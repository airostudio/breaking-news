import { Hono } from "hono";
import type {
  Env,
  ListingType,
  SubmissionRow,
  UserRow,
  VerificationNoteRow,
} from "../lib/types";
import { requireRole } from "../lib/auth";
import { mediaUrlFor } from "../lib/r2";
import { newId, isNonEmptyString, isPositiveInt } from "../lib/util";

const newsroom = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>();

const SOURCE_TYPES = ["on_ground_contact", "witness", "wire_service", "cross_reference", "other"];

function submissionSummary(s: SubmissionRow) {
  return {
    id: s.id,
    headline: s.headline,
    description: s.description,
    locationText: s.location_text,
    mediaType: s.media_type,
    thumbnailUrl: mediaUrlFor(s.thumbnail_key ?? s.object_key, { preview: true }),
    tags: JSON.parse(s.tags_json || "[]"),
    status: s.status,
    verificationScore: s.verification_score,
    createdAt: s.created_at,
  };
}

function noteJson(n: VerificationNoteRow) {
  return {
    id: n.id,
    submissionId: n.submission_id,
    author: n.author,
    note: n.note,
    sourceType: n.source_type,
    corroborates: !!n.corroborates,
    createdAt: n.created_at,
  };
}

newsroom.get("/queue", requireRole("editor", "admin"), async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM submissions WHERE status = 'pending_verification' ORDER BY created_at ASC"
  ).all<SubmissionRow>();
  return c.json({ submissions: (results ?? []).map(submissionSummary) });
});

newsroom.get("/submissions/:id", requireRole("editor", "admin"), async (c) => {
  const id = c.req.param("id");
  const submission = await c.env.DB.prepare("SELECT * FROM submissions WHERE id = ?")
    .bind(id)
    .first<SubmissionRow>();
  if (!submission) return c.json({ error: "Submission not found" }, 404);

  const contributor = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(submission.contributor_id)
    .first<UserRow>();

  const { results: notes } = await c.env.DB.prepare(
    "SELECT * FROM verification_notes WHERE submission_id = ? ORDER BY created_at ASC"
  )
    .bind(id)
    .all<VerificationNoteRow>();

  return c.json({
    submission: {
      ...submissionSummary(submission),
      mediaUrl: mediaUrlFor(submission.object_key), // full-res, editor-only
      contributor: contributor
        ? { id: contributor.id, name: contributor.name, email: contributor.email }
        : null,
      contributorContactMethod: submission.contributor_contact_method,
      contributorContactValue: submission.contributor_contact_value,
      capturedAt: submission.captured_at,
      lat: submission.lat,
      lng: submission.lng,
    },
    verificationChecklist: (notes ?? []).map(noteJson),
  });
});

newsroom.post("/submissions/:id/verification-notes", requireRole("editor", "admin"), async (c) => {
  const id = c.req.param("id");
  const submission = await c.env.DB.prepare("SELECT id FROM submissions WHERE id = ?")
    .bind(id)
    .first();
  if (!submission) return c.json({ error: "Submission not found" }, 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const { author, note, sourceType, corroborates } = body as Record<string, unknown>;

  if (!isNonEmptyString(author)) return c.json({ error: "author is required" }, 400);
  if (!isNonEmptyString(note)) return c.json({ error: "note is required" }, 400);
  if (typeof sourceType !== "string" || !SOURCE_TYPES.includes(sourceType)) {
    return c.json({ error: `sourceType must be one of ${SOURCE_TYPES.join(", ")}` }, 400);
  }
  if (typeof corroborates !== "boolean") {
    return c.json({ error: "corroborates must be a boolean" }, 400);
  }

  const noteId = newId();
  await c.env.DB.prepare(
    "INSERT INTO verification_notes (id, submission_id, author, note, source_type, corroborates) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(noteId, id, author, note, sourceType, corroborates ? 1 : 0)
    .run();

  const created = await c.env.DB.prepare("SELECT * FROM verification_notes WHERE id = ?")
    .bind(noteId)
    .first<VerificationNoteRow>();

  return c.json({ note: noteJson(created!) }, 201);
});

newsroom.post("/submissions/:id/verify", requireRole("editor", "admin"), async (c) => {
  const id = c.req.param("id");
  const submission = await c.env.DB.prepare("SELECT * FROM submissions WHERE id = ?")
    .bind(id)
    .first<SubmissionRow>();
  if (!submission) return c.json({ error: "Submission not found" }, 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const { decision, verificationScore, summary, listingType, buyNowPriceCents, auctionEndsAt, startingBidCents } =
    body as Record<string, unknown>;

  if (decision !== "verified" && decision !== "rejected") {
    return c.json({ error: 'decision must be "verified" or "rejected"' }, 400);
  }
  if (typeof verificationScore !== "number" || verificationScore < 0 || verificationScore > 100) {
    return c.json({ error: "verificationScore must be a number between 0 and 100" }, 400);
  }
  if (!isNonEmptyString(summary)) return c.json({ error: "summary is required" }, 400);

  if (decision === "rejected") {
    await c.env.DB.prepare("UPDATE submissions SET status = 'rejected', verification_score = ? WHERE id = ?")
      .bind(verificationScore, id)
      .run();
    // `summary` is recorded as a verification note for the audit trail.
    await c.env.DB.prepare(
      "INSERT INTO verification_notes (id, submission_id, author, note, source_type, corroborates) VALUES (?, ?, ?, ?, 'other', 0)"
    )
      .bind(newId(), id, "editor:decision", summary)
      .run();
    const updated = await c.env.DB.prepare("SELECT * FROM submissions WHERE id = ?").bind(id).first<SubmissionRow>();
    return c.json({ submission: submissionSummary(updated!) });
  }

  // decision === "verified": create the marketplace listing.
  if (listingType !== "buy_now" && listingType !== "auction" && listingType !== "both") {
    return c.json({ error: 'listingType must be "buy_now", "auction", or "both"' }, 400);
  }
  const lt = listingType as ListingType;
  if ((lt === "buy_now" || lt === "both") && !isPositiveInt(buyNowPriceCents)) {
    return c.json({ error: "buyNowPriceCents is required (positive integer) for this listingType" }, 400);
  }
  if ((lt === "auction" || lt === "both")) {
    if (!isNonEmptyString(auctionEndsAt) || Number.isNaN(Date.parse(auctionEndsAt))) {
      return c.json({ error: "auctionEndsAt (ISO date string) is required for this listingType" }, 400);
    }
    if (!isPositiveInt(startingBidCents)) {
      return c.json({ error: "startingBidCents is required (positive integer) for this listingType" }, 400);
    }
  }

  await c.env.DB.prepare("UPDATE submissions SET status = 'listed', verification_score = ? WHERE id = ?")
    .bind(verificationScore, id)
    .run();
  await c.env.DB.prepare(
    "INSERT INTO verification_notes (id, submission_id, author, note, source_type, corroborates) VALUES (?, ?, ?, ?, 'other', 1)"
  )
    .bind(newId(), id, "editor:decision", summary)
    .run();

  const listingId = newId();
  await c.env.DB.prepare(
    `INSERT INTO listings (id, submission_id, listing_type, buy_now_price_cents, starting_bid_cents, auction_ends_at, status)
     VALUES (?, ?, ?, ?, ?, ?, 'listed')`
  )
    .bind(
      listingId,
      id,
      lt,
      lt === "auction" ? null : (buyNowPriceCents as number),
      lt === "buy_now" ? null : (startingBidCents as number),
      lt === "buy_now" ? null : (auctionEndsAt as string)
    )
    .run();

  const updated = await c.env.DB.prepare("SELECT * FROM submissions WHERE id = ?").bind(id).first<SubmissionRow>();
  const listing = await c.env.DB.prepare("SELECT * FROM listings WHERE id = ?").bind(listingId).first();

  return c.json({ submission: submissionSummary(updated!), listing });
});

export default newsroom;

import { Hono } from "hono";
import type { BidRow, Env, ListingRow, SubmissionRow, TransactionRow, UserRow } from "../lib/types";
import { requireRole } from "../lib/auth";
import { mediaUrlFor } from "../lib/r2";
import { computeSplit, isPositiveInt, newId } from "../lib/util";

const marketplace = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>();

function maskBidder(outletId: string, name: string | undefined): string {
  // Bidder identity is masked in public bid history: show a stable short
  // fragment of their id rather than their real outlet name.
  const suffix = outletId.replace(/-/g, "").slice(-4).toUpperCase();
  return `Outlet #${suffix}`;
}

function listingSummary(l: ListingRow, s: SubmissionRow, highestBidCents: number | null) {
  return {
    id: l.id,
    listingType: l.listing_type,
    buyNowPriceCents: l.buy_now_price_cents,
    startingBidCents: l.starting_bid_cents,
    auctionEndsAt: l.auction_ends_at,
    status: l.status,
    createdAt: l.created_at,
    highestBidCents: highestBidCents,
    submission: {
      id: s.id,
      headline: s.headline,
      description: s.description,
      locationText: s.location_text,
      mediaType: s.media_type,
      previewUrl: mediaUrlFor(s.thumbnail_key ?? s.object_key, { preview: true }),
      tags: JSON.parse(s.tags_json || "[]"),
      capturedAt: s.captured_at,
    },
  };
}

async function getListingAndSubmission(env: Env, listingId: string) {
  const listing = await env.DB.prepare("SELECT * FROM listings WHERE id = ?").bind(listingId).first<ListingRow>();
  if (!listing) return null;
  const submission = await env.DB.prepare("SELECT * FROM submissions WHERE id = ?")
    .bind(listing.submission_id)
    .first<SubmissionRow>();
  if (!submission) return null;
  return { listing, submission };
}

async function highestBid(env: Env, listingId: string): Promise<BidRow | null> {
  return env.DB.prepare("SELECT * FROM bids WHERE listing_id = ? ORDER BY amount_cents DESC, created_at ASC LIMIT 1")
    .bind(listingId)
    .first<BidRow>();
}

marketplace.get("/listings", async (c) => {
  const status = c.req.query("status") || "listed";
  const tag = c.req.query("tag");
  const q = c.req.query("q");

  const { results } = await c.env.DB.prepare(
    "SELECT l.*, s.* , l.id as listing_id, l.status as listing_status, l.created_at as listing_created_at FROM listings l JOIN submissions s ON s.id = l.submission_id WHERE l.status = ? ORDER BY l.created_at DESC"
  )
    .bind(status)
    .all<any>();

  let rows = results ?? [];
  if (tag) {
    rows = rows.filter((r) => {
      try {
        const tags: string[] = JSON.parse(r.tags_json || "[]");
        return tags.includes(tag);
      } catch {
        return false;
      }
    });
  }
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter(
      (r) => r.headline.toLowerCase().includes(needle) || (r.description || "").toLowerCase().includes(needle)
    );
  }

  const listings = [];
  for (const r of rows) {
    const listing: ListingRow = {
      id: r.listing_id,
      submission_id: r.submission_id,
      listing_type: r.listing_type,
      buy_now_price_cents: r.buy_now_price_cents,
      starting_bid_cents: r.starting_bid_cents,
      auction_ends_at: r.auction_ends_at,
      status: r.listing_status,
      created_at: r.listing_created_at,
    };
    const submission: SubmissionRow = r;
    const hb = await highestBid(c.env, listing.id);
    listings.push(listingSummary(listing, submission, hb?.amount_cents ?? null));
  }

  return c.json({ listings });
});

marketplace.get("/listings/:id", async (c) => {
  const id = c.req.param("id");
  const found = await getListingAndSubmission(c.env, id);
  if (!found) return c.json({ error: "Listing not found" }, 404);
  const { listing, submission } = found;

  const { results: bids } = await c.env.DB.prepare(
    "SELECT * FROM bids WHERE listing_id = ? ORDER BY amount_cents DESC, created_at ASC"
  )
    .bind(id)
    .all<BidRow>();

  const bidHistory = (bids ?? []).map((b) => ({
    id: b.id,
    amountCents: b.amount_cents,
    bidder: maskBidder(b.outlet_id, undefined),
    createdAt: b.created_at,
  }));

  return c.json({
    listing: listingSummary(listing, submission, bidHistory[0]?.amountCents ?? null),
    bidHistory,
  });
});

marketplace.post("/listings/:id/bid", requireRole("outlet"), async (c) => {
  const id = c.req.param("id");
  const found = await getListingAndSubmission(c.env, id);
  if (!found) return c.json({ error: "Listing not found" }, 404);
  const { listing } = found;

  if (listing.status !== "listed") return c.json({ error: "Listing is not open for bidding" }, 400);
  if (listing.listing_type !== "auction" && listing.listing_type !== "both") {
    return c.json({ error: "This listing does not support auction bids" }, 400);
  }
  if (listing.auction_ends_at && Date.parse(listing.auction_ends_at) < Date.now()) {
    return c.json({ error: "Auction has already ended" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const { amountCents } = body as Record<string, unknown>;
  if (!isPositiveInt(amountCents)) return c.json({ error: "amountCents must be a positive integer" }, 400);

  const hb = await highestBid(c.env, id);
  const floor = Math.max(hb?.amount_cents ?? 0, listing.starting_bid_cents ?? 0);
  if (amountCents <= floor) {
    return c.json({ error: `amountCents must be greater than the current highest bid / starting bid (${floor})` }, 400);
  }

  const user = c.get("user");
  const bidId = newId();
  await c.env.DB.prepare("INSERT INTO bids (id, listing_id, outlet_id, amount_cents) VALUES (?, ?, ?, ?)")
    .bind(bidId, id, user.id, amountCents)
    .run();

  const bid = await c.env.DB.prepare("SELECT * FROM bids WHERE id = ?").bind(bidId).first<BidRow>();
  return c.json({ bid: { id: bid!.id, amountCents: bid!.amount_cents, createdAt: bid!.created_at } }, 201);
});

marketplace.post("/listings/:id/buy-now", requireRole("outlet"), async (c) => {
  const id = c.req.param("id");
  const found = await getListingAndSubmission(c.env, id);
  if (!found) return c.json({ error: "Listing not found" }, 404);
  const { listing, submission } = found;

  if (listing.status !== "listed") return c.json({ error: "Listing is not available" }, 400);
  if (listing.listing_type !== "buy_now" && listing.listing_type !== "both") {
    return c.json({ error: "This listing does not support buy-now" }, 400);
  }
  if (!isPositiveInt(listing.buy_now_price_cents ?? undefined)) {
    return c.json({ error: "This listing has no buy-now price configured" }, 400);
  }

  const user = c.get("user");
  const amountCents = listing.buy_now_price_cents as number;
  const { uploaderShareCents, bnoShareCents } = computeSplit(amountCents);

  const txId = newId();
  await c.env.DB.prepare(
    `INSERT INTO transactions (id, listing_id, buyer_outlet_id, amount_cents, uploader_share_cents, bno_share_cents)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(txId, id, user.id, amountCents, uploaderShareCents, bnoShareCents)
    .run();
  await c.env.DB.prepare("UPDATE listings SET status = 'sold' WHERE id = ?").bind(id).run();
  await c.env.DB.prepare("UPDATE submissions SET status = 'sold' WHERE id = ?").bind(submission.id).run();

  const transaction = await c.env.DB.prepare("SELECT * FROM transactions WHERE id = ?")
    .bind(txId)
    .first<TransactionRow>();

  return c.json({
    transaction: {
      id: transaction!.id,
      listingId: transaction!.listing_id,
      amountCents: transaction!.amount_cents,
      uploaderShareCents: transaction!.uploader_share_cents,
      bnoShareCents: transaction!.bno_share_cents,
      createdAt: transaction!.created_at,
    },
    mediaUrl: mediaUrlFor(submission.object_key),
  });
});

marketplace.get("/my-purchases", requireRole("outlet"), async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, l.submission_id as _submission_id FROM transactions t
     JOIN listings l ON l.id = t.listing_id
     WHERE t.buyer_outlet_id = ?
     ORDER BY t.created_at DESC`
  )
    .bind(user.id)
    .all<any>();

  const purchases = [];
  for (const t of results ?? []) {
    const submission = await c.env.DB.prepare("SELECT * FROM submissions WHERE id = ?")
      .bind(t._submission_id)
      .first<SubmissionRow>();
    if (!submission) continue;
    purchases.push({
      transactionId: t.id,
      listingId: t.listing_id,
      amountCents: t.amount_cents,
      purchasedAt: t.created_at,
      submission: {
        id: submission.id,
        headline: submission.headline,
        description: submission.description,
        mediaType: submission.media_type,
        mediaUrl: mediaUrlFor(submission.object_key), // full-res, licensed purchaser
      },
    });
  }

  return c.json({ purchases });
});

export default marketplace;

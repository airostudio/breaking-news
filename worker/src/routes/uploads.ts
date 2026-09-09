import { Hono } from "hono";
import type { Env, SubmissionRow, UserRow } from "../lib/types";
import { requireRole } from "../lib/auth";
import { createUploadId, verifyUploadId, objectKeyForPayload } from "../lib/uploadToken";
import { mediaUrlFor } from "../lib/r2";
import { newId, isNonEmptyString, isFiniteNumber, isPositiveInt } from "../lib/util";

const uploads = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>();

function submissionJson(s: SubmissionRow, earningsCents?: number) {
  return {
    id: s.id,
    contributorId: s.contributor_id,
    headline: s.headline,
    description: s.description,
    locationText: s.location_text,
    lat: s.lat,
    lng: s.lng,
    capturedAt: s.captured_at,
    mediaType: s.media_type,
    mediaUrl: mediaUrlFor(s.object_key, { preview: true }),
    contributorContactMethod: s.contributor_contact_method,
    contributorContactValue: s.contributor_contact_value,
    tags: JSON.parse(s.tags_json || "[]"),
    status: s.status,
    verificationScore: s.verification_score,
    createdAt: s.created_at,
    ...(earningsCents !== undefined ? { earningsCents } : {}),
  };
}

// Step 1: request a same-Worker "presigned-style" PUT URL.
// See src/lib/r2.ts for why this proxies through the Worker instead of doing
// real S3-style SigV4 presigning.
uploads.post("/request-url", requireRole("contributor"), async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const { filename, contentType, sizeBytes } = body as Record<string, unknown>;

  if (!isNonEmptyString(filename)) return c.json({ error: "filename is required" }, 400);
  if (!isNonEmptyString(contentType)) return c.json({ error: "contentType is required" }, 400);
  if (!isPositiveInt(sizeBytes)) return c.json({ error: "sizeBytes must be a positive integer" }, 400);

  const user = c.get("user");
  const uploadId = await createUploadId(c.env, {
    id: newId(),
    contributorId: user.id,
    filename,
    contentType,
    sizeBytes,
  });
  const payload = await verifyUploadId(c.env, uploadId);
  const objectKey = objectKeyForPayload(payload!);

  return c.json({
    uploadId,
    putUrl: `/api/uploads/${uploadId}/blob`,
    objectKey,
  });
});

// Step 2: frontend PUTs the raw file bytes here. Streamed straight into R2.
uploads.put("/:uploadId/blob", requireRole("contributor"), async (c) => {
  const uploadId = c.req.param("uploadId");
  const payload = await verifyUploadId(c.env, uploadId);
  if (!payload) return c.json({ error: "Invalid or expired uploadId" }, 400);

  const user = c.get("user");
  if (payload.contributorId !== user.id) {
    return c.json({ error: "Forbidden: this upload does not belong to you" }, 403);
  }

  if (!c.req.raw.body) return c.json({ error: "Request body is required" }, 400);

  const objectKey = objectKeyForPayload(payload);
  await c.env.BUCKET.put(objectKey, c.req.raw.body, {
    httpMetadata: { contentType: payload.contentType },
  });

  return c.json({ objectKey, uploaded: true });
});

// Step 3: attach editorial metadata, creating the `submissions` row.
uploads.post("/:uploadId/complete", requireRole("contributor"), async (c) => {
  const uploadId = c.req.param("uploadId");
  const payload = await verifyUploadId(c.env, uploadId);
  if (!payload) return c.json({ error: "Invalid or expired uploadId" }, 400);

  const user = c.get("user");
  if (payload.contributorId !== user.id) {
    return c.json({ error: "Forbidden: this upload does not belong to you" }, 403);
  }

  const objectKey = objectKeyForPayload(payload);
  const head = await c.env.BUCKET.head(objectKey);
  if (!head) {
    return c.json({ error: "Upload not found — PUT the file to putUrl before completing" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const {
    headline,
    description,
    locationText,
    lat,
    lng,
    capturedAt,
    mediaType,
    contributorContactMethod,
    contributorContactValue,
    tags,
  } = body as Record<string, unknown>;

  if (!isNonEmptyString(headline)) return c.json({ error: "headline is required" }, 400);
  if (mediaType !== "photo" && mediaType !== "video") {
    return c.json({ error: 'mediaType must be "photo" or "video"' }, 400);
  }
  if (lat !== undefined && lat !== null && !isFiniteNumber(lat)) {
    return c.json({ error: "lat must be a number" }, 400);
  }
  if (lng !== undefined && lng !== null && !isFiniteNumber(lng)) {
    return c.json({ error: "lng must be a number" }, 400);
  }
  if (tags !== undefined && !Array.isArray(tags)) {
    return c.json({ error: "tags must be an array of strings" }, 400);
  }

  const id = newId();
  // Simplification: a real pipeline would generate a distinct
  // watermarked/low-res thumbnail. Here the "preview" variant reuses the
  // same object; access gating (see routes/media.ts) is what distinguishes
  // preview vs full-res exposure, not the underlying bytes.
  const thumbnailKey = objectKey;

  await c.env.DB.prepare(
    `INSERT INTO submissions (
      id, contributor_id, headline, description, location_text, lat, lng,
      captured_at, media_type, object_key, thumbnail_key,
      contributor_contact_method, contributor_contact_value, tags_json, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification')`
  )
    .bind(
      id,
      user.id,
      headline,
      isNonEmptyString(description) ? description : "",
      isNonEmptyString(locationText) ? locationText : null,
      lat ?? null,
      lng ?? null,
      isNonEmptyString(capturedAt) ? capturedAt : null,
      mediaType,
      objectKey,
      thumbnailKey,
      isNonEmptyString(contributorContactMethod) ? contributorContactMethod : null,
      isNonEmptyString(contributorContactValue) ? contributorContactValue : null,
      JSON.stringify(Array.isArray(tags) ? tags : [])
    )
    .run();

  const submission = await c.env.DB.prepare("SELECT * FROM submissions WHERE id = ?")
    .bind(id)
    .first<SubmissionRow>();

  return c.json({ submission: submissionJson(submission!) }, 201);
});

uploads.get("/mine", requireRole("contributor"), async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM submissions WHERE contributor_id = ? ORDER BY created_at DESC"
  )
    .bind(user.id)
    .all<SubmissionRow>();

  const submissions = [];
  for (const s of results ?? []) {
    const earnings = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(t.uploader_share_cents), 0) as total
       FROM transactions t
       JOIN listings l ON l.id = t.listing_id
       WHERE l.submission_id = ?`
    )
      .bind(s.id)
      .first<{ total: number }>();
    submissions.push(submissionJson(s, earnings?.total ?? 0));
  }

  return c.json({ submissions });
});

export default uploads;

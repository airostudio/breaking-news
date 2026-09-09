// Same-Worker authenticated media proxy. See src/lib/r2.ts for why this
// replaces real presigned R2 GET URLs.
//
// Simplification: there is no real transcoding/watermarking pipeline here.
// `thumbnail_key` currently always points at the same underlying object as
// `object_key` (see routes/uploads.ts). "Preview" access is therefore
// enforced purely through the ACCESS RULES below (who is allowed to fetch
// which variant), not through actually serving a lower-resolution file.
// A production build would generate a genuinely downsampled/watermarked
// preview asset at upload time and gate + serve that distinct object.

import { Hono } from "hono";
import type { Env, SubmissionRow, UserRow } from "../lib/types";
import { getUserFromRequest } from "../lib/auth";

const media = new Hono<{ Bindings: Env }>();

media.get("/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const wantsPreview = c.req.query("preview") === "1";

  const submission = await c.env.DB.prepare(
    "SELECT * FROM submissions WHERE object_key = ? OR thumbnail_key = ?"
  )
    .bind(key, key)
    .first<SubmissionRow>();
  if (!submission) return c.json({ error: "Not found" }, 404);

  // `thumbnail_key` currently equals `object_key` (no distinct preview asset
  // is generated — see the file-level comment), so matching on the key alone
  // cannot distinguish preview vs. full-res: it would always be true and
  // defeat full-res gating entirely. The `?preview=1` query flag is the only
  // signal for "preview" today; the key comparison only matters once a real
  // pipeline gives thumbnail_key a genuinely distinct value.
  const isPreviewVariant =
    wantsPreview || (submission.thumbnail_key !== submission.object_key && key === submission.thumbnail_key);
  const isPubliclyListed = submission.status === "listed" || submission.status === "sold";

  const user: UserRow | null = await getUserFromRequest(c);

  let allowed = false;
  if (isPreviewVariant && isPubliclyListed) {
    // Marketplace browsing / public front page: preview art is open once a
    // story has cleared verification and been listed (or sold).
    allowed = true;
  } else if (user) {
    if (user.role === "editor" || user.role === "admin") {
      allowed = true;
    } else if (user.id === submission.contributor_id) {
      allowed = true; // contributor can always view their own upload
    } else if (isPreviewVariant) {
      // Not yet publicly listed, but an authenticated party with a
      // legitimate reason may still preview (e.g. contributor above already
      // covered; nothing else qualifies here) — left false by default.
      allowed = false;
    } else if (user.role === "outlet") {
      // Full-res is only for outlets that actually purchased this story.
      const purchase = await c.env.DB.prepare(
        `SELECT t.id FROM transactions t
         JOIN listings l ON l.id = t.listing_id
         WHERE l.submission_id = ? AND t.buyer_outlet_id = ?
         LIMIT 1`
      )
        .bind(submission.id, user.id)
        .first();
      allowed = !!purchase;
    }
  }

  if (!allowed) return c.json({ error: "Forbidden" }, 403);

  const object = await c.env.BUCKET.get(key);
  if (!object) return c.json({ error: "Media not found in storage" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", isPreviewVariant ? "public, max-age=300" : "private, no-store");

  return new Response(object.body as any, { headers });
});

export default media;

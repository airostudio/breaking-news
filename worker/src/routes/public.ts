import { Hono } from "hono";
import type { Env } from "../lib/types";
import { mediaUrlFor } from "../lib/r2";

const publicRoutes = new Hono<{ Bindings: Env }>();

// Only listings that have actually sold (i.e. licensed) are eligible to be
// "published" on the public front page, per the contract: "outlet credit
// once licensed & published".
publicRoutes.get("/stories", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.id as submission_id, s.headline, s.description, s.thumbnail_key, s.object_key,
            s.media_type, s.created_at, t.created_at as sold_at, u.name as outlet_name
     FROM transactions t
     JOIN listings l ON l.id = t.listing_id
     JOIN submissions s ON s.id = l.submission_id
     JOIN users u ON u.id = t.buyer_outlet_id
     WHERE l.status = 'sold'
     GROUP BY s.id
     ORDER BY t.created_at DESC`
  ).all<any>();

  const stories = (results ?? []).map((r) => ({
    id: r.submission_id,
    headline: r.headline,
    dek: (r.description || "").slice(0, 200),
    thumbnailUrl: mediaUrlFor(r.thumbnail_key ?? r.object_key, { preview: true }),
    mediaType: r.media_type,
    outletCredit: r.outlet_name,
    publishedAt: r.sold_at,
  }));

  return c.json({ stories });
});

publicRoutes.get("/stories/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT s.*, t.created_at as sold_at, u.name as outlet_name
     FROM submissions s
     JOIN listings l ON l.submission_id = s.id
     JOIN transactions t ON t.listing_id = l.id
     JOIN users u ON u.id = t.buyer_outlet_id
     WHERE s.id = ? AND l.status = 'sold'
     ORDER BY t.created_at DESC
     LIMIT 1`
  )
    .bind(id)
    .first<any>();

  if (!row) return c.json({ error: "Story not found" }, 404);

  return c.json({
    story: {
      id: row.id,
      headline: row.headline,
      dek: (row.description || "").slice(0, 200),
      description: row.description,
      locationText: row.location_text,
      capturedAt: row.captured_at,
      mediaType: row.media_type,
      thumbnailUrl: mediaUrlFor(row.thumbnail_key ?? row.object_key, { preview: true }),
      tags: JSON.parse(row.tags_json || "[]"),
      outletCredit: row.outlet_name,
      publishedAt: row.sold_at,
    },
  });
});

export default publicRoutes;

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, ListingRow, UserRow } from "./lib/types";
import { computeSplit, newId } from "./lib/util";

import authRoutes from "./routes/auth";
import uploadsRoutes from "./routes/uploads";
import newsroomRoutes from "./routes/newsroom";
import marketplaceRoutes from "./routes/marketplace";
import payoutsRoutes from "./routes/payouts";
import publicRoutes from "./routes/public";
import mediaRoutes from "./routes/media";

const app = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>();

// CORS: origin is configurable via the CORS_ORIGIN env var (wrangler.toml
// [vars] or a secret), defaulting to "*" for local dev.
app.use("*", async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN || "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  });
  return corsMiddleware(c, next);
});

app.get("/", (c) => c.json({ name: "BNO API", status: "ok" }));

app.route("/api/auth", authRoutes);
app.route("/api/uploads", uploadsRoutes);
app.route("/api/newsroom", newsroomRoutes);
app.route("/api/marketplace", marketplaceRoutes);
app.route("/api/payouts", payoutsRoutes);
app.route("/api/public", publicRoutes);
app.route("/api/media", mediaRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

/**
 * Closes expired auctions: for each `listings` row of type auction/both that
 * is still "listed" and past `auction_ends_at`, settles the highest bidder
 * as the buyer (or just closes it with no sale if there were no bids),
 * creating a `transactions` row with the server-computed 70/30 split.
 */
async function closeExpiredAuctions(env: Env): Promise<{ closed: number; sold: number }> {
  const nowIso = new Date().toISOString();
  const { results: expired } = await env.DB.prepare(
    `SELECT * FROM listings
     WHERE status = 'listed'
       AND listing_type IN ('auction', 'both')
       AND auction_ends_at IS NOT NULL
       AND auction_ends_at <= ?`
  )
    .bind(nowIso)
    .all<ListingRow>();

  let closed = 0;
  let sold = 0;

  for (const listing of expired ?? []) {
    const topBid = await env.DB.prepare(
      "SELECT * FROM bids WHERE listing_id = ? ORDER BY amount_cents DESC, created_at ASC LIMIT 1"
    )
      .bind(listing.id)
      .first<{ id: string; outlet_id: string; amount_cents: number }>();

    if (!topBid) {
      // No bids: close with no sale.
      await env.DB.prepare("UPDATE listings SET status = 'closed' WHERE id = ?").bind(listing.id).run();
      closed++;
      continue;
    }

    const { uploaderShareCents, bnoShareCents } = computeSplit(topBid.amount_cents);
    await env.DB.prepare(
      `INSERT INTO transactions (id, listing_id, buyer_outlet_id, amount_cents, uploader_share_cents, bno_share_cents)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(newId(), listing.id, topBid.outlet_id, topBid.amount_cents, uploaderShareCents, bnoShareCents)
      .run();
    await env.DB.prepare("UPDATE listings SET status = 'sold' WHERE id = ?").bind(listing.id).run();
    await env.DB.prepare("UPDATE submissions SET status = 'sold' WHERE id = ?").bind(listing.submission_id).run();
    sold++;
  }

  return { closed, sold };
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      closeExpiredAuctions(env).then((result) => {
        console.log(`[cron] auction close: closed=${result.closed} sold=${result.sold}`);
      })
    );
  },
};

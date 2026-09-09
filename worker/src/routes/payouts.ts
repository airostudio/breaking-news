import { Hono } from "hono";
import type { Env, UserRow } from "../lib/types";
import { requireRole } from "../lib/auth";

const payouts = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>();

payouts.get("/summary", requireRole("contributor"), async (c) => {
  const user = c.get("user");

  const { results } = await c.env.DB.prepare(
    `SELECT t.id as transaction_id, t.amount_cents, t.uploader_share_cents, t.created_at,
            s.id as submission_id, s.headline
     FROM transactions t
     JOIN listings l ON l.id = t.listing_id
     JOIN submissions s ON s.id = l.submission_id
     WHERE s.contributor_id = ?
     ORDER BY t.created_at DESC`
  )
    .bind(user.id)
    .all<{
      transaction_id: string;
      amount_cents: number;
      uploader_share_cents: number;
      created_at: string;
      submission_id: string;
      headline: string;
    }>();

  const rows = results ?? [];
  const lifetimeEarningsCents = rows.reduce((sum, r) => sum + r.uploader_share_cents, 0);

  // NOTE: Stripe Connect payout disbursement is not implemented (see
  // POST /api/payouts/connect stub below), so every recorded sale is
  // "pending" — none has actually been paid out to a bank account yet.
  // `paidCents` is always 0 until that integration exists.
  const pendingCents = lifetimeEarningsCents;
  const paidCents = 0;

  const bySubmission = rows.map((r) => ({
    submissionId: r.submission_id,
    headline: r.headline,
    transactionId: r.transaction_id,
    saleAmountCents: r.amount_cents,
    earnedCents: r.uploader_share_cents,
    status: "pending" as const,
    createdAt: r.created_at,
  }));

  return c.json({
    lifetimeEarningsCents,
    pendingCents,
    paidCents,
    bySubmission,
  });
});

payouts.post("/connect", requireRole("contributor"), async (c) => {
  return c.json({
    status: "not_implemented",
    message:
      "Stripe Connect onboarding is not wired up yet. TODO for a human: create a Stripe Connect Express account " +
      "for this contributor, generate an account link via stripe.accountLinks.create(), and redirect the user " +
      "there; then handle the account.updated webhook to mark them payout-ready before disbursing pendingCents " +
      "from /api/payouts/summary.",
  });
});

export default payouts;

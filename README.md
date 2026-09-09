# BNO — Breaking News Outlet

An exclusive breaking-news marketplace: local contributors upload raw footage/photos as news happens, BNO's newsroom verifies it by reaching out to on-the-ground contacts, witnesses, and other reliable sources, and verified stories are then licensed to news outlets — either as an instant **buy-now** or a competitive **auction**. Every sale pays the contributor **70%**, with **30%** to BNO.

See [`API_CONTRACT.md`](./API_CONTRACT.md) for the full API/data model spec both halves of the app were built against.

## Structure

- **`worker/`** — Cloudflare Worker backend (Hono + D1 + R2). Auth, upload intake, newsroom verification queue, marketplace (bidding/buy-now), scheduled auction close, payout summaries. See `worker/README.md` for setup (create a D1 database and R2 bucket, fill in `wrangler.toml`, run migrations).
- **`web/`** — Vite + React + TypeScript frontend styled as a professional broadsheet newspaper. See `web/README.md`.

## Quick start (local dev)

```bash
# 1. Backend
cd worker
npm install
# create D1 + R2 resources and fill in wrangler.toml (see worker/README.md), then:
npm run db:migrate
npm run dev        # http://localhost:8787

# 2. Frontend (new terminal)
cd web
npm install
npm run dev         # http://localhost:5173, calls the worker at http://localhost:8787
```

## How the revenue split works

The 70/30 split is computed **server-side only** (`computeSplit()` in the worker), on every buy-now purchase and every settled auction. Nothing about the split is ever trusted from the client. Contributors can track pending vs. paid earnings from their dashboard; outlets see the split disclosed on every listing before they buy or bid.

## Verification workflow

Every upload lands in the newsroom queue as `pending_verification`. Editors log dated verification notes against a submission — tagged by source type (on-the-ground contact, witness, wire service, cross-reference, other) and whether each note corroborates the footage — before rendering a verified/rejected decision with a confidence score. Only verified submissions become marketplace listings. This is a human-in-the-loop workflow today; the `verification_notes` table is the natural place to later plug in automated research/cross-referencing assistance.

## Known simplifications (by design, documented in code)

- **Media upload/delivery** goes through the Worker itself (`PUT`/`GET` proxied into the R2 binding) rather than AWS SigV4-style presigned URLs — avoids pulling in signing libraries for no real benefit inside a same-origin Worker.
- **Thumbnails** currently reuse the full object key; a real image-processing/watermarking pipeline for low-res previews is a follow-up, not implemented here. Preview vs. full-res access is gated by role/purchase state regardless.
- **Payouts** (`/api/payouts/connect`) is a stub — wiring real payouts (e.g. Stripe Connect) needs live business/API credentials only a human can provide.

## Deploying

Both halves deploy independently to Cloudflare:

- `cd worker && npm run deploy` (Cloudflare Workers)
- `cd web && npm run build` then deploy the `web/dist` static output to Cloudflare Pages (or any static host), pointing `VITE_API_BASE_URL` at the deployed Worker's URL.

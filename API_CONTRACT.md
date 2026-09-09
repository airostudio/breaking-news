# BNO (Breaking News Outlet) — API Contract

Backend: Cloudflare Worker (Hono) at `/worker`, using D1 (SQL) for metadata and R2 for raw media storage.
Frontend: Vite + React + TypeScript at `/web`, a professional newspaper-style site.

Base URL in dev: `http://localhost:8787`. In prod: same origin as Worker route, e.g. `https://api.bno.news`.
All JSON bodies. Auth via `Authorization: Bearer <token>` (simple JWT-ish session token issued at login/register — HMAC signed, stored in `sessions` table). Roles: `contributor` (local uploader), `outlet` (news media buyer/bidder), `editor` (BNO newsroom staff who verify), `admin`.

## Revenue split
Every sale (buy-now or winning bid) is recorded in `transactions` with `amount_cents`, `uploader_share_cents` (70%), `bno_share_cents` (30%). Split is computed server-side, never trusted from client.

## Auth
- `POST /api/auth/register` `{ name, email, password, role: "contributor"|"outlet" }` -> `{ token, user }`
- `POST /api/auth/login` `{ email, password }` -> `{ token, user }`
- `GET /api/auth/me` -> `{ user }`

## Upload portal (contributor)
- `POST /api/uploads/request-url` `{ filename, contentType, sizeBytes }` (auth: contributor)
  -> `{ uploadId, putUrl, objectKey }` — presigned-style PUT URL to R2 (Worker proxies/signs; since R2 presign needs S3-compatible signing, Worker either issues a direct-to-Worker upload stream or a signed URL via aws4fetch). Frontend PUTs raw file bytes to `putUrl`.
- `POST /api/uploads/:uploadId/complete` body with full metadata:
  ```
  {
    headline, description,
    locationText, lat, lng,
    capturedAt (ISO), mediaType: "photo"|"video",
    contributorContactMethod, contributorContactValue, // e.g. whatsapp/phone/email — for research desk to reach out
    tags: string[]
  }
  ```
  -> `{ submission }` (status: "pending_verification")
- `GET /api/uploads/mine` -> list of the contributor's own submissions + statuses + earnings

## Newsroom / verification desk (editor)
- `GET /api/newsroom/queue` -> pending submissions needing verification
- `GET /api/newsroom/submissions/:id` -> full detail incl. contributor contact, media URL (signed GET), verification checklist state
- `POST /api/newsroom/submissions/:id/verification-notes` `{ author, note, sourceType: "on_ground_contact"|"witness"|"wire_service"|"cross_reference"|"other", corroborates: boolean }` — append a research-desk note (this is where "reaching out to contacts on the ground / other reliable sources / witnesses" is logged)
- `POST /api/newsroom/submissions/:id/verify` `{ decision: "verified"|"rejected", verificationScore (0-100), summary }` -> on verified, submission becomes a marketplace `listing` (status "listed"); editor sets `listingType: "buy_now"|"auction"|"both"`, `buyNowPriceCents?`, `auctionEndsAt?`, `startingBidCents?`

## Marketplace (outlet)
- `GET /api/marketplace/listings?status=listed&tag=&q=` -> browse verified, licensable stories
- `GET /api/marketplace/listings/:id` -> detail incl. current highest bid, bid history (bidder names may be masked), preview (watermarked/low-res) media URL
- `POST /api/marketplace/listings/:id/bid` `{ amountCents }` (auth: outlet) -> validates > current highest & > startingBid; records bid
- `POST /api/marketplace/listings/:id/buy-now` (auth: outlet) -> immediately closes listing, creates `transaction`, grants exclusive license, computes 70/30 split
- Auction close: a scheduled Worker Cron (`/worker` triggers) closes expired auctions, settles highest bidder as buyer, creates transaction.
- `GET /api/marketplace/my-purchases` (outlet) -> licensed media, full-res signed GET URLs

## Payouts (contributor)
- `GET /api/payouts/summary` -> lifetime earnings, per-submission breakdown, pending vs paid
- (Stub) `POST /api/payouts/connect` — placeholder for Stripe Connect onboarding link; not a live integration, clearly marked TODO with instructions.

## Public site (no auth)
- `GET /api/public/stories` -> published/licensed story teasers for the homepage "front page" (headline, dek, thumbnail, outlet credit once licensed & published)
- `GET /api/public/stories/:id`

## Data model (D1 tables)
`users(id, name, email, password_hash, role, created_at)`
`sessions(token, user_id, expires_at)`
`submissions(id, contributor_id, headline, description, location_text, lat, lng, captured_at, media_type, object_key, thumbnail_key, contributor_contact_method, contributor_contact_value, tags_json, status, verification_score, created_at)`
`verification_notes(id, submission_id, author, note, source_type, corroborates, created_at)`
`listings(id, submission_id, listing_type, buy_now_price_cents, starting_bid_cents, auction_ends_at, status, created_at)`
`bids(id, listing_id, outlet_id, amount_cents, created_at)`
`transactions(id, listing_id, buyer_outlet_id, amount_cents, uploader_share_cents, bno_share_cents, created_at)`

## Frontend routes (web)
- `/` — Front page (public, newspaper masthead, breaking ticker, top licensed stories)
- `/story/:id` — public story page
- `/upload` — contributor upload portal (multi-step form + drag/drop, progress bar)
- `/dashboard` (contributor) — my submissions, statuses, earnings
- `/newsroom` (editor) — verification queue, submission detail w/ verification checklist & notes
- `/marketplace` (outlet) — browse listings, filters
- `/marketplace/:id` — listing detail, bid/buy-now
- `/purchases` (outlet) — licensed content library
- `/login`, `/register`

Design: broadsheet-newspaper aesthetic — serif display headlines (e.g. "Playfair Display" or "Libre Baskerville"), thin rules, byline/dateline typography, red "BREAKING" tag, dense grid front page, high contrast, light theme primary with dark-mode support.

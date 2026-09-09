# BNO Worker (Breaking News Outlet backend)

Cloudflare Worker (Hono) implementing the API in `../API_CONTRACT.md`, backed by D1 (relational
data) and R2 (raw media storage).

## Implementation notes vs. the contract

- **No SigV4 presigning.** Real S3-style presigned R2 URLs need AWS SigV4 signing, which is
  non-trivial to implement from a Worker without an extra library. Instead:
  - `POST /api/uploads/request-url` returns a `putUrl` that points **back at this same Worker**
    (e.g. `/api/uploads/:uploadId/blob`). The frontend `PUT`s the raw file bytes there with its
    normal `Authorization: Bearer` token, and the Worker streams the body straight into R2 via
    `env.BUCKET.put(key, request.body)`.
  - Media is served back out via same-Worker authenticated proxy endpoints, `GET
    /api/media/:key`, instead of presigned GET URLs. That route checks the caller's role /
    ownership / purchase status and streams the R2 object. A `?preview=1` variant is used for
    marketplace/public browsing.
  - There's no real watermarking/transcoding pipeline — "preview" vs. "full-res" access is
    enforced purely by the authorization rules in `src/routes/media.ts`, not by actually serving
    different bytes. This is called out in code comments.
  - See `src/lib/r2.ts` and `src/lib/uploadToken.ts` for details, including how the two-step
    upload flow works without an extra `uploads` D1 table (not in the contract's data model) —
    the `uploadId` itself is an HMAC-signed token carrying the object key/content-type/owner.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create the D1 database**

   ```bash
   npx wrangler d1 create bno-db
   ```

   Copy the `database_id` from the output into `wrangler.toml` under `[[d1_databases]]`.

3. **Create the R2 bucket**

   ```bash
   npx wrangler r2 bucket create bno-media
   ```

   Confirm the bucket name in `wrangler.toml` under `[[r2_buckets]]` matches (rename either side
   if you used a different name).

4. **Run the D1 migrations**

   ```bash
   npm run db:migrate            # local dev DB
   npm run db:migrate:remote     # apply to the real remote D1 database
   ```

5. **Set environment variables / secrets**

   `wrangler.toml` has a `SESSION_SECRET` under `[vars]` for local dev only — it signs session
   tokens (HMAC) and upload tokens. For production, remove it from `wrangler.toml` and set a real
   secret instead:

   ```bash
   npx wrangler secret put SESSION_SECRET
   ```

   Also set `CORS_ORIGIN` in `wrangler.toml` (`[vars]`) to your deployed frontend's origin (e.g.
   `https://bno.news`) once you're past local dev, where it defaults to `"*"`.

6. **Run locally**

   ```bash
   npm run dev
   ```

   This starts `wrangler dev`, serving the API at `http://localhost:8787` per the contract, with a
   local D1 (SQLite) and R2 simulated on disk.

7. **Deploy**

   ```bash
   npm run deploy
   ```

   This also registers the cron trigger (`*/5 * * * *`, in `wrangler.toml` under `[triggers]`)
   that closes expired auctions and settles the highest bidder, computing the 70/30 split
   server-side.

## Project layout

```
worker/
  wrangler.toml            # D1 / R2 bindings, cron trigger, CORS/session env vars
  migrations/0001_init.sql # D1 schema: users, sessions, submissions, verification_notes,
                            # listings, bids, transactions
  src/
    index.ts               # thin Hono app: mounts routers, CORS, scheduled() cron handler
    lib/
      types.ts             # Env bindings + row types
      auth.ts              # PBKDF2 password hashing, session issuance/validation, requireRole()
      uploadToken.ts        # signed uploadId tokens (bridges request-url -> blob -> complete)
      r2.ts                 # media URL helpers + design-decision notes
      util.ts               # id generation, revenue split, validation helpers
    routes/
      auth.ts               # register/login/me
      uploads.ts            # request-url, blob PUT, complete, mine
      newsroom.ts            # queue, submission detail, verification-notes, verify
      marketplace.ts         # listings, bid, buy-now, my-purchases
      payouts.ts             # summary, connect (stub)
      public.ts              # public stories feed
      media.ts               # authenticated media proxy (GET /api/media/:key)
```

## Roles

`contributor` (uploads footage), `outlet` (buys/bids), `editor` (newsroom verification staff),
`admin` (superset of editor). Enforced via `requireRole(...)` middleware in `src/lib/auth.ts`.

## Revenue split

Computed server-side only, in `src/lib/util.ts#computeSplit`:
`uploaderShareCents = Math.round(amountCents * 0.7)`, remainder to BNO. Applied identically for
buy-now purchases and for auctions settled by the cron job.

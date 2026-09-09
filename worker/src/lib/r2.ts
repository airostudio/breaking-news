// R2 helpers.
//
// NOTE on "presigned URLs": true S3-style presigned PUT/GET URLs for R2
// require AWS SigV4 request signing, which is non-trivial to implement from
// inside a Worker without pulling in an extra signing library (e.g.
// aws4fetch). For this build we deliberately avoid that complexity:
//
//   - Upload: `POST /api/uploads/request-url` returns a `putUrl` that points
//     BACK AT THIS SAME WORKER (same-origin), e.g. `/api/uploads/:id/blob`.
//     The frontend PUTs the raw file bytes there with its normal auth bearer
//     token; the Worker route streams `request.body` directly into R2 via
//     `env.BUCKET.put(key, request.body)`. No SigV4 needed.
//
//   - Download/serve: instead of a real presigned GET URL, we return
//     same-Worker authenticated proxy endpoints like `/api/media/:key`.
//     That route checks the caller's role/ownership/purchase status itself
//     and then streams the R2 object back, optionally serving a distinct
//     "preview" variant. This is a simplification of a real watermarking /
//     resolution-gating pipeline (out of scope here) — see routes/media.ts.
//
// This is an approved implementation detail per the build brief, not a
// deviation from the API contract; `putUrl` / media URLs are same-origin.

// Object key derivation for a given upload lives in `uploadToken.ts`
// (objectKeyForPayload) since it is namespaced by the signed upload token.

/**
 * Builds the same-Worker media proxy URL for a given object key. Object keys
 * only ever contain `[A-Za-z0-9._/-]` (see uploadToken.ts), so each path
 * segment is safe to place directly in the URL — encoding the whole key
 * would percent-escape its `/` separators and break route matching against
 * `GET /api/media/:key{.+}`.
 */
export function mediaUrlFor(key: string, opts?: { preview?: boolean }): string {
  const q = opts?.preview ? "?preview=1" : "";
  const encodedPath = key.split("/").map(encodeURIComponent).join("/");
  return `/api/media/${encodedPath}${q}`;
}

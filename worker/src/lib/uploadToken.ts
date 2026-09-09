// Self-contained, signed "uploadId" tokens.
//
// The API contract's data model has no dedicated `uploads` table — only
// `submissions` and the other listed tables. To bridge the two-step
// request-url -> PUT-blob -> complete flow without inventing an out-of-contract
// table, the uploadId itself carries its (signed) metadata: the underlying
// R2 object key, the uploading contributor's id, declared content-type and
// size. Each step verifies the HMAC signature (and re-derives the object key)
// rather than looking anything up in D1.
//
// Format: `${base64url(json)}.${hmacHex}`

import type { Env } from "./types";

interface UploadPayload {
  id: string; // random component, used to namespace the R2 key
  contributorId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(str.length + ((4 - (str.length % 4)) % 4), "=");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createUploadId(env: Env, payload: UploadPayload): Promise<string> {
  const json = JSON.stringify(payload);
  const encoded = toBase64Url(new TextEncoder().encode(json));
  const sig = await hmacHex(env.SESSION_SECRET, encoded);
  return `${encoded}.${sig}`;
}

export async function verifyUploadId(env: Env, uploadId: string): Promise<UploadPayload | null> {
  const dot = uploadId.lastIndexOf(".");
  if (dot === -1) return null;
  const encoded = uploadId.slice(0, dot);
  const sig = uploadId.slice(dot + 1);
  const expected = await hmacHex(env.SESSION_SECRET, encoded);
  if (expected !== sig) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded));
    const payload = JSON.parse(json) as UploadPayload;
    if (
      typeof payload.id !== "string" ||
      typeof payload.contributorId !== "string" ||
      typeof payload.filename !== "string" ||
      typeof payload.contentType !== "string" ||
      typeof payload.sizeBytes !== "number"
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function objectKeyForPayload(payload: UploadPayload): string {
  const safeName = payload.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "file";
  return `submissions/${payload.id}/${safeName}`;
}

// Password hashing (PBKDF2 via Web Crypto — Workers-runtime only, no Node APIs)
// and bearer-session issuance/validation backed by the `sessions` D1 table.
//
// Session tokens are HMAC-signed so a token cannot be forged even though it is
// also opaque-looked-up in D1: token = "<randomId>.<hmacHex>" where hmacHex =
// HMAC-SHA256(SESSION_SECRET, randomId). We verify the signature first (cheap,
// no DB hit for garbage tokens) and then confirm the token still exists in
// `sessions` and has not expired.

import type { Context, MiddlewareHandler, Next } from "hono";
import type { Env, Role, UserRow } from "./types";

type AppEnv = { Bindings: Env; Variables: { user: UserRow } };

const PBKDF2_ITERATIONS = 100_000;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufToHex(salt.buffer as ArrayBuffer)}$${bufToHex(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  const salt = hexToBuf(parts[2]);
  const expectedHex = parts[3];
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const actualHex = bufToHex(derived);
  // constant-time-ish compare
  if (actualHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) {
    diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
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
  return bufToHex(sig);
}

export async function issueSession(env: Env, userId: string): Promise<{ token: string; expiresAt: string }> {
  const randomId = crypto.randomUUID();
  const sig = await hmacHex(env.SESSION_SECRET, randomId);
  const token = `${randomId}.${sig}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(token, userId, expiresAt)
    .run();
  return { token, expiresAt };
}

async function verifyTokenSignature(env: Env, token: string): Promise<boolean> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const randomId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacHex(env.SESSION_SECRET, randomId);
  return expected === sig;
}

/** Resolves the bearer token in the Authorization header to a user, or null. */
export async function getUserFromRequest<E extends { Bindings: Env }>(
  c: Context<E>
): Promise<UserRow | null> {
  const authHeader = c.req.header("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();

  if (!(await verifyTokenSignature(c.env, token))) return null;

  const session = await c.env.DB.prepare("SELECT * FROM sessions WHERE token = ?")
    .bind(token)
    .first<{ token: string; user_id: string; expires_at: string }>();
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    // expired — best-effort cleanup, don't block on it
    c.executionCtx?.waitUntil?.(
      c.env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run()
    );
    return null;
  }

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(session.user_id)
    .first<UserRow>();
  return user ?? null;
}

/** Middleware: requires a valid session, sets `c.set("user", ...)`. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await getUserFromRequest(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", user);
  await next();
};

/** Middleware factory: requires a valid session AND one of the given roles. */
export function requireRole(...roles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = await getUserFromRequest(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (!roles.includes(user.role)) {
      return c.json({ error: `Forbidden: requires role ${roles.join(" or ")}` }, 403);
    }
    c.set("user", user);
    await next();
  };
}

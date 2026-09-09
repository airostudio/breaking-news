import { Hono } from "hono";
import type { Env, Role, UserRow } from "../lib/types";
import { hashPassword, verifyPassword, issueSession, requireAuth } from "../lib/auth";
import { newId, isNonEmptyString } from "../lib/util";

const auth = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>();

function publicUser(u: UserRow) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.created_at };
}

auth.post("/register", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const { name, email, password, role } = body as Record<string, unknown>;

  if (!isNonEmptyString(name)) return c.json({ error: "name is required" }, 400);
  if (!isNonEmptyString(email) || !email.includes("@")) return c.json({ error: "valid email is required" }, 400);
  if (!isNonEmptyString(password) || password.length < 8) {
    return c.json({ error: "password is required and must be at least 8 characters" }, 400);
  }
  if (role !== "contributor" && role !== "outlet") {
    return c.json({ error: 'role must be "contributor" or "outlet"' }, 400);
  }

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email.toLowerCase())
    .first();
  if (existing) return c.json({ error: "An account with this email already exists" }, 400);

  const id = newId();
  const passwordHash = await hashPassword(password);
  const roleValue: Role = role;
  await c.env.DB.prepare(
    "INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, name, email.toLowerCase(), passwordHash, roleValue)
    .run();

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  if (!user) return c.json({ error: "Failed to create account" }, 500);

  const { token } = await issueSession(c.env, user.id);
  return c.json({ token, user: publicUser(user) }, 201);
});

auth.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const { email, password } = body as Record<string, unknown>;

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email.toLowerCase())
    .first<UserRow>();
  if (!user) return c.json({ error: "Invalid email or password" }, 401);

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return c.json({ error: "Invalid email or password" }, 401);

  const { token } = await issueSession(c.env, user.id);
  return c.json({ token, user: publicUser(user) });
});

auth.get("/me", requireAuth, async (c) => {
  const user = c.get("user");
  return c.json({ user: publicUser(user) });
});

export default auth;

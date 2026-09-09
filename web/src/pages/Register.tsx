import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import type { Role } from "../lib/types";
import { roleHome } from "./Login";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("contributor");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await register({ name, email, password, role });
      navigate(roleHome(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page container">
      <div className="auth-shell">
        <div className="page-header">
          <div className="eyebrow">Join BNO</div>
          <h1>Create Account</h1>
          <p className="lead">
            Contributors submit breaking footage; outlets license verified stories.
          </p>
        </div>
        <form className="panel" onSubmit={onSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-field">
            <label>I am a…</label>
            <div className="role-choice">
              <div
                className={`role-option ${role === "contributor" ? "selected" : ""}`}
                onClick={() => setRole("contributor")}
              >
                Contributor
                <div className="hint" style={{ fontWeight: 400, marginTop: 4 }}>
                  Upload &amp; sell raw footage
                </div>
              </div>
              <div
                className={`role-option ${role === "outlet" ? "selected" : ""}`}
                onClick={() => setRole("outlet")}
              >
                News Outlet
                <div className="hint" style={{ fontWeight: 400, marginTop: 4 }}>
                  License &amp; bid on stories
                </div>
              </div>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="name">Full name / organization</label>
            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Create Account"}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

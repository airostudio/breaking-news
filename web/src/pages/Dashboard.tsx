import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { formatCents, formatDateline } from "../lib/format";
import type { PayoutSummary, Submission } from "../lib/types";

export default function Dashboard() {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.myUploads(), api.payoutsSummary()])
      .then(([uploads, pay]) => {
        if (cancelled) return;
        setSubmissions(uploads.submissions);
        setSummary(pay);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page container">
      <div className="page-header">
        <div className="eyebrow">Contributor Dashboard</div>
        <h1>My Submissions &amp; Earnings</h1>
        <p className="lead">
          Track verification status and your 70% share of every license sale.
        </p>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="panel">
        <div className="section-title">Earnings Summary</div>
        {summary ? (
          <div className="form-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <Stat label="Lifetime earnings" value={formatCents(summary.lifetime_earnings_cents)} />
            <Stat label="Paid out" value={formatCents(summary.paid_cents)} />
            <Stat label="Pending" value={formatCents(summary.pending_cents)} />
          </div>
        ) : !error ? (
          <div className="loading-state">Loading earnings…</div>
        ) : (
          <p className="hint">Earnings summary unavailable.</p>
        )}
        <p className="hint" style={{ marginTop: 12 }}>
          Contributors receive 70% of every sale price; BNO retains 30% to fund
          verification and distribution.{" "}
          <button
            className="linklike"
            type="button"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              textDecoration: "underline",
              cursor: "pointer",
              font: "inherit",
            }}
            onClick={() => api.connectPayouts().then((r) => alert(r.message))}
          >
            Set up payout account
          </button>
        </p>
      </div>

      <div className="panel">
        <div className="section-title">Submissions</div>
        {!submissions && !error && <div className="loading-state">Loading submissions…</div>}
        {submissions && submissions.length === 0 && (
          <div className="empty-state">
            You haven&rsquo;t submitted anything yet. <Link to="/upload">Upload your first story</Link>.
          </div>
        )}
        {submissions && submissions.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Headline</th>
                  <th>Captured</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Earnings (your 70%)</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.headline}</td>
                    <td>{formatDateline(s.captured_at)}</td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td>{s.verification_score ?? "—"}</td>
                    <td>{formatCents(s.uploader_share_cents ?? s.earnings_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="hint">{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}

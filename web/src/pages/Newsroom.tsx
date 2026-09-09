import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { formatDateline } from "../lib/format";
import type { Submission } from "../lib/types";

export default function Newsroom() {
  const [queue, setQueue] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .newsroomQueue()
      .then((res) => {
        if (!cancelled) setQueue(res.submissions);
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
        <div className="eyebrow">BNO Newsroom</div>
        <h1>Verification Queue</h1>
        <p className="lead">
          Corroborate submissions with on-the-ground contacts, witnesses, and wire
          services before listing.
        </p>
      </div>

      {error && <div className="form-error">{error}</div>}
      {!queue && !error && <div className="loading-state">Loading queue…</div>}
      {queue && queue.length === 0 && (
        <div className="empty-state">The verification queue is empty. Nice work.</div>
      )}

      {queue && queue.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Headline</th>
                <th>Media</th>
                <th>Location</th>
                <th>Captured</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((s) => (
                <tr key={s.id}>
                  <td>{s.headline}</td>
                  <td>{s.media_type}</td>
                  <td>{s.location_text || "—"}</td>
                  <td>{formatDateline(s.captured_at)}</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td>
                    <Link className="btn btn-outline" to={`/newsroom/${s.id}`}>
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import * as api from "../lib/api";
import { formatCents } from "../lib/format";
import type { Listing } from "../lib/types";

export default function Purchases() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .myPurchases()
      .then((res) => {
        if (!cancelled) setListings(res.listings);
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
        <div className="eyebrow">Outlet Library</div>
        <h1>My Licensed Media</h1>
        <p className="lead">Full-resolution, exclusively licensed footage and photography.</p>
      </div>

      {error && <div className="form-error">{error}</div>}
      {!listings && !error && <div className="loading-state">Loading purchases…</div>}
      {listings && listings.length === 0 && (
        <div className="empty-state">You haven&rsquo;t licensed any stories yet.</div>
      )}

      {listings && listings.length > 0 && (
        <div className="listings-grid">
          {listings.map((l) => (
            <div className="listing-card" key={l.id}>
              {l.thumbnail_url && <img className="thumb" src={l.thumbnail_url} alt="" />}
              <div className="body">
                <h3>{l.headline}</h3>
                <p className="hint">{formatCents(l.buy_now_price_cents || l.highest_bid_cents)}</p>
                {l.preview_url && (
                  <a className="btn btn-outline" href={l.preview_url} target="_blank" rel="noreferrer">
                    Open full-res media
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

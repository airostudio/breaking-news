import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import * as api from "../lib/api";
import { countdown, formatCents } from "../lib/format";
import type { Listing } from "../lib/types";

export default function Marketplace() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [, forceTick] = useState(0);

  function load(params: { q?: string; tag?: string } = {}) {
    api
      .listListings({ status: "listed", q: params.q, tag: params.tag })
      .then((res) => setListings(res.listings))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  function onFilter(e: FormEvent) {
    e.preventDefault();
    load({ q, tag });
  }

  return (
    <div className="page container">
      <div className="page-header">
        <div className="eyebrow">Licensing Marketplace</div>
        <h1>Verified Breaking Stories</h1>
        <p className="lead">Browse newsroom-verified footage available for exclusive license.</p>
      </div>

      <form className="filter-bar" onSubmit={onFilter}>
        <input
          type="text"
          placeholder="Search headlines…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          type="text"
          placeholder="Filter by tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
        <button className="btn btn-outline" type="submit">
          Apply
        </button>
      </form>

      {error && <div className="form-error">{error}</div>}
      {!listings && !error && <div className="loading-state">Loading listings…</div>}
      {listings && listings.length === 0 && (
        <div className="empty-state">No listings match your filters right now.</div>
      )}

      {listings && listings.length > 0 && (
        <div className="listings-grid">
          {listings.map((l) => (
            <Link className="listing-card" key={l.id} to={`/marketplace/${l.id}`}>
              {l.thumbnail_url && <img className="thumb" src={l.thumbnail_url} alt="" />}
              <div className="body">
                <span className="listing-type-tag">{l.listing_type.replace("_", " ")}</span>
                <h3>{l.headline}</h3>
                <div className="listing-meta-row">
                  <span className="price-tag">
                    {l.highest_bid_cents
                      ? `Bid: ${formatCents(l.highest_bid_cents)}`
                      : l.buy_now_price_cents
                      ? formatCents(l.buy_now_price_cents)
                      : l.starting_bid_cents
                      ? `From ${formatCents(l.starting_bid_cents)}`
                      : "—"}
                  </span>
                  {l.auction_ends_at && (
                    <span className="countdown-chip">{countdown(l.auction_ends_at)}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "../lib/api";
import { countdown, formatCents, formatDateTime } from "../lib/format";
import type { Bid, Listing } from "../lib/types";

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, forceTick] = useState(0);

  function load() {
    if (!id) return;
    api
      .getListing(id)
      .then((res) => {
        setListing(res.listing);
        setBids(res.bids);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(load, [id]);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function submitBid() {
    if (!id || !bidAmount) return;
    setActionError(null);
    setBusy(true);
    try {
      await api.placeBid(id, Math.round(Number(bidAmount) * 100));
      setBidAmount("");
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function doBuyNow() {
    if (!id) return;
    setActionError(null);
    setBusy(true);
    try {
      await api.buyNow(id);
      navigate("/purchases");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="page container">
        <div className="empty-state">
          {error} <Link to="/marketplace">Back to marketplace</Link>
        </div>
      </div>
    );
  }

  if (!listing) return <div className="loading-state">Loading listing…</div>;

  const isVideo = listing.preview_url && /\.(mp4|mov|webm)(\?|$)/i.test(listing.preview_url);
  const canBid = listing.listing_type !== "buy_now" && listing.status === "listed";
  const canBuyNow =
    (listing.listing_type === "buy_now" || listing.listing_type === "both") &&
    listing.status === "listed" &&
    !!listing.buy_now_price_cents;

  const minBid = Math.max(
    listing.highest_bid_cents || 0,
    listing.starting_bid_cents || 0,
  );

  return (
    <div className="page container">
      <div className="page-header">
        <span className="listing-type-tag">{listing.listing_type.replace("_", " ")}</span>
        <h1>{listing.headline}</h1>
      </div>

      <div className="detail-grid">
        <div>
          {listing.preview_url && (
            <div className="media-frame panel">
              {isVideo ? (
                <video src={listing.preview_url} controls />
              ) : (
                <img src={listing.preview_url} alt={listing.headline} />
              )}
            </div>
          )}
          <div className="panel">
            <div className="section-title">Description</div>
            <p>{listing.description}</p>
            {listing.tags && listing.tags.length > 0 && (
              <div className="tag-list">
                {listing.tags.map((t) => (
                  <span className="tag-pill" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="section-title">Bid History</div>
            {bids.length === 0 && <p className="hint">No bids yet.</p>}
            {bids.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bidder</th>
                    <th>Amount</th>
                    <th>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((b) => (
                    <tr key={b.id}>
                      <td>{b.bidder_name || "Masked bidder"}</td>
                      <td>{formatCents(b.amount_cents)}</td>
                      <td>{formatDateTime(b.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="section-title">License This Story</div>
            <div className="split-note">
              70% of this license fee goes directly to the contributor who captured
              this footage. BNO retains 30% to fund verification and distribution.
            </div>

            {actionError && <div className="form-error">{actionError}</div>}

            {listing.highest_bid_cents ? (
              <p>
                Current highest bid: <strong>{formatCents(listing.highest_bid_cents)}</strong>
              </p>
            ) : listing.starting_bid_cents ? (
              <p>
                Starting bid: <strong>{formatCents(listing.starting_bid_cents)}</strong>
              </p>
            ) : null}

            {listing.auction_ends_at && (
              <p className="countdown-chip" style={{ fontSize: 14 }}>
                {countdown(listing.auction_ends_at)}
              </p>
            )}

            {canBid && (
              <div style={{ marginBottom: 16 }}>
                <div className="form-field">
                  <label htmlFor="bidAmount">Your bid (USD)</label>
                  <span className="hint">Must exceed {formatCents(minBid)}</span>
                  <input
                    id="bidAmount"
                    type="number"
                    min={minBid / 100}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                  />
                </div>
                <button className="btn btn-outline btn-block" type="button" onClick={submitBid} disabled={busy}>
                  {busy ? "Placing bid…" : "Place Bid"}
                </button>
              </div>
            )}

            {canBuyNow && (
              <button className="btn btn-primary btn-block" type="button" onClick={doBuyNow} disabled={busy}>
                {busy
                  ? "Processing…"
                  : `Buy Now — Exclusive License (${formatCents(listing.buy_now_price_cents)})`}
              </button>
            )}

            {listing.status !== "listed" && (
              <p className="hint">This listing is no longer active ({listing.status}).</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

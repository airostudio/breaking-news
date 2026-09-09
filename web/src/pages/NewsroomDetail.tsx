import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../lib/auth";
import { formatDateTime } from "../lib/format";
import type { SourceType, Submission, VerificationNote } from "../lib/types";

const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: "on_ground_contact", label: "On-the-ground contact" },
  { value: "witness", label: "Witness" },
  { value: "wire_service", label: "Wire service" },
  { value: "cross_reference", label: "Cross-reference" },
  { value: "other", label: "Other" },
];

export default function NewsroomDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [notes, setNotes] = useState<VerificationNote[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [noteAuthor, setNoteAuthor] = useState(user?.name || "");
  const [noteText, setNoteText] = useState("");
  const [noteSource, setNoteSource] = useState<SourceType>("on_ground_contact");
  const [noteCorroborates, setNoteCorroborates] = useState(true);
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const [decision, setDecision] = useState<"verified" | "rejected">("verified");
  const [score, setScore] = useState(80);
  const [summary, setSummary] = useState("");
  const [listingType, setListingType] = useState<"buy_now" | "auction" | "both">("both");
  const [buyNowPrice, setBuyNowPrice] = useState("");
  const [startingBid, setStartingBid] = useState("");
  const [auctionEndsAt, setAuctionEndsAt] = useState("");
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  function load() {
    if (!id) return;
    api
      .newsroomSubmission(id)
      .then((res) => {
        setSubmission(res.submission);
        setNotes(res.notes);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(load, [id]);

  async function addNote() {
    if (!id || !noteText.trim() || !noteAuthor.trim()) return;
    setNoteSubmitting(true);
    try {
      await api.addVerificationNote(id, {
        author: noteAuthor,
        note: noteText,
        sourceType: noteSource,
        corroborates: noteCorroborates,
      });
      setNoteText("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setNoteSubmitting(false);
    }
  }

  async function submitDecision() {
    if (!id) return;
    setDecisionSubmitting(true);
    setDecisionError(null);
    try {
      await api.submitVerification(id, {
        decision,
        verificationScore: score,
        summary,
        ...(decision === "verified"
          ? {
              listingType,
              buyNowPriceCents:
                listingType !== "auction" && buyNowPrice ? Math.round(Number(buyNowPrice) * 100) : undefined,
              startingBidCents:
                listingType !== "buy_now" && startingBid ? Math.round(Number(startingBid) * 100) : undefined,
              auctionEndsAt:
                listingType !== "buy_now" && auctionEndsAt
                  ? new Date(auctionEndsAt).toISOString()
                  : undefined,
            }
          : {}),
      });
      navigate("/newsroom");
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : String(err));
    } finally {
      setDecisionSubmitting(false);
    }
  }

  if (error) {
    return (
      <div className="page container">
        <div className="empty-state">
          {error} <Link to="/newsroom">Back to queue</Link>
        </div>
      </div>
    );
  }

  if (!submission) return <div className="loading-state">Loading submission…</div>;

  const isVideo = submission.media_type === "video";

  return (
    <div className="page container">
      <div className="page-header">
        <div className="eyebrow">Newsroom Review</div>
        <h1>{submission.headline}</h1>
        <div className="byline-row" style={{ marginTop: 6 }}>
          <StatusBadge status={submission.status} />
          <span>{submission.location_text}</span>
          <span>{formatDateTime(submission.captured_at)}</span>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          {submission.media_url && (
            <div className="media-frame panel">
              {isVideo ? (
                <video src={submission.media_url} controls />
              ) : (
                <img src={submission.media_url} alt={submission.headline} />
              )}
            </div>
          )}

          <div className="panel">
            <div className="section-title">Description</div>
            <p>{submission.description}</p>
            {submission.tags && submission.tags.length > 0 && (
              <div className="tag-list">
                {submission.tags.map((t) => (
                  <span className="tag-pill" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="section-title">Contributor Contact</div>
            <div className="contact-box">
              <strong>{submission.contributor_contact_method}:</strong>{" "}
              {submission.contributor_contact_value}
              <div className="hint" style={{ marginTop: 6 }}>
                Use this to corroborate the footage with the person on the ground.
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="section-title">Verification Notes</div>
            <div className="notes-list">
              {notes.length === 0 && <p className="hint">No notes yet.</p>}
              {notes.map((n) => (
                <div key={n.id} className={`note-item ${n.corroborates ? "corroborates" : ""}`}>
                  <div className="note-meta">
                    <span>{n.author}</span>
                    <span>&middot;</span>
                    <span>{SOURCE_TYPES.find((s) => s.value === n.source_type)?.label || n.source_type}</span>
                    <span>&middot;</span>
                    <span>{n.corroborates ? "Corroborates" : "Does not corroborate"}</span>
                    <span>&middot;</span>
                    <span>{formatDateTime(n.created_at)}</span>
                  </div>
                  <div>{n.note}</div>
                </div>
              ))}
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="noteAuthor">Author</label>
                <input
                  id="noteAuthor"
                  type="text"
                  value={noteAuthor}
                  onChange={(e) => setNoteAuthor(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="noteSource">Source type</label>
                <select
                  id="noteSource"
                  value={noteSource}
                  onChange={(e) => setNoteSource(e.target.value as SourceType)}
                >
                  {SOURCE_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="noteText">Note</label>
              <textarea
                id="noteText"
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
            </div>
            <div className="checkbox-field form-field">
              <input
                id="noteCorroborates"
                type="checkbox"
                checked={noteCorroborates}
                onChange={(e) => setNoteCorroborates(e.target.checked)}
              />
              <label htmlFor="noteCorroborates">This source corroborates the footage</label>
            </div>
            <button className="btn btn-outline" type="button" onClick={addNote} disabled={noteSubmitting}>
              {noteSubmitting ? "Adding…" : "Add note"}
            </button>
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="section-title">Final Decision</div>
            {decisionError && <div className="form-error">{decisionError}</div>}

            <div className="form-field">
              <label htmlFor="decision">Decision</label>
              <select
                id="decision"
                value={decision}
                onChange={(e) => setDecision(e.target.value as "verified" | "rejected")}
              >
                <option value="verified">Verify &amp; list</option>
                <option value="rejected">Reject</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="score">Verification score (0-100)</label>
              <input
                id="score"
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
              />
            </div>

            <div className="form-field">
              <label htmlFor="summary">Summary</label>
              <textarea
                id="summary"
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            {decision === "verified" && (
              <>
                <div className="form-field">
                  <label htmlFor="listingType">Listing type</label>
                  <select
                    id="listingType"
                    value={listingType}
                    onChange={(e) => setListingType(e.target.value as typeof listingType)}
                  >
                    <option value="buy_now">Buy now only</option>
                    <option value="auction">Auction only</option>
                    <option value="both">Buy now + auction</option>
                  </select>
                </div>
                {listingType !== "auction" && (
                  <div className="form-field">
                    <label htmlFor="buyNowPrice">Buy-now price (USD)</label>
                    <input
                      id="buyNowPrice"
                      type="number"
                      min={0}
                      value={buyNowPrice}
                      onChange={(e) => setBuyNowPrice(e.target.value)}
                    />
                  </div>
                )}
                {listingType !== "buy_now" && (
                  <>
                    <div className="form-field">
                      <label htmlFor="startingBid">Starting bid (USD)</label>
                      <input
                        id="startingBid"
                        type="number"
                        min={0}
                        value={startingBid}
                        onChange={(e) => setStartingBid(e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="auctionEndsAt">Auction ends</label>
                      <input
                        id="auctionEndsAt"
                        type="datetime-local"
                        value={auctionEndsAt}
                        onChange={(e) => setAuctionEndsAt(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            <button
              className="btn btn-primary btn-block"
              type="button"
              onClick={submitDecision}
              disabled={decisionSubmitting}
            >
              {decisionSubmitting
                ? "Submitting…"
                : decision === "verified"
                ? "Verify & list"
                : "Reject submission"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

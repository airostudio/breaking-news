import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { publicStory } from "../lib/api";
import { formatDateline } from "../lib/format";
import type { PublicStory } from "../lib/types";

export default function Story() {
  const { id } = useParams<{ id: string }>();
  const [story, setStory] = useState<PublicStory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setStory(null);
    setError(null);
    publicStory(id)
      .then((res) => {
        if (!cancelled) setStory(res.story);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="page container">
        <div className="empty-state">
          Story not found. <Link to="/">Return to the front page</Link>.
        </div>
      </div>
    );
  }

  if (!story) return <div className="loading-state">Loading story…</div>;

  return (
    <div className="page container">
      <article style={{ maxWidth: 780, margin: "0 auto" }}>
        <span className="breaking-tag">Breaking</span>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", lineHeight: 1.1, margin: "6px 0 10px" }}>
          {story.headline}
        </h1>
        {story.dek && <p className="dek" style={{ fontSize: "1.2rem" }}>{story.dek}</p>}
        <div className="byline-row" style={{ marginBottom: 18 }}>
          {story.location_text && <span>{story.location_text}</span>}
          <span>{formatDateline(story.captured_at || story.created_at)}</span>
          {story.outlet_credit && (
            <span className="outlet-credit">Licensed by {story.outlet_credit}</span>
          )}
        </div>
        <hr className="rule" style={{ marginBottom: 20 }} />
        {story.media_url && (
          <div className="media-frame" style={{ marginBottom: 20 }}>
            {/^https?:\/\/.+\.(mp4|mov|webm)(\?|$)/i.test(story.media_url) ? (
              <video src={story.media_url} controls />
            ) : (
              <img src={story.media_url} alt={story.headline} />
            )}
          </div>
        )}
        {story.description && (
          <p style={{ fontSize: "1.05rem", whiteSpace: "pre-wrap" }}>{story.description}</p>
        )}
        {story.tags && story.tags.length > 0 && (
          <div className="tag-list">
            {story.tags.map((t) => (
              <span className="tag-pill" key={t}>
                {t}
              </span>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}

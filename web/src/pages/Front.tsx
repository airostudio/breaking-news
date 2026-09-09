import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { publicStories } from "../lib/api";
import { formatDateline } from "../lib/format";
import type { PublicStory } from "../lib/types";

export default function Front() {
  const [stories, setStories] = useState<PublicStory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    publicStories()
      .then((res) => {
        if (!cancelled) setStories(res.stories);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="front-page container">
        <div className="empty-state">
          Unable to load the front page right now.
          <br />
          {error}
        </div>
      </div>
    );
  }

  if (!stories) {
    return <div className="loading-state">Loading today&rsquo;s front page…</div>;
  }

  if (stories.length === 0) {
    return (
      <div className="front-page container">
        <div className="empty-state">
          No licensed stories are published yet. Check back soon — or{" "}
          <Link to="/upload">submit breaking footage</Link>.
        </div>
      </div>
    );
  }

  const [lede, ...rest] = stories;
  const secondary = rest.slice(0, 3);
  const below = rest.slice(3, 9);

  return (
    <div className="front-page container">
      <div className="front-grid">
        <article className="lede">
          <span className="breaking-tag">Breaking</span>
          {lede.thumbnail_url && (
            <img className="thumb" src={lede.thumbnail_url} alt="" />
          )}
          <Link to={`/story/${lede.id}`} className="plain">
            <h2>{lede.headline}</h2>
          </Link>
          {lede.dek && <p className="dek">{lede.dek}</p>}
          <div className="byline-row">
            {lede.location_text && <span>{lede.location_text}</span>}
            <span>{formatDateline(lede.captured_at || lede.created_at)}</span>
            {lede.outlet_credit && (
              <span className="outlet-credit">Licensed by {lede.outlet_credit}</span>
            )}
          </div>
        </article>

        <div className="secondary-col">
          {secondary.map((s) => (
            <StoryTeaser key={s.id} story={s} />
          ))}
        </div>

        {below.length > 0 && (
          <div className="grid-below">
            {below.map((s) => (
              <StoryTeaser key={s.id} story={s} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StoryTeaser({ story, compact }: { story: PublicStory; compact?: boolean }) {
  return (
    <article className="story-card">
      {story.thumbnail_url && (
        <img className="thumb" src={story.thumbnail_url} alt="" />
      )}
      <Link to={`/story/${story.id}`} className="plain">
        <h3>{story.headline}</h3>
      </Link>
      {!compact && story.dek && <p className="dek">{story.dek}</p>}
      <div className="byline-row">
        <span>{formatDateline(story.captured_at || story.created_at)}</span>
        {story.outlet_credit && (
          <span className="outlet-credit">Licensed by {story.outlet_credit}</span>
        )}
      </div>
    </article>
  );
}

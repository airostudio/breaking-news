import { useEffect, useState } from "react";
import { publicStories } from "../lib/api";
import type { PublicStory } from "../lib/types";

const FALLBACK = [
  "BNO verification desk is standing by 24/7 for breaking submissions",
  "70% of every license fee goes directly to the contributor who captured it",
  "New footage from the field is verified against on-the-ground sources before it airs",
];

export default function BreakingTicker() {
  const [items, setItems] = useState<string[]>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    publicStories()
      .then((res) => {
        if (cancelled) return;
        const headlines = res.stories
          .slice(0, 8)
          .map((s: PublicStory) => s.headline)
          .filter(Boolean);
        if (headlines.length) setItems(headlines);
      })
      .catch(() => {
        // keep fallback ticker items if the API isn't reachable yet
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loop = [...items, ...items];

  return (
    <div className="ticker">
      <div className="ticker-inner">
        <span className="ticker-label">Breaking</span>
        <div className="ticker-track-wrap">
          <div className="ticker-track">
            {loop.map((text, i) => (
              <span key={i}>{text}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

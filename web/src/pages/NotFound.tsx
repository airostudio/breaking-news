import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page container">
      <div className="empty-state">
        <h1 style={{ fontFamily: "var(--font-display)" }}>404</h1>
        <p>Page not found.</p>
        <Link to="/">Return to the front page</Link>
      </div>
    </div>
  );
}

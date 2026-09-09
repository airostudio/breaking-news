import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import BreakingTicker from "./BreakingTicker";

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="site-header">
      <div className="utility-bar">
        <div className="container">
          <span className="dateline-today">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <nav>
            {user ? (
              <>
                <span className="user-chip">
                  {user.name} &middot; {user.role}
                </span>
                <button className="linklike" onClick={logout} type="button">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Sign in</NavLink>
                <NavLink to="/register">Register</NavLink>
              </>
            )}
          </nav>
        </div>
      </div>

      <div className="masthead">
        <div className="masthead-eyebrow">Exclusive Licensed Footage &amp; Photography</div>
        <NavLink to="/" className="plain">
          <h1>BNO</h1>
        </NavLink>
        <div className="tagline">Breaking News Outlet — verified on the ground, licensed worldwide</div>
      </div>

      <nav className="main-nav">
        <div className="container">
          <NavLink to="/" end>
            Front Page
          </NavLink>
          <NavLink to="/pricing">Pricing</NavLink>
          {(!user || user.role === "contributor") && (
            <>
              <NavLink to="/upload">Upload</NavLink>
              <NavLink to="/dashboard">Dashboard</NavLink>
            </>
          )}
          {user?.role === "editor" && <NavLink to="/newsroom">Newsroom</NavLink>}
          {(!user || user.role === "outlet") && (
            <>
              <NavLink to="/marketplace">Marketplace</NavLink>
              <NavLink to="/purchases">Purchases</NavLink>
            </>
          )}
        </div>
      </nav>

      <BreakingTicker />
    </header>
  );
}

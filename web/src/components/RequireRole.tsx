import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import type { Role } from "../lib/types";

export default function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-state">Checking credentials…</div>;

  if (!user) return <Navigate to="/login" replace />;

  if (!roles.includes(user.role)) {
    return (
      <div className="page">
        <div className="container">
          <div className="empty-state">
            This section is only available to {roles.join(" / ")} accounts. You are
            signed in as {user.role}.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

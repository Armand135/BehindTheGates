"use client";

import { usePathname } from "next/navigation";
import { isPublicPath, useAuth } from "@/lib/auth-context";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading...</p>
      </div>
    );
  }

  // Redirects are handled in AuthProvider; this just avoids flashing
  // protected content while that redirect is in flight.
  if (!user && !isPublicPath(pathname)) {
    return (
      <div className="page">
        <p className="muted">Redirecting to sign in...</p>
      </div>
    );
  }

  return <>{children}</>;
}

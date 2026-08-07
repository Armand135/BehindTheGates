"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Nav() {
  const { user, logout } = useAuth();

  return (
    <nav className="nav">
      <span className="brand">⚓ Port Ops Copilot</span>
      {user && (
        <>
          <Link href="/">Dashboard</Link>
          <Link href="/twin">Digital Twin</Link>
          <Link href="/optimization">Optimization</Link>
          <Link href="/copilot">Copilot</Link>
        </>
      )}
      <span style={{ flex: 1 }} />
      {user && (
        <span className="muted" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
          {user.organization_name} · {user.email}
          <button className="secondary" onClick={logout}>
            Log out
          </button>
        </span>
      )}
    </nav>
  );
}

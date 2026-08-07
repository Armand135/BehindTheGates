"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function SignupPage() {
  const { signup } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(orgName, email, password);
    } catch (err) {
      setError(
        err instanceof Error && err.message.startsWith("409")
          ? "An account with this email already exists."
          : "Could not create account. Check your details and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 400 }}>
      <h1>Create your account</h1>
      <p className="muted">Sets up a new, isolated workspace for your organization -- your simulations, optimization runs, and copilot chats are only visible to your team.</p>
      <form onSubmit={submit} className="card grid" style={{ gap: 12 }}>
        <label>
          Organization name
          <div>
            <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} style={{ width: "100%" }} />
          </div>
        </label>
        <label>
          Work email
          <div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        </label>
        <label>
          Password
          <div>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        </label>
        {error && <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}

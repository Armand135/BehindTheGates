"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HostOnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", industry: "", website: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/host-organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create host organization.");
        return;
      }
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      } else {
        router.push("/host/dashboard");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold text-brand-900">List your company</h1>
      <p className="mt-2 text-sm text-brand-600">
        Tell us about your site. Our team will verify your organization before your listings can go live.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <input
          required
          placeholder="Company name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
        />
        <input
          placeholder="Industry"
          value={form.industry}
          onChange={(e) => setForm({ ...form, industry: e.target.value })}
          className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
        />
        <input
          placeholder="Website"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
          className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
        />
        <textarea
          placeholder="Brief description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={4}
          className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create host account"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InsuranceForm({ hostOrganizationId }: { hostOrganizationId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const res = await fetch(`/api/host-organizations/${hostOrganizationId}/insurance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ insuranceDocUrl: url, insuranceExpiresAt: expiresAt }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Could not save insurance doc.");
          return;
        }
        router.refresh();
      }}
    >
      <input
        required
        type="url"
        placeholder="Insurance document URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="rounded-md border border-amber-300 px-2 py-1.5 text-sm"
      />
      <input
        required
        type="date"
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
        className="rounded-md border border-amber-300 px-2 py-1.5 text-sm"
      />
      <button type="submit" className="rounded-md bg-amber-600 px-3 py-1.5 text-xs text-white hover:bg-amber-700">
        Save
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

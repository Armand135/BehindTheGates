"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateSiteForm({ hostOrganizationId }: { hostOrganizationId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [accessTier, setAccessTier] = useState("tier_1");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const res = await fetch("/api/sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostOrganizationId, name, address, accessTier }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Could not create site.");
          return;
        }
        setName("");
        setAddress("");
        router.refresh();
      }}
    >
      <input
        required
        placeholder="Site name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
      />
      <input
        required
        placeholder="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
      />
      <select
        value={accessTier}
        onChange={(e) => setAccessTier(e.target.value)}
        className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
      >
        <option value="tier_1">Tier 1 — bookable now</option>
        <option value="tier_2">Tier 2 — partnership required</option>
        <option value="tier_3">Tier 3 — security-restricted (virtual only)</option>
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-700">
        Add site
      </button>
    </form>
  );
}

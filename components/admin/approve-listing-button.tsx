"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApproveListingButton({ listingId, hasBlockers }: { listingId: string; hasBlockers: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function approve(override: boolean) {
    setError(null);
    const res = await fetch(`/api/listings/${listingId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ override }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not approve listing.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="text-right">
      <button
        onClick={() => approve(false)}
        className="rounded-md bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-700"
      >
        Approve
      </button>
      {hasBlockers && (
        <button
          onClick={() => approve(true)}
          className="ml-2 rounded-md border border-amber-300 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50"
        >
          Override &amp; publish
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

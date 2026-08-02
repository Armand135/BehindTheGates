"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SubmitListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        onClick={async () => {
          setError(null);
          const res = await fetch(`/api/listings/${listingId}/submit`, { method: "POST" });
          if (!res.ok) {
            const data = await res.json();
            setError(data.error ?? "Could not submit for review.");
            return;
          }
          router.refresh();
        }}
        className="text-xs text-brand-600 underline"
      >
        Submit for review
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

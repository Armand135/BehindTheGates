"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResolveIncidentButton({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  return (
    <button
      disabled={submitting}
      onClick={async () => {
        setSubmitting(true);
        try {
          await fetch(`/api/incidents/${incidentId}/resolve`, { method: "POST" });
          router.refresh();
        } finally {
          setSubmitting(false);
        }
      }}
      className="rounded-md bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-700 disabled:opacity-50"
    >
      Mark resolved
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminCancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-red-600 underline">
        Cancel &amp; refund
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
        className="rounded-md border border-brand-200 px-2 py-1 text-xs"
      />
      <button
        disabled={submitting || !reason.trim()}
        onClick={async () => {
          setError(null);
          setSubmitting(true);
          try {
            const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason }),
            });
            if (!res.ok) {
              const data = await res.json();
              setError(data.error ?? "Could not cancel booking.");
              return;
            }
            router.refresh();
          } finally {
            setSubmitting(false);
          }
        }}
        className="rounded-md bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
      >
        Confirm
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

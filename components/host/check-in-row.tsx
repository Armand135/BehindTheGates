"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CheckInRow({ bookingId, status }: { bookingId: string; status: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  if (status !== "confirmed") {
    return <span className="text-brand-500">{status.replace("_", " ")}</span>;
  }

  async function checkIn(outcome: "completed" | "no_show") {
    setSubmitting(true);
    try {
      await fetch(`/api/bookings/${bookingId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        disabled={submitting}
        onClick={() => checkIn("completed")}
        className="rounded border border-brand-200 px-2 py-0.5 text-brand-700 hover:bg-brand-50 disabled:opacity-50"
      >
        Checked in
      </button>
      <button
        disabled={submitting}
        onClick={() => checkIn("no_show")}
        className="rounded border border-brand-200 px-2 py-0.5 text-brand-500 hover:bg-brand-50 disabled:opacity-50"
      >
        No-show
      </button>
    </div>
  );
}

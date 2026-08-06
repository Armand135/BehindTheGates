"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateAvailabilityForm({ tourListingId }: { tourListingId: string }) {
  const router = useRouter();
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [capacity, setCapacity] = useState(20);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const start = new Date(startTime);
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
        const res = await fetch("/api/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tourListingId,
            slots: [{ startTime: start.toISOString(), endTime: end.toISOString(), capacity }],
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Could not create slot.");
          return;
        }
        setStartTime("");
        router.refresh();
      }}
    >
      <input
        required
        type="datetime-local"
        value={startTime}
        onChange={(e) => setStartTime(e.target.value)}
        className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder="Duration (min)"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        />
        <input
          type="number"
          placeholder="Capacity"
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
        Add time slot
      </button>
    </form>
  );
}

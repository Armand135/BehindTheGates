"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Slot {
  id: string;
  startTime: string;
  capacity: number;
  seatsBooked: number;
  isGroupOnly: boolean;
}

interface AttendeeDraft {
  name: string;
  dateOfBirth: string;
  guardianEmail: string;
}

export function BookingForm({
  listingId,
  slots,
  chaperoneRatio,
}: {
  listingId: string;
  slots: Slot[];
  chaperoneRatio: number | null;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [slotId, setSlotId] = useState(slots[0]?.id ?? "");
  const [bookingType, setBookingType] = useState<"individual" | "group">("individual");
  const [chaperoneCount, setChaperoneCount] = useState(0);
  const [attendees, setAttendees] = useState<AttendeeDraft[]>([{ name: "", dateOfBirth: "", guardianEmail: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!session?.user) {
    return (
      <p className="rounded-md border border-brand-200 bg-white p-4 text-sm text-brand-600">
        <a href="/login" className="text-brand-700 underline">
          Sign in
        </a>{" "}
        to book this visit.
      </p>
    );
  }

  if (slots.length === 0) {
    return <p className="text-sm text-brand-500">No upcoming availability — check back soon.</p>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availabilitySlotId: slotId,
          bookingType,
          chaperoneCount: bookingType === "group" ? chaperoneCount : 0,
          attendees: attendees.map((a) => ({
            name: a.name,
            dateOfBirth: a.dateOfBirth || null,
            guardianEmail: a.guardianEmail || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create booking.");
        return;
      }
      router.push(`/booking/${data.booking.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-brand-100 bg-white p-6">
      <div>
        <label className="block text-sm font-medium text-brand-800">Date &amp; time</label>
        <select
          value={slotId}
          onChange={(e) => setSlotId(e.target.value)}
          className="mt-1 w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
        >
          {slots.map((s) => (
            <option key={s.id} value={s.id}>
              {new Date(s.startTime).toLocaleString()} — {s.capacity - s.seatsBooked} seats left
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-brand-800">Booking type</label>
        <select
          value={bookingType}
          onChange={(e) => setBookingType(e.target.value as "individual" | "group")}
          className="mt-1 w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
        >
          <option value="individual">Individual / family</option>
          <option value="group">Group / school</option>
        </select>
      </div>

      {bookingType === "group" && (
        <div>
          <label className="block text-sm font-medium text-brand-800">
            Chaperone count {chaperoneRatio ? `(min 1 per ${chaperoneRatio} attendees)` : ""}
          </label>
          <input
            type="number"
            min={0}
            value={chaperoneCount}
            onChange={(e) => setChaperoneCount(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-brand-800">Attendees</label>
          <button
            type="button"
            onClick={() => setAttendees([...attendees, { name: "", dateOfBirth: "", guardianEmail: "" }])}
            className="text-xs text-brand-600 underline"
          >
            + Add attendee
          </button>
        </div>
        {attendees.map((a, i) => (
          <div key={i} className="grid gap-2 rounded-md border border-brand-100 p-3 sm:grid-cols-3">
            <input
              placeholder="Full name"
              value={a.name}
              onChange={(e) => {
                const next = [...attendees];
                next[i] = { ...next[i], name: e.target.value };
                setAttendees(next);
              }}
              className="rounded-md border border-brand-200 px-2 py-1.5 text-sm"
              required
            />
            <input
              type="date"
              value={a.dateOfBirth}
              onChange={(e) => {
                const next = [...attendees];
                next[i] = { ...next[i], dateOfBirth: e.target.value };
                setAttendees(next);
              }}
              className="rounded-md border border-brand-200 px-2 py-1.5 text-sm"
            />
            <input
              type="email"
              placeholder="Guardian email (if minor)"
              value={a.guardianEmail}
              onChange={(e) => {
                const next = [...attendees];
                next[i] = { ...next[i], guardianEmail: e.target.value };
                setAttendees(next);
              }}
              className="rounded-md border border-brand-200 px-2 py-1.5 text-sm"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? "Booking..." : "Continue to waivers"}
      </button>
    </form>
  );
}

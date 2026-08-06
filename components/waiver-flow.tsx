"use client";

import { useState } from "react";

interface AttendeeWaiverState {
  id: string;
  name: string;
  waiverStatus: "pending" | "signed" | null;
}

export function WaiverFlow({ bookingId, attendees: initialAttendees }: { bookingId: string; attendees: AttendeeWaiverState[] }) {
  const [attendees, setAttendees] = useState(initialAttendees);
  const [signature, setSignature] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const allSigned = attendees.every((a) => a.waiverStatus === "signed");

  async function signWaiver(attendeeId: string) {
    setError(null);
    const typedName = signature[attendeeId]?.trim();
    if (!typedName) {
      setError("Type your full name to sign.");
      return;
    }
    const res = await fetch(`/api/bookings/${bookingId}/waivers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendeeId, signaturePayload: typedName, templateVersion: "v1" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not submit waiver.");
      return;
    }
    setAttendees((prev) => prev.map((a) => (a.id === attendeeId ? { ...a, waiverStatus: "signed" } : a)));
  }

  async function checkout() {
    setError(null);
    setCheckingOut(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/checkout`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = data.url;
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-brand-800">Waivers</h2>
      <p className="text-sm text-brand-600">
        Every attendee needs a signed waiver before payment. Minors are signed for by their parent/guardian.
      </p>

      {attendees.map((a) => (
        <div key={a.id} className="rounded-md border border-brand-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-brand-800">{a.name}</span>
            <span className={`text-xs ${a.waiverStatus === "signed" ? "text-green-600" : "text-amber-600"}`}>
              {a.waiverStatus === "signed" ? "Signed" : "Pending"}
            </span>
          </div>
          {a.waiverStatus !== "signed" && (
            <div className="mt-3 flex gap-2">
              <input
                placeholder="Type full legal name to sign"
                value={signature[a.id] ?? ""}
                onChange={(e) => setSignature((prev) => ({ ...prev, [a.id]: e.target.value }))}
                className="flex-1 rounded-md border border-brand-200 px-3 py-2 text-sm"
              />
              <button
                onClick={() => signWaiver(a.id)}
                className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700"
              >
                Sign
              </button>
            </div>
          )}
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={checkout}
        disabled={!allSigned || checkingOut}
        className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {checkingOut ? "Redirecting..." : allSigned ? "Continue to payment" : "Sign all waivers to continue"}
      </button>
    </div>
  );
}

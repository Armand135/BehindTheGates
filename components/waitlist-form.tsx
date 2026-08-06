"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

export function WaitlistForm({ listingId }: { listingId: string }) {
  const { data: session } = useSession();
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  if (!session?.user) {
    return (
      <p className="rounded-md border border-brand-200 bg-white p-4 text-sm text-brand-600">
        This is a virtual-tour / interest-waitlist listing.{" "}
        <a href="/login" className="text-brand-700 underline">
          Sign in
        </a>{" "}
        to join the waitlist.
      </p>
    );
  }

  if (status === "done") {
    return (
      <p className="rounded-md border border-brand-100 bg-white p-4 text-sm text-brand-700">
        You&apos;re on the waitlist — we&apos;ll email you when this site opens up virtual or in-person access.
      </p>
    );
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-brand-100 bg-white p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus("submitting");
        const res = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tourListingId: listingId, note: note || null }),
        });
        setStatus(res.ok ? "done" : "error");
      }}
    >
      <p className="text-sm text-brand-600">
        This site is security-restricted — physical booking isn&apos;t available. Join the interest
        waitlist for virtual-tour content and updates.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (e.g. what you're interested in)"
        className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
        rows={3}
      />
      {status === "error" && <p className="text-sm text-red-600">Something went wrong — try again.</p>}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        Join waitlist
      </button>
    </form>
  );
}

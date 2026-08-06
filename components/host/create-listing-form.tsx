"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateListingForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    durationMinutes: 60,
    minAge: 0,
    maxGroupSize: 20,
    chaperoneRatio: 10,
    priceCents: 0,
    isFreeRecruitingVisit: true,
  });
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-brand-600 underline">
        + New listing
      </button>
    );
  }

  return (
    <form
      className="space-y-2 rounded-md border border-brand-100 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const res = await fetch("/api/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId,
            title: form.title,
            description: form.description,
            durationMinutes: Number(form.durationMinutes),
            minAge: Number(form.minAge),
            maxGroupSize: Number(form.maxGroupSize),
            chaperoneRatio: Number(form.chaperoneRatio),
            priceCents: Number(form.priceCents),
            isFreeRecruitingVisit: form.isFreeRecruitingVisit,
            ppeRequired: [],
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Could not create listing.");
          return;
        }
        setOpen(false);
        router.refresh();
      }}
    >
      <input
        required
        placeholder="Title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        className="w-full rounded-md border border-brand-200 px-2 py-1.5 text-sm"
      />
      <textarea
        required
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="w-full rounded-md border border-brand-200 px-2 py-1.5 text-sm"
        rows={2}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder="Duration (min)"
          value={form.durationMinutes}
          onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
          className="rounded-md border border-brand-200 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          placeholder="Min age"
          value={form.minAge}
          onChange={(e) => setForm({ ...form, minAge: Number(e.target.value) })}
          className="rounded-md border border-brand-200 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          placeholder="Max group size"
          value={form.maxGroupSize}
          onChange={(e) => setForm({ ...form, maxGroupSize: Number(e.target.value) })}
          className="rounded-md border border-brand-200 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          placeholder="Chaperone ratio (1:N)"
          value={form.chaperoneRatio}
          onChange={(e) => setForm({ ...form, chaperoneRatio: Number(e.target.value) })}
          className="rounded-md border border-brand-200 px-2 py-1.5 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-brand-600">
        <input
          type="checkbox"
          checked={form.isFreeRecruitingVisit}
          onChange={(e) => setForm({ ...form, isFreeRecruitingVisit: e.target.checked })}
        />
        Free recruiting visit (no charge)
      </label>
      {!form.isFreeRecruitingVisit && (
        <input
          type="number"
          placeholder="Price (cents)"
          value={form.priceCents}
          onChange={(e) => setForm({ ...form, priceCents: Number(e.target.value) })}
          className="w-full rounded-md border border-brand-200 px-2 py-1.5 text-sm"
        />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-700">
          Create draft
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-brand-500">
          Cancel
        </button>
      </div>
    </form>
  );
}

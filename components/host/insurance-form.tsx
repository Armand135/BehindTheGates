"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InsuranceForm({ hostOrganizationId }: { hostOrganizationId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!file) {
          setError("Choose a file first.");
          return;
        }
        setSubmitting(true);
        try {
          const urlRes = await fetch(`/api/host-organizations/${hostOrganizationId}/insurance/upload-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: file.name }),
          });
          if (!urlRes.ok) {
            const data = await urlRes.json();
            setError(data.error ?? "Could not start upload.");
            return;
          }
          const { signedUrl, publicUrl } = await urlRes.json();

          const uploadRes = await fetch(signedUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type || "application/octet-stream" },
            body: file,
          });
          if (!uploadRes.ok) {
            setError("File upload failed — check that the storage bucket is configured.");
            return;
          }

          const saveRes = await fetch(`/api/host-organizations/${hostOrganizationId}/insurance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ insuranceDocUrl: publicUrl, insuranceExpiresAt: expiresAt }),
          });
          if (!saveRes.ok) {
            const data = await saveRes.json();
            setError(data.error ?? "Could not save insurance doc.");
            return;
          }
          router.refresh();
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <input
        required
        type="file"
        accept="application/pdf,image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="rounded-md border border-amber-300 px-2 py-1.5 text-sm"
      />
      <input
        required
        type="date"
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
        className="rounded-md border border-amber-300 px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-amber-600 px-3 py-1.5 text-xs text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {submitting ? "Uploading..." : "Upload & save"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

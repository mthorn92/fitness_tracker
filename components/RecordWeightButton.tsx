"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RecordWeightButton({ date, currentKg }: { date: string; currentKg: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/weights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date,
        kg: Number(formData.get("kg") ?? 0),
      }),
    });
    setPending(false);
    if (!response.ok) {
      setError("Could not save that weigh-in.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-accent px-4 py-2 text-sm font-extrabold text-white touch-manipulation"
      >
        Record Weight
      </button>
    );
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <input
        name="kg"
        type="number"
        min="40"
        max="250"
        step="0.1"
        required
        defaultValue={currentKg ?? undefined}
        className="w-32 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm"
      />
      {error ? <p className="text-sm text-low">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-bold text-muted">
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {pending ? "Saving" : "Save"}
        </button>
      </div>
    </form>
  );
}

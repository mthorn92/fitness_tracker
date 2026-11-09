"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddFoodButton({
  date,
  defaultTime = "12:00",
  label = "Add manually",
}: {
  date: string;
  defaultTime?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/foods", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date,
        time: String(formData.get("time") ?? ""),
        item: String(formData.get("item") ?? ""),
        kcal: Number(formData.get("kcal") ?? 0),
        protein_g: Number(formData.get("protein_g") ?? 0),
        carbs_g: Number(formData.get("carbs_g") ?? 0),
        fat_g: Number(formData.get("fat_g") ?? 0),
      }),
    });
    setPending(false);
    if (!response.ok) {
      setError("Could not save that food. Check the time and calories.");
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
        className="px-3 py-2 text-sm font-bold text-muted touch-manipulation"
      >
        {label}
      </button>
    );
  }

  return (
    <form action={onSubmit} className="w-full space-y-3 rounded-2xl bg-surface-2 p-3">
      <input
        name="item"
        required
        placeholder="What did you eat?"
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <input name="time" type="time" required defaultValue={defaultTime} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
        <input name="kcal" type="number" min="0" step="1" required placeholder="kcal" className="rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input name="protein_g" type="number" min="0" step="0.1" placeholder="P" className="rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
        <input name="carbs_g" type="number" min="0" step="0.1" placeholder="C" className="rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
        <input name="fat_g" type="number" min="0" step="0.1" placeholder="F" className="rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
      </div>
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

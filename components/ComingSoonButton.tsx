"use client";

import { useState } from "react";

type ComingSoonButtonProps = {
  label: string;
  message?: string;
};

export function ComingSoonButton({
  label,
  message = "Saving isn’t wired yet. For now, add items in data/fitness.json.",
}: ComingSoonButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full bg-accent px-4 py-2 text-sm font-extrabold text-white touch-manipulation"
      >
        {label}
      </button>
      {open ? <p className="mt-3 text-sm leading-5 text-muted">{message}</p> : null}
    </div>
  );
}

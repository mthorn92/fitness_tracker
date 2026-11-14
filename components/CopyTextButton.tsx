"use client";

import { useEffect, useRef, useState } from "react";

export function CopyTextButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, []);

  async function onCopy() {
    const ok = await copyPlainText(text);
    setState(ok ? "copied" : "failed");
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1600);
  }

  const shown = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label;

  return (
    <button
      type="button"
      className={`copy-btn${state === "copied" ? " is-copied" : ""}${state === "failed" ? " is-failed" : ""}`}
      data-label={label}
      onClick={onCopy}
    >
      <span aria-live="polite">{shown}</span>
    </button>
  );
}

/** navigator.clipboard, then a hidden textarea if the clipboard API is missing or rejects. */
export async function copyPlainText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea path.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

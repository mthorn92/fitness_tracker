import Link from "next/link";
import type { DateNav } from "@/lib/types";

export function DateStrip({ nav, basePath }: { nav: DateNav; basePath: string }) {
  const hrefFor = (date: string) => `${basePath}?date=${date}`;

  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center gap-2 rounded-full bg-pill px-2 py-1.5 text-pill-ink">
        {nav.prevDate ? (
          <Link href={hrefFor(nav.prevDate)} aria-label="Previous day" className="grid h-8 w-8 place-items-center">
            <Chevron dir="left" />
          </Link>
        ) : (
          <span className="grid h-8 w-8 place-items-center opacity-30">
            <Chevron dir="left" />
          </span>
        )}
        <p className="flex items-center gap-1.5 px-1 text-sm font-extrabold">
          <CalendarIcon />
          {nav.label}
        </p>
        {nav.nextDate ? (
          <Link href={hrefFor(nav.nextDate)} aria-label="Next day" className="grid h-8 w-8 place-items-center">
            <Chevron dir="right" />
          </Link>
        ) : (
          <span className="grid h-8 w-8 place-items-center opacity-30">
            <Chevron dir="right" />
          </span>
        )}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 4v4M16 4v4M4 11h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === "left" ? "M14 6 8 12l6 6" : "M10 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

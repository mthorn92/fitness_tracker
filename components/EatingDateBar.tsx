"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { formatDatePill, shiftIsoDate } from "@/lib/format";

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path
        d={direction === "left" ? "M10 3.5 5.5 8 10 12.5" : "M6 3.5 10.5 8 6 12.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="2.5" y="3.5" width="11" height="10.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 2.2v2.6M11 2.2v2.6M2.5 6.5h11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function EatingDateBar({
  date,
  today,
  minDate,
}: {
  date: string;
  today: string;
  minDate: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const cap = shiftIsoDate(today, 366);
  const planned = date > today;

  function go(next: string) {
    const params = new URLSearchParams(window.location.search);
    if (next === today) params.delete("date");
    else params.set("date", next);
    if (!params.get("tab")) params.set("tab", "diet");
    const query = params.toString();
    router.push(`${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  }

  return (
    <section className="card eating-bar" aria-label="Today's eating" data-tab-group="diet" data-tile="eating">
      <div className="eating-nav">
        <button
          type="button"
          className="eating-arrow"
          aria-label="Previous day"
          disabled={date <= minDate}
          onClick={() => go(shiftIsoDate(date, -1))}
        >
          <Chevron direction="left" />
        </button>
        <p className="eating-date">{formatDatePill(date)}</p>
        <button
          type="button"
          className="eating-arrow"
          aria-label="Next day"
          disabled={date >= cap}
          onClick={() => go(shiftIsoDate(date, 1))}
        >
          <Chevron direction="right" />
        </button>
      </div>
      <button type="button" className="eating-cal" aria-label="Choose a date" onClick={openPicker}>
        <CalendarIcon />
      </button>
      <input
        ref={inputRef}
        className="eating-input"
        type="date"
        value={date}
        min={date < minDate ? date : minDate}
        max={date > cap ? date : cap}
        aria-label="Choose a date"
        tabIndex={-1}
        onChange={(event) => {
          if (event.target.value) go(event.target.value);
        }}
      />
      {planned ? <span className="date-tag">Planned</span> : null}
    </section>
  );
}

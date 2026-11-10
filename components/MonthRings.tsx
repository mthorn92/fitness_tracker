"use client";

import { useEffect, useRef, useState } from "react";
import type { DietDashboardDay } from "@/lib/types";
import { formatDatePill } from "@/lib/format";
import {
  buildMonthGrid,
  canGoToNextMonth,
  dayOfMonth,
  formatMonthTitle,
  greenStreak,
  monthCounts,
  monthTallyText,
  parseYearMonth,
  ringAriaLabel,
  ringSummary,
  shiftMonth,
  type DayRing,
  type RingDayInput,
} from "@/lib/rings";

const SIZE = 32;
const STROKE = 3.25;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const WEEKDAYS = [
  { key: "mon", label: "M", name: "Monday" },
  { key: "tue", label: "T", name: "Tuesday" },
  { key: "wed", label: "W", name: "Wednesday" },
  { key: "thu", label: "T", name: "Thursday" },
  { key: "fri", label: "F", name: "Friday" },
  { key: "sat", label: "S", name: "Saturday" },
  { key: "sun", label: "S", name: "Sunday" },
];

function toInput(day: DietDashboardDay): RingDayInput {
  return {
    date: day.date,
    foodKcal: day.kcal,
    whoopKcal: day.whoop_burn_kcal,
    cycleClosed: day.cycle_closed,
  };
}

function RingGlyph({ ring }: { ring: DayRing }) {
  const showFill = ring.fill > 0 && ring.judgement !== "empty" && ring.judgement !== "future";
  const full = ring.fill >= 0.999;
  return (
    <svg className="ring-svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        strokeWidth={STROKE}
        className={`ring-track ring-track-${ring.judgement}`}
      />
      {showFill ? (
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          strokeLinecap={full ? undefined : "round"}
          strokeDasharray={full ? undefined : `${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={full ? undefined : CIRCUMFERENCE * (1 - ring.fill)}
          className={`ring-fill ring-fill-${ring.judgement}`}
        />
      ) : null}
    </svg>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path
        d={direction === "left" ? "M10 3.5 5.5 8 10 12.5" : "M6 3.5 10.5 8 6 12.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MonthRings({ days, today }: { days: DietDashboardDay[]; today: string }) {
  const rootRef = useRef<HTMLElement>(null);
  const current = parseYearMonth(today);
  const [cursor, setCursor] = useState(current);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const inputs = days.map(toInput);
  const cells = buildMonthGrid(cursor.year, cursor.month, inputs, today);
  const { green, red } = monthCounts(inputs, today, cursor.year, cursor.month);
  const viewingCurrent = cursor.year === current.year && cursor.month === current.month;
  const streak = viewingCurrent ? greenStreak(inputs, today) : 0;
  const tally = monthTallyText(green, red, viewingCurrent ? streak : null);
  const title = formatMonthTitle(cursor.year, cursor.month);
  const openDate = hovered ?? pinned;
  const nextEnabled = canGoToNextMonth(cursor.year, cursor.month, today);

  useEffect(() => {
    if (!pinned) return;
    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node) || root.contains(event.target)) return;
      setPinned(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPinned(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned]);

  function go(delta: number) {
    setCursor((value) => shiftMonth(value.year, value.month, delta));
    setHovered(null);
    setPinned(null);
  }

  return (
    <section className="card month-rings" aria-label="Monthly rings" ref={rootRef}>
      <div className="rings-nav">
        <button type="button" className="rings-arrow" aria-label="Previous month" onClick={() => go(-1)}>
          <Chevron direction="left" />
        </button>
        <h2>{title}</h2>
        <button
          type="button"
          className="rings-arrow"
          aria-label="Next month"
          disabled={!nextEnabled}
          onClick={() => go(1)}
        >
          <Chevron direction="right" />
        </button>
      </div>

      <div className="rings-grid">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday.key} className="rings-dow" title={weekday.name}>
            {weekday.label}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (!cell.date || !cell.ring) {
            return <div key={`pad-${index}`} className="ring-cell" />;
          }
          const ring = cell.ring;
          const open = openDate === cell.date;
          const column = index % 7;
          const row = Math.floor(index / 7);
          const summary = ringSummary(ring);
          const difference =
            summary.pending && ring.deltaKcal != null ? `${summary.difference} · so far` : summary.difference;
          const deltaClass =
            summary.pending || ring.judgement === "empty" || ring.judgement === "future"
              ? "ring-tip-delta"
              : ring.judgement === "over"
                ? "ring-tip-delta is-over"
                : "ring-tip-delta is-under";
          const faceClass = [
            "ring-face",
            cell.date === today ? "is-today" : "",
            ring.judgement === "future" ? "is-future" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={cell.date}
              className="ring-cell"
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setHovered(cell.date);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType !== "mouse") return;
                setHovered((currentDate) => (currentDate === cell.date ? null : currentDate));
              }}
            >
              <button
                type="button"
                className="ring-btn"
                data-ring-date={cell.date}
                aria-label={ringAriaLabel(ring)}
                aria-expanded={open}
                aria-describedby={open ? `ring-tip-${cell.date}` : undefined}
                onClick={() => setPinned((currentDate) => (currentDate === cell.date ? null : cell.date))}
              >
                <span className={faceClass}>
                  <RingGlyph ring={ring} />
                  <span
                    className={`ring-day${ring.judgement === "empty" && cell.date !== today ? " is-empty" : ""}`}
                  >
                    {dayOfMonth(cell.date)}
                  </span>
                  {ring.overflow ? <span className="ring-overflow" aria-hidden /> : null}
                </span>
              </button>
              {open ? (
                <div
                  id={`ring-tip-${cell.date}`}
                  role="tooltip"
                  className="ring-tip"
                  data-place={row === 0 ? "below" : "above"}
                  data-align={column === 0 ? "start" : column === 6 ? "end" : "center"}
                >
                  <div className="ring-tip-date">{formatDatePill(ring.date)}</div>
                  <div>Eaten {summary.eaten}</div>
                  <div>Burned {summary.burned}</div>
                  <div className={deltaClass}>{difference}</div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="rings-tally">{tally}</p>
      <p className="rings-hint">Green means you ate no more than you burned. Red means you ate more.</p>
    </section>
  );
}

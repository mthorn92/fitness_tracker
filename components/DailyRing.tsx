import type { ReactNode } from "react";

const RING_SIZE = 120;
const RING_STROKE = 11;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function DailyRing({
  progress,
  tone,
  label,
  valueNow,
  valueMax,
  valueText,
  flag = false,
  compact = false,
  children,
}: {
  progress: number;
  tone: "good" | "over";
  label: string;
  valueNow: number;
  valueMax: number;
  valueText: string;
  flag?: boolean;
  compact?: boolean;
  children: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const full = clamped >= 0.999;
  const meterMax = Math.max(valueMax, 0);

  return (
    <div
      className={`daily-ring tone-${tone}${compact ? " is-compact" : ""}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={meterMax}
      aria-valuenow={Math.min(Math.max(valueNow, 0), meterMax)}
      aria-valuetext={valueText}
    >
      <svg className="daily-ring-svg" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
        <circle
          className="daily-ring-track"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
        />
        {clamped > 0 ? (
          <circle
            className="daily-ring-fill"
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap={full ? undefined : "round"}
            strokeDasharray={full ? undefined : `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            strokeDashoffset={full ? undefined : RING_CIRCUMFERENCE * (1 - clamped)}
          />
        ) : null}
      </svg>
      <div className="daily-ring-copy" aria-hidden="true">
        {children}
      </div>
      {flag ? (
        <span className="daily-ring-flag" aria-hidden="true">
          🎄
        </span>
      ) : null}
    </div>
  );
}

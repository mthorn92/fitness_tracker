"use client";

import { useState, type ReactNode } from "react";
import { CopyTextButton } from "@/components/CopyTextButton";
import { MUSCLE_GROUPS, formatCount } from "@/lib/exercise-progress";
import type { DayTileModel, ExerciseBoard, ExerciseRowModel, WeekBoard, WorkWeek } from "@/lib/exercise-board";
import type { MuscleGroup } from "@/lib/types";

const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  back: "Back",
  legs: "Legs",
  arms: "Arms",
};

export function ExerciseToday({
  board,
  week,
  weekCopy,
  onWeek,
}: {
  board: ExerciseBoard;
  week: WeekBoard;
  weekCopy?: string;
  onWeek: (week: number) => void;
}) {
  const atStart = week.week <= 1;
  const atEnd = week.week >= board.weekCount;
  const subtitle = board.todayNote && week.week === board.currentWeek ? board.todayNote : week.subtitle;
  const status =
    week.week === board.currentWeek
      ? [board.todayLabel, subtitle].filter(Boolean).join(" · ")
      : subtitle;
  return (
    <section className="card exercise-today" data-tab-group="exercise" data-tile="today">
      <div className="exercise-today-row">
        <div className="exercise-today-titles">
          <h2>Today&apos;s training</h2>
          {status ? <p className="exercise-today-status">{status}</p> : null}
        </div>
        <div className="exercise-today-actions">
          <div className="week-nav" aria-label="Week">
            <button
              type="button"
              className="week-arrow"
              aria-label="Previous week"
              disabled={atStart}
              onClick={() => onWeek(week.week - 1)}
            >
              <Chevron direction="left" />
            </button>
            <span className="week-current">
              Week {week.week} of {board.weekCount}
            </span>
            <button
              type="button"
              className="week-arrow"
              aria-label="Next week"
              disabled={atEnd}
              onClick={() => onWeek(week.week + 1)}
            >
              <Chevron direction="right" />
            </button>
          </div>
          {weekCopy ? <CopyTextButton text={weekCopy} label="Copy week" /> : null}
        </div>
      </div>
    </section>
  );
}

export function ExerciseDayTile({ day }: { day: DayTileModel }) {
  return (
    <section
      className="card ex-tile"
      data-tab-group="exercise"
      data-tile="strength"
      data-position={day.position}
      data-slot={day.slot}
    >
      <h2>{day.name}</h2>
      <p className="ex-meta">
        <span>{day.statusLabel}</span>
        <span className="ex-week">{day.weekLabel}</span>
      </p>
      <div className="ex-list">
        <div className="ex-col-head">
          <span />
          <span className="ex-done-h">Done</span>
        </div>
        <ExerciseRows rows={day.rows} />
      </div>
    </section>
  );
}

export function OverloadTile({ board, week }: { board: ExerciseBoard; week: WeekBoard }) {
  const [mode, setMode] = useState<"total" | "relative">("total");
  return (
    <section className="card ex-tile" data-tab-group="exercise" data-tile="overload" data-position="7">
      <div className="ex-tile-head">
        <h2>Progressive overload</h2>
        <div className="ex-seg" role="tablist" aria-label="Chart mode">
          <button type="button" role="tab" aria-selected={mode === "total"} onClick={() => setMode("total")}>
            Total
          </button>
          <button type="button" role="tab" aria-selected={mode === "relative"} onClick={() => setMode("relative")}>
            Relative
          </button>
        </div>
      </div>
      <p className="ex-meta">
        <span>Weekly work · kg × reps</span>
      </p>
      <WorkChart work={board.work} mode={mode} />
      <div className="ex-legend" aria-label="Muscle groups">
        {(["chest", "shoulders", "back", "legs", "arms"] as const).map((muscle) => (
          <span key={muscle}>
            <i data-muscle={muscle} />
            {MUSCLE_LABEL[muscle]}
          </span>
        ))}
      </div>
      <div className="ex-e1rm">
        <div className="ex-k">e1RM</div>
        <div className="ex-e1rm-grid">
          <E1 value={board.e1rm.bench} label="Bench" />
          <E1 value={board.e1rm.ohp} label="OHP" />
          <E1 value={board.e1rm.boxSquat} label="Box squat" />
          <E1 value={board.e1rm.deadlift} label="Deadlift" />
        </div>
      </div>
      <div className="ex-pu">
        <div className="ex-k">Pull-ups</div>
        <div className="ex-pu-stats">
          <div>
            <div className="ex-k">Assisted</div>
            <div className="ex-v">{formatCount(week.pullups.assisted)}</div>
          </div>
          <div>
            <div className="ex-k">Strict</div>
            <div className="ex-v">{formatCount(week.pullups.strict)}</div>
          </div>
          <div>
            <div className="ex-k">Band</div>
            <div className="ex-v">{week.pullups.band ?? "—"}</div>
          </div>
        </div>
      </div>
      <p className="ex-caption">
        Layers add up to weekly work. The dashed line is +10% a week. Relative is % vs week 1.
      </p>
    </section>
  );
}

export function PhaseSummaryTile({ board, week }: { board: ExerciseBoard; week: WeekBoard }) {
  const { phase } = board;
  const weekWidth = phase.sessionsPerWeek === 0 ? 0 : (week.sessions / phase.sessionsPerWeek) * 100;
  const blockWidth = phase.blockTarget === 0 ? 0 : (phase.blockSessions / phase.blockTarget) * 100;
  return (
    <section className="card ex-tile" data-tab-group="exercise" data-tile="phase" data-position="8">
      <h2>Phase summary</h2>
      <p className="ex-phase-name">{phase.name}</p>
      <p className="ex-phase-dates">{phase.datesLabel}</p>
      <div className="ex-facts">
        <div>
          <div className="ex-k">Current week</div>
          <div className="ex-fact">{week.weekLabel}</div>
        </div>
        <div>
          <div className="ex-k">Days left</div>
          <div className="ex-fact">
            {phase.daysLeft} {phase.daysLeft === 1 ? "day" : "days"}
          </div>
        </div>
      </div>
      <div className="ex-sess">
        <SessionBar label="This week" value={week.sessions} total={phase.sessionsPerWeek} width={weekWidth} />
        <SessionBar label="Block" value={phase.blockSessions} total={phase.blockTarget} width={blockWidth} />
      </div>
      <div className="ex-goals">
        <div>
          <div className="ex-k">Strict pull-ups</div>
          <div className="ex-fact">{formatCount(phase.strictPullups)}</div>
          <Spark values={phase.strictByWeek} trend={phase.strictPullups > 0 ? "up" : "flat"} />
        </div>
        <div>
          <div className="ex-k">Weight</div>
          <div className="ex-fact">
            {phase.weightKg == null ? "—" : phase.weightKg.toFixed(1)}
            {phase.weightKg != null ? <span className="ex-unit">kg</span> : null}
            {phase.weightTrend === "down" ? <span className="ex-trend is-down">↓</span> : null}
            {phase.weightTrend === "up" ? <span className="ex-trend is-up">↑</span> : null}
          </div>
          <Spark values={phase.weightSeries} trend={phase.weightTrend ?? "flat"} />
        </div>
      </div>
      <p className="ex-caption">
        Sessions vs the {phase.sessionsPerWeek}-day week and {phase.blockTarget}-session block. Weight is the latest
        logged weigh-in.
      </p>
    </section>
  );
}

function ExerciseRows({ rows }: { rows: ExerciseRowModel[] }) {
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < rows.length) {
    const row = rows[index];
    if (!row) break;
    if (row.superset) {
      const letter = row.superset;
      const group: ExerciseRowModel[] = [];
      while (index < rows.length && rows[index]?.superset === letter) {
        const next = rows[index];
        if (next) group.push(next);
        index += 1;
      }
      blocks.push(
        <div className="ex-pair" key={`${letter}-${index}`}>
          <div className="ex-superset">Superset</div>
          {group.map((item) => (
            <ExerciseRow key={`${item.key}-${item.name}`} row={item} />
          ))}
        </div>,
      );
    } else {
      blocks.push(<ExerciseRow key={`${row.key}-${row.name}`} row={row} />);
      index += 1;
    }
  }
  return blocks;
}

function ExerciseRow({ row }: { row: ExerciseRowModel }) {
  const label = row.status === "met" ? "Target met" : row.status === "partial" ? "Partly done" : undefined;
  return (
    <div className={`ex-row is-${row.status}`}>
      <div>
        <div className="ex-name">{row.name}</div>
        <div className="ex-target">{row.target}</div>
      </div>
      <div className="ex-done">
        <span className="ex-done-val">{row.actual ?? "—"}</span>
        <span className="ex-tick" aria-label={label}>
          {row.status === "none" ? null : <Tick tone={row.status} />}
        </span>
      </div>
    </div>
  );
}

function Tick({ tone }: { tone: "met" | "partial" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="8" className={tone === "met" ? "tick-met" : "tick-partial"} />
      <path
        d="M5.4 9.2l2.2 2.2 5-5"
        fill="none"
        stroke="#fff"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function E1({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="ex-k">{label}</div>
      <div className="ex-v">{value == null ? "—" : `${formatCount(value)} kg`}</div>
    </div>
  );
}

function SessionBar({ label, value, total, width }: { label: string; value: number; total: number; width: number }) {
  return (
    <div className="ex-sess-row">
      <div className="ex-k">{label}</div>
      <div className="ex-bar" aria-label={`${value} of ${total} sessions`}>
        <span style={{ width: `${Math.max(0, Math.min(100, width))}%` }} />
      </div>
      <div className="ex-n">
        {value}/{total}
      </div>
    </div>
  );
}

function Spark({ values, trend }: { values: number[]; trend: "down" | "up" | "flat" }) {
  if (values.length === 0) return <svg className="ex-spark" viewBox="0 0 80 18" aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 40 : 2 + (index / (values.length - 1)) * 76;
    const y = 15 - ((value - min) / span) * 12;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = points[points.length - 1]?.split(",") ?? ["78", "9"];
  return (
    <svg className="ex-spark" viewBox="0 0 80 18" aria-hidden="true">
      <polyline className={`spark-line is-${trend}`} fill="none" strokeWidth="1.6" strokeLinejoin="round" points={points.join(" ")} />
      <circle className={`spark-dot is-${trend}`} cx={last[0]} cy={last[1]} r="2.2" />
    </svg>
  );
}

function WorkChart({ work, mode }: { work: WorkWeek[]; mode: "total" | "relative" }) {
  const width = 400;
  const height = 168;
  const left = 36;
  const right = 386;
  const top = 16;
  const bottom = 140;
  const plotH = bottom - top;
  const n = Math.max(work.length, 1);
  const step = (right - left) / n;
  const barW = Math.min(32, step * 0.48);
  const loggedWeeks = work.filter((week) => week.total > 0).length;
  const useBars = loggedWeeks < 2;

  const totals = work.map((week) => week.total);
  const anchor = totals.findIndex((total) => total > 0);
  const target = work.map((_, index) => {
    if (anchor < 0 || index < anchor) return null;
    return (totals[anchor] ?? 0) * 1.1 ** (index - anchor);
  });
  const maxTotal = Math.max(0, ...totals, ...target.filter((value): value is number => value != null));
  const totalScale = maxTotal <= 0 ? 1000 : niceMax(maxTotal);

  const relative = work.map((week, index) => {
    const base = work[0];
    const point: Partial<Record<MuscleGroup, number | null>> = {};
    for (const muscle of MUSCLE_GROUPS) {
      const start = base?.groups[muscle] ?? 0;
      if (start <= 0) point[muscle] = null;
      else point[muscle] = index === 0 ? 0 : ((week.groups[muscle] - start) / start) * 100;
    }
    return point;
  });
  const relativeTarget = work.map((_, index) => (1.1 ** index - 1) * 100);
  const relativeNumbers = [
    ...relative.flatMap((point) => MUSCLE_GROUPS.map((muscle) => point[muscle]).filter((value): value is number => value != null)),
    ...relativeTarget,
  ];
  const relativeMin = Math.min(0, ...relativeNumbers);
  const relativeMax = niceMax(Math.max(10, ...relativeNumbers));
  const relativeSpan = relativeMax - relativeMin || 1;

  const yOf = (value: number) => {
    if (mode === "total") return bottom - (value / totalScale) * plotH;
    return bottom - ((value - relativeMin) / relativeSpan) * plotH;
  };
  const xOf = (index: number) => left + step * index + step / 2;

  const grid = uniqueTicks(
    mode === "total" ? [totalScale, totalScale / 2, 0] : [relativeMax, relativeMin + relativeSpan / 2, relativeMin],
    mode,
  );

  return (
    <svg
      className="ex-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={mode === "total" ? "Weekly work by muscle group" : "Muscle group change versus week 1"}
    >
      {grid.map((tick) => (
        <g key={tick}>
          <line x1={left} x2={right} y1={yOf(tick)} y2={yOf(tick)} className="ex-grid" />
          <text x={left - 4} y={yOf(tick) + 3} className="ex-axis" textAnchor="end">
            {mode === "total" ? compact(tick) : percentLabel(tick)}
          </text>
        </g>
      ))}
      {mode === "total" ? (
        useBars ? (
          <Bars work={work} xOf={xOf} yOf={yOf} bottom={bottom} barW={barW} scale={totalScale} plotH={plotH} />
        ) : (
          <Areas work={work} xOf={xOf} yOf={yOf} />
        )
      ) : (
        <RelativeLines relative={relative} xOf={xOf} yOf={yOf} />
      )}
      <TargetLine
        points={
          mode === "total"
            ? target.map((value, index) => (value == null ? null : ([xOf(index), yOf(value)] as const)))
            : relativeTarget.map((value, index) => [xOf(index), yOf(value)] as const)
        }
      />
      <text x={right} y={12} className="ex-axis" textAnchor="end">
        +10%/wk
      </text>
      {work.map((week, index) => (
        <text key={week.week} x={xOf(index)} y={158} className="ex-axis" textAnchor="middle">
          W{week.week}
        </text>
      ))}
    </svg>
  );
}

function Bars({
  work,
  xOf,
  yOf,
  bottom,
  barW,
  scale,
  plotH,
}: {
  work: WorkWeek[];
  xOf: (index: number) => number;
  yOf: (value: number) => number;
  bottom: number;
  barW: number;
  scale: number;
  plotH: number;
}) {
  return (
    <g>
      {work.map((week, index) => {
        if (week.total <= 0) {
          return <rect key={week.week} x={xOf(index) - barW / 2} y={bottom - 8} width={barW} height={8} rx="3" className="ex-stub" />;
        }
        let cursor = 0;
        return (
          <g key={week.week}>
            {MUSCLE_GROUPS.map((muscle) => {
              const value = week.groups[muscle];
              if (value <= 0) return null;
              const height = (value / scale) * plotH;
              const y = yOf(cursor + value);
              cursor += value;
              return <rect key={muscle} x={xOf(index) - barW / 2} y={y} width={barW} height={height} data-muscle={muscle} />;
            })}
          </g>
        );
      })}
    </g>
  );
}

function Areas({ work, xOf, yOf }: { work: WorkWeek[]; xOf: (index: number) => number; yOf: (value: number) => number }) {
  let lower = work.map(() => 0);
  return (
    <g>
      {MUSCLE_GROUPS.map((muscle) => {
        const upper = lower.map((value, index) => value + (work[index]?.groups[muscle] ?? 0));
        const forward = upper.map((value, index) => `${xOf(index)},${yOf(value)}`);
        const back = lower.map((value, index) => `${xOf(index)},${yOf(value)}`).reverse();
        lower = upper;
        return <polygon key={muscle} points={[...forward, ...back].join(" ")} data-muscle={muscle} />;
      })}
    </g>
  );
}

function RelativeLines({
  relative,
  xOf,
  yOf,
}: {
  relative: Array<Partial<Record<MuscleGroup, number | null>>>;
  xOf: (index: number) => number;
  yOf: (value: number) => number;
}) {
  return (
    <g>
      {MUSCLE_GROUPS.map((muscle) => {
        const points = relative
          .map((point, index) => {
            const value = point[muscle];
            if (value == null) return null;
            return `${xOf(index)},${yOf(value)}`;
          })
          .filter((point): point is string => point != null);
        if (points.length === 0) return null;
        return (
          <polyline key={muscle} points={points.join(" ")} fill="none" strokeWidth="1.6" data-muscle={muscle} className="ex-line" />
        );
      })}
    </g>
  );
}

function TargetLine({ points }: { points: Array<readonly [number, number] | null> }) {
  const usable = points.filter((point): point is readonly [number, number] => point != null);
  if (usable.length === 0) return null;
  return (
    <polyline
      className="ex-target"
      fill="none"
      strokeWidth="1.4"
      strokeDasharray="3.5 3"
      strokeLinejoin="round"
      points={usable.map((point) => point.join(",")).join(" ")}
    />
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  const d = direction === "left" ? "M10 3.5L5.5 8 10 12.5" : "M6 3.5L10.5 8 6 12.5";
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

function compact(value: number): string {
  if (value >= 1000) {
    const scaled = value / 1000;
    const text = scaled >= 10 || Number.isInteger(scaled) ? String(Math.round(scaled)) : scaled.toFixed(1);
    return `${text}k`;
  }
  if (value > 0 && value < 10) {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
  return String(Math.round(value));
}

function uniqueTicks(ticks: number[], mode: "total" | "relative"): number[] {
  const seen = new Set<string>();
  return ticks.filter((tick) => {
    const label = mode === "total" ? compact(tick) : percentLabel(tick);
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

function percentLabel(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return "0%";
  return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
}

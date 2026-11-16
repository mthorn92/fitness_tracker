import { rollingCalorieAverage, type CalorieAverage } from "@/lib/calorie-average";
import { clampPercent, formatNumber, shiftIsoDate } from "@/lib/format";
import { formatWeightDelta, latestWeighIn, weightWindowDelta, type WeightDelta } from "@/lib/weight-delta";
import { phaseLengthDays, phaseProgress, type CaloriePhase } from "@/lib/phases";
import type { DietDashboardView } from "@/lib/types";
import type { WeighIn } from "@/lib/weight-delta";

const CLAW_BACK_KCAL_THRESHOLD = 100;
const COUNTDOWN_RING = 96;
const COUNTDOWN_STROKE = 5;
const COUNTDOWN_RADIUS = (COUNTDOWN_RING - COUNTDOWN_STROKE) / 2;
const COUNTDOWN_CIRCUMFERENCE = 2 * Math.PI * COUNTDOWN_RADIUS;

function kcalDigits(value: number): 0 | 1 {
  return Number.isInteger(value) ? 0 : 1;
}

function bufferLabel(bufferKcal: number): string {
  const rounded = Math.round(bufferKcal);
  return `−${formatNumber(Math.abs(rounded))} to claw back`;
}

function avgDeltaParen(average: CalorieAverage): string {
  const d = average.deltaKcal;
  if (d === 0) return "(0)";
  const sign = d > 0 ? "+" : "−";
  return `(${sign}${formatNumber(Math.abs(d))})`;
}

function changeValue(delta: WeightDelta): { text: string; tone: "down" | "up" | "flat" } {
  const shown = formatWeightDelta(delta.deltaKg);
  if (shown.direction === "none" || delta.deltaKg == null) return { text: "—", tone: "flat" };
  if (shown.direction === "flat") return { text: "0.0 kg", tone: "flat" };
  const kg = formatNumber(Math.abs(Math.round(delta.deltaKg * 10) / 10), 1);
  const sign = shown.direction === "down" ? "−" : "+";
  return { text: `${sign}${kg} kg`, tone: shown.direction === "down" ? "down" : "up" };
}

function phaseWeightSubtitle(
  points: readonly WeighIn[],
  phase: CaloriePhase,
  asOf: string,
  goalKg: number,
): { change: string | null; changeTone: "down" | "up" | "flat"; toGoal: string } {
  const weighIns = points.filter((point) => point.date >= phase.start && point.date <= asOf);
  const first = weighIns[0] ?? null;
  const last = weighIns[weighIns.length - 1] ?? null;
  let change: string | null = null;
  let changeTone: "down" | "up" | "flat" = "flat";
  if (first && last) {
    const delta = last.kg - first.kg;
    const rounded = Math.round(delta * 10) / 10;
    if (rounded !== 0) {
      const kg = formatNumber(Math.abs(rounded), 1);
      changeTone = rounded < 0 ? "down" : "up";
      change = `${rounded < 0 ? "↓" : "↑"}${kg}`;
    }
  }
  const latest = last ?? latestWeighIn(points, asOf);
  const toGoal =
    latest && Number.isFinite(goalKg)
      ? `${formatNumber(Math.abs(Math.round((latest.kg - goalKg) * 10) / 10), 1)} to goal`
      : "—";
  return { change, changeTone, toGoal };
}

function MacroRow({
  label,
  current,
  target,
  unit,
  warnWhenOver,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  warnWhenOver: boolean;
}) {
  const over = warnWhenOver && target > 0 && current > target;
  const shown = `${formatNumber(current, 1)} / ${formatNumber(target, Number.isInteger(target) ? 0 : 1)} ${unit}`;
  const meterMax = Math.max(target, 0);
  return (
    <div className={`daily-macro-row${over ? " is-over" : ""}`}>
      <div className="daily-macro-head">
        <span className="daily-macro-k">{label}</span>
        <span className="daily-macro-v">{shown}</span>
      </div>
      <div
        className={`daily-macro-bar${over ? " over" : ""}`}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={meterMax}
        aria-valuenow={Math.min(Math.max(current, 0), meterMax)}
        aria-valuetext={over ? `${shown}, over target` : shown}
      >
        <span style={{ width: `${clampPercent(current, target)}%` }} />
      </div>
    </div>
  );
}

function PhaseCountdown({
  daysLeft,
  phase,
  progress,
  dayOf,
  totalDays,
  lastDay,
}: {
  daysLeft: number;
  phase: CaloriePhase;
  progress: number;
  dayOf: number;
  totalDays: number;
  lastDay: boolean;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const full = clamped >= 0.999;
  const label = lastDay ? "Last day" : "days to go";
  const phaseLine = `${phase.name} · day ${formatNumber(dayOf)} of ${formatNumber(totalDays)}`;

  return (
    <div
      className="daily-countdown"
      role="meter"
      aria-label={phase.name}
      aria-valuemin={0}
      aria-valuemax={totalDays}
      aria-valuenow={Math.min(Math.max(totalDays - daysLeft, 0), totalDays)}
      aria-valuetext={
        lastDay ? `Last day of ${phase.name}` : `${formatNumber(daysLeft)} days to go in ${phase.name}`
      }
    >
      <div className="daily-countdown-ring">
        <svg viewBox={`0 0 ${COUNTDOWN_RING} ${COUNTDOWN_RING}`} aria-hidden="true">
          <circle
            className="daily-countdown-track"
            cx={COUNTDOWN_RING / 2}
            cy={COUNTDOWN_RING / 2}
            r={COUNTDOWN_RADIUS}
            fill="none"
            strokeWidth={COUNTDOWN_STROKE}
          />
          {clamped > 0 ? (
            <circle
              className="daily-countdown-fill"
              cx={COUNTDOWN_RING / 2}
              cy={COUNTDOWN_RING / 2}
              r={COUNTDOWN_RADIUS}
              fill="none"
              strokeWidth={COUNTDOWN_STROKE}
              strokeLinecap={full ? undefined : "round"}
              strokeDasharray={full ? undefined : `${COUNTDOWN_CIRCUMFERENCE} ${COUNTDOWN_CIRCUMFERENCE}`}
              strokeDashoffset={full ? undefined : COUNTDOWN_CIRCUMFERENCE * (1 - clamped)}
              transform={`rotate(-90 ${COUNTDOWN_RING / 2} ${COUNTDOWN_RING / 2})`}
            />
          ) : null}
        </svg>
        <span className="daily-countdown-num" aria-hidden="true">
          {formatNumber(daysLeft)}
        </span>
      </div>
      <p className="daily-countdown-cap" aria-hidden="true">
        {label}
      </p>
      <p className="daily-countdown-phase" aria-hidden="true">
        {phaseLine}
      </p>
    </div>
  );
}

export function DietTodayCard({
  data,
  today: calendarToday,
}: {
  data: DietDashboardView;
  today: string;
}) {
  const { today, targets } = data;
  const kcal = today.kcal ?? 0;
  const digits = kcalDigits(kcal);
  const kcalOver = kcal > targets.calories_kcal;
  const kcalRemaining = targets.calories_kcal - kcal;
  const kcalLeftLabel = kcalOver
    ? `${formatNumber(Math.abs(kcalRemaining), digits)} over`
    : `${formatNumber(kcalRemaining, digits)} left`;
  const kcalLabel = formatNumber(kcal, digits);
  const selected = today.date;
  const asOf = selected < calendarToday ? selected : calendarToday;
  const averageAnchor = selected < calendarToday ? shiftIsoDate(selected, 1) : calendarToday;
  const loggedDays = data.days.map((day) => ({ date: day.date, kcal: day.kcal }));
  const rolling = rollingCalorieAverage(loggedDays, averageAnchor, targets.calories_kcal);
  const phase = data.phase_board;
  const phaseDays = phase ? phaseLengthDays(phase.phase) : 0;
  const lastDay = phase?.daysLeft === 1;
  const week = weightWindowDelta(data.weight_points, asOf, 7);
  const span21 = weightWindowDelta(data.weight_points, asOf, 21);
  const weekValue = changeValue(week);
  const span21Value = changeValue(span21);
  const latest = latestWeighIn(data.weight_points, asOf);
  const weightSub = phase
    ? phaseWeightSubtitle(data.weight_points, phase.phase, asOf, data.goal_weight_kg)
    : {
        change: null,
        changeTone: "flat" as const,
        toGoal: latest
          ? `${formatNumber(Math.abs(Math.round((latest.kg - data.goal_weight_kg) * 10) / 10), 1)} to goal`
          : "—",
      };
  const clawBack =
    rolling && rolling.deltaKcal > CLAW_BACK_KCAL_THRESHOLD && rolling.bufferKcal < 0
      ? bufferLabel(rolling.bufferKcal)
      : null;
  const phaseAvg = phase?.average ?? null;
  const dayOf = phase && phaseDays > 0 ? phaseDays - phase.daysLeft + 1 : 0;
  const phaseProgressShare = phase ? phaseProgress(selected, phase.phase) : 0;

  return (
    <section className="card daily-tile" data-tab-group="diet" data-tile="daily">
      <h2 className="daily-tile-title">{today.label}</h2>
      <div className="daily-stack">
        <div className="daily-hero daily-hero-kcal">
          <p className="daily-hero-val">
            {kcalLabel} <span className="daily-hero-unit">kcal</span>
          </p>
          <p className={`daily-hero-sub${kcalOver ? " is-over" : " is-under"}`}>{kcalLeftLabel}</p>
        </div>
        <div className="daily-hero daily-hero-weight">
          <p className="daily-hero-val">
            {latest ? formatNumber(latest.kg, 1) : "—"}{" "}
            {latest ? <span className="daily-hero-unit">kg</span> : null}
          </p>
          <p className="daily-hero-sub">
            {weightSub.change ? (
              <span className={weightSub.changeTone === "down" ? "is-down" : "is-up"}>{weightSub.change}</span>
            ) : null}
            {weightSub.change ? " · " : null}
            <span>{weightSub.toGoal}</span>
          </p>
        </div>
        <div className="daily-rule" aria-hidden="true" />

        <div className="daily-stat-lines">
          <div className="daily-stat-line">
            <span className="daily-stat-k">7-day avg</span>
            <span className="daily-stat-v">
              {rolling ? (
                <>
                  {formatNumber(rolling.averageKcal)}{" "}
                  <span className="daily-stat-delta">{avgDeltaParen(rolling)}</span>
                </>
              ) : (
                "—"
              )}
            </span>
          </div>
          <div className="daily-stat-line">
            <span className="daily-stat-k">Phase avg</span>
            <span className="daily-stat-v">
              {phaseAvg ? (
                <>
                  {formatNumber(phaseAvg.averageKcal)}{" "}
                  <span className="daily-stat-delta">{avgDeltaParen(phaseAvg)}</span>
                </>
              ) : (
                "—"
              )}
            </span>
          </div>
          {clawBack ? <p className="daily-claw-back">{clawBack}</p> : null}
          <div className="daily-stat-line">
            <span className="daily-stat-k">7-day change</span>
            <span
              className={`daily-stat-v${weekValue.tone !== "flat" ? ` is-${weekValue.tone}` : ""}`}
              title={week.detail}
            >
              {weekValue.text}
            </span>
          </div>
          <div className="daily-stat-line">
            <span className="daily-stat-k">21-day change</span>
            <span
              className={`daily-stat-v${span21Value.tone !== "flat" ? ` is-${span21Value.tone}` : ""}`}
              title={span21.detail}
            >
              {span21Value.text}
            </span>
          </div>
        </div>
        <div className="daily-rule daily-rule-end" aria-hidden="true" />

        <div className="daily-macros">
          <MacroRow
            label="Protein"
            current={today.protein_g}
            target={targets.protein_g}
            unit="g"
            warnWhenOver={false}
          />
          <MacroRow
            label="Carbs"
            current={today.carbs_g}
            target={targets.carbs_g}
            unit="g"
            warnWhenOver
          />
          <MacroRow label="Fat" current={today.fat_g} target={targets.fat_g} unit="g" warnWhenOver />
          <MacroRow
            label="Water"
            current={today.water_l}
            target={targets.water_l}
            unit="L"
            warnWhenOver={false}
          />
        </div>

        {phase ? (
          <PhaseCountdown
            daysLeft={phase.daysLeft}
            phase={phase.phase}
            progress={phaseProgressShare}
            dayOf={dayOf}
            totalDays={phaseDays}
            lastDay={lastDay ?? false}
          />
        ) : null}
      </div>
    </section>
  );
}
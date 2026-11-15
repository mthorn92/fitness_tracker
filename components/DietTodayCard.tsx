import { DailyRing } from "@/components/DailyRing";
import {
  phaseCalorieSummary,
  rollingCalorieAverage,
  type CalorieAverage,
} from "@/lib/calorie-average";
import { clampPercent, formatNumber } from "@/lib/format";
import { formatWeightDelta, latestWeighIn, weightWindowDelta, type WeightDelta } from "@/lib/weight-delta";
import { phaseLengthDays, phaseProgress } from "@/lib/phases";
import type { DietDashboardView } from "@/lib/types";

function deltaText(average: CalorieAverage): string {
  if (average.status === "even") return "on target";
  const amount = formatNumber(Math.abs(average.deltaKcal));
  return average.status === "under" ? `${amount} under` : `${amount} over`;
}

function kcalDigits(value: number): 0 | 1 {
  return Number.isInteger(value) ? 0 : 1;
}

function AverageChip({
  label,
  average,
  targetKcal,
}: {
  label: string;
  average: CalorieAverage | null;
  targetKcal: number;
}) {
  const target = average?.targetKcal ?? targetKcal;
  return (
    <div className="daily-chip">
      <p className="daily-kicker">{label}</p>
      <p className="daily-chip-figure">
        <span className="daily-chip-num">{average ? formatNumber(average.averageKcal) : "—"}</span>
        <span className="daily-chip-of">/ {formatNumber(target)}</span>
        {average ? <span className={`daily-pill ${average.status}`}>{deltaText(average)}</span> : null}
      </p>
    </div>
  );
}

function changeValue(delta: WeightDelta): { text: string; tone: "down" | "up" | "flat" } {
  const shown = formatWeightDelta(delta.deltaKg);
  if (shown.direction === "none" || delta.deltaKg == null) return { text: "—", tone: "flat" };
  if (shown.direction === "flat") return { text: "0.0 kg", tone: "flat" };
  const kg = formatNumber(Math.abs(Math.round(delta.deltaKg * 10) / 10), 1);
  const arrow = shown.direction === "down" ? "↓" : "↑";
  return { text: `${arrow} ${kg} kg`, tone: shown.direction === "down" ? "down" : "up" };
}

function toGoalText(currentKg: number, goalKg: number): string {
  const delta = Math.round((currentKg - goalKg) * 10) / 10;
  return `${formatNumber(Math.abs(delta), 1)} kg`;
}

function MacroCell({
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
    <div className={`daily-macro${over ? " is-over" : ""}`}>
      <div className="daily-kicker">{label}</div>
      <div className="value">{shown}</div>
      <div
        className={`bar${over ? " over" : ""}`}
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

function WeightStat({
  label,
  value,
  tone,
  hero = false,
  title,
}: {
  label: string;
  value: string;
  tone?: "down" | "up" | "flat";
  hero?: boolean;
  title?: string;
}) {
  const toneClass = tone && tone !== "flat" ? ` is-${tone}` : "";
  return (
    <div className={`weight-stat${hero ? " is-hero" : ""}${toneClass}`} title={title}>
      <p className="daily-kicker">{label}</p>
      <p className="weight-stat-value">{value}</p>
    </div>
  );
}

function WeightCard({ data, asOf }: { data: DietDashboardView; asOf: string }) {
  const latest = latestWeighIn(data.weight_points, asOf);
  const week = weightWindowDelta(data.weight_points, asOf, 7);
  const month = weightWindowDelta(data.weight_points, asOf, 28);
  const weekValue = changeValue(week);
  const monthValue = changeValue(month);
  const goal =
    latest && Number.isFinite(data.goal_weight_kg) ? toGoalText(latest.kg, data.goal_weight_kg) : "—";
  return (
    <div className="daily-chip daily-chip-wide">
      <div className="weight-stats">
        <WeightStat label="Weight" value={latest ? `${formatNumber(latest.kg, 1)} kg` : "—"} hero />
        <WeightStat label="To goal" value={goal} />
        <WeightStat label="7 days" value={weekValue.text} tone={weekValue.tone} title={week.detail} />
        <WeightStat label="28 days" value={monthValue.text} tone={monthValue.tone} title={month.detail} />
      </div>
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
  const kcalStatus = `${formatNumber(Math.abs(kcal - targets.calories_kcal), digits)} ${kcalOver ? "over" : "remaining"}`;
  const kcalLabel = formatNumber(kcal, digits);
  const targetLabel = formatNumber(targets.calories_kcal);
  const loggedDays = data.days.map((day) => ({ date: day.date, kcal: day.kcal }));
  const rolling = rollingCalorieAverage(loggedDays, calendarToday, targets.calories_kcal);
  const phase = phaseCalorieSummary(loggedDays, calendarToday);
  const phaseDays = phase ? phaseLengthDays(phase.phase) : 0;
  const lastDay = phase?.daysLeft === 1;

  return (
    <section className="card daily-tile" data-tab-group="diet" data-tile="daily">
      <h2>{today.label}</h2>
      <div className="daily-rings">
        <DailyRing
          progress={targets.calories_kcal <= 0 ? 0 : kcal / targets.calories_kcal}
          tone={kcalOver ? "over" : "good"}
          label="Calories"
          valueNow={kcal}
          valueMax={targets.calories_kcal}
          valueText={`${kcalLabel} of ${targetLabel} calories, ${kcalStatus}`}
        >
          <span className="daily-ring-num">{kcalLabel}</span>
          <span className="daily-ring-sub">/ {targetLabel}</span>
          <span className={`daily-ring-status${kcalOver ? " is-over" : " is-under"}`}>{kcalStatus}</span>
          <span className="daily-ring-kicker">Calories today</span>
        </DailyRing>
        {phase ? (
          <DailyRing
            progress={phaseProgress(calendarToday, phase.phase)}
            tone="good"
            flag
            label={phase.phase.name}
            valueNow={Math.max(0, phaseDays - phase.daysLeft)}
            valueMax={phaseDays}
            valueText={
              lastDay
                ? `Last day of ${phase.phase.name}`
                : `${formatNumber(phase.daysLeft)} days to go in ${phase.phase.name}`
            }
          >
            <span className="daily-ring-num">{formatNumber(phase.daysLeft)}</span>
            <span className={`daily-ring-sub${lastDay ? " is-last" : ""}`}>
              {lastDay ? "last day!" : "days to go"}
            </span>
            <span className="daily-ring-phase">{phase.phase.name}</span>
          </DailyRing>
        ) : null}
      </div>
      <div className="daily-board">
        <AverageChip label="Calories · 7-day avg" average={rolling} targetKcal={targets.calories_kcal} />
        {phase ? (
          <AverageChip
            label={`${phase.phase.name} · cal avg`}
            average={phase.average}
            targetKcal={phase.phase.kcal_target}
          />
        ) : null}
        <WeightCard data={data} asOf={today.date} />
        <MacroCell
          label="Protein"
          current={today.protein_g}
          target={targets.protein_g}
          unit="g"
          warnWhenOver={false}
        />
        <MacroCell
          label="Carbs"
          current={today.carbs_g}
          target={targets.carbs_g}
          unit="g"
          warnWhenOver
        />
        <MacroCell
          label="Fat"
          current={today.fat_g}
          target={targets.fat_g}
          unit="g"
          warnWhenOver
        />
        <MacroCell
          label="Water"
          current={today.water_l}
          target={targets.water_l}
          unit="L"
          warnWhenOver={false}
        />
      </div>
    </section>
  );
}

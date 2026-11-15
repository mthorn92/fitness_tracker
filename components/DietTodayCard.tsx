import { DailyRing } from "@/components/DailyRing";
import {
  phaseCalorieSummary,
  rollingCalorieAverage,
  rollingLoggedMean,
  type CalorieAverage,
} from "@/lib/calorie-average";
import { clampPercent, formatNumber } from "@/lib/format";
import { formatWeightDelta, kgToGoal, latestWeighIn, weightWindowDelta, type WeightDelta } from "@/lib/weight-delta";
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
      <p className="daily-chip-label">{label}</p>
      <p className="daily-chip-figure">
        <span className="daily-chip-num">{average ? formatNumber(average.averageKcal) : "—"}</span>
        <span className="daily-chip-of">/ {formatNumber(target)}</span>
        {average ? <span className={`daily-pill ${average.status}`}>{deltaText(average)}</span> : null}
      </p>
    </div>
  );
}

function formatSevenDay(value: number | null, digits: number, unit: string): string {
  if (value == null) return "7d avg —";
  const shown = digits === 0 ? Math.round(value) : value;
  return `7d avg ${formatNumber(shown, digits)} ${unit}`;
}

function changeTag(days: number, delta: WeightDelta): { text: string; tone: "under" | "over" | "even" } {
  const shown = formatWeightDelta(delta.deltaKg);
  if (shown.direction === "none" || delta.deltaKg == null) return { text: `${days}d —`, tone: "even" };
  if (shown.direction === "flat") return { text: `${days}d 0.0 kg`, tone: "even" };
  const kg = formatNumber(Math.abs(Math.round(delta.deltaKg * 10) / 10), 1);
  const arrow = shown.direction === "down" ? "↓" : "↑";
  return {
    text: `${days}d ${arrow} ${kg} kg`,
    tone: shown.direction === "down" ? "under" : "over",
  };
}

function MacroCell({
  label,
  current,
  target,
  unit,
  warnWhenOver,
  average,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  warnWhenOver: boolean;
  average: number | null;
}) {
  const over = warnWhenOver && target > 0 && current > target;
  const shown = `${formatNumber(current, 1)} / ${formatNumber(target, Number.isInteger(target) ? 0 : 1)} ${unit}`;
  const meterMax = Math.max(target, 0);
  const avgDigits = unit === "L" ? 1 : 0;
  return (
    <div className={`daily-macro${over ? " is-over" : ""}`}>
      <div className="label">{label}</div>
      <div className="macro-line">
        <div className="value">{shown}</div>
        <div className="macro-avg">{formatSevenDay(average, avgDigits, unit)}</div>
      </div>
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

function WeightCards({ data, asOf }: { data: DietDashboardView; asOf: string }) {
  const latest = latestWeighIn(data.weight_points, asOf);
  const goal = latest ? kgToGoal(latest.kg, data.goal_weight_kg) : null;
  const week = weightWindowDelta(data.weight_points, asOf, 7);
  const month = weightWindowDelta(data.weight_points, asOf, 28);
  const weekTag = changeTag(7, week);
  const monthTag = changeTag(28, month);
  return (
    <>
      <div className="daily-chip">
        <p className="daily-chip-label">Weight</p>
        <p className="daily-chip-figure">
          <span className="daily-chip-num">{latest ? formatNumber(latest.kg, 1) : "—"}</span>
          {latest ? <span className="daily-chip-of">kg</span> : null}
        </p>
        {goal ? <p className="daily-chip-note">{goal}</p> : null}
      </div>
      <div className="daily-chip">
        <p className="daily-chip-label">Change</p>
        <p className="daily-chip-tags">
          <span className={`daily-pill ${weekTag.tone}`} title={week.detail}>
            {weekTag.text}
          </span>
          <span className={`daily-pill ${monthTag.tone}`} title={month.detail}>
            {monthTag.text}
          </span>
        </p>
      </div>
    </>
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
  const proteinAvg = rollingLoggedMean(
    data.days.map((day) => ({ date: day.date, value: day.kcal == null ? null : day.protein_g })),
    calendarToday,
  );
  const carbsAvg = rollingLoggedMean(
    data.days.map((day) => ({ date: day.date, value: day.kcal == null ? null : day.carbs_g })),
    calendarToday,
  );
  const fatAvg = rollingLoggedMean(
    data.days.map((day) => ({ date: day.date, value: day.kcal == null ? null : day.fat_g })),
    calendarToday,
  );
  const waterAvg = rollingLoggedMean(
    data.days.map((day) => ({ date: day.date, value: day.water_l > 0 ? day.water_l : null })),
    calendarToday,
  );
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
      <div className="daily-stats">
        <AverageChip label="7-day avg" average={rolling} targetKcal={targets.calories_kcal} />
        {phase ? (
          <AverageChip
            label={`${phase.phase.name} avg`}
            average={phase.average}
            targetKcal={phase.phase.kcal_target}
          />
        ) : (
          <div className="daily-chip" aria-hidden="true" />
        )}
        <WeightCards data={data} asOf={today.date} />
      </div>
      <div className="daily-macros">
        <MacroCell
          label="Protein"
          current={today.protein_g}
          target={targets.protein_g}
          unit="g"
          warnWhenOver={false}
          average={proteinAvg}
        />
        <MacroCell
          label="Carbs"
          current={today.carbs_g}
          target={targets.carbs_g}
          unit="g"
          warnWhenOver
          average={carbsAvg}
        />
        <MacroCell
          label="Fat"
          current={today.fat_g}
          target={targets.fat_g}
          unit="g"
          warnWhenOver
          average={fatAvg}
        />
        <MacroCell
          label="Water"
          current={today.water_l}
          target={targets.water_l}
          unit="L"
          warnWhenOver={false}
          average={waterAvg}
        />
      </div>
    </section>
  );
}

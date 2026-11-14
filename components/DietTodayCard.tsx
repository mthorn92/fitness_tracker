import {
  phaseCalorieSummary,
  rollingCalorieAverage,
  type CalorieAverage,
} from "@/lib/calorie-average";
import { formatNumber } from "@/lib/format";
import { phaseLengthDays, phaseProgress } from "@/lib/phases";
import type { DietDashboardView } from "@/lib/types";

function barWidth(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}

function deltaText(average: CalorieAverage): string {
  if (average.status === "even") return "on target";
  const amount = formatNumber(Math.abs(average.deltaKcal));
  return average.status === "under" ? `${amount} under` : `${amount} over`;
}

function coverageText(days: number): string | null {
  if (days <= 0 || days >= 7) return null;
  return days === 1 ? "avg of 1 day" : `avg of ${days} days`;
}

function PhaseCountdown({
  daysLeft,
  done,
  total,
  progress,
  name,
}: {
  daysLeft: number;
  done: number;
  total: number;
  progress: number;
  name: string;
}) {
  const lastDay = daysLeft === 1;
  return (
    <>
      <div className="phase-count">
        <span className="phase-num">{formatNumber(daysLeft)}</span>
        <span className={`phase-count-label${lastDay ? " is-last" : ""}`}>
          {lastDay ? "last day!" : "days to go"}
        </span>
      </div>
      <div
        className="phase-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.max(0, done)}
        aria-label={lastDay ? `Last day of ${name}` : `${formatNumber(daysLeft)} days to go in ${name}`}
      >
        <span className="phase-fill" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
        <span className="phase-flag" aria-hidden="true">
          🎄
        </span>
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
  const remaining = Math.max(0, targets.calories_kcal - kcal);
  const kcalPct = barWidth(kcal, targets.calories_kcal);
  const loggedDays = data.days.map((day) => ({ date: day.date, kcal: day.kcal }));
  const rolling = rollingCalorieAverage(loggedDays, calendarToday, targets.calories_kcal);
  const phase = phaseCalorieSummary(loggedDays, calendarToday);
  const rollingCoverage = rolling ? coverageText(rolling.days) : null;
  const proteinPct = barWidth(today.protein_g, targets.protein_g);
  const carbsPct = barWidth(today.carbs_g, targets.carbs_g);
  const fatPct = barWidth(today.fat_g, targets.fat_g);
  const waterPct = barWidth(today.water_l, targets.water_l);

  return (
    <section className="card" data-tab-group="diet" data-tile="daily">
      <h2>{today.label}</h2>
      <div className="grid">
        <div className="metric span2">
          <div className="calorie-head">
            <div className="label">Calories</div>
            <div className="value">
              {formatNumber(kcal, kcal % 1 === 0 ? 0 : 1)} / {formatNumber(targets.calories_kcal)}
            </div>
            {phase ? (
              <PhaseCountdown
                daysLeft={phase.daysLeft}
                done={phaseLengthDays(phase.phase) - phase.daysLeft}
                total={phaseLengthDays(phase.phase)}
                progress={phaseProgress(calendarToday, phase.phase)}
                name={phase.phase.name}
              />
            ) : null}
            <div className={`bar${kcalPct > 100 ? " over" : ""}`}>
              <span style={{ width: `${Math.min(100, kcalPct)}%` }} />
            </div>
            <div className="sub">{formatNumber(remaining)} kcal remaining</div>
          </div>
          <p className="roll">
            <span className="roll-keep">
              7-day avg:{" "}
              {rolling
                ? `${formatNumber(rolling.averageKcal)} / ${formatNumber(rolling.targetKcal)}`
                : `— / ${formatNumber(targets.calories_kcal)}`}
            </span>
            {rolling ? (
              <span className={`roll-keep roll-delta ${rolling.status}`}> · {deltaText(rolling)}</span>
            ) : null}
          </p>
          {rollingCoverage ? <p className="roll-coverage">{rollingCoverage}</p> : null}
          {phase ? (
            <p className="roll">
              <span className="roll-keep">
                {phase.phase.name}: avg{" "}
                {phase.average
                  ? `${formatNumber(phase.average.averageKcal)} / ${formatNumber(phase.average.targetKcal)}`
                  : `— / ${formatNumber(phase.phase.kcal_target)}`}
              </span>
              {phase.average ? (
                <span className={`roll-keep roll-delta ${phase.average.status}`}> · {deltaText(phase.average)}</span>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="metric macro">
          <div className="label">Protein</div>
          <div className="value">
            {formatNumber(today.protein_g, 1)} / {targets.protein_g} g
          </div>
          <div className={`bar${proteinPct > 100 ? " over" : ""}`}>
            <span style={{ width: `${Math.min(100, proteinPct)}%` }} />
          </div>
        </div>
        <div className="metric macro">
          <div className="label">Carbs</div>
          <div className="value">
            {formatNumber(today.carbs_g, 1)} / {targets.carbs_g} g
          </div>
          <div className={`bar${carbsPct > 100 ? " over" : ""}`}>
            <span style={{ width: `${Math.min(100, carbsPct)}%` }} />
          </div>
        </div>
        <div className="metric macro">
          <div className="label">Fat</div>
          <div className="value">
            {formatNumber(today.fat_g, 1)} / {targets.fat_g} g
          </div>
          <div className={`bar${fatPct > 100 ? " over" : ""}`}>
            <span style={{ width: `${Math.min(100, fatPct)}%` }} />
          </div>
        </div>
        <div className="metric">
          <div className="label">Water</div>
          <div className="value">
            {formatNumber(today.water_l, 1)} / {targets.water_l} L
          </div>
          <div className={`bar${waterPct > 100 ? " over" : ""}`}>
            <span style={{ width: `${Math.min(100, waterPct)}%` }} />
          </div>
        </div>
        <div className="metric">
          <div className="label">Weight</div>
          <div className="value">
            {today.weight_kg == null ? "—" : `${formatNumber(today.weight_kg, 1)} kg`}
          </div>
        </div>
      </div>
    </section>
  );
}

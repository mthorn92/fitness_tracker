import type { DietDashboardView } from "@/lib/types";
import { formatNumber } from "@/lib/format";

function barWidth(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}

export function DietTodayCard({ data }: { data: DietDashboardView }) {
  const { today, targets } = data;
  const kcal = today.kcal ?? 0;
  const remaining = Math.max(0, targets.calories_kcal - kcal);
  const kcalPct = barWidth(kcal, targets.calories_kcal);
  const proteinPct = barWidth(today.protein_g, targets.protein_g);
  const carbsPct = barWidth(today.carbs_g, targets.carbs_g);
  const fatPct = barWidth(today.fat_g, targets.fat_g);
  const waterPct = barWidth(today.water_l, targets.water_l);
  const cycleLabel =
    today.cycle_closed === true ? "cycle closed" : today.cycle_closed === false ? "cycle open" : null;

  return (
    <section className="card">
      <h2>{today.label}</h2>
      <div className="grid">
        <div className="metric span2">
          <div className="label">Calories</div>
          <div className="value">
            {formatNumber(kcal, kcal % 1 === 0 ? 0 : 1)} / {formatNumber(targets.calories_kcal)}
          </div>
          <div className="sub">{formatNumber(remaining)} kcal remaining</div>
          <div className={`bar${kcalPct > 100 ? " over" : ""}`}>
            <span style={{ width: `${Math.min(100, kcalPct)}%` }} />
          </div>
        </div>
        <div className="metric">
          <div className="label">Protein</div>
          <div className="value">
            {formatNumber(today.protein_g, 1)} / {targets.protein_g} g
          </div>
          <div className={`bar${proteinPct > 100 ? " over" : ""}`}>
            <span style={{ width: `${Math.min(100, proteinPct)}%` }} />
          </div>
        </div>
        <div className="metric">
          <div className="label">Carbs</div>
          <div className="value">
            {formatNumber(today.carbs_g, 1)} / {targets.carbs_g} g
          </div>
          <div className={`bar${carbsPct > 100 ? " over" : ""}`}>
            <span style={{ width: `${Math.min(100, carbsPct)}%` }} />
          </div>
        </div>
        <div className="metric">
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
          <div className="label">WHOOP burn</div>
          <div className="value">
            {today.whoop_burn_kcal == null ? "—" : `${formatNumber(today.whoop_burn_kcal)} kcal`}
          </div>
          {cycleLabel ? (
            <div className="sub">
              {today.cycle_closed ? "closed" : "so far"} · {cycleLabel}
            </div>
          ) : null}
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

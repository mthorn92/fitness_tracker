/**
 * Y-axis for a target line that must sit on a gridline.
 * The top of the axis is one step above the target, and only moves higher,
 * still in whole steps, when a plotted value exceeds that.
 */
export type TargetAxis = {
  step: number;
  max: number;
};

function divides(target: number, step: number): boolean {
  if (!(step > 0) || !Number.isFinite(step)) return false;
  const quot = target / step;
  return Math.abs(quot - Math.round(quot)) < 1e-6 && Math.round(quot) >= 1;
}

/** 1, 2, 2.5, or 5 times a power of ten. */
function isNiceStep(step: number): boolean {
  if (!(step > 0)) return false;
  const exp = Math.floor(Math.log10(step));
  const mantissa = step / 10 ** exp;
  return [1, 2, 2.5, 5].some((base) => Math.abs(mantissa - base) < 1e-6);
}

/** Intervals from zero up to target + one step. */
function intervalCount(target: number, step: number): number {
  return Math.round(target / step) + 1;
}

export function targetAxis(target: number, dataMax = 0): TargetAxis {
  const safeTarget = Number.isFinite(target) && target > 0 ? target : 1;
  const candidates = new Set<number>();
  for (let exp = -2; exp <= 6; exp += 1) {
    for (const base of [1, 2, 2.5, 5]) {
      const step = base * 10 ** exp;
      if (divides(safeTarget, step)) candidates.add(step);
    }
  }
  for (let parts = 2; parts <= 8; parts += 1) {
    const step = safeTarget / parts;
    if (divides(safeTarget, step)) candidates.add(step);
  }

  const scored = [...candidates];
  const inBand = scored.filter((step) => {
    const count = intervalCount(safeTarget, step);
    return count >= 4 && count <= 6;
  });
  const pool = inBand.length > 0 ? inBand : scored;
  const targetIsInteger = Math.abs(safeTarget - Math.round(safeTarget)) < 1e-6;
  pool.sort((a, b) => {
    const integerA = targetIsInteger && Math.abs(a - Math.round(a)) < 1e-6 ? 0 : 1;
    const integerB = targetIsInteger && Math.abs(b - Math.round(b)) < 1e-6 ? 0 : 1;
    if (integerA !== integerB) return integerA - integerB;
    const niceA = isNiceStep(a) ? 0 : 1;
    const niceB = isNiceStep(b) ? 0 : 1;
    if (niceA !== niceB) return niceA - niceB;
    const bandA = Math.abs(intervalCount(safeTarget, a) - 5);
    const bandB = Math.abs(intervalCount(safeTarget, b) - 5);
    if (bandA !== bandB) return bandA - bandB;
    return b - a;
  });

  const step = pool[0] ?? safeTarget;
  const peak = Number.isFinite(dataMax) ? Math.max(0, dataMax) : 0;
  const stepsAbove = Math.max(1, Math.ceil((peak - safeTarget) / step - 1e-9));
  return { step, max: safeTarget + stepsAbove * step };
}

export function formatAverageLabel(kind: "kcal" | "protein" | "water", perDay: number): string {
  if (!Number.isFinite(perDay)) return "avg";
  if (kind === "water") {
    return `avg ${perDay.toLocaleString("en-AU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  }
  return `avg ${Math.round(perDay).toLocaleString("en-AU")}`;
}

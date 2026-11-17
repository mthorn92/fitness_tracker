import type { PrescribedExercise } from "@/lib/types";

/** One strength day, ready to paste into a workout generator. */
export type StrengthCopyDay = {
  name: string;
  weekLabel: string;
  items: PrescribedExercise[];
  deloadNote?: string | null;
};

/**
 * Plain text for one strength day.
 * Superset exercises are grouped under a "Superset X:" line and prefixed with a dash.
 * Everything else is one exercise per line. No emoji or markdown.
 */
export function formatStrengthDayCopy(day: StrengthCopyDay): string {
  const lines: string[] = [formatDayHeader(day.name)];
  for (const item of day.items) {
    lines.push(`${item.name}: ${formatCopyDose(item)}`);
  }
  if (day.deloadNote) {
    lines.push("");
    lines.push(day.deloadNote);
  }
  return lines.join("\n");
}

/** The four strength days, separated by a blank line, in week order. */
export function formatStrengthWeekCopy(days: StrengthCopyDay[]): string {
  return days.map((day) => formatStrengthDayCopy(day)).join("\n\n");
}

function formatDayHeader(name: string): string {
  const trimmed = name.trim();
  if (trimmed.includes("·")) return trimmed;
  const match = /^(Day\s+\S+)\s+(.+)$/i.exec(trimmed);
  if (!match) return trimmed;
  const focus = match[2].trim();
  const titled = focus.charAt(0).toUpperCase() + focus.slice(1);
  return `${match[1]} · ${titled}`;
}

function formatCopyDose(item: PrescribedExercise): string {
  if (item.extra === "attempt") return `${formatCount(item.sets)} attempts`;
  const dose =
    item.hold_s != null
      ? `${formatCount(item.sets)} × ${formatCount(item.hold_s)}s`
      : `${formatCount(item.sets)} × ${formatCount(item.reps)}${item.extra === "per leg" ? "/leg" : ""}`;
  const load =
    item.load_kg == null ? "" : ` @ ${formatCount(item.load_kg)} kg${item.extra === "per hand" ? "/hand" : ""}`;
  const band = item.band ? ` (${formatBand(item.band)})` : "";
  return `${dose}${load}${band}`;
}

function formatBand(band: string): string {
  if (band === "bodyweight") return "bodyweight";
  const match = /^(\d+) red$/.exec(band);
  if (!match) return band;
  const count = match[1] ?? band;
  return `${count} red ${count === "1" ? "band" : "bands"}`;
}

function formatCount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

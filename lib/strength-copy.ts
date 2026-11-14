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
  const lines: string[] = [`${formatDayTitle(day.name)} (${day.weekLabel})`];
  let currentLetter: string | null = null;
  for (const item of day.items) {
    const letter = supersetLetter(item.group);
    if (letter && letter !== currentLetter) lines.push(`Superset ${letter}:`);
    currentLetter = letter;
    const prefix = letter ? "- " : "";
    lines.push(`${prefix}${item.name}: ${formatCopyDose(item)}`);
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

function formatDayTitle(name: string): string {
  const match = /^(Day\s+\S+)\s+(.+)$/.exec(name.trim());
  if (!match) return name.trim();
  const focus = match[2].trim();
  return `${match[1]} - ${focus.charAt(0).toUpperCase()}${focus.slice(1)}`;
}

function supersetLetter(group: string | null): string | null {
  if (!group) return null;
  const match = /^([A-Za-z]+)\d*$/.exec(group);
  return match ? match[1].toUpperCase() : group;
}

function formatCopyDose(item: PrescribedExercise): string {
  if (item.extra === "attempt") return `${formatCount(item.sets)} attempts`;
  const dose =
    item.hold_s != null
      ? `${formatCount(item.sets)} x ${formatCount(item.hold_s)}s`
      : `${formatCount(item.sets)} x ${formatCount(item.reps)}${item.extra === "per leg" ? "/leg" : ""}`;
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

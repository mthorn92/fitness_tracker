const DATE_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  day: "numeric",
  month: "short",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
});

export function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateLabel(isoDate: string): string {
  return DATE_FORMATTER.format(parseIsoDate(isoDate));
}

export function formatShortDate(isoDate: string): string {
  return SHORT_DATE_FORMATTER.format(parseIsoDate(isoDate));
}

export function formatWeekday(isoDate: string): string {
  return WEEKDAY_FORMATTER.format(parseIsoDate(isoDate));
}

export function formatDatePill(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  const weekday = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" }).format(date);
  const day = new Intl.DateTimeFormat("en-AU", { day: "numeric", timeZone: "UTC" }).format(date);
  const month = new Intl.DateTimeFormat("en-AU", { month: "short", timeZone: "UTC" }).format(date);
  return `${weekday}, ${day} ${month}`;
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Calendar YYYY-MM-DD in the user's logging timezone (Whoop offset +11). */
export function todayIsoDate(timeZone = "Australia/Sydney"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** e.g. "Tue 10 Nov 2026, 2:35 pm Melbourne time" */
export function formatUpdatedLabel(date = new Date(), timeZone = "Australia/Melbourne"): string {
  const weekday = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone }).format(date);
  const day = new Intl.DateTimeFormat("en-AU", { day: "numeric", timeZone }).format(date);
  const month = new Intl.DateTimeFormat("en-AU", { month: "short", timeZone }).format(date);
  const year = new Intl.DateTimeFormat("en-AU", { year: "numeric", timeZone }).format(date);
  const time = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  })
    .format(date)
    .toLowerCase();
  return `${weekday} ${day} ${month} ${year}, ${time} Melbourne time`;
}

export function formatTime(hhmm: string): string {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const period = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 || 12;
  return minutes === 0 ? `${hour12}${period}` : `${hour12}:${String(minutes).padStart(2, "0")}${period}`;
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("en-AU", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function formatKg(value: number): string {
  return `${formatNumber(value, 1)} kg`;
}

export function formatHours(value: number): string {
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  if (minutes === 0) return `${hours}h`;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function formatSport(sport: string): string {
  const labels: Record<string, string> = {
    swimming: "Swim",
    weightlifting_msk: "Weights",
    spin: "Spin",
  };
  if (labels[sport]) return labels[sport];
  return sport
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function clampPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}

export function recoveryTone(score: number): "low" | "mid" | "high" {
  if (score < 34) return "low";
  if (score < 67) return "mid";
  return "high";
}

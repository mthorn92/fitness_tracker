import { sql } from "@/lib/db";
import { refreshPages } from "@/lib/refresh";
import {
  compareRunsNewestFirst,
  roundIndex,
  type RunScore,
} from "@/lib/run-tile";

const MAX_BATCH = 200;
const STRAVA_ID = /^[A-Za-z0-9_-]{1,32}$/;
const START_TIME =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export type RunScoreParseError = {
  error: "invalid_run_scores";
  index?: number;
  field: string;
};

type ScoreRow = {
  strava_id: string;
  run_date: string;
  start_time: string | null;
  name: string | null;
  distance_m: number | string | null;
  elev_gain_m: number | string | null;
  elev_loss_m: number | string | null;
  avg_hr: number | string | null;
  p97_hr: number | string | null;
  pct_under_145: number | string | null;
  ef_gap: number | string | null;
  disc: number | string | null;
  eff: number | string | null;
  dist: number | string | null;
  elev: number | string | null;
  score_index: number | string | null;
};

/** One object or an array. A repeated strava_id in one batch keeps the last copy. */
export function parseRunScores(body: unknown): RunScore[] | RunScoreParseError {
  if (Array.isArray(body)) {
    if (body.length > MAX_BATCH) return { error: "invalid_run_scores", field: "body" };
    const rows: RunScore[] = [];
    for (let index = 0; index < body.length; index += 1) {
      const parsed = parseRunScore(body[index]);
      if ("field" in parsed) return { error: "invalid_run_scores", index, field: parsed.field };
      rows.push(parsed);
    }
    return rows;
  }
  if (body && typeof body === "object") {
    const parsed = parseRunScore(body);
    if ("field" in parsed) return { error: "invalid_run_scores", index: 0, field: parsed.field };
    return [parsed];
  }
  return { error: "invalid_run_scores", field: "body" };
}

export function dedupeRunScores(rows: RunScore[]): RunScore[] {
  const byId = new Map<string, RunScore>();
  for (const row of rows) byId.set(row.strava_id, row);
  return [...byId.values()];
}

export async function upsertRunScores(rows: RunScore[]): Promise<RunScore[]> {
  const unique = dedupeRunScores(rows);
  if (unique.length === 0) return [];
  const params: unknown[] = [];
  const tuples: string[] = [];
  for (const row of unique) {
    const base = params.length;
    const slots = Array.from({ length: 16 }, (_, i) => `$${base + i + 1}`);
    tuples.push(`(${slots.join(", ")}, now())`);
    params.push(
      row.strava_id,
      row.date,
      row.start_time,
      row.name,
      row.distance_m,
      row.elev_gain_m,
      row.elev_loss_m,
      row.avg_hr,
      row.p97_hr,
      row.pct_under_145,
      row.ef_gap,
      row.disc,
      row.eff,
      row.dist,
      row.elev,
      row.index,
    );
  }
  const saved = await sql<ScoreRow>(
    `insert into run_scores (
       strava_id, run_date, start_time, name, distance_m, elev_gain_m, elev_loss_m,
       avg_hr, p97_hr, pct_under_145, ef_gap, disc, eff, dist, elev, score_index, updated_at
     ) values ${tuples.join(", ")}
     on conflict (strava_id) do update set
       run_date = excluded.run_date,
       start_time = excluded.start_time,
       name = excluded.name,
       distance_m = excluded.distance_m,
       elev_gain_m = excluded.elev_gain_m,
       elev_loss_m = excluded.elev_loss_m,
       avg_hr = excluded.avg_hr,
       p97_hr = excluded.p97_hr,
       pct_under_145 = excluded.pct_under_145,
       ef_gap = excluded.ef_gap,
       disc = excluded.disc,
       eff = excluded.eff,
       dist = excluded.dist,
       elev = excluded.elev,
       score_index = excluded.score_index,
       updated_at = now()
     returning strava_id, run_date, start_time, name, distance_m, elev_gain_m, elev_loss_m,
       avg_hr, p97_hr, pct_under_145, ef_gap, disc, eff, dist, elev, score_index`,
    params,
  );
  await refreshPages();
  return saved.map(mapScore).sort(compareRunsNewestFirst);
}

/** Newest first. `from` is an inclusive Melbourne date. */
export async function listRunScores(range?: { from: string }): Promise<RunScore[]> {
  const rows = range
    ? await sql<ScoreRow>(
        `select strava_id, run_date, start_time, name, distance_m, elev_gain_m, elev_loss_m,
                avg_hr, p97_hr, pct_under_145, ef_gap, disc, eff, dist, elev, score_index
         from run_scores
         where run_date >= $1
         order by run_date desc, start_time desc nulls last, strava_id desc`,
        [range.from],
      )
    : await sql<ScoreRow>(
        `select strava_id, run_date, start_time, name, distance_m, elev_gain_m, elev_loss_m,
                avg_hr, p97_hr, pct_under_145, ef_gap, disc, eff, dist, elev, score_index
         from run_scores
         order by run_date desc, start_time desc nulls last, strava_id desc`,
      );
  return rows.map(mapScore);
}

export function realCalendarDay(iso: string): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseRunScore(value: unknown): RunScore | { field: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { field: "run" };
  const row = value as Record<string, unknown>;
  const stravaId = requiredId(row.strava_id);
  if (!stravaId) return { field: "strava_id" };
  const date = requiredDate(row.date);
  if (!date) return { field: "date" };
  const start = optionalString(row, "start_time", 40);
  if (start === "invalid") return { field: "start_time" };
  if (start && (!START_TIME.test(start) || !Number.isFinite(Date.parse(start)) || !realCalendarDay(start.slice(0, 10)))) {
    return { field: "start_time" };
  }
  const name = optionalString(row, "name", 240);
  if (name === "invalid") return { field: "name" };
  const distance = optionalNumber(row, "distance_m", 0, 1_000_000);
  if (distance === "invalid") return { field: "distance_m" };
  const gain = optionalNumber(row, "elev_gain_m", 0, 20_000);
  if (gain === "invalid") return { field: "elev_gain_m" };
  const loss = optionalNumber(row, "elev_loss_m", 0, 20_000);
  if (loss === "invalid") return { field: "elev_loss_m" };
  const avgHr = optionalNumber(row, "avg_hr", 1, 250);
  if (avgHr === "invalid") return { field: "avg_hr" };
  const p97 = optionalNumber(row, "p97_hr", 1, 250);
  if (p97 === "invalid") return { field: "p97_hr" };
  const under = optionalNumber(row, "pct_under_145", 0, 100);
  if (under === "invalid") return { field: "pct_under_145" };
  const ef = optionalNumber(row, "ef_gap", 0, 20);
  if (ef === "invalid") return { field: "ef_gap" };
  const disc = optionalNumber(row, "disc", -1000, 1000);
  if (disc === "invalid") return { field: "disc" };
  const eff = optionalNumber(row, "eff", -1000, 1000);
  if (eff === "invalid") return { field: "eff" };
  const dist = optionalNumber(row, "dist", -1000, 1000);
  if (dist === "invalid") return { field: "dist" };
  const elev = optionalNumber(row, "elev", -1000, 1000);
  if (elev === "invalid") return { field: "elev" };
  const index = optionalNumber(row, "index", -1000, 1000);
  if (index === "invalid") return { field: "index" };
  return {
    strava_id: stravaId,
    date,
    start_time: start,
    name,
    distance_m: distance,
    elev_gain_m: gain,
    elev_loss_m: loss,
    avg_hr: avgHr,
    p97_hr: p97,
    pct_under_145: under,
    ef_gap: ef,
    disc,
    eff,
    dist,
    elev,
    index: index == null ? null : roundIndex(index),
  };
}

function mapScore(row: ScoreRow): RunScore {
  return {
    strava_id: row.strava_id,
    date: row.run_date,
    start_time: row.start_time,
    name: row.name,
    distance_m: asFloat(row.distance_m),
    elev_gain_m: asFloat(row.elev_gain_m),
    elev_loss_m: asFloat(row.elev_loss_m),
    avg_hr: asFloat(row.avg_hr),
    p97_hr: asFloat(row.p97_hr),
    pct_under_145: asFloat(row.pct_under_145),
    ef_gap: asFloat(row.ef_gap),
    disc: asFloat(row.disc),
    eff: asFloat(row.eff),
    dist: asFloat(row.dist),
    elev: asFloat(row.elev),
    index: row.score_index == null ? null : roundIndex(asFloat(row.score_index) ?? 0),
  };
}

function asFloat(value: number | string | null): number | null {
  if (value == null) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function requiredId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return STRAVA_ID.test(trimmed) ? trimmed : null;
}

function requiredDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return realCalendarDay(value) ? value : null;
}

function optionalString(
  row: Record<string, unknown>,
  key: string,
  max: number,
): string | null | "invalid" {
  if (!(key in row) || row[key] == null) return null;
  if (typeof row[key] !== "string") return "invalid";
  const trimmed = (row[key] as string).trim();
  if (trimmed.length < 1 || trimmed.length > max) return "invalid";
  return trimmed;
}

function optionalNumber(
  row: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): number | null | "invalid" {
  if (!(key in row) || row[key] == null) return null;
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return "invalid";
  return value;
}

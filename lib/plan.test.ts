import assert from "node:assert/strict";
import test from "node:test";
import { loadTrainingPlan, planEndDate, prescribeDay, scheduledTrainingDays } from "./plan";

const plan = loadTrainingPlan();

function item(date: string, key: string) {
  const day = prescribeDay(date, plan);
  const found = day.items.find((entry) => entry.key === key);
  assert.ok(found, `${key} missing on ${date}`);
  return found;
}

test("the block is eight weeks starting Monday 16 Nov 2026", () => {
  assert.equal(plan.id, "plan_2026-11-16");
  assert.equal(plan.start_date, "2026-11-16");
  assert.deepEqual(
    plan.weeks.map((week) => week.type),
    ["build", "build", "build", "deload", "build", "build", "build", "deload"],
  );
  assert.equal(planEndDate(plan), "2027-01-10");
  assert.equal(scheduledTrainingDays(plan), 6);
  const monday = prescribeDay("2026-11-16", plan);
  assert.equal(monday.plan_day, "mon");
  assert.equal(monday.week, 1);
  assert.equal(monday.week_type, "build");
});

test("week 1 Monday is the written push day", () => {
  const day = prescribeDay("2026-11-16", plan);
  assert.equal(day.label, "Day A push");
  assert.equal(day.kind, "lift");
  assert.equal(day.deload_note, null);
  const bench = item("2026-11-16", "bench_press");
  assert.equal(bench.sets, 3);
  assert.equal(bench.reps, 7);
  assert.equal(bench.load_kg, 50);
  assert.equal(bench.group, "A1");
  const pull = item("2026-11-16", "banded_pullup");
  assert.equal(pull.sets, 3);
  assert.equal(pull.reps, 6);
  assert.equal(pull.band, "2 red");
  assert.equal(pull.group, "A2");
  const strict = item("2026-11-16", "strict_pullup");
  assert.equal(strict.sets, 2);
  assert.equal(strict.reps, 1);
  assert.equal(strict.extra, "attempt");
  const press = item("2026-11-16", "overhead_press");
  assert.equal(press.sets, 3);
  assert.equal(press.reps, 7);
  assert.equal(press.load_kg, 25);
  const pushdown = item("2026-11-16", "rope_pushdown");
  assert.equal(pushdown.group, "C1");
  assert.equal(pushdown.reps, 10);
  const raise = item("2026-11-16", "db_lateral_raise");
  assert.equal(raise.group, "C2");
  assert.equal(raise.load_kg, 8);
  assert.equal(raise.extra, "per hand");
});

test("easy runs and rest keep the written dose, including on a deload week", () => {
  const run = prescribeDay("2026-11-17", plan);
  assert.equal(run.kind, "cardio");
  assert.equal(run.week_type, "build");
  assert.deepEqual(run.cardio, { duration_min_min: 25, duration_min_max: 30, hr_cap_bpm: 145 });
  assert.equal(run.daily_walk, "Daily walk");

  const deloadRun = prescribeDay("2026-12-08", plan);
  assert.equal(deloadRun.week, 4);
  assert.equal(deloadRun.week_type, "deload");
  assert.equal(deloadRun.plan_day, "tue");
  assert.deepEqual(deloadRun.cardio, run.cardio);
  assert.equal(deloadRun.deload_note, null);

  const rest = prescribeDay("2026-11-22", plan);
  assert.equal(rest.kind, "rest");
  assert.equal(rest.note, "Rest, walk, or an optional swim");
  assert.equal(rest.items.length, 0);
});

test("legs, pull and hinge match week 1", () => {
  assert.equal(item("2026-11-18", "box_squat").load_kg, 40);
  assert.equal(item("2026-11-18", "box_squat").reps, 7);
  assert.equal(item("2026-11-18", "bulgarian_split_squat").extra, "per leg");
  assert.equal(item("2026-11-18", "deadbug").reps, 10);
  assert.equal(item("2026-11-18", "calf_raise").reps, 12);
  assert.equal(item("2026-11-18", "calf_raise").group, "A2");

  const pullup = item("2026-11-19", "banded_pullup");
  assert.equal(pullup.sets, 4);
  assert.equal(pullup.reps, 8);
  assert.equal(pullup.band, "2 red");
  assert.equal(item("2026-11-19", "cable_row").sets, 3);
  assert.equal(item("2026-11-19", "pullup_negative").hold_s, 5);
  assert.equal(item("2026-11-19", "pullup_top_hold").hold_s, 10);
  assert.equal(item("2026-11-19", "face_pull").sets, 2);
  assert.equal(item("2026-11-19", "face_pull").reps, 12);
  assert.equal(item("2026-11-19", "db_curl").reps, 10);

  assert.equal(item("2026-11-21", "deadlift").load_kg, 50);
  assert.equal(item("2026-11-21", "deadlift").reps, 7);
  assert.equal(item("2026-11-21", "dead_hang").hold_s, 20);
  assert.equal(item("2026-11-21", "dead_hang").sets, 2);
  assert.equal(item("2026-11-21", "scap_pullup").reps, 8);
});

test("compounds climb 7, 8, 9 then add load and reset", () => {
  assert.equal(item("2026-11-23", "bench_press").reps, 8);
  assert.equal(item("2026-11-23", "bench_press").load_kg, 50);
  assert.equal(item("2026-11-30", "bench_press").reps, 9);
  assert.equal(item("2026-12-14", "bench_press").reps, 7);
  assert.equal(item("2026-12-14", "bench_press").load_kg, 55);
  assert.equal(item("2026-12-14", "bench_press").sets, 3);

  assert.equal(item("2026-12-14", "overhead_press").load_kg, 27.5);
  assert.equal(item("2026-12-14", "overhead_press").reps, 7);
  assert.equal(item("2026-12-16", "box_squat").load_kg, 45);
  assert.equal(item("2026-12-19", "deadlift").reps, 7);
  assert.equal(item("2026-12-19", "deadlift").load_kg, 55);
  assert.equal(item("2026-12-26", "deadlift").reps, 8);
  assert.equal(item("2026-12-26", "deadlift").load_kg, 55);
});

test("accessories climb 10, 12, 15 and exercises written at 12 stay there", () => {
  assert.equal(item("2026-11-23", "rope_pushdown").reps, 12);
  assert.equal(item("2026-11-30", "rope_pushdown").reps, 15);
  assert.equal(item("2026-12-14", "rope_pushdown").reps, 10);
  assert.equal(item("2026-12-14", "db_lateral_raise").reps, 10);
  assert.equal(item("2026-12-14", "db_lateral_raise").load_kg, 8);
  assert.equal(item("2026-11-25", "deadbug").reps, 12);
  assert.equal(item("2026-12-02", "calf_raise").reps, 12);
  assert.equal(item("2026-12-17", "face_pull").reps, 12);
  assert.equal(item("2026-12-17", "face_pull").sets, 2);
});

test("pull-ups add a rep per build week and drop a band after 10", () => {
  assert.equal(item("2026-11-23", "banded_pullup").reps, 7);
  assert.equal(item("2026-11-23", "banded_pullup").band, "2 red");
  assert.equal(item("2026-12-03", "banded_pullup").sets, 4);
  assert.equal(item("2026-12-03", "banded_pullup").reps, 10);
  assert.equal(item("2026-12-03", "banded_pullup").band, "2 red");
  const dropped = item("2026-12-17", "banded_pullup");
  assert.equal(dropped.reps, 8);
  assert.equal(dropped.band, "1 red");
  assert.equal(dropped.sets, 4);
});

test("deload halves sets, keeps the previous build load, and shows the reserve note", () => {
  const bench = item("2026-12-07", "bench_press");
  assert.equal(prescribeDay("2026-12-07", plan).week_type, "deload");
  assert.equal(prescribeDay("2026-12-07", plan).deload_note, "Stop with 4+ reps in reserve");
  assert.equal(bench.sets, 2);
  assert.equal(bench.reps, 9);
  assert.equal(bench.load_kg, 50);

  const pull = item("2026-12-10", "banded_pullup");
  assert.equal(pull.sets, 2);
  assert.equal(pull.reps, 10);
  assert.equal(pull.band, "2 red");
  assert.equal(item("2026-12-10", "pullup_negative").sets, 2);
  assert.equal(item("2026-12-10", "pullup_top_hold").sets, 1);

  const last = item("2027-01-04", "bench_press");
  assert.equal(prescribeDay("2027-01-04", plan).week, 8);
  assert.equal(last.sets, 2);
  assert.equal(last.reps, 9);
  assert.equal(last.load_kg, 55);
  assert.equal(item("2027-01-09", "dead_hang").sets, 1);
});

test("dates outside the block are not a training day", () => {
  const before = prescribeDay("2026-11-15", plan);
  assert.equal(before.in_block, false);
  assert.equal(before.week, null);
  assert.equal(before.items.length, 0);
  const after = prescribeDay("2027-01-11", plan);
  assert.equal(after.in_block, false);
  assert.equal(prescribeDay("2027-01-10", plan).in_block, true);
  assert.equal(prescribeDay("2027-01-10", plan).kind, "rest");
});

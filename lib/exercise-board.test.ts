import assert from "node:assert/strict";
import test from "node:test";
import { getExerciseBoard, sessionForStrengthDay, strengthSchedule } from "./exercise-board";
import { upsertSession } from "./store";
import type { TrainingSession } from "./types";

process.env.FITNESS_PGLITE_MEMORY = "1";

test("before the block, the four strength tiles preview week 1 in week order", () => {
  const schedule = strengthSchedule("2026-11-12");
  assert.equal(schedule.mode, "upcoming");
  assert.deepEqual(
    schedule.days.map((day) => day.weekday),
    ["mon", "wed", "thu", "sat"],
  );
  assert.deepEqual(
    schedule.days.map((day) => day.date),
    ["2026-11-16", "2026-11-18", "2026-11-19", "2026-11-21"],
  );
  assert.deepEqual(
    schedule.days.map((day) => day.prescribed.label),
    ["Day A push", "Day B legs", "Day C pull", "Day D hinge"],
  );
  assert.equal(schedule.days.every((day) => day.isToday), false);
  const bench = schedule.days[0]?.prescribed.items.find((item) => item.key === "bench_press");
  assert.equal(bench?.sets, 3);
  assert.equal(bench?.reps, 7);
  assert.equal(bench?.load_kg, 50);
  const pull = schedule.days[0]?.prescribed.items.find((item) => item.key === "banded_pullup");
  assert.equal(pull?.band, "2 red");
});

test("a deload week keeps the build reps and halves the sets", () => {
  const schedule = strengthSchedule("2026-12-09");
  assert.equal(schedule.mode, "current");
  const wednesday = schedule.days.find((day) => day.weekday === "wed");
  assert.equal(wednesday?.isToday, true);
  assert.equal(wednesday?.prescribed.week_type, "deload");
  const squat = wednesday?.prescribed.items.find((item) => item.key === "box_squat");
  assert.equal(squat?.sets, 2);
  assert.equal(squat?.reps, 9);
  assert.equal(squat?.load_kg, 40);
  assert.equal(wednesday?.prescribed.deload_note, "Stop with 4+ reps in reserve");
});

test("completion follows plan_day, and a dateless fallback only fills a blank plan day", () => {
  const sessions: TrainingSession[] = [
    session("session_2026-11-18_01", "2026-11-18", "mon", true),
    session("session_2026-11-19_01", "2026-11-19", null, true),
  ];
  assert.equal(sessionForStrengthDay(sessions, { date: "2026-11-16", weekday: "mon" })?.id, "session_2026-11-18_01");
  assert.equal(sessionForStrengthDay(sessions, { date: "2026-11-18", weekday: "wed" }), null);
  assert.equal(sessionForStrengthDay(sessions, { date: "2026-11-19", weekday: "thu" })?.id, "session_2026-11-19_01");
  const skipped = sessionForStrengthDay(
    [session("session_2026-11-16_02", "2026-11-16", "mon", false)],
    { date: "2026-11-16", weekday: "mon" },
  );
  assert.equal(skipped, null);
});

test("the board marks a logged session done and highlights today's strength day", async () => {
  await upsertSession({
    id: "session_2026-11-16_01",
    date: "2026-11-16",
    plan_id: "plan_2026-11-16",
    plan_day: "mon",
    completed: true,
    rpe: 7,
    feedback: "Stopped with reps in reserve.",
    sets: [
      { exercise_key: "bench_press", set: 1, reps: 7, load_kg: 50, band: null, hold_s: null, done: true },
    ],
    duration_min: null,
    avg_hr: null,
  });

  const board = await getExerciseBoard("2026-11-18");
  assert.equal(board.todayMode, "lift");
  assert.deepEqual(
    board.days.map((day) => day.position),
    [1, 2, 4, 5],
  );
  const monday = board.days[0];
  const wednesday = board.days[1];
  assert.equal(monday?.name, "Day A push");
  assert.equal(monday?.status, "Done this week");
  assert.equal(monday?.rpe, 7);
  assert.equal(monday?.groups[0]?.rows[0]?.prescription, "3 × 7 @ 50 kg");
  assert.equal(monday?.groups[0]?.rows[0]?.logged?.includes("7"), true);
  assert.equal(wednesday?.isToday, true);
  assert.equal(wednesday?.status, "Not done this week");
  assert.equal(wednesday?.weekLabel, "Week 1 · build");

  const runDay = await getExerciseBoard("2026-11-17");
  assert.equal(runDay.todayMode, "full");
  assert.equal(runDay.today.dayLabel, "Easy run");
  assert.match(runDay.today.cardioText ?? "", /25–30 min/);

  const before = await getExerciseBoard("2026-11-12");
  assert.equal(before.todayMode, "full");
  assert.equal(before.days[0]?.status, "Preview");
  assert.match(before.today.restNote ?? "", /starts/);
});

function session(
  id: string,
  date: string,
  planDay: TrainingSession["plan_day"],
  completed: boolean,
): TrainingSession {
  return {
    id,
    date,
    plan_id: "plan_2026-11-16",
    plan_day: planDay,
    completed,
    rpe: null,
    feedback: null,
    sets: [],
    duration_min: null,
    avg_hr: null,
  };
}

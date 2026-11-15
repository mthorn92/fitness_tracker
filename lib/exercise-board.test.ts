import assert from "node:assert/strict";
import test from "node:test";
import { buildExerciseBoard, getExerciseBoard, sessionForStrengthDay } from "./exercise-board";
import { loadTrainingPlan } from "./plan";
import type { TrainingSession } from "./types";

process.env.FITNESS_PGLITE_MEMORY = "1";

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

test("week 1 day tiles show the plan target and the logged sets", () => {
  const plan = loadTrainingPlan();
  const board = buildExerciseBoard({
    date: "2026-11-15",
    plan,
    weights: [
      { date: "2026-11-09", kg: 104.6 },
      { date: "2026-11-15", kg: 102 },
    ],
    sessions: [
      {
        id: "session_2026-11-15_01",
        date: "2026-11-15",
        plan_id: plan.id,
        plan_day: null,
        day_slot: "a",
        completed: true,
        rpe: 7,
        feedback: null,
        duration_min: null,
        avg_hr: null,
        sets: [
          { exercise_key: "bench_press", set: 1, reps: 7, load_kg: 50, band: null, hold_s: null, done: true },
          { exercise_key: "bench_press", set: 2, reps: 7, load_kg: 50, band: null, hold_s: null, done: true },
          { exercise_key: "bench_press", set: 3, reps: 7, load_kg: 50, band: null, hold_s: null, done: true },
          { exercise_key: "banded_pullup", set: 1, reps: 6, load_kg: null, band: "2 red", hold_s: null, done: true },
          { exercise_key: "banded_pullup", set: 2, reps: 6, load_kg: null, band: "2 red", hold_s: null, done: true },
          { exercise_key: "banded_pullup", set: 3, reps: 5, load_kg: null, band: "2 red", hold_s: null, done: true },
          { exercise_key: "strict_pullup", set: 1, reps: 1, load_kg: null, band: null, hold_s: null, done: true },
          { exercise_key: "strict_pullup", set: 2, reps: 0, load_kg: null, band: null, hold_s: null, done: true },
        ],
      },
    ],
  });

  assert.equal(board.currentWeek, 1);
  assert.equal(board.weekCount, 5);
  assert.equal(board.todayLabel, "Sun, 15 Nov");
  const week = board.weeks[0];
  assert.equal(week?.subtitle, "Day A done · Daily walk");
  assert.equal(week?.sessions, 1);
  const dayA = week?.days[0];
  const dayB = week?.days[1];
  assert.equal(dayA?.statusLabel, "Sun, 15 Nov");
  assert.equal(dayB?.statusLabel, "Not started");
  const bench = dayA?.rows.find((row) => row.key === "bench_press");
  const pull = dayA?.rows.find((row) => row.key === "banded_pullup");
  const strict = dayA?.rows.find((row) => row.key === "strict_pullup");
  assert.equal(bench?.target, "3 × 7 @ 50 kg");
  assert.equal(bench?.actual, "3×7 @ 50");
  assert.equal(bench?.status, "met");
  assert.equal(pull?.target, "3 × 6 · 2 red bands");
  assert.equal(pull?.actual, "6, 6, 5");
  assert.equal(pull?.status, "partial");
  assert.equal(strict?.status, "partial");
  assert.equal(dayB?.rows.every((row) => row.status === "none"), true);

  assert.equal(board.e1rm.bench, 61.7);
  assert.equal(board.work[0]?.groups.chest, 50 * 7 * 3);
  assert.equal(board.work[0]?.groups.back, 6 + 6 + 5);
  assert.equal(week?.pullups.assisted, 17);
  assert.equal(week?.pullups.strict, 1);
  assert.equal(week?.pullups.band, "2 red");
  assert.equal(board.phase.daysLeft, 37);
  assert.equal(board.phase.blockSessions, 1);
  assert.equal(board.phase.blockTarget, 20);
  assert.equal(board.phase.weightKg, 102);
  assert.equal(board.phase.weightTrend, "down");
  assert.equal(board.phase.strictPullups, 1);

  const week5 = board.weeks[4];
  const laterBench = week5?.days[0]?.rows.find((row) => row.key === "bench_press");
  assert.equal(laterBench?.target, "2 × 7 @ 55 kg");
  assert.equal(laterBench?.status, "none");
});

test("the board loads the active plan when nothing is logged", async () => {
  const board = await getExerciseBoard("2026-11-15");
  assert.equal(board.planId, "plan_2026-11-15");
  assert.equal(board.weeks[0]?.days.map((day) => day.slot).join(""), "abcd");
  assert.equal(board.weeks[0]?.subtitle, "Daily walk");
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

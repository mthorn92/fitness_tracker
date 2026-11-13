import assert from "node:assert/strict";
import test from "node:test";
import { formatShortDate } from "./format";
import type { ExerciseEntry } from "./types";
import { isWhoopWorkout, whoopWindowStart, whoopWorkoutsModel } from "./whoop-workouts";

const END = "2026-11-12";

test("the window is the last 7 days and includes the end date", () => {
  assert.equal(whoopWindowStart(END), "2026-11-06");
  const model = whoopWorkoutsModel(
    {
      "2026-11-05": { exercise: [workout("exercise_2026-11-05_01", "Too old")] },
      "2026-11-06": { exercise: [workout("exercise_2026-11-06_01", "Oldest kept", { time: "08:00" })] },
      "2026-11-12": { exercise: [workout("exercise_2026-11-12_01", "Today", { time: "18:10" })] },
    },
    END,
  );
  assert.deepEqual(
    model.rows.map((row) => row.name),
    ["Today", "Oldest kept"],
  );
  assert.equal(model.rows[0]?.dateLabel, formatShortDate("2026-11-12"));
});

test("whoop source is shown, another source is not, and a blank source is kept", () => {
  assert.equal(isWhoopWorkout({ source: "whoop" }), true);
  assert.equal(isWhoopWorkout({ source: " WHOOP " }), true);
  assert.equal(isWhoopWorkout({ source: null }), true);
  assert.equal(isWhoopWorkout({ source: "  " }), true);
  assert.equal(isWhoopWorkout({}), true);
  assert.equal(isWhoopWorkout({ source: "manual" }), false);

  const model = whoopWorkoutsModel(
    {
      "2026-11-12": {
        exercise: [
          workout("exercise_2026-11-12_01", "Swim", { source: "whoop", time: "07:00" }),
          workout("exercise_2026-11-12_02", "Note", { source: null, time: "12:00" }),
          workout("exercise_2026-11-12_03", "Manual", { source: "manual", time: "19:00" }),
        ],
      },
    },
    END,
  );
  assert.deepEqual(
    model.rows.map((row) => row.name),
    ["Note", "Swim"],
  );
});

test("newest day and later time come first, including a same-day pair", () => {
  const model = whoopWorkoutsModel(
    {
      "2026-11-10": {
        exercise: [
          workout("exercise_2026-11-10_01", "Morning spin", { time: "06:30" }),
          workout("exercise_2026-11-10_02", "Evening weights", { time: "18:45" }),
        ],
      },
      "2026-11-11": {
        exercise: [workout("exercise_2026-11-11_01", "Run", { time: "07:15", source: "Whoop" })],
      },
    },
    END,
  );
  assert.deepEqual(
    model.rows.map((row) => row.name),
    ["Run", "Evening weights", "Morning spin"],
  );
});

test("summary totals time and kcal and averages only the strains that were logged", () => {
  const model = whoopWorkoutsModel(
    {
      "2026-11-11": {
        exercise: [
          workout("exercise_2026-11-11_01", "Swim", {
            duration_min: 43,
            kcal: 663,
            strain: 14.322862,
            avg_hr: 160.4,
            source: "whoop",
          }),
        ],
      },
      "2026-11-12": {
        exercise: [
          workout("exercise_2026-11-12_01", "Walk", {
            duration_min: 50,
            kcal: 210,
            strain: null,
            avg_hr: null,
          }),
        ],
      },
    },
    END,
  );
  assert.equal(model.summary, "2 workouts · 1h 33m · 873 kcal · avg strain 14.3");
  const walk = model.rows.find((row) => row.name === "Walk");
  const swim = model.rows.find((row) => row.name === "Swim");
  assert.equal(walk?.durationLabel, "50 min");
  assert.equal(walk?.strainLabel, "—");
  assert.equal(walk?.hrLabel, "—");
  assert.equal(walk?.kcalLabel, "210 kcal");
  assert.equal(swim?.strainLabel, "14.3");
  assert.equal(swim?.hrLabel, "160 bpm");
  assert.equal(swim?.kcalLabel, "663 kcal");
});

test("a workout with no duration, strain, or heart rate is still listed", () => {
  const model = whoopWorkoutsModel(
    {
      "2026-11-12": {
        exercise: [workout("exercise_2026-11-12_01", "Activity", { duration_min: null, strain: null, avg_hr: null, kcal: 0 })],
      },
    },
    END,
  );
  assert.equal(model.rows.length, 1);
  assert.equal(model.summary, "1 workout · 0 min · 0 kcal · avg strain —");
});

test("no matching rows uses an empty model", () => {
  const model = whoopWorkoutsModel(
    {
      "2026-11-12": { exercise: [workout("exercise_2026-11-12_01", "Manual", { source: "manual" })] },
      "2026-11-01": { exercise: [workout("exercise_2026-11-01_01", "Old swim", { source: "whoop" })] },
    },
    END,
  );
  assert.deepEqual(model, { rows: [], summary: null });
});

function workout(id: string, item: string, extra: Partial<ExerciseEntry> = {}): ExerciseEntry {
  return {
    id,
    item,
    kcal: extra.kcal ?? 100,
    duration_min: extra.duration_min === undefined ? 30 : extra.duration_min,
    time: extra.time === undefined ? "09:00" : extra.time,
    strain: extra.strain === undefined ? 8 : extra.strain,
    avg_hr: extra.avg_hr === undefined ? 120 : extra.avg_hr,
    source: extra.source === undefined ? "whoop" : extra.source,
  };
}

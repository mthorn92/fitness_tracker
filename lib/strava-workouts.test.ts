import assert from "node:assert/strict";
import test from "node:test";
import { formatShortDate } from "./format";
import { parseActivities } from "./strava-summary";
import {
  activitiesToRuns,
  activityKcal,
  fixtureActivities,
  modelFromActivities,
  parseAllActivities,
  sportLabel,
  workoutWindowStart,
} from "./strava-workouts";

const END = "2026-11-13";

test("the workout window is the last 7 days and includes the end date", () => {
  assert.equal(workoutWindowStart(END), "2026-11-07");
  const model = modelFromActivities(fixtureActivities(END), END);
  assert.equal(model.status, "ready");
  if (model.status !== "ready") return;
  assert.deepEqual(
    model.rows.map((row) => row.name),
    ["Evening swim", "Lunchtime weights", "Park loop", "Easy run", "Evening walk"],
  );
  assert.equal(model.summary, "5 workouts · 3h 33m · 1,260 kcal");
  assert.deepEqual(model.chips, {
    countLabel: "5",
    countUnit: "workouts",
    duration: "3h 33m",
    kcal: "1,260",
  });
  assert.equal(model.highlight, "3-day streak · Most active: Fri");
  assert.deepEqual(
    model.days.map((day) => [day.label, day.count, day.kinds.join("+")]),
    [
      ["Sat", 0, ""],
      ["Sun", 0, ""],
      ["Mon", 1, "walk"],
      ["Tue", 0, ""],
      ["Wed", 1, "run"],
      ["Thu", 1, "other"],
      ["Fri", 2, "other"],
    ],
  );
  assert.equal(model.rows.find((row) => row.name === "Easy run")?.kind, "run");
  assert.equal(model.rows.find((row) => row.name === "Evening walk")?.kind, "walk");
  assert.equal(model.rows.find((row) => row.name === "Park loop")?.kind, "other");
  assert.equal(model.rows.find((row) => row.name === "Lunchtime weights")?.kind, "other");
});

test("a ride stays off the runs tile and on the workouts tile", () => {
  const payload = [
    {
      id: 9,
      name: "Park loop",
      type: "Ride",
      sport_type: "Ride",
      distance: 22000,
      moving_time: 3300,
      start_date_local: "2026-11-12T07:05:00",
      average_heartrate: 136,
      kilojoules: 1799.12,
      suffer_score: 58,
    },
    {
      id: 8,
      name: "Easy run",
      type: "Run",
      sport_type: "Run",
      distance: 6100,
      moving_time: 1920,
      start_date_local: "2026-11-11T06:30:00",
      average_heartrate: 151,
      calories: 310,
      suffer_score: 37,
    },
    {
      id: 4,
      name: "Weights",
      type: "WeightTraining",
      sport_type: "WeightTraining",
      moving_time: 2400,
      start_date_local: "2026-11-13T12:15:00",
    },
    { id: "nope", name: "Bad", type: "Swim", start_date_local: "not-a-date" },
  ];
  const all = parseAllActivities(payload);
  assert.deepEqual(
    all.map((activity) => activity.name),
    ["Park loop", "Easy run", "Weights"],
  );
  assert.deepEqual(activitiesToRuns(all), parseActivities(payload));
  assert.equal(parseActivities(payload).length, 1);
  assert.equal(parseActivities(payload)[0]?.name, "Easy run");

  const model = modelFromActivities(all, END);
  assert.equal(model.status, "ready");
  if (model.status !== "ready") return;
  const ride = model.rows.find((row) => row.name === "Park loop");
  const weights = model.rows.find((row) => row.name === "Weights");
  assert.equal(
    ride?.detail,
    `${formatShortDate("2026-11-12")} · Ride · 55 min · 136 bpm · 430 kcal · effort 58`,
  );
  assert.equal(weights?.detail, `${formatShortDate("2026-11-13")} · Weight training · 40 min`);
  assert.equal(sportLabel("WeightTraining", "WeightTraining"), "Weight training");
  assert.equal(sportLabel("Swim", ""), "Swim");
});

test("calories win over kilojoules, and kilojoules convert when calories are absent", () => {
  assert.equal(activityKcal({ calories: 520, kilojoules: 9000 }), 520);
  assert.equal(activityKcal({ calories: null, kilojoules: 418.4 }), 100);
  assert.equal(activityKcal({ calories: 0, kilojoules: 418.4 }), 100);
  assert.equal(activityKcal({ calories: null, kilojoules: null }), null);
  assert.equal(activityKcal({ calories: 0, kilojoules: null }), 0);
});

test("a blank week stays ready with no summary", () => {
  const model = modelFromActivities(
    [
      {
        id: 1,
        name: "Old ride",
        type: "Ride",
        sportType: "Ride",
        date: "2026-11-01",
        startLocal: "2026-11-01T08:00:00",
        movingTimeS: 600,
        distanceM: 0,
        avgHr: null,
        calories: 100,
        kilojoules: null,
        sufferScore: null,
      },
    ],
    END,
  );
  assert.equal(model.status, "ready");
  if (model.status !== "ready") return;
  assert.equal(model.stale, false);
  assert.deepEqual(model.rows, []);
  assert.equal(model.summary, null);
  assert.equal(model.chips, null);
  assert.equal(model.highlight, null);
  assert.equal(model.days.length, 7);
  assert.equal(
    model.days.every((day) => day.count === 0),
    true,
  );
});

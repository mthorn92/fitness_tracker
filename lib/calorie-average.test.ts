import assert from "node:assert/strict";
import test from "node:test";
import { calendarIsoDate, rollingCalorieAverage } from "./calorie-average";

const target = 2000;

test("rolling average uses completed days only and leaves today out", () => {
  const average = rollingCalorieAverage(
    [
      { date: "2026-11-12", kcal: 1800 },
      { date: "2026-11-13", kcal: 2200 },
      { date: "2026-11-14", kcal: 9000 },
      { date: "2026-11-15", kcal: 500 },
    ],
    "2026-11-14",
    target,
  );

  assert.equal(average?.days, 2);
  assert.equal(average?.averageKcal, 2000);
  assert.equal(average?.targetKcal, 2000);
  assert.equal(average?.deltaKcal, 0);
  assert.equal(average?.status, "even");
});

test("missing days are skipped and the window does not grow to replace them", () => {
  const average = rollingCalorieAverage(
    [
      { date: "2026-11-06", kcal: 100 },
      { date: "2026-11-08", kcal: 1800 },
      { date: "2026-11-09", kcal: null },
      { date: "2026-11-10", kcal: 2200 },
      { date: "2026-11-13", kcal: 0 },
      { date: "2026-11-14", kcal: 3000 },
    ],
    "2026-11-14",
    target,
  );

  // Window is 7–13 Nov. 6 Nov is one day too old. 9 Nov has no food.
  // 13 Nov is an explicit 0 and still counts. Today is excluded.
  assert.equal(average?.days, 3);
  assert.equal(average?.averageKcal, Math.round((1800 + 2200 + 0) / 3));
  assert.equal(average?.status, "under");
  assert.ok((average?.deltaKcal ?? 0) < 0);
});

test("the food target is unchanged by how large a day's calories are", () => {
  const under = rollingCalorieAverage([{ date: "2026-11-13", kcal: 1914 }], "2026-11-14", target);
  assert.equal(under?.averageKcal, 1914);
  assert.equal(under?.targetKcal, 2000);
  assert.equal(under?.deltaKcal, -86);
  assert.equal(under?.status, "under");

  const over = rollingCalorieAverage([{ date: "2026-11-13", kcal: 2120 }], "2026-11-14", target);
  assert.equal(over?.averageKcal, 2120);
  assert.equal(over?.deltaKcal, 120);
  assert.equal(over?.status, "over");
});

test("the displayed average is the rounded mean", () => {
  const over = rollingCalorieAverage([{ date: "2026-11-13", kcal: 2000.5 }], "2026-11-14", target);
  assert.equal(over?.averageKcal, 2001);
  assert.equal(over?.deltaKcal, 1);
  assert.equal(over?.status, "over");

  const even = rollingCalorieAverage([{ date: "2026-11-13", kcal: 2000.4 }], "2026-11-14", target);
  assert.equal(even?.averageKcal, 2000);
  assert.equal(even?.status, "even");
});

test("a day with no logged food and an empty window produce no average", () => {
  assert.equal(
    rollingCalorieAverage([{ date: "2026-11-13", kcal: null }], "2026-11-14", target),
    null,
  );
  assert.equal(rollingCalorieAverage([], "2026-11-14", target), null);
});

test("the window follows Melbourne midnight, not UTC midnight", () => {
  const days = [
    { date: "2026-11-06", kcal: 1000 },
    { date: "2026-11-07", kcal: 1100 },
    { date: "2026-11-08", kcal: 1200 },
    { date: "2026-11-09", kcal: 1300 },
    { date: "2026-11-10", kcal: 1400 },
    { date: "2026-11-11", kcal: 1500 },
    { date: "2026-11-12", kcal: 1600 },
    { date: "2026-11-13", kcal: 1700 },
  ];

  // 12:59 UTC is still 23:59 on 13 Nov in Melbourne (AEDT, UTC+11).
  const before = calendarIsoDate(new Date("2026-11-13T12:59:00.000Z"));
  assert.equal(before, "2026-11-13");
  const early = rollingCalorieAverage(days, before, target);
  assert.equal(early?.days, 7);
  assert.equal(early?.averageKcal, 1300);

  // 13:00 UTC is 00:00 on 14 Nov in Melbourne. 13 Nov joins the window and 6 Nov drops out.
  const after = calendarIsoDate(new Date("2026-11-13T13:00:00.000Z"));
  assert.equal(after, "2026-11-14");
  const late = rollingCalorieAverage(days, after, target);
  assert.equal(late?.days, 7);
  assert.equal(late?.averageKcal, 1400);
});

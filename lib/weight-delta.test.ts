import assert from "node:assert/strict";
import test from "node:test";
import { shiftIsoDate } from "./format";
import {
  formatWeightDelta,
  kgToGoal,
  latestWeighIn,
  weightWindowDelta,
  type WeighIn,
} from "./weight-delta";

function daily(start: string, days: number, kgFor: (index: number) => number): WeighIn[] {
  return Array.from({ length: days }, (_, index) => ({
    date: shiftIsoDate(start, index),
    kg: kgFor(index),
  }));
}

test("rolling averages compare now with the window 7 and 28 days ago", () => {
  const points = daily("2026-10-01", 46, (index) => (index < 39 ? 100 : 99));
  const asOf = "2026-11-15";
  const week = weightWindowDelta(points, asOf, 7);
  const month = weightWindowDelta(points, asOf, 28);

  assert.equal(week.method, "rolling");
  assert.equal(week.label, "Last 7 days");
  assert.equal(week.deltaKg, -1);
  assert.match(week.detail, /7-day average ending 15 Nov/);
  assert.match(week.detail, /ending 8 Nov/);

  assert.equal(month.method, "rolling");
  assert.equal(month.deltaKg, -1);
  assert.equal(month.label, "Last 28 days");
  assert.match(month.detail, /ending 18 Oct/);
});

test("a short history uses the closest earlier weigh-in", () => {
  const week = weightWindowDelta(
    [
      { date: "2026-11-01", kg: 100 },
      { date: "2026-11-15", kg: 102.4 },
    ],
    "2026-11-15",
    7,
  );

  assert.equal(week.method, "weigh-in");
  assert.equal(week.label, "Last 7 days");
  assert.ok(week.deltaKg != null && Math.abs(week.deltaKg - 2.4) < 1e-9);
  assert.equal(week.earlierDate, "2026-11-01");
  assert.equal(week.currentDate, "2026-11-15");
  assert.match(week.detail, /Latest weigh-in on 15 Nov versus 1 Nov/);
});

test("no weigh-in that far back falls back to the first one", () => {
  const month = weightWindowDelta(
    [
      { date: "2026-11-09", kg: 104.5 },
      { date: "2026-11-15", kg: 102 },
    ],
    "2026-11-15",
    28,
  );

  assert.equal(month.method, "since-start");
  assert.equal(month.label, "since 9 Nov");
  assert.equal(month.deltaKg, -2.5);
  assert.match(month.detail, /first weigh-in on 9 Nov/);
});

test("a single weigh-in has no delta", () => {
  const only = weightWindowDelta([{ date: "2026-11-15", kg: 102 }], "2026-11-15", 7);
  assert.equal(only.method, "none");
  assert.equal(only.deltaKg, null);
  assert.equal(only.label, "Last 7 days");
  assert.equal(formatWeightDelta(only.deltaKg).text, "—");
  assert.equal(latestWeighIn([{ date: "2026-11-15", kg: 102 }, { date: "2026-11-16", kg: 90 }], "2026-11-15")?.kg, 102);
});

test("duplicate dates keep the latest entry and ignore the future", () => {
  const week = weightWindowDelta(
    [
      { date: "2026-11-01", kg: 110 },
      { date: "2026-11-01", kg: 100 },
      { date: "2026-11-20", kg: 80 },
      { date: "2026-11-15", kg: 102 },
    ],
    "2026-11-15",
    7,
  );
  assert.equal(week.method, "weigh-in");
  assert.equal(week.deltaKg, 2);
});

test("the chip shows a sign, an arrow, and one decimal", () => {
  assert.deepEqual(formatWeightDelta(-0.44), { text: "↓ −0.4 kg", direction: "down" });
  assert.deepEqual(formatWeightDelta(0.44), { text: "↑ +0.4 kg", direction: "up" });
  assert.deepEqual(formatWeightDelta(0.04), { text: "0.0 kg", direction: "flat" });
  assert.deepEqual(formatWeightDelta(null), { text: "—", direction: "none" });
});

test("goal copy uses the latest weight", () => {
  assert.equal(kgToGoal(102, 95), "7.0 kg to 95 kg goal");
  assert.equal(kgToGoal(95, 95), "At the 95 kg goal");
  assert.equal(kgToGoal(94.5, 95), "0.5 kg under the 95 kg goal");
});

import assert from "node:assert/strict";
import test from "node:test";
import { withSevenDayAverage } from "./charts";

test("single day 7dma equals that day", () => {
  const series = withSevenDayAverage([{ date: "2026-11-09", value: 104.5 }]);
  assert.deepEqual(series, [{ date: "2026-11-09", value: 104.5, avg7d: 104.5 }]);
});

test("calendar window averages only days inside the last 7", () => {
  const series = withSevenDayAverage([
    { date: "2026-11-01", value: 10 },
    { date: "2026-11-03", value: 20 },
    { date: "2026-11-08", value: 30 },
    { date: "2026-11-09", value: 40 },
  ]);

  assert.equal(series[0].avg7d, 10);
  assert.equal(series[1].avg7d, 15);
  // Nov 8 window is Nov 2–8 → only Nov 3 + Nov 8
  assert.equal(series[2].avg7d, 25);
  // Nov 9 window is Nov 3–9 → Nov 3 + Nov 8 + Nov 9
  assert.equal(series[3].avg7d, 30);
});

test("a long weight history stays linear", () => {
  const points = Array.from({ length: 4000 }, (_, index) => {
    const date = new Date(Date.UTC(2016, 0, 1 + index));
    return { date: date.toISOString().slice(0, 10), value: 100 + (index % 7) };
  });
  const started = performance.now();
  const series = withSevenDayAverage(points);
  const elapsed = performance.now() - started;
  assert.equal(series.length, 4000);
  assert.ok(elapsed < 250, `7-day average took ${elapsed.toFixed(0)}ms`);
  const last = series[series.length - 1];
  assert.equal(last.avg7d, (100 + 101 + 102 + 103 + 104 + 105 + 106) / 7);
});

test("sorts unsorted input before averaging", () => {
  const series = withSevenDayAverage([
    { date: "2026-11-10", value: 3 },
    { date: "2026-11-09", value: 1 },
  ]);
  assert.equal(series[0].date, "2026-11-09");
  assert.equal(series[0].avg7d, 1);
  assert.equal(series[1].avg7d, 2);
});

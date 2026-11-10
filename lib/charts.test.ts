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

test("sorts unsorted input before averaging", () => {
  const series = withSevenDayAverage([
    { date: "2026-11-10", value: 3 },
    { date: "2026-11-09", value: 1 },
  ]);
  assert.equal(series[0].date, "2026-11-09");
  assert.equal(series[0].avg7d, 1);
  assert.equal(series[1].avg7d, 2);
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildDeficitSeries, dailyDeficitKcal } from "./deficit";
import {
  buildMonthGrid,
  canGoToNextMonth,
  dayOfMonth,
  formatMonthTitle,
  greenStreak,
  monthCounts,
  monthTallyText,
  parseYearMonth,
  ringAriaLabel,
  ringForDay,
  ringSummary,
  shiftMonth,
  type RingDayInput,
} from "./rings";

const today = "2026-11-10";

function day(partial: Partial<RingDayInput> & Pick<RingDayInput, "date">): RingDayInput {
  return {
    foodKcal: null,
    whoopKcal: null,
    cycleClosed: null,
    ...partial,
  };
}

test("fill is eaten divided by burn, capped at a full ring", () => {
  const under = ringForDay(day({ date: "2026-11-08", foodKcal: 2000, whoopKcal: 2200, cycleClosed: true }), today);
  assert.equal(under.judgement, "under");
  assert.ok(Math.abs(under.fill - 2000 / 2200) < 1e-12);
  assert.equal(under.overflow, false);
  assert.equal(under.deltaKcal, dailyDeficitKcal(2200, 2000));
  assert.equal(under.deltaKcal, 200);

  const even = ringForDay(day({ date: "2026-11-08", foodKcal: 2200, whoopKcal: 2200, cycleClosed: true }), today);
  assert.equal(even.judgement, "under");
  assert.equal(even.fill, 1);
  assert.equal(even.overflow, false);
  assert.equal(even.deltaKcal, 0);

  const over = ringForDay(day({ date: "2026-11-08", foodKcal: 2500, whoopKcal: 2000, cycleClosed: true }), today);
  assert.equal(over.judgement, "over");
  assert.equal(over.fill, 1);
  assert.equal(over.overflow, true);
  assert.equal(over.deltaKcal, dailyDeficitKcal(2000, 2500));
  assert.equal(over.deltaKcal, -500);
});

test("missing food or burn stays empty and uncoloured", () => {
  for (const input of [
    day({ date: "2026-11-08", foodKcal: 1800, whoopKcal: null, cycleClosed: true }),
    day({ date: "2026-11-08", foodKcal: null, whoopKcal: 2200, cycleClosed: true }),
    day({ date: "2026-11-08", foodKcal: null, whoopKcal: null }),
    day({ date: "2026-11-08", foodKcal: 1800, whoopKcal: 0, cycleClosed: true }),
  ]) {
    const ring = ringForDay(input, today);
    assert.equal(ring.judgement, "empty");
    assert.equal(ring.fill, 0);
    assert.equal(ring.overflow, false);
    assert.equal(ring.deltaKcal, null);
  }
});

test("today with an open cycle is in progress and not scored green or red", () => {
  const underSoFar = ringForDay(
    day({ date: today, foodKcal: 1509, whoopKcal: 1813, cycleClosed: false }),
    today,
  );
  assert.equal(underSoFar.judgement, "progress");
  assert.ok(Math.abs(underSoFar.fill - 1509 / 1813) < 1e-12);
  assert.equal(underSoFar.overflow, false);
  assert.equal(underSoFar.deltaKcal, dailyDeficitKcal(1813, 1509));

  const overSoFar = ringForDay(
    day({ date: today, foodKcal: 2500, whoopKcal: 2000, cycleClosed: false }),
    today,
  );
  assert.equal(overSoFar.judgement, "progress");
  assert.equal(overSoFar.fill, 1);
  assert.equal(overSoFar.overflow, false);

  const quiet = ringForDay(day({ date: today, cycleClosed: false }), today);
  assert.equal(quiet.judgement, "progress");
  assert.equal(quiet.fill, 0);
});

test("a closed or completed today is scored, and a past open cycle is scored too", () => {
  const closed = ringForDay(
    day({ date: today, foodKcal: 1500, whoopKcal: 2000, cycleClosed: true }),
    today,
  );
  assert.equal(closed.judgement, "under");

  const completedOpen = ringForDay(
    day({ date: today, foodKcal: 1500, whoopKcal: 2000, cycleClosed: false, complete: true }),
    today,
  );
  assert.equal(completedOpen.judgement, "under");

  const unknown = ringForDay(
    day({ date: today, foodKcal: 1500, whoopKcal: 2000, cycleClosed: null }),
    today,
  );
  assert.equal(unknown.judgement, "progress");

  const pastOpen = ringForDay(
    day({ date: "2026-11-09", foodKcal: 499, whoopKcal: 1372, cycleClosed: false }),
    today,
  );
  assert.equal(pastOpen.judgement, "under");
  assert.ok(Math.abs(pastOpen.fill - 499 / 1372) < 1e-12);
  assert.equal(pastOpen.deltaKcal, 1372 - 499);
});

test("future days stay faint even if numbers exist", () => {
  const ring = ringForDay(
    day({ date: "2026-11-12", foodKcal: 1000, whoopKcal: 2000, cycleClosed: true }),
    today,
  );
  assert.equal(ring.judgement, "future");
  assert.equal(ring.fill, 0);
  assert.equal(ring.deltaKcal, null);
  assert.equal(ring.overflow, false);
});

test("tooltip copy shows eaten, burned, and under or over", () => {
  const under = ringForDay(day({ date: "2026-11-09", foodKcal: 499, whoopKcal: 1372, cycleClosed: true }), today);
  const underSummary = ringSummary(under);
  assert.equal(underSummary.eaten, "499 kcal");
  assert.equal(underSummary.burned, "1,372 kcal");
  assert.equal(underSummary.difference, "873 kcal under");
  assert.equal(underSummary.pending, false);
  assert.match(ringAriaLabel(under), /Eaten 499 kcal/);
  assert.match(ringAriaLabel(under), /873 kcal under/);

  const over = ringForDay(day({ date: "2026-11-08", foodKcal: 2500, whoopKcal: 2000, cycleClosed: true }), today);
  assert.equal(ringSummary(over).difference, "500 kcal over");

  const pending = ringForDay(day({ date: today, foodKcal: 1509, whoopKcal: 1813, cycleClosed: false }), today);
  assert.equal(ringSummary(pending).difference, "304 kcal under");
  assert.equal(ringSummary(pending).pending, true);
  assert.match(ringAriaLabel(pending), /so far/);

  const empty = ringForDay(day({ date: "2026-11-06", whoopKcal: 2453, cycleClosed: true }), today);
  assert.equal(ringSummary(empty).difference, "No food logged yet");
});

test("November 2026 grid is Monday-first", () => {
  assert.equal(new Date(Date.UTC(2026, 10, 1)).getUTCDay(), 0);
  const cells = buildMonthGrid(2026, 11, [
    day({ date: "2026-11-09", foodKcal: 499, whoopKcal: 1372, cycleClosed: false }),
    day({ date: "2026-11-10", foodKcal: 1509, whoopKcal: 1813, cycleClosed: false }),
  ], today);

  assert.equal(cells.length % 7, 0);
  assert.equal(cells.length, 42);
  for (let i = 0; i < 6; i++) assert.equal(cells[i].date, null);
  assert.equal(cells[6].date, "2026-11-01");
  assert.equal(dayOfMonth(cells[6].date as string), 1);

  const nov9 = cells.find((cell) => cell.date === "2026-11-09");
  const nov10 = cells.find((cell) => cell.date === "2026-11-10");
  const nov11 = cells.find((cell) => cell.date === "2026-11-11");
  assert.equal(nov9?.ring?.judgement, "under");
  assert.equal(nov10?.ring?.judgement, "progress");
  assert.equal(nov11?.ring?.judgement, "future");
  assert.equal(cells[6 + 9].date, "2026-11-10");
  assert.equal((6 + 9) % 7, 1);
});

test("month tally counts only scored days and banks the green streak", () => {
  const days = [
    day({ date: "2026-11-07", foodKcal: 1800, whoopKcal: 2100, cycleClosed: true }),
    day({ date: "2026-11-08", foodKcal: 2400, whoopKcal: 2000, cycleClosed: true }),
    day({ date: "2026-11-09", foodKcal: 499, whoopKcal: 1372, cycleClosed: true }),
    day({ date: "2026-11-10", foodKcal: 1509, whoopKcal: 1813, cycleClosed: false }),
    day({ date: "2026-11-06", whoopKcal: 2453, cycleClosed: true }),
  ];

  assert.deepEqual(monthCounts(days, today, 2026, 11), { green: 2, red: 1 });
  assert.equal(greenStreak(days, today), 1);
  assert.equal(monthTallyText(2, 1, 1), "2 green days · 1 red · 1-day streak");
  assert.equal(monthTallyText(1, 0, null), "1 green day · 0 red");
  assert.equal(monthTallyText(0, 0, null), "No green or red days yet");
});

test("streak skips an unfinished today and stops on a gap or a red day", () => {
  assert.equal(
    greenStreak(
      [
        day({ date: "2026-11-08", foodKcal: 1000, whoopKcal: 2000, cycleClosed: true }),
        day({ date: "2026-11-09", foodKcal: 1000, whoopKcal: 2000, cycleClosed: true }),
        day({ date: "2026-11-10", foodKcal: 2500, whoopKcal: 2000, cycleClosed: false }),
      ],
      today,
    ),
    2,
  );

  assert.equal(
    greenStreak(
      [
        day({ date: "2026-11-08", foodKcal: 1000, whoopKcal: 2000, cycleClosed: true }),
        day({ date: "2026-11-09", foodKcal: 2500, whoopKcal: 2000, cycleClosed: true }),
        day({ date: "2026-11-10", cycleClosed: false }),
      ],
      today,
    ),
    0,
  );

  assert.equal(
    greenStreak(
      [
        day({ date: "2026-11-07", foodKcal: 1000, whoopKcal: 2000, cycleClosed: true }),
        day({ date: "2026-11-09", foodKcal: 1000, whoopKcal: 2000, cycleClosed: true }),
      ],
      today,
    ),
    1,
  );

  assert.equal(
    greenStreak(
      [
        day({ date: "2026-11-09", foodKcal: 1000, whoopKcal: 2000, cycleClosed: true }),
        day({ date: "2026-11-10", foodKcal: 1000, whoopKcal: 2000, cycleClosed: true }),
      ],
      today,
    ),
    2,
  );
});

test("rings and cumulative deficit count the same days", () => {
  const calendarToday = "2026-11-11";
  const past = {
    date: "2026-11-10",
    foodKcal: 1800,
    whoopKcal: 2200,
    weightKg: 104,
    cycleClosed: false as boolean | null,
    complete: false,
  };
  const current = {
    date: calendarToday,
    foodKcal: 1500,
    whoopKcal: 1900,
    weightKg: 103.8,
    cycleClosed: false as boolean | null,
    complete: false,
  };
  const summary = buildDeficitSeries([past, current], { today: calendarToday });
  assert.deepEqual(
    summary.points.map((point) => point.date),
    ["2026-11-10"],
  );
  assert.equal(summary.cumulativeDeficitKcal, dailyDeficitKcal(2200, 1800));

  const pastRing = ringForDay(past, calendarToday);
  assert.equal(pastRing.judgement, "under");
  assert.equal(pastRing.deltaKcal, summary.points[0].dailyDeficitKcal);

  const todayRing = ringForDay(current, calendarToday);
  assert.equal(todayRing.judgement, "progress");
  assert.equal(
    summary.points.some((point) => point.date === calendarToday),
    false,
  );

  const completed = { ...current, complete: true };
  const completedSummary = buildDeficitSeries([past, completed], { today: calendarToday });
  assert.deepEqual(
    completedSummary.points.map((point) => point.date),
    ["2026-11-10", calendarToday],
  );
  const completedRing = ringForDay(completed, calendarToday);
  assert.equal(completedRing.judgement, "under");
  assert.equal(completedRing.deltaKcal, completedSummary.points[1].dailyDeficitKcal);
});

test("month navigation stays on or before the current month", () => {
  assert.deepEqual(parseYearMonth("2026-11-10"), { year: 2026, month: 11 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2026, month: 12 });
  assert.equal(canGoToNextMonth(2026, 11, today), false);
  assert.equal(canGoToNextMonth(2026, 10, today), true);
  assert.equal(canGoToNextMonth(2027, 1, today), false);
  assert.equal(formatMonthTitle(2026, 11), "November 2026");
});

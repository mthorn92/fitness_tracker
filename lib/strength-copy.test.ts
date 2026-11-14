import assert from "node:assert/strict";
import test from "node:test";
import { strengthSchedule } from "./exercise-board";
import { formatStrengthDayCopy, formatStrengthWeekCopy, type StrengthCopyDay } from "./strength-copy";

const WEEK = "Starts Mon 16 Nov · Week 1 of 8";

test("day A copy text groups supersets and stays plain", () => {
  const text = formatStrengthDayCopy(copyDay("2026-11-12", 0, WEEK));
  assert.equal(
    text,
    [
      "Day A - Push (Starts Mon 16 Nov · Week 1 of 8)",
      "Superset A:",
      "- Bench press: 3 x 7 @ 50 kg",
      "- Banded pull-up: 3 x 6 (2 red bands)",
      "Strict pull-up: 2 attempts",
      "Overhead press: 3 x 7 @ 25 kg",
      "Superset C:",
      "- Rope pushdown: 3 x 10",
      "- Dumbbell lateral raise: 3 x 10 @ 8 kg/hand",
    ].join("\n"),
  );
  assert.equal(text.includes("×"), false);
  assert.equal(text.includes("·"), true);
  assert.equal(/[*#`]|[\u{1F300}-\u{1FAFF}]/u.test(text), false);
});

test("holds, per-leg work, and a later superset stay one exercise per line", () => {
  const schedule = strengthSchedule("2026-11-12");
  const pull = formatStrengthDayCopy(copyDay("2026-11-12", 2, WEEK));
  const hinge = formatStrengthDayCopy(copyDay("2026-11-12", 3, WEEK));
  const legs = formatStrengthDayCopy(copyDay("2026-11-12", 1, WEEK));
  assert.match(pull, /Pull-up negative: 3 x 5s\nPull-up top hold: 1 x 10s/);
  assert.match(pull, /^- Banded pull-up: 4 x 8 \(2 red bands\)/m);
  assert.match(hinge, /Dead hang: 2 x 20s/);
  assert.match(hinge, /Superset B:\n- Goblet squat: 2 x 10\n- Scap pull-up: 2 x 8/);
  assert.match(legs, /Bulgarian split squat: 3 x 10\/leg/);
  assert.equal(schedule.days.length, 4);
});

test("a deload day keeps the note and the halved sets", () => {
  const text = formatStrengthDayCopy(copyDay("2026-12-09", 1, "Today · Week 4 of 8"));
  assert.match(text, /^Day B - Legs \(Today · Week 4 of 8\)/);
  assert.match(text, /Box squat to bench: 2 x 9 @ 40 kg/);
  assert.match(text, /\n\nStop with 4\+ reps in reserve$/);
});

test("copy week uses each day's week label and a blank line between days", () => {
  const days = [0, 1, 2, 3].map((index) => copyDay("2026-11-12", index, WEEK));
  const text = formatStrengthWeekCopy(days);
  assert.equal(text.split("\n\n").length, 4);
  assert.match(text, /Day A - Push \(Starts Mon 16 Nov · Week 1 of 8\)/);
  assert.match(text, /Day B - Legs \(Starts Mon 16 Nov · Week 1 of 8\)/);
  assert.match(text, /Day C - Pull \(Starts Mon 16 Nov · Week 1 of 8\)/);
  assert.match(text, /Day D - Hinge \(Starts Mon 16 Nov · Week 1 of 8\)/);
});

function copyDay(date: string, index: number, weekLabel: string): StrengthCopyDay {
  const day = strengthSchedule(date).days[index];
  if (!day) throw new Error(`Missing strength day ${index}`);
  return {
    name: day.prescribed.label ?? "Strength",
    weekLabel,
    items: day.prescribed.items,
    deloadNote: day.prescribed.deload_note,
  };
}

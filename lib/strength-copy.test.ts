import assert from "node:assert/strict";
import test from "node:test";
import planFile from "@/data/plans/2026-11-16-8wk.json";
import { strengthSchedule } from "./exercise-board";
import { formatStrengthDayCopy, formatStrengthWeekCopy, type StrengthCopyDay } from "./strength-copy";
import type { TrainingPlan } from "./types";

const oldPlan = planFile as TrainingPlan;

const WEEK = "Starts Mon 16 Nov · Week 1 of 8";

test("day A copy text is plain lines for WHOOP", () => {
  const text = formatStrengthDayCopy(copyDay("2026-11-12", 0, WEEK));
  assert.equal(
    text,
    [
      "Day A · Push",
      "Bench press: 3 × 7 @ 50 kg",
      "Banded pull-up: 3 × 6 (2 red bands)",
      "Strict pull-up: 2 attempts",
      "Overhead press: 3 × 7 @ 25 kg",
      "Rope pushdown: 3 × 10",
      "Dumbbell lateral raise: 3 × 10 @ 8 kg/hand",
    ].join("\n"),
  );
  assert.equal(text.includes("×"), true);
  assert.equal(/Superset|^- /m.test(text), false);
});

test("holds, per-leg work, and bands format one exercise per line", () => {
  const schedule = strengthSchedule("2026-11-12", oldPlan);
  const pull = formatStrengthDayCopy(copyDay("2026-11-12", 2, WEEK));
  const hinge = formatStrengthDayCopy(copyDay("2026-11-12", 3, WEEK));
  const legs = formatStrengthDayCopy(copyDay("2026-11-12", 1, WEEK));
  assert.match(pull, /Pull-up negative: 3 × 5s\nPull-up top hold: 1 × 10s/);
  assert.match(pull, /^Banded pull-up: 4 × 8 \(2 red bands\)/m);
  assert.match(hinge, /Dead hang: 2 × 20s/);
  assert.match(hinge, /^Goblet squat: 2 × 10\nScap pull-up: 2 × 8/m);
  assert.match(legs, /Bulgarian split squat: 3 × 10\/leg/);
  assert.equal(schedule.days.length, 4);
});

test("a deload day keeps the note and the halved sets", () => {
  const text = formatStrengthDayCopy(copyDay("2026-12-09", 1, "Today · Week 4 of 8"));
  assert.match(text, /^Day B · Legs$/m);
  assert.match(text, /Box squat to bench: 2 × 9 @ 40 kg/);
  assert.match(text, /\n\nStop with 4\+ reps in reserve$/);
});

test("copy week uses each day's block separated by a blank line", () => {
  const days = [0, 1, 2, 3].map((index) => copyDay("2026-11-12", index, WEEK));
  const text = formatStrengthWeekCopy(days);
  assert.equal(text.split("\n\n").length, 4);
  assert.match(text, /^Day A · Push/m);
  assert.match(text, /^Day B · Legs/m);
});

function copyDay(date: string, index: number, weekLabel: string): StrengthCopyDay {
  const day = strengthSchedule(date, oldPlan).days[index];
  if (!day) throw new Error(`Missing strength day ${index}`);
  return {
    name: day.prescribed.label ?? "Strength",
    weekLabel,
    items: day.prescribed.items,
    deloadNote: day.prescribed.deload_note,
  };
}
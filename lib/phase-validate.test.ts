import assert from "node:assert/strict";
import test from "node:test";
import { parsePhaseWrite, parsePhaseWrites } from "./phase-validate";

test("parsePhaseWrite accepts nullable fields", () => {
  const phase = parsePhaseWrite({
    id: "phase1_cut",
    name: "Cut phase",
    kind: "cut",
    start: "2026-11-09",
    end: "2026-12-22",
    goal_weight_kg: 95,
    kcal_target: 2000,
    note: "Main cut",
  });
  assert.notEqual(phase, "invalid");
  if (phase === "invalid") return;
  assert.deepEqual(phase, {
    id: "phase1_cut",
    name: "Cut phase",
    kind: "cut",
    start: "2026-11-09",
    end: "2026-12-22",
    goal_weight_kg: 95,
    kcal_target: 2000,
    note: "Main cut",
  });
});

test("parsePhaseWrite rejects missing id, name, or start", () => {
  assert.equal(parsePhaseWrite({ name: "Cut", start: "2026-11-09" }), "invalid");
  assert.equal(parsePhaseWrite({ id: "x", start: "2026-11-09" }), "invalid");
  assert.equal(parsePhaseWrite({ id: "x", name: "Cut" }), "invalid");
});

test("parsePhaseWrite rejects end before start and bad numbers", () => {
  assert.equal(
    parsePhaseWrite({ id: "x", name: "Cut", start: "2026-11-09", end: "2026-11-08" }),
    "invalid",
  );
  assert.equal(
    parsePhaseWrite({ id: "x", name: "Cut", start: "2026-11-09", goal_weight_kg: -1 }),
    "invalid",
  );
});

test("parsePhaseWrites accepts one object or an array", () => {
  const single = parsePhaseWrites({
    id: "phase1_cut",
    name: "Cut phase",
    start: "2026-11-09",
  });
  assert.equal(single === "invalid" ? 0 : single.length, 1);
  const many = parsePhaseWrites([
    { id: "a", name: "A", start: "2026-11-09" },
    { id: "b", name: "B", start: "2026-12-23" },
  ]);
  assert.equal(many === "invalid" ? 0 : many.length, 2);
});
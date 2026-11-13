import assert from "node:assert/strict";
import test from "node:test";
import { formatAverageLabel, targetAxis } from "./chart-scale";

function onGrid(axis: { step: number; max: number }, target: number) {
  assert.ok(Math.abs(target / axis.step - Math.round(target / axis.step)) < 1e-6);
  assert.ok(Math.abs(axis.max / axis.step - Math.round(axis.max / axis.step)) < 1e-6);
  assert.ok(axis.max >= target + axis.step - 1e-6);
}

test("daily targets sit one step under the top", () => {
  const kcal = targetAxis(2000, 1960);
  assert.equal(kcal.step, 500);
  assert.equal(kcal.max, 2500);
  onGrid(kcal, 2000);

  const protein = targetAxis(170, 168);
  assert.equal(protein.step, 34);
  assert.equal(protein.max, 204);
  onGrid(protein, 170);

  const water = targetAxis(3, 2.9);
  assert.equal(water.step, 1);
  assert.equal(water.max, 4);
  onGrid(water, 3);
});

test("weekly targets use the same headroom rule", () => {
  const kcal = targetAxis(14000, 8000);
  assert.equal(kcal.step, 3500);
  assert.equal(kcal.max, 17500);
  onGrid(kcal, 14000);

  const protein = targetAxis(1190, 900);
  assert.equal(protein.step, 238);
  assert.equal(protein.max, 1428);
  onGrid(protein, 1190);

  const water = targetAxis(21, 12);
  assert.equal(water.step, 7);
  assert.equal(water.max, 28);
  onGrid(water, 21);
});

test("the top moves up in whole steps when the data exceeds the target", () => {
  const kcal = targetAxis(2000, 3200);
  assert.equal(kcal.step, 500);
  assert.equal(kcal.max, 3500);
  onGrid(kcal, 2000);

  const water = targetAxis(3, 5.2);
  assert.equal(water.step, 1);
  assert.equal(water.max, 6);
  onGrid(water, 3);
});

test("average labels stay short and per day", () => {
  assert.equal(formatAverageLabel("protein", 150.4), "avg 150");
  assert.equal(formatAverageLabel("kcal", 1960.2), "avg 1,960");
  assert.equal(formatAverageLabel("water", 2.26), "avg 2.3");
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createQuestions,
  dailySeed,
  MAX_RATIO,
  MIN_RATIO,
  scoreGuess,
  validateItems,
} from "../src/questions.js";

const dataUrl = new URL("../data/items.json", import.meta.url);
const { items } = JSON.parse(await readFile(dataUrl, "utf8"));

test("expanded data has 60 sourced entries across multiple categories", () => {
  assert.equal(validateItems(items), items);
  assert.ok(items.length >= 60);
  assert.ok(new Set(items.map((item) => item.category)).size >= 5);
  for (const item of items) {
    for (const property of Object.keys(item.props)) {
      assert.match(item.sources[property], /^https:\/\//);
    }
  }
  assert.equal(createQuestions(items).length, 5);
});

test("questions use valid ratios and comparable dimensions", () => {
  const questions = createQuestions(items, { count: 20, seed: "bounds" });
  for (const { itemA, itemB, property, answer, text } of questions) {
    assert.ok(answer >= MIN_RATIO && answer <= MAX_RATIO);
    if (property === "length_m") {
      assert.equal(itemA.length_kind, itemB.length_kind);
      if (itemA.length_kind === "diameter") assert.match(text, /diameter/);
      if (itemA.length_kind === "height") assert.match(text, /height/);
      if (itemA.length_kind === "width") assert.match(text, /width/);
      if (itemA.length_kind === "length") assert.match(text, /length|end to end/);
    }
  }
});

test("seeded questions are reproducible and pairs do not repeat", () => {
  const first = createQuestions(items, { count: 5, seed: dailySeed("2026-10-22", "space-starter-v1") });
  const second = createQuestions(items, { count: 5, seed: dailySeed("2026-10-22", "space-starter-v1") });
  assert.deepEqual(first.map((question) => question.id), second.map((question) => question.id));
  assert.equal(new Set(first.map((question) => question.pairId)).size, 5);
});

test("daily seed changes with UTC date and data version", () => {
  assert.notEqual(dailySeed("2026-10-22", "v1"), dailySeed("2026-10-23", "v1"));
  assert.notEqual(dailySeed("2026-10-22", "v1"), dailySeed("2026-10-22", "v2"));
  assert.throws(() => dailySeed("not-a-date"), /valid UTC date/);
  assert.throws(() => dailySeed("2026-02-30"), /valid UTC date/);
});

test("score is exact for a correct answer and decreases logarithmically", () => {
  assert.equal(scoreGuess(81, 81), 100);
  assert.equal(scoreGuess(810, 81), 50);
  assert.equal(scoreGuess(1, 10_000_000), 0);
  assert.throws(() => scoreGuess(0, 10), /Guess must be/);
});

test("malformed input and insufficient eligible pairs fail clearly", () => {
  assert.throws(() => validateItems([{ id: "x", name: "x", plural: "xs", category: "x", props: { mass_kg: 0 } }]), /at least two items/);
  assert.throws(() => validateItems([items[0], items[0]]), /unique/);
  const missingSource = structuredClone(items.slice(0, 2));
  delete missingSource[0].sources.mass_kg;
  assert.throws(() => validateItems(missingSource), /valid source/);
  const insecureSource = structuredClone(items.slice(0, 2));
  insecureSource[0].sources.mass_kg = "http://example.com/source";
  assert.throws(() => validateItems(insecureSource), /HTTPS/);
  const sameValueItems = [
    { ...items[0], id: "a", props: { mass_kg: 1 } },
    { ...items[1], id: "b", props: { mass_kg: 1 } },
  ];
  assert.throws(() => createQuestions(sameValueItems), /Not enough eligible/);
});

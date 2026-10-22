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
} from "./questions.js";

const dataUrl = new URL("../data/items.json", import.meta.url);
const { items } = JSON.parse(await readFile(dataUrl, "utf8"));

test("starter data has enough valid, sourced entries for a game", () => {
  assert.equal(validateItems(items), items);
  assert.ok(items.length >= 10);
  for (const item of items) {
    for (const property of Object.keys(item.props)) {
      assert.match(item.sources[property], /^https:\/\/nssdc\.gsfc\.nasa\.gov\//);
    }
  }
  assert.equal(createQuestions(items).length, 5);
});

test("questions use valid ratios and comparable dimensions", () => {
  for (const { itemA, itemB, property, answer } of createQuestions(items, { count: 20, seed: "bounds" })) {
    assert.ok(answer >= MIN_RATIO && answer <= MAX_RATIO);
    if (property === "length_m") {
      assert.equal(itemA.length_kind, itemB.length_kind);
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
  const sameValueItems = [
    { ...items[0], id: "a", props: { mass_kg: 1 } },
    { ...items[1], id: "b", props: { mass_kg: 1 } },
  ];
  assert.throws(() => createQuestions(sameValueItems), /Not enough eligible/);
});

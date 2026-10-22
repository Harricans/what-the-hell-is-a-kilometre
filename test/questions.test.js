import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createQuestions,
  dailySeed,
  MAX_RATIO,
  MIN_RATIO,
  scoreGuess,
  validateCatalog,
  validateItems,
} from "../src/questions.js";
import {
  CATALOG_STORAGE_KEY,
  loadCatalog,
  parseCatalog,
  saveCatalog,
} from "../src/catalog-store.js";

const dataUrl = new URL("../data/items.json", import.meta.url);
const catalog = JSON.parse(await readFile(dataUrl, "utf8"));
const { items, properties } = catalog;

test("expanded data has 60 sourced entries across multiple categories", () => {
  assert.equal(validateCatalog(catalog), catalog);
  assert.equal(validateItems(items, properties), items);
  assert.ok(items.length >= 60);
  assert.ok(new Set(items.map((item) => item.category)).size >= 5);
  for (const item of items) {
    for (const property of Object.keys(item.props)) {
      assert.match(item.sources[property], /^https:\/\//);
    }
  }
  assert.equal(createQuestions(items, { properties }).length, 5);
});

test("questions use valid ratios and comparable dimensions", () => {
  const questions = createQuestions(items, { count: 20, seed: "bounds", properties });
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
  const first = createQuestions(items, {
    count: 5,
    seed: dailySeed("2026-10-22", "catalog-v1"),
    properties,
  });
  const second = createQuestions(items, {
    count: 5,
    seed: dailySeed("2026-10-22", "catalog-v1"),
    properties,
  });
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
  assert.throws(
    () => validateItems([{ id: "x", name: "x", plural: "xs", emoji: "x", category: "x", note: "", props: { mass_kg: 0 } }], properties),
    /at least two items/,
  );
  assert.throws(() => validateItems([items[0], items[0]], properties), /unique/);
  const missingSource = structuredClone(items.slice(0, 2));
  delete missingSource[0].sources.mass_kg;
  assert.throws(() => validateItems(missingSource, properties), /valid source/);
  const insecureSource = structuredClone(items.slice(0, 2));
  insecureSource[0].sources.mass_kg = "http://example.com/source";
  assert.throws(() => validateItems(insecureSource, properties), /HTTPS/);
  const sameValueItems = [
    { ...items[0], id: "a", props: { mass_kg: 1 } },
    { ...items[1], id: "b", props: { mass_kg: 1 } },
  ];
  assert.throws(() => createQuestions(sameValueItems, { properties }), /Not enough eligible/);
});

test("new registered properties work when only some items have the measurement", () => {
  const newProperty = {
    id: "battery_capacity_wh",
    label: "Battery capacity",
    unit: "Wh",
    questionTemplate: "How many {aPlural} have the capacity of one {bName}?",
  };
  const customProperties = [...properties, newProperty];
  const customItems = [
    {
      id: "small-cell",
      name: "small cell",
      plural: "small cells",
      emoji: "🔋",
      category: "battery",
      note: "Example measurement.",
      props: { battery_capacity_wh: 2 },
      sources: { battery_capacity_wh: "https://example.org/small-cell" },
    },
    {
      id: "large-cell",
      name: "large cell",
      plural: "large cells",
      emoji: "🔋",
      category: "battery",
      note: "Example measurement.",
      props: { battery_capacity_wh: 11 },
      sources: { battery_capacity_wh: "https://example.org/large-cell" },
    },
    { ...items[0], props: {}, sources: {} },
  ];
  const question = createQuestions(customItems, {
    count: 1,
    seed: "custom",
    properties: customProperties,
  })[0];
  assert.equal(question.property, newProperty.id);
  assert.equal(question.text, "How many small cells have the capacity of one large cell?");
  assert.equal(question.answer, 5.5);
});

test("catalog JSON can be validated for import/export and rejects unknown columns", () => {
  assert.deepEqual(parseCatalog(JSON.stringify(catalog)), catalog);
  const invalid = structuredClone(catalog);
  invalid.items[0].props.unregistered_measure = 3;
  invalid.items[0].sources.unregistered_measure = "https://example.org";
  assert.throws(() => validateCatalog(invalid), /invalid unregistered_measure/);
});

test("saved catalogs can be reloaded from browser storage", async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  saveCatalog(catalog, storage);
  assert.equal(values.has(CATALOG_STORAGE_KEY), true);
  assert.deepEqual(
    await loadCatalog({
      storage,
      fetcher: async () => {
        throw new Error("Expected the saved catalog to be used.");
      },
    }),
    catalog,
  );
});

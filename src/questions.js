export const GAME_VERSION = "1";
export const ROUND_COUNT = 5;
export const MIN_RATIO = 3;
export const MAX_RATIO = 10_000_000;
export const MIN_GUESS = 1;
export const MAX_GUESS = 10_000_000;

const ROUND_NUMBER_TOLERANCE = 0.02;
const LENGTH_KINDS = ["length", "height", "diameter", "width"];
const TEMPLATE_TOKENS = new Set([
  "aName",
  "aPlural",
  "bName",
  "bPlural",
  "aUnit",
  "bUnit",
  "unit",
  "aKind",
  "bKind",
]);

function hashSeed(seed) {
  let hash = 2166136261;
  for (const character of String(seed)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function isNearlyRoundNumber(value) {
  const nearestPowerOfTen = 10 ** Math.round(Math.log10(value));
  return Math.abs(value - nearestPowerOfTen) / nearestPowerOfTen <= ROUND_NUMBER_TOLERANCE;
}

function dimensionMatches(itemA, itemB, definition) {
  return !definition.matchField || itemA[definition.matchField] === itemB[definition.matchField];
}

function questionText(itemA, itemB, definition) {
  const template =
    definition.questionTemplates?.[itemA[definition.matchField]] ??
    definition.questionTemplate;
  if (!template) return `How many ${itemA.plural} equal one ${itemB.name} by ${definition.label.toLowerCase()}?`;
  const values = {
    aName: itemA.name,
    aPlural: itemA.plural,
    bName: itemB.name,
    bPlural: itemB.plural,
    aUnit: definition.unit,
    bUnit: definition.unit,
    unit: definition.unit,
    aKind: itemA[definition.matchField] ?? "",
    bKind: itemB[definition.matchField] ?? "",
  };
  return template.replace(/\{([a-zA-Z]+)\}/g, (token, key) => values[key] ?? token);
}

function validateProperties(properties) {
  if (!Array.isArray(properties) || properties.length === 0) {
    throw new TypeError("Provide at least one property definition.");
  }
  const ids = new Set();
  for (const definition of properties) {
    if (
      !definition ||
      typeof definition.id !== "string" ||
      !/^[a-z][a-z0-9_]*$/.test(definition.id) ||
      ids.has(definition.id)
    ) {
      throw new TypeError("Every property must have a unique id using lowercase letters, digits, and underscores.");
    }
    ids.add(definition.id);
    if (!definition.label || !definition.unit) {
      throw new TypeError(`Property "${definition.id}" needs a label and unit.`);
    }
    const templates = definition.questionTemplates
      ? Object.values(definition.questionTemplates)
      : [definition.questionTemplate];
    if (!templates.length || templates.some((template) => typeof template !== "string" || !template.trim())) {
      throw new TypeError(`Property "${definition.id}" needs a question template.`);
    }
    for (const template of templates) {
      for (const [, token] of template.matchAll(/\{([^}]+)\}/g)) {
        if (!TEMPLATE_TOKENS.has(token)) {
          throw new TypeError(`Property "${definition.id}" uses unsupported template token "{${token}}".`);
        }
      }
    }
    if (definition.matchField && !["length_kind"].includes(definition.matchField)) {
      throw new TypeError(`Property "${definition.id}" has an unsupported matchField.`);
    }
    if (
      definition.matchValues &&
      (!definition.matchField ||
        !Array.isArray(definition.matchValues) ||
        definition.matchValues.length === 0 ||
        definition.matchValues.some((value) => typeof value !== "string"))
    ) {
      throw new TypeError(`Property "${definition.id}" has invalid matchValues.`);
    }
  }
  return properties;
}

export function validateItems(items, properties) {
  validateProperties(properties);
  if (!Array.isArray(items) || items.length < 2) {
    throw new TypeError("Provide at least two items.");
  }
  const propertyIds = new Set(properties.map(({ id }) => id));
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id)) {
      throw new TypeError("Every item must have a unique, non-empty id.");
    }
    ids.add(item.id);
    if (
      !item.name ||
      !item.plural ||
      !item.emoji ||
      !item.category ||
      typeof item.note !== "string" ||
      !item.props ||
      typeof item.props !== "object" ||
      Array.isArray(item.props)
    ) {
      throw new TypeError(`Item "${item.id}" is missing required fields.`);
    }
    for (const [property, value] of Object.entries(item.props)) {
      if (!propertyIds.has(property) || !Number.isFinite(value) || value <= 0) {
        throw new TypeError(`Item "${item.id}" has an invalid ${property} measurement.`);
      }
      let source;
      try {
        source = new URL(item.sources?.[property]);
      } catch {
        throw new TypeError(`Item "${item.id}" is missing a valid source for ${property}.`);
      }
      if (source.protocol !== "https:") {
        throw new TypeError(`Item "${item.id}" source for ${property} must use HTTPS.`);
      }
    }
    for (const definition of properties) {
      if (
        item.props[definition.id] !== undefined &&
        definition.matchField &&
        (typeof item[definition.matchField] !== "string" ||
          (definition.matchValues && !definition.matchValues.includes(item[definition.matchField])) ||
          (definition.matchField === "length_kind" && !LENGTH_KINDS.includes(item[definition.matchField])))
      ) {
        throw new TypeError(`Item "${item.id}" needs a valid ${definition.matchField} for ${definition.id}.`);
      }
    }
  }
  return items;
}

export function validateCatalog(catalog) {
  if (!catalog || typeof catalog.version !== "string" || !catalog.version.trim()) {
    throw new TypeError("Catalog needs a non-empty version.");
  }
  validateProperties(catalog.properties);
  validateItems(catalog.items, catalog.properties);
  return catalog;
}

function buildEligibleQuestions(items, properties) {
  validateItems(items, properties);
  const orderedItems = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const questions = [];

  for (const definition of properties) {
    const property = definition.id;
    for (let smallIndex = 0; smallIndex < orderedItems.length; smallIndex += 1) {
      for (let largeIndex = smallIndex + 1; largeIndex < orderedItems.length; largeIndex += 1) {
        const first = orderedItems[smallIndex];
        const second = orderedItems[largeIndex];
        if (!(property in first.props) || !(property in second.props)) continue;
        if (!dimensionMatches(first, second, definition)) continue;

        const [itemA, itemB] =
          first.props[property] < second.props[property] ? [first, second] : [second, first];
        const answer = itemB.props[property] / itemA.props[property];
        if (answer < MIN_RATIO || answer > MAX_RATIO || !Number.isFinite(answer)) continue;
        if (itemA.category === itemB.category && answer < MIN_RATIO) continue;
        if (isNearlyRoundNumber(answer)) continue;

        questions.push({
          id: `${property}:${itemA.id}:${itemB.id}`,
          pairId: `${itemA.id}:${itemB.id}`,
          itemA,
          itemB,
          property,
          answer,
          text: questionText(itemA, itemB, definition),
          label: definition.label,
          unit: definition.unit,
        });
      }
    }
  }
  return questions;
}

export function createQuestions(items, { count = ROUND_COUNT, seed, properties } = {}) {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("Question count must be a positive integer.");
  }
  const pool = buildEligibleQuestions(items, properties);
  const random = seed === undefined ? Math.random : seededRandom(seed);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  const selected = [];
  const usedPairs = new Set();
  for (const question of pool) {
    if (usedPairs.has(question.pairId)) continue;
    selected.push(question);
    usedPairs.add(question.pairId);
    if (selected.length === count) break;
  }
  if (selected.length < count) {
    throw new RangeError(
      `Not enough eligible, non-repeating item pairs: need ${count}, found ${selected.length}.`,
    );
  }
  return selected;
}

export function dailySeed(date = new Date(), dataVersion = "1") {
  const utcDate =
    date instanceof Date ? date.toISOString().slice(0, 10) : String(date);
  const parsedDate = new Date(`${utcDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(utcDate) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== utcDate
  ) {
    throw new TypeError("Daily seed date must be a valid UTC date in YYYY-MM-DD format.");
  }
  return `daily:${GAME_VERSION}:${dataVersion}:${utcDate}`;
}

export function scoreGuess(guess, answer) {
  if (!Number.isFinite(guess) || guess < MIN_GUESS || guess > MAX_GUESS) {
    throw new RangeError(`Guess must be between ${MIN_GUESS} and ${MAX_GUESS}.`);
  }
  if (!Number.isFinite(answer) || answer <= 0) {
    throw new RangeError("Answer must be a positive finite number.");
  }
  return Math.round(Math.max(0, 100 - 50 * Math.abs(Math.log10(guess / answer))));
}

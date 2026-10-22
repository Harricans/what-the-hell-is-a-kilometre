export const GAME_VERSION = "1";
export const ROUND_COUNT = 5;
export const MIN_RATIO = 3;
export const MAX_RATIO = 10_000_000;
export const MIN_GUESS = 1;
export const MAX_GUESS = 10_000_000;

const PROPERTY_ORDER = ["mass_kg", "length_m", "volume_l"];
const ROUND_NUMBER_TOLERANCE = 0.02;

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

function dimensionMatches(itemA, itemB, property) {
  return property !== "length_m" || itemA.length_kind === itemB.length_kind;
}

function questionText(itemA, itemB, property) {
  if (property === "mass_kg") {
    return `How many ${itemA.plural} weigh the same as one ${itemB.name}?`;
  }
  if (property === "volume_l") {
    return `How many ${itemA.plural} fill the same space as one ${itemB.name}?`;
  }

  const dimension = itemA.length_kind;
  if (dimension === "diameter") {
    return `How many ${itemA.plural} diameters fit across one ${itemB.name}'s diameter?`;
  }
  if (dimension === "height") {
    return `How many ${itemA.plural} heights stack up to one ${itemB.name}'s height?`;
  }
  if (dimension === "width") {
    return `How many ${itemA.plural} widths fit across one ${itemB.name}'s width?`;
  }
  return `How many ${itemA.plural} laid end to end match one ${itemB.name}'s length?`;
}

export function validateItems(items) {
  if (!Array.isArray(items) || items.length < 2) {
    throw new TypeError("Provide at least two items.");
  }
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id)) {
      throw new TypeError("Every item must have a unique, non-empty id.");
    }
    ids.add(item.id);
    if (!item.name || !item.plural || !item.category || !item.props) {
      throw new TypeError(`Item "${item.id}" is missing required fields.`);
    }
    for (const [property, value] of Object.entries(item.props)) {
      if (!PROPERTY_ORDER.includes(property) || !Number.isFinite(value) || value <= 0) {
        throw new TypeError(`Item "${item.id}" has an invalid ${property} measurement.`);
      }
    }
  }
  return items;
}

function buildEligibleQuestions(items) {
  validateItems(items);
  const orderedItems = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const questions = [];

  for (const property of PROPERTY_ORDER) {
    for (let smallIndex = 0; smallIndex < orderedItems.length; smallIndex += 1) {
      for (let largeIndex = smallIndex + 1; largeIndex < orderedItems.length; largeIndex += 1) {
        const first = orderedItems[smallIndex];
        const second = orderedItems[largeIndex];
        if (!(property in first.props) || !(property in second.props)) continue;
        if (!dimensionMatches(first, second, property)) continue;

        const [itemA, itemB] =
          first.props[property] < second.props[property] ? [first, second] : [second, first];
        const answer = itemB.props[property] / itemA.props[property];
        if (answer < MIN_RATIO || answer > MAX_RATIO || !Number.isFinite(answer)) continue;
        if (itemA.category === itemB.category && answer < MIN_RATIO) continue;
        if (isNearlyRoundNumber(answer)) continue;

        questions.push({
          id: `${property}:${itemA.id}:${itemB.id}`,
          itemA,
          itemB,
          property,
          answer,
          text: questionText(itemA, itemB, property),
        });
      }
    }
  }
  return questions;
}

export function createQuestions(items, { count = ROUND_COUNT, seed } = {}) {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("Question count must be a positive integer.");
  }
  const pool = buildEligibleQuestions(items);
  if (pool.length < count) {
    throw new RangeError(`Not enough eligible question pairs: need ${count}, found ${pool.length}.`);
  }

  const random = seed === undefined ? Math.random : seededRandom(seed);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, count);
}

export function dailySeed(date = new Date(), dataVersion = "1") {
  const utcDate =
    date instanceof Date ? date.toISOString().slice(0, 10) : String(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(utcDate) || Number.isNaN(Date.parse(`${utcDate}T00:00:00Z`))) {
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

import {
  createQuestions,
  dailySeed,
  GAME_VERSION,
  MAX_GUESS,
  MIN_GUESS,
  ROUND_COUNT,
  scoreGuess,
} from "./questions.js";

const elements = Object.fromEntries(
  [
    "start-screen",
    "game-screen",
    "results-screen",
    "daily-button",
    "random-button",
    "daily-date",
    "mode-label",
    "round-label",
    "progress",
    "item-pair",
    "question",
    "guess-form",
    "guess-input",
    "guess-slider",
    "unit-label",
    "guess-error",
    "submit-button",
    "answer-panel",
    "round-score",
    "answer-heading",
    "answer-note",
    "answer-sources",
    "next-button",
    "results-mode",
    "total-score",
    "share-emoji",
    "share-button",
    "again-button",
    "copy-status",
    "load-error",
  ].map((id) => [id, document.getElementById(id)]),
);

let data;
let state;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 3 }).format(value);
}

function formatAnswer(question) {
  return `${formatNumber(question.answer)} ${question.itemA.plural}`;
}

function propertyLabel(property) {
  return property === "mass_kg" ? "by mass" : property === "volume_l" ? "by volume" : "by length";
}

function sliderValue(guess) {
  return Math.round((Math.log10(guess) / 7) * 7000);
}

function guessFromSlider(value) {
  return 10 ** (Number(value) / 1000);
}

function setGuess(value, { updateSlider = true } = {}) {
  const guess = Number(value);
  elements["guess-input"].value = value;
  if (updateSlider && Number.isFinite(guess) && guess >= MIN_GUESS && guess <= MAX_GUESS) {
    elements["guess-slider"].value = sliderValue(guess);
  }
}

function currentQuestion() {
  return state.questions[state.round];
}

function renderQuestion() {
  const question = currentQuestion();
  elements["mode-label"].textContent =
    state.mode === "daily" ? `Daily · ${state.date}` : "Random game";
  elements["round-label"].textContent = `Round ${state.round + 1} of ${ROUND_COUNT}`;
  elements.progress.style.width = `${((state.round + 1) / ROUND_COUNT) * 100}%`;
  elements["item-pair"].textContent = `${question.itemA.emoji} ${question.itemA.name} · ${question.itemB.emoji} ${question.itemB.name}`;
  elements.question.textContent = question.text;
  elements["unit-label"].textContent = propertyLabel(question.property);
  elements["guess-error"].textContent = "";
  elements["answer-panel"].hidden = true;
  elements["submit-button"].hidden = false;
  setGuess(1000);
}

function startGame(mode) {
  const date = todayUtc();
  const seed = mode === "daily" ? dailySeed(date, data.version) : undefined;
  state = {
    mode,
    date,
    questions: createQuestions(data.items, { count: ROUND_COUNT, seed }),
    round: 0,
    scores: [],
  };
  elements["start-screen"].hidden = true;
  elements["results-screen"].hidden = true;
  elements["game-screen"].hidden = false;
  renderQuestion();
}

function sourceLinks(question) {
  const sources = [
    [question.itemA, question.property],
    [question.itemB, question.property],
  ];
  const unique = new Map(sources.map(([item, property]) => [item.sources[property], item]));
  const fragment = document.createDocumentFragment();
  [...unique].forEach(([url, item], index) => {
    if (index > 0) fragment.append(" · ");
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `${item.name} source`;
    fragment.append(link);
  });
  return fragment;
}

function submitGuess(event) {
  event.preventDefault();
  const guess = Number(elements["guess-input"].value);
  let score;
  try {
    score = scoreGuess(guess, currentQuestion().answer);
  } catch (error) {
    elements["guess-error"].textContent = error.message;
    return;
  }

  const question = currentQuestion();
  state.scores.push(score);
  elements["round-score"].textContent = `You scored ${score} / 100`;
  elements["answer-heading"].textContent = `About ${formatAnswer(question)}.`;
  elements["answer-note"].textContent = question.itemB.note;
  elements["answer-sources"].replaceChildren(sourceLinks(question));
  elements["next-button"].textContent =
    state.round === ROUND_COUNT - 1 ? "See my total" : "Next question";
  elements["answer-panel"].hidden = false;
  elements["submit-button"].hidden = true;
  elements["answer-heading"].focus();
}

function emojiForScore(score) {
  if (score >= 80) return "🟩";
  if (score >= 50) return "🟨";
  return "🟥";
}

function finishGame() {
  const total = state.scores.reduce((sum, score) => sum + score, 0);
  elements["game-screen"].hidden = true;
  elements["results-screen"].hidden = false;
  elements["results-mode"].textContent =
    state.mode === "daily" ? `Daily · ${state.date}` : "Random game";
  elements["total-score"].textContent = `${total} / ${ROUND_COUNT * 100}`;
  elements["share-emoji"].textContent = state.scores.map(emojiForScore).join("");
  elements["copy-status"].textContent = "";
  elements["results-heading"].focus();
}

function nextQuestion() {
  if (state.round === ROUND_COUNT - 1) {
    finishGame();
    return;
  }
  state.round += 1;
  renderQuestion();
  elements.question.focus();
}

async function copyShareText() {
  const total = state.scores.reduce((sum, score) => sum + score, 0);
  const label = state.mode === "daily" ? `Daily ${state.date}` : "Random game";
  const text = `What the Hell Is a Kilometre? · ${label}\n${total}/${ROUND_COUNT * 100} ${state.scores.map(emojiForScore).join("")}`;
  try {
    await navigator.clipboard.writeText(text);
    elements["copy-status"].textContent = "Score copied — no answers spoiled.";
  } catch {
    elements["copy-status"].textContent = "Clipboard access is unavailable in this browser.";
  }
}

elements["daily-button"].addEventListener("click", () => startGame("daily"));
elements["random-button"].addEventListener("click", () => startGame("random"));
elements["guess-form"].addEventListener("submit", submitGuess);
elements["guess-input"].addEventListener("input", (event) => setGuess(event.target.value));
elements["guess-slider"].addEventListener("input", (event) => setGuess(guessFromSlider(event.target.value), { updateSlider: false }));
elements["next-button"].addEventListener("click", nextQuestion);
elements["share-button"].addEventListener("click", copyShareText);
elements["again-button"].addEventListener("click", () => {
  elements["results-screen"].hidden = true;
  elements["start-screen"].hidden = false;
});

elements["daily-date"].textContent = `Today's date is ${todayUtc()} (UTC).`;

try {
  const response = await fetch("./data/items.json");
  if (!response.ok) throw new Error("Could not load the game data.");
  data = await response.json();
  if (!data.version || !Array.isArray(data.items)) throw new Error("The game data has an invalid format.");
  createQuestions(data.items, { count: ROUND_COUNT, seed: dailySeed(todayUtc(), `${data.version}:${GAME_VERSION}`) });
  elements["daily-button"].disabled = false;
  elements["random-button"].disabled = false;
} catch (error) {
  elements["daily-button"].disabled = true;
  elements["random-button"].disabled = true;
  elements["load-error"].textContent = `${error.message} Run the game from a local web server rather than opening the file directly.`;
  elements["load-error"].hidden = false;
}

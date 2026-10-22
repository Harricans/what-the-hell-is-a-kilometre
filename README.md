# What the Hell Is a Kilometre?

A small, playful browser game about estimating real-world quantities. The goal is a fast, shareable game that works on phones and does not depend on a server or third-party runtime services.

## Game

- Each round asks how many of a small thing equal one larger thing for the same property: for example, how many bananas laid end to end equal the height of the Eiffel Tower?
- Offer a logarithmic slider and a typed-number input. Accept only finite, positive guesses in the supported range (1 to 10 million).
- Reveal the answer and a short fact or caveat, then score closeness with `round(max(0, 100 - 50 × |log10(guess / answer)|))`.
- Play five rounds, show the total, and offer spoiler-free, copyable share text.
- Include Daily and Random modes. Daily questions should be reproducible for a given UTC date and published data version; Random mode should vary between games.

## Implementation plan

The prototype currently includes 60 items across everyday objects, food, animals, vehicles, landmarks, and space. The data is a first pass; validate its individual measurements and source links before treating it as fact-checked.

## Repository layout

```text
.
├── index.html          # GitHub Pages entry point (kept at repository root)
├── assets/             # Game and catalog editor styles
├── catalog.html        # Spreadsheet-style catalog editor
├── data/items.json     # Property definitions and item catalogue
├── src/                # Browser game, catalog storage, editor, and engine
└── test/               # Node.js unit tests
```

### 1. Curate and validate the data

- `data/items.json` contains both a `properties` registry and an `items` array. Each item has stable identifying/display fields plus optional positive numeric values in `props`; `sources` stores the URL for each populated property. An item does not need every variable.
- Each property definition declares its stable `id`, label, consistent unit, and question template. The engine loops through the registry, so a new column does not require a generator-code change. Optional `matchField`/`matchValues` metadata can restrict comparisons to items with matching measurement kinds. Templates support `{aName}`, `{aPlural}`, `{bName}`, `{bPlural}`, `{unit}`, `{aUnit}`, and `{bUnit}`; the built-in length definition also selects a template by `length_kind`.
- Measurements must be positive, ratio-scale quantities with consistent units for a given property. Temperature in Celsius, dates, ordinal values, and mixed units are not meaningful for the ratio-based score. Keep a source URL beside each value; the editor does not automatically search or verify sources.
- Keep a source URL with each measured property (or an equivalently clear per-property source record). A source must support the quantity and definition used, not just describe the item generally.
- Keep at least 60 items across everyday objects and food, animals, vehicles, landmarks, and space. Expand categories with well-sourced examples, and verify current approximate values before treating them as approved data.
- Prefer primary institutional references for facts. Use Wikidata to discover candidates and references, not as automatic verification. Normalize values once to the units above, preserve measurement meaning (for example, height versus diameter), and record ambiguity in the note.
- Validate the JSON before it reaches the game: unique IDs, valid fields, finite positive values, and a usable source for each populated measurement. A schema can check record shape; tests should also check cross-record constraints such as unique IDs.

### 2. Build a deterministic question engine

- Put the generic generator in `src/questions.js`; adding items and variable definitions is data work, not a generator-code change.
- Select a property present on both items and use only matching properties. Choose a smaller item A and larger item B so `B / A` is between 3 and 10,000,000, inclusive.
- Generate property-specific wording. Do not describe a diameter as a height or imply that unlike dimensions are directly comparable.
- Filter same-category pairs with ratios under 3 and trivial, nearly round answers. Define and test the exact threshold rather than relying on subjective wording.
- If there are not enough eligible, non-repeating pairs for a game, fail gracefully instead of looping indefinitely or silently reusing a pair.
- Make selection seedable. Daily mode should use a documented seeded PRNG, the UTC calendar date, stable item ordering, and a versioned selection/data set; otherwise changing data or algorithm can give different players different puzzles for the same date. Random mode can use an unseeded source.

### 3. Add the interface and game flow

- Keep question generation and scoring independent of the DOM so they can be tested without a browser.
- Implement the slider on a base-10 logarithmic scale and keep it synchronized with the typed-number input.
- Build the five-round flow, answer reveal, total score, and spoiler-free share text. Keep external APIs and runtime dependencies out of the game.
- Support narrow screens and dark mode, with clear labels, visible keyboard focus, adequate contrast, and comfortably sized controls.

### 4. Test, check, and publish

- Add unit tests for the score formula, eligible ratio bounds, deterministic Daily results, no duplicate pairs within a game, malformed data, and the no-eligible-pairs case.
- Verify that each generated question has valid data, matching properties, and correctly worded dimensions. Manually check keyboard operation, focus, contrast, and the complete game flow on mobile and desktop.
- Document local run and test commands once the app structure is in place. Keep the site static; GitHub Pages is a suitable first deployment, using branch publishing for a site with no build step or a Pages Actions workflow if a build is introduced.

Run the prototype locally with `python3 -m http.server 8000` from the repository root, then open `http://localhost:8000`. Open `http://localhost:8000/catalog.html` to manage items and variables in a spreadsheet-like table. Run the generator tests with `npm test` (Node.js 18 or newer; there are no installed runtime or test dependencies). Keep `index.html` at the root because GitHub Pages is configured to publish the branch root.

The editor validates and saves catalog changes in browser storage, shared by the editor and game on that device. Use **Export catalog JSON** to download the full catalog; replace `data/items.json` with that file and commit/deploy the change to publish the new content to all players. Import accepts the same complete JSON format. The browser-only editor has no shared database or automatic source lookup.

## Research notes and references

There is no single dependable dataset likely to cover household objects, animals, vehicles, landmarks, and space with consistently defined, traceable measurements. A small curated JSON dataset is the best fit: it keeps the game fast and offline, makes item facts reviewable, and avoids an API dependency. Institutional catalogs are useful for specific categories; no catalog should be treated as a substitute for checking each measurement and its definition.

Values in `data/items.json` are approximate and have source links for each populated measurement. The links include institutional references and item-specific reference pages, but external pages could not be fetched during this implementation. Verify each linked value and definition before presenting the catalogue as fact-checked; in particular, treat household and food sizes as representative rather than universal.

- [NIST: SI units](https://www.nist.gov/pml/owm/metric-si/si-units) — reference for consistent units, not a catalog of game objects.
- [NASA: Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) — candidate source for comparable planetary measurements.
- [Smithsonian Open Access](https://www.si.edu/openaccess) and [API](https://api.si.edu/) — candidate museum-object source; check the individual record and its reuse status.
- [Wikidata data access](https://www.wikidata.org/wiki/Wikidata:Data_access) and [licensing](https://www.wikidata.org/wiki/Wikidata:Licensing) — useful for discovering candidates; follow references to verify individual claims.
- [JSON Schema validation](https://json-schema.org/draft/2020-12/json-schema-validation) — reference for validating the data shape.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [WAI-ARIA slider pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) — accessibility criteria and expected slider interaction; prefer a native, labeled range input where possible.
- [Node.js test runner](https://nodejs.org/api/test.html) — built-in option for testing a DOM-independent JavaScript generator without adding a test dependency.
- [GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) and [custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) — deployment options for a static site.

## Success criteria

- A player can complete five rounds, understand why each answer is correct, and share a result without revealing answers.
- The same published Daily data version produces the same five questions for all players on the same UTC date.
- Every shipped measurement is positive, uses the declared unit and dimension, and has a traceable source; caveats explain limitations but do not replace sourcing.
- The game works without network services, supports keyboard and touch input, and passes the listed generator and game-flow checks.

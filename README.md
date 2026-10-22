# What the Hell Is a Kilometre?

A small, playful browser game about estimating real-world quantities. The goal is a fast, shareable game that works on phones and does not depend on a server or third-party runtime services.

## Game

- Each round asks how many of a small thing equal one larger thing for the same property: for example, how many bananas laid end to end equal the height of the Eiffel Tower?
- Offer a logarithmic slider and a typed-number input. Accept only finite, positive guesses in the supported range (1 to 10 million).
- Reveal the answer and a short fact or caveat, then score closeness with `round(max(0, 100 - 50 × |log10(guess / answer)|))`.
- Play five rounds, show the total, and offer spoiler-free, copyable share text.
- Include Daily and Random modes. Daily questions should be reproducible for a given UTC date and published data version; Random mode should vary between games.

## Implementation plan

The current prototype implements a small space-focused starter set; the broader, 60-item dataset remains future work.

### 1. Curate and validate the data

- Store items in `data/items.json`. Each item has a stable unique `id`, `name`, `plural`, `emoji`, `category`, optional positive measurements in a `props` object using canonical units (`mass_kg`, `length_m`, `volume_l`), a `length_kind` (`length`, `height`, `diameter`, or `width`), and a short note for a fun fact or caveat.
- Keep a source URL with each measured property (or an equivalently clear per-property source record). A source must support the quantity and definition used, not just describe the item generally.
- Start with a small, well-sourced set, then grow to at least 60 items across everyday objects and food, animals, vehicles, landmarks, and space. Treat the old example values as leads to verify, not as approved game data.
- Prefer primary institutional references for facts. Use Wikidata to discover candidates and references, not as automatic verification. Normalize values once to the units above, preserve measurement meaning (for example, height versus diameter), and record ambiguity in the note.
- Validate the JSON before it reaches the game: unique IDs, valid fields, finite positive values, and a usable source for each populated measurement. A schema can check record shape; tests should also check cross-record constraints such as unique IDs.

### 2. Build a deterministic question engine

- Put the generic generator in `src/questions.js`; adding an item should require editing only `data/items.json`.
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

Run the prototype locally with `python3 -m http.server 8000` from the repository root, then open `http://localhost:8000`. Run the generator tests with `npm test` (Node.js 18 or newer; there are no installed runtime or test dependencies).

## Research notes and references

There is no single dependable dataset likely to cover household objects, animals, vehicles, landmarks, and space with consistently defined, traceable measurements. A small curated JSON dataset is the best fit: it keeps the game fast and offline, makes item facts reviewable, and avoids an API dependency. Institutional catalogs are useful for specific categories; no catalog should be treated as a substitute for checking each measurement and its definition.

The starter values in `data/items.json` are approximate and include NASA source links per property. External pages could not be fetched in the implementation environment, so treat the dataset as a prototype and verify the cited values and definitions against the source pages before presenting it as fully fact-checked.

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

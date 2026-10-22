Build "WTH IS AKILOMETRE", a web game deployable fun.

GAMEPLAY
- Each round asks: "How many [A] equal one [B]?" for a chosen property, e.g. "How many bananas laid end to end equal the height of the Eiffel Tower?" or "How many paper clips weigh the same as a house cat?"
- Player guesses with a log-scale slider (1 to 10 million) plus a typed-number option.
- Reveal the true answer with a fun fact, then score by closeness: score = max(0, 100 - 50 * |log10(guess/answer)|), rounded.
- 5 rounds per game, with a total score and a copyable share text (emoji bar, no spoilers).
- Add a "Daily" mode using a date-seeded RNG so everyone gets the same questions that day, plus a "Random" mode.

DATA-DRIVEN DESIGN (important)
- All items live in data/items.json. Schema per item:
  { "id", "name", "plural", "emoji", "category",
    "props": { "mass_kg": n, "length_m": n, "volume_l": n (all optional) },
    "length_kind": "length|height|diameter|width", maybe more see if we can find a good db with heaps of fun variables for certain items objects etc
    "note": "short source or caveat" }
- Write ONE generic question generator in src/questions.js:
  1. Pick a property both items have (mass_kg, length_m, or volume_l).
  2. Pick A (small) and B (large) so that answer = B.prop / A.prop is between 3 and 10,000,000.
  3. Build the question text from templates per property (length: "laid end to end", mass: "weigh the same as", volume: "fill the same space as").
  4. Reject boring pairs: same category with ratio under 3, or answers that are nearly round trivial numbers.
- Adding a new item must require editing only items.json.

STARTER DATA (values are approximate; expand to 60+ items across everyday objects, animals, vehicles, landmarks, and space; double-check every value and put sources or caveats in "note"):
paper clip: 0.001 kg, 0.033 m
penny (US): 0.0025 kg, 0.019 m
grain of rice: 0.00002 kg, 0.007 m
honeybee: 0.0001 kg, 0.015 m
ant: 0.000003 kg, 0.004 m
credit card: 0.005 kg, 0.0856 m
dollar bill: 0.001 kg, 0.156 m
pencil: 0.007 kg, 0.19 m
AA battery: 0.023 kg, 0.0505 m
slice of bread: 0.03 kg, 0.1 m
chicken egg: 0.06 kg, 0.057 m
golf ball: 0.0459 kg, 0.0427 m (diameter)
tennis ball: 0.058 kg, 0.067 m (diameter)
banana: 0.12 kg, 0.19 m
smartphone: 0.2 kg, 0.15 m
coffee mug: 0.35 kg, 0.1 m (height)
basketball: 0.62 kg, 0.24 m (diameter)
brick: 2.5 kg, 0.215 m
house cat: 4.5 kg, 0.46 m
bowling ball: 6.8 kg, 0.218 m (diameter)
adult human: 70 kg, 1.7 m (height)
giraffe: 1,200 kg, 5 m (height)
sedan car: 1,500 kg, 4.7 m
African elephant: 5,000 kg, 3.3 m (height)
school bus: 11,000 kg, 12 m
Boeing 747: 180,000 kg, 70.7 m
blue whale: 150,000 kg, 25 m
football field (US, with end zones): 109.7 m
Statue of Liberty: 204,000 kg, 93 m (height incl. pedestal)
Eiffel Tower: 10,100,000 kg, 330 m (height)
Titanic: 52,000,000 kg, 269 m
Mount Everest: 8,849 m (height)
Earth: 5.972e24 kg, 1.2742e7 m (diameter)
Sun: 1.989e30 kg, 1.3927e9 m (diameter)

QUALITY
- Include a README with how to add items, a unit test for the generator (valid ratio range, deterministic with the same seed, no duplicate pairs in a game),
- Dark mode, large tap targets, and no external dependencies.

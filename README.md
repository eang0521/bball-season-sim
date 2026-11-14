# bball-season-sim

A multi-season basketball simulator. Individual games are decided by a
direct port of [`nba-game-sim`](https://github.com/eang0521/nba-game-sim)'s
possession-by-possession engine; this project adds what sits around that —
schedules, standings, and a **customizable season-progression system**
(aging, retirement, free agency, and the draft) that carries a league from
one year into the next.

**Live demo:** https://bball-season-sim.vercel.app

## What's here

- `src/engine/gameEngine.js` — `Player`/`Team`/`Game`, ported from
  `nba-game-sim`'s `live.html`. Same possession-by-possession rules (see
  `nba-game-sim`'s `RULEBOOK.md`), stripped of the DOM/animation code that
  drove its browser replay. `simulateGame(teamA, teamB)` runs a full game
  and returns the winner, final score, and box score.
- `src/season/` — the offseason engine (retirement, free agency matching,
  Potential-driven aging/development, contracts, rookie generation),
  config-driven and unit tested. See
  [`docs/SEASON-RULES.md`](docs/SEASON-RULES.md) for the rules themselves.
- `src/season/season.js` — a round-robin schedule runner built on top of
  `simulateGame`.
- `src/season/league.js` — generates a fresh, fictional 30-team league to
  develop and test against. Swapping in real rosters (e.g. from
  `nba-game-sim`'s `nba_rosters*.json`) is a separate step.
- `index.html` / `web/` — a static, client-side site: a Web Worker runs the
  season sim (schedule + offseason) off the main thread so simulating
  ~800+ possession-by-possession games per season doesn't freeze the page.
  No build step, no server — it's deployed to Vercel as-is.

## Running it

```bash
npm test        # engine + offseason unit tests
npm run demo     # plays a few seasons end-to-end in the terminal
python -m http.server 5500   # or any static server, then open index.html
```

`npm run demo` takes an optional season count and RNG seed:

```bash
node src/index.js 5 12345
```

## Why "customizable modes"

Every rule in the offseason engine (retirement odds, free-agency
aggressiveness, how fast Potential decays with age, contract length/salary
formulas, draft-class generation) is a plain value in
[`src/season/config.js`](src/season/config.js), passed into the engine
rather than hardcoded. A "mode" — e.g. a faster-aging arcade mode, or a
no-retirement franchise mode — is just a different config object.

## Status / next steps

- League generation is a placeholder (randomly generated fictional
  players at random ages) rather than real NBA rosters.
- The web UI simulates one season at a time and shows standings, the
  offseason summary, and a per-team roster viewer. It doesn't yet expose
  individual game box scores/play-by-play, though the engine already
  returns that data (`simulateGame`'s `boxScore`, and `timeline` when
  `includeTimeline: true`).

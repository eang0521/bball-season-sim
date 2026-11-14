# bball-season-sim

A multi-season basketball simulator. Individual games are meant to be
decided by [`nba-game-sim`](https://github.com/eang0521/nba-game-sim)'s
possession-by-possession engine; this project adds what sits around that —
schedules, standings, and a **customizable season-progression system**
(aging, retirement, free agency, and the draft) that carries a league from
one year into the next.

## Status

Early scaffold. What's here and working:

- `src/season/` — the full offseason engine (retirement, free agency
  matching, aging/development, contracts, rookie generation), config-driven
  and unit tested. See [`docs/SEASON-RULES.md`](docs/SEASON-RULES.md) for
  the rules themselves.
- `src/season/season.js` — a simple round-robin schedule runner.
- `src/engine/gameEngine.js` — **placeholder**. Game outcomes currently
  come from a quick strength-based coin flip so the season loop can run
  end to end. Porting `nba-game-sim`'s real `Game` class (see its
  `live.html` and `RULEBOOK.md`) in behind this same `simulateGame()`
  signature is the next big piece.
- `src/season/league.js` — generates a fresh, fictional 30-team league to
  develop and test against. Swapping in real rosters (e.g. from
  `nba-game-sim`'s `nba_rosters*.json`) is a separate step.

## Running it

```bash
npm test        # offseason engine unit tests
npm run demo     # plays a few seasons end-to-end against a generated league
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

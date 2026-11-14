# bball-season-sim

A multi-season basketball simulator. Individual games are decided by a
direct port of [`nba-game-sim`](https://github.com/eang0521/nba-game-sim)'s
possession-by-possession engine; this project adds what sits around that —
schedules, standings, playoffs, awards, and a **customizable
season-progression system** (aging, retirement, free agency, and the
draft) that carries a league from one year into the next.

**Live demo:** https://bball-season-sim.vercel.app

## What's here

- `src/engine/gameEngine.js` — `Player`/`Team`/`Game`, ported from
  `nba-game-sim`'s `live.html`. Same possession-by-possession rules (see
  `nba-game-sim`'s `RULEBOOK.md`). `simulateGame(teamA, teamB)` runs a full
  game and returns the winner, final score, and box score.
- `src/season/` — the season engine:
  - `offseason.js`, `progression.js`, `rookies.js`, `contracts.js` — the
    offseason itself (retirement, free agency matching, Potential-driven
    aging/development, contracts, rookie generation). See
    [`docs/SEASON-RULES.md`](docs/SEASON-RULES.md) for the rules.
  - `schedule.js` / `season.js` — builds a schedule for any games-per-team
    target (not just round-robin multiples) and plays it, accumulating
    per-player season stats and optional injuries.
  - `playoffs.js` — play-in tournament (seeds 7-10) and a standard
    1v8/2v7/3v6/4v5 conference bracket through the Finals.
  - `awards.js` — MVP/DPOY/ROY/6MOY, All-NBA, All-Defensive, All-Rookie,
    and Finals MVP from the season's accumulated stats. (A heuristic
    approximation — nba-game-sim's own awards logic wasn't available to
    port from.)
  - `conferences.js`, `league.js`, `realLeague.js` — East/West alignment
    and the two league-generation paths described below.
  - Injuries are rolled by the engine itself (`gameEngine.js`'s
    `rollInjuries`/`checkInjuries`/`applyInjury`), ported verbatim from
    nba-game-sim's `season.html`: each game has roughly even odds of
    seeing an injury (continues at a 1/3 chance per extra one), severity
    is 95% Light / 4.5% Medium / 0.5% Severe, and games missed is a
    rounded Normal(mean, stdev) draw per severity (2±5 / 10±10 / 50±15) —
    so a "Light" injury can legitimately round down to 0 games missed.
    `injuries.js` is just the season-level bookkeeping (who's still out,
    decremented per game) around that.
- `index.html` / `web/` — a static, client-side site: a Web Worker runs the
  season sim off the main thread so simulating a full season plus
  postseason doesn't freeze the page. Tabs for Standings, Leaders, Awards,
  Playoffs, Injuries, Roster, and Settings. No build step, no server —
  it's deployed to Vercel as-is.

## Two ways to start a league

- **Random players** — generates fresh prospects, then fast-forwards them
  through 10 simulated seasons (schedule + offseason) before showing you
  the result, so you get a realistic mix of ages and talent on day one
  instead of 450 rookies. Player names are drawn independently (first,
  then last) from every name that's appeared in the NBA historically, so
  common names come up more often than rare ones — same idea as the source
  spreadsheet's name generator.
- **Real NBA rosters** — builds the league from `nba-game-sim`'s current
  roster data (`data/nbaRosters.js`) and every one of those 450 players'
  real birthdate (`data/playerAges.js`), with age computed as of February
  1, 2027 — the project's fixed reference date for the 2026-27 season.
  Potential and contracts are estimated, since neither exists in the
  source data.

## Running it

```bash
npm test        # engine + season + offseason unit tests
npm run demo     # plays a few seasons end-to-end in the terminal
python -m http.server 5500   # or any static server, then open index.html
```

`npm run demo` takes an optional season count, RNG seed, and games-per-team:

```bash
node src/index.js 5 12345 82
```

## Settings

The Settings tab (persisted in `localStorage`) controls: games per season,
home court advantage, rating uncertainty (random per-season noise on every
player's ratings), and injuries — plus whether the Leaders/Awards tabs
show. All of it flows into `playSeason`'s settings object
(`src/season/season.js`'s `DEFAULT_SEASON_SETTINGS`).

## Why "customizable modes"

Every rule in the offseason engine (retirement odds, free-agency
aggressiveness, how fast Potential decays with age, contract length/salary
formulas, draft-class generation) is a plain value in
[`src/season/config.js`](src/season/config.js), passed into the engine
rather than hardcoded. A "mode" — e.g. a faster-aging arcade mode, or a
no-retirement franchise mode — is just a different config object.

## Status / next steps

- Awards are a reasonable heuristic, not a port of nba-game-sim's own
  awards voting (that source wasn't available to read).
- No individual game box score/play-by-play viewer yet, though the engine
  already returns that data (`simulateGame`'s `boxScore`, and `timeline`
  when `includeTimeline: true`).

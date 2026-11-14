// Runs the season sim off the main thread so the full possession-by-
// possession engine (~800+ games per season) never freezes the page.
import { createRng } from '../src/season/rng.js';
import { defaultRules } from '../src/season/config.js';
import { generateInitialLeague, fastForwardSeasons } from '../src/season/league.js';
import { generateRealLeague } from '../src/season/realLeague.js';
import { playSeason } from '../src/season/season.js';
import { runOffseason } from '../src/season/offseason.js';

const BOOTSTRAP_SEASONS = 10;

let rng = null;
let league = null;
let season = 0;

function rosterSummary(players) {
  return [...players]
    .sort((a, b) => b.overall - a.overall)
    .map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      age: p.age,
      overall: p.overall,
      potential: p.potential,
      ratings: p.ratings,
      salary: p.salary,
      yearsLeft: p.yearsLeft,
    }));
}

function topBy(players, key, n = 5) {
  return [...players].sort((a, b) => b[key] - a[key]).slice(0, n);
}

function postReady() {
  self.postMessage({
    type: 'ready',
    season,
    teams: league.teams.map((t) => t.abbr),
    roster: rosterSummary(league.players),
  });
}

self.onmessage = (event) => {
  const { type, payload } = event.data;

  if (type === 'init') {
    rng = createRng(payload?.seed ?? Date.now());
    season = 0;

    if (payload?.mode === 'real') {
      league = generateRealLeague(defaultRules, rng);
      postReady();
      return;
    }

    self.postMessage({ type: 'bootstrapProgress', season: 0, total: BOOTSTRAP_SEASONS });
    const rookieLeague = generateInitialLeague(defaultRules, rng);
    league = fastForwardSeasons(rookieLeague, defaultRules, rng, BOOTSTRAP_SEASONS, (done, total) => {
      self.postMessage({ type: 'bootstrapProgress', season: done, total });
    });
    postReady();
    return;
  }

  if (type === 'simulateSeason') {
    const standings = playSeason(league, rng).sort((a, b) => b.wins - a.wins);
    league = { teams: standings, players: league.players };

    const { players, retirees, draftees } = runOffseason(league, defaultRules, rng);
    league = { teams: standings, players };
    season += 1;

    self.postMessage({
      type: 'seasonResult',
      season,
      standings,
      champion: standings[0],
      retirees: topBy(retirees, 'overall'),
      draftees: topBy(draftees, 'potential'),
      retireeCount: retirees.length,
      draftedCount: draftees.length,
      roster: rosterSummary(league.players),
    });
    return;
  }

  if (type === 'getRoster') {
    const players = league.players.filter((p) => p.team === payload.team);
    self.postMessage({ type: 'roster', team: payload.team, players: rosterSummary(players) });
  }
};

// Runs the season sim off the main thread so the full possession-by-
// possession engine (~800+ games per season) never freezes the page.
import { createRng } from '../src/season/rng.js';
import { defaultRules } from '../src/season/config.js';
import { generateInitialLeague } from '../src/season/league.js';
import { playSeason } from '../src/season/season.js';
import { runOffseason } from '../src/season/offseason.js';

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

self.onmessage = (event) => {
  const { type, payload } = event.data;

  if (type === 'init') {
    rng = createRng(payload?.seed ?? Date.now());
    league = generateInitialLeague(defaultRules, rng);
    season = 0;
    self.postMessage({
      type: 'ready',
      season,
      teams: league.teams.map((t) => t.abbr),
      roster: rosterSummary(league.players),
    });
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

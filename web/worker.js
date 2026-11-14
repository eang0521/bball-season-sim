// Runs the season sim off the main thread so a full schedule (and now the
// postseason on top of it) never freezes the page.
import { createRng } from '../src/season/rng.js';
import { defaultRules } from '../src/season/config.js';
import { generateInitialLeague, fastForwardSeasons } from '../src/season/league.js';
import { generateRealLeague } from '../src/season/realLeague.js';
import { playSeason, DEFAULT_SEASON_SETTINGS } from '../src/season/season.js';
import { runOffseason } from '../src/season/offseason.js';
import { runPostseason } from '../src/season/playoffs.js';
import { computeAwards, computeFinalsMvp } from '../src/season/awards.js';
import { splitByConference } from '../src/season/conferences.js';
import { statSummary } from '../src/season/stats.js';
import { withPositions } from '../src/season/positions.js';

const BOOTSTRAP_SEASONS = 10;
const LEADER_CATEGORIES = [
  ['ppg', 'Points'], ['rpg', 'Rebounds'], ['apg', 'Assists'],
  ['spg', 'Steals'], ['bpg', 'Blocks'], ['pmpg', '+/-'],
  ['fgPct', 'FG%'], ['tpPct', '3P%'],
];
const LEADER_MIN_GAMES_FRACTION = 0.5;

let rng = null;
let league = null;
let season = 0;
let rookieIds = new Set();

// league.players is kept position-annotated at all times (see every
// place `league =` is assigned below), so this just passes it through —
// including when called with a single team's slice, which couldn't
// rank itself league-wide on its own.
function rosterSummary(players) {
  return [...players]
    .sort((a, b) => b.overall - a.overall)
    .map((p) => ({
      id: p.id, name: p.name, team: p.team, age: p.age, position: p.position,
      overall: p.overall, potential: p.potential, ratings: p.ratings,
      salary: p.salary, yearsLeft: p.yearsLeft,
    }));
}

function topBy(players, key, n = 5) {
  return [...players].sort((a, b) => b[key] - a[key]).slice(0, n);
}

function buildLeaders(stats, gamesPerTeam) {
  const minGames = Math.max(1, Math.round(gamesPerTeam * LEADER_MIN_GAMES_FRACTION));
  const summaries = stats.filter((s) => s.games >= minGames).map(statSummary);
  const leaders = {};
  for (const [key, label] of LEADER_CATEGORIES) {
    leaders[key] = { label, top: [...summaries].sort((a, b) => b[key] - a[key]).slice(0, 10) };
  }
  return leaders;
}

function rosterByTeamMap(players) {
  const map = new Map();
  for (const p of players) {
    if (!map.has(p.team)) map.set(p.team, []);
    map.get(p.team).push(p);
  }
  return map;
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
    rookieIds = new Set();

    if (payload?.mode === 'real') {
      const real = generateRealLeague(defaultRules, rng);
      league = { teams: real.teams, players: withPositions(real.players) };
      postReady();
      return;
    }

    self.postMessage({ type: 'bootstrapProgress', season: 0, total: BOOTSTRAP_SEASONS });
    const rookieLeague = generateInitialLeague(defaultRules, rng);
    const matured = fastForwardSeasons(rookieLeague, defaultRules, rng, BOOTSTRAP_SEASONS, (done, total) => {
      self.postMessage({ type: 'bootstrapProgress', season: done, total });
    });
    league = { teams: matured.teams, players: withPositions(matured.players) };
    rookieIds = new Set(matured.lastDraftees.map((p) => p.id));
    postReady();
    return;
  }

  if (type === 'simulateSeason') {
    const settings = { ...DEFAULT_SEASON_SETTINGS, ...payload?.settings };

    const { standings, stats, injuryReport } = playSeason(league, rng, settings, (played, total) => {
      if (played % 50 === 0 || played === total) {
        self.postMessage({ type: 'simProgress', played, total });
      }
    });
    standings.sort((a, b) => b.wins - a.wins);

    const rosterByTeam = rosterByTeamMap(league.players);
    const postseason = runPostseason(standings, rosterByTeam, rng, settings);
    const finalsMvp = computeFinalsMvp(postseason.finals, league.players);
    const awards = computeAwards(stats, standings, league.players, rookieIds, settings.gamesPerTeam);
    const leaders = buildLeaders(stats, settings.gamesPerTeam);
    const allPlayerStats = stats.map(statSummary);
    // The roster as it actually played this season (ratings before the
    // offseason ages/replaces anyone), for the Players tab and history.
    const playedRoster = rosterSummary(league.players);

    league = { teams: standings, players: league.players };
    const { players, retirees, draftees } = runOffseason(league, defaultRules, rng);
    league = { teams: standings, players: withPositions(players) };
    rookieIds = new Set(draftees.map((p) => p.id));
    season += 1;

    self.postMessage({
      type: 'seasonResult',
      season,
      standings,
      conferences: splitByConference(standings),
      champion: standings[0],
      leaders,
      awards,
      finalsMvp,
      postseason,
      injuryReport,
      retirees: topBy(retirees, 'overall'),
      draftees: topBy(draftees, 'potential'),
      retireeCount: retirees.length,
      draftedCount: draftees.length,
      roster: rosterSummary(league.players),
      playedRoster,
      allPlayerStats,
    });
    return;
  }

  if (type === 'getRoster') {
    const players = league.players.filter((p) => p.team === payload.team);
    self.postMessage({ type: 'roster', team: payload.team, players: rosterSummary(players) });
  }
};

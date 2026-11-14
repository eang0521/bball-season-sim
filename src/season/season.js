import { simulateGame } from '../engine/gameEngine.js';
import { buildSchedule } from './schedule.js';
import { createStatAccumulator, addGameBoxScore } from './stats.js';
import { createInjuryTracker } from './injuries.js';
import { gaussian } from './rng.js';

export const DEFAULT_SEASON_SETTINGS = {
  gamesPerTeam: 58,
  homeCourtAdvantage: true,
  ratingUncertainty: false,
  uncertaintyStdev: 3,
  injuriesEnabled: false,
};

function groupByTeam(players) {
  const byTeam = new Map();
  for (const player of players) {
    if (!byTeam.has(player.team)) byTeam.set(player.team, []);
    byTeam.get(player.team).push(player);
  }
  return byTeam;
}

// Matches nba-game-sim's perturbRosters(): independent Normal(0, stdev)
// noise per rating, clamped at 0.
function jitterRoster(players, stdev, rng) {
  if (!stdev) return players;
  return players.map((p) => ({
    ...p,
    ratings: {
      twoPt: Math.max(0, p.ratings.twoPt + Math.round(gaussian(rng, stdev))),
      threePt: Math.max(0, p.ratings.threePt + Math.round(gaussian(rng, stdev))),
      def: Math.max(0, p.ratings.def + Math.round(gaussian(rng, stdev))),
      reb: Math.max(0, p.ratings.reb + Math.round(gaussian(rng, stdev))),
    },
  }));
}

function idByTeamName(players) {
  return new Map(players.map((p) => [`${p.team}|${p.name}`, p.id]));
}

// Plays a full schedule (see buildSchedule) and accumulates season-long
// per-player stat lines from every game's box score. `onGame(played,
// total)` fires after each simulated game, for progress reporting.
//
// Injuries follow nba-game-sim's season.html simGame() exactly: for each
// game, filter each side to available players, decrement existing
// injuries for the full roster, THEN play the game — any new injuries
// the engine rolls during it apply starting next game.
export function playSeason(league, rng, settings = {}, onGame) {
  const cfg = { ...DEFAULT_SEASON_SETTINGS, ...settings };
  const rosterByTeam = groupByTeam(league.players);
  if (cfg.ratingUncertainty) {
    for (const [abbr, roster] of rosterByTeam) {
      rosterByTeam.set(abbr, jitterRoster(roster, cfg.uncertaintyStdev, rng));
    }
  }

  const wins = new Map(league.teams.map((t) => [t.abbr, 0]));
  const gamesPlayed = new Map(league.teams.map((t) => [t.abbr, 0]));
  const abbrs = league.teams.map((t) => t.abbr);
  const schedule = buildSchedule(abbrs, cfg.gamesPerTeam, rng);
  const stats = createStatAccumulator(league.players);
  const injuries = cfg.injuriesEnabled ? createInjuryTracker() : null;
  const nameToId = cfg.injuriesEnabled ? idByTeamName(league.players) : null;

  let played = 0;
  for (const [aAbbr, bAbbr] of schedule) {
    const fullA = rosterByTeam.get(aAbbr);
    const fullB = rosterByTeam.get(bAbbr);
    const rosterA = injuries ? injuries.filterAvailable(fullA) : fullA;
    const rosterB = injuries ? injuries.filterAvailable(fullB) : fullB;
    if (injuries) {
      injuries.decrement(fullA);
      injuries.decrement(fullB);
    }

    const result = simulateGame(
      { abbr: aAbbr, players: rosterA },
      { abbr: bAbbr, players: rosterB },
      rng,
      { homeCourtAdvantage: cfg.homeCourtAdvantage, injuriesEnabled: cfg.injuriesEnabled },
    );
    wins.set(result.winner, wins.get(result.winner) + 1);
    addGameBoxScore(stats, result.boxScore[aAbbr], aAbbr);
    addGameBoxScore(stats, result.boxScore[bAbbr], bAbbr);
    if (injuries && result.injuryEvents.length) {
      injuries.recordEvents(result.injuryEvents, nameToId);
    }

    gamesPlayed.set(aAbbr, gamesPlayed.get(aAbbr) + 1);
    gamesPlayed.set(bAbbr, gamesPlayed.get(bAbbr) + 1);

    played += 1;
    onGame?.(played, schedule.length);
  }

  const standings = league.teams.map((t) => ({
    abbr: t.abbr,
    wins: wins.get(t.abbr),
    losses: gamesPlayed.get(t.abbr) - wins.get(t.abbr),
    gamesPlayed: gamesPlayed.get(t.abbr),
  }));

  return { standings, stats: [...stats.values()], injuryReport: injuries ? injuries.finalize() : [] };
}

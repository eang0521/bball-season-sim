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

function jitterRoster(players, stdev, rng) {
  if (!stdev) return players;
  return players.map((p) => ({
    ...p,
    ratings: {
      twoPt: p.ratings.twoPt + Math.round(gaussian(rng, stdev)),
      threePt: p.ratings.threePt + Math.round(gaussian(rng, stdev)),
      def: p.ratings.def + Math.round(gaussian(rng, stdev)),
      reb: p.ratings.reb + Math.round(gaussian(rng, stdev)),
    },
  }));
}

// Plays a full schedule (see buildSchedule) and accumulates season-long
// per-player stat lines from every game's box score. `onGame(played,
// total)` fires after each simulated game, for progress reporting.
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

  let played = 0;
  for (const [aAbbr, bAbbr] of schedule) {
    let rosterA = rosterByTeam.get(aAbbr);
    let rosterB = rosterByTeam.get(bAbbr);
    if (injuries) {
      rosterA = injuries.available(aAbbr, gamesPlayed.get(aAbbr), rosterA);
      rosterB = injuries.available(bAbbr, gamesPlayed.get(bAbbr), rosterB);
    }

    const result = simulateGame(
      { abbr: aAbbr, players: rosterA },
      { abbr: bAbbr, players: rosterB },
      rng,
      { homeCourtAdvantage: cfg.homeCourtAdvantage },
    );
    wins.set(result.winner, wins.get(result.winner) + 1);
    addGameBoxScore(stats, result.boxScore[aAbbr], aAbbr);
    addGameBoxScore(stats, result.boxScore[bAbbr], bAbbr);

    gamesPlayed.set(aAbbr, gamesPlayed.get(aAbbr) + 1);
    gamesPlayed.set(bAbbr, gamesPlayed.get(bAbbr) + 1);
    if (injuries) {
      injuries.maybeInjure(aAbbr, gamesPlayed.get(aAbbr), rosterByTeam.get(aAbbr), rng);
      injuries.maybeInjure(bAbbr, gamesPlayed.get(bAbbr), rosterByTeam.get(bAbbr), rng);
    }

    played += 1;
    onGame?.(played, schedule.length);
  }

  const standings = league.teams.map((t) => ({
    abbr: t.abbr,
    wins: wins.get(t.abbr),
    losses: gamesPlayed.get(t.abbr) - wins.get(t.abbr),
    gamesPlayed: gamesPlayed.get(t.abbr),
  }));

  const injuryReport = injuries
    ? injuries.report.map((r) => ({
        ...r,
        gamesRemaining: Math.max(0, r.outUntil - gamesPlayed.get(r.team)),
      }))
    : [];

  return { standings, stats: [...stats.values()], injuryReport };
}

// A lightweight injury model (not nba-game-sim's own system — that wasn't
// available to port — but the same shape: each game carries a small
// chance of an injury, re-rolled for multiples, and injured players sit
// out a random stretch of future games before returning).
import { randInt } from './rng.js';

const PER_GAME_CHANCE = 0.2;
const SEVERITY = [
  { label: 'Minor', weight: 3, gamesRange: [1, 5] },
  { label: 'Moderate', weight: 2, gamesRange: [6, 15] },
  { label: 'Severe', weight: 1, gamesRange: [16, 40] },
];
const TOTAL_WEIGHT = SEVERITY.reduce((sum, s) => sum + s.weight, 0);

function rollSeverity(rng) {
  let roll = rng() * TOTAL_WEIGHT;
  for (const s of SEVERITY) {
    if (roll < s.weight) return s;
    roll -= s.weight;
  }
  return SEVERITY[0];
}

// Creates an injury tracker: `.available(team, gamesPlayed, roster)` filters
// out anyone currently hurt; `.maybeInjure(team, gamesPlayed, roster, rng)`
// rolls the per-game chance (re-rolled for multiples) and may sideline a
// random healthy player, recording it in `.report`.
export function createInjuryTracker() {
  const until = new Map(); // playerId -> gamesPlayed threshold to return at
  const report = []; // { id, name, team, label, outUntil }

  function available(team, gamesPlayed, roster) {
    const healthy = roster.filter((p) => (until.get(p.id) ?? 0) <= gamesPlayed);
    return healthy.length >= 5 ? healthy : roster;
  }

  function maybeInjure(team, gamesPlayed, roster, rng) {
    while (rng() < PER_GAME_CHANCE) {
      const healthy = available(team, gamesPlayed, roster);
      if (healthy.length <= 5) break;
      const victim = healthy[randInt(rng, 0, healthy.length - 1)];
      const severity = rollSeverity(rng);
      const outGames = randInt(rng, severity.gamesRange[0], severity.gamesRange[1]);
      const outUntil = gamesPlayed + outGames;
      until.set(victim.id, outUntil);
      report.push({ id: victim.id, name: victim.name, team, label: severity.label, outUntil });
    }
  }

  return { available, maybeInjure, report };
}

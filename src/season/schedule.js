import { shuffle } from './rng.js';

// Builds a schedule where every team plays exactly `gamesPerTeam` games,
// for any positive integer (not just multiples of a round-robin's 29) by
// greedily pairing the two teams with the most games still left to
// schedule. That always balances exactly, since 30 teams means the total
// games-left pool is always even. Ties are shuffled for matchup variety.
export function buildSchedule(teamAbbrs, gamesPerTeam, rng) {
  const remaining = new Map(teamAbbrs.map((abbr) => [abbr, gamesPerTeam]));
  const schedule = [];

  for (;;) {
    let needing = [...remaining.entries()].filter(([, n]) => n > 0).map(([abbr]) => abbr);
    if (needing.length < 2) break;

    needing = shuffle(rng, needing).sort((a, b) => remaining.get(b) - remaining.get(a));
    const [home, away] = needing;
    schedule.push([home, away]);
    remaining.set(home, remaining.get(home) - 1);
    remaining.set(away, remaining.get(away) - 1);
  }

  return schedule;
}

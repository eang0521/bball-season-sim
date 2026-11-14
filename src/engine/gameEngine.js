// Integration boundary with nba-game-sim's possession-by-possession engine
// (see ../../nba-game-sim/RULEBOOK.md and live.html's `Game` class).
//
// Not ported yet: this is a placeholder so season.js has a stable
// `simulateGame` contract to call once the real engine is wired in. For now
// it decides a winner from each team's roster Overall so the season loop
// (standings -> offseason -> next season) can be exercised end-to-end.
export function simulateGame(teamA, teamB, rng) {
  const strength = (team) =>
    team.players.reduce((sum, p) => sum + p.overall, 0) / team.players.length;

  const diff = strength(teamA) - strength(teamB);
  const homeEdge = 2;
  const winProb = 1 / (1 + Math.exp(-(diff + homeEdge) / 12));

  return rng() < winProb
    ? { winner: teamA.abbr, loser: teamB.abbr }
    : { winner: teamB.abbr, loser: teamA.abbr };
}

import { simulateGame } from '../engine/gameEngine.js';

function groupByTeam(players) {
  const byTeam = new Map();
  for (const player of players) {
    if (!byTeam.has(player.team)) byTeam.set(player.team, []);
    byTeam.get(player.team).push(player);
  }
  return byTeam;
}

// Plays a simple round-robin schedule (each team plays every other team
// `gamesPerOpponent` times) and returns updated win totals, ready to feed
// into runOffseason().
export function playSeason(league, rng, gamesPerOpponent = 2) {
  const rosterByTeam = groupByTeam(league.players);
  const wins = new Map(league.teams.map((t) => [t.abbr, 0]));
  const abbrs = league.teams.map((t) => t.abbr);

  for (let round = 0; round < gamesPerOpponent; round++) {
    for (let i = 0; i < abbrs.length; i++) {
      for (let j = i + 1; j < abbrs.length; j++) {
        const teamA = { abbr: abbrs[i], players: rosterByTeam.get(abbrs[i]) };
        const teamB = { abbr: abbrs[j], players: rosterByTeam.get(abbrs[j]) };
        const { winner } = simulateGame(teamA, teamB, rng);
        wins.set(winner, wins.get(winner) + 1);
      }
    }
  }

  return league.teams.map((t) => ({ abbr: t.abbr, wins: wins.get(t.abbr) }));
}

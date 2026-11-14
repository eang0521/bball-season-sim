// Matches every player who needs a new team (free agents leaving an
// expiring deal, plus incoming rookies) to every roster opening (created by
// those same departures, plus retirements), without an explicit salary cap.
//
// Free agents are ranked by value (mostly Potential, with Overall and
// youth as tiebreakers) and openings are ranked by "need" (lower payroll
// first; a team's 2nd/3rd opening always ranks behind every team's 1st).
// Best player goes to the neediest opening, and so on down both lists.

function valueScore(player) {
  return player.potential + player.overall * 0.0001 - player.age * 0.0000001;
}

function rankDescending(players) {
  return [...players].sort((a, b) => valueScore(b) - valueScore(a));
}

function rankOpenings(openings, payrollByTeam) {
  const seenPerTeam = new Map();
  const withNeed = openings.map((opening) => {
    const count = seenPerTeam.get(opening.team) || 0;
    seenPerTeam.set(opening.team, count + 1);
    const need = (payrollByTeam.get(opening.team) || 0) + count * 1000;
    return { ...opening, need };
  });
  return withNeed.sort((a, b) => a.need - b.need);
}

export function matchFreeAgentsToTeams(freeAgents, openings, payrollByTeam) {
  const rankedAgents = rankDescending(freeAgents);
  const rankedOpenings = rankOpenings(openings, payrollByTeam);

  const assignments = new Map(); // player.id -> team
  const count = Math.min(rankedAgents.length, rankedOpenings.length);
  for (let i = 0; i < count; i++) {
    assignments.set(rankedAgents[i].id, rankedOpenings[i].team);
  }
  return assignments;
}

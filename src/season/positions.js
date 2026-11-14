// Ported from nba-game-sim's teams.html assignPositions()/pv(), which
// ranks a roster by "size" and splits it into equal position bands —
// lower PV plays guard, higher PV plays center. teams.html does this per
// 15-man team (5 bands: PG/SG/SF/PF/C); this does it league-wide across
// all 450 players at once, with 9 finer bands of 50 each.
const TIER_LABELS = ['PG', 'G', 'SG', 'GF', 'SF', 'F', 'PF', 'FC', 'C'];

// Same formula as nba-game-sim's pv(p): mostly rebounding minus 3PT
// shooting, with 2PT and DEF as cascading decimal tiebreakers.
function positionValue(ratings) {
  return ratings.reb - ratings.threePt + 0.01 * ratings.twoPt + 0.0001 * ratings.def;
}

// Returns a Map of player id -> position label.
export function assignPositions(players) {
  const sorted = [...players].sort((a, b) => positionValue(a.ratings) - positionValue(b.ratings));
  const tierSize = sorted.length / TIER_LABELS.length;
  const positionById = new Map();
  sorted.forEach((p, i) => {
    const tier = Math.min(TIER_LABELS.length - 1, Math.floor(i / tierSize));
    positionById.set(p.id, TIER_LABELS[tier]);
  });
  return positionById;
}

export function withPositions(players) {
  const positionById = assignPositions(players);
  return players.map((p) => ({ ...p, position: positionById.get(p.id) }));
}

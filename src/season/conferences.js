// Real NBA conference alignment, covering both the "fictional league"
// abbreviations (src/season/league.js) and the basketball-reference-style
// ones the real-roster data uses (BRK/CHO/PHO instead of BKN/CHA/PHX).
const EAST = new Set([
  'ATL', 'BOS', 'BKN', 'BRK', 'CHA', 'CHO', 'CHI', 'CLE', 'DET', 'IND',
  'MIA', 'MIL', 'NYK', 'ORL', 'PHI', 'TOR', 'WAS',
]);
const WEST = new Set([
  'DAL', 'DEN', 'GSW', 'HOU', 'LAC', 'LAL', 'MEM', 'MIN', 'NOP', 'OKC',
  'PHX', 'PHO', 'POR', 'SAC', 'SAS', 'UTA',
]);

export function conferenceOf(abbr) {
  if (EAST.has(abbr)) return 'East';
  if (WEST.has(abbr)) return 'West';
  return 'East';
}

export function splitByConference(standings) {
  const east = standings.filter((t) => conferenceOf(t.abbr) === 'East');
  const west = standings.filter((t) => conferenceOf(t.abbr) === 'West');
  return { East: east, West: west };
}

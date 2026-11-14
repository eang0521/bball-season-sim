import { randInt } from './rng.js';
import { generateProspect } from './rookies.js';
import { advanceOnePeriod } from './progression.js';

export const TEAM_ABBREVIATIONS = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
];

// Builds a fresh league with no real-world data: every player starts as a
// generated prospect, then some are aged forward a random number of
// seasons so the roster has a realistic mix of rookies through veterans.
// Swap this out for real rosters (e.g. ported from nba-game-sim's roster
// JSON) once that import step exists.
export function generateInitialLeague(rules, rng, teams = TEAM_ABBREVIATIONS) {
  let nextId = 1;
  const players = [];

  for (const abbr of teams) {
    for (let i = 0; i < rules.league.rosterSize; i++) {
      let player = generateProspect(nextId++, rules, rng);
      const extraSeasons = randInt(rng, 0, 12);
      for (let s = 0; s < extraSeasons; s++) {
        player = advanceOnePeriod(player, rules, rng);
      }
      players.push({
        ...player,
        team: abbr,
        isRookieEntry: undefined,
        yearsWithTeam: 1,
      });
    }
  }

  return {
    teams: teams.map((abbr) => ({ abbr, wins: 41 })),
    players,
  };
}

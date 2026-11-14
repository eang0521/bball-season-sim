import { generateProspect } from './rookies.js';
import { playSeason } from './season.js';
import { runOffseason } from './offseason.js';

export const TEAM_ABBREVIATIONS = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
];

// A league of nothing but freshly generated rookies. On its own this isn't
// a realistic starting point (every roster is 15 teenagers) — see
// fastForwardSeasons below, which is how a "random players" league
// actually gets built.
export function generateInitialLeague(rules, rng, teams = TEAM_ABBREVIATIONS) {
  let nextId = 1;
  const players = [];

  for (const abbr of teams) {
    for (let i = 0; i < rules.league.rosterSize; i++) {
      const player = generateProspect(nextId++, rules, rng);
      players.push({ ...player, team: abbr, isRookieEntry: undefined, yearsWithTeam: 1 });
    }
  }

  return { teams: teams.map((abbr) => ({ abbr, wins: 41 })), players };
}

// Plays `seasons` full schedule-plus-offseason cycles so a freshly
// generated rookie-only league ages into a realistic mix of rookies,
// veterans, and stars before anyone actually sees it. `gamesPerOpponent`
// is kept low by default since only the roster outcome matters here, not
// the standings along the way. `onProgress(season, totalSeasons)` fires
// after each completed cycle.
export function fastForwardSeasons(league, rules, rng, seasons, onProgress, gamesPerOpponent = 1) {
  let current = league;

  for (let i = 0; i < seasons; i++) {
    const standings = playSeason(current, rng, gamesPerOpponent).sort((a, b) => b.wins - a.wins);
    current = { teams: standings, players: current.players };

    const { players } = runOffseason(current, rules, rng);
    current = { teams: standings, players };

    onProgress?.(i + 1, seasons);
  }

  // Hand back opening-day records, not whatever the last fast-forwarded
  // season happened to finish with.
  return {
    teams: current.teams.map((t) => ({ abbr: t.abbr, wins: 41 })),
    players: current.players,
  };
}

// Demo CLI: plays a few seasons end-to-end (schedule -> offseason -> repeat)
// against a freshly generated league, and prints what moved.
//   node src/index.js [seasons] [seed] [gamesPerTeam]
import { createRng } from './season/rng.js';
import { defaultRules } from './season/config.js';
import { generateInitialLeague } from './season/league.js';
import { playSeason } from './season/season.js';
import { runOffseason } from './season/offseason.js';

const seasons = Number(process.argv[2] ?? 3);
const seed = Number(process.argv[3] ?? Date.now());
const gamesPerTeam = Number(process.argv[4] ?? 58);

const rng = createRng(seed);
let league = generateInitialLeague(defaultRules, rng);

for (let year = 1; year <= seasons; year++) {
  const { standings } = playSeason(league, rng, { gamesPerTeam });
  standings.sort((a, b) => b.wins - a.wins);
  league = { teams: standings, players: league.players };

  const { players, retirees, draftees } = runOffseason(league, defaultRules, rng);
  league = { teams: standings, players };

  console.log(`\n=== Season ${year} ===`);
  console.log(
    'Top 3:',
    standings.slice(0, 3).map((t) => `${t.abbr} (${t.wins}-${t.losses})`).join(', '),
  );
  console.log(`Retirements: ${retirees.length}, Draftees: ${draftees.length}`);
}

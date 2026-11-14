// Builds a league from today's actual NBA rosters instead of generated
// prospects. Ratings come straight from nba-game-sim's roster data; age,
// Potential, and contracts aren't part of that data, so they're estimated
// (see estimatePotential below) rather than scraped.
import { nbaRosters } from '../../data/nbaRosters.js';
import { playerAges } from '../../data/playerAges.js';
import { randInt, signedDie } from './rng.js';
import { renewContract } from './contracts.js';

// playerAges.js covers every player currently in nbaRosters.js (computed
// as of Feb 1, 2027), so this fallback only matters if nbaRosters.js is
// ever updated with someone not yet researched into playerAges.js.
const FALLBACK_AGE_MIN = 20;
const FALLBACK_AGE_MAX = 32;

// No real "Potential" exists for real players, so it's approximated from
// age: younger players get more projected room to grow, older players get
// little to none (and veterans past ~30 trend below Overall, same as any
// player who's already past their peak in the generated engine).
function estimatePotential(overall, age, rng) {
  const growthRoom = Math.round((25 - age) * 1.5);
  return overall + growthRoom + signedDie(rng, 4);
}

export function generateRealLeague(rules, rng) {
  let nextId = 1;
  const teams = Object.keys(nbaRosters).sort();
  const players = [];

  for (const abbr of teams) {
    for (const raw of nbaRosters[abbr]) {
      const ratings = { twoPt: raw.t_2pt, threePt: raw.t_3pt, def: raw.t_def, reb: raw.t_reb };
      const overall = ratings.twoPt + ratings.threePt + ratings.def + ratings.reb;
      const age = playerAges[raw.name]?.age ?? randInt(rng, FALLBACK_AGE_MIN, FALLBACK_AGE_MAX);
      const potential = estimatePotential(overall, age, rng);

      const base = { id: nextId++, name: raw.name, team: abbr, age, overall, potential, ratings };
      const { salary, yearsLeft } = renewContract(base, rules, rng);
      players.push({ ...base, salary, yearsLeft, yearsWithTeam: randInt(rng, 1, 5) });
    }
  }

  return { teams: teams.map((abbr) => ({ abbr, wins: 41 })), players };
}

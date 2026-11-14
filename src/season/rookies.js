// Generates a draft-eligible prospect. This does NOT roll out a player's
// whole career — it only plays forward their pre-draft development years
// (think: high school into college) so prospects arrive at the draft with
// some of the spread real draft classes have, instead of being blank slates.
import { randInt, rollDice, chooseKOfN } from './rng.js';
import { advanceOnePeriod } from './progression.js';
import { FIRST_NAMES, LAST_NAMES } from '../../data/playerNames.js';

// Each array holds one entry per historical NBA player (duplicates kept on
// purpose), so an independent uniform draw from each — a first name, then
// an unrelated last name — lands on common names more often than rare
// ones, same as the spreadsheet's two independent VLOOKUP(RANDBETWEEN...)
// draws into its full player list.
function drawName(rng) {
  const first = FIRST_NAMES[randInt(rng, 0, FIRST_NAMES.length - 1)];
  const last = LAST_NAMES[randInt(rng, 0, LAST_NAMES.length - 1)];
  return `${first} ${last}`;
}

// With ~4,500 first and last names each drawn independently, the same
// full name can come up for two different people (confirmed: it happens
// within a handful of seasons in a 450-player league). `usedNames`, when
// given, is checked and extended so every prospect's name is unique
// across everyone who has ever been in this league — active or retired —
// not just within one draft class.
export function randomName(rng, usedNames) {
  if (!usedNames) return drawName(rng);
  let name = drawName(rng);
  for (let attempt = 0; attempt < 1000 && usedNames.has(name); attempt++) {
    name = drawName(rng);
  }
  usedNames.add(name);
  return name;
}

function rollAmateurBaseline(rules, rng) {
  const { ageRollDieSides, ageRollMultiplier, ageRollOffset } = rules.rookies;
  const age = Math.floor(randInt(rng, 1, ageRollDieSides) * ageRollMultiplier + ageRollOffset);

  // The number of "bonus" dice (0..4) this prospect gets is tied to how far
  // past the youngest draft age they are, spread across the 4 categories.
  const k = Math.max(0, Math.min(4, age - 14));
  const flags = chooseKOfN(rng, k, 4);

  const ratings = {
    twoPt: rollDice(rng, 6, 2) + flags[0] * rollDice(rng, 6, 1),
    threePt: rollDice(rng, 6, 2) + flags[1] * rollDice(rng, 6, 1),
    def: rollDice(rng, 6, 2) + flags[2] * rollDice(rng, 6, 1),
    reb: rollDice(rng, 6, 2) + flags[3] * rollDice(rng, 6, 1),
  };
  const overall = ratings.twoPt + ratings.threePt + ratings.def + ratings.reb;

  const { projectionBonusDice, projectionBonusAgeThresholds } = rules.rookies;
  let projection = rollDice(rng, 6, projectionBonusDice);
  for (const threshold of projectionBonusAgeThresholds) {
    if (age < threshold) projection += rollDice(rng, 6, 1);
  }
  const potential = overall + projection;

  return { age, overall, potential, ratings };
}

export function generateProspect(id, rules, rng, usedNames) {
  let player = {
    id,
    name: randomName(rng, usedNames),
    team: null,
    ...rollAmateurBaseline(rules, rng),
  };

  for (let year = 0; year < rules.rookies.developmentYears; year++) {
    player = advanceOnePeriod(player, rules, rng);
  }

  return {
    ...player,
    // yearsLeft: 1 (an "expiring" deal) is what makes runOffseason treat
    // this prospect as a free agent to be signed on their very first trip
    // through applyAgingAndContract, same as any other free agent — the
    // placeholder salary never surfaces, since that same pass signs them
    // to a real contract before they're added to a roster.
    salary: rules.rookies.salaryPlaceholder,
    yearsLeft: rules.rookies.yearsLeftAtEntry,
    yearsWithTeam: 0,
    isRookieEntry: true,
  };
}

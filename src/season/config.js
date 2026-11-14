// All the tunable knobs behind season progression. Ported from the FBA
// spreadsheet's offseason engine (see /docs/SEASON-RULES.md), with every
// magic number pulled out here so a "mode" is just a different config.
export const defaultRules = {
  league: {
    teams: 30,
    rosterSize: 15,
  },

  retirement: {
    // Retirement roll is RANDBETWEEN(1,6)*10 -> one of {10,20,30,40,50,60}.
    rollDieSides: 6,
    rollMultiplier: 10,
  },

  freeAgency: {
    // RANDBETWEEN(0,89) > MIN(winCap, teamWins)
    rollMin: 0,
    rollMax: 89,
    winCap: 88,
  },

  aging: {
    // Potential's age penalty: FLOOR((age - declineStartAge) / declineInterval)
    declineStartAge: 16,
    declineInterval: 4,
  },

  contracts: {
    // New salary = MEDIAN(floor, ceilingBase, min(newOverall, newPotential)) - offset
    salaryFloor: 56,
    salaryCeilingBase: 95,
    salaryOffset: 55,
    lengthDieSides: 6,
    lengthMultiplier: 0.75,
  },

  rookies: {
    // Draft-age roll: FLOOR(RANDBETWEEN(1,6)*0.6 + 14.5)
    ageRollDieSides: 6,
    ageRollMultiplier: 0.6,
    ageRollOffset: 14.5,
    // Years of pre-draft development applied before a prospect is draftable.
    developmentYears: 3,
    // Extra "projection" dice added to a young prospect's starting Potential.
    projectionBonusDice: 3,
    projectionBonusAgeThresholds: [16, 17, 18],
    salaryPlaceholder: 0,
    yearsLeftAtEntry: 1,
  },
};

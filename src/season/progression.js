// The single aging/development formula the spreadsheet reuses everywhere:
// once to grow an amateur prospect through their pre-draft years, and once
// per offseason for every player already in the league.
//
// Overall chases Potential (moves roughly halfway toward it each cycle);
// Potential itself drifts too, and loses ground every `declineInterval`
// years past `declineStartAge`. The resulting delta is split across the
// four ratings (2PT/3PT/DEF/REB) in the same direction and proportion.
import { signedDie, splitFour } from './rng.js';

export function advanceOnePeriod(player, rules, rng) {
  const age = player.age + 1;

  const overallDelta = Math.ceil((player.potential - player.overall) / 2) + signedDie(rng);
  const potentialDelta =
    Math.ceil(overallDelta / 2) +
    signedDie(rng) -
    Math.floor((age - rules.aging.declineStartAge) / rules.aging.declineInterval);

  const sign = Math.sign(overallDelta) || 1;
  const [d2pt, d3pt, dDef, dReb] = splitFour(rng, Math.abs(overallDelta));

  return {
    ...player,
    age,
    overall: player.overall + overallDelta,
    potential: player.potential + potentialDelta,
    ratings: {
      twoPt: player.ratings.twoPt + sign * d2pt,
      threePt: player.ratings.threePt + sign * d3pt,
      def: player.ratings.def + sign * dDef,
      reb: player.ratings.reb + sign * dReb,
    },
    overallDelta,
    potentialDelta,
  };
}

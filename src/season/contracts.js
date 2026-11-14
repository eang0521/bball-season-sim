import { rollDice } from './rng.js';

// A new contract's salary is pegged to whichever of the two ratings is the
// limiting factor (a declining Potential caps a veteran's payday even if
// Overall hasn't caught down to it yet).
export function renewContract(player, rules, rng) {
  const { salaryFloor, salaryCeilingBase, salaryOffset, lengthDieSides, lengthMultiplier } =
    rules.contracts;
  const basis = Math.min(player.overall, player.potential);
  const median = [salaryFloor, salaryCeilingBase, basis].sort((a, b) => a - b)[1];
  const salary = median - salaryOffset;
  const yearsLeft = Math.ceil(rollDice(rng, lengthDieSides, 1) * lengthMultiplier);
  return { salary, yearsLeft };
}

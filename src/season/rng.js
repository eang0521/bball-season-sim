// Deterministic PRNG so a whole season (or a single offseason) can be replayed
// from a seed. Swap in Math.random via createRng() with no seed for a "live" run.

export function createRng(seed = Date.now()) {
  let state = seed >>> 0;
  return function rng() {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function rollDice(rng, sides, count = 1) {
  let total = 0;
  for (let i = 0; i < count; i++) total += randInt(rng, 1, sides);
  return total;
}

// A signed d6 walk: +1..+6 or -1..-6 with equal probability. Mirrors the
// spreadsheet's `RANDBETWEEN(1,6)*SIGN(RAND()-0.5)` idiom used throughout
// the aging/progression formulas.
export function signedDie(rng, sides = 6) {
  const sign = rng() < 0.5 ? -1 : 1;
  return sign * randInt(rng, 1, sides);
}

// Samples a Binomial(n, p) count by summing n independent Bernoulli(p)
// trials. Statistically equivalent to Excel's BINOM.INV(n, p, RAND()).
export function sampleBinomial(rng, n, p) {
  if (n <= 0) return 0;
  let successes = 0;
  for (let i = 0; i < n; i++) if (rng() < p) successes++;
  return successes;
}

// Splits a non-negative integer `total` into 4 non-negative parts that sum
// back to `total`, via the same cascading-binomial "stick breaking" the
// spreadsheet uses to spread a rating change across 2PT/3PT/DEF/REB.
export function splitFour(rng, total) {
  const a = sampleBinomial(rng, total, 1 / 4);
  const b = sampleBinomial(rng, total - a, 1 / 3);
  const c = sampleBinomial(rng, total - a - b, 1 / 2);
  const d = total - a - b - c;
  return [a, b, c, d];
}

// Picks exactly k of n "slots" uniformly at random, as a 0/1 flag array.
// Mirrors the R2/S2/T2/U2 bonus-die flags on the Ref sheet, where k is the
// number of bonus dice an amateur prospect gets and n is the 4 rating
// categories they can land on.
export function chooseKOfN(rng, k, n) {
  const flags = [];
  let remainingK = k;
  let remainingN = n;
  for (let i = 0; i < n; i++) {
    const flag = rng() < remainingK / remainingN ? 1 : 0;
    flags.push(flag);
    remainingK -= flag;
    remainingN -= 1;
  }
  return flags;
}

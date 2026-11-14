import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/season/rng.js';
import { defaultRules } from '../src/season/config.js';
import { generateInitialLeague } from '../src/season/league.js';
import { generateRealLeague } from '../src/season/realLeague.js';
import { assignPositions, withPositions } from '../src/season/positions.js';

const ORDER = ['PG', 'G', 'SG', 'GF', 'SF', 'F', 'PF', 'FC', 'C'];

test('assignPositions splits 450 players into 9 bands of exactly 50, smallest to largest', () => {
  const rng = createRng(5);
  const league = generateInitialLeague(defaultRules, rng);
  const positionById = assignPositions(league.players);

  assert.equal(positionById.size, 450);
  const counts = new Map(ORDER.map((label) => [label, 0]));
  for (const label of positionById.values()) counts.set(label, counts.get(label) + 1);
  for (const label of ORDER) assert.equal(counts.get(label), 50, `${label} should have 50 players`);
});

test('positions rank by the same size formula as nba-game-sim (reb - 3pt, tiebroken by 2pt/def)', () => {
  const rng = createRng(6);
  const league = generateRealLeague(defaultRules, rng);
  const players = withPositions(league.players);

  const sizeOf = (p) => p.ratings.reb - p.ratings.threePt + 0.01 * p.ratings.twoPt + 0.0001 * p.ratings.def;
  const avgSizeByPosition = new Map();
  for (const label of ORDER) {
    const group = players.filter((p) => p.position === label);
    avgSizeByPosition.set(label, group.reduce((sum, p) => sum + sizeOf(p), 0) / group.length);
  }

  for (let i = 1; i < ORDER.length; i++) {
    assert.ok(
      avgSizeByPosition.get(ORDER[i]) > avgSizeByPosition.get(ORDER[i - 1]),
      `${ORDER[i]} should average bigger than ${ORDER[i - 1]}`,
    );
  }
});

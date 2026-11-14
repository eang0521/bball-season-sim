import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/season/rng.js';
import { defaultRules } from '../src/season/config.js';
import { generateInitialLeague, fastForwardSeasons } from '../src/season/league.js';
import { generateRealLeague } from '../src/season/realLeague.js';

test('fast-forwarding a rookie-only league keeps its size and ages the roster', () => {
  const rng = createRng(5);
  const rookieLeague = generateInitialLeague(defaultRules, rng);
  const expectedSize = rookieLeague.players.length;
  const startingAvgAge =
    rookieLeague.players.reduce((sum, p) => sum + p.age, 0) / expectedSize;

  const matured = fastForwardSeasons(rookieLeague, defaultRules, rng, 3, undefined, 10);

  assert.equal(matured.players.length, expectedSize);
  assert.ok(matured.teams.every((t) => t.wins === 41), 'records reset to a neutral baseline');
  const endingAvgAge = matured.players.reduce((sum, p) => sum + p.age, 0) / matured.players.length;
  assert.ok(endingAvgAge > startingAvgAge, 'league should have aged past day-one rookies');
});

test('fast-forwarding reports progress once per season', () => {
  const rng = createRng(6);
  const rookieLeague = generateInitialLeague(defaultRules, rng);
  const ticks = [];

  fastForwardSeasons(rookieLeague, defaultRules, rng, 4, (season, total) => {
    ticks.push([season, total]);
  }, 10);

  assert.deepEqual(ticks, [[1, 4], [2, 4], [3, 4], [4, 4]]);
});

test('real-roster league has 30 teams of 15 real players with usable stats', () => {
  const rng = createRng(1);
  const league = generateRealLeague(defaultRules, rng);

  assert.equal(league.teams.length, 30);
  assert.equal(league.players.length, 450);
  for (const player of league.players) {
    assert.ok(player.name.length > 0);
    assert.ok(player.age >= 15 && player.age <= 45);
    assert.equal(
      player.overall,
      player.ratings.twoPt + player.ratings.threePt + player.ratings.def + player.ratings.reb,
    );
    assert.ok(player.yearsLeft >= 1);
  }
});

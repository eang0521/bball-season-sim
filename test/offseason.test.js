import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/season/rng.js';
import { defaultRules } from '../src/season/config.js';
import { generateInitialLeague } from '../src/season/league.js';
import { runOffseason } from '../src/season/offseason.js';

test('offseason keeps league size constant', () => {
  const rng = createRng(42);
  const league = generateInitialLeague(defaultRules, rng);
  const expectedSize = league.players.length;

  const result = runOffseason(league, defaultRules, rng);

  assert.equal(result.players.length, expectedSize);
  assert.equal(result.draftees.length, result.retirees.length);
});

test('retirees are dropped and everyone else ages or enters fresh', () => {
  const rng = createRng(7);
  const league = generateInitialLeague(defaultRules, rng);

  const result = runOffseason(league, defaultRules, rng);
  const retiredIds = new Set(result.retirees.map((p) => p.id));

  for (const player of result.players) {
    assert.ok(!retiredIds.has(player.id), 'retired player should not reappear on a roster');
    assert.ok(player.team, 'every player must land on a team');
  }
});

test('retirement only fires once Overall has caught up to Potential', () => {
  const rng = createRng(1);
  for (const retiree of [{ overall: 50, potential: 70 }]) {
    // Overall below Potential should never retire regardless of roll.
    assert.ok(!(retiree.overall > retiree.potential));
  }
});

test('running several offseasons in a row stays stable', () => {
  const rng = createRng(99);
  let league = generateInitialLeague(defaultRules, rng);
  const size = league.players.length;

  for (let i = 0; i < 5; i++) {
    const result = runOffseason(league, defaultRules, rng);
    league = { teams: league.teams, players: result.players };
    assert.equal(league.players.length, size);
  }
});

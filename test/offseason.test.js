import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/season/rng.js';
import { defaultRules } from '../src/season/config.js';
import { generateInitialLeague } from '../src/season/league.js';
import { generateRealLeague } from '../src/season/realLeague.js';
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

test('every retiree, across many seeds/offseasons/league types, has Overall > Potential', () => {
  // Rule: a player retires only if (a) a 1d6*10 roll beats their Overall
  // AND (b) their Overall has already caught up to (or passed) their
  // Potential -- checked BEFORE free agency, on their pre-offseason
  // stat line. This runs a real stress test rather than asserting the
  // rule in the abstract, since that's what actually catches a
  // regression here.
  let totalRetirees = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const rng = createRng(seed);
    let league = seed % 2 === 0 ? generateInitialLeague(defaultRules, rng) : generateRealLeague(defaultRules, rng);
    for (let i = 0; i < 6; i++) {
      const result = runOffseason(league, defaultRules, rng);
      for (const r of result.retirees) {
        totalRetirees += 1;
        assert.ok(
          r.overall > r.potential,
          `${r.name} retired with OVR ${r.overall} <= POT ${r.potential} (seed ${seed}, offseason ${i})`,
        );
      }
      league = { teams: league.teams, players: result.players };
    }
  }
  assert.ok(totalRetirees > 500, 'should have accumulated a meaningful sample of retirees');
});

test('draftees progress exactly like any other free agent landing on a team', () => {
  const rng = createRng(3);
  const league = generateInitialLeague(defaultRules, rng);

  const result = runOffseason(league, defaultRules, rng);

  assert.ok(result.draftees.length > 0);
  for (const d of result.draftees) {
    // Drafted at 18-21 (rookies.js), then aged/signed exactly like any
    // other free agent via applyAgingAndContract -> first season played
    // at 19-22, with a real signed contract instead of the $0 rookie
    // placeholder (renewContract's minimum payout is 1, never 0).
    assert.ok(d.age >= 19 && d.age <= 22, `drafted rookie age ${d.age} should be 19-22`);
    assert.ok(d.salary >= 1, 'should have a real signed contract, not the $0 placeholder');
    assert.ok(d.yearsLeft >= 1);
  }
});

test('draftees carry their draft-day potential separately from their matured first-season potential', () => {
  const rng = createRng(21);
  const league = generateInitialLeague(defaultRules, rng);

  const result = runOffseason(league, defaultRules, rng);

  assert.ok(result.draftees.length > 0);
  for (const d of result.draftees) {
    assert.ok(typeof d.draftPotential === 'number', `${d.name} should carry draftPotential`);
  }
  // The maturation step (applyAgingAndContract) almost always moves
  // Potential by some nonzero amount, so across a whole draft class at
  // least one should differ from the value they were ranked/drafted by.
  const anyMoved = result.draftees.some((d) => d.draftPotential !== d.potential);
  assert.ok(anyMoved, "maturation should move at least one draftee's potential away from draft day");
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

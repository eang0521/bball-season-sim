import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/season/rng.js';
import { defaultRules } from '../src/season/config.js';
import { generateInitialLeague } from '../src/season/league.js';
import { simulateGame } from '../src/engine/gameEngine.js';

function teamFixture(league, abbr) {
  return { abbr, players: league.players.filter((p) => p.team === abbr) };
}

test('simulateGame produces a decisive, internally consistent result', () => {
  const rng = createRng(123);
  const league = generateInitialLeague(defaultRules, rng);
  const teamA = teamFixture(league, league.teams[0].abbr);
  const teamB = teamFixture(league, league.teams[1].abbr);

  const result = simulateGame(teamA, teamB, rng);

  assert.ok([teamA.abbr, teamB.abbr].includes(result.winner));
  assert.ok([teamA.abbr, teamB.abbr].includes(result.loser));
  assert.notEqual(result.winner, result.loser);
  assert.ok(result.score[teamA.abbr] !== result.score[teamB.abbr], 'no ties allowed');
  assert.ok(result.score[result.winner] > result.score[result.loser]);

  const boxTotal = result.boxScore[teamA.abbr].reduce((sum, p) => sum + p.pts, 0);
  assert.equal(boxTotal, result.score[teamA.abbr]);
});

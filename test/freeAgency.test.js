import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchFreeAgentsToTeams } from '../src/season/freeAgency.js';

test('matchFreeAgentsToTeams ranks by whatever potential is on the object at call time', () => {
  // Two "rookies" whose draft-day potential (passed in here) and some
  // later, already-matured potential would rank in opposite order --
  // proves the match only ever sees what's handed to it, so callers
  // control whether ranking happens before or after any later
  // progression step by choosing which snapshot they pass in.
  const freeAgents = [
    { id: 1, potential: 90, overall: 50, age: 19 }, // ranks best pre-maturation
    { id: 2, potential: 60, overall: 55, age: 19 }, // would rank best post-maturation
  ];
  const openings = [{ team: 'NEEDY' }, { team: 'RICH' }];
  const payrollByTeam = new Map([['NEEDY', 10], ['RICH', 300]]);

  const assignments = matchFreeAgentsToTeams(freeAgents, openings, payrollByTeam);

  assert.equal(assignments.get(1), 'NEEDY', 'the higher-potential (as given) free agent should land on the neediest team');
  assert.equal(assignments.get(2), 'RICH');
});

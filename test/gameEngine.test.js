import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/season/rng.js';
import { defaultRules } from '../src/season/config.js';
import { generateInitialLeague, fastForwardSeasons } from '../src/season/league.js';
import { playSeason } from '../src/season/season.js';
import { Team, Game, simulateGame } from '../src/engine/gameEngine.js';

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

test('startLineups always fields 5 players, even if 11+ of 15 have fouled out', () => {
  const roster = Array.from({ length: 15 }, (_, i) => ({
    name: `P${i}`, t_2pt: 10, t_3pt: 10, t_def: 10, t_reb: 10,
  }));
  const team = new Team('TST', roster);
  team.players.slice(0, 11).forEach((p) => { p.fouled_out = true; p.fouls = 6; });
  const game = new Game(team, new Team('OPP', roster.map((p) => ({ ...p }))));

  game.startLineups();

  assert.equal(team.court.length, 5, 'a team must always field 5, falling back to the least-fouled player');
});

test('a season with heavy foul-out risk (uncertainty + injuries, 82 games) never crashes', () => {
  // Regression test: reproduces a real crash where enough players fouled
  // out of a single game that startLineups() left a team with <5 on
  // court, and later indexing (defender/shooter lookups) threw.
  const rng = createRng(777);
  const rookieLeague = generateInitialLeague(defaultRules, rng);
  let league = fastForwardSeasons(rookieLeague, defaultRules, rng, 10, undefined, 29);

  for (let season = 0; season < 2; season++) {
    const { standings } = playSeason(league, rng, {
      gamesPerTeam: 82, injuriesEnabled: true, ratingUncertainty: true, uncertaintyStdev: 3,
    });
    standings.sort((a, b) => b.wins - a.wins);
    league = { teams: standings, players: league.players };
  }
});

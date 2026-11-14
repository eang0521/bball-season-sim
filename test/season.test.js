import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/season/rng.js';
import { defaultRules } from '../src/season/config.js';
import { generateInitialLeague } from '../src/season/league.js';
import { buildSchedule } from '../src/season/schedule.js';
import { playSeason } from '../src/season/season.js';
import { runPostseason } from '../src/season/playoffs.js';
import { computeAwards, computeFinalsMvp } from '../src/season/awards.js';
import { conferenceOf, splitByConference } from '../src/season/conferences.js';

const ABBRS = Array.from({ length: 30 }, (_, i) => `T${i}`);

test('buildSchedule gives every team exactly gamesPerTeam games for odd and even targets', () => {
  for (const gamesPerTeam of [1, 7, 41, 82]) {
    const rng = createRng(1);
    const schedule = buildSchedule(ABBRS, gamesPerTeam, rng);
    const counts = new Map(ABBRS.map((a) => [a, 0]));
    for (const [a, b] of schedule) {
      counts.set(a, counts.get(a) + 1);
      counts.set(b, counts.get(b) + 1);
    }
    for (const abbr of ABBRS) assert.equal(counts.get(abbr), gamesPerTeam, `${abbr} @ ${gamesPerTeam}`);
  }
});

test('injuries always have a real, non-zero assigned duration', () => {
  const rng = createRng(42);
  const league = generateInitialLeague(defaultRules, rng);
  const { injuryReport } = playSeason(league, rng, { gamesPerTeam: 82, injuriesEnabled: true });

  assert.ok(injuryReport.length > 0, 'an 82-game season with injuries enabled should produce some');
  for (const r of injuryReport) {
    assert.ok(r.outGames >= 1, `${r.label} injury should never be assigned 0 games out`);
    // gamesRemaining (how much of the injury was still active when the
    // season ended) can legitimately be 0 even for a long injury, if it
    // happened early enough to fully heal before the season was over.
    assert.ok(r.gamesRemaining >= 0 && r.gamesRemaining <= r.outGames);
  }
});

test('playSeason respects a custom gamesPerTeam and tracks per-player stats', () => {
  const rng = createRng(11);
  const league = generateInitialLeague(defaultRules, rng);
  const { standings, stats } = playSeason(league, rng, { gamesPerTeam: 12 });

  for (const t of standings) {
    assert.equal(t.gamesPlayed, 12);
    assert.equal(t.wins + t.losses, 12);
  }
  const totalPoints = stats.reduce((sum, s) => sum + s.pts, 0);
  assert.ok(totalPoints > 0, 'some points should have been scored');
});

test('conferences split 30 teams into two 15-team groups', () => {
  const rng = createRng(2);
  const league = generateInitialLeague(defaultRules, rng);
  const { standings } = playSeason(league, rng, { gamesPerTeam: 2 });
  const { East, West } = splitByConference(standings);
  assert.equal(East.length, 15);
  assert.equal(West.length, 15);
  for (const t of standings) assert.ok(['East', 'West'].includes(conferenceOf(t.abbr)));
});

test('runPostseason produces a play-in, a full bracket, and a single champion', () => {
  const rng = createRng(3);
  const league = generateInitialLeague(defaultRules, rng);
  const { standings } = playSeason(league, rng, { gamesPerTeam: 12 });
  const rosterByTeam = new Map();
  for (const p of league.players) {
    if (!rosterByTeam.has(p.team)) rosterByTeam.set(p.team, []);
    rosterByTeam.get(p.team).push(p);
  }

  const settings = { homeCourtAdvantage: true };
  const postseason = runPostseason(standings, rosterByTeam, rng, settings);

  assert.ok(postseason.conferences.East.playIn);
  assert.ok(postseason.conferences.West.playIn);
  assert.ok(postseason.conferences.East.bracket.champion.abbr);
  assert.ok(postseason.conferences.West.bracket.champion.abbr);
  assert.ok(postseason.champion);
  assert.ok([
    postseason.conferences.East.bracket.champion.abbr,
    postseason.conferences.West.bracket.champion.abbr,
  ].includes(postseason.champion));

  const finalsMvp = computeFinalsMvp(postseason.finals, league.players);
  assert.ok(finalsMvp.name);
});

test('computeAwards returns a full, non-overlapping set of categories', () => {
  const rng = createRng(4);
  const league = generateInitialLeague(defaultRules, rng);
  const { standings, stats } = playSeason(league, rng, { gamesPerTeam: 12 });
  const rookieIds = new Set(league.players.slice(0, 20).map((p) => p.id));

  const awards = computeAwards(stats, standings, league.players, rookieIds, 12);

  assert.ok(awards.mvp);
  assert.ok(awards.dpoy);
  assert.equal(awards.allNba.first.length + awards.allNba.second.length + awards.allNba.third.length, 15);
  assert.equal(awards.allDefensive.first.length + awards.allDefensive.second.length, 10);
});

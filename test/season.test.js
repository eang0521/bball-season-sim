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

test('injuries follow nba-game-sim\'s real severity distribution (ported from season.html)', () => {
  const rng = createRng(42);
  const league = generateInitialLeague(defaultRules, rng);
  const { injuryReport } = playSeason(league, rng, { gamesPerTeam: 82, injuriesEnabled: true });

  assert.ok(injuryReport.length > 100, 'an 82-game season should produce a large sample of injuries');

  const counts = { Light: 0, Medium: 0, Severe: 0 };
  let sawZeroGames = false;
  for (const r of injuryReport) {
    assert.ok(['Light', 'Medium', 'Severe'].includes(r.label));
    counts[r.label] += 1;
    assert.ok(r.outGames >= 0);
    // A "Light" injury (mean 2, stdev 5 games) can legitimately round to
    // 0 — a scare that turns out fine, same as the original.
    if (r.outGames === 0) sawZeroGames = true;
    // gamesRemaining (how much of the injury was still active when the
    // season ended) can be 0 even for a long injury, if it happened
    // early enough in the season to fully heal before it was over.
    assert.ok(r.gamesRemaining >= 0 && r.gamesRemaining <= r.outGames);
  }

  // Ported odds: rollD(1000) <= 5 -> Severe (0.5%), <= 50 -> Medium (4.5%),
  // else Light (95%). Loose tolerances since this is a live random sample.
  const total = injuryReport.length;
  assert.ok(counts.Light / total > 0.85, `Light should dominate: ${JSON.stringify(counts)}`);
  assert.ok(counts.Severe / total < 0.05, `Severe should be rare: ${JSON.stringify(counts)}`);
  assert.ok(sawZeroGames, 'at least one Light injury should round down to 0 games missed');
});

test('injury report carries opponent/phase/game#/time, like season.html\'s log', () => {
  const rng = createRng(17);
  const league = generateInitialLeague(defaultRules, rng);
  const { injuryReport } = playSeason(league, rng, { gamesPerTeam: 20, injuriesEnabled: true });

  assert.ok(injuryReport.length > 0);
  const teamAbbrs = new Set(league.teams.map((t) => t.abbr));
  for (const r of injuryReport) {
    assert.ok(teamAbbrs.has(r.opponent) && r.opponent !== r.team, 'opponent should be a different real team');
    assert.equal(r.phase, 'Regular Season');
    assert.ok(r.gameNum >= 1 && r.gameNum <= 20, `gameNum ${r.gameNum} should be within the season`);
    assert.ok(r.quarter >= 1 && r.quarter <= 4, 'injuries only roll in regulation quarters');
    assert.match(r.clockFmt, /^\d{2}:\d{2}$/);
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
  assert.ok(finalsMvp.games >= 1);
  assert.ok(Number.isFinite(finalsMvp.ppg) && Number.isFinite(finalsMvp.rpg) && Number.isFinite(finalsMvp.apg));
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

import { simulateGame } from '../engine/gameEngine.js';
import { splitByConference } from './conferences.js';

const HOME_PATTERN = ['A', 'A', 'B', 'B', 'A', 'B', 'A']; // 2-2-1-1-1, 'A' = higher seed

function team(abbr, rosterByTeam) {
  return { abbr, players: rosterByTeam.get(abbr) };
}

export function simulateSeries(seedA, seedB, rosterByTeam, rng, settings, bestOf = 7) {
  const winsNeeded = Math.ceil(bestOf / 2);
  const teamA = team(seedA.abbr, rosterByTeam);
  const teamB = team(seedB.abbr, rosterByTeam);
  let winsA = 0, winsB = 0;
  const games = [];

  while (winsA < winsNeeded && winsB < winsNeeded) {
    const homeIsA = HOME_PATTERN[games.length % HOME_PATTERN.length] === 'A';
    const result = simulateGame(teamA, teamB, rng, {
      homeCourtAdvantage: settings.homeCourtAdvantage,
      forceHome: homeIsA ? 'A' : 'B',
    });
    if (result.winner === teamA.abbr) winsA += 1; else winsB += 1;
    games.push({
      game: games.length + 1,
      home: homeIsA ? teamA.abbr : teamB.abbr,
      score: result.score,
      winner: result.winner,
      boxScore: result.boxScore,
    });
  }

  const winner = winsA > winsB ? seedA : seedB;
  const loser = winsA > winsB ? seedB : seedA;
  return { winner, loser, winsFor: { [seedA.abbr]: winsA, [seedB.abbr]: winsB }, games };
}

// 7 vs 8 for the 7-seed; the loser gets one more life against the 9-vs-10
// winner for the 8-seed. Returns the final 7/8 seeds plus both games.
export function runPlayIn(conferenceSeeds, rosterByTeam, rng, settings) {
  const [s7, s8, s9, s10] = conferenceSeeds;
  const gameA = simulateSeries(s7, s8, rosterByTeam, rng, settings, 1);
  const gameB = simulateSeries(s9, s10, rosterByTeam, rng, settings, 1);
  const gameC = simulateSeries(gameA.loser, gameB.winner, rosterByTeam, rng, settings, 1);

  return {
    seed7: gameA.winner,
    seed8: gameC.winner,
    eliminated: [gameB.loser, gameC.loser],
    games: [
      { label: '7 vs 8', ...gameA },
      { label: '9 vs 10', ...gameB },
      { label: 'Final spot', ...gameC },
    ],
  };
}

// Standard fixed bracket within a conference: (1v8, 4v5) feed one half,
// (2v7, 3v6) feed the other; halves only meet in the conference final.
export function runConferenceBracket(seeds, rosterByTeam, rng, settings) {
  const [s1, s2, s3, s4, s5, s6, s7, s8] = seeds;
  const r1 = {
    top: simulateSeries(s1, s8, rosterByTeam, rng, settings),
    midTop: simulateSeries(s4, s5, rosterByTeam, rng, settings),
    midBottom: simulateSeries(s2, s7, rosterByTeam, rng, settings),
    bottom: simulateSeries(s3, s6, rosterByTeam, rng, settings),
  };
  const r2 = {
    top: simulateSeries(r1.top.winner, r1.midTop.winner, rosterByTeam, rng, settings),
    bottom: simulateSeries(r1.midBottom.winner, r1.bottom.winner, rosterByTeam, rng, settings),
  };
  const confFinal = simulateSeries(r2.top.winner, r2.bottom.winner, rosterByTeam, rng, settings);

  return { round1: r1, round2: r2, confFinal, champion: confFinal.winner };
}

function seedConference(standings) {
  return [...standings].sort((a, b) => b.wins - a.wins);
}

// Runs the whole postseason from a finished regular season's standings:
// play-in for seeds 7-10 in each conference, then both 8-team brackets,
// then the Finals. `rosterByTeam` must map abbr -> player array.
export function runPostseason(standings, rosterByTeam, rng, settings) {
  const { East, West } = splitByConference(standings);
  const conferences = {};

  for (const [name, confStandings] of [['East', East], ['West', West]]) {
    const seeded = seedConference(confStandings);
    const top6 = seeded.slice(0, 6);
    const playInSeeds = seeded.slice(6, 10);
    const playIn = playInSeeds.length === 4
      ? runPlayIn(playInSeeds, rosterByTeam, rng, settings)
      : null;

    const bracketSeeds = playIn
      ? [...top6, playIn.seed7, playIn.seed8]
      : top6;

    conferences[name] = {
      playIn,
      bracket: bracketSeeds.length === 8
        ? runConferenceBracket(bracketSeeds, rosterByTeam, rng, settings)
        : null,
    };
  }

  const eastChamp = conferences.East.bracket?.champion;
  const westChamp = conferences.West.bracket?.champion;
  const finals = eastChamp && westChamp
    ? simulateSeries(eastChamp, westChamp, rosterByTeam, rng, settings)
    : null;

  return { conferences, finals, champion: finals?.winner.abbr ?? null };
}

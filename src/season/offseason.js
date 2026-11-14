// Turns one season's final roster into next season's opening-day roster:
// retirements, free agency, aging/development, contract renewals, and
// drafting enough rookies to replace whoever retired. See
// /docs/SEASON-RULES.md for the rules this encodes.
import { randInt } from './rng.js';
import { advanceOnePeriod } from './progression.js';
import { generateProspect } from './rookies.js';
import { matchFreeAgentsToTeams } from './freeAgency.js';
import { renewContract } from './contracts.js';

function rollsRetirement(player, rules, rng) {
  const roll = randInt(rng, 1, rules.retirement.rollDieSides) * rules.retirement.rollMultiplier;
  return roll > player.overall && player.overall > player.potential;
}

function rollsFreeAgency(player, teamWins, rules, rng) {
  if (player.yearsLeft !== 1) return false;
  const roll = randInt(rng, rules.freeAgency.rollMin, rules.freeAgency.rollMax);
  return roll > Math.min(rules.freeAgency.winCap, teamWins);
}

function sumByTeam(players, select) {
  const totals = new Map();
  for (const player of players) {
    totals.set(player.team, (totals.get(player.team) || 0) + select(player));
  }
  return totals;
}

function applyAgingAndContract(player, rules, rng) {
  const aged = advanceOnePeriod(player, rules, rng);
  if (player.yearsLeft === 1) {
    const { salary, yearsLeft } = renewContract(aged, rules, rng);
    return { ...aged, salary, yearsLeft };
  }
  return { ...aged, yearsLeft: player.yearsLeft - 1 };
}

export function runOffseason(league, rules, rng) {
  const payrollByTeam = sumByTeam(league.players, (p) => p.salary);
  const winsByTeam = new Map(league.teams.map((t) => [t.abbr, t.wins]));

  const retirees = [];
  const nonRetirees = [];
  for (const player of league.players) {
    if (rollsRetirement(player, rules, rng)) retirees.push(player);
    else nonRetirees.push(player);
  }

  const departures = [];
  const stayers = [];
  for (const player of nonRetirees) {
    if (rollsFreeAgency(player, winsByTeam.get(player.team), rules, rng)) departures.push(player);
    else stayers.push(player);
  }

  let nextId = Math.max(0, ...league.players.map((p) => p.id)) + 1;
  const rookies = [];
  for (let i = 0; i < retirees.length; i++) {
    rookies.push(generateProspect(nextId++, rules, rng));
  }

  const openings = [
    ...retirees.map((p) => ({ team: p.team })),
    ...departures.map((p) => ({ team: p.team })),
  ];
  const assignments = matchFreeAgentsToTeams([...departures, ...rookies], openings, payrollByTeam);

  const newStayers = stayers.map((player) => ({
    ...applyAgingAndContract(player, rules, rng),
    yearsWithTeam: player.yearsWithTeam + 1,
  }));

  const newDepartures = departures.map((player) => ({
    ...applyAgingAndContract(player, rules, rng),
    team: assignments.get(player.id) ?? player.team,
    yearsWithTeam: 1,
  }));

  // Rookies are evaluated, ranked against the rest of the free-agent pool
  // (matchFreeAgentsToTeams above runs on `rookies` as generated — i.e.
  // their draft-evaluation Potential, before any of this), and assigned a
  // team at their generated age (18-21, see rookies.js). Only after that
  // do they age/develop/sign their first real contract exactly like any
  // other free agent landing on a new team — so their first season is
  // played a year older (19-22) than the age they were drafted at, and
  // under a Potential that's already moved on from the one they were
  // drafted/ranked by. `draftPotential` keeps that original value around
  // for anyone who wants to show "how good this class looked on draft day".
  const newRookies = rookies.map((player) => ({
    ...applyAgingAndContract(player, rules, rng),
    draftPotential: player.potential,
    team: assignments.get(player.id) ?? null,
    yearsWithTeam: 1,
    isRookieEntry: undefined,
  }));

  return {
    players: [...newStayers, ...newDepartures, ...newRookies],
    retirees,
    draftees: newRookies,
    freeAgentMoves: newDepartures,
  };
}

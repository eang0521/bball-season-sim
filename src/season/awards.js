// Heuristic season awards from accumulated stat lines (see stats.js) and
// each player's underlying ratings. This is NOT a port of nba-game-sim's
// own awards voting (that source wasn't available) — it's a reasonable
// approximation built from the same category shape (MVP, DPOY, ROY,
// 6MOY, All-NBA/-Defensive/-Rookie, Finals MVP).
import { statSummary } from './stats.js';

const MIN_GAMES_FRACTION = 0.5;

function ratingsById(players) {
  return new Map(players.map((p) => [p.id, p]));
}

function eligible(lines, gamesPerTeam) {
  const minGames = Math.max(1, Math.round(gamesPerTeam * MIN_GAMES_FRACTION));
  return lines.filter((l) => l.games >= minGames);
}

function winPctByTeam(standings) {
  const map = new Map();
  for (const t of standings) map.set(t.abbr, t.gamesPlayed > 0 ? t.wins / t.gamesPlayed : 0);
  return map;
}

export function computeAwards(seasonStats, standings, players, rookieIds, gamesPerTeam) {
  const summaries = eligible(seasonStats, gamesPerTeam).map(statSummary);
  const ratings = ratingsById(players);
  const winPct = winPctByTeam(standings);

  const mvpScore = (s) =>
    (s.ppg + 1.2 * s.rpg + 1.5 * s.apg + 2 * s.spg + 2 * s.bpg) *
    (0.6 + 0.4 * (winPct.get(s.team) ?? 0.5));
  const dpoyScore = (s) => s.spg * 2 + s.bpg * 2 + (ratings.get(s.id)?.ratings.def ?? 0) * 0.1;
  const sixManScore = (s) => s.ppg + 0.5 * s.rpg + 0.5 * s.apg;

  const byMvp = [...summaries].sort((a, b) => mvpScore(b) - mvpScore(a));
  const byDpoy = [...summaries].sort((a, b) => dpoyScore(b) - dpoyScore(a));
  const rookies = summaries.filter((s) => rookieIds.has(s.id));
  const byRoy = [...rookies].sort((a, b) => mvpScore(b) - mvpScore(a));
  // Approximate "didn't start" as "not already a top-10 MVP-ladder player" —
  // the stat line itself doesn't record starter/bench status.
  const topTenIds = new Set(byMvp.slice(0, 10).map((s) => s.id));
  const bySixMan = summaries
    .filter((s) => !topTenIds.has(s.id))
    .sort((a, b) => sixManScore(b) - sixManScore(a));

  const take = (arr, n, offset = 0) => arr.slice(offset, offset + n);

  return {
    mvp: byMvp[0] ?? null,
    dpoy: byDpoy[0] ?? null,
    roy: byRoy[0] ?? null,
    sixthManOfTheYear: bySixMan[0] ?? null,
    allNba: {
      first: take(byMvp, 5),
      second: take(byMvp, 5, 5),
      third: take(byMvp, 5, 10),
    },
    allDefensive: {
      first: take(byDpoy, 5),
      second: take(byDpoy, 5, 5),
    },
    allRookie: {
      first: take(byRoy, 5),
      second: take(byRoy, 5, 5),
    },
  };
}

export function computeFinalsMvp(finalsSeries, players) {
  if (!finalsSeries) return null;
  const nameToPlayer = new Map(players.map((p) => [`${p.team}|${p.name}`, p]));
  const totals = new Map(); // "team|name" -> { name, team, games, pts, reb, ast }

  for (const game of finalsSeries.games) {
    for (const [abbr, box] of Object.entries(game.boxScore)) {
      for (const line of box) {
        if (line.sec <= 0) continue;
        const key = `${abbr}|${line.name}`;
        const line_ = totals.get(key) ?? { name: line.name, team: abbr, games: 0, pts: 0, reb: 0, ast: 0 };
        line_.games += 1;
        line_.pts += line.pts;
        line_.reb += line.reb;
        line_.ast += line.ast;
        totals.set(key, line_);
      }
    }
  }

  const championAbbr = finalsSeries.winner.abbr;
  const candidates = [...totals.values()]
    .filter((v) => v.team === championAbbr)
    .sort((a, b) => (b.pts + 0.7 * b.reb + b.ast) - (a.pts + 0.7 * a.reb + a.ast));

  if (!candidates.length) return null;
  const best = candidates[0];
  const player = nameToPlayer.get(`${best.team}|${best.name}`);
  return {
    id: player?.id,
    name: best.name,
    team: best.team,
    games: best.games,
    ppg: best.games > 0 ? best.pts / best.games : 0,
    rpg: best.games > 0 ? best.reb / best.games : 0,
    apg: best.games > 0 ? best.ast / best.games : 0,
  };
}

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
  const totals = new Map();

  for (const game of finalsSeries.games) {
    for (const [abbr, box] of Object.entries(game.boxScore)) {
      for (const line of box) {
        const key = `${abbr}|${line.name}`;
        const score = (totals.get(key)?.score ?? 0) + line.pts + 0.7 * line.reb + line.ast;
        totals.set(key, { score, name: line.name, team: abbr });
      }
    }
  }

  const championAbbr = finalsSeries.winner.abbr;
  const candidates = [...totals.entries()]
    .filter(([, v]) => v.team === championAbbr)
    .sort((a, b) => b[1].score - a[1].score);

  if (!candidates.length) return null;
  const [key, value] = candidates[0];
  const player = nameToPlayer.get(key);
  return { id: player?.id, name: value.name, team: value.team };
}

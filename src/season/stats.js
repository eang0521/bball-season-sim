// Accumulates per-player season totals from each game's box score
// (keyed by team+name, since that's all the engine's box score carries).
export function createStatAccumulator(players) {
  const acc = new Map();
  for (const p of players) {
    acc.set(`${p.team}|${p.name}`, {
      id: p.id, name: p.name, team: p.team,
      games: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, pf: 0,
      fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, pm: 0,
    });
  }
  return acc;
}

export function addGameBoxScore(acc, boxScore, teamAbbr) {
  for (const p of boxScore) {
    if (p.sec <= 0) continue;
    const line = acc.get(`${teamAbbr}|${p.name}`);
    if (!line) continue;
    line.games += 1;
    line.pts += p.pts; line.reb += p.reb; line.ast += p.ast;
    line.stl += p.stl; line.blk += p.blk; line.pf += p.pf;
    line.fgm += p.fgm; line.fga += p.fga;
    line.tpm += p.tpm; line.tpa += p.tpa;
    line.ftm += p.ftm; line.fta += p.fta;
    line.pm += p.pm;
  }
}

export function perGame(line, key) {
  return line.games > 0 ? line[key] / line.games : 0;
}

export function statSummary(line) {
  return {
    id: line.id, name: line.name, team: line.team, games: line.games,
    ppg: perGame(line, 'pts'), rpg: perGame(line, 'reb'), apg: perGame(line, 'ast'),
    spg: perGame(line, 'stl'), bpg: perGame(line, 'blk'), pmpg: perGame(line, 'pm'),
    fgPct: line.fga > 0 ? line.fgm / line.fga : 0,
    tpPct: line.tpa > 0 ? line.tpm / line.tpa : 0,
    ftPct: line.fta > 0 ? line.ftm / line.fta : 0,
  };
}

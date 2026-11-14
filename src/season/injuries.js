// Season-level bookkeeping around the engine's own injury rolls (see
// rollInjuries/checkInjuries/applyInjury in ../engine/gameEngine.js,
// ported from nba-game-sim's season.html). The engine decides WHO gets
// hurt, how badly, and for how long during a given game; this just
// tracks who's still out afterward, mirroring season.html's
// isAvailable()/decrementInjuries() exactly.
export function createInjuryTracker() {
  const playerInjuries = new Map(); // "team|name" -> { gamesRemaining, severity }
  const report = []; // { id, name, team, label, outGames }

  function isAvailable(p) {
    const inj = playerInjuries.get(`${p.team}|${p.name}`);
    return !inj || inj.gamesRemaining <= 0;
  }

  // Same shape as season.html's roster filtering, plus a safety net it
  // doesn't need: if injuries have genuinely dropped a team below 5
  // available, field the full roster rather than crash short-handed.
  function filterAvailable(roster) {
    const healthy = roster.filter(isAvailable);
    return healthy.length >= 5 ? healthy : roster;
  }

  function decrement(roster) {
    for (const p of roster) {
      const key = `${p.team}|${p.name}`;
      const inj = playerInjuries.get(key);
      if (!inj) continue;
      inj.gamesRemaining -= 1;
      if (inj.gamesRemaining <= 0) playerInjuries.delete(key);
    }
  }

  // `events` is a game's simulateGame() result.injuryEvents; `idByName`
  // maps "team|name" -> player id, for the report the UI reads.
  // `gameNumByTeam` and `phase` describe which game this was for each
  // side, matching season.html's Opponent / Phase (Game #) / Time columns.
  function recordEvents(events, idByName, gameNumByTeam, phase) {
    for (const evt of events) {
      const key = `${evt.team}|${evt.name}`;
      playerInjuries.set(key, { gamesRemaining: evt.games, severity: evt.severity });
      report.push({
        id: idByName.get(key),
        name: evt.name,
        team: evt.team,
        opponent: evt.opponent,
        phase,
        gameNum: gameNumByTeam[evt.team],
        quarter: evt.quarter,
        clockFmt: evt.clockFmt,
        label: evt.severity,
        outGames: evt.games,
      });
    }
  }

  // Call once, after the season's last game, to attach each report
  // entry's final "still out" count. A player can be injured more than
  // once in a season (fully healing in between — a new injury can't be
  // assigned while an old one is still active), so the live map state
  // belongs only to each player's most recent entry; earlier ones are
  // already fully resolved by construction.
  function finalize() {
    const seenKey = new Set();
    const result = new Array(report.length);
    for (let i = report.length - 1; i >= 0; i--) {
      const r = report[i];
      const key = `${r.team}|${r.name}`;
      const isLatest = !seenKey.has(key);
      seenKey.add(key);
      result[i] = { ...r, gamesRemaining: isLatest ? (playerInjuries.get(key)?.gamesRemaining ?? 0) : 0 };
    }
    return result;
  }

  return { filterAvailable, decrement, recordEvents, finalize };
}

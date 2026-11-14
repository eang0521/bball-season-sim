// Ported from nba-game-sim's `live.html` (`class Player`, `class Team`,
// `class Game`, `applyHomeBonus`, `rollD`) — the possession-by-possession
// engine described in ../../../nba-game-sim/RULEBOOK.md. The port is
// verbatim logic, just stripped of the DOM/animation code that drove the
// browser replay (setTimeout pacing, box-score rendering, logo lookups).
// `Game.log()` still records a full timeline in memory (unchanged), so a
// single game's play-by-play and snapshots stay available if a caller
// wants them (see simulateGame's `includeTimeline` option).

function rollD(sides, num = 1) {
  let t = 0;
  for (let i = 0; i < num; i++) t += Math.floor(Math.random() * sides) + 1;
  return t;
}

export class Player {
  constructor(name, t_2pt, t_3pt, t_def, t_reb) {
    this.name = name;
    this.t_2pt = t_2pt; this.t_3pt = t_3pt;
    this.t_def = t_def; this.t_reb = t_reb;
    this.ovr = t_2pt + t_3pt + t_def + t_reb;
    this.pv = t_reb - t_3pt + 0.01 * t_2pt + 0.0001 * t_def;
    this.off = t_2pt + t_3pt + 0.01 * this.ovr;
    this.ft_chance = Math.max(1, Math.min(90, Math.round(50 + t_2pt * 0.4 + t_3pt * 1.0)));
    this.seconds_played = 0; this.points = 0;
    this.fg_made = 0; this.fg_attempted = 0;
    this.tpt_made = 0; this.tpt_attempted = 0;
    this.ft_made = 0; this.ft_attempted = 0;
    this.rebounds = 0; this.assists = 0;
    this.steals = 0; this.blocks = 0;
    this.fouls = 0; this.plus_minus = 0;
    this.on_court = false;
    this.fouled_out = false;
    this.positions_played = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    this.current_position = null;
    this.team_ref = null;
  }

  primaryPos() {
    const total = Object.values(this.positions_played).reduce((a, b) => a + b, 0);
    if (!total) return 'BN';
    let best = 1;
    for (let i = 2; i <= 5; i++)
      if (this.positions_played[i] > this.positions_played[best]) best = i;
    return ['PG', 'SG', 'SF', 'PF', 'C'][best - 1];
  }
}

export class Team {
  constructor(abbr, playerData) {
    this.abbr = abbr;
    this.players = playerData.map((p) => new Player(p.name, p.t_2pt, p.t_3pt, p.t_def, p.t_reb));
    this.score = 0;
    this.court = [];
    this.defensive_fouls_qtr = 0;
    this.foul_in_last_2_mins = false;
  }

  byPv() {
    const s = [...this.court].sort((a, b) => a.pv - b.pv);
    s.forEach((p, i) => { p.current_position = i + 1; });
    return s;
  }

  byOff() { return [...this.court].sort((a, b) => b.off - a.off); }
}

export function applyHomeBonus(team) {
  team.players.forEach((p) => {
    p.t_2pt += 1; p.t_3pt += 1; p.t_def += 1; p.t_reb += 1;
    p.ovr = p.t_2pt + p.t_3pt + p.t_def + p.t_reb;
    p.pv = p.t_reb - p.t_3pt + 0.01 * p.t_2pt + 0.0001 * p.t_def;
    p.off = p.t_2pt + p.t_3pt + 0.01 * p.ovr;
    p.ft_chance = Math.max(1, Math.min(90, Math.round(50 + p.t_2pt * 0.4 + p.t_3pt * 1.0)));
  });
}

export class Game {
  constructor(t1, t2) {
    this.t1 = t1; this.t2 = t2;
    this.quarter = 0; this.clock = 0;
    this.possession = null; this.jumpball_winner = null;
    this.subs_waiting = false;
    this.t1_q_scores = []; this.t2_q_scores = [];
    this.t1_last = 0; this.t2_last = 0;
    this.logs = {};
    this.timeline = [];
  }

  fmt() {
    const m = Math.floor(this.clock / 60), s = this.clock % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  snap(team) {
    const onCourt = [...team.court].sort((a, b) => a.pv - b.pv);
    const posMap = {};
    onCourt.forEach((p, i) => { posMap[p.name] = i + 1; });
    return team.players.map((p) => ({
      name: p.name, on_court: p.on_court, pos: posMap[p.name] || 0,
      pts: p.points, reb: p.rebounds, ast: p.assists,
      stl: p.steals, blk: p.blocks, pf: p.fouls,
      fgm: p.fg_made, fga: p.fg_attempted,
      tpm: p.tpt_made, tpa: p.tpt_attempted,
      ftm: p.ft_made, fta: p.ft_attempted,
      sec: p.seconds_played, pm: p.plus_minus,
    }));
  }

  log(msg) {
    const scored = msg.includes('makes') || msg.includes('scores');
    const tag = scored ? ` [${this.t1.abbr} ${this.t1.score} – ${this.t2.abbr} ${this.t2.score}]` : '';
    if (!this.logs[this.quarter]) this.logs[this.quarter] = [];
    const line = `${this.fmt()} ${msg}${tag}`.trim();
    this.logs[this.quarter].push(line);
    this.timeline.push({
      quarter: this.quarter,
      clockFmt: this.fmt(),
      text: line,
      t1Score: this.t1.score,
      t2Score: this.t2.score,
      t1Snap: this.snap(this.t1),
      t2Snap: this.snap(this.t2),
    });
  }

  pm(scoringTeam, pts) {
    const other = scoringTeam === this.t1 ? this.t2 : this.t1;
    scoringTeam.court.forEach((p) => { p.plus_minus += pts; });
    other.court.forEach((p) => { p.plus_minus -= pts; });
  }

  startLineups() {
    for (const team of [this.t1, this.t2]) {
      team.court = [];
      team.players.forEach((p) => { p.on_court = false; });
      for (let s = 0; s < 5; s++) {
        let bench = [...team.players]
          .filter((p) => !p.on_court && !p.fouled_out)
          .sort((a, b) => b.ovr - a.ovr);
        // A team can't take the court with fewer than 5 — if fouls have
        // exhausted everyone else (rare, but reachable over enough
        // simulated games), the least-disqualified player has to play on.
        if (!bench.length) {
          bench = [...team.players]
            .filter((p) => !p.on_court)
            .sort((a, b) => a.fouls - b.fouls || b.ovr - a.ovr);
        }
        if (!bench.length) break;
        const r = rollD(20);
        const idx = r <= 6 ? 0
          : r <= 11 ? Math.min(1, bench.length - 1)
          : r <= 15 ? Math.min(2, bench.length - 1)
          : r <= 18 ? Math.min(3, bench.length - 1)
          : Math.min(4, bench.length - 1);
        bench[idx].on_court = true;
        team.court.push(bench[idx]);
      }
    }
  }

  thresh(roll, sz) {
    const t = sz >= 5 ? [6, 11, 15, 18, 20]
      : sz === 4 ? [8, 14, 18, 20]
      : sz === 3 ? [9, 16, 20]
      : sz === 2 ? [13, 20] : [20];
    for (let i = 0; i < t.length; i++) if (roll <= t[i]) return i;
    return t.length - 1;
  }

  subs(ftShooter = null, forced = []) {
    for (const team of [this.t1, this.t2]) {
      const forcedTeam = forced.filter((p) => team.players.includes(p) && p.on_court);
      if (!this.subs_waiting && !forcedTeam.length) continue;
      let n = (forcedTeam.length && !this.subs_waiting)
        ? 1
        : Math.min(5, this.thresh(rollD(20), 5) + 1);
      n = Math.max(n, forcedTeam.length);
      const courtPool = [...team.court].sort((a, b) => a.ovr - b.ovr);
      const initBench = team.players.filter((p) => !p.on_court && !p.fouled_out);
      const maxSubs = Math.min(n, courtPool.length, initBench.length);
      const outList = [], inList = [];
      for (let i = 0; i < maxSubs; i++) {
        let outP;
        if (i < forcedTeam.length) {
          outP = forcedTeam[i];
        } else {
          const validOut = courtPool.filter((p) => !outList.includes(p) && p !== ftShooter);
          if (!validOut.length) break;
          outP = validOut[this.thresh(rollD(20), validOut.length)];
        }
        const validIn = [...team.players]
          .filter((p) => !p.on_court && !p.fouled_out && !inList.includes(p))
          .sort((a, b) => b.ovr - a.ovr).slice(0, 5);
        if (!validIn.length) break;
        let idxIn = this.thresh(rollD(20), 5);
        idxIn = Math.min(idxIn, validIn.length - 1);
        outList.push(outP);
        inList.push(validIn[idxIn]);
      }
      for (let i = 0; i < outList.length; i++) {
        const op = outList[i], ip = inList[i];
        op.on_court = false;
        team.court = team.court.filter((p) => p !== op);
        ip.on_court = true;
        team.court.push(ip);
        this.log(`SUB: ${ip.name} in for ${op.name}`);
      }
    }
    this.subs_waiting = false;
    this.t1.byPv();
    this.t2.byPv();
  }

  tick(dice) {
    const t = rollD(6, dice);
    this.clock = Math.max(0, this.clock - t);
    for (const team of [this.t1, this.t2])
      for (const p of team.court) {
        p.seconds_played += t;
        if (p.current_position) p.positions_played[p.current_position] += t;
      }
    return this.clock > 0;
  }

  bonus(defTeam) {
    return defTeam.defensive_fouls_qtr >= 4
      || (this.clock <= 120 && defTeam.foul_in_last_2_mins);
  }

  foulOn(player) {
    player.fouls++;
    const f = [];
    if (player.fouls >= 6) {
      player.fouled_out = true; f.push(player);
      this.log(`${player.name} fouled out!`);
    } else if (player.fouls >= this.quarter + 2) {
      f.push(player);
      this.log(`${player.name} is in foul trouble (${player.fouls} fouls) and must sub out.`);
    }
    return f;
  }

  fts(shooter, n) {
    if (!n) return true;
    let madeLast = false;
    for (let i = 0; i < n; i++) {
      shooter.ft_attempted++;
      if (rollD(100) <= shooter.ft_chance) {
        shooter.points++; shooter.ft_made++;
        shooter.team_ref.score++;
        this.pm(shooter.team_ref, 1);
        this.log(`${shooter.name} makes free throw ${i + 1}/${n}`);
        madeLast = (i === n - 1);
      } else {
        this.log(`${shooter.name} misses free throw ${i + 1}/${n}`);
        if (i === n - 1) madeLast = false;
      }
    }
    return madeLast;
  }

  assist(offPv, shooter) {
    const r = rollD(100);
    let idx = -1;
    if (r <= 24) idx = 0; else if (r <= 42) idx = 1;
    else if (r <= 54) idx = 2; else if (r <= 60) idx = 3;
    if (idx >= 0) {
      const mates = offPv.filter((p) => p !== shooter);
      if (idx < mates.length) { mates[idx].assists++; return mates[idx]; }
    }
    return null;
  }

  rebCycle(offTeam, defTeam, skipped) {
    const offPv = offTeam.byPv();
    const defPv = defTeam.byPv();
    let cycle = 1;
    while (this.clock > 0) {
      const order = [...defPv].reverse().concat([...offPv].reverse());
      let grabbed = false;
      for (const p of order) {
        if (cycle === 1 && p === skipped) continue;
        const rating = Math.max(1, p.t_reb) + (cycle === 1 && defPv.includes(p) ? 3 : 0);
        if (rollD(100) <= rating) {
          p.rebounds++;
          this.log(`${p.name} Rebound`);
          if (defPv.includes(p)) {
            this.possession = defTeam;
          } else {
            this.possession = offTeam;
            this.poss(2);
          }
          grabbed = true; break;
        }
      }
      if (grabbed) break;
      this.clock--; cycle++;
    }
  }

  poss(dice = 4) {
    if (this.clock <= 0) return;
    if (!this.tick(dice)) return;
    const off = this.possession;
    const def = off === this.t1 ? this.t2 : this.t1;
    off.court.forEach((p) => { p.team_ref = off; });
    def.court.forEach((p) => { p.team_ref = def; });
    let ev = rollD(6);
    const offPv = off.byPv();
    const defPv = def.byPv();

    if (ev === 1) {
      let stolen = false;
      for (const d of defPv) {
        if (rollD(100) <= Math.max(1, d.t_def)) {
          d.steals++; this.log(`${d.name} Steal`);
          this.possession = def; stolen = true; break;
        }
      }
      if (stolen) return;
      ev = Math.floor(Math.random() * 4) + 3;
    }

    if (ev === 2) {
      const foulType = rollD(10);
      const foulPos = Math.floor((rollD(10) - 1) / 2);
      if (foulType === 1) {
        const fouler = offPv[foulPos];
        const forced = this.foulOn(fouler);
        this.log(`${fouler.name} offensive foul`);
        if (this.bonus(off)) {
          const shooter = def.court[Math.floor(Math.random() * def.court.length)];
          this.subs(shooter, forced);
          if (!this.fts(shooter, 2)) this.rebCycle(def, off, shooter);
          else this.possession = off;
        } else {
          this.subs(null, forced);
          this.possession = def;
        }
      } else {
        const fouler = defPv[foulPos];
        const forced = this.foulOn(fouler);
        def.defensive_fouls_qtr++;
        if (this.clock <= 120) def.foul_in_last_2_mins = true;
        if (foulType <= 6) {
          this.log(`${fouler.name} defensive foul`);
          if (this.bonus(def)) {
            const shooter = off.court[Math.floor(Math.random() * off.court.length)];
            this.subs(shooter, forced);
            if (!this.fts(shooter, 2)) this.rebCycle(off, def, shooter);
            else this.possession = def;
          } else {
            this.subs(null, forced);
            this.poss(2);
          }
        } else {
          this.log(`${fouler.name} shooting foul`);
          const offOff = off.byOff();
          const shooter = offOff[this.thresh(rollD(20), 5)];
          const s2 = Math.max(1, shooter.t_2pt), s3 = Math.max(1, shooter.t_3pt);
          const ratio = Math.round((s2 * 3) / ((s2 * 3) + (s3 * 2)) * 100);
          let is2 = rollD(100) <= ratio;
          if (!is2 && rollD(6) <= 4) is2 = true;
          const pts = is2 ? 2 : 3;
          const defender = defPv[shooter.current_position - 1];
          const diff = (is2 ? shooter.t_2pt : shooter.t_3pt) - defender.t_def;
          const target = Math.round(diff * (is2 ? 2 / 3 : 0.5)) + (is2 ? 54 : 36);
          const m1 = rollD(100) <= target, m2 = rollD(100) <= target;
          if (m1 && m2) {
            shooter.fg_attempted++; shooter.fg_made++;
            if (!is2) { shooter.tpt_attempted++; shooter.tpt_made++; }
            shooter.points += pts; off.score += pts; this.pm(off, pts);
            const ast = this.assist(offPv, shooter);
            this.log(`${shooter.name} makes ${pts} (And-1!)${ast ? ` (${ast.name} Assist)` : ''}`);
            if (rollD(10) <= pts) this.subs_waiting = true;
            this.subs(shooter, forced);
            if (!this.fts(shooter, 1)) this.rebCycle(off, def, shooter);
            else this.possession = def;
          } else {
            this.log(`${shooter.name} misses ${pts} on foul`);
            this.subs(shooter, forced);
            if (!this.fts(shooter, pts)) this.rebCycle(off, def, shooter);
            else this.possession = def;
          }
        }
      }
      return;
    }

    const offOff = off.byOff();
    const shooter = offOff[this.thresh(rollD(20), 5)];
    const s2 = Math.max(1, shooter.t_2pt), s3 = Math.max(1, shooter.t_3pt);
    const ratio = Math.round((s2 * 3) / ((s2 * 3) + (s3 * 2)) * 100);
    const is2 = rollD(100) <= ratio;
    const pts = is2 ? 2 : 3;
    const defender = defPv[shooter.current_position - 1];
    const diff = (is2 ? shooter.t_2pt : shooter.t_3pt) - defender.t_def;
    const target = Math.round(diff * (is2 ? 2 / 3 : 0.5)) + (is2 ? 54 : 36);
    shooter.fg_attempted++;
    if (!is2) shooter.tpt_attempted++;
    if (rollD(100) <= target) {
      shooter.fg_made++;
      if (!is2) shooter.tpt_made++;
      shooter.points += pts; off.score += pts; this.pm(off, pts);
      const ast = this.assist(offPv, shooter);
      this.log(`${shooter.name} makes ${pts}${ast ? ` (${ast.name} Assist)` : ''}`);
      if (rollD(10) <= pts) this.subs_waiting = true;
      this.possession = def;
    } else {
      let blocked = false;
      if (rollD(100) <= Math.max(1, defender.t_def)) {
        if (rollD(6) <= defender.current_position + 1) {
          blocked = true; defender.blocks++;
          this.log(`${shooter.name} misses ${pts} (Blocked by ${defender.name}!)`);
        }
      }
      if (!blocked) this.log(`${shooter.name} misses ${pts}`);
      this.rebCycle(off, def, shooter);
    }
  }

  playQuarter(mins) {
    this.subs_waiting = false;
    this.clock = mins * 60;
    this.t1.defensive_fouls_qtr = 0; this.t2.defensive_fouls_qtr = 0;
    this.t1.foul_in_last_2_mins = false; this.t2.foul_in_last_2_mins = false;
    this.startLineups();
    this.t1.byPv(); this.t2.byPv();
    if (this.quarter === 1 || mins === 5) {
      const c1 = this.t1.byPv()[4], c2 = this.t2.byPv()[4];
      const r1 = Math.max(1, c1.t_reb), r2 = Math.max(1, c2.t_reb);
      if (rollD(r1 + r2) <= r1) {
        this.possession = this.t1;
        if (this.quarter === 1) this.jumpball_winner = this.t1;
        this.log(`${c1.name} wins the jumpball for ${this.t1.abbr}`);
      } else {
        this.possession = this.t2;
        if (this.quarter === 1) this.jumpball_winner = this.t2;
        this.log(`${c2.name} wins the jumpball for ${this.t2.abbr}`);
      }
    } else if (this.quarter === 2 || this.quarter === 3) {
      this.possession = this.jumpball_winner === this.t1 ? this.t2 : this.t1;
    } else {
      this.possession = this.jumpball_winner;
    }
    while (this.clock > 0) this.poss();
    this.t1_q_scores.push(this.t1.score - this.t1_last);
    this.t2_q_scores.push(this.t2.score - this.t2_last);
    this.t1_last = this.t1.score;
    this.t2_last = this.t2.score;
  }

  run() {
    for (let q = 1; q <= 4; q++) { this.quarter = q; this.playQuarter(12); }
    let ot = 1;
    while (this.t1.score === this.t2.score) {
      this.quarter = 4 + ot; this.playQuarter(5); ot++;
    }
  }
}

// ── Season-sim integration ──────────────────────────────────────────
// Bridges a season-sim team/roster (ratings: {twoPt,threePt,def,reb}) to
// the engine's Player/Team shape, runs a full game, and reports a result
// shaped for src/season/season.js — a winner/loser plus each side's score
// and box score. The real engine always draws from Math.random() (that's
// how nba-game-sim itself behaves), so game outcomes aren't seeded by the
// season RNG; only which side gets the home-court bonus is.
function toEngineRoster(players) {
  return players.map((p) => ({
    name: p.name,
    t_2pt: p.ratings.twoPt,
    t_3pt: p.ratings.threePt,
    t_def: p.ratings.def,
    t_reb: p.ratings.reb,
  }));
}

export function simulateGame(
  teamA,
  teamB,
  rng,
  { includeTimeline = false, homeCourtAdvantage = true, forceHome = null } = {},
) {
  const aIsHome = forceHome ? forceHome === 'A' : rng ? rng() < 0.5 : Math.random() < 0.5;
  const t1 = new Team(teamA.abbr, toEngineRoster(teamA.players));
  const t2 = new Team(teamB.abbr, toEngineRoster(teamB.players));
  if (homeCourtAdvantage) applyHomeBonus(aIsHome ? t1 : t2);

  const game = new Game(t1, t2);
  game.run();

  const winner = game.t1.score > game.t2.score ? teamA.abbr : teamB.abbr;
  const loser = winner === teamA.abbr ? teamB.abbr : teamA.abbr;

  return {
    winner,
    loser,
    home: aIsHome ? teamA.abbr : teamB.abbr,
    score: { [teamA.abbr]: game.t1.score, [teamB.abbr]: game.t2.score },
    boxScore: { [teamA.abbr]: game.snap(game.t1), [teamB.abbr]: game.snap(game.t2) },
    timeline: includeTimeline ? game.timeline : undefined,
  };
}

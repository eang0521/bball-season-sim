const modeSelect = document.getElementById('mode');
const seedInput = document.getElementById('seed');
const newLeagueBtn = document.getElementById('newLeagueBtn');
const simulateBtn = document.getElementById('simulateBtn');
const statusEl = document.getElementById('status');

const teamSelect = document.getElementById('teamSelect');
const rosterBody = document.getElementById('rosterBody');

let worker = null;
let latestRoster = [];
let history = [];
let currentLeaderCategory = 'ppg';

// ── Settings (persisted) ──────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  gamesPerTeam: 58,
  homeCourtAdvantage: true,
  ratingUncertainty: false,
  uncertaintyStdev: 3,
  injuriesEnabled: false,
  showLeaders: true,
  showAwards: true,
};
const SETTINGS_KEY = 'bballSeasonSimSettings';

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let latestSettings = loadSettings();

function applySettingsToUI(s) {
  document.getElementById('gamesPerTeam').value = s.gamesPerTeam;
  document.getElementById('homeCourtAdvantage').checked = s.homeCourtAdvantage;
  document.getElementById('ratingUncertainty').checked = s.ratingUncertainty;
  document.getElementById('uncertaintyStdev').value = s.uncertaintyStdev;
  document.getElementById('stdevVal').textContent = s.uncertaintyStdev;
  document.getElementById('stdevRow').style.display = s.ratingUncertainty ? '' : 'none';
  document.getElementById('injuriesEnabled').checked = s.injuriesEnabled;
  document.getElementById('showLeaders').checked = s.showLeaders;
  document.getElementById('showAwards').checked = s.showAwards;
}

let toastTimer = null;
function showToast() {
  const t = document.getElementById('toast');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
}

function saveSettings() {
  latestSettings = {
    gamesPerTeam: Math.max(1, Math.min(200, parseInt(document.getElementById('gamesPerTeam').value, 10) || 58)),
    homeCourtAdvantage: document.getElementById('homeCourtAdvantage').checked,
    ratingUncertainty: document.getElementById('ratingUncertainty').checked,
    uncertaintyStdev: parseInt(document.getElementById('uncertaintyStdev').value, 10),
    injuriesEnabled: document.getElementById('injuriesEnabled').checked,
    showLeaders: document.getElementById('showLeaders').checked,
    showAwards: document.getElementById('showAwards').checked,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(latestSettings));
  showToast();
}

applySettingsToUI(latestSettings);
document.getElementById('gamesPerTeam').addEventListener('change', saveSettings);
document.getElementById('homeCourtAdvantage').addEventListener('change', saveSettings);
document.getElementById('ratingUncertainty').addEventListener('change', function () {
  document.getElementById('stdevRow').style.display = this.checked ? '' : 'none';
  saveSettings();
});
document.getElementById('uncertaintyStdev').addEventListener('input', function () {
  document.getElementById('stdevVal').textContent = this.value;
  saveSettings();
});
document.getElementById('injuriesEnabled').addEventListener('change', saveSettings);
document.getElementById('showLeaders').addEventListener('change', saveSettings);
document.getElementById('showAwards').addEventListener('change', saveSettings);
document.getElementById('resetSettingsBtn').addEventListener('click', () => {
  localStorage.removeItem(SETTINGS_KEY);
  latestSettings = { ...DEFAULT_SETTINGS };
  applySettingsToUI(latestSettings);
  showToast();
});

// ── Tabs ────────────────────────────────────────────────────────────
document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === btn));
  document.querySelectorAll('.tab-panel').forEach((p) =>
    p.classList.toggle('active', p.id === `tab-${btn.dataset.tab}`),
  );
});

// ── Shared helpers ──────────────────────────────────────────────────
function setBusy(busy, label) {
  newLeagueBtn.disabled = busy;
  simulateBtn.disabled = busy || !worker;
  statusEl.textContent = label ?? '';
}

function pct(wins, losses) {
  const total = wins + losses;
  return total > 0 ? (wins / total).toFixed(3).replace(/^0/, '') : '.000';
}

function playerLine(p) {
  return `<li>${p.name} <span style="color:#748ffc">(${p.team}, age ${p.age}, OVR ${p.overall}, POT ${p.potential})</span></li>`;
}

// ── Standings ───────────────────────────────────────────────────────
function renderConferenceTable(tbodyId, teams) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = teams
    .map((t, i) => {
      const cls = i === 5 ? 'playoff-line' : i === 9 ? 'playin-line' : '';
      return `<tr class="${cls}"><td>${i + 1}</td><td>${t.abbr}</td><td>${t.wins}</td><td>${t.losses}</td><td>${pct(t.wins, t.losses)}</td></tr>`;
    })
    .join('');
}

function renderStandings(conferences) {
  document.getElementById('standingsPlaceholder').hidden = true;
  document.getElementById('standingsGrid').hidden = false;
  document.getElementById('standingsLegend').hidden = false;
  document.getElementById('standingsFooter').hidden = false;
  const eastSorted = [...conferences.East].sort((a, b) => b.wins - a.wins);
  const westSorted = [...conferences.West].sort((a, b) => b.wins - a.wins);
  renderConferenceTable('eastBody', eastSorted);
  renderConferenceTable('westBody', westSorted);
}

function renderOffseasonSummary({ retireeCount, draftedCount, retirees, draftees }) {
  document.getElementById('offseasonSummary').innerHTML = `
    <p>${retireeCount} retirements &rarr; ${draftedCount} rookies drafted.</p>
    <h4>Notable retirements</h4>
    <ul>${retirees.map(playerLine).join('') || '<li>None</li>'}</ul>
    <h4>Top draftees (by potential)</h4>
    <ul>${draftees.map(playerLine).join('') || '<li>None</li>'}</ul>
  `;
}

function renderHistory() {
  document.getElementById('historyList').innerHTML = history
    .map((h) => `<li><span>Season ${h.season}</span><span class="champ">${h.champion.abbr} (${h.champion.wins}-${h.losses})</span></li>`)
    .reverse()
    .join('');
}

// ── Leaders ─────────────────────────────────────────────────────────
function renderLeaderTabs(leaders) {
  const container = document.getElementById('leaderTabs');
  container.innerHTML = Object.entries(leaders)
    .map(([key, { label }]) => `<button class="btn leader-tab" data-key="${key}">${label}</button>`)
    .join('');
  container.querySelectorAll('.leader-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentLeaderCategory = btn.dataset.key;
      renderLeaderTable(leaders);
    });
  });
}

function formatLeaderValue(key, value) {
  return key === 'fgPct' || key === 'tpPct' ? `${(value * 100).toFixed(1)}%` : value.toFixed(1);
}

function renderLeaderTable(leaders) {
  const category = leaders[currentLeaderCategory] ? currentLeaderCategory : Object.keys(leaders)[0];
  const { label, top } = leaders[category];
  document.getElementById('leaderValueHeader').textContent = label;
  document.querySelectorAll('.leader-tab').forEach((b) => b.classList.toggle('primary', b.dataset.key === category));
  document.getElementById('leaderBody').innerHTML = top
    .map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.team}</td><td>${formatLeaderValue(category, p[category])}</td></tr>`)
    .join('');
}

function renderLeaders(leaders) {
  document.getElementById('leadersPlaceholder').hidden = true;
  document.getElementById('leadersContent').hidden = false;
  renderLeaderTabs(leaders);
  renderLeaderTable(leaders);
}

// ── Awards ──────────────────────────────────────────────────────────
function awardCard(title, player, extra = '') {
  if (!player) return `<div class="award-card"><div class="award-title">${title}</div><div class="award-name">—</div></div>`;
  return `<div class="award-card">
    <div class="award-title">${title}</div>
    <div class="award-name">${player.name}</div>
    <div class="award-meta">${player.team}${extra ? ` &middot; ${extra}` : ''}</div>
  </div>`;
}

function teamList(title, players) {
  return `<div><h3>${title}</h3><ol>${players.map((p) => `<li>${p.name} (${p.team})</li>`).join('') || '<li>None</li>'}</ol></div>`;
}

function renderAwards(awards, finalsMvp) {
  document.getElementById('awardsPlaceholder').hidden = true;
  const el = document.getElementById('awardsContent');
  el.hidden = false;
  el.innerHTML = `
    <div class="award-cards">
      ${awardCard('MVP', awards.mvp, awards.mvp ? `${awards.mvp.ppg.toFixed(1)} PPG` : '')}
      ${awardCard('Defensive Player of the Year', awards.dpoy)}
      ${awardCard('Rookie of the Year', awards.roy)}
      ${awardCard('Sixth Man of the Year', awards.sixthManOfTheYear)}
      ${awardCard('Finals MVP', finalsMvp)}
    </div>
    <div class="team-list-grid">
      ${teamList('All-NBA First Team', awards.allNba.first)}
      ${teamList('All-NBA Second Team', awards.allNba.second)}
      ${teamList('All-NBA Third Team', awards.allNba.third)}
    </div>
    <div class="team-list-grid">
      ${teamList('All-Defensive First Team', awards.allDefensive.first)}
      ${teamList('All-Defensive Second Team', awards.allDefensive.second)}
      ${teamList('All-Rookie First Team', awards.allRookie.first)}
      ${teamList('All-Rookie Second Team', awards.allRookie.second)}
    </div>
  `;
}

// ── Playoffs ────────────────────────────────────────────────────────
function seriesCard(title, series, bestOf = 7) {
  if (!series) return '';
  const winner = series.winner.abbr, loser = series.loser.abbr;
  const wins = series.winsFor;
  const gamesHtml = series.games
    .map((g) => `<div class="game-line">G${g.game}: ${g.score[Object.keys(g.score)[0]]}-${g.score[Object.keys(g.score)[1]]} (${g.winner} win, @ ${g.home})</div>`)
    .join('');
  return `<div class="series-card">
    <div class="series-title">${title}</div>
    <div class="series-matchup"><span class="winner">${winner} ${wins[winner]}</span><span>${loser} ${wins[loser]}</span></div>
    <details><summary>${series.games.length} games</summary>${gamesHtml}</details>
  </div>`;
}

function playInCard(label, game) {
  if (!game) return '';
  return `<div class="series-card">
    <div class="series-title">${game.label}</div>
    <div class="series-matchup"><span class="winner">${game.winner.abbr}</span><span>${game.loser.abbr}</span></div>
  </div>`;
}

function renderConferencePostseason(name, data) {
  if (!data.bracket) return `<div class="bracket-conf"><h3>${name}</h3><p class="placeholder">Not enough teams for a bracket.</p></div>`;
  const { round1, round2, confFinal } = data.bracket;
  return `<div class="bracket-conf">
    <h3>${name} — Play-In</h3>
    <div class="series-row">${data.playIn.games.map((g) => playInCard(g.label, g)).join('')}</div>
    <h3>${name} — Round 1</h3>
    <div class="series-row">${[round1.top, round1.midTop, round1.midBottom, round1.bottom].map((s) => seriesCard('Round 1', s)).join('')}</div>
    <h3>${name} — Round 2</h3>
    <div class="series-row">${[round2.top, round2.bottom].map((s) => seriesCard('Round 2', s)).join('')}</div>
    <h3>${name} — Conference Finals</h3>
    <div class="series-row">${seriesCard(`${name} Finals`, confFinal)}</div>
  </div>`;
}

function renderPlayoffs(postseason, finalsMvp) {
  document.getElementById('playoffsPlaceholder').hidden = true;
  const el = document.getElementById('playoffsContent');
  el.hidden = false;
  el.innerHTML = `
    ${renderConferencePostseason('Eastern Conference', postseason.conferences.East)}
    ${renderConferencePostseason('Western Conference', postseason.conferences.West)}
    <h3>NBA Finals</h3>
    <div class="series-row">${seriesCard('NBA Finals', postseason.finals)}</div>
    ${postseason.champion ? `<div class="champion-banner"><div class="title">League Champion</div><div class="name">${postseason.champion}</div>${finalsMvp ? `<div class="award-meta">Finals MVP: ${finalsMvp.name}</div>` : ''}</div>` : ''}
  `;
}

// ── Injuries ────────────────────────────────────────────────────────
function renderInjuries(report) {
  const placeholder = document.getElementById('injuriesPlaceholder');
  const table = document.getElementById('injuriesTable');
  if (!report.length) {
    placeholder.hidden = false;
    placeholder.textContent = latestSettings.injuriesEnabled
      ? 'No injuries occurred this season.'
      : 'Enable Injuries in Settings and simulate a season to see this.';
    table.hidden = true;
    return;
  }
  placeholder.hidden = true;
  table.hidden = false;
  document.getElementById('injuriesBody').innerHTML = report
    .map((r) => `<tr><td>${r.name}</td><td>${r.team}</td><td>${r.label}</td><td>${r.gamesRemaining}</td></tr>`)
    .join('');
}

// ── Roster ──────────────────────────────────────────────────────────
function renderTeamOptions(teams) {
  teamSelect.innerHTML = teams.slice().sort().map((abbr) => `<option value="${abbr}">${abbr}</option>`).join('');
}

function renderRoster(team) {
  const players = latestRoster.filter((p) => p.team === team).sort((a, b) => b.overall - a.overall);
  rosterBody.innerHTML = players
    .map(
      (p) => `<tr>
        <td>${p.name}</td><td>${p.age}</td>
        <td>${p.ratings.twoPt}</td><td>${p.ratings.threePt}</td>
        <td>${p.ratings.def}</td><td>${p.ratings.reb}</td>
        <td>${p.overall}</td><td>${p.potential}</td>
        <td>${p.salary}</td><td>${p.yearsLeft}</td>
      </tr>`,
    )
    .join('');
}

// ── Worker wiring ───────────────────────────────────────────────────
function startWorker(seed, mode) {
  if (worker) worker.terminate();
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  history = [];
  renderHistory();
  setBusy(true, mode === 'real' ? 'Loading real rosters…' : 'Generating rookies…');

  worker.onerror = (event) => {
    console.error('Worker error:', event.message, event);
    setBusy(false, `Error: ${event.message || 'something went wrong in the simulation.'}`);
  };

  worker.onmessage = (event) => {
    const msg = event.data;

    if (msg.type === 'bootstrapProgress') {
      setBusy(true, `Fast-forwarding league: season ${msg.season}/${msg.total}…`);
      return;
    }
    if (msg.type === 'simProgress') {
      setBusy(true, `Simulating… ${msg.played}/${msg.total} games`);
      return;
    }

    if (msg.type === 'ready') {
      latestRoster = msg.roster;
      renderTeamOptions(msg.teams);
      renderRoster(teamSelect.value);
      setBusy(false, `League ready — ${msg.teams.length} teams.`);
      return;
    }

    if (msg.type === 'seasonResult') {
      latestRoster = msg.roster;
      renderStandings(msg.conferences);
      renderOffseasonSummary(msg);
      renderRoster(teamSelect.value);

      if (latestSettings.showLeaders) renderLeaders(msg.leaders);
      if (latestSettings.showAwards) renderAwards(msg.awards, msg.finalsMvp);
      renderPlayoffs(msg.postseason, msg.finalsMvp);
      renderInjuries(msg.injuryReport);

      const losses = msg.standings.find((t) => t.abbr === msg.champion.abbr)?.losses ?? 0;
      history.push({ season: msg.season, champion: msg.champion, losses });
      renderHistory();

      setBusy(false, `Season ${msg.season} complete.`);
      return;
    }

    if (msg.type === 'roster') {
      latestRoster = latestRoster.filter((p) => p.team !== msg.team).concat(msg.players);
      renderRoster(msg.team);
    }
  };

  worker.postMessage({ type: 'init', payload: { seed, mode } });
}

newLeagueBtn.addEventListener('click', () => {
  const raw = seedInput.value.trim();
  const seed = raw === '' ? undefined : Number(raw);
  startWorker(seed, modeSelect.value);
});

simulateBtn.addEventListener('click', () => {
  if (!worker) return;
  setBusy(true, 'Simulating season (schedule + playoffs + offseason)…');
  worker.postMessage({ type: 'simulateSeason', payload: { settings: latestSettings } });
});

teamSelect.addEventListener('change', () => renderRoster(teamSelect.value));

// Auto-start a league on load so the page isn't empty.
startWorker(undefined, modeSelect.value);

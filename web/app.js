const modeSelect = document.getElementById('mode');
const seedInput = document.getElementById('seed');
const newLeagueBtn = document.getElementById('newLeagueBtn');
const simulateBtn = document.getElementById('simulateBtn');
const statusEl = document.getElementById('status');

const seasonPanel = document.getElementById('seasonPanel');
const seasonTitle = document.getElementById('seasonTitle');
const standingsBody = document.getElementById('standingsBody');
const offseasonSummary = document.getElementById('offseasonSummary');

const rosterPanel = document.getElementById('rosterPanel');
const teamSelect = document.getElementById('teamSelect');
const rosterBody = document.getElementById('rosterBody');

const historyPanel = document.getElementById('historyPanel');
const historyList = document.getElementById('historyList');

let worker = null;
let latestRoster = [];
let history = [];

function setBusy(busy, label) {
  newLeagueBtn.disabled = busy;
  simulateBtn.disabled = busy || !worker;
  statusEl.textContent = label ?? '';
}

function renderStandings(standings) {
  standingsBody.innerHTML = '';
  standings.forEach((t, i) => {
    const row = document.createElement('tr');
    const losses = standings.length > 1 ? (standings.length - 1) * 2 - t.wins : 0;
    row.innerHTML = `<td>${i + 1}</td><td>${t.abbr}</td><td>${t.wins}</td><td>${losses}</td>`;
    standingsBody.appendChild(row);
  });
}

function playerLine(p) {
  return `<li>${p.name} <span style="color:#748ffc">(${p.team}, age ${p.age}, OVR ${p.overall}, POT ${p.potential})</span></li>`;
}

function renderOffseasonSummary({ retireeCount, draftedCount, retirees, draftees }) {
  offseasonSummary.innerHTML = `
    <p>${retireeCount} retirements &rarr; ${draftedCount} rookies drafted.</p>
    <h4>Notable retirements</h4>
    <ul>${retirees.map(playerLine).join('') || '<li>None</li>'}</ul>
    <h4>Top draftees (by potential)</h4>
    <ul>${draftees.map(playerLine).join('') || '<li>None</li>'}</ul>
  `;
}

function renderTeamOptions(teams) {
  teamSelect.innerHTML = teams
    .slice()
    .sort()
    .map((abbr) => `<option value="${abbr}">${abbr}</option>`)
    .join('');
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

function renderHistory() {
  historyList.innerHTML = history
    .map(
      (h) =>
        `<li><span>Season ${h.season}</span><span class="champ">${h.champion.abbr} (${h.champion.wins}-${h.losses})</span></li>`,
    )
    .reverse()
    .join('');
  historyPanel.hidden = history.length === 0;
}

function startWorker(seed, mode) {
  if (worker) worker.terminate();
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  history = [];
  seasonPanel.hidden = true;
  setBusy(true, mode === 'real' ? 'Loading real rosters…' : 'Generating rookies…');

  worker.onmessage = (event) => {
    const msg = event.data;

    if (msg.type === 'bootstrapProgress') {
      setBusy(true, `Fast-forwarding league: season ${msg.season}/${msg.total}…`);
      return;
    }

    if (msg.type === 'ready') {
      latestRoster = msg.roster;
      renderTeamOptions(msg.teams);
      rosterPanel.hidden = false;
      renderRoster(teamSelect.value);
      setBusy(false, `League ready — ${msg.teams.length} teams.`);
      return;
    }

    if (msg.type === 'seasonResult') {
      latestRoster = msg.roster;
      seasonPanel.hidden = false;
      seasonTitle.textContent = `Season ${msg.season}`;
      renderStandings(msg.standings);
      renderOffseasonSummary(msg);
      renderRoster(teamSelect.value);

      const losses = (msg.standings.length - 1) * 2 - msg.champion.wins;
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
  setBusy(true, 'Simulating season (schedule + offseason)…');
  worker.postMessage({ type: 'simulateSeason' });
});

teamSelect.addEventListener('change', () => renderRoster(teamSelect.value));

// Auto-start a league on load so the page isn't empty.
startWorker(undefined, modeSelect.value);

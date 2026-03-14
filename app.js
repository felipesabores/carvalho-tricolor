/* ════════════════════════════════════════
   CARVALHO TRICOLOR · App + TheSportsDB API
   ════════════════════════════════════════ */

const API      = 'https://www.thesportsdb.com/api/v1/json/123';
const FLU_ID   = '134296';
const FLU_BADGE = 'https://assets-fluminense.s3.amazonaws.com/assets/fluminense-d99518426e66fb3576697742f31b8b1d2b8b53d34f409072c52711764f1bdf32.svg';

const BADGE_CACHE = { [FLU_ID]: FLU_BADGE };

const ROUTES = {
  login:    'screen-login',
  home:     'screen-home',
  calendar: 'screen-calendar',
  realtime: 'screen-realtime',
  article:  'screen-article',
  profile:  'screen-profile',
};

let currentScreen = 'login';
let liveEventId   = null;

// ── NAVIGATION ──────────────────────────
function goTo(name) {
  if (!ROUTES[name] || name === currentScreen) return;
  const from = document.getElementById(ROUTES[currentScreen]);
  const to   = document.getElementById(ROUTES[name]);
  if (!from || !to) return;

  from.classList.remove('active');
  from.classList.add('slide-out');
  setTimeout(() => from.classList.remove('slide-out'), 300);

  to.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => to.classList.add('active')));
  currentScreen = name;

  const content = to.querySelector('.screen-content');
  if (content) content.scrollTop = 0;

  if (name === 'home')     loadHomeData();
  if (name === 'calendar') loadCalendar();
  if (name === 'realtime') { startClock(); if (liveEventId) loadLiveData(liveEventId); }
}

// ── CLOCK ────────────────────────────────
let clockInterval = null;
let matchMinute   = 67;
function startClock() {
  if (clockInterval) return;
  clockInterval = setInterval(() => {
    matchMinute = Math.min(matchMinute + 1, 90);
    const el = document.getElementById('match-clock');
    if (el) el.textContent = matchMinute + "'";
    if (matchMinute >= 90) { clearInterval(clockInterval); clockInterval = null; if (el) el.textContent = '90+'; }
  }, 10000);
}

// ── TOGGLE ───────────────────────────────
function toggleChange(input) {
  const card = input.closest('.pref-item');
  card.style.transition = 'background 0.2s';
  card.style.background = input.checked ? '#EAF3EB' : '#fff5f7';
  setTimeout(() => { card.style.background = ''; }, 400);
}

// ── API ──────────────────────────────────
async function apiFetch(endpoint) {
  try {
    const res = await fetch(`${API}/${endpoint}`);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    console.warn('[API]', endpoint, e.message);
    return null;
  }
}

async function getTeamBadge(teamId) {
  if (BADGE_CACHE[teamId]) return BADGE_CACHE[teamId];
  const data = await apiFetch(`lookupteam.php?id=${teamId}`);
  const badge = (data?.teams?.[0]?.strTeamBadge || '') + '/tiny';
  BADGE_CACHE[teamId] = badge;
  return badge;
}

// ── DATE UTILS ──────────────────────────
const DAYS_PT       = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
const MONTHS_FULL   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                       'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function parseEventDate(ev) {
  return new Date(`${ev.dateEvent}T${ev.strTime || '12:00:00'}`);
}
function fmtTime(str) { return str ? str.slice(0, 5) : '—'; }
function fmtShortDate(d) {
  return `${DAYS_PT[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ── HOME ─────────────────────────────────
async function loadHomeData() {
  const [nextData, lastData] = await Promise.all([
    apiFetch(`eventsnext.php?id=${FLU_ID}`),
    apiFetch(`eventslast.php?id=${FLU_ID}`),
  ]);

  if (nextData?.events?.[0]) {
    const ev = nextData.events[0];
    liveEventId = ev.idEvent;
    await renderNextMatchCard(ev);
  }

  if (lastData?.results?.length) {
    renderLastResults(lastData.results.slice(0, 3));
  }
}

async function renderNextMatchCard(ev) {
  const isFluHome = ev.idHomeTeam == FLU_ID;
  const oppId     = isFluHome ? ev.idAwayTeam : ev.idHomeTeam;
  const oppName   = isFluHome ? ev.strAwayTeam : ev.strHomeTeam;
  const oppBadge  = await getTeamBadge(oppId);

  const d       = parseEventDate(ev);
  const dateStr = fmtShortDate(d);
  const timeStr = fmtTime(ev.strTime);

  setText('next-match-comp',  ev.strLeague || '—');
  setText('next-match-date',  dateStr);
  setText('next-match-time',  timeStr);
  setText('next-opp-name',    oppName);
  setText('next-match-venue', `${ev.strVenue || 'A confirmar'} · Brasil`);

  const badgeEl = document.getElementById('next-opp-badge');
  if (badgeEl && oppBadge) badgeEl.src = oppBadge.replace('/tiny', '/small');
}

function renderLastResults(results) {
  const list = document.getElementById('last-results-list');
  if (!list) return;

  list.innerHTML = results.map(r => {
    const isFluHome = r.idHomeTeam == FLU_ID;
    const fluScore  = parseInt(isFluHome ? r.intHomeScore : r.intAwayScore) ?? '?';
    const oppScore  = parseInt(isFluHome ? r.intAwayScore : r.intHomeScore) ?? '?';
    const oppName   = isFluHome ? r.strAwayTeam : r.strHomeTeam;
    const won  = fluScore > oppScore;
    const drew = fluScore === oppScore;
    const cls  = won ? 'result-win' : drew ? 'result-draw' : 'result-loss';
    const lbl  = won ? 'V' : drew ? 'E' : 'D';
    const d    = new Date(r.dateEvent);
    const date = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    return `
      <div class="result-item">
        <div class="result-badge ${cls}">${lbl}</div>
        <div class="result-info">
          <span class="result-teams">Flu ${fluScore} × ${oppScore} ${oppName}</span>
          <span class="result-meta">${r.strLeague} · ${date}</span>
        </div>
      </div>`;
  }).join('');

  document.getElementById('last-results-section')?.classList.remove('hidden');
}

// ── CALENDAR ─────────────────────────────
async function loadCalendar() {
  const container = document.getElementById('calendar-content');
  if (!container) return;

  container.innerHTML = `
    <div class="api-loading">
      <div class="loading-spinner"></div>
      <p>Carregando agenda do Flu...</p>
    </div>`;

  const data = await apiFetch(`eventsnext.php?id=${FLU_ID}`);
  if (!data?.events?.length) {
    container.innerHTML = '<p class="empty-state">Nenhum jogo encontrado.</p>';
    return;
  }

  // Pre-fetch all opponent badges
  const oppIds = [...new Set(data.events.map(ev =>
    ev.idHomeTeam == FLU_ID ? ev.idAwayTeam : ev.idHomeTeam
  ))];
  await Promise.all(oppIds.map(id => getTeamBadge(id)));

  // Group by month
  const byMonth = {};
  for (const ev of data.events) {
    const d   = parseEventDate(ev);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
    if (!byMonth[key]) byMonth[key] = { label: `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`, events: [] };
    byMonth[key].events.push(ev);
  }

  let html    = '';
  let isFirst = true;

  for (const { label, events } of Object.values(byMonth)) {
    html += `
      <div class="calendar-month-header">
        <div class="month-stripe"></div>
        <h2 class="month-label">${label}</h2>
      </div>`;

    for (const ev of events) {
      const d         = parseEventDate(ev);
      const isFluHome = ev.idHomeTeam == FLU_ID;
      const oppId     = isFluHome ? ev.idAwayTeam : ev.idHomeTeam;
      const oppName   = isFluHome ? ev.strAwayTeam : ev.strHomeTeam;
      const oppBadge  = BADGE_CACHE[oppId] || '';
      const timeStr   = fmtTime(ev.strTime);
      const nextTag   = isFirst ? '<span class="next-tag">Próximo</span>' : '';
      const nextClass = isFirst ? 'next-match-item' : '';
      isFirst = false;

      const fluCrest = `<div class="mini-crest flu-mini"><img src="${FLU_BADGE}" alt="FLU"/></div>`;
      const oppCrest = `<div class="mini-crest"><img src="${oppBadge}" alt="${oppName.slice(0,3).toUpperCase()}" onerror="this.style.display='none'"/></div>`;

      html += `
        <div class="match-list-item ${nextClass}" onclick="selectEvent('${ev.idEvent}')">
          <div class="match-item-date">
            <span class="day-num">${String(d.getDate()).padStart(2,'0')}</span>
            <span class="day-name">${DAYS_PT[d.getDay()]}</span>
          </div>
          <div class="match-item-divider"></div>
          <div class="match-item-info">
            <div class="match-item-teams">
              ${isFluHome ? fluCrest : oppCrest}
              <span class="vs-mini">×</span>
              ${isFluHome ? oppCrest : fluCrest}
            </div>
            <div class="match-item-meta">
              <span class="match-item-comp">${ev.strLeague}</span>
              <span class="match-item-time">${timeStr} · ${ev.strVenue || 'A confirmar'}</span>
            </div>
          </div>
          <div class="match-item-channel" id="tv-${ev.idEvent}">
            <div class="channel-badge" style="background:#888;color:#fff;font-size:8px">TV</div>
          </div>
          ${nextTag}
        </div>`;
    }
  }

  container.innerHTML = html + '<div style="height:20px"></div>';

  // Load TV channels async per event
  for (const ev of data.events) loadTVChannel(ev.idEvent);
}

async function loadTVChannel(eventId) {
  const data = await apiFetch(`lookuptv.php?id=${eventId}`);
  const el   = document.getElementById(`tv-${eventId}`);
  if (!el || !data?.tvevent?.length) return;

  const bra = data.tvevent.find(t => t.strCountry === 'Brazil') || data.tvevent[0];
  if (!bra?.strChannel) return;

  const ch = bra.strChannel;
  let cls = '', label = ch.split(' ')[0];
  if (ch.includes('Globo'))    { cls = 'globo';    label = 'TV Globo'; }
  else if (ch.includes('SporTV')) { cls = 'sportv'; label = 'SporTV'; }
  else if (ch.includes('Premiere')){ cls = 'premiere'; label = 'Premiere'; }
  else if (ch.includes('ESPN'))    { cls = 'espn';  label = 'ESPN'; }
  else if (ch.includes('Band'))    { cls = 'band';  label = 'Band'; }
  else if (ch.includes('Amazon') || ch.includes('Prime')) { cls = 'premiere'; label = 'Prime'; }

  el.innerHTML = `<div class="channel-badge ${cls}">${label}</div>`;
}

function selectEvent(eventId) {
  liveEventId = eventId;
  goTo('realtime');
}

// ── REALTIME ─────────────────────────────
async function loadLiveData(eventId) {
  const [evData, statsData, timelineData] = await Promise.all([
    apiFetch(`lookupevent.php?id=${eventId}`),
    apiFetch(`lookupeventstats.php?id=${eventId}`),
    apiFetch(`lookuptimeline.php?id=${eventId}`),
  ]);

  if (evData?.events?.[0])       updateScoreboard(evData.events[0]);
  if (statsData?.eventstats)     updateStats(statsData.eventstats);
  if (timelineData?.timeline)    updateTimeline(timelineData.timeline);
}

async function updateScoreboard(ev) {
  const isFluHome = ev.idHomeTeam == FLU_ID;
  const fluScore  = isFluHome ? (ev.intHomeScore ?? '—') : (ev.intAwayScore ?? '—');
  const oppScore  = isFluHome ? (ev.intAwayScore ?? '—') : (ev.intHomeScore ?? '—');
  const oppId     = isFluHome ? ev.idAwayTeam : ev.idHomeTeam;
  const oppName   = isFluHome ? ev.strAwayTeam : ev.strHomeTeam;

  const fluScoreEl = document.querySelector('#screen-realtime .flu-score');
  const oppScoreEl = document.querySelector('#screen-realtime .opp-score');
  const periodEl   = document.querySelector('#screen-realtime .scoreboard-period');
  const compEl     = document.querySelector('#screen-realtime .scoreboard-competition');
  const oppNames   = document.querySelectorAll('#screen-realtime .scoreboard-name');
  const oppBadgeEl = document.querySelector('#screen-realtime .opp-scoreboard img');

  if (fluScoreEl) fluScoreEl.textContent = fluScore;
  if (oppScoreEl) oppScoreEl.textContent = oppScore;
  if (periodEl)   periodEl.textContent   = ev.strProgress || ev.strStatus || '—';
  if (compEl)     compEl.textContent     = `${ev.strLeague} · ${ev.strVenue || ''}`;
  if (oppNames[1]) oppNames[1].textContent = oppName;

  const oppBadge = await getTeamBadge(oppId);
  if (oppBadgeEl && oppBadge) oppBadgeEl.src = oppBadge.replace('/tiny', '/small');
}

function updateStats(stats) {
  const flu = stats.find(s => s.idTeam == FLU_ID) || stats[0];
  if (!flu) return;
  setText('stat-shots',      flu.intShotsTotal || flu.intShots || '—');
  setText('stat-possession', flu.strPossession ? flu.strPossession + '%' : '—');
  setText('stat-corners',    flu.intCorners || '—');
}

function updateTimeline(timeline) {
  const container = document.getElementById('live-timeline');
  if (!container || !timeline.length) return;

  const sorted = [...timeline].sort((a, b) => (parseInt(b.intTime) || 0) - (parseInt(a.intTime) || 0));

  container.innerHTML = sorted.map(ev => {
    const isFlu = ev.idTeam == FLU_ID;
    const type  = (ev.strTimelineType || '').toLowerCase();
    const time  = ev.intTime || '—';
    const p     = ev.strPlayer || '';

    if (type.includes('goal') && isFlu)  return tlGoal(time, p, ev.strAssist, true);
    if (type.includes('goal'))           return tlGoal(time, p, '', false);
    if (type.includes('yellow'))         return tlYellow(time, p, !isFlu);
    if (type.includes('red'))            return tlRed(time, p, !isFlu);
    if (type.includes('sub'))            return tlSub(time, p, ev.strPlayer2);
    return tlGeneric(time, ev.strTimelineType, p);
  }).join('');
}

function tlGoal(time, player, assist, isFlu) {
  return `
    <div class="timeline-item goal-item">
      <div class="timeline-time">${time}'</div>
      <div class="timeline-connector">
        <div class="timeline-dot goal-dot">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="10" fill="none" stroke="white" stroke-width="2"/><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="white"/></svg>
        </div>
        <div class="timeline-line"></div>
      </div>
      <div class="timeline-card goal-card">
        <div class="event-type-row">
          <span class="event-icon-label">⚽</span>
          <span class="event-type goal-type">${isFlu ? 'GOL DO FLUZÃO!' : 'Gol — Adversário'}</span>
          <span class="event-scorer">${player}</span>
        </div>
        ${assist ? `<div class="event-assist">Assist.: ${assist}</div>` : ''}
      </div>
    </div>`;
}

function tlYellow(time, player, isOpp) {
  return `
    <div class="timeline-item">
      <div class="timeline-time">${time}'</div>
      <div class="timeline-connector">
        <div class="timeline-dot yellow-dot">
          <svg width="10" height="13" viewBox="0 0 10 13" fill="none"><rect width="10" height="13" rx="1" fill="#F7C01B"/></svg>
        </div>
        <div class="timeline-line"></div>
      </div>
      <div class="timeline-card">
        <div class="event-type-row">
          <span class="event-type yellow-type">Cartão Amarelo</span>
          <span class="event-scorer ${isOpp ? 'opp-player' : ''}">${player}</span>
        </div>
      </div>
    </div>`;
}

function tlRed(time, player, isOpp) {
  return `
    <div class="timeline-item">
      <div class="timeline-time">${time}'</div>
      <div class="timeline-connector">
        <div class="timeline-dot" style="background:#CC0000;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;">
          <svg width="10" height="13" viewBox="0 0 10 13" fill="none"><rect width="10" height="13" rx="1" fill="#fff"/></svg>
        </div>
        <div class="timeline-line"></div>
      </div>
      <div class="timeline-card">
        <div class="event-type-row">
          <span class="event-type" style="color:#CC0000;font-size:10px;font-weight:800;text-transform:uppercase">Cartão Vermelho</span>
          <span class="event-scorer ${isOpp ? 'opp-player' : ''}">${player}</span>
        </div>
      </div>
    </div>`;
}

function tlSub(time, out, in_) {
  return `
    <div class="timeline-item">
      <div class="timeline-time">${time}'</div>
      <div class="timeline-connector">
        <div class="timeline-dot sub-dot">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        </div>
        <div class="timeline-line"></div>
      </div>
      <div class="timeline-card">
        <div class="event-type-row"><span class="event-type sub-type">Substituição</span></div>
        <p class="event-desc"><strong style="color:#33603B">↑ ${in_ || '—'}</strong> entra no lugar de <strong style="color:#727175">↓ ${out || '—'}</strong></p>
      </div>
    </div>`;
}

function tlGeneric(time, type, player) {
  return `
    <div class="timeline-item">
      <div class="timeline-time">${time}'</div>
      <div class="timeline-connector">
        <div class="timeline-dot kickoff-dot">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="2"/><polygon points="10,8 16,12 10,16" fill="white"/></svg>
        </div>
        <div class="timeline-line"></div>
      </div>
      <div class="timeline-card kickoff-card">
        <p class="event-type kickoff-type">${type || 'Evento'} ${player ? '· ' + player : ''}</p>
      </div>
    </div>`;
}

// ── UTILS ────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── INIT ─────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const shell = document.createElement('div');
  shell.id = 'app-shell';
  document.querySelectorAll('.screen').forEach(s => shell.appendChild(s));
  document.body.appendChild(shell);

  const loginScreen = document.getElementById('screen-login');
  if (loginScreen) { loginScreen.style.display = 'flex'; loginScreen.classList.add('active'); }
});

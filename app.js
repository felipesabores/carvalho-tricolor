/* ════════════════════════════════════════
   CARVALHO TRICOLOR · App + TheSportsDB API
   ════════════════════════════════════════ */

const API       = 'https://www.thesportsdb.com/api/v1/json/123';
const FLU_ID    = '134296';
const LEAGUE_ID = '4351'; // Brasileirão Série A
const FLU_BADGE = 'https://assets-fluminense.s3.amazonaws.com/assets/fluminense-d99518426e66fb3576697742f31b8b1d2b8b53d34f409072c52711764f1bdf32.svg';

const RSS_URL = 'https://news.google.com/rss/search?q=Fluminense+futebol&hl=pt-BR&gl=BR&ceid=BR:pt-419';
const RSS_API = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;

const BADGE_CACHE = { [FLU_ID]: FLU_BADGE };
const NEWS_CACHE  = {};

const TTL_MS = 30 * 60 * 1000; // 30 minutes

// newsLoadedAt = 0 means never loaded; checked against Date.now() for TTL
let newsLoadedAt = 0;

let currentScreen = 'login';
let liveEventId   = null;

const ROUTES = {
  login:    'screen-login',
  home:     'screen-home',
  calendar: 'screen-calendar',
  realtime: 'screen-realtime',
  article:  'screen-article',
  profile:  'screen-profile',
  table:    'screen-table',
  squad:    'screen-squad',
};

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

  if (name === 'home')     { loadHomeData(); loadRSSNews(); }
  if (name === 'calendar') loadCalendar();
  if (name === 'realtime') { startClock(); if (liveEventId) loadLiveData(liveEventId); }
  if (name === 'table')    loadTableData();
  if (name === 'squad')    loadSquadData();
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
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${API}/${endpoint}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    console.warn('[API]', endpoint, e.message);
    return null;
  }
}

async function getTeamBadge(teamId) {
  if (BADGE_CACHE[teamId]) return BADGE_CACHE[teamId];
  const data = await apiFetch(`lookupteam.php?id=${teamId}`);
  const raw  = data?.teams?.[0]?.strTeamBadge;
  const badge = raw ? raw + '/tiny' : '';
  if (badge) BADGE_CACHE[teamId] = badge;
  return badge;
}

// ── DATE UTILS ──────────────────────────
const DAYS_PT       = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
const MONTHS_FULL   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                       'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function parseEventDate(ev) {
  // strTimeLocal is the kickoff in the venue's local timezone; fall back to strTime
  const t = ev.strTimeLocal || ev.strTime || '12:00:00';
  return new Date(`${ev.dateEvent}T${t}`);
}
function fmtTime(ev) {
  // Accept either an event object or a raw time string (legacy)
  const str = (ev && typeof ev === 'object') ? (ev.strTimeLocal || ev.strTime) : ev;
  return str ? str.slice(0, 5) : '—';
}
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
  // Use badge embedded in event payload — avoids lookupteam which returns wrong data
  const rawBadge  = isFluHome ? ev.strAwayTeamBadge : ev.strHomeTeamBadge;
  const oppBadge  = rawBadge || await getTeamBadge(oppId);
  if (rawBadge) BADGE_CACHE[oppId] = rawBadge;

  const d       = parseEventDate(ev);
  const dateStr = fmtShortDate(d);
  const timeStr = fmtTime(ev);

  setText('next-match-comp',  ev.strLeague || '—');
  setText('next-match-date',  dateStr);
  setText('next-match-time',  timeStr);
  setText('next-opp-name',    oppName);
  setText('next-match-venue', `${ev.strVenue || 'A confirmar'} · Brasil`);

  const badgeEl = document.getElementById('next-opp-badge');
  if (badgeEl) badgeEl.src = oppBadge ? oppBadge.replace('/tiny', '') : '';
}

function renderLastResults(results) {
  const list = document.getElementById('last-results-list');
  if (!list) return;

  list.innerHTML = results.map(r => {
    const isFluHome = r.idHomeTeam == FLU_ID;
    const fluScore  = parseInt(isFluHome ? r.intHomeScore : r.intAwayScore);
    const oppScore  = parseInt(isFluHome ? r.intAwayScore : r.intHomeScore);
    const fluDisp   = isNaN(fluScore) ? '?' : fluScore;
    const oppDisp   = isNaN(oppScore) ? '?' : oppScore;
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
          <span class="result-teams">Flu ${fluDisp} × ${oppDisp} ${oppName}</span>
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

  // Pre-populate cache from event badges (more reliable than lookupteam)
  data.events.forEach(ev => {
    const isFluHome = ev.idHomeTeam == FLU_ID;
    const oppId     = isFluHome ? ev.idAwayTeam : ev.idHomeTeam;
    const badge     = isFluHome ? ev.strAwayTeamBadge : ev.strHomeTeamBadge;
    if (badge && !BADGE_CACHE[oppId]) BADGE_CACHE[oppId] = badge;
  });

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
      const oppBadge  = (isFluHome ? ev.strAwayTeamBadge : ev.strHomeTeamBadge) || BADGE_CACHE[oppId] || '';
      const timeStr   = fmtTime(ev);
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
  const [evData, statsData, timelineData, hlData] = await Promise.all([
    apiFetch(`lookupevent.php?id=${eventId}`),
    apiFetch(`lookupeventstats.php?id=${eventId}`),
    apiFetch(`lookuptimeline.php?id=${eventId}`),
    apiFetch(`eventshighlights.php?e=${eventId}`),
  ]);

  if (evData?.events?.[0])       updateScoreboard(evData.events[0]);
  if (statsData?.eventstats)     updateStats(statsData.eventstats);
  if (timelineData?.timeline)    updateTimeline(timelineData.timeline);
  if (hlData?.highlights?.length) renderHighlights(hlData.highlights);
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

  // Use badge from event payload first, fall back to cache/lookup
  const rawBadge = isFluHome ? ev.strAwayTeamBadge : ev.strHomeTeamBadge;
  const oppBadge = rawBadge || await getTeamBadge(oppId);
  if (rawBadge) BADGE_CACHE[oppId] = rawBadge;
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

  // Ascending order: earliest events at top
  const sorted = [...timeline].sort((a, b) => (parseInt(a.intTime) || 0) - (parseInt(b.intTime) || 0));

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
        <div class="timeline-dot red-dot">
          <svg width="10" height="13" viewBox="0 0 10 13" fill="none"><rect width="10" height="13" rx="1" fill="#fff"/></svg>
        </div>
        <div class="timeline-line"></div>
      </div>
      <div class="timeline-card">
        <div class="event-type-row">
          <span class="event-type red-type">Cartão Vermelho</span>
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
        <p class="event-desc"><strong class="sub-in">↑ ${in_ || '—'}</strong> entra no lugar de <strong class="sub-out">↓ ${out || '—'}</strong></p>
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

// ── HIGHLIGHTS ───────────────────────────
function renderHighlights(highlights) {
  const section = document.getElementById('highlights-section');
  const list    = document.getElementById('highlights-list');
  if (!section || !list || !highlights.length) return;

  list.innerHTML = highlights.map(h => {
    const ytId  = h.strVideo?.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1];
    const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '';
    const title = h.strFilename || 'Highlight';
    return `
      <a class="highlight-card" href="${h.strVideo}" target="_blank" rel="noopener">
        <div class="highlight-thumb">
          ${thumb
            ? `<img src="${thumb}" alt="${title}" onerror="this.parentElement.style.background='#2a1a22'">`
            : '<div class="highlight-no-thumb"></div>'}
          <div class="highlight-play">▶</div>
        </div>
        <p class="highlight-title">${title}</p>
      </a>`;
  }).join('');

  section.classList.remove('hidden');
}

// ── RSS NEWS ─────────────────────────────
async function loadRSSNews() {
  if (Date.now() - newsLoadedAt < TTL_MS) return;

  const list = document.getElementById('news-list');
  if (!list) return;

  const BG = ['#6E182C','#33603B','#4D0A21','#4D6B8A','#6E182C'];
  const GLOBE_ICON = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);

  try {
    const res  = await fetch(RSS_API, { signal: ctrl.signal });
    clearTimeout(timer);
    const data = await res.json();
    if (!data?.items?.length) throw new Error('empty');

    newsLoadedAt = Date.now();
    const items = data.items.slice(0, 5);
    // Key by link so cache is stable across refreshes
    items.forEach(item => { NEWS_CACHE[item.link] = item; });

    list.innerHTML = items.map((item, i) => {
      const title  = item.title.replace(/ [-–] [^-–]+$/, '');
      const source = item.title.match(/ [-–] ([^-–]+)$/)?.[1] || item.author || 'Notícia';
      const date   = new Date(item.pubDate);
      const dateStr = `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`;
      const bg = BG[i % BG.length];
      return `
        <div class="news-card" onclick="openArticle('${encodeURIComponent(item.link)}')">
          <div class="news-img-wrap">
            <div class="news-img" style="background:linear-gradient(135deg,${bg} 0%,${bg}aa 100%);">
              ${GLOBE_ICON}
            </div>
          </div>
          <div class="news-content">
            <span class="news-tag">${source}</span>
            <h3 class="news-title-card">${title}</h3>
            <p class="news-desc">${dateStr}</p>
            <a class="news-link" onclick="openArticle('${encodeURIComponent(item.link)}'); return false;">Ler mais →</a>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    clearTimeout(timer);
    // Don't set newsLoadedAt so next visit retries
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📰</div><p>Não foi possível carregar as notícias</p></div>`;
  }
}

function openArticle(encodedLink) {
  const link = decodeURIComponent(encodedLink);
  const item = NEWS_CACHE[link];
  if (!item) { goTo('article'); return; }

  const title  = item.title.replace(/ [-–] [^-–]+$/, '');
  const source = item.title.match(/ [-–] ([^-–]+)$/)?.[1] || item.author || '';
  const date   = new Date(item.pubDate);
  const dateStr = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const desc   = item.description?.replace(/<[^>]*>/g, '') || 'Clique abaixo para ler a notícia completa.';

  setText('article-tag',       source || 'Notícia');
  setText('article-title',     title);
  setText('article-date',      dateStr);
  setText('article-source',    `Por ${source}`);
  setText('article-body-text', desc);

  const tagsEl = document.getElementById('article-tags');
  if (tagsEl) {
    const tags = title.split(' ').filter(w => w.length > 5).slice(0, 4);
    tagsEl.innerHTML = tags.map(t => `<span class="tag-chip">${t}</span>`).join('');
  }

  const btn = document.getElementById('article-read-btn');
  if (btn) btn.onclick = () => window.open(item.link, '_blank');

  goTo('article');
}

// ── TABELA ───────────────────────────────
async function loadTableData() {
  const container = document.getElementById('table-content');
  if (!container) return;

  const loadedAt = Number(container.dataset.loadedAt) || 0;
  if (Date.now() - loadedAt < TTL_MS) return;

  container.innerHTML = `<div class="api-loading"><div class="loading-spinner"></div><p>Carregando tabela...</p></div>`;

  const data = await apiFetch(`lookuptable.php?l=${LEAGUE_ID}&s=2026`);
  if (!data?.table?.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Tabela não disponível</p></div>`;
    return;
  }

  const teams = data.table.slice(0, 20);
  // Pre-populate cache from table payload (avoids 20 extra lookupteam calls)
  // Table API uses strBadge (already includes /tiny), not strTeamBadge
  teams.forEach(t => {
    if (!BADGE_CACHE[t.idTeam] && t.strBadge)
      BADGE_CACHE[t.idTeam] = t.strBadge;
  });
  await Promise.all(teams.map(t => getTeamBadge(t.idTeam)));

  container.dataset.loadedAt = String(Date.now());
  container.innerHTML = `
    <table class="standings-table">
      <thead>
        <tr>
          <th>#</th><th colspan="2">Time</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th>
        </tr>
      </thead>
      <tbody>
        ${teams.map(t => {
          const isFlu  = t.idTeam == FLU_ID;
          const badge  = BADGE_CACHE[t.idTeam] || '';
          const pos    = parseInt(t.intRank);
          const zoneClass = pos <= 6 ? 'zone-lib' : pos <= 12 ? 'zone-sul' : pos >= 17 ? 'zone-rel' : '';
          const sg     = parseInt(t.intGoalDifference);
          return `
            <tr class="${isFlu ? 'flu-row' : ''}">
              <td class="pos-col"><span class="pos-marker ${zoneClass}">${pos}</span></td>
              <td class="badge-col"><img src="${badge}" width="20" height="20" onerror="this.style.display='none'"/></td>
              <td class="team-col-name">${t.strTeam}</td>
              <td class="pts-col"><strong>${t.intPoints}</strong></td>
              <td>${t.intPlayed}</td>
              <td>${t.intWin}</td>
              <td>${t.intDraw}</td>
              <td>${t.intLoss}</td>
              <td class="${sg > 0 ? 'sg-pos' : sg < 0 ? 'sg-neg' : ''}">${sg > 0 ? '+' + sg : sg}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="height:20px"></div>`;
}

// ── ELENCO ───────────────────────────────
async function loadSquadData() {
  const container = document.getElementById('squad-content');
  if (!container) return;

  const loadedAt = Number(container.dataset.loadedAt) || 0;
  if (Date.now() - loadedAt < TTL_MS) return;

  container.innerHTML = `<div class="api-loading"><div class="loading-spinner"></div><p>Carregando elenco...</p></div>`;

  const data = await apiFetch(`lookup_all_players.php?id=${FLU_ID}`);
  const activePlayers = data?.player?.filter(p => p.strStatus === 'Active') || [];
  if (!activePlayers.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">👕</div><p>Elenco não disponível</p></div>`;
    return;
  }

  const POS_MAP = {
    'Goalkeeper': { label: 'Goleiros',        icon: '🧤', order: 0 },
    'Defender':   { label: 'Defensores',      icon: '🛡️', order: 1 },
    'Midfielder': { label: 'Meio-Campistas',  icon: '⚙️', order: 2 },
    'Forward':    { label: 'Atacantes',       icon: '⚡', order: 3 },
  };

  const groups = {};
  for (const p of activePlayers) {
    const key = Object.keys(POS_MAP).find(k => (p.strPosition || '').includes(k)) || 'Midfielder';
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  container.dataset.loadedAt = String(Date.now());
  let html = '';
  for (const [key, { label, icon }] of Object.entries(POS_MAP)) {
    const players = groups[key] || [];
    if (!players.length) continue;
    html += `
      <div class="squad-position-header">
        <span class="squad-pos-icon">${icon}</span>
        <h3 class="squad-pos-label">${label}</h3>
        <span class="squad-count">${players.length}</span>
      </div>`;
    html += players.map(p => {
      const initials = p.strPlayer.split(' ').map(n => n[0]).slice(0, 2).join('');
      const photo    = p.strCutout || p.strThumb;
      return `
        <div class="player-card">
          <div class="player-photo">
            ${photo
              ? `<img src="${photo}" alt="${p.strPlayer}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
              : ''}
            <div class="player-initials"${photo ? ' style="display:none"' : ''}>${initials}</div>
          </div>
          <div class="player-info">
            <span class="player-name">${p.strPlayer}</span>
            <span class="player-meta">${p.strNationality || '—'}${p.strNumber ? ' · #' + p.strNumber : ''}</span>
          </div>
          ${p.dateBorn ? `<span class="player-age">${new Date().getFullYear() - parseInt(p.dateBorn)} a</span>` : ''}
        </div>`;
    }).join('');
  }

  const updatedAt = new Date().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  container.innerHTML = html + `
    <div class="squad-source-note">Fonte: TheSportsDB · ${updatedAt}</div>
    <div style="height:20px"></div>`;
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

  // Pre-warm news on login screen so Home is instant
  setTimeout(loadRSSNews, 1500);
});

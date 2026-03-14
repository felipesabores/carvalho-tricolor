/* ════════════════════════════════════════
   CARVALHO TRICOLOR · App Logic
   ════════════════════════════════════════ */

const ROUTES = {
  login:    'screen-login',
  home:     'screen-home',
  calendar: 'screen-calendar',
  realtime: 'screen-realtime',
  article:  'screen-article',
  profile:  'screen-profile',
};

let currentScreen = 'login';

function goTo(name) {
  if (!ROUTES[name] || name === currentScreen) return;

  const from = document.getElementById(ROUTES[currentScreen]);
  const to   = document.getElementById(ROUTES[name]);

  if (!from || !to) return;

  // Animate out
  from.classList.remove('active');
  from.classList.add('slide-out');
  setTimeout(() => from.classList.remove('slide-out'), 300);

  // Animate in
  to.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      to.classList.add('active');
    });
  });

  currentScreen = name;

  // Scroll to top of new screen
  const content = to.querySelector('.screen-content');
  if (content) content.scrollTop = 0;

  // Clock tick for realtime
  if (name === 'realtime') startClock();
}

// ── MATCH CLOCK ──
let clockInterval = null;
let matchMinute = 67;

function startClock() {
  if (clockInterval) return;
  clockInterval = setInterval(() => {
    matchMinute = Math.min(matchMinute + 1, 90);
    const el = document.getElementById('match-clock');
    if (el) el.textContent = matchMinute + "'";
    if (matchMinute >= 90) {
      clearInterval(clockInterval);
      clockInterval = null;
      if (el) el.textContent = '90+';
    }
  }, 10000); // tick every 10s for demo
}

// ── TOGGLE FEEDBACK ──
function toggleChange(input) {
  const label = input.closest('.pref-item').querySelector('.pref-label');
  if (!label) return;
  // Visual flash
  const card = input.closest('.pref-item');
  card.style.transition = 'background 0.2s';
  card.style.background = input.checked ? '#EAF3EB' : '#fff5f7';
  setTimeout(() => { card.style.background = ''; }, 400);
}

// ── WRAP SCREENS IN SHELL ──
window.addEventListener('DOMContentLoaded', () => {
  // Wrap all screens in a shell div for the phone chrome
  const body = document.body;
  const shell = document.createElement('div');
  shell.id = 'app-shell';

  // Move all screens into shell
  const screens = document.querySelectorAll('.screen');
  screens.forEach(s => shell.appendChild(s));
  body.appendChild(shell);

  // Init first screen
  const loginScreen = document.getElementById('screen-login');
  if (loginScreen) {
    loginScreen.style.display = 'flex';
    loginScreen.classList.add('active');
  }
});

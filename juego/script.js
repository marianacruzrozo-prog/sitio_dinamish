/* ==========================================================
   LAS AVENTURAS DEL PULPO — NÚCLEO DE LA APLICACIÓN
   ==========================================================
   Este archivo controla: pantallas, audio, almacenamiento local,
   transiciones, progreso/desbloqueo, y la carga del personaje.

   ⚠️ IMPORTANTE — PERSONAJE PRINCIPAL ⚠️
   Coloca tu GIF propio del pulpo en:  img/pulpo.gif
   El sistema lo detecta automáticamente. Si el archivo no existe
   todavía, se muestra un pulpo de reemplazo (dibujado en SVG)
   para que el proyecto funcione mientras tanto.
   ========================================================== */

const PULPO_SRC = 'img/pulpo.gif';

// Pulpo de reemplazo (SVG en línea) — se usa SOLO si img/pulpo.gif no existe aún.
const PULPO_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <radialGradient id="body" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#FFA05C"/>
      <stop offset="100%" stop-color="#EF7A22"/>
    </radialGradient>
  </defs>
  <g>
    <path d="M100 150 C70 190 40 185 35 165 C30 185 10 185 15 160 C-5 180 -10 150 15 140" fill="none"/>
    <path d="M60 120 Q30 160 45 190 Q55 165 65 150" stroke="#EF7A22" stroke-width="14" fill="none" stroke-linecap="round"/>
    <path d="M80 130 Q65 175 75 195" stroke="#EF7A22" stroke-width="14" fill="none" stroke-linecap="round"/>
    <path d="M100 132 Q100 178 100 198" stroke="#C75F12" stroke-width="14" fill="none" stroke-linecap="round"/>
    <path d="M120 130 Q135 175 125 195" stroke="#EF7A22" stroke-width="14" fill="none" stroke-linecap="round"/>
    <path d="M140 120 Q170 160 155 190" stroke="#C75F12" stroke-width="14" fill="none" stroke-linecap="round"/>
    <ellipse cx="100" cy="95" rx="62" ry="55" fill="url(#body)"/>
    <circle cx="78" cy="88" r="15" fill="#1E3C4D"/>
    <circle cx="122" cy="88" r="15" fill="#1E3C4D"/>
    <circle cx="82" cy="83" r="5" fill="#F4FAFC"/>
    <circle cx="126" cy="83" r="5" fill="#F4FAFC"/>
    <path d="M85 115 Q100 125 115 115" stroke="#1E3C4D" stroke-width="4" fill="none" stroke-linecap="round"/>
    <rect x="70" y="45" width="60" height="14" rx="4" fill="#1E3C4D"/>
    <circle cx="100" cy="42" r="9" fill="#1E3C4D"/>
    <circle cx="100" cy="42" r="4" fill="#EF7A22"/>
  </g>
</svg>`);

const App = (() => {

  const state = {
    unlocked: { 1: true, 2: false, 3: false },
    bestScores: { 1: 0, 2: 0, 3: 0 },
    lastResult: { score: 0, time: 0, items: 0, gameKey: 1 },
    muted: false,
    currentGame: 1,
    pulpoResolvedSrc: PULPO_SRC
  };

  /* ---------------- almacenamiento local ---------------- */
  const STORAGE_KEY = 'pulpo_aventuras_save_v1';
  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        Object.assign(state.unlocked, data.unlocked || {});
        Object.assign(state.bestScores, data.bestScores || {});
        state.muted = !!data.muted;
      }
    } catch (e) { /* almacenamiento no disponible, se continúa sin guardar */ }
  }
  function persistSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        unlocked: state.unlocked,
        bestScores: state.bestScores,
        muted: state.muted
      }));
    } catch (e) { /* ignorar si el navegador bloquea el almacenamiento */ }
  }

  function setBestScore(gameKey, score) {
    if (score > (state.bestScores[gameKey] || 0)) {
      state.bestScores[gameKey] = score;
      persistSave();
      return true;
    }
    return false;
  }
  function getBestScore(gameKey) { return state.bestScores[gameKey] || 0; }
  function getTotalBest() {
    return (state.bestScores[1] || 0) + (state.bestScores[2] || 0) + (state.bestScores[3] || 0);
  }

  function unlockGame(gameKey) {
    state.unlocked[gameKey] = true;
    persistSave();
    refreshMenuLocks();
  }

  /* ---------------- audio (sintetizado, sin archivos externos) ---------------- */
  let actx = null;
  function ensureAudioCtx() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { actx = null; }
    }
    return actx;
  }
  // Reemplaza estos sonidos sintetizados por archivos reales en /audio si lo prefieres.
  const SFX = {
    jump: { freq: 440, dur: .12, type: 'triangle', slide: 260 },
    collect: { freq: 660, dur: .14, type: 'sine', slide: 340 },
    hit: { freq: 160, dur: .22, type: 'sawtooth', slide: -80 },
    click: { freq: 520, dur: .06, type: 'square', slide: 0 },
    error: { freq: 180, dur: .18, type: 'square', slide: -60 },
    success: { freq: 520, dur: .3, type: 'sine', slide: 300 },
    tick: { freq: 800, dur: .05, type: 'square', slide: 0 },
    power: { freq: 300, dur: .25, type: 'triangle', slide: 500 },
    bubble: { freq: 900, dur: .08, type: 'sine', slide: -300 },
    gameover: { freq: 220, dur: .5, type: 'sawtooth', slide: -160 },
  };
  function playSfx(name) {
    if (state.muted) return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const cfg = SFX[name];
    if (!cfg) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = cfg.type;
    osc.frequency.setValueAtTime(cfg.freq, t0);
    osc.frequency.linearRampToValueAtTime(Math.max(40, cfg.freq + cfg.slide), t0 + cfg.dur);
    gain.gain.setValueAtTime(0.16, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + cfg.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + cfg.dur + 0.02);
  }

  /* ---------------- pantallas ---------------- */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + id);
    if (el) el.classList.add('active');
    updateTouchControlsVisibility(id);
    updateOrientationRequirement(id);
  }

  /* ---------------- transición cinematográfica ---------------- */
  function playTransition(type = 'clapper') {
    return new Promise(resolve => {
      const overlay = document.getElementById('transitionOverlay');
      const clapper = document.getElementById('clapperFx');
      const flash = document.getElementById('flashFx');
      const staticFx = document.getElementById('staticFx');
      playSfx(type === 'clapper' ? 'click' : 'bubble');
      let el, duration;
      if (type === 'flash') { el = flash; duration = 350; }
      else if (type === 'static') { el = staticFx; duration = 500; }
      else { el = clapper; duration = 700; }
      el.classList.add('play');
      setTimeout(() => { el.classList.remove('play'); resolve(); }, duration);
    });
  }

  /* ---------------- controles táctiles ---------------- */
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isTouch) document.documentElement.classList.add('no-touch');

  function updateTouchControlsVisibility(screenId) {
    document.querySelectorAll('.touch-controls').forEach(tc => tc.classList.remove('show'));
    if (!isTouch) return;
    if (screenId === 'game1') document.getElementById('touch-g1').classList.add('show');
    if (screenId === 'game3') document.getElementById('touch-g3').classList.add('show');
  }

  /* ---------------- orientación ---------------- */
  const LANDSCAPE_SCREENS = new Set(['game1', 'game3']); // juegos que se disfrutan mejor en horizontal
  function updateOrientationRequirement(screenId) {
    const notice = document.getElementById('orientationNotice');
    const check = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      const small = Math.min(window.innerWidth, window.innerHeight) < 620;
      if (LANDSCAPE_SCREENS.has(screenId) && isPortrait && small) {
        notice.classList.add('show');
      } else {
        notice.classList.remove('show');
      }
    };
    check();
    window.onresize = check;
  }

  /* ---------------- fondo de burbujas ---------------- */
  function spawnBubbles() {
    const layer = document.getElementById('bubblesLayer');
    const count = 18;
    for (let i = 0; i < count; i++) {
      const b = document.createElement('div');
      b.className = 'bubble';
      const size = 4 + Math.random() * 16;
      b.style.width = size + 'px';
      b.style.height = size + 'px';
      b.style.left = Math.random() * 100 + '%';
      b.style.animationDuration = (7 + Math.random() * 10) + 's';
      b.style.animationDelay = (Math.random() * 10) + 's';
      layer.appendChild(b);
    }
  }

  /* ---------------- carga del personaje (con reemplazo automático) ---------------- */
  function resolvePulpoSrc(callback) {
    const test = new Image();
    test.onload = () => { state.pulpoResolvedSrc = PULPO_SRC; callback(PULPO_SRC); };
    test.onerror = () => { state.pulpoResolvedSrc = PULPO_FALLBACK; callback(PULPO_FALLBACK); };
    test.src = PULPO_SRC + '?_=' + Date.now();
  }
  function applyPulpoToImgElements() {
    const src = state.pulpoResolvedSrc;
    ['pulpoMenuImg', 'pulpoGameoverImg', 'pulpoFinalImg'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.src = src;
    });
  }

  /* ---------------- menú: candados y navegación ---------------- */
  function refreshMenuLocks() {
    [2, 3].forEach(k => {
      const card = document.getElementById('cardGame' + k);
      const lock = document.querySelector('[data-lock="' + k + '"]');
      if (state.unlocked[k]) {
        card.classList.remove('locked');
        if (lock) lock.textContent = '';
      } else {
        card.classList.add('locked');
        if (lock) lock.textContent = '🔒';
      }
    });
    document.getElementById('bestScoreTotal').textContent = String(getTotalBest()).padStart(6, '0');
  }

  async function goToGame(gameKey) {
    if (!state.unlocked[gameKey]) { playSfx('error'); return; }
    state.currentGame = gameKey;
    playSfx('click');
    await playTransition('clapper');
    showScreen('game' + gameKey);
    if (gameKey === 1) Game1.start();
    if (gameKey === 2) Game2.start();
    if (gameKey === 3) Game3.start();
  }

  async function goToMenu() {
    if (Game1 && Game1.stop) Game1.stop();
    if (Game2 && Game2.stop) Game2.stop();
    if (Game3 && Game3.stop) Game3.stop();
    await playTransition('static');
    showScreen('menu');
    refreshMenuLocks();
  }

  async function onGameWin(gameKey, { score = 0, time = 0, items = 0 } = {}) {
    setBestScore(gameKey, score);
    state.lastResult = { score, time, items, gameKey };
    const nextKey = gameKey + 1;
    if (nextKey <= 3) unlockGame(nextKey);
    document.getElementById('v-score').textContent = score;
    document.getElementById('v-time').textContent = time + 's';
    document.getElementById('v-items').textContent = items;
    document.getElementById('v-best').textContent = getBestScore(gameKey);
    const nextBtn = document.getElementById('btnNextGame');
    nextBtn.style.display = 'block';
    nextBtn.textContent = nextKey <= 3 ? 'SIGUIENTE JUEGO' : 'VER RESULTADO FINAL';
    playSfx('success');
    await playTransition('flash');
    showScreen('victory');
  }

  async function onGameFinalComplete() {
    document.getElementById('f-total').textContent = getTotalBest();
    await playTransition('flash');
    showScreen('final');
  }

  async function onGameOver() {
    playSfx('gameover');
    await playTransition('static');
    showScreen('gameover');
  }

  /* ---------------- eventos globales ---------------- */
  function bindEvents() {
    document.getElementById('btnPlay').addEventListener('click', () => {
      const next = [1, 2, 3].find(k => state.unlocked[k]) || 1;
      goToGame(next);
    });
    document.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => goToGame(Number(card.dataset.game)));
    });
    document.querySelectorAll('[data-back]').forEach(btn => {
      btn.addEventListener('click', goToMenu);
    });
    document.getElementById('btnMute').addEventListener('click', (e) => {
      state.muted = !state.muted;
      e.target.textContent = state.muted ? '🔈' : '🔊';
      persistSave();
    });
    document.getElementById('btnRetry').addEventListener('click', async () => {
      await playTransition('clapper');
      showScreen('game' + state.currentGame);
      if (state.currentGame === 1) Game1.start();
      if (state.currentGame === 2) Game2.start();
      if (state.currentGame === 3) Game3.start();
    });
    document.getElementById('btnNextGame').addEventListener('click', () => {
      const next = state.lastResult.gameKey + 1;
      if (next <= 3) goToGame(next); else onGameFinalComplete();
    });

    // corrige la altura real en móviles (barra de direcciones)
    const setVh = () => document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px');
    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);
  }

  function init() {
    loadSave();
    spawnBubbles();
    resolvePulpoSrc(() => applyPulpoToImgElements());
    bindEvents();
    refreshMenuLocks();
    document.getElementById('btnMute').textContent = state.muted ? '🔈' : '🔊';
    showScreen('menu');
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    playSfx, playTransition, showScreen, goToMenu, goToGame,
    onGameWin, onGameOver, onGameFinalComplete,
    getBestScore, setBestScore, getTotalBest,
    get pulpoSrc() { return state.pulpoResolvedSrc; },
    isTouch,
    state
  };
})();

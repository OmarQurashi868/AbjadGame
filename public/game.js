/* ============================================================
   ABJAD GAME — Frontend JS (game.js)
   Vanilla JS SPA, WebSocket-driven
   ============================================================ */

// ─── i18n ───────────────────────────────────────────────────
const I18N = {
  ar: {
    dir: 'rtl',
    title: 'أبجد',
    subtitle: 'لعبة الحروف العربية الجماعية',
    enterName: 'أدخل اسمك',
    namePlaceholder: 'اسمك هنا...',
    createRoom: 'إنشاء غرفة',
    joinRoom: 'الانضمام برمز',
    joinPlaceholder: 'رمز الغرفة',
    join: 'انضمام',
    roomCode: 'رمز الغرفة',
    copyLink: 'نسخ الرابط',
    players: 'اللاعبون',
    config: 'إعدادات اللعبة',
    rounds: 'عدد الجولات',
    timer: 'مدة الجولة (ثانية)',
    letters: 'الحروف المتاحة',
    categories: 'الفئات',
    addCategory: 'أضف فئة',
    add: 'إضافة',
    startGame: 'بدء اللعبة',
    waitingForHost: 'في انتظار المضيف لبدء اللعبة...',
    waitingPlayers: 'في انتظار لاعبين آخرين...',
    round: 'الجولة',
    of: 'من',
    stop: 'STOP!',
    category: 'فئة',
    confirm: 'تأكيد',
    roundResults: 'نتائج الجولة',
    totalScores: 'المجموع الكلي',
    nextRound: 'الجولة التالية',
    finalResults: 'النتائج النهائية',
    winner: 'الفائز',
    playAgain: 'العب مجدداً',
    points: 'نقطة',
    thisRound: 'هذه الجولة',
    total: 'الكلي',
    host: 'مضيف',
    valid: 'صحيح',
    invalid: 'خاطئ',
    stoppedBy: 'أوقف الجولة',
    timeUp: 'انتهى الوقت!',
    votingFor: 'تصويت على فئة',
    submitVotes: 'تأكيد التصويت',
    noAnswer: '—',
    copySuccess: 'تم نسخ الرابط!',
    langToggle: 'EN',
    needTwoPlayers: 'يجب أن يكون هناك لاعبان على الأقل لبدء اللعبة',
    loading: 'جارٍ التحميل...',
    reconnecting: 'جارٍ إعادة الاتصال...',
    rank: 'المركز',
    player: 'اللاعب',
    score: 'النقاط',
    position1: '🥇',
    position2: '🥈',
    position3: '🥉',
    selectLetters: 'اختر حروفاً على الأقل',
  },
  en: {
    dir: 'ltr',
    title: 'Abjad',
    subtitle: 'Multiplayer Arabic Letter Game',
    enterName: 'Enter your name',
    namePlaceholder: 'Your name here...',
    createRoom: 'Create Room',
    joinRoom: 'Join by Code',
    joinPlaceholder: 'Room Code',
    join: 'Join',
    roomCode: 'Room Code',
    copyLink: 'Copy Link',
    players: 'Players',
    config: 'Game Settings',
    rounds: 'Number of Rounds',
    timer: 'Round Timer (seconds)',
    letters: 'Available Letters',
    categories: 'Categories',
    addCategory: 'Add Category',
    add: 'Add',
    startGame: 'Start Game',
    waitingForHost: 'Waiting for host to start the game...',
    waitingPlayers: 'Waiting for other players...',
    round: 'Round',
    of: 'of',
    stop: 'STOP!',
    category: 'Category',
    confirm: 'Confirm',
    roundResults: 'Round Results',
    totalScores: 'Total Scores',
    nextRound: 'Next Round',
    finalResults: 'Final Results',
    winner: 'Winner',
    playAgain: 'Play Again',
    points: 'pts',
    thisRound: 'This Round',
    total: 'Total',
    host: 'Host',
    valid: 'Valid',
    invalid: 'Invalid',
    stoppedBy: 'stopped the round',
    timeUp: "Time's up!",
    votingFor: 'Voting on category',
    submitVotes: 'Submit Votes',
    noAnswer: '—',
    copySuccess: 'Link copied!',
    langToggle: 'ع',
    needTwoPlayers: 'At least 2 players needed to start',
    loading: 'Loading...',
    reconnecting: 'Reconnecting...',
    rank: 'Rank',
    player: 'Player',
    score: 'Score',
    position1: '🥇',
    position2: '🥈',
    position3: '🥉',
    selectLetters: 'Please select at least one letter',
  }
};

const ARABIC_LETTERS = [
  'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش',
  'ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي'
];

const DEFAULT_CATEGORIES = [
  'ولد','بنت','حيوان','جماد','نبات','بلاد','وجبة','مشهور','لعبة','وسائط'
];

const PLAYER_COLORS = [
  '#f59e0b','#06b6d4','#ec4899','#10b981',
  '#f97316','#8b5cf6','#14b8a6','#ef4444',
  '#a78bfa','#34d399','#fb923c','#38bdf8'
];

// ─── State ───────────────────────────────────────────────────
const state = {
  lang: 'ar',
  ws: null,
  username: localStorage.getItem('abjad_username') || '',
  playerId: null,
  roomId: null,
  isHost: false,
  players: [],
  config: null,
  expiresAt: null, // lobby expiration timestamp
  lobbyExpiryTimer: null,
  currentScreen: 'landing', // landing | lobby | game | voting | roundEnd | gameEnd
  // Game
  round: 0,
  totalRounds: 0,
  currentLetter: '',
  categories: [],
  answers: {},
  timer: 0,
  timerInterval: null,
  // Voting
  currentVotingCategory: 0,
  votingAnswers: [],
  localVotes: {}, // playerId -> bool
  votingCategory: '',
  votingTotalCategories: 0,
  // Round end
  roundScores: null,
  totalScores: null,
  // Final
  ranking: null,
  finalScores: null,
  // UI
  roundStopped: false,
  stopOverlayShown: false,
  modalShown: false,
};

// ─── i18n helpers ────────────────────────────────────────────
function t(key) { return (I18N[state.lang] || I18N.ar)[key] || key; }

function setLang(lang) {
  state.lang = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.body.className = lang === 'en' ? 'lang-en' : '';
  render();
}

function toggleLang() { setLang(state.lang === 'ar' ? 'en' : 'ar'); }

// ─── WebSocket ───────────────────────────────────────────────
function connectWS(onOpen) {
  const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  const ws = new WebSocket(wsUrl);
  state.ws = ws;

  ws.onopen = () => { if (onOpen) onOpen(); };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      handleServerMessage(msg);
    } catch (err) {
      console.error('WS parse error', err);
    }
  };
  ws.onerror = (e) => { console.error('WS error', e); showToast(t('reconnecting'), 'error'); };
  ws.onclose = () => {
    state.ws = null;
  };
  return ws;
}

function wsSend(msg) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(msg));
  }
}

// ─── Server message handler ───────────────────────────────────
function handleServerMessage(msg) {
  switch (msg.type) {
    case 'roomCreated':
      state.roomId = msg.roomId;
      // roomJoined follows immediately
      break;

    case 'roomJoined':
      state.roomId = msg.roomId;
      state.players = msg.players;
      state.config = msg.config;
      state.isHost = msg.isHost;
      state.playerId = msg.playerId;
      state.expiresAt = msg.expiresAt || null;
      state.currentScreen = 'lobby';
      render();
      // Update URL and push a history entry so back button works
      if (!location.pathname.includes(msg.roomId)) {
        history.pushState({ screen: 'lobby', roomId: msg.roomId }, '', `/lobby/${msg.roomId}`);
      }
      break;

    case 'playerJoined':
      state.players = msg.players;
      state.expiresAt = msg.expiresAt || state.expiresAt;
      renderPlayerList();
      if (state.currentScreen === 'lobby') renderLobbyActions();
      break;

    case 'playerLeft':
      state.players = msg.players;
      if (msg.hostId) {
        state.isHost = msg.hostId === state.playerId;
      }
      renderPlayerList();
      if (state.currentScreen === 'lobby') renderLobbyActions();
      break;

    case 'configUpdated':
      state.config = msg.config;
      state.expiresAt = msg.expiresAt || state.expiresAt;
      if (state.currentScreen === 'lobby') renderConfigPanel();
      break;

    case 'roomExpired':
      // Show modal and return to landing
      showModal(
        t('title'),
        msg.message || 'انتهت صلاحية الغرفة بسبب عدم النشاط',
        [{ label: t('createRoom'), onclick: 'hideModal(); goToLanding()', class: 'btn-accent' }]
      );
      break;

    case 'gameStarted':
      state.currentLetter = msg.letter;
      state.categories = msg.categories;
      state.round = msg.round;
      state.totalRounds = msg.totalRounds;
      state.answers = {};
      state.roundStopped = false;
      state.stopOverlayShown = false;
      if (state.lobbyExpiryTimer) { clearInterval(state.lobbyExpiryTimer); state.lobbyExpiryTimer = null; }
      state.categories.forEach(c => { state.answers[c] = ''; });
      startClientTimer(msg.timerSeconds);
      state.currentScreen = 'game';
      history.pushState({ screen: 'game' }, '', location.pathname);
      render();
      break;

    case 'roundStopped': {
      state.roundStopped = true;
      if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
      // Show stop overlay briefly
      if (!state.stopOverlayShown) {
        state.stopOverlayShown = true;
        showStopOverlay(msg.stoppedBy);
      }
      // Disable all inputs immediately
      document.querySelectorAll('.answer-input').forEach(inp => inp.disabled = true);
      document.querySelector('.stop-btn')?.setAttribute('disabled', '');
      // Submit current answers
      wsSend({ type: 'submitAnswers', answers: state.answers });
      break;
    }

    case 'votingPhase':
      hideStopOverlay();
      state.currentVotingCategory = msg.categoryIndex;
      state.votingCategory = msg.category;
      state.votingAnswers = msg.answers;
      state.votingTotalCategories = state.categories.length;
      state.localVotes = {};
      // Initialize local votes from prevalidation
      msg.answers.forEach(a => { state.localVotes[a.playerId] = a.valid; });
      startClientTimer(30);
      state.currentScreen = 'voting';
      render();
      break;

    case 'votingResult':
      // Show results briefly; next votingPhase or roundEnd will follow
      break;

    case 'roundEnd':
      if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
      state.roundScores = msg.scores;
      state.totalScores = msg.totalScores;
      state.round = msg.round;
      state.totalRounds = msg.totalRounds;
      state.currentScreen = 'roundEnd';
      render();
      break;

    case 'gameEnd':
      if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
      state.finalScores = msg.finalScores;
      state.ranking = msg.ranking;
      state.currentScreen = 'gameEnd';
      render();
      break;

    case 'backToLobby':
      state.players = msg.players;
      state.config = msg.config;
      state.expiresAt = msg.expiresAt || null;
      state.currentScreen = 'lobby';
      render();
      break;

    case 'timerSync':
      // Server-authoritative timer update
      updateTimerDisplay(msg.remaining);
      break;

    case 'error':
      // Handle specific error codes
      if (msg.code === 'ROOM_NOT_FOUND') {
        showModal(t('title'), msg.message || 'الغرفة غير موجودة', [
          { label: t('createRoom'), onclick: 'hideModal(); goToLanding()', class: 'btn-accent' }
        ]);
      } else {
        showToast(msg.message, 'error');
      }
      break;
  }
}

// ─── Timer helpers ────────────────────────────────────────────
function startClientTimer(seconds) {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timer = seconds;
  state.timerInterval = setInterval(() => {
    state.timer = Math.max(0, state.timer - 1);
    updateTimerDisplay(state.timer);
    if (state.timer <= 0) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }, 1000);
  updateTimerDisplay(seconds);
}

function updateTimerDisplay(val) {
  state.timer = val;
  const el = document.querySelector('.timer-display');
  if (el) {
    el.textContent = val;
    el.classList.toggle('urgent', val <= 10);
  }
  // Update progress bar in voting
  const bar = document.querySelector('.progress-bar');
  if (bar && state.currentScreen === 'voting') {
    bar.style.width = `${(val / 30) * 100}%`;
  }
}

// ─── Stop overlay ─────────────────────────────────────────────
function showStopOverlay(stoppedBy) {
  const existing = document.getElementById('stop-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'stop-overlay';
  overlay.id = 'stop-overlay';
  const who = stoppedBy ? `${stoppedBy} ${t('stoppedBy')}!` : t('timeUp');
  overlay.innerHTML = `
    <div class="stop-banner">
      <h2>STOP!</h2>
      <p>${who}</p>
    </div>`;
  document.body.appendChild(overlay);
}

function hideStopOverlay() {
  const el = document.getElementById('stop-overlay');
  if (el) el.remove();
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s';
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ─── Modal Dialog ─────────────────────────────────────────────
function showModal(title, message, actions = []) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  state.modalShown = true;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <h3 class="modal-title">${escHtml(title)}</h3>
      <p class="modal-msg">${escHtml(message)}</p>
      <div class="modal-actions">
        ${actions.map(a => `<button class="btn ${a.class || 'btn-primary'}" onclick="${a.onclick}">${escHtml(a.label)}</button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideModal();
  });
}

function hideModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
  state.modalShown = false;
}

// ─── Player color helper ──────────────────────────────────────
function playerColor(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

function playerInitial(name) {
  return name ? name.charAt(0) : '?';
}

// ─── Render: Top bar ──────────────────────────────────────────
function renderTopBar() {
  return `
    <div class="top-bar">
      <span class="logo">${t('title')}</span>
      <button class="lang-toggle" onclick="toggleLang()">${t('langToggle')}</button>
    </div>`;
}

// ─── Render: Player list ──────────────────────────────────────
function renderPlayerList() {
  const container = document.getElementById('player-list');
  if (!container) return;
  container.innerHTML = state.players.map((p, i) => `
    <div class="player-card${p.connected === false ? ' disconnected' : ''}">
      <div class="player-avatar" style="background:${playerColor(i)}">
        ${playerInitial(p.username)}
      </div>
      <span class="player-name">${escHtml(p.username)}</span>
      ${p.isHost ? `<span class="host-badge">${t('host')}</span>` : ''}
    </div>`).join('');
}

function renderLobbyActions() {
  const container = document.getElementById('lobby-actions');
  if (!container) return;
  const count = state.players.filter(p => p.connected !== false).length;
  if (state.isHost) {
    container.innerHTML = `
      <button class="btn btn-accent btn-lg w-full" onclick="doStartGame()" ${count < 2 ? 'disabled' : ''}>
        🎮 ${t('startGame')}
      </button>
      ${count < 2 ? `<p class="text-muted text-sm text-center mt-sm">${t('needTwoPlayers')}</p>` : ''}`;
  } else {
    container.innerHTML = `<p class="text-muted text-center">${t('waitingForHost')}</p>`;
  }
}

// ─── Render: Config panel ─────────────────────────────────────
function renderConfigPanel() {
  const container = document.getElementById('config-panel');
  if (!container || !state.config) return;
  const cfg = state.config;
  const disabled = !state.isHost ? 'disabled' : '';

  const letterChips = ARABIC_LETTERS.map(l => {
    const active = cfg.letters.includes(l) ? 'active' : '';
    return `<span class="chip ${active}" onclick="toggleLetter('${l}')">${l}</span>`;
  }).join('');

  const catChips = cfg.categories.map((c, i) => `
    <span class="chip-cat">
      ${escHtml(c)}
      ${state.isHost ? `<button class="remove-btn" onclick="removeCategory(${i})">×</button>` : ''}
    </span>`).join('');

  container.innerHTML = `
    <div class="config-panel">
      <div class="config-row">
        <div class="config-field">
          <label>${t('rounds')}</label>
          <input class="input" type="number" min="1" max="20" value="${cfg.roundCount}"
            ${disabled} onchange="onConfigChange('roundCount', +this.value)" />
        </div>
        <div class="config-field">
          <label>${t('timer')}</label>
          <input class="input" type="number" min="15" max="300" value="${cfg.timerSeconds}"
            ${disabled} onchange="onConfigChange('timerSeconds', +this.value)" />
        </div>
      </div>
      <div class="mb-md">
        <div class="section-label">${t('letters')}</div>
        <div class="chip-grid">${letterChips}</div>
      </div>
      <div>
        <div class="section-label">${t('categories')}</div>
        <div class="chip-grid mb-sm" id="cat-chips">${catChips}</div>
        ${state.isHost ? `
        <div class="input-group">
          <input class="input" type="text" id="new-cat-input" placeholder="${t('addCategory')}"
            maxlength="20" onkeydown="if(event.key==='Enter')addCategory()" />
          <button class="btn btn-outline btn-sm" onclick="addCategory()">${t('add')}</button>
        </div>` : ''}
      </div>
    </div>`;
}

// ─── Config actions ───────────────────────────────────────────
function onConfigChange(field, value) {
  if (!state.isHost) return;
  const update = { [field]: value };
  wsSend({ type: 'updateConfig', ...state.config, ...update });
}

function toggleLetter(letter) {
  if (!state.isHost) return;
  const letters = [...state.config.letters];
  const idx = letters.indexOf(letter);
  if (idx >= 0) {
    if (letters.length <= 1) { showToast(t('selectLetters'), 'error'); return; }
    letters.splice(idx, 1);
  } else {
    letters.push(letter);
  }
  wsSend({ type: 'updateConfig', ...state.config, letters });
}

function removeCategory(index) {
  if (!state.isHost) return;
  const cats = [...state.config.categories];
  cats.splice(index, 1);
  wsSend({ type: 'updateConfig', ...state.config, categories: cats });
}

function addCategory() {
  if (!state.isHost) return;
  const inp = document.getElementById('new-cat-input');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) return;
  if (state.config.categories.includes(val)) { showToast('الفئة موجودة بالفعل', 'error'); return; }
  const cats = [...state.config.categories, val];
  wsSend({ type: 'updateConfig', ...state.config, categories: cats });
  inp.value = '';
}

// ─── Game actions ─────────────────────────────────────────────
function doStartGame() { wsSend({ type: 'startGame' }); }

// Client-side mirror of server isValidAnswer
function isValidAnswerClient(answer, letter) {
  if (!answer || !answer.trim()) return false;
  const strip = s => s.replace(/[ًٌٍَُِّْ]/g, '');
  const normAlef = s => s.replace(/[أإآ]/g, 'ا');
  const norm = normAlef(strip(answer.trim()));
  const letterNorm = normAlef(strip(letter));
  if (norm === letterNorm) return false; // just the letter alone
  return norm.startsWith(letterNorm);
}

function allCategoriesFilled() {
  return state.categories.every(cat =>
    isValidAnswerClient(state.answers[cat] || '', state.currentLetter)
  );
}

function updateStopButton() {
  const btn = document.querySelector('.stop-btn');
  if (!btn) return;
  btn.disabled = state.roundStopped || !allCategoriesFilled();
}

function doStop() {
  if (state.roundStopped || !allCategoriesFilled()) return;
  wsSend({ type: 'stopRound' });
  state.roundStopped = true;
}

function onAnswerChange(category, value) {
  state.answers[category] = value;
  updateStopButton();
}

function doSubmitVotes() {
  wsSend({
    type: 'submitVotes',
    categoryIndex: state.currentVotingCategory,
    votes: state.localVotes
  });
  // Disable button
  const btn = document.getElementById('submit-votes-btn');
  if (btn) btn.disabled = true;
}

function toggleVote(playerId) {
  if (state.localVotes[playerId] === undefined) return;
  state.localVotes[playerId] = !state.localVotes[playerId];
  renderVoteCards();
}

function doNextRound() { wsSend({ type: 'nextRound' }); }
function doPlayAgain() { wsSend({ type: 'playAgain' }); }

// ─── Render helpers ───────────────────────────────────────────
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderVoteCards() {
  const container = document.getElementById('vote-cards-container');
  if (!container) return;
  container.innerHTML = state.votingAnswers.map(a => {
    const isEmpty = !a.answer || !a.answer.trim();
    const voteState = isEmpty ? 'empty' : (state.localVotes[a.playerId] ? 'valid' : 'invalid');
    const icon = isEmpty ? '—' : (state.localVotes[a.playerId] ? '✅' : '❌');
    return `
      <div class="vote-card ${voteState}" onclick="${isEmpty ? '' : `toggleVote('${a.playerId}')`}">
        <div class="vote-player-name">${escHtml(a.username)}</div>
        <div class="vote-answer">${escHtml(a.answer || t('noAnswer'))}</div>
        <div class="vote-status-icon">${icon}</div>
      </div>`;
  }).join('');
}

// ─── Main render ──────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  switch (state.currentScreen) {
    case 'landing':  app.innerHTML = renderLanding();  break;
    case 'lobby':    app.innerHTML = renderLobby();    afterLobbyRender(); break;
    case 'game':     app.innerHTML = renderGame();     break;
    case 'voting':   app.innerHTML = renderVoting();   break;
    case 'roundEnd': app.innerHTML = renderRoundEnd(); break;
    case 'gameEnd':  app.innerHTML = renderGameEnd();  break;
  }
}

// ─── Screen: Landing ─────────────────────────────────────────
function renderLanding() {
  const pathParts = location.pathname.split('/').filter(Boolean);
  const roomInUrl = pathParts[0] === 'lobby' && pathParts[1] ? pathParts[1].toUpperCase() : '';

  return `
    ${renderTopBar()}
    <div class="screen">
      <div class="landing-hero">
        <div class="game-logo">${t('title')}</div>
        <p class="subtitle">${t('subtitle')}</p>
      </div>
      <div class="card landing-form">
        <div class="form-field">
          <label for="username-input">${t('enterName')}</label>
          <input class="input" id="username-input" type="text"
            placeholder="${t('namePlaceholder')}"
            value="${escHtml(state.username)}" maxlength="20"
            onkeydown="if(event.key==='Enter')${roomInUrl ? 'doJoinFromUrl()' : 'doCreate()'}" />
        </div>
        ${roomInUrl ? `
        <div class="landing-actions">
          <button class="btn btn-accent btn-lg" onclick="doJoinFromUrl()">
            🚪 ${t('joinRoom')}: ${roomInUrl}
          </button>
          <button class="btn btn-outline" onclick="doCreate()">
            ✨ ${t('createRoom')}
          </button>
        </div>` : `
        <div class="landing-actions">
          <button class="btn btn-accent btn-lg" onclick="doCreate()">
            ✨ ${t('createRoom')}
          </button>
          <div class="divider"></div>
          <div class="section-label text-center">${t('joinRoom')}</div>
          <div class="input-group">
            <input class="input" id="join-code-input" type="text"
              placeholder="${t('joinPlaceholder')}" maxlength="6"
              style="text-transform:uppercase;font-family:var(--font-en);letter-spacing:0.15em"
              onkeydown="if(event.key==='Enter')doJoinByCode()" />
            <button class="btn btn-primary" onclick="doJoinByCode()">${t('join')}</button>
          </div>
        </div>`}
      </div>
    </div>`;
}

function getUsername() {
  const inp = document.getElementById('username-input');
  const name = inp ? inp.value.trim() : state.username;
  if (!name) { showToast(t('enterName'), 'error'); return null; }
  state.username = name;
  localStorage.setItem('abjad_username', name);
  return name;
}

function doCreate() {
  const name = getUsername();
  if (!name) return;
  connectWS(() => { wsSend({ type: 'createRoom', username: name }); });
}

function doJoinFromUrl() {
  const name = getUsername();
  if (!name) return;
  const pathParts = location.pathname.split('/').filter(Boolean);
  const roomId = pathParts[1]?.toUpperCase();
  if (!roomId) return;
  connectWS(() => { wsSend({ type: 'join', roomId, username: name }); });
}

function doJoinByCode() {
  const name = getUsername();
  if (!name) return;
  const codeInput = document.getElementById('join-code-input');
  const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
  if (!code || code.length < 4) { showToast('أدخل رمز الغرفة', 'error'); return; }
  connectWS(() => { wsSend({ type: 'join', roomId: code, username: name }); });
}

// ─── Screen: Lobby ────────────────────────────────────────────
function renderLobby() {
  const link = `${location.origin}/lobby/${state.roomId}`;
  // Lobby expiry badge
  let expiryBadge = '';
  if (state.expiresAt) {
    const remaining = Math.max(0, Math.ceil((state.expiresAt - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const urgent = remaining <= 60;
    expiryBadge = `
      <div class="room-code-header">
        <div class="room-code-label">${t('roomCode')}</div>
        <span class="lobby-expiry-badge${urgent ? ' urgent' : ''}">
          ⏱ ${mins}:${secs.toString().padStart(2, '0')}
        </span>
      </div>`;
  } else {
    expiryBadge = `<div class="room-code-label">${t('roomCode')}</div>`;
  }

  return `
    ${renderTopBar()}
    <div class="screen">
      <div class="room-code-box">
        <div>
          ${expiryBadge}
          <div class="room-code-display">
            <input class="room-code-input" type="text" value="${state.roomId}" readonly tabindex="-1" />
            <button class="btn btn-outline btn-sm" onclick="copyLink('${link}')">
              🔗 ${t('copyLink')}
            </button>
          </div>
        </div>
      </div>

      <div class="lobby-layout">
        <div>
          <div class="card">
            <h3 class="mb-md">👥 ${t('players')} (${state.players.length})</h3>
            <div class="player-list" id="player-list"></div>
          </div>
          <div id="lobby-actions"></div>
        </div>
        <div class="card" id="config-card">
          <h3 class="mb-md">⚙️ ${t('config')}</h3>
          <div id="config-panel"></div>
        </div>
      </div>
    </div>`;
}

function afterLobbyRender() {
  renderPlayerList();
  renderConfigPanel();
  renderLobbyActions();
  startLobbyExpiryTimer();
}

function startLobbyExpiryTimer() {
  if (state.lobbyExpiryTimer) clearInterval(state.lobbyExpiryTimer);
  if (!state.expiresAt || state.currentScreen !== 'lobby') return;

  state.lobbyExpiryTimer = setInterval(() => {
    if (state.currentScreen !== 'lobby' || !state.expiresAt) {
      clearInterval(state.lobbyExpiryTimer);
      state.lobbyExpiryTimer = null;
      return;
    }
    const remaining = Math.max(0, Math.ceil((state.expiresAt - Date.now()) / 1000));
    const badge = document.querySelector('.lobby-expiry-badge');
    if (badge) {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      badge.textContent = `⏱ ${mins}:${secs.toString().padStart(2, '0')}`;
      badge.classList.toggle('urgent', remaining <= 60);
    }
  }, 1000);
}

function copyLink(link) {
  navigator.clipboard.writeText(link).then(() => {
    showToast(t('copySuccess'), 'success');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = link;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast(t('copySuccess'), 'success');
  });
}

// ─── Screen: Game ─────────────────────────────────────────────
function renderGame() {
  const fields = state.categories.map(cat => `
    <div class="answer-field-wrap">
      <div class="answer-field-label">
        <span class="letter-hint">${state.currentLetter}</span>
        ${escHtml(cat)}
      </div>
      <input class="answer-input" type="text"
        placeholder="${state.currentLetter}..."
        value="${escHtml(state.answers[cat] || '')}"
        oninput="onAnswerChange('${escHtml(cat)}', this.value)"
        ${state.roundStopped ? 'disabled' : ''}
        maxlength="30" />
    </div>`).join('');

  return `
    ${renderTopBar()}
    <div class="screen game-screen">
      <div class="game-header">
        <div class="round-badge">
          ${t('round')} ${state.round} ${t('of')} ${state.totalRounds}
        </div>
        <div class="timer-display${state.timer <= 10 ? ' urgent' : ''}">${state.timer}</div>
      </div>

      <div class="letter-display-wrap">
        <div class="letter-display">${state.currentLetter}</div>
      </div>

      <div class="answer-fields">${fields}</div>

      <div class="stop-btn-wrap">
        <button class="stop-btn" onclick="doStop()" ${state.roundStopped || !allCategoriesFilled() ? 'disabled' : ''}>
          ${t('stop')}
        </button>
      </div>
    </div>`;
}

// ─── Screen: Voting ───────────────────────────────────────────
function renderVoting() {
  return `
    ${renderTopBar()}
    <div class="screen">
      <div class="voting-header">
        <div class="text-muted text-sm mb-sm">${t('votingFor')}</div>
        <div class="vote-category-name">${escHtml(state.votingCategory)}</div>
        <div class="vote-progress">
          ${state.currentVotingCategory + 1} / ${state.votingTotalCategories || state.categories.length}
        </div>
      </div>

      <div class="progress-bar-wrap">
        <div class="progress-bar" style="width:${(state.timer/30)*100}%"></div>
      </div>

      <div class="vote-cards" id="vote-cards-container"></div>

      <div class="flex justify-center mt-md">
        <button class="btn btn-primary btn-lg" id="submit-votes-btn" onclick="doSubmitVotes()">
          ✓ ${t('submitVotes')}
        </button>
      </div>
    </div>`;
}

// ─── Screen: Round End ────────────────────────────────────────
function renderRoundEnd() {
  const players = state.players;
  const rows = players.map((p, i) => {
    const rs = state.roundScores?.[p.id];
    const ts = state.totalScores?.[p.id];
    return `
      <tr>
        <td>
          <div class="flex items-center gap-sm">
            <div class="player-avatar" style="background:${playerColor(i)};width:28px;height:28px;font-size:0.8rem">
              ${playerInitial(p.username)}
            </div>
            ${escHtml(p.username)}
          </div>
        </td>
        <td class="score-pts">${rs?.score ?? 0}</td>
        <td class="score-total-pts">${ts?.score ?? 0}</td>
      </tr>`;
  }).join('');

  return `
    ${renderTopBar()}
    <div class="screen">
      <div class="card text-center mb-md">
        <h2 class="title-gradient mb-sm">🏅 ${t('roundResults')}</h2>
        <p class="text-muted">${t('round')} ${state.round} ${t('of')} ${state.totalRounds}</p>
      </div>
      <div class="card">
        <table class="score-table">
          <thead>
            <tr>
              <th>${t('player')}</th>
              <th style="text-align:center">${t('thisRound')}</th>
              <th style="text-align:center">${t('total')}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="flex justify-center mt-md">
        ${state.isHost
          ? `<button class="btn btn-accent btn-lg" onclick="doNextRound()">▶ ${t('nextRound')}</button>`
          : `<p class="text-muted">${t('waitingForHost')}</p>`}
      </div>
    </div>`;
}

// ─── Screen: Game End ─────────────────────────────────────────
function renderGameEnd() {
  const ranking = state.ranking || [];
  const winner = ranking[0];

  const medals = [t('position1'), t('position2'), t('position3')];
  const rankClasses = ['gold', 'silver', 'bronze'];

  const items = ranking.map((p, i) => {
    const medal = medals[i] || `${i + 1}`;
    const rankCls = rankClasses[i] || '';
    const playerIdx = state.players.findIndex(pl => pl.id === p.playerId);
    return `
      <li class="ranking-item" style="animation-delay:${i * 0.1}s">
        <div class="rank-pos ${rankCls}">${medal}</div>
        <div class="player-avatar" style="background:${playerColor(playerIdx >= 0 ? playerIdx : i)}">
          ${playerInitial(p.username)}
        </div>
        <div class="rank-name">${escHtml(p.username)}</div>
        <div class="rank-score">${p.score} <span style="font-size:0.8rem;color:var(--text-muted)">${t('points')}</span></div>
      </li>`;
  }).join('');

  return `
    ${renderTopBar()}
    <div class="screen">
      ${winner ? `
      <div class="winner-banner card">
        <span class="trophy">🏆</span>
        <div class="winner-name">${escHtml(winner.username)}</div>
        <p class="text-muted mt-sm">${t('winner')}</p>
      </div>` : ''}

      <div class="return-lobby-banner">
        <div class="return-lobby-info">
          <span>🏠</span>
          <span>انتهت اللعبة — يمكن العودة للوبي</span>
        </div>
      </div>

      <div class="card">
        <h2 class="title-gradient mb-md">🎖 ${t('finalResults')}</h2>
        <ul class="ranking-list">${items}</ul>
      </div>

      ${state.isHost
        ? `<div class="flex justify-center mt-md">
             <button class="btn btn-accent btn-lg" onclick="doPlayAgain()">🔄 ${t('playAgain')}</button>
           </div>`
        : `<p class="text-muted text-center mt-md">${t('waitingForHost')}</p>`}
    </div>`;
}

// ─── Routing ──────────────────────────────────────────────────
function goToLanding() {
  // Close WS cleanly
  if (state.ws) {
    state.ws.onclose = null; // suppress any reconnect logic
    state.ws.close();
    state.ws = null;
  }
  // Clear timers
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
  if (state.lobbyExpiryTimer) { clearInterval(state.lobbyExpiryTimer); state.lobbyExpiryTimer = null; }
  // Reset relevant state
  state.playerId = null;
  state.roomId = null;
  state.isHost = false;
  state.players = [];
  state.config = null;
  state.expiresAt = null;
  state.lobbyExpiryTimer = null;
  state.roundStopped = false;
  state.stopOverlayShown = false;
  state.modalShown = false;
  state.currentScreen = 'landing';
  history.replaceState({ screen: 'landing' }, '', '/');
  render();
}

function initRouting() {
  const pathParts = location.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'lobby' && pathParts[1]) {
    // Deep-link with room code — show landing with join prompt
    history.replaceState({ screen: 'landing', roomId: pathParts[1].toUpperCase() }, '', location.pathname);
  } else {
    history.replaceState({ screen: 'landing' }, '', '/');
  }
  state.currentScreen = 'landing';

  // Back button: always return to landing from lobby/game screens
  window.addEventListener('popstate', () => {
    if (state.currentScreen !== 'landing') {
      goToLanding();
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────
function init() {
  initRouting();
  render();
}

// Expose globals for inline event handlers
window.toggleLang = toggleLang;
window.doCreate = doCreate;
window.doJoinFromUrl = doJoinFromUrl;
window.doJoinByCode = doJoinByCode;
window.doStartGame = doStartGame;
window.doStop = doStop;
window.doNextRound = doNextRound;
window.doPlayAgain = doPlayAgain;
window.doSubmitVotes = doSubmitVotes;
window.onAnswerChange = onAnswerChange;
window.onConfigChange = onConfigChange;
window.toggleLetter = toggleLetter;
window.removeCategory = removeCategory;
window.addCategory = addCategory;
window.copyLink = copyLink;
window.toggleVote = toggleVote;
window.renderVoteCards = renderVoteCards;
window.goToLanding = goToLanding;
window.updateStopButton = updateStopButton;

// Kick off
document.addEventListener('DOMContentLoaded', init);

// After voting screen renders, populate cards
const origRender = render;
window.render = function() {
  origRender();
  if (state.currentScreen === 'voting') {
    renderVoteCards();
  }
};

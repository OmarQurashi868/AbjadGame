const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback - serve index.html for non-static routes only
app.get(/^\/(?!.*\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map)$).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// In-memory store
const rooms = new Map(); // roomId -> Room
const clients = new Map(); // ws -> { playerId, roomId, username }

const ARABIC_LETTERS = [
  'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش',
  'ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي'
];

const DEFAULT_CATEGORIES = [
  'ولد','بنت','حيوان','جماد','نبات','دولة','وجبة','مشهور','لعبة','وسائط'
];

const DEFAULT_CONFIG = {
  roundCount: 5,
  timerSeconds: 120,
  letters: [...ARABIC_LETTERS],
  categories: [...DEFAULT_CATEGORIES]
};

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function generatePlayerId() {
  return uuidv4().replace(/-/g, '').substring(0, 12);
}

function broadcast(room, message, excludeWs = null) {
  const data = JSON.stringify(message);
  room.players.forEach(player => {
    if (player.ws && player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  });
}

function sendToPlayer(ws, message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function getPublicPlayers(room) {
  return room.players.map(p => ({
    id: p.id,
    username: p.username,
    isHost: p.id === room.hostId,
    connected: p.connected
  }));
}

function createRoom(ws, username) {
  let roomId;
  do {
    roomId = generateRoomId();
  } while (rooms.has(roomId));

  const playerId = generatePlayerId();
  const player = {
    id: playerId,
    username,
    ws,
    connected: true
  };

  const room = {
    id: roomId,
    hostId: playerId,
    players: [player],
    config: { ...DEFAULT_CONFIG, letters: [...ARABIC_LETTERS], categories: [...DEFAULT_CATEGORIES] },
    state: 'lobby', // lobby | playing | voting | roundEnd | gameEnd
    round: 0,
    currentLetter: null,
    answers: {}, // playerId -> { category: answer }
    votes: {},   // categoryIndex -> { voterId -> { targetPlayerId -> bool } }
    categoryVoteCount: {},
    scores: {},  // playerId -> score per round
    totalScores: {}, // playerId -> cumulative
    timerHandle: null,
    votingTimerHandle: null,
    currentCategoryIndex: 0,
    pendingVotes: new Set(), // playerIds who haven't submitted votes
    roundStoppedBy: null
  };

  rooms.set(roomId, room);
  clients.set(ws, { playerId, roomId, username });

  sendToPlayer(ws, { type: 'roomCreated', roomId });
  sendToPlayer(ws, {
    type: 'roomJoined',
    roomId,
    players: getPublicPlayers(room),
    config: room.config,
    isHost: true,
    playerId
  });

  console.log(`Room ${roomId} created by ${username}`);
  return room;
}

function joinRoom(ws, roomId, username) {
  const room = rooms.get(roomId);
  if (!room) {
    sendToPlayer(ws, { type: 'error', message: 'الغرفة غير موجودة' });
    return;
  }

  if (room.state !== 'lobby') {
    sendToPlayer(ws, { type: 'error', message: 'اللعبة بدأت بالفعل' });
    return;
  }

  // Check if reconnecting
  const existing = room.players.find(p => p.username === username && !p.connected);
  if (existing) {
    existing.ws = ws;
    existing.connected = true;
    clients.set(ws, { playerId: existing.id, roomId, username });
    sendToPlayer(ws, {
      type: 'roomJoined',
      roomId,
      players: getPublicPlayers(room),
      config: room.config,
      isHost: existing.id === room.hostId,
      playerId: existing.id
    });
    broadcast(room, { type: 'playerJoined', players: getPublicPlayers(room) }, ws);
    return;
  }

  const playerId = generatePlayerId();
  const player = { id: playerId, username, ws, connected: true };
  room.players.push(player);
  clients.set(ws, { playerId, roomId, username });

  sendToPlayer(ws, {
    type: 'roomJoined',
    roomId,
    players: getPublicPlayers(room),
    config: room.config,
    isHost: false,
    playerId
  });

  broadcast(room, { type: 'playerJoined', players: getPublicPlayers(room) }, ws);
  console.log(`${username} joined room ${roomId}`);
}

function startGame(ws) {
  const clientInfo = clients.get(ws);
  if (!clientInfo) return;
  const room = rooms.get(clientInfo.roomId);
  if (!room) return;
  if (room.hostId !== clientInfo.playerId) {
    sendToPlayer(ws, { type: 'error', message: 'فقط المضيف يمكنه بدء اللعبة' });
    return;
  }
  if (room.players.filter(p => p.connected).length < 2) {
    sendToPlayer(ws, { type: 'error', message: 'يجب أن يكون هناك لاعبان على الأقل' });
    return;
  }
  if (room.state !== 'lobby') return;

  // Init scores
  room.players.forEach(p => {
    room.totalScores[p.id] = 0;
  });

  startRound(room);
}

function pickLetter(room) {
  const avail = room.config.letters;
  return avail[Math.floor(Math.random() * avail.length)];
}

function startRound(room) {
  room.round++;
  room.state = 'playing';
  room.answers = {};
  room.scores = {};
  room.roundStoppedBy = null;
  room.currentCategoryIndex = 0;

  // Init per-player score to 0
  room.players.forEach(p => { room.scores[p.id] = 0; });

  room.currentLetter = pickLetter(room);

  const msg = {
    type: 'gameStarted',
    letter: room.currentLetter,
    categories: room.config.categories,
    timerSeconds: room.config.timerSeconds,
    round: room.round,
    totalRounds: room.config.roundCount
  };

  broadcast(room, msg);

  // Start countdown
  let remaining = room.config.timerSeconds;
  room.timerHandle = setInterval(() => {
    remaining--;
    broadcast(room, { type: 'timerSync', remaining });
    if (remaining <= 0) {
      clearInterval(room.timerHandle);
      room.timerHandle = null;
      endRoundCollect(room, null);
    }
  }, 1000);
}

function stopRound(ws) {
  const clientInfo = clients.get(ws);
  if (!clientInfo) return;
  const room = rooms.get(clientInfo.roomId);
  if (!room || room.state !== 'playing') return;

  if (room.timerHandle) {
    clearInterval(room.timerHandle);
    room.timerHandle = null;
  }

  endRoundCollect(room, clientInfo.playerId);
}

function endRoundCollect(room, stoppedByPlayerId) {
  if (room.state !== 'playing') return;
  room.state = 'collecting';

  const stoppedBy = stoppedByPlayerId
    ? room.players.find(p => p.id === stoppedByPlayerId)?.username || null
    : null;

  broadcast(room, { type: 'roundStopped', stoppedBy });

  // Give 2 seconds for last answers to arrive, then start voting
  setTimeout(() => startVoting(room), 2500);
}

function submitAnswers(ws, answers) {
  const clientInfo = clients.get(ws);
  if (!clientInfo) return;
  const room = rooms.get(clientInfo.roomId);
  if (!room || (room.state !== 'playing' && room.state !== 'collecting')) return;

  room.answers[clientInfo.playerId] = answers;
}

function startVoting(room) {
  room.state = 'voting';
  room.currentCategoryIndex = 0;
  room.votes = {};
  sendCategoryVoting(room);
}

function sendCategoryVoting(room) {
  const catIndex = room.currentCategoryIndex;
  const category = room.config.categories[catIndex];

  // Build answers array — only include currently connected players
  const activePlayers = room.players.filter(p => p.connected);
  const answersArr = activePlayers.map(p => {
    const ans = (room.answers[p.id] || {})[category] || '';
    const valid = isValidAnswer(ans, room.currentLetter);
    return { playerId: p.id, username: p.username, answer: ans, valid };
  });

  room.votes[catIndex] = {}; // voterId -> { playerId -> bool }

  // Track who needs to vote
  room.pendingVotes = new Set(activePlayers.map(p => p.id));

  broadcast(room, {
    type: 'votingPhase',
    categoryIndex: catIndex,
    category,
    answers: answersArr
  });

  // Voting timer: 30 seconds per category
  let remaining = 30;
  room.votingTimerHandle = setInterval(() => {
    remaining--;
    broadcast(room, { type: 'timerSync', remaining });
    if (remaining <= 0) {
      clearInterval(room.votingTimerHandle);
      room.votingTimerHandle = null;
      resolveVoting(room, catIndex);
    }
  }, 1000);
}

function isValidAnswer(answer, letter) {
  if (!answer || !answer.trim()) return false;
  const normalized = answer.trim().replace(/[ًٌٍَُِّْ]/g, ''); // strip diacritics
  const letterNorm = letter.replace(/[ًٌٍَُِّْ]/g, '');
  if (normalized === letterNorm) return false; // just the letter alone
  // Normalize alef forms
  const normalizeAlef = s => s.replace(/[أإآ]/g, 'ا');
  return normalizeAlef(normalized).startsWith(normalizeAlef(letterNorm));
}

function submitVotes(ws, categoryIndex, votes) {
  const clientInfo = clients.get(ws);
  if (!clientInfo) return;
  const room = rooms.get(clientInfo.roomId);
  if (!room || room.state !== 'voting') return;
  if (room.currentCategoryIndex !== categoryIndex) return;

  if (!room.votes[categoryIndex]) room.votes[categoryIndex] = {};
  room.votes[categoryIndex][clientInfo.playerId] = votes;
  room.pendingVotes.delete(clientInfo.playerId);

  if (room.pendingVotes.size === 0) {
    if (room.votingTimerHandle) {
      clearInterval(room.votingTimerHandle);
      room.votingTimerHandle = null;
    }
    resolveVoting(room, categoryIndex);
  }
}

function resolveVoting(room, catIndex) {
  if (room.state !== 'voting') return;
  const category = room.config.categories[catIndex];

  // Build final validity from votes: majority rules; if no votes, use pre-validation
  const playerAnswers = room.players.filter(p => p.connected).map(p => {
    const ans = (room.answers[p.id] || {})[category] || '';
    const preValid = isValidAnswer(ans, room.currentLetter);
    return { playerId: p.id, username: p.username, answer: ans, preValid };
  });

  const results = {};
  playerAnswers.forEach(({ playerId, answer, preValid }) => {
    // Count votes against this player
    let validVotes = 0, invalidVotes = 0;
    Object.values(room.votes[catIndex] || {}).forEach(voterVotes => {
      if (voterVotes[playerId] === false) {
        invalidVotes++;
      } else {
        validVotes++;
      }
    });

    let finalValid = preValid;
    if (invalidVotes + validVotes > 0) {
      finalValid = invalidVotes > validVotes ? false : preValid;
    }

    results[playerId] = { answer, valid: finalValid };
  });

  broadcast(room, { type: 'votingResult', categoryIndex: catIndex, results });

  // Advance
  room.currentCategoryIndex++;
  if (room.currentCategoryIndex < room.config.categories.length) {
    setTimeout(() => sendCategoryVoting(room), 1500);
  } else {
    setTimeout(() => calculateScores(room), 1500);
  }
}

function normalizeForCompare(str) {
  if (!str) return '';
  return str.trim()
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .toLowerCase();
}

function calculateScores(room) {
  room.state = 'roundEnd';
  const categories = room.config.categories;

  // Per category, compute scores
  categories.forEach(category => {
    // Collect valid answers per player
    const validAnswers = {}; // playerId -> normalizedAnswer
    room.players.forEach(p => {
      const ans = (room.answers[p.id] || {})[category] || '';
      // Get the resolved validity from all vote results
      let valid = isValidAnswer(ans, room.currentLetter);
      // Check last resolved votes
      // (we rely on votes obj even after resolveVoting updated results)
      // Simple approach: recompute from stored votes
      const catVotes = room.votes[categories.indexOf(category)] || {};
      let invalidCount = 0, voteCount = 0;
      Object.values(catVotes).forEach(voterVotes => {
        if (voterVotes[p.id] === false) invalidCount++;
        voteCount++;
      });
      if (voteCount > 0 && invalidCount > voteCount / 2) valid = false;

      if (valid && ans.trim()) {
        validAnswers[p.id] = normalizeForCompare(ans);
      }
    });

    // Group by normalized answer to find shared/unique
    const answerGroups = {}; // normalized -> [playerIds]
    Object.entries(validAnswers).forEach(([pid, norm]) => {
      if (!answerGroups[norm]) answerGroups[norm] = [];
      answerGroups[norm].push(pid);
    });

    // Assign points
    Object.entries(answerGroups).forEach(([norm, pids]) => {
      const pts = pids.length === 1 ? 10 : 5;
      pids.forEach(pid => {
        room.scores[pid] = (room.scores[pid] || 0) + pts;
      });
    });
  });

  // Accumulate total scores
  room.players.forEach(p => {
    room.totalScores[p.id] = (room.totalScores[p.id] || 0) + (room.scores[p.id] || 0);
  });

  const scoresPayload = {};
  const totalPayload = {};
  room.players.forEach(p => {
    scoresPayload[p.id] = { username: p.username, score: room.scores[p.id] || 0 };
    totalPayload[p.id] = { username: p.username, score: room.totalScores[p.id] || 0 };
  });

  if (room.round >= room.config.roundCount) {
    // Game over
    room.state = 'gameEnd';
    const ranking = Object.entries(totalPayload)
      .map(([id, v]) => ({ playerId: id, username: v.username, score: v.score }))
      .sort((a, b) => b.score - a.score);

    broadcast(room, {
      type: 'gameEnd',
      finalScores: totalPayload,
      ranking
    });
  } else {
    broadcast(room, {
      type: 'roundEnd',
      scores: scoresPayload,
      totalScores: totalPayload,
      round: room.round,
      totalRounds: room.config.roundCount
    });
  }
}

function nextRound(ws) {
  const clientInfo = clients.get(ws);
  if (!clientInfo) return;
  const room = rooms.get(clientInfo.roomId);
  if (!room || room.hostId !== clientInfo.playerId) return;
  if (room.state !== 'roundEnd') return;
  startRound(room);
}

function playAgain(ws) {
  const clientInfo = clients.get(ws);
  if (!clientInfo) return;
  const room = rooms.get(clientInfo.roomId);
  if (!room || room.hostId !== clientInfo.playerId) return;
  if (room.state !== 'gameEnd') return;

  // Reset
  room.round = 0;
  room.totalScores = {};
  room.scores = {};
  room.answers = {};
  room.votes = {};
  room.state = 'lobby';
  room.players.forEach(p => { room.totalScores[p.id] = 0; });

  broadcast(room, {
    type: 'backToLobby',
    players: getPublicPlayers(room),
    config: room.config
  });
}

function updateConfig(ws, config) {
  const clientInfo = clients.get(ws);
  if (!clientInfo) return;
  const room = rooms.get(clientInfo.roomId);
  if (!room || room.hostId !== clientInfo.playerId) return;
  if (room.state !== 'lobby') return;

  if (config.roundCount !== undefined) room.config.roundCount = Math.max(1, Math.min(20, config.roundCount));
  if (config.timerSeconds !== undefined) room.config.timerSeconds = Math.max(15, Math.min(300, config.timerSeconds));
  if (config.letters !== undefined && Array.isArray(config.letters) && config.letters.length > 0) {
    room.config.letters = config.letters.filter(l => ARABIC_LETTERS.includes(l));
  }
  if (config.categories !== undefined && Array.isArray(config.categories)) {
    room.config.categories = config.categories.filter(c => c && c.trim()).slice(0, 20);
  }

  broadcast(room, { type: 'configUpdated', config: room.config });
}

function handleDisconnect(ws) {
  const clientInfo = clients.get(ws);
  if (!clientInfo) return;

  const { playerId, roomId } = clientInfo;
  const room = rooms.get(roomId);
  if (!room) {
    clients.delete(ws);
    return;
  }

  const player = room.players.find(p => p.id === playerId);
  if (player) {
    player.connected = false;
    player.ws = null;
  }

  clients.delete(ws);

  const connectedPlayers = room.players.filter(p => p.connected);

  if (connectedPlayers.length === 0) {
    // Clean up room after a delay
    setTimeout(() => {
      if (rooms.has(roomId)) {
        const r = rooms.get(roomId);
        if (r.players.filter(p => p.connected).length === 0) {
          clearInterval(r.timerHandle);
          clearInterval(r.votingTimerHandle);
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    }, 60000);
    return;
  }

  // If host left, reassign host
  if (room.hostId === playerId) {
    const newHost = connectedPlayers[0];
    room.hostId = newHost.id;
    console.log(`Host reassigned to ${newHost.username} in room ${roomId}`);
  }

  broadcast(room, {
    type: 'playerLeft',
    players: getPublicPlayers(room),
    hostId: room.hostId
  });

  // If in voting and the disconnected player was pending
  if (room.state === 'voting') {
    room.pendingVotes.delete(playerId);
    if (room.pendingVotes.size === 0) {
      if (room.votingTimerHandle) {
        clearInterval(room.votingTimerHandle);
        room.votingTimerHandle = null;
      }
      resolveVoting(room, room.currentCategoryIndex);
    }
  }
}

// WebSocket message handler
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      sendToPlayer(ws, { type: 'error', message: 'Invalid message format' });
      return;
    }

    switch (msg.type) {
      case 'createRoom':
        if (!msg.username || !msg.username.trim()) {
          sendToPlayer(ws, { type: 'error', message: 'اسم المستخدم مطلوب' });
          return;
        }
        createRoom(ws, msg.username.trim());
        break;

      case 'join':
        if (!msg.username || !msg.username.trim() || !msg.roomId) {
          sendToPlayer(ws, { type: 'error', message: 'بيانات غير صحيحة' });
          return;
        }
        joinRoom(ws, msg.roomId.toUpperCase(), msg.username.trim());
        break;

      case 'updateConfig':
        updateConfig(ws, msg);
        break;

      case 'startGame':
        startGame(ws);
        break;

      case 'submitAnswers':
        submitAnswers(ws, msg.answers || {});
        break;

      case 'stopRound':
        stopRound(ws);
        break;

      case 'submitVotes':
        submitVotes(ws, msg.categoryIndex, msg.votes || {});
        break;

      case 'nextRound':
        nextRound(ws);
        break;

      case 'playAgain':
        playAgain(ws);
        break;

      default:
        sendToPlayer(ws, { type: 'error', message: `Unknown message type: ${msg.type}` });
    }
  });

  ws.on('close', () => handleDisconnect(ws));
  ws.on('error', () => handleDisconnect(ws));
});

server.listen(PORT, () => {
  console.log(`🎮 Abjad Game server running on http://localhost:${PORT}`);
});

/**
 * Monopoly Client - Complete UI Overhaul
 * Features: AI, Zoom/Pan, 3D Dice, Bills, Property Cards, Animated Movement
 */

const socket = io();

// Game state
let gameState = null;
let playerId = null;
let gameCode = null;
let boardData = null;
let selectedProperty = null;
let isHost = false;

// Zoom and pan state
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Auto camera state
let autoCameraEnabled = true;

// Animation state - track when animations are in progress
let animationInProgress = false;
let pendingBuyPhase = false;

// Bills system - track actual denominations
let playerBills = {
  500: 2,
  100: 4,
  50: 1,
  20: 1,
  10: 1,
  5: 1,
  1: 5
};

// Color mappings
const colorGroupCSS = {
  brown: '#8B4513',
  lightBlue: '#87CEEB',
  pink: '#FF69B4',
  orange: '#FFA500',
  red: '#FF0000',
  yellow: '#FFFF00',
  green: '#008000',
  darkBlue: '#00008B',
  railroad: '#333333',
  utility: '#999999'
};

const colorGroupCosts = {
  brown: 50,
  lightBlue: 50,
  pink: 100,
  orange: 100,
  red: 150,
  yellow: 150,
  green: 200,
  darkBlue: 200
};

// DOM Elements cache
const elements = {};

/**
 * Initialize application
 */
async function init() {
  cacheElements();
  loadDarkModePreference();

  try {
    const response = await fetch('/api/board-data');
    boardData = await response.json();
  } catch (error) {
    console.error('Failed to load board data:', error);
    showNotification('Failed to connect to server', 'error');
    return;
  }

  setupEventListeners();
  setupSocketHandlers();
  setupZoomPan();
  updateAutoCameraButton();
}

/**
 * Cache DOM elements
 */
function cacheElements() {
  elements.lobbyScreen = document.getElementById('lobby-screen');
  elements.waitingRoom = document.getElementById('waiting-room');
  elements.gameScreen = document.getElementById('game-screen');

  // Lobby
  elements.spName = document.getElementById('sp-name');
  elements.aiCount = document.getElementById('ai-count');
  elements.startSpBtn = document.getElementById('start-sp-btn');
  elements.hostName = document.getElementById('host-name');
  elements.joinName = document.getElementById('join-name');
  elements.gameCodeInput = document.getElementById('game-code');
  elements.createGameBtn = document.getElementById('create-game-btn');
  elements.joinGameBtn = document.getElementById('join-game-btn');
  elements.lobbyError = document.getElementById('lobby-error');

  // Waiting room
  elements.displayGameCode = document.getElementById('display-game-code');
  elements.playerCount = document.getElementById('player-count');
  elements.lobbyPlayers = document.getElementById('lobby-players');
  elements.startGameBtn = document.getElementById('start-game-btn');
  elements.waitingText = document.getElementById('waiting-text');

  // Game
  elements.boardViewport = document.getElementById('board-viewport');
  elements.gameBoard = document.getElementById('game-board');
  elements.playersInfo = document.getElementById('players-info');
  elements.gameLog = document.getElementById('game-log');
  elements.moneyTotal = document.getElementById('money-total');
  elements.billsDisplay = document.getElementById('bills-display');
  elements.propertyCardsContainer = document.getElementById('property-cards-container');
  elements.freeParkingAmount = document.getElementById('free-parking-amount');

  // Modals
  elements.actionModal = document.getElementById('action-modal');
  elements.actionTitle = document.getElementById('action-title');
  elements.actionDetails = document.getElementById('action-details');
  elements.actionButtons = document.getElementById('action-buttons');
  elements.propertyModal = document.getElementById('property-modal');
  elements.propertyCardDisplay = document.getElementById('property-card-display');
  elements.modalBillsPreview = document.getElementById('modal-bills-preview');
  elements.modalBuyBtn = document.getElementById('modal-buy-btn');
  elements.modalDeclineBtn = document.getElementById('modal-decline-btn');
  elements.propertyInfoModal = document.getElementById('property-info-modal');
  elements.propertyInfoCard = document.getElementById('property-info-card');
  elements.propertyInfoActions = document.getElementById('property-info-actions');
  elements.closePropertyInfo = document.getElementById('close-property-info');
  elements.propertyTooltip = document.getElementById('property-tooltip');

  // Zoom controls
  elements.zoomInBtn = document.getElementById('zoom-in-btn');
  elements.zoomOutBtn = document.getElementById('zoom-out-btn');
  elements.zoomResetBtn = document.getElementById('zoom-reset-btn');
  elements.autoCameraBtn = document.getElementById('auto-camera-btn');

  // Dark mode
  elements.darkModeBtn = document.getElementById('dark-mode-btn');

  // Other
  elements.gameOverModal = document.getElementById('game-over-modal');
  elements.winnerAnnouncement = document.getElementById('winner-announcement');
  elements.returnLobbyBtn = document.getElementById('return-lobby-btn');
  elements.notification = document.getElementById('notification');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    });
  });

  // Singleplayer
  elements.startSpBtn.addEventListener('click', startSingleplayer);
  elements.spName.addEventListener('keypress', e => { if (e.key === 'Enter') startSingleplayer(); });

  // Multiplayer
  elements.createGameBtn.addEventListener('click', createGame);
  elements.hostName.addEventListener('keypress', e => { if (e.key === 'Enter') createGame(); });
  elements.joinGameBtn.addEventListener('click', joinGame);
  elements.gameCodeInput.addEventListener('keypress', e => { if (e.key === 'Enter') joinGame(); });
  elements.gameCodeInput.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });
  elements.startGameBtn.addEventListener('click', startGame);

  // Property modal buttons
  elements.modalBuyBtn.addEventListener('click', buyProperty);
  elements.modalDeclineBtn.addEventListener('click', declineBuy);

  // Property info modal
  elements.closePropertyInfo.addEventListener('click', () => {
    elements.propertyInfoModal.style.display = 'none';
  });

  // Zoom controls
  elements.zoomInBtn.addEventListener('click', () => zoomBoard(1.2));
  elements.zoomOutBtn.addEventListener('click', () => zoomBoard(0.8));
  elements.zoomResetBtn.addEventListener('click', resetZoom);
  elements.autoCameraBtn.addEventListener('click', toggleAutoCamera);

  // Dark mode toggle
  elements.darkModeBtn.addEventListener('click', toggleDarkMode);

  // Return to lobby
  elements.returnLobbyBtn.addEventListener('click', () => window.location.reload());
}

/**
 * Setup zoom and pan controls
 */
function setupZoomPan() {
  const viewport = elements.boardViewport;

  // Mouse wheel zoom - disables auto camera
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    disableAutoCamera();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoomBoard(delta);
  });

  // Middle mouse pan - disables auto camera
  viewport.addEventListener('mousedown', (e) => {
    if (e.button === 1) { // Middle mouse button
      e.preventDefault();
      disableAutoCamera();
      isPanning = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      viewport.style.cursor = 'grabbing';
    }
  });

  // Left mouse drag for panning
  viewport.addEventListener('mousedown', (e) => {
    if (e.button === 0 && !e.target.closest('button')) { // Left mouse button
      e.preventDefault();
      disableAutoCamera();
      isPanning = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      viewport.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      panX += dx;
      panY += dy;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      updateBoardTransform();
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 1 || e.button === 0) {
      isPanning = false;
      viewport.style.cursor = 'grab';
    }
  });
}

/**
 * Toggle auto camera
 */
function toggleAutoCamera() {
  autoCameraEnabled = !autoCameraEnabled;
  updateAutoCameraButton();
}

function disableAutoCamera() {
  autoCameraEnabled = false;
  updateAutoCameraButton();
}

function updateAutoCameraButton() {
  if (elements.autoCameraBtn) {
    elements.autoCameraBtn.textContent = autoCameraEnabled ? 'Auto: ON' : 'Auto: OFF';
    elements.autoCameraBtn.classList.toggle('active', autoCameraEnabled);
  }
}

/**
 * Toggle dark mode
 */
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  if (elements.darkModeBtn) {
    elements.darkModeBtn.textContent = isDark ? '☀️' : '🌙';
  }
  localStorage.setItem('darkMode', isDark);
}

// Load dark mode preference on init
function loadDarkModePreference() {
  const isDark = localStorage.getItem('darkMode') === 'true';
  if (isDark) {
    document.body.classList.add('dark-mode');
    if (elements.darkModeBtn) {
      elements.darkModeBtn.textContent = '☀️';
    }
  }
}

function zoomBoard(factor) {
  zoomLevel = Math.max(0.5, Math.min(3, zoomLevel * factor));
  updateBoardTransform();
}

function resetZoom() {
  zoomLevel = 1;
  panX = 0;
  panY = 0;
  updateBoardTransform();
}

function updateBoardTransform() {
  if (elements.gameBoard) {
    elements.gameBoard.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
  }
}

/**
 * Zoom to a specific space on the board
 */
function zoomToSpace(spaceIndex, zoom = 1.5) {
  const spaceEl = document.getElementById(`space-${spaceIndex}`);
  if (!spaceEl) return;

  const viewport = elements.boardViewport;
  const board = elements.gameBoard;
  if (!viewport || !board) return;

  const viewportRect = viewport.getBoundingClientRect();
  const spaceRect = spaceEl.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();

  // Calculate center offset
  const spaceRelX = (spaceRect.left + spaceRect.width / 2) - boardRect.left;
  const spaceRelY = (spaceRect.top + spaceRect.height / 2) - boardRect.top;

  zoomLevel = zoom;
  panX = (viewportRect.width / 2) - (spaceRelX * zoom);
  panY = (viewportRect.height / 2) - (spaceRelY * zoom);

  updateBoardTransform();
}

/**
 * Socket handlers
 */
function setupSocketHandlers() {
  socket.on('gameUpdate', (state) => {
    gameState = state;
    updateBillsFromMoney();
    renderGame();
  });

  socket.on('diceRolled', (data) => {
    animationInProgress = true;
    pendingBuyPhase = false;

    // Animate dice first with delay to see the animation
    animateDice3D(data.dice, () => {
      // After dice animation completes, wait a moment then move token
      setTimeout(() => {
        if (data.movePath && data.movePath.length > 0) {
          animateTokenMovement(data.playerId, data.movePath, () => {
            // Animation complete - check if we need to show buy modal
            animationInProgress = false;
            if (pendingBuyPhase) {
              pendingBuyPhase = false;
              showPropertyPurchaseModal();
            }
          });
        } else {
          animationInProgress = false;
        }
      }, 500); // 500ms pause after dice roll before movement
    });
  });

  socket.on('gameStarted', () => {
    showScreen('game');
    renderBoard();
    centerBoard();
    showNotification('Game started!', 'success');
  });

  socket.on('playerLeft', () => {
    showNotification('A player left the game', 'warning');
  });

  socket.on('gameOver', (data) => {
    elements.winnerAnnouncement.textContent = `${data.winner.name} wins!`;
    elements.gameOverModal.style.display = 'flex';
  });

  socket.on('disconnect', () => {
    showNotification('Disconnected from server', 'error');
  });
}

/**
 * Start singleplayer game
 */
function startSingleplayer() {
  const name = elements.spName.value.trim();
  if (!name) {
    elements.lobbyError.textContent = 'Please enter your name';
    return;
  }

  const aiCount = parseInt(elements.aiCount.value) || 3;
  elements.startSpBtn.disabled = true;

  socket.emit('createSingleplayerGame', { playerName: name, aiCount }, (response) => {
    elements.startSpBtn.disabled = false;

    if (response.success) {
      playerId = response.playerId;
      gameCode = response.gameCode;
      gameState = response.gameState;
      isHost = true;

      elements.displayGameCode.textContent = gameCode;
      elements.startGameBtn.style.display = 'block';
      elements.waitingText.style.display = 'none';

      showScreen('waiting');
      renderWaitingRoom();
    } else {
      elements.lobbyError.textContent = response.error;
    }
  });
}

/**
 * Create multiplayer game
 */
function createGame() {
  const name = elements.hostName.value.trim();
  if (!name) {
    elements.lobbyError.textContent = 'Please enter your name';
    return;
  }

  elements.createGameBtn.disabled = true;

  socket.emit('createGame', name, (response) => {
    elements.createGameBtn.disabled = false;

    if (response.success) {
      playerId = response.playerId;
      gameCode = response.gameCode;
      gameState = response.gameState;
      isHost = true;

      elements.displayGameCode.textContent = gameCode;
      elements.startGameBtn.style.display = 'block';
      elements.waitingText.style.display = 'none';

      showScreen('waiting');
      renderWaitingRoom();
    } else {
      elements.lobbyError.textContent = response.error;
    }
  });
}

/**
 * Join game
 */
function joinGame() {
  const name = elements.joinName.value.trim();
  const code = elements.gameCodeInput.value.trim().toUpperCase();

  if (!name) {
    elements.lobbyError.textContent = 'Please enter your name';
    return;
  }
  if (!code || code.length !== 4) {
    elements.lobbyError.textContent = 'Please enter a valid 4-letter code';
    return;
  }

  elements.joinGameBtn.disabled = true;

  socket.emit('joinGame', { gameCode: code, playerName: name }, (response) => {
    elements.joinGameBtn.disabled = false;

    if (response.success) {
      playerId = response.playerId;
      gameCode = response.gameCode;
      gameState = response.gameState;
      isHost = false;

      elements.displayGameCode.textContent = gameCode;
      elements.startGameBtn.style.display = 'none';
      elements.waitingText.style.display = 'block';

      showScreen('waiting');
      renderWaitingRoom();
    } else {
      elements.lobbyError.textContent = response.error;
    }
  });
}

/**
 * Start game
 */
function startGame() {
  elements.startGameBtn.disabled = true;

  socket.emit('startGame', (response) => {
    elements.startGameBtn.disabled = false;
    if (!response.success) {
      showNotification(response.error, 'error');
    }
  });
}

/**
 * Game actions
 */
function rollDice() {
  hideActionModal();
  socket.emit('rollDice', (response) => {
    if (!response.success) {
      showNotification(response.error, 'error');
    }
  });
}

function buyProperty() {
  elements.propertyModal.style.display = 'none';
  socket.emit('buyProperty', (response) => {
    if (!response.success) {
      showNotification(response.error, 'error');
    }
  });
}

function declineBuy() {
  elements.propertyModal.style.display = 'none';
  socket.emit('declineBuy', (response) => {
    if (!response.success) {
      showNotification(response.error, 'error');
    }
  });
}

function endTurn() {
  hideActionModal();
  socket.emit('endTurn', (response) => {
    if (!response.success) {
      showNotification(response.error, 'error');
    } else if (response.rollAgain) {
      showNotification('Doubles! Roll again!', 'info');
    }
  });
}

function payBail() {
  hideActionModal();
  socket.emit('payBail', (response) => {
    if (!response.success) {
      showNotification(response.error, 'error');
    } else {
      showNotification('Paid bail - you are free!', 'success');
    }
  });
}

function useJailCard() {
  hideActionModal();
  socket.emit('useJailCard', (response) => {
    if (!response.success) {
      showNotification(response.error, 'error');
    } else {
      showNotification('Used Jail Free card!', 'success');
    }
  });
}

function resolvePayment() {
  hideActionModal();
  socket.emit('resolvePayment', (response) => {
    if (!response.success) {
      showNotification(response.error, 'error');
    }
  });
}

function declareBankruptcy() {
  if (!confirm('Declare bankruptcy? This cannot be undone.')) return;

  hideActionModal();
  const toPlayerId = gameState.pendingAction?.toPlayerId || null;
  socket.emit('declareBankruptcy', toPlayerId, (response) => {
    if (!response.success) {
      showNotification(response.error, 'error');
    }
  });
}

function buildHouse(propertyId) {
  socket.emit('buildHouse', propertyId, (response) => {
    if (!response.success) {
      showNotification(response.error, 'error');
    } else {
      showNotification('House built!', 'success');
    }
  });
}

function sellHouse(propertyId) {
  socket.emit('sellHouse', propertyId, (response) => {
    if (!response.success) {
      showNotification(response.error, 'error');
    } else {
      showNotification('Building sold!', 'success');
    }
  });
}

function mortgageProperty(propertyId) {
  socket.emit('mortgageProperty', propertyId, (response) => {
    if (!response.success) {
      showNotification(response.error, 'error');
    } else {
      showNotification('Property mortgaged!', 'success');
    }
  });
}

function unmortgageProperty(propertyId) {
  socket.emit('unmortgageProperty', propertyId, (response) => {
    if (!response.success) {
      showNotification(response.error, 'error');
    } else {
      showNotification('Property unmortgaged!', 'success');
    }
  });
}

/**
 * Show screen
 */
function showScreen(screen) {
  elements.lobbyScreen.classList.remove('active');
  elements.waitingRoom.classList.remove('active');
  elements.gameScreen.classList.remove('active');

  switch (screen) {
    case 'lobby': elements.lobbyScreen.classList.add('active'); break;
    case 'waiting': elements.waitingRoom.classList.add('active'); break;
    case 'game': elements.gameScreen.classList.add('active'); break;
  }
}

/**
 * Render waiting room
 */
function renderWaitingRoom() {
  if (!gameState) return;

  elements.playerCount.textContent = gameState.players.length;
  elements.lobbyPlayers.innerHTML = '';

  gameState.players.forEach((player, index) => {
    const div = document.createElement('div');
    div.className = 'lobby-player';
    div.style.borderColor = player.color.hex;

    let badges = '';
    if (index === 0) badges += '<span class="host-badge">HOST</span>';
    if (player.isAI) badges += '<span class="ai-badge">AI</span>';

    div.innerHTML = `
      <div class="color-dot" style="background: ${player.color.hex}"></div>
      <span>${player.name}</span>
      ${badges}
    `;
    elements.lobbyPlayers.appendChild(div);
  });
}

/**
 * Render the game board
 */
function renderBoard() {
  if (!boardData) return;

  elements.gameBoard.innerHTML = '';

  // Create board center
  const center = document.createElement('div');
  center.className = 'board-center';
  center.innerHTML = `
    <div class="center-logo">MONOPOLY</div>
    <div id="dice-stage" class="dice-stage">
      <div class="dice-3d-container">
        <div id="die1-3d" class="die-3d"></div>
        <div id="die2-3d" class="die-3d"></div>
      </div>
    </div>
    <div class="free-parking-display">
      Free Parking: $<span id="free-parking-amount">0</span>
    </div>
  `;
  elements.gameBoard.appendChild(center);
  elements.freeParkingAmount = document.getElementById('free-parking-amount');

  // Initialize dice faces
  initializeDice();

  // Create board spaces
  boardData.spaces.forEach((space, index) => {
    const spaceEl = createBoardSpace(space, index);
    elements.gameBoard.appendChild(spaceEl);
  });

  renderGame();
}

/**
 * Center board in viewport
 */
function centerBoard() {
  if (!elements.boardViewport || !elements.gameBoard) return;

  const viewportRect = elements.boardViewport.getBoundingClientRect();
  const boardRect = elements.gameBoard.getBoundingClientRect();

  panX = (viewportRect.width - boardRect.width) / 2;
  panY = (viewportRect.height - boardRect.height) / 2;

  updateBoardTransform();
}

/**
 * Create a board space element
 */
function createBoardSpace(space, index) {
  const div = document.createElement('div');
  div.id = `space-${index}`;
  div.dataset.spaceId = index;

  const position = getSpacePosition(index);
  div.style.gridArea = position.gridArea;

  if (position.isCorner) {
    div.className = `corner-space ${space.type.toLowerCase().replace(/\s/g, '-')}`;
    div.innerHTML = getCornerContent(space);
  } else {
    div.className = `board-space ${position.orientation}`;
    div.innerHTML = getSpaceContent(space);

    // Add hover tooltip for properties
    if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
      div.addEventListener('mouseenter', (e) => showPropertyTooltip(e, space, index));
      div.addEventListener('mouseleave', hidePropertyTooltip);
      div.addEventListener('mousemove', (e) => movePropertyTooltip(e));
    }
  }

  return div;
}

/**
 * Get grid position for a space
 */
function getSpacePosition(index) {
  if (index === 0) return { gridArea: '11 / 11', isCorner: true };
  if (index === 10) return { gridArea: '11 / 1', isCorner: true };
  if (index === 20) return { gridArea: '1 / 1', isCorner: true };
  if (index === 30) return { gridArea: '1 / 11', isCorner: true };

  if (index >= 1 && index <= 9) return { gridArea: `11 / ${11 - index}`, orientation: 'bottom' };
  if (index >= 11 && index <= 19) return { gridArea: `${21 - index} / 1`, orientation: 'left' };
  if (index >= 21 && index <= 29) return { gridArea: `1 / ${index - 19}`, orientation: 'top' };
  if (index >= 31 && index <= 39) return { gridArea: `${index - 29} / 11`, orientation: 'right' };

  return { gridArea: '1 / 1', orientation: 'bottom' };
}

/**
 * Get corner space content
 */
function getCornerContent(space) {
  switch (space.type) {
    case 'go': return '<div>GO</div><div style="font-size:0.7em">Collect $200</div>';
    case 'jail': return '<div>JAIL</div><div style="font-size:0.6em">Just Visiting</div>';
    case 'freeParking': return '<div>FREE</div><div>PARKING</div>';
    case 'goToJail': return '<div>GO TO</div><div>JAIL</div>';
    default: return space.name;
  }
}

/**
 * Get regular space content
 */
function getSpaceContent(space) {
  let html = '';

  if (space.colorGroup && colorGroupCSS[space.colorGroup]) {
    html += `<div class="color-bar" style="background: ${colorGroupCSS[space.colorGroup]}"></div>`;
  }

  let displayName = space.name;
  if (displayName.length > 12) {
    displayName = displayName.replace(' Avenue', ' Ave').replace(' Railroad', ' RR').replace(' Place', ' Pl');
  }
  html += `<div class="name">${displayName}</div>`;

  if (space.price) html += `<div class="price">$${space.price}</div>`;
  if (space.type === 'tax') html += `<div class="price">$${space.amount}</div>`;
  if (space.type === 'chance') html += `<div style="font-size:1.2em">?</div>`;
  if (space.type === 'communityChest') html += `<div style="font-size:1em">CHEST</div>`;

  return html;
}

/**
 * Show property tooltip on hover
 */
function showPropertyTooltip(e, space, index) {
  const tooltip = elements.propertyTooltip;
  const property = gameState?.properties[index];

  let html = `<h4 style="border-color: ${colorGroupCSS[space.colorGroup] || '#333'}">${space.name}</h4>`;

  if (space.rent) {
    html += '<div class="tooltip-rents">';
    html += `<div class="tooltip-rent"><span>Rent:</span><span>$${space.rent[0]}</span></div>`;
    html += `<div class="tooltip-rent"><span>1 House:</span><span>$${space.rent[1]}</span></div>`;
    html += `<div class="tooltip-rent"><span>2 Houses:</span><span>$${space.rent[2]}</span></div>`;
    html += `<div class="tooltip-rent"><span>3 Houses:</span><span>$${space.rent[3]}</span></div>`;
    html += `<div class="tooltip-rent"><span>4 Houses:</span><span>$${space.rent[4]}</span></div>`;
    html += `<div class="tooltip-rent"><span>Hotel:</span><span>$${space.rent[5]}</span></div>`;
    html += '</div>';
  }

  if (space.price) {
    html += `<div class="tooltip-mortgage">Mortgage Value: $${Math.floor(space.price / 2)}</div>`;
  }

  if (property?.ownerId) {
    const owner = gameState.players.find(p => p.id === property.ownerId);
    html += `<div style="margin-top:5px;color:${owner?.color.hex}">Owner: ${owner?.name || 'Unknown'}</div>`;
  }

  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  movePropertyTooltip(e);
}

function movePropertyTooltip(e) {
  elements.propertyTooltip.style.left = (e.clientX + 15) + 'px';
  elements.propertyTooltip.style.top = (e.clientY + 15) + 'px';
}

function hidePropertyTooltip() {
  elements.propertyTooltip.style.display = 'none';
}

/**
 * Initialize 3D dice
 */
function initializeDice() {
  [1, 2].forEach(num => {
    const die = document.getElementById(`die${num}-3d`);
    if (!die) return;

    die.innerHTML = `
      <div class="die-face die-front">${createDieFace(1)}</div>
      <div class="die-face die-back">${createDieFace(6)}</div>
      <div class="die-face die-right">${createDieFace(3)}</div>
      <div class="die-face die-left">${createDieFace(4)}</div>
      <div class="die-face die-top">${createDieFace(2)}</div>
      <div class="die-face die-bottom">${createDieFace(5)}</div>
    `;
  });
}

/**
 * Create die face with pips
 */
function createDieFace(value) {
  const pipPositions = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]]
  };

  return pipPositions[value].map(([x, y]) =>
    `<div class="pip" style="left:${x}%;top:${y}%;transform:translate(-50%,-50%)"></div>`
  ).join('');
}

/**
 * Animate 3D dice roll with callback when complete
 */
function animateDice3D(dice, onComplete) {
  const die1 = document.getElementById('die1-3d');
  const die2 = document.getElementById('die2-3d');
  if (!die1 || !die2) {
    if (onComplete) onComplete();
    return;
  }

  // Calculate rotations for final values
  const rotations = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateX(-90deg) rotateY(0deg)',
    3: 'rotateX(0deg) rotateY(-90deg)',
    4: 'rotateX(0deg) rotateY(90deg)',
    5: 'rotateX(90deg) rotateY(0deg)',
    6: 'rotateX(180deg) rotateY(0deg)'
  };

  die1.classList.add('rolling');
  die2.classList.add('rolling');

  // Random intermediate rotations - 15 cycles at 100ms = 1.5s animation
  let count = 0;
  const totalCycles = 15;
  const interval = setInterval(() => {
    die1.style.transform = `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg) rotateZ(${Math.random() * 360}deg)`;
    die2.style.transform = `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg) rotateZ(${Math.random() * 360}deg)`;
    count++;

    if (count >= totalCycles) {
      clearInterval(interval);
      die1.classList.remove('rolling');
      die2.classList.remove('rolling');
      die1.style.transform = rotations[dice.die1];
      die2.style.transform = rotations[dice.die2];

      // Wait for final position to settle, then call callback
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 300);
    }
  }, 100);
}

/**
 * Animate token movement with hover effect and callback
 */
function animateTokenMovement(tokenPlayerId, path, onComplete) {
  if (path.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  const player = gameState.players.find(p => p.id === tokenPlayerId);
  if (!player) {
    if (onComplete) onComplete();
    return;
  }

  // Create animated token overlay
  const animatedToken = document.createElement('div');
  animatedToken.className = 'player-token animated-token';
  animatedToken.style.background = player.color.hex;
  animatedToken.style.position = 'fixed';
  animatedToken.style.zIndex = '1000';
  animatedToken.style.width = '20px';
  animatedToken.style.height = '20px';
  animatedToken.style.transition = 'all 0.4s ease-in-out';
  document.body.appendChild(animatedToken);

  // Get starting position
  const startSpace = document.getElementById(`space-${path[0] > 0 ? path[0] - 1 : 39}`);
  if (startSpace) {
    const startRect = startSpace.getBoundingClientRect();
    animatedToken.style.left = (startRect.left + startRect.width / 2 - 10) + 'px';
    animatedToken.style.top = (startRect.top + startRect.height / 2 - 10) + 'px';
  }

  let step = 0;
  const timePerStep = Math.max(150, 1000 / path.length); // At least 150ms per step, or spread over 1 second

  const animateStep = () => {
    if (step >= path.length) {
      // Animation complete - remove animated token
      animatedToken.classList.remove('hovering');
      setTimeout(() => {
        animatedToken.remove();
        renderTokens(); // Re-render tokens at final positions

        // Zoom out after animation if auto camera is on
        if (autoCameraEnabled) {
          setTimeout(() => {
            resetZoom();
            centerBoard();
          }, 300);
        }

        if (onComplete) onComplete();
      }, 200);
      return;
    }

    const spaceIndex = path[step];
    const spaceEl = document.getElementById(`space-${spaceIndex}`);

    if (spaceEl) {
      const rect = spaceEl.getBoundingClientRect();

      // Move to hover position (above the space)
      animatedToken.classList.add('hovering');
      animatedToken.style.left = (rect.left + rect.width / 2 - 10) + 'px';
      animatedToken.style.top = (rect.top + rect.height / 2 - 15) + 'px';

      // Zoom to space if auto camera is on
      if (autoCameraEnabled) {
        zoomToSpace(spaceIndex, 1.8);
      }
    }

    step++;
    setTimeout(animateStep, timePerStep);
  };

  // Start with hover effect
  setTimeout(() => {
    animatedToken.classList.add('hovering');
    animateStep();
  }, 100);
}

/**
 * Update bills from money (realistic logic)
 */
function updateBillsFromMoney() {
  const myPlayer = gameState?.players.find(p => p.id === playerId);
  if (!myPlayer) return;

  const currentTotal = Object.entries(playerBills).reduce((sum, [denom, count]) => sum + (parseInt(denom) * count), 0);
  const targetMoney = myPlayer.money;
  const diff = targetMoney - currentTotal;

  if (diff > 0) {
    // Add bills (e.g., passed GO, received money)
    addBillsForAmount(diff);
  } else if (diff < 0) {
    // Remove bills (e.g., paid rent, bought property)
    removeBillsForAmount(-diff);
  }
}

function addBillsForAmount(amount) {
  // When receiving money, add in realistic denominations
  // Prefer smaller bills for variety
  const denoms = [100, 100, 20, 20, 10, 10, 5, 5, 1, 1, 1, 1, 1];
  let remaining = amount;

  // First try to add exact if possible with 100s and 20s
  while (remaining >= 100) { playerBills[100]++; remaining -= 100; }
  while (remaining >= 50) { playerBills[50]++; remaining -= 50; }
  while (remaining >= 20) { playerBills[20]++; remaining -= 20; }
  while (remaining >= 10) { playerBills[10]++; remaining -= 10; }
  while (remaining >= 5) { playerBills[5]++; remaining -= 5; }
  while (remaining >= 1) { playerBills[1]++; remaining -= 1; }
}

function removeBillsForAmount(amount) {
  let remaining = amount;
  const denoms = [500, 100, 50, 20, 10, 5, 1];

  // Try to pay with exact change first
  for (const denom of denoms) {
    while (remaining >= denom && playerBills[denom] > 0) {
      playerBills[denom]--;
      remaining -= denom;
    }
  }

  // If we overpaid, we'll get change back (simplified)
  if (remaining < 0) {
    addBillsForAmount(-remaining);
  }
}

/**
 * Render the game
 */
function renderGame() {
  if (!gameState || !boardData) return;

  renderPlayers();
  renderProperties();
  renderTokens();
  renderActionModal();
  renderGameLog();
  renderMyMoney();
  renderMyPropertyCards();

  if (elements.freeParkingAmount) {
    elements.freeParkingAmount.textContent = gameState.freeParkingMoney;
  }
}

/**
 * Render players panel
 */
function renderPlayers() {
  elements.playersInfo.innerHTML = '';

  gameState.players.forEach((player, index) => {
    const div = document.createElement('div');
    div.className = 'player-card';
    if (index === gameState.currentPlayerIndex && !player.bankrupt) div.classList.add('current-turn');
    if (player.bankrupt) div.classList.add('bankrupt');
    div.style.borderColor = player.color.hex;

    // Get player's properties by color
    const propIcons = player.properties.map(propId => {
      const space = boardData.spaces[propId];
      const color = colorGroupCSS[space?.colorGroup] || '#999';
      return `<div class="prop-icon" style="background:${color}"></div>`;
    }).join('');

    let status = '';
    if (player.bankrupt) status = 'BANKRUPT';
    else if (player.inJail) status = `In Jail (${player.jailTurns}/3)`;
    else if (player.hasGetOutOfJailCard) status = 'Has Jail Card';

    div.innerHTML = `
      <div class="name" style="color: ${player.color.hex}">
        ${player.name}
        ${player.isAI ? '<span class="ai-indicator">AI</span>' : ''}
      </div>
      <div class="money">$${player.money}</div>
      <div class="status">${status}</div>
      <div class="property-icons">${propIcons}</div>
    `;

    elements.playersInfo.appendChild(div);
  });
}

/**
 * Render properties on board
 */
function renderProperties() {
  if (!gameState.properties) return;

  Object.entries(gameState.properties).forEach(([spaceId, property]) => {
    const spaceEl = document.getElementById(`space-${spaceId}`);
    if (!spaceEl) return;

    spaceEl.querySelectorAll('.owner-indicator, .buildings').forEach(el => el.remove());
    spaceEl.classList.remove('mortgaged');

    if (property.ownerId) {
      const owner = gameState.players.find(p => p.id === property.ownerId);
      if (owner) {
        const indicator = document.createElement('div');
        indicator.className = 'owner-indicator';
        indicator.style.background = owner.color.hex;
        spaceEl.appendChild(indicator);

        if (property.mortgaged) spaceEl.classList.add('mortgaged');

        if (property.houses > 0) {
          const buildings = document.createElement('div');
          buildings.className = 'buildings';
          if (property.houses === 5) {
            buildings.innerHTML = '<div class="hotel"></div>';
          } else {
            for (let i = 0; i < property.houses; i++) {
              buildings.innerHTML += '<div class="house"></div>';
            }
          }
          spaceEl.appendChild(buildings);
        }
      }
    }
  });
}

/**
 * Render player tokens
 */
function renderTokens() {
  document.querySelectorAll('.player-token').forEach(el => el.remove());

  const positionGroups = {};
  gameState.players.forEach((player, index) => {
    if (player.bankrupt) return;
    const pos = player.position;
    if (!positionGroups[pos]) positionGroups[pos] = [];
    positionGroups[pos].push({ player, index });
  });

  Object.entries(positionGroups).forEach(([position, players]) => {
    const spaceEl = document.getElementById(`space-${position}`);
    if (!spaceEl) return;

    players.forEach((p, slot) => {
      const token = document.createElement('div');
      token.className = `player-token token-slot-${slot}`;
      if (p.player.inJail) token.classList.add('in-jail');
      token.style.background = p.player.color.hex;
      token.title = p.player.name;
      spaceEl.appendChild(token);
    });
  });
}

/**
 * Render action modal (center screen)
 */
function renderActionModal() {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer && currentPlayer.id === playerId;
  const myPlayer = gameState.players.find(p => p.id === playerId);

  // Hide property purchase modal by default
  elements.propertyModal.style.display = 'none';

  if (!isMyTurn || myPlayer.bankrupt) {
    hideActionModal();
    return;
  }

  // Handle buying phase with property modal - but wait for animations
  if (gameState.turnPhase === 'buying') {
    if (animationInProgress) {
      // Animation still running, mark as pending
      pendingBuyPhase = true;
      hideActionModal();
    } else {
      showPropertyPurchaseModal();
      hideActionModal();
    }
    return;
  }

  let title = '';
  let details = '';
  let buttons = [];

  switch (gameState.turnPhase) {
    case 'waiting':
      title = 'Your Turn';
      if (currentPlayer.inJail) {
        title = 'In Jail';
        details = `Turn ${currentPlayer.jailTurns}/3 - Roll doubles to escape`;
        buttons.push({ text: 'Roll Dice', class: 'primary', action: rollDice });
        if (currentPlayer.money >= 50) {
          buttons.push({ text: 'Pay $50 Bail', class: 'secondary', action: payBail });
        }
        if (currentPlayer.hasGetOutOfJailCard) {
          buttons.push({ text: 'Use Jail Card', class: 'secondary', action: useJailCard });
        }
      } else {
        details = 'Roll the dice to move';
        buttons.push({ text: 'Roll Dice', class: 'primary', action: rollDice });
      }
      break;

    case 'rolled':
      title = 'End Your Turn';
      details = gameState.lastDiceRoll?.isDoubles ? 'You rolled doubles!' : '';
      buttons.push({ text: 'End Turn', class: 'primary', action: endTurn });
      break;

    case 'actionRequired':
      title = 'Payment Required';
      const amount = gameState.pendingAction?.amount || 0;
      details = `You owe $${amount}`;
      if (myPlayer.money >= amount) {
        buttons.push({ text: `Pay $${amount}`, class: 'primary', action: resolvePayment });
      }
      buttons.push({ text: 'Declare Bankruptcy', class: 'danger', action: declareBankruptcy });
      break;

    default:
      hideActionModal();
      return;
  }

  showActionModal(title, details, buttons);
}

function showActionModal(title, details, buttons) {
  elements.actionTitle.textContent = title;
  elements.actionDetails.textContent = details;
  elements.actionButtons.innerHTML = '';

  buttons.forEach(btn => {
    const button = document.createElement('button');
    button.className = `action-btn ${btn.class}`;
    button.textContent = btn.text;
    button.addEventListener('click', btn.action);
    elements.actionButtons.appendChild(button);
  });

  elements.actionModal.style.display = 'block';
}

function hideActionModal() {
  elements.actionModal.style.display = 'none';
}

/**
 * Show property purchase modal
 */
function showPropertyPurchaseModal() {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const space = boardData.spaces[currentPlayer.position];
  if (!space) return;

  // Create property card
  elements.propertyCardDisplay.innerHTML = createPropertyCardHTML(space);

  // Show bills preview after purchase
  const myPlayer = gameState.players.find(p => p.id === playerId);
  const afterPurchase = myPlayer.money - space.price;

  elements.modalBillsPreview.innerHTML = `
    <h4>After Purchase</h4>
    <div style="color: white; font-size: 1.5em; font-weight: bold;">$${afterPurchase}</div>
    <div style="color: #aaa; margin-top: 5px;">Remaining balance</div>
  `;

  elements.modalBuyBtn.textContent = `Buy for $${space.price}`;
  elements.propertyModal.style.display = 'flex';
}

/**
 * Create property card HTML
 */
function createPropertyCardHTML(space) {
  const color = colorGroupCSS[space.colorGroup] || '#666';
  const textColor = ['yellow', 'lightBlue'].includes(space.colorGroup) ? '#333' : '#fff';

  let rentSection = '';
  if (space.rent) {
    rentSection = `
      <table class="rent-table">
        <tr><td>Rent</td><td>$${space.rent[0]}</td></tr>
        <tr><td>With 1 House</td><td>$${space.rent[1]}</td></tr>
        <tr><td>With 2 Houses</td><td>$${space.rent[2]}</td></tr>
        <tr><td>With 3 Houses</td><td>$${space.rent[3]}</td></tr>
        <tr><td>With 4 Houses</td><td>$${space.rent[4]}</td></tr>
        <tr><td>With Hotel</td><td>$${space.rent[5]}</td></tr>
      </table>
    `;
  } else if (space.type === 'railroad') {
    rentSection = `
      <table class="rent-table">
        <tr><td>1 Railroad</td><td>$25</td></tr>
        <tr><td>2 Railroads</td><td>$50</td></tr>
        <tr><td>3 Railroads</td><td>$100</td></tr>
        <tr><td>4 Railroads</td><td>$200</td></tr>
      </table>
    `;
  } else if (space.type === 'utility') {
    rentSection = `
      <div style="font-size: 0.9em; line-height: 1.5;">
        <div>If one utility owned: 4x dice roll</div>
        <div>If both utilities owned: 10x dice roll</div>
      </div>
    `;
  }

  return `
    <div class="card-header" style="background: ${color}; color: ${textColor}">
      ${space.name}
    </div>
    <div class="card-body">
      ${rentSection}
    </div>
    <div class="card-footer">
      <div>Mortgage Value: $${Math.floor(space.price / 2)}</div>
      ${space.colorGroup && colorGroupCosts[space.colorGroup] ?
        `<div>House Cost: $${colorGroupCosts[space.colorGroup]}</div>` : ''}
    </div>
  `;
}

/**
 * Render game log with color coding
 */
function renderGameLog() {
  elements.gameLog.innerHTML = '';

  gameState.gameLog.forEach(entry => {
    const div = document.createElement('div');
    let logClass = 'turn';
    let icon = '>';

    if (entry.includes('rolled')) { logClass = 'roll'; icon = '🎲'; }
    else if (entry.includes('bought')) { logClass = 'buy'; icon = '$'; }
    else if (entry.includes('rent') || entry.includes('paid')) { logClass = 'rent'; icon = '💰'; }
    else if (entry.includes('Jail') || entry.includes('jail')) { logClass = 'jail'; icon = '🔒'; }
    else if (entry.includes('drew') || entry.includes('Chance') || entry.includes('Community')) { logClass = 'card'; icon = '🃏'; }
    else if (entry.includes('built') || entry.includes('house') || entry.includes('hotel')) { logClass = 'build'; icon = '🏠'; }

    div.className = `log-entry ${logClass}`;
    div.innerHTML = `<span class="log-icon">${icon}</span><span>${entry}</span>`;
    elements.gameLog.appendChild(div);
  });

  elements.gameLog.scrollTop = elements.gameLog.scrollHeight;
}

/**
 * Render my money with bills
 */
function renderMyMoney() {
  const myPlayer = gameState.players.find(p => p.id === playerId);
  if (!myPlayer) return;

  elements.moneyTotal.textContent = `$${myPlayer.money}`;

  // Render individual bills
  const billsDenoms = [500, 100, 50, 20, 10, 5, 1];
  let billsHTML = '';

  billsDenoms.forEach(denom => {
    const count = playerBills[denom] || 0;
    for (let i = 0; i < Math.min(count, 10); i++) { // Max 10 of each shown
      billsHTML += `<div class="bill bill-${denom}">$${denom}</div>`;
    }
    if (count > 10) {
      billsHTML += `<div class="bill bill-${denom}">+${count - 10}</div>`;
    }
  });

  elements.billsDisplay.innerHTML = billsHTML;
}

/**
 * Render my property cards
 */
function renderMyPropertyCards() {
  const myPlayer = gameState.players.find(p => p.id === playerId);
  if (!myPlayer) return;

  elements.propertyCardsContainer.innerHTML = '';

  if (myPlayer.properties.length === 0) {
    elements.propertyCardsContainer.innerHTML = '<div style="color: #999; font-size: 0.8em; padding: 10px;">No properties owned</div>';
    return;
  }

  // Sort by color group
  const sortedProps = [...myPlayer.properties].sort((a, b) => {
    const spaceA = boardData.spaces[a];
    const spaceB = boardData.spaces[b];
    return (spaceA.colorGroup || 'zzz').localeCompare(spaceB.colorGroup || 'zzz');
  });

  sortedProps.forEach(propId => {
    const space = boardData.spaces[propId];
    const property = gameState.properties[propId];
    if (!space) return;

    const card = document.createElement('div');
    card.className = 'property-mini-card';
    if (property.mortgaged) card.classList.add('mortgaged');

    const color = colorGroupCSS[space.colorGroup] || '#999';

    let buildingsHTML = '';
    if (property.houses === 5) {
      buildingsHTML = '<div class="mini-hotel"></div>';
    } else if (property.houses > 0) {
      for (let i = 0; i < property.houses; i++) {
        buildingsHTML += '<div class="mini-house"></div>';
      }
    }

    card.innerHTML = `
      <div class="card-color-bar" style="background: ${color}"></div>
      <div class="card-name">${space.name.split(' ')[0]}</div>
      <div class="card-buildings">${buildingsHTML}</div>
    `;

    card.addEventListener('click', () => showPropertyInfoModal(propId));
    elements.propertyCardsContainer.appendChild(card);
  });
}

/**
 * Show property info modal (for owned properties)
 */
function showPropertyInfoModal(propId) {
  const space = boardData.spaces[propId];
  const property = gameState.properties[propId];
  const myPlayer = gameState.players.find(p => p.id === playerId);

  if (!space || !property || property.ownerId !== playerId) return;

  elements.propertyInfoCard.innerHTML = createPropertyCardHTML(space);

  // Action buttons
  let actionsHTML = '';
  const colorGroup = space.colorGroup;

  if (space.type === 'property' && colorGroup) {
    const groupProps = boardData.spaces.filter(s => s.colorGroup === colorGroup);
    const ownsAll = groupProps.every(s => gameState.properties[s.id]?.ownerId === playerId);
    const noneInGroupMortgaged = groupProps.every(s => !gameState.properties[s.id]?.mortgaged);
    const buildCost = colorGroupCosts[colorGroup];

    if (ownsAll && noneInGroupMortgaged && !property.mortgaged && property.houses < 5 && myPlayer.money >= buildCost) {
      actionsHTML += `<button class="build-btn" onclick="buildHouse(${propId})">Build House ($${buildCost})</button>`;
    }

    if (property.houses > 0) {
      actionsHTML += `<button class="sell-btn" onclick="sellHouse(${propId})">Sell Building</button>`;
    }
  }

  if (!property.mortgaged && property.houses === 0) {
    actionsHTML += `<button class="mortgage-btn" onclick="mortgageProperty(${propId})">Mortgage ($${Math.floor(space.price / 2)})</button>`;
  }

  if (property.mortgaged) {
    const unmortgageCost = Math.floor(space.price / 2 * 1.1);
    if (myPlayer.money >= unmortgageCost) {
      actionsHTML += `<button class="unmortgage-btn" onclick="unmortgageProperty(${propId})">Unmortgage ($${unmortgageCost})</button>`;
    }
  }

  elements.propertyInfoActions.innerHTML = actionsHTML;
  elements.propertyInfoModal.style.display = 'flex';
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  elements.notification.textContent = message;
  elements.notification.className = `notification ${type} show`;

  setTimeout(() => {
    elements.notification.classList.remove('show');
  }, 3000);
}

// Make functions globally accessible
window.buildHouse = buildHouse;
window.sellHouse = sellHouse;
window.mortgageProperty = mortgageProperty;
window.unmortgageProperty = unmortgageProperty;

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

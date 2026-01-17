/**
 * Monopoly Multiplayer Server
 * Handles game lobbies, player connections, AI players, and real-time game state synchronization
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const gameLogic = require('./gameLogic');
const aiPlayer = require('./aiPlayer');
const { BOARD_SPACES, COLOR_GROUP_CSS, PLAYER_COLORS, COLOR_GROUPS } = require('./gameData');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Store active games
const games = new Map();

// Store player to game mapping
const playerGameMap = new Map();

// Store AI processing flags
const aiProcessing = new Map();

/**
 * Generate a short, readable game code
 */
function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get server's local IP addresses for display
 */
function getLocalIPs() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const ips = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

/**
 * Generate AI player name
 */
function generateAIName(index) {
  const names = ['Bot Alice', 'Bot Bob', 'Bot Charlie', 'Bot Diana', 'Bot Edward', 'Bot Fiona', 'Bot George'];
  return names[index % names.length];
}

/**
 * Check if current player is AI and process their turn
 */
async function processAITurn(gameCode) {
  const game = games.get(gameCode);
  if (!game || game.status !== 'playing') return;

  const currentPlayer = game.players[game.currentPlayerIndex];
  if (!currentPlayer || !currentPlayer.isAI || currentPlayer.bankrupt) return;

  // Prevent multiple AI processing
  if (aiProcessing.get(gameCode)) return;
  aiProcessing.set(gameCode, true);

  const broadcastUpdate = () => {
    io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));
  };

  try {
    await aiPlayer.executeAITurn(game, currentPlayer, gameLogic, broadcastUpdate);

    // Check for game over
    const activePlayers = game.players.filter(p => !p.bankrupt);
    if (activePlayers.length === 1) {
      game.status = 'finished';
      game.winner = activePlayers[0];
      io.to(gameCode).emit('gameOver', { winner: activePlayers[0] });
    }

    broadcastUpdate();

    // Check if next player is also AI
    setTimeout(() => {
      aiProcessing.set(gameCode, false);
      processAITurn(gameCode);
    }, 1000);
  } catch (error) {
    console.error('AI turn error:', error);
    aiProcessing.set(gameCode, false);
  }
}

// API endpoint to get game data for rendering
app.get('/api/board-data', (req, res) => {
  res.json({
    spaces: BOARD_SPACES,
    colorGroups: COLOR_GROUP_CSS,
    playerColors: PLAYER_COLORS,
    colorGroupData: COLOR_GROUPS
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create a new game (multiplayer)
  socket.on('createGame', (playerName, callback) => {
    const gameCode = generateGameCode();
    const game = gameLogic.createGame(gameCode, socket.id, playerName);
    games.set(gameCode, game);
    playerGameMap.set(socket.id, gameCode);

    socket.join(gameCode);

    console.log(`Game ${gameCode} created by ${playerName}`);

    callback({
      success: true,
      gameCode,
      playerId: socket.id,
      gameState: gameLogic.getGameState(game)
    });
  });

  // Create a singleplayer game with AI opponents
  socket.on('createSingleplayerGame', (data, callback) => {
    const { playerName, aiCount } = data;
    const gameCode = generateGameCode();
    const game = gameLogic.createGame(gameCode, socket.id, playerName);

    // Add AI players
    const numAI = Math.min(Math.max(1, aiCount || 1), 7); // 1-7 AI players
    for (let i = 0; i < numAI; i++) {
      const aiId = `ai-${gameCode}-${i}`;
      const aiName = generateAIName(i);
      gameLogic.addPlayer(game, aiId, aiName);

      // Mark as AI player
      const aiPlayerObj = game.players.find(p => p.id === aiId);
      if (aiPlayerObj) {
        aiPlayerObj.isAI = true;
        aiPlayerObj.aiPersonalityIndex = i;
      }
    }

    games.set(gameCode, game);
    playerGameMap.set(socket.id, gameCode);

    socket.join(gameCode);

    console.log(`Singleplayer game ${gameCode} created by ${playerName} with ${numAI} AI players`);

    callback({
      success: true,
      gameCode,
      playerId: socket.id,
      gameState: gameLogic.getGameState(game)
    });
  });

  // Join an existing game
  socket.on('joinGame', (data, callback) => {
    const { gameCode, playerName } = data;
    const game = games.get(gameCode.toUpperCase());

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    const result = gameLogic.addPlayer(game, socket.id, playerName);
    if (!result.success) {
      callback({ success: false, error: result.error });
      return;
    }

    playerGameMap.set(socket.id, gameCode.toUpperCase());
    socket.join(gameCode.toUpperCase());

    console.log(`${playerName} joined game ${gameCode}`);

    // Notify all players in the game
    io.to(gameCode.toUpperCase()).emit('gameUpdate', gameLogic.getGameState(game));

    callback({
      success: true,
      gameCode: gameCode.toUpperCase(),
      playerId: socket.id,
      gameState: gameLogic.getGameState(game)
    });
  });

  // Start the game
  socket.on('startGame', (callback) => {
    const gameCode = playerGameMap.get(socket.id);
    const game = games.get(gameCode);

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    if (game.hostId !== socket.id) {
      callback({ success: false, error: 'Only host can start the game' });
      return;
    }

    const result = gameLogic.startGame(game);
    if (!result.success) {
      callback({ success: false, error: result.error });
      return;
    }

    console.log(`Game ${gameCode} started`);

    io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));
    io.to(gameCode).emit('gameStarted');

    callback({ success: true });

    // Start AI processing if first player is AI
    setTimeout(() => processAITurn(gameCode), 1500);
  });

  // Roll dice
  socket.on('rollDice', (callback) => {
    const gameCode = playerGameMap.get(socket.id);
    const game = games.get(gameCode);

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    const result = gameLogic.handleRoll(game, socket.id);
    if (!result.success) {
      callback({ success: false, error: result.error });
      return;
    }

    // Get movement path for animation
    const player = game.players.find(p => p.id === socket.id);
    const movePath = result.moveResult ? calculateMovePath(result.moveResult.oldPosition, result.moveResult.newPosition) : [];

    io.to(gameCode).emit('diceRolled', {
      playerId: socket.id,
      dice: result.dice,
      moveResult: result.moveResult,
      movePath: movePath
    });

    io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));

    callback(result);
  });

  // Calculate path of spaces for animation
  function calculateMovePath(from, to) {
    const path = [];
    let current = from;
    const spaces = to >= from ? to - from : (40 - from) + to;

    for (let i = 1; i <= spaces; i++) {
      path.push((from + i) % 40);
    }
    return path;
  }

  // Buy property
  socket.on('buyProperty', (callback) => {
    const gameCode = playerGameMap.get(socket.id);
    const game = games.get(gameCode);

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    const result = gameLogic.buyProperty(game, socket.id);
    io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));

    callback(result);
  });

  // Decline to buy property
  socket.on('declineBuy', (callback) => {
    const gameCode = playerGameMap.get(socket.id);
    const game = games.get(gameCode);

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    const result = gameLogic.declineBuy(game, socket.id);
    io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));

    callback(result);
  });

  // Build house
  socket.on('buildHouse', (propertyId, callback) => {
    const gameCode = playerGameMap.get(socket.id);
    const game = games.get(gameCode);

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    const result = gameLogic.buildHouse(game, socket.id, propertyId);
    io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));

    callback(result);
  });

  // Sell house
  socket.on('sellHouse', (propertyId, callback) => {
    const gameCode = playerGameMap.get(socket.id);
    const game = games.get(gameCode);

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    const result = gameLogic.sellHouse(game, socket.id, propertyId);
    io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));

    callback(result);
  });

  // Mortgage property
  socket.on('mortgageProperty', (propertyId, callback) => {
    const gameCode = playerGameMap.get(socket.id);
    const game = games.get(gameCode);

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    const result = gameLogic.mortgageProperty(game, socket.id, propertyId);
    io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));

    callback(result);
  });

  // Unmortgage property
  socket.on('unmortgageProperty', (propertyId, callback) => {
    const gameCode = playerGameMap.get(socket.id);
    const game = games.get(gameCode);

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    const result = gameLogic.unmortgageProperty(game, socket.id, propertyId);
    io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));

    callback(result);
  });

  // Pay bail
  socket.on('payBail', (callback) => {
    const gameCode = playerGameMap.get(socket.id);
    const game = games.get(gameCode);

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    const result = gameLogic.payBail(game, socket.id);
    io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));

    callback(result);
  });

  // Use Get Out of Jail Free card
  socket.on('useJailCard', (callback) => {
    const gameCode = playerGameMap.get(socket.id);
    const game = games.get(gameCode);

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    const result = gameLogic.useJailCard(game, socket.id);
    io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));

    callback(result);
  });

  // End turn
  socket.on('endTurn', (callback) => {
    const gameCode = playerGameMap.get(socket.id);
    const game = games.get(gameCode);

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    const result = gameLogic.endTurn(game, socket.id);

    if (result.gameOver) {
      io.to(gameCode).emit('gameOver', { winner: result.winner });
    }

    io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));

    callback(result);

    // Process AI turn if needed
    if (!result.rollAgain) {
      setTimeout(() => processAITurn(gameCode), 1000);
    }
  });

  // Declare bankruptcy
  socket.on('declareBankruptcy', (toPlayerId, callback) => {
    const gameCode = playerGameMap.get(socket.id);
    const game = games.get(gameCode);

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    const result = gameLogic.declareBankruptcy(game, socket.id, toPlayerId);

    if (result.gameOver) {
      io.to(gameCode).emit('gameOver', { winner: result.winner });
    }

    io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));

    callback(result);

    // Process AI turn if needed
    setTimeout(() => processAITurn(gameCode), 1000);
  });

  // Resolve pending payment
  socket.on('resolvePayment', (callback) => {
    const gameCode = playerGameMap.get(socket.id);
    const game = games.get(gameCode);

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    const result = gameLogic.resolvePayment(game, socket.id);
    io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));

    callback(result);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    const gameCode = playerGameMap.get(socket.id);
    if (gameCode) {
      const game = games.get(gameCode);
      if (game) {
        gameLogic.removePlayer(game, socket.id);

        // Check if game should be cleaned up
        const humanPlayers = game.players.filter(p => !p.bankrupt && !p.isAI);
        if (humanPlayers.length === 0 || (game.status === 'lobby' && game.players.length === 0)) {
          games.delete(gameCode);
          aiProcessing.delete(gameCode);
          console.log(`Game ${gameCode} cleaned up`);
        } else {
          io.to(gameCode).emit('gameUpdate', gameLogic.getGameState(game));
          io.to(gameCode).emit('playerLeft', { playerId: socket.id });
        }
      }
      playerGameMap.delete(socket.id);
    }
  });

  // Get current game state (for reconnection)
  socket.on('getGameState', (callback) => {
    const gameCode = playerGameMap.get(socket.id);
    const game = games.get(gameCode);

    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }

    callback({
      success: true,
      gameState: gameLogic.getGameState(game)
    });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n=================================');
  console.log('  MONOPOLY MULTIPLAYER SERVER');
  console.log('=================================\n');
  console.log(`Server running on port ${PORT}`);
  console.log('\nPlayers can connect using:');
  console.log(`  - http://localhost:${PORT}`);

  const ips = getLocalIPs();
  ips.forEach(ip => {
    console.log(`  - http://${ip}:${PORT}`);
  });

  console.log('\n=================================\n');
});

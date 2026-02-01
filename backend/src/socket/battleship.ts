import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { checkQuestProgress } from '../routes/quests.js';

interface BattleshipPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  board: number[][]; // 0 = empty, 1 = ship, 2 = hit, 3 = miss
  opponentBoard: number[][]; // What this player sees of opponent's board
  ships: Array<{ x: number; y: number; length: number; horizontal: boolean }>;
  ready: boolean;
  shipsPlaced: boolean;
}

interface BattleshipGame {
  partyId: string;
  players: BattleshipPlayer[];
  currentPlayerIndex: number;
  phase: 'placement' | 'playing' | 'finished';
  winnerId: string | null;
  isActive: boolean;
}

const activeGames = new Map<string, BattleshipGame>();
const playerSockets = new Map<string, string>(); // userId -> socketId

interface PendingPlayAgainPrompt {
  partyId: string;
  responses: Map<string, boolean>;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  timer: NodeJS.Timeout | null;
}

const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();
const PLAY_AGAIN_TIMEOUT = 20000;

const BOARD_SIZE = 10;
const SHIPS = [5, 4, 3, 3, 2]; // Ship lengths

function createEmptyBoard(): number[][] {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
}

function isValidPlacement(
  board: number[][],
  x: number,
  y: number,
  length: number,
  horizontal: boolean
): boolean {
  if (horizontal) {
    if (y + length > BOARD_SIZE) return false;
    for (let i = 0; i < length; i++) {
      if (board[x][y + i] !== 0) return false;
      // Check adjacent cells
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = x + dx;
          const ny = y + i + dy;
          if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
            if (board[nx][ny] === 1) return false;
          }
        }
      }
    }
  } else {
    if (x + length > BOARD_SIZE) return false;
    for (let i = 0; i < length; i++) {
      if (board[x + i][y] !== 0) return false;
      // Check adjacent cells
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = x + i + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
            if (board[nx][ny] === 1) return false;
          }
        }
      }
    }
  }
  return true;
}

function placeShip(
  board: number[][],
  x: number,
  y: number,
  length: number,
  horizontal: boolean
): boolean {
  if (!isValidPlacement(board, x, y, length, horizontal)) {
    return false;
  }

  if (horizontal) {
    for (let i = 0; i < length; i++) {
      board[x][y + i] = 1;
    }
  } else {
    for (let i = 0; i < length; i++) {
      board[x + i][y] = 1;
    }
  }
  return true;
}

function allShipsSunk(board: number[][], ships: Array<{ x: number; y: number; length: number; horizontal: boolean }>): boolean {
  for (const ship of ships) {
    let sunk = true;
    if (ship.horizontal) {
      for (let i = 0; i < ship.length; i++) {
        if (board[ship.x][ship.y + i] !== 2) {
          sunk = false;
          break;
        }
      }
    } else {
      for (let i = 0; i < ship.length; i++) {
        if (board[ship.x + i][ship.y] !== 2) {
          sunk = false;
          break;
        }
      }
    }
    if (!sunk) return false;
  }
  return true;
}

function serializeGameState(game: BattleshipGame, userId: string) {
  const player = game.players.find((p) => p.userId === userId);
  const opponent = game.players.find((p) => p.userId !== userId);

  if (!player || !opponent) return null;

  return {
    partyId: game.partyId,
    phase: game.phase,
    currentPlayerId: game.players[game.currentPlayerIndex].userId,
    myBoard: player.board,
    opponentBoard: player.opponentBoard,
    myShips: player.ships,
    myReady: player.ready,
    myShipsPlaced: player.shipsPlaced,
    opponentReady: opponent.ready,
    opponentShipsPlaced: opponent.shipsPlaced,
    winnerId: game.winnerId,
    players: game.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
    })),
  };
}

function emitState(game: BattleshipGame, io: Server) {
  for (const player of game.players) {
    const socketId = playerSockets.get(player.userId);
    if (socketId) {
      const state = serializeGameState(game, player.userId);
      if (state) {
        io.to(socketId).emit('battleship:state', state);
      }
    }
  }
}

async function endGame(game: BattleshipGame, io: Server, winnerId: string) {
  game.isActive = false;
  game.phase = 'finished';
  game.winnerId = winnerId;

  const winner = game.players.find((p) => p.userId === winnerId);
  const loser = game.players.find((p) => p.userId !== winnerId);

  if (!winner || !loser) return;

  // Calculate rewards
  const winnerReward = {
    aura: 30,
    money: 50,
  };

  const loserReward = {
    aura: 0,
    money: 20,
  };

  // Update user balances and stats
  try {
    const [updatedWinner, updatedLoser] = await Promise.all([
      prisma.user.update({
        where: { id: winnerId },
        data: {
          aura: { increment: winnerReward.aura },
          money: { increment: winnerReward.money },
        },
        select: { aura: true, money: true },
      }),
      prisma.user.update({
        where: { id: loser.userId },
        data: {
          money: { increment: loserReward.money },
        },
        select: { aura: true, money: true },
      }),
    ]);

    // Emit balance updates
    io.emit('economy:balance-update', {
      userId: winnerId,
      aura: updatedWinner.aura,
      money: updatedWinner.money,
    });

    io.emit('economy:balance-update', {
      userId: loser.userId,
      aura: updatedLoser.aura,
      money: updatedLoser.money,
    });

    // Check quest progress
    await checkQuestProgress(winnerId, 'BATTLESHIP_PLAYS', 1);
    await checkQuestProgress(winnerId, 'PLAY_GAMES', 1);
    await checkQuestProgress(winnerId, 'WIN_GAMES', 1);
    await checkQuestProgress(loser.userId, 'BATTLESHIP_PLAYS', 1);
    await checkQuestProgress(loser.userId, 'PLAY_GAMES', 1);
  } catch (error) {
    console.error('Error updating rewards:', error);
  }

  emitState(game, io);

  // Emit game over
  io.to(`party:${game.partyId}`).emit('battleship:game-over', {
    winnerId,
    winnerUsername: winner.username,
    rewards: {
      winner: winnerReward,
      loser: loserReward,
    },
  });

  const playAgainPrompt: PendingPlayAgainPrompt = {
    partyId: game.partyId,
    responses: new Map(),
    players: game.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
    })),
    timer: null,
  };

  pendingPlayAgainPrompts.set(game.partyId, playAgainPrompt);

  playAgainPrompt.timer = setTimeout(() => {
    resolvePlayAgainPrompt(game.partyId, io);
  }, PLAY_AGAIN_TIMEOUT);

  io.to(`party:${game.partyId}`).emit('battleship:play-again-prompt', {
    partyId: game.partyId,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: Date.now(),
    players: playAgainPrompt.players,
    responses: [],
  });

  activeGames.delete(game.partyId);
}

export const setupBattleshipHandlers = (socket: Socket, io: Server) => {
  socket.on('battleship:register', (data: { userId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    playerSockets.set(userId, socket.id);
  });

  socket.on('battleship:start', async (data: { userId: string; partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId } = data;

    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: { party: { include: { members: true } } },
      });

      if (!membership || membership.partyId !== partyId) {
        socket.emit('battleship:error', { message: 'You are not in this party' });
        return;
      }

      if (membership.party.members.length !== 2) {
        socket.emit('battleship:error', { message: 'Battleship requires exactly 2 players' });
        return;
      }

      if (activeGames.has(partyId)) {
        socket.emit('battleship:error', { message: 'A game is already in progress' });
        return;
      }

      const partyMembers = await prisma.partyMember.findMany({
        where: { partyId },
        include: {
          user: {
            select: { id: true, username: true, usernameColor: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      });

      const game: BattleshipGame = {
        partyId,
        players: partyMembers.map((m) => ({
          userId: m.user.id,
          username: m.user.username,
          usernameColor: m.user.usernameColor,
          board: createEmptyBoard(),
          opponentBoard: createEmptyBoard(),
          ships: [],
          ready: false,
          shipsPlaced: false,
        })),
        currentPlayerIndex: 0,
        phase: 'placement',
        winnerId: null,
        isActive: true,
      };

      activeGames.set(partyId, game);
      emitState(game, io);
    } catch (error) {
      console.error('Battleship start error:', error);
      socket.emit('battleship:error', { message: 'Failed to start game' });
    }
  });

  socket.on('battleship:place-ship', (data: { userId: string; partyId: string; x: number; y: number; length: number; horizontal: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, x, y, length, horizontal } = data;
    const game = activeGames.get(partyId);

    if (!game || !game.isActive) {
      socket.emit('battleship:error', { message: 'No active game' });
      return;
    }

    const player = game.players.find((p) => p.userId === userId);
    if (!player) {
      socket.emit('battleship:error', { message: 'You are not in this game' });
      return;
    }

    if (game.phase !== 'placement') {
      socket.emit('battleship:error', { message: 'Placement phase is over' });
      return;
    }

    if (player.shipsPlaced) {
      socket.emit('battleship:error', { message: 'You have already placed all ships' });
      return;
    }

    // Check if this ship length is still needed
    const placedLengths = player.ships.map((s) => s.length);
    const neededLengths = [...SHIPS];
    for (const placedLength of placedLengths) {
      const index = neededLengths.indexOf(placedLength);
      if (index !== -1) {
        neededLengths.splice(index, 1);
      }
    }

    if (!neededLengths.includes(length)) {
      socket.emit('battleship:error', { message: 'This ship size is not needed' });
      return;
    }

    if (placeShip(player.board, x, y, length, horizontal)) {
      player.ships.push({ x, y, length, horizontal });
      
      // Check if all ships are placed
      if (player.ships.length === SHIPS.length) {
        player.shipsPlaced = true;
      }

      emitState(game, io);

      // Check if both players are ready
      if (game.players.every((p) => p.shipsPlaced)) {
        game.phase = 'playing';
        game.currentPlayerIndex = Math.floor(Math.random() * 2); // Random starting player
        emitState(game, io);
      }
    } else {
      socket.emit('battleship:error', { message: 'Invalid ship placement' });
    }
  });

  socket.on('battleship:shoot', (data: { userId: string; partyId: string; x: number; y: number }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, x, y } = data;
    const game = activeGames.get(partyId);

    if (!game || !game.isActive) {
      socket.emit('battleship:error', { message: 'No active game' });
      return;
    }

    if (game.phase !== 'playing') {
      socket.emit('battleship:error', { message: 'Game is not in playing phase' });
      return;
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.userId !== userId) {
      socket.emit('battleship:error', { message: 'Not your turn' });
      return;
    }

    const opponent = game.players.find((p) => p.userId !== userId);
    if (!opponent) {
      socket.emit('battleship:error', { message: 'Opponent not found' });
      return;
    }

    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) {
      socket.emit('battleship:error', { message: 'Invalid coordinates' });
      return;
    }

    // Check if already shot here
    if (currentPlayer.opponentBoard[x][y] === 2 || currentPlayer.opponentBoard[x][y] === 3) {
      socket.emit('battleship:error', { message: 'Already shot here' });
      return;
    }

    // Check hit or miss
    if (opponent.board[x][y] === 1) {
      // Hit
      opponent.board[x][y] = 2;
      currentPlayer.opponentBoard[x][y] = 2;

      // Check if all ships are sunk
      if (allShipsSunk(opponent.board, opponent.ships)) {
        endGame(game, io, userId);
        return;
      }

      emitState(game, io);
      io.to(`party:${partyId}`).emit('battleship:shot-result', {
        shooterId: userId,
        x,
        y,
        hit: true,
      });
    } else {
      // Miss
      opponent.board[x][y] = 3;
      currentPlayer.opponentBoard[x][y] = 3;

      // Switch turns
      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % 2;

      emitState(game, io);
      io.to(`party:${partyId}`).emit('battleship:shot-result', {
        shooterId: userId,
        x,
        y,
        hit: false,
      });
    }
  });

  socket.on('battleship:leave', (data: { userId: string; partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId } = data;
    const game = activeGames.get(partyId);

    if (game) {
      activeGames.delete(partyId);
      io.to(`party:${partyId}`).emit('battleship:left', { userId });
    }
  });

  socket.on('battleship:play-again-response', (data: { partyId: string; userId: string; playAgain: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const prompt = pendingPlayAgainPrompts.get(data.partyId);
    if (!prompt) return;
    if (!prompt.players.find((p) => p.userId === userId)) return;

    prompt.responses.set(userId, data.playAgain);

    const responses = Array.from(prompt.responses.entries()).map(([uid, playAgain]) => ({
      userId: uid,
      playAgain,
    }));
    const playAgainCount = responses.filter((r) => r.playAgain).length;
    const leaveCount = responses.filter((r) => !r.playAgain).length;

    io.to(`party:${data.partyId}`).emit('battleship:play-again-response-update', {
      partyId: data.partyId,
      responses,
      playAgainCount,
      leaveCount,
    });

    if (prompt.responses.size === prompt.players.length) {
      resolvePlayAgainPrompt(data.partyId, io);
    }
  });
};

async function resolvePlayAgainPrompt(partyId: string, io: Server) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;

  if (prompt.timer) {
    clearTimeout(prompt.timer);
  }

  pendingPlayAgainPrompts.delete(partyId);

  const playAgainUserIds = Array.from(prompt.responses.entries())
    .filter(([_, playAgain]) => playAgain)
    .map(([userId]) => userId);

  if (playAgainUserIds.length < 2) {
    io.to(`party:${partyId}`).emit('battleship:play-again-cancelled', {
      reason: 'Not enough players want to play again (need 2)',
    });
    return;
  }

  const partyMembers = await prisma.partyMember.findMany({
    where: {
      partyId,
      userId: { in: playAgainUserIds },
    },
    include: {
      user: {
        select: { id: true, username: true, usernameColor: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  if (partyMembers.length !== 2) {
    io.to(`party:${partyId}`).emit('battleship:play-again-cancelled', {
      reason: 'Not enough players in party to play again',
    });
    return;
  }

  const game: BattleshipGame = {
    partyId,
    players: partyMembers.map((m) => ({
      userId: m.user.id,
      username: m.user.username,
      usernameColor: m.user.usernameColor,
      board: createEmptyBoard(),
      opponentBoard: createEmptyBoard(),
      ships: [],
      ready: false,
      shipsPlaced: false,
    })),
    currentPlayerIndex: 0,
    phase: 'placement',
    winnerId: null,
    isActive: true,
  };

  activeGames.set(partyId, game);
  emitState(game, io);
}

export function sendPendingBattleshipPlayAgainPrompt(socket: Socket, partyId: string, userId: string) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;

  const isPlayer = prompt.players.some((p) => p.userId === userId);
  if (!isPlayer) return;

  const responses = Array.from(prompt.responses.entries()).map(([uid, playAgain]) => ({
    userId: uid,
    playAgain,
  }));
  const playAgainCount = responses.filter((r) => r.playAgain).length;
  const leaveCount = responses.filter((r) => !r.playAgain).length;

  socket.emit('battleship:play-again-prompt', {
    partyId: prompt.partyId,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: Date.now(),
    players: prompt.players,
    responses,
    playAgainCount,
    leaveCount,
  });
}

export function sendActiveBattleshipState(socket: Socket, partyId: string, userId: string) {
  const game = activeGames.get(partyId);
  if (game && game.isActive) {
    const state = serializeGameState(game, userId);
    if (state) {
      socket.emit('battleship:state', state);
    }
  }
}

import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { checkQuestProgress } from '../routes/quests.js';
import { logGame } from '../utils/logger.js';
import { duelPartyIds, deleteDuelParty } from './duelParties.js';

const ROWS = 6;
const COLS = 7;

type Cell = 0 | 1 | 2;
type Board = Cell[][];

interface P4Player {
  userId: string;
  username: string;
  usernameColor?: string | null;
  playerIndex: 0 | 1;
}

interface P4Game {
  partyId: string;
  players: P4Player[];
  board: Board;
  currentPlayerIndex: 0 | 1;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  winCells: [number, number][] | null;
  lastMove: { col: number; row: number; playerId: string } | null;
  isActive: boolean;
}

interface PendingJoinPrompt {
  partyId: string;
  leaderId: string;
  responses: Map<string, boolean>;
  memberIds: string[];
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  timer: NodeJS.Timeout | null;
  startTime: number;
}

interface PendingPlayAgainPrompt {
  partyId: string;
  responses: Map<string, boolean>;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  timer: NodeJS.Timeout | null;
  startTime: number;
}

const activeGames = new Map<string, P4Game>();
const playerSockets = new Map<string, string>();
const pendingJoinPrompts = new Map<string, PendingJoinPrompt>();
const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();
const JOIN_PROMPT_TIMEOUT = 10000;
const PLAY_AGAIN_TIMEOUT = 20000;

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0) as Cell[]);
}

function dropPiece(board: Board, col: number, playerVal: 1 | 2): { board: Board; row: number } | null {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === 0) {
      const newBoard = board.map((r) => [...r]) as Board;
      newBoard[row][col] = playerVal;
      return { board: newBoard, row };
    }
  }
  return null;
}

function checkWin(board: Board, player: 1 | 2): [number, number][] | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (board[r][c] === player && board[r][c+1] === player && board[r][c+2] === player && board[r][c+3] === player)
        return [[r,c],[r,c+1],[r,c+2],[r,c+3]];
    }
  }
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === player && board[r+1][c] === player && board[r+2][c] === player && board[r+3][c] === player)
        return [[r,c],[r+1,c],[r+2,c],[r+3,c]];
    }
  }
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (board[r][c] === player && board[r-1][c+1] === player && board[r-2][c+2] === player && board[r-3][c+3] === player)
        return [[r,c],[r-1,c+1],[r-2,c+2],[r-3,c+3]];
    }
  }
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (board[r][c] === player && board[r+1][c+1] === player && board[r+2][c+2] === player && board[r+3][c+3] === player)
        return [[r,c],[r+1,c+1],[r+2,c+2],[r+3,c+3]];
    }
  }
  return null;
}

function isBoardFull(board: Board): boolean {
  return board[0].every((cell) => cell !== 0);
}

function serializeState(game: P4Game) {
  return {
    partyId: game.partyId,
    board: game.board,
    currentPlayerId: game.players[game.currentPlayerIndex].userId,
    phase: game.phase,
    winnerId: game.winnerId,
    winCells: game.winCells,
    lastMove: game.lastMove,
    players: game.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
      playerIndex: p.playerIndex,
    })),
  };
}

function emitState(game: P4Game, io: Server) {
  io.to(`party:${game.partyId}`).emit('p4:state', serializeState(game));
}

async function endGame(game: P4Game, io: Server, winnerId: string | null) {
  game.isActive = false;
  game.phase = 'finished';
  game.winnerId = winnerId;
  emitState(game, io);

  const winnerReward = { aura: 30, money: 50 };
  const loserReward = { aura: 0, money: 20 };
  const drawReward = { aura: 5, money: 25 };

  try {
    if (winnerId) {
      const winner = game.players.find((p) => p.userId === winnerId)!;
      const loser = game.players.find((p) => p.userId !== winnerId)!;

      const [updatedWinner, updatedLoser] = await Promise.all([
        prisma.user.update({
          where: { id: winnerId },
          data: { aura: { increment: winnerReward.aura }, money: { increment: winnerReward.money } },
          select: { id: true, aura: true, money: true },
        }),
        prisma.user.update({
          where: { id: loser.userId },
          data: { money: { increment: loserReward.money } },
          select: { id: true, aura: true, money: true },
        }),
      ]);

      io.emit('economy:balance-update', { userId: updatedWinner.id, aura: updatedWinner.aura, money: updatedWinner.money });
      io.emit('economy:balance-update', { userId: updatedLoser.id, aura: updatedLoser.aura, money: updatedLoser.money });

      await checkQuestProgress(winnerId, 'PLAY_GAMES', 1);
      await checkQuestProgress(winnerId, 'WIN_GAMES', 1);
      await checkQuestProgress(loser.userId, 'PLAY_GAMES', 1);

      io.to(`party:${game.partyId}`).emit('p4:game-over', {
        winnerId,
        winnerUsername: winner.username,
        isDraw: false,
        rewards: { winner: winnerReward, loser: loserReward },
      });

      logGame('game_complete', winner.userId, winner.username, {
        gameType: 'puissance_4', score: 1, won: true,
        auraReward: winnerReward.aura, moneyReward: winnerReward.money,
        isMultiplayer: true, partyId: game.partyId,
      });
      logGame('game_complete', loser.userId, loser.username, {
        gameType: 'puissance_4', score: 0, won: false,
        auraReward: loserReward.aura, moneyReward: loserReward.money,
        isMultiplayer: true, partyId: game.partyId,
      });
    } else {
      const updated = await Promise.all(
        game.players.map((p) =>
          prisma.user.update({
            where: { id: p.userId },
            data: { aura: { increment: drawReward.aura }, money: { increment: drawReward.money } },
            select: { id: true, aura: true, money: true },
          })
        )
      );
      for (const u of updated) {
        io.emit('economy:balance-update', { userId: u.id, aura: u.aura, money: u.money });
      }
      for (const p of game.players) {
        await checkQuestProgress(p.userId, 'PLAY_GAMES', 1);
      }

      io.to(`party:${game.partyId}`).emit('p4:game-over', {
        winnerId: null,
        winnerUsername: null,
        isDraw: true,
        rewards: { draw: drawReward },
      });
    }
  } catch (error) {
    console.error('p4:endGame error:', error);
  }

  // Play again prompt
  const prompt: PendingPlayAgainPrompt = {
    partyId: game.partyId,
    responses: new Map(),
    players: game.players.map((p) => ({ userId: p.userId, username: p.username, usernameColor: p.usernameColor })),
    timer: null,
    startTime: Date.now(),
  };
  pendingPlayAgainPrompts.set(game.partyId, prompt);
  prompt.timer = setTimeout(() => resolvePlayAgainPrompt(game.partyId, io), PLAY_AGAIN_TIMEOUT);
  io.to(`party:${game.partyId}`).emit('p4:play-again-prompt', {
    partyId: game.partyId,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: prompt.startTime,
    players: prompt.players,
    responses: [],
  });

  activeGames.delete(game.partyId);
}

async function resolvePlayAgainPrompt(partyId: string, io: Server) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;
  if (prompt.timer) clearTimeout(prompt.timer);
  pendingPlayAgainPrompts.delete(partyId);

  const playAgainUserIds = Array.from(prompt.responses.entries())
    .filter(([, v]) => v)
    .map(([uid]) => uid);

  if (playAgainUserIds.length < 2) {
    io.to(`party:${partyId}`).emit('p4:play-again-cancelled', {});
    if (duelPartyIds.has(partyId)) await deleteDuelParty(partyId, io);
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: playAgainUserIds } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  if (members.length !== 2) {
    io.to(`party:${partyId}`).emit('p4:play-again-cancelled', {});
    if (duelPartyIds.has(partyId)) await deleteDuelParty(partyId, io);
    return;
  }

  const game: P4Game = {
    partyId,
    players: members.map((m, i) => ({
      userId: m.user.id,
      username: m.user.username,
      usernameColor: m.user.usernameColor,
      playerIndex: i as 0 | 1,
    })),
    board: createBoard(),
    currentPlayerIndex: Math.floor(Math.random() * 2) as 0 | 1,
    phase: 'playing',
    winnerId: null,
    winCells: null,
    lastMove: null,
    isActive: true,
  };

  activeGames.set(partyId, game);
  emitState(game, io);
}

async function resolveJoinPrompt(partyId: string, io: Server) {
  const prompt = pendingJoinPrompts.get(partyId);
  if (!prompt) return;
  if (prompt.timer) clearTimeout(prompt.timer);
  pendingJoinPrompts.delete(partyId);

  const acceptedIds = Array.from(prompt.responses.entries())
    .filter(([, v]) => v)
    .map(([uid]) => uid);

  if (acceptedIds.length < 2) {
    io.to(`party:${partyId}`).emit('p4:join-cancelled', {});
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: acceptedIds } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  if (members.length !== 2) {
    io.to(`party:${partyId}`).emit('p4:join-cancelled', {});
    return;
  }

  const game: P4Game = {
    partyId,
    players: members.map((m, i) => ({
      userId: m.user.id,
      username: m.user.username,
      usernameColor: m.user.usernameColor,
      playerIndex: i as 0 | 1,
    })),
    board: createBoard(),
    currentPlayerIndex: Math.floor(Math.random() * 2) as 0 | 1,
    phase: 'playing',
    winnerId: null,
    winCells: null,
    lastMove: null,
    isActive: true,
  };

  activeGames.set(partyId, game);
  emitState(game, io);
}

export function startDirectP4Game(
  partyId: string,
  players: Array<{ user: { id: string; username: string; usernameColor?: string | null } }>,
  io: Server
) {
  if (activeGames.has(partyId)) return;
  const game: P4Game = {
    partyId,
    players: players.map((m, i) => ({
      userId: m.user.id,
      username: m.user.username,
      usernameColor: m.user.usernameColor ?? null,
      playerIndex: i as 0 | 1,
    })),
    board: createBoard(),
    currentPlayerIndex: Math.floor(Math.random() * 2) as 0 | 1,
    phase: 'playing',
    winnerId: null,
    winCells: null,
    lastMove: null,
    isActive: true,
  };
  activeGames.set(partyId, game);
  emitState(game, io);
}

export const setupPuissanceQuatreHandlers = (socket: Socket, io: Server) => {
  socket.on('p4:register', async () => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    playerSockets.set(userId, socket.id);

    // Resend active game state on reconnect — fall back to Prisma lookup if partyId not in socket.data
    let partyId = socket.data.partyId as string | undefined;
    if (!partyId) {
      try {
        const membership = await prisma.partyMember.findUnique({
          where: { userId },
          select: { partyId: true },
        });
        partyId = membership?.partyId;
      } catch {}
    }
    if (!partyId) return;

    const game = activeGames.get(partyId);
    if (game && game.players.some((p) => p.userId === userId)) {
      socket.emit('p4:state', serializeState(game));
    }
    const joinPrompt = pendingJoinPrompts.get(partyId);
    if (joinPrompt) {
      const responses = Array.from(joinPrompt.responses.entries()).map(([uid, v]) => ({ userId: uid, accepted: v }));
      socket.emit('p4:join-prompt', {
        partyId: joinPrompt.partyId,
        leaderId: joinPrompt.leaderId,
        timeLimit: JOIN_PROMPT_TIMEOUT,
        startTime: joinPrompt.startTime,
        members: joinPrompt.members,
        responses,
      });
    }

    const playAgainPrompt = pendingPlayAgainPrompts.get(partyId);
    if (playAgainPrompt) {
      const responses = Array.from(playAgainPrompt.responses.entries()).map(([uid, v]) => ({ userId: uid, playAgain: v }));
      socket.emit('p4:play-again-prompt', {
        partyId: playAgainPrompt.partyId,
        timeLimit: PLAY_AGAIN_TIMEOUT,
        startTime: playAgainPrompt.startTime,
        players: playAgainPrompt.players,
        responses,
      });
    }
  });

  socket.on('p4:start', async (data: { partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId } = data;

    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: {
          party: {
            include: {
              members: { include: { user: { select: { id: true, username: true, usernameColor: true } } } },
            },
          },
        },
      });

      if (!membership || membership.partyId !== partyId) {
        socket.emit('p4:error', { message: 'Tu n\'es pas dans ce duel.' });
        return;
      }
      if (!membership.isLeader) {
        socket.emit('p4:error', { message: 'Seul le leader peut lancer la partie.' });
        return;
      }
      if (membership.party.members.length !== 2) {
        socket.emit('p4:error', { message: 'Il faut exactement 2 joueurs.' });
        return;
      }
      if (activeGames.has(partyId)) {
        socket.emit('p4:error', { message: 'Une partie est déjà en cours.' });
        return;
      }
      if (pendingJoinPrompts.has(partyId)) {
        socket.emit('p4:error', { message: 'Une demande de rejoindre est déjà en cours.' });
        return;
      }

      const partyMembersData = membership.party.members;
      const memberIds = partyMembersData.map(m => m.user.id);
      const membersInfo = partyMembersData.map(m => ({
        userId: m.user.id,
        username: m.user.username,
        usernameColor: m.user.usernameColor,
      }));

      const prompt: PendingJoinPrompt = {
        partyId,
        leaderId: userId,
        responses: new Map(),
        memberIds,
        members: membersInfo,
        timer: null,
        startTime: Date.now(),
      };

      // Leader auto-accepts
      prompt.responses.set(userId, true);
      pendingJoinPrompts.set(partyId, prompt);
      prompt.timer = setTimeout(() => resolveJoinPrompt(partyId, io), JOIN_PROMPT_TIMEOUT);

      io.to(`party:${partyId}`).emit('p4:join-prompt', {
        partyId,
        leaderId: userId,
        timeLimit: JOIN_PROMPT_TIMEOUT,
        startTime: prompt.startTime,
        members: membersInfo,
        responses: [{ userId, accepted: true }],
      });
    } catch (error) {
      console.error('p4:start error:', error);
      socket.emit('p4:error', { message: 'Impossible de lancer la partie.' });
    }
  });

  socket.on('p4:join-response', async (data: { partyId: string; accepted: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const prompt = pendingJoinPrompts.get(data.partyId);
    if (!prompt) return;
    if (!prompt.memberIds.includes(userId)) return;

    prompt.responses.set(userId, data.accepted);

    const responses = Array.from(prompt.responses.entries()).map(([uid, v]) => ({ userId: uid, accepted: v }));
    io.to(`party:${data.partyId}`).emit('p4:join-response-update', {
      partyId: data.partyId,
      responses,
    });

    if (prompt.responses.size === prompt.memberIds.length) {
      await resolveJoinPrompt(data.partyId, io);
    }
  });

  socket.on('p4:drop', (data: { partyId: string; col: number }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, col } = data;

    const game = activeGames.get(partyId);
    if (!game || !game.isActive) {
      socket.emit('p4:error', { message: 'Aucune partie en cours.' });
      return;
    }
    if (game.phase !== 'playing') {
      socket.emit('p4:error', { message: 'La partie est terminée.' });
      return;
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.userId !== userId) {
      socket.emit('p4:error', { message: 'Ce n\'est pas ton tour.' });
      return;
    }

    if (col < 0 || col >= COLS) {
      socket.emit('p4:error', { message: 'Colonne invalide.' });
      return;
    }

    const playerVal = (game.currentPlayerIndex + 1) as 1 | 2;
    const result = dropPiece(game.board, col, playerVal);
    if (!result) {
      socket.emit('p4:error', { message: 'Colonne pleine.' });
      return;
    }

    game.board = result.board;
    game.lastMove = { col, row: result.row, playerId: userId };

    const win = checkWin(game.board, playerVal);
    if (win) {
      game.winCells = win;
      emitState(game, io);
      endGame(game, io, userId);
      return;
    }

    if (isBoardFull(game.board)) {
      emitState(game, io);
      endGame(game, io, null);
      return;
    }

    game.currentPlayerIndex = ((game.currentPlayerIndex + 1) % 2) as 0 | 1;
    emitState(game, io);
  });

  socket.on('p4:leave', (data: { partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId } = data;
    const game = activeGames.get(partyId);
    if (game) {
      activeGames.delete(partyId);
      io.to(`party:${partyId}`).emit('p4:left', { userId });
    }
  });

  socket.on('p4:play-again-response', (data: { partyId: string; playAgain: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const prompt = pendingPlayAgainPrompts.get(data.partyId);
    if (!prompt) return;
    if (!prompt.players.find((p) => p.userId === userId)) return;

    prompt.responses.set(userId, data.playAgain);

    const responses = Array.from(prompt.responses.entries()).map(([uid, v]) => ({ userId: uid, playAgain: v }));
    io.to(`party:${data.partyId}`).emit('p4:play-again-response-update', {
      partyId: data.partyId,
      responses,
      playAgainCount: responses.filter((r) => r.playAgain).length,
      leaveCount: responses.filter((r) => !r.playAgain).length,
    });

    if (prompt.responses.size === prompt.players.length) {
      resolvePlayAgainPrompt(data.partyId, io);
    }
  });
};

export function sendActiveP4State(socket: Socket, partyId: string, userId: string) {
  const game = activeGames.get(partyId);
  if (game && game.isActive) {
    socket.emit('p4:state', serializeState(game));
  }
}

export function sendPendingP4PlayAgainPrompt(socket: Socket, partyId: string, userId: string) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;
  if (!prompt.players.some((p) => p.userId === userId)) return;

  const responses = Array.from(prompt.responses.entries()).map(([uid, v]) => ({ userId: uid, playAgain: v }));
  socket.emit('p4:play-again-prompt', {
    partyId: prompt.partyId,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: prompt.startTime,
    players: prompt.players,
    responses,
    playAgainCount: responses.filter((r) => r.playAgain).length,
    leaveCount: responses.filter((r) => !r.playAgain).length,
  });
}

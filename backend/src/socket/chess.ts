import { Socket, Server } from 'socket.io';
import { Chess, type Square, type PieceSymbol } from 'chess.js';
import { prisma } from '../server.js';
import { checkQuestProgress } from '../routes/quests.js';
import { logGame } from '../utils/logger.js';
import { recheckBadgeForCondition } from '../utils/badgeAwards.js';
import { duelPartyIds, deleteDuelParty } from './duelParties.js';

type ChessColor = 'w' | 'b';
type ChessResult =
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'insufficient_material'
  | 'threefold_repetition'
  | 'resignation'
  | 'timeout';

interface ChessPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  color: ChessColor;
}

interface ChessGame {
  partyId: string;
  players: ChessPlayer[];
  spectators: Set<string>;
  engine: Chess;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  result: ChessResult | null;
  isActive: boolean;
  lastMove: {
    from: string;
    to: string;
    san: string;
    piece: string;
    color: ChessColor;
    promotion?: string;
    captured?: string;
  } | null;
  timeWhite: number;
  timeBlack: number;
  lastMoveTimestamp: number;
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

const activeGames = new Map<string, ChessGame>();
const playerSockets = new Map<string, string>();
const chessSpectatorPartyBySocket = new Map<string, string>();
const pendingJoinPrompts = new Map<string, PendingJoinPrompt>();
const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();
const JOIN_PROMPT_TIMEOUT = 10000;
const PLAY_AGAIN_TIMEOUT = 20000;

const GAME_TIME_MS = 10 * 60 * 1000; // 10 minutes per player

const getChessSpectateRoom = (partyId: string) => `chess:spectate:${partyId}`;

function getCapturedPieces(engine: Chess) {
  const history = engine.history({ verbose: true });
  const byWhite: string[] = [];
  const byBlack: string[] = [];
  for (const move of history) {
    if (move.captured) {
      (move.color === 'w' ? byWhite : byBlack).push(move.captured);
    }
  }
  return { byWhite, byBlack };
}

function calculateTimers(game: ChessGame) {
  if (game.phase !== 'playing') return { timeWhite: game.timeWhite, timeBlack: game.timeBlack };
  const elapsed = Date.now() - game.lastMoveTimestamp;
  const turn = game.engine.turn();
  return {
    timeWhite: turn === 'w' ? Math.max(0, game.timeWhite - elapsed) : game.timeWhite,
    timeBlack: turn === 'b' ? Math.max(0, game.timeBlack - elapsed) : game.timeBlack,
  };
}

function serializeBoard(engine: Chess) {
  return engine.board().map((row) =>
    row.map((piece) => (piece ? { type: piece.type, color: piece.color } : null))
  );
}

function getCurrentPlayer(game: ChessGame) {
  return game.players.find((player) => player.color === game.engine.turn()) ?? null;
}

function getLegalMoves(game: ChessGame, userId?: string) {
  if (!userId) {
    return {} as Record<string, string[]>;
  }
  const currentPlayer = getCurrentPlayer(game);
  if (game.phase !== 'playing' || currentPlayer?.userId !== userId) {
    return {} as Record<string, string[]>;
  }

  const moves = game.engine.moves({ verbose: true });
  return moves.reduce<Record<string, string[]>>((acc, move) => {
    const from = move.from;
    if (!acc[from]) {
      acc[from] = [];
    }
    acc[from].push(move.to);
    return acc;
  }, {});
}

function serializeState(game: ChessGame, userId?: string) {
  const { timeWhite, timeBlack } = calculateTimers(game);
  return {
    partyId: game.partyId,
    board: serializeBoard(game.engine),
    fen: game.engine.fen(),
    turn: game.engine.turn(),
    phase: game.phase,
    winnerId: game.winnerId,
    result: game.result,
    inCheck: game.engine.inCheck(),
    isDraw: game.result !== null && game.winnerId === null,
    lastMove: game.lastMove,
    legalMoves: getLegalMoves(game, userId),
    capturedPieces: getCapturedPieces(game.engine),
    timeWhite,
    timeBlack,
    players: game.players.map((player) => ({
      userId: player.userId,
      username: player.username,
      usernameColor: player.usernameColor,
      color: player.color,
    })),
  };
}

function emitChessSpectateSessions(io: Server) {
  const sessions = Array.from(activeGames.values()).map((game) => ({
    partyId: game.partyId,
    players: game.players.map((player) => ({
      userId: player.userId,
      username: player.username,
      usernameColor: player.usernameColor,
      color: player.color,
    })),
    spectatorCount: game.spectators.size,
    phase: game.phase,
  }));
  io.emit('chess:spectate-sessions', { sessions });
}

function emitChessSpectatorCount(game: ChessGame, io: Server) {
  const payload = {
    partyId: game.partyId,
    spectatorCount: game.spectators.size,
  };
  io.to(getChessSpectateRoom(game.partyId)).emit('chess:spectator-count', payload);
  for (const player of game.players) {
    const socketId = playerSockets.get(player.userId);
    if (!socketId) continue;
    io.to(socketId).emit('chess:spectator-count', payload);
  }
}

function removeChessSpectator(io: Server, spectatorSocketId: string) {
  const partyId = chessSpectatorPartyBySocket.get(spectatorSocketId);
  if (!partyId) return;

  chessSpectatorPartyBySocket.delete(spectatorSocketId);
  const game = activeGames.get(partyId);
  if (!game) return;

  game.spectators.delete(spectatorSocketId);
  const spectatorSocket = io.sockets.sockets.get(spectatorSocketId);
  spectatorSocket?.leave(getChessSpectateRoom(partyId));

  emitChessSpectatorCount(game, io);
  emitChessSpectateSessions(io);
}

function stopChessSpectateForGame(io: Server, partyId: string) {
  const game = activeGames.get(partyId);
  if (!game) return;

  io.to(getChessSpectateRoom(partyId)).emit('chess:spectate-stopped', { partyId });
  for (const spectatorSocketId of game.spectators) {
    chessSpectatorPartyBySocket.delete(spectatorSocketId);
    const spectatorSocket = io.sockets.sockets.get(spectatorSocketId);
    spectatorSocket?.leave(getChessSpectateRoom(partyId));
  }
  game.spectators.clear();
}

function emitState(game: ChessGame, io: Server) {
  for (const player of game.players) {
    const socketId = playerSockets.get(player.userId);
    if (!socketId) continue;
    io.to(socketId).emit('chess:state', serializeState(game, player.userId));
  }

  io.to(getChessSpectateRoom(game.partyId)).emit('chess:spectate-state', {
    partyId: game.partyId,
    state: serializeState(game),
  });
}

async function endGame(game: ChessGame, io: Server, winnerId: string | null, result: ChessResult) {
  game.isActive = false;
  game.phase = 'finished';
  game.winnerId = winnerId;
  game.result = result;

  emitState(game, io);

  const winnerReward = { aura: 30, money: 50 };
  const loserReward = { aura: 0, money: 20 };
  const drawReward = { aura: 5, money: 25 };

  try {
    if (winnerId) {
      const winner = game.players.find((player) => player.userId === winnerId);
      const loser = game.players.find((player) => player.userId !== winnerId);
      if (!winner || !loser) return;

      const [updatedWinner, updatedLoser] = await Promise.all([
        prisma.user.update({
          where: { id: winner.userId },
          data: {
            aura: { increment: winnerReward.aura },
            money: { increment: winnerReward.money },
          },
          select: { id: true, aura: true, money: true },
        }),
        prisma.user.update({
          where: { id: loser.userId },
          data: {
            money: { increment: loserReward.money },
          },
          select: { id: true, aura: true, money: true },
        }),
      ]);

      io.emit('economy:balance-update', {
        userId: updatedWinner.id,
        aura: updatedWinner.aura,
        money: updatedWinner.money,
      });
      io.emit('economy:balance-update', {
        userId: updatedLoser.id,
        aura: updatedLoser.aura,
        money: updatedLoser.money,
      });

      await checkQuestProgress(winner.userId, 'PLAY_GAMES', 1);
      await checkQuestProgress(winner.userId, 'WIN_GAMES', 1);
      await checkQuestProgress(loser.userId, 'PLAY_GAMES', 1);

      // Track chess stats for badge
      await Promise.all([
        prisma.gameStats.upsert({
          where: { userId_gameType: { userId: winner.userId, gameType: 'chess' } },
          create: { userId: winner.userId, gameType: 'chess', wins: 1, losses: 0, highScore: 1, totalPlayed: 1 },
          update: { wins: { increment: 1 }, totalPlayed: { increment: 1 } },
        }),
        prisma.gameStats.upsert({
          where: { userId_gameType: { userId: loser.userId, gameType: 'chess' } },
          create: { userId: loser.userId, gameType: 'chess', wins: 0, losses: 1, highScore: 0, totalPlayed: 1 },
          update: { losses: { increment: 1 }, totalPlayed: { increment: 1 } },
        }),
      ]);
      void recheckBadgeForCondition('CHESS_WIN');

      io.to(`party:${game.partyId}`).emit('chess:game-over', {
        winnerId: winner.userId,
        winnerUsername: winner.username,
        isDraw: false,
        result,
        rewards: {
          winner: winnerReward,
          loser: loserReward,
        },
      });

      logGame('game_complete', winner.userId, winner.username, {
        gameType: 'chess',
        score: 1,
        won: true,
        auraReward: winnerReward.aura,
        moneyReward: winnerReward.money,
        isMultiplayer: true,
        partyId: game.partyId,
      });
      logGame('game_complete', loser.userId, loser.username, {
        gameType: 'chess',
        score: 0,
        won: false,
        auraReward: loserReward.aura,
        moneyReward: loserReward.money,
        isMultiplayer: true,
        partyId: game.partyId,
      });
    } else {
      const updatedPlayers = await Promise.all(
        game.players.map((player) =>
          prisma.user.update({
            where: { id: player.userId },
            data: {
              aura: { increment: drawReward.aura },
              money: { increment: drawReward.money },
            },
            select: { id: true, aura: true, money: true },
          })
        )
      );

      for (const updatedPlayer of updatedPlayers) {
        io.emit('economy:balance-update', {
          userId: updatedPlayer.id,
          aura: updatedPlayer.aura,
          money: updatedPlayer.money,
        });
      }

      for (const player of game.players) {
        await checkQuestProgress(player.userId, 'PLAY_GAMES', 1);
        await prisma.gameStats.upsert({
          where: { userId_gameType: { userId: player.userId, gameType: 'chess' } },
          create: { userId: player.userId, gameType: 'chess', wins: 0, losses: 0, highScore: 0, totalPlayed: 1 },
          update: { totalPlayed: { increment: 1 } },
        });
      }

      io.to(`party:${game.partyId}`).emit('chess:game-over', {
        winnerId: null,
        winnerUsername: null,
        isDraw: true,
        result,
        rewards: {
          draw: drawReward,
        },
      });
    }
  } catch (error) {
    console.error('chess:endGame error:', error);
  }

  const prompt: PendingPlayAgainPrompt = {
    partyId: game.partyId,
    responses: new Map(),
    players: game.players.map((player) => ({
      userId: player.userId,
      username: player.username,
      usernameColor: player.usernameColor,
    })),
    timer: null,
    startTime: Date.now(),
  };

  pendingPlayAgainPrompts.set(game.partyId, prompt);
  prompt.timer = setTimeout(() => resolvePlayAgainPrompt(game.partyId, io), PLAY_AGAIN_TIMEOUT);

  io.to(`party:${game.partyId}`).emit('chess:play-again-prompt', {
    partyId: game.partyId,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: prompt.startTime,
    players: prompt.players,
    responses: [],
  });

  stopChessSpectateForGame(io, game.partyId);
  activeGames.delete(game.partyId);
  emitChessSpectateSessions(io);
}

function createGame(partyId: string, members: Array<{ user: { id: string; username: string; usernameColor?: string | null } }>) {
  const whiteIndex = Math.random() < 0.5 ? 0 : 1;
  const blackIndex = whiteIndex === 0 ? 1 : 0;

  return {
    partyId,
    players: [
      {
        userId: members[whiteIndex].user.id,
        username: members[whiteIndex].user.username,
        usernameColor: members[whiteIndex].user.usernameColor,
        color: 'w' as ChessColor,
      },
      {
        userId: members[blackIndex].user.id,
        username: members[blackIndex].user.username,
        usernameColor: members[blackIndex].user.usernameColor,
        color: 'b' as ChessColor,
      },
    ],
    spectators: new Set<string>(),
    engine: new Chess(),
    phase: 'playing' as const,
    winnerId: null,
    result: null,
    isActive: true,
    lastMove: null,
    timeWhite: GAME_TIME_MS,
    timeBlack: GAME_TIME_MS,
    lastMoveTimestamp: Date.now(),
  };
}

async function resolveJoinPrompt(partyId: string, io: Server) {
  const prompt = pendingJoinPrompts.get(partyId);
  if (!prompt) return;
  if (prompt.timer) clearTimeout(prompt.timer);
  pendingJoinPrompts.delete(partyId);

  const acceptedIds = Array.from(prompt.responses.entries())
    .filter(([, accepted]) => accepted)
    .map(([userId]) => userId);

  if (acceptedIds.length < 2) {
    io.to(`party:${partyId}`).emit('chess:join-cancelled', {});
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: acceptedIds } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  if (members.length !== 2) {
    io.to(`party:${partyId}`).emit('chess:join-cancelled', {});
    return;
  }

  const game = createGame(partyId, members);
  activeGames.set(partyId, game);
  emitState(game, io);
  emitChessSpectateSessions(io);
}

async function resolvePlayAgainPrompt(partyId: string, io: Server) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;
  if (prompt.timer) clearTimeout(prompt.timer);
  pendingPlayAgainPrompts.delete(partyId);

  const acceptedIds = Array.from(prompt.responses.entries())
    .filter(([, playAgain]) => playAgain)
    .map(([userId]) => userId);

  if (acceptedIds.length < 2) {
    io.to(`party:${partyId}`).emit('chess:play-again-cancelled', {});
    if (duelPartyIds.has(partyId)) await deleteDuelParty(partyId, io);
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: acceptedIds } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  if (members.length !== 2) {
    io.to(`party:${partyId}`).emit('chess:play-again-cancelled', {});
    if (duelPartyIds.has(partyId)) await deleteDuelParty(partyId, io);
    return;
  }

  const game = createGame(partyId, members);
  activeGames.set(partyId, game);
  emitState(game, io);
  emitChessSpectateSessions(io);
}

export function startDirectChessGame(
  partyId: string,
  players: Array<{ user: { id: string; username: string; usernameColor?: string | null } }>,
  io: Server
) {
  if (activeGames.has(partyId)) return;
  const game = createGame(partyId, players);
  activeGames.set(partyId, game);
  emitState(game, io);
  emitChessSpectateSessions(io);
}

export const setupChessHandlers = (socket: Socket, io: Server) => {
  socket.on('chess:register', async () => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    playerSockets.set(userId, socket.id);

    const membership = await prisma.partyMember.findUnique({
      where: { userId },
      select: { partyId: true },
    });

    if (!membership) return;

    const game = activeGames.get(membership.partyId);
    if (game && game.players.some((player) => player.userId === userId)) {
      socket.emit('chess:state', serializeState(game, userId));
    }

    const joinPrompt = pendingJoinPrompts.get(membership.partyId);
    if (joinPrompt && joinPrompt.memberIds.includes(userId)) {
      const responses = Array.from(joinPrompt.responses.entries()).map(([playerId, accepted]) => ({
        userId: playerId,
        accepted,
      }));

      socket.emit('chess:join-prompt', {
        partyId: joinPrompt.partyId,
        leaderId: joinPrompt.leaderId,
        timeLimit: JOIN_PROMPT_TIMEOUT,
        startTime: joinPrompt.startTime,
        members: joinPrompt.members,
        responses,
      });
    }

    const playAgainPrompt = pendingPlayAgainPrompts.get(membership.partyId);
    if (playAgainPrompt && playAgainPrompt.players.some((player) => player.userId === userId)) {
      const responses = Array.from(playAgainPrompt.responses.entries()).map(([playerId, playAgain]) => ({
        userId: playerId,
        playAgain,
      }));

      socket.emit('chess:play-again-prompt', {
        partyId: playAgainPrompt.partyId,
        timeLimit: PLAY_AGAIN_TIMEOUT,
        startTime: playAgainPrompt.startTime,
        players: playAgainPrompt.players,
        responses,
      });
    }

    socket.emit('chess:spectate-sessions', {
      sessions: Array.from(activeGames.values()).map((activeGame) => ({
        partyId: activeGame.partyId,
        players: activeGame.players.map((player) => ({
          userId: player.userId,
          username: player.username,
          usernameColor: player.usernameColor,
          color: player.color,
        })),
        spectatorCount: activeGame.spectators.size,
        phase: activeGame.phase,
      })),
    });
  });

  socket.on('chess:spectate-list-request', () => {
    socket.emit('chess:spectate-sessions', {
      sessions: Array.from(activeGames.values()).map((game) => ({
        partyId: game.partyId,
        players: game.players.map((player) => ({
          userId: player.userId,
          username: player.username,
          usernameColor: player.usernameColor,
          color: player.color,
        })),
        spectatorCount: game.spectators.size,
        phase: game.phase,
      })),
    });
  });

  socket.on('chess:spectate-join', (data: { partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    removeChessSpectator(io, socket.id);

    const game = activeGames.get(data.partyId);
    if (!game || !game.isActive) {
      socket.emit('chess:spectate-error', { message: 'Partie indisponible.' });
      return;
    }

    if (game.players.some((player) => player.userId === userId)) {
      socket.emit('chess:spectate-error', { message: 'Tu participes deja a cette partie.' });
      return;
    }

    socket.join(getChessSpectateRoom(game.partyId));
    chessSpectatorPartyBySocket.set(socket.id, game.partyId);
    game.spectators.add(socket.id);

    socket.emit('chess:spectate-joined', {
      partyId: game.partyId,
      state: serializeState(game),
      spectatorCount: game.spectators.size,
    });

    emitChessSpectatorCount(game, io);
    emitChessSpectateSessions(io);
  });

  socket.on('chess:spectate-leave', () => {
    removeChessSpectator(io, socket.id);
  });

  socket.on('chess:start', async (data: { partyId: string }) => {
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
        socket.emit('chess:error', { message: "Tu n'es pas dans ce duel." });
        return;
      }
      if (!membership.isLeader) {
        socket.emit('chess:error', { message: 'Seul le leader peut lancer la partie.' });
        return;
      }
      if (membership.party.members.length !== 2) {
        socket.emit('chess:error', { message: 'Il faut exactement 2 joueurs.' });
        return;
      }
      if (activeGames.has(partyId)) {
        socket.emit('chess:error', { message: 'Une partie est déjà en cours.' });
        return;
      }
      if (pendingJoinPrompts.has(partyId)) {
        socket.emit('chess:error', { message: 'Une demande de rejoindre est déjà en cours.' });
        return;
      }

      const prompt: PendingJoinPrompt = {
        partyId,
        leaderId: userId,
        responses: new Map([[userId, true]]),
        memberIds: membership.party.members.map((member) => member.user.id),
        members: membership.party.members.map((member) => ({
          userId: member.user.id,
          username: member.user.username,
          usernameColor: member.user.usernameColor,
        })),
        timer: null,
        startTime: Date.now(),
      };

      pendingJoinPrompts.set(partyId, prompt);
      prompt.timer = setTimeout(() => resolveJoinPrompt(partyId, io), JOIN_PROMPT_TIMEOUT);

      io.to(`party:${partyId}`).emit('chess:join-prompt', {
        partyId,
        leaderId: userId,
        timeLimit: JOIN_PROMPT_TIMEOUT,
        startTime: prompt.startTime,
        members: prompt.members,
        responses: [{ userId, accepted: true }],
      });
    } catch (error) {
      console.error('chess:start error:', error);
      socket.emit('chess:error', { message: 'Impossible de lancer la partie.' });
    }
  });

  socket.on('chess:join-response', async (data: { partyId: string; accepted: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const prompt = pendingJoinPrompts.get(data.partyId);
    if (!prompt || !prompt.memberIds.includes(userId)) return;

    prompt.responses.set(userId, data.accepted);

    const responses = Array.from(prompt.responses.entries()).map(([playerId, accepted]) => ({
      userId: playerId,
      accepted,
    }));

    io.to(`party:${data.partyId}`).emit('chess:join-response-update', {
      partyId: data.partyId,
      responses,
    });

    if (prompt.responses.size === prompt.memberIds.length) {
      await resolveJoinPrompt(data.partyId, io);
    }
  });

  socket.on('chess:move', async (data: { partyId: string; from: string; to: string; promotion?: PieceSymbol }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, from, to, promotion } = data;
    const game = activeGames.get(partyId);

    if (!game || !game.isActive) {
      socket.emit('chess:error', { message: 'Aucune partie en cours.' });
      return;
    }

    const player = game.players.find((entry) => entry.userId === userId);
    const currentPlayer = getCurrentPlayer(game);
    if (!player || currentPlayer?.userId !== userId) {
      socket.emit('chess:error', { message: "Ce n'est pas ton tour." });
      return;
    }

    try {
      const move = game.engine.move({
        from: from as Square,
        to: to as Square,
        promotion: promotion ?? 'q',
      });

      if (!move) {
        socket.emit('chess:error', { message: 'Coup invalide.' });
        return;
      }

      // Update timer for the player who just moved
      const now = Date.now();
      const elapsed = now - game.lastMoveTimestamp;
      if (move.color === 'w') {
        game.timeWhite = Math.max(0, game.timeWhite - elapsed);
      } else {
        game.timeBlack = Math.max(0, game.timeBlack - elapsed);
      }
      game.lastMoveTimestamp = now;

      game.lastMove = {
        from: move.from,
        to: move.to,
        san: move.san,
        piece: move.piece,
        color: move.color,
        promotion: move.promotion,
        captured: move.captured,
      };

      // Check timeout
      if (move.color === 'w' && game.timeWhite <= 0) {
        const blackPlayer = game.players.find((p) => p.color === 'b');
        if (blackPlayer) await endGame(game, io, blackPlayer.userId, 'timeout');
        return;
      }
      if (move.color === 'b' && game.timeBlack <= 0) {
        const whitePlayer = game.players.find((p) => p.color === 'w');
        if (whitePlayer) await endGame(game, io, whitePlayer.userId, 'timeout');
        return;
      }

      if (game.engine.isCheckmate()) {
        await endGame(game, io, userId, 'checkmate');
        return;
      }

      if (game.engine.isStalemate()) {
        await endGame(game, io, null, 'stalemate');
        return;
      }

      if (game.engine.isInsufficientMaterial()) {
        await endGame(game, io, null, 'insufficient_material');
        return;
      }

      if (game.engine.isThreefoldRepetition()) {
        await endGame(game, io, null, 'threefold_repetition');
        return;
      }

      if (game.engine.isDraw()) {
        await endGame(game, io, null, 'draw');
        return;
      }

      emitState(game, io);
    } catch (error) {
      socket.emit('chess:error', { message: 'Coup invalide.' });
    }
  });

  socket.on('chess:resign', async (data: { partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const game = activeGames.get(data.partyId);
    if (!game || !game.isActive) return;

    const opponent = game.players.find((player) => player.userId !== userId);
    if (!opponent) return;

    await endGame(game, io, opponent.userId, 'resignation');
  });

  socket.on('chess:timeout', async (data: { partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const game = activeGames.get(data.partyId);
    if (!game || !game.isActive) return;

    const player = game.players.find((p) => p.userId === userId);
    if (!player) return;

    // Verify the player's time is actually up (5s grace for network lag)
    const elapsed = Date.now() - game.lastMoveTimestamp;
    const remaining = player.color === 'w'
      ? game.timeWhite - elapsed
      : game.timeBlack - elapsed;
    if (remaining > 5000) return;

    const winner = game.players.find((p) => p.userId !== userId);
    if (winner) await endGame(game, io, winner.userId, 'timeout');
  });

  socket.on('chess:leave', (data: { partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const game = activeGames.get(data.partyId);
    if (!game) return;

    stopChessSpectateForGame(io, data.partyId);
    activeGames.delete(data.partyId);
    io.to(`party:${data.partyId}`).emit('chess:left', { userId });
    emitChessSpectateSessions(io);
  });

  socket.on('chess:play-again-response', (data: { partyId: string; playAgain: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const prompt = pendingPlayAgainPrompts.get(data.partyId);
    if (!prompt || !prompt.players.some((player) => player.userId === userId)) return;

    prompt.responses.set(userId, data.playAgain);

    const responses = Array.from(prompt.responses.entries()).map(([playerId, playAgain]) => ({
      userId: playerId,
      playAgain,
    }));

    io.to(`party:${data.partyId}`).emit('chess:play-again-response-update', {
      partyId: data.partyId,
      responses,
      playAgainCount: responses.filter((response) => response.playAgain).length,
      leaveCount: responses.filter((response) => !response.playAgain).length,
    });

    if (prompt.responses.size === prompt.players.length) {
      resolvePlayAgainPrompt(data.partyId, io);
    }
  });

  socket.on('disconnect', () => {
    const userId = socket.data.userId as string | undefined;
    if (userId && playerSockets.get(userId) === socket.id) {
      playerSockets.delete(userId);
    }
    removeChessSpectator(io, socket.id);
  });
};

export function sendActiveChessState(socket: Socket, partyId: string, userId: string) {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive) return;
  if (!game.players.some((player) => player.userId === userId)) return;
  socket.emit('chess:state', serializeState(game, userId));
}

export function sendPendingChessPlayAgainPrompt(socket: Socket, partyId: string, userId: string) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt || !prompt.players.some((player) => player.userId === userId)) return;

  const responses = Array.from(prompt.responses.entries()).map(([playerId, playAgain]) => ({
    userId: playerId,
    playAgain,
  }));

  socket.emit('chess:play-again-prompt', {
    partyId: prompt.partyId,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: prompt.startTime,
    players: prompt.players,
    responses,
  });
}

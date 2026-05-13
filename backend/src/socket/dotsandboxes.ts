import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { checkQuestProgress } from '../routes/quests.js';
import { logGame } from '../utils/logger.js';
import { getActiveClanMoneyBoostPercentsForUsers } from '../utils/clan-effects.js';
import { emitSharedBalanceUpdatesForUserIds } from '../utils/shared-balance.js';
import { applyDailyGameRewardCaps } from '../utils/daily/daily-game-rewards.js';
import { duelPartyIds, deleteDuelParty } from './duel-parties.js';

interface DotsAndBoxesPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  playerIndex: 0 | 1;
}

interface DotsAndBoxesGame {
  partyId: string;
  players: DotsAndBoxesPlayer[];
  gridSize: number; // number of dots (e.g. 5 for a 4x4 boxes grid)
  hLines: boolean[];
  vLines: boolean[];
  boxes: (0 | 1 | 2)[]; // 0: none, 1: player 0, 2: player 1
  scores: [number, number];
  currentPlayerIndex: 0 | 1;
  turnDuration: number;
  turnStartTime: number;
  turnTimer: NodeJS.Timeout | null;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  isActive: boolean;
  lastMove: { type: 'h' | 'v'; row: number; col: number; playerId: string } | null;
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

const activeGames = new Map<string, DotsAndBoxesGame>();
const playerSockets = new Map<string, string>();
const pendingJoinPrompts = new Map<string, PendingJoinPrompt>();
const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();

const JOIN_PROMPT_TIMEOUT = 10000;
const PLAY_AGAIN_TIMEOUT = 20000;
const TURN_TIMEOUT = 15000;
const GRID_SIZE = 5; // 5x5 dots = 4x4 boxes

function serializeState(game: DotsAndBoxesGame) {
  return {
    partyId: game.partyId,
    gridSize: game.gridSize,
    hLines: game.hLines,
    vLines: game.vLines,
    boxes: game.boxes,
    scores: game.scores,
    currentPlayerId: game.players[game.currentPlayerIndex].userId,
    turnDuration: game.turnDuration,
    turnStartTime: game.turnStartTime,
    phase: game.phase,
    winnerId: game.winnerId,
    lastMove: game.lastMove,
    players: game.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
      playerIndex: p.playerIndex,
    })),
  };
}

function emitState(game: DotsAndBoxesGame, io: Server) {
  io.to(`party:${game.partyId}`).emit('dotsandboxes:state', serializeState(game));
}

function clearTurnTimer(game: DotsAndBoxesGame) {
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }
}

function scheduleTurnTimer(game: DotsAndBoxesGame, io: Server) {
  clearTurnTimer(game);
  game.turnStartTime = Date.now();
  game.turnTimer = setTimeout(() => {
    void handleTurnTimeout(game.partyId, io);
  }, game.turnDuration);
}

async function handleTurnTimeout(partyId: string, io: Server) {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive || game.phase !== 'playing') return;

  clearTurnTimer(game);
  // Current player loses by timeout
  const winner = game.players.find((player) => player.userId !== game.players[game.currentPlayerIndex].userId);
  await endGame(game, io, winner?.userId ?? null);
}

async function endGame(game: DotsAndBoxesGame, io: Server, winnerId: string | null) {
  clearTurnTimer(game);
  game.isActive = false;
  game.phase = 'finished';
  game.winnerId = winnerId;
  emitState(game, io);

  const winnerReward = { aura: 18, money: 40 };
  const loserReward = { aura: 0, money: 20 };
  const drawReward = { aura: 5, money: 24 };

  try {
    const humanPlayers = game.players;
    const boostPercents = await getActiveClanMoneyBoostPercentsForUsers(humanPlayers.map(p => p.userId));
    const getBoostedMoney = (userId: string, base: number) => base + Math.floor(base * ((boostPercents.get(userId) ?? 0) / 100));

    if (winnerId) {
      const winner = game.players.find((p) => p.userId === winnerId)!;
      const loser = game.players.find((p) => p.userId !== winnerId)!;

      const resolvedWinnerReward = { ...winnerReward, money: getBoostedMoney(winner.userId, winnerReward.money) };
      const resolvedLoserReward = { ...loserReward, money: getBoostedMoney(loser.userId, loserReward.money) };

      const cappedWinnerReward = await applyDailyGameRewardCaps(prisma, winnerId, 'dotsandboxes', resolvedWinnerReward);
      const cappedLoserReward = await applyDailyGameRewardCaps(prisma, loser.userId, 'dotsandboxes', resolvedLoserReward);

      const finalWinnerReward = {
        aura: cappedWinnerReward?.appliedAura ?? 0,
        money: cappedWinnerReward?.appliedMoney ?? 0,
      };
      const finalLoserReward = {
        aura: cappedLoserReward?.appliedAura ?? 0,
        money: cappedLoserReward?.appliedMoney ?? 0,
      };

      await emitSharedBalanceUpdatesForUserIds(prisma, [winnerId, loser.userId]);

      await checkQuestProgress(winnerId, 'PLAY_GAMES', 1);
      await checkQuestProgress(winnerId, 'WIN_GAMES', 1);
      await prisma.gameStats.upsert({
        where: { userId_gameType: { userId: winnerId, gameType: 'dotsandboxes' } },
        create: { userId: winnerId, gameType: 'dotsandboxes', wins: 1, losses: 0, highScore: 1, totalPlayed: 1 },
        update: { wins: { increment: 1 }, totalPlayed: { increment: 1 } },
      });
      logGame('game_complete', winner.userId, winner.username, {
        gameType: 'dotsandboxes', score: 1, won: true,
        auraReward: finalWinnerReward.aura, moneyReward: finalWinnerReward.money,
        isMultiplayer: true, partyId: game.partyId,
      });

      await checkQuestProgress(loser.userId, 'PLAY_GAMES', 1);
      await prisma.gameStats.upsert({
        where: { userId_gameType: { userId: loser.userId, gameType: 'dotsandboxes' } },
        create: { userId: loser.userId, gameType: 'dotsandboxes', wins: 0, losses: 1, highScore: 0, totalPlayed: 1 },
        update: { losses: { increment: 1 }, totalPlayed: { increment: 1 } },
      });
      logGame('game_complete', loser.userId, loser.username, {
        gameType: 'dotsandboxes', score: 0, won: false,
        auraReward: finalLoserReward.aura, moneyReward: finalLoserReward.money,
        isMultiplayer: true, partyId: game.partyId,
      });

      io.to(`party:${game.partyId}`).emit('dotsandboxes:game-over', {
        winnerId,
        winnerUsername: winner.username,
        isDraw: false,
        rewards: { winner: finalWinnerReward, loser: finalLoserReward },
      });
    } else {
      // Draw
      const cappedDrawRewards = await Promise.all(
        humanPlayers.map(async (player) => {
          const capped = await applyDailyGameRewardCaps(prisma, player.userId, 'dotsandboxes', {
            aura: drawReward.aura,
            money: getBoostedMoney(player.userId, drawReward.money),
          });
          return {
            userId: player.userId,
            reward: { aura: capped?.appliedAura ?? 0, money: capped?.appliedMoney ?? 0 },
          };
        })
      );

      await emitSharedBalanceUpdatesForUserIds(prisma, humanPlayers.map(p => p.userId));

      for (const player of humanPlayers) {
        await checkQuestProgress(player.userId, 'PLAY_GAMES', 1);
        await prisma.gameStats.upsert({
          where: { userId_gameType: { userId: player.userId, gameType: 'dotsandboxes' } },
          create: { userId: player.userId, gameType: 'dotsandboxes', wins: 0, losses: 0, highScore: 0, totalPlayed: 1 },
          update: { totalPlayed: { increment: 1 } },
        });
      }

      io.to(`party:${game.partyId}`).emit('dotsandboxes:game-over', {
        winnerId: null,
        winnerUsername: null,
        isDraw: true,
        rewards: { draw: drawReward },
        results: game.players.map((player) => ({
          userId: player.userId,
          username: player.username,
          usernameColor: player.usernameColor,
          isWinner: false,
          rewards: cappedDrawRewards.find((r) => r.userId === player.userId)?.reward ?? { aura: 0, money: 0 },
        })),
      });
    }
  } catch (error) {
    console.error('dotsandboxes:endGame error:', error);
  }

  const prompt: PendingPlayAgainPrompt = {
    partyId: game.partyId,
    responses: new Map(),
    players: game.players.map((p) => ({ userId: p.userId, username: p.username, usernameColor: p.usernameColor })),
    timer: null,
    startTime: Date.now(),
  };

  pendingPlayAgainPrompts.set(game.partyId, prompt);
  prompt.timer = setTimeout(() => resolvePlayAgainPrompt(game.partyId, io), PLAY_AGAIN_TIMEOUT);

  io.to(`party:${game.partyId}`).emit('dotsandboxes:play-again-prompt', {
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
    .filter(([, playAgain]) => playAgain)
    .map(([userId]) => userId);

  if (playAgainUserIds.length < 2) {
    io.to(`party:${partyId}`).emit('dotsandboxes:play-again-cancelled', {});
    if (duelPartyIds.has(partyId)) await deleteDuelParty(partyId, io);
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: playAgainUserIds } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  if (members.length !== 2) {
    io.to(`party:${partyId}`).emit('dotsandboxes:play-again-cancelled', {});
    if (duelPartyIds.has(partyId)) await deleteDuelParty(partyId, io);
    return;
  }

  const game = createNewGame(partyId, members.map((m, i) => ({
    userId: m.user.id,
    username: m.user.username,
    usernameColor: m.user.usernameColor,
    playerIndex: i as 0 | 1,
  })));

  activeGames.set(partyId, game);
  scheduleTurnTimer(game, io);
  emitState(game, io);
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
    io.to(`party:${partyId}`).emit('dotsandboxes:join-cancelled', {});
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: acceptedIds } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  if (members.length !== 2) {
    io.to(`party:${partyId}`).emit('dotsandboxes:join-cancelled', {});
    return;
  }

  const game = createNewGame(partyId, members.map((m, i) => ({
    userId: m.user.id,
    username: m.user.username,
    usernameColor: m.user.usernameColor,
    playerIndex: i as 0 | 1,
  })));

  activeGames.set(partyId, game);
  scheduleTurnTimer(game, io);
  emitState(game, io);
}

function createNewGame(partyId: string, players: DotsAndBoxesPlayer[]): DotsAndBoxesGame {
  const N = GRID_SIZE;
  const numH = N * (N - 1);
  const numV = (N - 1) * N;
  const numBoxes = (N - 1) * (N - 1);

  return {
    partyId,
    players,
    gridSize: N,
    hLines: Array(numH).fill(false),
    vLines: Array(numV).fill(false),
    boxes: Array(numBoxes).fill(0),
    scores: [0, 0],
    currentPlayerIndex: Math.floor(Math.random() * 2) as 0 | 1,
    turnDuration: TURN_TIMEOUT,
    turnStartTime: Date.now(),
    turnTimer: null,
    phase: 'playing',
    winnerId: null,
    isActive: true,
    lastMove: null,
  };
}

export function startDirectDotsAndBoxesGame(
  partyId: string,
  players: Array<{ user: { id: string; username: string; usernameColor?: string | null } }>,
  io: Server
) {
  if (activeGames.has(partyId)) return;

  const game = createNewGame(partyId, players.map((p, i) => ({
    userId: p.user.id,
    username: p.user.username,
    usernameColor: p.user.usernameColor ?? null,
    playerIndex: i as 0 | 1,
  })));

  activeGames.set(partyId, game);
  scheduleTurnTimer(game, io);
  emitState(game, io);
}

export const setupDotsAndBoxesHandlers = (socket: Socket, io: Server) => {
  socket.on('dotsandboxes:register', async () => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    playerSockets.set(userId, socket.id);

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
      socket.emit('dotsandboxes:state', serializeState(game));
    }

    const joinPrompt = pendingJoinPrompts.get(partyId);
    if (joinPrompt) {
      const responses = Array.from(joinPrompt.responses.entries()).map(([uid, accepted]) => ({ userId: uid, accepted }));
      socket.emit('dotsandboxes:join-prompt', {
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
      const responses = Array.from(playAgainPrompt.responses.entries()).map(([uid, playAgain]) => ({ userId: uid, playAgain }));
      socket.emit('dotsandboxes:play-again-prompt', {
        partyId: playAgainPrompt.partyId,
        timeLimit: PLAY_AGAIN_TIMEOUT,
        startTime: playAgainPrompt.startTime,
        players: playAgainPrompt.players,
        responses,
      });
    }
  });

  socket.on('dotsandboxes:start', async (data: { partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const { partyId } = data;
    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: {
          party: {
            include: {
              members: {
                include: { user: { select: { id: true, username: true, usernameColor: true } } },
              },
            },
          },
        },
      });

      if (!membership || membership.partyId !== partyId) {
        socket.emit('dotsandboxes:error', { message: "Tu n'es pas dans ce duel." });
        return;
      }

      if (!membership.isLeader) {
        socket.emit('dotsandboxes:error', { message: 'Seul le leader peut lancer la partie.' });
        return;
      }

      if (membership.party.members.length !== 2) {
        socket.emit('dotsandboxes:error', { message: 'Il faut exactement 2 joueurs.' });
        return;
      }

      if (activeGames.has(partyId)) {
        socket.emit('dotsandboxes:error', { message: 'Une partie est deja en cours.' });
        return;
      }

      const partyMembersData = membership.party.members;
      const memberIds = partyMembersData.map((m) => m.user.id);
      const membersInfo = partyMembersData.map((m) => ({
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

      prompt.responses.set(userId, true);
      pendingJoinPrompts.set(partyId, prompt);
      prompt.timer = setTimeout(() => resolveJoinPrompt(partyId, io), JOIN_PROMPT_TIMEOUT);

      io.to(`party:${partyId}`).emit('dotsandboxes:join-prompt', {
        partyId,
        leaderId: userId,
        timeLimit: JOIN_PROMPT_TIMEOUT,
        startTime: prompt.startTime,
        members: membersInfo,
        responses: [{ userId, accepted: true }],
      });
    } catch (error) {
      console.error('dotsandboxes:start error:', error);
      socket.emit('dotsandboxes:error', { message: 'Impossible de lancer la partie.' });
    }
  });

  socket.on('dotsandboxes:join-response', async (data: { partyId: string; accepted: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const prompt = pendingJoinPrompts.get(data.partyId);
    if (!prompt || !prompt.memberIds.includes(userId)) return;

    prompt.responses.set(userId, data.accepted);
    const responses = Array.from(prompt.responses.entries()).map(([uid, accepted]) => ({ userId: uid, accepted }));

    io.to(`party:${data.partyId}`).emit('dotsandboxes:join-response-update', { partyId: data.partyId, responses });

    if (prompt.responses.size === prompt.memberIds.length) {
      await resolveJoinPrompt(data.partyId, io);
    }
  });

  socket.on('dotsandboxes:move', (data: { partyId: string; type: 'h' | 'v'; row: number; col: number }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const { partyId, type, row, col } = data;
    const game = activeGames.get(partyId);

    if (!game || !game.isActive || game.phase !== 'playing') {
      socket.emit('dotsandboxes:error', { message: 'Aucune partie en cours.' });
      return;
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.userId !== userId) {
      socket.emit('dotsandboxes:error', { message: "Ce n'est pas ton tour." });
      return;
    }

    const N = game.gridSize;
    if (type === 'h') {
      if (row < 0 || row >= N || col < 0 || col >= N - 1) {
        socket.emit('dotsandboxes:error', { message: 'Mouvement invalide.' });
        return;
      }
      const idx = row * (N - 1) + col;
      if (game.hLines[idx]) {
        socket.emit('dotsandboxes:error', { message: 'Ligne deja placee.' });
        return;
      }
      game.hLines[idx] = true;
    } else if (type === 'v') {
      if (row < 0 || row >= N - 1 || col < 0 || col >= N) {
        socket.emit('dotsandboxes:error', { message: 'Mouvement invalide.' });
        return;
      }
      const idx = row * N + col;
      if (game.vLines[idx]) {
        socket.emit('dotsandboxes:error', { message: 'Ligne deja placee.' });
        return;
      }
      game.vLines[idx] = true;
    } else {
      socket.emit('dotsandboxes:error', { message: 'Type de ligne invalide.' });
      return;
    }

    game.lastMove = { type, row, col, playerId: userId };
    clearTurnTimer(game);

    // Check for completed boxes
    let boxesCompleted = 0;
    const playerIndex = game.currentPlayerIndex;

    for (let r = 0; r < N - 1; r++) {
      for (let c = 0; c < N - 1; c++) {
        const boxIdx = r * (N - 1) + c;
        if (game.boxes[boxIdx] === 0) {
          const top = r * (N - 1) + c; // hLines
          const bottom = (r + 1) * (N - 1) + c; // hLines
          const left = r * N + c; // vLines
          const right = r * N + (c + 1); // vLines

          if (game.hLines[top] && game.hLines[bottom] && game.vLines[left] && game.vLines[right]) {
            game.boxes[boxIdx] = (playerIndex + 1) as 1 | 2;
            game.scores[playerIndex]++;
            boxesCompleted++;
          }
        }
      }
    }

    const totalBoxes = (N - 1) * (N - 1);
    const filledBoxes = game.boxes.filter((b) => b !== 0).length;

    if (filledBoxes === totalBoxes) {
      const [s0, s1] = game.scores;
      let winnerId: string | null = null;
      if (s0 > s1) winnerId = game.players[0].userId;
      else if (s1 > s0) winnerId = game.players[1].userId;

      emitState(game, io);
      void endGame(game, io, winnerId);
    } else {
      // If no box was completed, switch turns
      if (boxesCompleted === 0) {
        game.currentPlayerIndex = (1 - game.currentPlayerIndex) as 0 | 1;
      }
      scheduleTurnTimer(game, io);
      emitState(game, io);
    }
  });

  socket.on('dotsandboxes:leave', (data: { partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const game = activeGames.get(data.partyId);
    if (game) {
      clearTurnTimer(game);
      activeGames.delete(data.partyId);
      io.to(`party:${data.partyId}`).emit('dotsandboxes:left', { userId });
    }
  });

  socket.on('dotsandboxes:play-again-response', (data: { partyId: string; playAgain: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const prompt = pendingPlayAgainPrompts.get(data.partyId);
    if (!prompt || !prompt.players.find((p) => p.userId === userId)) return;

    prompt.responses.set(userId, data.playAgain);
    const responses = Array.from(prompt.responses.entries()).map(([uid, playAgain]) => ({ userId: uid, playAgain }));

    io.to(`party:${data.partyId}`).emit('dotsandboxes:play-again-response-update', { partyId: data.partyId, responses });

    if (prompt.responses.size === prompt.players.length) {
      void resolvePlayAgainPrompt(data.partyId, io);
    }
  });
};

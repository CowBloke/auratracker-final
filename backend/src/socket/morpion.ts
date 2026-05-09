import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { checkQuestProgress } from '../routes/quests.js';
import { logGame } from '../utils/logger.js';
import { getActiveClanMoneyBoostPercentsForUsers } from '../utils/clan-effects.js';
import { emitSharedBalanceUpdatesForUserIds } from '../utils/shared-balance.js';
import { applyDailyGameRewardCaps } from '../utils/daily/daily-game-rewards.js';
import { duelPartyIds, deleteDuelParty } from './duel-parties.js';
import { AI_PLAYER_ID, AI_PLAYER_NAMES, AI_MOVE_DELAY_MS, aiPartyInfos, getAIMorpionMove, type AIDifficulty } from './ai-game-state.js';

type Cell = 0 | 1 | 2;

type MorpionPlayerIndex = 0 | 1;

interface MorpionPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  playerIndex: MorpionPlayerIndex;
}

interface MorpionGame {
  partyId: string;
  players: MorpionPlayer[];
  board: Cell[];
  moveHistory: [number[], number[]];
  currentPlayerIndex: MorpionPlayerIndex;
  turnDuration: number;
  turnStartTime: number;
  turnTimer: NodeJS.Timeout | null;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  winCells: number[] | null;
  lastMove: { index: number; playerId: string; removedIndex?: number } | null;
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

const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const activeGames = new Map<string, MorpionGame>();
const playerSockets = new Map<string, string>();
const pendingJoinPrompts = new Map<string, PendingJoinPrompt>();
const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();
const JOIN_PROMPT_TIMEOUT = 10000;
const PLAY_AGAIN_TIMEOUT = 20000;
const TURN_TIMEOUT = 12000;

function createBoard(): Cell[] {
  return Array(9).fill(0) as Cell[];
}

function checkWin(board: Cell[], player: 1 | 2): number[] | null {
  for (const line of WIN_LINES) {
    if (line.every((index) => board[index] === player)) {
      return line;
    }
  }
  return null;
}

function isBoardFull(board: Cell[]): boolean {
  return board.every((cell) => cell !== 0);
}

function applyMove(game: MorpionGame, playerIndex: MorpionPlayerIndex, index: number, playerId: string): 1 | 2 {
  const playerVal = (playerIndex + 1) as 1 | 2;
  game.board[index] = playerVal;

  const history = game.moveHistory[playerIndex];
  history.push(index);

  let removedIndex: number | undefined;
  if (history.length > 3) {
    removedIndex = history.shift();
    if (removedIndex !== undefined) {
      game.board[removedIndex] = 0;
    }
  }

  game.lastMove = { index, playerId, removedIndex };
  return playerVal;
}

function serializeState(game: MorpionGame) {
  return {
    partyId: game.partyId,
    board: game.board,
    currentPlayerId: game.players[game.currentPlayerIndex].userId,
    turnDuration: game.turnDuration,
    turnStartTime: game.turnStartTime,
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

function emitState(game: MorpionGame, io: Server) {
  io.to(`party:${game.partyId}`).emit('morpion:state', serializeState(game));
}

function clearTurnTimer(game: MorpionGame) {
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }
}

function scheduleTurnTimer(game: MorpionGame, io: Server) {
  clearTurnTimer(game);
  if (game.players[game.currentPlayerIndex].userId === AI_PLAYER_ID) return; // AI manages its own moves
  game.turnStartTime = Date.now();
  game.turnTimer = setTimeout(() => {
    void handleTurnTimeout(game.partyId, io);
  }, game.turnDuration);
}

function scheduleAIMorpionMove(game: MorpionGame, io: Server) {
  const info = aiPartyInfos.get(game.partyId);
  if (!info) return;
  const delay = AI_MOVE_DELAY_MS[info.difficulty];
  setTimeout(() => { makeAIMorpionMove(game.partyId, io); }, delay);
}

function makeAIMorpionMove(partyId: string, io: Server) {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive || game.phase !== 'playing') return;
  const currentPlayer = game.players[game.currentPlayerIndex];
  if (currentPlayer.userId !== AI_PLAYER_ID) return;

  const info = aiPartyInfos.get(partyId);
  if (!info) return;

  const aiVal = (game.currentPlayerIndex + 1) as 1 | 2;
  const humanVal = (aiVal === 1 ? 2 : 1) as 1 | 2;
  const boardCopy = [...game.board] as Cell[];
  const moveIdx = getAIMorpionMove(boardCopy, aiVal, humanVal, info.difficulty);
  if (moveIdx < 0 || moveIdx > 8 || game.board[moveIdx] !== 0) return;

  clearTurnTimer(game);
  applyMove(game, game.currentPlayerIndex, moveIdx, AI_PLAYER_ID);

  const winCells = checkWin(game.board, aiVal);
  if (winCells) {
    game.winCells = winCells;
    emitState(game, io);
    void endGame(game, io, AI_PLAYER_ID);
    return;
  }
  if (isBoardFull(game.board)) {
    emitState(game, io);
    void endGame(game, io, null);
    return;
  }

  game.currentPlayerIndex = ((game.currentPlayerIndex + 1) % 2) as MorpionPlayerIndex;
  scheduleTurnTimer(game, io);
  emitState(game, io);
}

async function handleTurnTimeout(partyId: string, io: Server) {
  const game = activeGames.get(partyId);
  if (!game || !game.isActive || game.phase !== 'playing') return;

  clearTurnTimer(game);
  const winner = game.players.find((player) => player.userId !== game.players[game.currentPlayerIndex].userId);
  await endGame(game, io, winner?.userId ?? null);
}

async function endGame(game: MorpionGame, io: Server, winnerId: string | null) {
  clearTurnTimer(game);
  game.isActive = false;
  game.phase = 'finished';
  game.winnerId = winnerId;
  emitState(game, io);

  const winnerReward = { aura: 18, money: 40 };
  const loserReward = { aura: 0, money: 20 };
  const drawReward = { aura: 5, money: 24 };

  try {
    const humanPlayers = game.players.filter(p => p.userId !== AI_PLAYER_ID);
    const boostPercents = await getActiveClanMoneyBoostPercentsForUsers(humanPlayers.map(p => p.userId));
    const winnerMoneyReward = (userId: string, base: number) => base + Math.floor(base * ((boostPercents.get(userId) ?? 0) / 100));

    if (winnerId) {
      const winner = game.players.find((player) => player.userId === winnerId)!;
      const loser = game.players.find((player) => player.userId !== winnerId)!;
      const winnerIsHuman = winner.userId !== AI_PLAYER_ID;
      const loserIsHuman = loser.userId !== AI_PLAYER_ID;
      const resolvedWinnerReward = { ...winnerReward, money: winnerIsHuman ? winnerMoneyReward(winner.userId, winnerReward.money) : winnerReward.money };
      const resolvedLoserReward = { ...loserReward, money: loserIsHuman ? winnerMoneyReward(loser.userId, loserReward.money) : loserReward.money };
      const cappedWinnerReward = winnerIsHuman ? await applyDailyGameRewardCaps(prisma, winnerId, 'morpion', resolvedWinnerReward) : null;
      const cappedLoserReward = loserIsHuman ? await applyDailyGameRewardCaps(prisma, loser.userId, 'morpion', resolvedLoserReward) : null;
      const finalWinnerReward = {
        aura: cappedWinnerReward?.appliedAura ?? 0,
        money: cappedWinnerReward?.appliedMoney ?? 0,
      };
      const finalLoserReward = {
        aura: cappedLoserReward?.appliedAura ?? 0,
        money: cappedLoserReward?.appliedMoney ?? 0,
      };

      await emitSharedBalanceUpdatesForUserIds(
        prisma,
        [
          winnerIsHuman && (finalWinnerReward.aura > 0 || finalWinnerReward.money > 0) ? winnerId : null,
          loserIsHuman && (finalLoserReward.aura > 0 || finalLoserReward.money > 0) ? loser.userId : null,
        ].filter((id): id is string => Boolean(id))
      );

      if (winnerIsHuman) {
        await checkQuestProgress(winnerId, 'PLAY_GAMES', 1);
        await checkQuestProgress(winnerId, 'WIN_GAMES', 1);
        await prisma.gameStats.upsert({
          where: { userId_gameType: { userId: winnerId, gameType: 'morpion' } },
          create: { userId: winnerId, gameType: 'morpion', wins: 1, losses: 0, highScore: 1, totalPlayed: 1 },
          update: { wins: { increment: 1 }, totalPlayed: { increment: 1 } },
        });
        logGame('game_complete', winner.userId, winner.username, {
          gameType: 'morpion', score: 1, won: true,
          auraReward: cappedWinnerReward?.appliedAura ?? 0, moneyReward: cappedWinnerReward?.appliedMoney ?? 0,
          isMultiplayer: true, partyId: game.partyId,
        });
      }
      if (loserIsHuman) {
        await checkQuestProgress(loser.userId, 'PLAY_GAMES', 1);
        await prisma.gameStats.upsert({
          where: { userId_gameType: { userId: loser.userId, gameType: 'morpion' } },
          create: { userId: loser.userId, gameType: 'morpion', wins: 0, losses: 1, highScore: 0, totalPlayed: 1 },
          update: { losses: { increment: 1 }, totalPlayed: { increment: 1 } },
        });
        logGame('game_complete', loser.userId, loser.username, {
          gameType: 'morpion', score: 0, won: false,
          auraReward: cappedLoserReward?.appliedAura ?? 0, moneyReward: cappedLoserReward?.appliedMoney ?? 0,
          isMultiplayer: true, partyId: game.partyId,
        });
      }

      io.to(`party:${game.partyId}`).emit('morpion:game-over', {
        winnerId,
        winnerUsername: winner.username,
        isDraw: false,
        rewards: { winner: finalWinnerReward, loser: finalLoserReward },
      });
    } else {
      const cappedDrawRewards = await Promise.all(
        humanPlayers.map(async (player) => {
          const capped = await applyDailyGameRewardCaps(prisma, player.userId, 'morpion', {
            aura: drawReward.aura,
            money: winnerMoneyReward(player.userId, drawReward.money),
          });

          return {
            userId: player.userId,
            reward: {
              aura: capped?.appliedAura ?? 0,
              money: capped?.appliedMoney ?? 0,
            },
          };
        })
      );

      await emitSharedBalanceUpdatesForUserIds(
        prisma,
        cappedDrawRewards.filter(({ reward }) => reward.aura > 0 || reward.money > 0).map(({ userId }) => userId)
      );

      for (const player of humanPlayers) {
        await checkQuestProgress(player.userId, 'PLAY_GAMES', 1);
      }

      io.to(`party:${game.partyId}`).emit('morpion:game-over', {
        winnerId: null,
        winnerUsername: null,
        isDraw: true,
        rewards: { draw: drawReward },
        results: game.players.map((player) => ({
          userId: player.userId,
          username: player.username,
          usernameColor: player.usernameColor,
          isWinner: false,
          rewards: cappedDrawRewards.find(({ userId }) => userId === player.userId)?.reward ?? { aura: 0, money: 0 },
        })),
      });
    }
  } catch (error) {
    console.error('morpion:endGame error:', error);
  }

  const prompt: PendingPlayAgainPrompt = {
    partyId: game.partyId,
    responses: new Map(),
    players: game.players
      .filter(p => p.userId !== AI_PLAYER_ID)
      .map((player) => ({
        userId: player.userId,
        username: player.username,
        usernameColor: player.usernameColor,
      })),
    timer: null,
    startTime: Date.now(),
  };

  pendingPlayAgainPrompts.set(game.partyId, prompt);
  prompt.timer = setTimeout(() => resolvePlayAgainPrompt(game.partyId, io), PLAY_AGAIN_TIMEOUT);

  io.to(`party:${game.partyId}`).emit('morpion:play-again-prompt', {
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

  const isAIGame = aiPartyInfos.has(partyId);
  const minRequired = isAIGame ? 1 : 2;

  const playAgainUserIds = Array.from(prompt.responses.entries())
    .filter(([, playAgain]) => playAgain)
    .map(([userId]) => userId);

  if (playAgainUserIds.length < minRequired) {
    io.to(`party:${partyId}`).emit('morpion:play-again-cancelled', {});
    aiPartyInfos.delete(partyId);
    if (duelPartyIds.has(partyId)) await deleteDuelParty(partyId, io);
    return;
  }

  if (isAIGame) {
    const info = aiPartyInfos.get(partyId)!;
    const humanPlayer = prompt.players[0];
    startAIMorpionGame(partyId, humanPlayer, info.difficulty, io);
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: playAgainUserIds } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  if (members.length !== 2) {
    io.to(`party:${partyId}`).emit('morpion:play-again-cancelled', {});
    if (duelPartyIds.has(partyId)) await deleteDuelParty(partyId, io);
    return;
  }

  const game: MorpionGame = {
    partyId,
    players: members.map((member, index) => ({
      userId: member.user.id,
      username: member.user.username,
      usernameColor: member.user.usernameColor,
      playerIndex: index as MorpionPlayerIndex,
    })),
    board: createBoard(),
    moveHistory: [[], []],
    currentPlayerIndex: Math.floor(Math.random() * 2) as MorpionPlayerIndex,
    turnDuration: TURN_TIMEOUT,
    turnStartTime: Date.now(),
    turnTimer: null,
    phase: 'playing',
    winnerId: null,
    winCells: null,
    lastMove: null,
    isActive: true,
  };

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
    io.to(`party:${partyId}`).emit('morpion:join-cancelled', {});
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: acceptedIds } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  if (members.length !== 2) {
    io.to(`party:${partyId}`).emit('morpion:join-cancelled', {});
    return;
  }

  const game: MorpionGame = {
    partyId,
    players: members.map((member, index) => ({
      userId: member.user.id,
      username: member.user.username,
      usernameColor: member.user.usernameColor,
      playerIndex: index as MorpionPlayerIndex,
    })),
    board: createBoard(),
    moveHistory: [[], []],
    currentPlayerIndex: Math.floor(Math.random() * 2) as MorpionPlayerIndex,
    turnDuration: TURN_TIMEOUT,
    turnStartTime: Date.now(),
    turnTimer: null,
    phase: 'playing',
    winnerId: null,
    winCells: null,
    lastMove: null,
    isActive: true,
  };

  activeGames.set(partyId, game);
  scheduleTurnTimer(game, io);
  emitState(game, io);
}

export function startAIMorpionGame(
  partyId: string,
  humanPlayer: { userId: string; username: string; usernameColor?: string | null },
  difficulty: AIDifficulty,
  io: Server
) {
  // Register as AI game
  aiPartyInfos.set(partyId, { difficulty, humanUserId: humanPlayer.userId });

  const humanFirst = Math.random() < 0.5;
  const aiName = AI_PLAYER_NAMES[difficulty];

  const players: MorpionPlayer[] = humanFirst
    ? [
        { userId: humanPlayer.userId, username: humanPlayer.username, usernameColor: humanPlayer.usernameColor ?? null, playerIndex: 0 },
        { userId: AI_PLAYER_ID, username: aiName, usernameColor: null, playerIndex: 1 },
      ]
    : [
        { userId: AI_PLAYER_ID, username: aiName, usernameColor: null, playerIndex: 0 },
        { userId: humanPlayer.userId, username: humanPlayer.username, usernameColor: humanPlayer.usernameColor ?? null, playerIndex: 1 },
      ];

  const game: MorpionGame = {
    partyId,
    players,
    board: createBoard(),
    moveHistory: [[], []],
    currentPlayerIndex: 0,
    turnDuration: TURN_TIMEOUT,
    turnStartTime: Date.now(),
    turnTimer: null,
    phase: 'playing',
    winnerId: null,
    winCells: null,
    lastMove: null,
    isActive: true,
  };

  activeGames.set(partyId, game);
  emitState(game, io);

  if (game.players[0].userId === AI_PLAYER_ID) {
    scheduleAIMorpionMove(game, io);
  } else {
    scheduleTurnTimer(game, io);
  }
}

export function startDirectMorpionGame(
  partyId: string,
  players: Array<{ user: { id: string; username: string; usernameColor?: string | null } }>,
  io: Server
) {
  if (activeGames.has(partyId)) return;

  const game: MorpionGame = {
    partyId,
    players: players.map((member, index) => ({
      userId: member.user.id,
      username: member.user.username,
      usernameColor: member.user.usernameColor ?? null,
      playerIndex: index as MorpionPlayerIndex,
    })),
    board: createBoard(),
    moveHistory: [[], []],
    currentPlayerIndex: Math.floor(Math.random() * 2) as MorpionPlayerIndex,
    turnDuration: TURN_TIMEOUT,
    turnStartTime: Date.now(),
    turnTimer: null,
    phase: 'playing',
    winnerId: null,
    winCells: null,
    lastMove: null,
    isActive: true,
  };

  activeGames.set(partyId, game);
  scheduleTurnTimer(game, io);
  emitState(game, io);
}

export const setupMorpionHandlers = (socket: Socket, io: Server) => {
  socket.on('morpion:register', async () => {
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
    if (game && game.players.some((player) => player.userId === userId)) {
      socket.emit('morpion:state', serializeState(game));
    }

    const joinPrompt = pendingJoinPrompts.get(partyId);
    if (joinPrompt) {
      const responses = Array.from(joinPrompt.responses.entries()).map(([memberUserId, accepted]) => ({
        userId: memberUserId,
        accepted,
      }));

      socket.emit('morpion:join-prompt', {
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
      const responses = Array.from(playAgainPrompt.responses.entries()).map(([memberUserId, playAgain]) => ({
        userId: memberUserId,
        playAgain,
      }));

      socket.emit('morpion:play-again-prompt', {
        partyId: playAgainPrompt.partyId,
        timeLimit: PLAY_AGAIN_TIMEOUT,
        startTime: playAgainPrompt.startTime,
        players: playAgainPrompt.players,
        responses,
      });
    }
  });

  socket.on('morpion:start', async (data: { partyId: string }) => {
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
                include: {
                  user: { select: { id: true, username: true, usernameColor: true } },
                },
              },
            },
          },
        },
      });

      if (!membership || membership.partyId !== partyId) {
        socket.emit('morpion:error', { message: "Tu n'es pas dans ce duel." });
        return;
      }

      if (!membership.isLeader) {
        socket.emit('morpion:error', { message: 'Seul le leader peut lancer la partie.' });
        return;
      }

      if (membership.party.members.length !== 2) {
        socket.emit('morpion:error', { message: 'Il faut exactement 2 joueurs.' });
        return;
      }

      if (activeGames.has(partyId)) {
        socket.emit('morpion:error', { message: 'Une partie est deja en cours.' });
        return;
      }

      if (pendingJoinPrompts.has(partyId)) {
        socket.emit('morpion:error', { message: 'Une demande de rejoindre est deja en cours.' });
        return;
      }

      const partyMembersData = membership.party.members;
      const memberIds = partyMembersData.map((member) => member.user.id);
      const membersInfo = partyMembersData.map((member) => ({
        userId: member.user.id,
        username: member.user.username,
        usernameColor: member.user.usernameColor,
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

      io.to(`party:${partyId}`).emit('morpion:join-prompt', {
        partyId,
        leaderId: userId,
        timeLimit: JOIN_PROMPT_TIMEOUT,
        startTime: prompt.startTime,
        members: membersInfo,
        responses: [{ userId, accepted: true }],
      });
    } catch (error) {
      console.error('morpion:start error:', error);
      socket.emit('morpion:error', { message: 'Impossible de lancer la partie.' });
    }
  });

  socket.on('morpion:join-response', async (data: { partyId: string; accepted: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const prompt = pendingJoinPrompts.get(data.partyId);
    if (!prompt) return;
    if (!prompt.memberIds.includes(userId)) return;

    prompt.responses.set(userId, data.accepted);

    const responses = Array.from(prompt.responses.entries()).map(([memberUserId, accepted]) => ({
      userId: memberUserId,
      accepted,
    }));

    io.to(`party:${data.partyId}`).emit('morpion:join-response-update', {
      partyId: data.partyId,
      responses,
    });

    if (prompt.responses.size === prompt.memberIds.length) {
      await resolveJoinPrompt(data.partyId, io);
    }
  });

  socket.on('morpion:move', (data: { partyId: string; index: number }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const { partyId, index } = data;

    const game = activeGames.get(partyId);
    if (!game || !game.isActive) {
      socket.emit('morpion:error', { message: 'Aucune partie en cours.' });
      return;
    }

    if (game.phase !== 'playing') {
      socket.emit('morpion:error', { message: 'La partie est terminee.' });
      return;
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.userId !== userId) {
      socket.emit('morpion:error', { message: "Ce n'est pas ton tour." });
      return;
    }

    if (!Number.isInteger(index) || index < 0 || index > 8) {
      socket.emit('morpion:error', { message: 'Case invalide.' });
      return;
    }

    if (game.board[index] !== 0) {
      socket.emit('morpion:error', { message: 'Case deja prise.' });
      return;
    }

    clearTurnTimer(game);

    const playerVal = applyMove(game, game.currentPlayerIndex, index, userId);

    const winCells = checkWin(game.board, playerVal);
    if (winCells) {
      game.winCells = winCells;
      emitState(game, io);
      void endGame(game, io, userId);
      return;
    }

    if (isBoardFull(game.board)) {
      emitState(game, io);
      void endGame(game, io, null);
      return;
    }

    game.currentPlayerIndex = ((game.currentPlayerIndex + 1) % 2) as MorpionPlayerIndex;
    emitState(game, io);

    if (game.players[game.currentPlayerIndex].userId === AI_PLAYER_ID) {
      scheduleAIMorpionMove(game, io);
    } else {
      scheduleTurnTimer(game, io);
    }
  });

  socket.on('morpion:leave', (data: { partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const { partyId } = data;
    const game = activeGames.get(partyId);
    if (game) {
      clearTurnTimer(game);
      activeGames.delete(partyId);
      aiPartyInfos.delete(partyId);
      io.to(`party:${partyId}`).emit('morpion:left', { userId });
    }
  });

  socket.on('morpion:play-again-response', (data: { partyId: string; playAgain: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const prompt = pendingPlayAgainPrompts.get(data.partyId);
    if (!prompt) return;
    if (!prompt.players.find((player) => player.userId === userId)) return;

    prompt.responses.set(userId, data.playAgain);

    const responses = Array.from(prompt.responses.entries()).map(([memberUserId, playAgain]) => ({
      userId: memberUserId,
      playAgain,
    }));

    io.to(`party:${data.partyId}`).emit('morpion:play-again-response-update', {
      partyId: data.partyId,
      responses,
      playAgainCount: responses.filter((response) => response.playAgain).length,
      leaveCount: responses.filter((response) => !response.playAgain).length,
    });

    if (prompt.responses.size === prompt.players.length) {
      void resolvePlayAgainPrompt(data.partyId, io);
    }
  });
};

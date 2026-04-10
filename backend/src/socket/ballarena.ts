import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { checkQuestProgress } from '../routes/quests.js';
import { logGame } from '../utils/logger.js';
import { recheckBadgeForCondition } from '../utils/badgeAwards.js';
import { getActiveClanMoneyBoostPercentsForUsers } from '../utils/clanEffects.js';
import { emitSharedBalanceUpdatesForUserIds } from '../utils/sharedBalance.js';
import { applyDailyGameRewardCaps } from '../utils/dailyGameRewards.js';
import { duelPartyIds, deleteDuelParty } from './duelParties.js';

// ─── Arena constants ──────────────────────────────────────────────────────────
export const ARENA_CX = 300;
export const ARENA_CY = 300;
export const ARENA_RADIUS = 240;
export const BALL_RADIUS = 22;
export const PREP_TIME_MS = 10_000;
const GAME_TIME_LIMIT_MS = 25_000;
export const MAX_SPEED = 400; // game units per second
const FRICTION = 0.984; // velocity multiplier per 16 ms tick
const SIM_STEP_MS = 16;
const BROADCAST_EVERY_N_TICKS = 4; // broadcast every ~64 ms ≈ 15 fps
export const EXIT_THRESHOLD = ARENA_RADIUS - BALL_RADIUS; // 218
const STALEMATE_SPEED_THRESHOLD = 6; // px/s — both balls below this → new round
const STALEMATE_TICKS_MIN = 60;    // wait at least ~1s before checking

// ─── Types ────────────────────────────────────────────────────────────────────
type BallArenaMode = 'duo' | 'multiplayer';

interface BallArenaPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  playerIndex: number;
}

interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  plannedVx: number;
  plannedVy: number;
  hasSetDirection: boolean;
  isOut: boolean;
}

interface BallArenaGame {
  partyId: string;
  mode: BallArenaMode;
  players: BallArenaPlayer[];
  balls: BallState[];
  phase: 'prep' | 'playing' | 'finished';
  prepStartTime: number;
  playStartTime: number | null;
  winnerId: string | null;
  isDraw: boolean;
  isActive: boolean;
  simInterval: NodeJS.Timeout | null;
  prepTimeout: NodeJS.Timeout | null;
  gameTimeout: NodeJS.Timeout | null;
  tickCount: number;
  replayFrames: number[][];
  round: number;
}

interface PendingJoinPrompt {
  partyId: string;
  mode: BallArenaMode;
  leaderId: string;
  responses: Map<string, boolean>;
  memberIds: string[];
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  timer: NodeJS.Timeout | null;
  startTime: number;
}

interface PendingPlayAgainPrompt {
  partyId: string;
  mode: BallArenaMode;
  responses: Map<string, boolean>;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  timer: NodeJS.Timeout | null;
  startTime: number;
}

const activeGames = new Map<string, BallArenaGame>();
const playerSockets = new Map<string, string>();
const pendingJoinPrompts = new Map<string, PendingJoinPrompt>();
const pendingPlayAgainPrompts = new Map<string, PendingPlayAgainPrompt>();

const JOIN_PROMPT_TIMEOUT = 10_000;
const PLAY_AGAIN_TIMEOUT = 20_000;

// ─── Physics ──────────────────────────────────────────────────────────────────
function dist2(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function getInitialPositions(playerCount: number): Array<[number, number]> {
  if (playerCount <= 2) {
    return [
      [200, 300],
      [400, 300],
    ];
  }

  const radius = Math.min(150, EXIT_THRESHOLD - 42);
  return Array.from({ length: playerCount }, (_, index) => {
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / playerCount);
    return [
      ARENA_CX + Math.cos(angle) * radius,
      ARENA_CY + Math.sin(angle) * radius,
    ];
  });
}

function simStep(balls: BallState[]): void {
  const dt = SIM_STEP_MS / 1000;

  for (const ball of balls) {
    if (ball.isOut) continue;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;
  }

  // Ball–ball elastic collision (equal masses)
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const b0 = balls[i];
      const b1 = balls[j];
      if (b0.isOut || b1.isOut) continue;
      const d = dist2(b0.x, b0.y, b1.x, b1.y);
      if (d < BALL_RADIUS * 2 && d > 0.001) {
        const nx = (b1.x - b0.x) / d;
        const ny = (b1.y - b0.y) / d;
        const dvx = b0.vx - b1.vx;
        const dvy = b0.vy - b1.vy;
        const p = dvx * nx + dvy * ny;
        if (p > 0) {
          b0.vx -= p * nx;
          b0.vy -= p * ny;
          b1.vx += p * nx;
          b1.vy += p * ny;
          // Separate to prevent overlap
          const overlap = BALL_RADIUS * 2 - d;
          b0.x -= nx * overlap * 0.5;
          b0.y -= ny * overlap * 0.5;
          b1.x += nx * overlap * 0.5;
          b1.y += ny * overlap * 0.5;
        }
      }
    }
  }

  // Check exit condition
  for (const ball of balls) {
    if (ball.isOut) continue;
    if (dist2(ball.x, ball.y, ARENA_CX, ARENA_CY) > EXIT_THRESHOLD) {
      ball.isOut = true;
    }
  }
}

// ─── State serialization ──────────────────────────────────────────────────────
function serializeState(game: BallArenaGame) {
  return {
    partyId: game.partyId,
    mode: game.mode,
    phase: game.phase,
    prepStartTime: game.prepStartTime,
    prepTimeMs: PREP_TIME_MS,
    playStartTime: game.playStartTime,
    winnerId: game.winnerId,
    isDraw: game.isDraw,
    round: game.round,
    players: game.players.map((p, i) => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
      playerIndex: p.playerIndex,
      x: game.balls[i].x,
      y: game.balls[i].y,
      vx: game.balls[i].vx,
      vy: game.balls[i].vy,
      plannedVx: game.balls[i].plannedVx,
      plannedVy: game.balls[i].plannedVy,
      hasSetDirection: game.balls[i].hasSetDirection,
      isOut: game.balls[i].isOut,
    })),
  };
}

function emitState(game: BallArenaGame, io: Server) {
  io.to(`party:${game.partyId}`).emit('ballarena:state', serializeState(game));
}

// ─── Stalemate reset ──────────────────────────────────────────────────────────
function resetForNewRound(game: BallArenaGame, io: Server) {
  game.round++;
  game.phase = 'prep';
  game.prepStartTime = Date.now();
  game.playStartTime = null;

  for (let i = 0; i < game.balls.length; i++) {
    game.balls[i].vx = 0;
    game.balls[i].vy = 0;
    game.balls[i].plannedVx = 0;
    game.balls[i].plannedVy = 0;
    // Eliminated players stay eliminated for the rest of the multiplayer game.
    game.balls[i].hasSetDirection = game.balls[i].isOut;
  }

  emitState(game, io);
  game.prepTimeout = setTimeout(() => startSimulation(game, io), PREP_TIME_MS);
}

// ─── Simulation ───────────────────────────────────────────────────────────────
function startSimulation(game: BallArenaGame, io: Server) {
  if (game.phase !== 'prep') return;

  // Clear prep timeout if it fires naturally
  if (game.prepTimeout) {
    clearTimeout(game.prepTimeout);
    game.prepTimeout = null;
  }

  game.phase = 'playing';
  game.playStartTime = Date.now();

  // Apply planned velocities
  for (const ball of game.balls) {
    ball.vx = ball.plannedVx;
    ball.vy = ball.plannedVy;
  }

  // Send dedicated sim-start so clients can run physics locally
  io.to(`party:${game.partyId}`).emit('ballarena:sim-start', {
    partyId: game.partyId,
    balls: game.balls.map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, isOut: b.isOut })),
  });

  emitState(game, io);

  // Reset replay and record initial frame
  game.replayFrames = [];
  game.replayFrames.push(game.balls.flatMap((ball) => [ball.x, ball.y, ball.isOut ? 1 : 0]));

  game.tickCount = 0;
  game.simInterval = setInterval(() => {
    if (game.phase !== 'playing') {
      stopSimulation(game);
      return;
    }

    simStep(game.balls);
    game.tickCount++;

    // Record replay frames (no live broadcast — client runs physics locally)
    if (game.tickCount % BROADCAST_EVERY_N_TICKS === 0) {
      game.replayFrames.push(game.balls.flatMap((ball) => [ball.x, ball.y, ball.isOut ? 1 : 0]));
    }

    const alivePlayers = game.players.filter((_, index) => !game.balls[index].isOut);
    if (alivePlayers.length <= 1) {
      stopSimulation(game);
      let winnerId: string | null = null;
      let isDraw = false;
      if (alivePlayers.length === 0) {
        isDraw = true;
      } else {
        winnerId = alivePlayers[0].userId;
      }
      endGame(game, io, winnerId, isDraw);
      return;
    }

    // Stalemate: both balls stopped, nobody out → new round
    if (game.tickCount >= STALEMATE_TICKS_MIN) {
      const movingBalls = game.balls.filter((ball) => !ball.isOut);
      const isStalemate = movingBalls.every((ball) => (
        Math.sqrt(ball.vx ** 2 + ball.vy ** 2) < STALEMATE_SPEED_THRESHOLD
      ));
      if (movingBalls.length > 1 && isStalemate) {
        stopSimulation(game);
        resetForNewRound(game, io);
      }
    }
  }, SIM_STEP_MS);

  game.gameTimeout = setTimeout(() => {
    if (game.phase === 'playing') {
      stopSimulation(game);
      endGame(game, io, null, true);
    }
  }, GAME_TIME_LIMIT_MS);
}

function stopSimulation(game: BallArenaGame) {
  if (game.simInterval) {
    clearInterval(game.simInterval);
    game.simInterval = null;
  }
  if (game.gameTimeout) {
    clearTimeout(game.gameTimeout);
    game.gameTimeout = null;
  }
}

// ─── End game ─────────────────────────────────────────────────────────────────
async function endGame(
  game: BallArenaGame,
  io: Server,
  winnerId: string | null,
  isDraw: boolean
) {
  game.isActive = false;
  game.phase = 'finished';
  game.winnerId = winnerId;
  game.isDraw = isDraw;
  emitState(game, io);

  const winnerReward = { aura: 30, money: 50 };
  const loserReward = { aura: 0, money: 20 };
  const drawReward = { aura: 5, money: 25 };

  try {
    const boostPercents = await getActiveClanMoneyBoostPercentsForUsers(game.players.map((player) => player.userId));
    const resolveMoneyReward = (userId: string, base: number) => base + Math.floor(base * ((boostPercents.get(userId) ?? 0) / 100));

    if (!isDraw && winnerId) {
      const winner = game.players.find((p) => p.userId === winnerId)!;
      const losers = game.players.filter((p) => p.userId !== winnerId);
      const resolvedWinnerReward = { ...winnerReward, money: resolveMoneyReward(winner.userId, winnerReward.money) };
      const resolvedLoserRewards = new Map(losers.map((loser) => [loser.userId, { ...loserReward, money: resolveMoneyReward(loser.userId, loserReward.money) }]));
      const cappedWinnerReward = await applyDailyGameRewardCaps(prisma, winner.userId, 'ball_arena', resolvedWinnerReward);
      const cappedLoserRewards = new Map(await Promise.all(
        losers.map(async (loser) => {
          const capped = await applyDailyGameRewardCaps(prisma, loser.userId, 'ball_arena', resolvedLoserRewards.get(loser.userId) ?? loserReward);
          return [loser.userId, {
            aura: capped?.appliedAura ?? 0,
            money: capped?.appliedMoney ?? 0,
          }] as const;
        })
      ));
      const finalWinnerReward = {
        aura: cappedWinnerReward?.appliedAura ?? 0,
        money: cappedWinnerReward?.appliedMoney ?? 0,
      };

      const rewardedUserIds = [winner.userId, ...losers.map((loser) => loser.userId)].filter((userId) => {
        const reward = userId === winner.userId ? finalWinnerReward : (cappedLoserRewards.get(userId) ?? { aura: 0, money: 0 });
        return reward.aura > 0 || reward.money > 0;
      });

      await emitSharedBalanceUpdatesForUserIds(prisma, rewardedUserIds);

      await checkQuestProgress(winnerId, 'PLAY_GAMES', 1);
      await checkQuestProgress(winnerId, 'WIN_GAMES', 1);
      await Promise.all(losers.map((loser) => checkQuestProgress(loser.userId, 'PLAY_GAMES', 1)));

      await Promise.all([
        prisma.gameStats.upsert({
          where: { userId_gameType: { userId: winnerId, gameType: 'ball_arena' } },
          create: { userId: winnerId, gameType: 'ball_arena', wins: 1, losses: 0, highScore: 1, totalPlayed: 1 },
          update: { wins: { increment: 1 }, totalPlayed: { increment: 1 } },
        }),
        ...losers.map((loser) => prisma.gameStats.upsert({
          where: { userId_gameType: { userId: loser.userId, gameType: 'ball_arena' } },
          create: { userId: loser.userId, gameType: 'ball_arena', wins: 0, losses: 1, highScore: 0, totalPlayed: 1 },
          update: { losses: { increment: 1 }, totalPlayed: { increment: 1 } },
        })),
      ]);

      void recheckBadgeForCondition('BALL_ARENA_WIN');

      io.to(`party:${game.partyId}`).emit('ballarena:game-over', {
        winnerId,
        winnerUsername: winner.username,
        isDraw: false,
        rewards: { winner: finalWinnerReward, loser: cappedLoserRewards.get(losers[0]?.userId ?? '') ?? { aura: 0, money: 0 } },
        replayFrames: game.replayFrames,
        players: game.players.map((p) => ({ userId: p.userId, username: p.username, usernameColor: p.usernameColor, playerIndex: p.playerIndex })),
        results: game.players.map((player) => ({
          userId: player.userId,
          username: player.username,
          usernameColor: player.usernameColor,
          isWinner: player.userId === winnerId,
          rewards: player.userId === winnerId ? finalWinnerReward : (cappedLoserRewards.get(player.userId) ?? { aura: 0, money: 0 }),
        })),
      });

      logGame('game_complete', winner.userId, winner.username, {
        gameType: 'ball_arena', score: 1, won: true,
        auraReward: finalWinnerReward.aura, moneyReward: finalWinnerReward.money,
        isMultiplayer: true, partyId: game.partyId,
      });
      for (const loser of losers) {
        const resolvedLoserReward = cappedLoserRewards.get(loser.userId) ?? { aura: 0, money: 0 };
        logGame('game_complete', loser.userId, loser.username, {
          gameType: 'ball_arena', score: 0, won: false,
          auraReward: resolvedLoserReward.aura, moneyReward: resolvedLoserReward.money,
          isMultiplayer: true, partyId: game.partyId,
        });
      }
    } else {
      const cappedDrawRewards = await Promise.all(
        game.players.map(async (p) => {
          const baseReward = { aura: drawReward.aura, money: resolveMoneyReward(p.userId, drawReward.money) };
          const capped = await applyDailyGameRewardCaps(prisma, p.userId, 'ball_arena', baseReward);
          return {
            userId: p.userId,
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
      for (const p of game.players) {
        await checkQuestProgress(p.userId, 'PLAY_GAMES', 1);
      }

      io.to(`party:${game.partyId}`).emit('ballarena:game-over', {
        winnerId: null,
        winnerUsername: null,
        isDraw: true,
        rewards: { draw: drawReward },
        replayFrames: game.replayFrames,
        players: game.players.map((p) => ({ userId: p.userId, username: p.username, usernameColor: p.usernameColor, playerIndex: p.playerIndex })),
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
    console.error('ballarena:endGame error:', error);
  }

  // Play-again prompt
  const prompt: PendingPlayAgainPrompt = {
    partyId: game.partyId,
    mode: game.mode,
    responses: new Map(),
    players: game.players.map((p) => ({ userId: p.userId, username: p.username, usernameColor: p.usernameColor })),
    timer: null,
    startTime: Date.now(),
  };
  pendingPlayAgainPrompts.set(game.partyId, prompt);
  prompt.timer = setTimeout(() => resolvePlayAgainPrompt(game.partyId, io), PLAY_AGAIN_TIMEOUT);
  io.to(`party:${game.partyId}`).emit('ballarena:play-again-prompt', {
    partyId: game.partyId,
    mode: game.mode,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: prompt.startTime,
    players: prompt.players,
    responses: [],
  });

  activeGames.delete(game.partyId);
}

// ─── Play-again logic ─────────────────────────────────────────────────────────
async function resolvePlayAgainPrompt(partyId: string, io: Server) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt) return;
  if (prompt.timer) clearTimeout(prompt.timer);
  pendingPlayAgainPrompts.delete(partyId);

  const playAgainUserIds = Array.from(prompt.responses.entries())
    .filter(([, v]) => v)
    .map(([uid]) => uid);

  if (playAgainUserIds.length < 2) {
    io.to(`party:${partyId}`).emit('ballarena:play-again-cancelled', {});
    if (duelPartyIds.has(partyId)) await deleteDuelParty(partyId, io);
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: playAgainUserIds } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  if ((prompt.mode === 'duo' && members.length !== 2) || (prompt.mode === 'multiplayer' && members.length < 2)) {
    io.to(`party:${partyId}`).emit('ballarena:play-again-cancelled', {});
    if (duelPartyIds.has(partyId)) await deleteDuelParty(partyId, io);
    return;
  }

  const game = createGame(partyId, members.map((m) => ({ user: m.user })), prompt.mode);
  activeGames.set(partyId, game);
  emitState(game, io);
  game.prepTimeout = setTimeout(() => startSimulation(game, io), PREP_TIME_MS);
}

// ─── Join prompt resolution ───────────────────────────────────────────────────
async function resolveJoinPrompt(partyId: string, io: Server) {
  const prompt = pendingJoinPrompts.get(partyId);
  if (!prompt) return;
  if (prompt.timer) clearTimeout(prompt.timer);
  pendingJoinPrompts.delete(partyId);

  const acceptedIds = Array.from(prompt.responses.entries())
    .filter(([, v]) => v)
    .map(([uid]) => uid);

  if (acceptedIds.length < 2) {
    io.to(`party:${partyId}`).emit('ballarena:join-cancelled', {});
    return;
  }

  const members = await prisma.partyMember.findMany({
    where: { partyId, userId: { in: acceptedIds } },
    include: { user: { select: { id: true, username: true, usernameColor: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  if ((prompt.mode === 'duo' && members.length !== 2) || (prompt.mode === 'multiplayer' && members.length < 2)) {
    io.to(`party:${partyId}`).emit('ballarena:join-cancelled', {});
    return;
  }

  const game = createGame(partyId, members.map((m) => ({ user: m.user })), prompt.mode);
  activeGames.set(partyId, game);
  emitState(game, io);
  game.prepTimeout = setTimeout(() => startSimulation(game, io), PREP_TIME_MS);
}

// ─── Game factory ─────────────────────────────────────────────────────────────
function createGame(
  partyId: string,
  players: Array<{ user: { id: string; username: string; usernameColor?: string | null } }>,
  mode: BallArenaMode = 'duo'
): BallArenaGame {
  const initialPositions = getInitialPositions(players.length);
  return {
    partyId,
    mode,
    players: players.map((m, i) => ({
      userId: m.user.id,
      username: m.user.username,
      usernameColor: m.user.usernameColor ?? null,
      playerIndex: i,
    })),
    balls: players.map((_, i) => ({
      x: initialPositions[i][0],
      y: initialPositions[i][1],
      vx: 0,
      vy: 0,
      plannedVx: 0,
      plannedVy: 0,
      hasSetDirection: false,
      isOut: false,
    })),
    phase: 'prep',
    prepStartTime: Date.now(),
    playStartTime: null,
    winnerId: null,
    isDraw: false,
    isActive: true,
    simInterval: null,
    prepTimeout: null,
    gameTimeout: null,
    tickCount: 0,
    replayFrames: [],
    round: 1,
  };
}

// ─── Public: direct duel start ────────────────────────────────────────────────
export function startDirectBallArenaGame(
  partyId: string,
  players: Array<{ user: { id: string; username: string; usernameColor?: string | null } }>,
  io: Server
) {
  if (activeGames.has(partyId)) return;
  const game = createGame(partyId, players, 'duo');
  activeGames.set(partyId, game);
  emitState(game, io);
  game.prepTimeout = setTimeout(() => startSimulation(game, io), PREP_TIME_MS);
}

// ─── Socket handlers ──────────────────────────────────────────────────────────
export const setupBallArenaHandlers = (socket: Socket, io: Server) => {
  socket.on('ballarena:register', async () => {
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
      socket.emit('ballarena:state', serializeState(game));
    }

    const joinPrompt = pendingJoinPrompts.get(partyId);
    if (joinPrompt) {
      const responses = Array.from(joinPrompt.responses.entries()).map(([uid, v]) => ({ userId: uid, accepted: v }));
      socket.emit('ballarena:join-prompt', {
        partyId: joinPrompt.partyId,
        mode: joinPrompt.mode,
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
      socket.emit('ballarena:play-again-prompt', {
        partyId: playAgainPrompt.partyId,
        mode: playAgainPrompt.mode,
        timeLimit: PLAY_AGAIN_TIMEOUT,
        startTime: playAgainPrompt.startTime,
        players: playAgainPrompt.players,
        responses,
      });
    }
  });

  socket.on('ballarena:start', async (data: { partyId: string; mode?: BallArenaMode }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId } = data;
    const mode: BallArenaMode = data.mode === 'multiplayer' ? 'multiplayer' : 'duo';

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
        socket.emit('ballarena:error', { message: 'Tu n\'es pas dans ce duel.' });
        return;
      }
      if (!membership.isLeader) {
        socket.emit('ballarena:error', { message: 'Seul le leader peut lancer la partie.' });
        return;
      }
      if (mode === 'duo' && membership.party.members.length !== 2) {
        socket.emit('ballarena:error', { message: 'Le mode duo demande exactement 2 joueurs.' });
        return;
      }
      if (mode === 'multiplayer' && membership.party.members.length < 2) {
        socket.emit('ballarena:error', { message: 'Le mode multijoueur demande au moins 2 joueurs.' });
        return;
      }
      if (activeGames.has(partyId) || pendingJoinPrompts.has(partyId)) {
        socket.emit('ballarena:error', { message: 'Une partie est déjà en cours.' });
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
        mode,
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

      io.to(`party:${partyId}`).emit('ballarena:join-prompt', {
        partyId,
        mode,
        leaderId: userId,
        timeLimit: JOIN_PROMPT_TIMEOUT,
        startTime: prompt.startTime,
        members: membersInfo,
        responses: [{ userId, accepted: true }],
      });
    } catch (error) {
      console.error('ballarena:start error:', error);
      socket.emit('ballarena:error', { message: 'Impossible de lancer la partie.' });
    }
  });

  socket.on('ballarena:join-response', async (data: { partyId: string; accepted: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const prompt = pendingJoinPrompts.get(data.partyId);
    if (!prompt || !prompt.memberIds.includes(userId)) return;

    prompt.responses.set(userId, data.accepted);
    const responses = Array.from(prompt.responses.entries()).map(([uid, v]) => ({ userId: uid, accepted: v }));
    io.to(`party:${data.partyId}`).emit('ballarena:join-response-update', { partyId: data.partyId, responses });

    if (prompt.responses.size === prompt.memberIds.length) {
      await resolveJoinPrompt(data.partyId, io);
    }
  });

  socket.on('ballarena:set-direction', (data: { partyId: string; vx: number; vy: number }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId, vx, vy } = data;

    const game = activeGames.get(partyId);
    if (!game || game.phase !== 'prep') return;

    const playerIdx = game.players.findIndex((p) => p.userId === userId);
    if (playerIdx === -1) return;
    if (game.balls[playerIdx].isOut) return;

    // Clamp to MAX_SPEED
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > MAX_SPEED) {
      const scale = MAX_SPEED / speed;
      game.balls[playerIdx].plannedVx = vx * scale;
      game.balls[playerIdx].plannedVy = vy * scale;
    } else {
      game.balls[playerIdx].plannedVx = vx;
      game.balls[playerIdx].plannedVy = vy;
    }
    game.balls[playerIdx].hasSetDirection = true;

    emitState(game, io);

    // Early start when both players have chosen
    const allSet = game.balls.every((b) => b.isOut || b.hasSetDirection);
    if (allSet) {
      if (game.prepTimeout) {
        clearTimeout(game.prepTimeout);
        game.prepTimeout = null;
      }
      // 1.5s grace period so both players see the "confirmed" state
      game.prepTimeout = setTimeout(() => startSimulation(game, io), 1500);
    }
  });

  socket.on('ballarena:leave', (data: { partyId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { partyId } = data;
    const game = activeGames.get(partyId);
    if (game) {
      stopSimulation(game);
      activeGames.delete(partyId);
      io.to(`party:${partyId}`).emit('ballarena:left', { userId });
    }
  });

  socket.on('ballarena:play-again-response', (data: { partyId: string; playAgain: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const prompt = pendingPlayAgainPrompts.get(data.partyId);
    if (!prompt || !prompt.players.find((p) => p.userId === userId)) return;

    prompt.responses.set(userId, data.playAgain);
    const responses = Array.from(prompt.responses.entries()).map(([uid, v]) => ({ userId: uid, playAgain: v }));
    io.to(`party:${data.partyId}`).emit('ballarena:play-again-response-update', {
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

// ─── Helpers for reconnect (used by other socket handlers) ───────────────────
export function sendActiveBallArenaState(socket: Socket, partyId: string, userId: string) {
  const game = activeGames.get(partyId);
  if (game && game.isActive) {
    socket.emit('ballarena:state', serializeState(game));
  }
}

export function sendPendingBallArenaPlayAgainPrompt(socket: Socket, partyId: string, userId: string) {
  const prompt = pendingPlayAgainPrompts.get(partyId);
  if (!prompt || !prompt.players.some((p) => p.userId === userId)) return;
  const responses = Array.from(prompt.responses.entries()).map(([uid, v]) => ({ userId: uid, playAgain: v }));
  socket.emit('ballarena:play-again-prompt', {
    partyId: prompt.partyId,
    mode: prompt.mode,
    timeLimit: PLAY_AGAIN_TIMEOUT,
    startTime: prompt.startTime,
    players: prompt.players,
    responses,
  });
}

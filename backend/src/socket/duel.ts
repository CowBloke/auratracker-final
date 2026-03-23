import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { startDirectChessGame } from './chess.js';
import { startDirectBattleshipGame } from './battleship.js';
import { startDirectP4Game } from './puissancequatre.js';
import { startDirectBallArenaGame } from './ballarena.js';
import { startDirectUnoGame } from './uno.js';
import { startDirectMorpionGame } from './morpion.js';
import { emitPartyChatHistory } from './party.js';
import { duelPartyIds, onDuelPartyDeleted } from './duelParties.js';

type DuelGameType = 'chess' | 'battleship' | 'p4' | 'ballarena' | 'uno' | 'morpion';

interface DuelChallenge {
  challengerId: string;
  challengerUsername: string;
  challengerUsernameColor?: string | null;
  targetId: string;
  gameType: DuelGameType;
  timer: NodeJS.Timeout;
  sentAt: number;
}

const CHALLENGE_TIMEOUT = 30000;
const pendingChallenges = new Map<string, DuelChallenge>();
const matchmakingQueue: string[] = [];
const matchmakingQueueSet = new Set<string>();
const matchmakingUserToParty = new Map<string, string>();
const matchmakingActivePartyIds = new Set<string>();
let matchmakingPairingInProgress = false;
let deleteListenerRegistered = false;

const getChallengeKey = (challengerId: string, targetId: string, gameType: DuelGameType) =>
  `${challengerId}:${targetId}:${gameType}`;

const GAME_ROUTES: Record<DuelGameType, string> = {
  chess: '/games/echecs',
  battleship: '/games/bataille-navale',
  p4: '/games/puissance-quatre',
  ballarena: '/games/ball-arena',
  uno: '/games/uno',
  morpion: '/games/morpion',
};

const MATCHMAKING_GAME_TYPES: DuelGameType[] = ['chess', 'battleship', 'p4', 'ballarena', 'morpion'];
const DUEL_MATCHMAKING_ENABLED_SETTING_KEY = 'duel_matchmaking_enabled';

const randomMatchmakingGame = (): DuelGameType => {
  const index = Math.floor(Math.random() * MATCHMAKING_GAME_TYPES.length);
  return MATCHMAKING_GAME_TYPES[index];
};

const emitMatchmakingStateForUser = (io: Server, userId: string, isQueued: boolean) => {
  io.to(`user:${userId}`).emit('duel:matchmaking-state', { isQueued });
};

const isDuelMatchmakingEnabled = async () => {
  const setting = await prisma.gameSettings.findUnique({
    where: { key: DUEL_MATCHMAKING_ENABLED_SETTING_KEY },
    select: { value: true },
  });

  return setting?.value !== 'false';
};

const removeUserFromQueue = (userId: string): boolean => {
  if (!matchmakingQueueSet.has(userId)) return false;
  matchmakingQueueSet.delete(userId);
  const index = matchmakingQueue.indexOf(userId);
  if (index >= 0) matchmakingQueue.splice(index, 1);
  return true;
};

const syncMatchmakingParties = async () => {
  if (matchmakingActivePartyIds.size === 0) {
    if (matchmakingUserToParty.size > 0) matchmakingUserToParty.clear();
    return { inGameCount: 0 };
  }

  const partyIds = Array.from(matchmakingActivePartyIds);
  const parties = await prisma.party.findMany({
    where: { id: { in: partyIds } },
    select: {
      id: true,
      members: {
        select: { userId: true },
      },
    },
  });

  const existingIds = new Set(parties.map((party) => party.id));
  for (const partyId of partyIds) {
    if (!existingIds.has(partyId)) matchmakingActivePartyIds.delete(partyId);
  }

  matchmakingUserToParty.clear();
  let inGameCount = 0;
  for (const party of parties) {
    inGameCount += party.members.length;
    for (const member of party.members) {
      matchmakingUserToParty.set(member.userId, party.id);
    }
  }

  return { inGameCount };
};

const emitMatchmakingStats = async (io: Server, targetSocket?: Socket) => {
  const { inGameCount } = await syncMatchmakingParties();
  const payload = {
    queuedCount: matchmakingQueueSet.size,
    inGameCount,
  };

  if (targetSocket) {
    targetSocket.emit('duel:matchmaking-stats', payload);
    return;
  }

  io.emit('duel:matchmaking-stats', payload);
};

export const clearDuelMatchmakingQueue = async (io: Server) => {
  const queuedUserIds = Array.from(matchmakingQueueSet);
  matchmakingQueue.length = 0;
  matchmakingQueueSet.clear();

  for (const userId of queuedUserIds) {
    emitMatchmakingStateForUser(io, userId, false);
  }

  await emitMatchmakingStats(io);
};

const createAndStartDuel = async (
  io: Server,
  challengerId: string,
  acceptorId: string,
  gameType: DuelGameType,
  source: 'challenge' | 'matchmaking'
) => {
  await prisma.partyMember.deleteMany({
    where: { userId: { in: [challengerId, acceptorId] } },
  });

  const party = await prisma.party.create({
    data: {
      isPublic: false,
      maxSize: 2,
      members: {
        createMany: {
          data: [
            { userId: challengerId, isLeader: true },
            { userId: acceptorId, isLeader: false },
          ],
        },
      },
    },
    include: {
      members: {
        include: { user: { select: { id: true, username: true, usernameColor: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  const partyRoom = `party:${party.id}`;
  const partyData = { id: party.id, name: null, isPublic: false, maxSize: 2 };
  const members = party.members.map((member) => ({
    userId: member.user.id,
    username: member.user.username,
    usernameColor: member.user.usernameColor,
    isLeader: member.isLeader,
  }));

  const challengerSockets = await io.in(`user:${challengerId}`).fetchSockets();
  const acceptorSockets = await io.in(`user:${acceptorId}`).fetchSockets();
  const allSockets = [...challengerSockets, ...acceptorSockets];
  for (const currentSocket of allSockets) {
    currentSocket.join(partyRoom);
  }

  io.to(partyRoom).emit('party:joined', { party: partyData, members });

  for (const currentSocket of allSockets) {
    await emitPartyChatHistory(currentSocket, party.id);
  }

  duelPartyIds.add(party.id);

  const gamePlayers = party.members.map((member) => ({ user: member.user }));
  if (gameType === 'chess') {
    startDirectChessGame(party.id, gamePlayers, io);
  } else if (gameType === 'battleship') {
    startDirectBattleshipGame(party.id, gamePlayers, io);
  } else if (gameType === 'p4') {
    startDirectP4Game(party.id, gamePlayers, io);
  } else if (gameType === 'uno') {
    startDirectUnoGame(party.id, gamePlayers, io);
  } else if (gameType === 'morpion') {
    startDirectMorpionGame(party.id, gamePlayers, io);
  } else {
    startDirectBallArenaGame(party.id, gamePlayers, io);
  }

  if (source === 'matchmaking') {
    matchmakingActivePartyIds.add(party.id);
    for (const member of party.members) {
      matchmakingUserToParty.set(member.user.id, party.id);
    }

    io.to(partyRoom).emit('duel:matchmaking-match-found', {
      gameType,
      partyId: party.id,
    });
  }

  io.to(partyRoom).emit('duel:redirect', {
    gameType,
    partyId: party.id,
    path: GAME_ROUTES[gameType],
  });

  return party;
};

const tryMatchmakingPair = async (io: Server) => {
  if (matchmakingPairingInProgress) return;
  matchmakingPairingInProgress = true;

  try {
    if (!(await isDuelMatchmakingEnabled())) {
      await clearDuelMatchmakingQueue(io);
      return;
    }

    while (matchmakingQueue.length >= 2) {
      if (!(await isDuelMatchmakingEnabled())) {
        await clearDuelMatchmakingQueue(io);
        return;
      }

      const challengerId = matchmakingQueue.shift();
      const acceptorId = matchmakingQueue.shift();
      if (!challengerId || !acceptorId) break;

      matchmakingQueueSet.delete(challengerId);
      matchmakingQueueSet.delete(acceptorId);
      emitMatchmakingStateForUser(io, challengerId, false);
      emitMatchmakingStateForUser(io, acceptorId, false);

      const [challengerSockets, acceptorSockets] = await Promise.all([
        io.in(`user:${challengerId}`).fetchSockets(),
        io.in(`user:${acceptorId}`).fetchSockets(),
      ]);

      if (challengerSockets.length === 0 && acceptorSockets.length === 0) {
        continue;
      }

      if (challengerSockets.length === 0) {
        if (!matchmakingQueueSet.has(acceptorId) && !matchmakingUserToParty.has(acceptorId)) {
          matchmakingQueue.push(acceptorId);
          matchmakingQueueSet.add(acceptorId);
          emitMatchmakingStateForUser(io, acceptorId, true);
        }
        continue;
      }

      if (acceptorSockets.length === 0) {
        if (!matchmakingQueueSet.has(challengerId) && !matchmakingUserToParty.has(challengerId)) {
          matchmakingQueue.push(challengerId);
          matchmakingQueueSet.add(challengerId);
          emitMatchmakingStateForUser(io, challengerId, true);
        }
        continue;
      }

      const gameType = randomMatchmakingGame();
      await createAndStartDuel(io, challengerId, acceptorId, gameType, 'matchmaking');
    }
  } catch (error) {
    console.error('tryMatchmakingPair error:', error);
  } finally {
    matchmakingPairingInProgress = false;
    await emitMatchmakingStats(io);
  }
};

export const setupDuelHandlers = (socket: Socket, io: Server) => {
  if (!deleteListenerRegistered) {
    deleteListenerRegistered = true;
    onDuelPartyDeleted(async (partyId: string) => {
      if (!matchmakingActivePartyIds.has(partyId)) return;
      matchmakingActivePartyIds.delete(partyId);
      for (const [userId, userPartyId] of matchmakingUserToParty.entries()) {
        if (userPartyId === partyId) matchmakingUserToParty.delete(userId);
      }
      await emitMatchmakingStats(io);
    });
  }

  socket.on('duel:challenge', async (data: { targetId: string; gameType: DuelGameType }) => {
    const userId = socket.data.userId as string | undefined;
    const username = socket.data.username as string | undefined;
    if (!userId || !username) return;

    const { targetId, gameType } = data;
    if (!['chess', 'battleship', 'p4', 'ballarena', 'uno', 'morpion'].includes(gameType)) return;
    if (userId === targetId) return;

    // Cancel any existing challenge from this challenger to this target for this game type
    const key = getChallengeKey(userId, targetId, gameType);
    const existing = pendingChallenges.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      pendingChallenges.delete(key);
    }

    let challengerUsernameColor: string | null = null;
    try {
      const challenger = await prisma.user.findUnique({
        where: { id: userId },
        select: { usernameColor: true },
      });
      challengerUsernameColor = challenger?.usernameColor ?? null;
    } catch {}

    const sentAt = Date.now();
    const timer = setTimeout(() => {
      pendingChallenges.delete(key);
      socket.emit('duel:challenge-expired', { targetId, gameType });
    }, CHALLENGE_TIMEOUT);

    pendingChallenges.set(key, {
      challengerId: userId,
      challengerUsername: username,
      challengerUsernameColor,
      targetId,
      gameType,
      timer,
      sentAt,
    });

    io.to(`user:${targetId}`).emit('duel:challenge-received', {
      challengerId: userId,
      challengerUsername: username,
      challengerUsernameColor,
      gameType,
      timeLimit: CHALLENGE_TIMEOUT,
      sentAt,
    });

    socket.emit('duel:challenge-sent', { targetId, gameType });
  });

  socket.on('duel:accept', async (data: { challengerId: string; gameType: DuelGameType }) => {
    const userId = socket.data.userId as string | undefined;
    const username = socket.data.username as string | undefined;
    if (!userId) return;

    const { challengerId, gameType } = data;
    const key = getChallengeKey(challengerId, userId, gameType);
    const challenge = pendingChallenges.get(key);
    if (!challenge) {
      socket.emit('duel:challenge-error', { message: "Le défi a expiré ou n'existe plus." });
      return;
    }

    clearTimeout(challenge.timer);
    pendingChallenges.delete(key);

    try {
      const party = await createAndStartDuel(io, challengerId, userId, gameType, 'challenge');

      // Notify challenger that challenge was accepted
      io.to(`user:${challengerId}`).emit('duel:challenge-accepted', {
        targetId: userId,
        targetUsername: username ?? 'Quelqu\'un',
        gameType,
      });
    } catch (error) {
      console.error('duel:accept error:', error);
      socket.emit('duel:challenge-error', { message: 'Impossible de démarrer le duel.' });
    }
  });

  socket.on('duel:matchmaking-join', async () => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    if (!(await isDuelMatchmakingEnabled())) {
      removeUserFromQueue(userId);
      emitMatchmakingStateForUser(io, userId, false);
      socket.emit('duel:challenge-error', { message: 'Le matchmaking est temporairement desactive.' });
      await emitMatchmakingStats(io, socket);
      return;
    }

    if (matchmakingUserToParty.has(userId)) {
      socket.emit('duel:challenge-error', { message: 'Tu es deja en duel via le matchmaking.' });
      emitMatchmakingStateForUser(io, userId, false);
      await emitMatchmakingStats(io, socket);
      return;
    }

    if (!matchmakingQueueSet.has(userId)) {
      matchmakingQueueSet.add(userId);
      matchmakingQueue.push(userId);
    }

    emitMatchmakingStateForUser(io, userId, true);
    await emitMatchmakingStats(io);
    await tryMatchmakingPair(io);
  });

  socket.on('duel:matchmaking-leave', async () => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const removed = removeUserFromQueue(userId);
    emitMatchmakingStateForUser(io, userId, false);
    if (removed) await emitMatchmakingStats(io);
  });

  socket.on('duel:matchmaking-stats-request', async () => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const enabled = await isDuelMatchmakingEnabled();
    if (!enabled) {
      removeUserFromQueue(userId);
      emitMatchmakingStateForUser(io, userId, false);
      await emitMatchmakingStats(io, socket);
      return;
    }

    emitMatchmakingStateForUser(io, userId, matchmakingQueueSet.has(userId));
    await emitMatchmakingStats(io, socket);
  });

  socket.on('duel:decline', (data: { challengerId: string; gameType: DuelGameType }) => {
    const userId = socket.data.userId as string | undefined;
    const username = socket.data.username as string | undefined;
    if (!userId) return;

    const { challengerId, gameType } = data;
    const key = getChallengeKey(challengerId, userId, gameType);
    const challenge = pendingChallenges.get(key);
    if (challenge) {
      clearTimeout(challenge.timer);
      pendingChallenges.delete(key);
    }

    io.to(`user:${challengerId}`).emit('duel:challenge-declined', {
      targetId: userId,
      targetUsername: username ?? 'Quelqu\'un',
      gameType,
    });
  });

  socket.on('duel:cancel', (data: { targetId: string; gameType: DuelGameType }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const { targetId, gameType } = data;
    const key = getChallengeKey(userId, targetId, gameType);
    const challenge = pendingChallenges.get(key);
    if (challenge) {
      clearTimeout(challenge.timer);
      pendingChallenges.delete(key);
    }

    io.to(`user:${targetId}`).emit('duel:challenge-cancelled', {
      challengerId: userId,
      gameType,
    });
  });

  socket.on('disconnect', () => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const removed = removeUserFromQueue(userId);
    if (removed) {
      emitMatchmakingStateForUser(io, userId, false);
      void emitMatchmakingStats(io);
    }

    // Cancel any outgoing challenges when user disconnects
    for (const [key, challenge] of pendingChallenges.entries()) {
      if (challenge.challengerId === userId) {
        clearTimeout(challenge.timer);
        io.to(`user:${challenge.targetId}`).emit('duel:challenge-cancelled', {
          challengerId: userId,
          gameType: challenge.gameType,
        });
        pendingChallenges.delete(key);
      }
    }
  });
};

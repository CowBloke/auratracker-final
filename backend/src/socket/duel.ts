import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { startDirectChessGame } from './chess.js';
import { startDirectBattleshipGame } from './battleship.js';
import { startDirectP4Game } from './puissancequatre.js';

type DuelGameType = 'chess' | 'battleship' | 'p4';

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

const getChallengeKey = (challengerId: string, targetId: string, gameType: DuelGameType) =>
  `${challengerId}:${targetId}:${gameType}`;

const GAME_ROUTES: Record<DuelGameType, string> = {
  chess: '/games/echecs',
  battleship: '/games/bataille-navale',
  p4: '/games/puissance-quatre',
};

export const setupDuelHandlers = (socket: Socket, io: Server) => {
  socket.on('duel:challenge', async (data: { targetId: string; gameType: DuelGameType }) => {
    const userId = socket.data.userId as string | undefined;
    const username = socket.data.username as string | undefined;
    if (!userId || !username) return;

    const { targetId, gameType } = data;
    if (!['chess', 'battleship', 'p4'].includes(gameType)) return;
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
      // Remove both from any existing parties
      await prisma.partyMember.deleteMany({
        where: { userId: { in: [challengerId, userId] } },
      });

      // Create duel party with both players
      const party = await prisma.party.create({
        data: {
          isPublic: false,
          maxSize: 2,
          members: {
            createMany: {
              data: [
                { userId: challengerId, isLeader: true },
                { userId, isLeader: false },
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
      const members = party.members.map((m) => ({
        userId: m.user.id,
        username: m.user.username,
        usernameColor: m.user.usernameColor,
        isLeader: m.isLeader,
      }));

      // Join acceptor to party room
      socket.join(partyRoom);

      // Join challenger's sockets to party room
      const challengerSockets = await io.in(`user:${challengerId}`).fetchSockets();
      for (const s of challengerSockets) {
        s.join(partyRoom);
      }

      // Notify both of the new party
      io.to(partyRoom).emit('party:joined', { party: partyData, members });

      // Start game directly
      const gamePlayers = party.members.map((m) => ({ user: m.user }));
      if (gameType === 'chess') {
        startDirectChessGame(party.id, gamePlayers, io);
      } else if (gameType === 'battleship') {
        startDirectBattleshipGame(party.id, gamePlayers, io);
      } else if (gameType === 'p4') {
        startDirectP4Game(party.id, gamePlayers, io);
      }

      // Notify challenger that challenge was accepted
      io.to(`user:${challengerId}`).emit('duel:challenge-accepted', {
        targetId: userId,
        targetUsername: username ?? 'Quelqu\'un',
        gameType,
      });

      // Redirect both to the game page
      io.to(partyRoom).emit('duel:redirect', {
        gameType,
        partyId: party.id,
        path: GAME_ROUTES[gameType],
      });
    } catch (error) {
      console.error('duel:accept error:', error);
      socket.emit('duel:challenge-error', { message: 'Impossible de démarrer le duel.' });
    }
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

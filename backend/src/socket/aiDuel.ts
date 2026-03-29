import { Socket, Server } from 'socket.io';
import { AI_PLAYER_NAMES, aiPartyInfos, type AIDifficulty } from './aiGameState.js';
import { startAIMorpionGame } from './morpion.js';
import { startAIP4Game } from './puissancequatre.js';
import { startAIChessGame } from './chess.js';

type AIGameType = 'chess' | 'p4' | 'morpion';

const AI_GAME_ROUTES: Record<AIGameType, string> = {
  chess: '/games/echecs',
  p4: '/games/puissance-quatre',
  morpion: '/games/morpion',
};

// Track which partyIds are in-progress AI games (partyId = 'ai_${userId}')
const activeAIPartyIds = new Set<string>();

function getAIPartyId(userId: string): string {
  return `ai_${userId}`;
}

async function startVsAI(
  socket: Socket,
  io: Server,
  userId: string,
  username: string,
  usernameColor: string | null,
  gameType: AIGameType,
  difficulty: AIDifficulty,
) {
  const partyId = getAIPartyId(userId);

  // Clean up any existing AI game for this user
  if (activeAIPartyIds.has(partyId)) {
    aiPartyInfos.delete(partyId);
    activeAIPartyIds.delete(partyId);
  }

  activeAIPartyIds.add(partyId);

  const partyRoom = `party:${partyId}`;

  // Put all user's sockets in the party room and set partyId data
  const userSockets = await io.in(`user:${userId}`).fetchSockets();
  for (const s of userSockets) {
    s.join(partyRoom);
    s.data.partyId = partyId;
  }

  const humanPlayer = { userId, username, usernameColor };

  if (gameType === 'chess') {
    startAIChessGame(partyId, humanPlayer, difficulty, io);
  } else if (gameType === 'p4') {
    startAIP4Game(partyId, humanPlayer, difficulty, io);
  } else {
    startAIMorpionGame(partyId, humanPlayer, difficulty, io);
  }

  const aiName = AI_PLAYER_NAMES[difficulty];

  socket.emit('duel:vs-ai-started', {
    partyId,
    gameType,
    difficulty,
    aiName,
  });

  io.to(partyRoom).emit('duel:redirect', {
    gameType,
    partyId,
    path: AI_GAME_ROUTES[gameType],
  });
}

export const setupAIDuelHandlers = (socket: Socket, io: Server) => {
  socket.on('duel:vs-ai', async (data: { gameType: AIGameType; difficulty: AIDifficulty }) => {
    const userId = socket.data.userId as string | undefined;
    const username = socket.data.username as string | undefined;
    if (!userId || !username) return;

    const { gameType, difficulty } = data;

    if (!['chess', 'p4', 'morpion'].includes(gameType)) return;
    if (!['easy', 'medium', 'hard'].includes(difficulty)) return;

    let usernameColor: string | null = null;
    try {
      const { prisma } = await import('../server.js');
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { usernameColor: true } });
      usernameColor = user?.usernameColor ?? null;
    } catch {}

    await startVsAI(socket, io, userId, username, usernameColor, gameType, difficulty);
  });

  // Cleanup AI game state when user disconnects
  socket.on('disconnect', () => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const partyId = getAIPartyId(userId);
    if (activeAIPartyIds.has(partyId)) {
      aiPartyInfos.delete(partyId);
      activeAIPartyIds.delete(partyId);
    }
  });
};

import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';

interface PartyInvite {
  partyId: string;
  inviterId: string;
  inviterUsername: string;
}

const partyInvites = new Map<string, PartyInvite[]>(); // userId -> invites
const userSockets = new Map<string, string>(); // oderId -> socketId

type PartyGameType = 'hangman';
type PartyGamePhase = 'idle' | 'lobby' | 'choose-word' | 'playing' | 'ended';

interface HangmanSession {
  gameType: PartyGameType;
  phase: PartyGamePhase;
  readyUserIds: Set<string>;
  pickerId?: string;
  word?: string;
  wordNormalized?: string;
  maxWrongGuesses: number;
  wrongGuesses: string[];
  correctGuesses: string[];
  guessedLetters: Set<string>;
  guessedWords: Set<string>;
  turnOrder: string[];
  currentTurnIndex: number;
  winnerId?: string;
}

const partyGames = new Map<string, HangmanSession>(); // partyId -> session

// Auto-disband inactive parties (30 minutes)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

const PARTY_GAME_RESET_DELAY_MS = 5000;

const getPartyRoomId = (partyId: string) => `party:${partyId}`;

const normalizeWord = (word: string) => word.trim().toUpperCase();

const isValidWord = (word: string) => {
  const trimmed = word.trim();
  if (trimmed.length < 2) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  return /^[A-Za-z\s-]+$/.test(trimmed);
};

const getUniqueLetters = (word: string) => {
  const letters = new Set<string>();
  for (const char of word) {
    if (/[A-Z]/.test(char)) {
      letters.add(char);
    }
  }
  return letters;
};

const maskWord = (word: string, correctLetters: Set<string>) =>
  word
    .split('')
    .map((char) => {
      if (/[A-Z]/.test(char)) {
        return correctLetters.has(char) ? char : '_';
      }
      return char;
    })
    .join('');

const getPartyMembers = async (partyId: string) => {
  const members = await prisma.partyMember.findMany({
    where: { partyId },
    select: { userId: true, isLeader: true, joinedAt: true },
    orderBy: { joinedAt: 'asc' },
  });
  const leader = members.find((m) => m.isLeader);
  return { members, leaderId: leader?.userId || null };
};

const emitGameState = (io: Server, partyId: string, session: HangmanSession) => {
  const roomId = getPartyRoomId(partyId);
  const currentTurnUserId = session.turnOrder[session.currentTurnIndex] || null;
  const maskedWord = session.wordNormalized
    ? maskWord(session.wordNormalized, session.guessedLetters)
    : '';
  const remainingLives = session.maxWrongGuesses - session.wrongGuesses.length;
  const baseState = {
    gameType: session.gameType,
    phase: session.phase,
    pickerId: session.pickerId || null,
    state: {
      maskedWord,
      wrongGuesses: session.wrongGuesses,
      correctGuesses: session.correctGuesses,
      remainingLives,
      maxWrongGuesses: session.maxWrongGuesses,
      currentTurnUserId,
      turnOrder: session.turnOrder,
    },
  };

  const pickerSocketId = session.pickerId ? userSockets.get(session.pickerId) : null;
  if (pickerSocketId) {
    io.to(roomId).except(pickerSocketId).emit('party:game:state', baseState);
    io.to(pickerSocketId).emit('party:game:state', {
      ...baseState,
      state: {
        ...baseState.state,
        word: session.wordNormalized || '',
      },
    });
  } else {
    io.to(roomId).emit('party:game:state', baseState);
  }
};

export const setupPartyHandlers = (socket: Socket, io: Server) => {
  // Track socket to user mapping
  socket.on('party:register', (data: { userId: string }) => {
    userSockets.set(data.userId, socket.id);
  });
  
  // Create party
  socket.on('party:create', async (data: { userId: string; name?: string; isPublic: boolean }) => {
    const { userId, name, isPublic } = data;
    
    try {
      // Check if user is already in a party
      const existingMembership = await prisma.partyMember.findUnique({
        where: { userId },
      });
      
      if (existingMembership) {
        socket.emit('party:error', { message: 'You are already in a party' });
        return;
      }
      
      // Create party with user as leader
      const party = await prisma.party.create({
        data: {
          name: name || null,
          isPublic,
          members: {
            create: {
              userId,
              isLeader: true,
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, usernameColor: true },
              },
            },
          },
        },
      });
      
      // Join socket room for party
      socket.join(`party:${party.id}`);
      
      socket.emit('party:created', {
        party: {
          id: party.id,
          name: party.name,
          isPublic: party.isPublic,
          maxSize: party.maxSize,
        },
        members: party.members.map((m) => ({
          userId: m.userId,
          username: m.user.username,
          usernameColor: m.user.usernameColor,
          isLeader: m.isLeader,
        })),
      });
    } catch (error) {
      console.error('Create party error:', error);
      socket.emit('party:error', { message: 'Failed to create party' });
    }
  });
  
  // Join party
  socket.on('party:join', async (data: { userId: string; partyId: string }) => {
    const { userId, partyId } = data;
    
    try {
      // Check if user is already in a party
      const existingMembership = await prisma.partyMember.findUnique({
        where: { userId },
      });
      
      if (existingMembership) {
        socket.emit('party:error', { message: 'You are already in a party' });
        return;
      }
      
      const party = await prisma.party.findUnique({
        where: { id: partyId },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, usernameColor: true },
              },
            },
          },
        },
      });
      
      if (!party) {
        socket.emit('party:error', { message: 'Party not found' });
        return;
      }
      
      if (!party.isPublic) {
        // Check for invite
        const invites = partyInvites.get(userId) || [];
        const hasInvite = invites.some((i) => i.partyId === partyId);
        if (!hasInvite) {
          socket.emit('party:error', { message: 'This party is private' });
          return;
        }
      }
      
      if (party.members.length >= party.maxSize) {
        socket.emit('party:error', { message: 'Party is full' });
        return;
      }
      
      // Add member
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, usernameColor: true },
      });
      
      await prisma.partyMember.create({
        data: {
          partyId,
          userId,
        },
      });
      
      // Update party activity
      await prisma.party.update({
        where: { id: partyId },
        data: { lastActivity: new Date() },
      });
      
      // Join socket room
      socket.join(`party:${partyId}`);
      
      // Get updated party
      const updatedParty = await prisma.party.findUnique({
        where: { id: partyId },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, usernameColor: true },
              },
            },
          },
        },
      });
      
      // Notify the joining user
      socket.emit('party:joined', {
        party: {
          id: updatedParty!.id,
          name: updatedParty!.name,
          isPublic: updatedParty!.isPublic,
          maxSize: updatedParty!.maxSize,
        },
        members: updatedParty!.members.map((m) => ({
          userId: m.userId,
          username: m.user.username,
          usernameColor: m.user.usernameColor,
          isLeader: m.isLeader,
        })),
      });
      
      // Notify other members
      socket.to(`party:${partyId}`).emit('party:member-joined', {
        userId,
        username: user!.username,
        usernameColor: user!.usernameColor,
      });
      
      // Clear invite
      const invites = partyInvites.get(userId) || [];
      partyInvites.set(
        userId,
        invites.filter((i) => i.partyId !== partyId)
      );
    } catch (error) {
      console.error('Join party error:', error);
      socket.emit('party:error', { message: 'Failed to join party' });
    }
  });
  
  // Leave party
  socket.on('party:leave', async (data: { userId: string }) => {
    const { userId } = data;
    
    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: {
          party: {
            include: {
              members: true,
            },
          },
          user: {
            select: { username: true },
          },
        },
      });
      
      if (!membership) {
        socket.emit('party:error', { message: 'You are not in a party' });
        return;
      }
      
      const partyId = membership.partyId;
      const wasLeader = membership.isLeader;
      const memberCount = membership.party.members.length;
      
      // Remove member
      await prisma.partyMember.delete({
        where: { userId },
      });
      
      // Leave socket room
      socket.leave(`party:${partyId}`);
      
      if (memberCount <= 1) {
        // Disband party if last member
        await prisma.party.delete({
          where: { id: partyId },
        });
        partyGames.delete(partyId);
        socket.emit('party:disbanded');
      } else {
        // Notify others
        io.to(`party:${partyId}`).emit('party:member-left', {
          userId,
          username: membership.user.username,
        });
        
        // Transfer leadership if leader left
        if (wasLeader) {
          const newLeader = await prisma.partyMember.findFirst({
            where: { partyId },
            orderBy: { joinedAt: 'asc' },
          });
          
          if (newLeader) {
            await prisma.partyMember.update({
              where: { id: newLeader.id },
              data: { isLeader: true },
            });
            
            io.to(`party:${partyId}`).emit('party:leader-changed', {
              newLeaderId: newLeader.userId,
            });
          }
        }
        
        socket.emit('party:left');
      }
    } catch (error) {
      console.error('Leave party error:', error);
      socket.emit('party:error', { message: 'Failed to leave party' });
    }
  });
  
  // Invite to party
  socket.on('party:invite', async (data: { userId: string; targetUserId: string }) => {
    const { userId, targetUserId } = data;
    
    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: {
          user: { select: { username: true } },
          party: true,
        },
      });
      
      if (!membership) {
        socket.emit('party:error', { message: 'You are not in a party' });
        return;
      }
      
      // Store invite
      const invites = partyInvites.get(targetUserId) || [];
      invites.push({
        partyId: membership.partyId,
        inviterId: userId,
        inviterUsername: membership.user.username,
      });
      partyInvites.set(targetUserId, invites);
      
      // Notify target user
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('party:invite', {
          partyId: membership.partyId,
          partyName: membership.party.name,
          inviterId: userId,
          inviterUsername: membership.user.username,
        });
      }
      
      socket.emit('party:invite-sent', { targetUserId });
    } catch (error) {
      console.error('Invite error:', error);
      socket.emit('party:error', { message: 'Failed to send invite' });
    }
  });
  
  // Kick from party
  socket.on('party:kick', async (data: { userId: string; targetUserId: string }) => {
    const { userId, targetUserId } = data;
    
    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
      });
      
      if (!membership || !membership.isLeader) {
        socket.emit('party:error', { message: 'Only the leader can kick members' });
        return;
      }
      
      const targetMembership = await prisma.partyMember.findUnique({
        where: { userId: targetUserId },
        include: { user: { select: { username: true } } },
      });
      
      if (!targetMembership || targetMembership.partyId !== membership.partyId) {
        socket.emit('party:error', { message: 'User is not in your party' });
        return;
      }
      
      // Remove member
      await prisma.partyMember.delete({
        where: { userId: targetUserId },
      });
      
      // Notify kicked user
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.leave(`party:${membership.partyId}`);
          targetSocket.emit('party:kicked');
        }
      }
      
      // Notify others
      io.to(`party:${membership.partyId}`).emit('party:member-left', {
        userId: targetUserId,
        username: targetMembership.user.username,
        wasKicked: true,
      });
    } catch (error) {
      console.error('Kick error:', error);
      socket.emit('party:error', { message: 'Failed to kick member' });
    }
  });
  
  // Get party list (public parties)
  socket.on('party:list', async () => {
    try {
      const parties = await prisma.party.findMany({
        where: { isPublic: true },
        include: {
          members: {
            include: {
              user: {
                select: { username: true },
              },
            },
          },
        },
        orderBy: { lastActivity: 'desc' },
        take: 20,
      });
      
      socket.emit('party:list', {
        parties: parties.map((p) => ({
          id: p.id,
          name: p.name,
          memberCount: p.members.length,
          maxSize: p.maxSize,
          members: p.members.map((m) => ({
            username: m.user.username,
            isLeader: m.isLeader,
          })),
        })),
      });
    } catch (error) {
      console.error('List parties error:', error);
      socket.emit('party:error', { message: 'Failed to get party list' });
    }
  });
  
  // Handle disconnect - clean up user from parties
  socket.on('disconnect', async () => {
    // Remove socket mapping
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        break;
      }
    }
  });

  // Sync current party membership on reconnect/refresh
  socket.on('party:sync', async (data: { userId: string }) => {
    const { userId } = data;
    
    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: {
          party: {
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true, username: true, usernameColor: true },
                  },
                },
              },
            },
          },
        },
      });
      
      if (!membership) {
        return;
      }
      
      const party = membership.party;
      socket.join(getPartyRoomId(party.id));
      
      socket.emit('party:joined', {
        party: {
          id: party.id,
          name: party.name,
          isPublic: party.isPublic,
          maxSize: party.maxSize,
        },
        members: party.members.map((m) => ({
          userId: m.userId,
          username: m.user.username,
          usernameColor: m.user.usernameColor,
          isLeader: m.isLeader,
        })),
      });
    } catch (error) {
      console.error('Party sync error:', error);
      socket.emit('party:error', { message: 'Failed to sync party' });
    }
  });

  // Party game selection (leader only)
  socket.on('party:game:select', async (data: { userId: string; partyId: string; gameType: PartyGameType }) => {
    const { userId, partyId, gameType } = data;
    
    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
      });
      
      if (!membership || membership.partyId !== partyId) {
        socket.emit('party:game:error', { message: 'You are not in this party' });
        return;
      }
      
      if (!membership.isLeader) {
        socket.emit('party:game:error', { message: 'Only the leader can select a game' });
        return;
      }
      
      const { members } = await getPartyMembers(partyId);
      if (members.length < 2) {
        socket.emit('party:game:error', { message: 'At least 2 players are required' });
        return;
      }
      
      if (partyGames.has(partyId)) {
        socket.emit('party:game:error', { message: 'A game is already in progress' });
        return;
      }
      
      if (gameType !== 'hangman') {
        socket.emit('party:game:error', { message: 'Unsupported game type' });
        return;
      }
      
      const session: HangmanSession = {
        gameType,
        phase: 'lobby',
        readyUserIds: new Set(),
        maxWrongGuesses: 6,
        wrongGuesses: [],
        correctGuesses: [],
        guessedLetters: new Set(),
        guessedWords: new Set(),
        turnOrder: [],
        currentTurnIndex: 0,
      };
      
      partyGames.set(partyId, session);
      
      await prisma.party.update({
        where: { id: partyId },
        data: { lastActivity: new Date() },
      });
      
      io.to(getPartyRoomId(partyId)).emit('party:game:selected', {
        gameType,
        phase: session.phase,
        readyUserIds: [],
      });
    } catch (error) {
      console.error('Party game select error:', error);
      socket.emit('party:game:error', { message: 'Failed to select game' });
    }
  });
  
  // Party game ready toggle
  socket.on('party:game:ready', async (data: { userId: string; partyId: string; isReady: boolean }) => {
    const { userId, partyId, isReady } = data;
    
    try {
      const session = partyGames.get(partyId);
      if (!session || session.phase !== 'lobby') {
        socket.emit('party:game:error', { message: 'No lobby active' });
        return;
      }
      
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
      });
      
      if (!membership || membership.partyId !== partyId) {
        socket.emit('party:game:error', { message: 'You are not in this party' });
        return;
      }
      
      if (isReady) {
        session.readyUserIds.add(userId);
      } else {
        session.readyUserIds.delete(userId);
      }
      
      await prisma.party.update({
        where: { id: partyId },
        data: { lastActivity: new Date() },
      });
      
      io.to(getPartyRoomId(partyId)).emit('party:game:ready-state', {
        gameType: session.gameType,
        readyUserIds: Array.from(session.readyUserIds),
      });
      
      const { members } = await getPartyMembers(partyId);
      const allReady = members.every((m) => session.readyUserIds.has(m.userId));
      
      if (allReady && members.length > 1) {
        const picker = members[Math.floor(Math.random() * members.length)];
        session.phase = 'choose-word';
        session.pickerId = picker.userId;
        session.turnOrder = members.map((m) => m.userId).filter((id) => id !== picker.userId);
        session.currentTurnIndex = 0;
        
        io.to(getPartyRoomId(partyId)).emit('party:game:picker', {
          gameType: session.gameType,
          pickerId: picker.userId,
          phase: session.phase,
        });
      }
    } catch (error) {
      console.error('Party game ready error:', error);
      socket.emit('party:game:error', { message: 'Failed to update ready state' });
    }
  });
  
  // Picker submits the word
  socket.on('party:game:word', async (data: { userId: string; partyId: string; word: string }) => {
    const { userId, partyId, word } = data;
    
    try {
      const session = partyGames.get(partyId);
      if (!session || session.phase !== 'choose-word') {
        socket.emit('party:game:error', { message: 'No word selection in progress' });
        return;
      }
      
      if (session.pickerId !== userId) {
        socket.emit('party:game:error', { message: 'Only the picker can set the word' });
        return;
      }
      
      if (!isValidWord(word)) {
        socket.emit('party:game:error', { message: 'Invalid word' });
        return;
      }
      
      session.word = word.trim();
      session.wordNormalized = normalizeWord(word);
      session.guessedLetters.clear();
      session.guessedWords.clear();
      session.correctGuesses = [];
      session.wrongGuesses = [];
      session.phase = 'playing';
      session.currentTurnIndex = 0;
      
      await prisma.party.update({
        where: { id: partyId },
        data: { lastActivity: new Date() },
      });
      
      emitGameState(io, partyId, session);
    } catch (error) {
      console.error('Party game word error:', error);
      socket.emit('party:game:error', { message: 'Failed to set word' });
    }
  });
  
  // Guess a letter or word
  socket.on('party:game:guess', async (data: { userId: string; partyId: string; guess: string }) => {
    const { userId, partyId, guess } = data;
    
    try {
      const session = partyGames.get(partyId);
      if (!session || session.phase !== 'playing' || !session.wordNormalized) {
        socket.emit('party:game:error', { message: 'No active game' });
        return;
      }
      
      if (session.pickerId === userId) {
        socket.emit('party:game:error', { message: 'Picker cannot guess' });
        return;
      }
      
      const currentTurnUserId = session.turnOrder[session.currentTurnIndex];
      if (currentTurnUserId !== userId) {
        socket.emit('party:game:error', { message: 'Not your turn' });
        return;
      }
      
      const normalizedGuess = normalizeWord(guess);
      if (!normalizedGuess) {
        socket.emit('party:game:error', { message: 'Invalid guess' });
        return;
      }
      
      const isLetter = normalizedGuess.length === 1;
      let guessedCorrectly = false;
      
      if (isLetter) {
        if (!/^[A-Z]$/.test(normalizedGuess)) {
          socket.emit('party:game:error', { message: 'Invalid letter' });
          return;
        }
        if (session.guessedLetters.has(normalizedGuess)) {
          socket.emit('party:game:error', { message: 'Letter already guessed' });
          return;
        }
        
        session.guessedLetters.add(normalizedGuess);
        if (session.wordNormalized.includes(normalizedGuess)) {
          session.correctGuesses.push(normalizedGuess);
          guessedCorrectly = true;
        } else {
          session.wrongGuesses.push(normalizedGuess);
        }
      } else {
        if (!isValidWord(normalizedGuess)) {
          socket.emit('party:game:error', { message: 'Invalid word guess' });
          return;
        }
        if (session.guessedWords.has(normalizedGuess)) {
          socket.emit('party:game:error', { message: 'Word already guessed' });
          return;
        }
        
        session.guessedWords.add(normalizedGuess);
        if (session.wordNormalized === normalizedGuess) {
          guessedCorrectly = true;
        } else {
          session.wrongGuesses.push(normalizedGuess);
        }
      }
      
      const uniqueLetters = getUniqueLetters(session.wordNormalized);
      const hasWon =
        guessedCorrectly &&
        (isLetter ? Array.from(uniqueLetters).every((l) => session.guessedLetters.has(l)) : true);
      const hasLost = session.wrongGuesses.length >= session.maxWrongGuesses;
      
      if (hasWon) {
        session.phase = 'ended';
        session.winnerId = userId;
        io.to(getPartyRoomId(partyId)).emit('party:game:end', {
          gameType: session.gameType,
          winnerId: userId,
          word: session.wordNormalized,
          reason: 'guessed',
        });
        
        setTimeout(() => {
          partyGames.delete(partyId);
          io.to(getPartyRoomId(partyId)).emit('party:game:reset');
        }, PARTY_GAME_RESET_DELAY_MS);
        return;
      }
      
      if (hasLost) {
        session.phase = 'ended';
        session.winnerId = session.pickerId;
        io.to(getPartyRoomId(partyId)).emit('party:game:end', {
          gameType: session.gameType,
          winnerId: session.pickerId,
          word: session.wordNormalized,
          reason: 'failed',
        });
        
        setTimeout(() => {
          partyGames.delete(partyId);
          io.to(getPartyRoomId(partyId)).emit('party:game:reset');
        }, PARTY_GAME_RESET_DELAY_MS);
        return;
      }
      
      session.currentTurnIndex = (session.currentTurnIndex + 1) % session.turnOrder.length;
      
      await prisma.party.update({
        where: { id: partyId },
        data: { lastActivity: new Date() },
      });
      
      emitGameState(io, partyId, session);
    } catch (error) {
      console.error('Party game guess error:', error);
      socket.emit('party:game:error', { message: 'Failed to process guess' });
    }
  });
};

// Cleanup inactive parties periodically
setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - INACTIVITY_TIMEOUT);
    
    const inactiveParties = await prisma.party.findMany({
      where: {
        lastActivity: { lt: cutoff },
      },
      select: { id: true },
    });
    
    for (const party of inactiveParties) {
      await prisma.party.delete({
        where: { id: party.id },
      });
    }
  } catch (error) {
    console.error('Party cleanup error:', error);
  }
}, 5 * 60 * 1000); // Run every 5 minutes

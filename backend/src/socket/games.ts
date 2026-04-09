import { Socket, Server } from 'socket.io';
import { onlineUsers } from './chat.js';
import { createNotification } from '../utils/notifications.js';

interface GameInvite {
  gameType: string;
  inviterId: string;
  inviterUsername: string;
}

const gameInvites = new Map<string, GameInvite[]>(); // userId -> invites
const userGameSockets = new Map<string, string>(); // userId -> socketId

type DoodleMode = 'classic' | 'mort_subite';
type PlatformMovement = 'normal' | 'moving' | 'conveyor-left' | 'conveyor-right';
type PlatformEffect = 'bounce' | 'disappear' | 'instant-disappear' | null;
type SkinId = string;

interface DoodlePlatformFrame {
  x: number;
  y: number;
  movement: PlatformMovement;
  effect: PlatformEffect;
  direction: number;
  touched: boolean;
  opacity: number;
  fadingOut: boolean;
}

interface DoodleSpectateFrame {
  timestamp: number;
  score: number;
  mode: DoodleMode;
  gameRunning: boolean;
  gameOver: boolean;
  selectedSkin: SkinId;
  selectedSkinImageUrl?: string | null;
  facingLeft: boolean;
  player: {
    x: number;
    y: number;
    velocity: number;
  };
  platforms: DoodlePlatformFrame[];
}

interface DoodleSession {
  hostUserId: string;
  hostUsername: string;
  hostSocketId: string;
  mode: DoodleMode;
  spectators: Set<string>; // socket ids
  latestFrame: DoodleSpectateFrame | null;
  replayFrames: DoodleSpectateFrame[];
}

interface DoodleMultiplayerState {
  userId: string;
  username: string;
  usernameColor?: string | null;
  score: number;
  x: number;
  worldY: number;
  velocity: number;
  facingLeft: boolean;
  selectedSkin: SkinId;
  selectedSkinImageUrl?: string | null;
  isDead: boolean;
  updatedAt: number;
}

interface DoodleMultiplayerRoom {
  id: string;
  mode: DoodleMode;
  dayKey: string;
  seed: number;
  players: Map<string, DoodleMultiplayerState>;
  socketsByUser: Map<string, string>;
}

const doodleSessions = new Map<string, DoodleSession>(); // hostUserId -> session
const doodleSpectatorToHost = new Map<string, string>(); // spectatorSocketId -> hostUserId
const DOODLE_REPLAY_LIMIT = 240;
const doodleConfettiCooldownBySocket = new Map<string, number>();
const doodleMultiplayerRooms = new Map<string, DoodleMultiplayerRoom>(); // roomId -> room
const doodleMultiplayerRoomBySocket = new Map<string, string>(); // socketId -> roomId

const getDoodleRoom = (hostUserId: string) => `doodle:spectate:${hostUserId}`;
const getDailyKeyUtc = () => new Date().toISOString().slice(0, 10);
const getDoodleMultiplayerRoomId = (mode: DoodleMode, dayKey: string) => `doodle:multiplayer:${mode}:${dayKey}`;

const hashToSeed = (input: string) => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const cloneFrame = (frame: DoodleSpectateFrame): DoodleSpectateFrame => ({
  ...frame,
  player: { ...frame.player },
  platforms: frame.platforms.map((platform) => ({ ...platform })),
});

const emitDoodleSessionList = (io: Server) => {
  const sessions = Array.from(doodleSessions.values()).map((session) => ({
    hostUserId: session.hostUserId,
    hostUsername: session.hostUsername,
    mode: session.mode,
    spectatorCount: session.spectators.size,
    score: session.latestFrame?.score ?? 0,
  }));
  io.emit('doodle:spectate-sessions', { sessions });
};

const emitDoodleSpectatorCount = (io: Server, hostUserId: string) => {
  const session = doodleSessions.get(hostUserId);
  if (!session) {
    io.emit('doodle:spectator-count', { hostUserId, spectatorCount: 0 });
    return;
  }
  io.to(getDoodleRoom(hostUserId)).emit('doodle:spectator-count', {
    hostUserId,
    spectatorCount: session.spectators.size,
  });
  io.to(session.hostSocketId).emit('doodle:spectator-count', {
    hostUserId,
    spectatorCount: session.spectators.size,
  });
};

const removeDoodleSpectator = (io: Server, spectatorSocketId: string) => {
  const hostUserId = doodleSpectatorToHost.get(spectatorSocketId);
  if (!hostUserId) return;
  doodleSpectatorToHost.delete(spectatorSocketId);
  const session = doodleSessions.get(hostUserId);
  if (!session) return;
  session.spectators.delete(spectatorSocketId);
  emitDoodleSpectatorCount(io, hostUserId);
  emitDoodleSessionList(io);
};

const stopDoodleSession = (io: Server, hostUserId: string) => {
  const session = doodleSessions.get(hostUserId);
  if (!session) return;
  io.to(getDoodleRoom(hostUserId)).emit('doodle:spectate-stopped', { hostUserId });
  for (const spectatorSocketId of session.spectators) {
    doodleSpectatorToHost.delete(spectatorSocketId);
    const spectatorSocket = io.sockets.sockets.get(spectatorSocketId);
    spectatorSocket?.leave(getDoodleRoom(hostUserId));
  }
  doodleSessions.delete(hostUserId);
  emitDoodleSessionList(io);
};

const emitDoodleMultiplayerRoster = (io: Server, room: DoodleMultiplayerRoom) => {
  const players = Array.from(room.players.values())
    .sort((a, b) => b.score - a.score)
    .map((player) => ({
      userId: player.userId,
      username: player.username,
      usernameColor: player.usernameColor ?? null,
      score: player.score,
      isDead: player.isDead,
    }));
  io.to(room.id).emit('doodle:multiplayer-players', {
    roomId: room.id,
    mode: room.mode,
    dayKey: room.dayKey,
    players,
  });
};

const cleanupDoodleMultiplayerSocket = (io: Server, socketId: string) => {
  const roomId = doodleMultiplayerRoomBySocket.get(socketId);
  if (!roomId) return;
  doodleMultiplayerRoomBySocket.delete(socketId);

  const room = doodleMultiplayerRooms.get(roomId);
  if (!room) return;

  let removedUserId: string | null = null;
  for (const [userId, storedSocketId] of room.socketsByUser.entries()) {
    if (storedSocketId === socketId) {
      room.socketsByUser.delete(userId);
      room.players.delete(userId);
      removedUserId = userId;
      break;
    }
  }

  if (removedUserId) {
    io.to(room.id).emit('doodle:multiplayer-player-left', { userId: removedUserId });
    emitDoodleMultiplayerRoster(io, room);
  }

  if (room.socketsByUser.size === 0) {
    doodleMultiplayerRooms.delete(roomId);
  }
};

export const setupGameHandlers = (socket: Socket, io: Server) => {
  // Register socket for game events
  socket.on('game:register', (data: { userId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    userGameSockets.set(userId, socket.id);
  });
  
  // Invite to game
  socket.on('game:invite', (data: {
    userId: string;
    username: string;
    targetUserId: string;
    gameType: string;
  }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const inviterUsername = socket.data.username as string | undefined;
    const { targetUserId, gameType } = data;
    const senderName = inviterUsername ?? "Quelqu'un";
    
    // Store invite
    const invites = gameInvites.get(targetUserId) || [];
    invites.push({
      gameType,
      inviterId: userId,
      inviterUsername: inviterUsername ?? 'Unknown',
    });
    gameInvites.set(targetUserId, invites);
    
    // Notify target user
    const targetSocketId = userGameSockets.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('game:invite', {
        gameType,
        inviterId: userId,
        inviterUsername: inviterUsername ?? 'Unknown',
      });
    }

    createNotification({
      userId: targetUserId,
      type: 'SYSTEM',
      title: 'Invitation de jeu',
      body: `${senderName} t'invite a jouer a ${gameType}.`,
      data: {
        gameType,
        inviterId: userId,
        inviterUsername: inviterUsername ?? 'Unknown',
      },
      link: '/games',
      icon: 'gamepad-2',
    }).catch((e) => console.error('Notification failed (games):', e));
    
    socket.emit('game:invite-sent', { targetUserId, gameType });
  });
  
  // Accept game invite
  socket.on('game:accept-invite', (data: {
    userId: string;
    inviterId: string;
    gameType: string;
  }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { inviterId, gameType } = data;
    const responderName = (socket.data.username as string | undefined) ?? 'Un joueur';
    
    // Clear invite
    const invites = gameInvites.get(userId) || [];
    gameInvites.set(
      userId,
      invites.filter((i) => i.inviterId !== inviterId || i.gameType !== gameType)
    );
    
    // Notify inviter
    const inviterSocketId = userGameSockets.get(inviterId);
    if (inviterSocketId) {
      io.to(inviterSocketId).emit('game:invite-accepted', {
        userId,
        gameType,
      });
    }

    createNotification({
      userId: inviterId,
      type: 'SYSTEM',
      title: 'Invitation acceptée',
      body: `${responderName} a accepté ton invitation pour ${gameType}.`,
      data: {
        userId,
        gameType,
      },
      link: '/games',
      icon: 'swords',
    }).catch((e) => console.error('Notification failed (games):', e));
    
    // Create game room
    const gameRoomId = `game:${gameType}:${Date.now()}`;
    socket.join(gameRoomId);
    
    if (inviterSocketId) {
      const inviterSocket = io.sockets.sockets.get(inviterSocketId);
      if (inviterSocket) {
        inviterSocket.join(gameRoomId);
      }
    }
    
    // Emit game start to both players
    io.to(gameRoomId).emit('game:start', {
      gameType,
      roomId: gameRoomId,
      players: [userId, inviterId],
    });
  });
  
  // Decline game invite
  socket.on('game:decline-invite', (data: {
    userId: string;
    inviterId: string;
    gameType: string;
  }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { inviterId, gameType } = data;
    const responderName = (socket.data.username as string | undefined) ?? 'Un joueur';
    
    // Clear invite
    const invites = gameInvites.get(userId) || [];
    gameInvites.set(
      userId,
      invites.filter((i) => i.inviterId !== inviterId || i.gameType !== gameType)
    );
    
    // Notify inviter
    const inviterSocketId = userGameSockets.get(inviterId);
    if (inviterSocketId) {
      io.to(inviterSocketId).emit('game:invite-declined', {
        userId,
        gameType,
      });
    }

    createNotification({
      userId: inviterId,
      type: 'SYSTEM',
      title: 'Invitation refusée',
      body: `${responderName} a refuse ton invitation pour ${gameType}.`,
      data: {
        userId,
        gameType,
      },
      link: '/games',
      icon: 'circle-x',
    }).catch((e) => console.error('Notification failed (games):', e));
  });
  
  // Game update (for real-time multiplayer)
  socket.on('game:update', (data: {
    roomId: string;
    gameState: any;
  }) => {
    const { roomId, gameState } = data;
    socket.to(roomId).emit('game:update', { gameState });
  });
  
  // Game end
  socket.on('game:end', (data: {
    roomId: string;
    winnerId?: string;
    scores?: Record<string, number>;
  }) => {
    const { roomId, winnerId, scores } = data;
    io.to(roomId).emit('game:end', { winnerId, scores });
    
    // Clean up room
    io.in(roomId).socketsLeave(roomId);
  });

  socket.on('doodle:spectate-start', (data?: { mode?: DoodleMode }) => {
    const hostUserId = socket.data.userId as string | undefined;
    const hostUsername = socket.data.username as string | undefined;
    if (!hostUserId || !hostUsername) return;

    const onlineUser = onlineUsers.get(hostUserId);
    if (!onlineUser?.currentPage?.startsWith('/games/doodle-jump')) {
      return;
    }

    const existing = doodleSessions.get(hostUserId);
    const mode: DoodleMode = data?.mode === 'mort_subite' ? 'mort_subite' : 'classic';
    doodleSessions.set(hostUserId, {
      hostUserId,
      hostUsername,
      hostSocketId: socket.id,
      mode,
      spectators: existing?.spectators ?? new Set<string>(),
      latestFrame: null,
      replayFrames: [],
    });
    socket.join(getDoodleRoom(hostUserId));
    emitDoodleSpectatorCount(io, hostUserId);
    emitDoodleSessionList(io);
  });

  socket.on('doodle:spectate-stop', () => {
    const hostUserId = socket.data.userId as string | undefined;
    if (!hostUserId) return;
    stopDoodleSession(io, hostUserId);
  });

  socket.on('doodle:spectate-frame', (data: { frame: DoodleSpectateFrame }) => {
    const hostUserId = socket.data.userId as string | undefined;
    if (!hostUserId) return;
    const session = doodleSessions.get(hostUserId);
    if (!session || session.hostSocketId !== socket.id) return;

    const onlineUser = onlineUsers.get(hostUserId);
    if (!onlineUser?.currentPage?.startsWith('/games/doodle-jump')) {
      stopDoodleSession(io, hostUserId);
      return;
    }

    const incomingFrame = data.frame;
    if (!incomingFrame || !Array.isArray(incomingFrame.platforms)) return;

    const nextFrame = cloneFrame(incomingFrame);
    session.latestFrame = nextFrame;
    session.mode = nextFrame.mode === 'mort_subite' ? 'mort_subite' : 'classic';
    session.replayFrames.push(nextFrame);
    if (session.replayFrames.length > DOODLE_REPLAY_LIMIT) {
      session.replayFrames.splice(0, session.replayFrames.length - DOODLE_REPLAY_LIMIT);
    }

    io.to(getDoodleRoom(hostUserId)).emit('doodle:spectate-frame', {
      hostUserId,
      frame: nextFrame,
    });
    emitDoodleSessionList(io);
  });

  socket.on('doodle:spectate-list-request', () => {
    const sessions = Array.from(doodleSessions.values()).map((session) => ({
      hostUserId: session.hostUserId,
      hostUsername: session.hostUsername,
      mode: session.mode,
      spectatorCount: session.spectators.size,
      score: session.latestFrame?.score ?? 0,
    }));
    socket.emit('doodle:spectate-sessions', { sessions });
  });

  socket.on('doodle:spectate-join', (data: { hostUserId: string }) => {
    const spectatorUserId = socket.data.userId as string | undefined;
    if (!spectatorUserId) return;

    removeDoodleSpectator(io, socket.id);

    const hostUserId = data.hostUserId;
    const session = doodleSessions.get(hostUserId);
    if (!session) {
      socket.emit('doodle:spectate-error', { message: 'Session indisponible.' });
      return;
    }

    if (session.hostUserId === spectatorUserId) {
      socket.emit('doodle:spectate-error', { message: 'Tu ne peux pas te spectate toi-meme.' });
      return;
    }

    socket.join(getDoodleRoom(hostUserId));
    doodleSpectatorToHost.set(socket.id, hostUserId);
    session.spectators.add(socket.id);

    socket.emit('doodle:spectate-joined', {
      hostUserId,
      hostUsername: session.hostUsername,
      frame: session.latestFrame,
      replayFrames: session.replayFrames,
      spectatorCount: session.spectators.size,
    });

    emitDoodleSpectatorCount(io, hostUserId);
    emitDoodleSessionList(io);
  });

  socket.on('doodle:spectate-leave', () => {
    removeDoodleSpectator(io, socket.id);
  });

  socket.on('doodle:spectate-confetti', (data?: { hostUserId?: string }) => {
    const senderUserId = socket.data.userId as string | undefined;
    const senderUsername = socket.data.username as string | undefined;
    if (!senderUserId || !senderUsername) return;

    const now = Date.now();
    const lastSentAt = doodleConfettiCooldownBySocket.get(socket.id) ?? 0;
    if (now - lastSentAt < 500) return;

    let hostUserId: string | null = null;
    const hostedSession = doodleSessions.get(senderUserId);
    if (hostedSession && hostedSession.hostSocketId === socket.id) {
      hostUserId = senderUserId;
    } else {
      hostUserId = doodleSpectatorToHost.get(socket.id) ?? null;
    }

    if (!hostUserId) return;
    if (data?.hostUserId && data.hostUserId !== hostUserId) return;

    const session = doodleSessions.get(hostUserId);
    if (!session) return;

    doodleConfettiCooldownBySocket.set(socket.id, now);
    io.to(getDoodleRoom(hostUserId)).emit('doodle:spectate-confetti', {
      hostUserId,
      sourceUserId: senderUserId,
      sourceUsername: senderUsername,
      timestamp: now,
    });
  });

  socket.on('doodle:spectate-message', (data?: { hostUserId?: string; text?: string }) => {
    const senderUserId = socket.data.userId as string | undefined;
    const senderUsername = socket.data.username as string | undefined;
    if (!senderUserId || !senderUsername) return;

    const text = typeof data?.text === 'string' ? data.text.trim().slice(0, 80) : '';
    if (!text) return;

    // Resolve host — only spectators (not the host themselves) can send
    const hostUserId = doodleSpectatorToHost.get(socket.id) ?? null;
    if (!hostUserId) return;
    if (data?.hostUserId && data.hostUserId !== hostUserId) return;

    const session = doodleSessions.get(hostUserId);
    if (!session) return;

    io.to(getDoodleRoom(hostUserId)).emit('doodle:spectate-message-broadcast', {
      hostUserId,
      userId: senderUserId,
      username: senderUsername,
      text,
    });
  });

  socket.on('doodle:multiplayer-join', (data: { mode?: DoodleMode }) => {
    const userId = socket.data.userId as string | undefined;
    const username = socket.data.username as string | undefined;
    if (!userId || !username) return;

    const onlineUser = onlineUsers.get(userId);
    if (!onlineUser?.currentPage?.startsWith('/games/doodle-jump')) {
      return;
    }

    cleanupDoodleMultiplayerSocket(io, socket.id);

    const mode: DoodleMode = data.mode === 'mort_subite' ? 'mort_subite' : 'classic';
    const dayKey = getDailyKeyUtc();
    const roomId = getDoodleMultiplayerRoomId(mode, dayKey);
    const seed = hashToSeed(`${dayKey}:${mode}`);

    const room = doodleMultiplayerRooms.get(roomId) ?? {
      id: roomId,
      mode,
      dayKey,
      seed,
      players: new Map<string, DoodleMultiplayerState>(),
      socketsByUser: new Map<string, string>(),
    };

    room.mode = mode;
    room.dayKey = dayKey;
    room.seed = seed;
    room.socketsByUser.set(userId, socket.id);
    room.players.set(userId, {
      userId,
      username,
      usernameColor: onlineUser.usernameColor ?? null,
      score: 0,
      x: 175,
      worldY: 100,
      velocity: 0,
      facingLeft: false,
      selectedSkin: 'default',
      selectedSkinImageUrl: null,
      isDead: false,
      updatedAt: Date.now(),
    });

    doodleMultiplayerRooms.set(roomId, room);
    doodleMultiplayerRoomBySocket.set(socket.id, roomId);
    socket.join(roomId);

    socket.emit('doodle:multiplayer-joined', {
      roomId,
      mode,
      dayKey,
      seed,
      players: Array.from(room.players.values()),
    });
    socket.to(roomId).emit('doodle:multiplayer-player-joined', {
      userId,
      username,
      usernameColor: onlineUser.usernameColor ?? null,
      score: 0,
      x: 175,
      worldY: 100,
      velocity: 0,
      facingLeft: false,
      selectedSkin: 'default',
      selectedSkinImageUrl: null,
      isDead: false,
      updatedAt: Date.now(),
    });
    emitDoodleMultiplayerRoster(io, room);
  });

  socket.on('doodle:multiplayer-leave', () => {
    cleanupDoodleMultiplayerSocket(io, socket.id);
  });

  socket.on('doodle:multiplayer-state', (data: {
    mode?: DoodleMode;
    state: {
      score: number;
      x: number;
      worldY?: number;
      y?: number;
      velocity: number;
      facingLeft: boolean;
      selectedSkin: SkinId;
      selectedSkinImageUrl?: string | null;
      isDead: boolean;
    };
  }) => {
    const userId = socket.data.userId as string | undefined;
    const username = socket.data.username as string | undefined;
    if (!userId || !username || !data?.state) return;

    const roomId = doodleMultiplayerRoomBySocket.get(socket.id);
    if (!roomId) return;
    const room = doodleMultiplayerRooms.get(roomId);
    if (!room) return;

    const onlineUser = onlineUsers.get(userId);

    const nextState: DoodleMultiplayerState = {
      userId,
      username,
      usernameColor: onlineUser?.usernameColor ?? room.players.get(userId)?.usernameColor ?? null,
      score: Number.isFinite(data.state.score) ? data.state.score : 0,
      x: Number.isFinite(data.state.x) ? data.state.x : 0,
      worldY: Number.isFinite(data.state.worldY) ? data.state.worldY as number : (Number.isFinite(data.state.y) ? data.state.y as number : 0),
      velocity: Number.isFinite(data.state.velocity) ? data.state.velocity : 0,
      facingLeft: !!data.state.facingLeft,
      selectedSkin: data.state.selectedSkin ?? 'default',
      selectedSkinImageUrl: typeof data.state.selectedSkinImageUrl === 'string' ? data.state.selectedSkinImageUrl : null,
      isDead: !!data.state.isDead,
      updatedAt: Date.now(),
    };
    room.players.set(userId, nextState);

    socket.to(room.id).emit('doodle:multiplayer-state', {
      roomId: room.id,
      player: nextState,
    });
    emitDoodleMultiplayerRoster(io, room);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    doodleConfettiCooldownBySocket.delete(socket.id);
    removeDoodleSpectator(io, socket.id);
    cleanupDoodleMultiplayerSocket(io, socket.id);

    for (const [userId, socketId] of userGameSockets.entries()) {
      if (socketId === socket.id) {
        userGameSockets.delete(userId);
        break;
      }
    }

    for (const [hostUserId, session] of doodleSessions.entries()) {
      if (session.hostSocketId === socket.id) {
        stopDoodleSession(io, hostUserId);
        break;
      }
    }
  });
};

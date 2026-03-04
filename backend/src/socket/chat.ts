import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { logChat } from '../utils/logger.js';

interface OnlineUser {
  userId: string;
  username: string;
  socketId: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
  currentPage?: string | null;
}

const onlineUsers = new Map<string, OnlineUser>();

type PublicOnlineUser = Omit<OnlineUser, 'socketId'>;

const MIN_ONLINE_RATIO = 0.1;

let _fakeOnlineEnabled: boolean | null = null;
let _fakeOnlineCacheAt = 0;
const _FAKE_ONLINE_CACHE_TTL = 30_000; // re-read from DB at most every 30s

const isFakeOnlineEnabled = async (): Promise<boolean> => {
  const now = Date.now();
  if (_fakeOnlineEnabled !== null && now - _fakeOnlineCacheAt < _FAKE_ONLINE_CACHE_TTL) {
    return _fakeOnlineEnabled;
  }
  const setting = await prisma.gameSettings.findUnique({ where: { key: 'fake_online_enabled' } });
  _fakeOnlineEnabled = setting ? setting.value !== 'false' : true;
  _fakeOnlineCacheAt = now;
  return _fakeOnlineEnabled;
};

const shuffle = <T>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const toPublicOnlineUser = (user: OnlineUser): PublicOnlineUser => ({
  userId: user.userId,
  username: user.username,
  usernameColor: user.usernameColor,
  profilePicture: user.profilePicture,
  currentPage: user.currentPage ?? null,
});

const buildDisplayedOnlineState = async (): Promise<{ users: PublicOnlineUser[]; count: number }> => {
  const realUsers = Array.from(onlineUsers.values()).map(toPublicOnlineUser);

  if (!(await isFakeOnlineEnabled())) {
    return { users: realUsers, count: realUsers.length };
  }

  const totalRegisteredUsers = await prisma.user.count({
    where: {
      isApproved: true,
    },
  });

  const minimumDisplayedOnline = Math.min(
    totalRegisteredUsers,
    Math.ceil(totalRegisteredUsers * MIN_ONLINE_RATIO)
  );
  const additionalUsersNeeded = Math.max(0, minimumDisplayedOnline - realUsers.length);

  if (additionalUsersNeeded === 0) {
    return {
      users: realUsers,
      count: realUsers.length,
    };
  }

  const connectedUserIds = realUsers.map((user) => user.userId);
  const offlineCandidates = await prisma.user.findMany({
    where: {
      isApproved: true,
      id: {
        notIn: connectedUserIds,
      },
    },
    select: {
      id: true,
      username: true,
      usernameColor: true,
      profilePicture: true,
    },
  });

  const randomOfflineUsers = shuffle(offlineCandidates)
    .slice(0, additionalUsersNeeded)
    .map((user) => ({
      userId: user.id,
      username: user.username,
      usernameColor: user.usernameColor,
      profilePicture: user.profilePicture,
      currentPage: null,
    }));

  const users = [...realUsers, ...randomOfflineUsers];
  return {
    users,
    count: users.length,
  };
};

const broadcastDisplayedOnlineState = async (io: Server) => {
  const { users, count } = await buildDisplayedOnlineState();
  io.to('global-chat').emit('users:online-list', { users });
  io.to('global-chat').emit('users:online-count', { count });
};

const sendDisplayedOnlineState = async (socket: Socket) => {
  const { users, count } = await buildDisplayedOnlineState();
  socket.emit('users:online-list', { users });
  socket.emit('users:online-count', { count });
};

const summarizeReactions = (reactions: Array<{ emoji: string }>) => {
  const counts = new Map<string, number>();
  reactions.forEach((reaction) => {
    counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
  });
  return Array.from(counts.entries()).map(([emoji, count]) => ({ emoji, count }));
};

const getTopLeaderboardIds = async () => {
  const [topMoney, topAura] = await Promise.all([
    prisma.user.findMany({
      where: { isAdmin: false },
      select: { id: true },
      orderBy: { money: 'desc' },
      take: 5,
    }),
    prisma.user.findMany({
      where: { isAdmin: false },
      select: { id: true },
      orderBy: { aura: 'desc' },
      take: 5,
    }),
  ]);

  return {
    topMoneyIds: new Set(topMoney.map((u) => u.id)),
    topAuraIds: new Set(topAura.map((u) => u.id)),
  };
};

export const startOnlineCountBroadcast = (io: Server) => {
  setInterval(() => {
    void broadcastDisplayedOnlineState(io);
  }, 5000);
};

// ── Smart snapshot recording ──────────────────────────────────────────────────
// Rules:
//   INCREASE  → write immediately (every new join captured, no debounce)
//   DECREASE  → debounce 30 s; only write if the lower count persists
//               (absorbs users who flicker offline for a moment)
//   HEARTBEAT → adaptive interval: fewer players = rarer writes
//               0→30min | 10→5min | 20→3min | 28+→1min
//               so during a peak session the graph has dense data

const DECREASE_DEBOUNCE_MS = 30_000; // wait 30 s before recording a drop

// Heartbeat interval (piecewise linear): 0→30min, 10→5min, 20→3min, 28+→1min
const _HEARTBEAT_POINTS: [number, number][] = [
  [0,  30 * 60_000],
  [10,  5 * 60_000],
  [20,  3 * 60_000],
  [28,  1 * 60_000],
];
const _heartbeatMs = (count: number): number => {
  if (count <= 0)  return _HEARTBEAT_POINTS[0][1];
  if (count >= 28) return _HEARTBEAT_POINTS[_HEARTBEAT_POINTS.length - 1][1];
  for (let i = 0; i < _HEARTBEAT_POINTS.length - 1; i++) {
    const [x0, y0] = _HEARTBEAT_POINTS[i];
    const [x1, y1] = _HEARTBEAT_POINTS[i + 1];
    if (count >= x0 && count <= x1) {
      const t = (count - x0) / (x1 - x0);
      return Math.round(y0 + t * (y1 - y0));
    }
  }
  return 60_000;
};

let _lastSnapshotCount = -1;
let _decreaseTimer:  ReturnType<typeof setTimeout> | null = null;
let _heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

const _write = async () => {
  const count = onlineUsers.size;
  if (count === _lastSnapshotCount) return; // nothing changed, skip
  _lastSnapshotCount = count;
  const usernames = JSON.stringify(
    Array.from(onlineUsers.values()).map(u => ({ userId: u.userId, username: u.username }))
  );
  try {
    await prisma.onlineSnapshot.create({ data: { count, usernames } });
  } catch {
    // Don't let snapshot errors disrupt the socket layer
  }
};

// Reschedule the heartbeat based on current player count
const _rescheduleHeartbeat = () => {
  if (_heartbeatTimer) clearTimeout(_heartbeatTimer);
  _heartbeatTimer = setTimeout(async () => {
    await _write();
    _rescheduleHeartbeat();
  }, _heartbeatMs(onlineUsers.size));
};

/** Call when a player joins — captured immediately. */
const _onPlayerJoined = () => {
  _write();
  _rescheduleHeartbeat(); // reset heartbeat since activity just happened
};

/** Call when a player leaves — debounced to absorb quick reconnects. */
const _onPlayerLeft = () => {
  if (_decreaseTimer) clearTimeout(_decreaseTimer);
  _decreaseTimer = setTimeout(async () => {
    await _write();
    _rescheduleHeartbeat();
  }, DECREASE_DEBOUNCE_MS);
  _rescheduleHeartbeat(); // adjust heartbeat immediately for the new lower count
};

/** Starts the adaptive heartbeat. Call once at server startup. */
export const startOnlineSnapshotRecording = () => _rescheduleHeartbeat();

export const getOnlineCount = () => onlineUsers.size;
export const getOnlineUsers = () =>
  Array.from(onlineUsers.values()).map(u => ({ userId: u.userId, username: u.username }));

export const setupChatHandlers = (socket: Socket, io: Server) => {
  // Join chat
  socket.on('chat:join', async (data: { currentPage?: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const currentPage = data?.currentPage;

    // Check if user is banned
    const activeBan = await prisma.ban.findFirst({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null }, // Permanent ban
          { expiresAt: { gt: new Date() } }, // Temporary ban not yet expired
        ],
      },
      select: {
        reason: true,
        type: true,
        expiresAt: true,
      },
    });

    if (activeBan) {
      const message = activeBan.type === 'PERMANENT'
        ? `Your account has been permanently banned. Reason: ${activeBan.reason}`
        : `Your account is temporarily banned until ${activeBan.expiresAt?.toISOString()}. Reason: ${activeBan.reason}`;

      socket.emit('ban:active', {
        message,
        banned: true,
        ban: {
          reason: activeBan.reason,
          type: activeBan.type,
          expiresAt: activeBan.expiresAt ? activeBan.expiresAt.toISOString() : null,
        },
      });
      return;
    }

    // Fetch user cosmetics from database
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        usernameColor: true,
        profilePicture: true,
        isChatMuted: true,
      },
    });
    if (!dbUser) return;

    if (dbUser?.isChatMuted) {
      socket.emit('chat:muted', { message: 'Vous avez été mute du chat par un admin.' });
    }

    // Store user info
    onlineUsers.set(userId, {
      userId,
      username: dbUser.username,
      socketId: socket.id,
      usernameColor: dbUser?.usernameColor,
      profilePicture: dbUser?.profilePicture,
      currentPage: currentPage ?? null,
    });
    socket.join(`user:${userId}`);
    _onPlayerJoined();

    // Join global chat room
    socket.join('global-chat');
    
    const { topMoneyIds, topAuraIds } = await getTopLeaderboardIds();

    // Send chat history with user cosmetics
    const messages = await prisma.chatMessage.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
            profilePicture: true,
            userBadges: {
              where: { isSelected: true },
              take: 2,
              select: {
                badge: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    color: true,
                  },
                },
              },
            },
          },
        },
        reactions: {
          select: {
            emoji: true,
          },
        },
        replyTo: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                usernameColor: true,
              },
            },
          },
        },
      },
    });
    
    socket.emit('chat:history', {
      messages: messages.reverse().map((m) => ({
        id: m.id,
        userId: m.userId,
        username: m.user.username,
        usernameColor: m.user.usernameColor,
        profilePicture: m.user.profilePicture,
        badges: m.user.userBadges.map((ub) => ub.badge),
        message: m.message,
        pinned: m.pinned,
        pinnedAt: m.pinnedAt ? m.pinnedAt.toISOString() : null,
        isTopMoney: topMoneyIds.has(m.userId),
        isTopAura: topAuraIds.has(m.userId),
        reactions: summarizeReactions(m.reactions),
        replyTo: m.replyTo
          ? {
              id: m.replyTo.id,
              userId: m.replyTo.userId,
              username: m.replyTo.user.username,
              usernameColor: m.replyTo.user.usernameColor,
              message: m.replyTo.message,
            }
          : null,
        timestamp: m.createdAt.toISOString(),
      })),
    });
    
    await broadcastDisplayedOnlineState(io);
  });
  
  // Send message
  socket.on('chat:message', async (data: { message: string; replyToId?: string | null }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { message, replyToId } = data;

    const user = onlineUsers.get(userId);
    if (!user) return;

    // Check if user is banned before allowing message
    const activeBan = await prisma.ban.findFirst({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (activeBan) {
      socket.emit('ban:active', {
        banned: true,
        ban: {
          reason: activeBan.reason,
          type: activeBan.type,
          expiresAt: activeBan.expiresAt ? activeBan.expiresAt.toISOString() : null,
        },
      });
      return;
    }

    // Fetch latest cosmetics from database (in case they changed)
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        usernameColor: true,
        profilePicture: true,
        isChatMuted: true,
        userBadges: {
          where: { isSelected: true },
          take: 2,
          select: {
            badge: {
              select: {
                id: true,
                name: true,
                description: true,
                color: true,
              },
            },
          },
        },
      },
    });

    if (dbUser?.isChatMuted) {
      socket.emit('chat:muted', { message: 'Vous êtes mute du chat pour le moment.' });
      return;
    }
    
    // Update cached cosmetics
    if (dbUser) {
      user.usernameColor = dbUser.usernameColor;
      user.profilePicture = dbUser.profilePicture;
    }
    
    const replyTo = replyToId
      ? await prisma.chatMessage.findUnique({
          where: { id: replyToId },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                usernameColor: true,
              },
            },
          },
        })
      : null;

    // Save message to database
    const savedMessage = await prisma.chatMessage.create({
      data: {
        userId,
        message,
        replyToId: replyTo?.id ?? null,
      },
    });
    
    // Log message sent
    logChat('message_sent', userId, user.username, {
      messageId: savedMessage.id,
      messageLength: message.length,
      hasReply: !!replyTo,
    });

    // Broadcast to all in chat with cosmetics
    const { topMoneyIds, topAuraIds } = await getTopLeaderboardIds();

    io.to('global-chat').emit('chat:message', {
      id: savedMessage.id,
      userId,
      username: user.username,
      usernameColor: dbUser?.usernameColor,
      profilePicture: dbUser?.profilePicture,
      badges: dbUser?.userBadges.map((ub) => ub.badge) ?? [],
      message,
      pinned: false,
      pinnedAt: null,
      isTopMoney: topMoneyIds.has(userId),
      isTopAura: topAuraIds.has(userId),
      reactions: [],
      replyTo: replyTo
        ? {
            id: replyTo.id,
            userId: replyTo.userId,
            username: replyTo.user.username,
            usernameColor: replyTo.user.usernameColor,
            message: replyTo.message,
          }
        : null,
      timestamp: savedMessage.createdAt.toISOString(),
    });
    
    // Cleanup old messages (keep last 1000)
    const messageCount = await prisma.chatMessage.count();
    if (messageCount > 1000) {
      const oldMessages = await prisma.chatMessage.findMany({
        take: messageCount - 1000,
        where: { pinned: false },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (oldMessages.length > 0) {
        await prisma.chatMessage.deleteMany({
          where: { id: { in: oldMessages.map((m) => m.id) } },
        });
      }
    }
  });
  
  // Typing indicator
  socket.on('chat:typing', (data: { userId: string; isTyping: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { isTyping } = data;
    const user = onlineUsers.get(userId);
    if (!user) return;
    
    socket.to('global-chat').emit('chat:typing', {
      userId,
      username: user.username,
      isTyping,
    });
  });

  socket.on('chat:page', (data: { currentPage: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { currentPage } = data;
    const user = onlineUsers.get(userId);
    if (!user) return;

    user.currentPage = currentPage;
  });

  // On-demand: client requests the full online users list (with pages)
  socket.on('chat:request-online-users', async () => {
    await sendDisplayedOnlineState(socket);
  });

  socket.on('chat:reaction', async (data: { messageId: string; emoji: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { messageId, emoji } = data;
    const user = onlineUsers.get(userId);
    if (!user) return;

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true },
    });
    if (!message) return;

    const existingReaction = await prisma.chatReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    });

    if (existingReaction) {
      await prisma.chatReaction.delete({
        where: {
          id: existingReaction.id,
        },
      });
    } else {
      await prisma.chatReaction.create({
        data: {
          messageId,
          userId,
          emoji,
        },
      });
    }

    const reactionCounts = await prisma.chatReaction.groupBy({
      by: ['emoji'],
      where: { messageId },
      _count: { emoji: true },
    });

    io.to('global-chat').emit('chat:reactions-updated', {
      messageId,
      reactions: reactionCounts.map((entry) => ({
        emoji: entry.emoji,
        count: entry._count.emoji,
      })),
    });
  });

  socket.on('chat:pin', async (data: { messageId: string; pinned: boolean }) => {
    const adminId = socket.data.userId as string | undefined;
    if (!adminId) return;
    const { messageId, pinned } = data;

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { isAdmin: true },
    });

    if (!admin || !admin.isAdmin) {
      return;
    }

    try {
      const updated = await prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          pinned,
          pinnedAt: pinned ? new Date() : null,
        },
        select: { pinned: true, pinnedAt: true },
      });

      io.to('global-chat').emit('chat:pin-updated', {
        messageId,
        pinned: updated.pinned,
        pinnedAt: updated.pinnedAt ? updated.pinnedAt.toISOString() : null,
      });
    } catch (error) {
      console.error('Error pinning message:', error);
    }
  });

  // Delete message (admin only)
  socket.on('chat:delete-message', async (data: { messageId: string }) => {
    const adminId = socket.data.userId as string | undefined;
    if (!adminId) return;
    const { messageId } = data;

    // Verify admin status
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { isAdmin: true },
    });

    if (!admin || !admin.isAdmin) {
      return; // Silently fail if not admin
    }

    try {
      // Get the message before deleting for logging
      const messageToDelete = await prisma.chatMessage.findUnique({
        where: { id: messageId },
        include: { user: { select: { username: true } } },
      });

      // Delete the message from database
      await prisma.chatMessage.delete({
        where: { id: messageId },
      });

      // Log message deletion
      logChat('message_deleted', adminId, admin.isAdmin ? 'admin' : undefined, {
        deletedMessageId: messageId,
        originalAuthor: messageToDelete?.user.username,
        originalAuthorId: messageToDelete?.userId,
      });

      // Broadcast deletion to all users
      io.to('global-chat').emit('chat:message-deleted', { messageId });
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    // Find and remove user from online list
    for (const [userId, user] of onlineUsers.entries()) {
      if (user.socketId === socket.id) {
        onlineUsers.delete(userId);
        _onPlayerLeft();
        void broadcastDisplayedOnlineState(io);
        break;
      }
    }
  });
};

export { onlineUsers };

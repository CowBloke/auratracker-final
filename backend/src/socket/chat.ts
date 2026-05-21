import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { logAdmin, logChat } from '../utils/logger.js';
import { isAllowedImageUrl } from '../utils/uploads.js';
import { getChatBlockState } from '../utils/chat-settings.js';
import {
  applyChatModerationStrike,
  buildMuteNotice,
  clearExpiredChatMute,
  moderateChatMessage,
} from '../utils/chat-moderation.js';

interface OnlineUser {
  userId: string;
  username: string;
  socketId: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
  currentPage?: string | null;
  isPageActive: boolean;
}

interface ActiveChatPollOption {
  id: string;
  text: string;
  voterIds: Set<string>;
}

interface ActiveChatPoll {
  id: string;
  question: string;
  options: ActiveChatPollOption[];
  createdByUserId: string;
  createdByUsername: string;
  createdAt: Date;
}

const BADGE_SELECT = {
  id: true,
  name: true,
  description: true,
  howToObtain: true,
  backgroundType: true,
  backgroundColor: true,
  backgroundGradient: true,
  backgroundImage: true,
  icon: true,
  iconColor: true,
  borderColor: true,
  category: true,
  rarity: true,
} as const;

type ClanTagWire = { text: string; style: string | null };

/** Fetch the clan tag for a user (null if none or tag not unlocked). */
const getUserClanTag = async (userId: string): Promise<ClanTagWire | null> => {
  const membership = await prisma.clanMember.findUnique({
    where: { userId },
    select: { clan: { select: { tagUnlocked: true, tagText: true, tagStyle: true } } },
  });
  if (!membership?.clan?.tagUnlocked || !membership.clan.tagText) return null;
  return { text: membership.clan.tagText, style: membership.clan.tagStyle };
};

/** Batch-fetch clan tags for multiple user IDs. */
const getBatchClanTags = async (userIds: string[]): Promise<Map<string, ClanTagWire>> => {
  if (userIds.length === 0) return new Map();
  const memberships = await prisma.clanMember.findMany({
    where: { userId: { in: userIds }, clan: { tagUnlocked: true, tagText: { not: null } } },
    select: { userId: true, clan: { select: { tagText: true, tagStyle: true } } },
  });
  const map = new Map<string, ClanTagWire>();
  for (const m of memberships) {
    map.set(m.userId, { text: m.clan.tagText!, style: m.clan.tagStyle });
  }
  return map;
};

/** Fetch the two equipped badges for a user (returns array of 0-2 items). */
const getUserEquippedBadges = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      equippedBadge1: { select: BADGE_SELECT },
      equippedBadge2: { select: BADGE_SELECT },
    },
  });
  if (!user) return [];
  const badges = [];
  if (user.equippedBadge1) badges.push(user.equippedBadge1);
  if (user.equippedBadge2) badges.push(user.equippedBadge2);
  return badges;
};

/**
 * Batch-fetch equipped badges for multiple user IDs.
 * Returns a map of userId → badges array.
 */
const getBatchEquippedBadges = async (userIds: string[]): Promise<Map<string, any[]>> => {
  if (userIds.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      equippedBadge1: { select: BADGE_SELECT },
      equippedBadge2: { select: BADGE_SELECT },
    },
  });
  const map = new Map<string, any[]>();
  for (const u of users) {
    const badges = [];
    if (u.equippedBadge1) badges.push(u.equippedBadge1);
    if (u.equippedBadge2) badges.push(u.equippedBadge2);
    map.set(u.id, badges);
  }
  return map;
};

const onlineUsers = new Map<string, OnlineUser>();

type PublicOnlineUser = Omit<OnlineUser, 'socketId'> & { badges?: any[] };

const MIN_ONLINE_RATIO = 0.1;
const DISPLAYED_ONLINE_CACHE_TTL = 5_000;
let _displayedOnlineStateCache: { data: { users: PublicOnlineUser[]; count: number }; expiresAt: number } | null = null;

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
  isPageActive: user.isPageActive,
});

const buildDisplayedOnlineState = async (): Promise<{ users: PublicOnlineUser[]; count: number }> => {
  const now = Date.now();
  if (_displayedOnlineStateCache && now < _displayedOnlineStateCache.expiresAt) {
    return _displayedOnlineStateCache.data;
  }

  const realUsers = Array.from(onlineUsers.values()).map(toPublicOnlineUser);

  let users: PublicOnlineUser[];

  if (!(await isFakeOnlineEnabled())) {
    users = realUsers;
  } else {
    const totalRegisteredUsers = await prisma.user.count({
      where: { isApproved: true },
    });

    const minimumDisplayedOnline = Math.min(
      totalRegisteredUsers,
      Math.ceil(totalRegisteredUsers * MIN_ONLINE_RATIO)
    );
    const additionalUsersNeeded = Math.max(0, minimumDisplayedOnline - realUsers.length);

    if (additionalUsersNeeded === 0) {
      users = realUsers;
    } else {
      const connectedUserIds = realUsers.map((u) => u.userId);
      const offlineCandidates = await prisma.user.findMany({
        where: { isApproved: true, id: { notIn: connectedUserIds } },
        select: { id: true, username: true, usernameColor: true, profilePicture: true },
      });

      const randomOfflineUsers = shuffle(offlineCandidates)
        .slice(0, additionalUsersNeeded)
        .map((u) => ({
          userId: u.id,
          username: u.username,
          usernameColor: u.usernameColor,
          profilePicture: u.profilePicture,
          currentPage: null,
          isPageActive: false,
        }));

      users = [...realUsers, ...randomOfflineUsers];
    }
  }

  // Attach equipped badges and clan tags for all displayed users
  const userIds = users.map((u) => u.userId);
  const [badgeMap, clanTagMap] = await Promise.all([
    getBatchEquippedBadges(userIds),
    getBatchClanTags(userIds),
  ]);
  const data = {
    users: users.map((u) => ({
      ...u,
      badges: badgeMap.get(u.userId) ?? [],
      clanTag: clanTagMap.get(u.userId) ?? null,
    })),
    count: users.length,
  };
  _displayedOnlineStateCache = { data, expiresAt: Date.now() + DISPLAYED_ONLINE_CACHE_TTL };
  return data;
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

// Emit a single-user join delta to everyone else in the room (no full-list rebuild)
const broadcastUserJoined = async (socket: Socket, userId: string) => {
  const user = onlineUsers.get(userId);
  if (!user) return;
  const publicUser = toPublicOnlineUser(user);
  const [badgeMap, clanTagMap] = await Promise.all([
    getBatchEquippedBadges([userId]),
    getBatchClanTags([userId]),
  ]);
  socket.to('global-chat').emit('user:online', {
    ...publicUser,
    badges: badgeMap.get(userId) ?? [],
    clanTag: clanTagMap.get(userId) ?? null,
  });
  socket.to('global-chat').emit('users:online-count', { count: onlineUsers.size });
};

// Emit a page/presence update delta — no DB queries needed
const broadcastUserUpdated = (io: Server, userId: string) => {
  const user = onlineUsers.get(userId);
  if (!user) return;
  io.to('global-chat').emit('user:updated', toPublicOnlineUser(user));
};

// Emit a leave delta — no full-list rebuild
const broadcastUserLeft = (io: Server, userId: string) => {
  io.to('global-chat').emit('user:offline', { userId });
  io.to('global-chat').emit('users:online-count', { count: onlineUsers.size });
};

const summarizeReactions = (
  reactions: Array<{ emoji: string; user?: { username: string } | null }>
) => {
  const grouped = new Map<string, { count: number; users: string[] }>();

  reactions.forEach((reaction) => {
    const existing = grouped.get(reaction.emoji) ?? { count: 0, users: [] };
    existing.count += 1;
    if (reaction.user?.username) {
      existing.users.push(reaction.user.username);
    }
    grouped.set(reaction.emoji, existing);
  });

  return Array.from(grouped.entries()).map(([emoji, data]) => ({
    emoji,
    count: data.count,
    users: data.users,
  }));
};

const getTopLeaderboardIds = async () => {
  const [topMoney, topAura] = await Promise.all([
    prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { money: 'desc' },
      take: 5,
    }),
    prisma.user.findMany({
      where: { isSuperAdmin: false },
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

const CHAT_SYSTEM_USERNAME = 'AuraTracker';
let activeChatPoll: ActiveChatPoll | null = null;
const CHAT_HISTORY_PAGE_SIZE = 100;
const CHAT_MESSAGE_INCLUDE = {
  user: {
    select: {
      id: true,
      username: true,
      usernameColor: true,
      profilePicture: true,
    },
  },
  reactions: {
    select: {
      emoji: true,
      user: {
        select: {
          username: true,
        },
      },
    },
  },
  replyTo: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          usernameColor: true,
          profilePicture: true,
        },
      },
    },
  },
} as const;

const serializeChatPoll = (poll: ActiveChatPoll, viewerUserId?: string) => {
  const totalVotes = poll.options.reduce((sum, option) => sum + option.voterIds.size, 0);
  const userVoteOptionId =
    viewerUserId
      ? poll.options.find((option) => option.voterIds.has(viewerUserId))?.id ?? null
      : null;

  return {
    id: poll.id,
    question: poll.question,
    createdByUserId: poll.createdByUserId,
    createdByUsername: poll.createdByUsername,
    createdAt: poll.createdAt.toISOString(),
    totalVotes,
    userVoteOptionId,
    options: poll.options.map((option) => ({
      id: option.id,
      text: option.text,
      votes: option.voterIds.size,
    })),
  };
};

const emitChatPollStateToSocket = (socket: Socket, userId?: string) => {
  socket.emit('chat:poll-state', {
    poll: activeChatPoll ? serializeChatPoll(activeChatPoll, userId) : null,
  });
};

const broadcastChatPollState = (io: Server) => {
  if (!activeChatPoll) {
    io.to('global-chat').emit('chat:poll-state', { poll: null });
    return;
  }

  for (const user of onlineUsers.values()) {
    io.to(user.socketId).emit('chat:poll-state', {
      poll: serializeChatPoll(activeChatPoll, user.userId),
    });
  }
};

const formatGameScoreForChat = (gameType: string, score: number) => {
  if (gameType === 'racer') {
    return `${score.toLocaleString('fr-FR', {
      minimumFractionDigits: score % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })} s`;
  }

  return score.toLocaleString('fr-FR');
};

const buildChatMessagePayload = async (
  message: any,
  leaderboardState?: { topMoneyIds: Set<string>; topAuraIds: Set<string> }
) => {
  const senderId = typeof message.userId === 'string' ? message.userId : null;
  const [leaderboards, senderBadges, senderClanTag] = await Promise.all([
    leaderboardState ? Promise.resolve(leaderboardState) : getTopLeaderboardIds(),
    senderId ? getUserEquippedBadges(senderId) : Promise.resolve([]),
    senderId ? getUserClanTag(senderId) : Promise.resolve(null),
  ]);

  return {
    id: message.id,
    type: message.type ?? 'user',
    userId: senderId,
    username: message.user?.username ?? CHAT_SYSTEM_USERNAME,
    usernameColor: message.user?.usernameColor ?? null,
    profilePicture: message.user?.profilePicture ?? null,
    message: message.message,
    imageUrl: message.imageUrl ?? null,
    pinned: message.pinned ?? false,
    pinnedAt: message.pinnedAt ? message.pinnedAt.toISOString() : null,
    isTopMoney: senderId ? leaderboards.topMoneyIds.has(senderId) : false,
    isTopAura: senderId ? leaderboards.topAuraIds.has(senderId) : false,
    badges: senderBadges,
    clanTag: senderClanTag,
    reactions: summarizeReactions(message.reactions ?? []),
    replyTo: message.replyTo && !message.replyTo.deletedAt
      ? {
          id: message.replyTo.id,
          userId: message.replyTo.userId ?? null,
          username: message.replyTo.user?.username ?? CHAT_SYSTEM_USERNAME,
          usernameColor: message.replyTo.user?.usernameColor ?? null,
          message: message.replyTo.message,
          imageUrl: message.replyTo.imageUrl ?? null,
        }
      : null,
    timestamp: message.createdAt.toISOString(),
  };
};

const fetchChatHistoryPage = async (
  beforeMessageId?: string | null,
  limit: number = CHAT_HISTORY_PAGE_SIZE
) => {
  const messages = await prisma.chatMessage.findMany({
    take: limit + 1,
    where: { deletedAt: null },
    ...(beforeMessageId
      ? {
          cursor: { id: beforeMessageId },
          skip: 1,
        }
      : {}),
    orderBy: { createdAt: 'desc' },
    include: CHAT_MESSAGE_INCLUDE,
  });

  const hasMore = messages.length > limit;
  const pageMessages = hasMore ? messages.slice(0, limit) : messages;
  const senderIds = [
    ...new Set(pageMessages.map((message) => message.userId).filter((id): id is string => Boolean(id))),
  ];
  const [leaderboardState, badgeMap, clanTagMap] = await Promise.all([
    getTopLeaderboardIds(),
    getBatchEquippedBadges(senderIds),
    getBatchClanTags(senderIds),
  ]);

  return {
    hasMore,
    messages: pageMessages.reverse().map((message) => ({
      id: message.id,
      type: message.type ?? 'user',
      userId: message.userId ?? null,
      username: message.user?.username ?? CHAT_SYSTEM_USERNAME,
      usernameColor: message.user?.usernameColor ?? null,
      profilePicture: message.user?.profilePicture ?? null,
      message: message.message,
      imageUrl: message.imageUrl ?? null,
      pinned: message.pinned,
      pinnedAt: message.pinnedAt ? message.pinnedAt.toISOString() : null,
      isTopMoney: message.userId ? leaderboardState.topMoneyIds.has(message.userId) : false,
      isTopAura: message.userId ? leaderboardState.topAuraIds.has(message.userId) : false,
      badges: message.userId ? badgeMap.get(message.userId) ?? [] : [],
      clanTag: message.userId ? clanTagMap.get(message.userId) ?? null : null,
      reactions: summarizeReactions(message.reactions),
      replyTo: message.replyTo && !message.replyTo.deletedAt
        ? {
            id: message.replyTo.id,
            userId: message.replyTo.userId ?? null,
            username: message.replyTo.user?.username ?? CHAT_SYSTEM_USERNAME,
            usernameColor: message.replyTo.user?.usernameColor ?? null,
            message: message.replyTo.message,
            imageUrl: message.replyTo.imageUrl ?? null,
          }
        : null,
      timestamp: message.createdAt.toISOString(),
    })),
  };
};

export const createAndBroadcastSystemMessage = async (io: Server, message: string) => {
  const savedMessage = await prisma.chatMessage.create({
    data: {
      type: 'system',
      message,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          usernameColor: true,
          profilePicture: true,
        },
      },
      reactions: {
        select: {
          emoji: true,
          user: {
            select: {
              username: true,
            },
          },
        },
      },
      replyTo: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              usernameColor: true,
              profilePicture: true,
            },
          },
        },
      },
    },
  });

  io.to('global-chat').emit('chat:message', await buildChatMessagePayload(savedMessage));
};

export const announceGameRecordBroken = async (
  io: Server,
  data: { username: string; gameLabel: string; score: number; gameType: string }
) => {
  await createAndBroadcastSystemMessage(
    io,
    `${data.username} a battu le record sur ${data.gameLabel} avec ${formatGameScoreForChat(data.gameType, data.score)}.`
  );
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
  _displayedOnlineStateCache = null;
  _write();
  _rescheduleHeartbeat(); // reset heartbeat since activity just happened
};

/** Call when a player leaves — debounced to absorb quick reconnects. */
const _onPlayerLeft = () => {
  _displayedOnlineStateCache = null;
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
  Array.from(onlineUsers.values()).map(u => ({
    userId: u.userId,
    username: u.username,
    currentPage: u.currentPage ?? null,
    isPageActive: u.isPageActive,
  }));

export const setupChatHandlers = (socket: Socket, io: Server) => {
  // Join chat
  socket.on('chat:join', async (data: { currentPage?: string; isPageActive?: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const currentPage = data?.currentPage;
    const isPageActive = data?.isPageActive !== false;

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
        id: true,
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
        userId,
        ban: {
          id: activeBan.id,
          userId,
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
        chatMuteExpiresAt: true,
        chatMuteReason: true,
      },
    });
    if (!dbUser) return;

    if (dbUser.isChatMuted && dbUser.chatMuteExpiresAt && dbUser.chatMuteExpiresAt <= new Date()) {
      await clearExpiredChatMute(prisma, userId);
    } else if (dbUser.isChatMuted) {
      socket.emit('chat:muted', {
        message: 'Vous avez ete mute du chat.',
        mutedUntil: dbUser.chatMuteExpiresAt ? dbUser.chatMuteExpiresAt.toISOString() : null,
        reason: dbUser.chatMuteReason ?? 'Mute chat actif',
      });
    }

    // Store user info
    onlineUsers.set(userId, {
      userId,
      username: dbUser.username,
      socketId: socket.id,
      usernameColor: dbUser?.usernameColor,
      profilePicture: dbUser?.profilePicture,
      currentPage: currentPage ?? null,
      isPageActive,
    });
    socket.join(`user:${userId}`);
    _onPlayerJoined();

    // Join global chat room
    socket.join('global-chat');
    
    socket.emit('chat:history', await fetchChatHistoryPage());

    emitChatPollStateToSocket(socket, userId);
    
    await sendDisplayedOnlineState(socket);
    void broadcastUserJoined(socket, userId);
  });

  // Send message
  socket.on('chat:message', async (data: { message?: string; imageUrl?: string | null; replyToId?: string | null }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const rawMessage = typeof data.message === 'string' ? data.message.trim() : '';
    const imageUrl = typeof data.imageUrl === 'string' && isAllowedImageUrl(data.imageUrl) ? data.imageUrl : null;
    const replyToId = data.replyToId;

    const user = onlineUsers.get(userId);
    if (!user) return;

    if (!rawMessage && !imageUrl) {
      return;
    }

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
        userId,
        ban: {
          id: activeBan.id,
          userId,
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
        chatMuteExpiresAt: true,
        chatMuteReason: true,
        chatModerationStrikes: true,
        chatModerationLevel: true,
        isAdmin: true,
        isSuperAdmin: true,
      },
    });

    if (!dbUser) {
      return;
    }

    if (dbUser.isChatMuted && dbUser.chatMuteExpiresAt && dbUser.chatMuteExpiresAt <= new Date()) {
      await clearExpiredChatMute(prisma, userId);
      dbUser.isChatMuted = false;
      dbUser.chatMuteExpiresAt = null;
      dbUser.chatMuteReason = null;
    }

    if (dbUser.isChatMuted) {
      const notice = buildMuteNotice(dbUser.chatMuteExpiresAt, dbUser.chatMuteReason ?? 'Mute chat actif');
      socket.emit('chat:muted', {
        message: notice.message,
        mutedUntil: notice.mutedUntil,
        reason: notice.reason,
        notice,
      });
      return;
    }

    if (!dbUser.isAdmin && !dbUser.isSuperAdmin) {
      const chatBlockState = await getChatBlockState();
      if (chatBlockState.blocked) {
        socket.emit('chat:blocked', {
          message: chatBlockState.blockMessage,
          reason: chatBlockState.activeReason,
        });
        return;
      }
    }
    
    // Update cached cosmetics
    if (dbUser) {
      user.usernameColor = dbUser.usernameColor;
      user.profilePicture = dbUser.profilePicture;
    }
    
    const replyTo = replyToId
      ? await prisma.chatMessage.findFirst({
          where: { id: replyToId, deletedAt: null },
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

    const moderationResult = moderateChatMessage(rawMessage);
    const messageToSave = moderationResult.censoredMessage;
    const recentContext = moderationResult.matched
      ? await prisma.chatMessage.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: {
                username: true,
              },
            },
          },
        })
      : [];
    const moderationNotice = moderationResult.matched
      ? await applyChatModerationStrike(prisma, { id: userId, ...dbUser })
      : null;

    // Save message to database
    const savedMessage = await prisma.chatMessage.create({
      data: {
        userId,
        type: 'user',
        message: messageToSave,
        originalMessage: moderationResult.matched ? rawMessage : null,
        imageUrl,
        replyToId: replyTo?.id ?? null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
            profilePicture: true,
          },
        },
        reactions: {
          select: {
            emoji: true,
            user: {
              select: {
                username: true,
              },
            },
          },
        },
        replyTo: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                usernameColor: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });
    
    // Log message sent
    logChat('message_sent', userId, user.username, {
      messageId: savedMessage.id,
      messageLength: messageToSave.length,
      hasImage: Boolean(imageUrl),
      hasReply: !!replyTo,
      moderated: moderationResult.matched,
    });

    // Broadcast to all in chat with cosmetics
    const leaderboardState = await getTopLeaderboardIds();
    io.to('global-chat').emit('chat:message', await buildChatMessagePayload(savedMessage, leaderboardState));
    if (moderationNotice) {
      if (moderationNotice.type === 'mute') {
        void logAdmin('chat_auto_mute', null, 'Auto-modération', userId, user.username, {
          reason: moderationNotice.reason,
          durationLabel: moderationNotice.durationLabel,
          mutedUntil: moderationNotice.mutedUntil,
          detectedTerms: moderationResult.matchedTerms,
          discussion: 'Chat général',
          offendingMessage: rawMessage,
          censoredMessage: messageToSave,
          contextMessages: recentContext.reverse().map((message) => ({
            id: message.id,
            username: message.user?.username ?? CHAT_SYSTEM_USERNAME,
            message: message.message,
            createdAt: message.createdAt.toISOString(),
          })),
        });
      }
      socket.emit('chat:moderation-warning', moderationNotice);
      if (moderationNotice.type === 'mute') {
        socket.emit('chat:muted', {
          message: moderationNotice.message,
          mutedUntil: moderationNotice.mutedUntil,
          reason: moderationNotice.reason,
          notice: moderationNotice,
        });
      }
    }
  });
  
  // Typing indicator
  socket.on('chat:typing', async (data: { userId: string; isTyping: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { isTyping } = data;
    const user = onlineUsers.get(userId);
    if (!user) return;

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isAdmin: true,
        isSuperAdmin: true,
      },
    });

    if (!dbUser) return;

    if (!dbUser.isAdmin && !dbUser.isSuperAdmin) {
      const chatBlockState = await getChatBlockState();
      if (chatBlockState.blocked) {
        return;
      }
    }
    
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
    broadcastUserUpdated(io, userId);
  });

  socket.on('chat:presence', (data: { isPageActive: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const user = onlineUsers.get(userId);
    if (!user) return;

    const nextIsPageActive = Boolean(data?.isPageActive);
    if (user.isPageActive === nextIsPageActive) return;

    user.isPageActive = nextIsPageActive;
    broadcastUserUpdated(io, userId);
  });

  // On-demand: client requests the full online users list (with pages)
  socket.on('chat:request-online-users', async () => {
    await sendDisplayedOnlineState(socket);
  });

  socket.on('chat:load-older', async (data?: { beforeMessageId?: string | null }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    socket.emit('chat:history-older', await fetchChatHistoryPage(data?.beforeMessageId ?? null));
  });

  socket.on('chat:poll-create', async (data: { question?: string; options?: string[] }) => {
    const adminId = socket.data.userId as string | undefined;
    if (!adminId) return;

    const adminUser = await prisma.user.findUnique({
      where: { id: adminId },
      select: { username: true, isAdmin: true, isSuperAdmin: true },
    });

    if (!adminUser || (!adminUser.isAdmin && !adminUser.isSuperAdmin)) {
      socket.emit('chat:poll-error', { message: 'Seuls les admins peuvent creer un sondage.' });
      return;
    }

    const question = typeof data?.question === 'string' ? data.question.trim() : '';
    const rawOptions = Array.isArray(data?.options) ? data.options : [];
    const options = rawOptions
      .map((option) => (typeof option === 'string' ? option.trim() : ''))
      .filter(Boolean);

    if (question.length < 3 || question.length > 180) {
      socket.emit('chat:poll-error', {
        message: 'La question doit contenir entre 3 et 180 caracteres.',
      });
      return;
    }

    if (options.length < 2 || options.length > 6) {
      socket.emit('chat:poll-error', {
        message: 'Le sondage doit avoir entre 2 et 6 options.',
      });
      return;
    }

    const normalizedSet = new Set<string>();
    for (const option of options) {
      const normalized = option.toLowerCase();
      if (normalizedSet.has(normalized)) {
        socket.emit('chat:poll-error', {
          message: 'Les options du sondage doivent etre uniques.',
        });
        return;
      }
      if (option.length > 80) {
        socket.emit('chat:poll-error', {
          message: 'Chaque option doit faire 80 caracteres maximum.',
        });
        return;
      }
      normalizedSet.add(normalized);
    }

    activeChatPoll = {
      id: `poll-${Date.now()}`,
      question,
      options: options.map((option, index) => ({
        id: `opt-${index + 1}`,
        text: option,
        voterIds: new Set<string>(),
      })),
      createdByUserId: adminId,
      createdByUsername: adminUser.username,
      createdAt: new Date(),
    };

    broadcastChatPollState(io);
    await createAndBroadcastSystemMessage(io, `${adminUser.username} a lance un sondage dans le chat.`);
  });

  socket.on('chat:poll-vote', (data: { pollId?: string; optionId?: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId || !activeChatPoll) return;

    if (typeof data?.pollId !== 'string' || data.pollId !== activeChatPoll.id) {
      socket.emit('chat:poll-error', { message: 'Ce sondage n est plus actif.' });
      emitChatPollStateToSocket(socket, userId);
      return;
    }

    const optionId = typeof data?.optionId === 'string' ? data.optionId : '';
    const selectedOption = activeChatPoll.options.find((option) => option.id === optionId);
    if (!selectedOption) {
      socket.emit('chat:poll-error', { message: 'Option de sondage introuvable.' });
      return;
    }

    for (const option of activeChatPoll.options) {
      option.voterIds.delete(userId);
    }
    selectedOption.voterIds.add(userId);

    broadcastChatPollState(io);
  });

  socket.on('chat:poll-close', async (data: { pollId?: string }) => {
    const adminId = socket.data.userId as string | undefined;
    if (!adminId || !activeChatPoll) return;

    const adminUser = await prisma.user.findUnique({
      where: { id: adminId },
      select: { username: true, isAdmin: true, isSuperAdmin: true },
    });

    if (!adminUser || (!adminUser.isAdmin && !adminUser.isSuperAdmin)) {
      socket.emit('chat:poll-error', { message: 'Seuls les admins peuvent cloturer un sondage.' });
      return;
    }

    if (typeof data?.pollId !== 'string' || data.pollId !== activeChatPoll.id) {
      socket.emit('chat:poll-error', { message: 'Ce sondage n est plus actif.' });
      emitChatPollStateToSocket(socket, adminId);
      return;
    }

    activeChatPoll = null;
    broadcastChatPollState(io);
    await createAndBroadcastSystemMessage(io, `${adminUser.username} a cloture le sondage actif.`);
  });

  socket.on('chat:reaction', async (data: { messageId: string; emoji: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const { messageId, emoji } = data;
    const user = onlineUsers.get(userId);
    if (!user) return;

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true, deletedAt: true },
    });
    if (!message || message.deletedAt) return;

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

    const reactionDetails = await prisma.chatReaction.findMany({
      where: { messageId },
      select: {
        emoji: true,
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    io.to('global-chat').emit('chat:reactions-updated', {
      messageId,
      reactions: summarizeReactions(reactionDetails),
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
      const updated = await prisma.chatMessage.updateMany({
        where: { id: messageId, deletedAt: null },
        data: {
          pinned,
          pinnedAt: pinned ? new Date() : null,
        },
      });

      if (updated.count === 0) {
        return;
      }

      io.to('global-chat').emit('chat:pin-updated', {
        messageId,
        pinned,
        pinnedAt: pinned ? new Date().toISOString() : null,
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

      if (!messageToDelete || messageToDelete.deletedAt) {
        return;
      }

      // Visual-only deletion: keep message in storage for full history/export.
      await prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          deletedAt: new Date(),
          deletedByUserId: adminId,
          pinned: false,
          pinnedAt: null,
        },
      });

      // Log message deletion
      logChat('message_deleted', adminId, admin.isAdmin ? 'admin' : undefined, {
        deletedMessageId: messageId,
        originalAuthor: messageToDelete?.user?.username ?? CHAT_SYSTEM_USERNAME,
        originalAuthorId: messageToDelete?.userId,
      });

      // Broadcast deletion to all users
      io.to('global-chat').emit('chat:message-deleted', { messageId });
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  });

  // Heartbeat — keeps presence alive without resending chat history.
  // If the user isn't in onlineUsers (presence was lost), we ask them to rejoin.
  socket.on('chat:heartbeat', (data: { isPageActive?: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const user = onlineUsers.get(userId);
    if (user) {
      // Refresh socket ID (handles the case where the map has a stale socket ID)
      user.socketId = socket.id;
      if (data?.isPageActive !== undefined) {
        user.isPageActive = Boolean(data.isPageActive);
      }
    } else {
      // Presence was lost — tell the client to do a full chat:join
      socket.emit('chat:rejoin-required');
    }
  });

  // Handle disconnect
  socket.once('disconnect', () => {
    // Find and remove user from online list
    for (const [userId, user] of onlineUsers.entries()) {
      if (user.socketId === socket.id) {
        onlineUsers.delete(userId);
        _onPlayerLeft();
        broadcastUserLeft(io, userId);
        break;
      }
    }
  });
};

export { onlineUsers };

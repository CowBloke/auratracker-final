import { prisma } from '../server.js';

export const SOCIAL_USER_SELECT = {
  id: true,
  username: true,
  firstName: true,
  usernameColor: true,
  profilePicture: true,
  bio: true,
  createdAt: true,
} as const;

export const getCanonicalConversationPair = (userId: string, otherUserId: string) =>
  userId < otherUserId ? [userId, otherUserId] as const : [otherUserId, userId] as const;

export const getOrCreatePrivateConversation = async (userId: string, otherUserId: string) => {
  const [participantOneId, participantTwoId] = getCanonicalConversationPair(userId, otherUserId);

  return prisma.privateConversation.upsert({
    where: {
      participantOneId_participantTwoId: {
        participantOneId,
        participantTwoId,
      },
    },
    create: {
      participantOneId,
      participantTwoId,
    },
    update: {},
  });
};

export const getConversationOtherUserId = (
  conversation: { participantOneId: string; participantTwoId: string },
  viewerId: string
) => (conversation.participantOneId === viewerId ? conversation.participantTwoId : conversation.participantOneId);

export const getFriendIds = async (userId: string) => {
  const [following, followers] = await Promise.all([
    prisma.userFollow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    }),
    prisma.userFollow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    }),
  ]);

  const followerIds = new Set(followers.map((entry) => entry.followerId));

  return following
    .map((entry) => entry.followingId)
    .filter((id) => followerIds.has(id));
};

export const getRelationshipWithViewer = async (viewerId: string, targetUserId: string) => {
  if (viewerId === targetUserId) {
    return {
      isFollowing: false,
      isFollowedBy: false,
      isConnection: false,
    };
  }

  const [following, followedBy] = await Promise.all([
    prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId: viewerId,
          followingId: targetUserId,
        },
      },
      select: { id: true },
    }),
    prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId: targetUserId,
          followingId: viewerId,
        },
      },
      select: { id: true },
    }),
  ]);

  return {
    isFollowing: Boolean(following),
    isFollowedBy: Boolean(followedBy),
    isConnection: Boolean(following && followedBy),
  };
};

export const getUserSocialStats = async (userId: string) => {
  const [followerCount, followingCount, connections] = await Promise.all([
    prisma.userFollow.count({ where: { followingId: userId } }),
    prisma.userFollow.count({ where: { followerId: userId } }),
    getFriendIds(userId),
  ]);

  return {
    followerCount,
    followingCount,
    connectionCount: connections.length,
  };
};

export const buildConversationSummaryForViewer = (
  conversation: {
    id: string;
    participantOneId: string;
    participantTwoId: string;
    createdAt: Date;
    updatedAt: Date;
    lastMessageAt: Date;
    participantOne: typeof SOCIAL_USER_SELECT extends infer _T ? any : never;
    participantTwo: typeof SOCIAL_USER_SELECT extends infer _T ? any : never;
    messages: Array<{
      id: string;
      body: string;
      imageUrl: string | null;
      createdAt: Date;
      readAt: Date | null;
      senderId: string;
    }>;
  },
  viewerId: string
) => {
  const otherUser =
    conversation.participantOneId === viewerId
      ? conversation.participantTwo
      : conversation.participantOne;
  const lastMessage = conversation.messages[0] ?? null;
  const unreadCount = conversation.messages.filter(
    (message) => message.senderId !== viewerId && !message.readAt
  ).length;

  return {
    id: conversation.id,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    otherUser: {
      ...otherUser,
      createdAt: otherUser.createdAt.toISOString(),
    },
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          body: lastMessage.body,
          imageUrl: lastMessage.imageUrl,
          createdAt: lastMessage.createdAt.toISOString(),
          readAt: lastMessage.readAt ? lastMessage.readAt.toISOString() : null,
          senderId: lastMessage.senderId,
        }
      : null,
    unreadCount,
  };
};

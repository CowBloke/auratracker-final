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

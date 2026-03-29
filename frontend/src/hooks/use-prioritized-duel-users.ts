import { useEffect, useMemo, useState } from 'react';
import type { OnlineUser } from '../contexts/ChatSocketContext';
import { usersApi } from '../services/api';

interface UserSocialRecord {
  id: string;
  social?: {
    isConnection?: boolean;
    isFollowedBy?: boolean;
  };
}

interface UsersApiResponse {
  users?: UserSocialRecord[];
}

export function usePrioritizedDuelUsers(
  onlineUsers: OnlineUser[],
  currentUserId: string | undefined,
  searchQuery: string
): OnlineUser[] {
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [followerIds, setFollowerIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    usersApi
      .getAll()
      .then((response) => {
        if (cancelled) return;

        const users = Array.isArray((response.data as UsersApiResponse).users)
          ? ((response.data as UsersApiResponse).users as UserSocialRecord[])
          : [];

        const nextFriendIds = new Set<string>();
        const nextFollowerIds = new Set<string>();

        for (const listedUser of users) {
          if (listedUser.social?.isConnection) {
            nextFriendIds.add(listedUser.id);
          }
          if (listedUser.social?.isFollowedBy) {
            nextFollowerIds.add(listedUser.id);
          }
        }

        setFriendIds(nextFriendIds);
        setFollowerIds(nextFollowerIds);
      })
      .catch(() => {
        if (cancelled) return;
        setFriendIds(new Set());
        setFollowerIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  return useMemo(() => {
    const filtered = onlineUsers.filter((onlineUser) => {
      if (onlineUser.userId === currentUserId) return false;
      return onlineUser.username.toLowerCase().includes(normalizedSearch);
    });

    return [...filtered].sort((a, b) => {
      const aIsFriend = friendIds.has(a.userId);
      const bIsFriend = friendIds.has(b.userId);
      if (aIsFriend !== bIsFriend) return aIsFriend ? -1 : 1;

      const aIsFollower = followerIds.has(a.userId);
      const bIsFollower = followerIds.has(b.userId);
      if (aIsFollower !== bIsFollower) return aIsFollower ? -1 : 1;

      return a.username.localeCompare(b.username, 'fr', { sensitivity: 'base' });
    });
  }, [onlineUsers, currentUserId, normalizedSearch, friendIds, followerIds]);
}

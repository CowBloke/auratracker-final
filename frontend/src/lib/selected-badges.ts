import { badgesApi, type PublicBadge } from '@/services/api';

const selectedBadgesCache = new Map<string, PublicBadge[]>();
const selectedBadgesInFlight = new Map<string, Promise<void>>();

export const getCachedSelectedBadges = (userId: string) => selectedBadgesCache.get(userId);

export const setCachedSelectedBadges = (userId: string, badges: PublicBadge[]) => {
  selectedBadgesCache.set(userId, badges.slice(0, 2));
};

export const invalidateCachedSelectedBadges = (userId: string) => {
  selectedBadgesCache.delete(userId);
};

export const fetchCachedSelectedBadges = async (userId: string) => {
  if (selectedBadgesCache.has(userId)) return;
  if (selectedBadgesInFlight.has(userId)) return selectedBadgesInFlight.get(userId)!;

  const promise = (async () => {
    try {
      const res = await badgesApi.getSelected([userId]);
      const badges = res.data.users?.[userId] ?? [];
      setCachedSelectedBadges(userId, badges);
    } catch {
      setCachedSelectedBadges(userId, []);
    } finally {
      selectedBadgesInFlight.delete(userId);
    }
  })();

  selectedBadgesInFlight.set(userId, promise);
  return promise;
};


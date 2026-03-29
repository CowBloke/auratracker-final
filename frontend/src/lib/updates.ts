// Kept only for localStorage-based unread tracking.
// Display data is now served from the API (/updates).

const UPDATE_SEEN_STORAGE_KEY = 'auratracker:updates-last-seen-entry-id';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getSeenUpdateEntryId(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(UPDATE_SEEN_STORAGE_KEY);
}

export function markUpdatesSeen(entryId?: string): void {
  if (!canUseStorage()) return;
  if (entryId) {
    window.localStorage.setItem(UPDATE_SEEN_STORAGE_KEY, entryId);
  }
}

/** Returns how many entries in the given sorted (newest-first) ID list are newer than the last seen. */
export function computeNewUpdatesCount(entryIds: string[]): number {
  if (entryIds.length === 0) return 0;
  const seenId = getSeenUpdateEntryId();
  if (!seenId) return entryIds.length;
  const seenIndex = entryIds.indexOf(seenId);
  if (seenIndex < 0) return entryIds.length;
  return seenIndex;
}

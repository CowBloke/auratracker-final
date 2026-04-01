// Kept only for localStorage-based unread tracking.
// Display data is now served from the API (/changelog).

const CHANGELOG_SEEN_STORAGE_KEY = 'auratracker:changelog-last-seen-entry-id';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getSeenChangelogEntryId(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(CHANGELOG_SEEN_STORAGE_KEY);
}

export function markChangelogSeen(entryId?: string): void {
  if (!canUseStorage()) return;
  if (entryId) {
    window.localStorage.setItem(CHANGELOG_SEEN_STORAGE_KEY, entryId);
  }
}

/** Returns how many entries in the given sorted (newest-first) ID list are newer than the last seen. */
export function computeNewChangelogCount(entryIds: string[]): number {
  if (entryIds.length === 0) return 0;
  const seenId = getSeenChangelogEntryId();
  if (!seenId) return entryIds.length;
  const seenIndex = entryIds.indexOf(seenId);
  if (seenIndex < 0) return entryIds.length;
  return seenIndex;
}

export type ChangelogCategory = 'BIG_FEATURE' | 'SMALL_FEATURE' | 'BUG_FIX';

export type ChangelogSection = {
  category: ChangelogCategory;
  items: { id: string; text: string }[];
};

export type ChangelogEntry = {
  id: string;
  date: string;
  title: string;
  summary: string;
  sections: ChangelogSection[];
};

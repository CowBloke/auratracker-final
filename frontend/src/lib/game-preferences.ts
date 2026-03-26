import { useSyncExternalStore } from 'react';

const HIDE_GAME_LEADERBOARDS_STORAGE_KEY = 'hideGameLeaderboards';
const GAME_PREFERENCES_EVENT = 'game-preferences:change';

function readHideGameLeaderboardsPreference() {
  if (typeof window === 'undefined') {
    return false;
  }

  return localStorage.getItem(HIDE_GAME_LEADERBOARDS_STORAGE_KEY) === '1';
}

function emitGamePreferencesChange() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(GAME_PREFERENCES_EVENT));
}

export function setHideGameLeaderboardsPreference(value: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  if (value) {
    localStorage.setItem(HIDE_GAME_LEADERBOARDS_STORAGE_KEY, '1');
  } else {
    localStorage.removeItem(HIDE_GAME_LEADERBOARDS_STORAGE_KEY);
  }

  emitGamePreferencesChange();
}

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === HIDE_GAME_LEADERBOARDS_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(GAME_PREFERENCES_EVENT, callback);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(GAME_PREFERENCES_EVENT, callback);
  };
}

export function useHideGameLeaderboards() {
  return useSyncExternalStore(
    subscribe,
    readHideGameLeaderboardsPreference,
    () => false
  );
}

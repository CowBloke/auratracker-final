import { useSyncExternalStore } from 'react';

const HIDE_GAME_LEADERBOARDS_STORAGE_KEY = 'hideGameLeaderboards';
const HIDE_GAME_LEFT_INFO_STORAGE_KEY = 'hideGameLeftInfo';
const GAME_PREFERENCES_EVENT = 'game-preferences:change';

function readHideGameLeaderboardsPreference() {
  if (typeof window === 'undefined') {
    return false;
  }

  const storedValue = localStorage.getItem(HIDE_GAME_LEADERBOARDS_STORAGE_KEY);
  return storedValue === null ? false : storedValue === '1';
}

function readHideGameLeftInfoPreference() {
  if (typeof window === 'undefined') {
    return true;
  }

  const storedValue = localStorage.getItem(HIDE_GAME_LEFT_INFO_STORAGE_KEY);
  return storedValue === null ? true : storedValue === '1';
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

  localStorage.setItem(HIDE_GAME_LEADERBOARDS_STORAGE_KEY, value ? '1' : '0');

  emitGamePreferencesChange();
}

export function setHideGameLeftInfoPreference(value: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(HIDE_GAME_LEFT_INFO_STORAGE_KEY, value ? '1' : '0');

  emitGamePreferencesChange();
}

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === HIDE_GAME_LEADERBOARDS_STORAGE_KEY ||
      event.key === HIDE_GAME_LEFT_INFO_STORAGE_KEY
    ) {
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

export function useHideGameLeftInfo() {
  return useSyncExternalStore(
    subscribe,
    readHideGameLeftInfoPreference,
    () => true
  );
}

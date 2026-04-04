import { useSyncExternalStore } from 'react';

const SOUND_ENABLED_KEY = 'sound:enabled';
const SOUND_VOLUME_KEY = 'sound:volume';
const SOUND_PREFERENCES_EVENT = 'sound-preferences:change';

function readEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(SOUND_ENABLED_KEY);
  return v === null ? true : v === '1';
}

function readVolume(): number {
  if (typeof window === 'undefined') return 0.5;
  const v = localStorage.getItem(SOUND_VOLUME_KEY);
  if (v === null) return 0.5;
  const n = parseFloat(v);
  return isNaN(n) ? 0.5 : Math.min(1, Math.max(0, n));
}

function emit() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SOUND_PREFERENCES_EVENT));
  }
}

export function setSoundEnabled(value: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_ENABLED_KEY, value ? '1' : '0');
  emit();
}

export function setSoundVolume(value: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_VOLUME_KEY, String(Math.min(1, Math.max(0, value))));
  emit();
}

function subscribe(cb: () => void) {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === SOUND_ENABLED_KEY || e.key === SOUND_VOLUME_KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(SOUND_PREFERENCES_EVENT, cb);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(SOUND_PREFERENCES_EVENT, cb);
  };
}

export function useSoundEnabled() {
  return useSyncExternalStore(subscribe, readEnabled, () => true);
}

export function useSoundVolume() {
  return useSyncExternalStore(subscribe, readVolume, () => 0.5);
}

export function getSoundEnabled() { return readEnabled(); }
export function getSoundVolume() { return readVolume(); }

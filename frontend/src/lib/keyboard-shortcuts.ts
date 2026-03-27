import { useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from 'react';

const KEYBOARD_SHORTCUTS_STORAGE_KEY = 'keyboardShortcuts';
const KEYBOARD_SHORTCUTS_EVENT = 'keyboard-shortcuts:change';

export type KeyboardShortcutActionId =
  | 'open_dashboard'
  | 'open_games'
  | 'open_profile'
  | 'open_inbox'
  | 'open_shop'
  | 'open_settings';

export interface KeyboardShortcutDefinition {
  id: KeyboardShortcutActionId;
  label: string;
  description: string;
  combo: string;
  enabled: boolean;
}

type StoredKeyboardShortcutMap = Partial<
  Record<KeyboardShortcutActionId, { combo?: string; enabled?: boolean }>
>;

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcutDefinition[] = [
  {
    id: 'open_dashboard',
    label: 'Ouvrir le dashboard',
    description: 'Retourne rapidement a la page principale.',
    combo: 'Alt+Shift+D',
    enabled: true,
  },
  {
    id: 'open_games',
    label: 'Ouvrir les jeux',
    description: 'Affiche le hub des jeux.',
    combo: 'Alt+Shift+G',
    enabled: true,
  },
  {
    id: 'open_profile',
    label: 'Ouvrir mon profil',
    description: 'Va directement sur ton profil.',
    combo: 'Alt+Shift+P',
    enabled: true,
  },
  {
    id: 'open_inbox',
    label: 'Ouvrir la boite de reception',
    description: 'Affiche les notifications et messages systeme.',
    combo: 'Alt+Shift+I',
    enabled: true,
  },
  {
    id: 'open_shop',
    label: 'Ouvrir la boutique',
    description: 'Accede rapidement au shop.',
    combo: 'Alt+Shift+M',
    enabled: true,
  },
  {
    id: 'open_settings',
    label: 'Ouvrir les reglages',
    description: 'Va directement dans les parametres utilisateur.',
    combo: 'Alt+Shift+S',
    enabled: true,
  },
];

const DEFAULT_KEYBOARD_SHORTCUTS_SNAPSHOT = DEFAULT_KEYBOARD_SHORTCUTS.map((shortcut) => ({ ...shortcut }));
const DEFAULT_SHORTCUTS_SERIALIZED = JSON.stringify(
  DEFAULT_KEYBOARD_SHORTCUTS_SNAPSHOT.map(({ id, combo, enabled }) => ({ id, combo, enabled }))
);

let cachedKeyboardShortcutsSnapshot = DEFAULT_KEYBOARD_SHORTCUTS_SNAPSHOT;
let cachedKeyboardShortcutsSerialized = DEFAULT_SHORTCUTS_SERIALIZED;

function emitKeyboardShortcutsChange() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(KEYBOARD_SHORTCUTS_EVENT));
}

function getDefaultShortcutsMap() {
  return new Map(
    DEFAULT_KEYBOARD_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut] as const)
  );
}

export function normalizeShortcutCombo(combo: string) {
  const trimmed = combo.trim();
  if (!trimmed) {
    return '';
  }

  const rawParts = trimmed
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

  const modifiers = new Set<string>();
  let key = '';

  for (const part of rawParts) {
    const lower = part.toLowerCase();

    if (lower === 'ctrl' || lower === 'control') {
      modifiers.add('Ctrl');
      continue;
    }

    if (lower === 'cmd' || lower === 'meta') {
      modifiers.add('Meta');
      continue;
    }

    if (lower === 'alt' || lower === 'option') {
      modifiers.add('Alt');
      continue;
    }

    if (lower === 'shift') {
      modifiers.add('Shift');
      continue;
    }

    key = normalizeShortcutKey(part);
  }

  if (!key) {
    return '';
  }

  return [...['Ctrl', 'Meta', 'Alt', 'Shift'].filter((modifier) => modifiers.has(modifier)), key].join('+');
}

function normalizeShortcutKey(value: string) {
  const lower = value.toLowerCase();

  if (lower === ' ') return 'Space';
  if (lower === 'escape' || lower === 'esc') return 'Escape';
  if (lower === 'arrowup' || lower === 'up') return 'ArrowUp';
  if (lower === 'arrowdown' || lower === 'down') return 'ArrowDown';
  if (lower === 'arrowleft' || lower === 'left') return 'ArrowLeft';
  if (lower === 'arrowright' || lower === 'right') return 'ArrowRight';
  if (lower === 'comma') return ',';
  if (lower.length === 1) return lower.toUpperCase();

  return value.length > 1 ? `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}` : value.toUpperCase();
}

function readStoredShortcutMap(): StoredKeyboardShortcutMap {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(KEYBOARD_SHORTCUTS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed as StoredKeyboardShortcutMap;
  } catch {
    return {};
  }
}

export function readKeyboardShortcuts(): KeyboardShortcutDefinition[] {
  const stored = readStoredShortcutMap();
  const defaults = getDefaultShortcutsMap();
  const shortcuts = DEFAULT_KEYBOARD_SHORTCUTS.map((shortcut) => {
    const saved = stored[shortcut.id];
    const combo = normalizeShortcutCombo(saved?.combo ?? shortcut.combo) || shortcut.combo;
    const enabled = typeof saved?.enabled === 'boolean' ? saved.enabled : shortcut.enabled;
    const definition = defaults.get(shortcut.id) ?? shortcut;

    return {
      ...definition,
      combo,
      enabled,
    };
  });

  const serialized = JSON.stringify(
    shortcuts.map(({ id, combo, enabled }) => ({ id, combo, enabled }))
  );

  if (serialized === cachedKeyboardShortcutsSerialized) {
    return cachedKeyboardShortcutsSnapshot;
  }

  cachedKeyboardShortcutsSerialized = serialized;
  cachedKeyboardShortcutsSnapshot = shortcuts;
  return cachedKeyboardShortcutsSnapshot;
}

function writeKeyboardShortcuts(shortcuts: KeyboardShortcutDefinition[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const payload = shortcuts.reduce<StoredKeyboardShortcutMap>((acc, shortcut) => {
    acc[shortcut.id] = {
      combo: normalizeShortcutCombo(shortcut.combo) || shortcut.combo,
      enabled: shortcut.enabled,
    };
    return acc;
  }, {});

  localStorage.setItem(KEYBOARD_SHORTCUTS_STORAGE_KEY, JSON.stringify(payload));
  emitKeyboardShortcutsChange();
}

export function updateKeyboardShortcut(
  id: KeyboardShortcutActionId,
  updates: Partial<Pick<KeyboardShortcutDefinition, 'combo' | 'enabled'>>
) {
  const shortcuts = readKeyboardShortcuts().map((shortcut) => {
    if (shortcut.id !== id) {
      return shortcut;
    }

    return {
      ...shortcut,
      combo: updates.combo ? normalizeShortcutCombo(updates.combo) || shortcut.combo : shortcut.combo,
      enabled: typeof updates.enabled === 'boolean' ? updates.enabled : shortcut.enabled,
    };
  });

  writeKeyboardShortcuts(shortcuts);
}

export function resetKeyboardShortcuts() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(KEYBOARD_SHORTCUTS_STORAGE_KEY);
  emitKeyboardShortcutsChange();
}

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === KEYBOARD_SHORTCUTS_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(KEYBOARD_SHORTCUTS_EVENT, callback);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(KEYBOARD_SHORTCUTS_EVENT, callback);
  };
}

export function useKeyboardShortcuts() {
  return useSyncExternalStore(
    subscribe,
    readKeyboardShortcuts,
    () => DEFAULT_KEYBOARD_SHORTCUTS_SNAPSHOT
  );
}

export function getShortcutComboFromEvent(event: KeyboardEvent | ReactKeyboardEvent) {
  const key = normalizeShortcutKey(event.key);
  const isModifierKey = ['Control', 'Shift', 'Alt', 'Meta'].includes(event.key);

  if (!key || isModifierKey) {
    return '';
  }

  const parts: string[] = [];

  if (event.ctrlKey) {
    parts.push('Ctrl');
  }

  if (event.metaKey) {
    parts.push('Meta');
  }

  if (event.altKey) {
    parts.push('Alt');
  }

  if (event.shiftKey) {
    parts.push('Shift');
  }

  if (parts.length === 0) {
    return '';
  }

  parts.push(key);
  return parts.join('+');
}

export function matchesShortcut(event: KeyboardEvent, combo: string) {
  const eventCombo = getShortcutComboFromEvent(event);
  if (!eventCombo) {
    return false;
  }

  return normalizeShortcutCombo(eventCombo) === normalizeShortcutCombo(combo);
}

export function formatShortcutCombo(combo: string) {
  const normalized = normalizeShortcutCombo(combo);
  if (!normalized) {
    return 'Non defini';
  }

  return normalized
    .split('+')
    .map((part) => {
      if (part === 'Meta') {
        return typeof navigator !== 'undefined' && /mac/i.test(navigator.platform) ? 'Cmd' : 'Meta';
      }

      if (part === 'Ctrl') return 'Ctrl';
      if (part === 'Alt') return 'Alt';
      if (part === 'Shift') return 'Shift';
      if (part === ' ') return 'Space';
      return part;
    })
    .join(' + ');
}

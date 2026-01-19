export type BanType = 'TEMPORARY' | 'PERMANENT';

export interface BanInfo {
  reason: string | null;
  type: BanType | null;
  expiresAt: string | null;
  message?: string;
}

const BAN_STORAGE_KEY = 'banInfo';

export const storeBanInfo = (info: BanInfo) => {
  try {
    localStorage.setItem(BAN_STORAGE_KEY, JSON.stringify(info));
  } catch {
    // Ignore storage errors
  }
};

export const loadBanInfo = (): BanInfo | null => {
  try {
    const raw = localStorage.getItem(BAN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BanInfo;
  } catch {
    return null;
  }
};

export const clearBanInfo = () => {
  try {
    localStorage.removeItem(BAN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
};

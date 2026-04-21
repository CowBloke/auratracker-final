import { getBusinessBalancing } from '../../config/balancing.js';

export interface YouMenuItem {
  key: string;
  label: string;
  price: number;
  emoji?: string;
  imageUrl?: string;
  section?: string;
}

export interface IllegalBusinessCustomData {
  items: YouMenuItem[];
  unlockedUpgradeKeys: string[];
  upgradedAtByKey?: Record<string, string>;
}

export const BUSINESS_SHARE_PROPOSAL_CANCEL_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

export const safeJsonParse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export function getDefaultIllegalBusinessCustomData(): IllegalBusinessCustomData {
  return {
    items: [
      { key: 'puff', label: 'Puff', price: 45 },
      { key: 'weed_pack', label: 'Pack de weed', price: 110 },
      { key: 'resine', label: 'Resine', price: 160 },
      { key: 'pilules', label: 'Pilules', price: 220 },
    ],
    unlockedUpgradeKeys: [],
    upgradedAtByKey: {},
  };
}

export function getIllegalBusinessCustomData(customData: string | null | undefined): IllegalBusinessCustomData {
  const fallback = getDefaultIllegalBusinessCustomData();
  if (!customData) return fallback;

  const parsed = safeJsonParse<any>(customData, fallback);
  if (Array.isArray(parsed)) {
    return {
      ...fallback,
      items: parsed,
    };
  }

  const parsedItems = Array.isArray(parsed?.items) ? parsed.items : fallback.items;
  const parsedUpgradeKeys = Array.isArray(parsed?.unlockedUpgradeKeys)
    ? parsed.unlockedUpgradeKeys.filter((entry: unknown): entry is string => typeof entry === 'string')
    : [];
  const parsedUpgradedAtByKey = parsed?.upgradedAtByKey && typeof parsed.upgradedAtByKey === 'object'
    ? parsed.upgradedAtByKey as Record<string, string>
    : {};

  return {
    items: parsedItems,
    unlockedUpgradeKeys: parsedUpgradeKeys,
    upgradedAtByKey: parsedUpgradedAtByKey,
  };
}

export function getBusinessSaleItems(business: { typeKey: string; customData?: string | null }) {
  const balancing = getBusinessBalancing(business.typeKey);
  if (!balancing || !('items' in balancing)) {
    return [] as YouMenuItem[];
  }

  const fallbackItems = balancing.items as unknown as YouMenuItem[];
  if (!business.customData) {
    return fallbackItems;
  }

  if (business.typeKey === 'illegal_market') {
    return getIllegalBusinessCustomData(business.customData).items;
  }

  const parsed = safeJsonParse<any>(business.customData, fallbackItems);
  return Array.isArray(parsed) ? parsed : fallbackItems;
}

export function getBusinessShareProposalCancelAvailableAt(createdAt: Date) {
  return new Date(createdAt.getTime() + BUSINESS_SHARE_PROPOSAL_CANCEL_DELAY_MS);
}

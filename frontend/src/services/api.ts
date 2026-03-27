import axios from 'axios';
import { storeBanInfo } from './ban';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE = API_URL.endsWith('/api/')
  ? API_URL.slice(0, -1)
  : API_URL.endsWith('/api')
    ? API_URL
    : `${API_URL.replace(/\/$/, '')}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 && error.response?.data?.banned) {
      const banData = error.response.data;
      storeBanInfo({
        reason: banData.ban?.reason ?? null,
        type: banData.ban?.type ?? null,
        expiresAt: banData.ban?.expiresAt ?? null,
        message: banData.error,
        banId: banData.ban?.id ?? null,
        userId: banData.userId ?? null,
      });
      localStorage.removeItem('token');
      window.location.href = '/banned';
      return Promise.reject(error);
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (data: { username: string; firstName: string; schoolLevel: 'SECONDE' | 'PREMIERE' | 'TERMINALE'; classLetter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'; email: string; password: string; motivationMessage: string; referralCode?: string }) =>
    api.post('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data),
  refresh: () => api.post('/auth/refresh'),
  me: () => api.get('/auth/me'),
  getReferralSummary: () => api.get<ReferralSummary>('/auth/referral-summary'),
};

export interface ReferralSummary {
  referralCode: string;
  rewardAmount: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalRewardsEarned: number;
}

// Uploads API - Deprecated: File uploads are no longer supported, only URL-based images are allowed

// Users API
export const usersApi = {
  getAll: () => api.get('/users'),
  getSocialOverview: () => api.get<{ stats: SocialStats; friends: SocialUser[] }>('/users/social/overview'),
  follow: (targetUserId: string) =>
    api.post<{ relationship: SocialRelationship; stats: SocialStats }>(`/users/social/follow/${targetUserId}`),
  unfollow: (targetUserId: string) =>
    api.delete<{ relationship: SocialRelationship; stats: SocialStats }>(`/users/social/follow/${targetUserId}`),
  getAnnouncement: () => api.get<{ message: string }>('/users/announcement'),
  getPendingUpdatePopups: () => api.get<{ popups: UserUpdatePopup[] }>('/users/update-popups/pending'),
  markUpdatePopupViewed: (id: string) => api.post<{ success: boolean }>(`/users/update-popups/${id}/viewed`),
  getById: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: { username?: string; bio?: string }) => api.put(`/users/${id}`, data),
  requestNameChange: (data: { requestedUsername: string; reason?: string }) =>
    api.post<{ request: NameChangeRequest }>('/users/name-change-request', data),
  // Admin warnings (user-facing)
  getPendingWarnings: () => api.get<{ warnings: UserPendingWarning[] }>('/users/warnings/pending'),
  acknowledgeWarning: (id: string) => api.post<{ success: boolean; message: string }>(`/users/warnings/${id}/acknowledge`),
};

export interface UserUpdatePopup {
  id: string;
  title: string;
  summary: string | null;
  message: string;
  imageUrl: string | null;
  type: 'UPDATE' | 'CLAN_PROMPT';
  releaseDate: string;
  createdAt: string;
}

export interface UserPendingWarning {
  id: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  issuedBy: {
    id: string;
    username: string;
  };
}

export interface SocialRelationship {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isConnection: boolean;
}

export interface SocialStats {
  followerCount: number;
  followingCount: number;
  connectionCount: number;
}

export interface SocialUser {
  id: string;
  username: string;
  firstName?: string | null;
  usernameColor?: string | null;
  profilePicture?: string | null;
  profileBanner?: string | null;
  bio?: string | null;
  createdAt: string;
  social?: SocialRelationship & Partial<SocialStats>;
}

// Economy API
export const economyApi = {
  transfer: (data: { receiverId: string; auraAmount?: number; moneyAmount?: number }) =>
    api.post('/economy/transfer', data),
  getTransfers: (params?: { userId?: string; limit?: number; offset?: number; all?: boolean }) =>
    api.get('/economy/transfers', { params }),
  getBalance: (userId: string) => api.get(`/economy/balance/${userId}`),
  // Daily aura gift system
  getDailyAllowance: () => api.get('/economy/daily-allowance'),
  giftAura: (data: { receiverId: string; amount: number; message?: string }) =>
    api.post('/economy/gift-aura', data),
};

export interface ShopCategory {
  id: string;
  label: string;
}

// Marketplace API
export const marketplaceApi = {
  getCategories: () => api.get<{ categories: ShopCategory[] }>('/marketplace/categories'),
  getItems: (params?: { type?: string; page?: number; limit?: number }) =>
    api.get('/marketplace/items', { params }),
  purchase: (data: { itemId: string; quantity?: number }) =>
    api.post('/marketplace/purchase', data),
  getInventory: (userId: string) => api.get(`/marketplace/inventory/${userId}`),
  useItem: (userItemId: string, effectData?: { color?: string; imageUrl?: string; name?: string; description?: string; icon?: string; backgroundColor?: string; borderColor?: string; rarity?: string }) =>
    api.post('/marketplace/use-item', { userItemId, effectData }),
  sellGiftItem: (userItemId: string) =>
    api.post<{ success: boolean; moneyEarned: number }>('/marketplace/sell-gift-item', { userItemId }),
  chuckGiftItem: (userItemId: string) =>
    api.post<{ success: boolean }>('/marketplace/chuck-gift-item', { userItemId }),
  getDoodleSkins: () =>
    api.get<{ static: ShopItem[]; rotating: ShopItem[]; nextRefresh: string }>('/marketplace/doodle-skins'),
  // Admin
  createItem: (data: {
    name: string;
    description: string;
    type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE' | 'GIFT';
    price: number;
    imageUrl?: string;
    effect?: string;
    expiresAt?: string;
  }) => api.post('/marketplace/admin/item', data),
};

// Games API
export const gamesApi = {
  getStats: (gameType: string, userId: string) =>
    api.get(`/games/${gameType}/stats/${userId}`),
  getCatalogStats: () =>
    api.get<{ global: Record<string, number>; personal: Record<string, number> }>('/games/catalog/stats'),
  complete: (gameType: string, data: { score: number; won: boolean; duration?: number; bet?: number; netGain?: number; maxTile?: number; difficulty?: string }) =>
    api.post(`/games/${gameType}/complete`, data),
  getLeaderboard: (gameType: string, limit?: number) =>
    api.get(`/games/${gameType}/leaderboard`, { params: { limit } }),
  getGoyaveActiveLeaderboard: (limit?: number) =>
    api.get('/games/goyave_empire/active-leaderboard', { params: { limit } }),
  getDailyRacerState: (limit?: number) =>
    api.get<DailyRacerStateResponse>('/games/daily/racer', { params: { limit } }),
  submitDailyRacerRun: (lapTimeMs: number) =>
    api.post<DailyRacerSubmitResponse>('/games/daily/racer/complete', { lapTimeMs }),
  // Admin: Delete a user's game stats
  deleteStats: (gameType: string, userId: string) =>
    api.delete(`/games/${gameType}/stats/${userId}`),
  // Goyave Empire: DB-backed save state
  loadGoyaveSave: () =>
    api.get<{ saveData: string | null }>('/games/goyave_empire/save'),
  saveGoyaveState: (saveData: string) =>
    api.post('/games/goyave_empire/save', { saveData }),
};

// Polytrack API
export interface PolytrackHolder {
  userId: string;
  username: string;
  usernameColor: string | null;
  profilePicture: string | null;
}

export interface PolytrackTrack {
  number: number;
  name: string;
  globalRecord: { timeMs: number; timeDisplay: string; holder: PolytrackHolder | null } | null;
  personalBest: { timeMs: number; timeDisplay: string } | null;
}

export interface PolytrackLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  usernameColor: string | null;
  profilePicture: string | null;
  timeMs: number;
  timeDisplay: string;
  createdAt: string;
}

export const polytrackApi = {
  getTracks: () =>
    api.get<{ tracks: PolytrackTrack[] }>('/polytrack/tracks'),
  submitRecord: (trackNumber: number, timeMs: number) =>
    api.post<{ saved: boolean; isGlobalRecord: boolean; isNewPB: boolean; personalBest: { timeMs: number; timeDisplay: string } }>('/polytrack/records', { trackNumber, timeMs }),
  getLeaderboard: (trackNumber: number, limit?: number) =>
    api.get<{ trackNumber: number; rankings: PolytrackLeaderboardEntry[]; userRank: { rank: number; timeMs: number; timeDisplay: string } | null }>(`/polytrack/leaderboard/${trackNumber}`, { params: { limit } }),
};

export interface ClashPlayerSummary {
  id: string;
  username: string;
  usernameColor: string | null;
  profilePicture: string | null;
}

export interface ClashBuilding {
  id: string;
  type: 'townHall' | 'goldStorage' | 'vault' | 'cannon' | 'wall';
  level: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  storageCapacity?: number;
  defensePower?: number;
  protectionPct?: number;
}

export interface ClashTroop {
  type: 'barbarian' | 'archer' | 'giant';
  count: number;
}

export interface ClashVillageState {
  id: string;
  townHallLevel: number;
  moneyInStorage: number;
  trophies: number;
  shieldUntil: string | null;
  attackCooldownUntil: string | null;
  storageCapacity: number;
  defenseRating: number;
  vaultProtectionPct: number;
  layout: Array<{
    id: string;
    type: ClashBuilding['type'];
    x: number;
    y: number;
  }>;
  buildings: ClashBuilding[];
  troops: ClashTroop[];
  user: ClashPlayerSummary | null;
}

export interface ClashActivity {
  id: string;
  villageId: string;
  type: string;
  title: string;
  detail: string;
  deltaMoney: number;
  deltaTrophies: number;
  relatedUserId: string | null;
  createdAt: string;
}

export interface ClashBattleEntry {
  id: string;
  createdAt: string;
  opponent: ClashPlayerSummary;
  destructionPercent: number;
  moneyStolen: number;
  trophiesDelta: number;
  result: Record<string, unknown>;
}

export interface ClashStateResponse {
  village: ClashVillageState;
  activities: ClashActivity[];
  recentAttacks: ClashBattleEntry[];
  recentDefenses: ClashBattleEntry[];
}

export interface ClashTarget {
  user: ClashPlayerSummary | null;
  village: ClashVillageState;
  availableLoot: number;
}

export interface ClashLeaderboardEntry {
  rank: number;
  user: ClashPlayerSummary | null;
  trophies?: number;
  moneyInStorage?: number;
  townHallLevel?: number;
  totalLoot?: number;
  averageDefense?: number | null;
  defenseCount?: number;
}

export const clashApi = {
  getState: () => api.get<ClashStateResponse>('/clash/state'),
  bootstrap: () => api.post<ClashStateResponse>('/clash/bootstrap'),
  upgrade: (buildingType: ClashBuilding['type']) =>
    api.post<ClashStateResponse & { upgrade: { buildingType: ClashBuilding['type']; cost: number; newBalance: { money: number } } }>('/clash/upgrade', { buildingType }),
  getMatchmaking: () => api.get<{ targets: ClashTarget[] }>('/clash/matchmaking'),
  attack: (defenderUserId: string, attackPlan?: Array<{ troopType: ClashTroop['type']; count: number }>) =>
    api.post<ClashStateResponse & {
      attack: {
        id: string;
        createdAt: string;
        defender: ClashVillageState | null;
        destructionPercent: number;
        moneyStolen: number;
        trophiesDeltaAttacker: number;
        trophiesDeltaDefender: number;
        result: Record<string, unknown>;
      };
    }>('/clash/attack', { defenderUserId, attackPlan }),
  getHistory: () =>
    api.get<{ attacks: ClashBattleEntry[]; defenses: ClashBattleEntry[]; activities: ClashActivity[] }>('/clash/history'),
  getLeaderboard: () =>
    api.get<{ trophies: ClashLeaderboardEntry[]; loot: ClashLeaderboardEntry[]; defense: ClashLeaderboardEntry[] }>('/clash/leaderboard'),
};

export interface DailyRacerLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  usernameColor: string | null;
  bestLapTimeMs: number;
  achievedAt: string;
}

export interface DailyRacerStateResponse {
  trackDate: string;
  seed: number;
  leaderboard: DailyRacerLeaderboardEntry[];
  userBestLapTimeMs: number | null;
  userRunCount: number;
}

export interface DailyRacerSubmitResponse {
  success: boolean;
  run: {
    id: string;
    lapTimeMs: number;
    trackDate: string;
    createdAt: string;
  };
  rewards: {
    money: number;
    aura: number;
    isFirstRunToday: boolean;
    isNewDailyBest: boolean;
  };
  isNewDailyBest: boolean;
  bestLapTimeMs: number;
}

// AuraCoin API
export interface AuraCoinPriceHistory {
  price: number;
  volume: number;
  createdAt: string;
}

export interface AuraCoinTransaction {
  id: string;
  userId: string;
  type: 'BUY' | 'SELL';
  coinAmount: number;
  moneyAmount: number;
  price: number;
  fee: number;
  createdAt: string;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
  };
}

export interface AuraCoinLeaderboardEntry {
  id: string;
  username: string;
  usernameColor: string | null;
  auraCoinBalance: number;
}

export const auraCoinApi = {
  getPrice: (hours?: number) =>
    api.get<{
      currentPrice: number;
      feePercentage: number;
      history: AuraCoinPriceHistory[];
      userBalance: { auraCoin: number; money: number };
    }>('/auracoin/price', { params: { hours } }),
  getLeaderboard: (limit?: number) =>
    api.get<{ leaderboard: AuraCoinLeaderboardEntry[] }>('/auracoin/leaderboard', { params: { limit } }),
  buy: (moneyAmount: number) =>
    api.post<{
      success: boolean;
      transaction: {
        type: 'BUY';
        coinsReceived: number;
        moneySpent: number;
        fee: number;
        newPrice: number;
      };
      newBalance: { money: number; auraCoin: number };
    }>('/auracoin/buy', { moneyAmount }),
  sell: (coinAmount: number) =>
    api.post<{
      success: boolean;
      transaction: {
        type: 'SELL';
        coinsSold: number;
        moneyReceived: number;
        fee: number;
        newPrice: number;
      };
      newBalance: { money: number; auraCoin: number };
    }>('/auracoin/sell', { coinAmount }),
  getMyTransactions: (params?: { limit?: number; offset?: number }) =>
    api.get<{ transactions: AuraCoinTransaction[] }>('/auracoin/transactions/me', { params }),
  getAllTransactions: (params?: { limit?: number; offset?: number }) =>
    api.get<{ transactions: AuraCoinTransaction[] }>('/auracoin/transactions/all', { params }),
  openPosition: (type: 'LONG' | 'SHORT', leverage: number, marginAmount: number) =>
    api.post<{
      success: boolean;
      position: {
        id: string;
        type: string;
        leverage: number;
        entryPrice: number;
        coinAmount: number;
        marginAmount: number;
        createdAt: string;
      };
      newBalance: { money: number };
    }>('/auracoin/position/open', { type, leverage, marginAmount }),
  closePosition: (positionId: string) =>
    api.post<{
      success: boolean;
      position: {
        id: string;
        pnl: number;
        exitPrice: number;
        closedAt: string;
      };
      newBalance: { money: number };
    }>(`/auracoin/position/close/${positionId}`),
  getOpenPositions: () =>
    api.get<{
      positions: Array<{
        id: string;
        type: string;
        leverage: number;
        entryPrice: number;
        coinAmount: number;
        marginAmount: number;
        currentPrice: number;
        pnl: number;
        currentMargin: number;
        marginRatio: number;
        pnlPercentage: number;
        createdAt: string;
      }>;
    }>('/auracoin/positions/open'),
  getClosedPositions: (params?: { limit?: number; offset?: number }) =>
    api.get<{
      positions: Array<{
        id: string;
        type: string;
        leverage: number;
        entryPrice: number;
        exitPrice: number | null;
        coinAmount: number;
        marginAmount: number;
        pnl: number | null;
        liquidated: boolean;
        createdAt: string;
        closedAt: string | null;
      }>;
    }>('/auracoin/positions/closed', { params }),
};

export interface AuraCoinPosition {
  id: string;
  type: 'LONG' | 'SHORT';
  leverage: number;
  entryPrice: number;
  coinAmount: number;
  marginAmount: number;
  currentPrice?: number;
  pnl?: number;
  currentMargin?: number;
  marginRatio?: number;
  pnlPercentage?: number;
  isOpen: boolean;
  liquidated: boolean;
  createdAt: string;
  closedAt?: string | null;
  exitPrice?: number | null;
}

// Leaderboards API
export const leaderboardsApi = {
  get: (category: string, params?: { limit?: number; offset?: number; seasonId?: string; period?: 'daily' | 'weekly' | 'monthly' }) =>
    api.get(`/leaderboards/${category}`, { params }),
  getUserRankings: (userId: string) => api.get(`/leaderboards/user/${userId}`),
};

// Clans API
export interface ClanSummary {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  banner: string | null;
  isPublic: boolean;
  createdAt: string;
  maxMembers: number;
  memberCount: number;
  totalAura: number | string;
  leader: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
  };
  tagUnlocked: boolean;
  tagText: string | null;
  tagStyle: string | null;
  slotUpgraded: boolean;
  clanBankMoney: number;
  level: number;
}

export interface ClanMember {
  id: string;
  userId: string;
  username: string;
  usernameColor: string | null;
  aura: number | string;
  profilePicture: string | null;
  joinedAt: string;
  isLeader: boolean;
}

export interface ClanJoinRequest {
  id: string;
  userId: string;
  username: string;
  usernameColor: string | null;
  aura: number | string;
  profilePicture: string | null;
  requestedAt: string;
}

export interface ClanDetail extends ClanSummary {
  members: ClanMember[];
  joinRequests: ClanJoinRequest[];
  viewer: {
    isMember: boolean;
    isLeader: boolean;
    hasPendingRequest: boolean;
  };
  ownedItems: ClanOwnedItem[];
  activeEffects: ClanActiveEffect[];
  warHub: ClanWarHub;
}

export interface ClanOwnedItem {
  id: string;
  quantity: number;
  acquiredAt: string;
  item: ShopItem;
}

export interface ClanActiveEffect {
  id: string;
  type: string;
  name: string;
  description: string | null;
  value: number;
  durationHours: number;
  cooldownHours: number;
  activatedAt: string | null;
  activeUntil: string | null;
  cooldownUntil: string | null;
  isActive: boolean;
  isOnCooldown: boolean;
}

export interface ClanChatMessage {
  id: string;
  message: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
  };
}

export interface ClanPumpUpMessage {
  id: string;
  content: string;
  color: string;
  createdAt: string;
}

export interface ClanWarActionType {
  type: 'RAID' | 'SIEGE' | 'SABOTAGE';
  label: string;
  description: string;
  staminaCost: number;
  minPoints: number;
  maxPoints: number;
  structureDamage: number;
}

export interface ClanWarDefenseType {
  type: 'FORTRESS' | 'ARMORY' | 'BANNER';
  label: string;
  description: string;
  baseDurability: number;
  durabilityPerLevel: number;
  maxLevel: number;
}

export interface ClanWarDefenseState {
  type: ClanWarDefenseType['type'];
  label: string;
  description: string;
  level: number;
  durability: number;
  maxDurability: number;
  isActive: boolean;
  contributions: number;
}

export interface ClanWarAttackLog {
  id: string;
  attackType: ClanWarActionType['type'];
  attackLabel: string;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
  };
  attackingClan: {
    id: string;
    name: string;
  };
  targetClan: {
    id: string;
    name: string;
  };
  staminaCost: number;
  basePoints: number;
  bonusPoints: number;
  defenseMitigation: number;
  structureDamage: number;
  finalPoints: number;
  createdAt: string;
}

export interface ClanWarFortificationLog {
  id: string;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
  };
  clanId: string;
  defenseType: ClanWarDefenseType['type'];
  defenseLabel: string;
  levelAdded: number;
  durabilityAdded: number;
  createdAt: string;
}

export interface ClanWarState {
  id: string;
  status: 'PREPARING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startsAt: string;
  endsAt: string;
  completedAt: string | null;
  targetScore: number;
  attackerScore: number;
  defenderScore: number;
  scoreGap: number;
  viewerSide: 'ATTACKER' | 'DEFENDER' | 'SPECTATOR';
  viewerScore: number;
  opponentScore: number;
  attackerClan: ClanSummary;
  defenderClan: ClanSummary;
  winnerClan: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
  winnerUser: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
  } | null;
  rewardTable: {
    winner: {
      money: number;
      aura: number;
    };
    loser: {
      money: number;
      aura: number;
    };
  };
  defenses: {
    attacker: ClanWarDefenseState[];
    defender: ClanWarDefenseState[];
  };
  viewerActions: {
    staminaCap: number;
    staminaUsed: number;
    staminaRemaining: number;
    fortificationsCap: number;
    fortificationsUsed: number;
    fortificationsRemaining: number;
  };
  recentAttacks: ClanWarAttackLog[];
  recentFortifications: ClanWarFortificationLog[];
}

export interface ClanWarHub {
  currentWar: ClanWarState | null;
  history: ClanWarState[];
  eligibleOpponents: ClanSummary[];
  cooldownEndsAt: string | null;
  canDeclareWar: boolean;
  minimumMembersRequired: number;
  attackTypes: ClanWarActionType[];
  defenseTypes: ClanWarDefenseType[];
}

export interface ClansListResponse {
  clans: ClanSummary[];
  meta: {
    viewerClanId: string | null;
    viewerIsClanLeader: boolean;
    activeWars: ClanWarState[];
  };
}

export interface ClanWarNavalShot {
  x: number;
  y: number;
  isHit: boolean;
  building: string | null;
  points: number;
  isOwnShot: boolean;
}

export interface ClanWarGamesStatus {
  war: null | { id: string };
  warStatus: 'PREPARING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  warId: string;
  memoryPlayedToday: boolean;
  bombPlayedToday: boolean;
  canPlayMemory: boolean;
  canPlayBomb: boolean;
  naval: {
    boardId: string | null;
    shotsUsed: number;
    shotsRemaining: number;
    shots: ClanWarNavalShot[];
  } | null;
}

export const clansApi = {
  list: () => api.get<ClansListResponse>('/clans'),
  myStatus: () => api.get<{ inClan: boolean; isLeader?: boolean; tagUnlocked: boolean; slotUpgraded: boolean; clanBankMoney: number; level: number }>('/clans/me/status'),
  getById: (id: string) => api.get<{ clan: ClanDetail }>(`/clans/${id}`),
  getGlobalWarHistory: () => api.get<{ wars: ClanWarState[] }>('/clans/wars/history'),
  getChat: (id: string, limit = 50) => api.get<{ messages: ClanChatMessage[] }>(`/clans/${id}/chat`, { params: { limit } }),
  sendMessage: (id: string, message: string) =>
    api.post<{ message: ClanChatMessage }>(`/clans/${id}/chat`, { message }),
  create: (data: { name: string; description?: string; imageUrl?: string; isPublic?: boolean }) =>
    api.post<{ clan: ClanSummary }>('/clans', data),
  join: (id: string) => api.post<{ status: 'joined' | 'requested'; requestId?: string }>(`/clans/${id}/join`),
  declareWar: (clanId: string, targetClanId: string) =>
    api.post<{ war: ClanWarState }>(`/clans/${clanId}/war/declare`, { targetClanId }),
  fortifyWar: (clanId: string, defenseType: ClanWarDefenseType['type']) =>
    api.post<{ war: ClanWarState | null }>(`/clans/${clanId}/war/fortify`, { defenseType }),
  attackWar: (clanId: string, attackType: ClanWarActionType['type']) =>
    api.post<{ war: ClanWarState | null; completed: boolean }>(`/clans/${clanId}/war/attack`, { attackType }),
  leave: (id: string) => api.delete(`/clans/${id}/leave`),
  acceptRequest: (clanId: string, requestId: string) =>
    api.post(`/clans/${clanId}/requests/${requestId}/accept`),
  rejectRequest: (clanId: string, requestId: string) =>
    api.post(`/clans/${clanId}/requests/${requestId}/reject`),
  promoteMember: (clanId: string, userId: string) =>
    api.post(`/clans/${clanId}/members/${userId}/promote`),
  demoteMember: (clanId: string, userId: string) =>
    api.post(`/clans/${clanId}/members/${userId}/demote`),
  transferLeadership: (clanId: string, userId: string) =>
    api.post(`/clans/${clanId}/members/${userId}/transfer-leadership`),
  removeMember: (clanId: string, userId: string) =>
    api.delete(`/clans/${clanId}/members/${userId}`),
  depositToBank: (clanId: string, amount: number) =>
    api.post<{ success: boolean; deposited: number; clanBankMoney: number; newBalance: { aura: number | string; money: number } }>(`/clans/${clanId}/bank/deposit`, { amount }),
  updateImage: (id: string, imageUrl: string | null) =>
    api.put<{ success: boolean; imageUrl: string | null }>(`/clans/${id}/image`, { imageUrl }),
  updateTag: (id: string, data: { tagText?: string; tagStyle?: object }) =>
    api.put<{ success: boolean; tagText: string | null; tagStyle: string | null }>(`/clans/${id}/tag`, data),
  useOwnedItem: (clanId: string, clanItemId: string, effectData?: { imageUrl?: string }) =>
    api.post<{ success: boolean; effect: ClanActiveEffect }>(`/clans/${clanId}/items/${clanItemId}/use`, effectData ?? {}),
  // War mini-games
  getWarGamesStatus: (clanId: string) =>
    api.get<ClanWarGamesStatus>(`/clans/${clanId}/war/games/status`),
  submitMemoryGame: (clanId: string, data: { matchedPairs: Record<string, number>; score: number; isPractice: boolean }) =>
    api.post<{ success: boolean; isPractice: boolean }>(`/clans/${clanId}/war/games/memory`, data),
  submitBombGame: (clanId: string, data: { score: number; hits: number; isPractice: boolean }) =>
    api.post<{ success: boolean; isPractice: boolean; finalPoints: number }>(`/clans/${clanId}/war/games/bomb`, data),
  navalShot: (clanId: string, data: { x: number; y: number }) =>
    api.post<{ isHit: boolean; building: string | null; points: number; x: number; y: number }>(`/clans/${clanId}/war/games/naval/shot`, data),
  // Pump-up messages
  getPumpUpMessages: (clanId: string) =>
    api.get<{ messages: ClanPumpUpMessage[] }>(`/clans/${clanId}/pump-up`),
  createPumpUpMessage: (clanId: string, data: { content: string; color: string }) =>
    api.post<{ message: ClanPumpUpMessage }>(`/clans/${clanId}/pump-up`, data),
  updatePumpUpMessage: (clanId: string, msgId: string, data: { content?: string; color?: string }) =>
    api.put<{ message: ClanPumpUpMessage }>(`/clans/${clanId}/pump-up/${msgId}`, data),
  deletePumpUpMessage: (clanId: string, msgId: string) =>
    api.delete(`/clans/${clanId}/pump-up/${msgId}`),
};

// Admin API
export interface AdminUser {
  id: string;
  username: string;
  firstName: string | null;
  email: string;
  aura: number;
  money: number;
  auraCoinBalance: number;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isChatMuted: boolean;
  dailyAuraGiven: number;
  dailyAuraLimit: number;
  lastDailyReset: string;
  schoolLevel: string | null;
  classLetter: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUpdatePopup {
  id: string;
  title: string;
  summary: string | null;
  message: string;
  imageUrl: string | null;
  type: 'UPDATE' | 'CLAN_PROMPT';
  audience: 'ALL' | 'NO_CLAN' | 'SELECTED_USERS';
  targetUserIds: string[];
  releaseDate: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    username: string;
  };
  _count: {
    views: number;
  };
}

export interface AdminClanMember {
  id: string;
  userId: string;
  isLeader: boolean;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
    aura: number | string;
  };
}

export interface AdminClan {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isPublic: boolean;
  maxMembers: number;
  clanBankMoney: number;
  level: number;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    username: string;
    usernameColor: string | null;
    profilePicture: string | null;
    aura: number | string;
  };
  members: AdminClanMember[];
  activeWar: {
    id: string;
    status: 'PREPARING' | 'ACTIVE';
    startsAt: string;
    endsAt: string;
  } | null;
}


// Pending User Interface
export interface PendingUser {
  id: string;
  username: string;
  firstName: string | null;
  schoolLevel: 'SECONDE' | 'PREMIERE' | 'TERMINALE' | null;
  classLetter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null;
  email: string;
  motivationMessage: string | null;
  createdAt: string;
}

export interface RegistrationReview {
  id: string;
  registrationUserId: string;
  username: string;
  firstName: string | null;
  schoolLevel: 'SECONDE' | 'PREMIERE' | 'TERMINALE' | null;
  classLetter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null;
  email: string;
  motivationMessage: string | null;
  registrationCreatedAt: string;
  status: 'APPROVED' | 'REJECTED';
  reviewedAt: string;
  reviewedById: string | null;
  importedFromLegacy: boolean;
  createdAt: string;
  updatedAt: string;
}

// Shop Item Interface
export interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE' | 'GIFT';
  price: number;
  imageUrl: string | null;
  effect: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface AdminInventoryItem {
  id: string;
  quantity: number;
  acquiredAt: string;
  item: ShopItem;
}

// Bug Report Interface
export interface BugReport {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: 'PENDING' | 'DONE';
  adminReply: string | null;
  createdAt: string;
  resolvedAt: string | null;
  user: {
    id: string;
    username: string;
  };
}

export interface Ban {
  id: string;
  userId: string;
  bannedBy: string;
  reason: string;
  type: 'TEMPORARY' | 'PERMANENT';
  expiresAt: string | null;
  createdAt: string;
  isActive: boolean;
  user: {
    id: string;
    username: string;
    email: string;
  };
  admin: {
    id: string;
    username: string;
  };
}

export interface AdminWarning {
  id: string;
  userId: string;
  issuedById: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
  issuedBy: {
    id: string;
    username: string;
  };
}

// Suggestions API
export interface SuggestionComment {
  id: string;
  suggestionId: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
  };
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  status: 'PENDING' | 'DONE';
  createdAt: string;
  resolvedAt: string | null;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
  };
  upvotes: number;
  downvotes: number;
  score: number;
  boostedScore?: number;
  boost?: number;
  userVote: number;
  averageRating: number | null;
  ratingCount: number;
  userRating: number | null;
  comments: SuggestionComment[];
}

export const suggestionsApi = {
  getAll: () => api.get<{ suggestions: Suggestion[] }>('/suggestions'),
  create: (data: { title: string; description: string; imageUrl?: string }) =>
    api.post<{ suggestion: Suggestion }>('/suggestions', data),
  vote: (id: string, value: number) =>
    api.post<{ upvotes: number; downvotes: number; score: number; userVote: number }>(
      `/suggestions/${id}/vote`,
      { value }
    ),
  updateStatus: (id: string, status: 'PENDING' | 'DONE') =>
    api.patch<{
      status: 'PENDING' | 'DONE';
      resolvedAt: string | null;
      averageRating: number | null;
      ratingCount: number;
      userRating: number | null;
    }>(`/suggestions/${id}/status`, { status }),
  rate: (id: string, rating: number) =>
    api.post<{ averageRating: number | null; ratingCount: number; userRating: number | null }>(
      `/suggestions/${id}/rating`,
      { rating }
    ),
  delete: (id: string) => api.delete<{ success: boolean }>(`/suggestions/${id}`),
  addComment: (id: string, data: { content: string }) =>
    api.post<{ comment: SuggestionComment }>(`/suggestions/${id}/comments`, data),
  deleteComment: (id: string, commentId: string) =>
    api.delete<{ success: boolean }>(`/suggestions/${id}/comments/${commentId}`),
};

// Log Interface
export interface ActivityLog {
  id: string;
  type: 'AUTH' | 'CHAT' | 'GAME' | 'ECONOMY' | 'PARTY' | 'SUGGESTION' | 'MARKETPLACE' | 'ADMIN' | 'BAN' | 'AURACOIN';
  action: string;
  userId: string | null;
  username: string | null;
  targetId: string | null;
  targetName: string | null;
  details: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface LogStats {
  total: number;
  byType: Record<string, number>;
}

export interface AdminActivityBreakdown {
  date: string;
  pageSeries: Array<{
    hour: number;
    hourLabel: string;
    total: number;
    values: Record<string, number>;
  }>;
  topPages: Array<{
    page: string;
    total: number;
  }>;
  gameSeries: Array<{
    hour: number;
    hourLabel: string;
    total: number;
    values: Record<string, number>;
  }>;
  topGames: Array<{
    gameType: string;
    total: number;
  }>;
  gameDurationSeries: Array<{
    hour: number;
    hourLabel: string;
    total: number;
    values: Record<string, number>;
  }>;
  topGameDurations: Array<{
    gameType: string;
    totalSeconds: number;
  }>;
}

export interface OnlineHistoryInsightPeakHour {
  hour: number;
  label: string;
  averageOnline: number;
  peakOnline: number;
  sampleCount: number;
}

export interface OnlineHistoryInsights {
  uniqueConnectedUsers: number;
  busiestWeekday: {
    day: number;
    label: string;
    totalGames: number;
    uniquePlayers: number;
  } | null;
  peakHours: OnlineHistoryInsightPeakHour[];
}

type AdminRareAction =
  | { action: 'chat_clear' }
  | { action: 'deploy' }
  | { action: 'reset_extreme_aura'; threshold?: number };

const runRareAction = (data: AdminRareAction) => api.post('/admin/rare', data);

export const adminApi = {
  runRareAction,
  getUsers: () => api.get<{ users: AdminUser[] }>('/admin/users'),
  getClans: () => api.get<{ clans: AdminClan[] }>('/admin/clans'),
  updateClan: (id: string, data: { name?: string; description?: string; imageUrl?: string; isPublic?: boolean; maxMembers?: number }) =>
    api.put<{ clan: AdminClan }>(`/admin/clans/${id}`, data),
  transferClanLeadership: (id: string, targetUserId: string) =>
    api.post<{ success: boolean }>(`/admin/clans/${id}/transfer-leadership`, { targetUserId }),
  deleteClan: (id: string) => api.delete<{ success: boolean }>(`/admin/clans/${id}`),
  updateUser: (id: string, data: { username?: string; firstName?: string | null; aura?: number; money?: number; auraCoinBalance?: number; dailyAuraLimit?: number; password?: string; isChatMuted?: boolean; role?: 'USER' | 'ADMIN' | 'SUPER_ADMIN' }) =>
    api.put<{ user: AdminUser }>(`/admin/users/${id}`, data),
  deleteUser: (id: string) => api.delete<{ success: boolean; message: string }>(`/admin/users/${id}`),
  getUserInventory: (id: string) =>
    api.get<{ items: AdminInventoryItem[] }>(`/admin/users/${id}/inventory`),
  addUserInventoryItem: (id: string, data: { itemId: string; quantity?: number }) =>
    api.post<{ item: AdminInventoryItem }>(`/admin/users/${id}/inventory`, data),
  updateUserInventoryItem: (id: string, userItemId: string, data: { quantity: number }) =>
    api.patch<{ item?: AdminInventoryItem; removed?: boolean }>(`/admin/users/${id}/inventory/${userItemId}`, data),
  deleteUserInventoryItem: (id: string, userItemId: string) =>
    api.delete<{ success: boolean }>(`/admin/users/${id}/inventory/${userItemId}`),
  clearChat: () =>
    runRareAction({ action: 'chat_clear' }) as Promise<{ data: { success: boolean; message: string; messagesDeleted: number } }>,
  // Pending users management
  getPendingUsers: () => api.get<{ pendingUsers: PendingUser[] }>('/admin/pending-users'),
  getRegistrationReviews: () => api.get<{ registrationReviews: RegistrationReview[] }>('/admin/registration-reviews'),
  importRegistrationReviews: (entries: Array<PendingUser & { registrationStatus: 'APPROVED' | 'REJECTED' }>) =>
    api.post<{ success: boolean; importedCount: number; registrationReviews: RegistrationReview[] }>('/admin/registration-reviews/import-local', { entries }),
  approveUser: (id: string) => api.post<{ success: boolean; user: PendingUser; message: string }>(`/admin/users/${id}/approve`),
  rejectUser: (id: string) => api.post<{ success: boolean; message: string }>(`/admin/users/${id}/reject`),
  // Items management
  getItems: () => api.get<{ items: ShopItem[] }>('/admin/items'),
  createItem: (data: {
    name: string;
    description: string;
    type: string;
    price: number;
    imageUrl?: string;
    effect?: string;
  }) => api.post<{ item: ShopItem }>('/admin/items', data),
  updateItem: (id: string, data: {
    name: string;
    description: string;
    type: string;
    price: number;
    imageUrl?: string;
    effect?: string;
  }) => api.put<{ item: ShopItem }>(`/admin/items/${id}`, data),
  deleteItem: (id: string) => api.delete<{ success: boolean }>(`/admin/items/${id}`),
  // Doodle Jump skin rotation control
  getDjForcedSkin: () => api.get<{ itemId: string | null }>('/marketplace/admin/dj-forced-skin'),
  setDjForcedSkin: (itemId: string | null) =>
    api.post<{ success: boolean; itemId: string | null }>('/marketplace/admin/dj-force-skin', { itemId }),
  // Shop categories management
  getShopCategories: () => api.get<{ categories: ShopCategory[] }>('/admin/shop-categories'),
  updateShopCategories: (categories: ShopCategory[]) =>
    api.put<{ categories: ShopCategory[] }>('/admin/shop-categories', { categories }),
  // Bug reports management
  getBugReports: () => api.get<{ bugReports: BugReport[] }>('/admin/bugs'),
  updateBugReport: (id: string, data: { status: 'PENDING' | 'DONE'; adminReply?: string }) =>
    api.put<{ bugReport: BugReport }>(`/admin/bugs/${id}`, data),
  deleteBugReport: (id: string) => api.delete<{ success: boolean }>(`/admin/bugs/${id}`),
  // Ban management
  getBans: () => api.get<{ bans: Ban[] }>('/admin/bans'),
  createBan: (data: { userId: string; reason: string; type: 'TEMPORARY' | 'PERMANENT'; durationHours?: number }) =>
    api.post<{ ban: Ban; message: string }>('/admin/bans', data),
  unbanUser: (userId: string) => api.delete<{ success: boolean; message: string }>(`/admin/bans/${userId}`),
  // Activity logs
  getLogs: (params?: {
    type?: string;
    action?: string;
    username?: string;
    gameType?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }) => api.get<{ logs: ActivityLog[]; total: number }>('/admin/logs', { params }),
  downloadLogs: (params: {
    startDate?: string;
    endDate?: string;
    type?: string;
    action?: string;
    username?: string;
    gameType?: string;
  }) => api.get<Blob>('/admin/logs/download', { params, responseType: 'blob' }),
  getLogStats: () => api.get<LogStats>('/admin/logs/stats'),
  getActivityBreakdown: (date: string) =>
    api.get<AdminActivityBreakdown>('/admin/activity-breakdown', { params: { date } }),
  // Game settings management
  getSettings: () => api.get<{ settings: Record<string, string> }>('/admin/settings'),
  updateSettings: (settings: Record<string, string | number>) =>
    api.put<{ settings: Record<string, string> }>('/admin/settings', { settings }),
  updateSetting: (key: string, value: string | number) =>
    api.put<{ setting: { key: string; value: string } }>(`/admin/settings/${key}`, { value }),
  getBombPartyLanguages: () =>
    api.get<{ languages: { fileName: string; label: string }[] }>('/admin/bombparty/languages'),
  recalculateBombPartyPrompts: () =>
    api.post<{ result: { languageFile: string; wordCount: number; totalPrompts: number; twoLetterPrompts: number; threeLetterPrompts: number } }>(
      '/admin/bombparty/recalculate-prompts'
    ),
  // Server deployment
  deploy: () =>
    runRareAction({ action: 'deploy' }) as Promise<{ data: { success: boolean; message: string; stdout?: string; stderr?: string } }>,
  // Reset extreme aura values
  resetExtremeAura: (threshold?: number) =>
    runRareAction({ action: 'reset_extreme_aura', threshold }) as Promise<{ data: { success: boolean; message: string; usersReset: number; users: { id: string; username: string; oldAura: string }[] } }>,
  // Gift templates
  getGiftTemplates: () => api.get<{ templates: GiftTemplate[] }>('/admin/gift-templates'),
  createGiftTemplate: (data: { name: string; description?: string; imageUrl?: string; price: number }) =>
    api.post<{ template: GiftTemplate }>('/admin/gift-templates', data),
  updateGiftTemplate: (id: string, data: { name?: string; description?: string; imageUrl?: string; price?: number }) =>
    api.put<{ template: GiftTemplate }>(`/admin/gift-templates/${id}`, data),
  deleteGiftTemplate: (id: string) => api.delete<{ success: boolean }>(`/admin/gift-templates/${id}`),
  // Update popups
  getUpdatePopups: () => api.get<{ popups: AdminUpdatePopup[] }>('/admin/update-popups'),
  createUpdatePopup: (data: {
    title: string;
    summary?: string;
    message: string;
    imageUrl?: string;
    type?: 'UPDATE' | 'CLAN_PROMPT';
    audience?: 'ALL' | 'NO_CLAN' | 'SELECTED_USERS';
    targetUserIds?: string[];
    releaseDate?: string;
    isPublished?: boolean;
  }) => api.post<{ popup: AdminUpdatePopup }>('/admin/update-popups', data),
  updateUpdatePopup: (id: string, data: Partial<{
    title: string;
    summary: string | null;
    message: string;
    imageUrl: string | null;
    type: 'UPDATE' | 'CLAN_PROMPT';
    audience: 'ALL' | 'NO_CLAN' | 'SELECTED_USERS';
    targetUserIds: string[];
    releaseDate: string;
    isPublished: boolean;
  }>) => api.put<{ popup: AdminUpdatePopup }>(`/admin/update-popups/${id}`, data),
  deleteUpdatePopup: (id: string) => api.delete<{ success: boolean }>(`/admin/update-popups/${id}`),
  uploadUpdatePopupImage: (data: { base64Data: string; mimeType: string }) =>
    api.post<{ imageUrl: string }>('/admin/update-popups/upload-image', data),
  uploadItemImage: (data: { base64Data: string; mimeType: string }) =>
    api.post<{ imageUrl: string }>('/admin/items/upload-image', data),
  suggestUpdatePopupSummary: () => api.get<{ suggestion: string; sinceDate: string }>('/admin/update-popups/suggest-summary'),
  // Online activity history
  takeOnlineSnapshot: () => api.post<{ success: boolean; count: number }>('/admin/online-snapshot'),
  getOnlineHistory: (params?: {
    period?: 'day' | 'week' | 'month' | 'custom';
    startDate?: string;
    endDate?: string;
  }) => api.get<{
    data: { timestamp: string; count: number; max: number; usernames: { userId: string; username: string }[] }[];
    peak: number;
    peakAt: string | null;
    insights: OnlineHistoryInsights;
    period: string;
    start: string;
    end: string;
  }>('/admin/online-history', { params }),
  getOnlineStats: () => api.get<{
    current: number;
    allTimeRecord: number;
    allTimeRecordAt: string | null;
    avg1d: number;
    avg7d: number;
    avg30d: number;
    peak1d: number;
    peak7d: number;
    peak30d: number;
  }>('/admin/online-stats'),
  // Ban appeals
  getBanAppeals: () => api.get<{ banAppeals: BanAppeal[] }>('/admin/ban-appeals'),
  reviewBanAppeal: (id: string, data: { action: 'approve' | 'reject' }) =>
    api.put<{ banAppeal: BanAppeal }>(`/admin/ban-appeals/${id}`, data),
  // Name change requests
  getNameChangeRequests: () => api.get<{ nameChangeRequests: NameChangeRequest[] }>('/admin/name-change-requests'),
  reviewNameChangeRequest: (id: string, data: { action: 'approve' | 'reject' }) =>
    api.put<{ nameChangeRequest: NameChangeRequest }>(`/admin/name-change-requests/${id}`, data),
  // Admin warnings
  getWarnings: () => api.get<{ warnings: AdminWarning[] }>('/admin/warnings'),
  createWarning: (data: { userId: string; message: string; severity?: 'LOW' | 'MEDIUM' | 'HIGH' }) =>
    api.post<{ warning: AdminWarning; message: string }>('/admin/warnings', data),
  deleteWarning: (id: string) => api.delete<{ success: boolean; message: string }>(`/admin/warnings/${id}`),
  backfillScoreHistory: () => api.post<{ success: boolean; inserted: number; skipped: number }>('/admin/backfill-score-history'),
};

export const maintenanceApi = {
  getStatus: () => api.get<{
    enabled: boolean;
    message: string;
    pages: string[];
    endDate: string | null;
    blockedPages?: string[];
    blockedMessage?: string;
    loginMessage?: string;
    loginRegisterCtaEnabled?: boolean;
    referralEnabled?: boolean;
    duelMatchmakingEnabled?: boolean;
  }>('/maintenance'),
};

// Bug report API (for regular users)
export const bugReportApi = {
  create: (data: { title: string; description: string }) =>
    api.post<{ bugReport: BugReport }>('/admin/bugs', data),
};

// Ban Appeal Interface
export interface BanAppeal {
  id: string;
  userId: string;
  banId: string;
  message: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  user: { id: string; username: string; email: string };
  ban: { id: string; reason: string; type: string; expiresAt: string | null };
}

// Name Change Request Interface
export interface NameChangeRequest {
  id: string;
  userId: string;
  currentUsername: string;
  requestedUsername: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  user: { id: string; username: string; email: string };
}

// Public API (no auth required)
export const publicApi = {
  submitBanAppeal: (data: { banId: string; userId: string; message: string }) =>
    api.post<{ appeal: BanAppeal }>('/admin/ban-appeals', data),
};

// Bomb Party API
export interface BombPartyStats {
  id: string;
  userId: string;
  wins: number;
  losses: number;
  totalPlayed: number;
  wordsTyped: number;
  longestWord: string | null;
}

export interface BombPartyLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  usernameColor: string | null;
  wins: number;
  losses: number;
  totalPlayed: number;
  wordsTyped: number;
  longestWord: string | null;
}

export const bombPartyApi = {
  getStats: (userId: string) =>
    api.get<BombPartyStats>(`/bombparty/stats/${userId}`),
  getLeaderboard: (limit?: number) =>
    api.get<{ rankings: BombPartyLeaderboardEntry[] }>('/bombparty/leaderboard', { params: { limit } }),
  getPromptStats: () =>
    api.get<{ total: number; easy: number; medium: number; hard: number }>('/bombparty/prompts/stats'),
};

// Polymarket API
export interface PolymarketSuggestion {
  id: string;
  userId: string;
  title: string;
  description: string;
  imageUrl: string | null;
  eventDate: string | null;
  suggestedYesOdds?: number | null;
  suggestedNoOdds?: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  user: {
    id: string;
    username: string;
    usernameColor: string | null;
  };
  event: {
    id: string;
    status: string;
  } | null;
}

export interface PolymarketEvent {
  id: string;
  suggestionId: string | null;
  title: string;
  description: string;
  imageUrl: string | null;
  eventDate: string;
  yesOdds: number;
  noOdds: number;
  status: 'OPEN' | 'CLOSED' | 'RESOLVED';
  resolution: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  closedAt: string | null;
  totalVolume?: number;
  totalYes?: number;
  totalNo?: number;
  betCount?: number;
  suggestion?: PolymarketSuggestion | null;
  bets?: PolymarketBet[];
}

export interface PolymarketBet {
  id: string;
  userId: string;
  eventId: string;
  prediction: 'YES' | 'NO';
  amount: number;
  payout: number | string | null;
  createdAt: string;
  event?: {
    id: string;
    title: string;
    status: string;
    resolution: string | null;
    eventDate: string;
    yesOdds: number;
    noOdds: number;
  };
  user?: {
    id: string;
    username: string;
    usernameColor: string | null;
  };
}


export const polymarketApi = {
  // Suggestions
  getSuggestions: () => api.get<{ suggestions: PolymarketSuggestion[] }>('/polymarket/suggestions'),
  createSuggestion: (data: {
    title: string;
    description: string;
    imageUrl?: string;
    eventDate?: string;
    suggestedYesOdds?: number;
    suggestedNoOdds?: number;
  }) =>
    api.post<{ suggestion: PolymarketSuggestion }>('/polymarket/suggestions', data),
  approveSuggestion: (id: string, data: { yesOdds: number; noOdds: number; eventDate?: string }) =>
    api.post<{ event: PolymarketEvent }>(`/polymarket/suggestions/${id}/approve`, data),
  rejectSuggestion: (id: string) =>
    api.post<{ success: boolean }>(`/polymarket/suggestions/${id}/reject`),
  
  // Events
  getEvents: (status?: string) =>
    api.get<{ events: PolymarketEvent[] }>('/polymarket/events', { params: { status } }),
  getEvent: (id: string) =>
    api.get<{ event: PolymarketEvent }>(`/polymarket/events/${id}`),
  createEvent: (data: {
    title: string;
    description: string;
    imageUrl?: string;
    eventDate: string;
    yesOdds: number;
    noOdds: number;
    suggestionId?: string;
  }) => api.post<{ event: PolymarketEvent }>('/polymarket/events', data),
  updateEvent: (id: string, data: Partial<PolymarketEvent>) =>
    api.patch<{ event: PolymarketEvent }>(`/polymarket/events/${id}`, data),
  resolveEvent: (id: string, resolution: 'YES' | 'NO') =>
    api.post<{ success: boolean; resolution: string }>(`/polymarket/events/${id}/resolve`, { resolution }),
  
  // Bets
  getBets: () => api.get<{ bets: PolymarketBet[] }>('/polymarket/bets'),
  getAllBets: (limit?: number) =>
    api.get<{ bets: PolymarketBet[] }>('/polymarket/bets/all', { params: { limit } }),
  placeBet: (data: { eventId: string; prediction: 'YES' | 'NO'; amount: number }) =>
    api.post<{ bet: PolymarketBet }>('/polymarket/bets', data),
};

// Daily Quests API
export interface DailyQuest {
  id: string;
  questType: string;
  title: string;
  description: string;
  targetValue: number;
  moneyReward: number;
  auraReward: number;
  questDate: string;
  createdAt: string;
}

export interface UserDailyQuest {
  id: string;
  userId: string;
  questId: string;
  questDate: string;
  selectedAt: string;
  isCompleted: boolean;
  completedAt: string | null;
  isClaimed: boolean;
  claimedAt: string | null;
  quest: DailyQuest;
  progress: {
    id: string;
    currentValue: number;
    lastUpdated: string;
  } | null;
}

export const questsApi = {
  getDaily: () => api.get<{ quests: DailyQuest[] }>('/quests/daily'),
  select: (questIds: string[]) =>
    api.post<{ success: boolean; userQuests: UserDailyQuest[] }>('/quests/select', { questIds }),
  getMyQuests: () => api.get<{ userQuests: UserDailyQuest[] }>('/quests/my-quests'),
  claim: (questIds: string[]) =>
    api.post<{
      success: boolean;
      rewards: { money: number; aura: number };
      claimedQuests: number;
    }>('/quests/claim', { questIds }),
};

// Gift types
export interface GiftTemplate {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  createdAt: string;
}

export interface GiftItem {
  id: string;
  giftId: string;
  giftTemplateId: string;
  giftTemplate: GiftTemplate;
}

export interface Gift {
  id: string;
  senderId: string;
  receiverId: string;
  message: string | null;
  moneyAmount: number;
  auraAmount: number;
  giftedItemId: string | null;
  giftedItem: { id: string; name: string; imageUrl: string | null; price: number } | null;
  isOpened: boolean;
  openedAt: string | null;
  createdAt: string;
  sender: { id: string; username: string; profilePicture: string | null };
  items: GiftItem[];
}

export interface GiftStatus {
  limit: number;
  sentLast24h: number;
  remainingAura: number;
  nextRefillAt: string | null;
}

export const giftsApi = {
  getTemplates: () => api.get<{ templates: GiftTemplate[] }>('/gifts/templates'),
  getInbox: () => api.get<{ gifts: Gift[] }>('/gifts/inbox'),
  getInboxCount: () => api.get<{ count: number }>('/gifts/inbox/count'),
  getReceived: () => api.get<{ gifts: Gift[] }>('/gifts/received'),
  getStatus: () => api.get<GiftStatus>('/gifts/status'),
  send: (data: {
    receiverId: string;
    auraAmount: number;
    message?: string;
  }) =>
    api.post<{ gift: Gift }>('/gifts/send', data),
  open: (id: string) => api.post<{ gift: Gift }>(`/gifts/${id}/open`),
  sendShopItem: (data: { itemId: string; receiverId: string; message?: string }) =>
    api.post<{ gift: Gift; newBalance: { money: number; aura: number } }>('/gifts/send-item', data),
};

// ─── Notifications API ────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  link: string | null;
  icon: string | null;
  isRead: boolean;
  readAt: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const notificationsApi = {
  getAll: (params?: { page?: number; limit?: number; unreadOnly?: boolean; archived?: boolean }) =>
    api.get<NotificationsResponse>('/notifications', { params }),
  getUnreadCount: () => api.get<{ count: number }>('/notifications/unread/count'),
  markRead: (id: string) => api.post<{ notification: Notification }>(`/notifications/${id}/read`),
  markAllRead: () => api.post<{ success: boolean }>('/notifications/read-all'),
  archive: (id: string) => api.post<{ notification: Notification }>(`/notifications/${id}/archive`),
  archiveAllRead: () => api.post<{ success: boolean }>('/notifications/archive-all-read'),
  /** Admin only */
  broadcast: (data: { title: string; body: string; link?: string; icon?: string }) =>
    api.post<{ success: boolean; sent: number }>('/notifications/broadcast', data),
};

// Upload an image as any authenticated user (suggestions, clans, profile pictures, polymarket, etc.)
export const uploadUserImage = (data: { base64Data: string; mimeType: string }) =>
  api.post<{ imageUrl: string }>('/uploads/image', data);

// ─── Badges API ───────────────────────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  howToObtain?: string | null;
  backgroundType: string;
  backgroundColor: string;
  backgroundGradient?: string | null;
  backgroundImage?: string | null;
  icon: string;
  iconColor: string;
  borderColor: string;
  category: string;
  rarity: string;
  isAutomatic: boolean;
  autoConditionKey?: string | null;
  isActive: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  createdById?: string | null;
  ownerCount?: number;
}

export interface UserBadgeEntry extends Badge {
  obtainedAt: string;
  obtainedReason?: string | null;
}

export interface UserBadgesResponse {
  equippedBadge1Id: string | null;
  equippedBadge2Id: string | null;
  badges: UserBadgeEntry[];
}

// ─── Support API ──────────────────────────────────────────────────────────────

export interface SupportMessage {
  id: string;
  userId: string;
  body: string;
  fromAdmin: boolean;
  isRead: boolean;
  createdAt: string;
}

export interface SupportThread {
  userId: string;
  user: { id: string; username: string; profilePicture: string | null; usernameColor: string | null } | null;
  lastBody: string;
  lastFromAdmin: boolean;
  lastCreatedAt: string;
  unreadCount: number;
}

export const supportApi = {
  // User
  getMessages: () => api.get<{ messages: SupportMessage[] }>('/support/messages'),
  sendMessage: (body: string) => api.post<{ message: SupportMessage }>('/support/messages', { body }),
  getUnreadCount: () => api.get<{ count: number }>('/support/unread-count'),
  markRead: () => api.post<{ success: boolean }>('/support/messages/read'),
  // Admin
  getThreads: () => api.get<{ threads: SupportThread[] }>('/support/admin/threads'),
  getThread: (userId: string) => api.get<{ messages: SupportMessage[]; user: SupportThread['user'] }>(`/support/admin/threads/${userId}`),
  reply: (userId: string, body: string) => api.post<{ message: SupportMessage }>(`/support/admin/reply/${userId}`, { body }),
  markThreadRead: (userId: string) => api.post<{ success: boolean }>(`/support/admin/threads/${userId}/read`),
};

export const badgesApi = {
  getAll: () => api.get<{ badges: Badge[]; totalUsers: number }>('/badges'),
  getById: (id: string) => api.get<{ badge: Badge }>(`/badges/${id}`),
  getUserBadges: (userId: string) => api.get<UserBadgesResponse>(`/badges/user/${userId}`),
  equip: (slot: 1 | 2, badgeId: string | null) =>
    api.post<{ success: boolean }>('/badges/equip', { slot, badgeId }),
  // Admin
  create: (data: Partial<Badge>) => api.post<{ badge: Badge }>('/badges', data),
  update: (id: string, data: Partial<Badge>) => api.put<{ badge: Badge }>(`/badges/${id}`, data),
  delete: (id: string) => api.delete<{ success: boolean }>(`/badges/${id}`),
  award: (data: { userId: string; badgeId: string; reason?: string }) =>
    api.post<{ success: boolean; alreadyOwned: boolean }>('/badges/award', data),
  revoke: (userId: string, badgeId: string) =>
    api.delete<{ success: boolean }>(`/badges/revoke/${userId}/${badgeId}`),
  getAllUsersAdmin: () => api.get<{ users: Array<{ id: string; username: string; equippedBadge1Id: string | null; equippedBadge2Id: string | null; badges: UserBadgeEntry[] }> }>('/badges/admin/all-users'),
  checkAuto: () => api.post<{ success: boolean; message: string }>('/badges/check-auto'),
};

export interface CustomBadgeRequest {
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  name: string;
  description: string;
  icon: string;
  backgroundColor: string;
  borderColor: string;
  rarity: string;
  adminNote?: string | null;
  badgeId?: string | null;
  badge?: Partial<Badge> | null;
  user?: { id: string; username: string };
  createdAt: string;
  updatedAt: string;
}

export const customBadgesApi = {
  submit: (data: {
    name: string;
    description: string;
    icon: string;
    backgroundColor: string;
    borderColor: string;
    rarity: string;
  }) => api.post<{ request: CustomBadgeRequest }>('/custom-badges', data),
  getMy: () => api.get<{ requests: CustomBadgeRequest[] }>('/custom-badges/my'),
  // Admin
  getPending: () => api.get<{ requests: CustomBadgeRequest[] }>('/custom-badges/pending'),
  approve: (id: string, adminNote?: string) =>
    api.post<{ success: boolean; badge: Badge }>(`/custom-badges/${id}/approve`, { adminNote }),
  reject: (id: string, adminNote?: string) =>
    api.post<{ success: boolean }>(`/custom-badges/${id}/reject`, { adminNote }),
};

export default api;

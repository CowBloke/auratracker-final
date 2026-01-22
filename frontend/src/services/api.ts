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
  register: (data: { username: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data),
  refresh: () => api.post('/auth/refresh'),
  me: () => api.get('/auth/me'),
};

// Uploads API - Deprecated: File uploads are no longer supported, only URL-based images are allowed

// Users API
export const usersApi = {
  getAll: () => api.get('/users'),
  getAnnouncement: () => api.get<{ message: string }>('/users/announcement'),
  getById: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: { username?: string; bio?: string }) => api.put(`/users/${id}`, data),
};

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

// Pass API
export interface PassStatus {
  streak: number;
  status: 'available' | 'claimed';
  resetNotice: boolean;
  claimDay: number;
  claimReward: number;
  nextReward: number;
  nextReset: string;
}

export interface PassClaimResponse {
  success: boolean;
  reward: number;
  streak: number;
  claimDay: number;
  nextReward: number;
  newBalance: {
    money: number;
    aura: number;
  };
}

export const passApi = {
  getStatus: () => api.get<PassStatus>('/pass/status'),
  claim: () => api.post<PassClaimResponse>('/pass/claim'),
};

// Marketplace API
export const marketplaceApi = {
  getItems: (params?: { type?: string; page?: number; limit?: number }) =>
    api.get('/marketplace/items', { params }),
  purchase: (data: { itemId: string; quantity?: number }) =>
    api.post('/marketplace/purchase', data),
  getInventory: (userId: string) => api.get(`/marketplace/inventory/${userId}`),
  useItem: (userItemId: string, effectData?: { color?: string; imageUrl?: string }) => 
    api.post('/marketplace/use-item', { userItemId, effectData }),
  // Admin
  createItem: (data: {
    name: string;
    description: string;
    type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';
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
  complete: (gameType: string, data: { score: number; won: boolean; duration?: number; bet?: number; netGain?: number }) =>
    api.post(`/games/${gameType}/complete`, data),
  getLeaderboard: (gameType: string, limit?: number) =>
    api.get(`/games/${gameType}/leaderboard`, { params: { limit } }),
  // Admin: Delete a user's game stats
  deleteStats: (gameType: string, userId: string) =>
    api.delete(`/games/${gameType}/stats/${userId}`),
};

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

// Solaris API
export interface SolarisPriceHistory {
  price: number;
  volume: number;
  createdAt: string;
}

export interface SolarisTransaction {
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

export interface SolarisLeaderboardEntry {
  id: string;
  username: string;
  usernameColor: string | null;
  solarisBalance: number;
}

export const solarisApi = {
  getPrice: (hours?: number) =>
    api.get<{
      currentPrice: number;
      feePercentage: number;
      history: SolarisPriceHistory[];
      userBalance: { solaris: number; money: number };
    }>('/solaris/price', { params: { hours } }),
  getLeaderboard: (limit?: number) =>
    api.get<{ leaderboard: SolarisLeaderboardEntry[] }>('/solaris/leaderboard', { params: { limit } }),
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
      newBalance: { money: number; solaris: number };
    }>('/solaris/buy', { moneyAmount }),
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
      newBalance: { money: number; solaris: number };
    }>('/solaris/sell', { coinAmount }),
  getMyTransactions: (params?: { limit?: number; offset?: number }) =>
    api.get<{ transactions: SolarisTransaction[] }>('/solaris/transactions/me', { params }),
  getAllTransactions: (params?: { limit?: number; offset?: number }) =>
    api.get<{ transactions: SolarisTransaction[] }>('/solaris/transactions/all', { params }),
};

// Zenith API
export interface ZenithPriceHistory {
  price: number;
  volume: number;
  createdAt: string;
}

export interface ZenithTransaction {
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

export interface ZenithLeaderboardEntry {
  id: string;
  username: string;
  usernameColor: string | null;
  zenithBalance: number;
}

export const zenithApi = {
  getPrice: (hours?: number) =>
    api.get<{
      currentPrice: number;
      feePercentage: number;
      history: ZenithPriceHistory[];
      userBalance: { zenith: number; money: number };
    }>('/zenith/price', { params: { hours } }),
  getLeaderboard: (limit?: number) =>
    api.get<{ leaderboard: ZenithLeaderboardEntry[] }>('/zenith/leaderboard', { params: { limit } }),
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
      newBalance: { money: number; zenith: number };
    }>('/zenith/buy', { moneyAmount }),
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
      newBalance: { money: number; zenith: number };
    }>('/zenith/sell', { coinAmount }),
  getMyTransactions: (params?: { limit?: number; offset?: number }) =>
    api.get<{ transactions: ZenithTransaction[] }>('/zenith/transactions/me', { params }),
  getAllTransactions: (params?: { limit?: number; offset?: number }) =>
    api.get<{ transactions: ZenithTransaction[] }>('/zenith/transactions/all', { params }),
};

// Rift API
export interface RiftPriceHistory {
  price: number;
  volume: number;
  createdAt: string;
}

export interface RiftTransaction {
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

export interface RiftLeaderboardEntry {
  id: string;
  username: string;
  usernameColor: string | null;
  riftBalance: number;
}

export const riftApi = {
  getPrice: (hours?: number) =>
    api.get<{
      currentPrice: number;
      feePercentage: number;
      history: RiftPriceHistory[];
      userBalance: { rift: number; money: number };
    }>('/rift/price', { params: { hours } }),
  getLeaderboard: (limit?: number) =>
    api.get<{ leaderboard: RiftLeaderboardEntry[] }>('/rift/leaderboard', { params: { limit } }),
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
      newBalance: { money: number; rift: number };
    }>('/rift/buy', { moneyAmount }),
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
      newBalance: { money: number; rift: number };
    }>('/rift/sell', { coinAmount }),
  getMyTransactions: (params?: { limit?: number; offset?: number }) =>
    api.get<{ transactions: RiftTransaction[] }>('/rift/transactions/me', { params }),
  getAllTransactions: (params?: { limit?: number; offset?: number }) =>
    api.get<{ transactions: RiftTransaction[] }>('/rift/transactions/all', { params }),
};

// Leaderboards API
export const leaderboardsApi = {
  get: (category: string, params?: { limit?: number; offset?: number; seasonId?: string }) =>
    api.get(`/leaderboards/${category}`, { params }),
  getUserRankings: (userId: string) => api.get(`/leaderboards/user/${userId}`),
};

// Clans API
export interface ClanSummary {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
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
}

export const clansApi = {
  list: () => api.get<{ clans: ClanSummary[] }>('/clans'),
  getById: (id: string) => api.get<{ clan: ClanDetail }>(`/clans/${id}`),
  create: (data: { name: string; description?: string; imageUrl?: string; isPublic?: boolean }) =>
    api.post<{ clan: ClanSummary }>('/clans', data),
  join: (id: string) => api.post<{ status: 'joined' | 'requested'; requestId?: string }>(`/clans/${id}/join`),
  acceptRequest: (clanId: string, requestId: string) =>
    api.post(`/clans/${clanId}/requests/${requestId}/accept`),
  rejectRequest: (clanId: string, requestId: string) =>
    api.post(`/clans/${clanId}/requests/${requestId}/reject`),
  removeMember: (clanId: string, userId: string) =>
    api.delete(`/clans/${clanId}/members/${userId}`),
};

// Clash API
export interface Building {
  id: string;
  type: string;
  level: number;
  x: number;
  y: number;
}

export interface ClashBase {
  id: string;
  userId: string;
  baseLayout: { buildings: Building[]; version: number };
  defenseRating: number;
  trophies: number;
  shieldUntil: string | null;
  attackCooldown: string | null;
  user: {
    id: string;
    username: string;
    aura: number;
    money: number;
  };
}

export interface AttackTarget {
  id: string;
  username: string;
  trophies: number;
  defenseRating: number;
  potentialMoney: number;
  potentialAura: number;
}

export interface Troop {
  type: string;
  x: number;
  y: number;
  deployTime: number;
}

export const clashApi = {
  getBase: (userId: string) => api.get(`/clash/base/${userId}`),
  saveBase: (buildings: Building[]) => api.put('/clash/base', { buildings }),
  getTargets: () => api.get('/clash/targets'),
  checkAttack: (defenderId: string) => api.post('/clash/attack/check', { defenderId }),
  executeAttack: (data: {
    defenderId: string;
    troops: Troop[];
    duration: number;
    destruction: number;
    starsEarned: number;
  }) => api.post('/clash/attack/execute', data),
  getAttacks: (params?: { type?: 'all' | 'made' | 'received'; limit?: number }) =>
    api.get('/clash/attacks', { params }),
  getLeaderboard: (limit?: number) => api.get('/clash/leaderboard', { params: { limit } }),
  upgradeBuilding: (data: { buildingId: string; buildingType: string; currentLevel: number }) =>
    api.post('/clash/building/upgrade', data),
};

// Admin API
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  aura: number;
  money: number;
  auraCoinBalance: number;
  isAdmin: boolean;
  isChatMuted: boolean;
  dailyAuraGiven: number;
  dailyAuraLimit: number;
  lastDailyReset: string;
  createdAt: string;
  updatedAt: string;
}

export interface Badge {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface UserBadge {
  id: string;
  assignedAt: string;
  badge: Badge;
}


// Pending User Interface
export interface PendingUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

// Shop Item Interface
export interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';
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
  type: 'AUTH' | 'CHAT' | 'GAME' | 'ECONOMY' | 'PARTY' | 'SUGGESTION' | 'MARKETPLACE' | 'ADMIN' | 'BAN' | 'AURACOIN' | 'CLASH';
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

type AdminRareAction =
  | { action: 'chat_clear' }
  | { action: 'deploy' }
  | { action: 'reset_extreme_aura'; threshold?: number };

const runRareAction = (data: AdminRareAction) => api.post('/admin/rare', data);

export const adminApi = {
  runRareAction,
  getUsers: () => api.get<{ users: AdminUser[] }>('/admin/users'),
  updateUser: (id: string, data: { username?: string; aura?: number; money?: number; auraCoinBalance?: number; dailyAuraLimit?: number; password?: string; isChatMuted?: boolean }) =>
    api.put<{ user: AdminUser }>(`/admin/users/${id}`, data),
  deleteUser: (id: string) => api.delete<{ success: boolean; message: string }>(`/admin/users/${id}`),
  getBadges: () => api.get<{ badges: Badge[] }>('/admin/badges'),
  createBadge: (data: { name: string; color: string }) =>
    api.post<{ badge: Badge }>('/admin/badges', data),
  getUserBadges: (id: string) =>
    api.get<{ badges: UserBadge[] }>(`/admin/users/${id}/badges`),
  addUserBadge: (id: string, data: { badgeId: string }) =>
    api.post<{ userBadge: UserBadge; alreadyAssigned?: boolean }>(`/admin/users/${id}/badges`, data),
  removeUserBadge: (id: string, badgeId: string) =>
    api.delete<{ success: boolean }>(`/admin/users/${id}/badges/${badgeId}`),
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
  // Bug reports management
  getBugReports: () => api.get<{ bugReports: BugReport[] }>('/admin/bugs'),
  updateBugReport: (id: string, data: { status: 'PENDING' | 'DONE' }) =>
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
    startDate: string;
    endDate?: string;
    type?: string;
    action?: string;
    username?: string;
    gameType?: string;
  }) => api.get<Blob>('/admin/logs/download', { params, responseType: 'blob' }),
  getLogStats: () => api.get<LogStats>('/admin/logs/stats'),
  // Game settings management
  getSettings: () => api.get<{ settings: Record<string, string> }>('/admin/settings'),
  updateSettings: (settings: Record<string, string | number>) =>
    api.put<{ settings: Record<string, string> }>('/admin/settings', { settings }),
  updateSetting: (key: string, value: string | number) =>
    api.put<{ setting: { key: string; value: string } }>(`/admin/settings/${key}`, { value }),
  // Server deployment
  deploy: () =>
    runRareAction({ action: 'deploy' }) as Promise<{ data: { success: boolean; message: string; stdout?: string; stderr?: string } }>,
  // Reset extreme aura values
  resetExtremeAura: (threshold?: number) =>
    runRareAction({ action: 'reset_extreme_aura', threshold }) as Promise<{ data: { success: boolean; message: string; usersReset: number; users: { id: string; username: string; oldAura: string }[] } }>,
};

export const maintenanceApi = {
  getStatus: () => api.get<{ enabled: boolean; message: string; pages: string[]; endDate: string | null }>('/maintenance'),
};

// Bug report API (for regular users)
export const bugReportApi = {
  create: (data: { title: string; description: string }) =>
    api.post<{ bugReport: BugReport }>('/admin/bugs', data),
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
  eventDate: string;
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
  payout: number | null;
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

// Gallery API
export interface Painting {
  id: string;
  paintingId: string;
  title: string;
  artist: string;
  description: string | null;
  imageUrl: string;
  rarity: 'COMMON' | 'RARE' | 'GOLDEN';
  copyNumber: number;
  maxCopies: number;
  position?: number | null;
  acquiredAt?: string;
  isListed?: boolean;
}

export interface GallerySettings {
  id?: string;
  userId?: string;
  backgroundColor: string;
  lastNpcVisit?: string | null;
}

export interface ArtPackage {
  tier: number;
  price: number;
  purchased: boolean;
}

export interface NpcStatus {
  canVisit: boolean;
  lastVisit: string | null;
  paintingsInGallery: number;
  potentialRevenue: number;
}

export const galleryApi = {
  // Gallery viewing
  getGallery: (userId: string) =>
    api.get<{ gallery: GallerySettings; paintings: Painting[] }>(`/gallery/${userId}`),
  getWarehouse: () =>
    api.get<{ paintings: Painting[] }>('/gallery/warehouse/my'),
  getSettings: () =>
    api.get<{ gallery: GallerySettings }>('/gallery/settings/my'),
  updateSettings: (data: { backgroundColor?: string; paintings?: { copyId: string; position: number }[] }) =>
    api.put<{ success: boolean; gallery: GallerySettings }>('/gallery/settings/my', data),
  movePainting: (data: { copyId: string; toGallery: boolean; position?: number }) =>
    api.post<{ success: boolean }>('/gallery/move', data),

  // Art packages
  getPackagesStatus: () =>
    api.get<{ packages: ArtPackage[] }>('/gallery/packages/status'),
  purchasePackage: (tier: number) =>
    api.post<{ success: boolean; painting: Painting; newBalance: number }>('/gallery/packages/purchase', { tier }),

  // NPC visits
  getNpcStatus: () =>
    api.get<NpcStatus>('/gallery/npc/status'),
  triggerNpcVisit: () =>
    api.post<{ success: boolean; revenue: number; paintingsCount: number; hadGoldenBonus: boolean; newBalance: number }>('/gallery/npc/visit'),

  // Admin
  getPaintings: () =>
    api.get<{ paintings: Array<{
      id: string;
      title: string;
      artist: string;
      description: string | null;
      imageUrl: string;
      isVaulted: boolean;
      createdAt: string;
      copies: Array<{
        id: string;
        rarity: string;
        copyNumber: number;
        owner: { id: string; username: string } | null;
        inGallery: boolean;
      }>;
    }> }>('/gallery/admin/paintings'),
  createPainting: (data: { title: string; artist: string; description?: string; imageUrl: string }) =>
    api.post<{ painting: unknown }>('/gallery/admin/paintings', data),
  vaultPainting: (id: string, isVaulted: boolean) =>
    api.put<{ painting: unknown }>(`/gallery/admin/paintings/${id}/vault`, { isVaulted }),
  getAnalytics: () =>
    api.get<{
      totalPaintings: number;
      totalCopies: number;
      ownedCopies: number;
      availableCopies: number;
      copiesByRarity: Array<{ rarity: string; count: number }>;
      topCollectors: Array<{ userId: string; username: string | null; count: number }>;
    }>('/gallery/admin/analytics'),
};

// Player Market API
export interface MarketListing {
  id: string;
  type: 'PAINTING' | 'ITEM';
  price: number;
  quantity: number;
  createdAt: string;
  seller: {
    id: string;
    username: string;
  };
  painting?: {
    copyId: string;
    paintingId: string;
    title: string;
    artist: string;
    description: string | null;
    imageUrl: string;
    rarity: 'COMMON' | 'RARE' | 'GOLDEN';
    copyNumber: number;
    maxCopies: number;
  } | null;
  item?: {
    userItemId: string;
    itemId: string;
    name: string;
    description: string;
    type: string;
    imageUrl: string | null;
    effect: string | null;
  } | null;
}

export interface MarketStats {
  activeListings: number;
  totalSales: number;
  recentSales: Array<{
    type: string;
    price: number;
    soldAt: string;
    seller: string;
    buyer: string | null;
    itemName: string | null;
  }>;
}

export const marketApi = {
  // Browse listings
  getListings: (params?: { type?: string; page?: number; limit?: number; sort?: string }) =>
    api.get<{ listings: MarketListing[]; total: number; page: number; totalPages: number }>('/market/listings', { params }),
  getMyListings: () =>
    api.get<{ listings: MarketListing[] }>('/market/my-listings'),
  getHistory: (params?: { page?: number; limit?: number }) =>
    api.get<{ sales: MarketListing[]; purchases: MarketListing[] }>('/market/history', { params }),

  // List items
  listPainting: (data: { paintingCopyId: string; price: number }) =>
    api.post<{ success: boolean; listing: MarketListing }>('/market/list/painting', data),
  listItem: (data: { userItemId: string; price: number; quantity?: number }) =>
    api.post<{ success: boolean; listing: MarketListing }>('/market/list/item', data),

  // Buy and cancel
  buy: (listingId: string) =>
    api.post<{
      success: boolean;
      type: string;
      painting?: { copyId: string; title: string; rarity: string };
      item?: { name: string; quantity: number };
      pricePaid: number;
      fee: number;
      newBalance: number;
    }>('/market/buy', { listingId }),
  cancel: (listingId: string) =>
    api.post<{ success: boolean }>('/market/cancel', { listingId }),

  // Stats
  getStats: () =>
    api.get<MarketStats>('/market/stats'),
};

export const polymarketApi = {
  // Suggestions
  getSuggestions: () => api.get<{ suggestions: PolymarketSuggestion[] }>('/polymarket/suggestions'),
  createSuggestion: (data: { title: string; description: string; imageUrl?: string; eventDate: string }) =>
    api.post<{ suggestion: PolymarketSuggestion }>('/polymarket/suggestions', data),
  approveSuggestion: (id: string, data: { yesOdds: number; noOdds: number }) =>
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

export default api;

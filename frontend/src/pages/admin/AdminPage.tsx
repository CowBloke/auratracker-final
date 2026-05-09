import { useEffect, useState, useRef, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { adminApi, leaderboardsApi, AdminUser, ShopItem, ShopCategory, BugReport, PendingUser, AdminInventoryItem, Ban, ActivityLog, LogStats, BanAppeal, NameChangeRequest, AdminClan, AdminClanEvent, AdminWarning, AdminSurvey, badgesApi, Badge, AdminActivityBreakdown, OnlineHistoryInsights, supportApi, SupportThread, SupportMessage, MessagingReport, customBadgesApi, CustomBadgeRequest, TaxBracket, ShopItemExchangeFile, uploadUserImage, youApi, sanctionsApi, type FiscalUser, type FiscalInspectorSettings, type PendingSanction, type PendingFormationReviewItem, type PendingAdReview, type AdminChatHistoryDayBucket, type AdminChatHistoryMessage } from '../../services/api';
import { useSocketBase } from '@/contexts/SocketContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { prepareImageUploadPayload } from '@/lib/image-upload';
import { Loader2, Package, ChevronLeft, ChevronRight, ChevronDown, MessageCircle, Gamepad2, Coins, Users, Shield, Gavel, TrendingUp, Eye, Activity, CalendarRange, Award, Terminal, Landmark, Inbox, Settings, BarChart2 } from 'lucide-react';

import { cn, humanizeUiLabel } from '@/lib/utils';
import { PageShell } from '@/components/layout/PageShell';
import {
  DEFAULT_LANDING_PAGE,
  DEFAULT_LANDING_PAGE_KEY,
  normalizeDefaultLandingPage,
} from '@/lib/default-landing-page';
import {
  ADMIN_ARCHIVED_REGISTRATIONS_STORAGE_KEY,
  ADMIN_TABS,
  ANNOUNCEMENT_MAX_LENGTH,
  CHAT_BLOCK_MESSAGE_MAX_LENGTH,
  isValidChatTimeValue,
  type AdminTab,
  type AdminRole,
  YOU_LOGO_ADMIN_ONLY_SETTING_KEY,
} from './constants';
import { InboxTab } from './tabs/InboxTab';
import { BansTab } from './tabs/BansTab';
import { BraquageLegalTab } from './tabs/BraquageLegalTab';
import { ClubsTab } from './tabs/ClubsTab';
import { LogsTab } from './tabs/LogsTab';
import { ActivityTab } from './tabs/ActivityTab';
import { ReferralsTab } from './tabs/ReferralsTab';
import { TaxesTab } from './tabs/TaxesTab';
import { UsersTab } from './tabs/UsersTab';
import { DemographicsTab } from './tabs/DemographicsTab';
import { AdsTab } from './tabs/AdsTab';
import { ContentTab } from './tabs/ContentTab';
import { FiscalTab } from './tabs/FiscalTab';
import { GameLimitsTab } from './tabs/GameLimitsTab';
import { ChatHistoryTab } from './tabs/ChatHistoryTab';
import { SettingsTab } from './tabs/SettingsTab';
import { BadgesTab } from './tabs/BadgesTab';
import { CommunicationTab } from './tabs/CommunicationTab';
import { BanDialog } from './dialogs/BanDialog';
import { EditUserModal } from './dialogs/EditUserModal';
import { BadgeAssignModal } from './dialogs/BadgeAssignModal';
import { MassDeleteConfirmation } from './dialogs/MassDeleteConfirmation';
import { SharedMoneyDialog } from './dialogs/SharedMoneyDialog';
import { InventoryDialog } from './dialogs/InventoryDialog';
import { ItemDialog } from './dialogs/ItemDialog';
import {
  DEFAULT_CLAN_EVENT_FORM,
  DEFAULT_TAX_BRACKET,
  EFFECT_TYPES,
  EFFECT_TYPES_WITHOUT_VALUE,
  GAME_TYPES,
  ITEM_TYPE_LABELS,
  SHOP_ITEMS_FILE_FORMAT,
  SHOP_ITEMS_FILE_VERSION,
  defaultItemForm,
  generateBadgeSvgDataUrl,
  getAdminRole,
  mapClanEventToForm,
  mapRegistrationReviewToArchivedRegistration,
  parseLegacyArchivedRegistrations,
  toSafeNumber,
  type ArchivedRegistration,
  type ClanEventForm,
  type EditableTaxBracket,
  type ItemFormData,
} from './adminPageModels';
import { ACTION_LABELS, LOG_TYPE_CONFIG } from './log-constants';

const TaxesTabComponent = TaxesTab;

// Human-readable metadata key labels
const METADATA_LABELS: Record<string, string> = {
  score: 'Score',
  game: 'Jeu',
  gameType: 'Jeu',
  reward: 'Récompense',
  amount: 'Montant',
  item: 'Objet',
  itemName: 'Objet',
  price: 'Prix',
  totalPrice: 'Prix total',
  quantity: 'Quantité',
  reason: 'Raison',
  duration: 'Durée',
  lapTimeMs: 'Temps de tour',
  target: 'Cible',
  result: 'Résultat',
  bet: 'Mise',
  win: 'Gain',
  winAmount: 'Gain brut',
  netGain: 'Gain net',
  loss: 'Perte',
  won: 'Résultat',
  oldValue: 'Ancienne valeur',
  newValue: 'Nouvelle valeur',
  currency: 'Devise',
  type: 'Type',
  message: 'Message',
  partyName: 'Nom du groupe',
  content: 'Contenu',
  status: 'Statut',
  votes: 'Votes',
  auraAmount: 'Aura',
  moneyAmount: 'Money',
  auraReward: 'Récompense aura',
  moneyReward: 'Récompense money',
  totalAura: 'Total aura',
  totalMoney: 'Total money',
  newHighScore: 'Nouveau record',
  previousHighScore: 'Record précédent',
  isNewHighScore: 'Nouveau record',
  isNewDailyBest: 'Nouveau record quotidien',
  isFirstRunToday: 'Première partie du jour',
  streak: 'Streak',
  claimDay: 'Jour réclamé',
  banType: 'Type de ban',
  durationHours: 'Durée (heures)',
  expiresAt: 'Expire le',
  bansRemoved: 'Bans supprimés',
  moneySpent: 'Money dépensé',
  coinsReceived: 'AuraCoins reçus',
  coinsSold: 'AuraCoins vendus',
  moneyReceived: 'Money reçu',
  fee: 'Frais',
  feeRate: 'Taux de frais',
  priceAtPurchase: 'Prix d\'achat',
  priceAtSale: 'Prix de vente',
  remainingAllowance: 'Quota restant',
  effectType: 'Effet',
  badgeName: 'Nom du badge',
  auraSentLast24h: 'Aura envoyée (24h)',
  moneyStolen: 'Money volé',
  destructionPercent: 'Destruction (%)',
  buildingType: 'Bâtiment',
  level: 'Niveau',
  cost: 'Coût',
  via: 'Via',
  timeMs: 'Temps',
  trackNumber: 'Circuit',
  invitedCount: 'Invités',
  inviteeIds: 'IDs invités',
  inviteeNames: 'Invités',
  role: 'Rôle',
  durationDays: 'Durée (jours)',
  interestRate: 'Taux intérêt',
  borrowerName: 'Emprunteur',
  recipientUsername: 'Destinataire',
  slotIndex: 'Slot',
  nextLevel: 'Niveau suivant',
  researchCost: 'Coût recherche',
  productName: 'Produit',
  accountType: 'Type de compte',
  newBalance: 'Nouveau solde',
  formationPrice: 'Prix formation',
  formationUrl: 'URL formation',
  previousName: 'Nom précédent',
  previousDescription: 'Description précédente',
  previousLogoUrl: 'Logo précédent',
  previousTitle: 'Titre précédent',
  previousPrice: 'Prix précédent',
  previousUrl: 'URL précédente',
  previousSalary: 'Salaire précédent',
  salary: 'Salaire',
  ownerName: 'Propriétaire',
  ownerId: 'ID propriétaire',
  previousStatus: 'Statut précédent',
  seizedMoney: 'Money saisi',
  deletedByAdmin: 'Suppression admin',
};

const GAME_TYPE_LABELS: Record<string, string> = {
  doodle_jump: 'Doodle Jump',
  doodle_jump_mort_subite: 'Doodle Jump (Mort Subite)',
  game_2048: '2048',
  game_2048_tile: '2048 (Tuile max)',
  flappy_bird: 'Flappy Bird',
  chrome_dino: 'Chrome Dino',
  snake: 'Snake',
  blockblast: 'BlockBlast',
  crossy_road: 'Crossy Road',
  aura_coin: 'Aura Coin',
  stack_tower: 'Tour empilée',
  geometry_dash: 'Geometry Dash',
  qs_watermelon: 'QS Watermelon',
  solitaire: 'Solitaire',
  racer: 'Racer',
  racer_daily: 'Racer Quotidien',
  tetris: 'Tetris',
  knife_hit: 'Knife Hit',
  minesweeper: 'Démineur',
  goyave_empire: 'Goyave Empire',
  logic_lab: 'Sudoku',
  fruit_ninja: 'Fruit Ninja',
  casino: 'Casino',
  bombparty: 'Bombe de mots',
  petit_bac: 'Petit Bac',
  poker: 'Poker',
  battleship: 'Bataille Navale',
  chess: 'Échecs',
  puissance_4: 'Puissance 4',
  ball_arena: 'Arène des balles',
  ballarena: 'Arène des balles',
  uno: 'Uno',
  morpion: 'Morpion',
  polytrack: 'PolyTrack',
  eaglercraft: 'Eaglercraft',
  hexgl: 'HexGL',
  russian_roulette: 'Roulette russe',
  roulette: 'Roulette russe',
  p4: 'Puissance 4',
  clash_village: 'Clash Village',
  nuit_blanche: 'Nuit Blanche',
};

const MULTIPLAYER_GAME_TYPES = new Set([
  'bombparty',
  'petit_bac',
  'poker',
  'battleship',
  'chess',
  'puissance_4',
  'ball_arena',
  'uno',
  'morpion',
  'russian_roulette',
]);
const ACTIVITY_BREAKDOWN_COLORS = ['#2563eb', '#f97316', '#10b981', '#eab308', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f43f5e', '#14b8a6', '#f59e0b', '#6366f1'];

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const formatGameTypeLabel = (gameType: unknown): string => {
  const normalized = typeof gameType === 'string' ? gameType : '';
  return GAME_TYPE_LABELS[normalized] || (normalized ? normalized.replace(/_/g, ' ') : 'Jeu');
};

const formatBigNumber = (n: number): string => {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}G`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('fr-FR');
};

const formatPercent = (value: number, digits = 1): string => (
  `${value.toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`
);

type CountDistributionPoint = {
  label: string;
  count: number;
  share: number;
};

type ClassAveragePoint = {
  label: string;
  count: number;
  avgAura: number;
  avgMoney: number;
};

type TopUserByLevel = {
  level: string;
  users: AdminUser[];
};

const normalizeLevelLabel = (value: string | null | undefined): string => {
  const normalized = (value || '').trim();
  return normalized || 'Non renseigné';
};

const normalizeClassLabel = (user: Pick<AdminUser, 'schoolLevel' | 'classLetter'>): string => {
  const level = normalizeLevelLabel(user.schoolLevel);
  const letter = (user.classLetter || '').trim().toUpperCase();
  if (!letter) return level;
  return `${level} ${letter}`;
};

const buildCountDistribution = (
  population: AdminUser[],
  resolver: (entry: AdminUser) => string,
): CountDistributionPoint[] => {
  if (population.length === 0) return [];

  const counts = new Map<string, number>();
  for (const entry of population) {
    const key = resolver(entry);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      share: population.length > 0 ? (count / population.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr-FR'));
};

type WealthDistributionSummary = {
  total: number;
  average: number;
  median: number;
  p10: number;
  p90: number;
  min: number;
  max: number;
  gini: number;
  top10Share: number;
  top1Share: number;
  bottom50Share: number;
  zeroCount: number;
  richestUser: Pick<AdminUser, 'id' | 'username'> | null;
  deciles: Array<{
    label: string;
    total: number;
    average: number;
    userCount: number;
  }>;
  concentration: Array<{
    label: string;
    share: number;
    amount: number;
  }>;
};

const getPercentileValue = (sortedValues: number[], percentile: number): number => {
  if (sortedValues.length === 0) return 0;
  const clamped = Math.max(0, Math.min(1, percentile));
  const index = (sortedValues.length - 1) * clamped;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sortedValues[lowerIndex];
  const upper = sortedValues[upperIndex];
  if (lower === undefined || upper === undefined) return lower ?? upper ?? 0;
  if (lowerIndex === upperIndex) return lower;
  return lower + (upper - lower) * (index - lowerIndex);
};

const calculateWealthDistribution = (
  population: AdminUser[],
  getValue: (user: AdminUser) => number
): WealthDistributionSummary | null => {
  if (population.length === 0) return null;

  const entries = population
    .map((member) => ({
      id: member.id,
      username: member.username,
      value: Number.isFinite(getValue(member)) ? getValue(member) : 0,
    }))
    .sort((a, b) => a.value - b.value);

  if (entries.length === 0) return null;

  const values = entries.map((entry) => entry.value);
  const safeTotal = values.reduce((sum, value) => sum + value, 0);
  const nonNegativeValues = values.map((value) => Math.max(0, value));
  const totalForShares = nonNegativeValues.reduce((sum, value) => sum + value, 0);
  const shiftedValues = (() => {
    const minValue = Math.min(...values);
    return minValue < 0 ? values.map((value) => value - minValue) : values;
  })();
  const shiftedTotal = shiftedValues.reduce((sum, value) => sum + value, 0);
  const gini = shiftedTotal <= 0
    ? 0
    : Math.max(
        0,
        Math.min(
          100,
          (
            (2 * shiftedValues.reduce((sum, value, index) => sum + (index + 1) * value, 0)) /
              (shiftedValues.length * shiftedTotal) -
            (shiftedValues.length + 1) / shiftedValues.length
          ) * 100
        )
      );

  const topSlice = (share: number) => Math.max(1, Math.ceil(entries.length * share));
  const computeShare = (subset: typeof entries) => {
    if (totalForShares <= 0) return 0;
    const subtotal = subset.reduce((sum, entry) => sum + Math.max(0, entry.value), 0);
    return (subtotal / totalForShares) * 100;
  };

  const decileSize = Math.max(1, Math.ceil(entries.length / 10));
  const deciles = Array.from({ length: 10 }, (_value, index) => {
    const start = index * decileSize;
    const bucket = entries.slice(start, start + decileSize);
    const labelStart = index * 10;
    const labelEnd = index === 9 ? 100 : (index + 1) * 10;
    const total = bucket.reduce((sum, entry) => sum + entry.value, 0);
    return {
      label: `P${labelStart}-${labelEnd}`,
      total,
      average: bucket.length > 0 ? total / bucket.length : 0,
      userCount: bucket.length,
    };
  }).filter((bucket) => bucket.userCount > 0);

  return {
    total: safeTotal,
    average: safeTotal / entries.length,
    median: getPercentileValue(values, 0.5),
    p10: getPercentileValue(values, 0.1),
    p90: getPercentileValue(values, 0.9),
    min: values[0] ?? 0,
    max: values[values.length - 1] ?? 0,
    gini,
    top10Share: computeShare(entries.slice(-topSlice(0.1))),
    top1Share: computeShare(entries.slice(-topSlice(0.01))),
    bottom50Share: computeShare(entries.slice(0, Math.max(1, Math.floor(entries.length * 0.5)))),
    zeroCount: values.filter((value) => value <= 0).length,
    richestUser: entries.length > 0 ? { id: entries[entries.length - 1].id, username: entries[entries.length - 1].username } : null,
    deciles,
    concentration: [
      { label: 'Top 1%', share: computeShare(entries.slice(-topSlice(0.01))), amount: entries.slice(-topSlice(0.01)).reduce((sum, entry) => sum + Math.max(0, entry.value), 0) },
      { label: 'Top 10%', share: computeShare(entries.slice(-topSlice(0.1))), amount: entries.slice(-topSlice(0.1)).reduce((sum, entry) => sum + Math.max(0, entry.value), 0) },
      { label: 'Top 25%', share: computeShare(entries.slice(-topSlice(0.25))), amount: entries.slice(-topSlice(0.25)).reduce((sum, entry) => sum + Math.max(0, entry.value), 0) },
      { label: 'Bas 50%', share: computeShare(entries.slice(0, Math.max(1, Math.floor(entries.length * 0.5)))), amount: entries.slice(0, Math.max(1, Math.floor(entries.length * 0.5))).reduce((sum, entry) => sum + Math.max(0, entry.value), 0) },
    ],
  };
};

const formatDurationShort = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0s';
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const formatTimelineMinutes = (totalMinutes: number): string => {
  const safeMinutes = Math.max(0, Math.min(1439, Math.round(totalMinutes)));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const buildTimelineDateTime = (date: string, totalMinutes: number, boundary: 'start' | 'end'): string => {
  const safeMinutes = Math.max(0, Math.min(1439, Math.round(totalMinutes)));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  const seconds = boundary === 'start' ? '00' : '59';
  return `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${seconds}`;
};

const getGameDisplayInfo = (log: ActivityLog): { gameType: string; gameLabel: string; isMultiplayer: boolean } => {
  const metadata = log.metadata || {};
  const metadataGameType = typeof metadata.gameType === 'string' ? metadata.gameType : '';
  const gameType = metadataGameType || (log.action === 'casino_bet' ? 'casino' : '');
  const isMultiplayer =
    metadata.isMultiplayer === true ||
    MULTIPLAYER_GAME_TYPES.has(gameType);
  return {
    gameType,
    gameLabel: formatGameTypeLabel(gameType),
    isMultiplayer,
  };
};

// Keys that contain internal IDs — skip in expanded view
const SKIP_METADATA_KEYS = new Set(['itemId', 'transferId', 'appealId', 'questIds', 'banId', 'defenderUserId']);

const renderNetGain = (net: number) => (
  <span className={net >= 0 ? 'text-green-400' : 'text-red-400'}>
    {net >= 0 ? '+' : ''}{net}
  </span>
);

const formatMilliseconds = (value: number) => `${(value / 1000).toFixed(3)}s`;

const renderMetadataValue = (key: string, value: unknown): ReactNode => {
  if (key === 'netGain') {
    const n = toNumber(value);
    if (n !== null) return renderNetGain(n);
  }
  if (key === 'won') return value === true ? <span className="text-green-400">Oui</span> : <span className="text-red-400">Non</span>;
  if (key === 'isNewHighScore' || key === 'isNewDailyBest' || key === 'isFirstRunToday') return value === true ? 'Oui' : 'Non';
  if (key === 'banType') return value === 'TEMPORARY' ? 'Temporaire' : value === 'PERMANENT' ? 'Permanent' : String(value);
  if (key === 'gameType' && typeof value === 'string') return formatGameTypeLabel(value);
  if (key === 'effectType') {
    const map: Record<string, string> = { USERNAME_COLOR: 'Couleur pseudo', PROFILE_PICTURE: 'Photo de profil', PROFILE_BANNER: 'Bannière', CONSUMABLE: 'Objet', CUSTOM_BADGE: 'Badge custom' };
    return typeof value === 'string' ? (map[value] || value) : String(value);
  }
  if (key === 'expiresAt' && typeof value === 'string') {
    return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (key === 'duration') {
    const n = toNumber(value);
    if (n !== null) return formatDurationShort(n);
  }
  if (key === 'lapTimeMs') {
    const n = toNumber(value);
    if (n !== null) return formatMilliseconds(n);
  }
  if (key === 'timeMs') {
    const n = toNumber(value);
    if (n !== null) return formatMilliseconds(n);
  }
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
};

const renderLogSummary = (log: ActivityLog): ReactNode => {
  const actor = log.username || 'inconnu';
  const metadata = log.metadata || {};
  const { gameLabel, gameType } = getGameDisplayInfo(log);

  if (log.type === 'GAME') {
    if (log.action === 'game_complete') {
      const timeMs = toNumber(metadata.timeMs) ?? toNumber(metadata.lapTimeMs);
      if (timeMs !== null) {
        return <>{gameLabel} : temps {formatMilliseconds(timeMs)} par {actor}</>;
      }
      if (gameType === 'battleship') {
        const won = metadata.won === true;
        return <>{gameLabel} : {won ? <span className="text-green-400">victoire</span> : <span className="text-red-400">défaite</span>} par {actor}</>;
      }
      const netGain = toNumber(metadata.netGain);
      if (netGain !== null) {
        const bet = toNumber(metadata.bet);
        return <>{gameLabel} : {bet !== null && <>mise {bet}, </>}net {renderNetGain(netGain)} par {actor}</>;
      }
      const score = toNumber(metadata.score);
      if (score !== null) return <>{gameLabel} : score {score} par {actor}</>;
      return <>{gameLabel} : partie par {actor}</>;
    }

    if (log.action === 'highscore') {
      const timedBest = toNumber(metadata.newHighScore);
      if (timedBest !== null && (gameType === 'racer' || gameType === 'racer_daily' || gameType === 'hexgl' || gameType === 'polytrack')) {
        return <>{gameLabel} : nouveau record {formatMilliseconds(timedBest)} par {actor}</>;
      }
      const best = toNumber(metadata.newHighScore);
      if (best !== null) return <>{gameLabel} : nouveau record {best} par {actor}</>;
      return <>{gameLabel} : nouveau record par {actor}</>;
    }

    if (log.action === 'casino_bet') {
      const bet = toNumber(metadata.bet);
      const netGain = toNumber(metadata.netGain);
      const won = metadata.won === true;
      return <>Casino : {won ? <span className="text-green-400">gagné</span> : <span className="text-red-400">perdu</span>}{bet !== null && <>, mise {bet}</>}{netGain !== null && <>, net {renderNetGain(netGain)}</>} par {actor}</>;
    }

    if (log.action === 'game_reward') {
      const auraReward = toNumber(metadata.auraReward);
      const moneyReward = toNumber(metadata.moneyReward);
      const parts: string[] = [];
      if (auraReward !== null) parts.push(`${auraReward} aura`);
      if (moneyReward !== null) parts.push(`${moneyReward} money`);
      if (parts.length > 0) return <>{gameLabel} : récompense {parts.join(' + ')} par {actor}</>;
      return <>{gameLabel} : récompense par {actor}</>;
    }
  }

  if (log.type === 'MARKETPLACE') {
    const itemName = typeof metadata.itemName === 'string' ? metadata.itemName : null;
    if (log.action === 'item_purchase') {
      const qty = toNumber(metadata.quantity);
      const price = toNumber(metadata.totalPrice);
      return <>Achat{itemName && <> : <span className="font-semibold">{itemName}</span></>}{qty !== null && qty > 1 && <> ×{qty}</>}{price !== null && <> ({price} 💰)</>} par {actor}</>;
    }
    if (log.action === 'item_use') {
      return <>Utilisation{itemName && <> : <span className="font-semibold">{itemName}</span></>} par {actor}</>;
    }
  }

  if (log.type === 'ECONOMY') {
    if (log.action === 'transfer') {
      const aura = toNumber(metadata.auraAmount);
      const money = toNumber(metadata.moneyAmount);
      const parts: string[] = [];
      if (aura !== null && aura !== 0) parts.push(`${aura} aura`);
      if (money !== null && money !== 0) parts.push(`${money} 💰`);
      return <>Transfert{parts.length > 0 && <> : {parts.join(' + ')}</>} de {actor}{log.targetName && <> → {log.targetName}</>}</>;
    }
  }

  if (log.type === 'AURACOIN') {
    if (log.action === 'auracoin_buy') {
      const coins = toNumber(metadata.coinsReceived);
      const money = toNumber(metadata.moneySpent);
      return <>Achat AuraCoin{coins !== null && <> : {coins} coins</>}{money !== null && <> pour {money} 💰</>} par {actor}</>;
    }
    if (log.action === 'auracoin_sell') {
      const coins = toNumber(metadata.coinsSold);
      const money = toNumber(metadata.moneyReceived);
      return <>Vente AuraCoin{coins !== null && <> : {coins} coins</>}{money !== null && <> → {money} 💰</>} par {actor}</>;
    }
  }

  if (log.type === 'BAN') {
    if (log.action === 'ban_create') {
      const banType = metadata.banType === 'TEMPORARY' ? 'temporaire' : metadata.banType === 'PERMANENT' ? 'permanent' : null;
      const reason = typeof metadata.reason === 'string' ? metadata.reason : null;
      return <>Ban{banType && <> {banType}</>} de {log.targetName || 'inconnu'}{reason && <> — {reason}</>} par {actor}</>;
    }
    if (log.action === 'ban_remove') {
      return <>Ban levé : {log.targetName || 'inconnu'} par {actor}</>;
    }
  }

  const actionLabel = ACTION_LABELS[log.action] || humanizeUiLabel(log.action);
  if (log.targetName) return <>{actionLabel} par {actor} → {log.targetName}</>;
  return <>{log.username ? `${actionLabel} par ${actor}` : actionLabel}</>;
};

export default function Admin() {
  const { user } = useAuth();
  const location = useLocation();
  const { socket } = useSocketBase();
  const { refreshFeatures } = useFeatures();
  const { confirm, alert } = useAppDialog();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ username: string; firstName: string; aura: number; money: number; auraCoinBalance: number; dailyAuraLimit: number }>({
    username: '',
    firstName: '',
    aura: 0,
    money: 0,
    auraCoinBalance: 0,
    dailyAuraLimit: 50,
  });
  const [editPassword, setEditPassword] = useState('');
  const [editAuraAddAmount, setEditAuraAddAmount] = useState(0);
  const [editAuraRemoveAmount, setEditAuraRemoveAmount] = useState(0);
  const [editMoneyAddAmount, setEditMoneyAddAmount] = useState(0);
  const [editMoneyRemoveAmount, setEditMoneyRemoveAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [downloadingUsersCsv, setDownloadingUsersCsv] = useState(false);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [mutingUser, setMutingUser] = useState<string | null>(null);
  const [forcingDivorceUserId, setForcingDivorceUserId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalUser, setEditModalUser] = useState<AdminUser | null>(null);
  const [sharedMoneyUser, setSharedMoneyUser] = useState<AdminUser | null>(null);
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);
  const [badgeModalUserId, setBadgeModalUserId] = useState('');
  const [badgeModalBadgeId, setBadgeModalBadgeId] = useState('');
  const [badgeModalReason, setBadgeModalReason] = useState('');
  const [massDeleteOpen, setMassDeleteOpen] = useState(false);
  const [massBanTargetIds, setMassBanTargetIds] = useState<string[]>([]);
  const [clearingChat, setClearingChat] = useState(false);
  const [exportingChat, setExportingChat] = useState(false);
  const [chatHistoryDays, setChatHistoryDays] = useState<AdminChatHistoryDayBucket[]>([]);
  const [chatHistoryCursor, setChatHistoryCursor] = useState<string | null>(null);
  const [chatHistoryMessages, setChatHistoryMessages] = useState<AdminChatHistoryMessage[]>([]);
  const [chatHistoryDay, setChatHistoryDay] = useState<string | null>(null);
  const [loadingChatHistoryDays, setLoadingChatHistoryDays] = useState(false);
  const [loadingMoreChatHistoryDays, setLoadingMoreChatHistoryDays] = useState(false);
  const [loadingChatHistoryMessages, setLoadingChatHistoryMessages] = useState(false);
  const [exportingChatDay, setExportingChatDay] = useState<string | null>(null);
  const [softDeletingChatMessageId, setSoftDeletingChatMessageId] = useState<string | null>(null);
  const [showDeletedChatMessages, setShowDeletedChatMessages] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('inbox');
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [loginCommOpen, setLoginCommOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [openingPrisma, setOpeningPrisma] = useState(false);

  const isAdminOrSuperAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);

  // ── Badge tab state ────────────────────────────────────────────────────────
  const [badges, setBadges] = useState<Badge[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [customBadgeRequests, setCustomBadgeRequests] = useState<CustomBadgeRequest[]>([]);
  const [customBadgeRequestsLoading, setCustomBadgeRequestsLoading] = useState(false);
  const [pendingFormationReviews, setPendingFormationReviews] = useState<PendingFormationReviewItem[]>([]);
  const [pendingFormationReviewsLoading, setPendingFormationReviewsLoading] = useState(false);
  const [reviewingFormationProductId, setReviewingFormationProductId] = useState<string | null>(null);
  const [pendingAds, setPendingAds] = useState<PendingAdReview[]>([]);
  const [pendingAdsLoading, setPendingAdsLoading] = useState(false);
  const [allAds, setAllAds] = useState<PendingAdReview[]>([]);
  const [allAdsLoading, setAllAdsLoading] = useState(false);
  const [reviewingAdId, setReviewingAdId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [badgeFormOpen, setBadgeFormOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);

  const [badgeForm, setBadgeForm] = useState<Partial<Badge>>({
    name: '', description: '', howToObtain: '',
    backgroundType: 'solid', backgroundColor: '#374151',
    backgroundGradient: '', backgroundImage: '',
    icon: '⭐', iconColor: '#ffffff', borderColor: '#6b7280',
    category: 'special', rarity: 'common',
    isAutomatic: false, autoConditionKey: '', isActive: true, isHidden: false,
  });
  const [awardBadgeUserId, setAwardBadgeUserId] = useState('');
  const [awardBadgeId, setAwardBadgeId] = useState('');
  const [awardBadgeReason, setAwardBadgeReason] = useState('');

  // Support state
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([]);
  const [supportThreadsLoading, setSupportThreadsLoading] = useState(false);
  const [activeThreadUserId, setActiveThreadUserId] = useState<string | null>(null);
  const [activeThreadMessages, setActiveThreadMessages] = useState<SupportMessage[]>([]);
  const [activeThreadUser, setActiveThreadUser] = useState<SupportThread['user'] | null>(null);
  const [supportReply, setSupportReply] = useState('');
  const [supportReplyImages, setSupportReplyImages] = useState<string[]>([]);
  const [supportUploadingImage, setSupportUploadingImage] = useState(false);
  const [supportSending, setSupportSending] = useState(false);
  const [supportReports, setSupportReports] = useState<MessagingReport[]>([]);
  const [supportReportsLoading, setSupportReportsLoading] = useState(false);
  const [reviewingSupportReportId, setReviewingSupportReportId] = useState<string | null>(null);
  const supportMessagesEndRef = useRef<HTMLDivElement>(null);
  const supportImageInputRef = useRef<HTMLInputElement>(null);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [newThreadUserId, setNewThreadUserId] = useState('');
  const [newThreadBody, setNewThreadBody] = useState('');
  const [newThreadSending, setNewThreadSending] = useState(false);
  const [newThreadSearch, setNewThreadSearch] = useState('');
  const [surveys, setSurveys] = useState<AdminSurvey[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(false);
  const [surveyDialogOpen, setSurveyDialogOpen] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyDescription, setSurveyDescription] = useState('');
  const [surveyAudienceType, setSurveyAudienceType] = useState<AdminSurvey['audienceType']>('ALL_USERS');
  const [surveyPopupDelaySeconds, setSurveyPopupDelaySeconds] = useState(45);
  const [surveyOptions, setSurveyOptions] = useState<Array<{ label: string; color: string; imageUrl: string | null }>>([
    { label: '', color: '#6366f1', imageUrl: null },
    { label: '', color: '#22c55e', imageUrl: null },
  ]);
  const [surveyTargetSearch, setSurveyTargetSearch] = useState('');
  const [surveySelectedUserIds, setSurveySelectedUserIds] = useState<string[]>([]);
  const [surveyImageUrl, setSurveyImageUrl] = useState<string | null>(null);
  const [surveyUploadingImage, setSurveyUploadingImage] = useState(false);
  const surveyImageInputRef = useRef<HTMLInputElement>(null);
  const [surveyOptionUploadingIndex, setSurveyOptionUploadingIndex] = useState<number | null>(null);
  const surveyOptionImageInputRef = useRef<HTMLInputElement>(null);
  const surveyOptionUploadIndexRef = useRef<number | null>(null);
  const [creatingSurvey, setCreatingSurvey] = useState(false);
  const [archivingSurveyId, setArchivingSurveyId] = useState<string | null>(null);

  const supportUnread = supportThreads.reduce((total, thread) => total + (thread.unreadCount ?? 0), 0);

  const resetSurveyForm = () => {
    setSurveyTitle('');
    setSurveyDescription('');
    setSurveyAudienceType('ALL_USERS');
    setSurveyPopupDelaySeconds(45);
    setSurveyOptions([
      { label: '', color: '#6366f1', imageUrl: null },
      { label: '', color: '#22c55e', imageUrl: null },
    ]);
    setSurveyTargetSearch('');
    setSurveySelectedUserIds([]);
    setSurveyImageUrl(null);
  };

  const handleSurveyImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setSurveyUploadingImage(true);
    try {
      const { base64Data, mimeType } = await prepareImageUploadPayload(file);
      const { data } = await uploadUserImage({ base64Data, mimeType });
      setSurveyImageUrl(data.imageUrl);
    } catch {
      showMessage('error', 'Erreur lors du téléversement de l\'image');
    } finally {
      setSurveyUploadingImage(false);
      if (surveyImageInputRef.current) {
        surveyImageInputRef.current.value = '';
      }
    }
  };

  const triggerSurveyOptionImageUpload = (index: number) => {
    surveyOptionUploadIndexRef.current = index;
    surveyOptionImageInputRef.current?.click();
  };

  const handleSurveyOptionImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    const index = surveyOptionUploadIndexRef.current;
    if (!file || index === null) return;
    setSurveyOptionUploadingIndex(index);
    try {
      const { base64Data, mimeType } = await prepareImageUploadPayload(file);
      const { data } = await uploadUserImage({ base64Data, mimeType });
      setSurveyOptions((prev) => prev.map((opt, i) => i === index ? { ...opt, imageUrl: data.imageUrl } : opt));
    } catch {
      showMessage('error', 'Erreur lors du téléversement de l\'image');
    } finally {
      setSurveyOptionUploadingIndex(null);
      surveyOptionUploadIndexRef.current = null;
      if (surveyOptionImageInputRef.current) {
        surveyOptionImageInputRef.current.value = '';
      }
    }
  };

  const openPrismaStudio = async () => {
    if (openingPrisma) {
      return;
    }

    setOpeningPrisma(true);
    try {
      const res = await adminApi.startPrismaStudio();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const origin = new URL(apiUrl, window.location.origin).origin;
      const studioUrl = `${origin}/api/admin/prisma-studio?studioToken=${encodeURIComponent(res.data.studioToken)}`;
      window.open(studioUrl, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Impossible de lancer Prisma Studio.');
    } finally {
      setOpeningPrisma(false);
    }
  };

  const fetchSupportThreads = async () => {
    setSupportThreadsLoading(true);
    try {
      const res = await supportApi.getThreads();
      setSupportThreads(res.data.threads);
    } catch { /* non-critical */ }
    finally { setSupportThreadsLoading(false); }
  };

  const fetchSupportReports = async () => {
    setSupportReportsLoading(true);
    try {
      const res = await supportApi.getReports();
      setSupportReports(res.data.reports);
    } catch { /* non-critical */ }
    finally { setSupportReportsLoading(false); }
  };

  const fetchSurveys = async () => {
    try {
      setSurveysLoading(true);
      const res = await adminApi.getSurveys();
      setSurveys(res.data.surveys);
    } catch (error: any) {
      console.error('Failed to fetch surveys:', error);
      showMessage('error', error.response?.data?.error || 'Erreur lors du chargement des sondages');
    } finally {
      setSurveysLoading(false);
    }
  };

  const openSupportThread = async (userId: string) => {
    setActiveThreadUserId(userId);
    try {
      const res = await supportApi.getThread(userId);
      setActiveThreadMessages(res.data.messages);
      setActiveThreadUser(res.data.user);
      await supportApi.markThreadRead(userId);
      setSupportThreads((prev) =>
        prev.map((t) => (t.userId === userId ? { ...t, unreadCount: 0 } : t))
      );
    } catch { /* non-critical */ }
  };

  const handleSupportReply = async () => {
    if (!activeThreadUserId || (!supportReply.trim() && supportReplyImages.length === 0) || supportSending || supportUploadingImage) return;
    setSupportSending(true);
    try {
      const res = await supportApi.reply(
        activeThreadUserId,
        supportReply.trim(),
        supportReplyImages.length > 0 ? supportReplyImages : undefined,
      );
      setActiveThreadMessages((prev) => prev.some((m) => m.id === res.data.message.id) ? prev : [...prev, res.data.message]);
      setSupportReply('');
      setSupportReplyImages([]);
      if (supportImageInputRef.current) {
        supportImageInputRef.current.value = '';
      }
    } catch { /* non-critical */ }
    finally { setSupportSending(false); }
  };

  const handleSupportImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;

    if (supportReplyImages.length + files.length > 5) {
      showMessage('error', 'Maximum 5 images autorisées');
      if (supportImageInputRef.current) {
        supportImageInputRef.current.value = '';
      }
      return;
    }

    setSupportUploadingImage(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const { base64Data, mimeType } = await prepareImageUploadPayload(file);
        const { data } = await uploadUserImage({ base64Data, mimeType });
        uploadedUrls.push(data.imageUrl);
      }
      if (uploadedUrls.length > 0) {
        setSupportReplyImages((prev) => [...prev, ...uploadedUrls]);
      }
    } catch {
      showMessage('error', 'Erreur lors du téléversement de l\'image');
    } finally {
      setSupportUploadingImage(false);
      if (supportImageInputRef.current) {
        supportImageInputRef.current.value = '';
      }
    }
  };

  const removeSupportReplyImage = (index: number) => {
    setSupportReplyImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartThread = async () => {
    if (!newThreadUserId || !newThreadBody.trim() || newThreadSending) return;
    setNewThreadSending(true);
    try {
      await supportApi.reply(newThreadUserId, newThreadBody.trim());
      setNewThreadOpen(false);
      setNewThreadBody('');
      setNewThreadUserId('');
      setNewThreadSearch('');
      await fetchSupportThreads();
      await openSupportThread(newThreadUserId);
    } catch { /* non-critical */ }
    finally { setNewThreadSending(false); }
  };

  const handleReviewSupportReport = async (reportId: string, action: 'ACTION_TAKEN' | 'DISMISSED') => {
    if (reviewingSupportReportId) return;
    setReviewingSupportReportId(reportId);
    try {
      const res = await supportApi.reviewReport(reportId, { action });
      setSupportReports((prev) => prev.map((report) => report.id === reportId ? {
        ...report,
        status: res.data.report.status,
        reviewerNote: res.data.report.reviewerNote,
        reviewedAt: res.data.report.reviewedAt,
      } : report));
    } catch { /* non-critical */ }
    finally { setReviewingSupportReportId(null); }
  };

  const fetchBadges = async () => {
    setBadgesLoading(true);
    try {
      const res = await badgesApi.getAll();
      setBadges(res.data.badges);
    } catch { /* non-critical */ }
    finally { setBadgesLoading(false); }
  };

  const fetchCustomBadgeRequests = async () => {
    setCustomBadgeRequestsLoading(true);
    try {
      const res = await customBadgesApi.getPending();
      setCustomBadgeRequests(res.data.requests);
    } catch { /* non-critical */ }
    finally { setCustomBadgeRequestsLoading(false); }
  };

  const fetchPendingFormationReviews = async () => {
    setPendingFormationReviewsLoading(true);
    try {
      const res = await youApi.listPendingFormationProductsForAdmin();
      setPendingFormationReviews(res.data.products);
    } catch (error) {
      console.error('Failed to fetch pending formation reviews:', error);
      showMessage('error', 'Erreur lors du chargement des formations en attente');
    } finally {
      setPendingFormationReviewsLoading(false);
    }
  };

  const fetchPendingAds = async () => {
    setPendingAdsLoading(true);
    try {
      const res = await adminApi.getPendingAds();
      setPendingAds(res.data.pendingAds);
    } catch (error) {
      console.error('Failed to fetch pending ads:', error);
    } finally {
      setPendingAdsLoading(false);
    }
  };

  const fetchAllAds = async () => {
    setAllAdsLoading(true);
    try {
      const res = await adminApi.getAllAds();
      setAllAds(res.data.ads);
    } catch (error) {
      console.error('Failed to fetch all ads:', error);
    } finally {
      setAllAdsLoading(false);
    }
  };

  const handleApproveCustomBadge = async (id: string) => {
    try {
      await customBadgesApi.approve(id);
      showMessage('success', 'Badge approuvé et attribué');
      fetchCustomBadgeRequests();
    } catch {
      showMessage('error', 'Erreur lors de l\'approbation');
    }
  };

  const handleRejectCustomBadge = async (id: string) => {
    try {
      await customBadgesApi.reject(id, rejectNotes[id]);
      showMessage('success', 'Demande refusée');
      fetchCustomBadgeRequests();
      setRejectNotes((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } catch {
      showMessage('error', 'Erreur lors du refus');
    }
  };

  const handleReviewFormationProduct = async (businessId: string, productId: string, decision: 'approve' | 'reject') => {
    setReviewingFormationProductId(productId);
    try {
      await youApi.reviewFormationProduct(
        businessId,
        productId,
        decision,
        (rejectNotes[productId] ?? '').trim() || undefined,
      );
      showMessage('success', decision === 'approve' ? 'Formation approuvÃ©e' : 'Formation refusÃ©e');
      await fetchPendingFormationReviews();
      setRejectNotes((prev) => {
        if (!(productId in prev)) return prev;
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    } catch (error) {
      console.error('Failed to review formation product:', error);
      showMessage('error', 'Erreur lors de la revue de la formation');
    } finally {
      setReviewingFormationProductId(null);
    }
  };

  const handleReviewAd = async (adId: string, decision: 'approve' | 'reject') => {
    setReviewingAdId(adId);
    try {
      const res = decision === 'approve'
        ? await adminApi.approveAd(adId)
        : await adminApi.rejectAd(adId);
      setPendingAds((prev) => prev.filter((ad) => ad.id !== adId));
      setAllAds((prev) => prev.map((ad) => (ad.id === adId ? res.data.ad : ad)));
      if (decision === 'approve') {
        showMessage('success', 'Publicite approuvee');
      } else {
        showMessage('success', 'Publicite rejetee');
      }
      return res.data.ad;
    } catch (error: any) {
      console.error('Failed to review ad:', error);
      showMessage('error', error.response?.data?.error || 'Erreur lors de la revue de la publicite');
      return null;
    } finally {
      setReviewingAdId(null);
    }
  };

  const handleDeleteAdForever = async (adId: string) => {
    const confirmed = await confirm({
      title: 'Supprimer cette publicite ?',
      description: 'Cette action est irreversible.',
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setReviewingAdId(adId);
    try {
      await adminApi.deleteAdForever(adId);
      setPendingAds((prev) => prev.filter((ad) => ad.id !== adId));
      setAllAds((prev) => prev.filter((ad) => ad.id !== adId));
      showMessage('success', 'Publicite supprimee definitivement');
    } catch (error: any) {
      console.error('Failed to delete ad forever:', error);
      showMessage('error', error.response?.data?.error || 'Erreur lors de la suppression definitive de la publicite');
    } finally {
      setReviewingAdId(null);
    }
  };

  const handleToggleAdVisibility = async (adId: string, currentIsActive: boolean) => {
    setReviewingAdId(adId);
    try {
      const res = await adminApi.toggleAdVisibility(adId);
      setAllAds((prev) => prev.map((ad) => (ad.id === adId ? res.data.ad : ad)));
      showMessage('success', currentIsActive ? 'Publicité masquée' : 'Publicité visible');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur lors du changement de visibilité');
    } finally {
      setReviewingAdId(null);
    }
  };

  const openCreateBadge = () => {
    setEditingBadge(null);
    setBadgeForm({
      name: '', description: '', howToObtain: '',
      backgroundType: 'solid', backgroundColor: '#374151',
      backgroundGradient: '', backgroundImage: '',
      icon: '⭐', iconColor: '#ffffff', borderColor: '#6b7280',
      category: 'special', rarity: 'common',
      isAutomatic: false, autoConditionKey: '', isActive: true, isHidden: false,
    });
    setBadgeFormOpen(true);
  };

  const openEditBadge = (badge: Badge) => {
    setEditingBadge(badge);
    setBadgeForm({ ...badge });
    setBadgeFormOpen(true);
  };

  const handleSaveBadge = async () => {
    try {
      if (editingBadge) {
        await badgesApi.update(editingBadge.id, badgeForm);
        showMessage('success', 'Badge mis à jour');
      } else {
        await badgesApi.create(badgeForm);
        showMessage('success', 'Badge créé');
      }
      setBadgeFormOpen(false);
      await fetchBadges();
    } catch {
      showMessage('error', 'Erreur lors de la sauvegarde du badge');
    }
  };

  const handleDeleteBadge = async (badgeId: string) => {
    try {
      await badgesApi.delete(badgeId);
      showMessage('success', 'Badge supprimé');
      await fetchBadges();
    } catch {
      showMessage('error', 'Erreur lors de la suppression du badge');
    }
  };

  const handleAwardBadge = async () => {
    if (!awardBadgeUserId || !awardBadgeId) return;
    try {
      const res = await badgesApi.award({ userId: awardBadgeUserId, badgeId: awardBadgeId, reason: awardBadgeReason || undefined });
      showMessage('success', res.data.alreadyOwned ? 'L\'utilisateur possède déjà ce badge' : 'Badge attribué');
      setAwardBadgeUserId(''); setAwardBadgeId(''); setAwardBadgeReason('');
    } catch {
      showMessage('error', 'Erreur lors de l\'attribution du badge');
    }
  };

  const handleCheckAutoBadges = async () => {
    try {
      await badgesApi.checkAuto();
      showMessage('success', 'Vérification auto-badges effectuée');
      await fetchBadges();
    } catch {
      showMessage('error', 'Erreur lors de la vérification');
    }
  };

  // Activity tab state
  type OnlineHistoryPoint = { timestamp: string; count: number; max: number; usernames: { userId: string; username: string }[] };
  type ActivityChartPoint = OnlineHistoryPoint & { ts: number };
  type ActivityHoverState = { cursorTs: number; point: ActivityChartPoint };
  type OnlineStats = { current: number; allTimeRecord: number; allTimeRecordAt: string | null; avg1d: number; avg7d: number; avg30d: number; peak1d: number; peak7d: number; peak30d: number };
  type ReferralStats = {
    overview: {
      referralEnabled: boolean;
      rewardAmount: number;
      totalUsersWithCode: number;
      totalReferredUsers: number;
      approvedReferredUsers: number;
      pendingReferredUsers: number;
      rewardedReferrals: number;
      rewardPayoutTotal: number;
      conversionRate: number;
      pendingRate: number;
      stalePendingOlderThan7Days: number;
    };
    topReferrers: Array<{
      userId: string;
      username: string;
      referralCode: string | null;
      isApproved: boolean;
      totalReferrals: number;
      approvedReferrals: number;
      pendingReferrals: number;
      rewardedReferrals: number;
      totalRewardsGiven: number;
    }>;
  };
  type ActivityBreakdownChartPoint = { hour: number; hourLabel: string; total: number } & Record<string, string | number>;
  const [activityPeriod, setActivityPeriod] = useState<'day' | 'week' | 'month' | 'custom' | 'specific'>('day');
  const [activityCustomStart, setActivityCustomStart] = useState('');
  const [activityCustomEnd, setActivityCustomEnd] = useState('');
  const [activitySpecificDay, setActivitySpecificDay] = useState('');
  const [activityHistory, setActivityHistory] = useState<{ data: OnlineHistoryPoint[]; peak: number; peakAt: string | null; insights: OnlineHistoryInsights } | null>(null);
  const [onlineStats, setOnlineStats] = useState<OnlineStats | null>(null);
  const [activityBreakdownDay, setActivityBreakdownDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [activityBreakdown, setActivityBreakdown] = useState<AdminActivityBreakdown | null>(null);
  const [loadingActivityBreakdown, setLoadingActivityBreakdown] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [playtimeLeaderboard, setPlaytimeLeaderboard] = useState<{ leaderboard: any[]; period: string; start: string; end: string; totalEntries: number; limit: number } | null>(null);
  const [loadingPlaytimeLeaderboard, setLoadingPlaytimeLeaderboard] = useState(false);
  const [playtimePeriod, setPlaytimePeriod] = useState<'day' | 'week' | 'month' | 'custom'>('day');
  const [playtimeCustomStart, setPlaytimeCustomStart] = useState('');
  const [playtimeCustomEnd, setPlaytimeCustomEnd] = useState('');
  const [platformStats, setPlatformStats] = useState<null | { overview: { totalUsers: number; approvedUsers: number; totalAura: string; totalMoney: number; totalGamesPlayed: number; totalWins: number; totalTransfers: number; totalAuraTransferred: number; totalMoneyTransferred: number; totalWordsTyped: number }; topGames: Array<{ gameType: string; totalPlayed: number; wins: number }>; activityChart: Array<{ date: string; count: number }> }>(null);
  const [loadingPlatformStats, setLoadingPlatformStats] = useState(false);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [loadingReferralStats, setLoadingReferralStats] = useState(false);
  const [gamesLeaderboard, setGamesLeaderboard] = useState<any[]>([]);
  const [loadingGamesLeaderboard, setLoadingGamesLeaderboard] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [hoveredActivity, setHoveredActivity] = useState<ActivityHoverState | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityHoverState | null>(null);
  const [activityZoomDomain, setActivityZoomDomain] = useState<[number, number] | null>(null);
  const activityZoomDomainRef = useRef<[number, number] | null>(null);
  const activityFullDomainRef = useRef<[number, number]>([0, 0]);
  const activityChartDataRef = useRef<ActivityChartPoint[]>([]);
  const activityChartRef = useRef<HTMLDivElement>(null);
  const activityPanRef = useRef<{ pointerId: number; startClientX: number; domain: [number, number] } | null>(null);
  const activityDidPanRef = useRef(false);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [inventoryUser, setInventoryUser] = useState<AdminUser | null>(null);
  const [inventoryItems, setInventoryItems] = useState<AdminInventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventoryQuantities, setInventoryQuantities] = useState<Record<string, number>>({});
  const [inventoryAddItemId, setInventoryAddItemId] = useState<string>('');
  const [inventoryAddQuantity, setInventoryAddQuantity] = useState(1);
  const [addingInventoryItem, setAddingInventoryItem] = useState(false);
  const [updatingInventoryItem, setUpdatingInventoryItem] = useState<string | null>(null);
  const [removingInventoryItem, setRemovingInventoryItem] = useState<string | null>(null);

  // Clans state
  const [clans, setClans] = useState<AdminClan[]>([]);
  const [loadingClans, setLoadingClans] = useState(false);
  const [editingClanId, setEditingClanId] = useState<string | null>(null);
  const [clanSearchQuery, setClanSearchQuery] = useState('');
  const [clanForm, setClanForm] = useState<{ name: string; description: string; imageUrl: string; maxMembers: number; isPublic: boolean; tagUnlocked: boolean }>({
    name: '',
    description: '',
    imageUrl: '',
    maxMembers: 5,
    isPublic: true,
    tagUnlocked: false,
  });
  const [savingClan, setSavingClan] = useState(false);
  const [deletingClan, setDeletingClan] = useState<string | null>(null);
  const [transferringClanLeader, setTransferringClanLeader] = useState<string | null>(null);
  const [clanEvents, setClanEvents] = useState<AdminClanEvent[]>([]);
  const [loadingClanEvents, setLoadingClanEvents] = useState(false);
  const [editingClanEventId, setEditingClanEventId] = useState<string | null>(null);
  const [clanEventForm, setClanEventForm] = useState<ClanEventForm>(DEFAULT_CLAN_EVENT_FORM);
  const [savingClanEvent, setSavingClanEvent] = useState(false);
  const [deletingClanEvent, setDeletingClanEvent] = useState<string | null>(null);

  // Items state
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormData>(defaultItemForm);
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);
  const [importingItems, setImportingItems] = useState(false);
  const itemImportInputRef = useRef<HTMLInputElement>(null);

  // DJ forced skin state
  const [djForcedSkinId, setDjForcedSkinId] = useState<string | null>(null);
  const [djForcedSkinLoading, setDjForcedSkinLoading] = useState(false);
  const [djForcedSkinSaving, setDjForcedSkinSaving] = useState(false);
  const [djForcedSkinSelected, setDjForcedSkinSelected] = useState<string>('__none__');

  // Shop categories state
  const [shopCategories, setShopCategories] = useState<ShopCategory[]>([
    { id: 'COSMETIC', label: 'Cosmétiques' },
    { id: 'CONSUMABLE', label: 'Objets' },
    { id: 'UPGRADE', label: 'Améliorations' },
  ]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [savingCategories, setSavingCategories] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newCategoryLabel, setNewCategoryLabel] = useState('');

  // Bug reports state
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loadingBugs, setLoadingBugs] = useState(false);
  const [updatingBug, setUpdatingBug] = useState<string | null>(null);
  const [bugReply, setBugReply] = useState<Record<string, string>>({});
  const [selectedInboxItem, setSelectedInboxItem] = useState<string | null>(null);
  const [inboxFilter, setInboxFilter] = useState<'all' | 'registrations' | 'bugs' | 'appeals' | 'namechanges' | 'badges' | 'formations' | 'sanctions' | 'archived'>('all');

  // Pending users state
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [approvingUser, setApprovingUser] = useState<string | null>(null);
  const [rejectingUser, setRejectingUser] = useState<string | null>(null);
  const [archivedRegistrations, setArchivedRegistrations] = useState<ArchivedRegistration[]>([]);
  const [importingArchivedRegistrations, setImportingArchivedRegistrations] = useState(false);
  const [legacyArchivedRegistrationsCount, setLegacyArchivedRegistrationsCount] = useState(() => parseLegacyArchivedRegistrations().length);

  // Ban appeals state
  const [banAppeals, setBanAppeals] = useState<BanAppeal[]>([]);
  const [loadingAppeals, setLoadingAppeals] = useState(false);
  const [reviewingAppeal, setReviewingAppeal] = useState<string | null>(null);

  // Name change requests state
  const [nameChangeRequests, setNameChangeRequests] = useState<NameChangeRequest[]>([]);
  const [loadingNameChanges, setLoadingNameChanges] = useState(false);
  const [reviewingNameChange, setReviewingNameChange] = useState<string | null>(null);

  // Ban management state
  const [bans, setBans] = useState<Ban[]>([]);
  const [loadingBans, setLoadingBans] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banUserId, setBanUserId] = useState<string>('');
  const [banReason, setBanReason] = useState('');
  const [banType, setBanType] = useState<'TEMPORARY' | 'PERMANENT'>('TEMPORARY');
  const [banDuration, setBanDuration] = useState(24);
  const [creatingBan, setCreatingBan] = useState(false);
  const [unbanning, setUnbanning] = useState<string | null>(null);

  // Admin warnings state
  const [warnings, setWarnings] = useState<AdminWarning[]>([]);
  const [loadingWarnings, setLoadingWarnings] = useState(false);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [warningUserId, setWarningUserId] = useState<string>('');
  const [warningType, setWarningType] = useState<'AVERTISSEMENT' | 'AMENDE'>('AVERTISSEMENT');
  const [warningMessage, setWarningMessage] = useState('');
  const [warningSeverity, setWarningSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [amendeAmount, setAmendeAmount] = useState<number>(100);
  const [creatingWarning, setCreatingWarning] = useState(false);
  const [deletingWarning, setDeletingWarning] = useState<string | null>(null);

  // Fiscal / pending sanctions state
  const [fiscalUsers, setFiscalUsers] = useState<FiscalUser[]>([]);
  const [loadingFiscalUsers, setLoadingFiscalUsers] = useState(false);
  const [pendingSanctions, setPendingSanctions] = useState<PendingSanction[]>([]);
  const [loadingPendingSanctions, setLoadingPendingSanctions] = useState(false);
  const [showFiscalSanctionModal, setShowFiscalSanctionModal] = useState(false);
  const [approvingSanction, setApprovingSanction] = useState<string | null>(null);
  const [rejectingSanction, setRejectingSanction] = useState<string | null>(null);
  const [fiscalFundBalance, setFiscalFundBalance] = useState(0);
  const [fiscalFundRatePercent, setFiscalFundRatePercent] = useState(10);
  const [fiscalPaymentSource, setFiscalPaymentSource] = useState<FiscalInspectorSettings['paymentSource']>('ACCOUNT');
  const [savingFiscalPaymentSource, setSavingFiscalPaymentSource] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState({
    type: 'ALL',
    username: '',
    gameType: 'ALL',
  });
  const [logTimelineEnabled, setLogTimelineEnabled] = useState(false);
  const [logTimelineDate, setLogTimelineDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logTimelineRange, setLogTimelineRange] = useState<[number, number]>([0, 1439]);
  const [logsPage, setLogsPage] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const logsPerPage = 50;
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [downloadLogsOpen, setDownloadLogsOpen] = useState(false);
  const [downloadLogsMode, setDownloadLogsMode] = useState<'range' | 'all'>('range');
  const [downloadLogsStartDate, setDownloadLogsStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().slice(0, 10);
  });
  const [downloadLogsEndDate, setDownloadLogsEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [downloadingLogs, setDownloadingLogs] = useState(false);
  const [downloadLogsError, setDownloadLogsError] = useState<string | null>(null);

  // Score history backfill
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployOutput, setDeployOutput] = useState<{ success: boolean; stdout: string; stderr: string; message: string } | null>(null);
  const [deployModalOpen, setDeployModalOpen] = useState(false);

  // Settings state
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceAutoWeekendEnabled, setMaintenanceAutoWeekendEnabled] = useState(false);
  const [maintenanceEndDate, setMaintenanceEndDate] = useState<string>('');
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [blockedPages, setBlockedPages] = useState<string[]>([]);
  const [blockedMessage, setBlockedMessage] = useState('');
  const [blockedPageMessages, setBlockedPageMessages] = useState<Record<string, string>>({});
  const [savingBlocks, setSavingBlocks] = useState(false);
  const [fonctionnalitesOpen, setFonctionnalitesOpen] = useState(false);
  const [fakeOnlineEnabled, setFakeOnlineEnabled] = useState(true);
  const [savingFakeOnline, setSavingFakeOnline] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [chatBlockEnabled, setChatBlockEnabled] = useState(false);
  const [chatAutoBlockEnabled, setChatAutoBlockEnabled] = useState(false);
  const [chatAutoBlockStart, setChatAutoBlockStart] = useState('22:00');
  const [chatAutoBlockEnd, setChatAutoBlockEnd] = useState('07:00');
  const [chatBlockMessage, setChatBlockMessage] = useState('Le chat est temporairement bloque par l administration.');
  const [savingChatBlockSettings, setSavingChatBlockSettings] = useState(false);
  const [duelMatchmakingEnabled, setDuelMatchmakingEnabled] = useState(true);
  const [savingDuelMatchmakingEnabled, setSavingDuelMatchmakingEnabled] = useState(false);
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [referralDashboardCardEnabled, setReferralDashboardCardEnabled] = useState(true);
  const [savingReferralDashboardCardEnabled, setSavingReferralDashboardCardEnabled] = useState(false);
  const [savingReferralEnabled, setSavingReferralEnabled] = useState(false);
  const [referralRewardAmount, setReferralRewardAmount] = useState('250');
  const [savingReferralReward, setSavingReferralReward] = useState(false);
  const [dailyAuraDistributionLimit, setDailyAuraDistributionLimit] = useState('100');
  const [savingDailyAuraDistributionLimit, setSavingDailyAuraDistributionLimit] = useState(false);
  const [dailyGameAuraLimit, setDailyGameAuraLimit] = useState('500');
  const [dailyGameMoneyLimit, setDailyGameMoneyLimit] = useState('1000');
  const [savingDailyGameLimits, setSavingDailyGameLimits] = useState(false);
  const [taxBrackets, setTaxBrackets] = useState<EditableTaxBracket[]>([DEFAULT_TAX_BRACKET]);
  const [loadingTaxSettings, setLoadingTaxSettings] = useState(false);
  const [savingTaxSettings, setSavingTaxSettings] = useState(false);
  const [runningTaxNow, setRunningTaxNow] = useState(false);
  const [taxLastRunDate, setTaxLastRunDate] = useState<string | null>(null);
  const [auraCoinBuyFeePercentage, setAuraCoinBuyFeePercentage] = useState('0.02');
  const [savingAuraCoinBuyFee, setSavingAuraCoinBuyFee] = useState(false);
  const [stableCoinBuyFeePercentage, setStableCoinBuyFeePercentage] = useState('0.01');
  const [savingStableCoinBuyFee, setSavingStableCoinBuyFee] = useState(false);
  const [chaosCoinBuyFeePercentage, setChaosCoinBuyFeePercentage] = useState('0.035');
  const [savingChaosCoinBuyFee, setSavingChaosCoinBuyFee] = useState(false);
  const [clashAttackCooldownMinutes, setClashAttackCooldownMinutes] = useState('10');
  const [savingClashAttackCooldown, setSavingClashAttackCooldown] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');
  const [loginRegisterCtaEnabled, setLoginRegisterCtaEnabled] = useState(true);
  const [defaultLandingPage, setDefaultLandingPage] = useState(DEFAULT_LANDING_PAGE);
  const [youLogoAdminOnly, setYouLogoAdminOnly] = useState(false);
  const [savingLoginMessage, setSavingLoginMessage] = useState(false);
  const [savingLoginRegisterCta, setSavingLoginRegisterCta] = useState(false);
  const [savingDefaultLandingPage, setSavingDefaultLandingPage] = useState(false);
  const [savingYouLogoAdminOnly, setSavingYouLogoAdminOnly] = useState(false);
  // Business admin controls
  const [businessCreationEnabled, setBusinessCreationEnabled] = useState(true);
  const [savingBusinessCreation, setSavingBusinessCreation] = useState(false);
  const [purgingBusinesses, setPurgingBusinesses] = useState(false);
  const [resettingUnlockLevels, setResettingUnlockLevels] = useState(false);
  const uploadItemImageFile = async (file: File): Promise<string> => {
    try {
      const { base64Data, mimeType } = await prepareImageUploadPayload(file);
      const res = await adminApi.uploadItemImage({ base64Data, mimeType });
      showMessage('success', 'Image téléchargée');
      return res.data.imageUrl;
    } catch {
      showMessage('error', 'Erreur lors du téléchargement de l\'image');
      throw new Error();
    }
  };

  const toggleLogExpand = (logId: string) => {
    setExpandedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  // Debounced search effect
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      fetchLogs(0);
    }, 300);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [logFilter.username]);

  // Redirect non-admin users (fiscal inspectors and judges are allowed for read-only access)
  if (!user?.isAdmin && !user?.isFiscalInspector && !user?.isJudge) {
    return <Navigate to="/" replace />;
  }

  // Fiscal inspectors and judges can only access logs, taxes, and fiscal tabs
  const FISCAL_INSPECTOR_TABS: AdminTab[] = ['logs', 'taxes', 'fiscal'];
  const isReadOnlyInspectionUser = Boolean((user?.isFiscalInspector || user?.isJudge) && !user?.isAdmin);

  useEffect(() => {
    if (isReadOnlyInspectionUser) {
      fetchLogs();
      fetchLogStats();
      fetchTaxSettings();
      fetchFiscalUsers();
      return;
    }

    fetchUsers();
    fetchClans();
    fetchClanEvents();
    fetchItems();
    fetchDjForcedSkin();
    fetchShopCategories();
    fetchBugReports();
    fetchPendingUsers();
    fetchRegistrationReviews();
    fetchBans();
    fetchWarnings();
    fetchPendingSanctions('ALL');
    fetchBanAppeals();
    fetchNameChangeRequests();
    fetchBadges();
    fetchCustomBadgeRequests();
    fetchPendingFormationReviews();
    fetchPendingAds();
    fetchAllAds();
    fetchLogs();
    fetchLogStats();
    fetchSettings();
    fetchTaxSettings();
    fetchActivity('day');
    fetchActivityBreakdown(new Date().toISOString().slice(0, 10));
    fetchPlatformStats();
    fetchReferralStats();
    fetchGamesLeaderboard();
    fetchSupportThreads();
    fetchSupportReports();
    fetchSurveys();
  }, [isReadOnlyInspectionUser]);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab && ADMIN_TABS.includes(tab as AdminTab)) {
      setActiveTab(tab as AdminTab);
    }
  }, [location.search]);

  useEffect(() => {
    if (isReadOnlyInspectionUser && !FISCAL_INSPECTOR_TABS.includes(activeTab)) {
      setActiveTab('fiscal');
    }
  }, [isReadOnlyInspectionUser, activeTab]);

  useEffect(() => {
    if (activeTab !== 'chat-history' || isReadOnlyInspectionUser) {
      return;
    }
    if (chatHistoryDays.length === 0 && !loadingChatHistoryDays) {
      void fetchChatHistoryDays();
    }
  }, [activeTab, isReadOnlyInspectionUser, chatHistoryDays.length, loadingChatHistoryDays]);

  useEffect(() => {
    if (activeTab !== 'chat-history' || !chatHistoryDay) {
      return;
    }
    void fetchChatHistoryDay(chatHistoryDay, showDeletedChatMessages);
  }, [activeTab, chatHistoryDay, showDeletedChatMessages]);

  // Real-time support messages for admin
  useEffect(() => {
    if (!socket) return;
    const handleSupportMessage = (data: { message: SupportMessage; username?: string }) => {
      const msg = data.message;
      setSupportThreads((prev) => {
        const existing = prev.find((t) => t.userId === msg.userId);
        if (existing) {
          return prev.map((t) =>
            t.userId === msg.userId
              ? {
                  ...t,
                  lastBody: msg.body,
                  lastFromAdmin: msg.fromAdmin,
                  lastCreatedAt: msg.createdAt,
                  unreadCount: !msg.fromAdmin && activeThreadUserId !== msg.userId ? t.unreadCount + 1 : t.unreadCount,
                }
              : t
          ).sort((a, b) => new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime());
        }
        return [
          {
            userId: msg.userId,
            user: null,
            lastBody: msg.body,
            lastFromAdmin: msg.fromAdmin,
            lastCreatedAt: msg.createdAt,
            unreadCount: !msg.fromAdmin ? 1 : 0,
          },
          ...prev,
        ];
      });
      if (activeThreadUserId === msg.userId) {
        setActiveThreadMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };
    socket.on('support:message', handleSupportMessage);
    socket.on('messaging:report', fetchSupportReports);
    return () => {
      socket.off('support:message', handleSupportMessage);
      socket.off('messaging:report', fetchSupportReports);
    };
  }, [socket, activeThreadUserId]);

  useEffect(() => {
    supportMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadMessages]);

  const fetchActivityBreakdown = async (date = activityBreakdownDay) => {
    try {
      setLoadingActivityBreakdown(true);
      const res = await adminApi.getActivityBreakdown(date);
      setActivityBreakdown(res.data);
    } catch (error) {
      console.error('Failed to fetch activity breakdown:', error);
    } finally {
      setLoadingActivityBreakdown(false);
    }
  };

  const fetchPlaytimeLeaderboard = async (period?: 'day' | 'week' | 'month' | 'custom', customStart?: string, customEnd?: string) => {
    try {
      setLoadingPlaytimeLeaderboard(true);
      const p = period ?? playtimePeriod;
      const params: Record<string, any> = { period: p, limit: 50 };
      if (p === 'custom') {
        params.startDate = customStart ?? playtimeCustomStart;
        params.endDate = customEnd ?? playtimeCustomEnd;
      }
      const res = await adminApi.getPlaytimeLeaderboard(params);
      setPlaytimeLeaderboard(res.data);
    } catch (error) {
      console.error('Failed to fetch playtime leaderboard:', error);
    } finally {
      setLoadingPlaytimeLeaderboard(false);
    }
  };

  const fetchPlatformStats = async () => {
    try {
      setLoadingPlatformStats(true);
      const res = await adminApi.getPlatformStats();
      setPlatformStats(res.data);
    } catch (error) {
      console.error('Failed to fetch platform stats:', error);
    } finally {
      setLoadingPlatformStats(false);
    }
  };

  const fetchReferralStats = async () => {
    try {
      setLoadingReferralStats(true);
      const res = await adminApi.getReferralStats();
      setReferralStats(res.data);
    } catch (error) {
      console.error('Failed to fetch referral stats:', error);
    } finally {
      setLoadingReferralStats(false);
    }
  };

  const downloadStatsCSV = () => {
    if (!platformStats) return;
    const { overview, topGames, activityChart } = platformStats;
    const now = new Date().toISOString().slice(0, 10);

    const sections: string[] = [];

    // Overview
    sections.push('# Vue d\'ensemble');
    sections.push([
      'Membres inscrits', 'Membres actifs', 'Aura totale', 'Argent total',
      'Parties jouées', 'Victoires', 'Transferts', 'Aura échangée',
      'Argent échangé', 'Mots tapés (Bombe)',
    ].join(','));
    sections.push([
      overview.totalUsers, overview.approvedUsers, overview.totalAura, overview.totalMoney,
      overview.totalGamesPlayed, overview.totalWins, overview.totalTransfers, overview.totalAuraTransferred,
      overview.totalMoneyTransferred, overview.totalWordsTyped,
    ].join(','));

    sections.push('');

    // Top games
    sections.push('# Top jeux');
    sections.push('Jeu,Parties jouées,Victoires');
    topGames.forEach(g => sections.push(`${g.gameType},${g.totalPlayed},${g.wins}`));

    sections.push('');

    // Activity chart (30 days)
    sections.push('# Parties / jour (30 derniers jours)');
    sections.push('Date,Parties');
    activityChart.forEach(d => sections.push(`${d.date},${d.count}`));

    const blob = new Blob([sections.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auratracker-stats-${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchGamesLeaderboard = async () => {
    try {
      setLoadingGamesLeaderboard(true);
      const res = await leaderboardsApi.get('games_played', { limit: 20 });
      setGamesLeaderboard((res.data as any).rankings ?? []);
    } catch (error) {
      console.error('Failed to fetch games leaderboard:', error);
    } finally {
      setLoadingGamesLeaderboard(false);
    }
  };

  const setActivityDomain = (domain: [number, number] | null) => {
    activityZoomDomainRef.current = domain;
    setActivityZoomDomain(domain ? [...domain] : null);
  };

  const getActivityPlotMetrics = () => {
    const el = activityChartRef.current;
    if (!el) return null;
    const rightOffset = 4;
    const rect = el.getBoundingClientRect();
    const yAxisEl = el.querySelector('.recharts-yAxis');
    const plotAreaLeft = yAxisEl ? yAxisEl.getBoundingClientRect().right - rect.left : 16;
    const chartWidth = rect.width - plotAreaLeft - rightOffset;
    if (chartWidth <= 0) return null;
    return { rect, plotAreaLeft, chartWidth };
  };

  const zoomActivityDomain = (zoomFactor: number, anchorFraction = 0.5) => {
    const [fullStart, fullEnd] = activityFullDomainRef.current;
    if (fullEnd <= fullStart) return;
    const [currentStart, currentEnd] = activityZoomDomainRef.current ?? [fullStart, fullEnd];
    const currentRange = currentEnd - currentStart;
    const fullRange = fullEnd - fullStart;
    const minRange = Math.max(fullRange / 500, 5 * 60 * 1000);
    const clampedAnchorFraction = Math.max(0, Math.min(1, anchorFraction));
    const anchorTs = currentStart + clampedAnchorFraction * currentRange;
    const newRange = Math.max(minRange, Math.min(currentRange * zoomFactor, fullRange));
    let newStart = anchorTs - clampedAnchorFraction * newRange;
    let newEnd = anchorTs + (1 - clampedAnchorFraction) * newRange;
    if (newStart < fullStart) { newEnd += fullStart - newStart; newStart = fullStart; }
    if (newEnd > fullEnd) { newStart -= newEnd - fullEnd; newEnd = fullEnd; }
    newStart = Math.max(fullStart, newStart);
    newEnd = Math.min(fullEnd, newEnd);
    setActivityDomain([newStart, newEnd]);
  };

  const panActivityDomain = (deltaMs: number) => {
    const [fullStart, fullEnd] = activityFullDomainRef.current;
    if (fullEnd <= fullStart) return;
    const [currentStart, currentEnd] = activityZoomDomainRef.current ?? [fullStart, fullEnd];
    const currentRange = currentEnd - currentStart;
    const fullRange = fullEnd - fullStart;
    if (currentRange >= fullRange) return;
    let newStart = currentStart + deltaMs;
    let newEnd = currentEnd + deltaMs;
    if (newStart < fullStart) {
      newEnd += fullStart - newStart;
      newStart = fullStart;
    }
    if (newEnd > fullEnd) {
      newStart -= newEnd - fullEnd;
      newEnd = fullEnd;
    }
    setActivityDomain([newStart, newEnd]);
  };

  const resolveActivityHoverState = (clientX: number): ActivityHoverState | null => {
    const metrics = getActivityPlotMetrics();
    const chartData = activityChartDataRef.current;
    if (!metrics || chartData.length === 0) return null;
    const [fullStart, fullEnd] = activityFullDomainRef.current;
    const [viewStart, viewEnd] = activityZoomDomainRef.current ?? [fullStart, fullEnd];
    if (viewEnd <= viewStart) return null;
    const mouseX = clientX - metrics.rect.left - metrics.plotAreaLeft;
    const fraction = Math.max(0, Math.min(1, mouseX / metrics.chartWidth));
    const cursorTs = viewStart + fraction * (viewEnd - viewStart);

    let low = 0;
    let high = chartData.length - 1;
    let resolvedIndex = 0;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (chartData[mid].ts <= cursorTs) {
        resolvedIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return {
      cursorTs,
      point: chartData[resolvedIndex],
    };
  };

  const handleActivityPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = activityChartRef.current;
    if (!el) return;
    const [fullStart, fullEnd] = activityFullDomainRef.current;
    const [currentStart, currentEnd] = activityZoomDomainRef.current ?? [fullStart, fullEnd];
    activityPanRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      domain: [currentStart, currentEnd],
    };
    activityDidPanRef.current = false;
    el.setPointerCapture(e.pointerId);
  };

  const handleActivityPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const panState = activityPanRef.current;
    if (!panState || panState.pointerId !== e.pointerId) {
      if (!selectedActivity) {
        setHoveredActivity(resolveActivityHoverState(e.clientX));
      }
      return;
    }
    const metrics = getActivityPlotMetrics();
    if (!metrics) return;
    const [fullStart, fullEnd] = activityFullDomainRef.current;
    const fullRange = fullEnd - fullStart;
    const [domainStart, domainEnd] = panState.domain;
    const domainRange = domainEnd - domainStart;
    if (domainRange >= fullRange) {
      if (!selectedActivity) {
        setHoveredActivity(resolveActivityHoverState(e.clientX));
      }
      return;
    }
    const deltaX = e.clientX - panState.startClientX;
    if (Math.abs(deltaX) > 3) activityDidPanRef.current = true;
    let newStart = domainStart - (deltaX / metrics.chartWidth) * domainRange;
    let newEnd = domainEnd - (deltaX / metrics.chartWidth) * domainRange;
    if (newStart < fullStart) {
      newEnd += fullStart - newStart;
      newStart = fullStart;
    }
    if (newEnd > fullEnd) {
      newStart -= newEnd - fullEnd;
      newEnd = fullEnd;
    }
    setActivityDomain([newStart, newEnd]);
    if (!selectedActivity) {
      setHoveredActivity(resolveActivityHoverState(e.clientX));
    }
  };

  const handleActivityPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = activityChartRef.current;
    const panState = activityPanRef.current;
    if (panState && panState.pointerId === e.pointerId && !activityDidPanRef.current) {
      const nextSelection = resolveActivityHoverState(e.clientX);
      setSelectedActivity((prev) => {
        if (!nextSelection) return prev;
        if (prev?.point.timestamp === nextSelection.point.timestamp) return null;
        return nextSelection;
      });
      setHoveredActivity(nextSelection);
    }
    if (el && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
    activityPanRef.current = null;
    window.setTimeout(() => {
      activityDidPanRef.current = false;
    }, 0);
  };

  const handleActivityPointerLeave = () => {
    if (!activityPanRef.current && !selectedActivity) {
      setHoveredActivity(null);
    }
  };

  // Scroll-wheel horizontal zoom for the activity chart
  useEffect(() => {
    const el = activityChartRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const metrics = getActivityPlotMetrics();
      if (!metrics) return;
      const { rect, plotAreaLeft, chartWidth } = metrics;
      const mouseX = e.clientX - rect.left - plotAreaLeft;
      const fraction = Math.max(0, Math.min(1, mouseX / chartWidth));
      const zoomFactor = e.deltaY > 0 ? 1.25 : 1 / 1.25;
      zoomActivityDomain(zoomFactor, fraction);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [activityHistory]);


  const fetchUsers = async () => {
    try {
      const res = await adminApi.getUsers();
      setUsers(res.data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      showMessage('error', 'Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      setLoadingItems(true);
      const [itemsRes] = await Promise.all([
        adminApi.getItems(),
      ]);
      setItems(itemsRes.data.items);
    } catch (error) {
      console.error('Failed to fetch items:', error);
      showMessage('error', 'Erreur lors du chargement des objets');
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchDjForcedSkin = async () => {
    setDjForcedSkinLoading(true);
    try {
      const res = await adminApi.getDjForcedSkin();
      setDjForcedSkinId(res.data.itemId);
      setDjForcedSkinSelected(res.data.itemId ?? '__none__');
    } catch { /**/ } finally {
      setDjForcedSkinLoading(false);
    }
  };

  const saveDjForcedSkin = async () => {
    setDjForcedSkinSaving(true);
    try {
      const id = djForcedSkinSelected === '__none__' ? null : djForcedSkinSelected;
      const res = await adminApi.setDjForcedSkin(id);
      setDjForcedSkinId(res.data.itemId);
      showMessage('success', id ? 'Apparence forcée appliquée' : 'Rotation normale rétablie');
    } catch { showMessage('error', 'Erreur'); } finally {
      setDjForcedSkinSaving(false);
    }
  };

  const fetchShopCategories = async () => {
    try {
      setLoadingCategories(true);
      const res = await adminApi.getShopCategories();
      setShopCategories(res.data.categories);
    } catch (error) {
      console.error('Failed to fetch shop categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const saveShopCategories = async (cats: ShopCategory[]) => {
    try {
      setSavingCategories(true);
      const res = await adminApi.updateShopCategories(cats);
      setShopCategories(res.data.categories);
      showMessage('success', 'Catégories sauvegardées');
    } catch (error) {
      showMessage('error', 'Erreur lors de la sauvegarde des catégories');
    } finally {
      setSavingCategories(false);
    }
  };

  const addShopCategory = () => {
    const id = newCategoryId.trim().toUpperCase().replace(/\s+/g, '_');
    const label = newCategoryLabel.trim();
    if (!id || !label) return;
    if (shopCategories.find((c) => c.id === id)) {
      showMessage('error', 'Une catégorie avec cet identifiant existe déjà');
      return;
    }
    const updated = [...shopCategories, { id, label }];
    setShopCategories(updated);
    setNewCategoryId('');
    setNewCategoryLabel('');
    saveShopCategories(updated);
  };

  const removeShopCategory = (id: string) => {
    const updated = shopCategories.filter((c) => c.id !== id);
    setShopCategories(updated);
    saveShopCategories(updated);
  };

  const fetchClans = async () => {
    try {
      setLoadingClans(true);
      const res = await adminApi.getClans();
      setClans(res.data.clans);
    } catch (error) {
      console.error('Failed to fetch clans:', error);
      showMessage('error', 'Erreur lors du chargement des clans');
    } finally {
      setLoadingClans(false);
    }
  };

  const fetchClanEvents = async () => {
    try {
      setLoadingClanEvents(true);
      const res = await adminApi.getClanEvents();
      setClanEvents(res.data.events);
    } catch (error) {
      console.error('Failed to fetch clan events:', error);
      showMessage('error', 'Erreur lors du chargement des événements de clan');
    } finally {
      setLoadingClanEvents(false);
    }
  };


  const fetchBugReports = async () => {
    try {
      setLoadingBugs(true);
      const res = await adminApi.getBugReports();
      setBugReports(res.data.bugReports);
    } catch (error) {
      console.error('Failed to fetch bug reports:', error);
      showMessage('error', 'Erreur lors du chargement des bugs');
    } finally {
      setLoadingBugs(false);
    }
  };

  const fetchPendingUsers = async () => {
    try {
      setLoadingPending(true);
      const res = await adminApi.getPendingUsers();
      setPendingUsers(res.data.pendingUsers);
    } catch (error) {
      console.error('Failed to fetch pending users:', error);
      showMessage('error', 'Erreur lors du chargement des demandes');
    } finally {
      setLoadingPending(false);
    }
  };

  const fetchRegistrationReviews = async () => {
    try {
      const res = await adminApi.getRegistrationReviews();
      setArchivedRegistrations(res.data.registrationReviews.map(mapRegistrationReviewToArchivedRegistration));
    } catch (error) {
      console.error('Failed to fetch registration reviews:', error);
      showMessage('error', 'Erreur lors du chargement des inscriptions archivées');
    }
  };

  const fetchBanAppeals = async () => {
    try {
      setLoadingAppeals(true);
      const res = await adminApi.getBanAppeals();
      setBanAppeals(res.data.banAppeals);
    } catch (error) {
      console.error('Failed to fetch ban appeals:', error);
    } finally {
      setLoadingAppeals(false);
    }
  };

  const fetchNameChangeRequests = async () => {
    try {
      setLoadingNameChanges(true);
      const res = await adminApi.getNameChangeRequests();
      setNameChangeRequests(res.data.nameChangeRequests);
    } catch (error) {
      console.error('Failed to fetch name change requests:', error);
    } finally {
      setLoadingNameChanges(false);
    }
  };

  const fetchBans = async () => {
    try {
      setLoadingBans(true);
      const res = await adminApi.getBans();
      setBans(res.data.bans);
    } catch (error) {
      console.error('Failed to fetch bans:', error);
      showMessage('error', 'Erreur lors du chargement des bannissements');
    } finally {
      setLoadingBans(false);
    }
  };

  const fetchWarnings = async () => {
    try {
      setLoadingWarnings(true);
      const res = await adminApi.getWarnings();
      setWarnings(res.data.warnings);
    } catch (error) {
      console.error('Failed to fetch warnings:', error);
      showMessage('error', 'Erreur lors du chargement des avertissements');
    } finally {
      setLoadingWarnings(false);
    }
  };

  const fetchFiscalUsers = async () => {
    try {
      setLoadingFiscalUsers(true);
      const res = await sanctionsApi.getFiscalUsers();
      setFiscalUsers(res.data.users);
      const settings = res.data.fiscalInspectorSettings;
      if (settings) {
        setFiscalFundBalance(settings.fundBalance);
        setFiscalFundRatePercent(settings.fundRatePercent);
        setFiscalPaymentSource(settings.paymentSource);
      }
    } catch (error) {
      console.error('Failed to fetch fiscal users:', error);
    } finally {
      setLoadingFiscalUsers(false);
    }
  };

  const saveFiscalPaymentSource = async (paymentSource: FiscalInspectorSettings['paymentSource']) => {
    try {
      setSavingFiscalPaymentSource(true);
      const res = await sanctionsApi.updateFiscalSettings({ paymentSource });
      setFiscalPaymentSource(res.data.settings.paymentSource);
      setFiscalFundBalance(res.data.settings.fundBalance);
      setFiscalFundRatePercent(res.data.settings.fundRatePercent);
      showMessage('success', 'Source de paiement fiscale mise à jour');
    } catch (error) {
      console.error('Failed to update fiscal settings:', error);
      showMessage('error', 'Erreur lors de la mise à jour de la source de paiement');
    } finally {
      setSavingFiscalPaymentSource(false);
    }
  };

  const fetchPendingSanctions = async (status: 'PENDING' | 'ALL' = 'PENDING') => {
    try {
      setLoadingPendingSanctions(true);
      const res = await sanctionsApi.listPendingSanctions(status === 'PENDING' ? 'PENDING' : undefined);
      setPendingSanctions(res.data.sanctions);
    } catch (error) {
      console.error('Failed to fetch pending sanctions:', error);
    } finally {
      setLoadingPendingSanctions(false);
    }
  };

  const approveSanction = async (id: string) => {
    try {
      setApprovingSanction(id);
      const res = await sanctionsApi.approveSanction(id);
      setPendingSanctions((prev) => prev.map((s) => s.id === id ? res.data.sanction : s));
      showMessage('success', 'Sanction approuvée et exécutée');
    } catch (error) {
      console.error('Failed to approve sanction:', error);
      showMessage('error', 'Erreur lors de l\'approbation');
    } finally {
      setApprovingSanction(null);
    }
  };

  const rejectSanction = async (id: string) => {
    try {
      setRejectingSanction(id);
      const res = await sanctionsApi.rejectSanction(id);
      setPendingSanctions((prev) => prev.map((s) => s.id === id ? res.data.sanction : s));
      showMessage('success', 'Sanction refusée');
    } catch (error) {
      console.error('Failed to reject sanction:', error);
      showMessage('error', 'Erreur lors du refus');
    } finally {
      setRejectingSanction(null);
    }
  };

  const createWarning = async () => {
    if (!warningUserId || !warningMessage.trim()) {
      showMessage('error', 'Utilisateur et message requis');
      return;
    }
    if (warningType === 'AMENDE' && (!amendeAmount || amendeAmount <= 0)) {
      showMessage('error', 'Montant requis pour une amende');
      return;
    }
    try {
      setCreatingWarning(true);
      const res = await adminApi.createWarning({
        userId: warningUserId,
        type: warningType,
        message: warningMessage.trim(),
        severity: warningSeverity,
        amount: warningType === 'AMENDE' ? amendeAmount : undefined,
      });
      setWarnings((prev) => [res.data.warning, ...prev]);
      setWarningDialogOpen(false);
      setWarningUserId('');
      setWarningMessage('');
      setWarningType('AVERTISSEMENT');
      setWarningSeverity('MEDIUM');
      setAmendeAmount(100);
      showMessage('success', res.data.message || (warningType === 'AMENDE' ? 'Amende envoyée' : 'Avertissement envoyé'));
    } catch (error) {
      console.error('Failed to create warning:', error);
      showMessage('error', 'Erreur lors de l\'envoi de l\'avertissement');
    } finally {
      setCreatingWarning(false);
    }
  };

  const deleteWarning = async (id: string) => {
    try {
      setDeletingWarning(id);
      await adminApi.deleteWarning(id);
      setWarnings((prev) => prev.filter((w) => w.id !== id));
      showMessage('success', 'Avertissement supprimé');
    } catch (error) {
      console.error('Failed to delete warning:', error);
      showMessage('error', 'Erreur lors de la suppression');
    } finally {
      setDeletingWarning(null);
    }
  };

  const createSurvey = async () => {
    const trimmedTitle = surveyTitle.trim();
    const trimmedDescription = surveyDescription.trim();
    const cleanedOptions = surveyOptions
      .map((option) => ({
        label: option.label.trim(),
        color: option.color,
        imageUrl: option.imageUrl,
      }))
      .filter((option) => option.label);

    if (trimmedTitle.length < 3) {
      showMessage('error', 'Le titre du sondage est requis');
      return;
    }
    if (cleanedOptions.length < 2) {
      showMessage('error', 'Ajoute au moins 2 options');
      return;
    }
    if (surveyAudienceType === 'SELECTED_USERS' && surveySelectedUserIds.length === 0) {
      showMessage('error', 'Sélectionne au moins un utilisateur');
      return;
    }

    try {
      setCreatingSurvey(true);
      const res = await adminApi.createSurvey({
        title: trimmedTitle,
        description: trimmedDescription || null,
        imageUrl: surveyImageUrl,
        audienceType: surveyAudienceType,
        popupDelaySeconds: surveyPopupDelaySeconds,
        options: cleanedOptions,
        selectedUserIds: surveyAudienceType === 'SELECTED_USERS' ? surveySelectedUserIds : [],
      });
      setSurveys((prev) => [res.data.survey, ...prev]);
      setSurveyDialogOpen(false);
      resetSurveyForm();
      showMessage('success', 'Sondage créé');
    } catch (error: any) {
      console.error('Failed to create survey:', error);
      showMessage('error', error.response?.data?.error || 'Erreur lors de la création du sondage');
    } finally {
      setCreatingSurvey(false);
    }
  };

  const archiveSurvey = async (surveyId: string) => {
    try {
      setArchivingSurveyId(surveyId);
      const res = await adminApi.archiveSurvey(surveyId);
      setSurveys((prev) => prev.map((survey) => (survey.id === surveyId ? res.data.survey : survey)));
      showMessage('success', 'Sondage archivé');
    } catch (error: any) {
      console.error('Failed to archive survey:', error);
      showMessage('error', error.response?.data?.error || 'Erreur lors de l’archivage du sondage');
    } finally {
      setArchivingSurveyId(null);
    }
  };

  const fetchActivity = async (period?: 'day' | 'week' | 'month' | 'custom' | 'specific', customStart?: string, customEnd?: string) => {
    const p = period ?? activityPeriod;
    setLoadingActivity(true);
    try {
      const startStr = customStart ?? activityCustomStart;
      const endStr = customEnd ?? activityCustomEnd;
      // Convert YYYY-MM-DD date strings to full ISO datetimes for the API
      const startISO = startStr ? (startStr.includes('T') ? startStr : `${startStr}T00:00:00`) : undefined;
      const endISO = endStr ? (endStr.includes('T') ? endStr : `${endStr}T23:59:59`) : undefined;
      const [histRes, statsRes] = await Promise.all([
        adminApi.getOnlineHistory({
          period: p === 'specific' ? 'custom' : p,
          startDate: p === 'custom' ? startISO : p === 'specific' ? `${activitySpecificDay}T00:00:00` : undefined,
          endDate: p === 'custom' ? endISO : p === 'specific' ? `${activitySpecificDay}T23:59:59` : undefined,
        }),
        adminApi.getOnlineStats(),
      ]);
      setActivityHistory({
        data: histRes.data.data,
        peak: histRes.data.peak,
        peakAt: histRes.data.peakAt,
        insights: histRes.data.insights,
      });
      setOnlineStats(statsRes.data);
      setHoveredActivity(null);
      setSelectedActivity(null);
      setActivityZoomDomain(null);
      activityZoomDomainRef.current = null;
    } catch {
      // ignore
    } finally {
      setLoadingActivity(false);
    }
  };

  const fetchLogs = async (page = 0, typeOverride?: string, gameTypeOverride?: string) => {
    try {
      setLoadingLogs(true);
      const filterType = typeOverride !== undefined ? typeOverride : logFilter.type;
      const filterGameType = gameTypeOverride !== undefined ? gameTypeOverride : logFilter.gameType;
      const startDate = logTimelineEnabled && logTimelineDate
        ? buildTimelineDateTime(logTimelineDate, logTimelineRange[0], 'start')
        : undefined;
      const endDate = logTimelineEnabled && logTimelineDate
        ? buildTimelineDateTime(logTimelineDate, logTimelineRange[1], 'end')
        : undefined;
      const res = await adminApi.getLogs({
        type: filterType !== 'ALL' ? filterType : undefined,
        gameType: filterGameType !== 'ALL' ? filterGameType : undefined,
        username: logFilter.username || undefined,
        startDate,
        endDate,
        limit: logsPerPage,
        offset: page * logsPerPage,
      });
      setLogs(res.data.logs);
      setTotalLogs(res.data.total);
      setLogsPage(page);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      showMessage('error', 'Erreur lors du chargement des logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const renderLogsPagination = () => (
    totalLogs > logsPerPage ? (
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          {logsPage * logsPerPage + 1}-{Math.min((logsPage + 1) * logsPerPage, totalLogs)} sur {totalLogs.toLocaleString()}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchLogs(logsPage - 1)}
            disabled={logsPage === 0 || loadingLogs}
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            {logsPage + 1}/{Math.ceil(totalLogs / logsPerPage)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchLogs(logsPage + 1)}
            disabled={(logsPage + 1) * logsPerPage >= totalLogs || loadingLogs}
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    ) : null
  );

  const handleDownloadLogs = async () => {
    if (downloadLogsMode === 'range' && !downloadLogsStartDate) {
      setDownloadLogsError('Choisis une date de début.');
      return;
    }

    if (downloadLogsMode === 'range' && !downloadLogsEndDate) {
      setDownloadLogsError('Choisis une date de fin.');
      return;
    }

    if (downloadLogsMode === 'range' && downloadLogsEndDate < downloadLogsStartDate) {
      setDownloadLogsError('La date de fin doit être après la date de début.');
      return;
    }

    try {
      setDownloadLogsError(null);
      setDownloadingLogs(true);
      const timelineStartDate = logTimelineEnabled && logTimelineDate
        ? buildTimelineDateTime(logTimelineDate, logTimelineRange[0], 'start')
        : undefined;
      const timelineEndDate = logTimelineEnabled && logTimelineDate
        ? buildTimelineDateTime(logTimelineDate, logTimelineRange[1], 'end')
        : undefined;
      const res = await adminApi.downloadLogs({
        startDate: downloadLogsMode === 'range' ? downloadLogsStartDate : timelineStartDate,
        endDate: downloadLogsMode === 'range' ? downloadLogsEndDate : timelineEndDate,
        type: downloadLogsMode === 'all' ? undefined : (logFilter.type !== 'ALL' ? logFilter.type : undefined),
        gameType: downloadLogsMode === 'all' ? undefined : (logFilter.gameType !== 'ALL' ? logFilter.gameType : undefined),
        username: downloadLogsMode === 'all' ? undefined : (logFilter.username || undefined),
      });

      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const contentDisposition = res.headers?.['content-disposition'] as string | undefined;
      const match = contentDisposition?.match(/filename="([^"]+)"/);
      const fallbackLabel = downloadLogsMode === 'all'
        ? 'all-time'
        : downloadLogsStartDate === downloadLogsEndDate
          ? downloadLogsStartDate
          : `${downloadLogsStartDate}_to_${downloadLogsEndDate}`;
      const filename = match?.[1] ?? `admin-logs-${fallbackLabel}.csv`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setDownloadLogsOpen(false);
    } catch (error) {
      console.error('Failed to download logs:', error);
      setDownloadLogsError('Erreur lors du téléchargement des logs.');
      showMessage('error', 'Erreur lors du téléchargement des logs');
    } finally {
      setDownloadingLogs(false);
    }
  };

  const handleExportUsersCsv = async () => {
    try {
      setDownloadingUsersCsv(true);

      const escapeCsv = (value: unknown) => {
        if (value === null || value === undefined) {
          return '""';
        }
        const text = String(value).replace(/"/g, '""');
        return `"${text}"`;
      };

      const header = [
        'id',
        'username',
        'firstName',
        'email',
        'role',
        'isChatMuted',
        'schoolLevel',
        'classLetter',
        'aura',
        'money',
        'auraCoinBalance',
        'dailyAuraGiven',
        'dailyAuraLimit',
        'sharedPartnerUsername',
        'sharedCoupleBalance',
        'lastDailyReset',
        'createdAt',
        'updatedAt',
      ].join(',');

      const rows = filteredUsers.map((entry) => [
        escapeCsv(entry.id),
        escapeCsv(entry.username),
        escapeCsv(entry.firstName),
        escapeCsv(entry.email),
        escapeCsv(getAdminRole(entry)),
        escapeCsv(entry.isChatMuted),
        escapeCsv(entry.schoolLevel),
        escapeCsv(entry.classLetter),
        escapeCsv(entry.aura),
        escapeCsv(entry.money),
        escapeCsv(entry.auraCoinBalance),
        escapeCsv(entry.dailyAuraGiven),
        escapeCsv(entry.dailyAuraLimit),
        escapeCsv(entry.sharedMoney?.partner.username ?? ''),
        escapeCsv(entry.sharedMoney?.coupleBalance ?? ''),
        escapeCsv(entry.lastDailyReset),
        escapeCsv(entry.createdAt),
        escapeCsv(entry.updatedAt),
      ].join(','));

      const csv = [header, ...rows].join('\n');
      const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const hasFilter = userSearchQuery.trim().length > 0;
      const dateLabel = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = hasFilter
        ? `admin-users-${dateLabel}-filtered.csv`
        : `admin-users-${dateLabel}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showMessage('success', `Export CSV prêt (${filteredUsers.length} utilisateur(s)).`);
    } catch (error) {
      console.error('Failed to export users CSV:', error);
      showMessage('error', 'Erreur lors de l export CSV des utilisateurs');
    } finally {
      setDownloadingUsersCsv(false);
    }
  };

  const fetchLogStats = async () => {
    try {
      const res = await adminApi.getLogStats();
      setLogStats(res.data);
    } catch (error) {
      console.error('Failed to fetch log stats:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      const res = await adminApi.getSettings();
      setAnnouncementMessage(res.data.settings.topbar_announcement || '');
      setChatBlockEnabled(res.data.settings.chat_block_enabled === 'true');
      setChatAutoBlockEnabled(res.data.settings.chat_auto_block_enabled === 'true');
      setChatAutoBlockStart(res.data.settings.chat_auto_block_start || '22:00');
      setChatAutoBlockEnd(res.data.settings.chat_auto_block_end || '07:00');
      setChatBlockMessage(res.data.settings.chat_block_message || 'Le chat est temporairement bloque par l administration.');
      setDuelMatchmakingEnabled(res.data.settings.duel_matchmaking_enabled !== 'false');
      setReferralEnabled(res.data.settings.referral_enabled !== 'false');
      setReferralDashboardCardEnabled(res.data.settings.referral_dashboard_card_enabled !== 'false');
      setReferralRewardAmount(res.data.settings.referral_reward_amount || '250');
      setDailyAuraDistributionLimit(res.data.settings.daily_aura_distribution_limit || '100');
      setDailyGameAuraLimit(res.data.settings.daily_game_aura_limit || '500');
      setDailyGameMoneyLimit(res.data.settings.daily_game_money_limit || '1000');
      setAuraCoinBuyFeePercentage(res.data.settings.auracoin_buy_fee_percentage || '0.02');
      setStableCoinBuyFeePercentage(res.data.settings.stable_coin_buy_fee_percentage || '0.01');
      setChaosCoinBuyFeePercentage(res.data.settings.chaos_coin_buy_fee_percentage || '0.035');
      setClashAttackCooldownMinutes(res.data.settings.clash_attack_cooldown_minutes || '10');
      setMaintenanceMessage(res.data.settings.maintenance_message || '');
      setMaintenanceAutoWeekendEnabled(res.data.settings.maintenance_auto_weekend_enabled === 'true');
      setBlockedMessage(res.data.settings.blocked_message || '');
      if (res.data.settings.blocked_page_messages) {
        try {
          const parsed = JSON.parse(res.data.settings.blocked_page_messages);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const nextMessages = Object.fromEntries(
              Object.entries(parsed as Record<string, unknown>)
                .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
                .map(([key, value]) => [key, value])
            );
            setBlockedPageMessages(nextMessages);
          } else {
            setBlockedPageMessages({});
          }
        } catch {
          setBlockedPageMessages({});
        }
      } else {
        setBlockedPageMessages({});
      }
      setLoginMessage(res.data.settings.login_message || '');
      setLoginRegisterCtaEnabled(res.data.settings.login_register_cta_enabled !== 'false');
      setDefaultLandingPage(normalizeDefaultLandingPage(res.data.settings[DEFAULT_LANDING_PAGE_KEY]));
      setYouLogoAdminOnly(res.data.settings[YOU_LOGO_ADMIN_ONLY_SETTING_KEY] === 'true');

      // Business creation toggle
      try {
        const bizRes = await adminApi.getBusinessCreationEnabled();
        setBusinessCreationEnabled(bizRes.data.enabled);
      } catch { /* ignore */ }

      if (res.data.settings.blocked_pages) {
        try {
          const parsed = JSON.parse(res.data.settings.blocked_pages);
          if (Array.isArray(parsed)) {
            const unique = Array.from(new Set(parsed.filter((p: unknown) => typeof p === 'string')));
            setBlockedPages(unique);
          } else {
            setBlockedPages([]);
          }
        } catch {
          setBlockedPages([]);
        }
      } else {
        setBlockedPages([]);
      }
      
      setFakeOnlineEnabled(res.data.settings.fake_online_enabled !== 'false');

      // Déterminer si la maintenance est activée : priorité au flag dédié, fallback legacy pages
      const enabledFromFlag = res.data.settings.maintenance_enabled === 'true';
      let enabledFromPages = false;
      if (res.data.settings.maintenance_pages) {
        try {
          const pages = JSON.parse(res.data.settings.maintenance_pages);
          enabledFromPages = Array.isArray(pages) && pages.length > 0;
        } catch {
          enabledFromPages = false;
        }
      }
      setMaintenanceEnabled(enabledFromFlag || enabledFromPages);
      
      // Charger la date de fin de maintenance
      if (res.data.settings.maintenance_end_date && res.data.settings.maintenance_end_date.trim() !== '') {
        // Convertir la date ISO en format datetime-local (YYYY-MM-DDTHH:mm)
        const date = new Date(res.data.settings.maintenance_end_date);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          setMaintenanceEndDate(`${year}-${month}-${day}T${hours}:${minutes}`);
        } else {
          setMaintenanceEndDate('');
        }
      } else {
        setMaintenanceEndDate('');
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      showMessage('error', 'Erreur lors du chargement des paramètres');
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchTaxSettings = async () => {
    try {
      setLoadingTaxSettings(true);
      const res = await adminApi.getTaxSettings();
      const nextBrackets = res.data.brackets.length > 0
        ? res.data.brackets.map((bracket: TaxBracket) => ({
            id: bracket.id,
            threshold: String(bracket.threshold),
            rate: String(bracket.rate),
          }))
        : [{
            id: DEFAULT_TAX_BRACKET.id,
            threshold: String(res.data.defaults.threshold),
            rate: String(res.data.defaults.rate),
          }];

      setTaxBrackets(nextBrackets);
      setTaxLastRunDate(res.data.lastRunDate);
    } catch (error) {
      console.error('Failed to fetch tax settings:', error);
      showMessage('error', "Erreur lors du chargement des paliers d'impôt");
    } finally {
      setLoadingTaxSettings(false);
    }
  };

  const addTaxBracket = () => {
    setTaxBrackets((prev) => [
      ...prev,
      {
        id: `new-tax-bracket-${Date.now()}-${prev.length}`,
        threshold: '',
        rate: '',
      },
    ]);
  };

  const updateTaxBracket = (id: string, field: 'threshold' | 'rate', value: string) => {
    setTaxBrackets((prev) => prev.map((bracket) => (
      bracket.id === id ? { ...bracket, [field]: value } : bracket
    )));
  };

  const removeTaxBracket = (id: string) => {
    setTaxBrackets((prev) => {
      if (prev.length <= 1) {
        return [{ ...DEFAULT_TAX_BRACKET, id: prev[0]?.id ?? DEFAULT_TAX_BRACKET.id }];
      }
      return prev.filter((bracket) => bracket.id !== id);
    });
  };

  const saveTaxSettings = async () => {
    const parsedBrackets: Array<{ threshold: number; rate: number }> = [];
    const seenThresholds = new Set<number>();

    for (const bracket of taxBrackets) {
      const threshold = Number.parseInt(bracket.threshold, 10);
      const rate = Number.parseFloat(bracket.rate);

      if (!Number.isInteger(threshold) || threshold < 0) {
        showMessage('error', "Chaque palier doit avoir un seuil entier positif ou nul");
        return;
      }

      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        showMessage('error', "Chaque taux d'impôt doit être compris entre 0 et 100%");
        return;
      }

      if (seenThresholds.has(threshold)) {
        showMessage('error', 'Chaque seuil doit être unique');
        return;
      }

      seenThresholds.add(threshold);
      parsedBrackets.push({ threshold, rate });
    }

    parsedBrackets.sort((a, b) => a.threshold - b.threshold);

    try {
      setSavingTaxSettings(true);
      const res = await adminApi.updateTaxSettings(parsedBrackets);
      setTaxBrackets(
        res.data.brackets.length > 0
          ? res.data.brackets.map((bracket) => ({
              id: bracket.id,
              threshold: String(bracket.threshold),
              rate: String(bracket.rate),
            }))
          : [{
              id: DEFAULT_TAX_BRACKET.id,
              threshold: String(res.data.defaults.threshold),
              rate: String(res.data.defaults.rate),
            }]
      );
      showMessage('success', "Paliers d'impôt sauvegardés");
    } catch (error) {
      console.error('Failed to save tax settings:', error);
      showMessage('error', "Erreur lors de la sauvegarde des paliers d'impôt");
    } finally {
      setSavingTaxSettings(false);
    }
  };

  const runTaxNow = async () => {
    try {
      setRunningTaxNow(true);
      const res = await adminApi.runTaxNow(true);
      const { skipped, usersAffected, totalCollected } = res.data.result;
      setTaxLastRunDate(new Date().toISOString().slice(0, 10));
      showMessage(
        'success',
        skipped
          ? "Impôt déjà exécuté aujourd'hui"
          : `Impôt lancé: ${usersAffected} joueur(s), ${totalCollected.toLocaleString('fr-FR')}$ collectés`
      );
    } catch (error) {
      console.error('Failed to run tax now:', error);
      showMessage('error', "Erreur lors du lancement de l'impôt");
    } finally {
      setRunningTaxNow(false);
    }
  };

  const saveMaintenance = async () => {
    try {
      setSavingMaintenance(true);
      const settings: Record<string, string> = {
        maintenance_enabled: maintenanceEnabled ? 'true' : 'false',
        maintenance_auto_weekend_enabled: maintenanceAutoWeekendEnabled ? 'true' : 'false',
        maintenance_message: maintenanceMessage.trim(),
        // Champ legacy pour compat backend (toujours vide car maintenance globale)
        maintenance_pages: '[]',
      };
      
      // Ajouter la date de fin si elle est définie
      if (maintenanceEndDate && maintenanceEndDate.trim()) {
        // Convertir le format datetime-local en ISO string
        const date = new Date(maintenanceEndDate);
        if (!isNaN(date.getTime())) {
          settings.maintenance_end_date = date.toISOString();
        }
      } else {
        // Si la date est vide, supprimer le setting en mettant une chaîne vide
        settings.maintenance_end_date = '';
      }
      
      await adminApi.updateSettings(settings);
      showMessage('success', 'Maintenance mise à jour');
      fetchSettings();
    } catch (error) {
      console.error('Failed to save maintenance:', error);
      showMessage('error', 'Erreur lors de la sauvegarde');
    } finally {
      setSavingMaintenance(false);
    }
  };

  const toggleBlockedPage = (pageKey: string) => {
    setBlockedPages(prev => {
      if (prev.includes(pageKey)) {
        setBlockedPageMessages((messages) => {
          if (!(pageKey in messages)) {
            return messages;
          }
          const next = { ...messages };
          delete next[pageKey];
          return next;
        });
        return prev.filter(key => key !== pageKey);
      }
      return [...prev, pageKey];
    });
  };

  const updateBlockedPageMessage = (pageKey: string, value: string) => {
    setBlockedPageMessages((prev) => ({
      ...prev,
      [pageKey]: value,
    }));
  };

  const saveBlockedPages = async (): Promise<boolean> => {
    try {
      setSavingBlocks(true);
      const uniquePages = Array.from(new Set(blockedPages)).sort();
      const normalizedMessages = Object.fromEntries(
        Object.entries(blockedPageMessages)
          .filter(([key]) => uniquePages.includes(key))
          .map(([key, value]) => [key, value.trim()])
          .filter(([, value]) => value.length > 0)
      );
      await adminApi.updateSettings({
        blocked_pages: JSON.stringify(uniquePages),
        blocked_message: blockedMessage.trim(),
        blocked_page_messages: JSON.stringify(normalizedMessages),
      });
      showMessage('success', 'Feature switches mis à jour');
      fetchSettings();
      refreshFeatures();
      return true;
    } catch (error) {
      console.error('Failed to save page blocks:', error);
      showMessage('error', 'Erreur lors de la sauvegarde du blocage');
      return false;
    } finally {
      setSavingBlocks(false);
    }
  };

  const saveFakeOnline = async (value: boolean) => {
    try {
      setSavingFakeOnline(true);
      await adminApi.updateSettings({ fake_online_enabled: value ? 'true' : 'false' });
      setFakeOnlineEnabled(value);
      showMessage('success', value ? 'Faux online activé' : 'Faux online désactivé');
    } catch {
      showMessage('error', 'Erreur lors de la sauvegarde');
    } finally {
      setSavingFakeOnline(false);
    }
  };

  const saveAnnouncement = async () => {
    try {
      const trimmed = announcementMessage.trim();
      if (trimmed.length > ANNOUNCEMENT_MAX_LENGTH) {
        showMessage('error', `Le message doit faire ${ANNOUNCEMENT_MAX_LENGTH} caractères ou moins`);
        return;
      }

      setSavingAnnouncement(true);
      await adminApi.updateSetting('topbar_announcement', trimmed);
      setAnnouncementMessage(trimmed);
      showMessage('success', 'Annonce sauvegardée');
    } catch (error) {
      console.error('Failed to save announcement:', error);
      showMessage('error', 'Erreur lors de la sauvegarde de l\'annonce');
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const saveChatBlockSettings = async () => {
    try {
      const trimmedMessage = chatBlockMessage.trim();
      if (!trimmedMessage) {
        showMessage('error', 'Le message de blocage du chat ne peut pas etre vide');
        return;
      }

      if (trimmedMessage.length > CHAT_BLOCK_MESSAGE_MAX_LENGTH) {
        showMessage('error', `Le message de blocage doit faire ${CHAT_BLOCK_MESSAGE_MAX_LENGTH} caracteres ou moins`);
        return;
      }

      if (chatAutoBlockEnabled) {
        if (!isValidChatTimeValue(chatAutoBlockStart) || !isValidChatTimeValue(chatAutoBlockEnd)) {
          showMessage('error', 'Les horaires du blocage auto doivent etre au format HH:mm');
          return;
        }
      }

      setSavingChatBlockSettings(true);
      await adminApi.updateSettings({
        chat_block_enabled: chatBlockEnabled ? 'true' : 'false',
        chat_block_message: trimmedMessage,
        chat_auto_block_enabled: chatAutoBlockEnabled ? 'true' : 'false',
        chat_auto_block_start: chatAutoBlockStart,
        chat_auto_block_end: chatAutoBlockEnd,
      });
      setChatBlockMessage(trimmedMessage);
      refreshFeatures();
      showMessage('success', 'Parametres du chat sauvegardes');
    } catch (error) {
      console.error('Failed to save chat block settings:', error);
      showMessage('error', 'Erreur lors de la sauvegarde du blocage du chat');
    } finally {
      setSavingChatBlockSettings(false);
    }
  };

  const saveDuelMatchmakingEnabled = async (value: boolean) => {
    const previousValue = duelMatchmakingEnabled;
    try {
      setDuelMatchmakingEnabled(value);
      setSavingDuelMatchmakingEnabled(true);
      await adminApi.updateSetting('duel_matchmaking_enabled', value ? 'true' : 'false');
      refreshFeatures();
      showMessage('success', value ? 'Matchmaking duel active' : 'Matchmaking duel desactive');
    } catch (error) {
      setDuelMatchmakingEnabled(previousValue);
      console.error('Failed to save duel matchmaking enabled setting:', error);
      showMessage('error', 'Erreur lors de la sauvegarde du matchmaking duel');
    } finally {
      setSavingDuelMatchmakingEnabled(false);
    }
  };


  const saveReferralReward = async () => {
    try {
      const parsed = Number.parseInt(referralRewardAmount, 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        showMessage('error', 'La recompense de parrainage doit etre un entier positif ou nul');
        return;
      }

      setSavingReferralReward(true);
      await adminApi.updateSetting('referral_reward_amount', parsed);
      setReferralRewardAmount(String(parsed));
      showMessage('success', 'Recompense de parrainage sauvegardee');
    } catch (error) {
      console.error('Failed to save referral reward:', error);
      showMessage('error', 'Erreur lors de la sauvegarde de la recompense');
    } finally {
      setSavingReferralReward(false);
    }
  };

  const saveReferralEnabled = async (value: boolean) => {
    const previousValue = referralEnabled;
    try {
      setReferralEnabled(value);
      setSavingReferralEnabled(true);
      await adminApi.updateSetting('referral_enabled', value ? 'true' : 'false');
      refreshFeatures();
      showMessage('success', value ? 'Parrainage active' : 'Parrainage desactive');
    } catch (error) {
      setReferralEnabled(previousValue);
      console.error('Failed to save referral enabled setting:', error);
      showMessage('error', 'Erreur lors de la sauvegarde du parrainage');
    } finally {
      setSavingReferralEnabled(false);
    }
  };

  const saveReferralDashboardCardEnabled = async (value: boolean) => {
    const previousValue = referralDashboardCardEnabled;
    try {
      setReferralDashboardCardEnabled(value);
      setSavingReferralDashboardCardEnabled(true);
      await adminApi.updateSetting('referral_dashboard_card_enabled', value ? 'true' : 'false');
      refreshFeatures();
      showMessage('success', value ? 'Carte de parrainage sur le dashboard activee' : 'Carte de parrainage sur le dashboard desactivee');
    } catch (error) {
      setReferralDashboardCardEnabled(previousValue);
      console.error('Failed to save referral dashboard card enabled setting:', error);
      showMessage('error', 'Erreur lors de la sauvegarde de la carte de parrainage');
    } finally {
      setSavingReferralDashboardCardEnabled(false);
    }
  };

  const saveDailyAuraDistributionLimit = async () => {
    try {
      const parsed = Number.parseInt(dailyAuraDistributionLimit, 10);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10000) {
        showMessage('error', "Le quota d'aura journalier doit etre un entier entre 0 et 10000");
        return;
      }

      setSavingDailyAuraDistributionLimit(true);
      await adminApi.updateSetting('daily_aura_distribution_limit', parsed);
      setDailyAuraDistributionLimit(String(parsed));
      showMessage('success', "Quota d'aura journalier sauvegarde");
    } catch (error) {
      console.error('Failed to save daily aura distribution limit:', error);
      showMessage('error', "Erreur lors de la sauvegarde du quota d'aura");
    } finally {
      setSavingDailyAuraDistributionLimit(false);
    }
  };

  const saveDailyGameLimits = async () => {
    try {
      const parsedAura = Number.parseInt(dailyGameAuraLimit, 10);
      const parsedMoney = Number.parseInt(dailyGameMoneyLimit, 10);

      if (!Number.isInteger(parsedAura) || parsedAura < 0 || parsedAura > 100000) {
        showMessage('error', "Le plafond d'aura des jeux doit etre un entier entre 0 et 100000");
        return;
      }

      if (!Number.isInteger(parsedMoney) || parsedMoney < 0 || parsedMoney > 100000) {
        showMessage('error', "Le plafond d'argent des jeux doit etre un entier entre 0 et 100000");
        return;
      }

      setSavingDailyGameLimits(true);
      await adminApi.updateSettings({
        daily_game_aura_limit: parsedAura,
        daily_game_money_limit: parsedMoney,
      });
      setDailyGameAuraLimit(String(parsedAura));
      setDailyGameMoneyLimit(String(parsedMoney));
      showMessage('success', 'Plafonds de recompense des jeux sauvegardes');
    } catch (error) {
      console.error('Failed to save daily game limits:', error);
      showMessage('error', "Erreur lors de la sauvegarde des plafonds des jeux");
    } finally {
      setSavingDailyGameLimits(false);
    }
  };

  const saveAuraCoinBuyFee = async () => {
    try {
      const parsed = Number.parseFloat(auraCoinBuyFeePercentage);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 0.5) {
        showMessage('error', 'Les frais AuraCoin doivent etre compris entre 0% et 50%');
        return;
      }

      setSavingAuraCoinBuyFee(true);
      await adminApi.updateSetting('auracoin_buy_fee_percentage', parsed.toFixed(4));
      setAuraCoinBuyFeePercentage(parsed.toFixed(4));
      showMessage('success', 'Frais d achat AuraCoin sauvegardes');
    } catch (error) {
      console.error('Failed to save AuraCoin buy fee:', error);
      showMessage('error', 'Erreur lors de la sauvegarde des frais AuraCoin');
    } finally {
      setSavingAuraCoinBuyFee(false);
    }
  };

  const saveStableCoinBuyFee = async () => {
    try {
      const parsed = Number.parseFloat(stableCoinBuyFeePercentage);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 0.5) {
        showMessage('error', 'Les frais Aura Stable doivent etre compris entre 0% et 50%');
        return;
      }

      setSavingStableCoinBuyFee(true);
      await adminApi.updateSetting('stable_coin_buy_fee_percentage', parsed.toFixed(4));
      setStableCoinBuyFeePercentage(parsed.toFixed(4));
      showMessage('success', 'Frais Aura Stable sauvegardes');
    } catch (error) {
      console.error('Failed to save stable coin buy fee:', error);
      showMessage('error', 'Erreur lors de la sauvegarde des frais Aura Stable');
    } finally {
      setSavingStableCoinBuyFee(false);
    }
  };

  const saveChaosCoinBuyFee = async () => {
    try {
      const parsed = Number.parseFloat(chaosCoinBuyFeePercentage);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        showMessage('error', 'Les frais Chaos Coin doivent etre compris entre 0% et 100%');
        return;
      }

      setSavingChaosCoinBuyFee(true);
      await adminApi.updateSetting('chaos_coin_buy_fee_percentage', parsed.toFixed(4));
      setChaosCoinBuyFeePercentage(parsed.toFixed(4));
      showMessage('success', 'Frais Chaos Coin sauvegardes');
    } catch (error) {
      console.error('Failed to save chaos coin buy fee:', error);
      showMessage('error', 'Erreur lors de la sauvegarde des frais Chaos Coin');
    } finally {
      setSavingChaosCoinBuyFee(false);
    }
  };

  const saveClashAttackCooldown = async () => {
    try {
      const parsed = Number.parseInt(clashAttackCooldownMinutes, 10);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1440) {
        showMessage('error', 'Le cooldown d attaque Clash doit etre un entier entre 0 et 1440 minutes');
        return;
      }

      setSavingClashAttackCooldown(true);
      await adminApi.updateSetting('clash_attack_cooldown_minutes', parsed);
      setClashAttackCooldownMinutes(String(parsed));
      showMessage('success', "Temps de recharge d'attaque Clash sauvegardé");
    } catch (error) {
      console.error('Failed to save Clash attack cooldown:', error);
      showMessage('error', 'Erreur lors de la sauvegarde du cooldown Clash');
    } finally {
      setSavingClashAttackCooldown(false);
    }
  };


  const saveLoginMessage = async () => {
    try {
      setSavingLoginMessage(true);
      await adminApi.updateSetting('login_message', loginMessage.trim());
      setLoginMessage(loginMessage.trim());
      showMessage('success', 'Message de connexion sauvegardé');
    } catch (error) {
      console.error('Failed to save login message:', error);
      showMessage('error', 'Erreur lors de la sauvegarde du message');
    } finally {
      setSavingLoginMessage(false);
    }
  };

  const saveLoginRegisterCta = async (value: boolean) => {
    const previousValue = loginRegisterCtaEnabled;
    try {
      setLoginRegisterCtaEnabled(value);
      setSavingLoginRegisterCta(true);
      await adminApi.updateSetting('login_register_cta_enabled', value ? 'true' : 'false');
      showMessage('success', value ? 'Bouton creer un compte active' : 'Bouton creer un compte desactive');
    } catch (error) {
      setLoginRegisterCtaEnabled(previousValue);
      console.error('Failed to save login register CTA setting:', error);
      showMessage('error', 'Erreur lors de la sauvegarde du bouton');
    } finally {
      setSavingLoginRegisterCta(false);
    }
  };

  const saveDefaultLandingPage = async () => {
    try {
      setSavingDefaultLandingPage(true);
      const normalizedValue = normalizeDefaultLandingPage(defaultLandingPage);
      await adminApi.updateSetting(DEFAULT_LANDING_PAGE_KEY, normalizedValue);
      setDefaultLandingPage(normalizedValue);
      refreshFeatures();
      showMessage('success', 'Page principale sauvegardee');
    } catch (error) {
      console.error('Failed to save default landing page setting:', error);
      showMessage('error', 'Erreur lors de la sauvegarde de la page principale');
    } finally {
      setSavingDefaultLandingPage(false);
    }
  };

  const saveYouLogoAdminOnly = async (value: boolean) => {
    const previousValue = youLogoAdminOnly;
    try {
      setYouLogoAdminOnly(value);
      setSavingYouLogoAdminOnly(true);
      await adminApi.updateSetting(YOU_LOGO_ADMIN_ONLY_SETTING_KEY, value ? 'true' : 'false');
      showMessage('success', value ? 'Accès logo→Moi réservé aux admins' : 'Accès logo→Moi autorisé pour tous');
      refreshFeatures();
    } catch (error) {
      console.error('Failed to save you logo admin only setting:', error);
      setYouLogoAdminOnly(previousValue);
      showMessage('error', 'Erreur lors de la sauvegarde');
    } finally {
      setSavingYouLogoAdminOnly(false);
    }
  };

  const saveBusinessCreationEnabled = async (value: boolean) => {
    const prev = businessCreationEnabled;
    try {
      setBusinessCreationEnabled(value);
      setSavingBusinessCreation(true);
      await adminApi.setBusinessCreationEnabled(value);
      showMessage('success', value ? 'Création d\'entreprise activée' : 'Création d\'entreprise désactivée');
    } catch {
      setBusinessCreationEnabled(prev);
      showMessage('error', 'Erreur lors de la sauvegarde');
    } finally {
      setSavingBusinessCreation(false);
    }
  };

  const purgeAllBusinesses = async () => {
    const confirmed = await confirm({
      title: 'Purger toutes les entreprises ?',
      description: 'Les proprietaires seront rembourses. Action irreversible.',
      confirmLabel: 'Purger',
      cancelLabel: 'Annuler',
      variant: 'destructive',
    });
    if (!confirmed) return;
    setPurgingBusinesses(true);
    try {
      const res = await adminApi.purgeAllBusinesses();
      showMessage('success', `${res.data.purged} entreprise(s) supprimée(s)`);
    } catch {
      showMessage('error', 'Erreur lors de la purge');
    } finally {
      setPurgingBusinesses(false);
    }
  };

  const resetBusinessUnlockLevels = async () => {
    const confirmed = await confirm({
      title: 'Reinitialiser les niveaux debloques ?',
      description: 'Le niveau de tous les joueurs sera remis a 0.',
      confirmLabel: 'Reinitialiser',
      cancelLabel: 'Annuler',
      variant: 'destructive',
    });
    if (!confirmed) return;
    setResettingUnlockLevels(true);
    try {
      await adminApi.resetBusinessUnlockLevels();
      showMessage('success', 'Niveaux réinitialisés');
    } catch {
      showMessage('error', 'Erreur lors de la réinitialisation');
    } finally {
      setResettingUnlockLevels(false);
    }
  };

  const openBanDialog = (userId: string) => {
    setBanUserId(userId);
    setBanReason('');
    setBanType('TEMPORARY');
    setBanDuration(24);
    setBanDialogOpen(true);
  };

  const openWarningDialog = (userId: string) => {
    setActiveTab('bans');
    setWarningUserId(userId);
    setWarningMessage('');
    setWarningSeverity('MEDIUM');
    setWarningDialogOpen(true);
  };
  const createBan = async () => {
    if (!banReason.trim()) {
      showMessage('error', 'La raison est requise');
      return;
    }

    setCreatingBan(true);
    try {
      const targetIds = massBanTargetIds.length > 0 ? massBanTargetIds : [banUserId];
      for (const uid of targetIds) {
        await adminApi.createBan({
          userId: uid,
          reason: banReason,
          type: banType,
          durationHours: banType === 'TEMPORARY' ? banDuration : undefined,
        });
      }
      showMessage('success', massBanTargetIds.length > 0 ? `${massBanTargetIds.length} utilisateur(s) bannis` : 'Utilisateur banni avec succès');
      setBanDialogOpen(false);
      setMassBanTargetIds([]);
      if (massBanTargetIds.length > 0) setSelectedUserIds([]);
      fetchBans();
      fetchUsers();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur lors du bannissement');
    } finally {
      setCreatingBan(false);
    }
  };

  const unbanUser = async (userId: string) => {
    setUnbanning(userId);
    try {
      await adminApi.unbanUser(userId);
      showMessage('success', 'Utilisateur débanni avec succès');
      fetchBans();
      fetchUsers();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur lors du débannissement');
    } finally {
      setUnbanning(null);
    }
  };

  const importArchivedRegistrations = async () => {
    const legacyEntries = parseLegacyArchivedRegistrations();
    if (legacyEntries.length === 0) {
      showMessage('error', 'Aucune archive locale à importer');
      setLegacyArchivedRegistrationsCount(0);
      return;
    }

    setImportingArchivedRegistrations(true);
    try {
      const res = await adminApi.importRegistrationReviews(legacyEntries);
      setArchivedRegistrations(res.data.registrationReviews.map(mapRegistrationReviewToArchivedRegistration));
      localStorage.removeItem(ADMIN_ARCHIVED_REGISTRATIONS_STORAGE_KEY);
      setLegacyArchivedRegistrationsCount(0);
      showMessage('success', `${res.data.importedCount} archive${res.data.importedCount > 1 ? 's' : ''} importée${res.data.importedCount > 1 ? 's' : ''}`);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur lors de l\'import');
    } finally {
      setImportingArchivedRegistrations(false);
    }
  };

  const approveUser = async (id: string) => {
    setApprovingUser(id);
    try {
      await adminApi.approveUser(id);
      setPendingUsers(prev => prev.filter(u => u.id !== id));
      await fetchRegistrationReviews();
      showMessage('success', 'Utilisateur approuvé');
      // Refresh users list to include newly approved user
      fetchUsers();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setApprovingUser(null);
    }
  };

  const rejectUser = async (id: string) => {
    setRejectingUser(id);
    try {
      await adminApi.rejectUser(id);
      setPendingUsers(prev => prev.filter(u => u.id !== id));
      await fetchRegistrationReviews();
      showMessage('success', 'Demande rejetée');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setRejectingUser(null);
    }
  };

  const toggleBugStatus = async (bug: BugReport, newStatus?: 'PENDING' | 'DONE') => {
    setUpdatingBug(bug.id);
    try {
      const status = newStatus ?? (bug.status === 'PENDING' ? 'DONE' : 'PENDING');
      const reply = bugReply[bug.id]?.trim();
      const res = await adminApi.updateBugReport(bug.id, { status, ...(reply ? { adminReply: reply } : {}) });
      setBugReports(prev => prev.map(b => b.id === bug.id ? res.data.bugReport : b));
      if (reply) {
        setBugReply(prev => { const next = { ...prev }; delete next[bug.id]; return next; });
        showMessage('success', status === 'DONE' ? 'Bug résolu — réponse envoyée' : 'Bug rouvert — réponse envoyée');
      } else {
        showMessage('success', status === 'DONE' ? 'Bug marqué comme résolu' : 'Bug marqué comme en attente');
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setUpdatingBug(null);
    }
  };

  const sendBugReply = async (bug: BugReport) => {
    const reply = bugReply[bug.id]?.trim();
    if (!reply) return;
    setUpdatingBug(bug.id);
    try {
      const res = await adminApi.updateBugReport(bug.id, { status: bug.status, adminReply: reply });
      setBugReports(prev => prev.map(b => b.id === bug.id ? res.data.bugReport : b));
      setBugReply(prev => { const next = { ...prev }; delete next[bug.id]; return next; });
      showMessage('success', 'Réponse envoyée');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setUpdatingBug(null);
    }
  };

  const reviewBanAppeal = async (id: string, action: 'approve' | 'reject') => {
    setReviewingAppeal(id);
    try {
      const res = await adminApi.reviewBanAppeal(id, { action });
      setBanAppeals(prev => prev.map(a => a.id === id ? res.data.banAppeal : a));
      if (action === 'approve') {
        fetchBans();
        fetchUsers();
      }
      setSelectedInboxItem(null);
      showMessage('success', action === 'approve' ? 'Appel accepté, bannissement levé' : 'Appel rejeté');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setReviewingAppeal(null);
    }
  };

  const reviewNameChangeRequest = async (id: string, action: 'approve' | 'reject') => {
    setReviewingNameChange(id);
    try {
      const res = await adminApi.reviewNameChangeRequest(id, { action });
      setNameChangeRequests(prev => prev.map(n => n.id === id ? res.data.nameChangeRequest : n));
      if (action === 'approve') fetchUsers();
      setSelectedInboxItem(null);
      showMessage('success', action === 'approve' ? 'Pseudo changé avec succès' : 'Demande rejetée');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setReviewingNameChange(null);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  };

  const startEditingClan = (clan: AdminClan) => {
    setEditingClanId(clan.id);
    setClanForm({
      name: clan.name,
      description: clan.description || '',
      imageUrl: clan.imageUrl || '',
      maxMembers: clan.maxMembers,
      isPublic: clan.isPublic,
      tagUnlocked: clan.tagUnlocked,
    });
    setActiveTab('clubs');
  };

  const cancelEditingClan = () => {
    setEditingClanId(null);
    setClanForm({
      name: '',
      description: '',
      imageUrl: '',
      maxMembers: 5,
      isPublic: true,
      tagUnlocked: false,
    });
  };

  const saveClan = async (id: string) => {
    if (!clanForm.name.trim()) {
      showMessage('error', 'Le nom du clan est requis');
      return;
    }

    setSavingClan(true);
    try {
      const res = await adminApi.updateClan(id, {
        name: clanForm.name.trim(),
        description: clanForm.description.trim(),
        imageUrl: clanForm.imageUrl.trim(),
        maxMembers: clanForm.maxMembers,
        isPublic: clanForm.isPublic,
        tagUnlocked: clanForm.tagUnlocked,
      });
      setClans((prev) => prev.map((clan) => (clan.id === id ? res.data.clan : clan)));
      cancelEditingClan();
      showMessage('success', 'Clan mis à jour');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setSavingClan(false);
    }
  };

  const transferClanLeadership = async (clanId: string, targetUserId: string) => {
    setTransferringClanLeader(`${clanId}:${targetUserId}`);
    try {
      await adminApi.transferClanLeadership(clanId, targetUserId);
      await fetchClans();
      if (editingClanId === clanId) {
        setEditingClanId(null);
      }
      showMessage('success', 'Chef du clan mis à jour');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setTransferringClanLeader(null);
    }
  };

  const deleteClan = async (id: string) => {
    setDeletingClan(id);
    try {
      await adminApi.deleteClan(id);
      setClans((prev) => prev.filter((clan) => clan.id !== id));
      if (editingClanId === id) {
        cancelEditingClan();
      }
      showMessage('success', 'Clan supprimé');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setDeletingClan(null);
    }
  };

  const resetClanEventForm = () => {
    setEditingClanEventId(null);
    setClanEventForm(DEFAULT_CLAN_EVENT_FORM);
  };

  const startEditingClanEvent = (event: AdminClanEvent) => {
    setEditingClanEventId(event.id);
    setClanEventForm(mapClanEventToForm(event));
    setActiveTab('clubs');
  };

  const saveClanEvent = async () => {
    if (!clanEventForm.title.trim()) {
      showMessage('error', 'Le titre de l’événement est requis');
      return;
    }

    try {
      setSavingClanEvent(true);
      const payload = {
        title: clanEventForm.title.trim(),
        description: clanEventForm.description.trim() || null,
        bannerUrl: clanEventForm.bannerUrl.trim() || null,
        status: clanEventForm.status,
        highlightColor: clanEventForm.highlightColor.trim() || null,
        rulesSummary: clanEventForm.rulesSummary.trim() || null,
        startsAt: new Date(clanEventForm.startsAt).toISOString(),
        endsAt: new Date(clanEventForm.endsAt).toISOString(),
        quests: clanEventForm.quests.map((quest, index) => ({
          title: quest.title.trim(),
          description: quest.description.trim() || null,
          activityType: quest.activityType,
          targetValue: quest.targetValue,
          pointsReward: quest.pointsReward,
          sortOrder: index,
          isActive: quest.isActive,
        })),
        miniGames: clanEventForm.miniGames.map((miniGame, index) => ({
          title: miniGame.title.trim(),
          description: miniGame.description.trim() || null,
          type: miniGame.type,
          instructions: miniGame.instructions.trim() || null,
          scoreMultiplier: miniGame.scoreMultiplier,
          flatPointsBonus: miniGame.flatPointsBonus,
          maxPointsPerAttempt: miniGame.maxPointsPerAttempt,
          maxAttemptsPerUser: miniGame.maxAttemptsPerUser,
          cooldownMinutes: miniGame.cooldownMinutes,
          sortOrder: index,
          isActive: miniGame.isActive,
          config: miniGame.config.trim() ? JSON.parse(miniGame.config) : null,
        })),
        rewardTiers: clanEventForm.rewardTiers.map((tier) => ({
          title: tier.title.trim(),
          minRank: tier.minRank,
          maxRank: tier.maxRank,
          moneyReward: tier.moneyReward,
          auraReward: tier.auraReward,
          itemId: tier.itemId || null,
        })),
      };

      const res = editingClanEventId
        ? await adminApi.updateClanEvent(editingClanEventId, payload)
        : await adminApi.createClanEvent(payload);

      if (editingClanEventId) {
        setClanEvents((prev) => prev.map((entry) => entry.id === editingClanEventId ? res.data.event : entry));
      } else {
        setClanEvents((prev) => [res.data.event, ...prev]);
      }
      resetClanEventForm();
      showMessage('success', editingClanEventId ? 'Événement mis à jour' : 'Événement créé');
    } catch (error: any) {
      console.error('Failed to save clan event:', error);
      showMessage('error', error.response?.data?.error || 'Erreur lors de la sauvegarde de l’événement');
    } finally {
      setSavingClanEvent(false);
    }
  };

  const deleteClanEvent = async (id: string) => {
    try {
      setDeletingClanEvent(id);
      await adminApi.deleteClanEvent(id);
      setClanEvents((prev) => prev.filter((entry) => entry.id !== id));
      if (editingClanEventId === id) {
        resetClanEventForm();
      }
      showMessage('success', 'Événement supprimé');
    } catch (error: any) {
      console.error('Failed to delete clan event:', error);
      showMessage('error', error.response?.data?.error || 'Erreur lors de la suppression');
    } finally {
      setDeletingClanEvent(null);
    }
  };

  // Parse effect string to get type and value
  const parseEffect = (effectStr: string | null): { type: string; value: string; bonusAura?: number; bonusMoney?: number; skinImageUrl?: string; skinShopType?: 'none' | 'static' | 'rotating'; badgeId?: string; durationMinutes?: number } => {
    if (!effectStr) return { type: 'USERNAME_COLOR', value: '' };
    try {
      const effect = JSON.parse(effectStr);
      // Determine effect type from the effect object
      let effectType = effect.type || 'USERNAME_COLOR';
      if (effect.bonusAura !== undefined) effectType = 'BONUS_AURA';
      if (effect.bonusMoney !== undefined) effectType = 'BONUS_MONEY';
      if (effectType === 'ADBLOCK_YOU') effectType = 'YOU_ADBLOCK';
      if (effectType === 'GLOBAL_ADBLOCK') effectType = 'YOU_ADBLOCK';

      return {
        type: effectType,
        value: String(effect.percentage ?? effect.value ?? ''),
        bonusAura: effect.bonusAura,
        bonusMoney: effect.bonusMoney,
        skinImageUrl: effect.skinImageUrl || '',
        skinShopType: (effect.shopType as 'none' | 'static' | 'rotating') || 'none',
        badgeId: effect.badgeId || '',
        durationMinutes: Number.parseInt(String(effect.durationMinutes ?? effect.durationMins ?? (effect.durationHours != null ? Number(effect.durationHours) * 60 : 60)), 10) || 60,
      };
    } catch {
      return { type: 'USERNAME_COLOR', value: '' };
    }
  };

  const serializeItemEffect = (effect: string | null): Record<string, unknown> | string | null => {
    if (!effect) return null;
    try {
      return JSON.parse(effect) as Record<string, unknown>;
    } catch {
      return effect;
    }
  };

  const buildShopItemsExchangeFile = (sourceItems: ShopItem[]): ShopItemExchangeFile => ({
    format: SHOP_ITEMS_FILE_FORMAT,
    version: SHOP_ITEMS_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    itemCount: sourceItems.length,
    items: sourceItems.map((item) => ({
      name: item.name,
      description: item.description,
      type: item.type,
      price: item.price,
      imageUrl: item.imageUrl,
      effect: serializeItemEffect(item.effect),
      expiresAt: item.expiresAt,
    })),
  });

  const handleExportItems = () => {
    if (items.length === 0) {
      showMessage('error', 'Aucun objet à exporter');
      return;
    }

    const file = buildShopItemsExchangeFile(items);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    anchor.href = url;
    anchor.download = `shop-items-${timestamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showMessage('success', `${items.length} objet${items.length > 1 ? 's' : ''} exporté${items.length > 1 ? 's' : ''}`);
  };

  const openImportItemsPicker = () => {
    itemImportInputRef.current?.click();
  };

  const handleImportItemsFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    try {
      setImportingItems(true);
      const raw = await file.text();
      const parsed = JSON.parse(raw) as ShopItemExchangeFile;

      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items) || parsed.items.length === 0) {
        throw new Error('Le fichier doit contenir un tableau "items" non vide');
      }

      if ('format' in parsed && parsed.format !== SHOP_ITEMS_FILE_FORMAT) {
        throw new Error('Format de fichier non reconnu');
      }

      if ('version' in parsed && parsed.version !== SHOP_ITEMS_FILE_VERSION) {
        throw new Error('Version de fichier non supportée');
      }

      const res = await adminApi.importItems({
        format: SHOP_ITEMS_FILE_FORMAT,
        version: SHOP_ITEMS_FILE_VERSION,
        exportedAt: parsed.exportedAt || new Date().toISOString(),
        itemCount: parsed.items.length,
        items: parsed.items,
      });

      setItems((prev) => [...res.data.items, ...prev]);
      showMessage('success', `${res.data.count} objet${res.data.count > 1 ? 's' : ''} importé${res.data.count > 1 ? 's' : ''}`);
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Erreur lors de l\'import';
      showMessage('error', message);
    } finally {
      setImportingItems(false);
    }
  };

  // Open dialog for creating new item
  const openCreateItemDialog = () => {
    setEditingItem(null);
    setItemForm(defaultItemForm);
    if (badges.length === 0) fetchBadges();
    setItemDialogOpen(true);
  };

  // Open dialog for editing item
  const openEditItemDialog = (item: ShopItem) => {
    setEditingItem(item);
    const { type: effectType, value: effectValue, bonusAura, bonusMoney, skinImageUrl, skinShopType, badgeId, durationMinutes } = parseEffect(item.effect);
    setItemForm({
      name: item.name,
      description: item.description,
      type: item.type,
      price: item.price,
      imageUrl: item.imageUrl || '',
      effectType,
      effectValue,
      bonusAura,
      bonusMoney,
      skinImageUrl,
      skinShopType,
      badgeId,
      durationMinutes,
    });
    setItemDialogOpen(true);
  };

  const saveItem = async () => {
    setSavingItem(true);
    try {
      let effect: string;
      if (itemForm.effectType === 'BONUS_AURA') {
        effect = JSON.stringify({ type: 'BONUS_AURA', bonusAura: Math.max(0, parseInt(String(itemForm.bonusAura || 0), 10) || 0) });
      } else if (itemForm.effectType === 'BONUS_MONEY') {
        effect = JSON.stringify({ type: 'BONUS_MONEY', bonusMoney: Math.max(0, parseInt(String(itemForm.bonusMoney || 0), 10) || 0) });
      } else if (itemForm.effectType === 'DOODLE_JUMP_SKIN') {
        effect = JSON.stringify({
          type: 'DOODLE_JUMP_SKIN',
          skinImageUrl: itemForm.skinImageUrl || '',
          shopType: itemForm.skinShopType || 'none',
        });
      } else if (itemForm.effectType === 'AWARD_BADGE') {
        effect = JSON.stringify({ type: 'AWARD_BADGE', badgeId: itemForm.badgeId || '' });
      } else if (itemForm.effectType === 'YOU_ADBLOCK' || itemForm.effectType === 'GLOBAL_ADBLOCK') {
        effect = JSON.stringify({
          type: itemForm.effectType === 'GLOBAL_ADBLOCK' ? 'GLOBAL_ADBLOCK' : 'YOU_ADBLOCK',
          durationMinutes: Math.max(1, parseInt(String(itemForm.durationMinutes || 60), 10) || 60),
        });
      } else if (
        itemForm.effectType === 'CLAN_TAG_UNLOCK' ||
        itemForm.effectType === 'CLAN_SLOT_UPGRADE' ||
        EFFECT_TYPES_WITHOUT_VALUE.has(itemForm.effectType)
      ) {
        effect = JSON.stringify({ type: itemForm.effectType });
      } else if (itemForm.effectType === 'CLAN_GAME_MONEY_BOOST') {
        effect = JSON.stringify({ type: 'CLAN_GAME_MONEY_BOOST', percentage: Math.max(0, parseInt(itemForm.effectValue || '0', 10) || 0) });
      } else {
        effect = JSON.stringify({ type: itemForm.effectType, value: itemForm.effectValue });
      }

      // For badge items, auto-generate the shop image from the badge if none set
      let resolvedImageUrl = itemForm.imageUrl.trim();
      if (itemForm.effectType === 'AWARD_BADGE' && itemForm.badgeId && !resolvedImageUrl) {
        const selectedBadge = badges.find((b) => b.id === itemForm.badgeId);
        if (selectedBadge) resolvedImageUrl = generateBadgeSvgDataUrl(selectedBadge);
      }

      const uploadedUrl = resolvedImageUrl || undefined;

      const data = {
        name: itemForm.name.trim(),
        description: itemForm.description.trim(),
        type: itemForm.type,
        price: itemForm.price,
        imageUrl: uploadedUrl,
        effect,
      };

      if (editingItem) {
        const res = await adminApi.updateItem(editingItem.id, data);
        setItems((prev) => prev.map((i) => (i.id === editingItem.id ? res.data.item : i)));
        showMessage('success', 'Objet modifié');
      } else {
        const res = await adminApi.createItem(data);
        setItems((prev) => [res.data.item, ...prev]);
        showMessage('success', 'Objet créé');
      }
      setItemDialogOpen(false);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setSavingItem(false);
    }
  };

  // Delete item
  const deleteItem = async (id: string) => {
    setDeletingItem(id);
    try {
      await adminApi.deleteItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      showMessage('success', 'Objet supprimé');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setDeletingItem(null);
    }
  };

  const startEditing = (u: AdminUser) => {
    setEditingUser(u.id);
    setEditModalUser(u);
    setEditValues({
      username: u.username,
      firstName: u.firstName || '',
      aura: toSafeNumber(u.aura),
      money: toSafeNumber(u.money),
      auraCoinBalance: u.auraCoinBalance,
      dailyAuraLimit: u.dailyAuraLimit,
    });
    setEditPassword('');
    setEditAuraAddAmount(0);
    setEditAuraRemoveAmount(0);
    setEditMoneyAddAmount(0);
    setEditMoneyRemoveAmount(0);
    setEditModalOpen(true);
  };

  const cancelEditing = () => {
    setEditingUser(null);
    setEditModalUser(null);
    setEditModalOpen(false);
    setEditPassword('');
    setEditAuraAddAmount(0);
    setEditAuraRemoveAmount(0);
    setEditMoneyAddAmount(0);
    setEditMoneyRemoveAmount(0);
  };

  const saveUser = async (id: string) => {
    const nextAura = toSafeNumber(editValues.aura) + editAuraAddAmount - editAuraRemoveAmount;
    const nextMoney = toSafeNumber(editValues.money) + editMoneyAddAmount - editMoneyRemoveAmount;
    if (nextAura < 0) {
      showMessage('error', 'Le total d\'aura ne peut pas etre negatif');
      return;
    }
    if (nextMoney < 0) {
      showMessage('error', 'Le total d\'argent ne peut pas etre negatif');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...editValues } as Parameters<typeof adminApi.updateUser>[1];
      payload.aura = nextAura;
      payload.money = nextMoney;
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      const res = await adminApi.updateUser(id, payload);
      setUsers(prev => prev.map(u => u.id === id ? res.data.user : u));
      setEditingUser(null);
      setEditModalUser(null);
      setEditModalOpen(false);
      setEditPassword('');
      setEditAuraAddAmount(0);
      setEditAuraRemoveAmount(0);
      setEditMoneyAddAmount(0);
      setEditMoneyRemoveAmount(0);
      showMessage('success', 'Utilisateur mis à jour');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const openBadgeModal = (userId: string) => {
    setBadgeModalUserId(userId);
    setBadgeModalBadgeId('');
    setBadgeModalReason('');
    if (badges.length === 0) fetchBadges();
    setBadgeModalOpen(true);
  };

  const handleBadgeModalAward = async () => {
    if (!badgeModalBadgeId) return;
    const targetIds = badgeModalUserId ? [badgeModalUserId] : selectedUserIds;
    try {
      for (const uid of targetIds) {
        await badgesApi.award({ userId: uid, badgeId: badgeModalBadgeId, reason: badgeModalReason || undefined });
      }
      showMessage('success', `Badge attribué à ${targetIds.length} utilisateur(s)`);
      setBadgeModalOpen(false);
      setBadgeModalUserId('');
      setBadgeModalBadgeId('');
      setBadgeModalReason('');
      if (!badgeModalUserId) setSelectedUserIds([]);
    } catch {
      showMessage('error', 'Erreur lors de l\'attribution du badge');
    }
  };

  const massMuteUsers = async () => {
    try {
      for (const uid of selectedUserIds) {
        const u = users.find(usr => usr.id === uid);
        if (u && !u.isChatMuted) {
          const res = await adminApi.updateUser(uid, { isChatMuted: true });
          setUsers(prev => prev.map(usr => usr.id === uid ? res.data.user : usr));
        }
      }
      showMessage('success', `${selectedUserIds.length} utilisateur(s) muté(s)`);
      setSelectedUserIds([]);
    } catch {
      showMessage('error', 'Erreur lors du mute en masse');
    }
  };

  const massDeleteUsers = async () => {
    const ids = [...selectedUserIds];
    try {
      for (const uid of ids) {
        await adminApi.deleteUser(uid);
        setUsers(prev => prev.filter(u => u.id !== uid));
      }
      showMessage('success', `${ids.length} utilisateur(s) supprimé(s)`);
      setSelectedUserIds([]);
      setMassDeleteOpen(false);
    } catch {
      showMessage('error', 'Erreur lors de la suppression en masse');
    }
  };

  const openMassBanDialog = () => {
    setMassBanTargetIds([...selectedUserIds]);
    setBanReason('');
    setBanType('TEMPORARY');
    setBanDuration(24);
    setBanDialogOpen(true);
  };

  const updateUserRole = async (targetUser: AdminUser, role: AdminRole) => {
    if (getAdminRole(targetUser) === role) {
      return;
    }

    setUpdatingRoleUserId(targetUser.id);
    try {
      const res = await adminApi.updateUser(targetUser.id, { role });
      setUsers(prev => prev.map(u => u.id === targetUser.id ? res.data.user : u));
      showMessage('success', 'Role mis a jour');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setUpdatingRoleUserId(null);
    }
  };

  const toggleChatMute = async (u: AdminUser) => {
    setMutingUser(u.id);
    try {
      const res = await adminApi.updateUser(u.id, { isChatMuted: !u.isChatMuted });
      setUsers(prev => prev.map(user => user.id === u.id ? res.data.user : user));
      showMessage('success', res.data.user.isChatMuted ? 'Utilisateur mute' : 'Utilisateur démute');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setMutingUser(null);
    }
  };

  const deleteUser = async (id: string) => {
    setDeleting(id);
    try {
      await adminApi.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      showMessage('success', 'Utilisateur supprimé');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setDeleting(null);
    }
  };

  const clearChat = async () => {
    setClearingChat(true);
    try {
      const res = await adminApi.clearChat();
      showMessage('success', res.data.message);
      if (activeTab === 'chat-history') {
        await fetchChatHistoryDays();
        if (chatHistoryDay) {
          await fetchChatHistoryDay(chatHistoryDay, showDeletedChatMessages);
        }
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setClearingChat(false);
    }
  };

  const forceDivorceUser = async (id: string) => {
    setForcingDivorceUserId(id);
    try {
      const res = await adminApi.forceDivorceUser(id);
      await fetchUsers();
      showMessage('success', res.data.message);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setForcingDivorceUserId(null);
    }
  };

  const exportChat = async (day?: string) => {
    if (day) {
      setExportingChatDay(day);
    } else {
      setExportingChat(true);
    }
    try {
      const res = await adminApi.exportChat(day);
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/json' });
      const text = await blob.text();
      const parsed = JSON.parse(text) as { messageCount?: number };
      const messageCount = parsed.messageCount ?? 0;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const contentDisposition = res.headers?.['content-disposition'] as string | undefined;
      const match = contentDisposition?.match(/filename="([^"]+)"/);
      link.href = url;
      link.download = match?.[1] ?? `chat-export-${day ?? 'all-time'}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showMessage('success', day ? `Export du ${day} : ${messageCount} message(s) exporté(s)` : `Export : ${messageCount} message(s) exporté(s)`);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur lors de l’export du chat');
    } finally {
      if (day) {
        setExportingChatDay((current) => (current === day ? null : current));
      } else {
        setExportingChat(false);
      }
    }
  };

  const fetchChatHistoryDays = async (append: boolean = false) => {
    if (append) {
      if (!chatHistoryCursor || loadingMoreChatHistoryDays || loadingChatHistoryDays) {
        return;
      }
      setLoadingMoreChatHistoryDays(true);
    } else {
      setLoadingChatHistoryDays(true);
    }

    try {
      const res = await adminApi.getChatHistoryDays({
        limit: 60,
        cursor: append ? chatHistoryCursor : undefined,
      });

      const incomingDays = res.data.days ?? [];
      setChatHistoryDays((prev) => {
        if (!append) return incomingDays;
        const seen = new Set(prev.map((entry) => entry.day));
        return [...prev, ...incomingDays.filter((entry) => !seen.has(entry.day))];
      });

      setChatHistoryCursor(res.data.nextCursor ?? null);

      if (!append && incomingDays.length > 0) {
        const nextSelectedDay = chatHistoryDay && incomingDays.some((entry) => entry.day === chatHistoryDay)
          ? chatHistoryDay
          : incomingDays[0].day;
        setChatHistoryDay(nextSelectedDay);
      }

      if (!append && incomingDays.length === 0) {
        setChatHistoryDay(null);
        setChatHistoryMessages([]);
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur lors du chargement des jours du chat');
    } finally {
      setLoadingChatHistoryDays(false);
      setLoadingMoreChatHistoryDays(false);
    }
  };

  const fetchChatHistoryDay = async (day: string, includeDeleted: boolean = showDeletedChatMessages) => {
    setLoadingChatHistoryMessages(true);
    try {
      const res = await adminApi.getChatHistoryByDay(day, includeDeleted);
      setChatHistoryMessages(res.data.messages ?? []);
      setChatHistoryDay(day);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur lors du chargement des messages du jour');
    } finally {
      setLoadingChatHistoryMessages(false);
    }
  };

  const softDeleteChatMessage = async (messageId: string) => {
    setSoftDeletingChatMessageId(messageId);
    try {
      await adminApi.softDeleteChatMessage(messageId);
      if (showDeletedChatMessages) {
        setChatHistoryMessages((prev) => prev.map((msg) => (
          msg.id === messageId
            ? {
                ...msg,
                deletedAt: new Date().toISOString(),
                deletedByUserId: user?.id ?? msg.deletedByUserId,
                pinned: false,
                pinnedAt: null,
              }
            : msg
        )));
      } else {
        setChatHistoryMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      }
      await fetchChatHistoryDays();
      showMessage('success', 'Message supprimé visuellement');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur lors de la suppression visuelle');
    } finally {
      setSoftDeletingChatMessageId(null);
    }
  };

  const openInventory = (u: AdminUser) => {
    setInventoryUser(u);
    setInventoryDialogOpen(true);
    setInventoryAddQuantity(1);
    setInventoryAddItemId(items[0]?.id || '');
    fetchUserInventory(u.id);
  };

  const openSharedMoney = (u: AdminUser) => {
    setSharedMoneyUser(u);
  };

  const closeInventory = () => {
    setInventoryDialogOpen(false);
    setInventoryUser(null);
    setInventoryItems([]);
    setInventoryQuantities({});
    setInventoryAddItemId('');
  };

  const fetchUserInventory = async (userId: string) => {
    try {
      setLoadingInventory(true);
      const res = await adminApi.getUserInventory(userId);
      setInventoryItems(res.data.items);
      setInventoryQuantities(res.data.items.reduce((acc, item) => {
        acc[item.id] = item.quantity;
        return acc;
      }, {} as Record<string, number>));
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      showMessage('error', 'Erreur lors du chargement de l\'inventaire');
    } finally {
      setLoadingInventory(false);
    }
  };

  const addInventoryItem = async () => {
    if (!inventoryUser || !inventoryAddItemId) {
      showMessage('error', 'Sélectionnez un objet');
      return;
    }
    if (inventoryAddQuantity <= 0) {
      showMessage('error', 'Quantité invalide');
      return;
    }

    try {
      setAddingInventoryItem(true);
      const res = await adminApi.addUserInventoryItem(inventoryUser.id, {
        itemId: inventoryAddItemId,
        quantity: inventoryAddQuantity,
      });
      setInventoryItems((prev) => {
        const existingIndex = prev.findIndex((item) => item.item.id === inventoryAddItemId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = res.data.item;
          return updated;
        }
        return [res.data.item, ...prev];
      });
      setInventoryQuantities((prev) => ({
        ...prev,
        [res.data.item.id]: res.data.item.quantity,
      }));
      showMessage('success', 'Objet ajouté');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setAddingInventoryItem(false);
    }
  };

  const updateInventoryQuantity = async (userItemId: string) => {
    if (!inventoryUser) return;
    const nextQuantity = inventoryQuantities[userItemId];
    if (nextQuantity === undefined) return;

    try {
      setUpdatingInventoryItem(userItemId);
      const res = await adminApi.updateUserInventoryItem(inventoryUser.id, userItemId, {
        quantity: nextQuantity,
      });
      if (res.data.removed) {
        setInventoryItems((prev) => prev.filter((item) => item.id !== userItemId));
        setInventoryQuantities((prev) => {
          const { [userItemId]: _removed, ...rest } = prev;
          return rest;
        });
      } else if (res.data.item) {
        setInventoryItems((prev) => prev.map((item) => item.id === userItemId ? res.data.item! : item));
        setInventoryQuantities((prev) => ({
          ...prev,
          [userItemId]: res.data.item!.quantity,
        }));
      }
      showMessage('success', 'Inventaire mis à jour');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setUpdatingInventoryItem(null);
    }
  };

  const removeInventoryItem = async (userItemId: string) => {
    if (!inventoryUser) return;
    try {
      setRemovingInventoryItem(userItemId);
      await adminApi.deleteUserInventoryItem(inventoryUser.id, userItemId);
      setInventoryItems((prev) => prev.filter((item) => item.id !== userItemId));
      setInventoryQuantities((prev) => {
        const { [userItemId]: _removed, ...rest } = prev;
        return rest;
      });
      showMessage('success', 'Objet retiré');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setRemovingInventoryItem(null);
    }
  };

  const filteredClans = clans.filter((clan) => {
    const query = clanSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      clan.name.toLowerCase().includes(query) ||
      clan.owner.username.toLowerCase().includes(query) ||
      clan.members.some((member) => member.user.username.toLowerCase().includes(query))
    );
  });

  const pageBreakdownKeys = activityBreakdown?.topPages.map((entry) => entry.page) ?? [];
  const pageBreakdownData: ActivityBreakdownChartPoint[] = activityBreakdown?.pageSeries.map((entry) => ({
    hour: entry.hour,
    hourLabel: entry.hourLabel,
    total: entry.total,
    ...entry.values,
  })) ?? [];
  const gameBreakdownKeys = activityBreakdown?.topGames.map((entry) => entry.gameType) ?? [];
  const gameBreakdownData: ActivityBreakdownChartPoint[] = activityBreakdown?.gameSeries.map((entry) => ({
    hour: entry.hour,
    hourLabel: entry.hourLabel,
    total: entry.total,
    ...entry.values,
  })) ?? [];
  const gameDurationBreakdownKeys = activityBreakdown?.topGameDurations.map((entry) => entry.gameType) ?? [];
  const gameDurationBreakdownData: ActivityBreakdownChartPoint[] = activityBreakdown?.gameDurationSeries.map((entry) => ({
    hour: entry.hour,
    hourLabel: entry.hourLabel,
    total: entry.total,
    ...entry.values,
  })) ?? [];
  const platformTopGamesChartData = (platformStats?.topGames ?? []).map((entry) => ({
    ...entry,
    label: GAME_TYPE_LABELS[entry.gameType] ?? entry.gameType.replace(/_/g, ' '),
  }));
  const platformTopGamesChartHeight = Math.max(340, platformTopGamesChartData.length * 28);
  const wealthUsers = users.filter((entry) => !entry.isSuperAdmin);
  const moneyDistribution = calculateWealthDistribution(wealthUsers, (entry) => entry.money);
  const auraDistribution = calculateWealthDistribution(wealthUsers, (entry) => entry.aura);
  const usersForDemographics = wealthUsers;
  const totalDemographicUsers = usersForDemographics.length;
  const levelDistributionData = buildCountDistribution(usersForDemographics, (entry) => normalizeLevelLabel(entry.schoolLevel));
  const classDistributionData = buildCountDistribution(usersForDemographics, (entry) => normalizeClassLabel(entry));
  const classAveragesData: ClassAveragePoint[] = (() => {
    const grouped = new Map<string, { count: number; auraSum: number; moneySum: number }>();
    for (const entry of usersForDemographics) {
      const label = normalizeClassLabel(entry);
      const current = grouped.get(label) || { count: 0, auraSum: 0, moneySum: 0 };
      current.count += 1;
      current.auraSum += Number.isFinite(entry.aura) ? entry.aura : 0;
      current.moneySum += Number.isFinite(entry.money) ? entry.money : 0;
      grouped.set(label, current);
    }

    return [...grouped.entries()]
      .map(([label, stats]) => ({
        label,
        count: stats.count,
        avgAura: stats.count > 0 ? stats.auraSum / stats.count : 0,
        avgMoney: stats.count > 0 ? stats.moneySum / stats.count : 0,
      }))
      .sort((a, b) => b.avgAura - a.avgAura)
      .slice(0, 12);
  })();
  const topUsersByLevel: TopUserByLevel[] = (() => {
    const grouped = new Map<string, AdminUser[]>();
    for (const entry of usersForDemographics) {
      const level = normalizeLevelLabel(entry.schoolLevel);
      const bucket = grouped.get(level) || [];
      bucket.push(entry);
      grouped.set(level, bucket);
    }

    return [...grouped.entries()]
      .map(([level, levelUsers]) => ({
        level,
        users: [...levelUsers].sort((a, b) => b.aura - a.aura).slice(0, 5),
      }))
      .sort((a, b) => b.users.length - a.users.length || a.level.localeCompare(b.level, 'fr-FR'));
  })();
  const usersByClass = (() => {
    const grouped = new Map<string, AdminUser[]>();
    for (const entry of usersForDemographics) {
      const classLabel = normalizeClassLabel(entry);
      const bucket = grouped.get(classLabel) || [];
      bucket.push(entry);
      grouped.set(classLabel, bucket);
    }

    return [...grouped.entries()]
      .map(([classLabel, classUsers]) => ({
        classLabel,
        users: [...classUsers].sort((a, b) => b.aura - a.aura || a.username.localeCompare(b.username, 'fr-FR')),
      }))
      .sort((a, b) => b.users.length - a.users.length || a.classLabel.localeCompare(b.classLabel, 'fr-FR'));
  })();
  const normalizedUserSearchQuery = userSearchQuery.trim().toLowerCase();
  const filteredUsers = normalizedUserSearchQuery
    ? users.filter((entry) => (
      entry.username.toLowerCase().includes(normalizedUserSearchQuery)
      || (entry.firstName || '').toLowerCase().includes(normalizedUserSearchQuery)
    ))
    : users;
  const selectableUsers = filteredUsers.filter((entry) => !entry.isSuperAdmin && entry.id !== user?.id);
  const allSelected = selectableUsers.length > 0 && selectableUsers.every((entry) => selectedUserIds.includes(entry.id));
  const baseEditAura = toSafeNumber(editModalUser?.aura ?? editValues.aura);
  const baseEditMoney = toSafeNumber(editModalUser?.money ?? editValues.money);
  const nextEditAura = toSafeNumber(editValues.aura) + editAuraAddAmount - editAuraRemoveAmount;
  const nextEditMoney = toSafeNumber(editValues.money) + editMoneyAddAmount - editMoneyRemoveAmount;


  return (
    <>
    <PageShell>
      <div className={SPACING.PAGE_CONTENT}>
        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as AdminTab)}
          className={SPACING.SECTION_SPACING}
        >
          {/* ── Custom admin navigation with grouped dropdowns ── */}
          {(() => {
            const inboxCount = pendingUsers.length + bugReports.filter(b => b.status === 'PENDING').length + banAppeals.filter(a => a.status === 'PENDING').length + nameChangeRequests.filter(n => n.status === 'PENDING').length + customBadgeRequests.length + pendingFormationReviews.length + pendingAds.length + pendingSanctions.filter(s => s.status === 'PENDING').length;
            const navBtn = (tabs: AdminTab | AdminTab[], label: string, icon: ReactNode, onClick: () => void, badge?: ReactNode) => {
              const active = Array.isArray(tabs) ? (tabs as AdminTab[]).includes(activeTab) : activeTab === tabs;
              return (
                <button
                  onClick={onClick}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                    active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                  )}
                >
                  {icon}
                  {label}
                  {badge}
                </button>
              );
            };
            const dropdownItemBtn = (tab: AdminTab, label: string, icon: ReactNode, onClick: () => void, badge?: ReactNode) => (
              <button
                key={tab}
                onClick={onClick}
                className={cn(
                  'w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-sm transition-colors',
                  activeTab === tab ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                )}
              >
                {icon}
                {label}
                {badge && <span className="ml-auto">{badge}</span>}
              </button>
            );
            // Outer: transparent padding bridges the gap so hover state persists when moving into the dropdown
            const dropdownOuter = 'absolute left-0 top-full pt-1 z-50 hidden group-hover:block';
            const dropdownInner = 'min-w-40 rounded-md border border-border/50 bg-popover shadow-lg p-1 flex flex-col gap-0.5';
            const isFiscalOnly = isReadOnlyInspectionUser;
            return (
              <div className="flex flex-wrap gap-1 p-1 bg-muted/40 rounded-lg border border-border/30 mb-6">
                {/* Réception — admin only */}
                {!isFiscalOnly && navBtn('inbox', 'Réception', <Inbox className="w-4 h-4 shrink-0" />, () => { setActiveTab('inbox'); fetchCustomBadgeRequests(); fetchPendingFormationReviews(); fetchPendingAds(); fetchPendingSanctions(); },
                  inboxCount > 0 ? <span className="inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-semibold leading-none">{inboxCount}</span> : undefined
                )}

                {/* Utilisateurs — admin only */}
                {!isFiscalOnly && navBtn('users', 'Utilisateurs', <Users className="w-4 h-4 shrink-0" />, () => setActiveTab('users'))}

                {/* Clubs — admin only */}
                {!isFiscalOnly && navBtn('clubs', 'Clubs', <Shield className="w-4 h-4 shrink-0" />, () => setActiveTab('clubs'))}

                {/* Logs — visible to all */}
                {navBtn('logs', 'Logs', <Activity className="w-4 h-4 shrink-0" />, () => setActiveTab('logs'),
                  logStats ? <span className={TYPOGRAPHY.XS}>{logStats.total.toLocaleString()}</span> : undefined
                )}

                {/* Sanctions — admin only */}
                {!isFiscalOnly && navBtn('bans', 'Sanctions', <Gavel className="w-4 h-4 shrink-0" />, () => setActiveTab('bans'),
                  bans.filter(b => b.isActive).length > 0 ? <span className={TYPOGRAPHY.XS}>{bans.filter(b => b.isActive).length}</span> : undefined
                )}

                {/* Contenu dropdown — admin only */}
                {!isFiscalOnly && <div className="relative group">
                  <button className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                    ['content', 'ads'].includes(activeTab) ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                  )}>
                    <Package className="w-4 h-4 shrink-0" />
                    Contenu
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  </button>
                  <div className={dropdownOuter}>
                    <div className={dropdownInner}>
                      {dropdownItemBtn('content', 'Objets', <Package className="w-3.5 h-3.5" />, () => setActiveTab('content'))}
                      {dropdownItemBtn('ads', 'Publicités', <Eye className="w-3.5 h-3.5" />, () => { setActiveTab('ads'); fetchPendingAds(); fetchAllAds(); },
                        pendingAds.length > 0 ? <span className="inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-amber-600 text-white text-[11px] font-semibold leading-none">{pendingAds.length}</span> : undefined
                      )}
                    </div>
                  </div>
                </div>}

                {/* Inspection fiscale — visible to fiscal inspectors and judges */}
                {isFiscalOnly && navBtn('fiscal', 'Inspection fiscale', <Landmark className="w-4 h-4 shrink-0" />, () => { setActiveTab('fiscal'); fetchFiscalUsers(); })}

                {/* Finance — taxes visible to all, referrals admin only */}
                {isFiscalOnly
                  ? navBtn('taxes', 'Impôts', <Landmark className="w-4 h-4 shrink-0" />, () => { setActiveTab('taxes'); fetchTaxSettings(); })
                  : <div className="relative group">
                  <button className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                    ['taxes', 'referrals'].includes(activeTab) ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                  )}>
                    <Coins className="w-4 h-4 shrink-0" />
                    Finance
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  </button>
                  <div className={dropdownOuter}>
                    <div className={dropdownInner}>
                      {dropdownItemBtn('taxes', 'Impôts', <Landmark className="w-3.5 h-3.5" />, () => { setActiveTab('taxes'); fetchTaxSettings(); })}
                      {dropdownItemBtn('referrals', 'Parrainage', <Users className="w-3.5 h-3.5" />, () => { setActiveTab('referrals'); fetchReferralStats(); },
                        referralStats ? <span className="text-xs text-muted-foreground">{referralStats.overview.approvedReferredUsers.toLocaleString('fr-FR')} validés</span> : undefined
                      )}
                    </div>
                  </div>
                </div>}

                {/* Statistiques dropdown — admin only */}
                {!isFiscalOnly && <div className="relative group">
                  <button className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                    ['activity', 'demographics', 'badges'].includes(activeTab) ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                  )}>
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    Statistiques
                    {onlineStats && <span className={TYPOGRAPHY.XS}>{onlineStats.current} en ligne</span>}
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  </button>
                  <div className={dropdownOuter}>
                    <div className={dropdownInner}>
                      {dropdownItemBtn('activity', 'Activité', <Activity className="w-3.5 h-3.5" />, () => { setActiveTab('activity'); fetchActivity(activityPeriod); fetchActivityBreakdown(activityBreakdownDay); fetchPlaytimeLeaderboard(playtimePeriod); fetchPlatformStats(); fetchGamesLeaderboard(); })}
                      {dropdownItemBtn('demographics', 'Répartition', <BarChart2 className="w-3.5 h-3.5" />, () => setActiveTab('demographics'),
                        <span className="text-xs text-muted-foreground">{totalDemographicUsers.toLocaleString('fr-FR')} users</span>
                      )}
                      {dropdownItemBtn('badges', 'Badges', <Award className="w-3.5 h-3.5" />, () => { setActiveTab('badges'); fetchBadges(); })}
                    </div>
                  </div>
                </div>}

                {/* Paramètres dropdown — admin only */}
                {!isFiscalOnly && <div className="relative group">
                  <button className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                    ['settings', 'game-limits', 'communication', 'chat-history'].includes(activeTab) ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                  )}>
                    <Settings className="w-4 h-4 shrink-0" />
                    Paramètres
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  </button>
                  <div className={cn(dropdownOuter, 'left-auto right-0')}>
                    <div className={dropdownInner}>
                    {dropdownItemBtn('settings', 'Paramètres', <Settings className="w-3.5 h-3.5" />, () => setActiveTab('settings'))}
                    {dropdownItemBtn('game-limits', 'Limites jeux', <Gamepad2 className="w-3.5 h-3.5" />, () => setActiveTab('game-limits'))}
                    {dropdownItemBtn('chat-history', 'Historique chat', <CalendarRange className="w-3.5 h-3.5" />, () => { setActiveTab('chat-history'); void fetchChatHistoryDays(); })}
                    {dropdownItemBtn('communication', 'Communication', <MessageCircle className="w-3.5 h-3.5" />, () => { setActiveTab('communication'); fetchSupportThreads(); },
                      supportUnread > 0 ? <span className="inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-semibold leading-none">{supportUnread}</span> : undefined
                    )}
                    {isAdminOrSuperAdmin && (
                      <div className="border-t border-border/40 mt-1 pt-1">
                        <button
                          onClick={openPrismaStudio}
                          disabled={openingPrisma}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-sm transition-colors disabled:opacity-50"
                        >
                          {openingPrisma ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
                          Prisma Studio
                        </button>
                      </div>
                    )}
                    </div>
                  </div>
                </div>}
            </div>
            );
          })()}

        <InboxTab
          pendingUsers={pendingUsers}
          bugReports={bugReports}
          banAppeals={banAppeals}
          nameChangeRequests={nameChangeRequests}
          customBadgeRequests={customBadgeRequests}
          pendingFormationReviews={pendingFormationReviews}
          pendingSanctions={pendingSanctions}
          archivedRegistrations={archivedRegistrations}
          inboxFilter={inboxFilter}
          selectedInboxItem={selectedInboxItem}
          legacyArchivedRegistrationsCount={legacyArchivedRegistrationsCount}
          importingArchivedRegistrations={importingArchivedRegistrations}
          loadingPending={loadingPending}
          loadingBugs={loadingBugs}
          loadingAppeals={loadingAppeals}
          loadingNameChanges={loadingNameChanges}
          loadingCustomBadgeRequests={customBadgeRequestsLoading}
          loadingPendingFormationReviews={pendingFormationReviewsLoading}
          loadingPendingSanctions={loadingPendingSanctions}
          approvingUser={approvingUser}
          rejectingUser={rejectingUser}
          updatingBug={updatingBug}
          reviewingAppeal={reviewingAppeal}
          reviewingNameChange={reviewingNameChange}
          reviewingFormationProductId={reviewingFormationProductId}
          approvingSanction={approvingSanction}
          rejectingSanction={rejectingSanction}
          bugReply={bugReply}
          rejectNotes={rejectNotes}
          importArchivedRegistrations={importArchivedRegistrations}
          setInboxFilter={setInboxFilter}
          setSelectedInboxItem={setSelectedInboxItem}
          approveUser={approveUser}
          rejectUser={rejectUser}
          setBugReply={setBugReply}
          setRejectNotes={setRejectNotes}
          sendBugReply={sendBugReply}
          toggleBugStatus={toggleBugStatus}
          reviewBanAppeal={reviewBanAppeal}
          reviewNameChangeRequest={reviewNameChangeRequest}
          approveCustomBadgeRequest={handleApproveCustomBadge}
          rejectCustomBadgeRequest={handleRejectCustomBadge}
          reviewFormationProduct={handleReviewFormationProduct}
          approveSanction={approveSanction}
          rejectSanction={rejectSanction}
        />
        <AdsTab
          pendingAds={pendingAds}
          pendingAdsLoading={pendingAdsLoading}
          allAds={allAds}
          allAdsLoading={allAdsLoading}
          handleReviewAd={handleReviewAd}
          handleDeleteAdForever={handleDeleteAdForever}
          reviewingAdId={reviewingAdId}
          handleToggleAdVisibility={handleToggleAdVisibility}
        />

        <UsersTab
          userSearchQuery={userSearchQuery}
          setUserSearchQuery={setUserSearchQuery}
          handleExportUsersCsv={handleExportUsersCsv}
          downloadingUsersCsv={downloadingUsersCsv}
          filteredUsers={filteredUsers}
          selectedUserIds={selectedUserIds}
          setSelectedUserIds={setSelectedUserIds}
          openBadgeModal={openBadgeModal}
          massMuteUsers={massMuteUsers}
          openMassBanDialog={openMassBanDialog}
          setMassDeleteOpen={setMassDeleteOpen}
          loading={loading}
          allSelected={allSelected}
          selectableUsers={selectableUsers}
          user={user ? ({ id: user.id } as any) : null}
          startEditing={startEditing}
          openInventory={openInventory}
          openSharedMoney={openSharedMoney}
          getAdminRole={getAdminRole}
          toggleChatMute={toggleChatMute}
          mutingUser={mutingUser}
          openWarningDialog={openWarningDialog}
          openBanDialog={openBanDialog}
          deleting={deleting}
          forcingDivorceUserId={forcingDivorceUserId}
          forceDivorceUser={forceDivorceUser}
          deleteUser={deleteUser}
        />
        <ClubsTab
          filteredClans={filteredClans}
          clanSearchQuery={clanSearchQuery}
          setClanSearchQuery={setClanSearchQuery}
          loadingClans={loadingClans}
          startEditingClan={startEditingClan}
          deletingClan={deletingClan}
          deleteClan={deleteClan}
          editingClanId={editingClanId}
          clans={clans}
          clanForm={clanForm}
          setClanForm={setClanForm}
          uploadItemImageFile={uploadItemImageFile}
          saveClan={saveClan}
          savingClan={savingClan}
          cancelEditingClan={cancelEditingClan}
          transferringClanLeader={transferringClanLeader}
          transferClanLeadership={transferClanLeadership}
          clanEvents={clanEvents}
          loadingClanEvents={loadingClanEvents}
          resetClanEventForm={resetClanEventForm}
          startEditingClanEvent={startEditingClanEvent}
          deletingClanEvent={deletingClanEvent}
          deleteClanEvent={deleteClanEvent}
          editingClanEventId={editingClanEventId}
          clanEventForm={clanEventForm}
          setClanEventForm={setClanEventForm}
          items={items}
          saveClanEvent={saveClanEvent}
          savingClanEvent={savingClanEvent}
        />

        <BraquageLegalTab users={users} />
        <ContentTab
          loadingCategories={loadingCategories}
          shopCategories={shopCategories}
          removeShopCategory={removeShopCategory}
          savingCategories={savingCategories}
          newCategoryId={newCategoryId}
          setNewCategoryId={setNewCategoryId}
          newCategoryLabel={newCategoryLabel}
          setNewCategoryLabel={setNewCategoryLabel}
          addShopCategory={addShopCategory}
          items={items}
          djForcedSkinLoading={djForcedSkinLoading}
          djForcedSkinSelected={djForcedSkinSelected}
          setDjForcedSkinSelected={setDjForcedSkinSelected}
          djForcedSkinId={djForcedSkinId}
          saveDjForcedSkin={saveDjForcedSkin}
          djForcedSkinSaving={djForcedSkinSaving}
          itemImportInputRef={itemImportInputRef}
          handleImportItemsFile={handleImportItemsFile}
          handleExportItems={handleExportItems}
          openImportItemsPicker={openImportItemsPicker}
          importingItems={importingItems}
          openCreateItemDialog={openCreateItemDialog}
          loadingItems={loadingItems}
          parseEffect={parseEffect}
          EFFECT_TYPES={EFFECT_TYPES}
          ITEM_TYPE_LABELS={ITEM_TYPE_LABELS}
          openEditItemDialog={openEditItemDialog}
          deletingItem={deletingItem}
          deleteItem={deleteItem}
        />

        <TaxesTabComponent
          taxLastRunDate={taxLastRunDate}
          loadingTaxSettings={loadingTaxSettings}
          taxBrackets={taxBrackets}
          updateTaxBracket={updateTaxBracket}
          removeTaxBracket={removeTaxBracket}
          savingTaxSettings={savingTaxSettings}
          addTaxBracket={addTaxBracket}
          saveTaxSettings={saveTaxSettings}
          runTaxNow={runTaxNow}
          runningTaxNow={runningTaxNow}
        />

        <FiscalTab
          showFiscalSanctionModal={showFiscalSanctionModal}
          setShowFiscalSanctionModal={setShowFiscalSanctionModal}
          fiscalUsers={fiscalUsers}
          showMessage={showMessage}
          user={user}
          fiscalFundRatePercent={fiscalFundRatePercent}
          fiscalFundBalance={fiscalFundBalance}
          fiscalPaymentSource={fiscalPaymentSource}
          savingFiscalPaymentSource={savingFiscalPaymentSource}
          saveFiscalPaymentSource={saveFiscalPaymentSource}
          loadingFiscalUsers={loadingFiscalUsers}
        />
        <GameLimitsTab
          dailyGameAuraLimit={dailyGameAuraLimit}
          setDailyGameAuraLimit={setDailyGameAuraLimit}
          dailyGameMoneyLimit={dailyGameMoneyLimit}
          setDailyGameMoneyLimit={setDailyGameMoneyLimit}
          saveDailyGameLimits={saveDailyGameLimits}
          savingDailyGameLimits={savingDailyGameLimits}
        />

        <SettingsTab
          fakeOnlineEnabled={fakeOnlineEnabled}
          savingFakeOnline={savingFakeOnline}
          saveFakeOnline={saveFakeOnline}
          duelMatchmakingEnabled={duelMatchmakingEnabled}
          savingDuelMatchmakingEnabled={savingDuelMatchmakingEnabled}
          saveDuelMatchmakingEnabled={saveDuelMatchmakingEnabled}
          referralEnabled={referralEnabled}
          savingReferralEnabled={savingReferralEnabled}
          saveReferralEnabled={saveReferralEnabled}
          referralDashboardCardEnabled={referralDashboardCardEnabled}
          savingReferralDashboardCardEnabled={savingReferralDashboardCardEnabled}
          saveReferralDashboardCardEnabled={saveReferralDashboardCardEnabled}
          referralRewardAmount={referralRewardAmount}
          setReferralRewardAmount={setReferralRewardAmount}
          saveReferralReward={saveReferralReward}
          savingReferralReward={savingReferralReward}
          dailyAuraDistributionLimit={dailyAuraDistributionLimit}
          setDailyAuraDistributionLimit={setDailyAuraDistributionLimit}
          saveDailyAuraDistributionLimit={saveDailyAuraDistributionLimit}
          savingDailyAuraDistributionLimit={savingDailyAuraDistributionLimit}
          auraCoinBuyFeePercentage={auraCoinBuyFeePercentage}
          setAuraCoinBuyFeePercentage={setAuraCoinBuyFeePercentage}
          saveAuraCoinBuyFee={saveAuraCoinBuyFee}
          savingAuraCoinBuyFee={savingAuraCoinBuyFee}
          stableCoinBuyFeePercentage={stableCoinBuyFeePercentage}
          setStableCoinBuyFeePercentage={setStableCoinBuyFeePercentage}
          saveStableCoinBuyFee={saveStableCoinBuyFee}
          savingStableCoinBuyFee={savingStableCoinBuyFee}
          chaosCoinBuyFeePercentage={chaosCoinBuyFeePercentage}
          setChaosCoinBuyFeePercentage={setChaosCoinBuyFeePercentage}
          saveChaosCoinBuyFee={saveChaosCoinBuyFee}
          savingChaosCoinBuyFee={savingChaosCoinBuyFee}
          clashAttackCooldownMinutes={clashAttackCooldownMinutes}
          setClashAttackCooldownMinutes={setClashAttackCooldownMinutes}
          saveClashAttackCooldown={saveClashAttackCooldown}
          savingClashAttackCooldown={savingClashAttackCooldown}
          chatBlockEnabled={chatBlockEnabled}
          setChatBlockEnabled={setChatBlockEnabled}
          savingChatBlockSettings={savingChatBlockSettings}
          chatBlockMessage={chatBlockMessage}
          setChatBlockMessage={setChatBlockMessage}
          chatAutoBlockEnabled={chatAutoBlockEnabled}
          setChatAutoBlockEnabled={setChatAutoBlockEnabled}
          chatAutoBlockStart={chatAutoBlockStart}
          setChatAutoBlockStart={setChatAutoBlockStart}
          chatAutoBlockEnd={chatAutoBlockEnd}
          setChatAutoBlockEnd={setChatAutoBlockEnd}
          saveChatBlockSettings={saveChatBlockSettings}
          announcementMessage={announcementMessage}
          setAnnouncementMessage={setAnnouncementMessage}
          setAnnouncementOpen={setAnnouncementOpen}
          announcementOpen={announcementOpen}
          saveAnnouncement={saveAnnouncement}
          savingAnnouncement={savingAnnouncement}
          loginMessage={loginMessage}
          loginRegisterCtaEnabled={loginRegisterCtaEnabled}
          setLoginCommOpen={setLoginCommOpen}
          loginCommOpen={loginCommOpen}
          saveLoginMessage={saveLoginMessage}
          savingLoginMessage={savingLoginMessage}
          setLoginMessage={setLoginMessage}
          saveLoginRegisterCta={saveLoginRegisterCta}
          savingLoginRegisterCta={savingLoginRegisterCta}
          defaultLandingPage={defaultLandingPage}
          setDefaultLandingPage={setDefaultLandingPage}
          saveDefaultLandingPage={saveDefaultLandingPage}
          savingDefaultLandingPage={savingDefaultLandingPage}
          youLogoAdminOnly={youLogoAdminOnly}
          saveYouLogoAdminOnly={saveYouLogoAdminOnly}
          savingYouLogoAdminOnly={savingYouLogoAdminOnly}
          updatesOpen={updatesOpen}
          setUpdatesOpen={setUpdatesOpen}
          maintenanceEnabled={maintenanceEnabled}
          maintenanceAutoWeekendEnabled={maintenanceAutoWeekendEnabled}
          setMaintenanceOpen={setMaintenanceOpen}
          maintenanceOpen={maintenanceOpen}
          loadingSettings={loadingSettings}
          setMaintenanceEnabled={setMaintenanceEnabled}
          setMaintenanceAutoWeekendEnabled={setMaintenanceAutoWeekendEnabled}
          maintenanceMessage={maintenanceMessage}
          setMaintenanceMessage={setMaintenanceMessage}
          maintenanceEndDate={maintenanceEndDate}
          setMaintenanceEndDate={setMaintenanceEndDate}
          saveMaintenance={saveMaintenance}
          savingMaintenance={savingMaintenance}
          businessCreationEnabled={businessCreationEnabled}
          saveBusinessCreationEnabled={saveBusinessCreationEnabled}
          savingBusinessCreation={savingBusinessCreation}
          purgeAllBusinesses={purgeAllBusinesses}
          purgingBusinesses={purgingBusinesses}
          resetBusinessUnlockLevels={resetBusinessUnlockLevels}
          resettingUnlockLevels={resettingUnlockLevels}
          deployOutput={deployOutput}
          setDeployModalOpen={setDeployModalOpen}
          deployModalOpen={deployModalOpen}
          deploying={deploying}
          confirm={confirm}
          setDeploying={setDeploying}
          setDeployOutput={setDeployOutput}
          adminApi={adminApi}
          user={user}
          backfillResult={backfillResult}
          backfillLoading={backfillLoading}
          setBackfillLoading={setBackfillLoading}
          setBackfillResult={setBackfillResult}
          alert={alert}
          fonctionnalitesOpen={fonctionnalitesOpen}
          setFonctionnalitesOpen={setFonctionnalitesOpen}
          blockedPages={blockedPages}
          blockedMessage={blockedMessage}
          setBlockedMessage={setBlockedMessage}
          blockedPageMessages={blockedPageMessages}
          toggleBlockedPage={toggleBlockedPage}
          updateBlockedPageMessage={updateBlockedPageMessage}
          saveBlockedPages={saveBlockedPages}
          savingBlocks={savingBlocks}
          exportChat={exportChat}
          exportingChat={exportingChat}
          clearingChat={clearingChat}
          clearChat={clearChat}
        />

        <BansTab
          bans={bans}
          loadingBans={loadingBans}
          unbanning={unbanning}
          unbanUser={unbanUser}
          warnings={warnings}
          loadingWarnings={loadingWarnings}
          warningDialogOpen={warningDialogOpen}
          setWarningDialogOpen={setWarningDialogOpen}
          deletingWarning={deletingWarning}
          deleteWarning={deleteWarning}
          users={users}
          warningUserId={warningUserId}
          setWarningUserId={setWarningUserId}
          warningType={warningType}
          setWarningType={setWarningType}
          warningSeverity={warningSeverity}
          setWarningSeverity={setWarningSeverity}
          warningMessage={warningMessage}
          setWarningMessage={setWarningMessage}
          amendeAmount={amendeAmount}
          setAmendeAmount={setAmendeAmount}
          createWarning={createWarning}
          creatingWarning={creatingWarning}
        />

        <LogsTab
          logStats={logStats}
          logFilter={logFilter}
          setLogFilter={setLogFilter}
          fetchLogs={fetchLogs}
          logTypeConfig={LOG_TYPE_CONFIG}
          gameTypes={GAME_TYPES}
          logTimelineEnabled={logTimelineEnabled}
          setLogTimelineEnabled={setLogTimelineEnabled}
          logTimelineDate={logTimelineDate}
          setLogTimelineDate={setLogTimelineDate}
          logTimelineRange={logTimelineRange}
          setLogTimelineRange={setLogTimelineRange}
          formatTimelineMinutes={formatTimelineMinutes}
          setDownloadLogsError={setDownloadLogsError}
          setDownloadLogsOpen={setDownloadLogsOpen}
          downloadLogsOpen={downloadLogsOpen}
          downloadLogsMode={downloadLogsMode}
          setDownloadLogsMode={setDownloadLogsMode}
          downloadLogsStartDate={downloadLogsStartDate}
          setDownloadLogsStartDate={setDownloadLogsStartDate}
          downloadLogsEndDate={downloadLogsEndDate}
          setDownloadLogsEndDate={setDownloadLogsEndDate}
          downloadLogsError={downloadLogsError}
          handleDownloadLogs={handleDownloadLogs}
          downloadingLogs={downloadingLogs}
          renderLogsPagination={renderLogsPagination}
          loadingLogs={loadingLogs}
          logs={logs}
          expandedLogIds={expandedLogIds}
          renderLogSummary={renderLogSummary}
          getGameDisplayInfo={getGameDisplayInfo}
          toggleLogExpand={toggleLogExpand}
          skipMetadataKeys={SKIP_METADATA_KEYS}
          metadataLabels={METADATA_LABELS}
          renderMetadataValue={renderMetadataValue}
        />

      {/* Ban Dialog */}
      <BanDialog
        isOpen={banDialogOpen}
        onOpenChange={setBanDialogOpen}
        banReason={banReason}
        setBanReason={setBanReason}
        banType={banType}
        setBanType={setBanType}
        banDuration={banDuration}
        setBanDuration={setBanDuration}
        creatingBan={creatingBan}
        onCreateBan={createBan}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={editModalOpen}
        onOpenChange={(open) => {
          if (!open) cancelEditing();
        }}
        editingUser={editingUser}
        editModalUser={editModalUser}
        editValues={editValues}
        setEditValues={setEditValues}
        editAuraAddAmount={editAuraAddAmount}
        setEditAuraAddAmount={setEditAuraAddAmount}
        editAuraRemoveAmount={editAuraRemoveAmount}
        setEditAuraRemoveAmount={setEditAuraRemoveAmount}
        baseEditAura={baseEditAura}
        nextEditAura={nextEditAura}
        editMoneyAddAmount={editMoneyAddAmount}
        setEditMoneyAddAmount={setEditMoneyAddAmount}
        editMoneyRemoveAmount={editMoneyRemoveAmount}
        setEditMoneyRemoveAmount={setEditMoneyRemoveAmount}
        baseEditMoney={baseEditMoney}
        nextEditMoney={nextEditMoney}
        editPassword={editPassword}
        setEditPassword={setEditPassword}
        saving={saving}
        updatingRoleUserId={updatingRoleUserId}
        user={user}
        onCancelEditing={cancelEditing}
        onSaveUser={saveUser}
        onUpdateUserRole={updateUserRole}
      />

      <BadgeAssignModal
        isOpen={badgeModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBadgeModalOpen(false);
            setBadgeModalUserId('');
            setBadgeModalBadgeId('');
            setBadgeModalReason('');
          }
        }}
        badgeModalUserId={badgeModalUserId}
        selectedUserIds={selectedUserIds}
        users={users}
        badges={badges}
        badgeModalBadgeId={badgeModalBadgeId}
        setBadgeModalBadgeId={setBadgeModalBadgeId}
        badgeModalReason={badgeModalReason}
        setBadgeModalReason={setBadgeModalReason}
        onAward={handleBadgeModalAward}
        onClose={() => {
          setBadgeModalUserId('');
          setBadgeModalBadgeId('');
          setBadgeModalReason('');
        }}
      />

      <MassDeleteConfirmation
        isOpen={massDeleteOpen}
        onOpenChange={setMassDeleteOpen}
        selectedCount={selectedUserIds.length}
        onConfirm={massDeleteUsers}
      />

      <SharedMoneyDialog
        isOpen={Boolean(sharedMoneyUser)}
        onOpenChange={(open) => {
          if (!open) setSharedMoneyUser(null);
        }}
        sharedMoneyUser={sharedMoneyUser}
        onClose={() => setSharedMoneyUser(null)}
      />

      <InventoryDialog
        isOpen={inventoryDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeInventory();
          } else {
            setInventoryDialogOpen(true);
          }
        }}
        inventoryUser={inventoryUser}
        items={items}
        inventoryAddItemId={inventoryAddItemId}
        setInventoryAddItemId={setInventoryAddItemId}
        inventoryAddQuantity={inventoryAddQuantity}
        setInventoryAddQuantity={setInventoryAddQuantity}
        addingInventoryItem={addingInventoryItem}
        onAddInventoryItem={addInventoryItem}
        loadingInventory={loadingInventory}
        inventoryItems={inventoryItems}
        inventoryQuantities={inventoryQuantities}
        setInventoryQuantities={setInventoryQuantities}
        updatingInventoryItem={updatingInventoryItem}
        onUpdateInventoryQuantity={updateInventoryQuantity}
        removingInventoryItem={removingInventoryItem}
        onRemoveInventoryItem={removeInventoryItem}
        onClose={closeInventory}
      />

      <ItemDialog
        isOpen={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        editingItem={editingItem}
        itemForm={itemForm}
        setItemForm={setItemForm}
        shopCategories={shopCategories}
        badges={badges}
        savingItem={savingItem}
        onSaveItem={saveItem}
        uploadItemImageFile={uploadItemImageFile}
      />

        <ReferralsTab
          referralStats={referralStats}
          loadingReferralStats={loadingReferralStats}
          fetchReferralStats={fetchReferralStats}
        />

        {/* ===== ACTIVITY TAB ===== */}
        <ActivityTab
          loadingPlatformStats={loadingPlatformStats}
          downloadStatsCSV={downloadStatsCSV}
          platformStats={platformStats}
          fetchPlatformStats={fetchPlatformStats}
          formatBigNumber={formatBigNumber}
          moneyDistribution={moneyDistribution}
          auraDistribution={auraDistribution}
          wealthUsers={wealthUsers}
          formatPercent={formatPercent}
          platformTopGamesChartHeight={platformTopGamesChartHeight}
          platformTopGamesChartData={platformTopGamesChartData}
          activityBreakdownColors={ACTIVITY_BREAKDOWN_COLORS}
          loadingGamesLeaderboard={loadingGamesLeaderboard}
          gamesLeaderboard={gamesLeaderboard}
          onlineStats={onlineStats}
          loadingActivity={loadingActivity}
          activityPeriod={activityPeriod}
          setActivityPeriod={setActivityPeriod}
          fetchActivity={fetchActivity}
          snapshotting={snapshotting}
          setSnapshotting={setSnapshotting}
          adminApi={adminApi}
          activityCustomStart={activityCustomStart}
          setActivityCustomStart={setActivityCustomStart}
          activityCustomEnd={activityCustomEnd}
          setActivityCustomEnd={setActivityCustomEnd}
          activitySpecificDay={activitySpecificDay}
          setActivitySpecificDay={setActivitySpecificDay}
          activityHistory={activityHistory}
          selectedActivity={selectedActivity}
          hoveredActivity={hoveredActivity}
          activityChartDataRef={activityChartDataRef}
          activityFullDomainRef={activityFullDomainRef}
          activityZoomDomain={activityZoomDomain}
          setActivityDomain={setActivityDomain}
          panActivityDomain={panActivityDomain}
          zoomActivityDomain={zoomActivityDomain}
          activityChartRef={activityChartRef}
          handleActivityPointerDown={handleActivityPointerDown}
          handleActivityPointerMove={handleActivityPointerMove}
          handleActivityPointerEnd={handleActivityPointerEnd}
          handleActivityPointerLeave={handleActivityPointerLeave}
          activityBreakdownDay={activityBreakdownDay}
          setActivityBreakdownDay={setActivityBreakdownDay}
          fetchActivityBreakdown={fetchActivityBreakdown}
          loadingActivityBreakdown={loadingActivityBreakdown}
          activityBreakdown={activityBreakdown}
          pageBreakdownKeys={pageBreakdownKeys}
          pageBreakdownData={pageBreakdownData}
          gameTypeLabels={GAME_TYPE_LABELS}
          gameBreakdownKeys={gameBreakdownKeys}
          gameBreakdownData={gameBreakdownData}
          gameDurationBreakdownKeys={gameDurationBreakdownKeys}
          gameDurationBreakdownData={gameDurationBreakdownData}
          formatDurationShort={formatDurationShort}
          playtimePeriod={playtimePeriod}
          setPlaytimePeriod={setPlaytimePeriod}
          fetchPlaytimeLeaderboard={fetchPlaytimeLeaderboard}
          playtimeCustomStart={playtimeCustomStart}
          setPlaytimeCustomStart={setPlaytimeCustomStart}
          playtimeCustomEnd={playtimeCustomEnd}
          setPlaytimeCustomEnd={setPlaytimeCustomEnd}
          loadingPlaytimeLeaderboard={loadingPlaytimeLeaderboard}
          playtimeLeaderboard={playtimeLeaderboard}
        />
        <DemographicsTab
          totalDemographicUsers={totalDemographicUsers}
          levelDistributionData={levelDistributionData}
          classDistributionData={classDistributionData}
          classAveragesData={classAveragesData}
          topUsersByLevel={topUsersByLevel}
          usersByClass={usersByClass}
          activityBreakdownColors={ACTIVITY_BREAKDOWN_COLORS}
          formatPercent={formatPercent}
          formatBigNumber={formatBigNumber}
        />

        <BadgesTab
          handleCheckAutoBadges={handleCheckAutoBadges}
          openCreateBadge={openCreateBadge}
          badges={badges}
          badgesLoading={badgesLoading}
          openEditBadge={openEditBadge}
          handleDeleteBadge={handleDeleteBadge}
          awardBadgeUserId={awardBadgeUserId}
          setAwardBadgeUserId={setAwardBadgeUserId}
          awardBadgeId={awardBadgeId}
          setAwardBadgeId={setAwardBadgeId}
          awardBadgeReason={awardBadgeReason}
          setAwardBadgeReason={setAwardBadgeReason}
          handleAwardBadge={handleAwardBadge}
          badgeFormOpen={badgeFormOpen}
          setBadgeFormOpen={setBadgeFormOpen}
          editingBadge={editingBadge}
          badgeForm={badgeForm}
          setBadgeForm={setBadgeForm}
          uploadItemImageFile={uploadItemImageFile}
          handleSaveBadge={handleSaveBadge}
        />
        <ChatHistoryTab
          fetchChatHistoryDays={fetchChatHistoryDays}
          loadingChatHistoryDays={loadingChatHistoryDays}
          loadingMoreChatHistoryDays={loadingMoreChatHistoryDays}
          exportChat={exportChat}
          exportingChat={exportingChat}
          showDeletedChatMessages={showDeletedChatMessages}
          setShowDeletedChatMessages={setShowDeletedChatMessages}
          chatHistoryDays={chatHistoryDays}
          chatHistoryDay={chatHistoryDay}
          fetchChatHistoryDay={fetchChatHistoryDay}
          chatHistoryCursor={chatHistoryCursor}
          chatHistoryMessages={chatHistoryMessages}
          loadingChatHistoryMessages={loadingChatHistoryMessages}
          exportingChatDay={exportingChatDay}
          softDeletingChatMessageId={softDeletingChatMessageId}
          softDeleteChatMessage={softDeleteChatMessage}
        />

        <CommunicationTab
          surveys={surveys}
          surveysLoading={surveysLoading}
          fetchSurveys={fetchSurveys}
          surveyDialogOpen={surveyDialogOpen}
          setSurveyDialogOpen={setSurveyDialogOpen}
          surveyTitle={surveyTitle}
          setSurveyTitle={setSurveyTitle}
          surveyDescription={surveyDescription}
          setSurveyDescription={setSurveyDescription}
          surveyAudienceType={surveyAudienceType}
          setSurveyAudienceType={setSurveyAudienceType}
          surveyPopupDelaySeconds={surveyPopupDelaySeconds}
          setSurveyPopupDelaySeconds={setSurveyPopupDelaySeconds}
          surveyOptions={surveyOptions}
          setSurveyOptions={setSurveyOptions}
          surveyTargetSearch={surveyTargetSearch}
          setSurveyTargetSearch={setSurveyTargetSearch}
          surveySelectedUserIds={surveySelectedUserIds}
          setSurveySelectedUserIds={setSurveySelectedUserIds}
          surveyImageUrl={surveyImageUrl}
          setSurveyImageUrl={setSurveyImageUrl}
          surveyUploadingImage={surveyUploadingImage}
          surveyImageInputRef={surveyImageInputRef}
          handleSurveyImageUpload={handleSurveyImageUpload}
          surveyOptionUploadingIndex={surveyOptionUploadingIndex}
          surveyOptionImageInputRef={surveyOptionImageInputRef}
          triggerSurveyOptionImageUpload={triggerSurveyOptionImageUpload}
          handleSurveyOptionImageUpload={handleSurveyOptionImageUpload}
          creatingSurvey={creatingSurvey}
          createSurvey={createSurvey}
          resetSurveyForm={resetSurveyForm}
          archiveSurvey={archiveSurvey}
          archivingSurveyId={archivingSurveyId}
          newThreadOpen={newThreadOpen}
          setNewThreadOpen={setNewThreadOpen}
          setNewThreadUserId={setNewThreadUserId}
          setNewThreadBody={setNewThreadBody}
          setNewThreadSearch={setNewThreadSearch}
          newThreadSearch={newThreadSearch}
          users={users}
          newThreadUserId={newThreadUserId}
          newThreadBody={newThreadBody}
          newThreadSending={newThreadSending}
          handleStartThread={handleStartThread}
          supportReportsLoading={supportReportsLoading}
          supportReports={supportReports}
          fetchSupportReports={fetchSupportReports}
          reviewingSupportReportId={reviewingSupportReportId}
          handleReviewSupportReport={handleReviewSupportReport}
          fetchSupportThreads={fetchSupportThreads}
          supportThreadsLoading={supportThreadsLoading}
          supportThreads={supportThreads}
          openSupportThread={openSupportThread}
          activeThreadUserId={activeThreadUserId}
          activeThreadUser={activeThreadUser}
          activeThreadMessages={activeThreadMessages}
          supportMessagesEndRef={supportMessagesEndRef}
          supportReplyImages={supportReplyImages}
          removeSupportReplyImage={removeSupportReplyImage}
          supportUploadingImage={supportUploadingImage}
          supportSending={supportSending}
          supportImageInputRef={supportImageInputRef}
          handleSupportImageUpload={handleSupportImageUpload}
          supportReply={supportReply}
          setSupportReply={setSupportReply}
          handleSupportReply={handleSupportReply}
        />

        </Tabs>
      </div>
    </PageShell>

    </>
  );
}






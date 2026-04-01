import { useEffect, useState, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { adminApi, leaderboardsApi, AdminUser, ShopItem, ShopCategory, BugReport, PendingUser, AdminInventoryItem, Ban, ActivityLog, LogStats, AdminUpdatePopup, BanAppeal, NameChangeRequest, AdminClan, RegistrationReview, AdminWarning, badgesApi, Badge, AdminActivityBreakdown, OnlineHistoryInsights, supportApi, SupportThread, SupportMessage, customBadgesApi, CustomBadgeRequest } from '../services/api';
import { useSocketBase } from '@/contexts/SocketContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { prepareImageUploadPayload } from '@/lib/image-upload';
import { Loader2, Trash2, Save, AlertTriangle, Plus, Minus, Package, Edit2, X, Bug, Check, UserPlus, UserX, Ban as BanIcon, ShieldOff, ScrollText, Search, ChevronLeft, ChevronRight, ChevronDown, LogIn, MessageCircle, Gamepad2, Coins, Users, Store, Shield, Gavel, Lightbulb, TrendingUp, Download, Sparkles, Eye, Activity, Trophy, CalendarRange, RefreshCw, Inbox, Archive, UserCog, Crown, Swords, Send, Upload, Award, Terminal } from 'lucide-react';
import { BadgeIcon } from '@/components/badges/BadgeIcon';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, ReferenceDot, LineChart, Line, Tooltip as RechartsTooltip, Legend, BarChart, Bar, Cell } from 'recharts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, humanizeUiLabel } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { ImagePicker } from '@/components/ui/image-picker';
import { BLOCKABLE_PAGES } from '@/config/blockedPages';
import { PageShell } from '@/components/layout/page-shell';
import { getPageMetaForPath } from '@/lib/page-meta';
import {
  DEFAULT_LANDING_PAGE,
  DEFAULT_LANDING_PAGE_KEY,
  DEFAULT_LANDING_PAGE_OPTIONS,
  normalizeDefaultLandingPage,
} from '@/lib/default-landing-page';

// Effect types for items
const EFFECT_TYPES = [
  { value: 'USERNAME_COLOR', label: 'Couleur de pseudo', description: 'Permet de choisir une couleur pour le pseudo dans le chat' },
  { value: 'PROFILE_PICTURE', label: 'Photo de profil', description: 'Permet de téléverser une photo affichée dans le chat' },
  { value: 'PROFILE_BANNER', label: 'Bannière de profil', description: 'Permet de téléverser une bannière affichée en haut du profil' },
  { value: 'BONUS_AURA', label: 'Bonus Aura', description: 'Donne un bonus d\'aura à l\'utilisation' },
  { value: 'BONUS_MONEY', label: 'Bonus Argent', description: 'Donne un bonus d\'argent à l\'utilisation' },
  { value: 'DOODLE_JUMP_SKIN', label: 'Apparence Doodle Jump', description: 'Débloque une apparence personnalisée dans Doodle Jump (sélectionner une image pour l’apparence)' },
  { value: 'CLAN_TAG_UNLOCK', label: 'Tag de clan', description: 'Débloque le tag de clan pour le clan du membre acheteur. Un clan ne peut l\'acheter qu\'une fois.' },
  { value: 'CLAN_SLOT_UPGRADE', label: '+1 Slot clan', description: 'Ajoute un slot membre supplémentaire au clan. Un clan ne peut l\'acheter qu\'une fois. S\'applique automatiquement à l\'achat.' },
  { value: 'CLAN_GAME_MONEY_BOOST', label: 'Boost gains clan', description: 'Objet de clan: active un boost en % sur l\'argent gagné en jeu pour tous les membres du clan.' },
  { value: 'AWARD_BADGE', label: 'Badge', description: 'Donne un badge spécifique au joueur lors de l\'utilisation. L\'image boutique est générée automatiquement.' },
  { value: 'CUSTOM_BADGE', label: 'Badge personnalisé', description: 'Permet au joueur de concevoir son propre badge. La demande est envoyée aux admins pour validation. Remboursement automatique si refusée.' },
];

const EFFECT_TYPES_WITHOUT_VALUE = new Set([
  'USERNAME_COLOR',
  'PROFILE_PICTURE',
  'PROFILE_BANNER',
  'CLAN_TAG_UNLOCK',
  'CLAN_SLOT_UPGRADE',
  'AWARD_BADGE',
  'CUSTOM_BADGE',
]);

const generateBadgeSvgDataUrl = (badge: Badge): string => {
  let fill = badge.backgroundColor ?? '#374151';
  let gradientDef = '';
  if (badge.backgroundType === 'gradient' && badge.backgroundGradient) {
    try {
      const g = JSON.parse(badge.backgroundGradient) as { from: string; to: string; direction?: string };
      const isVert = (g.direction ?? 'to right').includes('bottom');
      gradientDef = `<defs><linearGradient id="g" x1="0" y1="0" x2="${isVert ? '0' : '1'}" y2="${isVert ? '1' : '0'}"><stop offset="0%" stop-color="${g.from}"/><stop offset="100%" stop-color="${g.to}"/></linearGradient></defs>`;
      fill = 'url(#g)';
    } catch { /* use solid */ }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56">${gradientDef}<rect width="56" height="56" rx="4" fill="${fill}" stroke="${badge.borderColor ?? '#6b7280'}" stroke-width="1.5"/><text x="28" y="39" text-anchor="middle" font-size="26" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">${badge.icon ?? '⭐'}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  CONSUMABLE: 'Objet',
  COSMETIC: 'Cosmétique',
  UPGRADE: 'Amélioration',
};

const ANNOUNCEMENT_MAX_LENGTH = 120;
const YOU_LOGO_ADMIN_ONLY_SETTING_KEY = 'you_logo_admin_only';
const ADMIN_ARCHIVED_REGISTRATIONS_STORAGE_KEY = 'admin_archived_registrations';
const ROLE_LABELS = {
  USER: 'membre',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super admin',
} as const;

type AdminRole = keyof typeof ROLE_LABELS;
type AdminTab = 'inbox' | 'users' | 'clubs' | 'logs' | 'bans' | 'content' | 'settings' | 'activity' | 'badges' | 'support' | 'communication';
const ADMIN_TABS: AdminTab[] = ['inbox', 'users', 'clubs', 'logs', 'bans', 'content', 'settings', 'activity', 'badges', 'support', 'communication'];

type ArchivedRegistration = PendingUser & {
  registrationStatus: 'APPROVED' | 'REJECTED';
  reviewedAt?: string;
  importedFromLegacy?: boolean;
};

const parseLegacyArchivedRegistrations = (): ArchivedRegistration[] => {
  try {
    const raw = localStorage.getItem(ADMIN_ARCHIVED_REGISTRATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is ArchivedRegistration => (
      entry &&
      typeof entry === 'object' &&
      typeof entry.id === 'string' &&
      typeof entry.username === 'string' &&
      typeof entry.email === 'string' &&
      typeof entry.createdAt === 'string' &&
      (entry.registrationStatus === 'APPROVED' || entry.registrationStatus === 'REJECTED')
    ));
  } catch {
    return [];
  }
};

const mapRegistrationReviewToArchivedRegistration = (review: RegistrationReview): ArchivedRegistration => ({
  id: review.registrationUserId,
  username: review.username,
  firstName: review.firstName,
  schoolLevel: review.schoolLevel,
  classLetter: review.classLetter,
  email: review.email,
  motivationMessage: review.motivationMessage,
  createdAt: review.registrationCreatedAt,
  registrationStatus: review.status,
  reviewedAt: review.reviewedAt,
  importedFromLegacy: review.importedFromLegacy,
});

const getAdminRole = (user: Pick<AdminUser, 'isAdmin' | 'isSuperAdmin'>): AdminRole => {
  if (user.isSuperAdmin) return 'SUPER_ADMIN';
  if (user.isAdmin) return 'ADMIN';
  return 'USER';
};

// Log type configuration with icons, colors and labels
const LOG_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  AUTH: { label: 'Connexion', color: 'text-blue-400', bgColor: 'bg-blue-500', borderColor: 'border-blue-500', icon: LogIn },
  CHAT: { label: 'Chat', color: 'text-green-400', bgColor: 'bg-green-500', borderColor: 'border-green-500', icon: MessageCircle },
  GAME: { label: 'Jeux', color: 'text-purple-400', bgColor: 'bg-purple-500', borderColor: 'border-purple-500', icon: Gamepad2 },
  ECONOMY: { label: 'Economie', color: 'text-yellow-400', bgColor: 'bg-yellow-500', borderColor: 'border-yellow-500', icon: Coins },
  PARTY: { label: 'Groupe', color: 'text-pink-400', bgColor: 'bg-pink-500', borderColor: 'border-pink-500', icon: Users },
  MARKETPLACE: { label: 'Boutique', color: 'text-orange-400', bgColor: 'bg-orange-500', borderColor: 'border-orange-500', icon: Store },
  ADMIN: { label: 'Admin', color: 'text-red-400', bgColor: 'bg-red-500', borderColor: 'border-red-500', icon: Shield },
  BAN: { label: 'Bans', color: 'text-red-300', bgColor: 'bg-red-700', borderColor: 'border-red-700', icon: Gavel },
  SUGGESTION: { label: 'Suggestions', color: 'text-cyan-400', bgColor: 'bg-cyan-500', borderColor: 'border-cyan-500', icon: Lightbulb },
  AURACOIN: { label: 'AuraCoin', color: 'text-amber-400', bgColor: 'bg-amber-500', borderColor: 'border-amber-500', icon: TrendingUp },
};

// Human-readable action labels
const ACTION_LABELS: Record<string, string> = {
  // Auth
  login: 'Connexion',
  logout: 'Déconnexion',
  register: 'Inscription',
  login_failed: 'Connexion échouée',
  login_banned: 'Connexion bannie',
  // Chat
  message_sent: 'Message envoyé',
  message_deleted: 'Message supprimé',
  // Game
  game_complete: 'Partie terminée',
  game_reward: 'Récompense obtenue',
  casino_bet: 'Pari casino',
  highscore: 'Nouveau record',
  // Economy
  transfer: 'Transfert',
  balance_change: 'Modification solde',
  pass_reward: 'Récompense pass',
  // Party
  party_create: 'Groupe créé',
  party_join: 'Rejoint groupe',
  party_leave: 'Quitté groupe',
  party_disband: 'Groupe dissous',
  party_kick: 'Expulsion',
  party_invite: 'Invitation envoyée',
  // Suggestion
  suggestion_create: 'Suggestion créée',
  suggestion_vote: 'Vote',
  suggestion_comment: 'Commentaire',
  suggestion_delete: 'Suggestion supprimée',
  bug_report: 'Bug signalé',
  // Marketplace
  item_purchase: 'Achat',
  item_use: 'Utilisation objet',
  item_create: 'Objet créé',
  item_delete: 'Objet supprimé',
  // Admin
  user_update: 'Utilisateur modifié',
  user_delete: 'Utilisateur supprimé',
  user_approve: 'Utilisateur approuvé',
  user_reject: 'Utilisateur refusé',
  inventory_add: 'Inventaire ajouté',
  inventory_update: 'Inventaire modifié',
  inventory_remove: 'Inventaire retiré',
  chat_clear: 'Chat vidé',
  stats_delete: 'Stats supprimées',

  update_popup_create: 'Popup changelog créée',
  update_popup_update: 'Popup changelog modifiée',
  update_popup_delete: 'Popup changelog supprimée',
  clan_update: 'Clan modifié',
  clan_transfer_leadership: 'Chef de clan modifié',
  clan_delete: 'Clan supprimé',
  // Ban
  ban_create: 'Bannissement créé',
  ban_remove: 'Bannissement levé',
  // AuraCoin
  auracoin_buy: 'Achat AuraCoin',
  auracoin_sell: 'Vente AuraCoin',
};

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
};

const GAME_TYPE_LABELS: Record<string, string> = {
  doodle_jump: 'Doodle Jump',
  doodle_jump_mort_subite: 'Doodle Jump (Mort Subite)',
  game_2048: '2048',
  game_2048_tile: '2048 (Tuile max)',
  flappy_bird: 'Flappy Bird',
  chrome_dino: 'Chrome Dino',
  crossy_road: 'Crossy Road',
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
  uno: 'Uno',
  morpion: 'Morpion',
  russian_roulette: 'Roulette russe',
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

const renderMetadataValue = (key: string, value: unknown): React.ReactNode => {
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
    if (n !== null) return `${(n / 1000).toFixed(3)}s`;
  }
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
};

const renderLogSummary = (log: ActivityLog): React.ReactNode => {
  const actor = log.username || 'inconnu';
  const metadata = log.metadata || {};
  const { gameLabel, gameType } = getGameDisplayInfo(log);

  if (log.type === 'GAME') {
    if (log.action === 'game_complete') {
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

// Game type filters
const GAME_TYPES = [
  { value: 'doodle_jump', label: 'Doodle Jump' },
  { value: 'doodle_jump_mort_subite', label: 'Doodle Jump (Mort Subite)' },
  { value: 'game_2048', label: '2048' },
  { value: 'flappy_bird', label: 'Flappy Bird' },
  { value: 'chrome_dino', label: 'Chrome Dino' },
  { value: 'crossy_road', label: 'Crossy Road' },
  { value: 'stack_tower', label: 'Tour empilée' },
  { value: 'geometry_dash', label: 'Geometry Dash' },
  { value: 'qs_watermelon', label: 'QS Watermelon' },
  { value: 'solitaire', label: 'Solitaire' },
  { value: 'racer', label: 'Racer' },
  { value: 'racer_daily', label: 'Racer Quotidien' },
  { value: 'tetris', label: 'Tetris' },
  { value: 'knife_hit', label: 'Knife Hit' },
  { value: 'minesweeper', label: 'Démineur' },
  { value: 'goyave_empire', label: 'Goyave Empire' },
  { value: 'logic_lab', label: 'Sudoku' },
  { value: 'fruit_ninja', label: 'Fruit Ninja' },
  { value: 'casino', label: 'Casino' },
  { value: 'bombparty', label: 'Bombe de mots' },
  { value: 'petit_bac', label: 'Petit Bac' },
  { value: 'poker', label: 'Poker' },
  { value: 'battleship', label: 'Bataille Navale' },
  { value: 'chess', label: 'Échecs' },
  { value: 'puissance_4', label: 'Puissance 4' },
  { value: 'ball_arena', label: 'Arène des balles' },
  { value: 'uno', label: 'Uno' },
  { value: 'morpion', label: 'Morpion' },
  { value: 'russian_roulette', label: 'Roulette russe' },
  { value: 'clash_village', label: 'Clash Village' },
  { value: 'nuit_blanche', label: 'Nuit Blanche' },
];

interface ItemFormData {
  name: string;
  description: string;
  type: string;
  price: number;
  imageUrl: string;
  effectType: string;
  effectValue: string;
  bonusAura?: number;
  bonusMoney?: number;
  skinImageUrl?: string;
  skinShopType?: 'none' | 'static' | 'rotating';
  badgeId?: string;
}

const defaultItemForm: ItemFormData = {
  name: '',
  description: '',
  type: 'COSMETIC',
  price: 0,
  imageUrl: '',
  effectType: 'USERNAME_COLOR',
  effectValue: '',
  bonusAura: 0,
  bonusMoney: 0,
  skinImageUrl: '',
  skinShopType: 'none',
  badgeId: '',
};

interface UpdatePopupFormData {
  type: 'UPDATE' | 'CLAN_PROMPT';
  title: string;
  summary: string;
  message: string;
  imageUrl: string;
  audience: 'ALL' | 'NO_CLAN' | 'SELECTED_USERS';
  targetUserIds: string[];
  releaseDate: string;
  publishMode: 'draft' | 'now' | 'scheduled';
  isPublished: boolean;
}

const toDateTimeLocalValue = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getUpdatePopupPublishMode = (popup: Pick<AdminUpdatePopup, 'isPublished' | 'releaseDate'>): UpdatePopupFormData['publishMode'] => {
  if (!popup.isPublished) {
    return 'draft';
  }
  return new Date(popup.releaseDate).getTime() > Date.now() ? 'scheduled' : 'now';
};

const defaultUpdatePopupForm: UpdatePopupFormData = {
  type: 'UPDATE',
  title: '',
  summary: '',
  message: '',
  imageUrl: '',
  audience: 'ALL',
  targetUserIds: [],
  releaseDate: toDateTimeLocalValue(new Date()),
  publishMode: 'now',
  isPublished: true,
};

export default function Admin() {
  const { user } = useAuth();
  const location = useLocation();
  const { socket } = useSocketBase();
  const { refreshFeatures } = useFeatures();
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
  const [saving, setSaving] = useState(false);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [mutingUser, setMutingUser] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalUser, setEditModalUser] = useState<AdminUser | null>(null);
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);
  const [badgeModalUserId, setBadgeModalUserId] = useState('');
  const [badgeModalBadgeId, setBadgeModalBadgeId] = useState('');
  const [badgeModalReason, setBadgeModalReason] = useState('');
  const [massDeleteOpen, setMassDeleteOpen] = useState(false);
  const [massBanTargetIds, setMassBanTargetIds] = useState<string[]>([]);
  const [clearingChat, setClearingChat] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('inbox');
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [loginCommOpen, setLoginCommOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  // ── Badge tab state ────────────────────────────────────────────────────────
  const [badges, setBadges] = useState<Badge[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [customBadgeRequests, setCustomBadgeRequests] = useState<CustomBadgeRequest[]>([]);
  const [customBadgeRequestsLoading, setCustomBadgeRequestsLoading] = useState(false);
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
  const [supportSending, setSupportSending] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);
  const supportMessagesEndRef = useRef<HTMLDivElement>(null);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [newThreadUserId, setNewThreadUserId] = useState('');
  const [newThreadBody, setNewThreadBody] = useState('');
  const [newThreadSending, setNewThreadSending] = useState(false);
  const [newThreadSearch, setNewThreadSearch] = useState('');

  const fetchSupportThreads = async () => {
    setSupportThreadsLoading(true);
    try {
      const res = await supportApi.getThreads();
      setSupportThreads(res.data.threads);
      setSupportUnread(res.data.threads.reduce((sum, t) => sum + t.unreadCount, 0));
    } catch { /* non-critical */ }
    finally { setSupportThreadsLoading(false); }
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
      setSupportUnread((prev) => {
        const thread = supportThreads.find((t) => t.userId === userId);
        return Math.max(0, prev - (thread?.unreadCount ?? 0));
      });
    } catch { /* non-critical */ }
  };

  const handleSupportReply = async () => {
    if (!activeThreadUserId || !supportReply.trim() || supportSending) return;
    setSupportSending(true);
    try {
      const res = await supportApi.reply(activeThreadUserId, supportReply.trim());
      setActiveThreadMessages((prev) => prev.some((m) => m.id === res.data.message.id) ? prev : [...prev, res.data.message]);
      setSupportReply('');
    } catch { /* non-critical */ }
    finally { setSupportSending(false); }
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
  const [gamesLeaderboard, setGamesLeaderboard] = useState<any[]>([]);
  const [loadingGamesLeaderboard, setLoadingGamesLeaderboard] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [hoveredActivity, setHoveredActivity] = useState<ActivityHoverState | null>(null);
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
  const [clanForm, setClanForm] = useState<{ name: string; description: string; imageUrl: string; maxMembers: number; isPublic: boolean }>({
    name: '',
    description: '',
    imageUrl: '',
    maxMembers: 5,
    isPublic: true,
  });
  const [savingClan, setSavingClan] = useState(false);
  const [deletingClan, setDeletingClan] = useState<string | null>(null);
  const [transferringClanLeader, setTransferringClanLeader] = useState<string | null>(null);

  // Items state
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormData>(defaultItemForm);
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);

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
  const [inboxFilter, setInboxFilter] = useState<'all' | 'registrations' | 'bugs' | 'appeals' | 'namechanges' | 'archived'>('all');

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
  const [warningMessage, setWarningMessage] = useState('');
  const [warningSeverity, setWarningSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [creatingWarning, setCreatingWarning] = useState(false);
  const [deletingWarning, setDeletingWarning] = useState<string | null>(null);

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
  const [maintenanceEndDate, setMaintenanceEndDate] = useState<string>('');
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [blockedPages, setBlockedPages] = useState<string[]>([]);
  const [blockedMessage, setBlockedMessage] = useState('');
  const [savingBlocks, setSavingBlocks] = useState(false);
  const [fonctionnalitesOpen, setFonctionnalitesOpen] = useState(false);
  const [fakeOnlineEnabled, setFakeOnlineEnabled] = useState(true);
  const [savingFakeOnline, setSavingFakeOnline] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [duelMatchmakingEnabled, setDuelMatchmakingEnabled] = useState(true);
  const [savingDuelMatchmakingEnabled, setSavingDuelMatchmakingEnabled] = useState(false);
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [savingReferralEnabled, setSavingReferralEnabled] = useState(false);
  const [referralRewardAmount, setReferralRewardAmount] = useState('250');
  const [savingReferralReward, setSavingReferralReward] = useState(false);
  const [dailyAuraDistributionLimit, setDailyAuraDistributionLimit] = useState('100');
  const [savingDailyAuraDistributionLimit, setSavingDailyAuraDistributionLimit] = useState(false);
  const [auraCoinBuyFeePercentage, setAuraCoinBuyFeePercentage] = useState('0.02');
  const [savingAuraCoinBuyFee, setSavingAuraCoinBuyFee] = useState(false);
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
  const [updatePopups, setUpdatePopups] = useState<AdminUpdatePopup[]>([]);
  const [loadingUpdatePopups, setLoadingUpdatePopups] = useState(false);
  const [savingUpdatePopup, setSavingUpdatePopup] = useState(false);
  const [deletingUpdatePopup, setDeletingUpdatePopup] = useState<string | null>(null);
  const [updatingUpdatePopupId, setUpdatingUpdatePopupId] = useState<string | null>(null);
  const [suggestingUpdateSummary, setSuggestingUpdateSummary] = useState(false);
  const [editingUpdatePopupId, setEditingUpdatePopupId] = useState<string | null>(null);
  const [updatePopupForm, setUpdatePopupForm] = useState<UpdatePopupFormData>(defaultUpdatePopupForm);


  const fetchUpdatePopups = async () => {
    try {
      setLoadingUpdatePopups(true);
      const res = await adminApi.getUpdatePopups();
      setUpdatePopups(res.data.popups);
    } catch {
      showMessage('error', 'Erreur lors du chargement du changelog');
    } finally {
      setLoadingUpdatePopups(false);
    }
  };

  const resetUpdatePopupForm = () => {
    setEditingUpdatePopupId(null);
    setUpdatePopupForm({
      ...defaultUpdatePopupForm,
      releaseDate: toDateTimeLocalValue(new Date()),
    });
  };

  const handleSuggestUpdateSummary = async () => {
    try {
      setSuggestingUpdateSummary(true);
      const res = await adminApi.suggestUpdatePopupSummary();
      setUpdatePopupForm((prev) => ({
        ...prev,
        message: res.data.suggestion || prev.message,
      }));
      showMessage('success', 'Suggestion chargée');
    } catch {
      showMessage('error', 'Erreur lors de la suggestion');
    } finally {
      setSuggestingUpdateSummary(false);
    }
  };

  const uploadUpdatePopupImageFile = async (file: File): Promise<string> => {
    try {
      const { base64Data, mimeType } = await prepareImageUploadPayload(file);
      const res = await adminApi.uploadUpdatePopupImage({ base64Data, mimeType });
      showMessage('success', 'Image téléchargée');
      return res.data.imageUrl;
    } catch {
      showMessage('error', 'Erreur lors du téléchargement de l\'image');
      throw new Error();
    }
  };

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

  const handleSaveUpdatePopup = async () => {
    const title = updatePopupForm.title.trim();
    const message = updatePopupForm.message.trim();
    const summary = updatePopupForm.summary.trim();
    const imageUrl = updatePopupForm.imageUrl.trim();

    if (!title || !message) {
      showMessage('error', 'Titre et message requis');
      return;
    }

    if (updatePopupForm.audience === 'SELECTED_USERS' && updatePopupForm.targetUserIds.length === 0) {
      showMessage('error', 'Sélectionne au moins un utilisateur');
      return;
    }

    let releaseDateIso = new Date().toISOString();
    if (updatePopupForm.publishMode === 'scheduled') {
      const parsedReleaseDate = new Date(updatePopupForm.releaseDate);
      if (Number.isNaN(parsedReleaseDate.getTime())) {
        showMessage('error', 'Date de programmation invalide');
        return;
      }
      releaseDateIso = parsedReleaseDate.toISOString();
    }

    const isPublished = updatePopupForm.publishMode !== 'draft';

    try {
      setSavingUpdatePopup(true);
      const payload = {
        type: updatePopupForm.type,
        title,
        message,
        summary: summary || undefined,
        imageUrl: imageUrl || undefined,
        audience: updatePopupForm.audience,
        targetUserIds: updatePopupForm.targetUserIds,
        releaseDate: releaseDateIso,
        isPublished,
      };

      if (editingUpdatePopupId) {
        await adminApi.updateUpdatePopup(editingUpdatePopupId, payload);
        showMessage('success', 'Annonce modifiée');
      } else {
        await adminApi.createUpdatePopup(payload);
        showMessage('success', 'Annonce créée');
      }

      resetUpdatePopupForm();
      fetchUpdatePopups();
    } catch {
      showMessage('error', 'Erreur lors de la sauvegarde');
    } finally {
      setSavingUpdatePopup(false);
    }
  };

  const handleDeleteUpdatePopup = async (id: string) => {
    try {
      setDeletingUpdatePopup(id);
      await adminApi.deleteUpdatePopup(id);
      if (editingUpdatePopupId === id) {
        resetUpdatePopupForm();
      }
      showMessage('success', 'Annonce supprimée');
      fetchUpdatePopups();
    } catch {
      showMessage('error', 'Erreur lors de la suppression');
    } finally {
      setDeletingUpdatePopup(null);
    }
  };

  const handleToggleUpdatePopupPublished = async (popup: AdminUpdatePopup, isPublished: boolean) => {
    try {
      setUpdatingUpdatePopupId(popup.id);
      await adminApi.updateUpdatePopup(popup.id, { isPublished });
      showMessage('success', isPublished ? 'Annonce publiée' : 'Annonce masquée');
      fetchUpdatePopups();
    } catch {
      showMessage('error', 'Erreur lors de la mise à jour');
    } finally {
      setUpdatingUpdatePopupId(null);
    }
  };

  const handleEditUpdatePopup = (popup: AdminUpdatePopup) => {
    setEditingUpdatePopupId(popup.id);
    setUpdatePopupForm({
      type: popup.type,
      title: popup.title,
      summary: popup.summary || '',
      message: popup.message,
      imageUrl: popup.imageUrl || '',
      audience: popup.audience,
      targetUserIds: popup.targetUserIds || [],
      releaseDate: toDateTimeLocalValue(popup.releaseDate),
      publishMode: getUpdatePopupPublishMode(popup),
      isPublished: popup.isPublished,
    });
    setActiveTab('communication');
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

  // Redirect non-admin users
  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    fetchUsers();
    fetchClans();
    fetchItems();
    fetchDjForcedSkin();
    fetchShopCategories();
    fetchBugReports();
    fetchPendingUsers();
    fetchRegistrationReviews();
    fetchBans();
    fetchWarnings();
    fetchBanAppeals();
    fetchNameChangeRequests();
    fetchBadges();
    fetchCustomBadgeRequests();
    fetchLogs();
    fetchLogStats();
    fetchSettings();
    fetchUpdatePopups();
    fetchActivity('day');
    fetchActivityBreakdown(new Date().toISOString().slice(0, 10));
    fetchPlatformStats();
    fetchGamesLeaderboard();
    fetchSupportThreads();
  }, []);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab && ADMIN_TABS.includes(tab as AdminTab)) {
      setActiveTab(tab as AdminTab);
    }
  }, [location.search]);

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
      if (!msg.fromAdmin) {
        setSupportUnread((c) => (activeThreadUserId !== msg.userId ? c + 1 : c));
      }
      if (activeThreadUserId === msg.userId) {
        setActiveThreadMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };
    socket.on('support:message', handleSupportMessage);
    return () => { socket.off('support:message', handleSupportMessage); };
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
    if (currentEnd - currentStart >= fullEnd - fullStart) return;
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
      setHoveredActivity(resolveActivityHoverState(e.clientX));
      return;
    }
    const metrics = getActivityPlotMetrics();
    if (!metrics) return;
    const [fullStart, fullEnd] = activityFullDomainRef.current;
    const fullRange = fullEnd - fullStart;
    const [domainStart, domainEnd] = panState.domain;
    const domainRange = domainEnd - domainStart;
    if (domainRange >= fullRange) return;
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
    setHoveredActivity(resolveActivityHoverState(e.clientX));
  };

  const handleActivityPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = activityChartRef.current;
    if (el && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
    activityPanRef.current = null;
    window.setTimeout(() => {
      activityDidPanRef.current = false;
    }, 0);
  };

  const handleActivityPointerLeave = () => {
    if (!activityPanRef.current) {
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

  const createWarning = async () => {
    if (!warningUserId || !warningMessage.trim()) {
      showMessage('error', 'Utilisateur et message requis');
      return;
    }
    try {
      setCreatingWarning(true);
      const res = await adminApi.createWarning({
        userId: warningUserId,
        message: warningMessage.trim(),
        severity: warningSeverity,
      });
      setWarnings((prev) => [res.data.warning, ...prev]);
      setWarningDialogOpen(false);
      setWarningUserId('');
      setWarningMessage('');
      setWarningSeverity('MEDIUM');
      showMessage('success', res.data.message || 'Avertissement envoyé');
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
        type: logFilter.type !== 'ALL' ? logFilter.type : undefined,
        gameType: logFilter.gameType !== 'ALL' ? logFilter.gameType : undefined,
        username: logFilter.username || undefined,
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
      setDuelMatchmakingEnabled(res.data.settings.duel_matchmaking_enabled !== 'false');
      setReferralEnabled(res.data.settings.referral_enabled !== 'false');
      setReferralRewardAmount(res.data.settings.referral_reward_amount || '250');
      setDailyAuraDistributionLimit(res.data.settings.daily_aura_distribution_limit || '100');
      setAuraCoinBuyFeePercentage(res.data.settings.auracoin_buy_fee_percentage || '0.02');
      setClashAttackCooldownMinutes(res.data.settings.clash_attack_cooldown_minutes || '10');
      setMaintenanceMessage(res.data.settings.maintenance_message || '');
      setBlockedMessage(res.data.settings.blocked_message || '');
      setLoginMessage(res.data.settings.login_message || '');
      setLoginRegisterCtaEnabled(res.data.settings.login_register_cta_enabled !== 'false');
      setDefaultLandingPage(normalizeDefaultLandingPage(res.data.settings[DEFAULT_LANDING_PAGE_KEY]));
      setYouLogoAdminOnly(res.data.settings[YOU_LOGO_ADMIN_ONLY_SETTING_KEY] === 'true');

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

  const saveMaintenance = async () => {
    try {
      setSavingMaintenance(true);
      const settings: Record<string, string> = {
        maintenance_enabled: maintenanceEnabled ? 'true' : 'false',
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
        return prev.filter(key => key !== pageKey);
      }
      return [...prev, pageKey];
    });
  };

  const saveBlockedPages = async (): Promise<boolean> => {
    try {
      setSavingBlocks(true);
      const uniquePages = Array.from(new Set(blockedPages)).sort();
      await adminApi.updateSettings({
        blocked_pages: JSON.stringify(uniquePages),
        blocked_message: blockedMessage.trim(),
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

  const openBanDialog = (userId: string) => {
    setBanUserId(userId);
    setBanReason('');
    setBanType('TEMPORARY');
    setBanDuration(24);
    setBanDialogOpen(true);
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

  // Parse effect string to get type and value
  const parseEffect = (effectStr: string | null): { type: string; value: string; bonusAura?: number; bonusMoney?: number; skinImageUrl?: string; skinShopType?: 'none' | 'static' | 'rotating'; badgeId?: string } => {
    if (!effectStr) return { type: 'USERNAME_COLOR', value: '' };
    try {
      const effect = JSON.parse(effectStr);
      // Determine effect type from the effect object
      let effectType = effect.type || 'USERNAME_COLOR';
      if (effect.bonusAura !== undefined) effectType = 'BONUS_AURA';
      if (effect.bonusMoney !== undefined) effectType = 'BONUS_MONEY';

      return {
        type: effectType,
        value: String(effect.percentage ?? effect.value ?? ''),
        bonusAura: effect.bonusAura,
        bonusMoney: effect.bonusMoney,
        skinImageUrl: effect.skinImageUrl || '',
        skinShopType: (effect.shopType as 'none' | 'static' | 'rotating') || 'none',
        badgeId: effect.badgeId || '',
      };
    } catch {
      return { type: 'USERNAME_COLOR', value: '' };
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
    const { type: effectType, value: effectValue, bonusAura, bonusMoney, skinImageUrl, skinShopType, badgeId } = parseEffect(item.effect);
    setItemForm({
      name: item.name,
      description: item.description,
      type: item.type,
      price: item.price,
      imageUrl: item.imageUrl || '',
      effectType,
      effectValue,
      bonusAura: bonusAura || 0,
      bonusMoney: bonusMoney || 0,
      skinImageUrl: skinImageUrl || '',
      skinShopType: skinShopType || 'none',
      badgeId: badgeId || '',
    });
    if (badges.length === 0) fetchBadges();
    setItemDialogOpen(true);
  };

  // Save item (create or update)
  const saveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.description.trim()) {
      showMessage('error', 'Nom et description requis');
      return;
    }

    setSavingItem(true);
    try {
      // Build effect JSON based on effect type
      let effect: string | undefined;
      if (itemForm.effectType === 'BONUS_AURA') {
        effect = JSON.stringify({ bonusAura: itemForm.bonusAura || 0 });
      } else if (itemForm.effectType === 'BONUS_MONEY') {
        effect = JSON.stringify({ bonusMoney: itemForm.bonusMoney || 0 });
      } else if (itemForm.effectType === 'DOODLE_JUMP_SKIN') {
        const shopType = itemForm.skinShopType && itemForm.skinShopType !== 'none' ? itemForm.skinShopType : undefined;
        effect = JSON.stringify({ type: 'DOODLE_JUMP_SKIN', skinImageUrl: itemForm.skinImageUrl || '', ...(shopType ? { shopType } : {}) });
      } else if (itemForm.effectType === 'AWARD_BADGE') {
        effect = JSON.stringify({ type: 'AWARD_BADGE', badgeId: itemForm.badgeId || '' });
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
        const selectedBadge = badges.find(b => b.id === itemForm.badgeId);
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
        setItems(prev => prev.map(i => i.id === editingItem.id ? res.data.item : i));
        showMessage('success', 'Objet modifié');
      } else {
        const res = await adminApi.createItem(data);
        setItems(prev => [res.data.item, ...prev]);
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
      aura: u.aura,
      money: u.money,
      auraCoinBalance: u.auraCoinBalance,
      dailyAuraLimit: u.dailyAuraLimit,
    });
    setEditPassword('');
    setEditModalOpen(true);
  };

  const cancelEditing = () => {
    setEditingUser(null);
    setEditModalUser(null);
    setEditModalOpen(false);
    setEditPassword('');
  };

  const saveUser = async (id: string) => {
    setSaving(true);
    try {
      const payload = { ...editValues } as Parameters<typeof adminApi.updateUser>[1];
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      const res = await adminApi.updateUser(id, payload);
      setUsers(prev => prev.map(u => u.id === id ? res.data.user : u));
      setEditingUser(null);
      setEditModalUser(null);
      setEditModalOpen(false);
      setEditPassword('');
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
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setClearingChat(false);
    }
  };

  const openInventory = (u: AdminUser) => {
    setInventoryUser(u);
    setInventoryDialogOpen(true);
    setInventoryAddQuantity(1);
    setInventoryAddItemId(items[0]?.id || '');
    fetchUserInventory(u.id);
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
          <TabsList className="flex flex-wrap h-auto p-1">
          <TabsTrigger value="inbox">
            Boîte de réception
            {(pendingUsers.length + bugReports.filter(b => b.status === 'PENDING').length + banAppeals.filter(a => a.status === 'PENDING').length + nameChangeRequests.filter(n => n.status === 'PENDING').length) > 0 && (
              <span className="inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-semibold leading-none">
                {pendingUsers.length + bugReports.filter(b => b.status === 'PENDING').length + banAppeals.filter(a => a.status === 'PENDING').length + nameChangeRequests.filter(n => n.status === 'PENDING').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="users">
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="clubs">
            Clubs
          </TabsTrigger>
          <TabsTrigger value="logs">
            Logs
            {logStats && (
              <span className={TYPOGRAPHY.XS}>
                {logStats.total.toLocaleString()}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="bans">
            Sanctions
            {bans.filter(b => b.isActive).length > 0 && (
              <span className={TYPOGRAPHY.XS}>
                {bans.filter(b => b.isActive).length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="content">
            Objets
          </TabsTrigger>
          <TabsTrigger value="settings">
            Paramètres
          </TabsTrigger>
          <TabsTrigger value="activity" onClick={() => { fetchActivity(activityPeriod); fetchActivityBreakdown(activityBreakdownDay); fetchPlaytimeLeaderboard(playtimePeriod); fetchPlatformStats(); fetchGamesLeaderboard(); }}>
            Statistiques
            {onlineStats && (
              <span className={TYPOGRAPHY.XS}>{onlineStats.current} en ligne</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="badges" onClick={() => { fetchBadges(); fetchCustomBadgeRequests(); }}>
            Badges
            {customBadgeRequests.length > 0 && (
              <span className="ml-1 bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">{customBadgeRequests.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="support" onClick={fetchSupportThreads}>
            Support
            {supportUnread > 0 && (
              <span className="inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-semibold leading-none">
                {supportUnread}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className={SPACING.SECTION_SPACING}>
          {(() => {
            // Build typed item lists
            const registrationItems = pendingUsers.map(u => ({
              id: `reg-${u.id}`, type: 'registration' as const, date: new Date(u.createdAt), data: u,
            }));
            const allBugItems = bugReports.map(b => ({
              id: `bug-${b.id}`, type: 'bug' as const, date: new Date(b.createdAt), data: b,
            }));
            const allAppealItems = banAppeals.map(a => ({
              id: `appeal-${a.id}`, type: 'appeal' as const, date: new Date(a.createdAt), data: a,
            }));
            const allNameChangeItems = nameChangeRequests.map(n => ({
              id: `nc-${n.id}`, type: 'namechange' as const, date: new Date(n.createdAt), data: n,
            }));

            const pendingBugItems = allBugItems.filter(i => (i.data as BugReport).status === 'PENDING');
            const pendingAppealItems = allAppealItems.filter(i => (i.data as BanAppeal).status === 'PENDING');
            const pendingNameChangeItems = allNameChangeItems.filter(i => (i.data as NameChangeRequest).status === 'PENDING');

            const archivedRegistrationItems = archivedRegistrations.map(u => ({
              id: `reg-${u.id}`, type: 'registration' as const, date: new Date(u.createdAt), data: u,
            }));

            const archivedItems = [
              ...archivedRegistrationItems,
              ...allBugItems.filter(i => (i.data as BugReport).status === 'DONE'),
              ...allAppealItems.filter(i => (i.data as BanAppeal).status !== 'PENDING'),
              ...allNameChangeItems.filter(i => (i.data as NameChangeRequest).status !== 'PENDING'),
            ].sort((a, b) => b.date.getTime() - a.date.getTime());

            const allPending = pendingUsers.length + pendingBugItems.length + pendingAppealItems.length + pendingNameChangeItems.length;

            const activeItems = inboxFilter === 'registrations' ? registrationItems
              : inboxFilter === 'bugs' ? pendingBugItems
              : inboxFilter === 'appeals' ? pendingAppealItems
              : inboxFilter === 'namechanges' ? pendingNameChangeItems
              : inboxFilter === 'archived' ? archivedItems
              : [...registrationItems, ...pendingBugItems, ...pendingAppealItems, ...pendingNameChangeItems]
                  .sort((a, b) => b.date.getTime() - a.date.getTime());

            // Find selected item across all items
            const allItemsPool = [...registrationItems, ...archivedRegistrationItems, ...allBugItems, ...allAppealItems, ...allNameChangeItems];
            const selectedItem = selectedInboxItem ? allItemsPool.find(i => i.id === selectedInboxItem) ?? null : null;

            const ADMIN_CATS = [
              { key: 'all' as const,         label: 'Tout',           Icon: Inbox,    count: allPending },
              { key: 'registrations' as const, label: 'Inscriptions', Icon: UserPlus, count: pendingUsers.length },
              { key: 'bugs' as const,          label: 'Bugs',         Icon: Bug,      count: pendingBugItems.length },
              { key: 'appeals' as const,       label: 'Appels de ban', Icon: Gavel,   count: pendingAppealItems.length },
              { key: 'namechanges' as const,   label: 'Pseudos',      Icon: UserCog,  count: pendingNameChangeItems.length },
              { key: 'archived' as const,      label: 'Archivé',      Icon: Archive,  count: archivedItems.length },
            ];

            return (
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border/30 pb-3 shrink-0">
                  <div className="flex items-center justify-between gap-4">
                    <CardDescription>Boîte de réception</CardDescription>
                    {legacyArchivedRegistrationsCount > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={importArchivedRegistrations}
                        disabled={importingArchivedRegistrations}
                        className="h-8 gap-1.5"
                      >
                        {importingArchivedRegistrations ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Importer {legacyArchivedRegistrationsCount} archive{legacyArchivedRegistrationsCount > 1 ? 's' : ''} locale{legacyArchivedRegistrationsCount > 1 ? 's' : ''}
                      </Button>
                    )}
                    <div className={cn("flex items-center gap-2", TYPOGRAPHY.SMALL)}>
                      <Inbox className="h-4 w-4" />
                      <span>{allPending} en attente</span>
                    </div>
                  </div>
                </CardHeader>

                <div className="flex" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
                  {/* Left sidebar */}
                  <div className="w-44 shrink-0 border-r border-border/40 p-1.5 space-y-0.5 overflow-y-auto custom-scroll">
                    {ADMIN_CATS.map((cat) => (
                      <button
                        key={cat.key}
                        onClick={() => { setInboxFilter(cat.key); setSelectedInboxItem(null); }}
                        className={cn(
                          'w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors text-left',
                          inboxFilter === cat.key
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                        )}
                      >
                        <cat.Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1 truncate">{cat.label}</span>
                        {cat.count > 0 && (
                          <span className="text-[10px] font-semibold bg-primary/15 text-primary rounded px-1 shrink-0">
                            {cat.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Center: item list */}
                  <div className="w-72 shrink-0 border-r border-border/40 overflow-y-auto custom-scroll">
                    {(loadingPending || loadingBugs || loadingAppeals || loadingNameChanges) ? (
                      <div className="flex justify-center py-12">
                        <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
                      </div>
                    ) : activeItems.length === 0 ? (
                      <div className="text-center py-12 space-y-2">
                        {inboxFilter === 'archived'
                          ? <Archive className="h-8 w-8 mx-auto text-muted-foreground/50" />
                          : <Inbox className="h-8 w-8 mx-auto text-muted-foreground/50" />}
                        <p className={TYPOGRAPHY.MUTED}>
                          {inboxFilter === 'archived' ? 'Aucun élément archivé' : 'Boîte de réception vide'}
                        </p>
                      </div>
                    ) : (
                      <div>
                        {activeItems.map((item) => {
                          const isSelected = selectedInboxItem === item.id;

                          let title = '';
                          let subtitle = '';
                          let badgeLabel = '';
                          let badgeColor = '';
                          let borderAccent = '';

                          if (item.type === 'registration') {
                            const u = item.data as PendingUser & { registrationStatus?: 'APPROVED' | 'REJECTED' };
                            title = u.username;
                            subtitle = u.email;
                            badgeLabel = u.registrationStatus === 'APPROVED' ? 'Approuvé' : u.registrationStatus === 'REJECTED' ? 'Rejeté' : 'Inscription';
                            badgeColor = u.registrationStatus === 'APPROVED' ? 'bg-green-500/20 text-green-400' : u.registrationStatus === 'REJECTED' ? 'bg-zinc-500/20 text-zinc-400' : 'bg-blue-500/20 text-blue-400';
                            borderAccent = u.registrationStatus === 'APPROVED' ? 'border-l-green-500' : u.registrationStatus === 'REJECTED' ? 'border-l-zinc-500' : 'border-l-blue-500';
                          } else if (item.type === 'bug') {
                            const b = item.data as BugReport;
                            title = b.title;
                            subtitle = b.user.username;
                            const done = b.status === 'DONE';
                            badgeLabel = done ? 'Résolu' : 'Bug';
                            badgeColor = done ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400';
                            borderAccent = done ? 'border-l-green-500' : 'border-l-amber-500';
                          } else if (item.type === 'appeal') {
                            const a = item.data as BanAppeal;
                            title = a.user.username;
                            subtitle = a.ban.reason;
                            badgeLabel = a.status === 'PENDING' ? 'Appel' : a.status === 'APPROVED' ? 'Accepté' : 'Rejeté';
                            badgeColor = a.status === 'PENDING' ? 'bg-red-500/20 text-red-400' : a.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400';
                            borderAccent = 'border-l-red-500';
                          } else {
                            const n = item.data as NameChangeRequest;
                            title = n.requestedUsername;
                            subtitle = `de ${n.currentUsername}`;
                            badgeLabel = n.status === 'PENDING' ? 'Pseudo' : n.status === 'APPROVED' ? 'Accepté' : 'Rejeté';
                            badgeColor = n.status === 'PENDING' ? 'bg-purple-500/20 text-purple-400' : n.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400';
                            borderAccent = 'border-l-purple-500';
                          }

                          return (
                            <button
                              key={item.id}
                              onClick={() => setSelectedInboxItem(isSelected ? null : item.id)}
                              className={cn(
                                'w-full text-left border-l-2 border-b border-b-border/20 transition-colors',
                                borderAccent,
                                isSelected ? 'bg-accent/70' : 'hover:bg-accent/30'
                              )}
                            >
                              <div className="px-3 py-3">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0', badgeColor)}>
                                    {badgeLabel}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                    {item.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                  </span>
                                </div>
                                <p className="text-sm font-medium truncate leading-tight">{title}</p>
                                <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{subtitle}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right: detail panel */}
                  <div className="flex-1 min-w-0 overflow-y-auto custom-scroll">
                    {!selectedItem ? (
                      <div className="flex flex-col items-center justify-center h-full space-y-2 text-center px-8">
                        <Inbox className="h-10 w-10 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground/50">Sélectionne un élément</p>
                      </div>
                    ) : selectedItem.type === 'registration' ? (
                      (() => {
                        const u = selectedItem.data as PendingUser & { registrationStatus?: 'APPROVED' | 'REJECTED' };
                        return (
                          <div className="p-6 space-y-5">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                {u.registrationStatus === 'APPROVED' ? (
                                  <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">Approuvé</span>
                                ) : u.registrationStatus === 'REJECTED' ? (
                                  <span className="text-xs px-2 py-0.5 rounded bg-zinc-500/20 text-zinc-400">Rejeté</span>
                                ) : (
                                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">Inscription</span>
                                )}
                                <span className="text-xs text-muted-foreground/60">
                                  {selectedItem.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <h3 className="text-lg font-semibold">{u.username}</h3>
                              <p className="text-sm text-muted-foreground">{u.email}</p>
                              {u.firstName && <p className="text-sm text-muted-foreground">Prénom : {u.firstName}</p>}
                              {(u.schoolLevel || u.classLetter) && (
                                <p className="text-sm text-muted-foreground">
                                  Classe : {[u.schoolLevel === 'SECONDE' ? 'Seconde' : u.schoolLevel === 'PREMIERE' ? 'Première' : u.schoolLevel === 'TERMINALE' ? 'Terminale' : null, u.classLetter].filter(Boolean).join(' ')}
                                </p>
                              )}
                            </div>
                            <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                              <p className="text-xs font-medium text-muted-foreground/70 mb-2">Message de motivation</p>
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {u.motivationMessage?.trim() || 'Non renseigné'}
                              </p>
                            </div>
                            {!u.registrationStatus && (
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => approveUser(u.id)} disabled={approvingUser === u.id} className="h-8 border-green-500/50 text-green-500 hover:bg-green-500/10">
                                  {approvingUser === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Approuver</>}
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" disabled={rejectingUser === u.id} className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10">
                                      {rejectingUser === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserX className="h-4 w-4 mr-1" />Rejeter</>}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-destructive" />
                                        Rejeter la demande de {u.username} ?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        L'utilisateur devra créer un nouveau compte s'il souhaite réessayer.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => rejectUser(u.id)} className="bg-destructive hover:bg-destructive/90">Rejeter</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : selectedItem.type === 'bug' ? (
                      (() => {
                        const bug = selectedItem.data as BugReport;
                        const isArchived = bug.status === 'DONE';
                        const replyValue = bugReply[bug.id] ?? '';
                        return (
                          <div className="p-6 space-y-5">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={cn('text-xs px-2 py-0.5 rounded', isArchived ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400')}>
                                  {isArchived ? 'Résolu' : 'Bug'}
                                </span>
                                <span className="text-xs text-muted-foreground/60">
                                  {selectedItem.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <h3 className={cn('text-lg font-semibold', isArchived && 'opacity-60')}>{bug.title}</h3>
                              <p className="text-sm text-muted-foreground">Par {bug.user.username}</p>
                            </div>
                            <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                              <p className="text-sm whitespace-pre-wrap break-words">{bug.description}</p>
                            </div>
                            {bug.adminReply && (
                              <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4">
                                <p className="text-xs font-medium text-indigo-400/70 mb-2">Réponse envoyée</p>
                                <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground">{bug.adminReply}</p>
                              </div>
                            )}
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground/70">
                                {bug.adminReply ? 'Modifier la réponse' : 'Répondre au signalement'}
                              </p>
                              <textarea
                                className="w-full rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-muted-foreground/40"
                                rows={3}
                                placeholder="Écrivez votre réponse… Elle sera envoyée par notification et par e-mail."
                                value={replyValue}
                                onChange={e => setBugReply(prev => ({ ...prev, [bug.id]: e.target.value }))}
                                disabled={updatingBug === bug.id}
                              />
                              <div className="flex items-center gap-2">
                                {replyValue.trim() && (
                                  <Button size="sm" variant="outline" onClick={() => sendBugReply(bug)} disabled={updatingBug === bug.id}
                                    className="h-8 border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10">
                                    {updatingBug === bug.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" />Envoyer</>}
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => toggleBugStatus(bug)} disabled={updatingBug === bug.id}
                                  className={cn('h-8', isArchived ? 'border-amber-500/50 text-amber-500 hover:bg-amber-500/10' : 'border-green-500/50 text-green-500 hover:bg-green-500/10')}>
                                  {updatingBug === bug.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isArchived ? <><X className="h-4 w-4 mr-1" />Rouvrir</> : <><Check className="h-4 w-4 mr-1" />Résolu</>}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : selectedItem.type === 'appeal' ? (
                      (() => {
                        const appeal = selectedItem.data as BanAppeal;
                        const isPending = appeal.status === 'PENDING';
                        return (
                          <div className="p-6 space-y-5">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={cn('text-xs px-2 py-0.5 rounded',
                                  appeal.status === 'PENDING' ? 'bg-red-500/20 text-red-400' :
                                  appeal.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                                  'bg-zinc-500/20 text-zinc-400')}>
                                  {appeal.status === 'PENDING' ? 'Appel en attente' : appeal.status === 'APPROVED' ? 'Accepté' : 'Rejeté'}
                                </span>
                                <span className="text-xs text-muted-foreground/60">
                                  {selectedItem.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <h3 className="text-lg font-semibold">{appeal.user.username}</h3>
                              <p className="text-sm text-muted-foreground">{appeal.user.email}</p>
                            </div>
                            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                              <p className="text-xs font-medium text-muted-foreground/70 mb-1.5">Motif du bannissement</p>
                              <p className="text-sm font-medium">{appeal.ban.reason}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {appeal.ban.type === 'PERMANENT' ? 'Permanent' : appeal.ban.expiresAt ? `Expire le ${new Date(appeal.ban.expiresAt).toLocaleDateString('fr-FR')}` : 'Temporaire'}
                              </p>
                            </div>
                            <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                              <p className="text-xs font-medium text-muted-foreground/70 mb-2">Message de l'utilisateur</p>
                              <p className="text-sm whitespace-pre-wrap break-words">{appeal.message}</p>
                            </div>
                            {isPending && (
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => reviewBanAppeal(appeal.id, 'approve')} disabled={reviewingAppeal === appeal.id} className="h-8 border-green-500/50 text-green-500 hover:bg-green-500/10">
                                  {reviewingAppeal === appeal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Lever le ban</>}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => reviewBanAppeal(appeal.id, 'reject')} disabled={reviewingAppeal === appeal.id} className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10">
                                  {reviewingAppeal === appeal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" />Rejeter</>}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      (() => {
                        const req = selectedItem.data as NameChangeRequest;
                        const isPending = req.status === 'PENDING';
                        return (
                          <div className="p-6 space-y-5">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={cn('text-xs px-2 py-0.5 rounded',
                                  req.status === 'PENDING' ? 'bg-purple-500/20 text-purple-400' :
                                  req.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                                  'bg-zinc-500/20 text-zinc-400')}>
                                  {req.status === 'PENDING' ? 'Changement de pseudo' : req.status === 'APPROVED' ? 'Accepté' : 'Rejeté'}
                                </span>
                                <span className="text-xs text-muted-foreground/60">
                                  {selectedItem.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <h3 className="text-lg font-semibold">{req.user.username}</h3>
                              <p className="text-sm text-muted-foreground">{req.user.email}</p>
                            </div>
                            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                              <p className="text-xs font-medium text-muted-foreground/70 mb-3">Changement demandé</p>
                              <div className="flex items-center gap-4">
                                <div>
                                  <p className="text-[11px] text-muted-foreground/60 mb-0.5">Actuel</p>
                                  <p className="text-sm font-medium">{req.currentUsername}</p>
                                </div>
                                <span className="text-muted-foreground/50 text-lg">→</span>
                                <div>
                                  <p className="text-[11px] text-muted-foreground/60 mb-0.5">Demandé</p>
                                  <p className="text-sm font-semibold text-purple-400">{req.requestedUsername}</p>
                                </div>
                              </div>
                            </div>
                            {req.reason && (
                              <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                                <p className="text-xs font-medium text-muted-foreground/70 mb-2">Raison</p>
                                <p className="text-sm whitespace-pre-wrap break-words">{req.reason}</p>
                              </div>
                            )}
                            {isPending && (
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => reviewNameChangeRequest(req.id, 'approve')} disabled={reviewingNameChange === req.id} className="h-8 border-green-500/50 text-green-500 hover:bg-green-500/10">
                                  {reviewingNameChange === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Approuver</>}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => reviewNameChangeRequest(req.id, 'reject')} disabled={reviewingNameChange === req.id} className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10">
                                  {reviewingNameChange === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" />Rejeter</>}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              </Card>
            );
          })()}
        </TabsContent>

        <TabsContent value="users" className={SPACING.SECTION_SPACING}>
          <Card>
            <CardHeader>
              {/* Search Bar */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par pseudo ou prénom..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="pl-9 bg-transparent border-border/50 h-9"
                  />
                </div>
                {selectedUserIds.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setSelectedUserIds([])} className="h-9 border-border/50 shrink-0">
                    <X className="h-4 w-4 mr-1" />
                    Annuler ({selectedUserIds.length})
                  </Button>
                )}
              </div>

              {/* Bulk action bar */}
              {selectedUserIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-border/30">
                  <span className="text-xs text-muted-foreground">{selectedUserIds.length} sélectionné(s) :</span>
                  <Button size="sm" onClick={() => openBadgeModal('')} className="h-7 bg-violet-600 hover:bg-violet-700 text-white text-xs gap-1.5">
                    <Award className="h-3.5 w-3.5" />
                    Badge
                  </Button>
                  <Button size="sm" onClick={massMuteUsers} className="h-7 bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5">
                    <ShieldOff className="h-3.5 w-3.5" />
                    Mute
                  </Button>
                  <Button size="sm" onClick={openMassBanDialog} className="h-7 bg-orange-600 hover:bg-orange-700 text-white text-xs gap-1.5">
                    <BanIcon className="h-3.5 w-3.5" />
                    Bannir
                  </Button>
                  <Button size="sm" onClick={() => setMassDeleteOpen(true)} className="h-7 bg-destructive hover:bg-destructive/90 text-white text-xs gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
                </div>
              ) : (() => {
                const filteredUsers = userSearchQuery.trim()
                  ? users.filter(u =>
                      u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      (u.firstName || '').toLowerCase().includes(userSearchQuery.toLowerCase())
                    )
                  : users;

                const selectableUsers = filteredUsers.filter(u => !u.isSuperAdmin && u.id !== user?.id);
                const allSelected = selectableUsers.length > 0 && selectableUsers.every(u => selectedUserIds.includes(u.id));

                return filteredUsers.length === 0 ? (
                  <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>
                    {userSearchQuery.trim() ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur'}
                  </p>
                ) : (
                  <div className="divide-y divide-border/30">
                    {/* Select-all header row */}
                    <div className="flex items-center gap-3 py-2">
                      <Checkbox
                        checked={allSelected ? true : selectedUserIds.length > 0 ? 'indeterminate' : false}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedUserIds(selectableUsers.map(u => u.id));
                          else setSelectedUserIds([]);
                        }}
                      />
                      <span className="text-xs text-muted-foreground">Tout sélectionner ({selectableUsers.length})</span>
                    </div>

                    {filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        className={cn(
                          "py-3",
                          u.isSuperAdmin ? "bg-amber-500/10" : u.isAdmin ? "bg-muted/20" : undefined
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {/* Checkbox */}
                          <div className="w-4 shrink-0">
                            {!u.isSuperAdmin && u.id !== user?.id && (
                              <Checkbox
                                checked={selectedUserIds.includes(u.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) setSelectedUserIds(prev => [...prev, u.id]);
                                  else setSelectedUserIds(prev => prev.filter(id => id !== u.id));
                                }}
                              />
                            )}
                          </div>

                          {/* User info — compact single-line */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className="font-medium text-sm">{u.username}</span>
                              {u.firstName && (
                                <span className="text-xs text-muted-foreground/70">({u.firstName})</span>
                              )}
                              <span className="text-muted-foreground/30 text-xs select-none">·</span>
                              <span className="text-xs text-muted-foreground/60 truncate">{u.email}</span>
                              {u.isSuperAdmin ? (
                                <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium shrink-0">
                                  <Crown className="h-2.5 w-2.5" />super admin
                                </span>
                              ) : u.isAdmin ? (
                                <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 shrink-0">
                                  <Shield className="h-2.5 w-2.5" />admin
                                </span>
                              ) : null}
                              {u.isChatMuted && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 shrink-0">muet</span>
                              )}
                              {u.schoolLevel && (
                                <span className={cn(
                                  "text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0",
                                  u.schoolLevel === 'SECONDE' && "bg-sky-500/15 text-sky-400",
                                  u.schoolLevel === 'PREMIERE' && "bg-violet-500/15 text-violet-400",
                                  u.schoolLevel === 'TERMINALE' && "bg-rose-500/15 text-rose-400",
                                )}>
                                  {u.schoolLevel === 'SECONDE' ? '2nde' : u.schoolLevel === 'PREMIERE' ? '1ère' : 'Tle'}
                                  {u.classLetter ? ` ${u.classLetter}` : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="hidden xl:flex items-center gap-1.5 shrink-0">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/15 text-purple-400 text-xs tabular-nums font-medium">
                              <TrendingUp className="h-3 w-3" />
                              {u.aura.toLocaleString()}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/15 text-green-400 text-xs tabular-nums font-medium">
                              <Coins className="h-3 w-3" />
                              {u.money.toLocaleString()}
                            </span>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Edit */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(u)}
                              className="h-8 w-8 p-0 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                              title="Modifier"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>

                            {/* Inventory */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openInventory(u)}
                              className="h-8 w-8 p-0 border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                              title="Inventaire"
                            >
                              <Package className="h-3.5 w-3.5" />
                            </Button>

                            {/* Badge */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openBadgeModal(u.id)}
                              className="h-8 w-8 p-0 border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
                              title="Attribuer badge"
                            >
                              <Award className="h-3.5 w-3.5" />
                            </Button>

                            {/* Mute */}
                            {getAdminRole(u) === 'USER' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleChatMute(u)}
                                disabled={mutingUser === u.id}
                                title={u.isChatMuted ? 'Démuter' : 'Muter'}
                                className={cn(
                                  "h-8 w-8 p-0",
                                  u.isChatMuted
                                    ? "border-amber-500/50 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                                    : "border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                )}
                              >
                                {mutingUser === u.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <ShieldOff className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}

                            {/* Ban */}
                            {getAdminRole(u) === 'USER' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openBanDialog(u.id)}
                                className="h-8 w-8 p-0 border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                                title="Bannir"
                              >
                                <BanIcon className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Delete */}
                            {getAdminRole(u) === 'USER' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 border-destructive/50 text-destructive hover:bg-destructive/10"
                                    disabled={deleting === u.id}
                                    title="Supprimer"
                                  >
                                    {deleting === u.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                      <AlertTriangle className="h-5 w-5 text-destructive" />
                                      Supprimer {u.username} ?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Cette action est irréversible. Toutes les données de l'utilisateur seront définitivement supprimées (messages, transferts, statistiques, inventaire, etc.).
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteUser(u.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clubs" className={SPACING.SECTION_SPACING}>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardDescription>Gestion des clans</CardDescription>
                    <p className="text-sm text-muted-foreground">{filteredClans.length} clan(s) affiché(s)</p>
                  </div>
                  <div className="relative w-full lg:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={clanSearchQuery}
                      onChange={(e) => setClanSearchQuery(e.target.value)}
                      placeholder="Rechercher un clan, chef ou membre"
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingClans ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </div>
                ) : filteredClans.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    Aucun clan trouvé.
                  </div>
                ) : (
                  filteredClans.map((clan) => (
                    <div key={clan.id} className="rounded-xl border border-border/50 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-medium">{clan.name}</h3>
                            <span className={cn(
                              'rounded-full px-2 py-0.5 text-xs',
                              clan.isPublic ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                            )}>
                              {clan.isPublic ? 'Public' : 'Privé'}
                            </span>
                            {clan.activeWar && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-400">
                                <Swords className="h-3 w-3" />
                                {clan.activeWar.status === 'ACTIVE' ? 'En guerre' : 'Préparation'}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {clan.description || 'Aucune description.'}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Chef: {clan.owner.username}</span>
                            <span>Membres: {clan.members.length}/{clan.maxMembers}</span>
                            <span>Créé le {new Date(clan.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEditingClan(clan)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Gérer
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-destructive/50 text-destructive hover:bg-destructive/10"
                                disabled={deletingClan === clan.id}
                              >
                                {deletingClan === clan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer {clan.name} ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action supprime le clan, ses membres et ses guerres liées.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteClan(clan.id)} className="bg-destructive hover:bg-destructive/90">
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>{editingClanId ? 'Édition du clan' : 'Sélectionne un clan à gérer'}</CardDescription>
              </CardHeader>
              <CardContent>
                {!editingClanId ? (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    Choisis un clan dans la liste pour modifier ses paramètres ou changer son chef.
                  </div>
                ) : (
                  (() => {
                    const clan = clans.find((entry) => entry.id === editingClanId);
                    if (!clan) {
                      return <div className="text-sm text-muted-foreground">Clan introuvable.</div>;
                    }

                    return (
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground">Nom</label>
                          <Input value={clanForm.name} onChange={(e) => setClanForm((prev) => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground">Description</label>
                          <Textarea
                            value={clanForm.description}
                            onChange={(e) => setClanForm((prev) => ({ ...prev, description: e.target.value }))}
                            rows={4}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground">Image</label>
                          <ImagePicker
                            value={clanForm.imageUrl}
                            onChange={(url) => setClanForm((prev) => ({ ...prev, imageUrl: url }))}
                            uploadFn={uploadItemImageFile}
                            hidePreview
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-xs text-muted-foreground">Capacité max</label>
                            <Input
                              type="number"
                              min={clan.members.length}
                              max={12}
                              value={clanForm.maxMembers}
                              onChange={(e) => setClanForm((prev) => ({ ...prev, maxMembers: parseInt(e.target.value) || clan.members.length }))}
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <div className="text-sm font-medium">Clan public</div>
                              <div className="text-xs text-muted-foreground">Entrée directe ou sur candidature</div>
                            </div>
                            <Switch
                              checked={clanForm.isPublic}
                              onCheckedChange={(checked) => setClanForm((prev) => ({ ...prev, isPublic: checked }))}
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button onClick={() => saveClan(clan.id)} disabled={savingClan}>
                            {savingClan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Sauvegarder
                          </Button>
                          <Button variant="outline" onClick={cancelEditingClan}>Annuler</Button>
                        </div>

                        <div className="space-y-3 border-t border-border/40 pt-5">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-amber-500" />
                            <h3 className="font-medium">Changer le chef</h3>
                          </div>
                          <div className="space-y-2">
                            {clan.members.map((member) => (
                              <div key={member.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{member.user.username}</span>
                                    {member.isLeader && <span className="text-xs text-amber-500">chef actuel</span>}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {Number(member.user.aura).toLocaleString('fr-FR')} aura • membre depuis {new Date(member.joinedAt).toLocaleDateString('fr-FR')}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant={member.isLeader ? 'secondary' : 'outline'}
                                  disabled={member.isLeader || transferringClanLeader === `${clan.id}:${member.userId}`}
                                  onClick={() => transferClanLeadership(clan.id, member.userId)}
                                >
                                  {transferringClanLeader === `${clan.id}:${member.userId}` ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Crown className="mr-2 h-4 w-4" />
                                  )}
                                  Nommer chef
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="content">
          <div className="flex gap-6 items-start">

            {/* ── Sidebar ── */}
            <div className="w-72 shrink-0 space-y-4 sticky top-4">

              {/* Categories */}
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Catégories</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingCategories ? (
                    <div className="flex justify-center py-4">
                      <div className="w-1 h-6 bg-foreground/20 animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        {shopCategories.map((cat) => (
                          <div key={cat.id} className="flex items-center justify-between rounded-md border border-border/30 px-2 py-1.5 text-sm">
                            <div className="min-w-0">
                              <span className="font-medium truncate block">{cat.label}</span>
                              <span className="font-mono text-xs text-muted-foreground">{cat.id}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeShopCategory(cat.id)}
                              disabled={savingCategories}
                              className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2 pt-1 border-t border-border/30">
                        <Input
                          value={newCategoryId}
                          onChange={(e) => setNewCategoryId(e.target.value)}
                          placeholder="Identifiant"
                          className="bg-transparent h-8 text-xs"
                        />
                        <div className="flex gap-2">
                          <Input
                            value={newCategoryLabel}
                            onChange={(e) => setNewCategoryLabel(e.target.value)}
                            placeholder="Libellé"
                            className="bg-transparent h-8 text-xs flex-1"
                            onKeyDown={(e) => e.key === 'Enter' && addShopCategory()}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={addShopCategory}
                            disabled={savingCategories || !newCategoryId.trim() || !newCategoryLabel.trim()}
                            className="h-8 w-8 p-0 shrink-0"
                          >
                            {savingCategories ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* DJ Skin rotation control */}
              {(() => {
                const djRotatingItems = items.filter(item => {
                  try {
                    const effect = JSON.parse(item.effect || '{}');
                    return effect.type === 'DOODLE_JUMP_SKIN' && effect.shopType === 'rotating';
                  } catch { return false; }
                });
                return (
                  <Card className="border-violet-500/20 bg-gradient-to-b from-violet-950/20 to-transparent">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Gamepad2 className="h-3.5 w-3.5 text-violet-400" />
                        <CardDescription className="text-violet-300">Apparence forcée du jour</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {djForcedSkinLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Chargement...
                        </div>
                      ) : djRotatingItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucun skin dans le pool. Créez des skins avec le placement <em>🔥 Pool de rotation</em>.</p>
                      ) : (
                        <>
                          <Select value={djForcedSkinSelected} onValueChange={setDjForcedSkinSelected}>
                            <SelectTrigger className="bg-transparent border-violet-500/30 text-xs h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">🎲 Rotation aléatoire</SelectItem>
                              {djRotatingItems.map(item => (
                                <SelectItem key={item.id} value={item.id}>
                                  🔥 {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {djForcedSkinId && djForcedSkinId !== '__none__' && (
                            <p className="text-xs text-violet-400">
                              Forcé : {djRotatingItems.find(i => i.id === djForcedSkinId)?.name ?? djForcedSkinId}
                            </p>
                          )}
                          <Button
                            size="sm"
                            onClick={saveDjForcedSkin}
                            disabled={djForcedSkinSaving}
                            className="w-full bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white border-0 h-8 text-xs"
                          >
                            {djForcedSkinSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Save className="h-3 w-3 mr-1.5" />}
                            Appliquer
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}
            </div>

            {/* ── Main: Items list ── */}
            <Card className="flex-1 min-w-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardDescription>Objets de la boutique</CardDescription>
                  <Button size="sm" variant="outline" onClick={openCreateItemDialog} className="h-8 w-8 p-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
              {loadingItems ? (
                <div className="flex justify-center py-12">
                  <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
                </div>
              ) : items.length === 0 ? (
                <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>Aucun objet créé</p>
              ) : (() => {
                const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
                  acc[item.type] = acc[item.type] || [];
                  acc[item.type].push(item);
                  return acc;
                }, {});
                const allTypes = [...shopCategories.map(c => c.id), ...Object.keys(grouped).filter(t => !shopCategories.find(c => c.id === t))];
                const getCategoryLabel = (typeId: string) => shopCategories.find(c => c.id === typeId)?.label || ITEM_TYPE_LABELS[typeId] || humanizeUiLabel(typeId);
                return (
                  <div className="space-y-6">
                    {allTypes.filter(t => grouped[t]?.length).map(type => (
                      <div key={type}>
                        <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">
                          {getCategoryLabel(type)}
                        </p>
                        <div className="divide-y divide-border/30">
                          {grouped[type].map((item) => {
                            const { type: effectType } = parseEffect(item.effect);
                            const effectLabel = EFFECT_TYPES.find(e => e.value === effectType)?.label || humanizeUiLabel(effectType);
                            return (
                              <div key={item.id} className="py-3 flex items-center justify-between">
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                  {item.imageUrl ? (
                                    <img src={resolveImageUrl(item.imageUrl)} alt={item.name} className="w-10 h-10 object-cover rounded shrink-0" />
                                  ) : (
                                    <div className="w-10 h-10 bg-muted/30 flex items-center justify-center rounded shrink-0">
                                      <Package className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <span className="font-medium truncate block">{item.name}</span>
                                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                                    <p className="text-xs text-muted-foreground/60">Effet: {effectLabel}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                  <span className="text-sm text-muted-foreground tabular-nums">${item.price}</span>
                                  <div className="flex items-center gap-2">
                                    <Button size="sm" variant="outline" onClick={() => openEditItemDialog(item)} className="h-8 border-border/50">
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="outline" className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10" disabled={deletingItem === item.id}>
                                          {deletingItem === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle className="flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5 text-destructive" />
                                            Supprimer {item.name} ?
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            L'objet sera supprimé de la boutique. Les utilisateurs qui le possèdent le garderont.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteItem(item.id)} className="bg-destructive hover:bg-destructive/90">
                                            Supprimer
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
          </div>{/* end flex sidebar layout */}
        </TabsContent>

        <TabsContent value="settings" className={SPACING.SECTION_SPACING}>

          {/* ── Présence ───────────────────────────────────────── */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Système de présence</p>
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Utilisateurs en ligne fictifs</div>
                  <div className="text-xs text-muted-foreground">Complète la liste des connectés avec des utilisateurs hors-ligne pour maintenir un minimum de 10 % affichés.</div>
                </div>
                <Switch checked={fakeOnlineEnabled} disabled={savingFakeOnline} onCheckedChange={saveFakeOnline} />
              </div>
            </div>
          </div>

          {/* ── Parrainage ─────────────────────────────────────── */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Parrainage</p>
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Matchmaking duel</div>
                  <div className="text-xs text-muted-foreground">Affiche le bouton côté joueur et autorise l&apos;entrée dans la file de matchmaking duel.</div>
                </div>
                <Switch checked={duelMatchmakingEnabled} disabled={savingDuelMatchmakingEnabled} onCheckedChange={saveDuelMatchmakingEnabled} />
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Système de parrainage</div>
                  <div className="text-xs text-muted-foreground">Coupe l&apos;usage des codes de parrainage sur l&apos;inscription et masque le module côté joueur.</div>
                </div>
                <Switch checked={referralEnabled} disabled={savingReferralEnabled} onCheckedChange={saveReferralEnabled} />
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Récompense par inscription</div>
                  <div className="text-xs text-muted-foreground">Montant versé au parrain et au filleul quand un compte parrainé est approuvé.</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    id="referral-reward-amount"
                    type="number"
                    min={0}
                    step={1}
                    value={referralRewardAmount}
                    disabled={!referralEnabled}
                    onChange={(event) => setReferralRewardAmount(event.target.value)}
                    className="w-24 h-8 text-sm"
                  />
                  <Button size="sm" onClick={saveReferralReward} disabled={savingReferralReward || !referralEnabled}>
                    {savingReferralReward ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Aura distribuable par jour</div>
                  <div className="text-xs text-muted-foreground">Quota global disponible pour chaque joueur à chaque reset de minuit. Valeur par défaut: 100.</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    id="daily-aura-distribution-limit"
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    value={dailyAuraDistributionLimit}
                    onChange={(event) => setDailyAuraDistributionLimit(event.target.value)}
                    className="w-24 h-8 text-sm"
                  />
                  <Button size="sm" onClick={saveDailyAuraDistributionLimit} disabled={savingDailyAuraDistributionLimit}>
                    {savingDailyAuraDistributionLimit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ── AuraCoin ───────────────────────────────────────── */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">AuraCoin</p>
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Frais d&apos;achat</div>
                  <div className="text-xs text-muted-foreground">Taux appliqué sur les achats et ventes AuraCoin (0 = 0 %, 0.5 = 50 %).</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    id="auracoin-buy-fee"
                    type="number"
                    min={0}
                    max={0.5}
                    step={0.0001}
                    value={auraCoinBuyFeePercentage}
                    onChange={(event) => setAuraCoinBuyFeePercentage(event.target.value)}
                    className="w-28 h-8 text-sm"
                  />
                  <Button size="sm" onClick={saveAuraCoinBuyFee} disabled={savingAuraCoinBuyFee}>
                    {savingAuraCoinBuyFee ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Clash Village</p>
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Temps de recharge d&apos;attaque</div>
                  <div className="text-xs text-muted-foreground">Temps d&apos;attente appliqué après un raid réussi ou raté. Mettre `0` pour désactiver ce temps de recharge.</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    id="clash-attack-cooldown"
                    type="number"
                    min={0}
                    max={1440}
                    step={1}
                    value={clashAttackCooldownMinutes}
                    onChange={(event) => setClashAttackCooldownMinutes(event.target.value)}
                    className="w-24 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">min</span>
                  <Button size="sm" onClick={saveClashAttackCooldown} disabled={savingClashAttackCooldown}>
                    {savingClashAttackCooldown ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Communication ─────────────────────────────────── */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Communication</p>
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">

              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Annonce topbar</div>
                  <div className="text-xs text-muted-foreground">
                    {announcementMessage.trim()
                      ? `"${announcementMessage.trim().slice(0, 48)}${announcementMessage.trim().length > 48 ? '…' : ''}"`
                      : 'Aucune annonce active'}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setAnnouncementOpen(true)} className="shrink-0">
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                  Configurer
                </Button>
              </div>

              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Page de connexion</div>
                  <div className="text-xs text-muted-foreground">
                    {loginMessage.trim()
                      ? `Message actif · CTA ${loginRegisterCtaEnabled ? 'activé' : 'désactivé'}`
                      : `Pas de message · CTA ${loginRegisterCtaEnabled ? 'activé' : 'désactivé'}`}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setLoginCommOpen(true)} className="shrink-0">
                  <LogIn className="h-3.5 w-3.5 mr-1.5" />
                  Configurer
                </Button>
              </div>

              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Page principale du site</div>
                  <div className="text-xs text-muted-foreground">
                    {DEFAULT_LANDING_PAGE_OPTIONS.find((option) => option.value === defaultLandingPage)?.label ?? 'Tableau de bord'}
                    {' '}ouvre quand un utilisateur connecte arrive sur `auratracker.xyz`.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select value={defaultLandingPage} onValueChange={setDefaultLandingPage}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Choisir une page" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_LANDING_PAGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={saveDefaultLandingPage} disabled={savingDefaultLandingPage}>
                    {savingDefaultLandingPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Logo sidebar → accès à Moi réservé aux admins</div>
                  <div className="text-xs text-muted-foreground">
                    Quand activé, seul un admin peut ouvrir la section Moi en cliquant sur le logo en haut à gauche.
                  </div>
                </div>
                <Switch
                  checked={youLogoAdminOnly}
                  onCheckedChange={saveYouLogoAdminOnly}
                  disabled={savingYouLogoAdminOnly}
                />
              </div>

              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Changelog et popup clan</div>
                  <div className="text-xs text-muted-foreground">
                    Gère le changelog classique et la popup qui force les utilisateurs à rejoindre un clan.
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setUpdatesOpen(true)} className="shrink-0">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Ouvrir
                </Button>
              </div>

              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Maintenance</div>
                  <div className={cn('text-xs', maintenanceEnabled ? 'text-amber-500' : 'text-muted-foreground')}>
                    {maintenanceEnabled ? 'Maintenance globale active' : 'Site accessible normalement'}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setMaintenanceOpen(true)} className="shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                  Configurer
                </Button>
              </div>

            </div>
          </div>

          {/* Annonce modal */}
          <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Annonce topbar</DialogTitle>
                <DialogDescription>Ce message s&apos;affiche pour tous les utilisateurs dans la barre du haut.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Message</label>
                  <span className={cn('text-xs', announcementMessage.length >= ANNOUNCEMENT_MAX_LENGTH ? 'text-amber-400' : 'text-muted-foreground')}>
                    {announcementMessage.length}/{ANNOUNCEMENT_MAX_LENGTH}
                  </span>
                </div>
                <Textarea
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  placeholder="Ex: Maintenance prévue ce soir à 23h."
                  className="min-h-[90px]"
                  maxLength={ANNOUNCEMENT_MAX_LENGTH}
                />
                <p className="text-xs text-muted-foreground">Laisser vide pour masquer l&apos;annonce.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAnnouncementOpen(false)}>Annuler</Button>
                <Button onClick={async () => { await saveAnnouncement(); setAnnouncementOpen(false); }} disabled={savingAnnouncement}>
                  {savingAnnouncement ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Sauvegarder
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Login modal */}
          <Dialog open={loginCommOpen} onOpenChange={setLoginCommOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Page de connexion</DialogTitle>
                <DialogDescription>Personnalisez le message et le bouton d&apos;inscription visibles sur la page de connexion.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
                  <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <div>
                      <div className="text-sm font-medium">Bouton &ldquo;Créer un compte&rdquo;</div>
                      <div className="text-xs text-muted-foreground">Affiche ou masque le gros bouton animé sur la page de connexion.</div>
                    </div>
                    <Switch checked={loginRegisterCtaEnabled} onCheckedChange={saveLoginRegisterCta} disabled={savingLoginRegisterCta} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    value={loginMessage}
                    onChange={(e) => setLoginMessage(e.target.value)}
                    placeholder="Ex: Bienvenue ! Le serveur est ouvert."
                    className="min-h-[90px]"
                  />
                  <p className="text-xs text-muted-foreground">Laisser vide pour masquer le message.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLoginCommOpen(false)}>Annuler</Button>
                <Button onClick={async () => { await saveLoginMessage(); setLoginCommOpen(false); }} disabled={savingLoginMessage}>
                  {savingLoginMessage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Sauvegarder
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Changelog modal */}
          <Dialog open={updatesOpen} onOpenChange={setUpdatesOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
                <DialogTitle>Changelog et popup clan</DialogTitle>
                <DialogDescription>Gérez le changelog classique et les popups qui redirigent vers la page des clans.</DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {/* Preview */}
                <div className="space-y-2 p-4 rounded-lg border bg-background/30">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Aperçu joueur</span>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                    <div>
                      <h4 className="text-lg font-semibold">{updatePopupForm.title || 'Titre du changelog'}</h4>
                      <p className="text-xs text-muted-foreground">
                        {updatePopupForm.type === 'CLAN_PROMPT' ? 'Popup clan' : 'Popup changelog'} ·{' '}
                        {updatePopupForm.publishMode === 'draft'
                          ? 'Brouillon non visible'
                          : updatePopupForm.publishMode === 'scheduled'
                            ? `Programmée pour le ${updatePopupForm.releaseDate ? new Date(updatePopupForm.releaseDate).toLocaleString('fr-FR') : 'date non définie'}`
                            : 'Publication immédiate'}
                      </p>
                    </div>
                    {updatePopupForm.summary && <p className="text-sm font-medium">{updatePopupForm.summary}</p>}
                    {updatePopupForm.imageUrl && (
                      <img
                        src={resolveImageUrl(updatePopupForm.imageUrl)}
                        alt="preview"
                        className="w-full max-h-56 rounded-md border object-cover"
                        onError={(event) => { (event.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="rounded-md border bg-background/60 p-3">
                      <p className="text-sm whitespace-pre-wrap">{updatePopupForm.message || 'Le contenu de la popup s\'affichera ici.'}</p>
                    </div>
                  </div>
                </div>
                {/* Form */}
                <div className="space-y-4 p-4 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between">
                    <h3 className={TYPOGRAPHY.H3}>{editingUpdatePopupId ? 'Modifier un changelog' : 'Nouveau changelog'}</h3>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleSuggestUpdateSummary} disabled={suggestingUpdateSummary}>
                        {suggestingUpdateSummary ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                        Auto-résumé
                      </Button>
                      {editingUpdatePopupId && (
                        <Button variant="ghost" size="sm" onClick={resetUpdatePopupForm}>
                          <X className="h-4 w-4 mr-1" />
                          Annuler
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <Select
                      value={updatePopupForm.type}
                      onValueChange={(value: 'UPDATE' | 'CLAN_PROMPT') => setUpdatePopupForm((prev) => ({
                        ...prev,
                        type: value,
                        title: prev.title || (value === 'CLAN_PROMPT' ? 'Rejoins un clan' : ''),
                      }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPDATE">Annonce classique</SelectItem>
                        <SelectItem value="CLAN_PROMPT">Popup rejoindre un clan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Titre *</label>
                    <Input
                      value={updatePopupForm.title}
                      onChange={(e) => setUpdatePopupForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder={updatePopupForm.type === 'CLAN_PROMPT' ? 'Ex: Rejoins un clan maintenant' : 'Ex: Changelog 1.8.0'}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sous-titre</label>
                    <Input
                      value={updatePopupForm.summary}
                      onChange={(e) => setUpdatePopupForm((prev) => ({ ...prev, summary: e.target.value }))}
                      placeholder={updatePopupForm.type === 'CLAN_PROMPT' ? 'Ex: Trouve une equipe et participe aux guerres' : 'Ex: Nouvelles features, équilibrage et fixes'}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Message *</label>
                    <Textarea
                      value={updatePopupForm.message}
                      onChange={(e) => setUpdatePopupForm((prev) => ({ ...prev, message: e.target.value }))}
                      rows={8}
                      placeholder={updatePopupForm.type === 'CLAN_PROMPT'
                        ? 'Ex: Rejoins un clan pour participer aux guerres, discuter avec ton equipe et progresser plus vite.'
                        : 'Ex: • Nouveau mode de jeu\n• Ajustement des récompenses\n• Corrections de bugs'}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Audience</label>
                    <Select
                      value={updatePopupForm.audience}
                      onValueChange={(value: 'ALL' | 'NO_CLAN' | 'SELECTED_USERS') => setUpdatePopupForm((prev) => ({
                        ...prev,
                        audience: value,
                        targetUserIds: value === 'SELECTED_USERS' ? prev.targetUserIds : [],
                      }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NO_CLAN">Envoyer aux personnes sans clan</SelectItem>
                        <SelectItem value="ALL">Envoyer a tout le monde</SelectItem>
                        <SelectItem value="SELECTED_USERS">Selectionner des utilisateurs</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {updatePopupForm.audience === 'NO_CLAN'
                        ? 'La popup sera visible uniquement pour les utilisateurs qui ne sont dans aucun clan.'
                        : updatePopupForm.audience === 'ALL'
                          ? 'La popup sera visible par tout le monde selon la date de diffusion.'
                          : 'Choisis exactement les utilisateurs qui recevront la popup.'}
                    </p>
                  </div>
                  {updatePopupForm.audience === 'SELECTED_USERS' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Utilisateurs ciblés</label>
                      <div className="max-h-56 overflow-y-auto rounded-md border bg-background/60 p-2 space-y-2">
                        {users.map((u) => {
                          const checked = updatePopupForm.targetUserIds.includes(u.id);
                          return (
                            <label key={u.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(isChecked) => setUpdatePopupForm((prev) => ({
                                  ...prev,
                                  targetUserIds: isChecked
                                    ? [...prev.targetUserIds, u.id]
                                    : prev.targetUserIds.filter((id) => id !== u.id),
                                }))}
                              />
                              <span className="text-sm">{u.username}</span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">{updatePopupForm.targetUserIds.length} utilisateur(s) sélectionné(s)</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mode de diffusion</label>
                      <Select
                        value={updatePopupForm.publishMode}
                        onValueChange={(value: 'draft' | 'now' | 'scheduled') => setUpdatePopupForm((prev) => ({
                          ...prev,
                          publishMode: value,
                          isPublished: value !== 'draft',
                          releaseDate: value === 'scheduled' ? prev.releaseDate : toDateTimeLocalValue(new Date()),
                        }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Brouillon</SelectItem>
                          <SelectItem value="now">Publier maintenant</SelectItem>
                          <SelectItem value="scheduled">Programmer</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {updatePopupForm.publishMode === 'draft'
                          ? 'La popup ne sera visible par aucun joueur.'
                          : updatePopupForm.publishMode === 'scheduled'
                            ? 'La popup sera visible automatiquement à la date choisie.'
                            : 'La popup devient visible dès la sauvegarde.'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Date de programmation</label>
                      <Input
                        type="datetime-local"
                        value={updatePopupForm.releaseDate}
                        onChange={(e) => setUpdatePopupForm((prev) => ({ ...prev, releaseDate: e.target.value }))}
                        disabled={updatePopupForm.publishMode !== 'scheduled'}
                      />
                      <p className="text-xs text-muted-foreground">
                        {updatePopupForm.publishMode === 'scheduled'
                          ? 'Choisissez la date et l\'heure de publication automatique.'
                          : 'Disponible uniquement en mode Programmé.'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Image</label>
                    <ImagePicker
                      value={updatePopupForm.imageUrl}
                      onChange={(url) => setUpdatePopupForm((prev) => ({ ...prev, imageUrl: url }))}
                      uploadFn={uploadUpdatePopupImageFile}
                      placeholder="/uploads/update-popups/... ou https://..."
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleSaveUpdatePopup} disabled={savingUpdatePopup}>
                      {savingUpdatePopup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      {editingUpdatePopupId ? 'Mettre à jour' : 'Créer'}
                    </Button>
                  </div>
                </div>
                {/* List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className={TYPOGRAPHY.H3}>Historique</h3>
                    <span className="text-xs text-muted-foreground">{updatePopups.length} entrées</span>
                  </div>
                  {loadingUpdatePopups ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : updatePopups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune popup créée.</p>
                  ) : (
                    <div className="space-y-2">
                      {updatePopups.map((popup) => (
                        <div key={popup.id} className="rounded-lg border p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          {(() => {
                            const isScheduled = popup.isPublished && new Date(popup.releaseDate).getTime() > Date.now();
                            const statusClass = !popup.isPublished ? 'bg-muted text-muted-foreground' : isScheduled ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400';
                            const statusLabel = !popup.isPublished ? 'Brouillon' : isScheduled ? 'Programmée' : 'Publiée';
                            return (
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{popup.title}</span>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                                    {popup.type === 'CLAN_PROMPT' ? 'Clan' : 'Annonce'}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                    {popup.audience === 'NO_CLAN' ? 'Sans clan' : popup.audience === 'SELECTED_USERS' ? 'Sélection' : 'Tout le monde'}
                                  </span>
                                  <span className={cn('text-xs px-2 py-0.5 rounded-full', statusClass)}>{statusLabel}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {isScheduled ? `Diffusion le ${new Date(popup.releaseDate).toLocaleString('fr-FR')}` : new Date(popup.releaseDate).toLocaleString('fr-FR')}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">Vu {popup._count.views} fois · Créée par {popup.createdBy.username}</p>
                                {popup.summary && <p className="text-sm text-muted-foreground truncate">{popup.summary}</p>}
                              </div>
                            );
                          })()}
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch checked={popup.isPublished} disabled={updatingUpdatePopupId === popup.id} onCheckedChange={(checked) => handleToggleUpdatePopupPublished(popup, checked)} />
                            <Button size="sm" variant="outline" onClick={() => handleEditUpdatePopup(popup)}><Edit2 className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" className="text-destructive border-destructive/30">
                                  {deletingUpdatePopup === popup.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer ce changelog ?</AlertDialogTitle>
                                  <AlertDialogDescription>Cette action est irréversible. La popup ne sera plus affichée aux joueurs.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUpdatePopup(popup.id)}>Supprimer</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Maintenance modal */}
          <Dialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Maintenance</DialogTitle>
                <DialogDescription>Quand activée, toutes les pages affichent la maintenance sauf /admin, /login et /register.</DialogDescription>
              </DialogHeader>
              {loadingSettings ? (
                <div className="flex justify-center py-8"><div className="w-1 h-8 bg-foreground/20 animate-pulse" /></div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
                    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                      <div>
                        <div className="text-sm font-medium">Maintenance globale</div>
                        <div className="text-xs text-muted-foreground">Active la page de maintenance sur tout le site.</div>
                      </div>
                      <Switch checked={maintenanceEnabled} onCheckedChange={setMaintenanceEnabled} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Raison</label>
                    <Textarea
                      value={maintenanceMessage}
                      onChange={(e) => setMaintenanceMessage(e.target.value)}
                      placeholder="Ex: Mise à jour technique en cours."
                      className="min-h-[100px]"
                    />
                    <p className="text-xs text-muted-foreground">Ce texte s&apos;affichera sur la page de maintenance.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fin de maintenance (optionnel)</label>
                    <Input
                      type="datetime-local"
                      value={maintenanceEndDate}
                      onChange={(e) => setMaintenanceEndDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Si définie, un compte à rebours s&apos;affichera sur la page de maintenance.</p>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setMaintenanceOpen(false)}>Annuler</Button>
                <Button onClick={async () => { await saveMaintenance(); setMaintenanceOpen(false); }} disabled={savingMaintenance}>
                  {savingMaintenance ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Sauvegarder
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Fonctionnalités ────────────────────────────────── */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Fonctionnalités</p>
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Pages du site</div>
                  <div className="text-xs text-muted-foreground">
                    {blockedPages.length > 0
                      ? `${blockedPages.length} page${blockedPages.length > 1 ? 's' : ''} désactivée${blockedPages.length > 1 ? 's' : ''}`
                      : 'Toutes les pages sont actives'}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setFonctionnalitesOpen(true)} className="shrink-0">
                  <Gamepad2 className="h-3.5 w-3.5 mr-1.5" />
                  Gérer
                </Button>
              </div>
            </div>
          </div>

          {/* ── Actions sensibles ──────────────────────────────── */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Actions sensibles</p>
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium text-destructive">Vider le chat</div>
                  <div className="text-xs text-muted-foreground">Supprime définitivement tous les messages du chat global. Cette action est irréversible.</div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10 shrink-0" disabled={clearingChat}>
                      {clearingChat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Vider le chat ?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Tous les messages du chat seront définitivement supprimés. Cette action ne peut pas être annulée.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={clearChat} className="bg-destructive hover:bg-destructive/90">
                        Vider le chat
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>

          {/* ── Déploiement ────────────────────────────────────── */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Déploiement</p>
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Déployer la dernière version</div>
                  <div className="text-xs text-muted-foreground">Exécute <code className="font-mono bg-muted/40 px-1 rounded">/var/scripts/deploy.sh</code> sur le serveur pour mettre en ligne les derniers changements Git.</div>
                  {deployOutput && (
                    <button
                      onClick={() => setDeployModalOpen(true)}
                      className={`mt-1.5 text-xs font-medium underline-offset-2 hover:underline ${deployOutput.success ? 'text-green-500' : 'text-destructive'}`}
                    >
                      {deployOutput.success ? '✓ Succès — voir la sortie' : '✗ Échec — voir la sortie'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deploying}
                    onClick={async () => {
                      if (!confirm('Lancer le déploiement ? Le serveur va pull les changements Git et redémarrer.')) return;
                      setDeploying(true);
                      setDeployOutput(null);
                      try {
                        const res = await adminApi.deploy();
                        setDeployOutput({ success: true, stdout: res.data.stdout || '', stderr: res.data.stderr || '', message: res.data.message });
                        setDeployModalOpen(true);
                      } catch (err: unknown) {
                        const d = (err as { response?: { data?: { message?: string; stdout?: string; stderr?: string } } })?.response?.data;
                        setDeployOutput({ success: false, stdout: d?.stdout || '', stderr: d?.stderr || '', message: d?.message || String(err) });
                        setDeployModalOpen(true);
                      } finally {
                        setDeploying(false);
                      }
                    }}
                  >
                    {deploying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Terminal className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Deploy output modal */}
          <Dialog open={deployModalOpen} onOpenChange={setDeployModalOpen}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
              <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40 shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Sortie du déploiement
                </DialogTitle>
                <DialogDescription>
                  {deployOutput?.success ? 'Le script s\'est terminé avec succès.' : 'Le script a échoué.'}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-4">
                <pre className="text-[11px] font-mono bg-black/80 text-green-400 rounded-lg p-4 whitespace-pre-wrap break-all leading-relaxed min-h-[200px]">
                  {deployOutput
                    ? [deployOutput.stdout, deployOutput.stderr].filter(Boolean).join('\n') || deployOutput.message
                    : ''}
                </pre>
              </div>
              <div className="px-6 py-4 border-t border-border/40 shrink-0 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setDeployModalOpen(false)}>Fermer</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* ── Classements (superAdmin) ───────────────────────── */}
          {user?.isSuperAdmin && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Classements par période</p>
              <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
                <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div>
                    <div className="text-sm font-medium">Backfill historique des scores</div>
                    <div className="text-xs text-muted-foreground">
                      Importe les scores passés dans GameScoreHistory pour alimenter les classements journalier / hebdo / mensuel. À lancer une seule fois.
                    </div>
                    {backfillResult && (
                      <p className="text-xs text-green-500 mt-1">✓ {backfillResult.inserted} importés, {backfillResult.skipped} ignorés.</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={backfillLoading}
                    className="shrink-0"
                    onClick={async () => {
                      if (!confirm('Lancer le backfill des scores ? Cette opération peut prendre quelques secondes.')) return;
                      setBackfillLoading(true);
                      setBackfillResult(null);
                      try {
                        const res = await adminApi.backfillScoreHistory();
                        setBackfillResult({ inserted: res.data.inserted, skipped: res.data.skipped });
                      } catch {
                        alert('Erreur lors du backfill.');
                      } finally {
                        setBackfillLoading(false);
                      }
                    }}
                  >
                    {backfillLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Fonctionnalités modal ──────────────────────────── */}
          <Dialog open={fonctionnalitesOpen} onOpenChange={setFonctionnalitesOpen}>
            <DialogContent className="max-w-xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
                <DialogTitle>Fonctionnalités</DialogTitle>
                <DialogDescription>
                  Activez ou désactivez chaque page. Une page désactivée disparaît de la navigation et redirige vers un message.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-4 border-b border-border/40 space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Message d&apos;erreur
                  </label>
                  <Textarea
                    value={blockedMessage}
                    onChange={(e) => setBlockedMessage(e.target.value)}
                    placeholder="Ex: Cette page est momentanément désactivée."
                    className="min-h-[70px] text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Laisser vide pour le message par défaut.</p>
                </div>

                {Object.entries(
                  BLOCKABLE_PAGES.reduce<Record<string, typeof BLOCKABLE_PAGES>>((acc, page) => {
                    acc[page.category] = acc[page.category] || [];
                    acc[page.category].push(page);
                    return acc;
                  }, {} as Record<string, typeof BLOCKABLE_PAGES>)
                ).map(([category, pages]) => (
                  <div key={category}>
                    <div className="px-6 pt-5 pb-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">{category}</span>
                      <span className="text-[11px] text-muted-foreground/50">
                        {pages.filter(p => !blockedPages.includes(p.key)).length}/{pages.length}
                      </span>
                    </div>
                    <div className="mx-4 rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
                      {pages.map((page) => {
                        const isBlocked = blockedPages.includes(page.key);
                        return (
                          <div key={page.key} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-default">
                            <div className={cn('text-sm font-medium', isBlocked && 'text-muted-foreground/50 line-through')}>
                              {page.label}
                            </div>
                            <Switch checked={!isBlocked} onCheckedChange={() => toggleBlockedPage(page.key)} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="h-4" />
              </div>

              <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between shrink-0 bg-background">
                <span className="text-sm text-muted-foreground">
                  {blockedPages.length > 0
                    ? `${blockedPages.length} désactivée${blockedPages.length > 1 ? 's' : ''}`
                    : 'Tout activé'}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setFonctionnalitesOpen(false)}>Annuler</Button>
                  <Button onClick={async () => { const ok = await saveBlockedPages(); if (ok) setFonctionnalitesOpen(false); }} disabled={savingBlocks}>
                    {savingBlocks ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Sauvegarder
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

        </TabsContent>

        <TabsContent value="bans" className={SPACING.SECTION_SPACING}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardDescription>Gestion des bannissements</CardDescription>
                <div className={cn("flex items-center gap-2", TYPOGRAPHY.SMALL)}>
                  <BanIcon className="h-4 w-4" />
                  <span>{bans.filter(b => b.isActive).length} actifs</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingBans ? (
                <div className="flex justify-center py-12">
                  <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
                </div>
              ) : bans.length === 0 ? (
                <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>
                  Aucun bannissement
                </p>
              ) : (
                <div className="divide-y divide-border/30">
                  {bans.map((ban) => (
                    <div
                      key={ban.id}
                      className={cn(
                        "py-4",
                        !ban.isActive && "opacity-60"
                      )}
                    >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{ban.user.username}</span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded",
                          ban.isActive
                            ? ban.type === 'PERMANENT'
                              ? "bg-destructive/20 text-destructive"
                              : "bg-amber-500/20 text-amber-400"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {ban.isActive
                            ? ban.type === 'PERMANENT'
                              ? 'Permanent'
                              : 'Temporaire'
                            : 'Inactif'}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground">Raison:</span> {ban.reason}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Par <span className="text-foreground">{ban.admin.username}</span> • {new Date(ban.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {ban.expiresAt && ban.isActive && (
                          <span> • Expire le {new Date(ban.expiresAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</span>
                        )}
                      </p>
                    </div>

                    {ban.isActive && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-green-500/50 text-green-500 hover:bg-green-500/10"
                            disabled={unbanning === ban.userId}
                          >
                            {unbanning === ban.userId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <ShieldOff className="h-4 w-4 mr-1" />
                                Débannir
                              </>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Débannir {ban.user.username} ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              L'utilisateur pourra de nouveau se connecter et utiliser la plateforme.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => unbanUser(ban.userId)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Débannir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    </div>
                  </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Admin Warnings Card */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardDescription>Avertissements admin</CardDescription>
                <div className="flex items-center gap-4">
                  <div className={cn("flex items-center gap-2", TYPOGRAPHY.SMALL)}>
                    <AlertTriangle className="h-4 w-4" />
                    <span>{warnings.filter(w => !w.isAcknowledged).length} non lus</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setWarningDialogOpen(true)}
                    className="h-8"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Envoyer
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingWarnings ? (
                <div className="flex justify-center py-12">
                  <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
                </div>
              ) : warnings.length === 0 ? (
                <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>
                  Aucun avertissement envoyé
                </p>
              ) : (
                <div className="divide-y divide-border/30">
                  {warnings.map((warning) => (
                    <div
                      key={warning.id}
                      className={cn(
                        "py-4",
                        warning.isAcknowledged && "opacity-60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{warning.user.username}</span>
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded",
                              warning.severity === 'HIGH'
                                ? "bg-destructive/20 text-destructive"
                                : warning.severity === 'MEDIUM'
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-blue-500/20 text-blue-400"
                            )}>
                              {warning.severity === 'HIGH' ? 'Grave' : warning.severity === 'MEDIUM' ? 'Moyen' : 'Info'}
                            </span>
                            {warning.isAcknowledged ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                                Lu
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                Non lu
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-muted-foreground">
                            {warning.message}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            Par <span className="text-foreground">{warning.issuedBy.username}</span> • {new Date(warning.createdAt).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {warning.acknowledgedAt && (
                              <span> • Lu le {new Date(warning.acknowledgedAt).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}</span>
                            )}
                          </p>
                        </div>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                              disabled={deletingWarning === warning.id}
                            >
                              {deletingWarning === warning.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer cet avertissement ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                L'avertissement sera supprimé définitivement.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteWarning(warning.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Warning Dialog */}
          <Dialog open={warningDialogOpen} onOpenChange={setWarningDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Envoyer un avertissement</DialogTitle>
                <DialogDescription>
                  L'utilisateur verra un popup qu'il devra confirmer avoir lu.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Utilisateur</label>
                  <Select value={warningUserId} onValueChange={setWarningUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un utilisateur" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sévérité</label>
                  <Select value={warningSeverity} onValueChange={(v) => setWarningSeverity(v as 'LOW' | 'MEDIUM' | 'HIGH')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Information</SelectItem>
                      <SelectItem value="MEDIUM">Avertissement</SelectItem>
                      <SelectItem value="HIGH">Grave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    value={warningMessage}
                    onChange={(e) => setWarningMessage(e.target.value)}
                    placeholder="Entrez le message de l'avertissement..."
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setWarningDialogOpen(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={createWarning}
                  disabled={creatingWarning || !warningUserId || !warningMessage.trim()}
                >
                  {creatingWarning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Envoyer
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="logs" className={SPACING.CARD_SPACING}>
          {/* Category Pills - Single Line */}
          {logStats && (
            <ToggleGroup
              type="single"
              value={logFilter.type === 'ALL' ? '' : logFilter.type}
              onValueChange={(value) => {
                const newType = value || 'ALL';
                setLogFilter(prev => ({ ...prev, type: newType, gameType: 'ALL' }));
                setTimeout(() => fetchLogs(0, newType, 'ALL'), 0);
              }}
              className="flex flex-wrap justify-start gap-2"
            >
              {Object.entries(logStats.byType).map(([type, count]) => {
                const config = LOG_TYPE_CONFIG[type];
                if (!config) return null;
                const Icon = config.icon;
                const isSelected = logFilter.type === type;

                return (
                  <ToggleGroupItem
                    key={type}
                    value={type}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "rounded-full text-xs transition-all data-[state=on]:hover:text-white",
                      isSelected
                        ? `${config.bgColor} ${config.borderColor} text-white hover:${config.bgColor}`
                        : `${config.borderColor} ${config.color} bg-transparent hover:bg-muted/30 hover:${config.color}`
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{config.label}</span>
                    <span className={cn(
                      "tabular-nums",
                      isSelected ? "text-white/80" : "text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          )}

          {/* Game Type Filters (show when GAME type is selected) */}
          {logFilter.type === 'GAME' && (
            <ToggleGroup
              type="single"
              value={logFilter.gameType === 'ALL' ? '' : logFilter.gameType}
              onValueChange={(value) => {
                const newGameType = value || 'ALL';
                setLogFilter(prev => ({ ...prev, gameType: newGameType }));
                setTimeout(() => fetchLogs(0, undefined, newGameType), 0);
              }}
              className="flex flex-wrap justify-start gap-2"
            >
              {GAME_TYPES.map((game) => {
                const isSelected = logFilter.gameType === game.value;
                return (
                  <ToggleGroupItem
                    key={game.value}
                    value={game.value}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "rounded-full text-xs transition-all",
                      isSelected
                        ? "border-purple-500 bg-purple-500 text-white hover:bg-purple-500"
                        : "border-purple-500 text-purple-400 bg-transparent hover:bg-muted/30 hover:text-purple-300"
                    )}
                  >
                    <Gamepad2 className="h-3 w-3" />
                    <span>{game.label}</span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          )}

          <Card className="border-border/40 bg-background/70">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm font-semibold">Filtre horaire</div>
                  <div className="text-xs text-muted-foreground">
                    Sélectionne un créneau précis sur une journée via la timeline.
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {logTimelineEnabled ? 'Activé' : 'Désactivé'}
                  </span>
                  <Switch
                    checked={logTimelineEnabled}
                    onCheckedChange={(checked) => {
                      setLogTimelineEnabled(checked);
                      setTimeout(() => fetchLogs(0), 0);
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jour</label>
                  <Input
                    type="date"
                    value={logTimelineDate}
                    disabled={!logTimelineEnabled}
                    onChange={(e) => {
                      setLogTimelineDate(e.target.value);
                      setTimeout(() => fetchLogs(0), 0);
                    }}
                    className="h-9 w-full md:w-[210px]"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!logTimelineEnabled}
                  onClick={() => {
                    setLogTimelineRange([0, 1439]);
                    setTimeout(() => fetchLogs(0), 0);
                  }}
                  className="h-9 md:self-end"
                >
                  Toute la journée
                </Button>
              </div>

              <div className={cn("space-y-4 transition-opacity", !logTimelineEnabled && "opacity-50")}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="rounded-full border border-border/50 px-2.5 py-1 font-mono">
                    Début {formatTimelineMinutes(logTimelineRange[0])}
                  </span>
                  <span className="text-muted-foreground">
                    {Math.max(15, logTimelineRange[1] - logTimelineRange[0] + 1)} min sélectionnées
                  </span>
                  <span className="rounded-full border border-border/50 px-2.5 py-1 font-mono">
                    Fin {formatTimelineMinutes(logTimelineRange[1])}
                  </span>
                </div>

                <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-5">
                  <Slider
                    min={0}
                    max={1439}
                    step={15}
                    minStepsBetweenThumbs={1}
                    value={logTimelineRange}
                    disabled={!logTimelineEnabled}
                    onValueChange={(value) => {
                      if (value.length !== 2) return;
                      setLogTimelineRange([value[0], value[1]]);
                    }}
                    onValueCommit={(value) => {
                      if (value.length !== 2) return;
                      setLogTimelineRange([value[0], value[1]]);
                      fetchLogs(0);
                    }}
                    className="py-3"
                  />

                  <div className="mt-3 grid grid-cols-6 gap-2 text-[11px] text-muted-foreground sm:grid-cols-8 lg:grid-cols-12">
                    {Array.from({ length: 12 }, (_, index) => {
                      const hour = index * 2;
                      return (
                        <div key={hour} className="text-center font-mono">
                          {String(hour).padStart(2, '0')}h
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search Bar + Download */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par utilisateur..."
                value={logFilter.username}
                onChange={(e) => setLogFilter(prev => ({ ...prev, username: e.target.value }))}
                className="pl-9 bg-transparent border-border/50 h-9"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDownloadLogsError(null);
                setDownloadLogsOpen(true);
              }}
              className="h-9"
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger les logs
            </Button>
          </div>

          <Dialog
            open={downloadLogsOpen}
            onOpenChange={(open) => {
              setDownloadLogsOpen(open);
              if (!open) {
                setDownloadLogsError(null);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Télécharger les logs</DialogTitle>
                <DialogDescription>
                  Exporte une plage de dates précise ou tous les logs. Les filtres actuels, y compris le créneau horaire s'il est activé, seront appliqués.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={downloadLogsMode === 'range' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setDownloadLogsMode('range');
                      setDownloadLogsError(null);
                    }}
                  >
                    Plage de dates
                  </Button>
                  <Button
                    type="button"
                    variant={downloadLogsMode === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setDownloadLogsMode('all');
                      setDownloadLogsError(null);
                    }}
                  >
                    Tous les temps
                  </Button>
                </div>
                {downloadLogsMode === 'range' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Depuis le</label>
                      <Input
                        type="date"
                        value={downloadLogsStartDate}
                        onChange={(e) => setDownloadLogsStartDate(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Jusqu'au</label>
                      <Input
                        type="date"
                        value={downloadLogsEndDate}
                        onChange={(e) => setDownloadLogsEndDate(e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Tous les logs correspondant aux filtres actifs seront exportés, sans limite de date.
                  </p>
                )}
                {downloadLogsError && (
                  <p className="text-xs text-red-400">{downloadLogsError}</p>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDownloadLogsOpen(false)}
                  disabled={downloadingLogs}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={handleDownloadLogs}
                  disabled={downloadingLogs}
                >
                  {downloadingLogs ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Télécharger'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Log List */}
          {loadingLogs ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <ScrollText className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground">Aucun log trouvé</p>
            </div>
          ) : (
            <div className="border border-border/30 rounded overflow-hidden divide-y divide-border/30">
              {logs.map((log) => {
                const config = LOG_TYPE_CONFIG[log.type];
                const Icon = config?.icon || ScrollText;
                const isExpanded = expandedLogIds.has(log.id);
                const summaryNode = renderLogSummary(log);
                const gameDisplayInfo = getGameDisplayInfo(log);
                const gameRowAccentClass =
                  log.type === 'GAME'
                    ? gameDisplayInfo.isMultiplayer
                      ? 'bg-cyan-500/[0.05] hover:bg-cyan-500/[0.10]'
                      : 'bg-amber-500/[0.05] hover:bg-amber-500/[0.10]'
                    : 'hover:bg-muted/20';
                const gameDetailsAccentClass =
                  log.type === 'GAME'
                    ? gameDisplayInfo.isMultiplayer
                      ? 'bg-cyan-500/[0.04]'
                      : 'bg-amber-500/[0.04]'
                    : 'bg-muted/10';
                const typePillClass =
                  log.type === 'GAME'
                    ? gameDisplayInfo.isMultiplayer
                      ? 'bg-cyan-600'
                      : 'bg-amber-600'
                    : (config?.bgColor || 'bg-muted');

                return (
                  <div key={log.id}>
                    {/* Collapsed single-line view */}
                    <Button variant="ghost"
                      onClick={() => toggleLogExpand(log.id)}
                      className={cn(
                        "w-full px-3 py-2 flex items-center gap-2 transition-colors text-left",
                        gameRowAccentClass
                      )}
                    >
                      {/* Type pastille */}
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0",
                        typePillClass,
                        "text-white"
                      )}>
                        <Icon className="h-2.5 w-2.5" />
                        {config?.label || humanizeUiLabel(log.type)}
                      </span>

                      {/* Action + User summary */}
                      <span className="text-sm truncate flex-1">
                        <span className="font-medium">{summaryNode}</span>
                      </span>

                      {/* Time */}
                      <span className="text-xs text-muted-foreground/60 shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {/* Expand indicator */}
                      <ChevronDown className={cn(
                        "h-4 w-4 text-muted-foreground/50 shrink-0 transition-transform",
                        isExpanded && "rotate-180"
                      )} />
                    </Button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className={cn("px-3 pb-3 pt-1 border-t border-border/20", gameDetailsAccentClass)}>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div className="text-muted-foreground">Date</div>
                          <div>
                            {new Date(log.createdAt).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </div>

                          {log.username && (
                            <>
                              <div className="text-muted-foreground">Utilisateur</div>
                              <div>{log.username}</div>
                            </>
                          )}

                          {log.targetName && (
                            <>
                              <div className="text-muted-foreground">Cible</div>
                              <div>{log.targetName}</div>
                            </>
                          )}

                          {log.ipAddress && (
                            <>
                              <div className="text-muted-foreground">Adresse réseau</div>
                              <div className="font-mono">{log.ipAddress}</div>
                            </>
                          )}

                          {/* Metadata — skip internal IDs, format values */}
                          {Object.entries(log.metadata ?? log.details ?? {})
                            .filter(([key]) => !SKIP_METADATA_KEYS.has(key))
                            .map(([key, value]) => (
                              <div key={key} className="contents">
                                <div className="text-muted-foreground">{METADATA_LABELS[key] || humanizeUiLabel(key)}</div>
                                <div>{renderMetadataValue(key, value)}</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalLogs > logsPerPage && (
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
          )}
        </TabsContent>

      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bannir un utilisateur</DialogTitle>
            <DialogDescription>
              Empêcher un utilisateur d'accéder à la plateforme.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Raison</label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Indiquez la raison du bannissement..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type de bannissement</label>
              <Select value={banType} onValueChange={(value: 'TEMPORARY' | 'PERMANENT') => setBanType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEMPORARY">Temporaire</SelectItem>
                  <SelectItem value="PERMANENT">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {banType === 'TEMPORARY' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Durée (heures)</label>
                <Input
                  type="number"
                  value={banDuration}
                  onChange={(e) => setBanDuration(parseInt(e.target.value) || 1)}
                  min={1}
                  placeholder="24"
                />
                <p className="text-xs text-muted-foreground">
                  Le bannissement expirera dans {banDuration} heure{banDuration > 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBanDialogOpen(false)}
              disabled={creatingBan}
            >
              Annuler
            </Button>
            <Button
              onClick={createBan}
              disabled={creatingBan || !banReason.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {creatingBan ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Bannissement...
                </>
              ) : (
                <>
                  <BanIcon className="h-4 w-4 mr-2" />
                  Bannir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={editModalOpen} onOpenChange={(open) => { if (!open) cancelEditing(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier {editModalUser?.username}</DialogTitle>
            <DialogDescription>{editModalUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Identity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-blue-400 flex items-center gap-1"><UserCog className="h-3 w-3" />Pseudo</label>
                <div className="relative">
                  <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-400/60 pointer-events-none" />
                  <Input type="text" value={editValues.username} onChange={(e) => setEditValues(prev => ({ ...prev, username: e.target.value }))} className="h-9 bg-transparent border-blue-500/30 focus-visible:ring-blue-500/30 pl-8" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-blue-400 flex items-center gap-1"><Users className="h-3 w-3" />Prénom</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-400/60 pointer-events-none" />
                  <Input type="text" value={editValues.firstName} onChange={(e) => setEditValues(prev => ({ ...prev, firstName: e.target.value }))} className="h-9 bg-transparent border-blue-500/30 focus-visible:ring-blue-500/30 pl-8" placeholder="Non défini" />
                </div>
              </div>
            </div>

            {/* Role */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-amber-400 flex items-center gap-1"><Shield className="h-3 w-3" />Rôle</label>
              <Select
                value={editModalUser ? getAdminRole(editModalUser) : 'USER'}
                onValueChange={(value) => editModalUser && void updateUserRole(editModalUser, value as AdminRole)}
                disabled={updatingRoleUserId === editModalUser?.id || user?.id === editModalUser?.id}
              >
                <SelectTrigger className="h-9 border-amber-500/30 bg-transparent">
                  <Shield className="h-3.5 w-3.5 text-amber-400/60 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">{ROLE_LABELS.USER}</SelectItem>
                  <SelectItem value="ADMIN">{ROLE_LABELS.ADMIN}</SelectItem>
                  <SelectItem value="SUPER_ADMIN">{ROLE_LABELS.SUPER_ADMIN}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Economy */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-purple-400 flex items-center gap-1"><TrendingUp className="h-3 w-3" />Aura</label>
                <div className="relative">
                  <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-purple-400/60 pointer-events-none" />
                  <Input type="number" value={editValues.aura} onChange={(e) => setEditValues(prev => ({ ...prev, aura: parseInt(e.target.value) || 0 }))} className="h-9 bg-transparent border-purple-500/30 focus-visible:ring-purple-500/30 pl-8" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-green-400 flex items-center gap-1"><Coins className="h-3 w-3" />Argent</label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-400/60 pointer-events-none" />
                  <Input type="number" value={editValues.money} onChange={(e) => setEditValues(prev => ({ ...prev, money: parseInt(e.target.value) || 0 }))} className="h-9 bg-transparent border-green-500/30 focus-visible:ring-green-500/30 pl-8" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-yellow-400 flex items-center gap-1"><Coins className="h-3 w-3" />AuraCoin</label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-yellow-400/60 pointer-events-none" />
                  <Input type="number" step="0.01" value={editValues.auraCoinBalance} onChange={(e) => setEditValues(prev => ({ ...prev, auraCoinBalance: parseFloat(e.target.value) || 0 }))} className="h-9 bg-transparent border-yellow-500/30 focus-visible:ring-yellow-500/30 pl-8" />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" />Nouveau mot de passe</label>
              <div className="relative">
                <Eye className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
                <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="h-9 bg-transparent border-border/40 pl-8" placeholder="Laisser vide pour ne pas changer" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelEditing}>Annuler</Button>
            <Button onClick={() => editingUser && saveUser(editingUser)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Badge Award Modal */}
      <Dialog open={badgeModalOpen} onOpenChange={(open) => { if (!open) { setBadgeModalOpen(false); setBadgeModalUserId(''); setBadgeModalBadgeId(''); setBadgeModalReason(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Attribuer un badge</DialogTitle>
            <DialogDescription>
              {badgeModalUserId
                ? `Attribution à ${users.find(u => u.id === badgeModalUserId)?.username || badgeModalUserId}`
                : `Attribution à ${selectedUserIds.length} utilisateur(s) sélectionné(s)`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Badge</label>
              <Select value={badgeModalBadgeId} onValueChange={setBadgeModalBadgeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un badge..." />
                </SelectTrigger>
                <SelectContent>
                  {badges.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.icon} {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Raison (optionnel)</label>
              <Input
                placeholder="Raison de l'attribution..."
                value={badgeModalReason}
                onChange={(e) => setBadgeModalReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBadgeModalOpen(false); setBadgeModalUserId(''); setBadgeModalBadgeId(''); setBadgeModalReason(''); }}>
              Annuler
            </Button>
            <Button onClick={handleBadgeModalAward} disabled={!badgeModalBadgeId} className="bg-violet-600 hover:bg-violet-700">
              <Award className="h-4 w-4 mr-2" />
              Attribuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mass Delete Confirmation */}
      <AlertDialog open={massDeleteOpen} onOpenChange={setMassDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Supprimer {selectedUserIds.length} utilisateur(s) ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données de ces utilisateurs seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={massDeleteUsers} className="bg-destructive hover:bg-destructive/90">
              Supprimer tout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Inventory Dialog */}
      <Dialog
        open={inventoryDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeInventory();
          } else {
            setInventoryDialogOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Inventaire de {inventoryUser?.username || 'l\'utilisateur'}
            </DialogTitle>
            <DialogDescription>
              Consultez et ajustez les objets détenus par l'utilisateur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="border border-border/30 rounded p-4 space-y-3">
              <h3 className="text-sm text-muted-foreground  ">
                Ajouter un objet
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Objet</label>
                  <Select
                    value={inventoryAddItemId}
                    onValueChange={(value) => setInventoryAddItemId(value)}
                  >
                    <SelectTrigger className="bg-transparent">
                      <SelectValue placeholder="Choisir un objet" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Aucun objet disponible
                        </SelectItem>
                      ) : (
                        items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} • {ITEM_TYPE_LABELS[item.type] || humanizeUiLabel(item.type)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Quantité</label>
                  <Input
                    type="number"
                    min={1}
                    value={inventoryAddQuantity}
                    onChange={(e) => setInventoryAddQuantity(parseInt(e.target.value) || 1)}
                    className="bg-transparent"
                  />
                </div>
                <Button
                  onClick={addInventoryItem}
                  disabled={addingInventoryItem || items.length === 0 || !inventoryAddItemId}
                  className="h-9"
                >
                  {addingInventoryItem ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Ajouter
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm text-muted-foreground  ">
                  Inventaire actuel
                </h3>
                <span className="text-xs text-muted-foreground">
                  Définissez 0 pour supprimer un objet
                </span>
              </div>

              {loadingInventory ? (
                <div className="flex justify-center py-8">
                  <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
                </div>
              ) : inventoryItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucun objet dans l'inventaire
                </p>
              ) : (
                <div className="space-y-0">
                  {inventoryItems.map((inventoryItem) => {
                    const effect = inventoryItem.item.effect ? parseEffect(inventoryItem.item.effect) : null;
                    const effectLabel = effect
                      ? EFFECT_TYPES.find((effectItem) => effectItem.value === effect.type)?.label || humanizeUiLabel(effect.type)
                      : null;

                    return (
                      <div
                        key={inventoryItem.id}
                        className="py-4 border-b border-border/30 last:border-0"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-4 min-w-0">
                            {inventoryItem.item.imageUrl ? (
                              <img
                                src={resolveImageUrl(inventoryItem.item.imageUrl)}
                                alt={inventoryItem.item.name}
                                className="w-10 h-10 object-cover rounded"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-muted/30 flex items-center justify-center rounded">
                                <Package className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium truncate">{inventoryItem.item.name}</span>
                                <span className="text-xs text-muted-foreground  ">
                                  {ITEM_TYPE_LABELS[inventoryItem.item.type] || humanizeUiLabel(inventoryItem.item.type)}
                                </span>
                              </div>
                              {effectLabel && (
                                <p className="text-xs text-muted-foreground/70">
                                  Effet: {effectLabel}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground/60">
                                Ajouté le {new Date(inventoryItem.acquiredAt).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              value={inventoryQuantities[inventoryItem.id] ?? inventoryItem.quantity}
                              onChange={(e) =>
                                setInventoryQuantities((prev) => ({
                                  ...prev,
                                  [inventoryItem.id]: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="h-9 w-24 bg-transparent"
                            />
                            <Button
                              size="sm"
                              onClick={() => updateInventoryQuantity(inventoryItem.id)}
                              disabled={updatingInventoryItem === inventoryItem.id}
                              className="h-9"
                            >
                              {updatingInventoryItem === inventoryItem.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 border-destructive/50 text-destructive hover:bg-destructive/10"
                                  disabled={removingInventoryItem === inventoryItem.id}
                                >
                                  {removingInventoryItem === inventoryItem.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-destructive" />
                                    Retirer {inventoryItem.item.name} ?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    L'objet sera supprimé de l'inventaire de l'utilisateur.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeInventoryItem(inventoryItem.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Retirer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeInventory}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Create/Edit Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Modifier l\'objet' : 'Créer un objet'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Modifiez les propriétés de l\'objet.' : 'Créez un nouvel objet pour la boutique.'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {/* Row 1: Name + Category + Price */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nom</label>
                <Input
                  value={itemForm.name}
                  onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nom de l'objet"
                  className="bg-transparent"
                />
              </div>
              <div className="col-span-1 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
                <Select
                  value={itemForm.type}
                  onValueChange={(value) => setItemForm(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger className="bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {shopCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Prix ($)</label>
                <Input
                  type="number"
                  value={itemForm.price}
                  onChange={(e) => setItemForm(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                  className="bg-transparent"
                  min={0}
                />
              </div>
            </div>

            {/* Row 2: Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea
                value={itemForm.description}
                onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description de l'objet"
                className="bg-transparent resize-none"
                rows={2}
              />
            </div>

            {/* Row 3: Image + Effect */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Image boutique (optionnel)</label>
                <ImagePicker
                  value={itemForm.imageUrl}
                  onChange={(url) => setItemForm(prev => ({ ...prev, imageUrl: url }))}
                  uploadFn={uploadItemImageFile}
                />
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Type d'effet</label>
                  <Select
                    value={itemForm.effectType}
                    onValueChange={(value) => {
                      setItemForm(prev => ({
                        ...prev,
                        effectType: value,
                        effectValue: '',
                        bonusAura: 0,
                        bonusMoney: 0,
                        skinImageUrl: '',
                        skinShopType: 'none',
                        badgeId: '',
                      }));
                    }}
                  >
                    <SelectTrigger className="bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EFFECT_TYPES.map((effect) => (
                        <SelectItem key={effect.value} value={effect.value}>
                          {effect.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {EFFECT_TYPES.find(e => e.value === itemForm.effectType)?.description}
                  </p>
                </div>

                {itemForm.effectType === 'BONUS_AURA' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Valeur Bonus Aura</label>
                    <Input
                      type="number"
                      value={itemForm.bonusAura || 0}
                      onChange={(e) => setItemForm(prev => ({ ...prev, bonusAura: parseInt(e.target.value) || 0 }))}
                      className="bg-transparent"
                      min="0"
                    />
                  </div>
                )}

                {itemForm.effectType === 'BONUS_MONEY' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Valeur Bonus Argent</label>
                    <Input
                      type="number"
                      value={itemForm.bonusMoney || 0}
                      onChange={(e) => setItemForm(prev => ({ ...prev, bonusMoney: parseInt(e.target.value) || 0 }))}
                      className="bg-transparent"
                      min="0"
                    />
                  </div>
                )}

                {itemForm.effectType === 'DOODLE_JUMP_SKIN' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Image du skin</label>
                      <ImagePicker
                        value={itemForm.skinImageUrl || ''}
                        onChange={(url) => setItemForm(prev => ({ ...prev, skinImageUrl: url }))}
                        uploadFn={uploadItemImageFile}
                      />
                      <p className="text-xs text-muted-foreground">Cette image sera utilisée comme sprite du personnage dans Doodle Jump.</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Placement dans la boutique DJ</label>
                      <Select
                        value={itemForm.skinShopType || 'none'}
                        onValueChange={(value) => setItemForm(prev => ({ ...prev, skinShopType: value as 'none' | 'static' | 'rotating' }))}
                      >
                        <SelectTrigger className="bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Non placé (invisible en boutique)</SelectItem>
                          <SelectItem value="static">⭐ Boutique permanente</SelectItem>
                          <SelectItem value="rotating">🔥 Pool de rotation quotidienne</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Choisir si ce skin apparaît en permanence ou dans la rotation du jour.</p>
                    </div>
                  </div>
                )}

                {itemForm.effectType === 'AWARD_BADGE' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Badge à attribuer</label>
                    <div className="max-h-48 overflow-y-auto rounded border border-border/40 bg-muted/10 p-2">
                      {badges.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-2">Aucun badge disponible.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-1">
                          {badges.filter(b => b.isActive).map((badge) => (
                            <button
                              key={badge.id}
                              type="button"
                              onClick={() => {
                                const svg = generateBadgeSvgDataUrl(badge);
                                setItemForm(prev => ({ ...prev, badgeId: badge.id, imageUrl: prev.imageUrl || svg }));
                              }}
                              className={cn(
                                'flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/40',
                                itemForm.badgeId === badge.id ? 'bg-muted/60 ring-1 ring-border' : '',
                              )}
                            >
                              <BadgeIcon badge={badge} size="xs" />
                              <span className="truncate font-medium">{badge.name}</span>
                              <span className="ml-auto shrink-0 text-muted-foreground">{badge.rarity}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {itemForm.badgeId && (
                      <p className="text-xs text-muted-foreground">
                        Sélectionné : {badges.find(b => b.id === itemForm.badgeId)?.name ?? itemForm.badgeId}
                      </p>
                    )}
                  </div>
                )}

                {itemForm.effectType !== 'BONUS_AURA' && itemForm.effectType !== 'BONUS_MONEY' && itemForm.effectType !== 'DOODLE_JUMP_SKIN' && !EFFECT_TYPES_WITHOUT_VALUE.has(itemForm.effectType) && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {itemForm.effectType === 'CLAN_GAME_MONEY_BOOST' ? 'Pourcentage de boost' : 'Valeur de l\'effet'}
                    </label>
                    <Input
                      value={itemForm.effectValue}
                      onChange={(e) => setItemForm(prev => ({ ...prev, effectValue: e.target.value }))}
                      placeholder={itemForm.effectType === 'CLAN_GAME_MONEY_BOOST' ? 'Ex: 10' : 'Valeur de l\'effet'}
                      className="bg-transparent"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveItem} disabled={savingItem}>
              {savingItem ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {editingItem ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        {/* ===== ACTIVITY TAB ===== */}
        <TabsContent value="activity" className={SPACING.SECTION_SPACING}>

          {/* ── PLATFORM OVERVIEW ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Vue d'ensemble de la plateforme</span>
                {loadingPlatformStats && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
              <Button variant="ghost" size="sm" onClick={fetchPlatformStats} className="h-7 w-7 p-0" title="Rafraîchir">
                <RefreshCw className={cn('h-3.5 w-3.5', loadingPlatformStats && 'animate-spin')} />
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-blue-400" />
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Membres actifs</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-blue-400">{platformStats?.overview.approvedUsers ?? '—'}</p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>{platformStats?.overview.totalUsers ?? '—'} inscrits</p>
                </CardContent>
              </Card>
              <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Gamepad2 className="h-3.5 w-3.5 text-purple-400" />
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Parties jouées</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-purple-400">
                    {platformStats ? formatBigNumber(platformStats.overview.totalGamesPlayed) : '—'}
                  </p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>tous les temps</p>
                </CardContent>
              </Card>
              <Card className="border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-green-400" />
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Victoires</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-green-400">
                    {platformStats ? formatBigNumber(platformStats.overview.totalWins) : '—'}
                  </p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>
                    {platformStats && platformStats.overview.totalGamesPlayed > 0
                      ? `${Math.round(platformStats.overview.totalWins / platformStats.overview.totalGamesPlayed * 100)}% win rate`
                      : 'win rate'}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Aura totale</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-yellow-400">
                    {platformStats ? formatBigNumber(parseInt(platformStats.overview.totalAura)) : '—'}
                  </p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>en circulation</p>
                </CardContent>
              </Card>
              <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-600/5">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-orange-400" />
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Argent total</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-orange-400">
                    {platformStats ? formatBigNumber(platformStats.overview.totalMoney) : '—'}
                  </p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>en circulation</p>
                </CardContent>
              </Card>
              <Card className="border-pink-500/20 bg-gradient-to-br from-pink-500/10 to-pink-600/5">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-pink-400" />
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Transferts</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-pink-400">
                    {platformStats ? formatBigNumber(platformStats.overview.totalTransfers) : '—'}
                  </p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>
                    {platformStats ? `${formatBigNumber(platformStats.overview.totalAuraTransferred)} aura` : 'échangée'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── EXTRA STATS ROW ── */}
          {platformStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-border/40">
                <CardContent className="p-4 space-y-1">
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Argent échangé</p>
                  <p className="text-xl font-semibold tabular-nums">{formatBigNumber(platformStats.overview.totalMoneyTransferred)}</p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>via transferts</p>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardContent className="p-4 space-y-1">
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Mots tapés (Bombe)</p>
                  <p className="text-xl font-semibold tabular-nums">{formatBigNumber(platformStats.overview.totalWordsTyped)}</p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>tous les temps</p>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardContent className="p-4 space-y-1">
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Parties (30j)</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatBigNumber(platformStats.activityChart.reduce((s, d) => s + d.count, 0))}
                  </p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>sur les 30 derniers jours</p>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardContent className="p-4 space-y-1">
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Moy. / jour (30j)</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {(platformStats.activityChart.reduce((s, d) => s + d.count, 0) / 30).toFixed(1)}
                  </p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>parties par jour</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── GAME ACTIVITY CHART (30 days) ── */}
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Parties jouées (30 derniers jours)</span>
                  {loadingPlatformStats && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
                {platformStats && (
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                    {platformStats.activityChart.reduce((s, d) => s + d.count, 0).toLocaleString('fr-FR')} parties
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingPlatformStats && !platformStats ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : platformStats && platformStats.activityChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={platformStats.activityChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => {
                        const d = new Date(v + 'T12:00:00');
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                      interval={4}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={24}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                      formatter={(value: number) => [`${value} partie${value !== 1 ? 's' : ''}`, 'Jeux']}
                      labelFormatter={(label: string) => new Date(label + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
              )}
            </CardContent>
          </Card>

          {/* ── TOP GAMES + ALL-TIME LEADERBOARD ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top games by plays */}
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Jeux les plus joués (tous les temps)</span>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPlatformStats && !platformStats ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : platformStats && platformStats.topGames.length > 0 ? (
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart
                      data={platformStats.topGames.slice(0, 12).map((g) => ({
                        ...g,
                        label: GAME_TYPE_LABELS[g.gameType] ?? g.gameType.replace(/_/g, ' '),
                      }))}
                      layout="vertical"
                      margin={{ top: 4, right: 50, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => formatBigNumber(v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={96}
                      />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                        formatter={(value: number, _name: string, props: any) => [
                          `${value.toLocaleString('fr-FR')} parties · ${(props.payload.wins ?? 0).toLocaleString('fr-FR')} victoires`,
                          'Stats',
                        ]}
                      />
                      <Bar dataKey="totalPlayed" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                        {platformStats.topGames.slice(0, 12).map((_g, index) => (
                          <Cell key={index} fill={ACTIVITY_BREAKDOWN_COLORS[index % ACTIVITY_BREAKDOWN_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
                )}
              </CardContent>
            </Card>

            {/* All-time games played leaderboard */}
            <Card className="border-border/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Classement parties jouées (tous les temps)</span>
                  {loadingGamesLeaderboard && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
                <CardDescription>
                  Basé sur les stats de jeu — toutes les parties comptées pour tous les jeux, sans estimation de durée.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingGamesLeaderboard && gamesLeaderboard.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : gamesLeaderboard.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/40">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground w-10">#</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Joueur</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Parties</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gamesLeaderboard.map((entry: any, i: number) => (
                          <tr key={entry.userId} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                            <td className="py-2 px-3 font-semibold text-foreground">{entry.rank ?? i + 1}</td>
                            <td className="py-2 px-3">
                              <span style={{ color: entry.usernameColor || 'inherit' }} className="font-medium">
                                {entry.username}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums font-semibold">
                              {(entry.value ?? 0).toLocaleString('fr-FR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/40">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/40 bg-muted/20">
                  <Trophy className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Record absolu</p>
                  <p className="text-2xl font-semibold tabular-nums">{onlineStats?.allTimeRecord ?? '—'}</p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                    {onlineStats?.allTimeRecordAt
                      ? new Date(onlineStats.allTimeRecordAt).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Aucun record enregistre'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardContent className="space-y-1 p-4">
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>En ligne</p>
                <p className="text-2xl font-semibold tabular-nums">{onlineStats?.current ?? '—'}</p>
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardContent className="space-y-1 p-4">
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Pic 24h</p>
                <p className="text-2xl font-semibold tabular-nums">{onlineStats?.peak1d ?? '—'}</p>
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardContent className="space-y-1 p-4">
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Pic 7 jours</p>
                <p className="text-2xl font-semibold tabular-nums">{onlineStats?.peak7d ?? '—'}</p>
              </CardContent>
            </Card>
          </div>

          {/* ── CHART CARD ── */}
          <Card>
            <CardHeader className="pb-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Joueurs en ligne</span>
                  {loadingActivity && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(['day', 'week', 'month', 'specific', 'custom'] as const).map(p => (
                    <Button
                      key={p}
                      variant={activityPeriod === p ? 'default' : 'outline'}
                      onClick={() => {
                        setActivityPeriod(p);
                        if (p !== 'custom' && p !== 'specific') fetchActivity(p);
                      }}
                      className="h-8 px-3 text-xs"
                    >
                      {p === 'day' ? "Aujourd'hui" : p === 'week' ? '7j' : p === 'month' ? '30j' : p === 'specific' ? 'Jour' : 'Plage'}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => fetchActivity(activityPeriod)}
                    className="h-8 px-2"
                    title="Rafraîchir"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    setSnapshotting(true);
                    try {
                      await adminApi.takeOnlineSnapshot();
                      await fetchActivity(activityPeriod);
                    } finally {
                      setSnapshotting(false);
                    }
                  }}
                  disabled={snapshotting}
                  className="h-8 gap-1.5 px-3 text-xs"
                  title="Enregistrer un snapshot maintenant"
                >
                  {snapshotting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Snapshot
                </Button>
              </div>

              {/* Custom date range — native date pickers (open system calendar) */}
              {activityPeriod === 'custom' && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <CalendarRange className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input
                    type="date"
                    value={activityCustomStart}
                    onChange={e => setActivityCustomStart(e.target.value)}
                    className="h-8 w-auto text-xs"
                  />
                  <span className="text-xs text-muted-foreground">→</span>
                  <Input
                    type="date"
                    value={activityCustomEnd}
                    onChange={e => setActivityCustomEnd(e.target.value)}
                    className="h-8 w-auto text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => fetchActivity('custom', activityCustomStart, activityCustomEnd)}
                    disabled={!activityCustomStart || !activityCustomEnd}
                  >
                    Appliquer
                  </Button>
                </div>
              )}

              {/* Specific day picker */}
              {activityPeriod === 'specific' && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <CalendarRange className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input
                    type="date"
                    value={activitySpecificDay}
                    onChange={e => setActivitySpecificDay(e.target.value)}
                    className="h-8 w-auto text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => fetchActivity('specific')}
                    disabled={!activitySpecificDay}
                  >
                    Appliquer
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="pt-4">
              {loadingActivity && !activityHistory ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activityHistory && activityHistory.data.length > 0 ? (
                <>
                  {/* Big period title */}
                  <p className="text-2xl font-bold tracking-tight mb-4 capitalize">
                    {activityPeriod === 'day'
                      ? new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                      : activityPeriod === 'week'
                      ? '7 derniers jours'
                      : activityPeriod === 'month'
                      ? '30 derniers jours'
                      : activityPeriod === 'specific' && activitySpecificDay
                      ? new Date(activitySpecificDay + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                      : activityPeriod === 'custom' && activityCustomStart && activityCustomEnd
                      ? `${new Date(activityCustomStart + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → ${new Date(activityCustomEnd + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : 'Activité'}
                  </p>

                  {activityHistory.peak > 0 && (
                    <div className="mb-4 flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Pic sur la période</span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-semibold tabular-nums">
                          {activityHistory.peak}
                        </span>
                        <span className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                          {activityHistory.peakAt
                            ? new Date(activityHistory.peakAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : 'joueurs'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <Card className="border-border/40">
                      <CardContent className="space-y-1 p-4">
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Connectés au moins une fois</p>
                        <p className="text-2xl font-semibold tabular-nums">{(activityHistory.insights?.uniqueConnectedUsers ?? 0).toLocaleString('fr-FR')}</p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/70')}>
                          Utilisateurs vus en snapshot ou en connexion sur la période
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-border/40">
                      <CardContent className="space-y-1 p-4">
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Jour le plus joué</p>
                        {activityHistory.insights?.busiestWeekday ? (
                          <>
                            <p className="text-2xl font-semibold capitalize">{activityHistory.insights.busiestWeekday.label}</p>
                            <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/70')}>
                              {activityHistory.insights.busiestWeekday.totalGames.toLocaleString('fr-FR')} parties loggées, {activityHistory.insights.busiestWeekday.uniquePlayers.toLocaleString('fr-FR')} joueur{activityHistory.insights.busiestWeekday.uniquePlayers > 1 ? 's' : ''} actifs
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">Pas encore assez de logs de jeu</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-border/40">
                      <CardContent className="space-y-1 p-4">
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Heures de pointe</p>
                        {(activityHistory.insights?.peakHours?.length ?? 0) > 0 ? (
                          <>
                            <p className="text-lg font-semibold">
                              {activityHistory.insights!.peakHours.map((entry) => entry.label).join(' • ')}
                            </p>
                            <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/70')}>
                              Moyenne de {activityHistory.insights!.peakHours[0]?.averageOnline.toLocaleString('fr-FR')} joueurs en ligne sur le créneau n°1
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">Pas encore assez de snapshots</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Chart + side panel */}
                  <div className="flex gap-4 items-start">
                    <div className="flex-1 min-w-0">
                      {(() => {
                        const MS_HOUR = 3600000;
                        const MS_DAY = 86400000;

                        // All periods use a numeric time axis for proportional spacing
                        const chartData: ActivityChartPoint[] = activityHistory.data.map(pt => ({ ...pt, ts: new Date(pt.timestamp).getTime() }));
                        activityChartDataRef.current = chartData;

                        // Compute full domain boundaries for this period
                        const now = new Date();
                        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                        let domainStart: number, domainEnd: number;
                        if (activityPeriod === 'specific' && activitySpecificDay) {
                          domainStart = new Date(activitySpecificDay + 'T00:00:00').getTime();
                          domainEnd = domainStart + MS_DAY;
                        } else if (activityPeriod === 'day') {
                          domainStart = todayMidnight;
                          domainEnd = todayMidnight + MS_DAY;
                        } else if (activityPeriod === 'week') {
                          domainStart = todayMidnight - 7 * MS_DAY;
                          domainEnd = todayMidnight + MS_DAY;
                        } else if (activityPeriod === 'month') {
                          domainStart = todayMidnight - 30 * MS_DAY;
                          domainEnd = todayMidnight + MS_DAY;
                        } else if (activityPeriod === 'custom' && activityCustomStart && activityCustomEnd) {
                          domainStart = new Date(activityCustomStart + 'T00:00:00').getTime();
                          domainEnd = new Date(activityCustomEnd + 'T00:00:00').getTime() + MS_DAY;
                        } else {
                          const times = chartData.map(pt => pt.ts);
                          domainStart = Math.min(...times);
                          domainEnd = Math.max(...times);
                        }

                        // Keep full domain in ref so the wheel handler can read it
                        activityFullDomainRef.current = [domainStart, domainEnd];

                        // Apply zoom if active
                        const [viewStart, viewEnd] = activityZoomDomain ?? [domainStart, domainEnd];
                        const viewRange = viewEnd - viewStart;
                        const isZoomed = viewRange < domainEnd - domainStart;

                        // Adaptive ticks and separator lines based on visible range
                        const getTicksAndLines = (start: number, end: number, range: number) => {
                          const alignedStart = (interval: number) => Math.ceil(start / interval) * interval;
                          const generate = (interval: number, from: number, to: number) => {
                            const out: number[] = [];
                            for (let t = from; t <= to; t += interval) out.push(t);
                            return out;
                          };
                          if (range <= 3 * MS_HOUR) {
                            const lines = generate(30 * 60000, alignedStart(30 * 60000), end);
                            return { ticks: lines, lines };
                          } else if (range <= 8 * MS_HOUR) {
                            const lines = generate(MS_HOUR, alignedStart(MS_HOUR), end);
                            return { ticks: lines, lines };
                          } else if (range <= 18 * MS_HOUR) {
                            const lines = generate(MS_HOUR, alignedStart(MS_HOUR), end);
                            const ticks = generate(2 * MS_HOUR, alignedStart(2 * MS_HOUR), end);
                            return { ticks, lines };
                          } else if (range <= MS_DAY * 1.5) {
                            const lines = generate(MS_HOUR, alignedStart(MS_HOUR), end);
                            const ticks = generate(3 * MS_HOUR, alignedStart(3 * MS_HOUR), end);
                            return { ticks, lines };
                          } else if (range <= 4 * MS_DAY) {
                            const lines = generate(MS_DAY, alignedStart(MS_DAY), end);
                            const ticks = generate(MS_DAY, alignedStart(MS_DAY), end);
                            return { ticks, lines };
                          } else if (range <= 10 * MS_DAY) {
                            const lines = generate(MS_DAY, alignedStart(MS_DAY), end);
                            const ticks = generate(2 * MS_DAY, alignedStart(2 * MS_DAY), end);
                            return { ticks, lines };
                          } else {
                            const lines = generate(MS_DAY, alignedStart(MS_DAY), end);
                            const ticks = generate(5 * MS_DAY, alignedStart(5 * MS_DAY), end);
                            return { ticks, lines };
                          }
                        };

                        const { ticks: xAxisTicks, lines: separatorLines } = getTicksAndLines(viewStart, viewEnd, viewRange);

                        const tickFormatter = (ts: number) => {
                          const d = new Date(ts);
                          if (viewRange <= MS_DAY * 1.5) {
                            const h = d.getHours(), m = d.getMinutes();
                            return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
                          }
                          if (viewRange <= 8 * MS_DAY) return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
                          return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                        };

                        return (
                          <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">
                              Molette pour zoomer, glisser pour dÃ©placer
                            </p>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => panActivityDomain(-viewRange * 0.25)}
                                disabled={!isZoomed}
                                aria-label="DÃ©placer vers la gauche"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => zoomActivityDomain(1 / 1.25)}
                                aria-label="Zoomer"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => zoomActivityDomain(1.25)}
                                aria-label="DÃ©zoomer"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => setActivityDomain(null)}
                                disabled={!isZoomed}
                              >
                                Reset
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => panActivityDomain(viewRange * 0.25)}
                                disabled={!isZoomed}
                                aria-label="DÃ©placer vers la droite"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div
                            ref={activityChartRef}
                            onPointerDown={handleActivityPointerDown}
                            onPointerMove={handleActivityPointerMove}
                            onPointerUp={handleActivityPointerEnd}
                            onPointerCancel={handleActivityPointerEnd}
                            onPointerLeave={handleActivityPointerLeave}
                            className={cn('touch-none select-none', isZoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer')}
                          >
                          <ResponsiveContainer width="100%" height={300}>
                            <AreaChart
                              data={chartData}
                              margin={{ top: 6, right: 4, left: -8, bottom: 0 }}
                              style={{ cursor: isZoomed ? 'grab' : 'pointer' }}
                            >
                              <defs>
                                <linearGradient id="strokeGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.95} />
                                  <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0.35} />
                                </linearGradient>
                                <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.12} />
                                  <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis
                                dataKey="ts"
                                type="number"
                                domain={[viewStart, viewEnd]}
                                allowDataOverflow
                                ticks={xAxisTicks}
                                tickFormatter={tickFormatter}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                interval={0}
                              />
                              <YAxis
                                allowDecimals={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                width={24}
                              />
                              {activityHistory.peak > 0 && (
                                <ReferenceLine
                                  y={activityHistory.peak}
                                  stroke="hsl(var(--muted-foreground))"
                                  strokeDasharray="5 4"
                                  strokeWidth={1}
                                  label={{ value: `↑ ${activityHistory.peak}`, fill: 'hsl(var(--muted-foreground))', fontSize: 10, position: 'insideTopRight', dy: -4 }}
                                />
                              )}
                              {separatorLines.map(ts => (
                                <ReferenceLine
                                  key={`sep-${ts}`}
                                  x={ts}
                                  stroke="hsl(var(--border))"
                                  strokeWidth={1.5}
                                />
                              ))}
                              {hoveredActivity && (
                                <>
                                  <ReferenceLine
                                    x={hoveredActivity.cursorTs}
                                    stroke="hsl(var(--foreground))"
                                    strokeDasharray="4 4"
                                    strokeWidth={1.25}
                                  />
                                  <ReferenceDot
                                    x={hoveredActivity.cursorTs}
                                    y={hoveredActivity.point.max}
                                    r={5}
                                    fill="hsl(var(--foreground))"
                                    stroke="hsl(var(--background))"
                                    strokeWidth={2}
                                  />
                                </>
                              )}
                              <Area
                                type="stepAfter"
                                dataKey="max"
                                stroke="url(#strokeGradient)"
                                strokeWidth={2.5}
                                fill="url(#activityGradient)"
                                dot={false}
                                activeDot={{ r: 4, fill: 'hsl(var(--foreground))', strokeWidth: 0 }}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                          </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* User list side panel — always visible */}
                    {(() => {
                      const displayPoint = hoveredActivity?.point ?? null;
                      const users = displayPoint?.usernames ?? [];
                      return (
                        <div className="w-44 shrink-0 border border-border/40 rounded-lg bg-muted/10 flex flex-col" style={{ height: 300 }}>
                          <div className="px-3 py-2 border-b border-border/40 shrink-0">
                            {displayPoint ? (
                              <>
                                <p className="text-xs font-medium tabular-nums">{displayPoint.max} joueur{displayPoint.max !== 1 ? 's' : ''}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(hoveredActivity!.cursorTs).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground/60">Survolez le graphe</p>
                            )}
                          </div>
                          <div className="overflow-y-auto flex-1 p-1.5">
                            {!displayPoint ? (
                              <p className="text-xs text-muted-foreground/40 text-center py-4">—</p>
                            ) : users.length === 0 ? (
                              <p className="text-xs text-muted-foreground/60 text-center py-4">Aucun joueur enregistré</p>
                            ) : (
                              <ul className="space-y-0.5">
                                {users.map(u => (
                                  <li key={u.userId} className="text-xs px-1.5 py-1 rounded hover:bg-muted/30 truncate" title={u.username}>
                                    {u.username}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/40 bg-muted/20">
                    <Activity className="h-6 w-6 opacity-40" />
                  </div>
                  <div className="text-center">
                    <p className={TYPOGRAPHY.SMALL}>Aucune donnée pour cette période</p>
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60 mt-0.5')}>Les snapshots sont enregistrés automatiquement</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="border-border/40">
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">Pages sur la journée</span>
                    </div>
                    <CardDescription>
                      Présence moyenne par page heure par heure.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={activityBreakdownDay}
                      onChange={(e) => setActivityBreakdownDay(e.target.value)}
                      className="h-8 w-auto text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => fetchActivityBreakdown(activityBreakdownDay)}
                      disabled={!activityBreakdownDay || loadingActivityBreakdown}
                    >
                      {loadingActivityBreakdown ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Appliquer'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingActivityBreakdown && !activityBreakdown ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : pageBreakdownKeys.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={pageBreakdownData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="hourLabel"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          interval={1}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={28}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.75rem',
                          }}
                          formatter={(value: number, name: string) => [
                            `${value} joueur${value > 1 ? 's' : ''}`,
                            getPageMetaForPath(name).title,
                          ]}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Legend
                          formatter={(value) => getPageMetaForPath(value).title}
                          wrapperStyle={{ fontSize: '12px' }}
                        />
                        {pageBreakdownKeys.map((page: string, index: number) => (
                          <Line
                            key={page}
                            type="monotone"
                            dataKey={page}
                            stroke={ACTIVITY_BREAKDOWN_COLORS[index % ACTIVITY_BREAKDOWN_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            name={page}
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {activityBreakdown?.topPages.map((entry, index) => (
                        <div key={entry.page} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-xs">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: ACTIVITY_BREAKDOWN_COLORS[index % ACTIVITY_BREAKDOWN_COLORS.length] }}
                            />
                            <span className="truncate">{getPageMetaForPath(entry.page).title}</span>
                          </div>
                          <span className="tabular-nums text-muted-foreground">{entry.total}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Pas encore assez de snapshots avec la page courante pour cette date.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Jeux par heure</span>
                </div>
                <CardDescription>
                  Nombre d’actions de jeu enregistrées par heure sur la date choisie.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingActivityBreakdown && !activityBreakdown ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : gameBreakdownKeys.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={gameBreakdownData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="hourLabel"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          interval={1}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={28}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.75rem',
                          }}
                          formatter={(value: number, name: string) => [
                            `${value} action${value > 1 ? 's' : ''}`,
                            GAME_TYPE_LABELS[name] ?? humanizeUiLabel(name),
                          ]}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Legend
                          formatter={(value) => GAME_TYPE_LABELS[value] ?? humanizeUiLabel(value)}
                          wrapperStyle={{ fontSize: '12px' }}
                        />
                        {gameBreakdownKeys.map((gameType: string, index: number) => (
                          <Bar
                            key={gameType}
                            dataKey={gameType}
                            stackId="games"
                            fill={ACTIVITY_BREAKDOWN_COLORS[index % ACTIVITY_BREAKDOWN_COLORS.length]}
                            radius={index === gameBreakdownKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                            isAnimationActive={false}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {activityBreakdown?.topGames.map((entry, index) => (
                        <div key={entry.gameType} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-xs">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: ACTIVITY_BREAKDOWN_COLORS[index % ACTIVITY_BREAKDOWN_COLORS.length] }}
                            />
                            <span className="truncate">{GAME_TYPE_LABELS[entry.gameType] ?? humanizeUiLabel(entry.gameType)}</span>
                          </div>
                          <span className="tabular-nums text-muted-foreground">{entry.total}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Aucun log de jeu disponible pour cette date.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Temps passé par jeu</span>
                </div>
                <CardDescription>
                  Durée cumulée des parties par heure (sur la date choisie).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingActivityBreakdown && !activityBreakdown ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : gameDurationBreakdownKeys.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={gameDurationBreakdownData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="hourLabel"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          interval={1}
                        />
                        <YAxis
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={44}
                          tickFormatter={(value: number) => `${Math.round(value / 60)}m`}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.75rem',
                          }}
                          formatter={(value: number, name: string) => [
                            formatDurationShort(value),
                            GAME_TYPE_LABELS[name] ?? humanizeUiLabel(name),
                          ]}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Legend
                          formatter={(value) => GAME_TYPE_LABELS[value] ?? humanizeUiLabel(value)}
                          wrapperStyle={{ fontSize: '12px' }}
                        />
                        {gameDurationBreakdownKeys.map((gameType: string, index: number) => (
                          <Bar
                            key={gameType}
                            dataKey={gameType}
                            stackId="durations"
                            fill={ACTIVITY_BREAKDOWN_COLORS[index % ACTIVITY_BREAKDOWN_COLORS.length]}
                            radius={index === gameDurationBreakdownKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                            isAnimationActive={false}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {activityBreakdown?.topGameDurations.map((entry, index) => (
                        <div key={entry.gameType} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-xs">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: ACTIVITY_BREAKDOWN_COLORS[index % ACTIVITY_BREAKDOWN_COLORS.length] }}
                            />
                            <span className="truncate">{GAME_TYPE_LABELS[entry.gameType] ?? humanizeUiLabel(entry.gameType)}</span>
                          </div>
                          <span className="tabular-nums text-muted-foreground">{formatDurationShort(entry.totalSeconds)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Aucune durée de partie exploitable pour cette date.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── PLAYTIME LEADERBOARD ── */}
          <Card className="border-border/40">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Classement temps de jeu</span>
                  </div>
                  <CardDescription>
                    Joueurs qui jouent le plus (en temps de jeu).
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(['day', 'week', 'month', 'custom'] as const).map(p => (
                    <Button
                      key={p}
                      variant={playtimePeriod === p ? 'default' : 'outline'}
                      onClick={() => {
                        setPlaytimePeriod(p);
                        if (p !== 'custom') fetchPlaytimeLeaderboard(p);
                      }}
                      className="h-8 px-3 text-xs"
                    >
                      {p === 'day' ? "Aujourd'hui" : p === 'week' ? '7j' : p === 'month' ? '30j' : 'Plage'}
                    </Button>
                  ))}
                </div>
              </div>

              {playtimePeriod === 'custom' && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    value={playtimeCustomStart}
                    onChange={(e) => setPlaytimeCustomStart(e.target.value)}
                    className="h-8 text-xs flex-1 min-w-max"
                    placeholder="Début"
                  />
                  <span className="text-xs text-muted-foreground">à</span>
                  <Input
                    type="date"
                    value={playtimeCustomEnd}
                    onChange={(e) => setPlaytimeCustomEnd(e.target.value)}
                    className="h-8 text-xs flex-1 min-w-max"
                    placeholder="Fin"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => fetchPlaytimeLeaderboard('custom', playtimeCustomStart, playtimeCustomEnd)}
                    disabled={!playtimeCustomStart || !playtimeCustomEnd || loadingPlaytimeLeaderboard}
                  >
                    {loadingPlaytimeLeaderboard ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Appliquer'}
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent>
              {loadingPlaytimeLeaderboard && !playtimeLeaderboard ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : playtimeLeaderboard && playtimeLeaderboard.leaderboard.length > 0 ? (
                <div className="space-y-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/40">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Rang</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Joueur</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Temps total</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Parties</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Moyenne/partie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playtimeLeaderboard.leaderboard.map((entry) => {
                          const totalHours = Math.floor(entry.totalSeconds / 3600);
                          const totalMinutes = Math.floor((entry.totalSeconds % 3600) / 60);
                          const avgSeconds = Math.floor(entry.averageGameDuration);
                          const avgMinutes = Math.floor(avgSeconds / 60);
                          const avgSecs = avgSeconds % 60;
                          return (
                            <tr key={entry.userId} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                              <td className="py-2 px-3 font-semibold text-foreground">{entry.rank}</td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  {entry.profilePicture ? (
                                    <img src={entry.profilePicture} alt="" className="h-5 w-5 rounded" />
                                  ) : (
                                    <div className="h-5 w-5 rounded bg-muted" />
                                  )}
                                  <span style={{ color: entry.usernameColor || 'inherit' }} className="truncate font-medium">
                                    {entry.username}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums">
                                {totalHours > 0 ? `${totalHours}h ${totalMinutes}min` : `${totalMinutes}min`}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                                {entry.gamesPlayed}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                                {avgMinutes}m {String(avgSecs).padStart(2, '0')}s
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {playtimeLeaderboard.totalEntries > playtimeLeaderboard.limit && (
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60 text-center mt-3')}>
                      Affichage des {playtimeLeaderboard.limit} premiers sur {playtimeLeaderboard.totalEntries} joueurs
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Aucune donnée de temps de jeu pour cette période
                </p>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        {/* ── BADGES TAB ─────────────────────────────────────────────────────── */}
        <TabsContent value="badges" className={SPACING.SECTION_SPACING}>
          <div className="space-y-6">

            {/* Custom badge requests */}
            <Card>
              <CardHeader>
                <CardDescription className="flex items-center gap-2">
                  Demandes de badges personnalisés
                  {customBadgeRequests.length > 0 && (
                    <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">{customBadgeRequests.length}</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className={SPACING.CARD_SPACING}>
                {customBadgeRequestsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : customBadgeRequests.length === 0 ? (
                  <p className={TYPOGRAPHY.MUTED}>Aucune demande en attente.</p>
                ) : (
                  <div className="space-y-3">
                    {customBadgeRequests.map((req) => (
                      <div key={req.id} className="flex items-start gap-3 p-3 rounded-md border border-yellow-500/20 bg-yellow-500/5">
                        <BadgeIcon
                          badge={{
                            id: req.id, name: req.name, description: req.description,
                            icon: req.icon, iconColor: '#ffffff',
                            backgroundColor: req.backgroundColor, backgroundType: 'solid',
                            borderColor: req.borderColor, rarity: req.rarity,
                            category: 'custom',
                          }}
                          size="md"
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{req.name}</span>
                            <span className="text-xs text-muted-foreground">par {req.user?.username}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                              req.rarity === 'legendary' ? 'border-yellow-500/40 text-yellow-400' :
                              req.rarity === 'epic' ? 'border-purple-500/40 text-purple-400' :
                              req.rarity === 'rare' ? 'border-blue-500/40 text-blue-400' :
                              req.rarity === 'uncommon' ? 'border-green-500/40 text-green-400' :
                              'border-border/40 text-muted-foreground'
                            }`}>{req.rarity}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{req.description}</p>
                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            <Input
                              className="h-7 text-xs max-w-[200px]"
                              placeholder="Note (optionnel)"
                              value={rejectNotes[req.id] ?? ''}
                              onChange={(e) => setRejectNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                            />
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleApproveCustomBadge(req.id)}>
                              <Check className="w-3 h-3 mr-1" />
                              Approuver
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleRejectCustomBadge(req.id)}>
                              <X className="w-3 h-3 mr-1" />
                              Refuser
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Header actions */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className={TYPOGRAPHY.H3}>Gestion des Badges</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCheckAutoBadges}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Vérifier auto-badges
                </Button>
                <Button size="sm" onClick={openCreateBadge}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau badge
                </Button>
              </div>
            </div>

            {/* Badge list */}
            <Card>
              <CardHeader>
                <CardDescription>Tous les badges ({badges.length})</CardDescription>
              </CardHeader>
              <CardContent className={SPACING.CARD_SPACING}>
                {badgesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : badges.length === 0 ? (
                  <p className={TYPOGRAPHY.MUTED}>Aucun badge. Clique sur "Nouveau badge" pour en créer un.</p>
                ) : (
                  <div className="space-y-2">
                    {badges.map((badge) => (
                      <div key={badge.id} className="flex items-center gap-3 p-3 rounded-md border border-border/40 hover:bg-muted/30">
                        <BadgeIcon badge={badge} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{badge.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                              badge.rarity === 'legendary' ? 'border-yellow-500/40 text-yellow-400' :
                              badge.rarity === 'epic' ? 'border-purple-500/40 text-purple-400' :
                              badge.rarity === 'rare' ? 'border-blue-500/40 text-blue-400' :
                              badge.rarity === 'uncommon' ? 'border-green-500/40 text-green-400' :
                              'border-border/40 text-muted-foreground'
                            }`}>{badge.rarity}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border/40 text-muted-foreground">{badge.category}</span>
                            {badge.isAutomatic && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border/40 text-muted-foreground">
                                auto: {badge.autoConditionKey}
                              </span>
                            )}
                            {!badge.isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30">inactif</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{badge.description}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditBadge(badge)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer le badge</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Supprimer le badge "{badge.name}" ? Cette action est irréversible et retirera le badge de tous les utilisateurs.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteBadge(badge.id)} className="bg-destructive hover:bg-destructive/90">
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Award badge to user */}
            <Card>
              <CardHeader>
                <CardDescription>Attribuer un badge à un utilisateur</CardDescription>
              </CardHeader>
              <CardContent className={SPACING.CARD_SPACING}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className={TYPOGRAPHY.XS}>ID utilisateur</label>
                    <Input
                      placeholder="user-id ou username"
                      value={awardBadgeUserId}
                      onChange={(e) => setAwardBadgeUserId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={TYPOGRAPHY.XS}>Badge</label>
                    <Select value={awardBadgeId} onValueChange={setAwardBadgeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un badge..." />
                      </SelectTrigger>
                      <SelectContent>
                        {badges.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            <div className="flex items-center gap-2">
                              <BadgeIcon badge={b} size="xs" />
                              <span>{b.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className={TYPOGRAPHY.XS}>Raison (optionnel)</label>
                    <Input
                      placeholder="Raison de l'attribution..."
                      value={awardBadgeReason}
                      onChange={(e) => setAwardBadgeReason(e.target.value)}
                    />
                  </div>
                </div>
                <Button className="mt-3" onClick={handleAwardBadge} disabled={!awardBadgeUserId || !awardBadgeId}>
                  <Award className="w-4 h-4 mr-2" />
                  Attribuer
                </Button>
              </CardContent>
            </Card>

            {/* Badge create/edit dialog */}
            <Dialog open={badgeFormOpen} onOpenChange={setBadgeFormOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingBadge ? 'Modifier le badge' : 'Nouveau badge'}</DialogTitle>
                  <DialogDescription>
                    Personnalise l&apos;apparence et les propriétés du badge.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                  {/* Preview + Basic Info */}
                  <div className="flex gap-4 items-start p-4 rounded-lg bg-muted/20 border border-border/40">
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <BadgeIcon badge={{
                        id: 'preview',
                        name: badgeForm.name || 'Aperçu',
                        description: badgeForm.description || '',
                        backgroundType: badgeForm.backgroundType || 'solid',
                        backgroundColor: badgeForm.backgroundColor || '#374151',
                        backgroundGradient: badgeForm.backgroundGradient || null,
                        backgroundImage: badgeForm.backgroundImage || null,
                        icon: badgeForm.icon || '⭐',
                        iconColor: badgeForm.iconColor || '#ffffff',
                        borderColor: badgeForm.borderColor || '#6b7280',
                        category: badgeForm.category || 'special',
                        rarity: badgeForm.rarity || 'common',
                      }} size="lg" />
                      <p className="text-[11px] text-muted-foreground text-center w-20 truncate">{badgeForm.name || 'Aperçu'}</p>
                    </div>
                    <div className="flex-1 space-y-2.5 min-w-0">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1 min-w-0">
                          <label className={TYPOGRAPHY.XS}>Nom *</label>
                          <Input value={badgeForm.name ?? ''} onChange={(e) => setBadgeForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <label className={TYPOGRAPHY.XS}>Icône</label>
                          <Input value={badgeForm.icon ?? '⭐'} onChange={(e) => setBadgeForm(f => ({ ...f, icon: e.target.value }))} maxLength={4} className="w-16 text-center text-lg" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className={TYPOGRAPHY.XS}>Description *</label>
                        <Textarea value={badgeForm.description ?? ''} onChange={(e) => setBadgeForm(f => ({ ...f, description: e.target.value }))} rows={2} />
                      </div>
                      <div className="space-y-1">
                        <label className={TYPOGRAPHY.XS}>Comment l&apos;obtenir</label>
                        <Input value={badgeForm.howToObtain ?? ''} onChange={(e) => setBadgeForm(f => ({ ...f, howToObtain: e.target.value }))} placeholder="Ex: Être dans le top 5 de l'aura" />
                      </div>
                    </div>
                  </div>

                  {/* Apparence */}
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Apparence</p>

                    {/* Background type */}
                    <div className="space-y-2.5">
                      <div className="flex gap-2">
                        {(['solid', 'gradient', 'image'] as const).map((t) => (
                          <Button key={t} variant={badgeForm.backgroundType === t ? 'default' : 'outline'} size="sm"
                            onClick={() => setBadgeForm(f => ({ ...f, backgroundType: t }))}>
                            {t === 'solid' ? 'Couleur unie' : t === 'gradient' ? 'Dégradé' : 'Image'}
                          </Button>
                        ))}
                      </div>

                      {badgeForm.backgroundType === 'solid' && (
                        <div className="space-y-1">
                          <label className={TYPOGRAPHY.XS}>Couleur de fond</label>
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer shrink-0">
                              <div className="h-9 w-9 rounded-md border border-border shadow-sm transition-transform hover:scale-105" style={{ backgroundColor: badgeForm.backgroundColor ?? '#374151' }} />
                              <input type="color" value={badgeForm.backgroundColor ?? '#374151'} onChange={(e) => setBadgeForm(f => ({ ...f, backgroundColor: e.target.value }))} className="sr-only" />
                            </label>
                            <Input value={badgeForm.backgroundColor ?? '#374151'} onChange={(e) => setBadgeForm(f => ({ ...f, backgroundColor: e.target.value }))} className="flex-1 font-mono" placeholder="#374151" />
                          </div>
                        </div>
                      )}

                      {badgeForm.backgroundType === 'gradient' && (() => {
                        const _g = (() => { try { return JSON.parse(badgeForm.backgroundGradient ?? '{}'); } catch { return {}; } })();
                        const gradFrom = (_g.from as string) ?? '#374151';
                        const gradTo = (_g.to as string) ?? '#6b7280';
                        const gradDir = (_g.direction as string) ?? 'to bottom right';
                        const setGrad = (field: string, val: string) => {
                          const cur = (() => { try { return JSON.parse(badgeForm.backgroundGradient ?? '{}'); } catch { return {}; } })();
                          setBadgeForm(f => ({ ...f, backgroundGradient: JSON.stringify({ ...cur, [field]: val }) }));
                        };
                        return (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2 items-end">
                              <div className="space-y-1">
                                <label className={TYPOGRAPHY.XS}>Depuis</label>
                                <div className="flex items-center gap-1.5">
                                  <label className="cursor-pointer shrink-0">
                                    <div className="h-8 w-8 rounded-md border border-border shadow-sm transition-transform hover:scale-105" style={{ backgroundColor: gradFrom }} />
                                    <input type="color" value={gradFrom} onChange={(e) => setGrad('from', e.target.value)} className="sr-only" />
                                  </label>
                                  <Input value={gradFrom} onChange={(e) => setGrad('from', e.target.value)} className="font-mono text-xs min-w-0" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className={TYPOGRAPHY.XS}>Vers</label>
                                <div className="flex items-center gap-1.5">
                                  <label className="cursor-pointer shrink-0">
                                    <div className="h-8 w-8 rounded-md border border-border shadow-sm transition-transform hover:scale-105" style={{ backgroundColor: gradTo }} />
                                    <input type="color" value={gradTo} onChange={(e) => setGrad('to', e.target.value)} className="sr-only" />
                                  </label>
                                  <Input value={gradTo} onChange={(e) => setGrad('to', e.target.value)} className="font-mono text-xs min-w-0" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className={TYPOGRAPHY.XS}>Direction</label>
                                <Select value={gradDir} onValueChange={(v) => setGrad('direction', v)}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="to right">→ Droite</SelectItem>
                                    <SelectItem value="to left">← Gauche</SelectItem>
                                    <SelectItem value="to bottom">↓ Bas</SelectItem>
                                    <SelectItem value="to top">↑ Haut</SelectItem>
                                    <SelectItem value="to bottom right">↘ Bas droite</SelectItem>
                                    <SelectItem value="to bottom left">↙ Bas gauche</SelectItem>
                                    <SelectItem value="to top right">↗ Haut droite</SelectItem>
                                    <SelectItem value="to top left">↖ Haut gauche</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="h-6 rounded-md border border-border/40" style={{ background: `linear-gradient(${gradDir}, ${gradFrom}, ${gradTo})` }} />
                          </div>
                        );
                      })()}

                      {badgeForm.backgroundType === 'image' && (
                        <ImagePicker
                          value={badgeForm.backgroundImage ?? ''}
                          onChange={(url) => setBadgeForm(f => ({ ...f, backgroundImage: url }))}
                          uploadFn={uploadItemImageFile}
                          placeholder="URL de l'image de fond..."
                        />
                      )}
                    </div>

                    {/* Icon + Border colors */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className={TYPOGRAPHY.XS}>Couleur de l&apos;icône</label>
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer shrink-0">
                            <div className="h-9 w-9 rounded-md border border-border shadow-sm transition-transform hover:scale-105" style={{ backgroundColor: badgeForm.iconColor ?? '#ffffff' }} />
                            <input type="color" value={badgeForm.iconColor ?? '#ffffff'} onChange={(e) => setBadgeForm(f => ({ ...f, iconColor: e.target.value }))} className="sr-only" />
                          </label>
                          <Input value={badgeForm.iconColor ?? '#ffffff'} onChange={(e) => setBadgeForm(f => ({ ...f, iconColor: e.target.value }))} className="flex-1 font-mono" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className={TYPOGRAPHY.XS}>Couleur de bordure</label>
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer shrink-0">
                            <div className="h-9 w-9 rounded-md border border-border shadow-sm transition-transform hover:scale-105" style={{ backgroundColor: badgeForm.borderColor ?? '#6b7280' }} />
                            <input type="color" value={badgeForm.borderColor ?? '#6b7280'} onChange={(e) => setBadgeForm(f => ({ ...f, borderColor: e.target.value }))} className="sr-only" />
                          </label>
                          <Input value={badgeForm.borderColor ?? '#6b7280'} onChange={(e) => setBadgeForm(f => ({ ...f, borderColor: e.target.value }))} className="flex-1 font-mono" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Paramètres */}
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Paramètres</p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className={TYPOGRAPHY.XS}>Catégorie</label>
                        <Select value={badgeForm.category ?? 'special'} onValueChange={(v) => setBadgeForm(f => ({ ...f, category: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="leaderboard">Classement</SelectItem>
                            <SelectItem value="achievement">Succès</SelectItem>
                            <SelectItem value="special">Spécial</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className={TYPOGRAPHY.XS}>Rareté</label>
                        <Select value={badgeForm.rarity ?? 'common'} onValueChange={(v) => setBadgeForm(f => ({ ...f, rarity: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="common">Commun</SelectItem>
                            <SelectItem value="uncommon">Peu commun</SelectItem>
                            <SelectItem value="rare">Rare</SelectItem>
                            <SelectItem value="epic">Épique</SelectItem>
                            <SelectItem value="legendary">Légendaire</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Auto condition */}
                    {editingBadge?.isAutomatic ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 border border-border/40 text-xs text-muted-foreground">
                        <Sparkles className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                        <span>Badge automatique — condition&nbsp;: <span className="font-mono text-foreground">{editingBadge.autoConditionKey}</span></span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={badgeForm.isAutomatic ?? false}
                            onCheckedChange={(v) => setBadgeForm(f => ({ ...f, isAutomatic: v }))}
                          />
                          <label className={TYPOGRAPHY.XS}>Attribution automatique</label>
                        </div>
                        {badgeForm.isAutomatic && (
                          <div className="space-y-1">
                            <label className={TYPOGRAPHY.XS}>Condition</label>
                            <Select value={badgeForm.autoConditionKey ?? ''} onValueChange={(v) => setBadgeForm(f => ({ ...f, autoConditionKey: v }))}>
                              <SelectTrigger><SelectValue placeholder="Choisir une condition..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TOP_1_AURA">Top 1 Aura</SelectItem>
                                <SelectItem value="TOP_3_AURA">Top 3 Aura</SelectItem>
                                <SelectItem value="TOP_5_AURA">Top 5 Aura</SelectItem>
                                <SelectItem value="TOP_10_AURA">Top 10 Aura</SelectItem>
                                <SelectItem value="TOP_1_MONEY">Top 1 Argent</SelectItem>
                                <SelectItem value="TOP_3_MONEY">Top 3 Argent</SelectItem>
                                <SelectItem value="TOP_5_MONEY">Top 5 Argent</SelectItem>
                                <SelectItem value="TOP_10_MONEY">Top 10 Argent</SelectItem>
                                <SelectItem value="GAME_HIGHSCORE_doodle_jump">🦘 Champion Doodle Jump</SelectItem>
                                <SelectItem value="GAME_HIGHSCORE_doodle_jump_mort_subite">💀 Champion Doodle Jump Mort Subite</SelectItem>
                                <SelectItem value="GAME_HIGHSCORE_flappy_bird">🐦 Champion Flappy Bird</SelectItem>
                                <SelectItem value="GAME_HIGHSCORE_game_2048">🔢 Champion 2048</SelectItem>
                                <SelectItem value="GAME_HIGHSCORE_geometry_dash">📐 Champion Geometry Dash</SelectItem>
                                <SelectItem value="GAME_HIGHSCORE_solitaire">🃏 Champion Solitaire</SelectItem>
                                <SelectItem value="GAME_HIGHSCORE_racer">🏎️ Champion Racer (meilleur temps)</SelectItem>
                                <SelectItem value="GAME_HIGHSCORE_tetris">🧱 Champion Tetris</SelectItem>
                                <SelectItem value="GAME_HIGHSCORE_knife_hit">🔪 Champion Knife Hit</SelectItem>
                                <SelectItem value="GAME_HIGHSCORE_goyave_empire">🌿 Champion Goyave Empire</SelectItem>
                                <SelectItem value="GAME_HIGHSCORE_logic_lab">🧠 Champion Logic Lab</SelectItem>
                                <SelectItem value="GAME_HIGHSCORE_minesweeper">💣 Champion Démineur</SelectItem>
                                <SelectItem value="GAME_HIGHSCORE_casino">🎰 Champion Casino</SelectItem>
                                <SelectItem value="BOMBPARTY_TOP_WINS">💥 Champion Bombe de mots (victoires)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <Switch
                        checked={badgeForm.isActive ?? true}
                        onCheckedChange={(v) => setBadgeForm(f => ({ ...f, isActive: v }))}
                      />
                      <label className={TYPOGRAPHY.XS}>Badge actif (visible et attribuable)</label>
                    </div>

                    <div className="flex items-center gap-3">
                      <Switch
                        checked={badgeForm.isHidden ?? false}
                        onCheckedChange={(v) => setBadgeForm(f => ({ ...f, isHidden: v }))}
                      />
                      <label className={TYPOGRAPHY.XS}>Achievement caché — s'affiche comme ??? sur les profils avant d'être obtenu</label>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setBadgeFormOpen(false)}>Annuler</Button>
                  <Button onClick={handleSaveBadge} disabled={!badgeForm.name || !badgeForm.description}>
                    <Save className="w-4 h-4 mr-2" />
                    {editingBadge ? 'Mettre à jour' : 'Créer'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>
        </TabsContent>

        {/* ── SUPPORT TAB ──────────────────────────────────────────────────────── */}
        <TabsContent value="support" className={SPACING.SECTION_SPACING}>
          {/* New thread dialog */}
          <Dialog open={newThreadOpen} onOpenChange={(o) => { setNewThreadOpen(o); if (!o) { setNewThreadUserId(''); setNewThreadBody(''); setNewThreadSearch(''); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvelle conversation</DialogTitle>
                <DialogDescription>Envoie un premier message à un utilisateur.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Utilisateur</label>
                  <Input
                    placeholder="Rechercher un utilisateur…"
                    value={newThreadSearch}
                    onChange={(e) => { setNewThreadSearch(e.target.value); setNewThreadUserId(''); }}
                    className="mb-2"
                  />
                  {newThreadSearch.trim() && (
                    <div className="border border-border rounded-md max-h-40 overflow-y-auto">
                      {users
                        .filter((u) => u.username.toLowerCase().includes(newThreadSearch.toLowerCase()))
                        .slice(0, 10)
                        .map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            className={cn('w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors', newThreadUserId === u.id && 'bg-muted font-medium')}
                            onClick={() => { setNewThreadUserId(u.id); setNewThreadSearch(u.username); }}
                          >
                            {u.username}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Message</label>
                  <Textarea
                    value={newThreadBody}
                    onChange={(e) => setNewThreadBody(e.target.value)}
                    placeholder="Votre message…"
                    rows={3}
                    maxLength={1000}
                    className="resize-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewThreadOpen(false)}>Annuler</Button>
                <Button disabled={!newThreadUserId || !newThreadBody.trim() || newThreadSending} onClick={handleStartThread}>
                  {newThreadSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Envoyer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="flex gap-4 h-[600px]">
            {/* Thread list */}
            <div className="w-72 shrink-0 flex flex-col border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
                <h3 className={TYPOGRAPHY.H4}>Conversations</h3>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Nouvelle conversation" onClick={() => setNewThreadOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchSupportThreads}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {supportThreadsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : supportThreads.length === 0 ? (
                  <p className={cn(TYPOGRAPHY.MUTED, 'p-4 text-center')}>Aucune conversation.</p>
                ) : (
                  supportThreads.map((thread) => (
                    <button
                      key={thread.userId}
                      type="button"
                      onClick={() => openSupportThread(thread.userId)}
                      className={cn(
                        'w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/40 transition-colors',
                        activeThreadUserId === thread.userId && 'bg-muted'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">
                          {thread.user?.username ?? thread.userId}
                        </span>
                        {thread.unreadCount > 0 && (
                          <span className="inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-semibold shrink-0">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {thread.lastFromAdmin ? '↩ ' : ''}{thread.lastBody}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Thread view */}
            <div className="flex-1 flex flex-col border border-border rounded-lg overflow-hidden">
              {!activeThreadUserId ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  Sélectionne une conversation.
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-border bg-muted/40">
                    <h3 className={TYPOGRAPHY.H4}>{activeThreadUser?.username ?? activeThreadUserId}</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                    {activeThreadMessages.map((msg) => (
                      <div key={msg.id} className={cn('flex', msg.fromAdmin ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                          msg.fromAdmin
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-muted text-foreground rounded-tl-sm'
                        )}>
                          {!msg.fromAdmin && (
                            <p className="text-[10px] font-semibold text-primary mb-0.5">{activeThreadUser?.username}</p>
                          )}
                          <p className="break-words whitespace-pre-wrap">{msg.body}</p>
                          <p className={cn('text-[10px] mt-1', msg.fromAdmin ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                            {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={supportMessagesEndRef} />
                  </div>
                  <div className="border-t border-border p-3 flex gap-2 items-end">
                    <Textarea
                      value={supportReply}
                      onChange={(e) => setSupportReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSupportReply(); }
                      }}
                      placeholder="Répondre…"
                      className="resize-none text-sm min-h-[36px] max-h-24 py-2"
                      rows={1}
                      maxLength={1000}
                    />
                    <Button
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      disabled={!supportReply.trim() || supportSending}
                      onClick={handleSupportReply}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        </Tabs>
      </div>
    </PageShell>

    </>
  );
}

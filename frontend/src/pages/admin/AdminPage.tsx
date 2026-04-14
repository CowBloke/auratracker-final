import { useEffect, useState, useRef, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { adminApi, leaderboardsApi, AdminUser, ShopItem, ShopCategory, BugReport, PendingUser, AdminInventoryItem, Ban, ActivityLog, LogStats, AdminUpdatePopup, BanAppeal, NameChangeRequest, AdminClan, AdminClanEvent, RegistrationReview, AdminWarning, badgesApi, Badge, AdminActivityBreakdown, OnlineHistoryInsights, supportApi, SupportThread, SupportMessage, MessagingReport, customBadgesApi, CustomBadgeRequest, TaxBracket, ShopItemExchangeFile, uploadUserImage, youApi, sanctionsApi, type FiscalUser, type FiscalInspectorSettings, type PendingSanction, type PendingFormationReviewItem, type PendingAdReview } from '../../services/api';
import { useSocketBase } from '@/contexts/SocketContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { prepareImageUploadPayload } from '@/lib/image-upload';
import { Loader2, Trash2, Save, AlertTriangle, Plus, Minus, Package, Edit2, X, Ban as BanIcon, ChevronLeft, ChevronRight, ChevronDown, LogIn, MessageCircle, Gamepad2, Coins, Users, Store, Shield, Gavel, Lightbulb, TrendingUp, Download, Sparkles, Eye, Activity, Trophy, CalendarRange, RefreshCw, UserCog, Send, Upload, Award, Terminal, Landmark, Wallet, Inbox, Settings, BarChart2, Briefcase } from 'lucide-react';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
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
import {
  ADMIN_ARCHIVED_REGISTRATIONS_STORAGE_KEY,
  ADMIN_TABS,
  ANNOUNCEMENT_MAX_LENGTH,
  CHAT_BLOCK_MESSAGE_MAX_LENGTH,
  CHAT_BLOCK_TIMEZONE,
  isValidChatTimeValue,
  ROLE_LABELS,
  type AdminTab,
  type AdminRole,
  YOU_LOGO_ADMIN_ONLY_SETTING_KEY,
} from './constants';
import { InboxTab } from './tabs/InboxTab';
import { BansTab } from './tabs/BansTab';
import { BraquageLegalTab } from './tabs/BraquageLegalTab';
import { ClubsTab } from './tabs/ClubsTab';
import { LogsTab } from './tabs/LogsTab';
import { TaxesTab } from './tabs/TaxesTab';
import { UsersTab } from './tabs/UsersTab';
import SanctionModal from '@/components/sanctions/SanctionModal';

const TaxesTabComponent = TaxesTab;

// Effect types for items
const EFFECT_TYPES = [
  { value: 'USERNAME_COLOR', label: 'Couleur de pseudo', description: 'Permet de choisir une couleur pour le pseudo dans le chat' },
  { value: 'PROFILE_PICTURE', label: 'Photo de profil', description: 'Permet de téléverser une photo affichée dans le chat' },
  { value: 'PROFILE_BANNER', label: 'Bannière de profil', description: 'Permet de téléverser une bannière affichée en haut du profil' },
  { value: 'BONUS_AURA', label: 'Bonus Aura', description: 'Donne un bonus d\'aura à l\'utilisation' },
  { value: 'BONUS_MONEY', label: 'Bonus Argent', description: 'Donne un bonus d\'argent à l\'utilisation' },
  { value: 'DOODLE_JUMP_SKIN', label: 'Apparence Doodle Jump', description: 'Débloque une apparence personnalisée dans Doodle Jump (sélectionner une image pour l’apparence)' },
  { value: 'CLAN_TAG_UNLOCK', label: 'Tag de clan', description: 'Débloque le tag de clan pour le clan du membre acheteur. Un clan ne peut l\'acheter qu\'une fois.' },
  { value: 'CLAN_SLOT_UPGRADE', label: '+1 Slot clan', description: 'Ajoute un slot membre supplémentaire au clan. Le clan peut l\'acheter jusqu\'à deux fois, pour monter jusqu\'à 7 membres. S\'applique automatiquement à l\'achat.' },
  { value: 'CLAN_GAME_MONEY_BOOST', label: 'Boost gains clan', description: 'Objet de clan: active un boost en % sur l\'argent gagné en jeu pour tous les membres du clan.' },
  { value: 'CLAN_PROFILE_PICTURE', label: 'Photo de profil de clan', description: 'Objet de clan: acheté avec la banque du clan, puis le chef téléverse une image pour l\'utiliser comme emblème du clan.' },
  { value: 'CLAN_BANNER', label: 'Bannière de clan', description: 'Objet de clan: acheté avec la banque du clan, puis le chef téléverse une image pour l\'afficher en haut de la page clan.' },
  { value: 'AWARD_BADGE', label: 'Badge', description: 'Donne un badge spécifique au joueur lors de l\'utilisation. L\'image boutique est générée automatiquement.' },
  { value: 'CUSTOM_BADGE', label: 'Badge personnalisé', description: 'Permet au joueur de concevoir son propre badge. La demande est envoyée aux admins pour validation. Remboursement automatique si refusée.' },
  { value: 'YOU_ADBLOCK', label: 'Adblock You (temporaire)', description: 'Masque les interfaces publicitaires dans la page You pendant une durée configurable.' },
];

const EFFECT_TYPES_WITHOUT_VALUE = new Set([
  'USERNAME_COLOR',
  'PROFILE_PICTURE',
  'PROFILE_BANNER',
  'CLAN_TAG_UNLOCK',
  'CLAN_SLOT_UPGRADE',
  'CLAN_PROFILE_PICTURE',
  'CLAN_BANNER',
  'AWARD_BADGE',
  'CUSTOM_BADGE',
  'YOU_ADBLOCK',
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

type EditableTaxBracket = {
  id: string;
  threshold: string;
  rate: string;
};

const DEFAULT_TAX_BRACKET: EditableTaxBracket = {
  id: 'default-tax-bracket',
  threshold: '10000',
  rate: '1',
};

type ClanEventQuestForm = {
  title: string;
  description: string;
  activityType: string;
  targetValue: number;
  pointsReward: number;
  sortOrder: number;
  isActive: boolean;
};

type ClanEventMiniGameForm = {
  title: string;
  description: string;
  type: 'REFLEX' | 'TAP_FRENZY';
  instructions: string;
  scoreMultiplier: number;
  flatPointsBonus: number;
  maxPointsPerAttempt: number;
  maxAttemptsPerUser: number | null;
  cooldownMinutes: number;
  sortOrder: number;
  isActive: boolean;
  config: string;
};

type ClanEventRewardTierForm = {
  title: string;
  minRank: number;
  maxRank: number;
  moneyReward: number;
  auraReward: number;
  itemId: string;
};

type ClanEventForm = {
  title: string;
  description: string;
  bannerUrl: string;
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  highlightColor: string;
  rulesSummary: string;
  startsAt: string;
  endsAt: string;
  quests: ClanEventQuestForm[];
  miniGames: ClanEventMiniGameForm[];
  rewardTiers: ClanEventRewardTierForm[];
};

const DEFAULT_CLAN_EVENT_FORM: ClanEventForm = {
  title: '',
  description: '',
  bannerUrl: '',
  status: 'SCHEDULED',
  highlightColor: '#f59e0b',
  rulesSummary: '',
  startsAt: '',
  endsAt: '',
  quests: [
    { title: 'Jouer 10 parties', description: 'Toutes les parties terminées comptent.', activityType: 'PLAY_ANY_GAME', targetValue: 10, pointsReward: 40, sortOrder: 0, isActive: true },
  ],
  miniGames: [
    { title: 'Réflexe éclair', description: 'Clique dès que le signal apparaît.', type: 'REFLEX', instructions: 'Attends le signal vert, puis clique le plus vite possible.', scoreMultiplier: 0.5, flatPointsBonus: 0, maxPointsPerAttempt: 120, maxAttemptsPerUser: 5, cooldownMinutes: 15, sortOrder: 0, isActive: true, config: '{"minDelayMs":1200,"maxDelayMs":2800}' },
  ],
  rewardTiers: [
    { title: 'Top 1', minRank: 1, maxRank: 1, moneyReward: 1500, auraReward: 80, itemId: '' },
    { title: 'Top 2-3', minRank: 2, maxRank: 3, moneyReward: 900, auraReward: 45, itemId: '' },
  ],
};

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

const mapClanEventToForm = (event: AdminClanEvent): ClanEventForm => ({
  title: event.title,
  description: event.description || '',
  bannerUrl: event.bannerUrl || '',
  status: event.storedStatus,
  highlightColor: event.highlightColor || '#f59e0b',
  rulesSummary: event.rulesSummary || '',
  startsAt: toDateTimeLocalValue(event.startsAt),
  endsAt: toDateTimeLocalValue(event.endsAt),
  quests: event.quests.map((quest) => ({
    title: quest.title,
    description: quest.description || '',
    activityType: quest.activityType,
    targetValue: quest.targetValue,
    pointsReward: quest.pointsReward,
    sortOrder: quest.sortOrder,
    isActive: quest.isActive,
  })),
  miniGames: event.miniGames.map((miniGame) => ({
    title: miniGame.title,
    description: miniGame.description || '',
    type: miniGame.type,
    instructions: miniGame.instructions || '',
    scoreMultiplier: miniGame.scoreMultiplier,
    flatPointsBonus: miniGame.flatPointsBonus,
    maxPointsPerAttempt: miniGame.maxPointsPerAttempt,
    maxAttemptsPerUser: miniGame.maxAttemptsPerUser,
    cooldownMinutes: miniGame.cooldownMinutes,
    sortOrder: miniGame.sortOrder,
    isActive: miniGame.isActive,
    config: miniGame.config ? JSON.stringify(miniGame.config) : '',
  })),
  rewardTiers: event.rewardTiers.map((tier) => ({
    title: tier.title,
    minRank: tier.minRank,
    maxRank: tier.maxRank,
    moneyReward: tier.moneyReward,
    auraReward: tier.auraReward,
    itemId: tier.itemId || '',
  })),
});

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

const getAdminRole = (user: Pick<AdminUser, 'isAdmin' | 'isSuperAdmin' | 'isBetaTester' | 'isFiscalInspector' | 'isJudge'>): AdminRole => {
  if (user.isSuperAdmin) return 'SUPER_ADMIN';
  if (user.isAdmin) return 'ADMIN';
  if (user.isBetaTester) return 'BETA_TESTER';
  if (user.isFiscalInspector) return 'FISCAL_INSPECTOR';
  if (user.isJudge) return 'JUDGE';
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
  BUSINESS: { label: 'Business', color: 'text-emerald-400', bgColor: 'bg-emerald-600', borderColor: 'border-emerald-600', icon: Briefcase },
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
  reward_fallback: 'Récompense de secours',
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
  item_import: 'Objets importés',
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
  chat_export: 'Chat exporté',
  stats_delete: 'Stats supprimées',
  business_create: 'Entreprise créée',
  business_delete: 'Entreprise supprimée',
  business_invite: 'Invitation business envoyée',
  business_loan_request: 'Demande de prêt business',
  business_loan_decision: 'Décision prêt business',
  business_loan_repay: 'Prêt business remboursé',
  business_deposit: 'Dépôt business',
  business_withdraw: 'Retrait business',
  business_invest: 'Investissement business',
  business_transfer: 'Transfert business',
  business_transfer_fee_update: 'Frais de transfert modifiés',
  business_buyout_offer_create: 'Offre de rachat créée',
  business_buyout_offer_respond: 'Offre de rachat traitée',
  business_buyout_offer_cancel: 'Offre de rachat annulée',
  business_research_start: 'Recherche business lancée',
  business_share_proposal_cancel: 'Proposition actionnaire annulée',
  business_product_deploy: 'Produit startup déployé',
  business_collect: 'Recette business collectée',
  business_sale: 'Vente business enregistrée',
  business_profile_update: 'Profil business modifié',
  business_invitation_respond: 'Invitation business traitée',
  business_member_sack: 'Membre business renvoyé',
  business_member_salary_update: 'Salaire business modifié',
  business_formation_product_buy: 'Produit formation acheté',
  business_rate: 'Business noté',
  bank_upgrade_purchase: 'Upgrade bancaire acheté',
  bank_rate_update: 'Taux bancaire modifié',
  bank_account_open: 'Compte bancaire ouvert',
  bank_account_deposit: 'Dépôt bancaire',
  bank_account_withdraw: 'Retrait bancaire',
  formation_update: 'Formation modifiée',
  formation_purchase: 'Formation achetée',
  formation_product_create: 'Produit formation créé',
  formation_product_update: 'Produit formation modifié',
  formation_product_delete: 'Produit formation supprimé',
  relationship_create: 'Relation créée',
  relationship_forget: 'Relation supprimée',
  relationship_reactivate: 'Relation relancée',
  marriage_proposal: 'Demande en mariage',
  marriage_response: 'Réponse mariage',
  divorce_proposal: 'Demande de divorce',
  divorce_response: 'Réponse divorce',
  relationship_force_divorce: 'Divorce forcé',
  relationship_mistress: 'Liaison créée',
  relationship_cheating_report: 'Soupçon de tricherie',
  relationship_court_case: 'Décision tribunal',
  couple_deposit: 'Dépôt compte commun',
  couple_withdraw: 'Retrait compte commun',
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
  subway_surfers: 'Subway Surfers Clone',
  hexgl: 'HexGL',
  opengd: 'OpenGD',
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

// Game type filters
const GAME_TYPES = [
  { value: 'doodle_jump', label: 'Doodle Jump' },
  { value: 'doodle_jump_mort_subite', label: 'Doodle Jump (Mort Subite)' },
  { value: 'game_2048', label: '2048' },
  { value: 'flappy_bird', label: 'Flappy Bird' },
  { value: 'chrome_dino', label: 'Chrome Dino' },
  { value: 'snake', label: 'Snake' },
  { value: 'blockblast', label: 'BlockBlast' },
  { value: 'crossy_road', label: 'Crossy Road' },
  { value: 'aura_coin', label: 'Aura Coin' },
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
  { value: 'ballarena', label: 'Arène des balles (alias)' },
  { value: 'uno', label: 'Uno' },
  { value: 'morpion', label: 'Morpion' },
  { value: 'polytrack', label: 'PolyTrack' },
  { value: 'eaglercraft', label: 'Eaglercraft' },
  { value: 'subway_surfers', label: 'Subway Surfers Clone' },
  { value: 'hexgl', label: 'HexGL' },
  { value: 'opengd', label: 'OpenGD' },
  { value: 'russian_roulette', label: 'Roulette russe' },
  { value: 'roulette', label: 'Roulette russe (alias)' },
  { value: 'p4', label: 'Puissance 4 (alias)' },
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
  durationMinutes?: number;
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
  durationMinutes: 60,
};

const SHOP_ITEMS_FILE_FORMAT = 'auratracker-shop-items';
const SHOP_ITEMS_FILE_VERSION = 1;

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

const toSafeNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

  const supportUnread = supportThreads.reduce((total, thread) => total + (thread.unreadCount ?? 0), 0);

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
    const confirmed = window.confirm('Supprimer cette publicite definitivement ? Cette action est irreversible.');
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
    fetchPendingSanctions();
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
    fetchUpdatePopups();
    fetchActivity('day');
    fetchActivityBreakdown(new Date().toISOString().slice(0, 10));
    fetchPlatformStats();
    fetchReferralStats();
    fetchGamesLeaderboard();
    fetchSupportThreads();
    fetchSupportReports();
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
      await sanctionsApi.approveSanction(id);
      setPendingSanctions((prev) => prev.filter((s) => s.id !== id));
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
      await sanctionsApi.rejectSanction(id);
      setPendingSanctions((prev) => prev.filter((s) => s.id !== id));
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
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 0.5) {
        showMessage('error', 'Les frais Chaos Coin doivent etre compris entre 0% et 50%');
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
    if (!window.confirm('Purger TOUTES les entreprises ? Les propriétaires seront remboursés. Action irréversible.')) return;
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
    if (!window.confirm('Réinitialiser le niveau débloqué de TOUS les joueurs à 0 ?')) return;
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
      } else if (itemForm.effectType === 'YOU_ADBLOCK') {
        effect = JSON.stringify({
          type: 'YOU_ADBLOCK',
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

  const exportChat = async () => {
    setExportingChat(true);
    try {
      const res = await adminApi.exportChat();
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const contentDisposition = res.headers?.['content-disposition'] as string | undefined;
      const match = contentDisposition?.match(/filename="([^"]+)"/);
      link.href = url;
      link.download = match?.[1] ?? `chat-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showMessage('success', 'Export du chat téléchargé');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur lors de l’export du chat');
    } finally {
      setExportingChat(false);
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
                    ['settings', 'game-limits', 'communication'].includes(activeTab) ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                  )}>
                    <Settings className="w-4 h-4 shrink-0" />
                    Paramètres
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  </button>
                  <div className={cn(dropdownOuter, 'left-auto right-0')}>
                    <div className={dropdownInner}>
                    {dropdownItemBtn('settings', 'Paramètres', <Settings className="w-3.5 h-3.5" />, () => setActiveTab('settings'))}
                    {dropdownItemBtn('game-limits', 'Limites jeux', <Gamepad2 className="w-3.5 h-3.5" />, () => setActiveTab('game-limits'))}
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

        {/* ── ADS TAB ──────────────────────────────────────────────────────────── */}
        <TabsContent value="ads" className={SPACING.SECTION_SPACING}>
          <div className="space-y-8">
            {/* Pending ads */}
            {pendingAds.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">À valider</h2>
                  <span className={TYPOGRAPHY.XS}>{pendingAds.length} en attente</span>
                </div>
                <div className="space-y-3">
                  {pendingAdsLoading ? (
                    <Card><CardContent className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement…</CardContent></Card>
                  ) : pendingAds.map((ad) => (
                    <Card key={ad.id} className="overflow-hidden">
                      <CardContent className="space-y-4 px-5 py-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold">{ad.title}</p>
                              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-300">{ad.adType}</span>
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">En attente</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{ad.tagline}</p>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">{ad.business.name} · par {ad.business.owner.username}</p>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>CTA: {ad.ctaText}</span>
                              <span>·</span>
                              <span className="break-all">{ad.ctaLink}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => void handleReviewAd(ad.id, 'approve')} disabled={reviewingAdId === ad.id}>
                              Approuver
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void handleReviewAd(ad.id, 'reject')} disabled={reviewingAdId === ad.id}>
                              Rejeter
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => void handleDeleteAdForever(ad.id)} disabled={reviewingAdId === ad.id}>
                              Supprimer
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                          <div className="overflow-hidden rounded-xl border border-border/40 bg-background/50">
                            {ad.imageUrl ? (
                              <img src={resolveImageUrl(ad.imageUrl)} alt={ad.title} className="h-40 w-full object-cover" />
                            ) : (
                              <div className="flex h-40 items-center justify-center bg-muted/30 text-xs text-muted-foreground">Pas d'image</div>
                            )}
                          </div>
                          <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Aperçu joueur</p>
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">{ad.title}</p>
                              <p className="text-sm text-muted-foreground">{ad.tagline}</p>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{ad.business.owner.username}</span>
                              <span>·</span>
                              <span>{ad.business.verified ? 'Entreprise vérifiée' : 'Entreprise non vérifiée'}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* All ads gallery */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Toutes les publicités</h2>
                <span className={TYPOGRAPHY.XS}>{allAds.length} au total</span>
              </div>
              {allAdsLoading ? (
                <Card><CardContent className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement…</CardContent></Card>
              ) : allAds.length === 0 ? (
                <Card><CardContent className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune publicité créée par les utilisateurs.</CardContent></Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {allAds.map((ad) => (
                    <Card key={`all-${ad.id}`} className="overflow-hidden flex flex-col">
                      <div className="relative">
                        {ad.imageUrl ? (
                          <img src={resolveImageUrl(ad.imageUrl)} alt={ad.title} className="h-44 w-full object-cover" />
                        ) : (
                          <div className="flex h-44 items-center justify-center bg-muted/30 text-xs text-muted-foreground">Pas d'image</div>
                        )}
                        {/* Status badges overlay */}
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                          <span className={ad.status === 'APPROVED' ? 'rounded-full bg-emerald-600/90 px-2 py-0.5 text-[11px] text-white font-medium' : ad.status === 'PENDING' ? 'rounded-full bg-amber-600/90 px-2 py-0.5 text-[11px] text-white font-medium' : 'rounded-full bg-red-600/90 px-2 py-0.5 text-[11px] text-white font-medium'}>
                            {ad.status === 'APPROVED' ? 'Approuvée' : ad.status === 'PENDING' ? 'En attente' : 'Rejetée'}
                          </span>
                          {!ad.isActive && (
                            <span className="rounded-full bg-background/80 border border-border/50 px-2 py-0.5 text-[11px] text-muted-foreground font-medium">Masquée</span>
                          )}
                        </div>
                      </div>
                      <CardContent className="flex flex-col gap-3 px-4 py-3 flex-1">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{ad.title}</p>
                            <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[11px] text-violet-300">{ad.adType}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{ad.tagline}</p>
                          <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60">{ad.business.name} · {ad.business.owner.username}</p>
                          <div className="flex gap-3 text-[11px] text-muted-foreground pt-0.5">
                            <span>{ad.impressions.toLocaleString('fr-FR')} impressions</span>
                            <span>·</span>
                            <span>{ad.clicks.toLocaleString('fr-FR')} clics</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/30">
                          {ad.status === 'PENDING' && (
                            <>
                              <Button size="sm" className="h-7 text-xs" onClick={() => void handleReviewAd(ad.id, 'approve')} disabled={reviewingAdId === ad.id}>
                                Approuver
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void handleReviewAd(ad.id, 'reject')} disabled={reviewingAdId === ad.id}>
                                Rejeter
                              </Button>
                            </>
                          )}
                          {ad.status === 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => void handleToggleAdVisibility(ad.id, ad.isActive)}
                              disabled={reviewingAdId === ad.id}
                            >
                              {reviewingAdId === ad.id ? <Loader2 className="w-3 h-3 animate-spin" /> : ad.isActive ? <Eye className="w-3 h-3" /> : <Eye className="w-3 h-3 opacity-40" />}
                              {ad.isActive ? 'Masquer' : 'Afficher'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs ml-auto"
                            onClick={() => void handleDeleteAdForever(ad.id)}
                            disabled={reviewingAdId === ad.id}
                          >
                            <Trash2 className="w-3 h-3" />
                            Supprimer
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

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
                  <div className="flex items-center gap-2">
                    <input
                      ref={itemImportInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={handleImportItemsFile}
                    />
                    <Button size="sm" variant="outline" onClick={handleExportItems} className="h-8 px-2">
                      <Download className="mr-1.5 h-4 w-4" />
                      Export
                    </Button>
                    <Button size="sm" variant="outline" onClick={openImportItemsPicker} className="h-8 px-2" disabled={importingItems}>
                      {importingItems ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                      Import
                    </Button>
                    <Button size="sm" variant="outline" onClick={openCreateItemDialog} className="h-8 w-8 p-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
              <p className="mb-4 text-xs text-muted-foreground">
                Import/export au format JSON versionné. Les images restent référencées par URL et les effets sont conservés en structure JSON.
              </p>
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

        {/* ── Fiscal Inspector Tab ── */}
        <TabsContent value="fiscal" className={SPACING.SECTION_SPACING}>
          <div className="space-y-6">
            {/* Sanction modal for fiscal inspector */}
            <SanctionModal
              open={showFiscalSanctionModal}
              onClose={() => setShowFiscalSanctionModal(false)}
              issuerRole="FISCAL_INSPECTOR"
              players={fiscalUsers.map((u) => ({ id: u.id, username: u.username }))}
              onSubmit={async (data) => {
                await sanctionsApi.submitFiscalSanction({
                  type: data.type,
                  targetUserId: data.targetUserId,
                  beneficiaryUserId: data.beneficiaryUserId,
                  amount: data.amount,
                  message: data.message,
                });
                showMessage('success', 'Demande de sanction transmise à l\'administration');
              }}
            />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Inspection fiscale — Patrimoine des joueurs</p>
                <p className="text-xs text-muted-foreground mt-0.5">Vue lecture seule. Utilisez le bouton ci-dessous pour soumettre une demande de récupération fiscale.</p>
              </div>
              <Button size="sm" onClick={() => setShowFiscalSanctionModal(true)} className="gap-1.5">
                <Gavel className="w-3.5 h-3.5" />
                Demande de sanction
              </Button>
            </div>

            {user?.isFiscalInspector && (
              <div className="rounded-lg border border-border/60 p-4 bg-muted/20">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Fonds du fisc</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fiscalFundRatePercent}% de chaque sanction fiscale approuvée sont ajoutés à cette cagnotte.</p>
                    <p className="text-lg font-semibold mt-2 tabular-nums">{fiscalFundBalance.toLocaleString('fr-FR')}€</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Source de paiement</p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={fiscalPaymentSource === 'ACCOUNT' ? 'default' : 'outline'}
                        disabled={savingFiscalPaymentSource}
                        onClick={() => saveFiscalPaymentSource('ACCOUNT')}
                      >
                        Compte principal
                      </Button>
                      <Button
                        size="sm"
                        variant={fiscalPaymentSource === 'FONDS_DU_FISC' ? 'default' : 'outline'}
                        disabled={savingFiscalPaymentSource}
                        onClick={() => saveFiscalPaymentSource('FONDS_DU_FISC')}
                      >
                        Fonds du fisc
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {loadingFiscalUsers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : fiscalUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun joueur trouvé.</p>
            ) : (
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border/60">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Joueur</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Compte (€)</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Compte partagé (€)</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Aura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {fiscalUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 font-medium">{u.username}{u.firstName ? ` (${u.firstName})` : ''}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{u.money.toLocaleString('fr-FR')}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {u.sharedMoney
                            ? <span title={`Compte partagé avec ${u.sharedMoney.partner.username}`}>{u.sharedMoney.coupleBalance.toLocaleString('fr-FR')}</span>
                            : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-amber-500">{u.aura.toLocaleString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="game-limits" className={SPACING.SECTION_SPACING}>
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Récompenses de jeux</p>
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Plafond d'aura journalier</div>
                  <div className="text-xs text-muted-foreground">Total maximum d'aura gagnable via les jeux avant le reset de minuit. Valeur par défaut: 500.</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    id="daily-game-aura-limit"
                    type="number"
                    min={0}
                    max={100000}
                    step={1}
                    value={dailyGameAuraLimit}
                    onChange={(event) => setDailyGameAuraLimit(event.target.value)}
                    className="w-28 h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Plafond d'argent journalier (par jeu)</div>
                  <div className="text-xs text-muted-foreground">Maximum d'argent gagnable par jeu avant le reset de minuit. Valeur par défaut: 1000.</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    id="daily-game-money-limit"
                    type="number"
                    min={0}
                    max={100000}
                    step={1}
                    value={dailyGameMoneyLimit}
                    onChange={(event) => setDailyGameMoneyLimit(event.target.value)}
                    className="w-28 h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end px-4 py-3.5">
                <Button size="sm" onClick={saveDailyGameLimits} disabled={savingDailyGameLimits}>
                  {savingDailyGameLimits ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
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
                  <div className="text-sm font-medium">Carte de parrainage sur le dashboard</div>
                  <div className="text-xs text-muted-foreground">Affiche la carte de suivi du parrainage sur la page dashboard des joueurs.</div>
                </div>
                <Switch
                  checked={referralDashboardCardEnabled}
                  disabled={savingReferralDashboardCardEnabled}
                  onCheckedChange={saveReferralDashboardCardEnabled}
                />
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

          {/* ── Salle de marche ───────────────────────── */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Salle de marche</p>
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Frais Aura Coin</div>
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
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Frais Aura Stable</div>
                  <div className="text-xs text-muted-foreground">Stable coin a faible volatilite. Meme logique de frais modifiable depuis l&apos;admin.</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    id="stable-coin-buy-fee"
                    type="number"
                    min={0}
                    max={0.5}
                    step={0.0001}
                    value={stableCoinBuyFeePercentage}
                    onChange={(event) => setStableCoinBuyFeePercentage(event.target.value)}
                    className="w-28 h-8 text-sm"
                  />
                  <Button size="sm" onClick={saveStableCoinBuyFee} disabled={savingStableCoinBuyFee}>
                    {savingStableCoinBuyFee ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Frais Chaos Coin</div>
                  <div className="text-xs text-muted-foreground">Coin tres instable avec frais separes pour equilibrer le risque et les spreads.</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    id="chaos-coin-buy-fee"
                    type="number"
                    min={0}
                    max={0.5}
                    step={0.0001}
                    value={chaosCoinBuyFeePercentage}
                    onChange={(event) => setChaosCoinBuyFeePercentage(event.target.value)}
                    className="w-28 h-8 text-sm"
                  />
                  <Button size="sm" onClick={saveChaosCoinBuyFee} disabled={savingChaosCoinBuyFee}>
                    {savingChaosCoinBuyFee ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
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

              <div className="px-4 py-3.5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">Blocage du chat</div>
                    <div className="text-xs text-muted-foreground">
                      Coupe l&apos;envoi de messages pour les joueurs. Les admins gardent l&apos;accès pour moderer.
                    </div>
                  </div>
                  <Switch checked={chatBlockEnabled} onCheckedChange={setChatBlockEnabled} disabled={savingChatBlockSettings} />
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Message affiche aux joueurs
                    </label>
                    <Textarea
                      value={chatBlockMessage}
                      onChange={(event) => setChatBlockMessage(event.target.value)}
                      placeholder="Ex: Le chat est ferme pendant les heures de cours."
                      className="min-h-[88px]"
                      maxLength={CHAT_BLOCK_MESSAGE_MAX_LENGTH}
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Visible dans le chat et au moment d&apos;une tentative d&apos;envoi.</span>
                      <span>{chatBlockMessage.length}/{CHAT_BLOCK_MESSAGE_MAX_LENGTH}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-xs text-muted-foreground md:w-64">
                    <p className="font-medium text-foreground">Etat actuel</p>
                    <p className="mt-1">
                      {chatBlockEnabled
                        ? 'Blocage manuel active'
                        : chatAutoBlockEnabled
                          ? `Blocage auto configure de ${chatAutoBlockStart} a ${chatAutoBlockEnd}`
                          : 'Chat ouvert'}
                    </p>
                    <p className="mt-1">Fuseau horaire: {CHAT_BLOCK_TIMEZONE}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/40 bg-background/30 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">Blocage automatique quotidien</div>
                      <div className="text-xs text-muted-foreground">
                        Active un blocage chaque jour sur un creneau fixe. Gere aussi les plages qui passent minuit.
                      </div>
                    </div>
                    <Switch checked={chatAutoBlockEnabled} onCheckedChange={setChatAutoBlockEnabled} disabled={savingChatBlockSettings} />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Debut
                      </label>
                      <Input
                        type="time"
                        step={60}
                        value={chatAutoBlockStart}
                        disabled={!chatAutoBlockEnabled || savingChatBlockSettings}
                        onChange={(event) => setChatAutoBlockStart(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Fin
                      </label>
                      <Input
                        type="time"
                        step={60}
                        value={chatAutoBlockEnd}
                        disabled={!chatAutoBlockEnabled || savingChatBlockSettings}
                        onChange={(event) => setChatAutoBlockEnd(event.target.value)}
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Exemple: `22:00` → `07:00` bloque le chat toute la nuit.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveChatBlockSettings} disabled={savingChatBlockSettings}>
                    {savingChatBlockSettings ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                    Sauvegarder le chat
                  </Button>
                </div>
              </div>

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
                    {maintenanceEnabled
                      ? 'Maintenance globale active'
                      : maintenanceAutoWeekendEnabled
                        ? 'Activation automatique le week-end'
                        : 'Site accessible normalement'}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setMaintenanceOpen(true)} className="shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                  Configurer
                </Button>
              </div>

              {/* Business admin controls */}
              <div className="mx-4 border-t border-border/30 pt-3 pb-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Entreprises</p>
              </div>

              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Création d'entreprise</div>
                  <div className="text-xs text-muted-foreground">
                    Quand désactivé, les joueurs ne peuvent plus créer de nouvelles entreprises.
                  </div>
                </div>
                <Switch
                  checked={businessCreationEnabled}
                  onCheckedChange={saveBusinessCreationEnabled}
                  disabled={savingBusinessCreation}
                />
              </div>

              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Purger toutes les entreprises</div>
                  <div className="text-xs text-muted-foreground">
                    Supprime toutes les entreprises et rembourse chaque propriétaire.
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void purgeAllBusinesses()} disabled={purgingBusinesses} className="shrink-0 border-red-400/30 text-red-300 hover:bg-red-500/10">
                  {purgingBusinesses ? 'Purge…' : 'Purger'}
                </Button>
              </div>

              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Réinitialiser les niveaux débloqués</div>
                  <div className="text-xs text-muted-foreground">
                    Remet le niveau débloqué de tous les joueurs à 0 (niveau 1 accessible à nouveau).
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void resetBusinessUnlockLevels()} disabled={resettingUnlockLevels} className="shrink-0">
                  {resettingUnlockLevels ? 'Reset…' : 'Réinitialiser'}
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
                    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                      <div>
                        <div className="text-sm font-medium">Maintenance auto le week-end</div>
                        <div className="text-xs text-muted-foreground">Active automatiquement la maintenance les samedis et dimanches.</div>
                      </div>
                      <Switch checked={maintenanceAutoWeekendEnabled} onCheckedChange={setMaintenanceAutoWeekendEnabled} />
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
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={exportChat} disabled={exportingChat}>
                    {exportingChat ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                    Exporter
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10" disabled={clearingChat}>
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
                        const blockedReason = blockedPageMessages[page.key] || '';
                        return (
                          <div key={page.key} className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-default space-y-2">
                            <div className="flex items-center justify-between gap-4">
                              <div className={cn('text-sm font-medium', isBlocked && 'text-muted-foreground/50 line-through')}>
                                {page.label}
                              </div>
                              <Switch checked={!isBlocked} onCheckedChange={() => toggleBlockedPage(page.key)} />
                            </div>
                            {isBlocked && (
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                  Raison spécifique
                                </label>
                                <Textarea
                                  value={blockedReason}
                                  onChange={(e) => updateBlockedPageMessage(page.key, e.target.value)}
                                  placeholder={`Ex: ${page.label} est bloquée temporairement pour maintenance ciblée.`}
                                  className="min-h-[64px] text-xs"
                                />
                              </div>
                            )}
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
                  <SelectItem value="BETA_TESTER">{ROLE_LABELS.BETA_TESTER}</SelectItem>
                  <SelectItem value="FISCAL_INSPECTOR">{ROLE_LABELS.FISCAL_INSPECTOR}</SelectItem>
                  <SelectItem value="JUDGE">{ROLE_LABELS.JUDGE}</SelectItem>
                  <SelectItem value="ADMIN">{ROLE_LABELS.ADMIN}</SelectItem>
                  <SelectItem value="SUPER_ADMIN">{ROLE_LABELS.SUPER_ADMIN}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Economy */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-purple-400 flex items-center gap-1"><TrendingUp className="h-3 w-3" />Aura (solde direct)</label>
                <div className="relative">
                  <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-purple-400/60 pointer-events-none" />
                  <Input
                    type="number"
                    min={0}
                    value={editValues.aura}
                    onChange={(e) => setEditValues(prev => ({ ...prev, aura: Number.parseInt(e.target.value, 10) || 0 }))}
                    className="h-9 bg-transparent border-purple-500/30 focus-visible:ring-purple-500/30 pl-8"
                    placeholder="Solde aura"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-400/70 pointer-events-none" />
                    <Input
                      type="number"
                      min={0}
                      value={editAuraAddAmount}
                      onChange={(e) => setEditAuraAddAmount(Number.parseInt(e.target.value, 10) || 0)}
                      className="h-9 bg-transparent border-emerald-500/30 focus-visible:ring-emerald-500/30 pl-8"
                      placeholder="Ajouter"
                    />
                  </div>
                  <div className="relative">
                    <Minus className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-rose-400/70 pointer-events-none" />
                    <Input
                      type="number"
                      min={0}
                      value={editAuraRemoveAmount}
                      onChange={(e) => setEditAuraRemoveAmount(Number.parseInt(e.target.value, 10) || 0)}
                      className="h-9 bg-transparent border-rose-500/30 focus-visible:ring-rose-500/30 pl-8"
                      placeholder="Enlever"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Actuel: {baseEditAura.toLocaleString()} • Base: {toSafeNumber(editValues.aura).toLocaleString()} • Resultat: <span className={cn(nextEditAura < 0 ? 'text-rose-400' : 'text-purple-300')}>{nextEditAura.toLocaleString()}</span>
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-green-400 flex items-center gap-1"><CurrencyIcon type="money" className="h-3 w-3" />Argent (solde direct)</label>
                <div className="relative">
                  <CurrencyIcon type="money" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" />
                  <Input
                    type="number"
                    min={0}
                    value={editValues.money}
                    onChange={(e) => setEditValues(prev => ({ ...prev, money: Number.parseInt(e.target.value, 10) || 0 }))}
                    className="h-9 bg-transparent border-green-500/30 focus-visible:ring-green-500/30 pl-8"
                    placeholder="Solde argent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-400/70 pointer-events-none" />
                    <Input
                      type="number"
                      min={0}
                      value={editMoneyAddAmount}
                      onChange={(e) => setEditMoneyAddAmount(Number.parseInt(e.target.value, 10) || 0)}
                      className="h-9 bg-transparent border-emerald-500/30 focus-visible:ring-emerald-500/30 pl-8"
                      placeholder="Ajouter"
                    />
                  </div>
                  <div className="relative">
                    <Minus className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-rose-400/70 pointer-events-none" />
                    <Input
                      type="number"
                      min={0}
                      value={editMoneyRemoveAmount}
                      onChange={(e) => setEditMoneyRemoveAmount(Number.parseInt(e.target.value, 10) || 0)}
                      className="h-9 bg-transparent border-rose-500/30 focus-visible:ring-rose-500/30 pl-8"
                      placeholder="Enlever"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Actuel: {baseEditMoney.toLocaleString()} • Base: {toSafeNumber(editValues.money).toLocaleString()} • Resultat: <span className={cn(nextEditMoney < 0 ? 'text-rose-400' : 'text-green-300')}>{nextEditMoney.toLocaleString()}</span>
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-yellow-400 flex items-center gap-1"><CurrencyIcon type="money" className="h-3 w-3" />AuraCoin</label>
                <div className="relative">
                  <CurrencyIcon type="money" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" />
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

      <Dialog
        open={Boolean(sharedMoneyUser)}
        onOpenChange={(open) => {
          if (!open) {
            setSharedMoneyUser(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Compte commun de {sharedMoneyUser?.username || 'l\'utilisateur'}
            </DialogTitle>
            <DialogDescription>
              Consultez l'argent personnel et le solde partagé actuel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground">Argent personnel</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-green-400">
                  {sharedMoneyUser?.money.toLocaleString('fr-FR') ?? '0'} €
                </p>
              </div>
              <div className="rounded-lg border border-border/40 bg-emerald-500/10 p-3">
                <p className="text-xs text-muted-foreground">Compte commun</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-400">
                  {sharedMoneyUser?.sharedMoney?.coupleBalance.toLocaleString('fr-FR') ?? '0'} €
                </p>
              </div>
            </div>

            {sharedMoneyUser?.sharedMoney ? (
              <div className="space-y-3 rounded-xl border border-border/40 bg-muted/10 p-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-400" />
                  <p className="text-sm font-medium">Conjoint</p>
                  <span className="ml-auto text-sm font-semibold tabular-nums">
                    {sharedMoneyUser.sharedMoney.partner.username}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Argent du conjoint</span>
                  <span className="ml-auto font-semibold tabular-nums text-green-400">
                    {sharedMoneyUser.sharedMoney.partner.money.toLocaleString('fr-FR')} €
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Total du foyer</span>
                  <span className="ml-auto font-semibold tabular-nums text-amber-400">
                    {(sharedMoneyUser.money + sharedMoneyUser.sharedMoney.partner.money + sharedMoneyUser.sharedMoney.coupleBalance).toLocaleString('fr-FR')} €
                  </span>
                </div>
                {sharedMoneyUser.sharedMoney.marriedAt && (
                  <div className="text-xs text-muted-foreground">
                    Mariage depuis le {new Date(sharedMoneyUser.sharedMoney.marriedAt).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/40 bg-muted/5 p-4 text-sm text-muted-foreground">
                Cet utilisateur n'a pas de compte commun actif.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSharedMoneyUser(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                        durationMinutes: 60,
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

                {itemForm.effectType === 'YOU_ADBLOCK' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Durée de l'effet (minutes)</label>
                    <Input
                      type="number"
                      value={itemForm.durationMinutes || 60}
                      onChange={(e) => setItemForm((prev) => ({ ...prev, durationMinutes: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                      className="bg-transparent"
                      min="1"
                    />
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

        <TabsContent value="referrals" className={SPACING.SECTION_SPACING}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Statistiques de parrainage</h2>
              <p className="text-xs text-muted-foreground">Suivi global du funnel et des meilleurs parrains.</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchReferralStats} disabled={loadingReferralStats}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-2', loadingReferralStats && 'animate-spin')} />
              Rafraîchir
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-1">
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Système</p>
                <p className="text-xl font-semibold tabular-nums">
                  {referralStats?.overview.referralEnabled ? 'Actif' : 'Désactivé'}
                </p>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>état global</p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-1">
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Comptes avec code</p>
                <p className="text-xl font-semibold tabular-nums">{referralStats?.overview.totalUsersWithCode.toLocaleString('fr-FR') ?? '—'}</p>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>parrains potentiels</p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-1">
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Inscrits via parrainage</p>
                <p className="text-xl font-semibold tabular-nums">{referralStats?.overview.totalReferredUsers.toLocaleString('fr-FR') ?? '—'}</p>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>total filleuls</p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-1">
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Validés</p>
                <p className="text-xl font-semibold tabular-nums">{referralStats?.overview.approvedReferredUsers.toLocaleString('fr-FR') ?? '—'}</p>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>{referralStats ? `${referralStats.overview.conversionRate}% conversion` : 'conversion'}</p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-1">
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>En attente</p>
                <p className="text-xl font-semibold tabular-nums">{referralStats?.overview.pendingReferredUsers.toLocaleString('fr-FR') ?? '—'}</p>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>{referralStats ? `${referralStats.overview.pendingRate}% du flux` : 'du flux'}</p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-1">
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Coût total</p>
                <p className="text-xl font-semibold tabular-nums">{referralStats ? referralStats.overview.rewardPayoutTotal.toLocaleString('fr-FR') : '—'}</p>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>
                  {referralStats ? `${referralStats.overview.rewardAmount.toLocaleString('fr-FR')} / validation` : 'récompenses'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardDescription>Parrainages récompensés</CardDescription>
                <p className="text-2xl font-semibold tabular-nums">{referralStats?.overview.rewardedReferrals.toLocaleString('fr-FR') ?? '—'}</p>
              </CardHeader>
              <CardContent>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                  Nombre de filleuls déjà approuvés ayant déclenché le versement.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardDescription>En attente depuis plus de 7 jours</CardDescription>
                <p className="text-2xl font-semibold tabular-nums">{referralStats?.overview.stalePendingOlderThan7Days.toLocaleString('fr-FR') ?? '—'}</p>
              </CardHeader>
              <CardContent>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                  Comptes parrainés toujours non validés après une semaine.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Top parrains</h3>
                  <CardDescription>Classement par nombre total de filleuls.</CardDescription>
                </div>
                {loadingReferralStats && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </CardHeader>
            <CardContent>
              {!referralStats ? (
                <p className="text-sm text-muted-foreground">Chargement des stats de parrainage...</p>
              ) : referralStats.topReferrers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun parrainage enregistré pour le moment.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border/40">
                        <th className="py-2 pr-2">Parrain</th>
                        <th className="py-2 pr-2">Code</th>
                        <th className="py-2 pr-2 text-right">Total</th>
                        <th className="py-2 pr-2 text-right">Validés</th>
                        <th className="py-2 pr-2 text-right">En attente</th>
                        <th className="py-2 pr-2 text-right">Récompensés</th>
                        <th className="py-2 text-right">Montant total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referralStats.topReferrers.map((entry) => (
                        <tr key={entry.userId} className="border-b border-border/20">
                          <td className="py-2 pr-2">
                            <span className="font-medium">{entry.username}</span>
                            {!entry.isApproved && <span className="ml-2 text-xs text-amber-400">(non validé)</span>}
                          </td>
                          <td className="py-2 pr-2 font-mono text-xs">{entry.referralCode ?? '—'}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{entry.totalReferrals.toLocaleString('fr-FR')}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{entry.approvedReferrals.toLocaleString('fr-FR')}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{entry.pendingReferrals.toLocaleString('fr-FR')}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{entry.rewardedReferrals.toLocaleString('fr-FR')}</td>
                          <td className="py-2 text-right tabular-nums">{entry.totalRewardsGiven.toLocaleString('fr-FR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={downloadStatsCSV} disabled={!platformStats} className="h-7 w-7 p-0" title="Télécharger CSV">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={fetchPlatformStats} className="h-7 w-7 p-0" title="Rafraîchir">
                  <RefreshCw className={cn('h-3.5 w-3.5', loadingPlatformStats && 'animate-spin')} />
                </Button>
              </div>
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
                    <CurrencyIcon type="aura" className="h-3.5 w-3.5" />
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
                    <CurrencyIcon type="money" className="h-3.5 w-3.5" />
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

          {(moneyDistribution || auraDistribution) && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-border/40">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Répartition des richesses</span>
                  </div>
                  <CardDescription>
                    Calculé sur {wealthUsers.length.toLocaleString('fr-FR')} comptes hors super admin.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Card className="border-emerald-500/20 bg-emerald-500/5">
                      <CardContent className="p-4 space-y-1">
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Médiane argent</p>
                        <p className="text-xl font-semibold tabular-nums text-emerald-300">
                          {moneyDistribution ? formatBigNumber(Math.round(moneyDistribution.median)) : '—'}
                        </p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>
                          moyenne {moneyDistribution ? formatBigNumber(Math.round(moneyDistribution.average)) : '—'}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-cyan-500/20 bg-cyan-500/5">
                      <CardContent className="p-4 space-y-1">
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Médiane aura</p>
                        <p className="text-xl font-semibold tabular-nums text-cyan-300">
                          {auraDistribution ? formatBigNumber(Math.round(auraDistribution.median)) : '—'}
                        </p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>
                          moyenne {auraDistribution ? formatBigNumber(Math.round(auraDistribution.average)) : '—'}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-amber-500/20 bg-amber-500/5">
                      <CardContent className="p-4 space-y-1">
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Inégalité argent</p>
                        <p className="text-xl font-semibold tabular-nums text-amber-300">
                          {moneyDistribution ? formatPercent(moneyDistribution.gini) : '—'}
                        </p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>
                          top 10%: {moneyDistribution ? formatPercent(moneyDistribution.top10Share) : '—'}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-fuchsia-500/20 bg-fuchsia-500/5">
                      <CardContent className="p-4 space-y-1">
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Inégalité aura</p>
                        <p className="text-xl font-semibold tabular-nums text-fuchsia-300">
                          {auraDistribution ? formatPercent(auraDistribution.gini) : '—'}
                        </p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>
                          top 10%: {auraDistribution ? formatPercent(auraDistribution.top10Share) : '—'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Argent par décile</p>
                          <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Qui détient quoi dans l’économie.</p>
                        </div>
                        <p className={cn(TYPOGRAPHY.XS, 'text-right text-muted-foreground')}>
                          Top 1%: {moneyDistribution ? formatPercent(moneyDistribution.top1Share) : '—'}
                        </p>
                      </div>
                      {moneyDistribution && moneyDistribution.deciles.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={moneyDistribution.deciles} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatBigNumber(value)} width={36} />
                            <RechartsTooltip
                              contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                              formatter={(value: number, _name: string, props: any) => [
                                `${value.toLocaleString('fr-FR')} total · moyenne ${Math.round(props.payload.average).toLocaleString('fr-FR')}`,
                                'Argent',
                              ]}
                            />
                            <Bar dataKey="total" fill="#10b981" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Aura par décile</p>
                          <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Distribution sociale et prestige accumulé.</p>
                        </div>
                        <p className={cn(TYPOGRAPHY.XS, 'text-right text-muted-foreground')}>
                          Top 1%: {auraDistribution ? formatPercent(auraDistribution.top1Share) : '—'}
                        </p>
                      </div>
                      {auraDistribution && auraDistribution.deciles.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={auraDistribution.deciles} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatBigNumber(value)} width={36} />
                            <RechartsTooltip
                              contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                              formatter={(value: number, _name: string, props: any) => [
                                `${value.toLocaleString('fr-FR')} total · moyenne ${Math.round(props.payload.average).toLocaleString('fr-FR')}`,
                                'Aura',
                              ]}
                            />
                            <Bar dataKey="total" fill="#06b6d4" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/40">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Concentration & écarts</span>
                  </div>
                  <CardDescription>
                    Vue rapide sur les poches de richesse et les écarts entre bas et haut de tableau.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">Argent</p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                          p10 {moneyDistribution ? formatBigNumber(Math.round(moneyDistribution.p10)) : '—'} · p90 {moneyDistribution ? formatBigNumber(Math.round(moneyDistribution.p90)) : '—'}
                        </p>
                      </div>
                      {moneyDistribution?.concentration.map((item) => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium tabular-nums">{formatPercent(item.share)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(2, Math.min(100, item.share))}%` }} />
                          </div>
                        </div>
                      ))}
                      <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                        Plus riche: <span className="font-medium text-foreground">{moneyDistribution?.richestUser?.username ?? '—'}</span> · {moneyDistribution ? formatBigNumber(Math.round(moneyDistribution.max)) : '—'}
                      </p>
                      <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                        Comptes à 0 ou moins: {moneyDistribution?.zeroCount.toLocaleString('fr-FR') ?? '—'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">Aura</p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                          p10 {auraDistribution ? formatBigNumber(Math.round(auraDistribution.p10)) : '—'} · p90 {auraDistribution ? formatBigNumber(Math.round(auraDistribution.p90)) : '—'}
                        </p>
                      </div>
                      {auraDistribution?.concentration.map((item) => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium tabular-nums">{formatPercent(item.share)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.max(2, Math.min(100, item.share))}%` }} />
                          </div>
                        </div>
                      ))}
                      <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                        Plus riche: <span className="font-medium text-foreground">{auraDistribution?.richestUser?.username ?? '—'}</span> · {auraDistribution ? formatBigNumber(Math.round(auraDistribution.max)) : '—'}
                      </p>
                      <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                        Comptes à 0 ou moins: {auraDistribution?.zeroCount.toLocaleString('fr-FR') ?? '—'}
                      </p>
                    </div>
                  </div>
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
                  <ResponsiveContainer width="100%" height={platformTopGamesChartHeight}>
                    <BarChart
                      data={platformTopGamesChartData}
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
                        {platformTopGamesChartData.map((_g, index) => (
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
                  {(() => {
                    const activeActivity = selectedActivity ?? hoveredActivity;
                    return (
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
                              Molette pour zoomer, glisser pour déplacer, clic pour figer
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
                              {activeActivity && (
                                <>
                                  <ReferenceLine
                                    x={activeActivity.cursorTs}
                                    stroke="hsl(var(--foreground))"
                                    strokeDasharray="4 4"
                                    strokeWidth={1.25}
                                  />
                                  <ReferenceDot
                                    x={activeActivity.cursorTs}
                                    y={activeActivity.point.max}
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
                      const displayPoint = activeActivity?.point ?? null;
                      const users = displayPoint?.usernames ?? [];
                      return (
                        <div className="w-44 shrink-0 border border-border/40 rounded-lg bg-muted/10 flex flex-col" style={{ height: 300 }}>
                          <div className="px-3 py-2 border-b border-border/40 shrink-0">
                            {displayPoint ? (
                              <>
                                <p className="text-xs font-medium tabular-nums">{displayPoint.max} joueur{displayPoint.max !== 1 ? 's' : ''}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(activeActivity!.cursorTs).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                </p>
                                {selectedActivity && (
                                  <p className="text-[10px] text-muted-foreground/70 mt-1">Cliquer à nouveau pour libérer</p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground/60">Survolez ou cliquez sur le graphe</p>
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
                    );
                  })()}
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

        <TabsContent value="demographics" className={SPACING.SECTION_SPACING}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Comptes analysés</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{totalDemographicUsers.toLocaleString('fr-FR')}</p>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Hors super admin.</p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <span className="font-semibold text-sm">Niveaux distincts</span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{levelDistributionData.length.toLocaleString('fr-FR')}</p>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Seconde, Première, Terminale, etc.</p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <span className="font-semibold text-sm">Classes distinctes</span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{classDistributionData.length.toLocaleString('fr-FR')}</p>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Combinaisons niveau + lettre.</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Répartition par niveau</span>
                </div>
              </CardHeader>
              <CardContent>
                {levelDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={levelDistributionData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                        formatter={(value: number, _name: string, props: any) => [`${value} utilisateurs (${formatPercent(props.payload.share)})`, 'Niveau']}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                        {levelDistributionData.map((entry, index) => (
                          <Cell key={entry.label} fill={ACTIVITY_BREAKDOWN_COLORS[index % ACTIVITY_BREAKDOWN_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Répartition par classe (top 12)</span>
                </div>
              </CardHeader>
              <CardContent>
                {classDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={classDistributionData.slice(0, 12)} layout="vertical" margin={{ top: 4, right: 8, left: 20, bottom: 4 }}>
                      <XAxis type="number" allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="label" width={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                        formatter={(value: number, _name: string, props: any) => [`${value} utilisateurs (${formatPercent(props.payload.share)})`, 'Classe']}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#3b82f6" isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Moyennes par classe (Aura / Argent)</span>
                </div>
              </CardHeader>
              <CardContent>
                {classAveragesData.length > 0 ? (
                  <div className="space-y-3">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={classAveragesData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={64} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={36} tickFormatter={(value: number) => formatBigNumber(value)} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                          formatter={(value: number, name: string, props: any) => [
                            `${Math.round(value).toLocaleString('fr-FR')} (n=${props.payload.count})`,
                            name === 'avgAura' ? 'Aura moyenne' : 'Argent moyen',
                          ]}
                        />
                        <Bar dataKey="avgAura" name="avgAura" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        <Bar dataKey="avgMoney" name="avgMoney" fill="#22c55e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {classAveragesData.slice(0, 4).map((entry) => (
                        <div key={entry.label} className="rounded-lg border border-border/40 bg-muted/10 p-3">
                          <p className="text-sm font-medium truncate">{entry.label}</p>
                          <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>n = {entry.count}</p>
                          <p className="text-sm mt-1">Aura moy: <span className="font-semibold tabular-nums">{Math.round(entry.avgAura).toLocaleString('fr-FR')}</span></p>
                          <p className="text-sm">Argent moy: <span className="font-semibold tabular-nums">{Math.round(entry.avgMoney).toLocaleString('fr-FR')}</span></p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Top joueurs par niveau (Aura)</span>
                </div>
                <CardDescription>
                  Classement interne par niveau scolaire.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {topUsersByLevel.length > 0 ? topUsersByLevel.map((entry) => (
                  <div key={entry.level} className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{entry.level}</p>
                      <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>{entry.users.length} affichés</p>
                    </div>
                    <div className="space-y-1.5">
                      {entry.users.map((member, index) => (
                        <div key={member.id} className="flex items-center justify-between text-xs">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background font-semibold">
                              {index + 1}
                            </span>
                            <span className="truncate">{member.username}</span>
                          </div>
                          <span className="tabular-nums font-medium">{member.aura.toLocaleString('fr-FR')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Utilisateurs par classe (Aura)</span>
              </div>
              <CardDescription>
                Un tableau par classe avec tous les utilisateurs et leur aura.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersByClass.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {usersByClass.map((entry) => (
                    <div key={entry.classLabel} className="rounded-lg border border-border/40 bg-muted/10 overflow-hidden">
                      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
                        <p className="text-sm font-semibold truncate">{entry.classLabel}</p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>{entry.users.length} utilisateur{entry.users.length > 1 ? 's' : ''}</p>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-muted/30 backdrop-blur">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Utilisateur</th>
                              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Aura</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.users.map((member) => (
                              <tr key={member.id} className="border-t border-border/30">
                                <td className="px-3 py-2">
                                  <span className="font-medium">{member.username}</span>
                                  {member.firstName ? <span className="text-muted-foreground"> ({member.firstName})</span> : null}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium">{member.aura.toLocaleString('fr-FR')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        {/* ── BADGES TAB ─────────────────────────────────────────────────────── */}
        <TabsContent value="badges" className={SPACING.SECTION_SPACING}>
          <div className="space-y-6">

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

        {/* ── COMMUNICATION TAB ────────────────────────────────────────────────── */}
        <TabsContent value="communication" className={SPACING.SECTION_SPACING}>
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

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/10 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className={TYPOGRAPHY.H4}>Signalements de conversations</h3>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Les derniers messages sont envoyes ici quand un joueur signale un DM ou un groupe.</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchSupportReports}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
              {supportReportsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : supportReports.length === 0 ? (
                <p className={cn(TYPOGRAPHY.MUTED, 'text-center')}>Aucun signalement.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {supportReports.slice(0, 8).map((report) => (
                    <div key={report.id} className="rounded-lg border border-border/60 bg-background p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{report.conversationTitle || report.conversationType || 'Conversation'}</p>
                          <p className="text-xs text-muted-foreground">Signale par {report.reporter.username} • {new Date(report.createdAt).toLocaleString('fr-FR')}</p>
                        </div>
                        <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', report.status === 'PENDING' ? 'bg-amber-500/15 text-amber-400' : report.status === 'ACTION_TAKEN' ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400')}>
                          {report.status}
                        </span>
                      </div>
                      {report.reason && <p className="text-sm text-foreground">{report.reason}</p>}
                      <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border/50 bg-muted/20 p-2">
                        {report.snapshot.map((message) => (
                          <div key={message.id} className="rounded-md bg-background/80 px-2 py-1.5 text-xs whitespace-pre-wrap break-words">
                            <span className="font-semibold">{message.sender?.username ?? 'Systeme'}:</span> {message.body}
                          </div>
                        ))}
                      </div>
                      {report.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" disabled={reviewingSupportReportId === report.id} onClick={() => handleReviewSupportReport(report.id, 'ACTION_TAKEN')}>
                            Action prise
                          </Button>
                          <Button size="sm" variant="outline" disabled={reviewingSupportReportId === report.id} onClick={() => handleReviewSupportReport(report.id, 'DISMISSED')}>
                            Ignorer
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                    {activeThreadMessages.map((msg) => {
                      const messageImages = msg.images ? JSON.parse(msg.images) : [];
                      return (
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
                            {messageImages.length > 0 && (
                              <div className="flex gap-1 mb-2 flex-wrap">
                                {messageImages.map((img: string, idx: number) => (
                                  <img
                                    key={idx}
                                    src={img}
                                    alt={`Message ${idx}`}
                                    className="h-16 w-16 object-cover rounded"
                                  />
                                ))}
                              </div>
                            )}
                            <p className="break-words whitespace-pre-wrap">{msg.body}</p>
                            <p className={cn('text-[10px] mt-1', msg.fromAdmin ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                              {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={supportMessagesEndRef} />
                  </div>
                  <div className="border-t border-border p-3 space-y-2">
                    {supportReplyImages.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {supportReplyImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img
                              src={img}
                              alt={`Support ${idx}`}
                              className="h-12 w-12 object-cover rounded border border-border"
                            />
                            <button
                              type="button"
                              onClick={() => removeSupportReplyImage(idx)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Supprimer l'image"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 items-end">
                      <div className="flex flex-col gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 hover:bg-primary/10 hover:text-primary text-xs"
                          disabled={supportUploadingImage || supportReplyImages.length >= 5 || supportSending}
                          onClick={() => supportImageInputRef.current?.click()}
                          title="Ajouter une image"
                        >
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                          Image
                        </Button>
                        <input
                          ref={supportImageInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleSupportImageUpload}
                          className="hidden"
                        />
                      </div>
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
                        disabled={(!supportReply.trim() && supportReplyImages.length === 0) || supportSending || supportUploadingImage}
                        onClick={handleSupportReply}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          </div>
        </TabsContent>

        </Tabs>
      </div>
    </PageShell>

    </>
  );
}





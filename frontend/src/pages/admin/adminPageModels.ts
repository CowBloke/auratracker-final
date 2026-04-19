import type {
  AdminClanEvent,
  AdminUser,
  Badge,
  PendingUser,
  RegistrationReview,
} from '../../services/api';
import {
  ADMIN_ARCHIVED_REGISTRATIONS_STORAGE_KEY,
  type AdminRole,
} from './constants';

export const EFFECT_TYPES = [
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

export const EFFECT_TYPES_WITHOUT_VALUE = new Set([
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

export const generateBadgeSvgDataUrl = (badge: Badge): string => {
  let fill = badge.backgroundColor ?? '#374151';
  let gradientDef = '';
  if (badge.backgroundType === 'gradient' && badge.backgroundGradient) {
    try {
      const g = JSON.parse(badge.backgroundGradient) as { from: string; to: string; direction?: string };
      const isVert = (g.direction ?? 'to right').includes('bottom');
      gradientDef = `<defs><linearGradient id="g" x1="0" y1="0" x2="${isVert ? '0' : '1'}" y2="${isVert ? '1' : '0'}"><stop offset="0%" stop-color="${g.from}"/><stop offset="100%" stop-color="${g.to}"/></linearGradient></defs>`;
      fill = 'url(#g)';
    } catch {
      // Keep solid fallback.
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56">${gradientDef}<rect width="56" height="56" rx="4" fill="${fill}" stroke="${badge.borderColor ?? '#6b7280'}" stroke-width="1.5"/><text x="28" y="39" text-anchor="middle" font-size="26" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">${badge.icon ?? '⭐'}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};

export const ITEM_TYPE_LABELS: Record<string, string> = {
  CONSUMABLE: 'Objet',
  COSMETIC: 'Cosmétique',
  UPGRADE: 'Amélioration',
};

export type EditableTaxBracket = {
  id: string;
  threshold: string;
  rate: string;
};

export const DEFAULT_TAX_BRACKET: EditableTaxBracket = {
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

export type ClanEventForm = {
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

export const DEFAULT_CLAN_EVENT_FORM: ClanEventForm = {
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

export type ArchivedRegistration = PendingUser & {
  registrationStatus: 'APPROVED' | 'REJECTED';
  reviewedAt?: string;
  importedFromLegacy?: boolean;
};

export const parseLegacyArchivedRegistrations = (): ArchivedRegistration[] => {
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

export const toDateTimeLocalValue = (value: string | Date): string => {
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

export const mapClanEventToForm = (event: AdminClanEvent): ClanEventForm => ({
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

export const mapRegistrationReviewToArchivedRegistration = (review: RegistrationReview): ArchivedRegistration => ({
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

export const getAdminRole = (user: Pick<AdminUser, 'isAdmin' | 'isSuperAdmin' | 'isBetaTester' | 'isFiscalInspector' | 'isJudge'>): AdminRole => {
  if (user.isSuperAdmin) return 'SUPER_ADMIN';
  if (user.isAdmin) return 'ADMIN';
  if (user.isBetaTester) return 'BETA_TESTER';
  if (user.isFiscalInspector) return 'FISCAL_INSPECTOR';
  if (user.isJudge) return 'JUDGE';
  return 'USER';
};

export const GAME_TYPES = [
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

export interface ItemFormData {
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

export const defaultItemForm: ItemFormData = {
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

export const SHOP_ITEMS_FILE_FORMAT = 'auratracker-shop-items';
export const SHOP_ITEMS_FILE_VERSION = 1;

export const toSafeNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { adminApi, uploadsApi, AdminUser, ShopItem, BugReport, PendingUser, AdminInventoryItem, Ban, ActivityLog, LogStats, Badge, UserBadge, Nft } from '../services/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Trash2, Save, MessageSquareX, AlertTriangle, Plus, Package, Edit2, X, Bug, Check, UserPlus, UserX, Ban as BanIcon, ShieldOff, ScrollText, Search, ChevronLeft, ChevronRight, ChevronDown, LogIn, MessageCircle, Gamepad2, Coins, Users, Store, Shield, Gavel, Lightbulb, TrendingUp, Swords, Award, Rocket, Download } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { readFileAsDataUrl } from '@/lib/uploads';

// Effect types for items
const EFFECT_TYPES = [
  { value: 'USERNAME_COLOR', label: 'Couleur de pseudo', description: 'Permet de choisir une couleur pour le pseudo dans le chat' },
  { value: 'PROFILE_PICTURE', label: 'Photo de profil', description: 'Permet de téléverser une photo affichée dans le chat' },
  { value: 'BONUS_AURA', label: 'Bonus Aura', description: 'Donne un bonus d\'aura à l\'utilisation' },
  { value: 'BONUS_MONEY', label: 'Bonus Argent', description: 'Donne un bonus d\'argent à l\'utilisation' },
];

const ITEM_TYPE_LABELS: Record<string, string> = {
  CONSUMABLE: 'Consommable',
  COSMETIC: 'Cosmétique',
  UPGRADE: 'Amélioration',
};

const NFT_RARITY_LABELS: Record<string, string> = {
  COMMON: 'Commun',
  UNCOMMON: 'Inhabituel',
  RARE: 'Rare',
  EPIC: 'Épique',
  LEGENDARY: 'Légendaire',
};

const ANNOUNCEMENT_MAX_LENGTH = 120;

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
  CLASH: { label: 'Clash', color: 'text-indigo-400', bgColor: 'bg-indigo-500', borderColor: 'border-indigo-500', icon: Swords },
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
  gift_aura: 'Don d\'aura',
  balance_change: 'Modification solde',
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
  nft_purchase: 'Achat NFT',
  nft_create: 'NFT créé',
  nft_update: 'NFT modifié',
  nft_delete: 'NFT supprimé',
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
  badge_create: 'Badge créé',
  badge_assign: 'Badge attribué',
  badge_remove: 'Badge retiré',
  // Ban
  ban_create: 'Bannissement créé',
  ban_remove: 'Bannissement levé',
  // AuraCoin
  auracoin_buy: 'Achat AuraCoin',
  auracoin_sell: 'Vente AuraCoin',
  // Clash
  attack_execute: 'Attaque lancée',
  base_save: 'Base sauvegardée',
  building_upgrade: 'Bâtiment amélioré',
};

// Human-readable metadata key labels
const METADATA_LABELS: Record<string, string> = {
  score: 'Score',
  game: 'Jeu',
  reward: 'Récompense',
  amount: 'Montant',
  item: 'Objet',
  price: 'Prix',
  reason: 'Raison',
  duration: 'Durée',
  target: 'Cible',
  result: 'Résultat',
  bet: 'Mise',
  win: 'Gain',
  loss: 'Perte',
  oldValue: 'Ancienne valeur',
  newValue: 'Nouvelle valeur',
  currency: 'Devise',
  type: 'Type',
  message: 'Message',
  partyName: 'Nom du groupe',
  content: 'Contenu',
  status: 'Statut',
  votes: 'Votes',
  badgeId: 'Badge',
  badgeName: 'Badge',
};

// Game type filters
const GAME_TYPES = [
  { value: 'doodle_jump', label: 'Doodle Jump' },
  { value: 'casino', label: 'Casino' },
];

interface ItemFormData {
  name: string;
  description: string;
  type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';
  price: number;
  imageUrl: string;
  effectType: string;
  effectValue: string;
}

interface NftFormData {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
}

const defaultItemForm: ItemFormData = {
  name: '',
  description: '',
  type: 'COSMETIC',
  price: 0,
  imageUrl: '',
  effectType: 'USERNAME_COLOR',
  effectValue: '',
};

const defaultNftForm: NftFormData = {
  name: '',
  description: '',
  price: 0,
  imageUrl: '',
  rarity: 'COMMON',
};

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ username: string; aura: number; money: number; dailyAuraLimit: number }>({
    username: '',
    aura: 0,
    money: 0,
    dailyAuraLimit: 50,
  });
  const [editPassword, setEditPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [mutingUser, setMutingUser] = useState<string | null>(null);
  const [clearingChat, setClearingChat] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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

  // Items state
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormData>(defaultItemForm);
  const [itemImageDataUrl, setItemImageDataUrl] = useState('');
  const [itemImageInputMode, setItemImageInputMode] = useState<'upload' | 'url'>('upload');
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);

  // NFT state
  const [nfts, setNfts] = useState<Nft[]>([]);
  const [loadingNfts, setLoadingNfts] = useState(false);
  const [nftDialogOpen, setNftDialogOpen] = useState(false);
  const [editingNft, setEditingNft] = useState<Nft | null>(null);
  const [nftForm, setNftForm] = useState<NftFormData>(defaultNftForm);
  const [nftImageDataUrl, setNftImageDataUrl] = useState('');
  const [nftImageInputMode, setNftImageInputMode] = useState<'upload' | 'url'>('upload');
  const [savingNft, setSavingNft] = useState(false);
  const [deletingNft, setDeletingNft] = useState<string | null>(null);

  // Badge management state
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const [creatingBadge, setCreatingBadge] = useState(false);
  const [badgeForm, setBadgeForm] = useState({ name: '', color: '#f59e0b' });
  const [badgeUserId, setBadgeUserId] = useState('');
  const [badgeAssignId, setBadgeAssignId] = useState('');
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loadingUserBadges, setLoadingUserBadges] = useState(false);
  const [assigningBadge, setAssigningBadge] = useState(false);
  const [removingBadgeId, setRemovingBadgeId] = useState<string | null>(null);

  // Bug reports state
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loadingBugs, setLoadingBugs] = useState(false);
  const [updatingBug, setUpdatingBug] = useState<string | null>(null);
  const [deletingBug, setDeletingBug] = useState<string | null>(null);

  // Pending users state
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [approvingUser, setApprovingUser] = useState<string | null>(null);
  const [rejectingUser, setRejectingUser] = useState<string | null>(null);

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

  // Logs state
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState({
    type: 'ALL',
    username: '',
    gameType: 'ALL',
  });
  const [logsPage, setLogsPage] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const logsPerPage = 50;
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [downloadLogsOpen, setDownloadLogsOpen] = useState(false);
  const [downloadLogsStartDate, setDownloadLogsStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().slice(0, 10);
  });
  const [downloadingLogs, setDownloadingLogs] = useState(false);
  const [downloadLogsError, setDownloadLogsError] = useState<string | null>(null);

  // Game settings state
  const [_gameSettings, setGameSettings] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    bombparty_wpp_easy: '500',
    bombparty_wpp_medium: '200',
    bombparty_wpp_hard: '100',
    bombparty_3letter_start_round: '10',
  });
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  // Deploy state
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string; stdout?: string; stderr?: string } | null>(null);

  // Reset extreme aura state
  const [resettingAura, setResettingAura] = useState(false);
  const [resetAuraResult, setResetAuraResult] = useState<{ success: boolean; message: string; usersReset: number; users: { id: string; username: string; oldAura: string }[] } | null>(null);

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
    fetchItems();
    fetchNfts();
    fetchBadges();
    fetchBugReports();
    fetchPendingUsers();
    fetchBans();
    fetchLogs();
    fetchLogStats();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (badgeUserId) {
      fetchUserBadges(badgeUserId);
    } else {
      setUserBadges([]);
    }
  }, [badgeUserId]);

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
      const res = await adminApi.getItems();
      setItems(res.data.items);
    } catch (error) {
      console.error('Failed to fetch items:', error);
      showMessage('error', 'Erreur lors du chargement des objets');
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchNfts = async () => {
    try {
      setLoadingNfts(true);
      const res = await adminApi.getNfts();
      setNfts(res.data.nfts);
    } catch (error) {
      console.error('Failed to fetch NFTs:', error);
      showMessage('error', 'Erreur lors du chargement des NFTs');
    } finally {
      setLoadingNfts(false);
    }
  };

  const fetchBadges = async () => {
    try {
      setLoadingBadges(true);
      const res = await adminApi.getBadges();
      setBadges(res.data.badges);
    } catch (error) {
      console.error('Failed to fetch badges:', error);
      showMessage('error', 'Erreur lors du chargement des badges');
    } finally {
      setLoadingBadges(false);
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

  const fetchLogs = async (page = 0, typeOverride?: string, gameTypeOverride?: string) => {
    try {
      setLoadingLogs(true);
      const filterType = typeOverride !== undefined ? typeOverride : logFilter.type;
      const filterGameType = gameTypeOverride !== undefined ? gameTypeOverride : logFilter.gameType;
      const res = await adminApi.getLogs({
        type: filterType !== 'ALL' ? filterType : undefined,
        gameType: filterGameType !== 'ALL' ? filterGameType : undefined,
        username: logFilter.username || undefined,
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
    if (!downloadLogsStartDate) {
      setDownloadLogsError('Choisis une date de début.');
      return;
    }

    try {
      setDownloadLogsError(null);
      setDownloadingLogs(true);
      const startDate = new Date(`${downloadLogsStartDate}T00:00:00`).toISOString();
      const res = await adminApi.downloadLogs({
        startDate,
        type: logFilter.type !== 'ALL' ? logFilter.type : undefined,
        gameType: logFilter.gameType !== 'ALL' ? logFilter.gameType : undefined,
        username: logFilter.username || undefined,
      });

      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const contentDisposition = res.headers?.['content-disposition'] as string | undefined;
      const match = contentDisposition?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `admin-logs-${downloadLogsStartDate}.csv`;
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
      setGameSettings(res.data.settings);
      setAnnouncementMessage(res.data.settings.topbar_announcement || '');
      // Update form with loaded values
      setSettingsForm({
        bombparty_wpp_easy: res.data.settings.bombparty_wpp_easy || '500',
        bombparty_wpp_medium: res.data.settings.bombparty_wpp_medium || '200',
        bombparty_wpp_hard: res.data.settings.bombparty_wpp_hard || '100',
        bombparty_3letter_start_round: res.data.settings.bombparty_3letter_start_round || '10',
      });
      const maintenanceValue = res.data.settings.maintenance_enabled || 'false';
      const maintenanceNormalized = maintenanceValue.toLowerCase();
      setMaintenanceEnabled(maintenanceNormalized === 'true' || maintenanceNormalized === '1');
      setMaintenanceMessage(res.data.settings.maintenance_message || '');
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      showMessage('error', 'Erreur lors du chargement des paramètres');
    } finally {
      setLoadingSettings(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSavingSettings(true);

      // Validate values
      const easy = parseInt(settingsForm.bombparty_wpp_easy);
      const medium = parseInt(settingsForm.bombparty_wpp_medium);
      const hard = parseInt(settingsForm.bombparty_wpp_hard);
      const startRound = parseInt(settingsForm.bombparty_3letter_start_round);

      if (isNaN(easy) || easy < 1 || isNaN(medium) || medium < 1 || isNaN(hard) || hard < 1) {
        showMessage('error', 'Les seuils WPP doivent être des entiers positifs');
        return;
      }

      if (isNaN(startRound) || startRound < 0) {
        showMessage('error', 'Le round de début doit être un entier positif ou zéro');
        return;
      }

      if (easy <= medium || medium <= hard) {
        showMessage('error', 'Les seuils doivent être: Facile > Moyen > Difficile');
        return;
      }

      await adminApi.updateSettings({
        bombparty_wpp_easy: easy,
        bombparty_wpp_medium: medium,
        bombparty_wpp_hard: hard,
        bombparty_3letter_start_round: startRound,
      });

      showMessage('success', 'Paramètres sauvegardés');
      fetchSettings();
    } catch (error) {
      console.error('Failed to save settings:', error);
      showMessage('error', 'Erreur lors de la sauvegarde');
    } finally {
      setSavingSettings(false);
    }
  };

  const saveMaintenance = async () => {
    try {
      setSavingMaintenance(true);
      await adminApi.updateSettings({
        maintenance_enabled: maintenanceEnabled ? 'true' : 'false',
        maintenance_message: maintenanceMessage.trim(),
      });
      showMessage('success', 'Maintenance mise à jour');
      fetchSettings();
    } catch (error) {
      console.error('Failed to save maintenance:', error);
      showMessage('error', 'Erreur lors de la sauvegarde');
    } finally {
      setSavingMaintenance(false);
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

  const runDeploy = async () => {
    try {
      setDeploying(true);
      setDeployResult(null);
      const res = await adminApi.deploy();
      setDeployResult(res.data);
      showMessage('success', 'Déploiement lancé avec succès');
    } catch (error: unknown) {
      console.error('Deploy failed:', error);
      const errorData = (error as { response?: { data?: { message?: string; stderr?: string } } })?.response?.data;
      setDeployResult({
        success: false,
        message: errorData?.message || 'Erreur lors du déploiement',
        stderr: errorData?.stderr,
      });
      showMessage('error', 'Erreur lors du déploiement');
    } finally {
      setDeploying(false);
    }
  };

  const resetExtremeAura = async () => {
    try {
      setResettingAura(true);
      setResetAuraResult(null);
      const res = await adminApi.resetExtremeAura();
      setResetAuraResult(res.data);
      if (res.data.usersReset > 0) {
        showMessage('success', `${res.data.usersReset} utilisateur(s) réinitialisé(s)`);
        fetchUsers();
      } else {
        showMessage('success', 'Aucun utilisateur avec des valeurs extrêmes');
      }
    } catch (error: unknown) {
      console.error('Reset extreme aura failed:', error);
      const errorData = (error as { response?: { data?: { message?: string } } })?.response?.data;
      setResetAuraResult({
        success: false,
        message: errorData?.message || 'Erreur lors de la réinitialisation',
        usersReset: 0,
        users: []
      });
      showMessage('error', 'Erreur lors de la réinitialisation');
    } finally {
      setResettingAura(false);
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
      await adminApi.createBan({
        userId: banUserId,
        reason: banReason,
        type: banType,
        durationHours: banType === 'TEMPORARY' ? banDuration : undefined,
      });
      showMessage('success', 'Utilisateur banni avec succès');
      setBanDialogOpen(false);
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

  const approveUser = async (id: string) => {
    setApprovingUser(id);
    try {
      await adminApi.approveUser(id);
      setPendingUsers(prev => prev.filter(u => u.id !== id));
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
      showMessage('success', 'Demande rejetée');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setRejectingUser(null);
    }
  };

  const toggleBugStatus = async (bug: BugReport) => {
    setUpdatingBug(bug.id);
    try {
      const newStatus = bug.status === 'PENDING' ? 'DONE' : 'PENDING';
      const res = await adminApi.updateBugReport(bug.id, { status: newStatus });
      setBugReports(prev => prev.map(b => b.id === bug.id ? res.data.bugReport : b));
      showMessage('success', newStatus === 'DONE' ? 'Bug marqué comme résolu' : 'Bug marqué comme en attente');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setUpdatingBug(null);
    }
  };

  const deleteBug = async (id: string) => {
    setDeletingBug(id);
    try {
      await adminApi.deleteBugReport(id);
      setBugReports(prev => prev.filter(b => b.id !== id));
      showMessage('success', 'Rapport de bug supprimé');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setDeletingBug(null);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Parse effect string to get type and value
  const parseEffect = (effectStr: string | null): { type: string; value: string } => {
    if (!effectStr) return { type: 'USERNAME_COLOR', value: '' };
    try {
      const effect = JSON.parse(effectStr);
      return { type: effect.type || 'USERNAME_COLOR', value: effect.value || '' };
    } catch {
      return { type: 'USERNAME_COLOR', value: '' };
    }
  };

  // Open dialog for creating new item
  const openCreateItemDialog = () => {
    setEditingItem(null);
    setItemForm(defaultItemForm);
    setItemImageDataUrl('');
    setItemImageInputMode('upload');
    setItemDialogOpen(true);
  };

  // Open dialog for editing item
  const openEditItemDialog = (item: ShopItem) => {
    setEditingItem(item);
    const { type: effectType, value: effectValue } = parseEffect(item.effect);
    setItemForm({
      name: item.name,
      description: item.description,
      type: item.type,
      price: item.price,
      imageUrl: item.imageUrl || '',
      effectType,
      effectValue,
    });
    setItemImageDataUrl('');
    setItemImageInputMode(item.imageUrl ? 'url' : 'upload');
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
      // Build effect JSON
      const effect = JSON.stringify({
        type: itemForm.effectType,
        value: itemForm.effectValue,
      });

      let uploadedUrl = itemForm.imageUrl.trim() || undefined;
      if (itemImageInputMode === 'upload' && itemImageDataUrl) {
        const uploadRes = await uploadsApi.uploadImage({
          purpose: 'item',
          imageData: itemImageDataUrl,
        });
        uploadedUrl = uploadRes.data.url;
      }
      if (itemImageInputMode === 'url' && itemForm.imageUrl.trim()) {
        uploadedUrl = itemForm.imageUrl.trim();
      }

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
      setItemImageDataUrl('');
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

  // Open dialog for creating new NFT
  const openCreateNftDialog = () => {
    setEditingNft(null);
    setNftForm(defaultNftForm);
    setNftImageDataUrl('');
    setNftImageInputMode('upload');
    setNftDialogOpen(true);
  };

  // Open dialog for editing NFT
  const openEditNftDialog = (nft: Nft) => {
    setEditingNft(nft);
    setNftForm({
      name: nft.name,
      description: nft.description,
      price: nft.price,
      imageUrl: nft.imageUrl,
      rarity: nft.rarity,
    });
    setNftImageDataUrl('');
    setNftImageInputMode(nft.imageUrl ? 'url' : 'upload');
    setNftDialogOpen(true);
  };

  // Save NFT (create or update)
  const saveNft = async () => {
    if (!nftForm.name.trim() || !nftForm.description.trim()) {
      showMessage('error', 'Nom et description requis');
      return;
    }
    if (!nftImageDataUrl && !nftForm.imageUrl.trim()) {
      showMessage('error', 'Image requise');
      return;
    }

    setSavingNft(true);
    try {
      let uploadedUrl = nftForm.imageUrl.trim();
      if (nftImageInputMode === 'upload' && nftImageDataUrl) {
        const uploadRes = await uploadsApi.uploadImage({
          purpose: 'nft',
          imageData: nftImageDataUrl,
        });
        uploadedUrl = uploadRes.data.url;
      }
      if (nftImageInputMode === 'url' && nftForm.imageUrl.trim()) {
        uploadedUrl = nftForm.imageUrl.trim();
      }

      const data = {
        name: nftForm.name.trim(),
        description: nftForm.description.trim(),
        price: nftForm.price,
        imageUrl: uploadedUrl,
        rarity: nftForm.rarity,
      };

      if (editingNft) {
        const res = await adminApi.updateNft(editingNft.id, data);
        setNfts(prev => prev.map(n => n.id === editingNft.id ? res.data.nft : n));
        showMessage('success', 'NFT modifié');
      } else {
        const res = await adminApi.createNft(data);
        setNfts(prev => [res.data.nft, ...prev]);
        showMessage('success', 'NFT créé');
      }
      setNftDialogOpen(false);
      setNftImageDataUrl('');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setSavingNft(false);
    }
  };

  // Delete NFT
  const deleteNft = async (id: string) => {
    setDeletingNft(id);
    try {
      await adminApi.deleteNft(id);
      setNfts(prev => prev.filter(n => n.id !== id));
      showMessage('success', 'NFT supprimé');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setDeletingNft(null);
    }
  };

  const startEditing = (u: AdminUser) => {
    setEditingUser(u.id);
    setEditValues({
      username: u.username,
      aura: u.aura,
      money: u.money,
      dailyAuraLimit: u.dailyAuraLimit,
    });
    setEditPassword('');
  };

  const cancelEditing = () => {
    setEditingUser(null);
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
      setEditPassword('');
      showMessage('success', 'Utilisateur mis à jour');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setSaving(false);
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

  const createBadge = async () => {
    const name = badgeForm.name.trim();
    if (!name) {
      showMessage('error', 'Nom du badge requis');
      return;
    }
    try {
      setCreatingBadge(true);
      const res = await adminApi.createBadge({ name, color: badgeForm.color });
      setBadges((prev) => [res.data.badge, ...prev]);
      setBadgeForm({ name: '', color: badgeForm.color });
      showMessage('success', 'Badge créé');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setCreatingBadge(false);
    }
  };

  const fetchUserBadges = async (userId: string) => {
    try {
      setLoadingUserBadges(true);
      const res = await adminApi.getUserBadges(userId);
      setUserBadges(res.data.badges);
    } catch (error) {
      console.error('Failed to fetch user badges:', error);
      showMessage('error', 'Erreur lors du chargement des badges utilisateur');
    } finally {
      setLoadingUserBadges(false);
    }
  };

  const assignBadgeToUser = async () => {
    if (!badgeUserId || !badgeAssignId) return;
    try {
      setAssigningBadge(true);
      const res = await adminApi.addUserBadge(badgeUserId, { badgeId: badgeAssignId });
      if (res.data.userBadge && !res.data.alreadyAssigned) {
        setUserBadges((prev) => [res.data.userBadge, ...prev]);
        showMessage('success', 'Badge attribué');
      } else {
        showMessage('error', 'Badge déjà attribué');
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setAssigningBadge(false);
    }
  };

  const removeBadgeFromUser = async (badgeId: string) => {
    if (!badgeUserId) return;
    try {
      setRemovingBadgeId(badgeId);
      await adminApi.removeUserBadge(badgeUserId, badgeId);
      setUserBadges((prev) => prev.filter((userBadge) => userBadge.badge.id !== badgeId));
      showMessage('success', 'Badge retiré');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setRemovingBadgeId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
      {/* Message */}
      {message && (
        <div className={cn(
          "px-4 py-3 border",
          message.type === 'success' ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-destructive/30 bg-destructive/10 text-destructive'
        )}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-8">
        <TabsList className="bg-transparent border border-border/30 p-1">
          <TabsTrigger 
            value="pending"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Demandes
            {pendingUsers.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                {pendingUsers.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="users"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger 
            value="items"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Objets
          </TabsTrigger>
          <TabsTrigger
            value="badges"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            <Award className="h-4 w-4 mr-1" />
            Badges
          </TabsTrigger>
          <TabsTrigger 
            value="chat"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Chat
          </TabsTrigger>
          <TabsTrigger
            value="bugs"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Bugs
            {bugReports.filter(b => b.status === 'PENDING').length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-destructive/20 text-destructive rounded">
                {bugReports.filter(b => b.status === 'PENDING').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="bans"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Bannissements
            {bans.filter(b => b.isActive).length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-destructive/20 text-destructive rounded">
                {bans.filter(b => b.isActive).length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            <ScrollText className="h-4 w-4 mr-1" />
            Logs
            {logStats && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded">
                {logStats.total.toLocaleString()}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="announcement"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Annonce
          </TabsTrigger>
          <TabsTrigger
            value="attention"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            Attention
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Paramètres
          </TabsTrigger>
        </TabsList>

        {/* Pending Users Tab */}
        <TabsContent value="pending" className="space-y-6">
          <div className="h-px bg-border" />
          
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Demandes d'inscription en attente
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserPlus className="h-4 w-4" />
              <span>{pendingUsers.length} en attente</span>
            </div>
          </div>

          {loadingPending ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <UserPlus className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground">
                Aucune demande en attente
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {pendingUsers.map((u) => (
                <div
                  key={u.id}
                  className="py-4 border-b border-border/30 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{u.username}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                          En attente
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {u.email}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        Demandé le {new Date(u.createdAt).toLocaleDateString('fr-FR', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approveUser(u.id)}
                        disabled={approvingUser === u.id}
                        className="h-8 border-green-500/50 text-green-500 hover:bg-green-500/10"
                      >
                        {approvingUser === u.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Approuver
                          </>
                        )}
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                            disabled={rejectingUser === u.id}
                          >
                            {rejectingUser === u.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <UserX className="h-4 w-4 mr-1" />
                                Rejeter
                              </>
                            )}
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
                            <AlertDialogAction
                              onClick={() => rejectUser(u.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Rejeter
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="h-px bg-border" />
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun utilisateur
            </p>
          ) : (
            <div className="space-y-0">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={cn(
                    "py-4 border-b border-border/30 last:border-0",
                    u.isAdmin && "bg-muted/20 -mx-4 px-4"
                  )}
                >
                  {editingUser === u.id ? (
                    // Edit mode
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{u.username}</span>
                          {u.isAdmin && (
                            <span className="ml-2 text-xs text-amber-500">admin</span>
                          )}
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditing}
                            className="h-8 border-border/50"
                          >
                            Annuler
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveUser(u.id)}
                            disabled={saving}
                            className="h-8"
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Pseudo</label>
                        <Input
                          type="text"
                          value={editValues.username}
                          onChange={(e) => setEditValues(prev => ({ ...prev, username: e.target.value }))}
                          className="h-9 bg-transparent border-border/50"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Aura</label>
                          <Input
                            type="number"
                            value={editValues.aura}
                            onChange={(e) => setEditValues(prev => ({ ...prev, aura: parseInt(e.target.value) || 0 }))}
                            className="h-9 bg-transparent border-border/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Argent</label>
                          <Input
                            type="number"
                            value={editValues.money}
                            onChange={(e) => setEditValues(prev => ({ ...prev, money: parseInt(e.target.value) || 0 }))}
                            className="h-9 bg-transparent border-border/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Limite aura/jour</label>
                          <Input
                            type="number"
                            value={editValues.dailyAuraLimit}
                            onChange={(e) => setEditValues(prev => ({ ...prev, dailyAuraLimit: parseInt(e.target.value) || 0 }))}
                            className="h-9 bg-transparent border-border/50"
                            min={0}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Nouveau mot de passe</label>
                        <Input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          className="h-9 bg-transparent border-border/50"
                          placeholder="Laisser vide pour ne pas changer"
                        />
                      </div>
                    </div>
                  ) : (
                    // Display mode
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{u.username}</span>
                            {u.isAdmin && (
                              <span className="text-xs text-amber-500">admin</span>
                            )}
                            {u.isChatMuted && (
                              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                muet
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                          <div className="text-right">
                            <p className="tabular-nums">{u.aura.toLocaleString()} aura</p>
                          </div>
                          <div className="text-right">
                            <p className="tabular-nums">${u.money.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="tabular-nums">{u.dailyAuraGiven}/{u.dailyAuraLimit} donné</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditing(u)}
                            className="h-8 border-border/50"
                          >
                            Modifier
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openInventory(u)}
                            className="h-8 border-border/50"
                          >
                            <Package className="h-4 w-4 mr-1" />
                            Inventaire
                          </Button>

                          {!u.isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleChatMute(u)}
                              disabled={mutingUser === u.id}
                              className={cn(
                                "h-8 border-border/50",
                                u.isChatMuted && "border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                              )}
                            >
                              {mutingUser === u.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <ShieldOff className="h-4 w-4 mr-1" />
                                  {u.isChatMuted ? 'Démute' : 'Mute'}
                                </>
                              )}
                            </Button>
                          )}

                          {!u.isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openBanDialog(u.id)}
                              className="h-8 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                            >
                              <BanIcon className="h-4 w-4" />
                            </Button>
                          )}

                          {!u.isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                                  disabled={deleting === u.id}
                                >
                                  {deleting === u.id ? (
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
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-6">
          <div className="h-px bg-border" />
          
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Gestion des objets de la boutique
            </h2>
            <Button
              onClick={openCreateItemDialog}
              className="h-9"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvel objet
            </Button>
          </div>

          {loadingItems ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun objet créé
            </p>
          ) : (
            <div className="space-y-0">
              {items.map((item) => {
                const { type: effectType } = parseEffect(item.effect);
                const effectLabel = EFFECT_TYPES.find(e => e.value === effectType)?.label || effectType;
                
                return (
                  <div
                    key={item.id}
                    className="py-4 border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        {item.imageUrl ? (
                          <img 
                            src={resolveImageUrl(item.imageUrl)} 
                            alt={item.name}
                            className="w-10 h-10 object-cover rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-muted/30 flex items-center justify-center rounded">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{item.name}</span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">
                              {item.type}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.description}
                          </p>
                          <p className="text-xs text-muted-foreground/60">
                            Effet: {effectLabel}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right text-sm text-muted-foreground">
                          <p className="tabular-nums">${item.price}</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditItemDialog(item)}
                            className="h-8 border-border/50"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                                disabled={deletingItem === item.id}
                              >
                                {deletingItem === item.id ? (
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
                                  Supprimer {item.name} ?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  L'objet sera supprimé de la boutique. Les utilisateurs qui le possèdent le garderont.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteItem(item.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="h-px bg-border mt-10" />

          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Gestion des NFTs du marché
            </h2>
            <Button
              onClick={openCreateNftDialog}
              className="h-9"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouveau NFT
            </Button>
          </div>

          {loadingNfts ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : nfts.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun NFT créé
            </p>
          ) : (
            <div className="space-y-0">
              {nfts.map((nft) => (
                <div
                  key={nft.id}
                  className="py-4 border-b border-border/30 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {nft.imageUrl ? (
                        <img 
                          src={resolveImageUrl(nft.imageUrl)} 
                          alt={nft.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted/30 flex items-center justify-center rounded">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{nft.name}</span>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">
                            {NFT_RARITY_LABELS[nft.rarity] || nft.rarity}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {nft.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right text-sm text-muted-foreground">
                        <p className="tabular-nums">${nft.price}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditNftDialog(nft)}
                          className="h-8 border-border/50"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                              disabled={deletingNft === nft.id}
                            >
                              {deletingNft === nft.id ? (
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
                                Supprimer {nft.name} ?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Le NFT sera supprimé du marché. Les utilisateurs qui l'ont acheté le garderont.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteNft(nft.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Badges Tab */}
        <TabsContent value="badges" className="space-y-6">
          <div className="h-px bg-border" />

          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4 border border-border/40 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
                  Creer un badge
                </h2>
                <span className="text-xs text-muted-foreground">
                  {badges.length} existants
                </span>
              </div>
              <div className="space-y-3">
                <Input
                  value={badgeForm.name}
                  onChange={(e) => setBadgeForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nom du badge"
                />
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={badgeForm.color}
                    onChange={(e) => setBadgeForm((prev) => ({ ...prev, color: e.target.value }))}
                    className="h-10 w-16 rounded border border-border/40 bg-transparent"
                    aria-label="Couleur du badge"
                  />
                  <Input
                    value={badgeForm.color}
                    onChange={(e) => setBadgeForm((prev) => ({ ...prev, color: e.target.value }))}
                    placeholder="#F59E0B"
                  />
                  <Button onClick={createBadge} disabled={creatingBadge}>
                    {creatingBadge ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    <span className="ml-2">Ajouter</span>
                  </Button>
                </div>
                {badgeForm.name && (
                  <span
                    className="inline-flex text-xs uppercase tracking-wide px-2.5 py-1 rounded-full border"
                    style={{ color: badgeForm.color, borderColor: badgeForm.color }}
                  >
                    {badgeForm.name}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wide">
                  Badges disponibles
                </h3>
                {loadingBadges ? (
                  <div className="flex justify-center py-6">
                    <div className="w-1 h-6 bg-foreground/20 animate-pulse" />
                  </div>
                ) : badges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun badge cree.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {badges.map((badge) => (
                      <span
                        key={badge.id}
                        className="text-xs uppercase tracking-wide px-2.5 py-1 rounded-full border"
                        style={{ color: badge.color, borderColor: badge.color }}
                      >
                        {badge.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 border border-border/40 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
                  Attribuer un badge
                </h2>
                <span className="text-xs text-muted-foreground">
                  {users.length} utilisateurs
                </span>
              </div>
              <div className="space-y-3">
                <Select value={badgeUserId} onValueChange={(value) => {
                  setBadgeUserId(value);
                  setBadgeAssignId('');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un utilisateur" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-3">
                  <Select value={badgeAssignId} onValueChange={setBadgeAssignId} disabled={!badgeUserId || badges.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un badge" />
                    </SelectTrigger>
                    <SelectContent>
                      {badges.map((badge) => (
                        <SelectItem key={badge.id} value={badge.id}>
                          {badge.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={assignBadgeToUser}
                    disabled={!badgeUserId || !badgeAssignId || assigningBadge}
                  >
                    {assigningBadge ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    <span className="ml-2">Attribuer</span>
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wide">
                  Badges de l'utilisateur
                </h3>
                {!badgeUserId ? (
                  <p className="text-sm text-muted-foreground">Selectionne un utilisateur.</p>
                ) : loadingUserBadges ? (
                  <div className="flex justify-center py-6">
                    <div className="w-1 h-6 bg-foreground/20 animate-pulse" />
                  </div>
                ) : userBadges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun badge attribue.</p>
                ) : (
                  <div className="space-y-2">
                    {userBadges.map((userBadge) => (
                      <div key={userBadge.id} className="flex items-center justify-between border border-border/30 px-3 py-2">
                        <span
                          className="text-xs uppercase tracking-wide px-2.5 py-1 rounded-full border"
                          style={{ color: userBadge.badge.color, borderColor: userBadge.badge.color }}
                        >
                          {userBadge.badge.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBadgeFromUser(userBadge.badge.id)}
                          disabled={removingBadgeId === userBadge.badge.id}
                        >
                          {removingBadgeId === userBadge.badge.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          <span className="ml-2">Retirer</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat" className="space-y-6">
          <div className="h-px bg-border" />
          
          <section className="space-y-6">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Gestion du chat
            </h2>
            
            <div className="p-6 border border-border/30 space-y-4">
              <div className="flex items-start gap-4">
                <MessageSquareX className="h-8 w-8 text-muted-foreground shrink-0 mt-1" />
                <div className="space-y-2">
                  <h3 className="font-medium">Vider le chat</h3>
                  <p className="text-sm text-muted-foreground">
                    Supprime définitivement tous les messages du chat global. Cette action est irréversible.
                  </p>
                </div>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    disabled={clearingChat}
                  >
                    {clearingChat ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Suppression...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Vider le chat
                      </>
                    )}
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
                    <AlertDialogAction
                      onClick={clearChat}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Vider le chat
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </section>
        </TabsContent>

        {/* Bugs Tab */}
        <TabsContent value="bugs" className="space-y-6">
          <div className="h-px bg-border" />
          
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Rapports de bugs des utilisateurs
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bug className="h-4 w-4" />
              <span>{bugReports.filter(b => b.status === 'PENDING').length} en attente</span>
            </div>
          </div>

          {loadingBugs ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : bugReports.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun rapport de bug
            </p>
          ) : (
            <div className="space-y-0">
              {bugReports.map((bug) => (
                <div
                  key={bug.id}
                  className={cn(
                    "py-4 border-b border-border/30 last:border-0",
                    bug.status === 'DONE' && "opacity-60"
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "font-medium",
                            bug.status === 'DONE' && "line-through"
                          )}>
                            {bug.title}
                          </span>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded",
                            bug.status === 'PENDING' 
                              ? "bg-amber-500/20 text-amber-400" 
                              : "bg-green-500/20 text-green-400"
                          )}>
                            {bug.status === 'PENDING' ? 'En attente' : 'Résolu'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Par <span className="text-foreground">{bug.user.username}</span> • {new Date(bug.createdAt).toLocaleDateString('fr-FR', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleBugStatus(bug)}
                          disabled={updatingBug === bug.id}
                          className={cn(
                            "h-8",
                            bug.status === 'DONE' 
                              ? "border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                              : "border-green-500/50 text-green-500 hover:bg-green-500/10"
                          )}
                        >
                          {updatingBug === bug.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : bug.status === 'DONE' ? (
                            <>
                              <X className="h-4 w-4 mr-1" />
                              Rouvrir
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Résolu
                            </>
                          )}
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                              disabled={deletingBug === bug.id}
                            >
                              {deletingBug === bug.id ? (
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
                                Supprimer ce rapport ?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Le rapport de bug sera définitivement supprimé.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteBug(bug.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/20 p-3 rounded">
                      {bug.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Bans Tab */}
        <TabsContent value="bans" className="space-y-6">
          <div className="h-px bg-border" />

          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Gestion des bannissements
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BanIcon className="h-4 w-4" />
              <span>{bans.filter(b => b.isActive).length} actifs</span>
            </div>
          </div>

          {loadingBans ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : bans.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun bannissement
            </p>
          ) : (
            <div className="space-y-0">
              {bans.map((ban) => (
                <div
                  key={ban.id}
                  className={cn(
                    "py-4 border-b border-border/30 last:border-0",
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
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          {/* Category Pills - Single Line */}
          {logStats && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(logStats.byType).map(([type, count]) => {
                const config = LOG_TYPE_CONFIG[type];
                if (!config) return null;
                const Icon = config.icon;
                const isSelected = logFilter.type === type;

                return (
                  <button
                    key={type}
                    onClick={() => {
                      const newType = logFilter.type === type ? 'ALL' : type;
                      setLogFilter(prev => ({ ...prev, type: newType, gameType: 'ALL' }));
                      setTimeout(() => fetchLogs(0, newType, 'ALL'), 0);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                      isSelected
                        ? `${config.bgColor} text-white`
                        : `border ${config.borderColor} ${config.color} bg-transparent hover:bg-muted/30`
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
                  </button>
                );
              })}
            </div>
          )}

          {/* Game Type Filters (show when GAME type is selected) */}
          {logFilter.type === 'GAME' && (
            <div className="flex flex-wrap gap-2">
              {GAME_TYPES.map((game) => {
                const isSelected = logFilter.gameType === game.value;
                return (
                  <button
                    key={game.value}
                    onClick={() => {
                      const newGameType = logFilter.gameType === game.value ? 'ALL' : game.value;
                      setLogFilter(prev => ({ ...prev, gameType: newGameType }));
                      setTimeout(() => fetchLogs(0, undefined, newGameType), 0);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                      isSelected
                        ? "bg-purple-500 text-white"
                        : "border border-purple-500 text-purple-400 bg-transparent hover:bg-muted/30"
                    )}
                  >
                    <Gamepad2 className="h-3 w-3" />
                    <span>{game.label}</span>
                  </button>
                );
              })}
            </div>
          )}

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
                  Choisis une date de début. Les filtres actuels seront appliqués.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <label className="text-sm font-medium">Depuis le</label>
                <Input
                  type="date"
                  value={downloadLogsStartDate}
                  onChange={(e) => setDownloadLogsStartDate(e.target.value)}
                  className="h-9"
                />
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
                const actionLabel = ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ');

                return (
                  <div key={log.id}>
                    {/* Collapsed single-line view */}
                    <button
                      onClick={() => toggleLogExpand(log.id)}
                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/20 transition-colors text-left"
                    >
                      {/* Type pastille */}
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0",
                        config?.bgColor || 'bg-muted',
                        "text-white"
                      )}>
                        <Icon className="h-2.5 w-2.5" />
                        {config?.label || log.type}
                      </span>

                      {/* Action + User summary */}
                      <span className="text-sm truncate flex-1">
                        <span className="font-medium">{actionLabel}</span>
                        {log.username && (
                          <span className="text-muted-foreground"> par </span>
                        )}
                        {log.username && (
                          <span className="text-foreground">{log.username}</span>
                        )}
                        {log.targetName && (
                          <span className="text-muted-foreground"> → {log.targetName}</span>
                        )}
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
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 bg-muted/10 border-t border-border/20">
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

                          {log.ipAddress && (
                            <>
                              <div className="text-muted-foreground">Adresse IP</div>
                              <div className="font-mono">{log.ipAddress}</div>
                            </>
                          )}

                          {log.userId && (
                            <>
                              <div className="text-muted-foreground">ID utilisateur</div>
                              <div className="font-mono text-[11px]">{log.userId}</div>
                            </>
                          )}

                          {log.targetId && (
                            <>
                              <div className="text-muted-foreground">ID cible</div>
                              <div className="font-mono text-[11px]">{log.targetId}</div>
                            </>
                          )}

                          {/* Metadata with human-readable labels */}
                          {log.metadata && Object.entries(log.metadata).map(([key, value]) => (
                            <div key={key} className="contents">
                              <div className="text-muted-foreground">{METADATA_LABELS[key] || key}</div>
                              <div>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</div>
                            </div>
                          ))}

                          {/* Details with human-readable labels */}
                          {log.details && !log.metadata && Object.entries(log.details).map(([key, value]) => (
                            <div key={key} className="contents">
                              <div className="text-muted-foreground">{METADATA_LABELS[key] || key}</div>
                              <div>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</div>
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

        {/* Announcement Tab */}
        <TabsContent value="announcement" className="space-y-6">
          <div className="h-px bg-border" />

          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Annonce top bar
            </h2>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ce message s'affiche pour tous les utilisateurs dans la barre du haut, à côté du bouton de sidebar.
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Message</label>
                <span className={cn(
                  'text-xs',
                  announcementMessage.length >= ANNOUNCEMENT_MAX_LENGTH ? 'text-amber-400' : 'text-muted-foreground'
                )}>
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
              <p className="text-xs text-muted-foreground">
                Laissez vide pour masquer l'annonce.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={saveAnnouncement}
                disabled={savingAnnouncement}
              >
                {savingAnnouncement ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Sauvegarder l'annonce
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Attention Tab */}
        <TabsContent value="attention" className="space-y-6">
          <div className="h-px bg-border" />

          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Maintenance
            </h2>
          </div>

          {loadingSettings ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-border/30 rounded-lg">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Activer la maintenance</p>
                  <p className="text-xs text-muted-foreground">
                    Affiche la page de maintenance sur tout le site (hors admin).
                  </p>
                </div>
                <Switch
                  checked={maintenanceEnabled}
                  onCheckedChange={setMaintenanceEnabled}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Raison</label>
                <Textarea
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  placeholder="Ex: Mise à jour technique en cours."
                  className="min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  Ce texte s'affichera sur la page de maintenance.
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={saveMaintenance}
                  disabled={savingMaintenance}
                >
                  {savingMaintenance ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Sauvegarder la maintenance
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="h-px bg-border" />

          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Paramètres de jeu
            </h2>
          </div>

          {loadingSettings ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Word Bomb Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Word Bomb - Seuils WPP (Words Per Prompt)</h3>
                <p className="text-sm text-muted-foreground">
                  Les seuils déterminent la difficulté des prompts en fonction du nombre de mots valides.
                  Un prompt avec plus de mots est plus facile car il y a plus de réponses possibles.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 p-4 border border-border/30 rounded-lg bg-green-500/5">
                    <label className="text-sm font-medium text-green-400">Facile (mots minimum)</label>
                    <Input
                      type="number"
                      value={settingsForm.bombparty_wpp_easy}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, bombparty_wpp_easy: e.target.value }))}
                      className="bg-transparent"
                      min={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Prompts avec {settingsForm.bombparty_wpp_easy}+ mots valides
                    </p>
                  </div>

                  <div className="space-y-2 p-4 border border-border/30 rounded-lg bg-yellow-500/5">
                    <label className="text-sm font-medium text-yellow-400">Moyen (mots minimum)</label>
                    <Input
                      type="number"
                      value={settingsForm.bombparty_wpp_medium}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, bombparty_wpp_medium: e.target.value }))}
                      className="bg-transparent"
                      min={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Prompts avec {settingsForm.bombparty_wpp_medium}-{parseInt(settingsForm.bombparty_wpp_easy) - 1 || '?'} mots
                    </p>
                  </div>

                  <div className="space-y-2 p-4 border border-border/30 rounded-lg bg-red-500/5">
                    <label className="text-sm font-medium text-red-400">Difficile (mots minimum)</label>
                    <Input
                      type="number"
                      value={settingsForm.bombparty_wpp_hard}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, bombparty_wpp_hard: e.target.value }))}
                      className="bg-transparent"
                      min={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Prompts avec {settingsForm.bombparty_wpp_hard}-{parseInt(settingsForm.bombparty_wpp_medium) - 1 || '?'} mots
                    </p>
                  </div>
                </div>
              </div>

              {/* 3-Letter Start Round */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Apparition des prompts à 3 lettres</h3>
                <p className="text-sm text-muted-foreground">
                  Les prompts à 3 lettres sont plus difficiles. Définissez à partir de quel round ils commencent à apparaître.
                </p>

                <div className="space-y-2 max-w-xs p-4 border border-border/30 rounded-lg">
                  <label className="text-sm font-medium">Round de début</label>
                  <Input
                    type="number"
                    value={settingsForm.bombparty_3letter_start_round}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, bombparty_3letter_start_round: e.target.value }))}
                    className="bg-transparent"
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Les prompts à 3 lettres apparaissent à partir du round {settingsForm.bombparty_3letter_start_round}
                  </p>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-border/30">
                <Button
                  onClick={saveSettings}
                  disabled={savingSettings}
                >
                  {savingSettings ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Sauvegarder les paramètres
                </Button>
              </div>

              {/* Info Note */}
              <div className="p-4 border border-border/30 rounded-lg bg-muted/20">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Les modifications des seuils WPP prendront effet immédiatement pour les nouvelles parties.
                  Pour régénérer les prompts avec les nouveaux seuils, exécutez <code className="bg-muted px-1 rounded">npm run db:seed-bombparty</code> dans le backend.
                </p>
              </div>

              {/* Reset Extreme Aura Section */}
              <div className="space-y-4 pt-8 border-t border-border/30">
                <h3 className="text-lg font-medium">Réinitialiser les valeurs d'aura extrêmes</h3>
                <p className="text-sm text-muted-foreground">
                  Réinitialise à 0 l'aura des utilisateurs ayant des valeurs supérieures à 1 milliard (valeurs corrompues ou overflow).
                </p>

                <div className="flex items-center gap-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={resettingAura}
                        className="border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
                      >
                        {resettingAura ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Réinitialisation en cours...
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Réinitialiser les valeurs extrêmes
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-orange-500" />
                          Réinitialiser les valeurs d'aura extrêmes ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action va réinitialiser à 0 l'aura de tous les utilisateurs ayant des valeurs supérieures à 1 milliard. Cette action est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={resetExtremeAura}
                          className="bg-orange-500 hover:bg-orange-600"
                        >
                          Réinitialiser
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {resetAuraResult && (
                  <div className={cn(
                    "p-4 border rounded-lg space-y-2",
                    resetAuraResult.success
                      ? "border-green-500/50 bg-green-500/10"
                      : "border-red-500/50 bg-red-500/10"
                  )}>
                    <p className={cn(
                      "text-sm font-medium",
                      resetAuraResult.success ? "text-green-400" : "text-red-400"
                    )}>
                      {resetAuraResult.success ? 'Réinitialisation réussie' : 'Échec de la réinitialisation'}
                    </p>
                    <p className="text-sm text-muted-foreground">{resetAuraResult.message}</p>
                    {resetAuraResult.users.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted-foreground">Utilisateurs réinitialisés:</p>
                        <ul className="text-xs space-y-1">
                          {resetAuraResult.users.map(u => (
                            <li key={u.id} className="flex items-center gap-2">
                              <span className="font-medium">{u.username}</span>
                              <span className="text-muted-foreground">-</span>
                              <span className="text-red-400">{BigInt(u.oldAura).toLocaleString()} aura</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Server Deployment Section */}
              <div className="space-y-4 pt-8 border-t border-border/30">
                <h3 className="text-lg font-medium">Déploiement serveur</h3>
                <p className="text-sm text-muted-foreground">
                  Exécute le script de déploiement sur le serveur (<code className="bg-muted px-1 rounded">/var/scripts/deploy.sh</code>).
                </p>

                <div className="flex items-center gap-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={deploying}
                        className="border-blue-500/50 text-blue-500 hover:bg-blue-500/10"
                      >
                        {deploying ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Déploiement en cours...
                          </>
                        ) : (
                          <>
                            <Rocket className="h-4 w-4 mr-2" />
                            Déployer
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <Rocket className="h-5 w-5 text-blue-500" />
                          Lancer le déploiement ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action va exécuter le script de déploiement sur le serveur. Le site pourrait être temporairement indisponible pendant le processus.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={runDeploy}
                          className="bg-blue-500 hover:bg-blue-600"
                        >
                          Déployer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {deployResult && (
                  <div className={cn(
                    "p-4 border rounded-lg space-y-2",
                    deployResult.success
                      ? "border-green-500/50 bg-green-500/10"
                      : "border-red-500/50 bg-red-500/10"
                  )}>
                    <p className={cn(
                      "text-sm font-medium",
                      deployResult.success ? "text-green-400" : "text-red-400"
                    )}>
                      {deployResult.success ? 'Déploiement réussi' : 'Échec du déploiement'}
                    </p>
                    <p className="text-sm text-muted-foreground">{deployResult.message}</p>
                    {deployResult.stdout && (
                      <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto max-h-40 overflow-y-auto">
                        {deployResult.stdout}
                      </pre>
                    )}
                    {deployResult.stderr && (
                      <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto max-h-40 overflow-y-auto text-red-400">
                        {deployResult.stderr}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
              <h3 className="text-sm text-muted-foreground tracking-wide uppercase">
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
                            {item.name} • {ITEM_TYPE_LABELS[item.type] || item.type}
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
                <h3 className="text-sm text-muted-foreground tracking-wide uppercase">
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
                      ? EFFECT_TYPES.find((effectItem) => effectItem.value === effect.type)?.label || effect.type
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
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                  {ITEM_TYPE_LABELS[inventoryItem.item.type] || inventoryItem.item.type}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Modifier l\'objet' : 'Créer un objet'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Modifiez les propriétés de l\'objet.' : 'Créez un nouvel objet pour la boutique.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Nom</label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nom de l'objet"
                className="bg-transparent"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Description</label>
              <Textarea
                value={itemForm.description}
                onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description de l'objet"
                className="bg-transparent resize-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Type</label>
                <Select
                  value={itemForm.type}
                  onValueChange={(value: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE') => 
                    setItemForm(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger className="bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COSMETIC">Cosmétique</SelectItem>
                    <SelectItem value="CONSUMABLE">Consommable</SelectItem>
                    <SelectItem value="UPGRADE">Amélioration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Prix ($)</label>
                <Input
                  type="number"
                  value={itemForm.price}
                  onChange={(e) => setItemForm(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                  className="bg-transparent"
                  min={0}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Image (optionnel)</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={itemImageInputMode === 'upload' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setItemImageInputMode('upload')}
                >
                  Upload
                </Button>
                <Button
                  type="button"
                  variant={itemImageInputMode === 'url' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setItemImageInputMode('url')}
                >
                  URL
                </Button>
              </div>
              {itemImageInputMode === 'upload' ? (
                <Input
                  type="file"
                  accept="image/*"
                  className="bg-transparent"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                      setItemImageDataUrl('');
                      return;
                    }
                    try {
                      const dataUrl = await readFileAsDataUrl(file);
                      setItemImageDataUrl(dataUrl);
                    } catch (error) {
                      console.error('Failed to read image:', error);
                      setItemImageDataUrl('');
                    }
                  }}
                />
              ) : (
                <Input
                  value={itemForm.imageUrl}
                  onChange={(e) => setItemForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="https://..."
                  className="bg-transparent"
                />
              )}
              {(itemImageDataUrl || itemForm.imageUrl) && (
                <div className="relative">
                  <img
                    src={
                      itemImageInputMode === 'upload'
                        ? itemImageDataUrl || ''
                        : resolveImageUrl(itemForm.imageUrl)
                    }
                    alt="Preview"
                    className="max-h-40 rounded-md object-cover border border-border/30"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setItemImageDataUrl('');
                      setItemForm(prev => ({ ...prev, imageUrl: '' }));
                    }}
                    className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center bg-background/80 border border-border rounded-full text-muted-foreground hover:text-foreground"
                    aria-label="Retirer l'image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Effet</label>
              <Select
                value={itemForm.effectType}
                onValueChange={(value) => setItemForm(prev => ({ ...prev, effectType: value }))}
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
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setItemDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={saveItem}
              disabled={savingItem}
            >
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

      {/* NFT Create/Edit Dialog */}
      <Dialog open={nftDialogOpen} onOpenChange={setNftDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingNft ? 'Modifier le NFT' : 'Créer un NFT'}
            </DialogTitle>
            <DialogDescription>
              {editingNft ? 'Modifiez les propriétés du NFT.' : 'Ajoutez un NFT au marché.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Nom</label>
              <Input
                value={nftForm.name}
                onChange={(e) => setNftForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nom du NFT"
                className="bg-transparent"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Description</label>
              <Textarea
                value={nftForm.description}
                onChange={(e) => setNftForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description du NFT"
                className="bg-transparent resize-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Rareté</label>
                <Select
                  value={nftForm.rarity}
                  onValueChange={(value) => setNftForm(prev => ({ ...prev, rarity: value as NftFormData['rarity'] }))}
                >
                  <SelectTrigger className="bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NFT_RARITY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Prix ($)</label>
                <Input
                  type="number"
                  value={nftForm.price}
                  onChange={(e) => setNftForm(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                  className="bg-transparent"
                  min={0}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Image</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={nftImageInputMode === 'upload' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNftImageInputMode('upload')}
                >
                  Upload
                </Button>
                <Button
                  type="button"
                  variant={nftImageInputMode === 'url' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNftImageInputMode('url')}
                >
                  URL
                </Button>
              </div>
              {nftImageInputMode === 'upload' ? (
                <Input
                  type="file"
                  accept="image/*"
                  className="bg-transparent"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                      setNftImageDataUrl('');
                      return;
                    }
                    try {
                      const dataUrl = await readFileAsDataUrl(file);
                      setNftImageDataUrl(dataUrl);
                    } catch (error) {
                      console.error('Failed to read image:', error);
                      setNftImageDataUrl('');
                    }
                  }}
                />
              ) : (
                <Input
                  value={nftForm.imageUrl}
                  onChange={(e) => setNftForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="https://..."
                  className="bg-transparent"
                />
              )}
              {(nftImageDataUrl || nftForm.imageUrl) && (
                <div className="relative">
                  <img
                    src={
                      nftImageInputMode === 'upload'
                        ? nftImageDataUrl || ''
                        : resolveImageUrl(nftForm.imageUrl)
                    }
                    alt="Preview"
                    className="max-h-40 rounded-md object-cover border border-border/30"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setNftImageDataUrl('');
                      setNftForm(prev => ({ ...prev, imageUrl: '' }));
                    }}
                    className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center bg-background/80 border border-border rounded-full text-muted-foreground hover:text-foreground"
                    aria-label="Retirer l'image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNftDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={saveNft}
              disabled={savingNft}
            >
              {savingNft ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {editingNft ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

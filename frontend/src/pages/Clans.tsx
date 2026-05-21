import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Axe, AlertTriangle, Check, ChevronDown, ChevronUp, Crown, History, Landmark, Loader2, LogOut, Lock, Megaphone, MessageSquare, Package, Pencil, Plus, Send, Settings2, Shield, Sparkles, Swords, Target, Trash2, UserX, X, LayoutGrid, Layout } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClanActiveEffect,
  ClanBankContribution,
  ClanChatMessage,
  ClanDetail,
  ClanEventMiniGame,
  ClanEventView,
  ClanOwnedItem,
  ClanPumpUpMessage,
  ClanRole,
  ClanWarParticipantStats,
  ClanSummary,
  ClanWarDefenseState,
  ClanWarGamesStatus,
  ClanWarState,
  ClanWarActionType,
  clansApi,
  uploadUserImage,
} from '@/services/api';
import { MemoryGame } from '@/components/clans/war-games/MemoryGame';
import { BombDropGame } from '@/components/clans/war-games/BombDropGame';
import { NavalWarfareGame } from '@/components/clans/war-games/NavalWarfareGame';
import { PageShell } from '@/components/layout/PageShell';
import { CenteredSkeletonCard, ListSkeleton } from '@/components/ui/loading-skeletons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImagePicker } from '@/components/ui/image-picker';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { UsernameDisplay } from '@/components/ui/username-display';
import { ClanTag, ClanTagStyle, DEFAULT_CLAN_TAG_STYLE, getClanTagBackground, parseClanTagStyle } from '@/components/clans/ClanTag';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { toast } from '@/hooks/use-toast';
import { SPACING, TYPOGRAPHY } from '@/lib/design-system';
import { prepareImageUploadPayload } from '@/lib/image-upload';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import {
  formatAura,
  formatDate,
  formatEffectCooldown,
  formatCountdown,
  formatMoney,
  formatSignedValue,
  getAvatarFallback,
  getClanEventActivityLabel,
  getClanEventStatusLabel,
  getStatusLabel,
  getStatusVariant,
} from './clans/formatters';
import {
  getWarDefenseSet,
  getWarEnemyDefenseSet,
  getWarOpponent,
  getWarOpponentParticipantStats,
  getWarOwnSide,
  getWarParticipantStats,
  getWarResultBadge,
} from './clans/war-utils';

const panelClassName = 'rounded-2xl border border-border/50 bg-background shadow-none';
const mutedPanelClassName = 'rounded-2xl border border-border/50 bg-muted/15 shadow-none';

const BankContributionRow = ({ entry }: { entry: ClanBankContribution }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-3">
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-9 w-9">
        <AvatarImage src={resolveImageUrl(entry.user.profilePicture)} alt={entry.user.username} />
        <AvatarFallback>{getAvatarFallback(entry.user.username)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="text-sm font-medium">
          <UsernameDisplay username={entry.user.username} usernameColor={entry.user.usernameColor} />
        </div>
        <div className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</div>
      </div>
    </div>
    <div className="text-right">
      <div className="text-sm font-semibold text-emerald-600">{formatSignedValue(entry.amount)}</div>
      <div className="text-xs text-muted-foreground">ajoutés à la banque</div>
    </div>
  </div>
);

const SectionTitle = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="space-y-1">
      <h2 className="text-base font-medium tracking-tight">{title}</h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
    {action ? <div className="flex items-center gap-2">{action}</div> : null}
  </div>
);

const ClanEffectBadge = ({ effect }: { effect: ClanActiveEffect }) => (
  <div
    className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 shadow-sm"
    title={`${effect.name} • +${effect.value}%${effect.activeUntil ? ` • ${formatEffectCooldown(effect)}` : ""}`}
  >
    {effect.type === 'CLAN_GAME_MONEY_BOOST' ? <CurrencyIcon type="money" className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
  </div>
);

const UPGRADE_ICONS: Record<string, string> = { FORTRESS: '🏰', ARMORY: '⚔️', BANNER: '🚩' };
const UPGRADE_EFFECTS: Record<string, (level: number) => string> = {
  FORTRESS: (level) => level > 0 ? `Réduit les bombardements ennemis de ${level * 4} pts` : 'Non construite — à améliorer via le jeu mémoire',
  ARMORY: (level) => level > 0 ? `Augmente vos bombardements de ${level * 3} pts` : 'Non construite — à améliorer via le jeu mémoire',
  BANNER: (level) => level > 0 ? `Booste vos tirs navals de ${level * 2} pts` : 'Non construite — à améliorer via le jeu mémoire',
};

const UpgradeRow = ({ defense }: { defense: ClanWarDefenseState }) => (
  <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
    <span className="text-lg">{UPGRADE_ICONS[defense.type] ?? '🏛️'}</span>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{defense.label}</span>
        <div className="flex gap-0.5">
          {[1, 2, 3].map((lvl) => (
            <div
              key={lvl}
              className={cn('h-1.5 w-4 rounded-full transition-colors', defense.level >= lvl ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{UPGRADE_EFFECTS[defense.type]?.(defense.level) ?? ''}</p>
    </div>
    <span className={cn('text-xs font-mono tabular-nums shrink-0', defense.level === 0 ? 'text-muted-foreground/50' : 'text-foreground')}>
      {defense.level}/3
    </span>
  </div>
);

const WarMemberRow = ({
  member,
  showClanName = false,
}: {
  member: ClanWarParticipantStats;
  showClanName?: boolean;
}) => {
  const didCombat = member.hasCompletedCombat;
  const didSupport = member.hasCompletedSupport;

  return (
    <div className="rounded-2xl border border-border/50 bg-muted/15 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={resolveImageUrl(member.user.profilePicture)} alt={member.user.username} />
            <AvatarFallback>{getAvatarFallback(member.user.username)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              <UsernameDisplay username={member.user.username} usernameColor={member.user.usernameColor} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {showClanName ? <span>{member.clanName}</span> : null}
              <span>{member.totalCombatPoints} pts combat</span>
              <span>{member.fortificationLevelsAdded} niv. défense</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge variant={didCombat ? 'secondary' : 'outline'}>{didCombat ? 'Combat fait' : 'Combat manquant'}</Badge>
          <Badge variant={didSupport ? 'secondary' : 'outline'}>{didSupport ? 'Support fait' : 'Support manquant'}</Badge>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/40 bg-background/60 px-2.5 py-2">
          Bombes: <span className="font-medium text-foreground">{member.bombRuns}</span> • {member.bombPoints} pts
        </div>
        <div className="rounded-xl border border-border/40 bg-background/60 px-2.5 py-2">
          Naval: <span className="font-medium text-foreground">{member.navalShotsUsed}</span> tirs • {member.navalHits} touches
        </div>
        <div className="rounded-xl border border-border/40 bg-background/60 px-2.5 py-2">
          Mémoire: <span className="font-medium text-foreground">{member.memoryRuns}</span> • {member.fortificationsUsed} renforts
        </div>
        <div className="rounded-xl border border-border/40 bg-background/60 px-2.5 py-2">
          Total attaques: <span className="font-medium text-foreground">{member.attackCount}</span> • {member.attackPoints} pts
        </div>
      </div>
    </div>
  );
};

const TAG_PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
  '#8b5cf6', '#d946ef', '#ec4899', '#ffffff', '#e5e7eb',
  '#a1a1aa', '#374151', '#1f2937', '#111827', '#000000',
];

export default function Clans() {
  const { user, refreshUser } = useAuth();
  const { confirm } = useAppDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clans, setClans] = useState<ClanSummary[]>([]);
  const [activeWars, setActiveWars] = useState<ClanWarState[]>([]);
  const [globalWarHistory, setGlobalWarHistory] = useState<ClanWarState[]>([]);
  const [viewerClanId, setViewerClanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClanId, setSelectedClanId] = useState<string | null>(null);
  const [selectedClan, setSelectedClan] = useState<ClanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [warActionKey, setWarActionKey] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ClanChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [warDialogOpen, setWarDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [bankDepositAmount, setBankDepositAmount] = useState('100');
  const [depositingBank, setDepositingBank] = useState(false);
  const [usingClanItemId, setUsingClanItemId] = useState<string | null>(null);

  // Settings modal state
  const [clanSettingsOpen, setClanSettingsOpen] = useState(false);
  const [clanHubOpen, setClanHubOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'tag' | 'roles' | 'messages'>('general');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);

  // Banner item dialog state
  const [bannerItemDialogOpen, setBannerItemDialogOpen] = useState(false);
  const [bannerItemId, setBannerItemId] = useState<string | null>(null);
  const [bannerItemImgUrl, setBannerItemImgUrl] = useState('');
  const [bannerItemEffectType, setBannerItemEffectType] = useState<'CLAN_BANNER' | 'CLAN_PROFILE_PICTURE' | null>(null);
  const [savingBannerItem, setSavingBannerItem] = useState(false);

  // Tag editor state
  const [tagText, setTagText] = useState('');
  const [tagStyle, setTagStyle] = useState<ClanTagStyle>(DEFAULT_CLAN_TAG_STYLE);
  const [savingTag, setSavingTag] = useState(false);
  // Tab state
  const [activeTab, setActiveTab] = useState<'info' | 'chat' | 'bank' | 'inventory' | 'guerre' | 'event' | 'requests' | 'messages'>('chat');
  const [bankHistoryOpen, setBankHistoryOpen] = useState(false);
  const [warListDialogOpen, setWarListDialogOpen] = useState(false);
  const [warGamesDialogOpen, setWarGamesDialogOpen] = useState(false);
  const [activeWarsDialogOpen, setActiveWarsDialogOpen] = useState(false);
  const [directoryViewMode, setDirectoryViewMode] = useState<'regular' | 'war'>('regular');

  // Pump-up messages
  const [pumpUpMessages, setPumpUpMessages] = useState<ClanPumpUpMessage[]>([]);
  const [pumpUpLoading, setPumpUpLoading] = useState(false);
  const [pumpUpDraft, setPumpUpDraft] = useState('');
  const [pumpUpColor, setPumpUpColor] = useState('#ffffff');
  const [pumpUpSaving, setPumpUpSaving] = useState(false);
  const [pumpUpEditId, setPumpUpEditId] = useState<string | null>(null);

  // Role management
  const [roleEditOpen, setRoleEditOpen] = useState(false);
  const [roleEditId, setRoleEditId] = useState<string | null>(null);
  const [roleEditName, setRoleEditName] = useState('');
  const [roleEditColor, setRoleEditColor] = useState('#6b7280');
  const [roleEditPerms, setRoleEditPerms] = useState({ canManageHorses: false, canInviteMembers: false, canKickMembers: false, canManageRoles: false });
  const [roleEditIsSystem, setRoleEditIsSystem] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleAssignMemberId, setRoleAssignMemberId] = useState<string | null>(null);

  // War games
  const [gameStatus, setGameStatus] = useState<ClanWarGamesStatus | null>(null);
  const [activeGame, setActiveGame] = useState<'MEMORY' | 'BOMB' | 'NAVAL' | null>(null);
  const [gamePractice, setGamePractice] = useState(false);
  const [seenTutorials, setSeenTutorials] = useState<Record<string, boolean>>(() => ({
    MEMORY: localStorage.getItem('war_tutorial_MEMORY') === '1',
    BOMB: localStorage.getItem('war_tutorial_BOMB') === '1',
    NAVAL: localStorage.getItem('war_tutorial_NAVAL') === '1',
  }));
  const [showTutorial, setShowTutorial] = useState<'MEMORY' | 'BOMB' | 'NAVAL' | null>(null);
  const [featuredEvent, setFeaturedEvent] = useState<ClanEventView | null>(null);
  const [featuredEventLoading, setFeaturedEventLoading] = useState(false);
  const [activeEventMiniGame, setActiveEventMiniGame] = useState<ClanEventMiniGame | null>(null);
  const [eventMiniGameSubmitting, setEventMiniGameSubmitting] = useState(false);
  const [reflexPhase, setReflexPhase] = useState<'idle' | 'waiting' | 'go' | 'result'>('idle');
  const [reflexScore, setReflexScore] = useState<number | null>(null);
  const [tapFrenzyRunning, setTapFrenzyRunning] = useState(false);
  const [tapFrenzyScore, setTapFrenzyScore] = useState(0);
  const [tapFrenzyTimeLeft, setTapFrenzyTimeLeft] = useState(0);
  const requestedClanId = searchParams.get('clan');

  const fetchGameStatus = useCallback(async (clanId: string) => {
    try {
      const res = await clansApi.getWarGamesStatus(clanId);
      setGameStatus(res.data);
    } catch {
      // Non-member or no war — silently ignore
    }
  }, []);

  const fetchFeaturedEvent = useCallback(async (clanId?: string | null, withLoader = true) => {
    try {
      if (withLoader) setFeaturedEventLoading(true);
      const res = await clansApi.getFeaturedEvent(clanId ?? undefined);
      setFeaturedEvent(res.data.event ?? null);
    } catch {
      setFeaturedEvent(null);
    } finally {
      if (withLoader) setFeaturedEventLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchClans();
    void fetchGlobalWarHistory();
  }, []);

  useEffect(() => {
    if (!selectedClanId && clans.length > 0) {
      const initialClanId = requestedClanId && clans.some((clan) => clan.id === requestedClanId)
        ? requestedClanId
        : viewerClanId ?? clans[0].id;
      setSelectedClanId(initialClanId);
    }
  }, [clans, requestedClanId, selectedClanId, viewerClanId]);

  useEffect(() => {
    if (!selectedClanId || searchParams.get('clan') === selectedClanId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('clan', selectedClanId);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, selectedClanId, setSearchParams]);

  useEffect(() => {
    if (!selectedClanId) return;
    void fetchClanDetail(selectedClanId);
  }, [selectedClanId]);

  useEffect(() => {
    if (selectedClan?.tagUnlocked) {
      setTagText(selectedClan.tagText ?? '');
      setTagStyle(parseClanTagStyle(selectedClan.tagStyle));
    }
  }, [selectedClan?.id]);

  useEffect(() => {
    setEditDescription(selectedClan?.description ?? '');
  }, [selectedClan?.id, selectedClan?.description]);


  useEffect(() => {
    if (!selectedClanId || !selectedClan?.viewer.isMember) {
      setChatMessages([]);
      return;
    }

    void fetchClanChat(selectedClanId);
    const interval = window.setInterval(() => {
      void fetchClanChat(selectedClanId, false);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [selectedClanId, selectedClan?.viewer.isMember]);

  useEffect(() => {
    if (selectedClanId && selectedClan?.viewer.isMember) {
      void fetchGameStatus(selectedClanId);
    } else {
      setGameStatus(null);
    }
  }, [selectedClanId, selectedClan?.viewer.isMember, fetchGameStatus]);

  useEffect(() => {
    if (!selectedClanId) {
      setFeaturedEvent(null);
      return;
    }

    void fetchFeaturedEvent(selectedClanId);
  }, [selectedClanId, fetchFeaturedEvent]);

  const fetchPumpUpMessages = useCallback(async (clanId: string) => {
    setPumpUpLoading(true);
    try {
      const res = await clansApi.getPumpUpMessages(clanId);
      setPumpUpMessages(res.data.messages);
    } catch {
      setPumpUpMessages([]);
    } finally {
      setPumpUpLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClanId && selectedClan?.viewer.isMember) {
      void fetchPumpUpMessages(selectedClanId);
    } else {
      setPumpUpMessages([]);
    }
  }, [selectedClanId, selectedClan?.viewer.isMember, fetchPumpUpMessages]);

  useEffect(() => {
    if (selectedClanId) {
      setActiveTab('chat');
    }
  }, [selectedClanId]);

  const selectedClanSummary = useMemo(
    () => clans.find((clan) => clan.id === selectedClanId) ?? null,
    [clans, selectedClanId]
  );
  const clansByWarTrophies = useMemo(
    () => [...clans].sort((a, b) => {
      const trophyDelta = Number(b.warTrophies) - Number(a.warTrophies);
      if (trophyDelta !== 0) return trophyDelta;
      return Number(b.totalAura) - Number(a.totalAura);
    }),
    [clans]
  );
  const directoryClans = useMemo(
    () => (directoryViewMode === 'war' ? clansByWarTrophies : clans),
    [clans, clansByWarTrophies, directoryViewMode]
  );
  const clansAtWarIds = useMemo(
    () =>
      new Set(
        activeWars.flatMap((war) => [war.attackerClan.id, war.defenderClan.id])
      ),
    [activeWars]
  );

  const selectedWar = selectedClan?.warHub.currentWar ?? null;
  const isOwnClan = viewerClanId === selectedClan?.id;
  const otherActiveWars = activeWars.filter(
    (w) => w.attackerClan.id !== viewerClanId && w.defenderClan.id !== viewerClanId
  );
  const canCreateClan = !viewerClanId;
  const canJoinSelectedClan = Boolean(selectedClan && !selectedClan.viewer.isMember && !viewerClanId);
  const clanWars = useMemo(() => {
    if (!selectedClan) return [];
    const currentWar = selectedClan.warHub.currentWar ? [selectedClan.warHub.currentWar] : [];
    const historyWars = selectedClan.warHub.history.filter(
      (war) => war.id !== selectedClan.warHub.currentWar?.id
    );
    return [...currentWar, ...historyWars];
  }, [selectedClan]);

  const pendingWarGames = useMemo(() => {
    if (!selectedWar || !isOwnClan || !selectedClan?.viewer.isMember || !gameStatus) return [];

    const games: Array<{
      type: 'MEMORY' | 'BOMB' | 'NAVAL';
      title: string;
      description: string;
      actionLabel: string;
      remainingLabel: string;
    }> = [];

    if (gameStatus.canPlayMemory) {
      games.push({
        type: 'MEMORY',
        title: 'Jeu mémoire',
        description: 'Renforce les défenses de ton clan.',
        actionLabel: 'Jouer',
        remainingLabel: "1 partie dispo aujourd'hui",
      });
    }

    if (gameStatus.canPlayBomb) {
      games.push({
        type: 'BOMB',
        title: 'Bombardement',
        description: 'Marque des points en détruisant la base ennemie.',
        actionLabel: 'Attaquer',
        remainingLabel: "1 attaque dispo aujourd'hui",
      });
    }

    if ((gameStatus.naval?.shotsRemaining ?? 0) > 0) {
      games.push({
        type: 'NAVAL',
        title: 'Guerre navale',
        description: 'Utilise tes tirs restants sur la grille ennemie.',
        actionLabel: 'Jouer',
        remainingLabel: `${gameStatus.naval?.shotsRemaining ?? 0} tir(s) restant(s)`,
      });
    }

    return games;
  }, [gameStatus, isOwnClan, selectedClan?.viewer.isMember, selectedWar]);
  const resetForm = () => {
    setName('');
    setDescription('');
    setIsPublic(true);
    setImageUrl('');
    setFormError(null);
  };

  const uploadClanImageFile = async (file: File): Promise<string> => {
    const { base64Data, mimeType } = await prepareImageUploadPayload(file);
    const res = await uploadUserImage({ base64Data, mimeType });
    return res.data.imageUrl;
  };

  const saveTag = async () => {
    if (!selectedClan?.tagUnlocked) return;
    try {
      setSavingTag(true);
      await clansApi.updateTag(selectedClan.id, { tagText: tagText.trim(), tagStyle });
      await fetchClanDetail(selectedClan.id);
      toast({ title: 'Tag sauvegardé' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de sauvegarder.', variant: 'destructive' });
    } finally {
      setSavingTag(false);
    }
  };


  const savePumpUpMessage = async () => {
    if (!selectedClan || !pumpUpDraft.trim()) return;
    setPumpUpSaving(true);
    try {
      if (pumpUpEditId) {
        const res = await clansApi.updatePumpUpMessage(selectedClan.id, pumpUpEditId, { content: pumpUpDraft.trim(), color: pumpUpColor });
        setPumpUpMessages((prev) => prev.map((m) => m.id === pumpUpEditId ? res.data.message : m));
      } else {
        const res = await clansApi.createPumpUpMessage(selectedClan.id, { content: pumpUpDraft.trim(), color: pumpUpColor });
        setPumpUpMessages((prev) => [...prev, res.data.message]);
      }
      setPumpUpDraft('');
      setPumpUpColor('#ffffff');
      setPumpUpEditId(null);
      toast({ title: pumpUpEditId ? 'Message modifié' : 'Message ajouté' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de sauvegarder.', variant: 'destructive' });
    } finally {
      setPumpUpSaving(false);
    }
  };

  const deletePumpUpMessage = async (msgId: string) => {
    if (!selectedClan) return;
    try {
      await clansApi.deletePumpUpMessage(selectedClan.id, msgId);
      setPumpUpMessages((prev) => prev.filter((m) => m.id !== msgId));
      if (pumpUpEditId === msgId) {
        setPumpUpEditId(null);
        setPumpUpDraft('');
        setPumpUpColor('#ffffff');
      }
      toast({ title: 'Message supprimé' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de supprimer.', variant: 'destructive' });
    }
  };

  const startEditPumpUp = (msg: ClanPumpUpMessage) => {
    setPumpUpEditId(msg.id);
    setPumpUpDraft(msg.content);
    setPumpUpColor(msg.color);
  };

  const cancelEditPumpUp = () => {
    setPumpUpEditId(null);
    setPumpUpDraft('');
    setPumpUpColor('#ffffff');
  };

  const fetchClans = async () => {
    try {
      setLoading(true);
      const res = await clansApi.list();
      const sorted = [...(res.data.clans ?? [])].sort(
        (a, b) => Number(b.totalAura) - Number(a.totalAura)
      );
      setClans(sorted);
      setActiveWars(res.data.meta.activeWars ?? []);
      setViewerClanId(res.data.meta.viewerClanId ?? null);
    } catch (error) {
      console.error('Failed to fetch clans:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les clans.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClanDetail = async (clanId: string, silent = false) => {
    try {
      if (!silent) setDetailLoading(true);
      const res = await clansApi.getById(clanId);
      setSelectedClan(res.data.clan);
    } catch (error) {
      console.error('Failed to fetch clan detail:', error);
      if (!silent) toast({
        title: 'Erreur',
        description: 'Impossible de charger ce clan.',
        variant: 'destructive',
      });
    } finally {
      if (!silent) setDetailLoading(false);
    }
  };

  const fetchGlobalWarHistory = async () => {
    try {
      const res = await clansApi.getGlobalWarHistory();
      setGlobalWarHistory(res.data.wars ?? []);
    } catch (error) {
      console.error('Failed to fetch global war history:', error);
      toast({
        title: 'Erreur',
        description: "Impossible de charger l'historique global des guerres.",
        variant: 'destructive',
      });
    }
  };

  const fetchClanChat = async (clanId: string, withLoader = true) => {
    try {
      if (withLoader) setChatLoading(true);
      const res = await clansApi.getChat(clanId, 60);
      setChatMessages(res.data.messages ?? []);
    } catch (error: any) {
      if (error.response?.status !== 403) {
        console.error('Failed to fetch clan chat:', error);
      }
    } finally {
      if (withLoader) setChatLoading(false);
    }
  };

  const refreshData = async (preferredClanId?: string | null) => {
    await fetchClans();
    const nextClanId = preferredClanId ?? selectedClanId ?? viewerClanId ?? clans[0]?.id ?? null;
    if (nextClanId) {
      setSelectedClanId(nextClanId);
      await Promise.all([
        fetchClanDetail(nextClanId),
        fetchFeaturedEvent(nextClanId, false),
      ]);
    } else {
      setSelectedClan(null);
      setFeaturedEvent(null);
    }
  };

  const openGame = (type: 'MEMORY' | 'BOMB' | 'NAVAL', practice: boolean) => {
    setGamePractice(practice);
    if (!seenTutorials[type]) {
      setShowTutorial(type);
    } else {
      setActiveGame(type);
    }
  };

  const confirmTutorial = (type: 'MEMORY' | 'BOMB' | 'NAVAL') => {
    localStorage.setItem(`war_tutorial_${type}`, '1');
    setSeenTutorials((prev) => ({ ...prev, [type]: true }));
    setShowTutorial(null);
    setActiveGame(type);
  };

  const closeGame = () => {
    setActiveGame(null);
    setShowTutorial(null);
  };

  const launchWarGameFromDialog = (type: 'MEMORY' | 'BOMB' | 'NAVAL') => {
    setWarGamesDialogOpen(false);
    openGame(type, false);
  };

  const afterGame = async () => {
    closeGame();
    if (selectedClan) {
      await refreshData(selectedClan.id);
      await fetchGameStatus(selectedClan.id);
    }
  };

  const closeEventMiniGame = () => {
    setActiveEventMiniGame(null);
    setEventMiniGameSubmitting(false);
    setReflexPhase('idle');
    setReflexScore(null);
    setTapFrenzyRunning(false);
    setTapFrenzyScore(0);
    setTapFrenzyTimeLeft(0);
  };

  const submitEventMiniGameScore = async (miniGame: ClanEventMiniGame, rawScore: number) => {
    if (!featuredEvent) return;
    try {
      setEventMiniGameSubmitting(true);
      const res = await clansApi.submitEventMiniGame(featuredEvent.id, miniGame.id, { rawScore });
      toast({
        title: 'Score enregistré',
        description: `+${res.data.result.pointsAwarded} points pour ton clan.`,
      });
      await fetchFeaturedEvent(selectedClanId, false);
      closeEventMiniGame();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || "Impossible d'enregistrer ce score.",
        variant: 'destructive',
      });
      setEventMiniGameSubmitting(false);
    }
  };

  const startReflexMiniGame = (miniGame: ClanEventMiniGame) => {
    setActiveEventMiniGame(miniGame);
    setReflexPhase('waiting');
    setReflexScore(null);

    const config = miniGame.config ?? {};
    const minDelay = typeof config.minDelayMs === 'number' ? config.minDelayMs : 1200;
    const maxDelay = typeof config.maxDelayMs === 'number' ? config.maxDelayMs : 2800;
    const delay = Math.max(minDelay, Math.floor(minDelay + Math.random() * Math.max(200, maxDelay - minDelay)));
    const startAt = Date.now() + delay;

    window.setTimeout(() => {
      setReflexPhase('go');
      setReflexScore(startAt);
    }, delay);
  };

  const handleReflexClick = async () => {
    if (!activeEventMiniGame) return;

    if (reflexPhase === 'waiting') {
      setReflexPhase('result');
      setReflexScore(0);
      return;
    }

    if (reflexPhase !== 'go' || typeof reflexScore !== 'number') return;
    const reactionMs = Math.max(1, Date.now() - reflexScore);
    const rawScore = Math.max(0, 1200 - reactionMs);
    setReflexPhase('result');
    setReflexScore(rawScore);
    await submitEventMiniGameScore(activeEventMiniGame, rawScore);
  };

  useEffect(() => {
    if (!tapFrenzyRunning || !activeEventMiniGame) return;

    if (tapFrenzyTimeLeft <= 0) {
      setTapFrenzyRunning(false);
      void submitEventMiniGameScore(activeEventMiniGame, tapFrenzyScore);
      return;
    }

    const timer = window.setTimeout(() => {
      setTapFrenzyTimeLeft((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [tapFrenzyRunning, tapFrenzyTimeLeft, tapFrenzyScore, activeEventMiniGame]);

  const startTapFrenzyMiniGame = (miniGame: ClanEventMiniGame) => {
    const config = miniGame.config ?? {};
    const durationSeconds = typeof config.durationSeconds === 'number' ? config.durationSeconds : 8;
    setActiveEventMiniGame(miniGame);
    setTapFrenzyRunning(true);
    setTapFrenzyScore(0);
    setTapFrenzyTimeLeft(Math.max(3, durationSeconds));
  };

  const handleMemoryComplete = async (result: { matchedPairs: Record<string, number>; score: number }) => {
    if (gamePractice) { closeGame(); return; }
    if (!selectedClan) return;
    try {
      await clansApi.submitMemoryGame(selectedClan.id, { ...result, isPractice: false });
      toast({ title: 'Défenses renforcées !', description: 'Les structures de ton clan ont été améliorées.' });
      await afterGame();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de valider.', variant: 'destructive' });
    }
  };

  const handleBombComplete = async (result: { score: number; hits: number }) => {
    if (gamePractice) { closeGame(); return; }
    if (!selectedClan) return;
    try {
      const res = await clansApi.submitBombGame(selectedClan.id, { ...result, isPractice: false });
      toast({ title: 'Attaque enregistrée !', description: `+${res.data.finalPoints} pts de guerre.` });
      await afterGame();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de valider.', variant: 'destructive' });
    }
  };

  const handleNavalShot = async (x: number, y: number) => {
    if (!selectedClan) throw new Error('No clan');
    const res = await clansApi.navalShot(selectedClan.id, { x, y });
    await fetchGameStatus(selectedClan.id);
    return res.data;
  };

  const handleCreateClan = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Le nom est obligatoire.');
      return;
    }

    setCreating(true);
    try {
      const res = await clansApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        isPublic,
      });
      setDialogOpen(false);
      resetForm();
      toast({ title: 'Clan créé', description: 'Ton organisation est prête à recruter, négocier et combattre.' });
      await refreshData(res.data.clan.id);
    } catch (error: any) {
      console.error('Failed to create clan:', error);
      setFormError(error.response?.data?.error || 'Impossible de créer le clan.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!selectedClan) return;
    setActionLoading(true);
    try {
      const res = await clansApi.join(selectedClan.id);
      toast({
        title: res.data.status === 'joined' ? 'Clan rejoint' : 'Demande envoyée',
        description:
          res.data.status === 'joined'
            ? 'Tu as rejoint le clan.'
            : 'Ta demande a été envoyée au chef du clan.',
      });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to join clan:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de rejoindre le clan.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'accept' | 'reject') => {
    if (!selectedClan) return;
    setActionLoading(true);
    try {
      if (action === 'accept') {
        await clansApi.acceptRequest(selectedClan.id, requestId);
      } else {
        await clansApi.rejectRequest(selectedClan.id, requestId);
      }
      toast({
        title: action === 'accept' ? 'Demande acceptée' : 'Demande refusée',
        description: action === 'accept' ? 'Le joueur a rejoint le clan.' : 'La demande a été rejetée.',
      });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to update request:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de traiter la demande.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedClan) return;
    setActionLoading(true);
    try {
      await clansApi.removeMember(selectedClan.id, userId);
      toast({ title: 'Membre retiré', description: 'Le membre a été retiré du clan.' });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de retirer ce membre.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromoteMember = async (userId: string) => {
    if (!selectedClan) return;
    setActionLoading(true);
    try {
      await clansApi.promoteMember(selectedClan.id, userId);
      toast({ title: 'Membre promu', description: 'Le membre est maintenant officier.' });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to promote member:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de promouvoir ce membre.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDemoteMember = async (userId: string) => {
    if (!selectedClan) return;
    setActionLoading(true);
    try {
      await clansApi.demoteMember(selectedClan.id, userId);
      toast({ title: 'Membre rétrogradé', description: 'Le membre est repassé au rang membre.' });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to demote member:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de rétrograder ce membre.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferLeadership = async (userId: string, username: string) => {
    if (!selectedClan) return;
    if (!(await confirm(`Confirmer le transfert du rôle de chef à ${username} ?`))) return;

    setActionLoading(true);
    try {
      await clansApi.transferLeadership(selectedClan.id, userId);
      toast({ title: 'Chef transféré', description: `${username} est maintenant le chef du clan.` });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to transfer leadership:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de transférer le rôle de chef.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!selectedClan) return;
    if (!(await confirm('Voulez-vous vraiment quitter ce clan ?'))) return;

    setActionLoading(true);
    try {
      await clansApi.leave(selectedClan.id);
      toast({ title: 'Clan quitté', description: 'Tu as quitté le clan.' });
      await refreshData(null);
    } catch (error: any) {
      console.error('Failed to leave clan:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de quitter le clan.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclareWar = async (targetClanId: string) => {
    if (!selectedClan) return;
    setWarActionKey(`declare:${targetClanId}`);
    try {
      await clansApi.declareWar(selectedClan.id, targetClanId);
      toast({ title: 'Guerre déclarée !', description: 'La bataille commence maintenant — attaquez !' });
      setWarDialogOpen(false);
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to declare war:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de déclarer cette guerre.',
        variant: 'destructive',
      });
    } finally {
      setWarActionKey(null);
    }
  };

  const handleWarAttack = async (attackType: ClanWarActionType['type']) => {
    if (!selectedClan || !selectedWar) return;
    setWarActionKey(`attack:${attackType}`);
    try {
      const res = await clansApi.attackWar(selectedClan.id, attackType);
      toast({
        title: 'Assaut lancé',
        description: `+${res.data.finalPoints} pts avec ${attackType.toLowerCase()}.`,
      });
      await refreshData(selectedClan.id);
      await fetchGameStatus(selectedClan.id);
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || "Impossible d'effectuer cette attaque.",
        variant: 'destructive',
      });
    } finally {
      setWarActionKey(null);
    }
  };

  const handleDepositToBank = async () => {
    if (!selectedClan || !selectedClan.viewer.isMember) return;

    const amount = Number(bankDepositAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast({
        title: 'Montant invalide',
        description: 'Entre un montant entier supérieur à 0.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setDepositingBank(true);
      await clansApi.depositToBank(selectedClan.id, amount);
      toast({ title: 'Dépôt effectué', description: `${amount.toLocaleString('fr-FR')} money ajouté à la banque de clan.` });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de déposer dans la banque de clan.',
        variant: 'destructive',
      });
    } finally {
      setDepositingBank(false);
    }
  };

  const parseClanItemEffect = (effect: string | null): { type?: string } | null => {
    try { return effect ? JSON.parse(effect) : null; } catch { return null; }
  };

  const handleUseClanItem = async (clanItem: ClanOwnedItem) => {
    if (!selectedClan || usingClanItemId) return;
    const effect = parseClanItemEffect(clanItem.item.effect);
    if (effect?.type === "CLAN_BANNER" || effect?.type === 'CLAN_PROFILE_PICTURE') {
      setBannerItemId(clanItem.id);
      setBannerItemEffectType(effect.type);
      setBannerItemImgUrl(effect.type === 'CLAN_BANNER' ? (selectedClan.banner ?? "") : (selectedClan.imageUrl ?? ""));
      setBannerItemDialogOpen(true);
      return;
    }
    try {
      setUsingClanItemId(clanItem.id);
      await clansApi.useOwnedItem(selectedClan.id, clanItem.id);
      await Promise.all([fetchClanDetail(selectedClan.id), refreshUser()]);
      toast({
        title: "Effet active",
        description: `${clanItem.item.name} booste maintenant les gains d'argent du clan.`,
      });
    } catch (error: any) {
      toast({
        title: "Activation impossible",
        description: error.response?.data?.error || "Impossible d'activer cet objet.",
        variant: "destructive",
      });
    } finally {
      setUsingClanItemId(null);
    }
  };

  const handleApplyBannerItem = async () => {
    if (!selectedClan || !bannerItemId || !bannerItemImgUrl.trim() || !bannerItemEffectType) return;
    try {
      setSavingBannerItem(true);
      await clansApi.useOwnedItem(selectedClan.id, bannerItemId, { imageUrl: bannerItemImgUrl.trim() });
      const appliedImageUrl = bannerItemImgUrl.trim();
      if (bannerItemEffectType === 'CLAN_BANNER') {
        setSelectedClan((prev) => prev ? { ...prev, banner: appliedImageUrl } : prev);
        setClans((prev) => prev.map((c) => c.id === selectedClan.id ? { ...c, banner: appliedImageUrl } : c));
      } else {
        setSelectedClan((prev) => prev ? { ...prev, imageUrl: appliedImageUrl } : prev);
        setClans((prev) => prev.map((c) => c.id === selectedClan.id ? { ...c, imageUrl: appliedImageUrl } : c));
      }
      setBannerItemDialogOpen(false);
      toast({ title: bannerItemEffectType === 'CLAN_BANNER' ? "Banniere de clan appliquee" : 'Photo de profil de clan appliquee' });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || (
          bannerItemEffectType === 'CLAN_BANNER'
            ? "Impossible d'appliquer la banniere."
            : "Impossible d'appliquer la photo de profil du clan."
        ),
        variant: "destructive",
      });
    } finally {
      setSavingBannerItem(false);
      setBannerItemId(null);
      setBannerItemEffectType(null);
    }
  };

  const openRoleCreate = () => {
    setRoleEditId(null);
    setRoleEditName('');
    setRoleEditColor('#6b7280');
    setRoleEditPerms({ canManageHorses: false, canInviteMembers: false, canKickMembers: false, canManageRoles: false });
    setRoleEditIsSystem(false);
    setRoleEditOpen(true);
  };

  const openRoleEdit = (role: ClanRole) => {
    setRoleEditId(role.id);
    setRoleEditName(role.name);
    setRoleEditColor(role.color);
    setRoleEditPerms({ canManageHorses: role.canManageHorses, canInviteMembers: role.canInviteMembers, canKickMembers: role.canKickMembers, canManageRoles: role.canManageRoles });
    setRoleEditIsSystem(role.isSystem);
    setRoleEditOpen(true);
  };

  const handleSaveRole = async () => {
    if (!selectedClan) return;
    setRoleSaving(true);
    try {
      if (roleEditId) {
        const res = await clansApi.updateRole(selectedClan.id, roleEditId, { name: roleEditIsSystem ? undefined : roleEditName, color: roleEditColor, ...roleEditPerms });
        setSelectedClan((prev) => prev ? { ...prev, roles: prev.roles.map((r) => r.id === roleEditId ? res.data.role : r) } : prev);
      } else {
        const res = await clansApi.createRole(selectedClan.id, { name: roleEditName, color: roleEditColor, ...roleEditPerms });
        setSelectedClan((prev) => prev ? { ...prev, roles: [...prev.roles, res.data.role] } : prev);
      }
      setRoleEditOpen(false);
      toast({ title: roleEditId ? 'Rôle mis à jour' : 'Rôle créé' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de sauvegarder le rôle.', variant: 'destructive' });
    } finally {
      setRoleSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!selectedClan) return;
    const confirmed = await confirm({ title: 'Supprimer ce rôle ?', description: 'Les membres avec ce rôle seront réinitialisés.' });
    if (!confirmed) return;
    try {
      await clansApi.deleteRole(selectedClan.id, roleId);
      setSelectedClan((prev) => prev ? { ...prev, roles: prev.roles.filter((r) => r.id !== roleId) } : prev);
      toast({ title: 'Rôle supprimé' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de supprimer ce rôle.', variant: 'destructive' });
    }
  };

  const handleAssignRole = async (userId: string, roleId: string | null) => {
    if (!selectedClan) return;
    try {
      await clansApi.assignRole(selectedClan.id, userId, roleId);
      setSelectedClan((prev) => {
        if (!prev) return prev;
        const role = roleId ? prev.roles.find((r) => r.id === roleId) : null;
        return {
          ...prev,
          members: prev.members.map((m) => m.userId === userId ? { ...m, roleId: roleId ?? null, roleName: role?.name ?? null, roleColor: role?.color ?? null } : m),
        };
      });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible d\'assigner ce rôle.', variant: 'destructive' });
    }
  };

  const handleSaveImage = async () => {
    if (!selectedClan || !selectedClan.viewer.isLeader) return;
    try {
      setSavingImage(true);
      const res = await clansApi.updateImage(selectedClan.id, editImageUrl.trim() || null);
      setSelectedClan((prev) => prev ? { ...prev, imageUrl: res.data.imageUrl } : prev);
      setClans((prev) => prev.map((c) => c.id === selectedClan.id ? { ...c, imageUrl: res.data.imageUrl } : c));
      toast({ title: 'Image mise à jour' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de modifier l\'image.', variant: 'destructive' });
    } finally {
      setSavingImage(false);
    }
  };

  const handleSaveDescription = async () => {
    if (!selectedClan || !selectedClan.viewer.isLeader) return;
    try {
      setSavingDescription(true);
      const res = await clansApi.updateDescription(selectedClan.id, editDescription.trim() || null);
      setSelectedClan((prev) => prev ? { ...prev, description: res.data.description } : prev);
      setClans((prev) => prev.map((c) => c.id === selectedClan.id ? { ...c, description: res.data.description } : c));
      toast({ title: 'Description mise à jour' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de modifier la description.', variant: 'destructive' });
    } finally {
      setSavingDescription(false);
    }
  };

  const handleSendChatMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClan || !selectedClan.viewer.isMember) return;

    const message = chatDraft.trim();
    if (!message) return;

    setChatSending(true);
    try {
      const res = await clansApi.sendMessage(selectedClan.id, message);
      setChatMessages((current) => [...current, res.data.message].slice(-60));
      setChatDraft('');
    } catch (error: any) {
      console.error('Failed to send clan chat message:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || "Impossible d'envoyer le message.",
        variant: 'destructive',
      });
    } finally {
      setChatSending(false);
    }
  };

  return (
    <div className="relative flex-1 h-full w-full">
      {/* Global Clan Banner Background */}
      <div
        className="fixed inset-0 z-0 opacity-30 blur-[100px] transition-all duration-1000 pointer-events-none"
        style={{
          backgroundImage: selectedClan?.banner ? `url(${resolveImageUrl(selectedClan.banner)})` : 'none',
          backgroundColor: selectedClan?.banner ? 'transparent' : 'rgba(0,0,0,0.2)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <PageShell size="wide" className="relative z-10 h-[calc(100vh-7rem)] overflow-hidden transition-all duration-500">

      <div className={cn(SPACING.PAGE_CONTENT, 'relative h-full min-h-0 overflow-hidden bg-transparent')}>
        <div className="grid h-full min-h-0 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col bg-transparent p-0">
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="min-w-0 space-y-3">
                <Tabs value={directoryViewMode} onValueChange={(value) => setDirectoryViewMode(value as 'regular' | 'war')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 border-border/60 bg-muted/20">
                        <TabsTrigger value="regular" className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
                          <Shield className="mr-2 h-4 w-4" />
                          Normal
                        </TabsTrigger>
                        <TabsTrigger
                          value="war"
                          className="text-red-400 data-[state=active]:border-red-500/40 data-[state=active]:bg-red-500/15 data-[state=active]:text-red-500"
                        >
                          <Swords className="mr-2 h-4 w-4" />
                          Guerre
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    {directoryViewMode === 'war' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveWarsDialogOpen(true)}
                        disabled={otherActiveWars.length === 0}
                        className="w-full border-red-500/30 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <Swords className="mr-2 h-4 w-4" />
                        Guerres actives ({otherActiveWars.length})
                      </Button>
                    ) : null}
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-baseline gap-2">
                        <span className="rounded-xl border border-border/60 bg-muted/20 px-3 py-1 text-lg font-semibold tabular-nums">
                          {clans.length}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">Clans</span>
                      </div>
                      {canCreateClan ? (
                        <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Créer
                        </Button>
                      ) : null}
                    </div>
                  </div>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  {loading ? (
                    <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                      <ListSkeleton rows={4} />
                    </div>
                  ) : clans.length === 0 ? (
                    <div className={cn(TYPOGRAPHY.MUTED, 'py-6')}>Aucun clan pour le moment.</div>
                  ) : (
                    <div className="space-y-2">
                      {directoryClans.map((clan) => {
                        const hasTag = clan.tagUnlocked && clan.tagText;
                        const clanTagStyle = hasTag && clan.tagStyle ? parseClanTagStyle(clan.tagStyle) : null;
                        const isClanAtWar = clansAtWarIds.has(clan.id);
                        return (
                          <button
                            key={clan.id}
                            type="button"
                            onClick={() => setSelectedClanId(clan.id)}
                            className={cn(
                              'relative w-full overflow-visible rounded-2xl border px-3.5 py-3.5 text-left transition-all duration-200 backdrop-blur-sm',
                              clan.id === selectedClanId ? 'shadow-[0_8px_35px_rgba(0,0,0,0.05)] scale-[1.01]' : 'hover:scale-[1.005] hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]',
                              !hasTag && 'border-border/30 bg-background/15 hover:bg-background/25 hover:border-border/50',
                              !hasTag && clan.id === selectedClanId && 'border-primary/30 bg-background/35 shadow-md',
                            )}
                            style={clanTagStyle ? {
                              ...getClanTagBackground(clanTagStyle),
                              borderColor: clanTagStyle.borderColor,
                            } : undefined}
                          >
                            {directoryViewMode === 'war' && isClanAtWar ? (
                              <span className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-500/40 bg-background p-1 text-red-500 shadow-sm">
                                <Swords className="h-3 w-3" />
                              </span>
                            ) : null}
                            <div className="flex items-center gap-3">
                              <Avatar className="h-11 w-11">
                                <AvatarImage src={resolveImageUrl(clan.imageUrl)} alt={clan.name} />
                                <AvatarFallback>{getAvatarFallback(clan.name)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div
                                  className="truncate font-medium"
                                  style={clanTagStyle ? { color: clanTagStyle.textColor } : undefined}
                                >
                                  {clan.name}
                                </div>
                                <div
                                  className={cn('text-xs', !clanTagStyle && 'text-muted-foreground')}
                                  style={clanTagStyle ? { color: clanTagStyle.textColor, opacity: 0.75 } : undefined}
                                >
                                  {clan.memberCount}/{clan.maxMembers} membres • {directoryViewMode === 'war' ? `🏆 ${formatMoney(clan.warTrophies)}` : `${formatAura(clan.totalAura)} aura`}
                                </div>
                              </div>
                              {viewerClanId === clan.id ? <Badge>Mon clan</Badge> : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border/50 bg-background/60 shadow-sm backdrop-blur-md">
              {!selectedClanId || !selectedClanSummary ? (
                <div className="flex h-full items-center justify-center p-10 text-center text-muted-foreground">
                  Sélectionne un clan pour afficher son quartier général.
                </div>
              ) : detailLoading || !selectedClan ? (
                <div className="p-6">
                  <CenteredSkeletonCard className="min-h-[240px]" />
                </div>
              ) : (
                <div className="flex flex-col">
                  {/* Compact horizontal premium header bar */}
                  <div className="relative shrink-0 border-b border-border/40 bg-background/50 backdrop-blur-md px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        <Avatar className="h-14 w-14 rounded-2xl border-2 border-primary/20 bg-muted/20 shadow-md">
                          <AvatarImage src={resolveImageUrl(selectedClan.imageUrl)} alt={selectedClan.name} />
                          <AvatarFallback className="rounded-2xl text-lg font-bold">{getAvatarFallback(selectedClan.name)}</AvatarFallback>
                        </Avatar>
                        {selectedClan.viewer.isLeader && (
                          <button
                            type="button"
                            className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity hover:opacity-100"
                            onClick={() => { setEditImageUrl(selectedClan.imageUrl ?? ""); setClanSettingsOpen(true); }}
                          >
                            <Pencil className="h-4 w-4 text-white" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
                            {selectedClan.name}
                            {selectedClan.tagUnlocked && selectedClan.tagText && (
                              <ClanTag tag={{ text: selectedClan.tagText, style: parseClanTagStyle(selectedClan.tagStyle) }} />
                            )}
                          </h1>
                          {selectedClan.viewer.isLeader ? <Crown className="h-4.5 w-4.5 text-amber-500 fill-amber-500/25" /> : null}
                          {!selectedClan.isPublic ? (
                            <TooltipProvider>
                              <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help inline-flex items-center gap-0.5 text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/15">
                                    <Lock className="h-2.5 w-2.5" />
                                    <span>Privé</span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs bg-slate-950 border-slate-800 text-slate-100 p-3 shadow-xl z-50">
                                  <p className="font-semibold text-amber-400 mb-1">Clan Privé</p>
                                  <p className="text-xs leading-relaxed text-slate-300">
                                    Ce clan est privé. Les joueurs doivent soumettre une candidature pour le rejoindre, et les informations internes ne sont visibles que par ses membres.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <span>Chef :</span>
                            <UsernameDisplay username={selectedClan.leader.username} usernameColor={selectedClan.leader.usernameColor} />
                          </div>
                          <span>•</span>
                          <div>
                            <span>Membres :</span>
                            <span className="text-foreground ml-0.5">{selectedClan.memberCount}/{selectedClan.maxMembers}</span>
                          </div>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-foreground">{formatAura(selectedClan.totalAura)} aura</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Visitor Button */}
                      {canJoinSelectedClan && (
                        <Button size="sm" className="h-9 px-4 font-semibold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleJoin} disabled={actionLoading || selectedClan.viewer.hasPendingRequest}>
                          {actionLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                          {selectedClan.viewer.hasPendingRequest ? "En attente" : "Rejoindre le clan"}
                        </Button>
                      )}

                      {/* Clan Hub Button (Dashboard & Chat) */}
                      {selectedClan.viewer.isMember && (
                        <Button
                          size="sm"
                          className="h-9 px-4 font-semibold shadow-md gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() => { setActiveTab('chat'); setClanHubOpen(true); }}
                        >
                          <LayoutGrid className="h-4 w-4" />
                          Tableau de Bord
                        </Button>
                      )}

                      {/* Settings Button */}
                      {selectedClan.viewer.isMember && (selectedClan.viewer.isLeader || selectedClan.viewer.permissions?.canManageRoles) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 px-3 font-semibold border-border hover:bg-muted"
                          onClick={() => {
                            setEditImageUrl(selectedClan.imageUrl ?? "");
                            setEditDescription(selectedClan.description ?? "");
                            setSettingsTab('general');
                            setClanSettingsOpen(true);
                          }}
                        >
                          <Settings2 className="h-4 w-4 mr-1.5" />
                          Paramètres
                        </Button>
                      )}

                      {/* Leave Button */}
                      {selectedClan.viewer.isMember && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 px-3 font-semibold border-rose-500/20 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                          onClick={handleLeave}
                          disabled={actionLoading}
                        >
                          <LogOut className="h-4 w-4 mr-1.5" />
                          Quitter
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 sm:p-8 space-y-6">
                    {/* Visitor Welcome Card (if non-member) */}
                    {!selectedClan.viewer.isMember && (
                      <div className="rounded-2xl border border-border/40 bg-muted/5 p-5 space-y-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="max-w-2xl flex-1 space-y-1.5">
                            <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                              <Layout className="h-4 w-4 text-primary" />
                              Présentation du clan
                            </h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {selectedClan.description || 'Aucune description pour le moment.'}
                            </p>
                          </div>

                          {/* Active Effects */}
                          {selectedClan.activeEffects.length > 0 && (
                            <div className="flex shrink-0 flex-wrap gap-2 pt-1 lg:justify-end">
                              {selectedClan.activeEffects.map((effect) => (
                                <ClanEffectBadge key={effect.id} effect={effect} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Member List Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-border/10 pb-2">
                        <h2 className="text-sm font-bold tracking-tight text-foreground uppercase tracking-wider">
                          Membres du clan ({selectedClan.members.length}/{selectedClan.maxMembers})
                        </h2>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {/* Member Cards */}
                        {selectedClan.members.map((member) => {
                          const isSelf = member.userId === user?.id;
                          const isClanLeader = selectedClan.leader.id === member.userId;
                          const displayRole = isClanLeader ? 'Chef' : member.roleName ? member.roleName : member.isLeader ? 'Officier' : 'Membre';

                          return (
                            <div
                              key={member.id}
                              className="group relative flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-muted/5 p-4 shadow-sm hover:border-border transition-all"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="relative shrink-0">
                                  <Avatar className="h-10 w-10 border border-border/30 shadow-sm transition-transform duration-300 group-hover:scale-105">
                                    <AvatarImage src={resolveImageUrl(member.profilePicture)} alt={member.username} />
                                    <AvatarFallback className="bg-muted/20 text-sm font-semibold">{getAvatarFallback(member.username)}</AvatarFallback>
                                  </Avatar>
                                  {isClanLeader ? (
                                    <span className="absolute -right-1 -top-1 rounded-full bg-background p-0.5 shadow-sm border border-border/30">
                                      <Crown className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                                    </span>
                                  ) : member.isLeader ? (
                                    <span className="absolute -right-1 -top-1 rounded-full bg-background p-0.5 shadow-sm border border-border/30">
                                      <Shield className="h-2.5 w-2.5 text-blue-500" />
                                    </span>
                                  ) : null}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 text-sm font-bold">
                                    <UsernameDisplay
                                      username={member.username}
                                      usernameColor={member.usernameColor}
                                    />
                                    {isSelf ? (
                                      <Badge variant="outline" className="h-4 border-primary/20 bg-primary/5 px-1 text-[9px] text-primary font-semibold">
                                        Toi
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 font-semibold">
                                    <span className="text-foreground/75">{formatAura(member.aura)} aura</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      {member.roleColor ? (
                                        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: member.roleColor }} />
                                      ) : null}
                                      <span>{displayRole}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Admin actions */}
                              {!isSelf && selectedClan.viewer.isMember && (
                                <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 shrink-0">
                                  {(selectedClan.viewer.isLeader || selectedClan.viewer.permissions?.canManageRoles) && !isClanLeader ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-xl bg-muted/20 hover:bg-muted text-muted-foreground hover:text-foreground"
                                      onClick={() => setRoleAssignMemberId(member.userId)}
                                      disabled={actionLoading}
                                      title="Gérer le rôle"
                                    >
                                      <Shield className="h-3.5 w-3.5" style={{ color: member.roleColor ?? undefined }} />
                                    </Button>
                                  ) : null}
                                  {selectedClan.viewer.isLeader && selectedClan.leader.id === user?.id && !isClanLeader ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-xl bg-muted/20 hover:bg-muted text-muted-foreground hover:text-amber-500"
                                      onClick={() => handleTransferLeadership(member.userId, member.username)}
                                      disabled={actionLoading}
                                      title="Transférer le rôle de chef"
                                    >
                                      <Crown className="h-3.5 w-3.5" />
                                    </Button>
                                  ) : null}
                                  {selectedClan.viewer.permissions?.canKickMembers && !isClanLeader && !member.isLeader ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-xl bg-muted/20 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                                      onClick={() => handleRemoveMember(member.userId)}
                                      disabled={actionLoading}
                                      title="Exclure du clan"
                                    >
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Unfilled slots */}
                        {Array.from({ length: Math.max(0, selectedClan.maxMembers - selectedClan.members.length) }).map((_, index) => (
                          <div
                            key={`empty-slot-${index}`}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border/40 bg-muted/5 p-4"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="relative shrink-0 flex items-center justify-center h-10 w-10 rounded-2xl border border-dashed border-border/50 bg-muted/10 text-muted-foreground/35">
                                <Plus className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-muted-foreground/40 italic">
                                  Slot libre
                                </div>
                                <div className="text-xs text-muted-foreground/30 font-semibold mt-0.5">
                                  En attente d'un membre
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </PageShell>

      <Dialog open={activeWarsDialogOpen} onOpenChange={setActiveWarsDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Guerres actives</DialogTitle>
            <DialogDescription>
              {otherActiveWars.length === 0
                ? 'Aucune autre guerre en cours.'
                : `${otherActiveWars.length} guerre(s) en cours sur le serveur.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {otherActiveWars.map((war) => (
              <button
                key={war.id}
                type="button"
                onClick={() => { setSelectedClanId(war.attackerClan.id); setActiveWarsDialogOpen(false); }}
                className="w-full rounded-2xl border border-border/50 bg-muted/15 p-4 text-left transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Guerre #{war.id.slice(0, 6)}</div>
                    <div className="font-medium">
                      {war.attackerClan.name} <span className="text-muted-foreground">contre</span> {war.defenderClan.name}
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(war.status)}>{getStatusLabel(war.status)}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                  <span>{war.attackerScore} - {war.defenderScore}</span>
                  <span>
                    {war.status === 'COMPLETED'
                      ? `Terminee ${formatDate(war.completedAt)}`
                      : `Fin dans ${formatCountdown(war.endsAt)}`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(activeEventMiniGame)} onOpenChange={(open) => !open && closeEventMiniGame()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{activeEventMiniGame?.title ?? 'Mini-jeu événement'}</DialogTitle>
            <DialogDescription>{activeEventMiniGame?.instructions || activeEventMiniGame?.description || 'Fais le meilleur score possible pour ton clan.'}</DialogDescription>
          </DialogHeader>

          {activeEventMiniGame?.type === 'REFLEX' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 text-sm text-muted-foreground">
                {reflexPhase === 'waiting'
                  ? 'Attends le signal vert, puis clique immédiatement.'
                  : reflexPhase === 'go'
                    ? 'CLIQUE MAINTENANT'
                    : reflexPhase === 'result'
                      ? reflexScore === 0
                        ? 'Trop tôt. Cette tentative vaut 0.'
                        : `Score brut: ${Math.floor(reflexScore ?? 0)}`
                      : 'Prêt ?'}
              </div>
              <Button
                className={cn('h-28 w-full text-lg', reflexPhase === 'go' ? 'bg-emerald-600 hover:bg-emerald-600/90' : '')}
                disabled={eventMiniGameSubmitting}
                onClick={() => { void handleReflexClick(); }}
              >
                {reflexPhase === 'waiting' ? '...' : reflexPhase === 'go' ? 'CLIQUE' : 'Tenter'}
              </Button>
            </div>
          ) : activeEventMiniGame?.type === 'TAP_FRENZY' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/50 bg-muted/15 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Temps restant</div>
                  <div className="mt-2 text-2xl font-semibold">{tapFrenzyTimeLeft}s</div>
                </div>
                <div className="rounded-2xl border border-border/50 bg-muted/15 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Score brut</div>
                  <div className="mt-2 text-2xl font-semibold">{tapFrenzyScore}</div>
                </div>
              </div>
              <Button
                className="h-28 w-full text-lg"
                disabled={!tapFrenzyRunning || eventMiniGameSubmitting}
                onClick={() => setTapFrenzyScore((current) => current + 10)}
              >
                Tap tap tap
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-lg">
          <div className="flex max-h-[85vh] flex-col">
            <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
              <DialogTitle>Créer un clan</DialogTitle>
              <DialogDescription>Coût: 100 money. Le chef devient automatiquement le premier membre.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateClan} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
                {formError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Erreur</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nom</label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={32} placeholder="Les Veilleurs" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={300}
                    rows={4}
                    placeholder="Décris l'identité, le style de jeu et l'objectif du clan."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Emblème</label>
                  <ImagePicker
                    value={imageUrl}
                    onChange={setImageUrl}
                    uploadFn={uploadClanImageFile}
                    disabled={creating}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">Clan public</div>
                    <div className="text-sm text-muted-foreground">Si désactivé, les joueurs devront envoyer une candidature.</div>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
              </div>
              <div className="shrink-0 border-t px-6 py-4">
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Créer le clan
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Clan Settings Modal ── */}
      {/* ── Clan Settings Modal ── */}
      <Dialog
        open={clanSettingsOpen}
        onOpenChange={(open) => {
          if (!open && (savingImage || savingDescription || savingTag)) return;
          if (!open && selectedClan) {
            setEditDescription(selectedClan.description ?? '');
            setEditImageUrl(selectedClan.imageUrl ?? '');
          }
          setClanSettingsOpen(open);
        }}
      >
        <DialogContent className="max-w-4xl h-[75vh] p-0 overflow-hidden flex flex-col bg-background/90 backdrop-blur-xl border border-border/40 shadow-2xl">
          {selectedClan && (
            <>
              <DialogHeader className="px-6 py-4 border-b border-border/40 shrink-0 bg-background/40 backdrop-blur-md">
                <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                  <Settings2 className="h-5.5 w-5.5 text-primary" />
                  Paramètres du clan — {selectedClan.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Gérez l'emblème, la description, le tag, les rôles et les annonces de votre clan.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 flex min-h-0 bg-background/30">
                {/* Left Sidebar (Settings Tabs) */}
                <div className="w-56 border-r border-border/40 bg-muted/10 p-4 space-y-1.5 shrink-0 backdrop-blur-sm overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setSettingsTab('general')}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all text-left border border-transparent",
                      settingsTab === 'general'
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Settings2 className="h-4 w-4 text-sky-400" />
                    Général
                  </button>

                  {selectedClan.tagUnlocked && (
                    <button
                      type="button"
                      onClick={() => setSettingsTab('tag')}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all text-left border border-transparent",
                        settingsTab === 'tag'
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      Tag du clan
                    </button>
                  )}

                  {(selectedClan.viewer.permissions?.canManageRoles || selectedClan.viewer.isLeader) && (
                    <button
                      type="button"
                      onClick={() => setSettingsTab('roles')}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all text-left border border-transparent",
                        settingsTab === 'roles'
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Shield className="h-4 w-4 text-purple-400" />
                      Rôles
                    </button>
                  )}

                  {selectedClan.viewer.isLeader && (
                    <button
                      type="button"
                      onClick={() => setSettingsTab('messages')}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all text-left border border-transparent",
                        settingsTab === 'messages'
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Megaphone className="h-4 w-4 text-indigo-400" />
                      Annonces
                    </button>
                  )}
                </div>

                {/* Right Content Area */}
                <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-background/50">
                  {settingsTab === 'general' && (
                    <div className="space-y-6">
                      {/* Stats Overview */}
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-2xl border border-border/40 bg-muted/10 p-3 shadow-sm">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aura</div>
                          <div className="text-base font-bold mt-1 text-primary">{formatAura(selectedClan.totalAura)}</div>
                        </div>
                        <div className="rounded-2xl border border-border/40 bg-muted/10 p-3 shadow-sm">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trophées</div>
                          <div className="text-base font-bold mt-1 text-amber-500">{formatMoney(selectedClan.warTrophies)}</div>
                        </div>
                        <div className="rounded-2xl border border-border/40 bg-muted/10 p-3 shadow-sm">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Guerres</div>
                          <div className="text-base font-bold mt-1">{selectedClan.warWins}V {selectedClan.warLosses}D</div>
                        </div>
                      </div>

                      <div className="border-t border-border/40 my-4" />

                      {/* Emblem Edit */}
                      <div className="space-y-3 rounded-2xl border border-border/40 bg-muted/5 p-4 shadow-sm">
                        <h4 className="text-sm font-bold flex items-center gap-1.5">
                          <Plus className="h-4 w-4 text-sky-400" />
                          Modifier l'emblème
                        </h4>
                        <ImagePicker
                          value={editImageUrl}
                          onChange={setEditImageUrl}
                          uploadFn={uploadClanImageFile}
                          disabled={savingImage}
                        />
                        <Button size="sm" className="w-full font-semibold" onClick={handleSaveImage} disabled={savingImage}>
                          {savingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                          Enregistrer l'emblème
                        </Button>
                      </div>

                      {/* Description Edit */}
                      <div className="space-y-3 rounded-2xl border border-border/40 bg-muted/5 p-4 shadow-sm">
                        <h4 className="text-sm font-bold flex items-center gap-1.5">
                          <Pencil className="h-3.5 w-3.5 text-sky-400" />
                          Modifier la description
                        </h4>
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          maxLength={300}
                          rows={4}
                          placeholder="Décris l'identité, le style de jeu et l'objectif du clan…"
                          disabled={savingDescription}
                          className="bg-background/50 text-sm resize-none"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">{editDescription.length}/300</span>
                          <Button size="sm" className="font-semibold" onClick={handleSaveDescription} disabled={savingDescription}>
                            {savingDescription ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Enregistrer la description
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsTab === 'tag' && selectedClan.tagUnlocked && (
                    <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/5 p-5 shadow-sm">
                      <h4 className="text-sm font-bold flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-amber-400" />
                        Tag du clan
                      </h4>

                      {/* Tag Preview */}
                      <div className="flex items-center gap-2.5 rounded-xl bg-muted/20 p-3 border border-border/30">
                        <span className="text-xs text-muted-foreground font-semibold">Aperçu :</span>
                        <span className="text-sm font-semibold">Pseudo</span>
                        {tagText.trim() ? (
                          <ClanTag tag={{ text: tagText.trim(), style: tagStyle }} />
                        ) : (
                          <span className="text-xs text-muted-foreground italic">aucun tag défini</span>
                        )}
                      </div>

                      {/* Text input */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Texte du Tag (1–6 caractères)</label>
                        <Input
                          value={tagText}
                          onChange={(e) => setTagText(e.target.value.slice(0, 6))}
                          maxLength={6}
                          placeholder="OG"
                          className="w-32 font-mono h-9 bg-background/50"
                        />
                      </div>

                      {/* Background type */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Style de fond</label>
                        <div className="flex gap-2">
                          {(['solid', 'gradient'] as const).map((type) => (
                            <Button
                              key={type}
                              type="button"
                              size="sm"
                              variant={tagStyle.backgroundType === type ? 'default' : 'outline'}
                              onClick={() => setTagStyle((s) => ({ ...s, backgroundType: type }))}
                              className="h-8 text-xs font-semibold px-3"
                            >
                              {type === 'solid' ? 'Uni' : 'Dégradé'}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Background colors */}
                      {tagStyle.backgroundType === 'solid' ? (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground">Couleur de fond</label>
                          <div className="flex flex-wrap gap-1.5">
                            {TAG_PRESET_COLORS.map((c) => (
                              <button
                                type="button"
                                key={c}
                                onClick={() => setTagStyle((s) => ({ ...s, backgroundColor: c }))}
                                className={cn('h-5.5 w-5.5 rounded-full border-2 transition-transform hover:scale-110 shadow-sm', tagStyle.backgroundColor === c ? 'border-foreground scale-110' : 'border-transparent')}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                            <input
                              type="color"
                              value={tagStyle.backgroundColor}
                              onChange={(e) => setTagStyle((s) => ({ ...s, backgroundColor: e.target.value }))}
                              className="h-5.5 w-5.5 cursor-pointer rounded border p-0 bg-transparent shrink-0"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground">Couleurs du dégradé</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={(() => { try { return JSON.parse(tagStyle.backgroundGradient ?? '{}').from ?? '#374151'; } catch { return '#374151'; } })()}
                              onChange={(e) => { const cur = (() => { try { return JSON.parse(tagStyle.backgroundGradient ?? '{}'); } catch { return { from: '#374151', to: '#6366f1', direction: 'to right' }; } })(); setTagStyle((s) => ({ ...s, backgroundGradient: JSON.stringify({ ...cur, from: e.target.value }) })); }}
                              className="h-7 w-7 cursor-pointer rounded border p-0 bg-transparent shrink-0"
                            />
                            <span className="text-xs text-muted-foreground font-semibold">→</span>
                            <input
                              type="color"
                              value={(() => { try { return JSON.parse(tagStyle.backgroundGradient ?? '{}').to ?? '#6366f1'; } catch { return '#6366f1'; } })()}
                              onChange={(e) => { const cur = (() => { try { return JSON.parse(tagStyle.backgroundGradient ?? '{}'); } catch { return { from: '#374151', to: '#6366f1', direction: 'to right' }; } })(); setTagStyle((s) => ({ ...s, backgroundGradient: JSON.stringify({ ...cur, to: e.target.value }) })); }}
                              className="h-7 w-7 cursor-pointer rounded border p-0 bg-transparent shrink-0"
                            />
                          </div>
                        </div>
                      )}

                      {/* Text color */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Couleur du texte</label>
                        <div className="flex flex-wrap gap-1.5">
                          {TAG_PRESET_COLORS.map((c) => (
                            <button
                              type="button"
                              key={c}
                              onClick={() => setTagStyle((s) => ({ ...s, textColor: c }))}
                              className={cn('h-5.5 w-5.5 rounded-full border-2 transition-transform hover:scale-110 shadow-sm', tagStyle.textColor === c ? 'border-foreground scale-110' : 'border-transparent')}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                          <input
                            type="color"
                            value={tagStyle.textColor}
                            onChange={(e) => setTagStyle((s) => ({ ...s, textColor: e.target.value }))}
                            className="h-5.5 w-5.5 cursor-pointer rounded border p-0 bg-transparent shrink-0"
                          />
                        </div>
                      </div>

                      {/* Border color */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Couleur de bordure</label>
                        <div className="flex flex-wrap gap-1.5">
                          {TAG_PRESET_COLORS.map((c) => (
                            <button
                              type="button"
                              key={c}
                              onClick={() => setTagStyle((s) => ({ ...s, borderColor: c }))}
                              className={cn('h-5.5 w-5.5 rounded-full border-2 transition-transform hover:scale-110 shadow-sm', tagStyle.borderColor === c ? 'border-foreground scale-110' : 'border-transparent')}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                          <input
                            type="color"
                            value={tagStyle.borderColor}
                            onChange={(e) => setTagStyle((s) => ({ ...s, borderColor: e.target.value }))}
                            className="h-5.5 w-5.5 cursor-pointer rounded border p-0 bg-transparent shrink-0"
                          />
                        </div>
                      </div>

                      <Button type="button" size="sm" className="w-full font-semibold" onClick={saveTag} disabled={savingTag || !tagText.trim()}>
                        {savingTag ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Enregistrer le tag
                      </Button>
                    </div>
                  )}

                  {settingsTab === 'roles' && (selectedClan.viewer.permissions?.canManageRoles || selectedClan.viewer.isLeader) && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-border/40 pb-3 gap-2">
                        <div>
                          <h3 className="text-sm font-bold flex items-center gap-1.5">
                            <Shield className="h-4 w-4 text-purple-400" />
                            Rôles du clan
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Gerez les grades personnalises de vos membres et leurs permissions associees.
                          </p>
                        </div>
                        <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs font-semibold border-border hover:bg-muted" onClick={openRoleCreate}>
                          <Plus className="mr-1 h-3.5 w-3.5" /> Nouveau rôle
                        </Button>
                      </div>

                      {(selectedClan.roles ?? []).length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/50 py-10 text-center text-sm text-muted-foreground bg-muted/5">
                          Aucun rôle créé pour ce clan. Les grades personnalisés apparaîtront ici.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(selectedClan.roles ?? []).map((role) => (
                            <div key={role.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-muted/5 p-4 shadow-sm hover:border-border transition-all">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="h-4 w-4 rounded-full flex-shrink-0 border border-border/30 shadow-inner" style={{ backgroundColor: role.color }} />
                                <div className="min-w-0">
                                  <div className="text-sm font-bold">{role.name}</div>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {role.canManageHorses && <span className="rounded bg-amber-500/10 border border-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">Chevaux</span>}
                                    {role.canInviteMembers && <span className="rounded bg-emerald-500/10 border border-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">Inviter</span>}
                                    {role.canKickMembers && <span className="rounded bg-rose-500/10 border border-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-rose-600 dark:text-rose-400">Exclure</span>}
                                    {role.canManageRoles && <span className="rounded bg-purple-500/10 border border-purple-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-purple-600 dark:text-purple-400">Rôles</span>}
                                    {!role.canManageHorses && !role.canInviteMembers && !role.canKickMembers && !role.canManageRoles && (
                                      <span className="text-[9px] text-muted-foreground/50 italic">Aucune permission</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2.5 text-xs font-semibold border-border hover:bg-muted"
                                  onClick={() => openRoleEdit(role)}
                                >
                                  <Pencil className="h-3 w-3 mr-1" /> Modifier
                                </Button>
                                {!role.isSystem ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => void handleDeleteRole(role.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {settingsTab === 'messages' && selectedClan.viewer.isLeader && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-bold flex items-center gap-1.5">
                          <Megaphone className="h-4 w-4 text-indigo-400" />
                          Messages de bienvenue & Annonces
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Configurez des slogans, encouragements ou instructions qui s'affichent aléatoirement aux membres du clan.
                        </p>
                      </div>

                      {/* Message list */}
                      {pumpUpLoading ? (
                        <p className="text-sm text-muted-foreground">Chargement...</p>
                      ) : pumpUpMessages.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/50 py-8 text-center text-sm text-muted-foreground bg-muted/5">
                          Aucun message d'annonce ou de bienvenue pour l'instant.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {pumpUpMessages.map((msg) => (
                            <div key={msg.id} className="flex items-start gap-2 rounded-2xl border border-border/40 bg-muted/5 p-4 shadow-sm hover:border-border transition-all">
                              <div className="mt-1 h-3 w-3 shrink-0 rounded-full border border-border/40 shadow-inner" style={{ backgroundColor: msg.color }} />
                              <p className="min-w-0 flex-1 text-sm leading-relaxed" style={{ color: msg.color !== '#ffffff' ? msg.color : undefined }}>
                                {msg.content}
                              </p>
                              {selectedClan.viewer.isLeader && (
                                <div className="flex shrink-0 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => startEditPumpUp(msg)}
                                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void deletePumpUpMessage(msg.id)}
                                    className="rounded p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-destructive transition-all"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Editor — leaders only */}
                      {selectedClan.viewer.isLeader && (
                        <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/5 p-4 shadow-sm">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            {pumpUpEditId ? 'Modifier le message' : `Nouveau message (${pumpUpMessages.length}/5)`}
                          </p>

                          {/* Preview */}
                          {pumpUpDraft.trim() && (
                            <div className="rounded-xl bg-muted/20 px-3 py-2 border border-border/30">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Aperçu : </span>
                              <span className="text-sm font-semibold" style={{ color: pumpUpColor }}>
                                {pumpUpDraft.replace('{name}', user?.username ?? 'Nom')}
                              </span>
                            </div>
                          )}

                          {/* Text input */}
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-semibold">
                              Texte — utilise <code className="rounded bg-muted px-1.5 font-semibold text-[11px]">{'{name}'}</code> pour inclure le prénom du membre
                            </label>
                            <Input
                              value={pumpUpDraft}
                              onChange={(e) => setPumpUpDraft(e.target.value.slice(0, 120))}
                              placeholder="Bienvenue {name} dans le clan !"
                              maxLength={120}
                              className="bg-background/50 h-9"
                            />
                            <p className="text-right text-[10px] text-muted-foreground font-semibold">{pumpUpDraft.length}/120</p>
                          </div>

                          {/* Color picker */}
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-semibold">Couleur d'affichage du texte</label>
                            <div className="flex flex-wrap gap-1.5">
                              {TAG_PRESET_COLORS.map((c) => (
                                <button
                                  type="button"
                                  key={c}
                                  onClick={() => setPumpUpColor(c)}
                                  className={cn('h-5.5 w-5.5 rounded-full border-2 transition-transform hover:scale-110 shadow-sm', pumpUpColor === c ? 'border-foreground scale-110' : 'border-transparent')}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                              <input
                                type="color"
                                value={pumpUpColor}
                                onChange={(e) => setPumpUpColor(e.target.value)}
                                className="h-5.5 w-5.5 cursor-pointer rounded border p-0 bg-transparent shrink-0"
                              />
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 pt-1">
                            <Button
                              type="button"
                              size="sm"
                              disabled={pumpUpSaving || !pumpUpDraft.trim() || (!pumpUpEditId && pumpUpMessages.length >= 5)}
                              onClick={() => void savePumpUpMessage()}
                              className="flex-1 font-semibold"
                            >
                              {pumpUpSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                              {pumpUpEditId ? 'Modifier' : 'Ajouter'}
                            </Button>
                            {pumpUpEditId && (
                              <Button type="button" size="sm" variant="outline" onClick={cancelEditPumpUp} className="font-semibold border-border">
                                Annuler
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Clan Hub Modal (Tableau de Bord) ── */}
      <Dialog open={clanHubOpen} onOpenChange={setClanHubOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden flex flex-col bg-background/90 backdrop-blur-xl border border-border/40 shadow-2xl">
          {selectedClan && (
            <>
              <DialogHeader className="px-6 py-4 border-b border-border/40 shrink-0 bg-background/40 backdrop-blur-md">
                <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                  <LayoutGrid className="h-5.5 w-5.5 text-primary" />
                  Tableau de Bord — {selectedClan.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Accédez au chat, à la banque, aux guerres, à l'inventaire et à la gestion opérationnelle de votre clan.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 flex min-h-0 bg-background/30">
                {/* Left Sidebar (Sidetabs) */}
                <div className="w-56 border-r border-border/40 bg-muted/10 p-4 space-y-1.5 shrink-0 backdrop-blur-sm overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab('info')}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all text-left border border-transparent",
                      activeTab === 'info'
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Layout className="h-4 w-4 text-sky-400" />
                    Infos & Effets
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all text-left border border-transparent",
                      activeTab === 'chat'
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <MessageSquare className="h-4 w-4 text-sky-400" />
                    Chat du clan
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('bank')}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all text-left border border-transparent",
                      activeTab === 'bank'
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Landmark className="h-4 w-4 text-emerald-400" />
                    Banque
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('inventory')}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all text-left border border-transparent",
                      activeTab === 'inventory'
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Package className="h-4 w-4 text-orange-400" />
                    Inventaire
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('guerre')}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all text-left border border-transparent",
                      activeTab === 'guerre'
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Swords className="h-4 w-4 text-rose-400" />
                    Guerre
                  </button>

                  {featuredEvent ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('event')}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all text-left border border-transparent",
                        activeTab === 'event'
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      Événement
                    </button>
                  ) : null}

                  {selectedClan.viewer.permissions?.canInviteMembers || selectedClan.viewer.isLeader ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('requests')}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all border border-transparent",
                        activeTab === 'requests'
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <UserX className="h-4 w-4 rotate-180 text-emerald-400" />
                        Candidatures
                      </span>
                      {selectedClan.joinRequests.length > 0 ? (
                        <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px] font-bold">
                          {selectedClan.joinRequests.length}
                        </Badge>
                      ) : null}
                    </button>
                  ) : null}
                </div>

                {/* Right Content Area */}
                <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-background/50">
                  {activeTab === 'info' && (
                    <div className="space-y-6">
                      {/* Detailed Description */}
                      <div className="rounded-2xl border border-border/40 bg-muted/5 p-5 space-y-4">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold flex items-center gap-1.5">
                            <Layout className="h-4 w-4 text-primary" />
                            À propos du clan
                          </h3>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {selectedClan.description || 'Aucune description pour le moment.'}
                          </p>
                        </div>
                      </div>

                      {/* Active Effects */}
                      <div className="rounded-2xl border border-border/40 bg-muted/5 p-5 space-y-4">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-amber-500" />
                            Boosts & Effets Actifs
                          </h3>
                          <p className="text-xs text-muted-foreground">Les bonus en cours d'activation pour tous les membres.</p>
                        </div>
                        {selectedClan.activeEffects.length > 0 ? (
                          <div className="flex flex-wrap gap-2.5 pt-1">
                            {selectedClan.activeEffects.map((effect) => (
                              <div key={effect.id} className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/15 p-2 pr-3">
                                <ClanEffectBadge effect={effect} />
                                <div>
                                  <div className="text-xs font-semibold">{effect.name}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {effect.activeUntil ? `Expire dans ${formatEffectCooldown(effect)}` : 'Permanent'}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground italic">Aucun effet actif pour le moment.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'chat' && (
                    <Card className="border-none bg-transparent shadow-none">
                      <CardContent className="space-y-4 p-0">
                        <div className="max-h-[50vh] min-h-[350px] flex-1 space-y-2 overflow-y-auto rounded-2xl border border-border/50 bg-muted/15 p-4">
                          {chatLoading ? (
                            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                              <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />
                              Chargement du chat...
                            </div>
                          ) : chatMessages.length === 0 ? (
                            <div className="py-12 text-center text-sm text-muted-foreground">Lance la conversation dans le clan ! 💬</div>
                          ) : (
                            chatMessages.map((entry) => {
                              if (entry.type === 'system') {
                                return (
                                  <div key={entry.id} className="flex justify-center">
                                    <div className="flex max-w-[90%] items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
                                      <Megaphone className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                      <p className="whitespace-pre-wrap break-words text-center text-xs text-amber-600 dark:text-amber-300">{entry.message}</p>
                                    </div>
                                  </div>
                                );
                              }
                              const isOwnMessage = entry.user?.id === user?.id;
                              return (
                                <div key={entry.id} className={cn('flex', isOwnMessage ? 'justify-end' : 'justify-start')}>
                                  <div className={cn('max-w-[85%] rounded-xl border border-border/50 px-3 py-2', isOwnMessage ? 'border-primary/20 bg-primary/10' : 'bg-background')}>
                                    <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                      <UsernameDisplay username={entry.user?.username ?? 'Inconnu'} usernameColor={entry.user?.usernameColor ?? null} />
                                      <span>•</span>
                                      <span>{formatDate(entry.createdAt)}</span>
                                    </div>
                                    <p className="whitespace-pre-wrap break-words text-sm">{entry.message}</p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        <form onSubmit={handleSendChatMessage} className="space-y-2">
                          <Textarea
                            value={chatDraft}
                            onChange={(event) => setChatDraft(event.target.value.slice(0, 400))}
                            rows={3}
                            placeholder="Écris un message à tes camarades de clan..."
                            disabled={chatSending}
                            className="bg-background/50 text-sm resize-none"
                          />
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-muted-foreground">{chatDraft.trim().length}/400</span>
                            <Button type="submit" size="sm" className="h-9 px-4 font-semibold" disabled={chatSending || !chatDraft.trim()}>
                              {chatSending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                              Envoyer
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  )}

                  {activeTab === 'bank' && (
                    <Card className="border-none bg-transparent shadow-none">
                      <CardContent className="space-y-4 p-0">
                        <div className="flex flex-wrap items-center justify-between border-b border-border/50 pb-4 gap-3">
                          <div>
                            <h3 className="text-sm font-semibold flex items-center gap-1.5">
                              <Landmark className="h-4 w-4 text-emerald-400" />
                              Banque de clan
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Les membres peuvent déposer. Seul le chef peut dépenser cet argent pour les améliorations du clan.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setBankHistoryOpen(true)}
                            className="h-9 gap-1 text-xs font-semibold border-border hover:bg-muted"
                          >
                            <History className="h-3.5 w-3.5" /> Historique des dépôts
                          </Button>
                        </div>

                        <div className="rounded-2xl border border-border/50 bg-muted/15 p-5 space-y-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-bold">
                                <CurrencyIcon type="money" className="h-3.5 w-3.5" />
                                Solde actuel
                              </div>
                              <div className="mt-1.5 text-3xl font-bold tabular-nums text-foreground">
                                {formatMoney(selectedClan.clanBankMoney)}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-end gap-2.5">
                              <div className="w-full sm:w-auto min-w-[150px] space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Montant à déposer</label>
                                <Input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={bankDepositAmount}
                                  onChange={(event) => setBankDepositAmount(event.target.value)}
                                  disabled={depositingBank}
                                  className="h-9 text-sm bg-background"
                                />
                              </div>
                              <Button type="button" size="sm" className="h-9 font-semibold" onClick={handleDepositToBank} disabled={depositingBank}>
                                {depositingBank ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CurrencyIcon type="money" className="mr-1.5 h-3.5 w-3.5" />}
                                Déposer
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border/50 bg-muted/15 p-4">
                          <div className="text-sm font-semibold flex items-center gap-1.5">
                            <Package className="h-4 w-4 text-orange-400" /> Stockage
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {selectedClan.ownedItems.length > 0
                              ? `${selectedClan.ownedItems.length} objet${selectedClan.ownedItems.length > 1 ? "s" : ""} différent${selectedClan.ownedItems.length > 1 ? "s" : ""} en stock`
                              : 'Aucun objet de clan en stock.'}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {activeTab === 'inventory' && (
                    <Card className="border-none bg-transparent shadow-none">
                      <CardContent className="space-y-4 p-0">
                        <div>
                          <h3 className="text-sm font-semibold flex items-center gap-1.5">
                            <Package className="h-4 w-4 text-orange-400" />
                            Objets de clan
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Achetés avec la banque du clan. Le chef peut les activer pour le bénéfice de tous.
                          </p>
                        </div>

                        {selectedClan.ownedItems.length > 0 ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {selectedClan.ownedItems.map((clanItem) => (
                              <div key={clanItem.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-border/50 bg-muted/5 p-4 shadow-sm hover:border-border transition-all">
                                <div>
                                  <div className="flex items-center gap-2 text-sm font-bold">
                                    <span>{clanItem.item.name} {"×"}{clanItem.quantity}</span>
                                    {["CLAN_BANNER", "CLAN_PROFILE_PICTURE"].includes(parseClanItemEffect(clanItem.item.effect)?.type ?? "") ? (
                                      <Badge variant="secondary" className="text-[9px] px-1 py-0.5">Image requise</Badge>
                                    ) : null}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">{clanItem.item.description}</div>
                                </div>
                                <div className="pt-2 border-t border-border/10 flex justify-end">
                                  {selectedClan.viewer.isLeader ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => handleUseClanItem(clanItem)}
                                      disabled={usingClanItemId === clanItem.id}
                                      className="h-8 text-xs font-semibold px-3"
                                    >
                                      {usingClanItemId === clanItem.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                                      {["CLAN_BANNER", "CLAN_PROFILE_PICTURE"].includes(parseClanItemEffect(clanItem.item.effect)?.type ?? "") ? "Choisir l'image" : "Activer"}
                                    </Button>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px]">Chef requis</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/50 px-4 py-8 text-center text-sm text-muted-foreground bg-muted/5">
                            Aucun objet de clan en stock. Les achats apparaîtront ici.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {activeTab === 'guerre' && (
                    <div className="space-y-5">
                      {/* War stats bar */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                        <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5 shadow-sm">
                          <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Trophées</div>
                          <div className="text-sm font-bold mt-0.5 text-amber-500">{formatMoney(selectedClan.warTrophies)}</div>
                        </div>
                        <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5 shadow-sm">
                          <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Bilan</div>
                          <div className="text-sm font-bold mt-0.5">{selectedClan.warWins}V {selectedClan.warLosses}D {selectedClan.warDraws}N</div>
                        </div>
                        <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5 shadow-sm">
                          <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Éligibilité</div>
                          <div className="text-sm font-bold mt-0.5">
                            {selectedClan.memberCount >= selectedClan.warHub.minimumMembersRequired
                              ? 'Éligible'
                              : `${selectedClan.warHub.minimumMembersRequired} req.`}
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5 shadow-sm col-span-2 sm:col-span-1">
                          <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Disponibilité</div>
                          <div className="text-xs font-semibold mt-0.5 truncate">
                            {selectedClan.warHub.cooldownEndsAt
                              ? `Dans ${formatCountdown(selectedClan.warHub.cooldownEndsAt)}`
                              : 'Immédiate'}
                          </div>
                        </div>
                      </div>

                      {selectedClan.warHub.canDeclareWar && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setWarListDialogOpen(true)} className="h-9 px-4 font-semibold border-border hover:bg-muted">
                            <History className="mr-1.5 h-3.5 w-3.5" />
                            Guerres passées
                          </Button>
                          <Button size="sm" onClick={() => setWarDialogOpen(true)} className="h-9 px-4 font-semibold shadow-md">
                            <Swords className="mr-2 h-4 w-4" />
                            Déclarer une guerre
                          </Button>
                        </div>
                      )}

                      {/* Active war */}
                      {selectedWar ? (
                        <Card className="border border-border/40 bg-muted/5 shadow-none rounded-2xl">
                          <div className="border-b border-border/20 p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={getStatusVariant(selectedWar.status)}>{getStatusLabel(selectedWar.status)}</Badge>
                                  <span className="text-xs text-muted-foreground">Objectif {selectedWar.targetScore} points</span>
                                </div>
                                <h4 className="mt-1.5 text-lg font-bold tracking-tight">
                                  {selectedWar.attackerClan.name} contre {selectedWar.defenderClan.name}
                                </h4>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {selectedWar.status === 'ACTIVE'
                                    ? `Fin prévue dans ${formatCountdown(selectedWar.endsAt)}.`
                                    : `Terminée le ${formatDate(selectedWar.completedAt)}.`}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-center">
                                <div className="rounded-xl border border-border/40 bg-background px-4 py-2 shadow-sm min-w-[100px]">
                                  <div className="text-[10px] text-muted-foreground truncate">{selectedWar.attackerClan.name}</div>
                                  <div className="mt-0.5 text-2xl font-bold tabular-nums text-primary">{selectedWar.attackerScore}</div>
                                </div>
                                <div className="rounded-xl border border-border/40 bg-background px-4 py-2 shadow-sm min-w-[100px]">
                                  <div className="text-[10px] text-muted-foreground truncate">{selectedWar.defenderClan.name}</div>
                                  <div className="mt-0.5 text-2xl font-bold tabular-nums text-primary">{selectedWar.defenderScore}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <CardContent className="space-y-5 p-5">
                            {isOwnClan && (
                              <div className="space-y-4">
                                <div className="rounded-2xl border border-border/40 bg-background p-4 space-y-4 shadow-sm">
                                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div>
                                      <h5 className="font-semibold text-sm">Centre de commandement</h5>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        Lance des assauts tactiques instantanés ou complète les mini-jeux pour pousser la ligne de front.
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <Button size="sm" variant="outline" onClick={() => setWarGamesDialogOpen(true)} className="h-8 text-xs border-border">
                                        🎮 Mes Parties
                                      </Button>
                                      <Badge variant="outline" className="font-semibold h-7 bg-primary/5 text-primary border-primary/20">
                                        Endurance {selectedWar.viewerActions.staminaRemaining}/{selectedWar.viewerActions.staminaCap}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-3">
                                    {selectedClan.warHub.attackTypes.map((attackType) => {
                                      const disabled =
                                        warActionKey === `attack:${attackType.type}`
                                        || selectedWar.viewerActions.staminaRemaining < attackType.staminaCost
                                        || !['PREPARING', 'ACTIVE'].includes(selectedWar.status);
                                      return (
                                        <div key={attackType.type} className="rounded-2xl border border-border/40 bg-muted/5 p-4 flex flex-col justify-between">
                                          <div>
                                            <div className="flex items-center justify-between gap-2 border-b border-border/10 pb-2">
                                              <div className="text-xs font-bold text-foreground truncate">{attackType.label}</div>
                                              <Badge variant="secondary" className="text-[9px] px-1 py-0.5 shrink-0">Coût {attackType.staminaCost}</Badge>
                                            </div>
                                            <p className="mt-2 text-[11px] leading-normal text-muted-foreground">{attackType.description}</p>
                                          </div>
                                          <div className="mt-3">
                                            <div className="text-[10px] text-muted-foreground font-semibold">
                                              {attackType.minPoints} à {attackType.maxPoints} pts • dégâts structurels {attackType.structureDamage}
                                            </div>
                                            <Button
                                              size="sm"
                                              className="mt-3 w-full text-xs font-semibold h-8"
                                              disabled={disabled}
                                              onClick={() => void handleWarAttack(attackType.type)}
                                            >
                                              {warActionKey === `attack:${attackType.type}` ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Axe className="mr-1.5 h-3 w-3" />}
                                              Frapper
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Games */}
                                <div className="rounded-2xl border border-border/40 bg-background p-4 space-y-4 shadow-sm">
                                  <div className="flex items-center justify-between border-b border-border/10 pb-2">
                                    <div>
                                      <h5 className="font-semibold text-sm">Jeux de guerre</h5>
                                      <p className="text-xs text-muted-foreground">Complétez les jeux quotidiennement pour marquer des points.</p>
                                    </div>
                                    <Badge variant="secondary" className="text-[10px]">{selectedWar.viewerSide === 'ATTACKER' ? 'Attaquant' : 'Défenseur'}</Badge>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-3">
                                    {/* Memory */}
                                    <div className={cn('rounded-2xl border p-4 space-y-3 flex flex-col justify-between', gameStatus?.canPlayMemory ? 'border-amber-500/20 bg-amber-500/5' : 'border-border/40 bg-muted/5')}>
                                      <div>
                                        <div className="flex items-start justify-between gap-2 border-b border-border/10 pb-2">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-lg">🧩</span>
                                            <span className="font-bold text-xs">Jeu Mémoire</span>
                                          </div>
                                          {gameStatus?.memoryPlayedToday && <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">✓ Joué</Badge>}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-2 leading-normal">Retournez les paires pour fortifier et améliorer vos défenses du clan.</p>
                                      </div>
                                      <div className="flex flex-col gap-1.5 mt-2">
                                        <Button size="sm" className="w-full text-xs font-semibold h-8" disabled={!gameStatus?.canPlayMemory} onClick={() => openGame('MEMORY', false)}>
                                          {gameStatus?.memoryPlayedToday ? 'Déjà joué' : 'Jouer (1×/jour)'}
                                        </Button>
                                        <Button size="sm" variant="outline" className="w-full text-xs font-semibold h-8 border-border" onClick={() => openGame('MEMORY', true)}>
                                          Entraînement
                                        </Button>
                                      </div>
                                    </div>
                                    {/* Bomb */}
                                    <div className={cn('rounded-2xl border p-4 space-y-3 flex flex-col justify-between', gameStatus?.canPlayBomb ? 'border-rose-500/20 bg-rose-500/5' : 'border-border/40 bg-muted/5')}>
                                      <div>
                                        <div className="flex items-start justify-between gap-2 border-b border-border/10 pb-2">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-lg">💣</span>
                                            <span className="font-bold text-xs">Bombardement</span>
                                          </div>
                                          {gameStatus?.bombPlayedToday && <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">✓ Joué</Badge>}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-2 leading-normal">Pilotez un avion et larguez des bombes sur les structures adverses.</p>
                                      </div>
                                      <div className="flex flex-col gap-1.5 mt-2">
                                        <Button size="sm" className="w-full text-xs font-semibold h-8" disabled={!gameStatus?.canPlayBomb} onClick={() => openGame('BOMB', false)}>
                                          {gameStatus?.bombPlayedToday ? 'Déjà joué' : 'Attaquer (1×/jour)'}
                                        </Button>
                                        <Button size="sm" variant="outline" className="w-full text-xs font-semibold h-8 border-border" onClick={() => openGame('BOMB', true)}>
                                          Entraînement
                                        </Button>
                                      </div>
                                    </div>
                                    {/* Naval */}
                                    <div className={cn('rounded-2xl border p-4 space-y-3 flex flex-col justify-between', (gameStatus?.naval?.shotsRemaining ?? 0) > 0 ? 'border-sky-500/20 bg-sky-500/5' : 'border-border/40 bg-muted/5')}>
                                      <div>
                                        <div className="flex items-start justify-between gap-2 border-b border-border/10 pb-2">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-lg">🎯</span>
                                            <span className="font-bold text-xs">Guerre Navale</span>
                                          </div>
                                          {gameStatus?.naval && (
                                            <Badge variant={(gameStatus.naval.shotsRemaining ?? 0) > 0 ? 'secondary' : 'outline'} className="text-[8px] px-1 py-0 shrink-0">
                                              {gameStatus.naval.shotsRemaining} tirs
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-2 leading-normal">Bombardez la base ennemie sur une grille tactique 6×6 partagée.</p>
                                      </div>
                                      <div className="mt-4 flex flex-col justify-end">
                                        <Button size="sm" className="w-full text-xs font-semibold h-8 mt-2" disabled={(gameStatus?.naval?.shotsRemaining ?? 0) <= 0} onClick={() => openGame('NAVAL', false)}>
                                          {(gameStatus?.naval?.shotsRemaining ?? 0) <= 0 ? 'Plus de tirs' : 'Ouvrir la carte'}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Defenses list */}
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <div>
                                    <div className="mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                      <span>🛡️ Nos défenses</span>
                                      <span className="text-[10px] font-normal text-muted-foreground lowercase">({getWarOwnSide(selectedWar, selectedClan.id).name})</span>
                                    </div>
                                    <div className="space-y-1.5">
                                      {getWarDefenseSet(selectedWar, selectedClan.id).map((defense) => (
                                        <UpgradeRow key={defense.type} defense={defense} />
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                      <Target className="h-3 w-3" />
                                      <span>Défenses ennemies</span>
                                    </div>
                                    <div className="space-y-1.5">
                                      {getWarEnemyDefenseSet(selectedWar, selectedClan.id).map((defense) => (
                                        <UpgradeRow key={defense.type} defense={defense} />
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* Rewards */}
                                <div className="rounded-2xl border border-border/40 bg-background p-4 space-y-3 shadow-sm">
                                  <h5 className="font-semibold text-sm">Récompenses de guerre</h5>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-border/40 bg-emerald-500/5 p-3 text-xs leading-normal">
                                      <div className="font-bold text-emerald-600 dark:text-emerald-400">Victoire</div>
                                      <div className="mt-1 text-muted-foreground">+{selectedWar.rewardTable.winner.money} money, +{selectedWar.rewardTable.winner.aura} aura et {formatSignedValue(selectedWar.rewardTable.winner.trophies)} trophées pour le clan.</div>
                                    </div>
                                    <div className="rounded-2xl border border-border/40 bg-muted/5 p-3 text-xs leading-normal">
                                      <div className="font-bold text-foreground/80">Défaite / égalité</div>
                                      <div className="mt-1 text-muted-foreground font-semibold">+{selectedWar.rewardTable.loser.money} money, +{selectedWar.rewardTable.loser.aura} aura et {formatSignedValue(selectedWar.rewardTable.loser.trophies)} trophées pour le clan.</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-3 border-b border-border/10 pb-2">
                                <div>
                                  <h5 className="font-semibold text-sm">Participation des membres</h5>
                                  <p className="text-[11px] text-muted-foreground font-medium">
                                    Vérifiez qui a déjà fait ses combats de guerre et son support défensif.
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-[10px]">{getWarOwnSide(selectedWar, selectedClan.id).name}</Badge>
                              </div>
                              {getWarParticipantStats(selectedWar, selectedClan.id).length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground bg-muted/5">
                                  Aucune participation enregistrée pour l'instant.
                                </div>
                              ) : (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {getWarParticipantStats(selectedWar, selectedClan.id).map((member) => (
                                    <WarMemberRow key={member.user.id} member={member} />
                                  ))}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <Alert className="rounded-2xl bg-muted/5 border-border/40">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Pas de guerre en cours</AlertTitle>
                          <AlertDescription className="text-xs">
                            {selectedClan.warHub.canDeclareWar
                              ? 'Le chef peut choisir un clan adverse et démarrer la guerre immédiatement.'
                              : selectedClan.warHub.cooldownEndsAt
                                ? `Le clan récupère encore jusqu'au ${formatDate(selectedClan.warHub.cooldownEndsAt)}.`
                                : selectedClan.memberCount < selectedClan.warHub.minimumMembersRequired
                                  ? `Le clan doit atteindre ${selectedClan.warHub.minimumMembersRequired} membres pour entrer en guerre.`
                                  : 'Aucun adversaire disponible avec un total de trophées assez proche pour lancer une guerre.'}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* War history list (Relocated button & history trigger) */}
                      <div className="flex justify-start">
                        <Button size="sm" variant="outline" onClick={() => setWarListDialogOpen(true)} className="h-9 px-4 font-semibold border-border hover:bg-muted">
                          <History className="mr-1.5 h-3.5 w-3.5" />
                          Consulter l'historique complet des guerres terminées
                        </Button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'event' && featuredEvent && (
                    <div className="space-y-4">
                      <Card className={panelClassName}>
                        <CardContent className="space-y-4 p-4">
                          <div
                            className="rounded-2xl border border-border/50 p-4"
                            style={{
                              background: featuredEvent.highlightColor
                                ? `linear-gradient(135deg, ${featuredEvent.highlightColor}22, transparent 60%)`
                                : undefined,
                            }}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{getClanEventStatusLabel(featuredEvent.status)}</Badge>
                              <Badge variant="outline">
                                {featuredEvent.status === 'SCHEDULED'
                                  ? `Débute ${formatDate(featuredEvent.startsAt)}`
                                  : featuredEvent.status === 'ACTIVE'
                                    ? `Fin ${formatDate(featuredEvent.endsAt)}`
                                    : `Clôturé ${formatDate(featuredEvent.endsAt)}`}
                              </Badge>
                            </div>
                            <h2 className="mt-3 text-xl font-semibold tracking-tight">{featuredEvent.title}</h2>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {featuredEvent.description || 'Un événement compétitif de clan est en cours.'}
                            </p>
                            {featuredEvent.rulesSummary ? (
                              <div className="mt-3 rounded-xl border border-border/50 bg-background/70 p-3 text-sm text-muted-foreground">
                                {featuredEvent.rulesSummary}
                              </div>
                            ) : null}
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-border/50 bg-muted/15 p-4">
                              <div className="text-xs uppercase tracking-wide text-muted-foreground">Rang du clan</div>
                              <div className="mt-2 text-2xl font-semibold">
                                {featuredEvent.selectedClanEntry?.rank ? `#${featuredEvent.selectedClanEntry.rank}` : 'Non classé'}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-border/50 bg-muted/15 p-4">
                              <div className="text-xs uppercase tracking-wide text-muted-foreground">Points</div>
                              <div className="mt-2 text-2xl font-semibold">
                                {(featuredEvent.selectedClanEntry?.totalPoints ?? 0).toLocaleString('fr-FR')}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-border/50 bg-muted/15 p-4">
                              <div className="text-xs uppercase tracking-wide text-muted-foreground">Participation</div>
                              <div className="mt-2 text-sm font-medium">
                                {featuredEvent.canParticipate ? 'Ton clan peut jouer maintenant' : 'Lecture seule sur ce clan'}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                        <Card className={panelClassName}>
                          <CardContent className="space-y-4 p-4">
                            <SectionTitle title="Quêtes d'événement" description="Chaque quête terminée ajoute des points au clan." />
                            <div className="space-y-3">
                              {featuredEvent.quests.map((quest) => (
                                <div key={quest.id} className="rounded-2xl border border-border/50 bg-muted/15 p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <div className="text-sm font-medium">{quest.title}</div>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {quest.description || getClanEventActivityLabel(quest.activityType)}
                                      </p>
                                    </div>
                                    <Badge variant={quest.progress.isCompleted ? 'secondary' : 'outline'}>
                                      +{quest.pointsReward} pts
                                    </Badge>
                                  </div>
                                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                    <span>{getClanEventActivityLabel(quest.activityType)}</span>
                                    <span>
                                      {Math.min(quest.progress.currentValue, quest.targetValue)}/{quest.targetValue}
                                    </span>
                                  </div>
                                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={cn('h-full rounded-full transition-all', quest.progress.isCompleted ? 'bg-emerald-500' : 'bg-primary')}
                                      style={{ width: `${Math.min(100, (quest.progress.currentValue / quest.targetValue) * 100)}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        <div className="space-y-4">
                          <Card className={panelClassName}>
                            <CardContent className="space-y-4 p-4">
                              <SectionTitle title="Mini-jeux" description="Joue pour ajouter des points instantanément." />
                              <div className="space-y-3">
                                {featuredEvent.miniGames.map((miniGame) => {
                                  const isCoolingDown = Boolean(miniGame.viewerStats.nextAvailableAt && new Date(miniGame.viewerStats.nextAvailableAt).getTime() > Date.now());
                                  return (
                                    <div key={miniGame.id} className="rounded-2xl border border-border/50 bg-muted/15 p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <div className="text-sm font-medium">{miniGame.title}</div>
                                          <p className="mt-1 text-xs text-muted-foreground">{miniGame.description || miniGame.instructions || 'Mini-jeu de score instantané.'}</p>
                                        </div>
                                        <Badge variant="outline">Cap {miniGame.maxPointsPerAttempt} pts</Badge>
                                      </div>
                                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                                        <span>Meilleur score: {miniGame.viewerStats.bestScore.toLocaleString('fr-FR')}</span>
                                        <span>Tentatives: {miniGame.viewerStats.attemptsUsed}{miniGame.maxAttemptsPerUser ? `/${miniGame.maxAttemptsPerUser}` : ''}</span>
                                        {isCoolingDown ? <span>Recharge: {formatCountdown(miniGame.viewerStats.nextAvailableAt)}</span> : null}
                                      </div>
                                      <Button
                                        className="mt-3 w-full"
                                        disabled={!featuredEvent.canParticipate || isCoolingDown || eventMiniGameSubmitting}
                                        onClick={() => {
                                          if (miniGame.type === 'REFLEX') startReflexMiniGame(miniGame);
                                          else startTapFrenzyMiniGame(miniGame);
                                        }}
                                      >
                                        Jouer
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>

                          <Card className={panelClassName}>
                            <CardContent className="space-y-4 p-4">
                              <SectionTitle title="Top clans" description="Classement de l'événement." />
                              <div className="space-y-2">
                                {featuredEvent.leaderboard.map((entry) => (
                                  <div key={entry.clan.id} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2.5">
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium">#{entry.rank} {entry.clan.name}</div>
                                      <div className="text-xs text-muted-foreground">{entry.clan.memberCount} membres</div>
                                    </div>
                                    <div className="text-sm font-semibold">{entry.totalPoints.toLocaleString('fr-FR')} pts</div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          <Card className={panelClassName}>
                            <CardContent className="space-y-4 p-4">
                              <SectionTitle title="Récompenses" description="Répartition selon le rang final du clan." />
                              <div className="space-y-2">
                                {featuredEvent.rewardTiers.map((tier) => (
                                  <div key={tier.id} className="rounded-xl border border-border/50 bg-muted/15 p-3 text-sm">
                                    <div className="font-medium">{tier.title}</div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      Rangs {tier.minRank}{tier.maxRank !== tier.minRank ? `-${tier.maxRank}` : ''} • {tier.moneyReward} money • {tier.auraReward} aura{tier.item ? ` • ${tier.item.name}` : ''}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      <Card className={panelClassName}>
                        <CardContent className="space-y-4 p-4">
                          <SectionTitle title="Activité récente" description="Derniers points inscrits dans l'événement." />
                          <div className="space-y-2">
                            {featuredEvent.recentActivity.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                                Aucun point enregistré pour l'instant.
                              </div>
                            ) : featuredEvent.recentActivity.map((activity) => (
                              <div key={activity.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2.5">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium">{activity.label}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {activity.clan.name} • {formatDate(activity.createdAt)}
                                  </div>
                                </div>
                                <Badge variant="secondary">+{activity.points} pts</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {activeTab === 'requests' && (selectedClan.viewer.permissions?.canInviteMembers || selectedClan.viewer.isLeader) && (
                    <Card className="border-none bg-transparent shadow-none">
                      <CardContent className="space-y-4 p-0">
                        <div className="flex items-center justify-between border-b border-border/50 pb-4">
                          <div>
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                              <UserX className="h-5 w-5 rotate-180 text-emerald-500" />
                              Candidatures de recrutement
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Validez ou rejetez les demandes des joueurs qui souhaitent rejoindre le clan.
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-bold px-2 py-0.5">
                            {selectedClan.joinRequests.length} en attente
                          </Badge>
                        </div>

                        {selectedClan.joinRequests.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="h-12 w-12 rounded-full bg-muted/10 flex items-center justify-center text-muted-foreground/40 mb-3 border border-dashed border-border">
                              <UserX className="h-5 w-5 rotate-180" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">Aucune candidature en attente</p>
                            <p className="text-xs text-muted-foreground/75 mt-1">Les nouvelles demandes de recrutement apparaîtront ici.</p>
                          </div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {selectedClan.joinRequests.map((request) => (
                              <div
                                key={request.id}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/5 p-4 shadow-sm hover:border-border transition-all"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <Avatar className="h-10 w-10 border border-border/40 shadow-sm">
                                    <AvatarImage src={resolveImageUrl(request.profilePicture)} alt={request.username} />
                                    <AvatarFallback>{getAvatarFallback(request.username)}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <UsernameDisplay username={request.username} usernameColor={request.usernameColor} />
                                    <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground font-semibold">
                                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                      <span>{formatAura(request.aura)} aura</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  <Button
                                    size="sm"
                                    className="h-9 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition-all"
                                    onClick={() => handleRequestAction(request.id, 'accept')}
                                    disabled={actionLoading}
                                  >
                                    <Check className="h-3.5 w-3.5 mr-1" /> Accepter
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 px-3 text-xs border-rose-500/20 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 font-semibold"
                                    onClick={() => handleRequestAction(request.id, 'reject')}
                                    disabled={actionLoading}
                                  >
                                    <X className="h-3.5 w-3.5 mr-1" /> Rejeter
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Relocated Dialogs */}
      {selectedClan && (
        <Dialog open={bankHistoryOpen} onOpenChange={setBankHistoryOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Historique de la banque</DialogTitle>
              <DialogDescription>
                Chaque dépôt effectué par un membre dans la banque du clan.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {selectedClan.bankContributionHistory.length > 0 ? (
                selectedClan.bankContributionHistory.map((entry) => (
                  <BankContributionRow key={entry.id} entry={entry} />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border/50 px-3 py-4 text-sm text-muted-foreground">
                  Aucun dépôt enregistré pour le moment.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedClan && (
        <Dialog open={warListDialogOpen} onOpenChange={setWarListDialogOpen}>
          <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Guerres du clan</DialogTitle>
              <DialogDescription>
                Toutes les guerres de {selectedClan.name}, avec les détails dépliables de chaque conflit.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[65vh] overflow-y-auto pr-1">
              {clanWars.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                  Aucune guerre enregistrée pour ce clan.
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full space-y-3">
                  {clanWars.map((war) => {
                    const opponent = getWarOpponent(war, selectedClan.id);
                    const resultBadge = getWarResultBadge(war, selectedClan.id);
                    const ownTrophyChange = selectedClan.id === war.attackerClan.id ? war.trophyChanges.attacker : war.trophyChanges.defender;
                    const ownParticipants = getWarParticipantStats(war, selectedClan.id);
                    const opponentParticipants = getWarOpponentParticipantStats(war, selectedClan.id);
                    return (
                      <AccordionItem
                        key={war.id}
                        value={war.id}
                        className="overflow-hidden rounded-2xl border border-border/50 bg-muted/15 px-4"
                      >
                        <AccordionTrigger className="py-4 hover:no-underline">
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">Contre {opponent.name}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {war.status === 'COMPLETED'
                                  ? `${formatDate(war.completedAt)} • Score ${war.attackerScore} - ${war.defenderScore}`
                                  : `${formatDate(war.startsAt)} • En cours ${war.viewerScore} - ${war.opponentScore}`}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge variant={resultBadge.variant}>{resultBadge.label}</Badge>
                              <span className="text-xs font-medium text-muted-foreground">
                                {formatSignedValue(ownTrophyChange)} trophées
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="rounded-2xl border border-border/50 bg-background/70 p-3">
                                <div className="text-xs text-muted-foreground">Score</div>
                                <div className="mt-1 text-lg font-semibold">{war.attackerScore} - {war.defenderScore}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {war.attackerClan.name} contre {war.defenderClan.name}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-border/50 bg-background/70 p-3">
                                <div className="text-xs text-muted-foreground">Dates</div>
                                <div className="mt-1 text-sm font-medium">Début: {formatDate(war.startsAt)}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {war.completedAt ? `Fin: ${formatDate(war.completedAt)}` : `Fin prévue: ${formatDate(war.endsAt)}`}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-border/50 bg-background/70 p-3">
                                <div className="text-xs text-muted-foreground">Récompenses</div>
                                <div className="mt-1 text-sm font-medium">
                                  +{war.rewardTable.winner.money} money / +{war.rewardTable.winner.aura} aura
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {formatSignedValue(war.rewardTable.winner.trophies)} trophées en victoire
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                              <div className="space-y-2">
                                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Participation de {selectedClan.name}
                                </div>
                                {ownParticipants.length === 0 ? (
                                  <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                                    Aucune donnée de participation.
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {ownParticipants.map((member) => (
                                      <WarMemberRow key={`${war.id}:${member.user.id}`} member={member} />
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Participation de {opponent.name}
                                </div>
                                {opponentParticipants.length === 0 ? (
                                  <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                                    Aucune donnée de participation.
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {opponentParticipants.map((member) => (
                                      <WarMemberRow key={`${war.id}:opponent:${member.user.id}`} member={member} showClanName />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {war.recentAttacks.length > 0 ? (
                              <div className="space-y-2">
                                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Attaques récentes
                                </div>
                                <div className="space-y-2">
                                  {war.recentAttacks.slice(0, 5).map((attack) => (
                                    <div key={attack.id} className="rounded-2xl border border-border/50 bg-background/70 px-3 py-2 text-sm">
                                      <span className="font-medium">{attack.attackLabel}</span> par {attack.user.username} • {attack.finalPoints} pts
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedClan && (
        <Dialog open={warGamesDialogOpen} onOpenChange={setWarGamesDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Mes parties de guerre</DialogTitle>
              <DialogDescription>
                {selectedWar && isOwnClan
                  ? `Score actuel: ${selectedWar.viewerScore} - ${selectedWar.opponentScore}. Lance tes parties restantes depuis cette fenêtre.`
                  : "Tu n'es pas dans une guerre active avec ce clan."}
              </DialogDescription>
            </DialogHeader>
            {!selectedWar || !isOwnClan || !selectedClan.viewer.isMember ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-5 text-sm text-muted-foreground">
                Aucune guerre active pour toi dans ce clan.
              </div>
            ) : pendingWarGames.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-5 text-sm text-muted-foreground">
                Tu as déjà joué toutes tes parties disponibles pour le moment.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingWarGames.map((game) => (
                  <div key={game.type} className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/15 p-4">
                    <div>
                      <div className="text-sm font-medium">{game.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{game.description}</div>
                      <div className="mt-2 text-xs font-medium text-emerald-600">{game.remainingLabel}</div>
                    </div>
                    <Button onClick={() => launchWarGameFromDialog(game.type)}>
                      {game.actionLabel}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}


      <Dialog open={bannerItemDialogOpen} onOpenChange={setBannerItemDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{bannerItemEffectType === 'CLAN_PROFILE_PICTURE' ? 'Appliquer une photo de profil de clan' : 'Appliquer une banniere de clan'}</DialogTitle>
            <DialogDescription>
              {bannerItemEffectType === 'CLAN_PROFILE_PICTURE'
                ? "Téléversez l'image qui sera utilisée comme emblème du clan."
                : "Téléversez l'image qui sera affichée en haut de la page du clan lorsque ce clan est sélectionné."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ImagePicker
              value={bannerItemImgUrl}
              onChange={setBannerItemImgUrl}
              uploadFn={uploadClanImageFile}
              disabled={savingBannerItem}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setBannerItemDialogOpen(false);
                setBannerItemEffectType(null);
              }}
              disabled={savingBannerItem}
            >
              Annuler
            </Button>
            <Button onClick={handleApplyBannerItem} disabled={savingBannerItem || !bannerItemImgUrl.trim()}>
              {savingBannerItem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Appliquer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={warDialogOpen} onOpenChange={setWarDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Déclarer une guerre</DialogTitle>
            <DialogDescription>
              La guerre démarre immédiatement. Seuls les clans disponibles avec l'écart de trophées le plus faible peuvent être ciblés.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {selectedClan?.warHub.eligibleOpponents.length ? (
              selectedClan.warHub.eligibleOpponents.map((opponent) => (
                <div key={opponent.id} className="flex items-center justify-between rounded-2xl border border-border/50 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={resolveImageUrl(opponent.imageUrl)} alt={opponent.name} />
                      <AvatarFallback>{getAvatarFallback(opponent.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{opponent.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {opponent.memberCount}/{opponent.maxMembers} membres • {formatAura(opponent.totalAura)} aura
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(opponent.warTrophies)} trophées • écart {Math.abs(opponent.warTrophies - selectedClan.warTrophies)}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleDeclareWar(opponent.id)}
                    disabled={warActionKey === `declare:${opponent.id}`}
                  >
                    {warActionKey === `declare:${opponent.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Axe className="mr-2 h-4 w-4" />}
                    Déclarer
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                Aucun adversaire disponible actuellement avec un nombre de trophées compatible.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Tutorial dialogs ── */}
      {(['MEMORY', 'BOMB', 'NAVAL'] as const).map((type) => {
        const TUTORIALS = {
          MEMORY: {
            title: '🧩 Jeu Mémoire — Comment jouer',
            desc: 'Retournez les cartes pour trouver les paires. Chaque paire de défense matched améliore la structure correspondante.',
            tips: ['16 cartes, 8 paires à trouver', '90 secondes pour tout trouver', 'Paire 🏰 = fortifie la Forteresse, ⚔️ = Armurerie, 🚩 = Bannière', 'Jouable une fois par jour (mode réel)'],
          },
          BOMB: {
            title: '💣 Bombardement Aérien — Comment jouer',
            desc: 'Votre avion survole la base ennemie. Cliquez sur le terrain pour larguer des bombes sur les bâtiments.',
            tips: ['8 bombes par mission', '🏰 Forteresses nécessitent 2 impacts', 'Plus vous détruisez, plus vous marquez de points', 'Jouable une fois par jour (mode réel)'],
          },
          NAVAL: {
            title: '🎯 Guerre Navale — Comment jouer',
            desc: 'La carte ennemie est cachée. Cliquez sur les cases pour y envoyer un missile et révéler les bâtiments.',
            tips: ['Grille 6×6 (36 cases possibles)', '5 tirs par membre, par guerre (total)', 'Vos coéquipiers partagent la même carte — coordonnez-vous !', 'Chaque touche rapporte des points de guerre'],
          },
        };
        const t = TUTORIALS[type];
        return (
          <Dialog key={type} open={showTutorial === type} onOpenChange={(open) => !open && setShowTutorial(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t.title}</DialogTitle>
                <DialogDescription>{t.desc}</DialogDescription>
              </DialogHeader>
              <ul className="space-y-2">
                {t.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-primary shrink-0">▸</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={() => confirmTutorial(type)}>Jouer !</Button>
                <Button variant="outline" onClick={() => setShowTutorial(null)}>Fermer</Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })}

      {/* ── Game modals ── */}
      <Dialog open={activeGame === 'MEMORY'} onOpenChange={(open) => !open && closeGame()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              🧩 Jeu Mémoire
              {gamePractice && <span className="ml-2 text-xs font-normal text-muted-foreground">(Entraînement)</span>}
            </DialogTitle>
            <DialogDescription>Trouvez toutes les paires pour améliorer vos défenses.</DialogDescription>
          </DialogHeader>
          {activeGame === 'MEMORY' && (
            <MemoryGame
              isPractice={gamePractice}
              onComplete={handleMemoryComplete}
              onClose={closeGame}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={activeGame === 'BOMB'} onOpenChange={(open) => !open && closeGame()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              💣 Bombardement Aérien
              {gamePractice && <span className="ml-2 text-xs font-normal text-muted-foreground">(Entraînement)</span>}
            </DialogTitle>
            <DialogDescription>Cliquez sur la zone de jeu pour larguer vos bombes sur la base ennemie.</DialogDescription>
          </DialogHeader>
          {activeGame === 'BOMB' && (
            <BombDropGame
              isPractice={gamePractice}
              onComplete={handleBombComplete}
              onClose={closeGame}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={activeGame === 'NAVAL'} onOpenChange={(open) => !open && closeGame()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>🎯 Guerre Navale</DialogTitle>
            <DialogDescription>
              Ciblez les cases de la base ennemie.{' '}
              {gameStatus?.naval ? `${gameStatus.naval.shotsRemaining} tir(s) restant(s) pour cette guerre.` : ''}
            </DialogDescription>
          </DialogHeader>
          {activeGame === 'NAVAL' && gameStatus?.naval && selectedWar && (
            <NavalWarfareGame
              boardId={gameStatus.naval.boardId}
              shotsRemaining={gameStatus.naval.shotsRemaining}
              shots={gameStatus.naval.shots}
              enemyClanName={getWarOpponent(selectedWar, selectedClan?.id ?? '').name}
              onShoot={handleNavalShot}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Role assignment modal ── */}
      {(() => {
        const assignMember = roleAssignMemberId ? selectedClan?.members.find((m) => m.userId === roleAssignMemberId) : null;
        return (
          <Dialog open={Boolean(roleAssignMemberId)} onOpenChange={(open) => { if (!open) setRoleAssignMemberId(null); }}>
            <DialogContent className="sm:max-w-xs">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Rôle de {assignMember?.username ?? '...'}
                </DialogTitle>
                <DialogDescription>Sélectionner un rôle ou en créer un nouveau.</DialogDescription>
              </DialogHeader>
              {assignMember ? (
                <div className="space-y-3">
                  {/* Promote / Demote */}
                  {selectedClan?.viewer.isLeader && selectedClan.leader.id !== assignMember.userId ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Rang</label>
                      {assignMember.isLeader ? (
                        <Button variant="outline" size="sm" className="w-full" onClick={() => { void handleDemoteMember(assignMember.userId); setRoleAssignMemberId(null); }} disabled={actionLoading}>
                          <ChevronDown className="mr-1.5 h-3.5 w-3.5" /> Rétrograder (officier → membre)
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="w-full" onClick={() => { void handlePromoteMember(assignMember.userId); setRoleAssignMemberId(null); }} disabled={actionLoading}>
                          <ChevronUp className="mr-1.5 h-3.5 w-3.5" /> Promouvoir (membre → officier)
                        </Button>
                      )}
                    </div>
                  ) : null}

                  {/* Role list */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Rôle assigné</label>
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => { void handleAssignRole(assignMember.userId, null); setRoleAssignMemberId(null); }}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                          !assignMember.roleId
                            ? 'border-foreground/20 bg-muted/30 font-medium text-foreground'
                            : 'border-border/50 bg-muted/10 text-muted-foreground hover:bg-muted/20',
                        )}
                      >
                        <span className="inline-block h-3 w-3 rounded-full flex-shrink-0 border border-border/50 bg-muted/30" />
                        Aucun rôle
                      </button>
                      {(selectedClan?.roles ?? []).filter((r) => r.name !== 'Chef').map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => { void handleAssignRole(assignMember.userId, role.id); setRoleAssignMemberId(null); }}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                            assignMember.roleId === role.id
                              ? 'border-foreground/20 bg-muted/30 font-medium text-foreground'
                              : 'border-border/50 bg-muted/10 text-muted-foreground hover:bg-muted/20',
                          )}
                        >
                          <span className="inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
                          {role.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Create new role shortcut */}
                  {selectedClan?.viewer.permissions?.canManageRoles ? (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => { setRoleAssignMemberId(null); openRoleCreate(); }}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Nouveau rôle
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Role edit / create modal ── */}
      <Dialog open={roleEditOpen} onOpenChange={setRoleEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span className="h-4 w-4 rounded-full border border-border/40 transition-colors" style={{ backgroundColor: roleEditColor }} />
              {roleEditId ? 'Modifier le rôle' : 'Nouveau rôle'}
            </DialogTitle>
            <DialogDescription>
              {roleEditId ? 'Modifiez le nom, la couleur et les permissions de ce rôle.' : 'Créez un rôle personnalisé pour les membres de votre clan.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* Name + color preview */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nom du rôle</label>
              <div className="flex items-center gap-2">
                <Input
                  value={roleEditName}
                  onChange={(e) => setRoleEditName(e.target.value.slice(0, 32))}
                  placeholder="Ex: Stratège, Éleveur..."
                  disabled={roleEditIsSystem}
                  maxLength={32}
                  className="flex-1"
                />
                {roleEditName.trim() ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold border" style={{ color: roleEditColor, borderColor: roleEditColor + '55', backgroundColor: roleEditColor + '18' }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: roleEditColor }} />
                    {roleEditName.trim()}
                  </span>
                ) : null}
              </div>
              {roleEditIsSystem && <p className="text-xs text-muted-foreground">Le nom des rôles système ne peut pas être modifié.</p>}
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Couleur</label>
              <div className="flex flex-wrap gap-1.5">
                {TAG_PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn('h-6 w-6 rounded-full border-2 transition-transform hover:scale-110', roleEditColor === c ? 'border-foreground scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c }}
                    onClick={() => setRoleEditColor(c)}
                  />
                ))}
                <input
                  type="color"
                  value={roleEditColor}
                  onChange={(e) => setRoleEditColor(e.target.value)}
                  className="h-6 w-6 cursor-pointer rounded-full border p-0"
                />
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Permissions</label>
              {([
                { key: 'canManageHorses', label: 'Gérer les chevaux', desc: 'Acheter, entraîner, inscrire et soigner les chevaux', icon: '🐴' },
                { key: 'canInviteMembers', label: 'Inviter des membres', desc: 'Accepter ou refuser les candidatures', icon: '👋' },
                { key: 'canKickMembers', label: 'Exclure des membres', desc: 'Retirer des membres réguliers du clan', icon: '🚫' },
                { key: 'canManageRoles', label: 'Gérer les rôles', desc: 'Créer, modifier et assigner des rôles', icon: '🛡️' },
              ] as { key: keyof typeof roleEditPerms; label: string; desc: string; icon: string }[]).map(({ key, label, desc, icon }) => (
                <label key={key} className={cn('flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors', roleEditPerms[key] ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-muted/10 hover:bg-muted/20')}>
                  <input
                    type="checkbox"
                    checked={roleEditPerms[key]}
                    onChange={(e) => setRoleEditPerms((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium">{icon} {label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSaveRole} disabled={roleSaving || (!roleEditIsSystem && !roleEditName.trim())}>
                {roleSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                {roleEditId ? 'Enregistrer les modifications' : 'Créer le rôle'}
              </Button>
              <Button variant="outline" onClick={() => setRoleEditOpen(false)}>Annuler</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

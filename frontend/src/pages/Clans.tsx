import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Axe, AlertTriangle, Check, ChevronDown, ChevronUp, Crown, History, Landmark, Loader2, LogOut, Lock, Megaphone, MessageSquare, Package, Pencil, Plus, Send, Settings2, Shield, Sparkles, Swords, Target, Trash2, UserX, UserPlus, X, LayoutGrid, Layout } from 'lucide-react';
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
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { ColorSwatchPicker } from '@/components/shared/ColorSwatchPicker';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ImagePicker } from '@/components/ui/image-picker';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { UsernameDisplay } from '@/components/ui/username-display';
import { ClanTag, ClanTagStyle, DEFAULT_CLAN_TAG_STYLE, getClanTagBackground, parseClanTagStyle } from '@/components/clans/ClanTag';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { toast } from 'sonner';
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

const BankContributionRow = ({ entry }: { entry: ClanBankContribution }) => (
  <Item size="sm" variant="outline">
    <ItemMedia>
      <Avatar className="size-9">
        <AvatarImage src={resolveImageUrl(entry.user.profilePicture)} alt={entry.user.username} />
        <AvatarFallback>{getAvatarFallback(entry.user.username)}</AvatarFallback>
      </Avatar>
    </ItemMedia>
    <ItemContent>
      <ItemTitle>
        <UsernameDisplay username={entry.user.username} usernameColor={entry.user.usernameColor} />
      </ItemTitle>
      <ItemDescription>{formatDate(entry.createdAt)}</ItemDescription>
    </ItemContent>
    <ItemActions className="flex-col items-end gap-0">
      <span className="text-sm font-semibold text-success">{formatSignedValue(entry.amount)}</span>
      <span className="text-xs text-muted-foreground">ajoutés à la banque</span>
    </ItemActions>
  </Item>
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
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
    {action ? <div className="flex items-center gap-2">{action}</div> : null}
  </div>
);

const ClanStat = ({ label, value }: { label: string; value: string }) => (
  <Card className="gap-1 py-4">
    <CardHeader className="px-4">
      <CardDescription>{label}</CardDescription>
      <CardTitle className="text-base tabular-nums">{value}</CardTitle>
    </CardHeader>
  </Card>
);

const ClanEffectBadge = ({ effect }: { effect: ClanActiveEffect }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Badge variant="success" className="size-9 justify-center rounded-full p-0">
        {effect.type === 'CLAN_GAME_MONEY_BOOST' ? <CurrencyIcon type="money" className="size-4" /> : <Sparkles className="size-4" />}
      </Badge>
    </TooltipTrigger>
    <TooltipContent>
      {`${effect.name} • +${effect.value}%${effect.activeUntil ? ` • ${formatEffectCooldown(effect)}` : ''}`}
    </TooltipContent>
  </Tooltip>
);

const UPGRADE_ICONS: Record<string, string> = { FORTRESS: '🏰', ARMORY: '⚔️', BANNER: '🚩' };
const UPGRADE_EFFECTS: Record<string, (level: number) => string> = {
  FORTRESS: (level) => level > 0 ? `Réduit les bombardements ennemis de ${level * 4} pts` : 'Non construite — à améliorer via le jeu mémoire',
  ARMORY: (level) => level > 0 ? `Augmente vos bombardements de ${level * 3} pts` : 'Non construite — à améliorer via le jeu mémoire',
  BANNER: (level) => level > 0 ? `Booste vos tirs navals de ${level * 2} pts` : 'Non construite — à améliorer via le jeu mémoire',
};

const UpgradeRow = ({ defense }: { defense: ClanWarDefenseState }) => (
  <Item size="sm" variant="outline">
    <ItemMedia variant="icon">{UPGRADE_ICONS[defense.type] ?? '🏛️'}</ItemMedia>
    <ItemContent>
      <ItemTitle>{defense.label}</ItemTitle>
      <ItemDescription>{UPGRADE_EFFECTS[defense.type]?.(defense.level) ?? ''}</ItemDescription>
      <Progress value={(defense.level / 3) * 100} className="mt-1 max-w-32" />
    </ItemContent>
    <ItemActions>
      <Badge variant={defense.level === 0 ? 'outline' : 'secondary'} className="tabular-nums">
        {defense.level}/3
      </Badge>
    </ItemActions>
  </Item>
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
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-10">
              <AvatarImage src={resolveImageUrl(member.user.profilePicture)} alt={member.user.username} />
              <AvatarFallback>{getAvatarFallback(member.user.username)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="truncate text-sm">
                <UsernameDisplay username={member.user.username} usernameColor={member.user.usernameColor} />
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
                {showClanName ? <span>{member.clanName}</span> : null}
                <span>{member.totalCombatPoints} pts combat</span>
                <span>{member.fortificationLevelsAdded} niv. défense</span>
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            <Badge variant={didCombat ? 'secondary' : 'outline'}>{didCombat ? 'Combat fait' : 'Combat manquant'}</Badge>
            <Badge variant={didSupport ? 'secondary' : 'outline'}>{didSupport ? 'Support fait' : 'Support manquant'}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 px-4 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border px-2.5 py-2">
          Bombes : <span className="font-medium text-foreground">{member.bombRuns}</span> • {member.bombPoints} pts
        </div>
        <div className="rounded-md border px-2.5 py-2">
          Naval : <span className="font-medium text-foreground">{member.navalShotsUsed}</span> tirs • {member.navalHits} touches
        </div>
        <div className="rounded-md border px-2.5 py-2">
          Mémoire : <span className="font-medium text-foreground">{member.memoryRuns}</span> • {member.fortificationsUsed} renforts
        </div>
        <div className="rounded-md border px-2.5 py-2">
          Total attaques : <span className="font-medium text-foreground">{member.attackCount}</span> • {member.attackPoints} pts
        </div>
      </CardContent>
    </Card>
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
      toast('Tag sauvegardé');
    } catch (error: any) {
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de sauvegarder.' });
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
      toast(pumpUpEditId ? 'Message modifié' : 'Message ajouté');
    } catch (error: any) {
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de sauvegarder.' });
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
      toast('Message supprimé');
    } catch (error: any) {
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de supprimer.' });
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
      toast.error('Erreur', { description: 'Impossible de charger les clans.' });
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
      if (!silent) toast.error('Erreur', { description: 'Impossible de charger ce clan.' });
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
      toast.error('Erreur', { description: "Impossible de charger l'historique global des guerres." });
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
      toast('Score enregistré', { description: `+${res.data.result.pointsAwarded} points pour ton clan.` });
      await fetchFeaturedEvent(selectedClanId, false);
      closeEventMiniGame();
    } catch (error: any) {
      toast.error('Erreur', { description: error.response?.data?.error || "Impossible d'enregistrer ce score." });
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
      toast('Défenses renforcées !', { description: 'Les structures de ton clan ont été améliorées.' });
      await afterGame();
    } catch (error: any) {
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de valider.' });
    }
  };

  const handleBombComplete = async (result: { score: number; hits: number }) => {
    if (gamePractice) { closeGame(); return; }
    if (!selectedClan) return;
    try {
      const res = await clansApi.submitBombGame(selectedClan.id, { ...result, isPractice: false });
      toast('Attaque enregistrée !', { description: `+${res.data.finalPoints} pts de guerre.` });
      await afterGame();
    } catch (error: any) {
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de valider.' });
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
      toast('Clan créé', { description: 'Ton organisation est prête à recruter, négocier et combattre.' });
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
      toast(res.data.status === 'joined' ? 'Clan rejoint' : 'Demande envoyée', { description: res.data.status === 'joined'
            ? 'Tu as rejoint le clan.'
            : 'Ta demande a été envoyée au chef du clan.' });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to join clan:', error);
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de rejoindre le clan.' });
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
      toast(action === 'accept' ? 'Demande acceptée' : 'Demande refusée', { description: action === 'accept' ? 'Le joueur a rejoint le clan.' : 'La demande a été rejetée.' });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to update request:', error);
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de traiter la demande.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedClan) return;
    setActionLoading(true);
    try {
      await clansApi.removeMember(selectedClan.id, userId);
      toast('Membre retiré', { description: 'Le membre a été retiré du clan.' });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de retirer ce membre.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromoteMember = async (userId: string) => {
    if (!selectedClan) return;
    setActionLoading(true);
    try {
      await clansApi.promoteMember(selectedClan.id, userId);
      toast('Membre promu', { description: 'Le membre est maintenant officier.' });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to promote member:', error);
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de promouvoir ce membre.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDemoteMember = async (userId: string) => {
    if (!selectedClan) return;
    setActionLoading(true);
    try {
      await clansApi.demoteMember(selectedClan.id, userId);
      toast('Membre rétrogradé', { description: 'Le membre est repassé au rang membre.' });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to demote member:', error);
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de rétrograder ce membre.' });
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
      toast('Chef transféré', { description: `${username} est maintenant le chef du clan.` });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to transfer leadership:', error);
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de transférer le rôle de chef.' });
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
      toast('Clan quitté', { description: 'Tu as quitté le clan.' });
      await refreshData(null);
    } catch (error: any) {
      console.error('Failed to leave clan:', error);
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de quitter le clan.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclareWar = async (targetClanId: string) => {
    if (!selectedClan) return;
    setWarActionKey(`declare:${targetClanId}`);
    try {
      await clansApi.declareWar(selectedClan.id, targetClanId);
      toast('Guerre déclarée !', { description: 'La bataille commence maintenant — attaquez !' });
      setWarDialogOpen(false);
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to declare war:', error);
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de déclarer cette guerre.' });
    } finally {
      setWarActionKey(null);
    }
  };

  const handleWarAttack = async (attackType: ClanWarActionType['type']) => {
    if (!selectedClan || !selectedWar) return;
    setWarActionKey(`attack:${attackType}`);
    try {
      const res = await clansApi.attackWar(selectedClan.id, attackType);
      toast('Assaut lancé', { description: `+${res.data.finalPoints} pts avec ${attackType.toLowerCase()}.` });
      await refreshData(selectedClan.id);
      await fetchGameStatus(selectedClan.id);
    } catch (error: any) {
      toast.error('Erreur', { description: error.response?.data?.error || "Impossible d'effectuer cette attaque." });
    } finally {
      setWarActionKey(null);
    }
  };

  const handleDepositToBank = async () => {
    if (!selectedClan || !selectedClan.viewer.isMember) return;

    const amount = Number(bankDepositAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error('Montant invalide', { description: 'Entre un montant entier supérieur à 0.' });
      return;
    }

    try {
      setDepositingBank(true);
      await clansApi.depositToBank(selectedClan.id, amount);
      toast('Dépôt effectué', { description: `${amount.toLocaleString('fr-FR')} money ajouté à la banque de clan.` });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de déposer dans la banque de clan.' });
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
      toast("Effet active", { description: `${clanItem.item.name} booste maintenant les gains d'argent du clan.` });
    } catch (error: any) {
      toast.error("Activation impossible", { description: error.response?.data?.error || "Impossible d'activer cet objet." });
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
      toast(bannerItemEffectType === 'CLAN_BANNER' ? "Banniere de clan appliquee" : 'Photo de profil de clan appliquee');
    } catch (error: any) {
      toast.error("Erreur", { description: error.response?.data?.error || (
          bannerItemEffectType === 'CLAN_BANNER'
            ? "Impossible d'appliquer la banniere."
            : "Impossible d'appliquer la photo de profil du clan."
        ) });
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
      toast(roleEditId ? 'Rôle mis à jour' : 'Rôle créé');
    } catch (error: any) {
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de sauvegarder le rôle.' });
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
      toast('Rôle supprimé');
    } catch (error: any) {
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de supprimer ce rôle.' });
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
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible d\'assigner ce rôle.' });
    }
  };

  const handleSaveImage = async () => {
    if (!selectedClan || !selectedClan.viewer.isLeader) return;
    try {
      setSavingImage(true);
      const res = await clansApi.updateImage(selectedClan.id, editImageUrl.trim() || null);
      setSelectedClan((prev) => prev ? { ...prev, imageUrl: res.data.imageUrl } : prev);
      setClans((prev) => prev.map((c) => c.id === selectedClan.id ? { ...c, imageUrl: res.data.imageUrl } : c));
      toast('Image mise à jour');
    } catch (error: any) {
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de modifier l\'image.' });
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
      toast('Description mise à jour');
    } catch (error: any) {
      toast.error('Erreur', { description: error.response?.data?.error || 'Impossible de modifier la description.' });
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
      toast.error('Erreur', { description: error.response?.data?.error || "Impossible d'envoyer le message." });
    } finally {
      setChatSending(false);
    }
  };

  return (
    <>
      <PageShell size="wide">
        <PageHeader
          title="Clans"
          description="Rejoignez un clan, partagez une banque commune et affrontez d'autres clans."
          actions={
            canCreateClan ? (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus />
                Créer un clan
              </Button>
            ) : null
          }
        />

        <div className="grid items-start gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Annuaire</CardTitle>
              <CardDescription>
                {clans.length} clan{clans.length > 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Tabs value={directoryViewMode} onValueChange={(value) => setDirectoryViewMode(value as 'regular' | 'war')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="regular">
                    <Shield />
                    Normal
                  </TabsTrigger>
                  <TabsTrigger value="war">
                    <Swords />
                    Guerre
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {directoryViewMode === 'war' ? (
                <Button type="button" variant="outline" onClick={() => setActiveWarsDialogOpen(true)} disabled={otherActiveWars.length === 0}>
                  <Swords />
                  Guerres actives ({otherActiveWars.length})
                </Button>
              ) : null}

              <ScrollArea className="h-[28rem]">
                {loading ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 4 }, (_, index) => (
                      <Skeleton key={index} className="h-16 w-full" />
                    ))}
                  </div>
                ) : clans.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>Aucun clan</EmptyTitle>
                      <EmptyDescription>Aucun clan pour le moment.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ItemGroup className="gap-1 pr-3">
                    {directoryClans.map((clan) => {
                      const hasTag = clan.tagUnlocked && clan.tagText;
                      const clanTagStyle = hasTag && clan.tagStyle ? parseClanTagStyle(clan.tagStyle) : null;
                      const isClanAtWar = clansAtWarIds.has(clan.id);
                      return (
                        <Item key={clan.id} asChild size="sm" variant={clan.id === selectedClanId ? 'muted' : 'default'}>
                          <button type="button" onClick={() => setSelectedClanId(clan.id)} className="text-left">
                            <ItemMedia>
                              <Avatar className="size-10">
                                <AvatarImage src={resolveImageUrl(clan.imageUrl)} alt={clan.name} />
                                <AvatarFallback>{getAvatarFallback(clan.name)}</AvatarFallback>
                              </Avatar>
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle>
                                <span className="truncate">{clan.name}</span>
                                {clanTagStyle && clan.tagText ? <ClanTag tag={{ text: clan.tagText, style: clanTagStyle }} /> : null}
                              </ItemTitle>
                              <ItemDescription>
                                {clan.memberCount}/{clan.maxMembers} membres •{' '}
                                {directoryViewMode === 'war' ? `🏆 ${formatMoney(clan.warTrophies)}` : `${formatAura(clan.totalAura)} aura`}
                              </ItemDescription>
                            </ItemContent>
                            <ItemActions>
                              {directoryViewMode === 'war' && isClanAtWar ? (
                                <Badge variant="destructive">
                                  <Swords />
                                </Badge>
                              ) : null}
                              {viewerClanId === clan.id ? <Badge>Mon clan</Badge> : null}
                            </ItemActions>
                          </button>
                        </Item>
                      );
                    })}
                  </ItemGroup>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {!selectedClanId || !selectedClanSummary ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Shield />
                </EmptyMedia>
                <EmptyTitle>Aucun clan sélectionné</EmptyTitle>
                <EmptyDescription>Sélectionnez un clan pour afficher son quartier général.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : detailLoading || !selectedClan ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <div className="flex min-w-0 flex-col gap-6">
              <Card className="overflow-hidden py-0">
                {selectedClan.banner ? (
                  <AspectRatio ratio={5 / 1} className="bg-muted">
                    <img src={resolveImageUrl(selectedClan.banner)} alt={`Bannière de ${selectedClan.name}`} className="size-full object-cover" />
                  </AspectRatio>
                ) : null}
                <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <Avatar className="size-16 rounded-xl">
                        <AvatarImage src={resolveImageUrl(selectedClan.imageUrl)} alt={selectedClan.name} />
                        <AvatarFallback className="rounded-xl text-lg font-semibold">{getAvatarFallback(selectedClan.name)}</AvatarFallback>
                      </Avatar>
                      {selectedClan.viewer.isLeader ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon-xs"
                          className="absolute -bottom-1 -right-1 rounded-full"
                          aria-label="Modifier l'emblème"
                          onClick={() => {
                            setEditImageUrl(selectedClan.imageUrl ?? '');
                            setClanSettingsOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold tracking-tight">{selectedClan.name}</h2>
                        {selectedClan.tagUnlocked && selectedClan.tagText ? (
                          <ClanTag tag={{ text: selectedClan.tagText, style: parseClanTagStyle(selectedClan.tagStyle) }} />
                        ) : null}
                        {selectedClan.viewer.isLeader ? <Crown className="size-4 text-warning" /> : null}
                        {!selectedClan.isPublic ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="warning">
                                <Lock />
                                Privé
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              Ce clan est privé. Les joueurs doivent soumettre une candidature pour le rejoindre, et les informations
                              internes ne sont visibles que par ses membres.
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          Chef : <UsernameDisplay username={selectedClan.leader.username} usernameColor={selectedClan.leader.usernameColor} />
                        </span>
                        <span>
                          Membres : <span className="text-foreground">{selectedClan.memberCount}/{selectedClan.maxMembers}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Sparkles className="size-3.5" />
                          <span className="text-foreground">{formatAura(selectedClan.totalAura)} aura</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canJoinSelectedClan ? (
                      <Button onClick={handleJoin} disabled={actionLoading || selectedClan.viewer.hasPendingRequest}>
                        {actionLoading ? <Spinner /> : null}
                        {selectedClan.viewer.hasPendingRequest ? 'En attente' : 'Rejoindre le clan'}
                      </Button>
                    ) : null}
                    {selectedClan.viewer.isMember ? (
                      <Button
                        onClick={() => {
                          setActiveTab('chat');
                          setClanHubOpen(true);
                        }}
                      >
                        <LayoutGrid />
                        Tableau de bord
                      </Button>
                    ) : null}
                    {selectedClan.viewer.isMember && (selectedClan.viewer.isLeader || selectedClan.viewer.permissions?.canManageRoles) ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditImageUrl(selectedClan.imageUrl ?? '');
                          setEditDescription(selectedClan.description ?? '');
                          setSettingsTab('general');
                          setClanSettingsOpen(true);
                        }}
                      >
                        <Settings2 />
                        Paramètres
                      </Button>
                    ) : null}
                    {selectedClan.viewer.isMember ? (
                      <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleLeave} disabled={actionLoading}>
                        <LogOut />
                        Quitter
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {!selectedClan.viewer.isMember ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Layout className="size-4" />
                      Présentation du clan
                    </CardTitle>
                    {selectedClan.activeEffects.length > 0 ? (
                      <CardAction className="flex flex-wrap gap-2">
                        {selectedClan.activeEffects.map((effect) => (
                          <ClanEffectBadge key={effect.id} effect={effect} />
                        ))}
                      </CardAction>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{selectedClan.description || 'Aucune description pour le moment.'}</p>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>Membres du clan</CardTitle>
                  <CardDescription>
                    {selectedClan.members.length}/{selectedClan.maxMembers} membres
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedClan.members.map((member) => {
                    const isSelf = member.userId === user?.id;
                    const isClanLeader = selectedClan.leader.id === member.userId;
                    const displayRole = isClanLeader ? 'Chef' : member.roleName ? member.roleName : member.isLeader ? 'Officier' : 'Membre';

                    return (
                      <Item key={member.id} variant="outline" size="sm">
                        <ItemMedia>
                          <Avatar className="size-10">
                            <AvatarImage src={resolveImageUrl(member.profilePicture)} alt={member.username} />
                            <AvatarFallback>{getAvatarFallback(member.username)}</AvatarFallback>
                          </Avatar>
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>
                            <UsernameDisplay username={member.username} usernameColor={member.usernameColor} />
                            {isSelf ? <Badge variant="outline">Vous</Badge> : null}
                          </ItemTitle>
                          <ItemDescription className="flex items-center gap-1.5">
                            <span>{formatAura(member.aura)} aura</span>
                            <span>•</span>
                            {isClanLeader ? <Crown className="size-3 text-warning" /> : member.isLeader ? <Shield className="size-3" /> : null}
                            {member.roleColor ? <span className="size-1.5 rounded-full" style={{ backgroundColor: member.roleColor }} /> : null}
                            <span>{displayRole}</span>
                          </ItemDescription>
                        </ItemContent>
                        {!isSelf && selectedClan.viewer.isMember ? (
                          <ItemActions>
                            {(selectedClan.viewer.isLeader || selectedClan.viewer.permissions?.canManageRoles) && !isClanLeader ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon-sm" aria-label="Gérer le rôle" onClick={() => setRoleAssignMemberId(member.userId)} disabled={actionLoading}>
                                    <Shield style={{ color: member.roleColor ?? undefined }} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Gérer le rôle</TooltipContent>
                              </Tooltip>
                            ) : null}
                            {selectedClan.viewer.isLeader && selectedClan.leader.id === user?.id && !isClanLeader ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon-sm" aria-label="Transférer le rôle de chef" onClick={() => handleTransferLeadership(member.userId, member.username)} disabled={actionLoading}>
                                    <Crown />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Transférer le rôle de chef</TooltipContent>
                              </Tooltip>
                            ) : null}
                            {selectedClan.viewer.permissions?.canKickMembers && !isClanLeader && !member.isLeader ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon-sm" aria-label="Exclure du clan" onClick={() => handleRemoveMember(member.userId)} disabled={actionLoading}>
                                    <UserX />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Exclure du clan</TooltipContent>
                              </Tooltip>
                            ) : null}
                          </ItemActions>
                        ) : null}
                      </Item>
                    );
                  })}

                  {Array.from({ length: Math.max(0, selectedClan.maxMembers - selectedClan.members.length) }).map((_, index) => (
                    <Item key={`empty-slot-${index}`} variant="outline" size="sm" className="border-dashed">
                      <ItemMedia variant="icon">
                        <Plus />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle className="text-muted-foreground">Slot libre</ItemTitle>
                        <ItemDescription>En attente d&apos;un membre</ItemDescription>
                      </ItemContent>
                    </Item>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </PageShell>

      <Dialog open={activeWarsDialogOpen} onOpenChange={setActiveWarsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Guerres actives</DialogTitle>
            <DialogDescription>
              {otherActiveWars.length === 0
                ? 'Aucune autre guerre en cours.'
                : `${otherActiveWars.length} guerre(s) en cours sur le serveur.`}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <ItemGroup className="gap-2 pr-3">
              {otherActiveWars.map((war) => (
                <Item key={war.id} asChild variant="outline">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClanId(war.attackerClan.id);
                      setActiveWarsDialogOpen(false);
                    }}
                    className="text-left"
                  >
                    <ItemContent>
                      <ItemDescription>Guerre #{war.id.slice(0, 6)}</ItemDescription>
                      <ItemTitle>
                        {war.attackerClan.name} <span className="font-normal text-muted-foreground">contre</span> {war.defenderClan.name}
                      </ItemTitle>
                      <ItemDescription className="flex items-center justify-between gap-4">
                        <span className="tabular-nums">
                          {war.attackerScore} - {war.defenderScore}
                        </span>
                        <span>
                          {war.status === 'COMPLETED' ? `Terminée ${formatDate(war.completedAt)}` : `Fin dans ${formatCountdown(war.endsAt)}`}
                        </span>
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Badge variant={getStatusVariant(war.status)}>{getStatusLabel(war.status)}</Badge>
                    </ItemActions>
                  </button>
                </Item>
              ))}
            </ItemGroup>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(activeEventMiniGame)} onOpenChange={(open) => !open && closeEventMiniGame()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{activeEventMiniGame?.title ?? 'Mini-jeu événement'}</DialogTitle>
            <DialogDescription>
              {activeEventMiniGame?.instructions || activeEventMiniGame?.description || 'Faites le meilleur score possible pour votre clan.'}
            </DialogDescription>
          </DialogHeader>

          {activeEventMiniGame?.type === 'REFLEX' ? (
            <div className="flex flex-col gap-4">
              <Alert variant={reflexPhase === 'go' ? 'success' : 'default'}>
                <AlertDescription>
                  {reflexPhase === 'waiting'
                    ? 'Attendez le signal vert, puis cliquez immédiatement.'
                    : reflexPhase === 'go'
                      ? 'CLIQUEZ MAINTENANT'
                      : reflexPhase === 'result'
                        ? reflexScore === 0
                          ? 'Trop tôt. Cette tentative vaut 0.'
                          : `Score brut : ${Math.floor(reflexScore ?? 0)}`
                        : 'Prêt ?'}
                </AlertDescription>
              </Alert>
              <Button
                size="lg"
                className="h-28 w-full text-lg"
                variant={reflexPhase === 'go' ? 'default' : 'secondary'}
                disabled={eventMiniGameSubmitting}
                onClick={() => {
                  void handleReflexClick();
                }}
              >
                {reflexPhase === 'waiting' ? '…' : reflexPhase === 'go' ? 'CLIQUE' : 'Tenter'}
              </Button>
            </div>
          ) : activeEventMiniGame?.type === 'TAP_FRENZY' ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Card className="gap-1 py-4">
                  <CardHeader className="px-4">
                    <CardDescription>Temps restant</CardDescription>
                    <CardTitle className="text-2xl tabular-nums">{tapFrenzyTimeLeft}s</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="gap-1 py-4">
                  <CardHeader className="px-4">
                    <CardDescription>Score brut</CardDescription>
                    <CardTitle className="text-2xl tabular-nums">{tapFrenzyScore}</CardTitle>
                  </CardHeader>
                </Card>
              </div>
              <Button size="lg" className="h-28 w-full text-lg" disabled={!tapFrenzyRunning || eventMiniGameSubmitting} onClick={() => setTapFrenzyScore((current) => current + 10)}>
                Tap tap tap
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Créer un clan</DialogTitle>
            <DialogDescription>Coût : 100 money. Le chef devient automatiquement le premier membre.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateClan} className="flex flex-col gap-4">
            {formError ? (
              <Alert variant="destructive">
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="clan-name">Nom</FieldLabel>
                <Input id="clan-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={32} placeholder="Les Veilleurs" />
              </Field>
              <Field>
                <FieldLabel htmlFor="clan-description">Description</FieldLabel>
                <Textarea
                  id="clan-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={300}
                  rows={4}
                  placeholder="Décrivez l'identité, le style de jeu et l'objectif du clan."
                />
              </Field>
              <Field>
                <FieldLabel>Emblème</FieldLabel>
                <ImagePicker value={imageUrl} onChange={setImageUrl} uploadFn={uploadClanImageFile} disabled={creating} />
              </Field>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="clan-public">Clan public</FieldLabel>
                  <FieldDescription>Si désactivé, les joueurs devront envoyer une candidature.</FieldDescription>
                </FieldContent>
                <Switch id="clan-public" checked={isPublic} onCheckedChange={setIsPublic} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? <Spinner /> : <Plus />}
                Créer le clan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Paramètres du clan ── */}
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
        <DialogContent className="flex h-[80vh] flex-col gap-0 p-0 sm:max-w-4xl">
          {selectedClan ? (
            <>
              <DialogHeader className="border-b p-6">
                <DialogTitle>Paramètres du clan — {selectedClan.name}</DialogTitle>
                <DialogDescription>Gérez l&apos;emblème, la description, le tag, les rôles et les annonces de votre clan.</DialogDescription>
              </DialogHeader>

              <Tabs
                value={settingsTab}
                onValueChange={(value) => setSettingsTab(value as typeof settingsTab)}
                orientation="vertical"
                className="min-h-0 flex-1 flex-row gap-0"
              >
                <TabsList className="h-auto w-48 shrink-0 flex-col items-stretch justify-start rounded-none border-r bg-transparent p-3">
                  <TabsTrigger value="general" className="justify-start">
                    <Settings2 />
                    Général
                  </TabsTrigger>
                  {selectedClan.tagUnlocked ? (
                    <TabsTrigger value="tag" className="justify-start">
                      <Sparkles />
                      Tag du clan
                    </TabsTrigger>
                  ) : null}
                  {selectedClan.viewer.permissions?.canManageRoles || selectedClan.viewer.isLeader ? (
                    <TabsTrigger value="roles" className="justify-start">
                      <Shield />
                      Rôles
                    </TabsTrigger>
                  ) : null}
                  {selectedClan.viewer.isLeader ? (
                    <TabsTrigger value="messages" className="justify-start">
                      <Megaphone />
                      Annonces
                    </TabsTrigger>
                  ) : null}
                </TabsList>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="p-6">
                    {settingsTab === 'general' ? (
                      <div className="flex flex-col gap-6">
                        <div className="grid grid-cols-3 gap-3">
                          <Card className="gap-1 py-4">
                            <CardHeader className="px-4">
                              <CardDescription>Aura</CardDescription>
                              <CardTitle className="tabular-nums">{formatAura(selectedClan.totalAura)}</CardTitle>
                            </CardHeader>
                          </Card>
                          <Card className="gap-1 py-4">
                            <CardHeader className="px-4">
                              <CardDescription>Trophées</CardDescription>
                              <CardTitle className="tabular-nums">{formatMoney(selectedClan.warTrophies)}</CardTitle>
                            </CardHeader>
                          </Card>
                          <Card className="gap-1 py-4">
                            <CardHeader className="px-4">
                              <CardDescription>Guerres</CardDescription>
                              <CardTitle className="tabular-nums">
                                {selectedClan.warWins}V {selectedClan.warLosses}D
                              </CardTitle>
                            </CardHeader>
                          </Card>
                        </div>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Emblème</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ImagePicker value={editImageUrl} onChange={setEditImageUrl} uploadFn={uploadClanImageFile} disabled={savingImage} />
                          </CardContent>
                          <CardFooter>
                            <Button className="w-full" onClick={handleSaveImage} disabled={savingImage}>
                              {savingImage ? <Spinner /> : <Check />}
                              Enregistrer l&apos;emblème
                            </Button>
                          </CardFooter>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Description</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Field>
                              <Textarea
                                aria-label="Description du clan"
                                value={editDescription}
                                onChange={(event) => setEditDescription(event.target.value)}
                                maxLength={300}
                                rows={4}
                                placeholder="Décrivez l'identité, le style de jeu et l'objectif du clan…"
                                disabled={savingDescription}
                              />
                              <FieldDescription>{editDescription.length}/300</FieldDescription>
                            </Field>
                          </CardContent>
                          <CardFooter>
                            <Button className="w-full" onClick={handleSaveDescription} disabled={savingDescription}>
                              {savingDescription ? <Spinner /> : <Check />}
                              Enregistrer la description
                            </Button>
                          </CardFooter>
                        </Card>
                      </div>
                    ) : null}

                    {settingsTab === 'tag' && selectedClan.tagUnlocked ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Tag du clan</CardTitle>
                          <CardDescription>Personnalisez le tag affiché à côté du pseudo de chaque membre.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <FieldGroup>
                            <Item variant="muted" size="sm">
                              <ItemContent>
                                <ItemDescription>Aperçu</ItemDescription>
                                <ItemTitle>
                                  Pseudo
                                  {tagText.trim() ? <ClanTag tag={{ text: tagText.trim(), style: tagStyle }} /> : <span className="font-normal italic text-muted-foreground">aucun tag défini</span>}
                                </ItemTitle>
                              </ItemContent>
                            </Item>

                            <Field>
                              <FieldLabel htmlFor="tag-text">Texte du tag (1–6 caractères)</FieldLabel>
                              <Input id="tag-text" value={tagText} onChange={(event) => setTagText(event.target.value.slice(0, 6))} maxLength={6} placeholder="OG" className="w-32 font-mono" />
                            </Field>

                            <Field>
                              <FieldLabel>Style de fond</FieldLabel>
                              <ToggleGroup
                                type="single"
                                variant="outline"
                                value={tagStyle.backgroundType}
                                onValueChange={(value) => value && setTagStyle((current) => ({ ...current, backgroundType: value as 'solid' | 'gradient' }))}
                                className="self-start"
                              >
                                <ToggleGroupItem value="solid">Uni</ToggleGroupItem>
                                <ToggleGroupItem value="gradient">Dégradé</ToggleGroupItem>
                              </ToggleGroup>
                            </Field>

                            {tagStyle.backgroundType === 'solid' ? (
                              <Field>
                                <FieldLabel>Couleur de fond</FieldLabel>
                                <ColorSwatchPicker
                                  label="Couleur de fond"
                                  colors={TAG_PRESET_COLORS}
                                  value={tagStyle.backgroundColor}
                                  onChange={(color) => setTagStyle((current) => ({ ...current, backgroundColor: color }))}
                                />
                              </Field>
                            ) : (
                              <Field>
                                <FieldLabel>Couleurs du dégradé</FieldLabel>
                                <div className="flex items-center gap-3">
                                  <Input
                                    type="color"
                                    aria-label="Début du dégradé"
                                    className="h-9 w-12 cursor-pointer p-1"
                                    value={(() => { try { return JSON.parse(tagStyle.backgroundGradient ?? '{}').from ?? '#374151'; } catch { return '#374151'; } })()}
                                    onChange={(e) => { const cur = (() => { try { return JSON.parse(tagStyle.backgroundGradient ?? '{}'); } catch { return { from: '#374151', to: '#6366f1', direction: 'to right' }; } })(); setTagStyle((s) => ({ ...s, backgroundGradient: JSON.stringify({ ...cur, from: e.target.value }) })); }}
                                  />
                                  <span className="text-muted-foreground">→</span>
                                  <Input
                                    type="color"
                                    aria-label="Fin du dégradé"
                                    className="h-9 w-12 cursor-pointer p-1"
                                    value={(() => { try { return JSON.parse(tagStyle.backgroundGradient ?? '{}').to ?? '#6366f1'; } catch { return '#6366f1'; } })()}
                                    onChange={(e) => { const cur = (() => { try { return JSON.parse(tagStyle.backgroundGradient ?? '{}'); } catch { return { from: '#374151', to: '#6366f1', direction: 'to right' }; } })(); setTagStyle((s) => ({ ...s, backgroundGradient: JSON.stringify({ ...cur, to: e.target.value }) })); }}
                                  />
                                </div>
                              </Field>
                            )}

                            <Field>
                              <FieldLabel>Couleur du texte</FieldLabel>
                              <ColorSwatchPicker
                                label="Couleur du texte"
                                colors={TAG_PRESET_COLORS}
                                value={tagStyle.textColor}
                                onChange={(color) => setTagStyle((current) => ({ ...current, textColor: color }))}
                              />
                            </Field>

                            <Field>
                              <FieldLabel>Couleur de bordure</FieldLabel>
                              <ColorSwatchPicker
                                label="Couleur de bordure"
                                colors={TAG_PRESET_COLORS}
                                value={tagStyle.borderColor}
                                onChange={(color) => setTagStyle((current) => ({ ...current, borderColor: color }))}
                              />
                            </Field>
                          </FieldGroup>
                        </CardContent>
                        <CardFooter>
                          <Button type="button" className="w-full" onClick={saveTag} disabled={savingTag || !tagText.trim()}>
                            {savingTag ? <Spinner /> : <Check />}
                            Enregistrer le tag
                          </Button>
                        </CardFooter>
                      </Card>
                    ) : null}

                    {settingsTab === 'roles' && (selectedClan.viewer.permissions?.canManageRoles || selectedClan.viewer.isLeader) ? (
                      <div className="flex flex-col gap-4">
                        <SectionTitle
                          title="Rôles du clan"
                          description="Gérez les grades personnalisés de vos membres et leurs permissions associées."
                          action={
                            <Button variant="outline" size="sm" onClick={openRoleCreate}>
                              <Plus />
                              Nouveau rôle
                            </Button>
                          }
                        />
                        {(selectedClan.roles ?? []).length === 0 ? (
                          <Empty className="border">
                            <EmptyHeader>
                              <EmptyTitle>Aucun rôle</EmptyTitle>
                              <EmptyDescription>Aucun rôle créé pour ce clan. Les grades personnalisés apparaîtront ici.</EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        ) : (
                          <ItemGroup className="gap-2">
                            {(selectedClan.roles ?? []).map((role) => (
                              <Item key={role.id} variant="outline">
                                <ItemMedia>
                                  <span className="size-4 rounded-full border" style={{ backgroundColor: role.color }} />
                                </ItemMedia>
                                <ItemContent>
                                  <ItemTitle>{role.name}</ItemTitle>
                                  <div className="flex flex-wrap gap-1.5">
                                    {role.canManageHorses ? <Badge variant="warning">Chevaux</Badge> : null}
                                    {role.canInviteMembers ? <Badge variant="success">Inviter</Badge> : null}
                                    {role.canKickMembers ? <Badge variant="destructive">Exclure</Badge> : null}
                                    {role.canManageRoles ? <Badge variant="secondary">Rôles</Badge> : null}
                                    {!role.canManageHorses && !role.canInviteMembers && !role.canKickMembers && !role.canManageRoles ? (
                                      <span className="text-xs italic text-muted-foreground">Aucune permission</span>
                                    ) : null}
                                  </div>
                                </ItemContent>
                                <ItemActions>
                                  <Button variant="outline" size="sm" onClick={() => openRoleEdit(role)}>
                                    <Pencil />
                                    Modifier
                                  </Button>
                                  {!role.isSystem ? (
                                    <Button variant="ghost" size="icon-sm" aria-label="Supprimer le rôle" onClick={() => void handleDeleteRole(role.id)}>
                                      <Trash2 />
                                    </Button>
                                  ) : null}
                                </ItemActions>
                              </Item>
                            ))}
                          </ItemGroup>
                        )}
                      </div>
                    ) : null}

                    {settingsTab === 'messages' && selectedClan.viewer.isLeader ? (
                      <div className="flex flex-col gap-4">
                        <SectionTitle
                          title="Messages de bienvenue & annonces"
                          description="Configurez des slogans, encouragements ou instructions qui s'affichent aléatoirement aux membres du clan."
                        />

                        {pumpUpLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner />
                            Chargement…
                          </div>
                        ) : pumpUpMessages.length === 0 ? (
                          <Empty className="border">
                            <EmptyHeader>
                              <EmptyDescription>Aucun message d&apos;annonce ou de bienvenue pour l&apos;instant.</EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        ) : (
                          <ItemGroup className="gap-2">
                            {pumpUpMessages.map((msg) => (
                              <Item key={msg.id} variant="outline" size="sm">
                                <ItemMedia>
                                  <span className="size-3 rounded-full border" style={{ backgroundColor: msg.color }} />
                                </ItemMedia>
                                <ItemContent>
                                  <ItemTitle className="font-normal" style={{ color: msg.color !== '#ffffff' ? msg.color : undefined }}>
                                    {msg.content}
                                  </ItemTitle>
                                </ItemContent>
                                <ItemActions>
                                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Modifier le message" onClick={() => startEditPumpUp(msg)}>
                                    <Pencil />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Supprimer le message" onClick={() => void deletePumpUpMessage(msg.id)}>
                                    <Trash2 />
                                  </Button>
                                </ItemActions>
                              </Item>
                            ))}
                          </ItemGroup>
                        )}

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">{pumpUpEditId ? 'Modifier le message' : `Nouveau message (${pumpUpMessages.length}/5)`}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <FieldGroup>
                              {pumpUpDraft.trim() ? (
                                <Item variant="muted" size="sm">
                                  <ItemContent>
                                    <ItemDescription>Aperçu</ItemDescription>
                                    <ItemTitle style={{ color: pumpUpColor }}>{pumpUpDraft.replace('{name}', user?.username ?? 'Nom')}</ItemTitle>
                                  </ItemContent>
                                </Item>
                              ) : null}
                              <Field>
                                <FieldLabel htmlFor="pump-up-text">Texte</FieldLabel>
                                <Input
                                  id="pump-up-text"
                                  value={pumpUpDraft}
                                  onChange={(event) => setPumpUpDraft(event.target.value.slice(0, 120))}
                                  placeholder="Bienvenue {name} dans le clan !"
                                  maxLength={120}
                                />
                                <FieldDescription>
                                  Utilisez <code className="rounded bg-muted px-1">{'{name}'}</code> pour inclure le prénom du membre · {pumpUpDraft.length}/120
                                </FieldDescription>
                              </Field>
                              <Field>
                                <FieldLabel>Couleur d&apos;affichage du texte</FieldLabel>
                                <ColorSwatchPicker label="Couleur du message" colors={TAG_PRESET_COLORS} value={pumpUpColor} onChange={setPumpUpColor} />
                              </Field>
                            </FieldGroup>
                          </CardContent>
                          <CardFooter className="gap-2">
                            <Button
                              type="button"
                              className="flex-1"
                              disabled={pumpUpSaving || !pumpUpDraft.trim() || (!pumpUpEditId && pumpUpMessages.length >= 5)}
                              onClick={() => void savePumpUpMessage()}
                            >
                              {pumpUpSaving ? <Spinner /> : null}
                              {pumpUpEditId ? 'Modifier' : 'Ajouter'}
                            </Button>
                            {pumpUpEditId ? (
                              <Button type="button" variant="outline" onClick={cancelEditPumpUp}>
                                Annuler
                              </Button>
                            ) : null}
                          </CardFooter>
                        </Card>
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </Tabs>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Tableau de bord du clan ── */}
      <Dialog open={clanHubOpen} onOpenChange={setClanHubOpen}>
        <DialogContent className="flex h-[85vh] flex-col gap-0 p-0 sm:max-w-5xl">
          {selectedClan ? (
            <>
              <DialogHeader className="border-b p-6">
                <DialogTitle>Tableau de bord — {selectedClan.name}</DialogTitle>
                <DialogDescription>Accédez au chat, à la banque, aux guerres, à l&apos;inventaire et à la gestion opérationnelle de votre clan.</DialogDescription>
              </DialogHeader>

              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as typeof activeTab)}
                orientation="vertical"
                className="min-h-0 flex-1 flex-row gap-0"
              >
                <TabsList className="h-auto w-52 shrink-0 flex-col items-stretch justify-start rounded-none border-r bg-transparent p-3">
                  <TabsTrigger value="info" className="justify-start">
                    <Layout />
                    Infos & effets
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="justify-start">
                    <MessageSquare />
                    Chat du clan
                  </TabsTrigger>
                  <TabsTrigger value="bank" className="justify-start">
                    <Landmark />
                    Banque
                  </TabsTrigger>
                  <TabsTrigger value="inventory" className="justify-start">
                    <Package />
                    Inventaire
                  </TabsTrigger>
                  <TabsTrigger value="guerre" className="justify-start">
                    <Swords />
                    Guerre
                  </TabsTrigger>
                  {featuredEvent ? (
                    <TabsTrigger value="event" className="justify-start">
                      <Sparkles />
                      Événement
                    </TabsTrigger>
                  ) : null}
                  {selectedClan.viewer.permissions?.canInviteMembers || selectedClan.viewer.isLeader ? (
                    <TabsTrigger value="requests" className="justify-start">
                      <UserPlus />
                      <span className="flex-1 text-left">Candidatures</span>
                      {selectedClan.joinRequests.length > 0 ? <Badge variant="secondary">{selectedClan.joinRequests.length}</Badge> : null}
                    </TabsTrigger>
                  ) : null}
                </TabsList>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="p-6">
                    {activeTab === 'info' ? (
                      <div className="flex flex-col gap-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Layout className="size-4" />
                              À propos du clan
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">{selectedClan.description || 'Aucune description pour le moment.'}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Sparkles className="size-4" />
                              Boosts & effets actifs
                            </CardTitle>
                            <CardDescription>Les bonus en cours d&apos;activation pour tous les membres.</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {selectedClan.activeEffects.length > 0 ? (
                              <ItemGroup className="gap-2 sm:grid sm:grid-cols-2">
                                {selectedClan.activeEffects.map((effect) => (
                                  <Item key={effect.id} variant="outline" size="sm">
                                    <ItemMedia>
                                      <ClanEffectBadge effect={effect} />
                                    </ItemMedia>
                                    <ItemContent>
                                      <ItemTitle>{effect.name}</ItemTitle>
                                      <ItemDescription>{effect.activeUntil ? `Expire dans ${formatEffectCooldown(effect)}` : 'Permanent'}</ItemDescription>
                                    </ItemContent>
                                  </Item>
                                ))}
                              </ItemGroup>
                            ) : (
                              <p className="text-sm italic text-muted-foreground">Aucun effet actif pour le moment.</p>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    ) : null}

                    {activeTab === 'chat' ? (
                      <div className="flex flex-col gap-4">
                        <ScrollArea className="h-[22rem] rounded-md border">
                          <div className="flex flex-col gap-3 p-4">
                            {chatLoading ? (
                              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                                <Spinner />
                                Chargement du chat…
                              </div>
                            ) : chatMessages.length === 0 ? (
                              <p className="py-12 text-center text-sm text-muted-foreground">Lancez la conversation dans le clan !</p>
                            ) : (
                              chatMessages.map((entry) => {
                                if (entry.type === 'system') {
                                  return (
                                    <Alert key={entry.id} variant="warning">
                                      <Megaphone />
                                      <AlertDescription className="whitespace-pre-wrap break-words">{entry.message}</AlertDescription>
                                    </Alert>
                                  );
                                }
                                const isOwnMessage = entry.user?.id === user?.id;
                                return (
                                  <div key={entry.id} className={cn('flex', isOwnMessage ? 'justify-end' : 'justify-start')}>
                                    <div className={cn('max-w-[85%] rounded-lg border px-3 py-2', isOwnMessage ? 'bg-secondary' : 'bg-card')}>
                                      <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
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
                        </ScrollArea>
                        <form onSubmit={handleSendChatMessage}>
                          <Field>
                            <Textarea
                              aria-label="Message au clan"
                              value={chatDraft}
                              onChange={(event) => setChatDraft(event.target.value.slice(0, 400))}
                              rows={3}
                              placeholder="Écrivez un message à vos camarades de clan…"
                              disabled={chatSending}
                            />
                            <div className="flex items-center justify-between gap-3">
                              <FieldDescription>{chatDraft.trim().length}/400</FieldDescription>
                              <Button type="submit" disabled={chatSending || !chatDraft.trim()}>
                                {chatSending ? <Spinner /> : <Send />}
                                Envoyer
                              </Button>
                            </div>
                          </Field>
                        </form>
                      </div>
                    ) : null}

                    {activeTab === 'bank' ? (
                      <div className="flex flex-col gap-4">
                        <SectionTitle
                          title="Banque de clan"
                          description="Les membres peuvent déposer. Seul le chef peut dépenser cet argent pour les améliorations du clan."
                          action={
                            <Button type="button" variant="outline" onClick={() => setBankHistoryOpen(true)}>
                              <History />
                              Historique des dépôts
                            </Button>
                          }
                        />
                        <Card>
                          <CardHeader>
                            <CardDescription className="flex items-center gap-2">
                              <CurrencyIcon type="money" className="size-4" />
                              Solde actuel
                            </CardDescription>
                            <CardTitle className="text-3xl tabular-nums">{formatMoney(selectedClan.clanBankMoney)}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Field orientation="horizontal" className="items-end">
                              <FieldContent>
                                <FieldLabel htmlFor="bank-deposit">Montant à déposer</FieldLabel>
                                <Input
                                  id="bank-deposit"
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={bankDepositAmount}
                                  onChange={(event) => setBankDepositAmount(event.target.value)}
                                  disabled={depositingBank}
                                />
                              </FieldContent>
                              <Button type="button" onClick={handleDepositToBank} disabled={depositingBank}>
                                {depositingBank ? <Spinner /> : <CurrencyIcon type="money" className="size-4" />}
                                Déposer
                              </Button>
                            </Field>
                          </CardContent>
                        </Card>
                        <Item variant="outline">
                          <ItemMedia variant="icon">
                            <Package />
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle>Stockage</ItemTitle>
                            <ItemDescription>
                              {selectedClan.ownedItems.length > 0
                                ? `${selectedClan.ownedItems.length} objet${selectedClan.ownedItems.length > 1 ? 's' : ''} différent${selectedClan.ownedItems.length > 1 ? 's' : ''} en stock`
                                : 'Aucun objet de clan en stock.'}
                            </ItemDescription>
                          </ItemContent>
                        </Item>
                      </div>
                    ) : null}

                    {activeTab === 'inventory' ? (
                      <div className="flex flex-col gap-4">
                        <SectionTitle title="Objets de clan" description="Achetés avec la banque du clan. Le chef peut les activer pour le bénéfice de tous." />
                        {selectedClan.ownedItems.length > 0 ? (
                          <div className="grid gap-4 sm:grid-cols-2">
                            {selectedClan.ownedItems.map((clanItem) => {
                              const needsImage = ['CLAN_BANNER', 'CLAN_PROFILE_PICTURE'].includes(parseClanItemEffect(clanItem.item.effect)?.type ?? '');
                              return (
                                <Card key={clanItem.id}>
                                  <CardHeader>
                                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                                      {clanItem.item.name} ×{clanItem.quantity}
                                      {needsImage ? <Badge variant="secondary">Image requise</Badge> : null}
                                    </CardTitle>
                                    <CardDescription>{clanItem.item.description}</CardDescription>
                                  </CardHeader>
                                  <CardFooter className="justify-end">
                                    {selectedClan.viewer.isLeader ? (
                                      <Button type="button" size="sm" onClick={() => handleUseClanItem(clanItem)} disabled={usingClanItemId === clanItem.id}>
                                        {usingClanItemId === clanItem.id ? <Spinner /> : <Sparkles />}
                                        {needsImage ? "Choisir l'image" : 'Activer'}
                                      </Button>
                                    ) : (
                                      <Badge variant="outline">Chef requis</Badge>
                                    )}
                                  </CardFooter>
                                </Card>
                              );
                            })}
                          </div>
                        ) : (
                          <Empty className="border">
                            <EmptyHeader>
                              <EmptyTitle>Aucun objet</EmptyTitle>
                              <EmptyDescription>Aucun objet de clan en stock. Les achats apparaîtront ici.</EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        )}
                      </div>
                    ) : null}

                    {activeTab === 'guerre' ? (
                      <div className="flex flex-col gap-6">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <ClanStat label="Trophées" value={formatMoney(selectedClan.warTrophies)} />
                          <ClanStat label="Bilan" value={`${selectedClan.warWins}V ${selectedClan.warLosses}D ${selectedClan.warDraws}N`} />
                          <ClanStat
                            label="Éligibilité"
                            value={selectedClan.memberCount >= selectedClan.warHub.minimumMembersRequired ? 'Éligible' : `${selectedClan.warHub.minimumMembersRequired} req.`}
                          />
                          <ClanStat
                            label="Disponibilité"
                            value={selectedClan.warHub.cooldownEndsAt ? `Dans ${formatCountdown(selectedClan.warHub.cooldownEndsAt)}` : 'Immédiate'}
                          />
                        </div>

                        {selectedClan.warHub.canDeclareWar ? (
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setWarListDialogOpen(true)}>
                              <History />
                              Guerres passées
                            </Button>
                            <Button onClick={() => setWarDialogOpen(true)}>
                              <Swords />
                              Déclarer une guerre
                            </Button>
                          </div>
                        ) : null}

                        {selectedWar ? (
                          <Card>
                            <CardHeader>
                              <CardDescription className="flex items-center gap-2">
                                <Badge variant={getStatusVariant(selectedWar.status)}>{getStatusLabel(selectedWar.status)}</Badge>
                                Objectif {selectedWar.targetScore} points
                              </CardDescription>
                              <CardTitle className="text-lg">
                                {selectedWar.attackerClan.name} contre {selectedWar.defenderClan.name}
                              </CardTitle>
                              <CardDescription>
                                {selectedWar.status === 'ACTIVE'
                                  ? `Fin prévue dans ${formatCountdown(selectedWar.endsAt)}.`
                                  : `Terminée le ${formatDate(selectedWar.completedAt)}.`}
                              </CardDescription>
                              <CardAction className="grid grid-cols-2 gap-3 text-center">
                                <div className="flex flex-col rounded-md border px-4 py-2">
                                  <span className="max-w-24 truncate text-xs text-muted-foreground">{selectedWar.attackerClan.name}</span>
                                  <span className="text-2xl font-semibold tabular-nums">{selectedWar.attackerScore}</span>
                                </div>
                                <div className="flex flex-col rounded-md border px-4 py-2">
                                  <span className="max-w-24 truncate text-xs text-muted-foreground">{selectedWar.defenderClan.name}</span>
                                  <span className="text-2xl font-semibold tabular-nums">{selectedWar.defenderScore}</span>
                                </div>
                              </CardAction>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-6">
                              {isOwnClan ? (
                                <>
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-base">Centre de commandement</CardTitle>
                                      <CardDescription>Lancez des assauts tactiques instantanés ou complétez les mini-jeux pour pousser la ligne de front.</CardDescription>
                                      <CardAction className="flex items-center gap-2">
                                        <Button size="sm" variant="outline" onClick={() => setWarGamesDialogOpen(true)}>
                                          Mes parties
                                        </Button>
                                        <Badge variant="outline">
                                          Endurance {selectedWar.viewerActions.staminaRemaining}/{selectedWar.viewerActions.staminaCap}
                                        </Badge>
                                      </CardAction>
                                    </CardHeader>
                                    <CardContent className="grid gap-4 sm:grid-cols-3">
                                      {selectedClan.warHub.attackTypes.map((attackType) => {
                                        const disabled =
                                          warActionKey === `attack:${attackType.type}` ||
                                          selectedWar.viewerActions.staminaRemaining < attackType.staminaCost ||
                                          !['PREPARING', 'ACTIVE'].includes(selectedWar.status);
                                        return (
                                          <Card key={attackType.type} className="gap-3 py-4">
                                            <CardHeader className="px-4">
                                              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                                                <span className="truncate">{attackType.label}</span>
                                                <Badge variant="secondary">Coût {attackType.staminaCost}</Badge>
                                              </CardTitle>
                                              <CardDescription>{attackType.description}</CardDescription>
                                            </CardHeader>
                                            <CardContent className="flex flex-col gap-3 px-4">
                                              <p className="text-xs text-muted-foreground">
                                                {attackType.minPoints} à {attackType.maxPoints} pts • dégâts structurels {attackType.structureDamage}
                                              </p>
                                              <Button size="sm" disabled={disabled} onClick={() => void handleWarAttack(attackType.type)}>
                                                {warActionKey === `attack:${attackType.type}` ? <Spinner /> : <Axe />}
                                                Frapper
                                              </Button>
                                            </CardContent>
                                          </Card>
                                        );
                                      })}
                                    </CardContent>
                                  </Card>

                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-base">Jeux de guerre</CardTitle>
                                      <CardDescription>Complétez les jeux quotidiennement pour marquer des points.</CardDescription>
                                      <CardAction>
                                        <Badge variant="secondary">{selectedWar.viewerSide === 'ATTACKER' ? 'Attaquant' : 'Défenseur'}</Badge>
                                      </CardAction>
                                    </CardHeader>
                                    <CardContent className="grid gap-4 sm:grid-cols-3">
                                      <Card className="gap-3 py-4">
                                        <CardHeader className="px-4">
                                          <CardTitle className="flex items-center justify-between gap-2 text-sm">
                                            <span>🧩 Jeu Mémoire</span>
                                            {gameStatus?.memoryPlayedToday ? <Badge variant="success">✓ Joué</Badge> : null}
                                          </CardTitle>
                                          <CardDescription>Retournez les paires pour fortifier et améliorer les défenses du clan.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex flex-col gap-2 px-4">
                                          <Button size="sm" disabled={!gameStatus?.canPlayMemory} onClick={() => openGame('MEMORY', false)}>
                                            {gameStatus?.memoryPlayedToday ? 'Déjà joué' : 'Jouer (1×/jour)'}
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={() => openGame('MEMORY', true)}>
                                            Entraînement
                                          </Button>
                                        </CardContent>
                                      </Card>
                                      <Card className="gap-3 py-4">
                                        <CardHeader className="px-4">
                                          <CardTitle className="flex items-center justify-between gap-2 text-sm">
                                            <span>💣 Bombardement</span>
                                            {gameStatus?.bombPlayedToday ? <Badge variant="success">✓ Joué</Badge> : null}
                                          </CardTitle>
                                          <CardDescription>Pilotez un avion et larguez des bombes sur les structures adverses.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex flex-col gap-2 px-4">
                                          <Button size="sm" disabled={!gameStatus?.canPlayBomb} onClick={() => openGame('BOMB', false)}>
                                            {gameStatus?.bombPlayedToday ? 'Déjà joué' : 'Attaquer (1×/jour)'}
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={() => openGame('BOMB', true)}>
                                            Entraînement
                                          </Button>
                                        </CardContent>
                                      </Card>
                                      <Card className="gap-3 py-4">
                                        <CardHeader className="px-4">
                                          <CardTitle className="flex items-center justify-between gap-2 text-sm">
                                            <span>🎯 Guerre Navale</span>
                                            {gameStatus?.naval ? (
                                              <Badge variant={(gameStatus.naval.shotsRemaining ?? 0) > 0 ? 'secondary' : 'outline'}>{gameStatus.naval.shotsRemaining} tirs</Badge>
                                            ) : null}
                                          </CardTitle>
                                          <CardDescription>Bombardez la base ennemie sur une grille tactique 6×6 partagée.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="px-4">
                                          <Button size="sm" className="w-full" disabled={(gameStatus?.naval?.shotsRemaining ?? 0) <= 0} onClick={() => openGame('NAVAL', false)}>
                                            {(gameStatus?.naval?.shotsRemaining ?? 0) <= 0 ? 'Plus de tirs' : 'Ouvrir la carte'}
                                          </Button>
                                        </CardContent>
                                      </Card>
                                    </CardContent>
                                  </Card>

                                  <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="flex flex-col gap-2">
                                      <h5 className="text-sm font-medium">🛡️ Nos défenses ({getWarOwnSide(selectedWar, selectedClan.id).name})</h5>
                                      <ItemGroup className="gap-2">
                                        {getWarDefenseSet(selectedWar, selectedClan.id).map((defense) => (
                                          <UpgradeRow key={defense.type} defense={defense} />
                                        ))}
                                      </ItemGroup>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      <h5 className="flex items-center gap-1 text-sm font-medium">
                                        <Target className="size-3.5" />
                                        Défenses ennemies
                                      </h5>
                                      <ItemGroup className="gap-2">
                                        {getWarEnemyDefenseSet(selectedWar, selectedClan.id).map((defense) => (
                                          <UpgradeRow key={defense.type} defense={defense} />
                                        ))}
                                      </ItemGroup>
                                    </div>
                                  </div>

                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-base">Récompenses de guerre</CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid gap-3 sm:grid-cols-2">
                                      <Alert variant="success">
                                        <AlertTitle>Victoire</AlertTitle>
                                        <AlertDescription>
                                          +{selectedWar.rewardTable.winner.money} money, +{selectedWar.rewardTable.winner.aura} aura et {formatSignedValue(selectedWar.rewardTable.winner.trophies)} trophées pour le clan.
                                        </AlertDescription>
                                      </Alert>
                                      <Alert>
                                        <AlertTitle>Défaite / égalité</AlertTitle>
                                        <AlertDescription>
                                          +{selectedWar.rewardTable.loser.money} money, +{selectedWar.rewardTable.loser.aura} aura et {formatSignedValue(selectedWar.rewardTable.loser.trophies)} trophées pour le clan.
                                        </AlertDescription>
                                      </Alert>
                                    </CardContent>
                                  </Card>
                                </>
                              ) : null}

                              <div className="flex flex-col gap-3">
                                <SectionTitle
                                  title="Participation des membres"
                                  description="Vérifiez qui a déjà fait ses combats de guerre et son support défensif."
                                  action={<Badge variant="outline">{getWarOwnSide(selectedWar, selectedClan.id).name}</Badge>}
                                />
                                {getWarParticipantStats(selectedWar, selectedClan.id).length === 0 ? (
                                  <Empty className="border">
                                    <EmptyHeader>
                                      <EmptyDescription>Aucune participation enregistrée pour l&apos;instant.</EmptyDescription>
                                    </EmptyHeader>
                                  </Empty>
                                ) : (
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    {getWarParticipantStats(selectedWar, selectedClan.id).map((member) => (
                                      <WarMemberRow key={member.user.id} member={member} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <Alert>
                            <AlertTriangle />
                            <AlertTitle>Pas de guerre en cours</AlertTitle>
                            <AlertDescription>
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

                        <Button variant="outline" className="self-start" onClick={() => setWarListDialogOpen(true)}>
                          <History />
                          Consulter l&apos;historique complet des guerres terminées
                        </Button>
                      </div>
                    ) : null}

                    {activeTab === 'event' && featuredEvent ? (
                      <div className="flex flex-col gap-6">
                        <Card>
                          <CardHeader>
                            <CardDescription className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{getClanEventStatusLabel(featuredEvent.status)}</Badge>
                              <Badge variant="outline">
                                {featuredEvent.status === 'SCHEDULED'
                                  ? `Débute ${formatDate(featuredEvent.startsAt)}`
                                  : featuredEvent.status === 'ACTIVE'
                                    ? `Fin ${formatDate(featuredEvent.endsAt)}`
                                    : `Clôturé ${formatDate(featuredEvent.endsAt)}`}
                              </Badge>
                            </CardDescription>
                            <CardTitle className="text-xl">{featuredEvent.title}</CardTitle>
                            <CardDescription>{featuredEvent.description || 'Un événement compétitif de clan est en cours.'}</CardDescription>
                          </CardHeader>
                          <CardContent className="flex flex-col gap-4">
                            {featuredEvent.rulesSummary ? (
                              <Alert>
                                <AlertDescription>{featuredEvent.rulesSummary}</AlertDescription>
                              </Alert>
                            ) : null}
                            <div className="grid gap-3 md:grid-cols-3">
                              <ClanStat label="Rang du clan" value={featuredEvent.selectedClanEntry?.rank ? `#${featuredEvent.selectedClanEntry.rank}` : 'Non classé'} />
                              <ClanStat label="Points" value={(featuredEvent.selectedClanEntry?.totalPoints ?? 0).toLocaleString('fr-FR')} />
                              <ClanStat label="Participation" value={featuredEvent.canParticipate ? 'Peut jouer maintenant' : 'Lecture seule'} />
                            </div>
                          </CardContent>
                        </Card>

                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Quêtes d&apos;événement</CardTitle>
                              <CardDescription>Chaque quête terminée ajoute des points au clan.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                              {featuredEvent.quests.map((quest) => (
                                <Item key={quest.id} variant="outline">
                                  <ItemContent>
                                    <ItemTitle>{quest.title}</ItemTitle>
                                    <ItemDescription>{quest.description || getClanEventActivityLabel(quest.activityType)}</ItemDescription>
                                    <div className="flex items-center gap-3 pt-1">
                                      <Progress value={Math.min(100, (quest.progress.currentValue / quest.targetValue) * 100)} />
                                      <span className="text-xs tabular-nums text-muted-foreground">
                                        {Math.min(quest.progress.currentValue, quest.targetValue)}/{quest.targetValue}
                                      </span>
                                    </div>
                                  </ItemContent>
                                  <ItemActions>
                                    <Badge variant={quest.progress.isCompleted ? 'success' : 'outline'}>+{quest.pointsReward} pts</Badge>
                                  </ItemActions>
                                </Item>
                              ))}
                            </CardContent>
                          </Card>

                          <div className="flex flex-col gap-6">
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base">Mini-jeux</CardTitle>
                                <CardDescription>Jouez pour ajouter des points instantanément.</CardDescription>
                              </CardHeader>
                              <CardContent className="flex flex-col gap-3">
                                {featuredEvent.miniGames.map((miniGame) => {
                                  const isCoolingDown = Boolean(miniGame.viewerStats.nextAvailableAt && new Date(miniGame.viewerStats.nextAvailableAt).getTime() > Date.now());
                                  return (
                                    <Item key={miniGame.id} variant="outline">
                                      <ItemContent>
                                        <ItemTitle>
                                          {miniGame.title}
                                          <Badge variant="outline">Cap {miniGame.maxPointsPerAttempt} pts</Badge>
                                        </ItemTitle>
                                        <ItemDescription>{miniGame.description || miniGame.instructions || 'Mini-jeu de score instantané.'}</ItemDescription>
                                        <div className="flex flex-col gap-0.5 pt-1 text-xs text-muted-foreground">
                                          <span>Meilleur score : {miniGame.viewerStats.bestScore.toLocaleString('fr-FR')}</span>
                                          <span>
                                            Tentatives : {miniGame.viewerStats.attemptsUsed}
                                            {miniGame.maxAttemptsPerUser ? `/${miniGame.maxAttemptsPerUser}` : ''}
                                          </span>
                                          {isCoolingDown ? <span>Recharge : {formatCountdown(miniGame.viewerStats.nextAvailableAt)}</span> : null}
                                        </div>
                                        <Button
                                          className="mt-2 w-full"
                                          disabled={!featuredEvent.canParticipate || isCoolingDown || eventMiniGameSubmitting}
                                          onClick={() => {
                                            if (miniGame.type === 'REFLEX') startReflexMiniGame(miniGame);
                                            else startTapFrenzyMiniGame(miniGame);
                                          }}
                                        >
                                          Jouer
                                        </Button>
                                      </ItemContent>
                                    </Item>
                                  );
                                })}
                              </CardContent>
                            </Card>

                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base">Top clans</CardTitle>
                                <CardDescription>Classement de l&apos;événement.</CardDescription>
                              </CardHeader>
                              <CardContent>
                                <ItemGroup>
                                  {featuredEvent.leaderboard.map((entry, index) => (
                                    <div key={entry.clan.id}>
                                      {index > 0 ? <ItemSeparator /> : null}
                                      <Item size="sm">
                                        <ItemContent>
                                          <ItemTitle>
                                            #{entry.rank} {entry.clan.name}
                                          </ItemTitle>
                                          <ItemDescription>{entry.clan.memberCount} membres</ItemDescription>
                                        </ItemContent>
                                        <ItemActions>
                                          <span className="text-sm font-semibold tabular-nums">{entry.totalPoints.toLocaleString('fr-FR')} pts</span>
                                        </ItemActions>
                                      </Item>
                                    </div>
                                  ))}
                                </ItemGroup>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base">Récompenses</CardTitle>
                                <CardDescription>Répartition selon le rang final du clan.</CardDescription>
                              </CardHeader>
                              <CardContent>
                                <ItemGroup>
                                  {featuredEvent.rewardTiers.map((tier, index) => (
                                    <div key={tier.id}>
                                      {index > 0 ? <ItemSeparator /> : null}
                                      <Item size="sm">
                                        <ItemContent>
                                          <ItemTitle>{tier.title}</ItemTitle>
                                          <ItemDescription>
                                            Rangs {tier.minRank}
                                            {tier.maxRank !== tier.minRank ? `-${tier.maxRank}` : ''} • {tier.moneyReward} money • {tier.auraReward} aura
                                            {tier.item ? ` • ${tier.item.name}` : ''}
                                          </ItemDescription>
                                        </ItemContent>
                                      </Item>
                                    </div>
                                  ))}
                                </ItemGroup>
                              </CardContent>
                            </Card>
                          </div>
                        </div>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Activité récente</CardTitle>
                            <CardDescription>Derniers points inscrits dans l&apos;événement.</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {featuredEvent.recentActivity.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Aucun point enregistré pour l&apos;instant.</p>
                            ) : (
                              <ItemGroup>
                                {featuredEvent.recentActivity.map((activity, index) => (
                                  <div key={activity.id}>
                                    {index > 0 ? <ItemSeparator /> : null}
                                    <Item size="sm">
                                      <ItemContent>
                                        <ItemTitle>{activity.label}</ItemTitle>
                                        <ItemDescription>
                                          {activity.clan.name} • {formatDate(activity.createdAt)}
                                        </ItemDescription>
                                      </ItemContent>
                                      <ItemActions>
                                        <Badge variant="secondary">+{activity.points} pts</Badge>
                                      </ItemActions>
                                    </Item>
                                  </div>
                                ))}
                              </ItemGroup>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    ) : null}

                    {activeTab === 'requests' && (selectedClan.viewer.permissions?.canInviteMembers || selectedClan.viewer.isLeader) ? (
                      <div className="flex flex-col gap-4">
                        <SectionTitle
                          title="Candidatures de recrutement"
                          description="Validez ou rejetez les demandes des joueurs qui souhaitent rejoindre le clan."
                          action={<Badge variant="outline">{selectedClan.joinRequests.length} en attente</Badge>}
                        />
                        {selectedClan.joinRequests.length === 0 ? (
                          <Empty className="border">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <UserPlus />
                              </EmptyMedia>
                              <EmptyTitle>Aucune candidature en attente</EmptyTitle>
                              <EmptyDescription>Les nouvelles demandes de recrutement apparaîtront ici.</EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        ) : (
                          <ItemGroup className="gap-2 sm:grid sm:grid-cols-2">
                            {selectedClan.joinRequests.map((request) => (
                              <Item key={request.id} variant="outline">
                                <ItemMedia>
                                  <Avatar className="size-10">
                                    <AvatarImage src={resolveImageUrl(request.profilePicture)} alt={request.username} />
                                    <AvatarFallback>{getAvatarFallback(request.username)}</AvatarFallback>
                                  </Avatar>
                                </ItemMedia>
                                <ItemContent>
                                  <ItemTitle>
                                    <UsernameDisplay username={request.username} usernameColor={request.usernameColor} />
                                  </ItemTitle>
                                  <ItemDescription className="flex items-center gap-1">
                                    <Sparkles className="size-3.5" />
                                    {formatAura(request.aura)} aura
                                  </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                  <Button size="sm" onClick={() => handleRequestAction(request.id, 'accept')} disabled={actionLoading}>
                                    <Check />
                                    Accepter
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleRequestAction(request.id, 'reject')} disabled={actionLoading}>
                                    <X />
                                    Rejeter
                                  </Button>
                                </ItemActions>
                              </Item>
                            ))}
                          </ItemGroup>
                        )}
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </Tabs>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Dialogs secondaires */}
      {selectedClan ? (
        <Dialog open={bankHistoryOpen} onOpenChange={setBankHistoryOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Historique de la banque</DialogTitle>
              <DialogDescription>Chaque dépôt effectué par un membre dans la banque du clan.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <ItemGroup className="gap-2 pr-3">
                {selectedClan.bankContributionHistory.length > 0 ? (
                  selectedClan.bankContributionHistory.map((entry) => <BankContributionRow key={entry.id} entry={entry} />)
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun dépôt enregistré pour le moment.</p>
                )}
              </ItemGroup>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      ) : null}

      {selectedClan ? (
        <Dialog open={warListDialogOpen} onOpenChange={setWarListDialogOpen}>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Guerres du clan</DialogTitle>
              <DialogDescription>Toutes les guerres de {selectedClan.name}, avec les détails dépliables de chaque conflit.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[65vh]">
              <div className="pr-3">
                {clanWars.length === 0 ? (
                  <Empty className="border">
                    <EmptyHeader>
                      <EmptyDescription>Aucune guerre enregistrée pour ce clan.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Accordion type="single" collapsible className="w-full">
                    {clanWars.map((war) => {
                      const opponent = getWarOpponent(war, selectedClan.id);
                      const resultBadge = getWarResultBadge(war, selectedClan.id);
                      const ownTrophyChange = selectedClan.id === war.attackerClan.id ? war.trophyChanges.attacker : war.trophyChanges.defender;
                      const ownParticipants = getWarParticipantStats(war, selectedClan.id);
                      const opponentParticipants = getWarOpponentParticipantStats(war, selectedClan.id);
                      return (
                        <AccordionItem key={war.id} value={war.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left">
                              <div className="min-w-0">
                                <div className="text-sm font-medium">Contre {opponent.name}</div>
                                <div className="mt-1 text-xs font-normal text-muted-foreground">
                                  {war.status === 'COMPLETED'
                                    ? `${formatDate(war.completedAt)} • Score ${war.attackerScore} - ${war.defenderScore}`
                                    : `${formatDate(war.startsAt)} • En cours ${war.viewerScore} - ${war.opponentScore}`}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <Badge variant={resultBadge.variant}>{resultBadge.label}</Badge>
                                <span className="text-xs font-medium text-muted-foreground">{formatSignedValue(ownTrophyChange)} trophées</span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-col gap-4">
                              <div className="grid gap-3 md:grid-cols-3">
                                <Card className="gap-1 py-4">
                                  <CardHeader className="px-4">
                                    <CardDescription>Score</CardDescription>
                                    <CardTitle className="tabular-nums">
                                      {war.attackerScore} - {war.defenderScore}
                                    </CardTitle>
                                    <CardDescription>
                                      {war.attackerClan.name} contre {war.defenderClan.name}
                                    </CardDescription>
                                  </CardHeader>
                                </Card>
                                <Card className="gap-1 py-4">
                                  <CardHeader className="px-4">
                                    <CardDescription>Dates</CardDescription>
                                    <CardTitle className="text-sm">Début : {formatDate(war.startsAt)}</CardTitle>
                                    <CardDescription>{war.completedAt ? `Fin : ${formatDate(war.completedAt)}` : `Fin prévue : ${formatDate(war.endsAt)}`}</CardDescription>
                                  </CardHeader>
                                </Card>
                                <Card className="gap-1 py-4">
                                  <CardHeader className="px-4">
                                    <CardDescription>Récompenses</CardDescription>
                                    <CardTitle className="text-sm">
                                      +{war.rewardTable.winner.money} money / +{war.rewardTable.winner.aura} aura
                                    </CardTitle>
                                    <CardDescription>{formatSignedValue(war.rewardTable.winner.trophies)} trophées en victoire</CardDescription>
                                  </CardHeader>
                                </Card>
                              </div>

                              <div className="grid gap-4 lg:grid-cols-2">
                                <div className="flex flex-col gap-2">
                                  <h5 className="text-sm font-medium">Participation de {selectedClan.name}</h5>
                                  {ownParticipants.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Aucune donnée de participation.</p>
                                  ) : (
                                    ownParticipants.map((member) => <WarMemberRow key={`${war.id}:${member.user.id}`} member={member} />)
                                  )}
                                </div>
                                <div className="flex flex-col gap-2">
                                  <h5 className="text-sm font-medium">Participation de {opponent.name}</h5>
                                  {opponentParticipants.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Aucune donnée de participation.</p>
                                  ) : (
                                    opponentParticipants.map((member) => <WarMemberRow key={`${war.id}:opponent:${member.user.id}`} member={member} showClanName />)
                                  )}
                                </div>
                              </div>

                              {war.recentAttacks.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                  <h5 className="text-sm font-medium">Attaques récentes</h5>
                                  <ItemGroup className="gap-2">
                                    {war.recentAttacks.slice(0, 5).map((attack) => (
                                      <Item key={attack.id} variant="outline" size="sm">
                                        <ItemContent>
                                          <ItemTitle>{attack.attackLabel}</ItemTitle>
                                          <ItemDescription>
                                            par {attack.user.username} • {attack.finalPoints} pts
                                          </ItemDescription>
                                        </ItemContent>
                                      </Item>
                                    ))}
                                  </ItemGroup>
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
            </ScrollArea>
          </DialogContent>
        </Dialog>
      ) : null}

      {selectedClan ? (
        <Dialog open={warGamesDialogOpen} onOpenChange={setWarGamesDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Mes parties de guerre</DialogTitle>
              <DialogDescription>
                {selectedWar && isOwnClan
                  ? `Score actuel : ${selectedWar.viewerScore} - ${selectedWar.opponentScore}. Lancez vos parties restantes depuis cette fenêtre.`
                  : "Vous n'êtes pas dans une guerre active avec ce clan."}
              </DialogDescription>
            </DialogHeader>
            {!selectedWar || !isOwnClan || !selectedClan.viewer.isMember ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyDescription>Aucune guerre active pour vous dans ce clan.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : pendingWarGames.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyDescription>Vous avez déjà joué toutes vos parties disponibles pour le moment.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup className="gap-2">
                {pendingWarGames.map((game) => (
                  <Item key={game.type} variant="outline">
                    <ItemContent>
                      <ItemTitle>{game.title}</ItemTitle>
                      <ItemDescription>{game.description}</ItemDescription>
                      <span className="text-xs font-medium text-success">{game.remainingLabel}</span>
                    </ItemContent>
                    <ItemActions>
                      <Button onClick={() => launchWarGameFromDialog(game.type)}>{game.actionLabel}</Button>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={bannerItemDialogOpen} onOpenChange={setBannerItemDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{bannerItemEffectType === 'CLAN_PROFILE_PICTURE' ? 'Appliquer une photo de profil de clan' : 'Appliquer une bannière de clan'}</DialogTitle>
            <DialogDescription>
              {bannerItemEffectType === 'CLAN_PROFILE_PICTURE'
                ? "Téléversez l'image qui sera utilisée comme emblème du clan."
                : "Téléversez l'image qui sera affichée en haut de la page du clan lorsque ce clan est sélectionné."}
            </DialogDescription>
          </DialogHeader>
          <ImagePicker value={bannerItemImgUrl} onChange={setBannerItemImgUrl} uploadFn={uploadClanImageFile} disabled={savingBannerItem} />
          <DialogFooter>
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
              {savingBannerItem ? <Spinner /> : null}
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={warDialogOpen} onOpenChange={setWarDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Déclarer une guerre</DialogTitle>
            <DialogDescription>
              La guerre démarre immédiatement. Seuls les clans disponibles avec l&apos;écart de trophées le plus faible peuvent être ciblés.
            </DialogDescription>
          </DialogHeader>
          {selectedClan?.warHub.eligibleOpponents.length ? (
            <ItemGroup className="gap-2">
              {selectedClan.warHub.eligibleOpponents.map((opponent) => (
                <Item key={opponent.id} variant="outline">
                  <ItemMedia>
                    <Avatar className="size-12">
                      <AvatarImage src={resolveImageUrl(opponent.imageUrl)} alt={opponent.name} />
                      <AvatarFallback>{getAvatarFallback(opponent.name)}</AvatarFallback>
                    </Avatar>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{opponent.name}</ItemTitle>
                    <ItemDescription>
                      {opponent.memberCount}/{opponent.maxMembers} membres • {formatAura(opponent.totalAura)} aura
                    </ItemDescription>
                    <ItemDescription>
                      {formatMoney(opponent.warTrophies)} trophées • écart {Math.abs(opponent.warTrophies - selectedClan.warTrophies)}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button onClick={() => handleDeclareWar(opponent.id)} disabled={warActionKey === `declare:${opponent.id}`}>
                      {warActionKey === `declare:${opponent.id}` ? <Spinner /> : <Axe />}
                      Déclarer
                    </Button>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyDescription>Aucun adversaire disponible actuellement avec un nombre de trophées compatible.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Tutoriels des jeux de guerre ── */}
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
              <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
                {t.tips.map((tip, index) => (
                  <li key={index}>{tip}</li>
                ))}
              </ul>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowTutorial(null)}>
                  Fermer
                </Button>
                <Button onClick={() => confirmTutorial(type)}>Jouer !</Button>
              </DialogFooter>
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
              {gamePractice ? <Badge variant="outline" className="ml-2">Entraînement</Badge> : null}
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
              {gamePractice ? <Badge variant="outline" className="ml-2">Entraînement</Badge> : null}
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

      {/* ── Attribution de rôle ── */}
      {(() => {
        const assignMember = roleAssignMemberId ? selectedClan?.members.find((m) => m.userId === roleAssignMemberId) : null;
        return (
          <Dialog open={Boolean(roleAssignMemberId)} onOpenChange={(open) => { if (!open) setRoleAssignMemberId(null); }}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Rôle de {assignMember?.username ?? '…'}</DialogTitle>
                <DialogDescription>Sélectionnez un rôle ou créez-en un nouveau.</DialogDescription>
              </DialogHeader>
              {assignMember ? (
                <FieldGroup>
                  {selectedClan?.viewer.isLeader && selectedClan.leader.id !== assignMember.userId ? (
                    <Field>
                      <FieldLabel>Rang</FieldLabel>
                      {assignMember.isLeader ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            void handleDemoteMember(assignMember.userId);
                            setRoleAssignMemberId(null);
                          }}
                          disabled={actionLoading}
                        >
                          <ChevronDown />
                          Rétrograder (officier → membre)
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => {
                            void handlePromoteMember(assignMember.userId);
                            setRoleAssignMemberId(null);
                          }}
                          disabled={actionLoading}
                        >
                          <ChevronUp />
                          Promouvoir (membre → officier)
                        </Button>
                      )}
                    </Field>
                  ) : null}

                  <Field>
                    <FieldLabel>Rôle assigné</FieldLabel>
                    <ItemGroup className="gap-1">
                      <Item asChild size="sm" variant={!assignMember.roleId ? 'muted' : 'outline'}>
                        <button
                          type="button"
                          onClick={() => {
                            void handleAssignRole(assignMember.userId, null);
                            setRoleAssignMemberId(null);
                          }}
                          className="text-left"
                        >
                          <ItemMedia>
                            <span className="size-3 rounded-full border bg-muted" />
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle>Aucun rôle</ItemTitle>
                          </ItemContent>
                        </button>
                      </Item>
                      {(selectedClan?.roles ?? [])
                        .filter((role) => role.name !== 'Chef')
                        .map((role) => (
                          <Item key={role.id} asChild size="sm" variant={assignMember.roleId === role.id ? 'muted' : 'outline'}>
                            <button
                              type="button"
                              onClick={() => {
                                void handleAssignRole(assignMember.userId, role.id);
                                setRoleAssignMemberId(null);
                              }}
                              className="text-left"
                            >
                              <ItemMedia>
                                <span className="size-3 rounded-full" style={{ backgroundColor: role.color }} />
                              </ItemMedia>
                              <ItemContent>
                                <ItemTitle>{role.name}</ItemTitle>
                              </ItemContent>
                            </button>
                          </Item>
                        ))}
                    </ItemGroup>
                  </Field>

                  {selectedClan?.viewer.permissions?.canManageRoles ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRoleAssignMemberId(null);
                        openRoleCreate();
                      }}
                    >
                      <Plus />
                      Nouveau rôle
                    </Button>
                  ) : null}
                </FieldGroup>
              ) : null}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Création / modification de rôle ── */}
      <Dialog open={roleEditOpen} onOpenChange={setRoleEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="size-4 rounded-full border" style={{ backgroundColor: roleEditColor }} />
              {roleEditId ? 'Modifier le rôle' : 'Nouveau rôle'}
            </DialogTitle>
            <DialogDescription>
              {roleEditId ? 'Modifiez le nom, la couleur et les permissions de ce rôle.' : 'Créez un rôle personnalisé pour les membres de votre clan.'}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="role-name">Nom du rôle</FieldLabel>
              <Input
                id="role-name"
                value={roleEditName}
                onChange={(event) => setRoleEditName(event.target.value.slice(0, 32))}
                placeholder="Ex : Stratège, Éleveur…"
                disabled={roleEditIsSystem}
                maxLength={32}
              />
              {roleEditIsSystem ? <FieldDescription>Le nom des rôles système ne peut pas être modifié.</FieldDescription> : null}
            </Field>

            <Field>
              <FieldLabel>Couleur</FieldLabel>
              <ColorSwatchPicker label="Couleur du rôle" colors={TAG_PRESET_COLORS} value={roleEditColor} onChange={setRoleEditColor} />
            </Field>

            <Field>
              <FieldLabel>Permissions</FieldLabel>
              <div className="flex flex-col gap-2">
                {([
                  { key: 'canManageHorses', label: 'Gérer les chevaux', desc: 'Acheter, entraîner, inscrire et soigner les chevaux' },
                  { key: 'canInviteMembers', label: 'Inviter des membres', desc: 'Accepter ou refuser les candidatures' },
                  { key: 'canKickMembers', label: 'Exclure des membres', desc: 'Retirer des membres réguliers du clan' },
                  { key: 'canManageRoles', label: 'Gérer les rôles', desc: 'Créer, modifier et assigner des rôles' },
                ] as { key: keyof typeof roleEditPerms; label: string; desc: string }[]).map(({ key, label, desc }) => (
                  <Field key={key} orientation="horizontal" className="rounded-lg border p-3">
                    <Checkbox
                      id={`perm-${key}`}
                      checked={roleEditPerms[key]}
                      onCheckedChange={(checked) => setRoleEditPerms((prev) => ({ ...prev, [key]: checked === true }))}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={`perm-${key}`}>{label}</FieldLabel>
                      <FieldDescription>{desc}</FieldDescription>
                    </FieldContent>
                  </Field>
                ))}
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleEditOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveRole} disabled={roleSaving || (!roleEditIsSystem && !roleEditName.trim())}>
              {roleSaving ? <Spinner /> : <Check />}
              {roleEditId ? 'Enregistrer les modifications' : 'Créer le rôle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}

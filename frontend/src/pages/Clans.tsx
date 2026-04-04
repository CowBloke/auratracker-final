import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Axe, Check, Crown, History, Loader2, LogOut, Pencil, Plus, Send, Sparkles, Swords, Target, Trash2, UserX, X } from 'lucide-react';
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
  ClanWarParticipantStats,
  ClanSummary,
  ClanWarDefenseState,
  ClanWarGamesStatus,
  ClanWarState,
  clansApi,
  uploadUserImage,
} from '@/services/api';
import { MemoryGame } from '@/components/clans/war-games/MemoryGame';
import { BombDropGame } from '@/components/clans/war-games/BombDropGame';
import { NavalWarfareGame } from '@/components/clans/war-games/NavalWarfareGame';
import { PageShell } from '@/components/layout/page-shell';
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
import { UsernameDisplay } from '@/components/ui/username-display';
import { ClanTag, ClanTagStyle, DEFAULT_CLAN_TAG_STYLE, getClanTagBackground, parseClanTagStyle } from '@/components/clans/ClanTag';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { SPACING, TYPOGRAPHY } from '@/lib/design-system';
import { prepareImageUploadPayload } from '@/lib/image-upload';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';

const panelClassName = 'rounded-2xl border border-border/50 bg-background shadow-none';
const mutedPanelClassName = 'rounded-2xl border border-border/50 bg-muted/15 shadow-none';

const formatAura = (value: number | string) => {
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(numericValue)) return '0';
  return numericValue.toLocaleString('fr-FR');
};

const formatMoney = (value: number | string) => {
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(numericValue)) return '0';
  return numericValue.toLocaleString('fr-FR');
};

const formatSignedValue = (value: number) =>
  `${value > 0 ? '+' : ''}${value.toLocaleString('fr-FR')}`;

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCountdown = (value: string | null | undefined) => {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return 'maintenant';

  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
};

const formatEffectCooldown = (effect: ClanActiveEffect) => {
  return `Actif encore ${formatCountdown(effect.activeUntil)}`;
};


const getClanEffectIcon = (effect: ClanActiveEffect) => {
  if (effect.type === 'CLAN_GAME_MONEY_BOOST') {
    return <CurrencyIcon type="money" className="h-4 w-4" />;
  }

  return <Sparkles className="h-4 w-4" />;
};

const getStatusLabel = (status: ClanWarState['status']) => {
  switch (status) {
    case 'PREPARING':
      return 'Préparation';
    case 'ACTIVE':
      return 'En cours';
    case 'COMPLETED':
      return 'Terminée';
    default:
      return status;
  }
};

const getClanEventStatusLabel = (status: ClanEventView['status']) => {
  switch (status) {
    case 'ACTIVE':
      return 'En cours';
    case 'SCHEDULED':
      return 'Bientôt';
    case 'COMPLETED':
      return 'Terminée';
    case 'DRAFT':
      return 'Brouillon';
    default:
      return 'Annulée';
  }
};

const getClanEventActivityLabel = (activityType: string) => {
  switch (activityType) {
    case 'PLAY_ANY_GAME':
      return 'Parties jouées';
    case 'WIN_ANY_GAME':
      return 'Victoires';
    case 'CLAN_CHAT_MESSAGE':
      return 'Messages clan';
    case 'CLAN_BANK_DEPOSIT':
      return 'Money déposée';
    case 'CLAN_WAR_ATTACK':
      return 'Actions d’attaque';
    case 'CLAN_WAR_SUPPORT':
      return 'Actions de support';
    case 'EVENT_MINIGAME_PLAY':
      return 'Mini-jeux joués';
    case 'EVENT_MINIGAME_POINTS':
      return 'Points mini-jeux';
    default:
      return activityType.replace(/_/g, ' ').toLowerCase();
  }
};

const getStatusVariant = (status: ClanWarState['status']) => {
  switch (status) {
    case 'ACTIVE':
      return 'destructive' as const;
    case 'PREPARING':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
};

const getWarOpponent = (war: ClanWarState, clanId: string) =>
  war.attackerClan.id === clanId ? war.defenderClan : war.attackerClan;

const getWarOwnSide = (war: ClanWarState, clanId: string) =>
  war.attackerClan.id === clanId ? war.attackerClan : war.defenderClan;

const getWarDefenseSet = (war: ClanWarState, clanId: string) =>
  war.attackerClan.id === clanId ? war.defenses.attacker : war.defenses.defender;

const getWarEnemyDefenseSet = (war: ClanWarState, clanId: string) =>
  war.attackerClan.id === clanId ? war.defenses.defender : war.defenses.attacker;

const getWarParticipantStats = (war: ClanWarState, clanId: string) =>
  war.attackerClan.id === clanId ? war.participantStats.attacker : war.participantStats.defender;

const getAvatarFallback = (value: string) => value.trim().slice(0, 2);

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
    {getClanEffectIcon(effect)}
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

  // Image editor state
  const [imageEditOpen, setImageEditOpen] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const [descriptionEditOpen, setDescriptionEditOpen] = useState(false);
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
  const [activeTab, setActiveTab] = useState<'info' | 'event' | 'bank' | 'inventory' | 'chat' | 'guerre' | 'tag' | 'messages'>('info');
  const [bankHistoryOpen, setBankHistoryOpen] = useState(false);

  // Pump-up messages
  const [pumpUpMessages, setPumpUpMessages] = useState<ClanPumpUpMessage[]>([]);
  const [pumpUpLoading, setPumpUpLoading] = useState(false);
  const [pumpUpDraft, setPumpUpDraft] = useState('');
  const [pumpUpColor, setPumpUpColor] = useState('#ffffff');
  const [pumpUpSaving, setPumpUpSaving] = useState(false);
  const [pumpUpEditId, setPumpUpEditId] = useState<string | null>(null);

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
      setSelectedClanId(viewerClanId ?? clans[0].id);
    }
  }, [clans, selectedClanId, viewerClanId]);

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
    setDescriptionEditOpen(false);
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



  const selectedClanSummary = useMemo(
    () => clans.find((clan) => clan.id === selectedClanId) ?? null,
    [clans, selectedClanId]
  );

  const selectedWar = selectedClan?.warHub.currentWar ?? null;
  const isOwnClan = viewerClanId === selectedClan?.id;
  const canCreateClan = !viewerClanId;
  const canJoinSelectedClan = Boolean(selectedClan && !selectedClan.viewer.isMember && !viewerClanId);

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
        description: error.response?.data?.error || 'Impossible d’enregistrer ce score.',
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
      toast({ title: 'Clan créé', description: 'Ton clan est prêt à recruter et à combattre.' });
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
    if (!confirm(`Confirmer le transfert du rôle de chef à ${username} ?`)) return;

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
    if (!confirm('Voulez-vous vraiment quitter ce clan ?')) return;

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
        description: `${clanItem.item.name} booste maintenant les gains d’argent du clan.`,
      });
    } catch (error: any) {
      toast({
        title: "Activation impossible",
        description: error.response?.data?.error || "Impossible d’activer cet objet.",
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
            ? "Impossible d’appliquer la banniere."
            : "Impossible d’appliquer la photo de profil du clan."
        ),
        variant: "destructive",
      });
    } finally {
      setSavingBannerItem(false);
      setBannerItemId(null);
      setBannerItemEffectType(null);
    }
  };

  const handleSaveImage = async () => {
    if (!selectedClan || !selectedClan.viewer.isLeader) return;
    try {
      setSavingImage(true);
      const res = await clansApi.updateImage(selectedClan.id, editImageUrl.trim() || null);
      setSelectedClan((prev) => prev ? { ...prev, imageUrl: res.data.imageUrl } : prev);
      setClans((prev) => prev.map((c) => c.id === selectedClan.id ? { ...c, imageUrl: res.data.imageUrl } : c));
      setImageEditOpen(false);
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
      setDescriptionEditOpen(false);
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
    <>
      <PageShell size="wide">
        <div className={SPACING.PAGE_CONTENT}>
          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-4">
              <Card className={panelClassName}>
                <CardContent className="space-y-4 p-4">
                  <SectionTitle
                    title="Front global"
                    description="Guerres en préparation ou déjà lancées."
                    action={<Badge variant="secondary">{activeWars.length}</Badge>}
                  />
                  {activeWars.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                      Aucune guerre active pour le moment.
                    </div>
                  ) : (
                    activeWars.map((war) => (
                      <button
                        key={war.id}
                        type="button"
                        onClick={() => setSelectedClanId(war.attackerClan.id)}
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
                          <span>Fin dans {formatCountdown(war.endsAt)}</span>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className={panelClassName}>
                <CardContent className="space-y-3 p-4">
                  <SectionTitle
                    title="Répertoire"
                    description="Tous les clans disponibles."
                    action={
                      <>
                        <span className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground tabular-nums')}>{clans.length}</span>
                        {canCreateClan ? (
                          <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Créer
                          </Button>
                        ) : null}
                      </>
                    }
                  />
                  {loading ? (
                    <div className={cn(TYPOGRAPHY.MUTED, 'py-10')}>Chargement...</div>
                  ) : clans.length === 0 ? (
                    <div className={cn(TYPOGRAPHY.MUTED, 'py-6')}>Aucun clan pour le moment.</div>
                  ) : (
                    clans.map((clan) => {
                      const hasTag = clan.tagUnlocked && clan.tagText;
                      const clanTagStyle = hasTag ? parseClanTagStyle(clan.tagStyle) : null;
                      return (
                        <button
                          key={clan.id}
                          type="button"
                          onClick={() => setSelectedClanId(clan.id)}
                          className={cn(
                            'w-full rounded-2xl border px-3 py-3 text-left transition-opacity',
                            clan.id === selectedClanId ? 'opacity-100' : 'opacity-90 hover:opacity-100',
                            !hasTag && 'border-border/50 hover:bg-muted/30',
                            !hasTag && clan.id === selectedClanId && 'border-foreground/15 bg-muted/30',
                          )}
                          style={clanTagStyle ? {
                            ...getClanTagBackground(clanTagStyle),
                            borderColor: clanTagStyle.borderColor,
                          } : undefined}
                        >
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
                                {clan.memberCount}/{clan.maxMembers} membres • {formatAura(clan.totalAura)} aura
                              </div>
                              <div
                                className={cn('text-[11px]', !clanTagStyle && 'text-muted-foreground')}
                                style={clanTagStyle ? { color: clanTagStyle.textColor, opacity: 0.75 } : undefined}
                              >
                                Niveau {clan.level}
                              </div>
                            </div>
                            {viewerClanId === clan.id ? <Badge>Mon clan</Badge> : null}
                          </div>
                        </button>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {!selectedClanId || !selectedClanSummary ? (
                <Card className={panelClassName}>
                  <CardContent className="p-10 text-center text-muted-foreground">
                    Sélectionne un clan pour afficher son quartier général.
                  </CardContent>
                </Card>
              ) : detailLoading || !selectedClan ? (
                <Card className={panelClassName}>
                  <CardContent className="flex items-center justify-center p-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Twitter-style clan profile header */}
                  <Card className={cn(panelClassName, "overflow-hidden")}>
                    {/* Banner */}
                    <div className="relative h-40 overflow-hidden bg-gradient-to-br from-muted via-background to-muted/70 sm:h-48 lg:h-56">
                      {selectedClan.banner ? (
                        <>
                          <img
                            src={resolveImageUrl(selectedClan.banner)}
                            alt={selectedClan.name}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/20" />
                        </>
                      ) : null}
                      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-card to-transparent" />
                    </div>

                    <CardContent className="px-4 pb-5 pt-0">
                      <div className="-mt-8 flex items-end justify-between gap-3">
                        <div className="relative shrink-0">
                          <Avatar className="h-16 w-16 rounded-2xl border-[3px] border-card bg-muted/20 shadow-sm">
                            <AvatarImage src={resolveImageUrl(selectedClan.imageUrl)} alt={selectedClan.name} />
                            <AvatarFallback className="rounded-2xl text-base font-semibold">{getAvatarFallback(selectedClan.name)}</AvatarFallback>
                          </Avatar>
                          {selectedClan.viewer.isLeader ? (
                            <button
                              type="button"
                              className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
                              onClick={() => { setEditImageUrl(selectedClan.imageUrl ?? ""); setImageEditOpen(true); }}
                            >
                              <Pencil className="h-3.5 w-3.5 text-white" />
                            </button>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 pb-1">
                          {canJoinSelectedClan ? (
                            <Button size="sm" className="rounded-full px-4" onClick={handleJoin} disabled={actionLoading || selectedClan.viewer.hasPendingRequest}>
                              {actionLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                              {selectedClan.viewer.hasPendingRequest ? "En attente" : "Rejoindre"}
                            </Button>
                          ) : null}
                          {selectedClan.viewer.isMember ? (
                            <Button size="sm" variant="outline" className="rounded-full px-4" onClick={handleLeave} disabled={actionLoading}>
                              <LogOut className="h-3.5 w-3.5" />
                              Quitter
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h1 className="text-xl font-semibold tracking-tight">{selectedClan.name}</h1>
                            {selectedClan.viewer.isLeader ? <Crown className="h-4 w-4 text-amber-500" /> : null}
                          </div>

                          {descriptionEditOpen ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editDescription}
                                onChange={(event) => setEditDescription(event.target.value)}
                                maxLength={300}
                                rows={3}
                                placeholder="Décris l'identité, le style de jeu et l'objectif du clan."
                                disabled={savingDescription}
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" size="sm" onClick={handleSaveDescription} disabled={savingDescription}>
                                  {savingDescription ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                  Enregistrer
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditDescription(selectedClan.description ?? '');
                                    setDescriptionEditOpen(false);
                                  }}
                                  disabled={savingDescription}
                                >
                                  Annuler
                                </Button>
                                <span className="text-xs text-muted-foreground">{editDescription.length}/300</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-start gap-2">
                              <p className="text-sm text-muted-foreground">
                                {selectedClan.description || 'Aucune description pour le moment.'}
                              </p>
                              {selectedClan.viewer.isLeader ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => setDescriptionEditOpen(true)}
                                >
                                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                  Modifier
                                </Button>
                              ) : null}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>
                              <span className="font-medium text-foreground">{selectedClan.memberCount}</span>
                              /{selectedClan.maxMembers} membres
                            </span>
                            <span>{formatAura(selectedClan.totalAura)} aura</span>
                            <span>
                              <span className="font-medium text-foreground">{formatMoney(selectedClan.warTrophies)}</span>
                              {' '}trophées
                            </span>
                            <Badge variant="outline" className="h-5 rounded-full px-2 text-xs">Niv. {selectedClan.level}</Badge>
                            {!selectedClan.isPublic ? <Badge variant="outline" className="h-5 rounded-full px-2 text-xs">Prive</Badge> : null}
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>Chef :</span>
                            <UsernameDisplay username={selectedClan.leader.username} usernameColor={selectedClan.leader.usernameColor} />
                          </div>
                        </div>

                        {selectedClan.activeEffects.length > 0 ? (
                          <div className="flex shrink-0 flex-wrap justify-end gap-2 pt-0.5">
                            {selectedClan.activeEffects.map((effect) => (
                              <ClanEffectBadge key={effect.id} effect={effect} />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tabs: Infos / Chat / Tag / Guerre */}
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'info' | 'event' | 'bank' | 'inventory' | 'chat' | 'guerre' | 'tag' | 'messages')}>
                    <TabsList className="w-full">
                      <TabsTrigger value="info" className="flex-1">
                        Infos
                      </TabsTrigger>
                      {featuredEvent ? (
                        <TabsTrigger value="event" className="flex-1">
                          Événement
                        </TabsTrigger>
                      ) : null}
                      {selectedClan.viewer.isMember ? (
                        <TabsTrigger value="bank" className="flex-1">
                          Banque
                        </TabsTrigger>
                      ) : null}
                      {selectedClan.viewer.isMember ? (
                        <TabsTrigger value="inventory" className="flex-1">
                          Inventaire
                        </TabsTrigger>
                      ) : null}
                      {selectedClan.viewer.isMember ? (
                        <TabsTrigger value="chat" className="flex-1">
                          Chat
                        </TabsTrigger>
                      ) : null}
                      {selectedClan.viewer.isLeader && selectedClan.tagUnlocked ? (
                        <TabsTrigger value="tag" className="flex-1">
                          Tag
                        </TabsTrigger>
                      ) : null}
                      {selectedClan.viewer.isMember ? (
                        <TabsTrigger value="messages" className="flex-1">
                          Messages
                        </TabsTrigger>
                      ) : null}
                      <TabsTrigger value="guerre" className="flex-1">
                        Guerre
                        {selectedWar && selectedWar.status !== 'COMPLETED' ? (
                          <Badge variant={getStatusVariant(selectedWar.status)} className="ml-2 h-4 px-1 text-[10px]">
                            {getStatusLabel(selectedWar.status)}
                          </Badge>
                        ) : null}
                      </TabsTrigger>
                    </TabsList>

                    {/* ── Info tab ── */}
                    <TabsContent value="info" className="mt-4 space-y-4">



                      {/* Roster */}
                      <Card className={panelClassName}>
                        <CardContent className="space-y-2 p-4">
                          <SectionTitle title="Membres" description={`${selectedClan.memberCount}/${selectedClan.maxMembers}`} />
                          {selectedClan.members.map((member) => (
                            <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-2">
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={resolveImageUrl(member.profilePicture)} alt={member.username} />
                                  <AvatarFallback>{getAvatarFallback(member.username)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <UsernameDisplay
                                      username={member.username}
                                      usernameColor={member.usernameColor}
                                      clanTag={selectedClan.tagUnlocked && selectedClan.tagText ? { text: selectedClan.tagText, style: parseClanTagStyle(selectedClan.tagStyle) } : null}
                                    />
                                    {member.isLeader ? <Crown className="h-3.5 w-3.5 text-amber-500" /> : null}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span>{formatAura(member.aura)} aura</span>
                                    <span>•</span>
                                    <span>
                                      {selectedClan.leader.id === member.userId
                                        ? 'Chef'
                                        : member.isLeader
                                          ? 'Officier'
                                          : 'Membre'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {selectedClan.viewer.isLeader && member.userId !== user?.id ? (
                                <div className="flex flex-wrap justify-end gap-1.5">
                                  {selectedClan.leader.id !== member.userId ? (
                                    member.isLeader ? (
                                      <Button variant="outline" size="sm" onClick={() => handleDemoteMember(member.userId)} disabled={actionLoading}>
                                        Rétrograder
                                      </Button>
                                    ) : (
                                      <Button variant="outline" size="sm" onClick={() => handlePromoteMember(member.userId)} disabled={actionLoading}>
                                        Promouvoir
                                      </Button>
                                    )
                                  ) : null}
                                  {selectedClan.leader.id === user?.id && selectedClan.leader.id !== member.userId ? (
                                    <Button variant="secondary" size="sm" onClick={() => handleTransferLeadership(member.userId, member.username)} disabled={actionLoading}>
                                      Donner chef
                                    </Button>
                                  ) : null}
                                  {!member.isLeader ? (
                                    <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member.userId)} disabled={actionLoading}>
                                      <UserX className="h-3.5 w-3.5" />
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      {/* Candidatures (leader only) */}
                      {selectedClan.viewer.isLeader && selectedClan.joinRequests.length > 0 ? (
                        <Card className={panelClassName}>
                          <CardContent className="space-y-2 p-4">
                            <SectionTitle title="Candidatures" description={`${selectedClan.joinRequests.length} en attente`} />
                            {selectedClan.joinRequests.map((request) => (
                              <div key={request.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={resolveImageUrl(request.profilePicture)} alt={request.username} />
                                  <AvatarFallback>{getAvatarFallback(request.username)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <UsernameDisplay username={request.username} usernameColor={request.usernameColor} />
                                  <div className="text-xs text-muted-foreground">{formatAura(request.aura)} aura</div>
                                </div>
                                <div className="flex gap-1.5">
                                  <Button size="sm" onClick={() => handleRequestAction(request.id, 'accept')} disabled={actionLoading}>
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleRequestAction(request.id, 'reject')} disabled={actionLoading}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      ) : null}

                    </TabsContent>

                    <TabsContent value="event" className="mt-4 space-y-4">
                      {featuredEventLoading ? (
                        <Card className={panelClassName}>
                          <CardContent className="flex items-center justify-center p-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </CardContent>
                        </Card>
                      ) : !featuredEvent ? (
                        <Card className={panelClassName}>
                          <CardContent className="p-8 text-sm text-muted-foreground">
                            Aucun événement de clan n’est publié pour le moment.
                          </CardContent>
                        </Card>
                      ) : (
                        <>
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
                                <SectionTitle title="Quêtes d’événement" description="Chaque quête terminée ajoute des points au clan." />
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
                                  <SectionTitle title="Top clans" description="Classement de l’événement." />
                                  <div className="space-y-2">
                                    {featuredEvent.leaderboard.map((entry) => (
                                      <div key={entry.clan.id} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2.5">
                                        <div className="min-w-0">
                                          <div className="text-sm font-medium">#{entry.rank} {entry.clan.name}</div>
                                          <div className="text-xs text-muted-foreground">{entry.clan.memberCount} membres • niv. {entry.clan.level}</div>
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
                              <SectionTitle title="Activité récente" description="Derniers points inscrits dans l’événement." />
                              <div className="space-y-2">
                                {featuredEvent.recentActivity.length === 0 ? (
                                  <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                                    Aucun point enregistré pour l’instant.
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
                        </>
                      )}
                    </TabsContent>


                    <TabsContent value="bank" className="mt-4 space-y-4">
                      <Card className={panelClassName}>
                        <CardContent className="space-y-3 p-4">
                          <SectionTitle
                            title="Banque de clan"
                            description={"Les membres peuvent déposer. Seul le chef peut dépenser cet argent pour les améliorations du clan."}
                            action={
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setBankHistoryOpen(true)}
                                  title="Historique"
                                  aria-label="Historique"
                                >
                                  <History className="h-4 w-4" />
                                </Button>
                                <Badge variant="secondary">Niveau {selectedClan.level}</Badge>
                              </>
                            }
                          />
                          <div className="rounded-2xl border border-border/50 bg-muted/15 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <CurrencyIcon type="money" className="h-4 w-4" />
                                  Solde actuel
                                </div>
                                <div className="mt-2 text-2xl font-semibold tabular-nums">
                                  {formatMoney(selectedClan.clanBankMoney)}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-end gap-2">
                                <div className="w-full max-w-[180px] space-y-1">
                                  <label className="text-xs text-muted-foreground">{"Montant à déposer"}</label>
                                  <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={bankDepositAmount}
                                    onChange={(event) => setBankDepositAmount(event.target.value)}
                                    disabled={depositingBank}
                                  />
                                </div>
                                <Button type="button" onClick={handleDepositToBank} disabled={depositingBank}>
                                  {depositingBank ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CurrencyIcon type="money" className="mr-2 h-4 w-4" />}
                                  {"Déposer"}
                                </Button>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border/50 bg-muted/15 p-4">
                            <div className="text-sm font-medium">Inventaire du clan</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {selectedClan.ownedItems.length > 0
                                ? `${selectedClan.ownedItems.length} objet${selectedClan.ownedItems.length > 1 ? "s" : ""} différent${selectedClan.ownedItems.length > 1 ? "s" : ""} en stock`
                                : 'Aucun objet de clan en stock.'}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="inventory" className="mt-4 space-y-4">
                      <Card className={panelClassName}>
                        <CardContent className="space-y-3 p-4">
                          <SectionTitle
                            title="Objets de clan"
                            description={"Achetés avec la banque du clan. Le chef peut les activer."}
                          />
                          {selectedClan.ownedItems.length > 0 ? (
                            <div className="space-y-2">
                              {selectedClan.ownedItems.map((clanItem) => (
                                <div key={clanItem.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                      <span>{clanItem.item.name} {"×"}{clanItem.quantity}</span>
                                      {["CLAN_BANNER", "CLAN_PROFILE_PICTURE"].includes(parseClanItemEffect(clanItem.item.effect)?.type ?? "") ? (
                                        <Badge variant="secondary">Upload image</Badge>
                                      ) : null}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{clanItem.item.description}</div>
                                  </div>
                                  {selectedClan.viewer.isLeader ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => handleUseClanItem(clanItem)}
                                      disabled={usingClanItemId === clanItem.id}
                                    >
                                      {usingClanItemId === clanItem.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                      {["CLAN_BANNER", "CLAN_PROFILE_PICTURE"].includes(parseClanItemEffect(clanItem.item.effect)?.type ?? "") ? "Choisir l&apos;image" : "Activer"}
                                    </Button>
                                  ) : (
                                    <Badge variant="outline">Chef requis</Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-border/50 px-3 py-4 text-sm text-muted-foreground">
                              {"Aucun objet de clan en stock. Les achats apparaîtront ici."}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                    <TabsContent value="chat" className="mt-4">
                      <Card className={panelClassName}>
                        <CardContent className="space-y-3 p-4">
                          <SectionTitle title="Chat du clan" />
                          <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-border/50 bg-muted/15 p-3">
                            {chatLoading ? (
                              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Chargement...
                              </div>
                            ) : chatMessages.length === 0 ? (
                              <div className="py-8 text-center text-sm text-muted-foreground">Lance la conversation.</div>
                            ) : (
                              [...chatMessages].reverse().map((entry) => {
                                const isOwnMessage = entry.user.id === user?.id;
                                return (
                                  <div key={entry.id} className={cn('flex', isOwnMessage ? 'justify-end' : 'justify-start')}>
                                    <div className={cn('max-w-[85%] rounded-xl border border-border/50 px-3 py-2', isOwnMessage ? 'border-primary/20 bg-primary/10' : 'bg-background')}>
                                      <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <UsernameDisplay username={entry.user.username} usernameColor={entry.user.usernameColor} />
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
                              rows={2}
                              placeholder="Écris à ton clan..."
                              disabled={chatSending}
                            />
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs text-muted-foreground">{chatDraft.trim().length}/400</span>
                              <Button type="submit" size="sm" disabled={chatSending || !chatDraft.trim()}>
                                {chatSending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                                Envoyer
                              </Button>
                            </div>
                          </form>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* ── Tag tab ── */}
                    <TabsContent value="tag" className="mt-4 space-y-4">
                      <Card className={panelClassName}>
                        <CardContent className="space-y-4 p-4">
                          <SectionTitle title="Tag du clan" description="Personnalise le tag affiché après les noms des membres." />
                          {/* Preview */}
                          <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-3">
                            <span className="text-sm text-muted-foreground">Aperçu :</span>
                            <span className="font-medium">Nom</span>
                            {tagText.trim() ? (
                              <ClanTag tag={{ text: tagText.trim(), style: tagStyle }} />
                            ) : (
                              <span className="text-xs text-muted-foreground italic">aucun texte</span>
                            )}
                          </div>
                          {/* Text */}
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Texte (1–6 caractères)</label>
                            <Input value={tagText} onChange={(e) => setTagText(e.target.value.slice(0, 6))} maxLength={6} placeholder="OG" className="w-28 font-mono" />
                          </div>
                          {/* Background type */}
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Fond</label>
                            <div className="flex gap-2">
                              {(['solid', 'gradient'] as const).map((type) => (
                                <Button key={type} type="button" size="sm" variant={tagStyle.backgroundType === type ? 'default' : 'outline'} onClick={() => setTagStyle((s) => ({ ...s, backgroundType: type }))}>
                                  {type === 'solid' ? 'Uni' : 'Dégradé'}
                                </Button>
                              ))}
                            </div>
                          </div>
                          {/* Background colors */}
                          {tagStyle.backgroundType === 'solid' ? (
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">Couleur de fond</label>
                              <div className="flex flex-wrap gap-1.5">
                                {TAG_PRESET_COLORS.map((c) => (
                                  <button type="button" key={c} onClick={() => setTagStyle((s) => ({ ...s, backgroundColor: c }))} className={cn('h-5 w-5 rounded-full border-2 transition-transform hover:scale-110', tagStyle.backgroundColor === c ? 'border-foreground scale-110' : 'border-transparent')} style={{ backgroundColor: c }} />
                                ))}
                                <input type="color" value={tagStyle.backgroundColor} onChange={(e) => setTagStyle((s) => ({ ...s, backgroundColor: e.target.value }))} className="h-5 w-5 cursor-pointer rounded border p-0" />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">Couleurs du dégradé</label>
                              <div className="flex items-center gap-2">
                                <input type="color" value={(() => { try { return JSON.parse(tagStyle.backgroundGradient ?? '{}').from ?? '#374151'; } catch { return '#374151'; } })()} onChange={(e) => { const cur = (() => { try { return JSON.parse(tagStyle.backgroundGradient ?? '{}'); } catch { return { from: '#374151', to: '#6366f1', direction: 'to right' }; } })(); setTagStyle((s) => ({ ...s, backgroundGradient: JSON.stringify({ ...cur, from: e.target.value }) })); }} className="h-6 w-6 cursor-pointer rounded border p-0" />
                                <span className="text-xs text-muted-foreground">→</span>
                                <input type="color" value={(() => { try { return JSON.parse(tagStyle.backgroundGradient ?? '{}').to ?? '#6366f1'; } catch { return '#6366f1'; } })()} onChange={(e) => { const cur = (() => { try { return JSON.parse(tagStyle.backgroundGradient ?? '{}'); } catch { return { from: '#374151', to: '#6366f1', direction: 'to right' }; } })(); setTagStyle((s) => ({ ...s, backgroundGradient: JSON.stringify({ ...cur, to: e.target.value }) })); }} className="h-6 w-6 cursor-pointer rounded border p-0" />
                              </div>
                            </div>
                          )}
                          {/* Text color */}
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Couleur du texte</label>
                            <div className="flex flex-wrap gap-1.5">
                              {TAG_PRESET_COLORS.map((c) => (<button type="button" key={c} onClick={() => setTagStyle((s) => ({ ...s, textColor: c }))} className={cn('h-5 w-5 rounded-full border-2 transition-transform hover:scale-110', tagStyle.textColor === c ? 'border-foreground scale-110' : 'border-transparent')} style={{ backgroundColor: c }} />))}
                              <input type="color" value={tagStyle.textColor} onChange={(e) => setTagStyle((s) => ({ ...s, textColor: e.target.value }))} className="h-5 w-5 cursor-pointer rounded border p-0" />
                            </div>
                          </div>
                          {/* Border color */}
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Couleur de bordure</label>
                            <div className="flex flex-wrap gap-1.5">
                              {TAG_PRESET_COLORS.map((c) => (<button type="button" key={c} onClick={() => setTagStyle((s) => ({ ...s, borderColor: c }))} className={cn('h-5 w-5 rounded-full border-2 transition-transform hover:scale-110', tagStyle.borderColor === c ? 'border-foreground scale-110' : 'border-transparent')} style={{ backgroundColor: c }} />))}
                              <input type="color" value={tagStyle.borderColor} onChange={(e) => setTagStyle((s) => ({ ...s, borderColor: e.target.value }))} className="h-5 w-5 cursor-pointer rounded border p-0" />
                            </div>
                          </div>
                          {/* Save */}
                          <Button type="button" onClick={saveTag} disabled={savingTag || !tagText.trim()} size="sm" className="w-full">
                            {savingTag ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Sauvegarder
                          </Button>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* ── Messages tab ── */}
                    <TabsContent value="messages" className="mt-4 space-y-4">
                      <Card className={panelClassName}>
                        <CardContent className="space-y-4 p-4">
                          <SectionTitle
                            title="Messages de bienvenue"
                            description="Ces messages s'affichent aléatoirement sur l'accueil des membres."
                          />

                          {/* Message list */}
                          {pumpUpLoading ? (
                            <p className="text-sm text-muted-foreground">Chargement...</p>
                          ) : pumpUpMessages.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 px-4 py-4">
                              <p className="text-sm text-muted-foreground">Aucun message de bienvenue pour l'instant.</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {pumpUpMessages.map((msg) => (
                                <div key={msg.id} className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
                                  <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full border border-border/50" style={{ backgroundColor: msg.color }} />
                                  <p className="min-w-0 flex-1 text-sm leading-relaxed" style={{ color: msg.color !== '#ffffff' ? msg.color : undefined }}>
                                    {msg.content}
                                  </p>
                                  {selectedClan.viewer.isLeader && (
                                    <div className="flex shrink-0 gap-1">
                                      <button
                                        type="button"
                                        onClick={() => startEditPumpUp(msg)}
                                        className="rounded p-1 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void deletePumpUpMessage(msg.id)}
                                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
                            <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-3">
                              <p className="text-xs font-medium text-muted-foreground">
                                {pumpUpEditId ? 'Modifier le message' : `Nouveau message (${pumpUpMessages.length}/5)`}
                              </p>

                              {/* Preview */}
                              {pumpUpDraft.trim() && (
                                <div className="rounded-lg bg-muted/30 px-3 py-2">
                                  <span className="text-xs text-muted-foreground">Aperçu : </span>
                                  <span className="text-sm font-medium" style={{ color: pumpUpColor }}>
                                    {pumpUpDraft.replace('{name}', user?.username ?? 'Nom')}
                                  </span>
                                </div>
                              )}

                              {/* Text input */}
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">
                                  Texte — utilise <code className="rounded bg-muted px-1">{'{name}'}</code> pour le prénom
                                </label>
                                <Input
                                  value={pumpUpDraft}
                                  onChange={(e) => setPumpUpDraft(e.target.value.slice(0, 120))}
                                  placeholder="Bienvenue {name} dans le clan !"
                                  maxLength={120}
                                />
                                <p className="text-right text-xs text-muted-foreground">{pumpUpDraft.length}/120</p>
                              </div>

                              {/* Color picker */}
                              <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Couleur du texte</label>
                                <div className="flex flex-wrap gap-1.5">
                                  {TAG_PRESET_COLORS.map((c) => (
                                    <button
                                      type="button"
                                      key={c}
                                      onClick={() => setPumpUpColor(c)}
                                      className={cn('h-5 w-5 rounded-full border-2 transition-transform hover:scale-110', pumpUpColor === c ? 'border-foreground scale-110' : 'border-transparent')}
                                      style={{ backgroundColor: c }}
                                    />
                                  ))}
                                  <input
                                    type="color"
                                    value={pumpUpColor}
                                    onChange={(e) => setPumpUpColor(e.target.value)}
                                    className="h-5 w-5 cursor-pointer rounded border p-0"
                                  />
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={pumpUpSaving || !pumpUpDraft.trim() || (!pumpUpEditId && pumpUpMessages.length >= 5)}
                                  onClick={() => void savePumpUpMessage()}
                                  className="flex-1"
                                >
                                  {pumpUpSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  {pumpUpEditId ? 'Modifier' : 'Ajouter'}
                                </Button>
                                {pumpUpEditId && (
                                  <Button type="button" size="sm" variant="outline" onClick={cancelEditPumpUp}>
                                    Annuler
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* ── Guerre tab ── */}
                    <TabsContent value="guerre" className="mt-4 space-y-4">
                      {/* War status bar */}
                      <Card className={panelClassName}>
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-3">
                              <div className={mutedPanelClassName}>
                                <div className="px-3 py-2">
                                  <div className="text-xs text-muted-foreground">Trophées de guerre</div>
                                  <div className="text-sm font-medium">{formatMoney(selectedClan.warTrophies)}</div>
                                </div>
                              </div>
                              <div className={mutedPanelClassName}>
                                <div className="px-3 py-2">
                                  <div className="text-xs text-muted-foreground">Bilan</div>
                                  <div className="text-sm">
                                    {selectedClan.warWins}V • {selectedClan.warLosses}D • {selectedClan.warDraws}N
                                  </div>
                                </div>
                              </div>
                              <div className={mutedPanelClassName}>
                                <div className="px-3 py-2">
                                  <div className="text-xs text-muted-foreground">Éligibilité</div>
                                  <div className="text-sm">
                                    {selectedClan.memberCount >= selectedClan.warHub.minimumMembersRequired
                                      ? 'Éligible'
                                      : `${selectedClan.warHub.minimumMembersRequired} membres requis`}
                                  </div>
                                </div>
                              </div>
                              <div className={mutedPanelClassName}>
                                <div className="px-3 py-2">
                                  <div className="text-xs text-muted-foreground">Temps de recharge</div>
                                  <div className="text-sm">
                                    {selectedClan.warHub.cooldownEndsAt
                                      ? `Disponible dans ${formatCountdown(selectedClan.warHub.cooldownEndsAt)}`
                                      : 'Disponible'}
                                  </div>
                                </div>
                              </div>
                              {selectedClan.warHub.closestTrophyGap !== null ? (
                                <div className={mutedPanelClassName}>
                                  <div className="px-3 py-2">
                                    <div className="text-xs text-muted-foreground">Matchmaking</div>
                                    <div className="text-sm">Écart mini: {selectedClan.warHub.closestTrophyGap} trophées</div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            {selectedClan.warHub.canDeclareWar ? (
                              <Button onClick={() => setWarDialogOpen(true)}>
                                <Swords className="mr-2 h-4 w-4" />
                                Déclarer une guerre
                              </Button>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Active war */}
                      {selectedWar ? (
                        <Card className={panelClassName}>
                          <div className="border-b border-border/50 p-6">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={getStatusVariant(selectedWar.status)}>{getStatusLabel(selectedWar.status)}</Badge>
                                  <span className="text-sm text-muted-foreground">Objectif {selectedWar.targetScore} points</span>
                                </div>
                                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                                  {selectedWar.attackerClan.name} contre {selectedWar.defenderClan.name}
                                </h2>
                                <p className="mt-2 text-sm text-muted-foreground">
                                  {selectedWar.status === 'ACTIVE'
                                    ? `Fin prévue dans ${formatCountdown(selectedWar.endsAt)}.`
                                    : `Terminée le ${formatDate(selectedWar.completedAt)}.`}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-center">
                                <div className={mutedPanelClassName}>
                                  <div className="px-4 py-3">
                                    <div className="text-xs text-muted-foreground">{selectedWar.attackerClan.name}</div>
                                    <div className="mt-1 text-3xl font-semibold tabular-nums">{selectedWar.attackerScore}</div>
                                  </div>
                                </div>
                                <div className={mutedPanelClassName}>
                                  <div className="px-4 py-3">
                                    <div className="text-xs text-muted-foreground">{selectedWar.defenderClan.name}</div>
                                    <div className="mt-1 text-3xl font-semibold tabular-nums">{selectedWar.defenderScore}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <CardContent className="space-y-4 p-6">
                            {isOwnClan ? (
                              <div className="space-y-4">
                                {/* Games */}
                                <div className={mutedPanelClassName}>
                                  <div className="space-y-4 p-4">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <h3 className="font-medium">Jeux de guerre</h3>
                                        <p className="text-sm text-muted-foreground">Complétez les jeux quotidiennement pour marquer des points.</p>
                                      </div>
                                      <Badge variant="secondary">{selectedWar.viewerSide === 'ATTACKER' ? 'Attaquant' : 'Défenseur'}</Badge>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-3">
                                      {/* Memory */}
                                      <div className={cn('rounded-2xl border p-4 space-y-3', gameStatus?.canPlayMemory ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/40 bg-muted/10')}>
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-xl">🧩</span>
                                              <span className="font-medium text-sm">Jeu Mémoire</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">Retournez les paires pour améliorer vos défenses</p>
                                          </div>
                                          {gameStatus?.memoryPlayedToday && <Badge variant="outline" className="text-[10px] shrink-0">✓ Joué</Badge>}
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                          <Button size="sm" className="w-full" disabled={!gameStatus?.canPlayMemory} onClick={() => openGame('MEMORY', false)}>
                                            {gameStatus?.memoryPlayedToday ? 'Déjà joué' : 'Jouer (1×/jour)'}
                                          </Button>
                                          <Button size="sm" variant="outline" className="w-full" onClick={() => openGame('MEMORY', true)}>
                                            Entraînement
                                          </Button>
                                        </div>
                                      </div>
                                      {/* Bomb */}
                                      <div className={cn('rounded-2xl border p-4 space-y-3', gameStatus?.canPlayBomb ? 'border-rose-500/30 bg-rose-500/5' : 'border-border/40 bg-muted/10')}>
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-xl">💣</span>
                                              <span className="font-medium text-sm">Bombardement</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">Pilotez un avion et détruisez les bâtiments ennemis</p>
                                          </div>
                                          {gameStatus?.bombPlayedToday && <Badge variant="outline" className="text-[10px] shrink-0">✓ Joué</Badge>}
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                          <Button size="sm" className="w-full" disabled={!gameStatus?.canPlayBomb} onClick={() => openGame('BOMB', false)}>
                                            {gameStatus?.bombPlayedToday ? 'Déjà joué' : 'Attaquer (1×/jour)'}
                                          </Button>
                                          <Button size="sm" variant="outline" className="w-full" onClick={() => openGame('BOMB', true)}>
                                            Entraînement
                                          </Button>
                                        </div>
                                      </div>
                                      {/* Naval */}
                                      <div className={cn('rounded-2xl border p-4 space-y-3', (gameStatus?.naval?.shotsRemaining ?? 0) > 0 ? 'border-sky-500/30 bg-sky-500/5' : 'border-border/40 bg-muted/10')}>
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-xl">🎯</span>
                                              <span className="font-medium text-sm">Guerre Navale</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">Bombardez la base ennemie sur une grille 6×6</p>
                                          </div>
                                          {gameStatus?.naval && (
                                            <Badge variant={(gameStatus.naval.shotsRemaining ?? 0) > 0 ? 'secondary' : 'outline'} className="text-[10px] shrink-0">
                                              {gameStatus.naval.shotsRemaining} tir(s)
                                            </Badge>
                                          )}
                                        </div>
                                        <Button size="sm" className="w-full" disabled={(gameStatus?.naval?.shotsRemaining ?? 0) <= 0} onClick={() => openGame('NAVAL', false)}>
                                          {(gameStatus?.naval?.shotsRemaining ?? 0) <= 0 ? 'Plus de tirs' : 'Ouvrir la carte'}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Own defenses */}
                                <div>
                                  <div className="mb-2 flex items-center gap-2">
                                    <span className="text-sm font-medium">🛡️ Défenses — {getWarOwnSide(selectedWar, selectedClan.id).name}</span>
                                    <span className="text-xs text-muted-foreground">(Jeu Mémoire pour améliorer)</span>
                                  </div>
                                  <div className="space-y-1.5">
                                    {getWarDefenseSet(selectedWar, selectedClan.id).map((defense) => (
                                      <UpgradeRow key={defense.type} defense={defense} />
                                    ))}
                                  </div>
                                </div>

                                {/* Enemy defenses */}
                                <div>
                                  <div className="mb-2 flex items-center gap-2">
                                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm font-medium">Défenses ennemies</span>
                                  </div>
                                  <div className="space-y-1.5">
                                    {getWarEnemyDefenseSet(selectedWar, selectedClan.id).map((defense) => (
                                      <UpgradeRow key={defense.type} defense={defense} />
                                    ))}
                                  </div>
                                </div>

                                {/* Rewards */}
                                <div className={mutedPanelClassName}>
                                  <div className="space-y-3 p-4">
                                    <h3 className="font-medium">Récompenses</h3>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <div className="rounded-2xl border border-border/50 bg-emerald-500/5 p-3 text-sm">
                                        <div className="font-medium">Victoire</div>
                                        <div className="mt-1 text-muted-foreground">+{selectedWar.rewardTable.winner.money} money, +{selectedWar.rewardTable.winner.aura} aura et {formatSignedValue(selectedWar.rewardTable.winner.trophies)} trophées pour le clan.</div>
                                      </div>
                                      <div className="rounded-2xl border border-border/50 bg-background p-3 text-sm">
                                        <div className="font-medium">Défaite / égalité</div>
                                        <div className="mt-1 text-muted-foreground">+{selectedWar.rewardTable.loser.money} money, +{selectedWar.rewardTable.loser.aura} aura et {formatSignedValue(selectedWar.rewardTable.loser.trophies)} trophées pour le clan.</div>
                                      </div>
                                    </div>
                                    {selectedWar.winnerClan ? (
                                      <Alert>
                                        <Sparkles className="h-4 w-4" />
                                        <AlertTitle>Vainqueur</AlertTitle>
                                        <AlertDescription>
                                          {selectedWar.winnerClan.name}
                                          {selectedWar.winnerUser ? ` • MVP: ${selectedWar.winnerUser.username}` : ''}
                                        </AlertDescription>
                                      </Alert>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <h3 className="text-sm font-medium">Participation des membres</h3>
                                  <p className="text-xs text-muted-foreground">
                                    Vérifie qui a déjà fait ses combats de guerre et son support défensif.
                                  </p>
                                </div>
                                <Badge variant="outline">{getWarOwnSide(selectedWar, selectedClan.id).name}</Badge>
                              </div>
                              {getWarParticipantStats(selectedWar, selectedClan.id).length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                                  Aucune participation enregistrée pour l’instant.
                                </div>
                              ) : (
                                <div className="space-y-2">
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
                          <AlertTriangle className="h-4 w-4" />
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

                      {/* War history */}
                      <Card className={panelClassName}>
                        <CardContent className="space-y-3 p-4">
                          <SectionTitle title="Historique des guerres" description="Conflits terminés." />
                          {selectedClan.warHub.history.length === 0 ? (
                            <div className="text-sm text-muted-foreground">Aucune guerre terminée pour ce clan.</div>
                          ) : (
                            selectedClan.warHub.history.map((war) => {
                              const opponent = getWarOpponent(war, selectedClan.id);
                              const isWin = war.winnerClan?.id === selectedClan.id;
                              const isDraw = !war.winnerClan;
                              return (
                                <div key={war.id} className="space-y-3 rounded-2xl border border-border/50 bg-muted/15 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-1">
                                      <div className="text-sm font-medium">Contre {opponent.name}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {formatDate(war.completedAt)} • Score final {war.attackerScore} - {war.defenderScore}
                                        {war.winnerUser ? ` • MVP: ${war.winnerUser.username}` : ''} • Trophées {formatSignedValue(selectedClan.id === war.attackerClan.id ? war.trophyChanges.attacker : war.trophyChanges.defender)}
                                      </div>
                                    </div>
                                    <Badge variant={isDraw ? 'outline' : isWin ? 'secondary' : 'destructive'}>
                                      {isDraw ? 'Égalité' : isWin ? 'Victoire' : 'Défaite'}
                                    </Badge>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Participation du clan
                                    </div>
                                    {getWarParticipantStats(war, selectedClan.id).length === 0 ? (
                                      <div className="text-sm text-muted-foreground">Aucune donnée de participation.</div>
                                    ) : (
                                      <div className="space-y-2">
                                        {getWarParticipantStats(war, selectedClan.id).map((member) => (
                                          <WarMemberRow key={`${war.id}:${member.user.id}`} member={member} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </CardContent>
                      </Card>

                      {/* Global war history */}
                      <Card className={panelClassName}>
                        <CardContent className="space-y-3 p-4">
                          <SectionTitle
                            title="Archives globales des guerres"
                            description="Toutes les guerres terminées de tous les clans."
                            action={<Badge variant="secondary">{globalWarHistory.length}</Badge>}
                          />
                          {globalWarHistory.length === 0 ? (
                            <div className="text-sm text-muted-foreground">Aucune guerre globale terminée pour le moment.</div>
                          ) : (
                            globalWarHistory.map((war) => {
                              const isDraw = !war.winnerClan;
                              return (
                                <div key={war.id} className="rounded-2xl border border-border/50 bg-muted/15 p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-1">
                                      <div className="text-sm font-medium">
                                        {war.attackerClan.name} <span className="text-muted-foreground">contre</span> {war.defenderClan.name}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Début: {formatDate(war.startsAt)} • Fin: {formatDate(war.completedAt)}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        Score final: {war.attackerScore} - {war.defenderScore}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Récompense victoire: +{war.rewardTable.winner.money} money, +{war.rewardTable.winner.aura} aura, {formatSignedValue(war.rewardTable.winner.trophies)} trophées •
                                        Récompense défaite/égalité: +{war.rewardTable.loser.money} money, +{war.rewardTable.loser.aura} aura, {formatSignedValue(war.rewardTable.loser.trophies)} trophées
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {war.winnerClan
                                          ? `Vainqueur: ${war.winnerClan.name}${war.winnerUser ? ` • MVP: ${war.winnerUser.username}` : ''}`
                                          : 'Résultat: égalité'}
                                      </div>
                                    </div>
                                    <Badge variant={isDraw ? 'outline' : 'secondary'}>
                                      {isDraw ? 'Égalité' : 'Terminée'}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                  <Dialog open={bankHistoryOpen} onOpenChange={setBankHistoryOpen}>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Historique de la banque</DialogTitle>
                        <DialogDescription>
                          {"Chaque dépôt effectué par un membre dans la banque du clan."}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                        {selectedClan.bankContributionHistory.length > 0 ? (
                          selectedClan.bankContributionHistory.map((entry) => (
                            <BankContributionRow key={entry.id} entry={entry} />
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/50 px-3 py-4 text-sm text-muted-foreground">
                            {"Aucun dépôt enregistré pour le moment."}
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>
        </div>
      </PageShell>

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

      <Dialog open={imageEditOpen} onOpenChange={setImageEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifier l'emblème du clan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ImagePicker
              value={editImageUrl}
              onChange={setEditImageUrl}
              uploadFn={uploadClanImageFile}
              disabled={savingImage}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setImageEditOpen(false)} disabled={savingImage}>Annuler</Button>
            <Button onClick={handleSaveImage} disabled={savingImage}>
              {savingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              La guerre démarre immédiatement. Seuls les clans disponibles avec l’écart de trophées le plus faible peuvent être ciblés.
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
    </>
  );
}

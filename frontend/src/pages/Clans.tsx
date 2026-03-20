import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Axe, Check, Crown, Loader2, LogOut, Plus, Send, Sparkles, Swords, Tag, Target, UserX, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClanChatMessage,
  ClanDetail,
  ClanSummary,
  ClanWarDefenseState,
  ClanWarGamesStatus,
  ClanWarState,
  clansApi,
  marketplaceApi,
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
import { ClanTag, ClanTagStyle, DEFAULT_CLAN_TAG_STYLE, parseClanTagStyle } from '@/components/clans/ClanTag';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { SPACING, TYPOGRAPHY } from '@/lib/design-system';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';

const panelClassName = 'rounded-2xl border border-border/50 bg-background shadow-none';
const mutedPanelClassName = 'rounded-2xl border border-border/50 bg-muted/15 shadow-none';

const formatAura = (value: number | string) => {
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(numericValue)) return '0';
  return numericValue.toLocaleString('fr-FR');
};

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

const getStatusLabel = (status: ClanWarState['status']) => {
  switch (status) {
    case 'PREPARING':
      return 'Préparation';
    case 'ACTIVE':
      return 'Active';
    case 'COMPLETED':
      return 'Terminée';
    default:
      return status;
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


const getAvatarFallback = (value: string) => value.trim().slice(0, 2);

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

const TAG_PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
  '#8b5cf6', '#d946ef', '#ec4899', '#ffffff', '#e5e7eb',
  '#a1a1aa', '#374151', '#1f2937', '#111827', '#000000',
];

export default function Clans() {
  const { user } = useAuth();
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

  // Tag editor state
  const [tagText, setTagText] = useState('');
  const [tagStyle, setTagStyle] = useState<ClanTagStyle>(DEFAULT_CLAN_TAG_STYLE);
  const [savingTag, setSavingTag] = useState(false);
  const [clanTagUserItemId, setClanTagUserItemId] = useState<string | null>(null);
  const [activatingTag, setActivatingTag] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'info' | 'guerre' | 'tag'>('info');

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

  const fetchGameStatus = useCallback(async (clanId: string) => {
    try {
      const res = await clansApi.getWarGamesStatus(clanId);
      setGameStatus(res.data);
    } catch {
      // Non-member or no war — silently ignore
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
    setTagText(selectedClan?.tagText ?? '');
    setTagStyle(parseClanTagStyle(selectedClan?.tagUnlocked ? selectedClan.tagStyle : null));
  }, [selectedClan?.id]);

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

  // Check if the leader has a clan tag unlock item in their inventory
  useEffect(() => {
    if (!user || !selectedClan?.viewer.isLeader || selectedClan.tagUnlocked) {
      setClanTagUserItemId(null);
      return;
    }
    marketplaceApi.getInventory(user.id).then((res) => {
      const items: { id: string; item: { effect?: string } }[] = res.data.items ?? [];
      const tagItem = items.find((ui) => {
        try { return JSON.parse(ui.item.effect ?? '{}').type === 'CLAN_TAG_UNLOCK'; } catch { return false; }
      });
      setClanTagUserItemId(tagItem?.id ?? null);
    }).catch(() => setClanTagUserItemId(null));
  }, [user, selectedClan?.id, selectedClan?.viewer.isLeader, selectedClan?.tagUnlocked]);


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
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = typeof reader.result === 'string' ? reader.result : '';
        const payload = raw.includes(',') ? raw.split(',')[1] : '';
        if (!payload) reject(new Error('Invalid file'));
        else resolve(payload);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await uploadUserImage({ base64Data, mimeType: file.type });
    return res.data.imageUrl;
  };

  const saveTag = async () => {
    if (!selectedClan) return;
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

  const activateTagFromInventory = async () => {
    const itemId = clanTagUserItemId;
    if (!itemId || !selectedClan) return;
    try {
      setActivatingTag(true);
      await marketplaceApi.useItem(itemId);
      // Directly mark as unlocked — no network round-trip needed
      setSelectedClan((prev) => prev ? { ...prev, tagUnlocked: true } : null);
      toast({ title: 'Tag de clan débloqué !', description: 'Personnalise-le maintenant.' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible d\'activer.', variant: 'destructive' });
    } finally {
      setActivatingTag(false);
    }
  };

  const fetchClans = async () => {
    try {
      setLoading(true);
      const res = await clansApi.list();
      setClans(res.data.clans ?? []);
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
      await fetchClanDetail(nextClanId);
    } else {
      setSelectedClan(null);
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
                              {war.attackerClan.name} <span className="text-muted-foreground">vs</span> {war.defenderClan.name}
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
                    clans.map((clan) => (
                      <button
                        key={clan.id}
                        type="button"
                        onClick={() => setSelectedClanId(clan.id)}
                        className={cn(
                          'w-full rounded-2xl border border-border/50 px-3 py-3 text-left transition-colors hover:bg-muted/30',
                          clan.id === selectedClanId && 'border-foreground/15 bg-muted/30'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11">
                            <AvatarImage src={resolveImageUrl(clan.imageUrl)} alt={clan.name} />
                            <AvatarFallback>{getAvatarFallback(clan.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{clan.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {clan.memberCount}/{clan.maxMembers} membres • {formatAura(clan.totalAura)} aura
                            </div>
                          </div>
                          {viewerClanId === clan.id ? <Badge>Mon clan</Badge> : null}
                        </div>
                      </button>
                    ))
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
                  {/* Compact clan header */}
                  <Card className={panelClassName}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12 shrink-0 rounded-xl border border-border/50 bg-muted/20">
                          <AvatarImage src={resolveImageUrl(selectedClan.imageUrl)} alt={selectedClan.name} />
                          <AvatarFallback className="rounded-xl text-base">{getAvatarFallback(selectedClan.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl font-semibold tracking-tight">{selectedClan.name}</h1>
                            <Badge variant={selectedClan.isPublic ? 'secondary' : 'outline'}>
                              {selectedClan.isPublic ? 'Ouvert' : 'Privé'}
                            </Badge>
                            {selectedClan.viewer.isLeader ? (
                              <Badge className="gap-1">
                                <Crown className="h-3 w-3" />
                                Chef
                              </Badge>
                            ) : null}
                          </div>
                          <p className="line-clamp-1 text-sm text-muted-foreground">
                            {selectedClan.description || 'Aucune description.'}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <UsernameDisplay username={selectedClan.leader.username} usernameColor={selectedClan.leader.usernameColor} />
                            <span>•</span>
                            <span>{selectedClan.memberCount}/{selectedClan.maxMembers} membres</span>
                            <span>•</span>
                            <span>{formatAura(selectedClan.totalAura)} aura</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {canJoinSelectedClan ? (
                            <Button size="sm" onClick={handleJoin} disabled={actionLoading || selectedClan.viewer.hasPendingRequest}>
                              {actionLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                              {selectedClan.viewer.hasPendingRequest ? 'En attente' : 'Rejoindre'}
                            </Button>
                          ) : null}
                          {selectedClan.viewer.isMember ? (
                            <Button size="sm" variant="outline" onClick={handleLeave} disabled={actionLoading}>
                              <LogOut className="mr-1.5 h-3.5 w-3.5" />
                              Quitter
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tabs: Infos / Tag / Guerre */}
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'info' | 'guerre' | 'tag')}>
                    <TabsList className="w-full">
                      <TabsTrigger value="info" className="flex-1">Infos</TabsTrigger>
                      {selectedClan.viewer.isLeader && (selectedClan.tagUnlocked || !!clanTagUserItemId) ? (
                        <TabsTrigger value="tag" className="flex-1">
                          <Tag className="mr-1.5 h-3.5 w-3.5" />
                          Tag
                          {!selectedClan.tagUnlocked && clanTagUserItemId ? (
                            <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                          ) : null}
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
                                  <div className="text-xs text-muted-foreground">{formatAura(member.aura)} aura</div>
                                </div>
                              </div>
                              {selectedClan.viewer.isLeader && !member.isLeader ? (
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member.userId)} disabled={actionLoading}>
                                  <UserX className="h-3.5 w-3.5" />
                                </Button>
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

                      {/* Chat (members only) */}
                      {selectedClan.viewer.isMember ? (
                        <Card className={panelClassName}>
                          <CardContent className="space-y-3 p-4">
                            <SectionTitle title="Chat du clan" />
                            <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-xl border border-border/50 bg-muted/15 p-3">
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
                      ) : null}

                    </TabsContent>

                    {/* ── Tag tab ── */}
                    <TabsContent value="tag" className="mt-4 space-y-4">
                      <Card className={panelClassName}>
                        <CardContent className="space-y-5 p-4">
                          {/* Toggle row */}
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">Tag de clan</p>
                              <p className="text-xs text-muted-foreground">
                                {selectedClan.tagUnlocked
                                  ? 'Débloqué — personnalise le tag ci-dessous.'
                                  : clanTagUserItemId
                                  ? 'Active pour utiliser ton item.'
                                  : 'Disponible dans la boutique.'}
                              </p>
                            </div>
                            {activatingTag ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <Switch
                                checked={selectedClan.tagUnlocked}
                                disabled={selectedClan.tagUnlocked || !clanTagUserItemId}
                                onCheckedChange={(checked) => { if (checked) void activateTagFromInventory(); }}
                              />
                            )}
                          </div>

                          <div className={cn('space-y-4', !selectedClan.tagUnlocked && 'pointer-events-none opacity-40')}>
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
                                  <Button key={type} size="sm" variant={tagStyle.backgroundType === type ? 'default' : 'outline'} onClick={() => setTagStyle((s) => ({ ...s, backgroundType: type }))}>
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
                                    <button key={c} onClick={() => setTagStyle((s) => ({ ...s, backgroundColor: c }))} className={cn('h-5 w-5 rounded-full border-2 transition-transform hover:scale-110', tagStyle.backgroundColor === c ? 'border-foreground scale-110' : 'border-transparent')} style={{ backgroundColor: c }} />
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
                                {TAG_PRESET_COLORS.map((c) => (<button key={c} onClick={() => setTagStyle((s) => ({ ...s, textColor: c }))} className={cn('h-5 w-5 rounded-full border-2 transition-transform hover:scale-110', tagStyle.textColor === c ? 'border-foreground scale-110' : 'border-transparent')} style={{ backgroundColor: c }} />))}
                                <input type="color" value={tagStyle.textColor} onChange={(e) => setTagStyle((s) => ({ ...s, textColor: e.target.value }))} className="h-5 w-5 cursor-pointer rounded border p-0" />
                              </div>
                            </div>
                            {/* Border color */}
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">Couleur de bordure</label>
                              <div className="flex flex-wrap gap-1.5">
                                {TAG_PRESET_COLORS.map((c) => (<button key={c} onClick={() => setTagStyle((s) => ({ ...s, borderColor: c }))} className={cn('h-5 w-5 rounded-full border-2 transition-transform hover:scale-110', tagStyle.borderColor === c ? 'border-foreground scale-110' : 'border-transparent')} style={{ backgroundColor: c }} />))}
                                <input type="color" value={tagStyle.borderColor} onChange={(e) => setTagStyle((s) => ({ ...s, borderColor: e.target.value }))} className="h-5 w-5 cursor-pointer rounded border p-0" />
                              </div>
                            </div>
                            {/* Save */}
                            <Button onClick={saveTag} disabled={savingTag || !tagText.trim()} size="sm" className="w-full">
                              {savingTag ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Sauvegarder
                            </Button>
                          </div>
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
                                  <div className="text-xs text-muted-foreground">Cooldown</div>
                                  <div className="text-sm">
                                    {selectedClan.warHub.cooldownEndsAt
                                      ? `Disponible dans ${formatCountdown(selectedClan.warHub.cooldownEndsAt)}`
                                      : 'Disponible'}
                                  </div>
                                </div>
                              </div>
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
                                  {selectedWar.attackerClan.name} vs {selectedWar.defenderClan.name}
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
                                        <div className="mt-1 text-muted-foreground">+{selectedWar.rewardTable.winner.money} money et +{selectedWar.rewardTable.winner.aura} aura par membre.</div>
                                      </div>
                                      <div className="rounded-2xl border border-border/50 bg-background p-3 text-sm">
                                        <div className="font-medium">Défaite / égalité</div>
                                        <div className="mt-1 text-muted-foreground">+{selectedWar.rewardTable.loser.money} money et +{selectedWar.rewardTable.loser.aura} aura par membre.</div>
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
                                : `Le clan doit atteindre ${selectedClan.warHub.minimumMembersRequired} membres pour entrer en guerre.`}
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
                                <div key={war.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border/50 bg-muted/15 p-4">
                                  <div className="min-w-0 space-y-1">
                                    <div className="text-sm font-medium">Contre {opponent.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {formatDate(war.completedAt)} • Score final {war.attackerScore} - {war.defenderScore}
                                      {war.winnerUser ? ` • MVP: ${war.winnerUser.username}` : ''}
                                    </div>
                                  </div>
                                  <Badge variant={isDraw ? 'outline' : isWin ? 'secondary' : 'destructive'}>
                                    {isDraw ? 'Égalité' : isWin ? 'Victoire' : 'Défaite'}
                                  </Badge>
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
                                        {war.attackerClan.name} <span className="text-muted-foreground">vs</span> {war.defenderClan.name}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Début: {formatDate(war.startsAt)} • Fin: {formatDate(war.completedAt)}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        Score final: {war.attackerScore} - {war.defenderScore}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Récompense victoire: +{war.rewardTable.winner.money} money, +{war.rewardTable.winner.aura} aura •
                                        Récompense défaite/égalité: +{war.rewardTable.loser.money} money, +{war.rewardTable.loser.aura} aura
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
                </>
              )}
            </div>
          </div>
        </div>
      </PageShell>

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

      <Dialog open={warDialogOpen} onOpenChange={setWarDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Déclarer une guerre</DialogTitle>
            <DialogDescription>
              La guerre démarre immédiatement. Choisis un adversaire disponible.
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
                Aucun adversaire disponible actuellement.
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

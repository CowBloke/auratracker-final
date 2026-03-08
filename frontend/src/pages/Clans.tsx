import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Axe, Check, Crown, Loader2, LogOut, Plus, Send, Shield, Sparkles, Swords, Target, UserX, X } from 'lucide-react';
import {
  ClanChatMessage,
  ClanDetail,
  ClanSummary,
  ClanWarActionType,
  ClanWarDefenseState,
  ClanWarState,
  clansApi,
  uploadUserImage,
} from '@/services/api';
import { PageShell } from '@/components/layout/page-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImagePicker } from '@/components/ui/image-picker';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';
import { useAuth } from '@/contexts/AuthContext';

const CLAN_WAR_TARGET_SCORE = 180;

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

const getAttackColor = (attackType: ClanWarActionType['type']) => {
  switch (attackType) {
    case 'RAID':
      return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    case 'SIEGE':
      return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
    case 'SABOTAGE':
      return 'bg-sky-500/10 text-sky-700 border-sky-500/20';
    default:
      return '';
  }
};

const DefenseCard = ({
  defense,
  canFortify,
  fortifying,
  onFortify,
}: {
  defense: ClanWarDefenseState;
  canFortify: boolean;
  fortifying: boolean;
  onFortify: () => void;
}) => (
  <Card className="border-muted/60">
    <CardContent className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{defense.label}</span>
            <Badge variant={defense.isActive ? 'secondary' : 'outline'}>Niv. {defense.level}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{defense.description}</p>
        </div>
        <Shield className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span>Durabilité</span>
          <span className="tabular-nums">
            {defense.durability}/{defense.maxDurability}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{
              width: defense.maxDurability > 0 ? `${(defense.durability / defense.maxDurability) * 100}%` : '0%',
            }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{defense.contributions} renfort(s)</span>
        {canFortify && (
          <Button size="sm" variant="outline" onClick={onFortify} disabled={fortifying}>
            {fortifying ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
            Fortifier
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
);

export default function Clans() {
  const { user } = useAuth();
  const [clans, setClans] = useState<ClanSummary[]>([]);
  const [activeWars, setActiveWars] = useState<ClanWarState[]>([]);
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
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [warDialogOpen, setWarDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void fetchClans();
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
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const selectedClanSummary = useMemo(
    () => clans.find((clan) => clan.id === selectedClanId) ?? null,
    [clans, selectedClanId]
  );

  const selectedWar = selectedClan?.warHub.currentWar ?? null;
  const isOwnClan = viewerClanId === selectedClan?.id;
  const canCreateClan = !viewerClanId;
  const canJoinSelectedClan = Boolean(selectedClan && !selectedClan.viewer.isMember && !viewerClanId);
  const canFortify = Boolean(selectedWar && isOwnClan && selectedClan?.viewer.isMember && selectedWar.viewerActions.fortificationsRemaining > 0);
  const canAttack = Boolean(selectedWar && isOwnClan && selectedClan?.viewer.isMember && selectedWar.status === 'ACTIVE' && selectedWar.viewerActions.staminaRemaining > 0);

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

  const fetchClanDetail = async (clanId: string) => {
    try {
      setDetailLoading(true);
      const res = await clansApi.getById(clanId);
      setSelectedClan(res.data.clan);
    } catch (error) {
      console.error('Failed to fetch clan detail:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger ce clan.',
        variant: 'destructive',
      });
    } finally {
      setDetailLoading(false);
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
      toast({ title: 'Guerre déclarée', description: 'La phase de préparation vient de démarrer.' });
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

  const handleFortify = async (defenseType: ClanWarDefenseState['type']) => {
    if (!selectedClan) return;
    setWarActionKey(`fortify:${defenseType}`);
    try {
      await clansApi.fortifyWar(selectedClan.id, defenseType);
      toast({ title: 'Défense renforcée', description: 'La structure a été améliorée.' });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to fortify war:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de fortifier cette structure.',
        variant: 'destructive',
      });
    } finally {
      setWarActionKey(null);
    }
  };

  const handleAttack = async (attackType: ClanWarActionType['type']) => {
    if (!selectedClan) return;
    setWarActionKey(`attack:${attackType}`);
    try {
      const res = await clansApi.attackWar(selectedClan.id, attackType);
      toast({
        title: res.data.completed ? 'Guerre terminée' : 'Attaque lancée',
        description: res.data.completed ? 'Le conflit est terminé, les récompenses ont été distribuées.' : 'Ton attaque a été enregistrée.',
      });
      await refreshData(selectedClan.id);
    } catch (error: any) {
      console.error('Failed to attack war:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de lancer cette attaque.',
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
        description: error.response?.data?.error || 'Impossible d’envoyer le message.',
        variant: 'destructive',
      });
    } finally {
      setChatSending(false);
    }
  };

  return (
    <>
      <PageShell>
        <div className={SPACING.PAGE_CONTENT}>
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-br from-amber-200/50 via-background to-rose-200/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Guerres en cours</p>
                      <h2 className="mt-1 text-xl font-semibold">Front global</h2>
                    </div>
                    <Badge variant="secondary">{activeWars.length}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Les clans s’affrontent en préparation puis en phase active. Le premier à {CLAN_WAR_TARGET_SCORE} points gagne.
                  </p>
                </div>
                <CardContent className="space-y-3 p-4">
                  {activeWars.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Aucune guerre active pour le moment.
                    </div>
                  ) : (
                    activeWars.map((war) => (
                      <button
                        key={war.id}
                        type="button"
                        onClick={() => setSelectedClanId(war.attackerClan.id)}
                        className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">
                            {war.attackerClan.name} <span className="text-muted-foreground">vs</span> {war.defenderClan.name}
                          </div>
                          <Badge variant={getStatusVariant(war.status)}>{getStatusLabel(war.status)}</Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                          <span>{war.attackerScore} - {war.defenderScore}</span>
                          <span>
                            {war.status === 'PREPARING'
                              ? `Départ dans ${formatCountdown(war.startsAt)}`
                              : `Fin dans ${formatCountdown(war.endsAt)}`}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="h-fit">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Clans</CardTitle>
                    <span className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground tabular-nums')}>{clans.length}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {canCreateClan && (
                    <Button type="button" onClick={() => setDialogOpen(true)} className="w-full justify-start">
                      <Plus className="mr-2 h-4 w-4" />
                      Créer un clan
                    </Button>
                  )}
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
                          'w-full rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/40',
                          clan.id === selectedClanId && 'border-primary/40 bg-muted/40'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11">
                            <AvatarImage src={resolveImageUrl(clan.imageUrl)} alt={clan.name} />
                            <AvatarFallback>{clan.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{clan.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {clan.memberCount}/{clan.maxMembers} membres • {formatAura(clan.totalAura)} aura
                            </div>
                          </div>
                          {viewerClanId === clan.id && <Badge>Mon clan</Badge>}
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {!selectedClanId || !selectedClanSummary ? (
                <Card>
                  <CardContent className="p-10 text-center text-muted-foreground">
                    Sélectionne un clan pour afficher son quartier général.
                  </CardContent>
                </Card>
              ) : detailLoading || !selectedClan ? (
                <Card>
                  <CardContent className="flex items-center justify-center p-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card className="overflow-hidden">
                    <div className="relative border-b bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.25),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(244,63,94,0.18),_transparent_40%)] p-6">
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-20 w-20 rounded-2xl border bg-background/80">
                            <AvatarImage src={resolveImageUrl(selectedClan.imageUrl)} alt={selectedClan.name} />
                            <AvatarFallback className="rounded-2xl text-xl">{selectedClan.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <h1 className="text-3xl font-semibold tracking-tight">{selectedClan.name}</h1>
                              <Badge variant={selectedClan.isPublic ? 'secondary' : 'outline'}>
                                {selectedClan.isPublic ? 'Ouvert' : 'Privé'}
                              </Badge>
                              {selectedClan.viewer.isLeader && <Badge className="gap-1"><Crown className="h-3.5 w-3.5" /> Chef</Badge>}
                            </div>
                            <p className="max-w-2xl text-sm text-muted-foreground">
                              {selectedClan.description || 'Aucune description pour le moment.'}
                            </p>
                            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                              <span>{selectedClan.memberCount}/{selectedClan.maxMembers} membres</span>
                              <span>•</span>
                              <span>{formatAura(selectedClan.totalAura)} aura cumulée</span>
                              <span>•</span>
                              <span>Créé le {formatDate(selectedClan.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {selectedClan.warHub.canDeclareWar && (
                            <Button onClick={() => setWarDialogOpen(true)}>
                              <Swords className="mr-2 h-4 w-4" />
                              Déclarer une guerre
                            </Button>
                          )}
                          {canJoinSelectedClan && (
                            <Button onClick={handleJoin} disabled={actionLoading || selectedClan.viewer.hasPendingRequest}>
                              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              {selectedClan.viewer.hasPendingRequest ? 'Demande en attente' : 'Rejoindre'}
                            </Button>
                          )}
                          {selectedClan.viewer.isMember && (
                            <Button variant="outline" onClick={handleLeave} disabled={actionLoading}>
                              <LogOut className="mr-2 h-4 w-4" />
                              Quitter
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <CardContent className="grid gap-4 p-6 md:grid-cols-3">
                      <div className="rounded-xl border bg-muted/30 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Chef</p>
                        <div className="mt-3 flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={resolveImageUrl(selectedClan.leader.profilePicture)} alt={selectedClan.leader.username} />
                            <AvatarFallback>{selectedClan.leader.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <UsernameDisplay username={selectedClan.leader.username} usernameColor={selectedClan.leader.usernameColor} />
                        </div>
                      </div>
                      <div className="rounded-xl border bg-muted/30 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Éligibilité guerre</p>
                        <div className="mt-3 text-sm">
                          {selectedClan.memberCount >= selectedClan.warHub.minimumMembersRequired
                            ? 'Le clan peut participer aux guerres.'
                            : `Il faut ${selectedClan.warHub.minimumMembersRequired} membres minimum.`}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-muted/30 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Cooldown</p>
                        <div className="mt-3 text-sm">
                          {selectedClan.warHub.cooldownEndsAt
                            ? `Disponible dans ${formatCountdown(selectedClan.warHub.cooldownEndsAt)}`
                            : 'Le clan peut repartir au combat.'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {selectedWar ? (
                    <Card className="overflow-hidden border-rose-500/20">
                      <div className="border-b bg-gradient-to-r from-rose-500/10 via-background to-amber-500/10 p-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant={getStatusVariant(selectedWar.status)}>{getStatusLabel(selectedWar.status)}</Badge>
                              <span className="text-sm text-muted-foreground">Objectif {selectedWar.targetScore} points</span>
                            </div>
                            <h2 className="mt-2 text-2xl font-semibold">
                              {selectedWar.attackerClan.name} vs {selectedWar.defenderClan.name}
                            </h2>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {selectedWar.status === 'PREPARING'
                                ? `La guerre démarre dans ${formatCountdown(selectedWar.startsAt)}.`
                                : selectedWar.status === 'ACTIVE'
                                  ? `Fin prévue dans ${formatCountdown(selectedWar.endsAt)}.`
                                  : `Terminée le ${formatDate(selectedWar.completedAt)}.`}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="rounded-xl border bg-background/70 px-4 py-3">
                              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{selectedWar.attackerClan.name}</div>
                              <div className="mt-1 text-3xl font-semibold tabular-nums">{selectedWar.attackerScore}</div>
                            </div>
                            <div className="rounded-xl border bg-background/70 px-4 py-3">
                              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{selectedWar.defenderClan.name}</div>
                              <div className="mt-1 text-3xl font-semibold tabular-nums">{selectedWar.defenderScore}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <CardContent className="space-y-6 p-6">
                        {isOwnClan && (
                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                            <div className="rounded-xl border p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="font-medium">Centre de commandement</h3>
                                  <p className="text-sm text-muted-foreground">
                                    {selectedWar.status === 'PREPARING'
                                      ? 'Utilise la phase de préparation pour monter tes structures.'
                                      : 'Coordonne les attaques et surveille la pression adverse.'}
                                  </p>
                                </div>
                                <Badge variant="secondary">{selectedWar.viewerSide === 'ATTACKER' ? 'Attaquant' : 'Défenseur'}</Badge>
                              </div>
                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <div className="rounded-lg border bg-muted/30 p-4">
                                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Endurance (24h)</div>
                                  <div className="mt-2 text-2xl font-semibold tabular-nums">
                                    {selectedWar.viewerActions.staminaRemaining}/{selectedWar.viewerActions.staminaCap}
                                  </div>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {selectedWar.viewerActions.staminaUsed} consommée(s) sur les dernières 24h.
                                  </p>
                                </div>
                                <div className="rounded-lg border bg-muted/30 p-4">
                                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Fortifications</div>
                                  <div className="mt-2 text-2xl font-semibold tabular-nums">
                                    {selectedWar.viewerActions.fortificationsRemaining}/{selectedWar.viewerActions.fortificationsCap}
                                  </div>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    Chaque membre peut renforcer deux fois par guerre.
                                  </p>
                                </div>
                              </div>
                              {selectedWar.status === 'ACTIVE' && (
                                <div className="mt-4 grid gap-3 md:grid-cols-3">
                                  {selectedClan.warHub.attackTypes.map((attack) => (
                                    <button
                                      key={attack.type}
                                      type="button"
                                      onClick={() => handleAttack(attack.type)}
                                      disabled={!canAttack || warActionKey === `attack:${attack.type}`}
                                      className={cn(
                                        'rounded-xl border px-4 py-4 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60',
                                        getAttackColor(attack.type)
                                      )}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">{attack.label}</span>
                                        <Badge variant="outline">-{attack.staminaCost} end.</Badge>
                                      </div>
                                      <p className="mt-2 text-sm text-muted-foreground">{attack.description}</p>
                                      <div className="mt-3 text-xs text-muted-foreground">
                                        {attack.minPoints}-{attack.maxPoints} pts • {attack.structureDamage} dégâts structure
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="rounded-xl border p-4">
                              <h3 className="font-medium">Récompenses</h3>
                              <div className="mt-4 space-y-3 text-sm">
                                <div className="rounded-lg border bg-emerald-500/5 p-3">
                                  <div className="font-medium">Victoire</div>
                                  <div className="mt-1 text-muted-foreground">
                                    +{selectedWar.rewardTable.winner.money} money et +{selectedWar.rewardTable.winner.aura} aura par membre.
                                  </div>
                                </div>
                                <div className="rounded-lg border bg-muted/30 p-3">
                                  <div className="font-medium">Défaite / égalité</div>
                                  <div className="mt-1 text-muted-foreground">
                                    +{selectedWar.rewardTable.loser.money} money et +{selectedWar.rewardTable.loser.aura} aura par membre.
                                  </div>
                                </div>
                                {selectedWar.winnerClan && (
                                  <Alert>
                                    <TrophyLike />
                                    <AlertTitle>Vainqueur</AlertTitle>
                                    <AlertDescription>
                                      {selectedWar.winnerClan.name}
                                      {selectedWar.winnerUser ? ` • MVP: ${selectedWar.winnerUser.username}` : ''}
                                    </AlertDescription>
                                  </Alert>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid gap-6 xl:grid-cols-2">
                          <div className="space-y-4">
                            <div>
                              <div className="mb-3 flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                <h3 className="font-medium">Défenses de {getWarOwnSide(selectedWar, selectedClan.id).name}</h3>
                              </div>
                              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                                {getWarDefenseSet(selectedWar, selectedClan.id).map((defense) => (
                                  <DefenseCard
                                    key={defense.type}
                                    defense={defense}
                                    canFortify={canFortify}
                                    fortifying={warActionKey === `fortify:${defense.type}`}
                                    onFortify={() => handleFortify(defense.type)}
                                  />
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="mb-3 flex items-center gap-2">
                                <Target className="h-4 w-4 text-muted-foreground" />
                                <h3 className="font-medium">Défenses ennemies</h3>
                              </div>
                              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                                {getWarEnemyDefenseSet(selectedWar, selectedClan.id).map((defense) => (
                                  <DefenseCard
                                    key={defense.type}
                                    defense={defense}
                                    canFortify={false}
                                    fortifying={false}
                                    onFortify={() => undefined}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <Card className="border-muted/60">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Journal des attaques</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {selectedWar.recentAttacks.length === 0 ? (
                                  <div className="text-sm text-muted-foreground">Aucune attaque enregistrée.</div>
                                ) : (
                                  selectedWar.recentAttacks.map((attack) => (
                                    <div key={attack.id} className="rounded-lg border p-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline">{attack.attackLabel}</Badge>
                                            <span className="text-sm font-medium">
                                              {attack.attackingClan.name} → {attack.targetClan.name}
                                            </span>
                                          </div>
                                          <div className="mt-2 text-sm text-muted-foreground">
                                            <UsernameDisplay username={attack.user.username} usernameColor={attack.user.usernameColor} /> a infligé{' '}
                                            <span className="font-medium text-foreground">{attack.finalPoints} pts</span>
                                            {attack.structureDamage > 0 ? ` et ${attack.structureDamage} dégâts structure.` : '.'}
                                          </div>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{formatDate(attack.createdAt)}</span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </CardContent>
                            </Card>

                            <Card className="border-muted/60">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Journal des fortifications</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {selectedWar.recentFortifications.length === 0 ? (
                                  <div className="text-sm text-muted-foreground">Aucun renfort pour l’instant.</div>
                                ) : (
                                  selectedWar.recentFortifications.map((entry) => (
                                    <div key={entry.id} className="rounded-lg border p-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="text-sm">
                                          <UsernameDisplay username={entry.user.username} usernameColor={entry.user.usernameColor} /> a renforcé{' '}
                                          <span className="font-medium">{entry.defenseLabel}</span>
                                          {entry.levelAdded > 0 ? ` (+${entry.levelAdded} niveau)` : ''}
                                          {entry.durabilityAdded > 0 ? `, +${entry.durabilityAdded} durabilité` : ''}.
                                        </div>
                                        <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Pas de guerre en cours</AlertTitle>
                      <AlertDescription>
                        {selectedClan.warHub.canDeclareWar
                          ? 'Le chef peut choisir un clan adverse et lancer une phase de préparation.'
                          : selectedClan.warHub.cooldownEndsAt
                            ? `Le clan récupère encore jusqu’au ${formatDate(selectedClan.warHub.cooldownEndsAt)}.`
                            : `Le clan doit atteindre ${selectedClan.warHub.minimumMembersRequired} membres pour entrer en guerre.`}
                      </AlertDescription>
                    </Alert>
                  )}

                  {selectedClan.viewer.isMember && (
                    <Card className="overflow-hidden">
                      <CardHeader className="border-b bg-muted/20 pb-4">
                        <CardTitle className="text-base">Chat du clan</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 p-4">
                        <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border bg-muted/15 p-3">
                          {chatLoading ? (
                            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Chargement des messages...
                            </div>
                          ) : chatMessages.length === 0 ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">
                              Aucun message pour le moment. Lance la conversation.
                            </div>
                          ) : (
                            chatMessages.map((entry) => {
                              const isOwnMessage = entry.user.id === user?.id;
                              return (
                                <div
                                  key={entry.id}
                                  className={cn('flex', isOwnMessage ? 'justify-end' : 'justify-start')}
                                >
                                  <div className={cn('max-w-[85%] rounded-2xl border px-4 py-3', isOwnMessage ? 'bg-primary/10 border-primary/20' : 'bg-background')}>
                                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
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
                          <div ref={chatBottomRef} />
                        </div>

                        <form onSubmit={handleSendChatMessage} className="space-y-3">
                          <Textarea
                            value={chatDraft}
                            onChange={(event) => setChatDraft(event.target.value.slice(0, 400))}
                            rows={3}
                            placeholder="Écris à ton clan..."
                            disabled={chatSending}
                          />
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-muted-foreground">{chatDraft.trim().length}/400</span>
                            <Button type="submit" disabled={chatSending || !chatDraft.trim()}>
                              {chatSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                              Envoyer
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Rosters</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedClan.members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={resolveImageUrl(member.profilePicture)} alt={member.username} />
                                <AvatarFallback>{member.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <UsernameDisplay username={member.username} usernameColor={member.usernameColor} />
                                  {member.isLeader && <Crown className="h-4 w-4 text-amber-500" />}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatAura(member.aura)} aura • rejoint le {formatDate(member.joinedAt)}
                                </div>
                              </div>
                            </div>
                            {selectedClan.viewer.isLeader && !member.isLeader && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMember(member.userId)}
                                disabled={actionLoading}
                              >
                                <UserX className="mr-2 h-4 w-4" />
                                Retirer
                              </Button>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <div className="space-y-6">
                      {selectedClan.viewer.isLeader && selectedClan.joinRequests.length > 0 && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Candidatures</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {selectedClan.joinRequests.map((request) => (
                              <div key={request.id} className="rounded-xl border p-3">
                                <div className="flex items-center gap-3">
                                  <Avatar>
                                    <AvatarImage src={resolveImageUrl(request.profilePicture)} alt={request.username} />
                                    <AvatarFallback>{request.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <UsernameDisplay username={request.username} usernameColor={request.usernameColor} />
                                    <div className="text-xs text-muted-foreground">
                                      {formatAura(request.aura)} aura • {formatDate(request.requestedAt)}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-3 flex gap-2">
                                  <Button size="sm" onClick={() => handleRequestAction(request.id, 'accept')} disabled={actionLoading}>
                                    <Check className="mr-2 h-4 w-4" />
                                    Accepter
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleRequestAction(request.id, 'reject')} disabled={actionLoading}>
                                    <X className="mr-2 h-4 w-4" />
                                    Refuser
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Historique des guerres</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {selectedClan.warHub.history.length === 0 ? (
                            <div className="text-sm text-muted-foreground">Aucune guerre terminée pour ce clan.</div>
                          ) : (
                            selectedClan.warHub.history.map((war) => {
                              const opponent = getWarOpponent(war, selectedClan.id);
                              const isWin = war.winnerClan?.id === selectedClan.id;
                              const isDraw = !war.winnerClan;
                              return (
                                <div key={war.id} className="rounded-xl border p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="font-medium">Contre {opponent.name}</div>
                                      <div className="text-xs text-muted-foreground">{formatDate(war.completedAt)}</div>
                                    </div>
                                    <Badge variant={isDraw ? 'outline' : isWin ? 'secondary' : 'destructive'}>
                                      {isDraw ? 'Égalité' : isWin ? 'Victoire' : 'Défaite'}
                                    </Badge>
                                  </div>
                                  <div className="mt-2 text-sm text-muted-foreground">
                                    Score final {war.attackerScore} - {war.defenderScore}
                                    {war.winnerUser ? ` • MVP: ${war.winnerUser.username}` : ''}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </PageShell>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Créer un clan</DialogTitle>
            <DialogDescription>Coût: 100 money. Le chef devient automatiquement le premier membre.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateClan} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
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
                placeholder="Décris l’identité, le style de jeu et l’objectif du clan."
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
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Créer le clan
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={warDialogOpen} onOpenChange={setWarDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Déclarer une guerre</DialogTitle>
            <DialogDescription>
              La guerre démarre par une préparation de 12h puis bascule en phase active. Choisis un adversaire disponible.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {selectedClan?.warHub.eligibleOpponents.length ? (
              selectedClan.warHub.eligibleOpponents.map((opponent) => (
                <div key={opponent.id} className="flex items-center justify-between rounded-xl border p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={resolveImageUrl(opponent.imageUrl)} alt={opponent.name} />
                      <AvatarFallback>{opponent.name.slice(0, 2).toUpperCase()}</AvatarFallback>
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
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aucun adversaire disponible actuellement.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TrophyLike() {
  return <Sparkles className="h-4 w-4" />;
}

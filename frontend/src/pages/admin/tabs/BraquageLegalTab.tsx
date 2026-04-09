import { useEffect, useMemo, useState } from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { toast } from '@/hooks/use-toast';
import { useSocketBase } from '@/contexts/SocketContext';
import { adminApi, type AdminUser, type BraquageLegalHistoryEntry, type BraquageLegalSession } from '@/services/api';
import { Clock3, Loader2, Plus, Sparkles, Ticket, Trophy, UserRoundPlus } from 'lucide-react';

const DEFAULT_DURATION = 24;

function formatCountdown(targetIso: string | null): string {
  if (!targetIso) return '--:--:--';
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return '00:00:00';
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

type Props = {
  users: AdminUser[];
};

export function BraquageLegalTab({ users }: Props) {
  const { socket } = useSocketBase();
  const [session, setSession] = useState<BraquageLegalSession | null>(null);
  const [history, setHistory] = useState<BraquageLegalHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [settingOwner, setSettingOwner] = useState(false);
  const [durationHours, setDurationHours] = useState(String(DEFAULT_DURATION));
  const [ownerSearch, setOwnerSearch] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [currentRes, historyRes] = await Promise.all([
        adminApi.getBraquageLegalCurrent(),
        adminApi.getBraquageLegalHistory(),
      ]);
      setSession(currentRes.data.session);
      setHistory(historyRes.data.sessions);
      setSelectedOwnerId(currentRes.data.session?.owner?.id ?? '');
    } catch {
      toast.error('Impossible de charger Loto.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadData();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleDrawn = () => {
      void loadData();
    };

    socket.on('braquage-legal:drawn', handleDrawn);
    return () => {
      socket.off('braquage-legal:drawn', handleDrawn);
    };
  }, [socket]);

  useEffect(() => {
    if (session?.owner?.id) {
      setSelectedOwnerId(session.owner.id);
    }
  }, [session?.owner?.id]);

  const filteredUsers = useMemo(() => {
    const term = ownerSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => user.username.toLowerCase().includes(term) || (user.firstName ?? '').toLowerCase().includes(term));
  }, [ownerSearch, users]);

  const ownerCandidate = filteredUsers.find((user) => user.id === selectedOwnerId) ?? users.find((user) => user.id === selectedOwnerId) ?? null;
  const countdown = formatCountdown(session?.endTime ?? null);

  const createSession = async () => {
    const parsed = Number(durationHours);
    if (!Number.isInteger(parsed) || parsed < 24 || parsed > 48) {
      toast.error('La durée doit être comprise entre 24 et 48 heures.');
      return;
    }

    setCreating(true);
    try {
      const response = await adminApi.adminCreateBraquageSession(parsed);
      setSession(response.data.session);
      setSelectedOwnerId(response.data.session.owner?.id ?? '');
      toast.success('Session Loto créée.');
    } catch (error) {
      toast.error((error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Impossible de créer la session.');
    } finally {
      setCreating(false);
    }
  };

  const drawSession = async () => {
    if (!session) return;
    setDrawing(true);
    try {
      const response = await adminApi.adminDrawBraquage(session.id);
      const result = response.data.result;
      if (result.cancelled) {
        toast.info('Le tirage a fermé la session sans participant.');
      } else {
        toast.success(`Tirage effectué: ${result.winner?.username ?? 'gagnant inconnu'}.`);
      }
      await loadData();
    } catch (error) {
      toast.error((error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Impossible d’effectuer le tirage.');
    } finally {
      setDrawing(false);
    }
  };

  const setOwner = async () => {
    if (!selectedOwnerId) {
      toast.error('Sélectionne un utilisateur.');
      return;
    }

    setSettingOwner(true);
    try {
      await adminApi.adminSetBraquageOwner(selectedOwnerId);
      toast.success('Propriétaire du Loto mis à jour.');
      await loadData();
    } catch (error) {
      toast.error((error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Impossible de définir le propriétaire.');
    } finally {
      setSettingOwner(false);
    }
  };

  const latestDraws = history.slice(0, 5);

  return (
    <TabsContent value="braquageLegal" className="space-y-4">
      <Card>
        <CardHeader>
          <CardDescription>Gestion du loto</CardDescription>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            Loto
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Session active
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{session ? countdown : 'Aucune'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{session ? (session.isExpired ? 'Session expirée' : 'Session en cours') : 'Aucune session ouverte'}</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Ticket className="h-4 w-4" />
              Jackpot
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{session?.totalPool.toLocaleString('fr-FR') ?? '0'} €</p>
            <p className="mt-1 text-sm text-muted-foreground">{session?.participationsCount ?? 0} participations, {session?.ticketPool ?? 0} tickets</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4" />
              Propriétaire
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={session?.owner?.profilePicture ? resolveImageUrl(session.owner.profilePicture) : undefined} alt={session?.owner?.username ?? 'Propriétaire'} />
                <AvatarFallback>{session?.owner?.username?.slice(0, 1)?.toUpperCase() ?? '?'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{session?.owner?.username ?? 'Aucun propriétaire'}</p>
                <p className="text-sm text-muted-foreground">Désignation unique en vigueur</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardDescription>Lancer une session</CardDescription>
            <CardTitle>Créer une nouvelle loterie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                type="number"
                min={24}
                max={48}
                step={1}
                value={durationHours}
                onChange={(event) => setDurationHours(event.target.value)}
                className="sm:max-w-40"
              />
              <Button onClick={createSession} disabled={creating || refreshing || Boolean(session && !session.isExpired)}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Plus className="mr-2 h-4 w-4" />
                Lancer une session
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Durée autorisée entre 24 et 48 heures.</p>
            <div className="rounded-xl border border-border/50 bg-background/60 p-4 text-sm text-muted-foreground">
              Si une session active existe déjà, la création est bloquée.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Effectuer le tirage</CardDescription>
            <CardTitle>Tirage manuel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Le tirage ne doit être lancé que lorsque la session active est expirée.</p>
            <Button onClick={drawSession} disabled={!session || !session.isExpired || drawing} variant="outline" className="w-full">
              {drawing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Effectuer le tirage
            </Button>
            <div className="rounded-xl border border-border/50 bg-background/60 p-4 text-sm text-muted-foreground">
              Gère aussi la clôture automatique des sessions expirées via le cron serveur.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>Désigner le propriétaire</CardDescription>
          <CardTitle className="flex items-center gap-2">
            <UserRoundPlus className="h-5 w-5 text-muted-foreground" />
            Un seul propriétaire à la fois
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={ownerSearch}
            onChange={(event) => setOwnerSearch(event.target.value)}
            placeholder="Rechercher un utilisateur..."
          />
          <ScrollArea className="h-64 rounded-2xl border border-border/50 bg-background/60 p-2">
            <div className="space-y-2 pr-2">
              {filteredUsers.map((user) => {
                const isSelected = user.id === selectedOwnerId;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedOwnerId(user.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                      isSelected ? 'border-primary bg-primary/10' : 'border-border/50 bg-background/60 hover:bg-muted/60'
                    )}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.profilePicture ? resolveImageUrl(user.profilePicture) : undefined} alt={user.username} />
                      <AvatarFallback>{user.username.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{user.username}</p>
                        {user.isBraquageLegalOwner && <Badge variant="secondary">Actuel</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{user.firstName ?? 'Sans prénom'}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Sélection actuelle: <span className="font-medium text-foreground">{ownerCandidate?.username ?? 'Aucun'}</span>
            </p>
            <Button onClick={setOwner} disabled={!selectedOwnerId || settingOwner}>
              {settingOwner && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Désigner le propriétaire
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Historique récent</CardDescription>
          <CardTitle>Derniers tirages</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : latestDraws.length ? (
            <div className="space-y-3">
              {latestDraws.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-background/60 px-4 py-3">
                  <div>
                    <p className="font-medium">{entry.winner?.username ?? 'Session annulée'}</p>
                    <p className="text-sm text-muted-foreground">{new Date(entry.endTime).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold tabular-nums text-amber-200">{entry.winnerPayout?.toLocaleString('fr-FR') ?? 0} €</p>
                    <p className="text-muted-foreground">{entry.totalPool.toLocaleString('fr-FR')} € pool</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun tirage encore enregistré.</p>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
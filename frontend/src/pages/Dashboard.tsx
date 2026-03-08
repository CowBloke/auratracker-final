import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CheckCircle2, DollarSign, Gift as GiftIcon, Star, Users, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import {
  Gift,
  GiftStatus,
  UserDailyQuest,
  auraCoinApi,
  giftsApi,
  questsApi,
} from '../services/api';
import GiftDialog from '@/components/gifts/GiftDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';

interface GameShortcut {
  id: string;
  label: string;
  path: string;
}

const shortcuts: GameShortcut[] = [
  { id: 'bomb-party', label: 'Bomb Party', path: '/games/bomb-party' },
  { id: 'poker', label: 'Poker', path: '/games/poker' },
  { id: '2048', label: '2048', path: '/games/2048' },
  { id: 'solitaire', label: 'Solitaire', path: '/games/solitaire' },
];

function DashboardSectionTitle({
  title,
  icon: Icon,
}: {
  title: string;
  icon: React.FC<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <CardTitle className={TYPOGRAPHY.H4}>{title}</CardTitle>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const {
    socket,
    fetchPublicParties,
    publicParties,
    currentParty,
    joinParty,
    requestJoinParty,
    pendingJoinRequests,
  } = useSocket();

  const [loading, setLoading] = useState(true);
  const [giftsLoading, setGiftsLoading] = useState(true);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [giftDialogInitialTab, setGiftDialogInitialTab] = useState<'inbox' | 'send' | 'received'>('inbox');
  const [inboxGifts, setInboxGifts] = useState<Gift[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<Gift[]>([]);
  const [giftStatus, setGiftStatus] = useState<GiftStatus | null>(null);
  const [questWidgets, setQuestWidgets] = useState<UserDailyQuest[]>([]);
  const [auraCoinPrice, setAuraCoinPrice] = useState<number | null>(null);

  const fetchGiftOverview = async () => {
    setGiftsLoading(true);
    try {
      const [inboxRes, receivedRes, statusRes] = await Promise.allSettled([
        giftsApi.getInbox(),
        giftsApi.getReceived(),
        giftsApi.getStatus(),
      ]);

      if (inboxRes.status === 'fulfilled') {
        setInboxGifts(inboxRes.value.data.gifts);
      }

      if (receivedRes.status === 'fulfilled') {
        setReceivedGifts(receivedRes.value.data.gifts);
      }

      if (statusRes.status === 'fulfilled') {
        setGiftStatus(statusRes.value.data);
      }
    } catch (error) {
      console.error('Failed to fetch gifts overview:', error);
    } finally {
      setGiftsLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [giftInboxRes, giftReceivedRes, giftStatusRes, auraCoinRes, questsRes] = await Promise.allSettled([
          giftsApi.getInbox(),
          giftsApi.getReceived(),
          giftsApi.getStatus(),
          auraCoinApi.getPrice(1),
          questsApi.getMyQuests(),
        ]);

        if (giftInboxRes.status === 'fulfilled') {
          setInboxGifts(giftInboxRes.value.data.gifts);
        }

        if (giftReceivedRes.status === 'fulfilled') {
          setReceivedGifts(giftReceivedRes.value.data.gifts);
        }

        if (giftStatusRes.status === 'fulfilled') {
          setGiftStatus(giftStatusRes.value.data);
        }

        if (auraCoinRes.status === 'fulfilled') {
          setAuraCoinPrice(auraCoinRes.value.data.currentPrice);
        }

        if (questsRes.status === 'fulfilled') {
          setQuestWidgets(questsRes.value.data.userQuests || []);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
        setGiftsLoading(false);
      }
    };

    fetchData();
    fetchPublicParties();
  }, [fetchPublicParties]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchPublicParties();
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchPublicParties]);

  useEffect(() => {
    if (!socket) return;

    const handleGiftReceived = () => {
      fetchGiftOverview();
    };

    const handleAuraCoinPriceUpdate = (data: { price: number }) => {
      setAuraCoinPrice(data.price);
    };

    socket.on('gift:received', handleGiftReceived);
    socket.on('auracoin:price-update', handleAuraCoinPriceUpdate);

    return () => {
      socket.off('gift:received', handleGiftReceived);
      socket.off('auracoin:price-update', handleAuraCoinPriceUpdate);
    };
  }, [socket]);

  const completedQuestCount = useMemo(
    () => questWidgets.filter((quest) => quest.isCompleted && !quest.isClaimed).length,
    [questWidgets]
  );

  const openGiftDialog = (tab: 'inbox' | 'send' | 'received') => {
    setGiftDialogInitialTab(tab);
    setGiftDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-foreground animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-6 lg:px-6 lg:pb-8">
        <section className="rounded-2xl border bg-card px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p
                className={cn(TYPOGRAPHY.H2, 'text-foreground')}
                style={user?.usernameColor ? { color: user.usernameColor } : undefined}
              >
                Bonjour {user?.username ?? ''}
              </p>
              <p className="text-sm text-muted-foreground">L’essentiel de ton activité, sans éléments secondaires.</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/games">Voir les jeux</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Card className="border-border/60">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground">Aura</p>
                <p className="text-2xl font-semibold tabular-nums">{user?.aura.toLocaleString('fr-FR') ?? 0}</p>
              </div>
              <Zap className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground">Argent</p>
                <p className="text-2xl font-semibold tabular-nums">${user?.money.toLocaleString('fr-FR') ?? 0}</p>
              </div>
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground">Aura Coin</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {auraCoinPrice === null ? '--' : `$${auraCoinPrice.toFixed(2)}`}
                </p>
              </div>
              <Star className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <DashboardSectionTitle title="Parties en cours" icon={Users} />
            </CardHeader>
            <CardContent className="space-y-3">
              {publicParties.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune party active.</p>
              ) : (
                publicParties.slice(0, 5).map((party) => {
                  const isFull = party.memberCount >= party.maxSize;
                  const isPending = pendingJoinRequests.includes(party.id);
                  const isCurrentParty = currentParty?.id === party.id;

                  return (
                    <div key={party.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{party.name || 'Party sans nom'}</p>
                        <p className="text-xs text-muted-foreground">
                          {party.selectedGame?.gameName || 'Pas de jeu'} · {party.memberCount}/{party.maxSize}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          if (party.isPublic) {
                            joinParty(party.id);
                            return;
                          }
                          requestJoinParty(party.id);
                        }}
                        disabled={isFull || isPending || isCurrentParty}
                      >
                        {isCurrentParty ? 'Déjà dedans' : isFull ? 'Pleine' : isPending ? 'En attente' : 'Rejoindre'}
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <DashboardSectionTitle title="Quêtes" icon={CheckCircle2} />
                {completedQuestCount > 0 ? <Badge>{completedQuestCount}</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {questWidgets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune quête active.</p>
              ) : (
                questWidgets.slice(0, 3).map((quest) => {
                  const progress = quest.progress?.currentValue || 0;
                  const target = quest.quest.targetValue;

                  return (
                    <div key={quest.id} className="space-y-2 rounded-lg border border-border/60 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-medium">{quest.quest.title}</p>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {progress}/{target}
                        </span>
                      </div>
                      <Progress value={Math.min((progress / target) * 100, 100)} className="h-1.5" />
                    </div>
                  );
                })
              )}
              <Button asChild variant="outline" className="w-full">
                <Link to="/quests">Voir les quêtes</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <DashboardSectionTitle title="Cadeaux" icon={GiftIcon} />
                {inboxGifts.length > 0 ? <Badge>{inboxGifts.length}</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/60 px-3 py-3">
                  <p className="text-sm text-muted-foreground">En attente</p>
                  <p className="text-2xl font-semibold tabular-nums">{inboxGifts.length}</p>
                </div>
                <div className="rounded-lg border border-border/60 px-3 py-3">
                  <p className="text-sm text-muted-foreground">Ouverts</p>
                  <p className="text-2xl font-semibold tabular-nums">{receivedGifts.length}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 px-3 py-3">
                <p className="text-sm text-muted-foreground">Aura cadeau disponible</p>
                <p className="text-lg font-semibold tabular-nums">
                  {giftStatus?.remainingAura ?? 0}/{giftStatus?.limit ?? 50}
                </p>
              </div>

              {giftsLoading ? <p className="text-sm text-muted-foreground">Chargement...</p> : null}

              <div className="flex gap-2">
                <Button className="flex-1" variant="outline" onClick={() => openGiftDialog('inbox')}>
                  Ouvrir
                </Button>
                <Button className="flex-1" onClick={() => openGiftDialog('send')}>
                  Envoyer
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <DashboardSectionTitle title="Accès rapide" icon={BarChart3} />
                <Button asChild variant="ghost" size="sm">
                  <Link to="/games">Tout voir</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {shortcuts.map((shortcut) => (
                  <Link
                    key={shortcut.id}
                    to={shortcut.path}
                    className="rounded-lg border border-border/60 px-3 py-6 text-center text-sm font-medium transition hover:bg-accent/40"
                  >
                    {shortcut.label}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <GiftDialog
        open={giftDialogOpen}
        onOpenChange={(open) => {
          setGiftDialogOpen(open);
          if (!open) {
            fetchGiftOverview();
          }
        }}
        onGiftOpened={fetchGiftOverview}
        initialTab={giftDialogInitialTab}
      />
    </>
  );
}

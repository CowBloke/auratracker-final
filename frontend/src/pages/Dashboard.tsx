import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { leaderboardsApi, economyApi } from '../services/api';
import { ArrowRight, Loader2, Clock, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import GiftDialog from '@/components/gifts/GiftDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PageLayout from '@/components/layout/PageLayout';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { getPageMeta } from '@/components/chat/presence';

interface Transfer {
  id: string;
  senderId: string;
  receiverId: string;
  auraAmount: number;
  moneyAmount: number;
  isGift?: boolean;
  message?: string | null;
  createdAt: string;
  sender: { id: string; username: string; usernameColor?: string | null };
  receiver: { id: string; username: string; usernameColor?: string | null };
}

interface DailyAllowance {
  dailyLimit: number;
  used: number;
  remaining: number;
  lastReset: string;
  nextReset: string;
}

interface GameShortcut {
  id: string;
  label: string;
  path: string;
  description: string;
  image?: string;
}

const shortcutStorageKey = 'auratracker:dashboard-shortcuts';

const welcomeTemplates = [
  'Bienvenue, {username}',
  'Heureux de te revoir {username}, prÃªt pour AuraTracker ?',
  'Salut {username} ! On lance une partie ?',
  'Yo {username}, le crew tâ€™attend.',
  'Hey {username}, tu reviens charger lâ€™aura ?',
  '{username}, Ã§a faisait longtemps !',
  'Content de te revoir {username} !',
  'Re {username} â€” place au fun.',
  'PrÃªt Ã  tout Ã©clater, {username} ?',
  'Bon retour {username}, Ã§a va chauffer.',
  '{username}, on remet Ã§a ?',
  'Bienvenue Ã  bord, {username}.',
  'Hello {username}, Ã§a part en jeux ?',
  '{username}, le tableau de bord est prÃªt.',
  'Heureux de te revoir {username} !',
  'Bon retour {username}, ready ?',
];

const pickWelcomeMessage = (username?: string) => {
  const name = username || 'toi';
  const template = welcomeTemplates[Math.floor(Math.random() * welcomeTemplates.length)];
  return template.replace('{username}', name);
};

const gameShortcuts: GameShortcut[] = [
  { id: 'bomb-party', label: 'Bomb Party', path: '/games/bomb-party', description: 'Mots explosifs en ??quipe.', image: '/images/games/bombparty.png' },
  { id: 'poker', label: 'Poker', path: '/games/poker', description: 'Table rapide, mise prudente.', image: '/images/games/poker.png' },
  { id: 'petit-bac', label: 'Petit Bac', path: '/games/petit-bac', description: 'Cat??gories, lettres, vitesse.', image: '/images/games/petitbac.png' },
  { id: 'clash', label: 'Clash', path: '/games/clash', description: 'Duel strat??gique instantan??.', image: '/images/games/clash.png' },
  { id: 'casino', label: 'Casino', path: '/games/casino', description: 'Mini-jeux et mises rapides.', image: '/images/games/casino.png' },
  { id: 'market', label: 'March??', path: '/games/market', description: 'Salle de march?? en direct.', image: '/images/games/market.png' },
  { id: 'aura-coin', label: 'Aura Coin', path: '/games/aura-coin', description: 'Suivi des coins aura.', image: '/images/games/auracoin.png' },
  { id: 'polymarket', label: 'Polymarket', path: '/games/polymarket', description: 'Paris en temps r??el.' },
  { id: 'doodle-jump', label: 'Doodle Jump', path: '/games/doodle-jump', description: 'Grimpe sans fin.', image: '/images/games/doodlejump.png' },
  { id: '2048', label: '2048', path: '/games/2048', description: "Fusionne jusqu'?? 2048.", image: '/images/games/2048.png' },
  { id: 'flappy-bird', label: 'Flappy Bird', path: '/games/flappy-bird', description: 'Timing parfait.', image: '/images/games/flappybird.png' },
  { id: 'bataille-navale', label: 'Bataille Navale', path: '/games/bataille-navale', description: 'Touches, coul??s, gagne.', image: '/images/games/bataillenavale.png' },
  { id: 'solitaire', label: 'Solitaire', path: '/games/solitaire', description: 'Classique et relax.', image: '/images/games/solitaire.png' },
  { id: 'racer', label: 'Racer', path: '/games/racer', description: 'Course pseudo-3D style Outrun.', image: '/images/games/racer.png' },
  { id: 'tetris', label: 'Tetris', path: '/games/tetris', description: 'Puzzle classique et addictif.', image: '/images/games/tetris.png' },
];

const defaultShortcuts = ['doodle-jump', 'flappy-bird', 'bomb-party', '2048'];

export default function Dashboard() {
  const { user } = useAuth();
  const {
    fetchPublicParties,
    requestOnlineUsers,
    onlineUsers,
    publicParties,
    currentParty,
    joinParty,
    requestJoinParty,
    pendingJoinRequests,
  } = useSocket();
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [dailyAllowance, setDailyAllowance] = useState<DailyAllowance | null>(null);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  
  const [historyOpen, setHistoryOpen] = useState(false);
  const [allTransfers, setAllTransfers] = useState<Transfer[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [now, setNow] = useState(new Date());
  const [welcomeMessage, setWelcomeMessage] = useState(() => pickWelcomeMessage(user?.username));
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shortcutsLoaded, setShortcutsLoaded] = useState(false);
  const [shortcutWidgets, setShortcutWidgets] = useState<string[]>(defaultShortcuts);

  const shortcutMap = useMemo(() => new Map(gameShortcuts.map((item) => [item.id, item])), []);
  const orderedShortcuts = useMemo(
    () => shortcutWidgets.map((id) => shortcutMap.get(id)).filter(Boolean) as GameShortcut[],
    [shortcutMap, shortcutWidgets]
  );
  const onlinePlayersByGame = useMemo(
    () =>
      onlineUsers
        .filter((onlineUser) => onlineUser.currentPage?.startsWith('/games'))
        .sort((a, b) => a.username.localeCompare(b.username)),
    [onlineUsers]
  );
  const onlinePlayersElsewhere = useMemo(
    () =>
      onlineUsers
        .filter((onlineUser) => !onlineUser.currentPage?.startsWith('/games'))
        .sort((a, b) => a.username.localeCompare(b.username)),
    [onlineUsers]
  );

  // Update time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user?.username) return;
    setWelcomeMessage(pickWelcomeMessage(user.username));
  }, [user?.username]);

  // Calculate countdown to next reset
  const resetCountdown = useMemo(() => {
    if (!dailyAllowance?.nextReset) return null;
    
    const nextReset = new Date(dailyAllowance.nextReset);
    const diff = nextReset.getTime() - now.getTime();
    
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0 };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return { hours, minutes, seconds, total: diff };
  }, [dailyAllowance?.nextReset, now]);

  // Refresh daily allowance when countdown reaches 0
  useEffect(() => {
    if (resetCountdown && resetCountdown.total <= 0 && dailyAllowance?.remaining === 0) {
      fetchDailyAllowance();
    }
  }, [resetCountdown?.total, dailyAllowance?.remaining]);

  const fetchDailyAllowance = async () => {
    try {
      const res = await economyApi.getDailyAllowance();
      setDailyAllowance(res.data);
    } catch (error) {
      console.error('Failed to fetch daily allowance:', error);
    }
  };

  const fetchAllHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await economyApi.getTransfers({ limit: 50, all: true });
      setAllTransfers(res.data.transfers);
      setHasMoreHistory(res.data.transfers.length >= 50);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadMoreHistory = async () => {
    if (historyLoading || !hasMoreHistory) return;
    setHistoryLoading(true);
    try {
      const res = await economyApi.getTransfers({ limit: 50, offset: allTransfers.length, all: true });
      const newTransfers = res.data.transfers;
      setAllTransfers(prev => [...prev, ...newTransfers]);
      setHasMoreHistory(newTransfers.length >= 50);
    } catch (error) {
      console.error('Failed to load more history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rankingsRes, transfersRes, allowanceRes] = await Promise.all([
          leaderboardsApi.get('aura', { limit: 5 }),
          economyApi.getTransfers({ limit: 5, all: true }),
          economyApi.getDailyAllowance(),
        ]);

        setUserRank(rankingsRes.data.userRank);
        setRecentTransfers(transfersRes.data.transfers);
        setDailyAllowance(allowanceRes.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    fetchPublicParties();
    requestOnlineUsers();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchPublicParties();
      requestOnlineUsers();
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchPublicParties, requestOnlineUsers]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(shortcutStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((id: string) => shortcutMap.has(id));
          if (filtered.length > 0) {
            setShortcutWidgets(filtered);
          }
        }
      }
    } catch {
      // Ignore localStorage parse failures.
    } finally {
      setShortcutsLoaded(true);
    }
  }, [shortcutMap]);

  useEffect(() => {
    if (!shortcutsLoaded) return;
    try {
      localStorage.setItem(shortcutStorageKey, JSON.stringify(shortcutWidgets));
    } catch {
      // Ignore localStorage write failures.
    }
  }, [shortcutsLoaded, shortcutWidgets]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}j`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'maint.';
  };

  if (loading) {
    return (
      <PageLayout variant="compact">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout variant="compact" className="space-y-8">
      {/* Stats */}
      <Card className="border-border/40">
        <CardContent className="p-8 md:p-10">
          <div className={cn("space-y-2 text-center", SPACING.TIGHT_SPACING)}>
            <p
              className={cn(TYPOGRAPHY.H1, "md:text-5xl")}
              style={user?.usernameColor ? { color: user.usernameColor } : undefined}
            >
              {welcomeMessage || `Bienvenue, ${user?.username ?? ''}`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Shortcuts */}
      <Card className="border-border/40">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardDescription>Widgets</CardDescription>
              <CardTitle className={TYPOGRAPHY.H3}>Raccourcis jeux</CardTitle>
            </div>
          <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
            <Button variant="outline" onClick={() => setShortcutsOpen(true)}>
              GÃ©rer les widgets
            </Button>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className={TYPOGRAPHY.H5}>Widgets de raccourcis</DialogTitle>
                <DialogDescription>
                  Active les jeux Ã  afficher en haut du tableau de bord.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {gameShortcuts.map((shortcut) => {
                  const checked = shortcutWidgets.includes(shortcut.id);
                  return (
                    <label
                      key={shortcut.id}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border px-3 py-3 transition",
                        checked ? "border-foreground/30 bg-muted/40" : "border-border/50"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => {
                          setShortcutWidgets((prev) =>
                            prev.includes(shortcut.id)
                              ? prev.filter((id) => id !== shortcut.id)
                              : [...prev, shortcut.id]
                          );
                        }}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <p className="font-medium">{shortcut.label}</p>
                        <p className="text-sm text-muted-foreground">{shortcut.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="ghost"
                  onClick={() => setShortcutWidgets(defaultShortcuts)}
                >
                  RÃ©initialiser
                </Button>
                <Button onClick={() => setShortcutsOpen(false)}>Terminer</Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className={SPACING.SECTION_SPACING}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {orderedShortcuts.length > 0 ? (
            orderedShortcuts.map((shortcut) => (
                <Link
                key={shortcut.id}
                to={shortcut.path}
                className={cn(
                  "group relative overflow-hidden rounded-lg border border-border/40 p-4 transition hover:border-foreground/30 shadow-sm",
                  shortcut.image ? "text-white" : "bg-card hover:bg-accent/50"
                )}
              >
                {shortcut.image && (
                  <>
                    <img
                      src={shortcut.image}
                      alt={shortcut.label}
                      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
                  </>
                )}
                <div className="relative z-10 flex h-full flex-col justify-end gap-1">
                  <h3 className={TYPOGRAPHY.H5}>{shortcut.label}</h3>
                </div>
              </Link>
            ))
          ) : (
            <Card className="col-span-full border-dashed border-border/60">
              <CardContent className="p-6 text-center">
                <p className={TYPOGRAPHY.SMALL}>Aucun widget actif. Ajoute des jeux pour un accÃ¨s rapide.</p>
              </CardContent>
            </Card>
          )}
          </div>
        </CardContent>
      </Card>

      {/* Primary Stats */}
      <Card className="border-border/40">
        <CardContent className="p-6 md:p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-2">
                <p className={cn(TYPOGRAPHY.H2, "tabular-nums")}>
                  {user?.aura.toLocaleString()}
                </p>
                <p className={TYPOGRAPHY.SMALL}>aura</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-2">
                <p className={cn(TYPOGRAPHY.H2, "tabular-nums")}>
                  ${user?.money.toLocaleString()}
                </p>
                <p className={TYPOGRAPHY.SMALL}>argent</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-2">
                <p className={cn(TYPOGRAPHY.H2, "tabular-nums")}>
                  #{userRank || '-'}
                </p>
                <p className={TYPOGRAPHY.SMALL}>rang</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-2">
                <p className={cn(TYPOGRAPHY.H2, "tabular-nums")}>
                  {dailyAllowance?.remaining || 0}
                </p>
                <p className={TYPOGRAPHY.SMALL}>dons restants</p>
                {resetCountdown && resetCountdown.total > 0 && (
                  <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground/70 flex items-center gap-1")}>
                    <Clock className="h-3 w-3" />
                    <span className="tabular-nums">
                      {String(resetCountdown.hours).padStart(2, '0')}:
                      {String(resetCountdown.minutes).padStart(2, '0')}:
                      {String(resetCountdown.seconds).padStart(2, '0')}
                    </span>
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>


      {/* Gift Section */}
      <Card className="border-border/40">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardDescription>Envoyer un cadeau</CardDescription>
              <CardTitle className={TYPOGRAPHY.H5}>
                Offre de l'aura, de l'argent ou des articles Ã  un joueur.
              </CardTitle>
            </div>
            <Button
              onClick={() => setGiftDialogOpen(true)}
              className="h-12 px-6 text-base"
            >
              <Gift className="h-4 w-4 mr-2" />
              Envoyer un cadeau
            </Button>
          </div>
        </CardHeader>
      </Card>
      <GiftDialog
        open={giftDialogOpen}
        onOpenChange={setGiftDialogOpen}
        onGiftOpened={() => {}}
        initialTab="send"
      />


      {/* Recent Activity + Activity Sidebar */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className={SPACING.SECTION_SPACING}>
          <div className="flex items-center justify-between">
            <h2 className={TYPOGRAPHY.MUTED}>Activité récente</h2>
            <Sheet open={historyOpen} onOpenChange={(open) => {
              setHistoryOpen(open);
              if (open && allTransfers.length === 0) {
                fetchAllHistory();
              }
            }}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  Voir tout <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="text-sm text-muted-foreground tracking-wide uppercase font-normal">
                    Historique d'activité
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-0">
                  {historyLoading && allTransfers.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : allTransfers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-12">Aucun transfert</p>
                  ) : (
                    <>
                      {allTransfers.map((transfer) => (
                        <div
                          key={transfer.id}
                          className="py-3 border-b border-border/30 last:border-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xs text-muted-foreground shrink-0 w-10">
                                {formatTimeAgo(transfer.createdAt)}
                              </span>
                              <span className="truncate">
                                <span style={transfer.sender.usernameColor ? { color: transfer.sender.usernameColor } : undefined}>
                                  {transfer.sender.username}
                                </span>
                                {' -> '}
                                <span style={transfer.receiver.usernameColor ? { color: transfer.receiver.usernameColor } : undefined}>
                                  {transfer.receiver.username}
                                </span>
                              </span>
                            </div>
                            <span className="tabular-nums shrink-0">
                              {transfer.auraAmount}
                            </span>
                          </div>
                          {transfer.message && (
                            <p className="text-sm text-muted-foreground mt-1 ml-[3.25rem] italic truncate">
                              "{transfer.message}"
                            </p>
                          )}
                        </div>
                      ))}
                      {hasMoreHistory && (
                        <Button
                          variant="ghost"
                          className="w-full mt-4"
                          onClick={loadMoreHistory}
                          disabled={historyLoading}
                        >
                          {historyLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Charger plus'
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {recentTransfers.length === 0 ? (
            <p className={TYPOGRAPHY.MUTED}>Aucun transfert</p>
          ) : (
            <Card className="border-border/40">
              <CardContent className="p-0">
                <div className="divide-y divide-border/30">
                  {recentTransfers.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="py-3 px-6"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground w-8")}>
                            {formatTimeAgo(transfer.createdAt)}
                          </span>
                          <span>
                            <span style={transfer.sender.usernameColor ? { color: transfer.sender.usernameColor } : undefined}>
                              {transfer.sender.username}
                            </span>
                            {' -> '}
                            <span style={transfer.receiver.usernameColor ? { color: transfer.receiver.usernameColor } : undefined}>
                              {transfer.receiver.username}
                            </span>
                          </span>
                        </div>
                        <span className="tabular-nums">
                          {transfer.auraAmount}
                        </span>
                      </div>
                      {transfer.message && (
                        <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground mt-1 ml-12 italic")}>
                          "{transfer.message}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="border-border/40 h-fit">
          <CardHeader>
            <CardDescription>En direct</CardDescription>
            <CardTitle className={TYPOGRAPHY.H5}>Activité des joueurs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className={cn(TYPOGRAPHY.XS, "uppercase tracking-[0.2em] text-muted-foreground")}>
                Qui joue
              </p>
              {onlinePlayersByGame.length === 0 ? (
                <p className={TYPOGRAPHY.SMALL}>Aucun joueur en partie pour le moment.</p>
              ) : (
                <div className="space-y-0">
                  {onlinePlayersByGame.slice(0, 8).map((onlineUser) => {
                    const pageMeta = getPageMeta(onlineUser.currentPage);
                    return (
                      <div
                        key={onlineUser.userId}
                        className="flex items-center justify-between gap-3 py-3 border-b border-border/30 last:border-0"
                      >
                        <span className={TYPOGRAPHY.SMALL} style={onlineUser.usernameColor ? { color: onlineUser.usernameColor } : undefined}>
                          {onlineUser.username}
                        </span>
                        <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>{pageMeta.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {onlinePlayersElsewhere.length > 0 && (
                <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>
                  +{onlinePlayersElsewhere.length} en ligne ailleurs
                </p>
              )}
            </div>

            <div className="space-y-3">
              <p className={cn(TYPOGRAPHY.XS, "uppercase tracking-[0.2em] text-muted-foreground")}>
                Parties ouvertes
              </p>
              {publicParties.length === 0 ? (
                <p className={TYPOGRAPHY.SMALL}>Aucune party active.</p>
              ) : (
                <div className="space-y-3">
                  {publicParties.slice(0, 6).map((party) => {
                    const isFull = party.memberCount >= party.maxSize;
                    const isPending = pendingJoinRequests.includes(party.id);
                    const isCurrentParty = currentParty?.id === party.id;
                    return (
                      <Card key={party.id} className="border-border/50">
                        <CardContent className="p-4 space-y-3">
                          <div>
                            <p className={TYPOGRAPHY.SMALL}>{party.name || 'Party sans nom'}</p>
                            <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>
                              {party.selectedGame?.gameName || 'Pas de jeu sélectionné'} · {party.memberCount}/{party.maxSize}
                            </p>
                          </div>
                          <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>
                            {party.members?.length
                              ? party.members.map((member) => member.username).join(', ')
                              : `${party.memberCount} membre${party.memberCount > 1 ? 's' : ''}`}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              if (party.isPublic) {
                                joinParty(party.id);
                                return;
                              }
                              requestJoinParty(party.id);
                            }}
                            disabled={isFull || isPending || isCurrentParty}
                          >
                            {isCurrentParty
                              ? 'Dans ta party'
                              : isFull
                                ? 'Pleine'
                                : isPending
                                  ? 'Demande envoyée'
                                  : 'Rejoindre'}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </PageLayout>
  );
}



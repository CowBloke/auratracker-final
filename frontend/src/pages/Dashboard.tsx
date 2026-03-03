import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Gift, GiftStatus, giftsApi } from '../services/api';
import { Gift as GiftIcon, Inbox, Send, History, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import GiftDialog from '@/components/gifts/GiftDialog';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';

interface GameShortcut {
  id: string;
  label: string;
  path: string;
  description: string;
  image?: string;
}

const shortcutStorageKey = 'auratracker:dashboard-shortcuts';
const maxShortcutWidgets = 4;

const welcomeTemplates = [
  'Bienvenue, {username}',
  'Heureux de te revoir {username}, prêt pour AuraTracker ?',
  'Salut {username} ! On lance une partie ?',
  'Yo {username}, le crew t’attend.',
  'Hey {username}, tu reviens charger l’aura ?',
  '{username}, ça faisait longtemps !',
  'Content de te revoir {username} !',
  'Re {username} - place au fun.',
  'Prêt à tout éclater, {username} ?',
  'Bon retour {username}, ça va chauffer.',
  '{username}, on remet ça ?',
  'Bienvenue à bord, {username}.',
  'Hello {username}, ça part en jeux ?',
  '{username}, le tableau de bord est prêt.',
  'Heureux de te revoir {username} !',
  'Bon retour {username}, ready ?',
];

const pickWelcomeMessage = (username?: string) => {
  const name = username || 'toi';
  const template = welcomeTemplates[Math.floor(Math.random() * welcomeTemplates.length)];
  return template.replace('{username}', name);
};

const gameShortcuts: GameShortcut[] = [
  { id: 'bomb-party', label: 'Bomb Party', path: '/games/bomb-party', description: 'Mots explosifs en équipe.', image: '/images/games/bombparty.png' },
  { id: 'poker', label: 'Poker', path: '/games/poker', description: 'Table rapide, mise prudente.', image: '/images/games/poker.png' },
  { id: 'petit-bac', label: 'Petit Bac', path: '/games/petit-bac', description: 'Catégories, lettres, vitesse.', image: '/images/games/petitbac.png' },
  { id: 'casino', label: 'Casino', path: '/games/casino', description: 'Mini-jeux et mises rapides.', image: '/images/games/casino.png' },
  { id: 'aura-coin', label: 'Aura Coin', path: '/games/aura-coin', description: 'Suivi des coins aura.', image: '/images/games/auracoin.png' },
  { id: 'polymarket', label: 'Polymarket', path: '/games/polymarket', description: 'Paris en temps réel.' },
  { id: 'doodle-jump', label: 'Doodle Jump', path: '/games/doodle-jump', description: 'Grimpe sans fin.', image: '/images/games/doodlejump.png' },
  { id: '2048', label: '2048', path: '/games/2048', description: "Fusionne jusqu'à 2048.", image: '/images/games/2048.png' },
  { id: 'flappy-bird', label: 'Flappy Bird', path: '/games/flappy-bird', description: 'Timing parfait.', image: '/images/games/flappybird.png' },
  { id: 'bataille-navale', label: 'Bataille Navale', path: '/games/bataille-navale', description: 'Touches, coulés, gagne.', image: '/images/games/bataillenavale.png' },
  { id: 'solitaire', label: 'Solitaire', path: '/games/solitaire', description: 'Classique et relax.', image: '/images/games/solitaire.png' },
  { id: 'racer', label: 'Racer', path: '/games/racer', description: 'Course pseudo-3D style Outrun.', image: '/images/games/racer.png' },
  { id: 'tetris', label: 'Tetris', path: '/games/tetris', description: 'Puzzle classique et addictif.', image: '/images/games/tetris.png' },
];

const defaultShortcuts = ['doodle-jump', 'flappy-bird', 'bomb-party', '2048'];

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
  const [inboxGifts, setInboxGifts] = useState<Gift[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<Gift[]>([]);
  const [giftStatus, setGiftStatus] = useState<GiftStatus | null>(null);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [giftDialogInitialTab, setGiftDialogInitialTab] = useState<'inbox' | 'send' | 'received'>('inbox');
  const [welcomeMessage, setWelcomeMessage] = useState(() => pickWelcomeMessage(user?.username));
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shortcutsLoaded, setShortcutsLoaded] = useState(false);
  const [shortcutWidgets, setShortcutWidgets] = useState<string[]>(defaultShortcuts);
  const [now, setNow] = useState(Date.now());

  const shortcutMap = useMemo(() => new Map(gameShortcuts.map((item) => [item.id, item])), []);
  const orderedShortcuts = useMemo(
    () => shortcutWidgets.slice(0, maxShortcutWidgets).map((id) => shortcutMap.get(id)).filter(Boolean) as GameShortcut[],
    [shortcutMap, shortcutWidgets]
  );

  useEffect(() => {
    if (!user?.username) return;
    setWelcomeMessage(pickWelcomeMessage(user.username));
  }, [user?.username]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getNextLocalMidnightTimestamp = () => {
    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 0);
    return nextMidnight.getTime();
  };

  const getNextRefillTimestamp = (value: string | null | undefined) => {
    if (!value) return getNextLocalMidnightTimestamp();
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? getNextLocalMidnightTimestamp() : timestamp;
  };

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
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setGiftsLoading(false);
        setLoading(false);
      }
    };

    fetchData();
    fetchPublicParties();
  }, []);

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
    socket.on('gift:received', handleGiftReceived);
    return () => {
      socket.off('gift:received', handleGiftReceived);
    };
  }, [socket]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(shortcutStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((id: string) => shortcutMap.has(id)).slice(0, maxShortcutWidgets);
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

  const openGiftDialog = (tab: 'inbox' | 'send' | 'received') => {
    setGiftDialogInitialTab(tab);
    setGiftDialogOpen(true);
  };

  const nextRefillCountdown = useMemo(() => {
    const nextRefillTimestamp = getNextRefillTimestamp(giftStatus?.nextRefillAt);
    if (!nextRefillTimestamp) return null;

    const diff = nextRefillTimestamp - now;
    if (diff <= 0) return '00:00:00';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [giftStatus?.nextRefillAt, now]);

  useEffect(() => {
    const nextRefillTimestamp = getNextRefillTimestamp(giftStatus?.nextRefillAt);
    if (!nextRefillTimestamp) return;
    if (nextRefillTimestamp > now) return;
    fetchGiftOverview();
  }, [giftStatus?.nextRefillAt, now]);

  if (loading) {
    return (
      <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <Card className="xl:col-span-2">
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

      <div className="space-y-8">
      {/* Shortcuts */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardDescription>Widgets</CardDescription>
              <CardTitle className={TYPOGRAPHY.H3}>Raccourcis jeux</CardTitle>
            </div>
          <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
            <Button variant="outline" onClick={() => setShortcutsOpen(true)}>
              Gérer les widgets
            </Button>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className={TYPOGRAPHY.H5}>Widgets de raccourcis</DialogTitle>
                <DialogDescription>
                  Active les jeux à afficher en haut du tableau de bord. Maximum {maxShortcutWidgets} jeux.
                </DialogDescription>
              </DialogHeader>
              <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>
                {shortcutWidgets.length}/{maxShortcutWidgets} selectionnes
              </p>
              <div className="space-y-3">
                {gameShortcuts.map((shortcut) => {
                  const checked = shortcutWidgets.includes(shortcut.id);
                  const limitReached = !checked && shortcutWidgets.length >= maxShortcutWidgets;
                  return (
                    <label
                      key={shortcut.id}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border px-3 py-3 transition",
                        checked ? "border-foreground/30 bg-muted/40" : "border-border/50",
                        limitReached && "opacity-50"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={limitReached}
                        onCheckedChange={() => {
                          setShortcutWidgets((prev) =>
                            prev.includes(shortcut.id)
                              ? prev.filter((id) => id !== shortcut.id)
                              : prev.length >= maxShortcutWidgets
                                ? prev
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
                  Réinitialiser
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
                  "group relative overflow-hidden rounded-lg border p-4 transition hover:border-foreground/30 shadow-sm",
                  shortcut.image ? "text-white" : "bg-card hover:bg-accent/50"
                )}
              >
                {shortcut.image && (
                  <>
                    <img
                      src={shortcut.image}
                      alt={shortcut.label}
                      className="absolute inset-0 h-full w-full object-cover"
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
                <p className={TYPOGRAPHY.SMALL}>Aucun widget actif. Ajoute des jeux pour un accès rapide.</p>
              </CardContent>
            </Card>
          )}
          </div>
        </CardContent>
      </Card>

      {/* Primary Stats */}
      <Card>
        <CardContent className="p-6 md:p-8">
          <div className="grid grid-cols-2 gap-4 md:gap-6">
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
          </div>
        </CardContent>
      </Card>

      {/* Gifts */}
      <Card className={SPACING.SECTION_SPACING}>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardDescription>Nouveau système</CardDescription>
              <CardTitle className={TYPOGRAPHY.H3}>Cadeaux</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openGiftDialog('inbox')}>
                <Inbox className="mr-2 h-4 w-4" />
                Boite
              </Button>
              <Button size="sm" onClick={() => openGiftDialog('send')}>
                <Send className="mr-2 h-4 w-4" />
                Envoyer
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-1">
                <p className={cn(TYPOGRAPHY.H2, "tabular-nums")}>{inboxGifts.length}</p>
                <p className={TYPOGRAPHY.SMALL}>cadeaux en attente</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-1">
                <p className={cn(TYPOGRAPHY.H2, "tabular-nums")}>{receivedGifts.length}</p>
                <p className={TYPOGRAPHY.SMALL}>cadeaux ouverts</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60 bg-muted/30">
            <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className={TYPOGRAPHY.SMALL}>Cooldown aura</p>
                <p className={cn(TYPOGRAPHY.H5, "tabular-nums")}>
                  {giftStatus?.remainingAura ?? 0}/{giftStatus?.limit ?? 50} disponibles
                </p>
                <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>
                  {giftStatus?.sentLast24h ?? 0} aura envoyee aujourd'hui
                </p>
              </div>
              <div className="space-y-1 text-left sm:text-right">
                <p className={cn(TYPOGRAPHY.XS, "flex items-center gap-1 text-muted-foreground sm:justify-end")}>
                  <Clock3 className="h-3.5 w-3.5" />
                  Reset a minuit
                </p>
                <p className={cn(TYPOGRAPHY.H5, "tabular-nums")}>
                  {nextRefillCountdown ?? '--:--:--'}
                </p>
              </div>
            </CardContent>
          </Card>

          {giftsLoading ? (
            <p className={cn(TYPOGRAPHY.MUTED)}>Chargement des cadeaux...</p>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className={TYPOGRAPHY.H5}>Boite de réception</h3>
                  {inboxGifts.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => openGiftDialog('inbox')}>
                      Tout ouvrir
                    </Button>
                  )}
                </div>
                {inboxGifts.length === 0 ? (
                  <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground")}>Aucun cadeau en attente.</p>
                ) : (
                  <div className="space-y-2">
                    {inboxGifts.slice(0, 3).map((gift) => (
                      <button
                        key={gift.id}
                        type="button"
                        onClick={() => openGiftDialog('inbox')}
                        className="flex w-full items-start gap-3 rounded-lg border border-border/60 p-3 text-left transition hover:bg-accent/40"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-pink-500 text-white">
                          <GiftIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">Cadeau de {gift.sender.username}</p>
                          <p className="text-xs text-muted-foreground">{formatTimeAgo(gift.createdAt)}</p>
                          {gift.message && (
                            <p className="mt-1 text-xs text-muted-foreground truncate">"{gift.message}"</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className={TYPOGRAPHY.H5}>Derniers cadeaux ouverts</h3>
                  {receivedGifts.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => openGiftDialog('received')}>
                      <History className="mr-2 h-4 w-4" />
                      Historique
                    </Button>
                  )}
                </div>
                {receivedGifts.length === 0 ? (
                  <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground")}>Aucun cadeau ouvert pour le moment.</p>
                ) : (
                  <div className="space-y-2">
                    {receivedGifts.slice(0, 3).map((gift) => (
                      <button
                        key={gift.id}
                        type="button"
                        onClick={() => openGiftDialog('received')}
                        className="flex w-full items-start gap-3 rounded-lg border border-border/60 p-3 text-left transition hover:bg-accent/40"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-white">
                          <GiftIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">De {gift.sender.username}</p>
                          <p className="text-xs text-muted-foreground">{formatTimeAgo(gift.openedAt || gift.createdAt)}</p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs">
                            {gift.auraAmount > 0 && <span className="text-purple-400">+{gift.auraAmount} aura</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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

      <Card className="h-fit">
          <CardHeader>
            <CardDescription>En direct</CardDescription>
            <CardTitle className={TYPOGRAPHY.H5}>Activité des parties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className={cn(TYPOGRAPHY.XS, "  text-muted-foreground")}>
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
  );
}

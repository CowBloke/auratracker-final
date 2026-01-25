import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { leaderboardsApi, economyApi, usersApi } from '../services/api';
import { ArrowRight, Loader2, Send, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

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

interface UserListItem {
  id: string;
  username: string;
  aura: number;
}

interface Ranking {
  rank: number;
  userId: string;
  username: string;
  usernameColor?: string | null;
  value: number;
}

interface GameShortcut {
  id: string;
  label: string;
  path: string;
  description: string;
}

const shortcutStorageKey = 'auratracker:dashboard-shortcuts';

const welcomeTemplates = [
  'Bienvenue, {username}',
  'Heureux de te revoir {username}, prêt pour AuraTracker ?',
  'Salut {username} ! On lance une partie ?',
  'Yo {username}, le crew t’attend.',
  'Hey {username}, tu reviens charger l’aura ?',
  '{username}, ça faisait longtemps !',
  'Content de te revoir {username} !',
  'Re {username} — place au fun.',
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
  { id: 'bomb-party', label: 'Bomb Party', path: '/games/bomb-party', description: 'Mots explosifs en équipe.' },
  { id: 'poker', label: 'Poker', path: '/games/poker', description: 'Table rapide, mise prudente.' },
  { id: 'petit-bac', label: 'Petit Bac', path: '/games/petit-bac', description: 'Catégories, lettres, vitesse.' },
  { id: 'clash', label: 'Clash', path: '/games/clash', description: 'Duel stratégique instantané.' },
  { id: 'casino', label: 'Casino', path: '/games/casino', description: 'Mini-jeux et mises rapides.' },
  { id: 'market', label: 'Marché', path: '/games/market', description: 'Salle de marché en direct.' },
  { id: 'aura-coin', label: 'Aura Coin', path: '/games/aura-coin', description: 'Suivi des coins aura.' },
  { id: 'polymarket', label: 'Polymarket', path: '/games/polymarket', description: 'Paris en temps réel.' },
  { id: 'doodle-jump', label: 'Doodle Jump', path: '/games/doodle-jump', description: 'Grimpe sans fin.' },
  { id: '2048', label: '2048', path: '/games/2048', description: "Fusionne jusqu'à 2048." },
  { id: 'flappy-bird', label: 'Flappy Bird', path: '/games/flappy-bird', description: 'Timing parfait.' },
  { id: 'russian-roulette', label: 'Roulette Russe', path: '/games/russian-roulette', description: 'Tour fatal, chance.' },
  { id: 'bataille-navale', label: 'Bataille Navale', path: '/games/bataille-navale', description: 'Touches, coulés, gagne.' },
  { id: 'solitaire', label: 'Solitaire', path: '/games/solitaire', description: 'Classique et relax.' },
];

const defaultShortcuts = ['bomb-party', 'poker', 'petit-bac', 'clash'];

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const { onlineUsers, publicParties, fetchPublicParties } = useSocket();
  const [auraRankings, setAuraRankings] = useState<Ranking[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [allUsers, setAllUsers] = useState<UserListItem[]>([]);
  const [dailyAllowance, setDailyAllowance] = useState<DailyAllowance | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [giftAmount, setGiftAmount] = useState(10);
  const [giftText, setGiftText] = useState('');
  const [giftLoading, setGiftLoading] = useState(false);
  const [giftMessage, setGiftMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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
        const [rankingsRes, transfersRes, usersRes, allowanceRes] = await Promise.all([
          leaderboardsApi.get('aura', { limit: 5 }),
          economyApi.getTransfers({ limit: 5, all: true }),
          usersApi.getAll(),
          economyApi.getDailyAllowance(),
        ]);
        
        setAuraRankings(rankingsRes.data.rankings);
        setUserRank(rankingsRes.data.userRank);
        setRecentTransfers(transfersRes.data.transfers);
        setAllUsers(usersRes.data.users);
        setDailyAllowance(allowanceRes.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    fetchPublicParties();
  }, []);

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

  const handleGiftAura = async () => {
    if (!selectedUserId || giftAmount <= 0) return;
    
    setGiftLoading(true);
    setGiftMessage(null);
    
    try {
      await economyApi.giftAura({ 
        receiverId: selectedUserId, 
        amount: giftAmount,
        message: giftText.trim() || undefined,
      });
      
      const selectedUser = allUsers.find(u => u.id === selectedUserId);
      setGiftMessage({ 
        type: 'success', 
        text: `${giftAmount} aura → ${selectedUser?.username}` 
      });
      
      await Promise.all([
        fetchDailyAllowance(),
        economyApi.getTransfers({ limit: 5, all: true }).then(res => setRecentTransfers(res.data.transfers)),
        refreshUser(),
      ]);
      
      setSelectedUserId('');
      setGiftAmount(10);
      setGiftText('');
      setGiftDialogOpen(false);
      
      setTimeout(() => setGiftMessage(null), 3000);
    } catch (error: any) {
      setGiftMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Échec' 
      });
    } finally {
      setGiftLoading(false);
    }
  };

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
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2 text-center">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">
          {onlineUsers.length} en ligne
        </p>
        <h1
          className="text-5xl md:text-7xl font-light tracking-tight"
          style={user?.usernameColor ? { color: user.usernameColor } : undefined}
        >
          {welcomeMessage || `Bienvenue, ${user?.username ?? ''}`}
        </h1>
      </header>

      {/* Shortcuts */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground tracking-wide uppercase">Widgets</p>
            <h2 className="text-2xl font-light tracking-tight">Raccourcis jeux</h2>
          </div>
          <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
            <Button variant="outline" onClick={() => setShortcutsOpen(true)}>
              Gérer les widgets
            </Button>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg font-light">Widgets de raccourcis</DialogTitle>
                <DialogDescription>
                  Active les jeux à afficher en haut du tableau de bord.
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
                  Réinitialiser
                </Button>
                <Button onClick={() => setShortcutsOpen(false)}>Terminer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {orderedShortcuts.length > 0 ? (
            orderedShortcuts.map((shortcut) => (
              <Link
                key={shortcut.id}
                to={shortcut.path}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-muted/20 p-4 transition hover:border-foreground/30 hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">Jeu</p>
                    <h3 className="text-lg font-medium">{shortcut.label}</h3>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-foreground/5 flex items-center justify-center text-muted-foreground group-hover:text-foreground">
                    <Sparkles className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{shortcut.description}</p>
              </Link>
            ))
          ) : (
            <div className="col-span-full rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6 text-center">
              <p className="text-sm text-muted-foreground">Aucun widget actif. Ajoute des jeux pour un accès rapide.</p>
            </div>
          )}
        </div>
      </section>

      {/* Primary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2">
          <p className="text-3xl md:text-4xl font-light tabular-nums">
            {user?.aura.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">aura</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2">
          <p className="text-3xl md:text-4xl font-light tabular-nums">
            ${user?.money.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">argent</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2">
          <p className="text-3xl md:text-4xl font-light tabular-nums">
            #{userRank || '-'}
          </p>
          <p className="text-sm text-muted-foreground">rang</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2">
          <p className="text-3xl md:text-4xl font-light tabular-nums">
            {publicParties.length}
          </p>
          <p className="text-sm text-muted-foreground">parties actives</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2">
          <p className="text-3xl md:text-4xl font-light tabular-nums">
            {dailyAllowance?.remaining || 0}
          </p>
          <p className="text-sm text-muted-foreground">dons restants</p>
          {resetCountdown && resetCountdown.total > 0 && (
            <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className="tabular-nums">
                {String(resetCountdown.hours).padStart(2, '0')}:
                {String(resetCountdown.minutes).padStart(2, '0')}:
                {String(resetCountdown.seconds).padStart(2, '0')}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Gift Section */}
      <section className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground tracking-wide uppercase">Envoyer de l'aura</p>
              <p className="text-lg font-light">
                Offre de l'aura à un joueur, ajoute un message, et garde un œil sur ta limite.
              </p>
            </div>
            <Dialog open={giftDialogOpen} onOpenChange={setGiftDialogOpen}>
              <Button
                onClick={() => setGiftDialogOpen(true)}
                disabled={!dailyAllowance || dailyAllowance.remaining === 0}
                className="h-12 px-6 text-base"
              >
                <Send className="h-4 w-4 mr-2" />
                Envoyer de l'aura
              </Button>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-xl font-light">Envoyer de l'aura</DialogTitle>
                  <DialogDescription>
                    Choisis un joueur, un montant, et ajoute un message si tu veux.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">1. Destinataire</p>
                    <Select
                      value={selectedUserId}
                      onValueChange={setSelectedUserId}
                      disabled={!dailyAllowance || dailyAllowance.remaining === 0}
                    >
                      <SelectTrigger className="h-12 bg-transparent border-border/50 text-base">
                        <SelectValue placeholder="Choisis un joueur" />
                      </SelectTrigger>
                      <SelectContent>
                        {allUsers
                          .filter(u => u.id !== user?.id)
                          .map(u => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.username}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">2. Montant</p>
                      <Input
                        type="number"
                        value={giftAmount}
                        onChange={(e) => setGiftAmount(Math.min(Math.max(1, parseInt(e.target.value) || 0), dailyAllowance?.remaining || 50))}
                        min={1}
                        max={dailyAllowance?.remaining || 50}
                        disabled={!dailyAllowance || dailyAllowance.remaining === 0}
                        className="h-12 bg-transparent border-border/50 text-base text-center"
                        placeholder="10"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">3. Message</p>
                      <div className="relative">
                        <Input
                          type="text"
                          value={giftText}
                          onChange={(e) => setGiftText(e.target.value)}
                          disabled={!dailyAllowance || dailyAllowance.remaining === 0}
                          className="h-12 bg-transparent border-border/50 text-base pr-16"
                          placeholder="Ajoute un message"
                          maxLength={50}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 tabular-nums">
                          {giftText.length}/50
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-background/40 p-3 text-sm text-muted-foreground">
                    Limite quotidienne restante : <span className="font-medium text-foreground">{dailyAllowance?.remaining || 0}</span>
                    {resetCountdown && resetCountdown.total > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span className="tabular-nums">
                          {String(resetCountdown.hours).padStart(2, '0')}:
                          {String(resetCountdown.minutes).padStart(2, '0')}:
                          {String(resetCountdown.seconds).padStart(2, '0')}
                        </span>
                      </span>
                    )}
                  </div>

                  {giftMessage && (
                    <p className={cn(
                      "text-sm",
                      giftMessage.type === 'success' ? 'text-foreground' : 'text-destructive'
                    )}>
                      {giftMessage.text}
                    </p>
                  )}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => setGiftDialogOpen(false)}
                    disabled={giftLoading}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleGiftAura}
                    disabled={!selectedUserId || giftAmount <= 0 || giftLoading || !dailyAllowance || dailyAllowance.remaining === 0}
                  >
                    {giftLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Envoyer maintenant
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {giftMessage && (
            <p className={cn(
              "text-sm",
              giftMessage.type === 'success' ? 'text-foreground' : 'text-destructive'
            )}>
              {giftMessage.text}
            </p>
          )}
          {!dailyAllowance || dailyAllowance.remaining === 0 ? (
            <p className="text-sm text-muted-foreground">
              Limite quotidienne atteinte. Reviens après le reset pour offrir de nouveau.
            </p>
          ) : null}
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Leaderboard */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
            Classement
          </h2>
          <Link 
            to="/leaderboards" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Voir tout <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        
        <div className="space-y-0">
          {auraRankings.map((ranking) => (
            <div
              key={ranking.userId}
              className={cn(
                "flex items-center justify-between py-4 border-b border-border/30 last:border-0",
                ranking.userId === user?.id && "bg-muted/30 -mx-4 px-4"
              )}
            >
              <div className="flex items-center gap-6">
                <span className="text-muted-foreground text-sm w-6 tabular-nums">
                  {ranking.rank}
                </span>
                <span 
                  className="font-medium"
                  style={ranking.usernameColor ? { color: ranking.usernameColor } : undefined}
                >
                  {ranking.username}
                </span>
              </div>
              <span className="tabular-nums text-muted-foreground">
                {ranking.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Recent Activity */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
            Activité récente
          </h2>
          <Sheet open={historyOpen} onOpenChange={(open) => {
            setHistoryOpen(open);
            if (open && allTransfers.length === 0) {
              fetchAllHistory();
            }
          }}>
            <SheetTrigger asChild>
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                Voir tout <ArrowRight className="h-3 w-3" />
              </button>
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
                                      {' → '}
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
          <p className="text-muted-foreground">Aucun transfert</p>
        ) : (
          <div className="space-y-0">
            {recentTransfers.map((transfer) => (
              <div
                key={transfer.id}
                className="py-3 border-b border-border/30 last:border-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-8">
                      {formatTimeAgo(transfer.createdAt)}
                    </span>
                    <span>
                      <span style={transfer.sender.usernameColor ? { color: transfer.sender.usernameColor } : undefined}>
                        {transfer.sender.username}
                      </span>
                      {' → '}
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
                  <p className="text-sm text-muted-foreground mt-1 ml-12 italic">
                    "{transfer.message}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

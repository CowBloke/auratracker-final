import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Gift, GiftStatus, UserDailyQuest, DailyQuest, auraCoinApi, giftsApi, leaderboardsApi, marketplaceApi, questsApi, passApi, bombPartyApi, polymarketApi } from '../services/api';
import { GripVertical, Zap, DollarSign, Trophy, Users, Gift as GiftIcon, Package, TrendingUp, TrendingDown, CheckCircle2, Star, Flame, Gamepad2, Hash, BarChart3, Coins, Shield, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis } from 'recharts';
import GiftDialog from '@/components/gifts/GiftDialog';
import { toast } from 'sonner';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';

interface GameShortcut {
  id: string;
  label: string;
  path: string;
  description: string;
  image?: string;
}

type DashboardWidgetId = 'shortcuts' | 'live' | 'stats' | 'gifts' | 'auracoin' | 'quests' | 'quick-actions' | 'inventory' | 'aura-leaders';

interface DashboardInventoryItem {
  id: string;
  quantity: number;
  item: {
    id: string;
    name: string;
    type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE' | 'GIFT';
  };
}

interface AuraLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  usernameColor?: string | null;
  value: number;
}

const shortcutStorageKey = 'auratracker:dashboard-shortcuts';
const dashboardLayoutStorageKey = 'auratracker:dashboard-layout';
const dashboardVisibleWidgetsStorageKey = 'auratracker:dashboard-visible-widgets';
const maxShortcutWidgets = 8;

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
  { id: 'polymarket', label: 'Polymarket', path: '/polymarket', description: 'Paris en temps réel.' },
  { id: 'doodle-jump', label: 'Doodle Jump', path: '/games/doodle-jump', description: 'Grimpe sans fin.', image: '/images/games/doodlejump.png' },
  { id: '2048', label: '2048', path: '/games/2048', description: "Fusionne jusqu'à 2048.", image: '/images/games/2048.png' },
  { id: 'flappy-bird', label: 'Flappy Bird', path: '/games/flappy-bird', description: 'Timing parfait.', image: '/images/games/flappybird.png' },
  { id: 'bataille-navale', label: 'Bataille Navale', path: '/games/bataille-navale', description: 'Touches, coulés, gagne.', image: '/images/games/bataillenavale.png' },
  { id: 'solitaire', label: 'Solitaire', path: '/games/solitaire', description: 'Classique et relax.', image: '/images/games/solitaire.png' },
  { id: 'racer', label: 'Racer', path: '/games/racer', description: 'Course pseudo-3D style Outrun.', image: '/images/games/racer.png' },
  { id: 'tetris', label: 'Tetris', path: '/games/tetris', description: 'Puzzle classique et addictif.', image: '/images/games/tetris.png' },
  { id: 'knife-hit', label: 'Knife Hit', path: '/games/knife-hit', description: 'Timing sec et précision.', image: '/images/games/knifehit.png' },
  { id: 'subway-rush', label: 'Subway Rush', path: '/games/subway-rush', description: 'Runner 3 voies style Subway Surfers.' },
];

const defaultShortcuts = ['doodle-jump', 'flappy-bird', 'bomb-party', '2048', 'poker', 'solitaire', 'tetris', 'racer'];
const defaultShortcutSet = new Set(defaultShortcuts);
const quickActions = [
  { label: 'Créer party', path: '/party', icon: Users, color: 'text-violet-500', bg: 'bg-violet-500/15' },
  { label: 'Voir quêtes', path: '/quests', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/15' },
  { label: 'Ouvrir shop', path: '/market', icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/15' },
  { label: 'Classements', path: '/leaderboards', icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-500/15' },
  { label: 'Clans', path: '/clans', icon: Shield, color: 'text-teal-500', bg: 'bg-teal-500/15' },
  { label: 'Mon profil', path: '/profile', icon: UserIcon, color: 'text-rose-500', bg: 'bg-rose-500/15' },
  { label: 'Polymarket', path: '/polymarket', icon: BarChart3, color: 'text-indigo-500', bg: 'bg-indigo-500/15' },
];

const defaultDashboardLayout: DashboardWidgetId[] = ['shortcuts', 'live', 'quick-actions', 'stats', 'quests', 'auracoin', 'aura-leaders', 'inventory', 'gifts'];
const dashboardWidgetLabels: Record<DashboardWidgetId, { title: string; description: string }> = {
  'quick-actions': { title: 'Actions rapides', description: 'Liens utiles du dashboard.' },
  shortcuts: { title: 'Raccourcis jeux', description: 'Accès rapide à tes jeux favoris.' },
  quests: { title: 'Quêtes du jour', description: 'Suivi des quêtes actives.' },
  auracoin: { title: 'Aura Coin', description: 'Prix et variation du marché.' },
  'aura-leaders': { title: 'Top Aura', description: 'Utilisateurs avec le plus d’aura.' },
  inventory: { title: 'Inventaire', description: 'Résumé de tes objets.' },
  live: { title: 'Activité des parties', description: 'Parties ouvertes en direct.' },
  stats: { title: 'Stats', description: 'Vue rapide de tes ressources.' },
  gifts: { title: 'Cadeaux', description: 'Boîte, envois et historique.' },
};

const isDashboardWidgetId = (value: string): value is DashboardWidgetId =>
  ['shortcuts', 'live', 'stats', 'gifts', 'auracoin', 'quests', 'quick-actions', 'inventory', 'aura-leaders'].includes(value);

interface ExtraStatConfig {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  bg: string;
  fetch: (userId: string) => Promise<string | number>;
}

const EXTRA_STAT_POOL: ExtraStatConfig[] = [
  {
    id: 'pass-streak',
    label: 'Streak pass',
    icon: Flame,
    color: 'text-orange-500',
    bg: 'bg-orange-500/15',
    fetch: async () => {
      const res = await passApi.getStatus();
      return `${res.data.streak}j`;
    },
  },
  {
    id: 'bomb-wins',
    label: 'Victoires BP',
    icon: Gamepad2,
    color: 'text-red-500',
    bg: 'bg-red-500/15',
    fetch: async (userId) => {
      const res = await bombPartyApi.getStats(userId);
      return res.data.wins;
    },
  },
  {
    id: 'bomb-words',
    label: 'Mots tapés',
    icon: Hash,
    color: 'text-sky-500',
    bg: 'bg-sky-500/15',
    fetch: async (userId) => {
      const res = await bombPartyApi.getStats(userId);
      return Number(res.data.wordsTyped).toLocaleString('fr-FR');
    },
  },
  {
    id: 'poly-bets',
    label: 'Paris placés',
    icon: BarChart3,
    color: 'text-violet-500',
    bg: 'bg-violet-500/15',
    fetch: async () => {
      const res = await polymarketApi.getBets();
      return res.data.bets.length;
    },
  },
  {
    id: 'auracoin-balance',
    label: 'Balance AC',
    icon: Coins,
    color: 'text-primary',
    bg: 'bg-primary/15',
    fetch: async () => {
      const res = await auraCoinApi.getPrice(1);
      return res.data.userBalance.auraCoin.toFixed(4);
    },
  },
];

function pickRandomStats(count: number): ExtraStatConfig[] {
  const shuffled = [...EXTRA_STAT_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

interface ExtraStatValue {
  config: ExtraStatConfig;
  value: string | number | null;
}

const dashboardWidgetCardClass = "flex h-full flex-col overflow-hidden rounded-xl border-border/60 shadow-sm";
const dashboardWidgetHeaderClass = "px-4 pb-3 pt-4 sm:px-5";
const dashboardWidgetContentClass = "min-h-0 flex-1 px-4 pb-4 pt-0 sm:px-5 sm:pb-5";
const dashboardWidgetCompactContentClass = "min-h-0 flex-1 p-3 pt-0 sm:p-4 sm:pt-0";

function DashboardWidgetTitle({
  title,
  icon: Icon,
  iconClassName,
  iconWrapperClassName,
}: {
  title: string;
  icon: React.FC<{ className?: string }>;
  iconClassName: string;
  iconWrapperClassName: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", iconWrapperClassName)}>
        <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
      </div>
      <CardTitle className={cn(TYPOGRAPHY.H3, "truncate")}>{title}</CardTitle>
    </div>
  );
}


function SortableDashboardWidget({
  widgetId,
  children,
}: {
  widgetId: DashboardWidgetId;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widgetId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative min-h-0 h-[312px] md:h-[356px] xl:h-[372px]",
        isDragging && "z-20"
      )}
    >
      <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
        <button
          type="button"
          aria-label="Deplacer le widget"
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground backdrop-blur-sm transition hover:bg-accent",
            "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto",
            isDragging && "opacity-100 pointer-events-auto"
          )}
          onClick={(event) => event.preventDefault()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <div className={cn("h-full", isDragging && "scale-[1.01] shadow-xl ring-2 ring-foreground/15 rounded-xl")}>
        {children}
      </div>
    </div>
  );
}

function ShortcutTile({ shortcut }: { shortcut: GameShortcut }) {
  return (
    <Link
      to={shortcut.path}
      className={cn(
        "group relative flex aspect-square overflow-hidden rounded-lg border p-4 shadow-sm transition hover:border-foreground/30",
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

      <div className="relative z-10 mt-auto flex h-full flex-col justify-end gap-1">
        <h3 className={TYPOGRAPHY.H5}>{shortcut.label}</h3>
      </div>
    </Link>
  );
}

function coerceDashboardLayout(value: unknown): DashboardWidgetId[] | null {
  if (!Array.isArray(value)) return null;

  const normalized = Array.from(new Set(value.filter((item): item is DashboardWidgetId =>
    typeof item === 'string' && isDashboardWidgetId(item)
  )));

  const ids = new Set(normalized);
  if (ids.size !== defaultDashboardLayout.length) return null;

  return normalized;
}

function coerceVisibleDashboardWidgets(value: unknown): DashboardWidgetId[] | null {
  if (!Array.isArray(value)) return null;

  const normalized = value.filter((item): item is DashboardWidgetId =>
    typeof item === 'string' && isDashboardWidgetId(item)
  );

  return Array.from(new Set(normalized));
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
  const [inboxGifts, setInboxGifts] = useState<Gift[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<Gift[]>([]);
  const [giftStatus, setGiftStatus] = useState<GiftStatus | null>(null);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [giftDialogInitialTab, setGiftDialogInitialTab] = useState<'inbox' | 'send' | 'received'>('inbox');
  const [welcomeMessage, setWelcomeMessage] = useState(() => pickWelcomeMessage(user?.username));
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shortcutsLoaded, setShortcutsLoaded] = useState(false);
  const [shortcutWidgets, setShortcutWidgets] = useState<string[]>(defaultShortcuts);
  const [dashboardLayout, setDashboardLayout] = useState<DashboardWidgetId[]>(defaultDashboardLayout);
  const [dashboardLayoutLoaded, setDashboardLayoutLoaded] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<DashboardWidgetId[]>(defaultDashboardLayout);
  const [visibleWidgetsLoaded, setVisibleWidgetsLoaded] = useState(false);
  const [widgetsDialogOpen, setWidgetsDialogOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [auraCoinPrice, setAuraCoinPrice] = useState<number | null>(null);
  const [auraCoinPreviousPrice, setAuraCoinPreviousPrice] = useState<number | null>(null);
  const [auraCoinHistory, setAuraCoinHistory] = useState<{ price: number; time: string }[]>([]);
  const [questWidgets, setQuestWidgets] = useState<UserDailyQuest[]>([]);
  const [availableDailyQuests, setAvailableDailyQuests] = useState<DailyQuest[]>([]);
  const [widgetQuestSelection, setWidgetQuestSelection] = useState<string[]>([]);
  const [widgetQuestSelecting, setWidgetQuestSelecting] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<DashboardInventoryItem[]>([]);
  const [auraLeaders, setAuraLeaders] = useState<AuraLeaderboardEntry[]>([]);
  const [extraStats, setExtraStats] = useState<ExtraStatValue[]>([]);
  const [selectedStatPool] = useState<ExtraStatConfig[]>(() => pickRandomStats(2));

  const shortcutMap = useMemo(() => new Map(gameShortcuts.map((item) => [item.id, item])), []);
  const orderedShortcuts = useMemo(
    () => shortcutWidgets.slice(0, maxShortcutWidgets).map((id) => shortcutMap.get(id)).filter(Boolean) as GameShortcut[],
    [shortcutMap, shortcutWidgets]
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const visibleDashboardLayout = useMemo(
    () => dashboardLayout.filter((widgetId) => visibleWidgets.includes(widgetId)),
    [dashboardLayout, visibleWidgets]
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
        const [inboxRes, receivedRes, statusRes, auraCoinRes, myQuestsRes, dailyQuestsRes, inventoryRes, auraLeadersRes] = await Promise.allSettled([
          giftsApi.getInbox(),
          giftsApi.getReceived(),
          giftsApi.getStatus(),
          auraCoinApi.getPrice(4),
          questsApi.getMyQuests(),
          questsApi.getDaily(),
          user?.id ? marketplaceApi.getInventory(user.id) : Promise.resolve({ data: { items: [] as DashboardInventoryItem[] } }),
          leaderboardsApi.get('aura', { limit: 5 }),
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

        if (auraCoinRes.status === 'fulfilled') {
          const { currentPrice, history } = auraCoinRes.value.data;
          setAuraCoinPrice(currentPrice);
          setAuraCoinPreviousPrice(history[1]?.price ?? history[0]?.price ?? currentPrice);
          setAuraCoinHistory(
            history.map((h) => ({
              price: h.price,
              time: new Date(h.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            }))
          );
        }

        if (myQuestsRes.status === 'fulfilled') {
          setQuestWidgets(myQuestsRes.value.data.userQuests || []);
        }

        if (dailyQuestsRes.status === 'fulfilled') {
          const quests = dailyQuestsRes.value.data.quests || [];
          setAvailableDailyQuests(quests);
        }

        if (inventoryRes.status === 'fulfilled') {
          setInventoryItems((inventoryRes.value.data.items || []) as DashboardInventoryItem[]);
        }

        if (auraLeadersRes.status === 'fulfilled') {
          setAuraLeaders((auraLeadersRes.value.data.rankings || []) as AuraLeaderboardEntry[]);
        }

        // Fetch randomly selected extra stats
        if (selectedStatPool.length > 0 && user?.id) {
          const extraResults = await Promise.allSettled(
            selectedStatPool.map((s) => s.fetch(user.id))
          );
          setExtraStats(
            selectedStatPool.map((config, i) => ({
              config,
              value: extraResults[i].status === 'fulfilled' ? (extraResults[i] as PromiseFulfilledResult<string | number>).value : '--',
            }))
          );
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
  }, [user?.id]);

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
    if (!socket) return;

    const handleAuraCoinPriceUpdate = (data: { price: number }) => {
      setAuraCoinPreviousPrice((prev) => auraCoinPrice ?? prev);
      setAuraCoinPrice(data.price);
    };

    socket.on('auracoin:price-update', handleAuraCoinPriceUpdate);
    return () => {
      socket.off('auracoin:price-update', handleAuraCoinPriceUpdate);
    };
  }, [socket, auraCoinPrice]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(shortcutStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((id: string) => shortcutMap.has(id)).slice(0, maxShortcutWidgets);
          if (filtered.length > 0) {
            const shouldFillLegacyDefaults =
              filtered.length < maxShortcutWidgets && filtered.every((id: string) => defaultShortcutSet.has(id));

            setShortcutWidgets(
              shouldFillLegacyDefaults
                ? [...new Set([...filtered, ...defaultShortcuts])].slice(0, maxShortcutWidgets)
                : filtered
            );
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
    try {
      const stored = localStorage.getItem(dashboardLayoutStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      const layout = coerceDashboardLayout(parsed);
      if (layout) {
        setDashboardLayout(layout);
      }
    } catch {
      // Ignore localStorage parse failures.
    } finally {
      setDashboardLayoutLoaded(true);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(dashboardVisibleWidgetsStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      const widgets = coerceVisibleDashboardWidgets(parsed);
      if (widgets) {
        setVisibleWidgets(widgets);
      }
    } catch {
      // Ignore localStorage parse failures.
    } finally {
      setVisibleWidgetsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!shortcutsLoaded) return;
    try {
      localStorage.setItem(shortcutStorageKey, JSON.stringify(shortcutWidgets));
    } catch {
      // Ignore localStorage write failures.
    }
  }, [shortcutsLoaded, shortcutWidgets]);

  useEffect(() => {
    if (!dashboardLayoutLoaded) return;
    try {
      localStorage.setItem(dashboardLayoutStorageKey, JSON.stringify(dashboardLayout));
    } catch {
      // Ignore localStorage write failures.
    }
  }, [dashboardLayoutLoaded, dashboardLayout]);

  useEffect(() => {
    if (!visibleWidgetsLoaded) return;
    try {
      localStorage.setItem(dashboardVisibleWidgetsStorageKey, JSON.stringify(visibleWidgets));
    } catch {
      // Ignore localStorage write failures.
    }
  }, [visibleWidgetsLoaded, visibleWidgets]);

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

  const handleWidgetQuestConfirm = async () => {
    if (widgetQuestSelection.length !== 3) return;
    setWidgetQuestSelecting(true);
    try {
      const res = await questsApi.select(widgetQuestSelection);
      setQuestWidgets(res.data.userQuests || []);
      setWidgetQuestSelection([]);
      toast.success('Quêtes sélectionnées !');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erreur lors de la sélection');
    } finally {
      setWidgetQuestSelecting(false);
    }
  };

  const handleDashboardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDashboardLayout((current) => {
      const oldIndex = current.findIndex((item) => item === active.id);
      const newIndex = current.findIndex((item) => item === over.id);

      if (oldIndex === -1 || newIndex === -1) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
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

  const auraCoinDelta = useMemo(() => {
    if (auraCoinPrice === null || auraCoinPreviousPrice === null || auraCoinPreviousPrice === 0) return null;
    return ((auraCoinPrice - auraCoinPreviousPrice) / auraCoinPreviousPrice) * 100;
  }, [auraCoinPrice, auraCoinPreviousPrice]);

  const completedQuestCount = useMemo(
    () => questWidgets.filter((quest) => quest.isCompleted && !quest.isClaimed).length,
    [questWidgets]
  );
  const totalInventoryCount = useMemo(
    () => inventoryItems.reduce((sum, item) => sum + item.quantity, 0),
    [inventoryItems]
  );
  const giftInventoryCount = useMemo(
    () => inventoryItems.filter((item) => item.item.type === 'GIFT').reduce((sum, item) => sum + item.quantity, 0),
    [inventoryItems]
  );
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
    <>
      <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-6">
        <div className="rounded-2xl border border-border/60 bg-card/70 px-6 py-8 md:px-8 md:py-10">
          <div className={cn("space-y-2", SPACING.TIGHT_SPACING)}>
            <p
              className={cn(TYPOGRAPHY.H1, "text-center md:text-left md:text-5xl")}
              style={user?.usernameColor ? { color: user.usernameColor } : undefined}
            >
              {welcomeMessage || `Bienvenue, ${user?.username ?? ''}`}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="flex flex-wrap justify-end gap-2">
            <Dialog open={widgetsDialogOpen} onOpenChange={setWidgetsDialogOpen}>
              <Button variant="outline" onClick={() => setWidgetsDialogOpen(true)}>
                Gérer widgets
              </Button>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className={TYPOGRAPHY.H5}>Widgets du dashboard</DialogTitle>
                  <DialogDescription>
                    Choisis les widgets a afficher sur la page.
                  </DialogDescription>
                </DialogHeader>
                <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>
                  {visibleWidgets.length}/{defaultDashboardLayout.length} visibles
                </p>
                <div className="space-y-3">
                  {defaultDashboardLayout.map((widgetId) => {
                    const widget = dashboardWidgetLabels[widgetId];
                    const checked = visibleWidgets.includes(widgetId);
                    const isLastVisible = checked && visibleWidgets.length === 1;

                    return (
                      <label
                        key={widgetId}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border px-3 py-3 transition",
                          checked ? "border-foreground/30 bg-muted/40" : "border-border/50",
                          isLastVisible && "opacity-50"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={isLastVisible}
                          onCheckedChange={() => {
                            setVisibleWidgets((prev) =>
                              prev.includes(widgetId)
                                ? prev.length === 1
                                  ? prev
                                  : prev.filter((id) => id !== widgetId)
                                : [...prev, widgetId]
                            );
                          }}
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <p className="font-medium">{widget.title}</p>
                          <p className="text-sm text-muted-foreground">{widget.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="ghost"
                    onClick={() => setVisibleWidgets(defaultDashboardLayout)}
                  >
                    Tout afficher
                  </Button>
                  <Button onClick={() => setWidgetsDialogOpen(false)}>Terminer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              onClick={() => {
                setDashboardLayout(defaultDashboardLayout);
                setVisibleWidgets(defaultDashboardLayout);
              }}
            >
              Réinitialiser la grille
            </Button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDashboardDragEnd}
        >
          <SortableContext
            items={visibleDashboardLayout}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-5">
              {visibleDashboardLayout.map((widgetId) => (
                <SortableDashboardWidget
                  key={widgetId}
                  widgetId={widgetId}
                >
                  {widgetId === 'quick-actions' && (
                    <Card className={dashboardWidgetCardClass}>
                      <CardHeader className={dashboardWidgetHeaderClass}>
                        <DashboardWidgetTitle
                          title="Actions rapides"
                          icon={Zap}
                          iconClassName="text-amber-500"
                          iconWrapperClassName="bg-amber-500/15"
                        />
                      </CardHeader>
                      <CardContent className={dashboardWidgetContentClass}>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {quickActions.map((action) => {
                            const Icon = action.icon;
                            return (
                              <Button
                                key={action.path}
                                asChild
                                variant="outline"
                                className="aspect-square h-auto w-full flex-col items-center justify-center gap-1.5 rounded-xl p-2.5 text-center hover:border-border"
                              >
                                <Link to={action.path}>
                                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", action.bg)}>
                                    <Icon className={cn("h-4 w-4", action.color)} />
                                  </div>
                                  <span className="text-xs font-medium leading-tight">{action.label}</span>
                                </Link>
                              </Button>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {widgetId === 'shortcuts' && (
                    <Card className={dashboardWidgetCardClass}>
                      <CardHeader className={dashboardWidgetHeaderClass}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <DashboardWidgetTitle
                            title="Raccourcis jeux"
                            icon={Gamepad2}
                            iconClassName="text-sky-500"
                            iconWrapperClassName="bg-sky-500/15"
                          />
                          <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
                            <Button variant="outline" size="sm" onClick={() => setShortcutsOpen(true)}>
                              Modifier
                            </Button>
                            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className={TYPOGRAPHY.H5}>Widgets de raccourcis</DialogTitle>
                                <DialogDescription>
                                  Active les jeux à afficher dans le widget. Maximum {maxShortcutWidgets} jeux (2 rangées de 4).
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
                      <CardContent className={cn(dashboardWidgetContentClass, "overflow-y-auto")}>
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                          {orderedShortcuts.length > 0 ? (
                            orderedShortcuts.map((shortcut) => (
                              <ShortcutTile key={shortcut.id} shortcut={shortcut} />
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
                  )}

                  {widgetId === 'quests' && (
                    <Card className={dashboardWidgetCardClass}>
                      <CardHeader className={dashboardWidgetHeaderClass}>
                        <div className="flex items-center justify-between gap-3">
                          <DashboardWidgetTitle
                            title="Quêtes du jour"
                            icon={CheckCircle2}
                            iconClassName="text-emerald-600"
                            iconWrapperClassName="bg-emerald-500/15"
                          />
                          {completedQuestCount > 0 && (
                            <Badge className="bg-emerald-500 text-white hover:bg-emerald-500/90">
                              {completedQuestCount} à réclamer
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className={cn(dashboardWidgetContentClass, "flex flex-col")}>
                        {questWidgets.length > 0 ? (
                          <>
                            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm">
                                <span className="text-muted-foreground">{questWidgets.length} actives</span>
                                {completedQuestCount > 0 ? (
                                  <span className="tabular-nums font-medium text-emerald-600">{completedQuestCount} à réclamer</span>
                                ) : (
                                  <span className="tabular-nums text-muted-foreground">0 à réclamer</span>
                                )}
                              </div>

                              <div className="space-y-2">
                                {questWidgets.slice(0, 3).map((quest) => {
                                  const progress = quest.progress?.currentValue || 0;
                                  const target = quest.quest.targetValue;

                                  return (
                                    <div key={quest.id} className="space-y-2 rounded-lg border border-border/60 px-3 py-2.5">
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="min-w-0 truncate text-sm font-medium">{quest.quest.title}</p>
                                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{progress}/{target}</span>
                                      </div>
                                      <Progress value={Math.min((progress / target) * 100, 100)} className="h-1.5" />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <Button asChild variant="outline" className="mt-3 w-full">
                              <Link to="/quests">Ouvrir les quêtes</Link>
                            </Button>
                          </>
                        ) : availableDailyQuests.length > 0 ? (
                          <>
                            <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>
                              Choisis 3 quêtes · {widgetQuestSelection.length}/3 sélectionnées
                            </p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {availableDailyQuests.slice(0, 9).map((quest) => {
                                const isSelected = widgetQuestSelection.includes(quest.id);
                                const limitReached = !isSelected && widgetQuestSelection.length >= 3;
                                return (
                                  <button
                                    key={quest.id}
                                    type="button"
                                    disabled={limitReached}
                                    onClick={() =>
                                      setWidgetQuestSelection((prev) =>
                                        prev.includes(quest.id)
                                          ? prev.filter((id) => id !== quest.id)
                                          : prev.length >= 3 ? prev : [...prev, quest.id]
                                      )
                                    }
                                    className={cn(
                                      "flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left text-xs transition",
                                      isSelected
                                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                        : "border-border/60 hover:bg-accent/50",
                                      limitReached && "opacity-40 cursor-not-allowed"
                                    )}
                                  >
                                    <span className="font-medium leading-tight line-clamp-2">{quest.title}</span>
                                    <span className="text-muted-foreground">+{quest.auraReward} aura</span>
                                  </button>
                                );
                              })}
                            </div>
                            <Button
                              className="w-full"
                              disabled={widgetQuestSelection.length !== 3 || widgetQuestSelecting}
                              onClick={handleWidgetQuestConfirm}
                            >
                              {widgetQuestSelecting ? 'Sélection...' : `Valider (${widgetQuestSelection.length}/3)`}
                            </Button>
                          </>
                        ) : (
                          <div className="flex min-h-0 flex-1 flex-col gap-3">
                            <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground")}>Les quêtes du jour ne sont pas encore disponibles.</p>
                            <Button asChild className="mt-auto">
                              <Link to="/quests">Voir les quêtes</Link>
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {widgetId === 'live' && (
                    <Card className={dashboardWidgetCardClass}>
                      <CardHeader className={dashboardWidgetHeaderClass}>
                        <div className="flex items-center gap-2">
                          <DashboardWidgetTitle
                            title="Activité des parties"
                            icon={Users}
                            iconClassName="text-violet-500"
                            iconWrapperClassName="bg-violet-500/15"
                          />
                          {publicParties.length > 0 && (
                            <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                              </span>
                              Live
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className={cn(dashboardWidgetContentClass, "overflow-y-auto")}>
                        {publicParties.length === 0 ? (
                          <p className={TYPOGRAPHY.SMALL}>Aucune party active.</p>
                        ) : (
                          <div className="space-y-2.5">
                            {publicParties.slice(0, 6).map((party) => {
                              const isFull = party.memberCount >= party.maxSize;
                              const isPending = pendingJoinRequests.includes(party.id);
                              const isCurrentParty = currentParty?.id === party.id;
                              return (
                                <div key={party.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
                                  <div className="min-w-0">
                                    <p className={TYPOGRAPHY.SMALL}>{party.name || 'Party sans nom'}</p>
                                    <p className={cn(TYPOGRAPHY.XS, "truncate text-muted-foreground")}>
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
                                    {isCurrentParty
                                      ? 'Dans ta party'
                                      : isFull
                                        ? 'Pleine'
                                        : isPending
                                          ? 'Envoyé'
                                          : 'Rejoindre'}
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {widgetId === 'stats' && (
                    <Card className={dashboardWidgetCardClass}>
                      <CardHeader className={cn(dashboardWidgetHeaderClass, "pb-2")}>
                        <DashboardWidgetTitle
                          title="Stats"
                          icon={BarChart3}
                          iconClassName="text-primary"
                          iconWrapperClassName="bg-primary/15"
                        />
                      </CardHeader>
                      <CardContent className={dashboardWidgetCompactContentClass}>
                        <div className="grid h-full grid-cols-2 gap-2">
                          <Card className="border-primary/20 bg-primary/5">
                            <CardContent className="flex h-full flex-col justify-between p-2.5 sm:p-3">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                                <Zap className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <div>
                                <p className="text-xl font-semibold tabular-nums text-primary leading-tight sm:text-2xl">
                                  {user?.aura.toLocaleString()}
                                </p>
                                <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>aura</p>
                              </div>
                            </CardContent>
                          </Card>
                          <Card className="border-emerald-500/20 bg-emerald-500/5">
                            <CardContent className="flex h-full flex-col justify-between p-2.5 sm:p-3">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
                                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                              </div>
                              <div>
                                <p className="text-xl font-semibold tabular-nums text-emerald-600 leading-tight sm:text-2xl">
                                  ${user?.money.toLocaleString()}
                                </p>
                                <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>argent</p>
                              </div>
                            </CardContent>
                          </Card>
                          {extraStats.map(({ config, value }) => {
                            const Icon = config.icon;
                            return (
                              <Card key={config.id} className="border-border/60">
                                <CardContent className="flex h-full flex-col justify-between p-2.5 sm:p-3">
                                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", config.bg)}>
                                    <Icon className={cn("h-3.5 w-3.5", config.color)} />
                                  </div>
                                  <div>
                                    <p className={cn("text-xl font-semibold tabular-nums leading-tight sm:text-2xl", value === '--' && "text-muted-foreground")}>
                                      {value ?? '--'}
                                    </p>
                                    <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>{config.label}</p>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {widgetId === 'auracoin' && (() => {
                    const isUp = (auraCoinDelta ?? 0) >= 0;
                    const auraCoinChartConfig = {
                      price: {
                        label: 'Prix',
                        color: isUp ? 'hsl(var(--chart-1))' : 'hsl(var(--destructive))',
                      },
                    } satisfies ChartConfig;
                    return (
                      <Card className={dashboardWidgetCardClass}>
                        <CardHeader className={cn(dashboardWidgetHeaderClass, "pb-2")}>
                          <div className="flex items-center justify-between gap-2">
                            <DashboardWidgetTitle
                              title="Aura Coin"
                              icon={Star}
                              iconClassName="text-primary"
                              iconWrapperClassName="bg-primary/15"
                            />
                            <div
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                                auraCoinDelta === null
                                  ? "bg-muted text-muted-foreground"
                                  : isUp
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : "bg-red-500/10 text-red-600"
                              )}
                            >
                              {auraCoinDelta !== null && (
                                isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
                              )}
                              <span className="tabular-nums">
                                {auraCoinDelta === null ? 'N/A' : `${isUp ? '+' : ''}${auraCoinDelta.toFixed(2)}%`}
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className={cn(dashboardWidgetContentClass, "flex flex-col")}>
                          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                            <p className={cn(TYPOGRAPHY.H1, "tabular-nums text-primary text-4xl md:text-[2.75rem]")}>
                              {auraCoinPrice === null ? '--' : `$${auraCoinPrice.toFixed(2)}`}
                            </p>

                            {auraCoinHistory.length >= 2 ? (
                              <ChartContainer config={auraCoinChartConfig} className="!aspect-auto h-20 w-full sm:h-24">
                                <AreaChart data={auraCoinHistory} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                                  <defs>
                                    <linearGradient id="acGrad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="var(--color-price)" stopOpacity={0.25} />
                                      <stop offset="95%" stopColor="var(--color-price)" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <XAxis dataKey="time" hide />
                                  <YAxis domain={['auto', 'auto']} hide />
                                  <ChartTooltip
                                    content={
                                      <ChartTooltipContent
                                        formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Prix']}
                                        labelFormatter={(l) => l}
                                      />
                                    }
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="price"
                                    stroke="var(--color-price)"
                                    fill="url(#acGrad)"
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                  />
                                </AreaChart>
                              </ChartContainer>
                            ) : (
                              <div className="h-20 sm:h-24" />
                            )}
                          </div>

                          <Button asChild variant="outline" className="mt-3 w-full">
                            <Link to="/games/aura-coin">Ouvrir Aura Coin</Link>
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {widgetId === 'aura-leaders' && (
                    <Card className={dashboardWidgetCardClass}>
                      <CardHeader className={dashboardWidgetHeaderClass}>
                        <DashboardWidgetTitle
                          title="Top Aura"
                          icon={Trophy}
                          iconClassName="text-amber-500"
                          iconWrapperClassName="bg-amber-500/15"
                        />
                      </CardHeader>
                      <CardContent className={cn(dashboardWidgetContentClass, "flex flex-col")}>
                        {auraLeaders.length > 0 ? (
                          <div className="space-y-2">
                            {auraLeaders.slice(0, 5).map((entry) => (
                              <div
                                key={entry.userId}
                                className={cn(
                                  "flex items-center justify-between rounded-lg border px-3 py-2.5",
                                  entry.rank === 1 && "border-amber-500/30 bg-amber-500/5",
                                  entry.rank === 2 && "border-zinc-400/30 bg-zinc-400/5",
                                  entry.rank === 3 && "border-orange-600/30 bg-orange-600/5",
                                  entry.rank > 3 && "border-border/60"
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className={cn(
                                    "shrink-0 w-5 text-sm font-bold tabular-nums",
                                    entry.rank === 1 && "text-amber-500",
                                    entry.rank === 2 && "text-zinc-400",
                                    entry.rank === 3 && "text-orange-600",
                                    entry.rank > 3 && "text-muted-foreground"
                                  )}>{entry.rank}</span>
                                  <p
                                    className="text-sm font-medium truncate"
                                    style={entry.usernameColor ? { color: entry.usernameColor } : undefined}
                                  >{entry.username}</p>
                                </div>
                                <span className="shrink-0 text-sm font-medium tabular-nums">{Number(entry.value).toLocaleString('fr-FR')}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground")}>Classement aura indisponible.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {widgetId === 'inventory' && (
                    <Card className={dashboardWidgetCardClass}>
                      <CardHeader className={dashboardWidgetHeaderClass}>
                        <div className="flex items-center justify-between gap-3">
                          <DashboardWidgetTitle
                            title="Inventaire"
                            icon={Package}
                            iconClassName="text-blue-500"
                            iconWrapperClassName="bg-blue-500/15"
                          />
                          {totalInventoryCount > 0 && (
                            <Badge variant="secondary" className="tabular-nums">{totalInventoryCount}</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className={cn(dashboardWidgetContentClass, "flex flex-col")}>
                        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 text-sm">
                            <span>Cadeaux stockés</span>
                            <span className="tabular-nums text-muted-foreground">{giftInventoryCount}</span>
                          </div>

                          {inventoryItems.length > 0 ? (
                            <div className="space-y-2">
                              {inventoryItems.slice(0, 4).map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <p className="min-w-0 text-sm font-medium truncate">{item.item.name}</p>
                                    <Badge variant="outline" className={cn(
                                      "shrink-0 text-xs capitalize",
                                      item.item.type === 'CONSUMABLE' && "border-blue-500/40 text-blue-600",
                                      item.item.type === 'COSMETIC' && "border-violet-500/40 text-violet-600",
                                      item.item.type === 'UPGRADE' && "border-emerald-500/40 text-emerald-600",
                                      item.item.type === 'GIFT' && "border-rose-500/40 text-rose-600"
                                    )}>
                                      {item.item.type.toLowerCase()}
                                    </Badge>
                                  </div>
                                  <span className="shrink-0 text-sm font-medium tabular-nums">x{item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground")}>Aucun objet dans l&apos;inventaire.</p>
                          )}
                        </div>

                        <Button asChild variant="outline" className="mt-3 w-full">
                          <Link to="/inventory">Ouvrir l&apos;inventaire</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {widgetId === 'gifts' && (
                    <Card className={dashboardWidgetCardClass}>
                      <CardHeader className={dashboardWidgetHeaderClass}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <DashboardWidgetTitle
                              title="Cadeaux"
                              icon={GiftIcon}
                              iconClassName="text-rose-500"
                              iconWrapperClassName="bg-rose-500/15"
                            />
                            {inboxGifts.length > 0 && (
                              <Badge className="bg-rose-500 text-white hover:bg-rose-500/90 tabular-nums">
                                {inboxGifts.length}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={() => openGiftDialog('send')}>
                              Envoyer
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className={cn(dashboardWidgetContentClass, "flex flex-col")}>
                        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className={cn(
                              "rounded-lg border px-3 py-2.5",
                              inboxGifts.length > 0 ? "border-rose-500/30 bg-rose-500/5" : "border-border/60"
                            )}>
                              <p className={cn(TYPOGRAPHY.H2, "tabular-nums", inboxGifts.length > 0 && "text-rose-600")}>{inboxGifts.length}</p>
                              <p className={TYPOGRAPHY.SMALL}>en attente</p>
                            </div>
                            <div className="rounded-lg border border-border/60 px-3 py-2.5">
                              <p className={cn(TYPOGRAPHY.H2, "tabular-nums")}>{receivedGifts.length}</p>
                              <p className={TYPOGRAPHY.SMALL}>ouverts</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                            <div>
                              <p className={TYPOGRAPHY.SMALL}>Aura disponible</p>
                              <p className={cn(TYPOGRAPHY.H5, "tabular-nums")}>
                                {giftStatus?.remainingAura ?? 0}/{giftStatus?.limit ?? 50}
                              </p>
                            </div>
                            <p className={cn(TYPOGRAPHY.SMALL, "tabular-nums text-muted-foreground")}>
                              {nextRefillCountdown ?? '--:--:--'}
                            </p>
                          </div>

                          {giftsLoading ? (
                            <p className={cn(TYPOGRAPHY.MUTED)}>Chargement des cadeaux...</p>
                          ) : (
                            <div className="space-y-2">
                              {inboxGifts.length === 0 ? (
                                <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground")}>Aucun cadeau en attente.</p>
                              ) : (
                                inboxGifts.slice(0, 4).map((gift) => (
                                  <button
                                    key={gift.id}
                                    type="button"
                                    onClick={() => openGiftDialog('inbox')}
                                    className="block w-full rounded-lg border border-border/60 px-3 py-2.5 text-left transition hover:bg-accent/40"
                                  >
                                    <p className="text-sm font-medium truncate">Cadeau de {gift.sender.username}</p>
                                    <p className="text-xs text-muted-foreground">{formatTimeAgo(gift.createdAt)}</p>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>

                        <Button variant="outline" className="mt-3 w-full" onClick={() => openGiftDialog('inbox')}>
                          Ouvrir la boîte
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </SortableDashboardWidget>
              ))}
            </div>
          </SortableContext>
        </DndContext>
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

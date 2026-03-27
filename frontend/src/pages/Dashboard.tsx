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
import { useSocketBase } from '../contexts/SocketContext';
import { usePartySocket } from '../contexts/PartySocketContext';
import { ClanChatMessage, ClanPumpUpMessage, ClanSummary, ClanWarState, auraCoinApi, clansApi } from '../services/api';
import { GripVertical, Users, TrendingUp, TrendingDown, Star, Gamepad2, MessageSquare, Swords, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { resolveThemeImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';

interface GameShortcut {
  id: string;
  label: string;
  path: string;
  description: string;
  image?: string;
}

type DashboardWidgetId =
  | 'shortcuts'
  | 'live'
  | 'auracoin'
  | 'clan-wars'
  | 'clan-message'
  | 'clan-ranking';

const shortcutStorageKey = 'auratracker:dashboard-shortcuts';
const dashboardLayoutStorageKey = 'auratracker:dashboard-layout';
const dashboardVisibleWidgetsStorageKey = 'auratracker:dashboard-visible-widgets';
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
  { id: 'levier-infernal', label: 'Levier Infernal', path: '/games/levier-infernal', description: 'Leviers, bluff et explosion.', image: '/images/games/rouletterusse.png' },
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
];

const legacyDefaultShortcuts = [
  'doodle-jump',
  'flappy-bird',
  'bomb-party',
  '2048',
  'poker',
  'solitaire',
  'tetris',
  'racer',
  'petit-bac',
  'casino',
  'bataille-navale',
  'knife-hit',
];
const defaultShortcuts = legacyDefaultShortcuts.slice(0, maxShortcutWidgets);
const defaultShortcutSet = new Set(defaultShortcuts);

const defaultDashboardLayout: DashboardWidgetId[] = [
  'shortcuts',
  'live',
  'clan-wars',
  'clan-message',
  'clan-ranking',
  'auracoin',
];
const dashboardWidgetLabels: Record<DashboardWidgetId, { title: string; description: string }> = {
  shortcuts: { title: 'Raccourcis jeux', description: 'Accès rapide à tes jeux favoris.' },
  'clan-wars': { title: 'Guerres de clan', description: 'Suivi rapide des affrontements en cours.' },
  'clan-message': { title: 'Message du clan', description: 'Dernier message posté dans ton clan.' },
  'clan-ranking': { title: 'Classement des clans', description: 'Top clans par aura totale.' },
  auracoin: { title: 'Aura Coin', description: 'Prix et variation du marché.' },
  live: { title: 'Activité des parties', description: 'Parties ouvertes en direct.' },
};

const isDashboardWidgetId = (value: string): value is DashboardWidgetId =>
  ['shortcuts', 'live', 'auracoin', 'clan-wars', 'clan-message', 'clan-ranking'].includes(value);

const dashboardWidgetCardClass = "flex h-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-background shadow-none";
const dashboardWidgetHeaderClass = "px-4 pb-3 pt-4 sm:px-5";
const dashboardWidgetContentClass = "min-h-0 flex-1 px-4 pb-4 pt-0 sm:px-5 sm:pb-5";
const dashboardRowClass = "flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-3";
const dashboardGhostButtonClass = "border-border/50 bg-transparent shadow-none hover:bg-muted/30";
const dashboardCompactListClass = "space-y-2.5";

const formatNumber = (value: number | string | null | undefined) => {
  const numericValue = typeof value === 'string' ? Number(value) : value ?? 0;
  if (Number.isNaN(numericValue)) return '0';
  return numericValue.toLocaleString('fr-FR');
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

const getClanWarStatusLabel = (status: ClanWarState['status']) => {
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

const getWarOpponent = (war: ClanWarState, clanId: string | null) => {
  if (!clanId) return null;
  return war.attackerClan.id === clanId ? war.defenderClan : war.attackerClan;
};

function DashboardWidgetTitle({
  title,
  icon: _icon,
  iconClassName: _iconClassName,
  iconWrapperClassName: _iconWrapperClassName,
}: {
  title: string;
  icon: React.FC<{ className?: string }>;
  iconClassName: string;
  iconWrapperClassName: string;
}) {
  return (
    <div className="flex min-w-0 items-center">
      <CardTitle className="truncate text-base font-medium tracking-tight">{title}</CardTitle>
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
        "group relative min-h-0 h-[280px] md:h-[320px] xl:h-[340px]",
        isDragging && "z-20"
      )}
    >
      <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
        <button
          type="button"
          aria-label="Deplacer le widget"
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/50 bg-background text-muted-foreground transition hover:bg-muted/30 hover:text-foreground",
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

      <div className={cn("h-full", isDragging && "scale-[1.01] rounded-2xl ring-1 ring-foreground/10")}>
        {children}
      </div>
    </div>
  );
}

function ShortcutTile({ shortcut, theme }: { shortcut: GameShortcut; theme: 'light' | 'dark' }) {
  return (
    <Link
      to={shortcut.path}
      aria-label={shortcut.label}
      title={shortcut.label}
      className={cn(
        "group relative block h-full min-h-[96px] overflow-hidden rounded-xl border border-border/50 bg-muted/20 transition hover:border-foreground/20 hover:bg-muted/40",
        !shortcut.image && "flex items-center justify-center"
      )}
    >
      {shortcut.image ? (
        <img
          src={resolveThemeImageUrl(shortcut.image, theme)}
          alt={shortcut.label}
          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
          loading="lazy"
        />
      ) : (
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {shortcut.label.slice(0, 2)}
        </span>
      )}
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
  const { theme } = useTheme();
  const { socket } = useSocketBase();
  const { fetchPublicParties, publicParties, currentParty, joinParty, requestJoinParty, pendingJoinRequests } = usePartySocket();
  const [loading, setLoading] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState(() => pickWelcomeMessage(user?.username));
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shortcutsLoaded, setShortcutsLoaded] = useState(false);
  const [shortcutWidgets, setShortcutWidgets] = useState<string[]>(defaultShortcuts);
  const [dashboardLayout, setDashboardLayout] = useState<DashboardWidgetId[]>(defaultDashboardLayout);
  const [dashboardLayoutLoaded, setDashboardLayoutLoaded] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<DashboardWidgetId[]>(defaultDashboardLayout);
  const [visibleWidgetsLoaded, setVisibleWidgetsLoaded] = useState(false);
  const [widgetsDialogOpen, setWidgetsDialogOpen] = useState(false);
  const [auraCoinPrice, setAuraCoinPrice] = useState<number | null>(null);
  const [auraCoinPreviousPrice, setAuraCoinPreviousPrice] = useState<number | null>(null);
  const [auraCoinHistory, setAuraCoinHistory] = useState<{ price: number; time: string }[]>([]);
  const [clans, setClans] = useState<ClanSummary[]>([]);
  const [activeWars, setActiveWars] = useState<ClanWarState[]>([]);
  const [viewerClanId, setViewerClanId] = useState<string | null>(null);
  const [latestClanMessage, setLatestClanMessage] = useState<ClanChatMessage | null>(null);
  const [clanMessageLoading, setClanMessageLoading] = useState(false);
  const [clanPumpUpMessage, setClanPumpUpMessage] = useState<ClanPumpUpMessage | null>(null);

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
  const rankedClans = useMemo(
    () => [...clans].sort((a, b) => Number(b.totalAura) - Number(a.totalAura)).slice(0, 5),
    [clans]
  );
  const featuredWars = useMemo(() => {
    const prioritized = [...activeWars].sort((a, b) => {
      const aHasViewerClan = viewerClanId && (a.attackerClan.id === viewerClanId || a.defenderClan.id === viewerClanId) ? 1 : 0;
      const bHasViewerClan = viewerClanId && (b.attackerClan.id === viewerClanId || b.defenderClan.id === viewerClanId) ? 1 : 0;
      if (aHasViewerClan !== bHasViewerClan) return bHasViewerClan - aHasViewerClan;
      return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
    });

    return prioritized.slice(0, 3);
  }, [activeWars, viewerClanId]);
  const viewerClan = useMemo(
    () => clans.find((clan) => clan.id === viewerClanId) ?? null,
    [clans, viewerClanId]
  );

  useEffect(() => {
    if (!user?.username) return;
    setWelcomeMessage(pickWelcomeMessage(user.username));
  }, [user?.username]);

  const fetchLatestClanMessage = async (clanId: string) => {
    setClanMessageLoading(true);
    try {
      const response = await clansApi.getChat(clanId, 1);
      setLatestClanMessage(response.data.messages[0] ?? null);
    } catch (error) {
      console.error('Failed to fetch latest clan message:', error);
      setLatestClanMessage(null);
    } finally {
      setClanMessageLoading(false);
    }
  };

  const fetchClanPumpUpMessage = async (clanId: string) => {
    try {
      const response = await clansApi.getPumpUpMessages(clanId);
      const messages = response.data.messages;
      if (messages.length > 0) {
        setClanPumpUpMessage(messages[Math.floor(Math.random() * messages.length)]);
      }
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [auraCoinRes, clansRes] = await Promise.allSettled([
          auraCoinApi.getPrice(4),
          clansApi.list(),
        ]);

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

        if (clansRes.status === 'fulfilled') {
          setClans(clansRes.value.data.clans);
          setActiveWars(clansRes.value.data.meta.activeWars);
          setViewerClanId(clansRes.value.data.meta.viewerClanId);

          if (clansRes.value.data.meta.viewerClanId) {
            await fetchLatestClanMessage(clansRes.value.data.meta.viewerClanId);
            await fetchClanPumpUpMessage(clansRes.value.data.meta.viewerClanId);
          } else {
            setLatestClanMessage(null);
          }
        }

      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
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
                ? [...new Set([...filtered, ...legacyDefaultShortcuts])].slice(0, maxShortcutWidgets)
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
      localStorage.removeItem('auratracker:dashboard-quick-actions');
    } catch {
      // Ignore localStorage write failures.
    }
  }, []);

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

  const auraCoinDelta = useMemo(() => {
    if (auraCoinPrice === null || auraCoinPreviousPrice === null || auraCoinPreviousPrice === 0) return null;
    return ((auraCoinPrice - auraCoinPreviousPrice) / auraCoinPreviousPrice) * 100;
  }, [auraCoinPrice, auraCoinPreviousPrice]);

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
      <div className="w-full space-y-6 px-4 pb-6 lg:px-6 lg:pb-8">
        <div className="flex flex-col gap-3 px-1 py-1 lg:flex-row lg:items-start lg:justify-between">
          <div className={cn("space-y-2", SPACING.TIGHT_SPACING)}>
            {clanPumpUpMessage ? (
              <p
                className="text-3xl font-semibold tracking-tight md:text-4xl"
                style={{ color: clanPumpUpMessage.color }}
              >
                {clanPumpUpMessage.content.replace('{name}', user?.username ?? '')}
              </p>
            ) : (
              <p className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                {welcomeMessage || `Bienvenue, ${user?.username ?? ''}`}
              </p>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Dialog open={widgetsDialogOpen} onOpenChange={setWidgetsDialogOpen}>
              <Button variant="outline" className={dashboardGhostButtonClass} onClick={() => setWidgetsDialogOpen(true)}>
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
                    className="hover:bg-muted/30"
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
              className="hover:bg-muted/30"
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:gap-5">
              {visibleDashboardLayout.map((widgetId) => (
                <SortableDashboardWidget
                  key={widgetId}
                  widgetId={widgetId}
                >
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
                            <Button variant="outline" size="sm" className={dashboardGhostButtonClass} onClick={() => setShortcutsOpen(true)}>
                              Modifier
                            </Button>
                            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className={TYPOGRAPHY.H5}>Widgets de raccourcis</DialogTitle>
                                <DialogDescription>
                                  Active les jeux à afficher dans le widget. Maximum {maxShortcutWidgets} jeux.
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
                      <CardContent className={dashboardWidgetContentClass}>
                        <div className="grid h-full grid-cols-2 grid-rows-2 gap-3">
                          {orderedShortcuts.length > 0 ? (
                            orderedShortcuts.map((shortcut) => (
                              <ShortcutTile key={shortcut.id} shortcut={shortcut} theme={theme} />
                            ))
                          ) : (
                              <Card className="col-span-full border-dashed border-border/50 bg-muted/10 shadow-none">
                                <CardContent className="p-6 text-center">
                                  <p className={TYPOGRAPHY.SMALL}>Aucun widget actif. Ajoute des jeux pour un accès rapide.</p>
                                </CardContent>
                            </Card>
                          )}
                        </div>
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
                            <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
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
                                <div key={party.id} className={dashboardRowClass}>
                                  <div className="min-w-0">
                                    <p className={TYPOGRAPHY.SMALL}>{party.name || 'Party sans nom'}</p>
                                    <p className={cn(TYPOGRAPHY.XS, "truncate text-muted-foreground")}>
                                      {party.selectedGame?.gameName || 'Pas de jeu'} · {party.memberCount}/{party.maxSize}
                                    </p>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn("shrink-0", dashboardGhostButtonClass)}
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

                  {widgetId === 'clan-wars' && (
                    <Card className={dashboardWidgetCardClass}>
                      <CardHeader className={dashboardWidgetHeaderClass}>
                        <div className="flex items-center justify-between gap-3">
                          <DashboardWidgetTitle
                            title="Guerres de clan"
                            icon={Swords}
                            iconClassName="text-rose-500"
                            iconWrapperClassName="bg-rose-500/15"
                          />
                          {activeWars.length > 0 && (
                            <Badge variant="secondary" className="border border-border/50 bg-muted/30 tabular-nums">
                              {activeWars.length}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className={cn(dashboardWidgetContentClass, "flex flex-col")}>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                          {featuredWars.length === 0 ? (
                            <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground")}>Aucune guerre active pour le moment.</p>
                          ) : (
                            <div className={dashboardCompactListClass}>
                              {featuredWars.map((war) => {
                                const isViewerWar = !!viewerClanId && (war.attackerClan.id === viewerClanId || war.defenderClan.id === viewerClanId);
                                const opponent = getWarOpponent(war, viewerClanId);
                                const countdownLabel = war.status === 'PREPARING' ? formatCountdown(war.startsAt) : formatCountdown(war.endsAt);

                                return (
                                  <div key={war.id} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className="truncate text-sm font-medium">
                                            {isViewerWar && opponent ? `Vs ${opponent.name}` : `${war.attackerClan.name} vs ${war.defenderClan.name}`}
                                          </p>
                                          {isViewerWar && (
                                            <Badge variant="outline" className="border-border/50 bg-background text-[10px] uppercase tracking-[0.18em]">
                                              Ton clan
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          {getClanWarStatusLabel(war.status)}
                                          {countdownLabel ? ` · ${war.status === 'PREPARING' ? 'départ' : 'fin'} ${countdownLabel}` : ''}
                                        </p>
                                      </div>
                                      <span className="shrink-0 text-sm font-medium tabular-nums">
                                        {war.attackerScore} - {war.defenderScore}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <Button asChild variant="outline" className={cn("mt-3 w-full", dashboardGhostButtonClass)}>
                          <Link to="/clans">Voir les guerres</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {widgetId === 'clan-message' && (
                    <Card className={dashboardWidgetCardClass}>
                      <CardHeader className={dashboardWidgetHeaderClass}>
                        <div className="flex items-center justify-between gap-3">
                          <DashboardWidgetTitle
                            title="Message du clan"
                            icon={MessageSquare}
                            iconClassName="text-emerald-500"
                            iconWrapperClassName="bg-emerald-500/15"
                          />
                          {viewerClan && (
                            <Badge variant="outline" className="border-border/50 bg-background">
                              {viewerClan.name}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className={cn(dashboardWidgetContentClass, "flex flex-col")}>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                          {!viewerClanId ? (
                            <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 px-4 py-4">
                              <p className="text-sm font-medium">Tu n&apos;as pas encore de clan.</p>
                              <p className="mt-1 text-xs text-muted-foreground">Rejoins-en un pour voir ses messages ici.</p>
                            </div>
                          ) : clanMessageLoading ? (
                            <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground")}>Chargement du salon de clan...</p>
                          ) : latestClanMessage ? (
                            <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium">{latestClanMessage.user.username}</p>
                                <p className="shrink-0 text-xs text-muted-foreground">{formatTimeAgo(latestClanMessage.createdAt)}</p>
                              </div>
                              <p className="text-sm leading-6 text-foreground/90">{latestClanMessage.message}</p>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-border/50 bg-muted/10 px-4 py-4">
                              <p className="text-sm font-medium">Aucun message récent.</p>
                              <p className="mt-1 text-xs text-muted-foreground">Le chat de clan est prêt quand quelqu&apos;un écrit.</p>
                            </div>
                          )}
                        </div>

                        <Button asChild variant="outline" className={cn("mt-3 w-full", dashboardGhostButtonClass)}>
                          <Link to="/clans">Ouvrir le clan</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {widgetId === 'clan-ranking' && (
                    <Card className={dashboardWidgetCardClass}>
                      <CardHeader className={dashboardWidgetHeaderClass}>
                        <div className="flex items-center justify-between gap-3">
                          <DashboardWidgetTitle
                            title="Classement des clans"
                            icon={Crown}
                            iconClassName="text-amber-500"
                            iconWrapperClassName="bg-amber-500/15"
                          />
                          {clans.length > 0 && (
                            <Badge variant="secondary" className="border border-border/50 bg-muted/30">
                              Top {Math.min(rankedClans.length, 5)}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className={cn(dashboardWidgetContentClass, "flex flex-col")}>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                          {rankedClans.length === 0 ? (
                            <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground")}>Aucun clan à classer pour le moment.</p>
                          ) : (
                            <div className={dashboardCompactListClass}>
                              {rankedClans.map((clan, index) => (
                                <div key={clan.id} className={dashboardRowClass}>
                                  <div className="flex min-w-0 items-center gap-3">
                                    <span className="w-5 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                                      #{index + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">{clan.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {clan.memberCount}/{clan.maxMembers} membres
                                      </p>
                                    </div>
                                  </div>
                                  <span className="shrink-0 text-sm font-medium tabular-nums">
                                    {formatNumber(clan.totalAura)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <Button asChild variant="outline" className={cn("mt-3 w-full", dashboardGhostButtonClass)}>
                          <Link to="/clans">Voir les clans</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {widgetId === 'auracoin' && (() => {
                    const isUp = (auraCoinDelta ?? 0) >= 0;
                    const auraCoinChartConfig = {
                      price: {
                        label: 'Prix',
                        color: isUp ? '#10b981' : '#ef4444',
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
                            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
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
                            <p className="text-4xl font-semibold tracking-tight tabular-nums md:text-[2.75rem]">
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

                          <Button asChild variant="outline" className={cn("mt-3 w-full", dashboardGhostButtonClass)}>
                            <Link to="/games/aura-coin">Ouvrir Aura Coin</Link>
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })()}

                </SortableDashboardWidget>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </>
  );
}

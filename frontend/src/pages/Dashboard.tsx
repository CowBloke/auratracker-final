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
import { useFeatures } from '../contexts/FeaturesContext';
import {
  AuraTransferEntry,
  ClanPumpUpMessage,
  ClanWarState,
  DailyAuraState,
  ReferralSummary,
  authApi,
  auraCoinApi,
  clansApi,
  economyApi,
  marketRoomApi,
  usersApi,
} from '../services/api';
import { GripVertical, Users, TrendingUp, TrendingDown, Star, Gamepad2, Swords, Loader2, Ticket, Copy } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AreaChart, Area, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { resolveImageUrl, resolveThemeImageUrl } from '@/lib/images';
import { getGameImage } from '@/lib/game-images';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface GameShortcut {
  id: string;
  label: string;
  path: string;
  description: string;
  image?: string;
}

interface AuraTargetUser {
  id: string;
  username: string;
  usernameColor?: string | null;
  aura: number;
}

interface ClanWarWidgetItem {
  id: string;
  status: ClanWarState['status'];
  startsAt: string;
  endsAt: string;
  targetScore: number;
  attackerScore: number;
  defenderScore: number;
  scoreGap: number;
  attackerClan: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  defenderClan: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
}

type DashboardWidgetId =
  | 'shortcuts'
  | 'aura-flow'
  | 'aura-history'
  | 'live'
  | 'auracoin'
  | 'stablecoin'
  | 'chaoscoin'
  | 'clan-wars'
  | 'referral';

const shortcutStorageKey = 'auratracker:dashboard-shortcuts';
const dashboardLayoutStorageKey = 'auratracker:dashboard-layout';
const dashboardVisibleWidgetsStorageKey = 'auratracker:dashboard-visible-widgets';
const maxShortcutWidgets = 12;

const welcomeTemplates = [
  'Bienvenue, {username}',
  'Heureux de te revoir {username}, prêt pour AuraTracker ?',
  'Salut {username} ! On lance une partie ?',
  'Yo {username}, l’équipe t’attend.',
  'Hey {username}, tu reviens charger l’aura ?',
  '{username}, ça faisait longtemps !',
  'Content de te revoir {username} !',
  'Re {username} - place au fun.',
  'Prêt à tout éclater, {username} ?',
  'Bon retour {username}, ça va chauffer.',
  '{username}, on remet ça ?',
  'Bienvenue à bord, {username}.',
  'Salut {username}, on part sur des jeux ?',
  '{username}, le tableau de bord est prêt.',
  'Heureux de te revoir {username} !',
  'Bon retour {username}, tu es prêt ?',
];

const pickWelcomeMessage = (username?: string) => {
  const name = username || 'toi';
  const template = welcomeTemplates[Math.floor(Math.random() * welcomeTemplates.length)];
  return template.replace('{username}', name);
};

const gameShortcuts: GameShortcut[] = [
  { id: 'bomb-party', label: 'Bombe de mots', path: '/games/bomb-party', description: 'Mots explosifs en équipe.', image: getGameImage('bomb-party') },
  { id: 'poker', label: 'Poker', path: '/games/poker', description: 'Table rapide, mise prudente.', image: getGameImage('poker') },
  { id: 'petit-bac', label: 'Petit Bac', path: '/games/petit-bac', description: 'Catégories, lettres, vitesse.', image: getGameImage('petit-bac') },
  { id: 'casino', label: 'Casino', path: '/games/casino', description: 'Mini-jeux et mises rapides.', image: getGameImage('casino') },
  { id: 'market-room', label: 'Salle de marché', path: '/games/salle-de-marche', description: 'Hub crypto avec trois marchés.', image: getGameImage('market-room') },
  { id: 'polymarket', label: 'Polymarket', path: '/polymarket', description: 'Paris en temps réel.' },
  { id: 'doodle-jump', label: 'Doodle Jump', path: '/games/doodle-jump', description: 'Grimpe sans fin.', image: getGameImage('doodle-jump') },
  { id: '2048', label: '2048', path: '/games/2048', description: "Fusionne jusqu'à 2048.", image: getGameImage('game-2048') },
  { id: 'flappy-bird', label: 'Flappy Bird', path: '/games/flappy-bird', description: 'Timing parfait.', image: getGameImage('flappy-bird') },
  { id: 'bataille-navale', label: 'Bataille Navale', path: '/games/bataille-navale', description: 'Touches, coulés, gagne.', image: getGameImage('bataille-navale') },
  { id: 'solitaire', label: 'Solitaire', path: '/games/solitaire', description: 'Classique et relax.', image: getGameImage('solitaire') },
  { id: 'racer', label: 'Racer', path: '/games/racer', description: 'Course pseudo-3D style Outrun.', image: getGameImage('racer') },
  { id: 'tetris', label: 'Tetris', path: '/games/tetris', description: 'Puzzle classique et addictif.', image: getGameImage('tetris') },
  { id: 'knife-hit', label: 'Knife Hit', path: '/games/knife-hit', description: 'Timing sec et précision.', image: getGameImage('knife-hit') },
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
  'referral',
  'aura-flow',
  'aura-history',
  'live',
  'clan-wars',
  'auracoin',
  'stablecoin',
  'chaoscoin',
];
const dashboardWidgetLabels: Record<DashboardWidgetId, { title: string; description: string }> = {
  shortcuts: { title: 'Raccourcis jeux', description: 'Accès rapide à tes jeux favoris.' },
  referral: { title: 'Parrainage', description: 'Ton code, tes stats et un accès rapide au partage.' },
  'aura-flow': { title: 'Distribution d aura', description: 'Envoie ou retire ton quota d aura journalier.' },
  'aura-history': { title: 'Historique aura', description: 'Tous les envois et retraits d aura du site.' },
  'clan-wars': { title: 'Guerres de clan', description: 'Suivi rapide des affrontements en cours.' },
  auracoin: { title: 'Aura Coin', description: 'Prix et variation du marché.' },
  stablecoin: { title: 'Aura Stable', description: 'Prix et variation du marché stable.' },
  chaoscoin: { title: 'Chaos Coin', description: 'Prix et variation du marché volatil.' },
  live: { title: 'Activité des parties', description: 'Parties ouvertes en direct.' },
};

const isDashboardWidgetId = (value: string): value is DashboardWidgetId =>
  ['shortcuts', 'referral', 'aura-flow', 'aura-history', 'live', 'auracoin', 'stablecoin', 'chaoscoin', 'clan-wars'].includes(value);

const dashboardWidgetCardClass = "flex h-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-background shadow-none";
const dashboardWidgetHeaderClass = "px-4 pb-3 pt-4 sm:px-5";
const dashboardWidgetContentClass = "min-h-0 flex-1 px-4 pb-4 pt-0 sm:px-5 sm:pb-5";
const dashboardRowClass = "flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-3";
const dashboardGhostButtonClass = "border-border/50 bg-transparent shadow-none hover:bg-muted/30";
const dashboardCompactListClass = "space-y-2.5";

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

const getWarOpponent = (war: ClanWarWidgetItem, clanId: string | null) => {
  if (!clanId) return null;
  return war.attackerClan.id === clanId ? war.defenderClan : war.attackerClan;
};

const getAvatarFallback = (value: string) => value.trim().slice(0, 2).toUpperCase();

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
        "group relative block aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted/20 transition hover:border-foreground/30 hover:shadow-sm",
        !shortcut.image && "flex items-end"
      )}
    >
      {shortcut.image ? (
        <>
          <img
            src={resolveThemeImageUrl(shortcut.image, theme)}
            alt={shortcut.label}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="relative z-10 flex h-full flex-col justify-end p-2 text-white">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Jeu</p>
            <p className="text-sm font-semibold leading-tight">{shortcut.label}</p>
          </div>
        </>
      ) : (
        <div className="flex h-full w-full flex-col justify-end bg-gradient-to-t from-muted/70 via-muted/30 to-transparent p-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Jeu</p>
          <p className="text-sm font-semibold leading-tight">{shortcut.label}</p>
        </div>
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
  const { user, refreshUser } = useAuth();
  const { maintenanceStatus } = useFeatures();
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
  const [stableCoinPrice, setStableCoinPrice] = useState<number | null>(null);
  const [stableCoinPreviousPrice, setStableCoinPreviousPrice] = useState<number | null>(null);
  const [stableCoinHistory, setStableCoinHistory] = useState<{ price: number; time: string }[]>([]);
  const [chaosCoinPrice, setChaosCoinPrice] = useState<number | null>(null);
  const [chaosCoinPreviousPrice, setChaosCoinPreviousPrice] = useState<number | null>(null);
  const [chaosCoinHistory, setChaosCoinHistory] = useState<{ price: number; time: string }[]>([]);
  const [activeWars, setActiveWars] = useState<ClanWarState[]>([]);
  const [viewerClanId, setViewerClanId] = useState<string | null>(null);
  const [clanPumpUpMessage, setClanPumpUpMessage] = useState<ClanPumpUpMessage | null>(null);
  const [dailyAuraState, setDailyAuraState] = useState<DailyAuraState | null>(null);
  const [dailyAuraHistory, setDailyAuraHistory] = useState<AuraTransferEntry[]>([]);
  const [auraUsers, setAuraUsers] = useState<AuraTargetUser[]>([]);
  const [selectedAuraUserId, setSelectedAuraUserId] = useState('');
  const [auraAction, setAuraAction] = useState<'give' | 'take'>('give');
  const [auraAmountInput, setAuraAmountInput] = useState('10');
  const [auraMessage, setAuraMessage] = useState('');
  const [auraWidgetLoading, setAuraWidgetLoading] = useState(false);
  const [submittingAuraTransfer, setSubmittingAuraTransfer] = useState(false);
  const [resetCountdown, setResetCountdown] = useState('--:--:--');
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);

  const referralWidgetEnabled = maintenanceStatus.referralDashboardCardEnabled;
  const referralEnabled = maintenanceStatus.referralEnabled;

  const shortcutMap = useMemo(() => new Map(gameShortcuts.map((item) => [item.id, item])), []);
  const availableDashboardWidgets = useMemo(
    () => defaultDashboardLayout.filter((widgetId) => widgetId !== 'referral' || referralWidgetEnabled),
    [referralWidgetEnabled]
  );
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
    () => dashboardLayout.filter((widgetId) => visibleWidgets.includes(widgetId) && availableDashboardWidgets.includes(widgetId)),
    [availableDashboardWidgets, dashboardLayout, visibleWidgets]
  );
  const featuredWars = useMemo<ClanWarWidgetItem[]>(() => {
    const prioritized = [...activeWars].sort((a, b) => {
      const aHasViewerClan = viewerClanId && (a.attackerClan.id === viewerClanId || a.defenderClan.id === viewerClanId) ? 1 : 0;
      const bHasViewerClan = viewerClanId && (b.attackerClan.id === viewerClanId || b.defenderClan.id === viewerClanId) ? 1 : 0;
      if (aHasViewerClan !== bHasViewerClan) return bHasViewerClan - aHasViewerClan;
      return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
    });

    return prioritized.slice(0, 3).map((war) => ({
      id: war.id,
      status: war.status,
      startsAt: war.startsAt,
      endsAt: war.endsAt,
      targetScore: war.targetScore,
      attackerScore: war.attackerScore,
      defenderScore: war.defenderScore,
      scoreGap: war.scoreGap,
      attackerClan: {
        id: war.attackerClan.id,
        name: war.attackerClan.name,
        imageUrl: war.attackerClan.imageUrl,
      },
      defenderClan: {
        id: war.defenderClan.id,
        name: war.defenderClan.name,
        imageUrl: war.defenderClan.imageUrl,
      },
    }));
  }, [activeWars, viewerClanId]);
  const livePartiesForWidget = publicParties;
  const warsForWidget: ClanWarWidgetItem[] = featuredWars;
  const selectedAuraUser = useMemo(
    () => auraUsers.find((candidate) => candidate.id === selectedAuraUserId) ?? null,
    [auraUsers, selectedAuraUserId]
  );
  const remainingAura = dailyAuraState?.remainingAura ?? 0;

  useEffect(() => {
    if (!user?.username) return;
    setWelcomeMessage(pickWelcomeMessage(user.username));
  }, [user?.username]);

  const fetchClanPumpUpMessage = async (clanId: string) => {
    try {
      const response = await clansApi.getPumpUpMessages(clanId);
      const messages = response.data.messages;
      if (messages.length > 0) {
        setClanPumpUpMessage(messages[Math.floor(Math.random() * messages.length)]);
      } else {
        setClanPumpUpMessage(null);
      }
    } catch {
      setClanPumpUpMessage(null);
    }
  };

  const fetchAuraWidgetData = async () => {
    try {
      setAuraWidgetLoading(true);
      const [stateRes, transfersRes, usersRes] = await Promise.all([
        economyApi.getState(),
        economyApi.getTransfers({ all: true, limit: 100 }),
        usersApi.getAll(),
      ]);

      setDailyAuraState(stateRes.data.state);
      setDailyAuraHistory(transfersRes.data.transfers);
      setAuraUsers(
        (usersRes.data.users as Array<{ id: string; username: string; usernameColor?: string | null; aura: number }>)
          .filter((candidate) => candidate.id !== user?.id)
          .map((candidate) => ({
            id: candidate.id,
            username: candidate.username,
            usernameColor: candidate.usernameColor ?? null,
            aura: Number(candidate.aura ?? 0),
          }))
      );
    } catch (error) {
      console.error('Failed to fetch aura widget data:', error);
    } finally {
      setAuraWidgetLoading(false);
    }
  };

  const submitAuraTransfer = async () => {
    const parsedAmount = Number.parseInt(auraAmountInput, 10);
    if (!selectedAuraUserId) {
      toast.error('Choisis un joueur.');
      return;
    }

    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      toast.error('Entre un nombre d aura positif.');
      return;
    }

    if (!auraMessage.trim()) {
      toast.error('Ajoute une justification.');
      return;
    }

    try {
      setSubmittingAuraTransfer(true);
      await economyApi.transfer({
        receiverId: selectedAuraUserId,
        auraAmount: auraAction === 'give' ? parsedAmount : -parsedAmount,
        message: auraMessage.trim(),
      });
      await fetchAuraWidgetData();
      setAuraMessage('');
      await refreshUser();
      toast.success(auraAction === 'give' ? 'Aura envoyee.' : 'Aura retiree.');
    } catch (error: any) {
      console.error('Failed to submit aura transfer:', error);
      toast.error(error?.response?.data?.error || 'Impossible de distribuer cette aura.');
    } finally {
      setSubmittingAuraTransfer(false);
    }
  };

  useEffect(() => {
    if (!referralWidgetEnabled) {
      setReferralSummary(null);
      setReferralLoading(false);
      return;
    }

    if (!referralEnabled) {
      setReferralSummary(null);
      setReferralLoading(false);
      return;
    }

    let cancelled = false;
    setReferralLoading(true);
    authApi.getReferralSummary()
      .then((res) => {
        if (!cancelled) setReferralSummary(res.data);
      })
      .catch(() => {
        if (!cancelled) setReferralSummary(null);
      })
      .finally(() => {
        if (!cancelled) setReferralLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [referralEnabled, referralWidgetEnabled]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [auraCoinRes, stableCoinRes, chaosCoinRes, clansRes, auraWidgetRes] = await Promise.allSettled([
          auraCoinApi.getPrice(4),
          marketRoomApi.getCoin('stable-coin').getPrice(4),
          marketRoomApi.getCoin('chaos-coin').getPrice(4),
          clansApi.list(),
          fetchAuraWidgetData(),
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

        if (stableCoinRes.status === 'fulfilled') {
          const { currentPrice, history } = stableCoinRes.value.data;
          setStableCoinPrice(currentPrice);
          setStableCoinPreviousPrice(history[1]?.price ?? history[0]?.price ?? currentPrice);
          setStableCoinHistory(
            history.map((h) => ({
              price: h.price,
              time: new Date(h.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            }))
          );
        }

        if (chaosCoinRes.status === 'fulfilled') {
          const { currentPrice, history } = chaosCoinRes.value.data;
          setChaosCoinPrice(currentPrice);
          setChaosCoinPreviousPrice(history[1]?.price ?? history[0]?.price ?? currentPrice);
          setChaosCoinHistory(
            history.map((h) => ({
              price: h.price,
              time: new Date(h.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            }))
          );
        }

        if (clansRes.status === 'fulfilled') {
          setActiveWars(clansRes.value.data.meta.activeWars);
          setViewerClanId(clansRes.value.data.meta.viewerClanId);

          if (clansRes.value.data.meta.viewerClanId) {
            await fetchClanPumpUpMessage(clansRes.value.data.meta.viewerClanId);
          } else {
            setClanPumpUpMessage(null);
          }
        }

        if (auraWidgetRes.status === 'rejected') {
          console.error('Failed to fetch aura widget data:', auraWidgetRes.reason);
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

    const handleStableCoinPriceUpdate = (data: { price: number }) => {
      setStableCoinPreviousPrice((prev) => stableCoinPrice ?? prev);
      setStableCoinPrice(data.price);
    };

    const handleChaosCoinPriceUpdate = (data: { price: number }) => {
      setChaosCoinPreviousPrice((prev) => chaosCoinPrice ?? prev);
      setChaosCoinPrice(data.price);
    };

    socket.on('auracoin:price-update', handleAuraCoinPriceUpdate);
    socket.on('market-room:stable-coin:price-update', handleStableCoinPriceUpdate);
    socket.on('market-room:chaos-coin:price-update', handleChaosCoinPriceUpdate);
    return () => {
      socket.off('auracoin:price-update', handleAuraCoinPriceUpdate);
      socket.off('market-room:stable-coin:price-update', handleStableCoinPriceUpdate);
      socket.off('market-room:chaos-coin:price-update', handleChaosCoinPriceUpdate);
    };
  }, [socket, auraCoinPrice, stableCoinPrice, chaosCoinPrice]);

  useEffect(() => {
    if (!dailyAuraState?.nextResetAt) {
      setResetCountdown('--:--:--');
      return;
    }

    const updateCountdown = () => {
      const diffMs = new Date(dailyAuraState.nextResetAt).getTime() - Date.now();
      if (diffMs <= 0) {
        setResetCountdown('00:00:00');
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setResetCountdown(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [dailyAuraState?.nextResetAt]);

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
    setDashboardLayout((current) => {
      const filtered = current.filter((widgetId) => availableDashboardWidgets.includes(widgetId));
      const missing = availableDashboardWidgets.filter((widgetId) => !filtered.includes(widgetId));
      return [...filtered, ...missing];
    });

    setVisibleWidgets((current) => {
      const filtered = current.filter((widgetId) => availableDashboardWidgets.includes(widgetId));
      return filtered.length > 0 ? filtered : availableDashboardWidgets;
    });
  }, [availableDashboardWidgets]);

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

  const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

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

  const stableCoinDelta = useMemo(() => {
    if (stableCoinPrice === null || stableCoinPreviousPrice === null || stableCoinPreviousPrice === 0) return null;
    return ((stableCoinPrice - stableCoinPreviousPrice) / stableCoinPreviousPrice) * 100;
  }, [stableCoinPrice, stableCoinPreviousPrice]);

  const chaosCoinDelta = useMemo(() => {
    if (chaosCoinPrice === null || chaosCoinPreviousPrice === null || chaosCoinPreviousPrice === 0) return null;
    return ((chaosCoinPrice - chaosCoinPreviousPrice) / chaosCoinPreviousPrice) * 100;
  }, [chaosCoinPrice, chaosCoinPreviousPrice]);

  const renderCoinWidget = ({
    title,
    price,
    delta,
    history,
    gradientId,
    route,
    buttonLabel,
  }: {
    title: string;
    price: number | null;
    delta: number | null;
    history: { price: number; time: string }[];
    gradientId: string;
    route: string;
    buttonLabel: string;
  }) => {
    const isUp = (delta ?? 0) >= 0;
    const chartConfig = {
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
              title={title}
              icon={Star}
              iconClassName="text-primary"
              iconWrapperClassName="bg-primary/15"
            />
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {delta !== null && (
                isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
              )}
              <span className="tabular-nums">
                {delta === null ? 'N/A' : `${isUp ? '+' : ''}${delta.toFixed(2)}%`}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn(dashboardWidgetContentClass, "flex flex-col")}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <p className="text-4xl font-semibold tracking-tight tabular-nums md:text-[2.75rem]">
              {price === null ? '--' : `$${price.toFixed(2)}`}
            </p>

            {history.length >= 2 ? (
              <ChartContainer config={chartConfig} className="!aspect-auto h-20 w-full sm:h-24">
                <AreaChart data={history} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-price)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--color-price)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <ChartTooltip
                    cursor={{ stroke: 'var(--color-price)', strokeWidth: 1, strokeDasharray: '4 2' }}
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
                    fill={`url(#${gradientId})`}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: 'var(--color-price)', strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-20 sm:h-24" />
            )}
          </div>

          <Button asChild variant="outline" className={cn("mt-3 w-full", dashboardGhostButtonClass)}>
            <Link to={route}>{buttonLabel}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  };

  const handleReferralCopy = async () => {
    if (!referralSummary?.referralCode) return;
    try {
      await navigator.clipboard.writeText(referralSummary.referralCode);
      toast.success('Code de parrainage copie.');
    } catch {
      toast.error('Copie impossible pour le moment.');
    }
  };

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
                  {visibleDashboardLayout.length}/{availableDashboardWidgets.length} visibles
                </p>
                <div className="space-y-3">
                  {availableDashboardWidgets.map((widgetId) => {
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
                    onClick={() => setVisibleWidgets(availableDashboardWidgets)}
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
                setDashboardLayout(availableDashboardWidgets);
                setVisibleWidgets(availableDashboardWidgets);
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
                        <div className="grid grid-cols-4 content-start gap-2">
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

                  {widgetId === 'referral' && (
                    <Card className={dashboardWidgetCardClass}>
                      <CardHeader className={dashboardWidgetHeaderClass}>
                        <div className="flex items-center justify-between gap-3">
                          <DashboardWidgetTitle
                            title="Parrainage"
                            icon={Ticket}
                            iconClassName="text-fuchsia-500"
                            iconWrapperClassName="bg-fuchsia-500/15"
                          />
                          {referralSummary ? (
                            <Badge variant="secondary" className="border border-border/50 bg-muted/30">
                              +{referralSummary.rewardAmount} chacun
                            </Badge>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className={cn(dashboardWidgetContentClass, "flex flex-col")}>
                        {referralLoading ? (
                          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Chargement...
                          </div>
                        ) : !referralEnabled ? (
                          <div className="flex min-h-0 flex-1 flex-col justify-between gap-4">
                            <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-4">
                              <p className="text-sm font-medium">Parrainage désactivé</p>
                              <p className="mt-1 text-xs text-muted-foreground">Le système de parrainage est masqué pour le moment.</p>
                            </div>
                            <Button asChild variant="outline" className={dashboardGhostButtonClass}>
                              <Link to="/settings">Ouvrir les paramètres</Link>
                            </Button>
                          </div>
                        ) : !referralSummary ? (
                          <div className="flex min-h-0 flex-1 flex-col justify-between gap-4">
                            <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-4">
                              <p className="text-sm text-muted-foreground">Impossible de charger le parrainage pour le moment.</p>
                            </div>
                            <Button asChild variant="outline" className={dashboardGhostButtonClass}>
                              <Link to="/settings">Réessayer depuis les paramètres</Link>
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="min-h-0 flex-1 space-y-4">
                              <div className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Code de parrainage</p>
                                <p className="mt-2 font-mono text-2xl font-semibold tracking-[0.22em]">
                                  {referralSummary.referralCode}
                                </p>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Validés</p>
                                  <p className="mt-1 text-lg font-semibold tabular-nums">{referralSummary.successfulReferrals}</p>
                                </div>
                                <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">En attente</p>
                                  <p className="mt-1 text-lg font-semibold tabular-nums">{referralSummary.pendingReferrals}</p>
                                </div>
                                <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-3">
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Gagné</p>
                                  <p className="mt-1 text-lg font-semibold tabular-nums">{referralSummary.totalRewardsEarned}</p>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3">
                              <Button variant="outline" className={dashboardGhostButtonClass} onClick={handleReferralCopy}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copier
                              </Button>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {widgetId === 'aura-flow' && (
                    <Card className={dashboardWidgetCardClass}>
                      <CardHeader className={dashboardWidgetHeaderClass}>
                        <div className="flex items-center justify-between gap-3">
                          <DashboardWidgetTitle
                            title="Distribution d aura"
                            icon={Star}
                            iconClassName="text-amber-500"
                            iconWrapperClassName="bg-amber-500/15"
                          />
                          <div className="flex items-center gap-2 text-sm tabular-nums">
                            <Badge variant="secondary" className="border border-border/50 bg-muted/30">
                              {remainingAura}/{dailyAuraState?.dailyAuraLimit ?? 0}
                            </Badge>
                            <span className="text-muted-foreground">/</span>
                            <span className="whitespace-nowrap text-muted-foreground">
                              {resetCountdown}
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className={cn(dashboardWidgetContentClass, "flex min-h-0 flex-col")}>
                        <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                          <div className="space-y-3">
                            <div className="grid grid-cols-[40px_40px_minmax(0,1fr)_92px] gap-2 items-center">
                              <Button
                                type="button"
                                variant={auraAction === 'give' ? 'default' : 'outline'}
                                className={cn(
                                  "h-10 w-10 px-0",
                                  auraAction === 'give' ? '' : dashboardGhostButtonClass,
                                )}
                                onClick={() => setAuraAction('give')}
                                aria-label="Envoyer de l aura"
                                title="Envoyer de l aura"
                              >
                                <span className="text-base font-semibold leading-none">+</span>
                              </Button>
                              <Button
                                type="button"
                                variant={auraAction === 'take' ? 'default' : 'outline'}
                                className={cn(
                                  "h-10 w-10 px-0",
                                  auraAction === 'take' ? '' : dashboardGhostButtonClass,
                                )}
                                onClick={() => setAuraAction('take')}
                                aria-label="Retirer de l aura"
                                title="Retirer de l aura"
                              >
                                <span className="text-base font-semibold leading-none">-</span>
                              </Button>
                              <Select
                                value={selectedAuraUserId || '__none'}
                                onValueChange={(value) => setSelectedAuraUserId(value === '__none' ? '' : value)}
                              >
                                <SelectTrigger className="h-10 w-full">
                                  <SelectValue placeholder="Choisir un joueur" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">Choisir un joueur</SelectItem>
                                  {auraUsers.map((candidate) => (
                                    <SelectItem key={candidate.id} value={candidate.id}>
                                      {candidate.username} · {candidate.aura.toLocaleString('fr-FR')} aura
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                value={auraAmountInput}
                                onChange={(event) => setAuraAmountInput(event.target.value)}
                                placeholder="Aura"
                              />
                            </div>

                            {selectedAuraUser ? (
                              <p className="text-xs text-muted-foreground">
                                Cible actuelle: <span className="font-medium text-foreground">{selectedAuraUser.username}</span> · {selectedAuraUser.aura.toLocaleString('fr-FR')} aura
                              </p>
                            ) : null}

                            <Textarea
                              value={auraMessage}
                              onChange={(event) => setAuraMessage(event.target.value)}
                              placeholder="Justification visible dans l historique et la notification"
                              className="min-h-[72px] resize-none"
                            />
                          </div>
                        </div>

                        <div className="pt-3">
                          <Button className="w-full" onClick={submitAuraTransfer} disabled={submittingAuraTransfer || auraWidgetLoading}>
                            {submittingAuraTransfer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {auraAction === 'give' ? 'Confirmer l envoi' : 'Confirmer le retrait'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {widgetId === 'aura-history' && (
                    <Card className={dashboardWidgetCardClass}>
                      <CardHeader className={dashboardWidgetHeaderClass}>
                        <div className="flex items-center justify-between gap-3">
                          <DashboardWidgetTitle
                            title="Historique aura"
                            icon={Star}
                            iconClassName="text-emerald-500"
                            iconWrapperClassName="bg-emerald-500/15"
                          />
                          <Badge variant="secondary" className="border border-border/50 bg-muted/30 tabular-nums">
                            {dailyAuraHistory.length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className={cn(dashboardWidgetContentClass, "flex min-h-0 flex-col")}>
                        <div className="min-h-0 flex-1 overflow-y-scroll pr-2">
                          <div className="space-y-2">
                            {auraWidgetLoading ? (
                              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Chargement...
                              </div>
                            ) : dailyAuraHistory.length === 0 ? (
                              <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-6 text-sm text-muted-foreground">
                                Aucun envoi d aura pour le moment.
                              </div>
                            ) : (
                              dailyAuraHistory.map((entry) => (
                                <div key={entry.id} className="rounded-lg border border-border/40 bg-background/80 px-3 py-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">
                                        {entry.sender?.username ?? 'Inconnu'} {'>'} {entry.receiver?.username ?? 'Inconnu'}
                                      </p>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {entry.message || 'Sans justification'}
                                      </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <p className={cn("text-sm font-semibold tabular-nums", entry.auraAmount >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                        {entry.auraAmount >= 0 ? '+' : ''}
                                        {entry.auraAmount}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
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
                          {livePartiesForWidget.length > 0 && (
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
                        {livePartiesForWidget.length === 0 ? (
                          <p className={TYPOGRAPHY.SMALL}>Aucun groupe actif.</p>
                        ) : (
                          <div className="space-y-2.5">
                            {livePartiesForWidget.slice(0, 6).map((party) => {
                              const isFull = party.memberCount >= party.maxSize;
                              const isPending = pendingJoinRequests.includes(party.id);
                              const isCurrentParty = currentParty?.id === party.id;
                              return (
                                <div key={party.id} className={dashboardRowClass}>
                                  <div className="min-w-0">
                                    <p className={TYPOGRAPHY.SMALL}>{party.name || 'Groupe sans nom'}</p>
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
                          {warsForWidget.length > 0 && (
                            <Badge variant="secondary" className="border border-border/50 bg-muted/30 tabular-nums">
                              {warsForWidget.length}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className={cn(dashboardWidgetContentClass, "flex flex-col")}>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                          {warsForWidget.length === 0 ? (
                            <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground")}>Aucune guerre active pour le moment.</p>
                          ) : (
                            <div className={dashboardCompactListClass}>
                              {warsForWidget.map((war) => {
                                const isViewerWar = !!viewerClanId && (war.attackerClan.id === viewerClanId || war.defenderClan.id === viewerClanId);
                                const opponent = getWarOpponent(war, viewerClanId);
                                const countdownLabel = war.status === 'PREPARING' ? formatCountdown(war.startsAt) : formatCountdown(war.endsAt);
                                const attackerHasLead = war.attackerScore > war.defenderScore;
                                const defenderHasLead = war.defenderScore > war.attackerScore;

                                return (
                                  <div
                                    key={war.id}
                                    className={cn(
                                      "rounded-xl border border-border/50 bg-muted/15 px-3 py-3",
                                      isViewerWar && "border-primary/30 bg-muted/25"
                                    )}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        {isViewerWar && opponent ? <p className="truncate text-sm font-semibold">Contre {opponent.name}</p> : null}
                                        {isViewerWar ? (
                                          <Badge variant="outline" className="text-[10px] uppercase tracking-[0.14em]">
                                            Ton clan
                                          </Badge>
                                        ) : null}
                                      </div>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {getClanWarStatusLabel(war.status)}
                                        {countdownLabel ? ` · ${war.status === 'PREPARING' ? 'départ' : 'fin'} ${countdownLabel}` : ''}
                                      </p>
                                    </div>

                                    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <Avatar className={cn(
                                            "h-9 w-9 rounded-lg border border-border/50",
                                            attackerHasLead && "border-emerald-500/40"
                                          )}>
                                          <AvatarImage
                                            src={resolveImageUrl(war.attackerClan.imageUrl)}
                                            alt={war.attackerClan.name}
                                            className="object-cover"
                                          />
                                          <AvatarFallback className="rounded-lg bg-foreground/5 text-xs font-semibold text-foreground">
                                            {getAvatarFallback(war.attackerClan.name)}
                                          </AvatarFallback>
                                          </Avatar>
                                          <p className="truncate text-sm font-medium">{war.attackerClan.name}</p>
                                        </div>
                                        <p className={cn("mt-1 text-lg font-semibold tabular-nums", attackerHasLead && "text-emerald-600 dark:text-emerald-400")}>
                                          {war.attackerScore} pts
                                        </p>
                                      </div>

                                      <div className="text-sm font-medium tabular-nums text-muted-foreground">
                                        {war.attackerScore} - {war.defenderScore}
                                      </div>

                                      <div className="min-w-0 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <p className="truncate text-sm font-medium">{war.defenderClan.name}</p>
                                          <Avatar className={cn(
                                            "h-9 w-9 rounded-lg border border-border/50",
                                            defenderHasLead && "border-emerald-500/40"
                                          )}>
                                          <AvatarImage
                                            src={resolveImageUrl(war.defenderClan.imageUrl)}
                                            alt={war.defenderClan.name}
                                            className="object-cover"
                                          />
                                          <AvatarFallback className="rounded-lg bg-foreground/5 text-xs font-semibold text-foreground">
                                            {getAvatarFallback(war.defenderClan.name)}
                                          </AvatarFallback>
                                          </Avatar>
                                        </div>
                                        <p className={cn("mt-1 text-lg font-semibold tabular-nums", defenderHasLead && "text-emerald-600 dark:text-emerald-400")}>
                                          {war.defenderScore} pts
                                        </p>
                                      </div>
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

                  {widgetId === 'auracoin' && renderCoinWidget({
                    title: 'Aura Coin',
                    price: auraCoinPrice,
                    delta: auraCoinDelta,
                    history: auraCoinHistory,
                    gradientId: 'auraCoinGrad',
                    route: '/games/aura-coin',
                    buttonLabel: 'Ouvrir Aura Coin',
                  })}

                  {widgetId === 'stablecoin' && renderCoinWidget({
                    title: 'Aura Stable',
                    price: stableCoinPrice,
                    delta: stableCoinDelta,
                    history: stableCoinHistory,
                    gradientId: 'stableCoinGrad',
                    route: '/games/stable-coin',
                    buttonLabel: 'Ouvrir Aura Stable',
                  })}

                  {widgetId === 'chaoscoin' && renderCoinWidget({
                    title: 'Chaos Coin',
                    price: chaosCoinPrice,
                    delta: chaosCoinDelta,
                    history: chaosCoinHistory,
                    gradientId: 'chaosCoinGrad',
                    route: '/games/chaos-coin',
                    buttonLabel: 'Ouvrir Chaos Coin',
                  })}

                </SortableDashboardWidget>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </>
  );
}

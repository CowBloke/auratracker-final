import { type ReactNode, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AlertTriangle, Map, Shield, Sparkles, Sword, Target, Trash2, Trophy, SlidersHorizontal, History, RotateCcw } from 'lucide-react';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
import { clashApi, type ClashBattleEntry, type ClashBuilding, type ClashLeaderboardEntry, type ClashStateResponse, type ClashTarget } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { GameTopBar } from '@/components/game/GameTopBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CenteredSkeletonCard } from '@/components/ui/loading-skeletons';
import { UsernameDisplay } from '@/components/ui/username-display';
import { toast } from '@/hooks/use-toast';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useHideGameLeaderboards } from '@/lib/game-preferences';

type TabId = 'village' | 'attack' | 'journal' | 'leaderboard';

const BUILDING_LABELS: Record<ClashBuilding['type'], string> = {
  townHall: 'Hôtel de ville',
  goldStorage: 'Réserve',
  vault: 'Coffre',
  cannon: 'Canon',
  wall: 'Muraille',
};

const BUILDING_ICONS: Record<ClashBuilding['type'], string> = {
  townHall: '🏰',
  goldStorage: '💰',
  vault: '🔐',
  cannon: '💣',
  wall: '🧱',
};

const TROOP_LABELS = {
  barbarian: 'Barbares',
  archer: 'Archers',
  giant: 'Géants',
} as const;

const GRID_COLUMNS = 8;
const GRID_ROWS = 6;

const formatMoney = (value: number) => value.toLocaleString('fr-FR');
const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
const formatDate = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : 'N/A';

function formatCountdown(value: string | null | undefined, now: number) {
  if (!value) return null;
  const diff = new Date(value).getTime() - now;
  if (diff <= 0) return 'Disponible';
  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
  }
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function getAvatarFallback(username?: string | null) {
  return username?.slice(0, 2).toUpperCase() || 'CV';
}

function getBuildingUpgradeCost(building: ClashBuilding) {
  switch (building.type) {
    case 'townHall':
      return 700 + (building.level - 1) * 900;
    case 'goldStorage':
      return 450 + (building.level - 1) * 550;
    case 'vault':
      return 350 + (building.level - 1) * 450;
    case 'cannon':
      return 550 + (building.level - 1) * 650;
    case 'wall':
      return 300 + (building.level - 1) * 400;
    default:
      return 500;
  }
}

function getBuildingAccent(type: ClashBuilding['type']) {
  switch (type) {
    case 'townHall':
      return 'from-amber-300/40 via-orange-300/20 to-transparent border-amber-500/40';
    case 'goldStorage':
      return 'from-yellow-300/40 via-amber-300/20 to-transparent border-yellow-500/40';
    case 'vault':
      return 'from-cyan-300/35 via-sky-300/15 to-transparent border-cyan-500/40';
    case 'cannon':
      return 'from-rose-300/35 via-red-300/15 to-transparent border-rose-500/40';
    case 'wall':
      return 'from-stone-300/30 via-zinc-300/15 to-transparent border-zinc-500/40';
    default:
      return 'from-white/20 via-white/5 to-transparent border-border/50';
  }
}

function BuildingInspector({
  building,
  canAfford,
  isLoading,
  onUpgrade,
}: {
  building: ClashBuilding;
  canAfford: boolean;
  isLoading: boolean;
  onUpgrade: (buildingType: ClashBuilding['type']) => void;
}) {
  const cost = getBuildingUpgradeCost(building);

  return (
    <Card className="rounded-[32px] border-border/40 shadow-xl overflow-hidden bg-card/60 backdrop-blur-md">
      <CardContent className="space-y-4 p-6">
        <div className={cn('rounded-3xl border bg-gradient-to-br p-5 shadow-sm', getBuildingAccent(building.type))}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl drop-shadow-md">{BUILDING_ICONS[building.type]}</span>
              <div>
                <p className="font-bold text-lg">{BUILDING_LABELS[building.type]}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Position X{building.x} • Y{building.y}</p>
              </div>
            </div>
            <Badge variant="outline" className="rounded-full bg-background/80 px-3 py-1 font-bold">
              Niveau {building.level}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/30 bg-muted/20 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Résistance</p>
            <p className="mt-1 font-bold">{building.hp} / {building.maxHp} HP</p>
          </div>
          <div className="rounded-2xl border border-border/30 bg-muted/20 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Coût suivant</p>
            <p className="mt-1 font-bold">{formatMoney(cost)} 🪙</p>
          </div>
          {typeof building.storageCapacity === 'number' ? (
            <div className="rounded-2xl border border-border/30 bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Capacité</p>
              <p className="mt-1 font-bold">{formatMoney(building.storageCapacity)}</p>
            </div>
          ) : null}
          {typeof building.protectionPct === 'number' ? (
            <div className="rounded-2xl border border-border/30 bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Protection</p>
              <p className="mt-1 font-bold">{formatPercent(building.protectionPct)}</p>
            </div>
          ) : null}
        </div>

        <div className="pt-2">
          <Button
            className="w-full rounded-2xl h-12 text-sm font-bold shadow-lg shadow-primary/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => onUpgrade(building.type)}
            disabled={!canAfford || isLoading}
          >
            {isLoading ? 'Amélioration...' : `Améliorer pour ${formatMoney(cost)} 🪙`}
          </Button>
          {!canAfford ? (
            <p className="text-[10px] text-amber-600 mt-2 text-center font-medium">Or insuffisant. Pille des villages !</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClashVillage() {
  const { user, refreshUser } = useAuth();
  const { confirm } = useAppDialog();
  const hideGameLeaderboards = useHideGameLeaderboards();
  const [activeTab, setActiveTab] = useState<TabId>('village');
  const [state, setState] = useState<ClashStateResponse | null>(null);
  const [targets, setTargets] = useState<ClashTarget[]>([]);
  const [history, setHistory] = useState<{ attacks: ClashBattleEntry[]; defenses: ClashBattleEntry[]; activities: ClashStateResponse['activities'] }>({
    attacks: [],
    defenses: [],
    activities: [],
  });
  const [leaderboard, setLeaderboard] = useState<{ trophies: ClashLeaderboardEntry[]; loot: ClashLeaderboardEntry[]; defense: ClashLeaderboardEntry[] }>({
    trophies: [],
    loot: [],
    defense: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshingTargets, setRefreshingTargets] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [attackLoading, setAttackLoading] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (hideGameLeaderboards && activeTab === 'leaderboard') {
      setActiveTab('village');
    }
  }, [activeTab, hideGameLeaderboards]);

  const loadPage = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [stateRes, leaderboardRes] = await Promise.all([
        clashApi.getState(),
        clashApi.getLeaderboard(),
      ]);

      setState(stateRes.data);
      setLeaderboard(leaderboardRes.data);

      if (stateRes.data.village) {
        const [targetsRes, historyRes] = await Promise.all([
          clashApi.getMatchmaking(),
          clashApi.getHistory(),
        ]);
        setTargets(targetsRes.data.targets);
        setHistory(historyRes.data);
      } else {
        setTargets([]);
        setHistory({
          attacks: [],
          defenses: [],
          activities: [],
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de charger Clash Village.',
        variant: 'destructive',
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const refreshTargets = useCallback(async () => {
    if (!state?.village) {
      setTargets([]);
      return;
    }

    setRefreshingTargets(true);
    try {
      const response = await clashApi.getMatchmaking();
      setTargets(response.data.targets);
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de trouver de nouvelles cibles.',
        variant: 'destructive',
      });
    } finally {
      setRefreshingTargets(false);
    }
  }, [state?.village]);

  const handleCreateVillage = useCallback(async () => {
    setCreateLoading(true);
    try {
      const response = await clashApi.bootstrap();
      setState(response.data);
      await loadPage({ silent: true });
      toast({
        title: 'Village créé',
        description: 'Ton village Clash est prêt à être joué et peut désormais être attaqué.',
      });
    } catch (error: any) {
      toast({
        title: 'Création impossible',
        description: error.response?.data?.error || 'Impossible de créer ton village.',
        variant: 'destructive',
      });
    } finally {
      setCreateLoading(false);
    }
  }, [loadPage]);

  const handleDeleteVillage = useCallback(async () => {
    if (!(await confirm('Supprimer ton village Clash ? Cette action retirera ton village du jeu et personne ne pourra plus l’attaquer tant que tu n’en recrées pas un.'))) {
      return;
    }

    setDeleteLoading(true);
    try {
      await clashApi.deleteVillage();
      setState({
        village: null,
        activities: [],
        recentAttacks: [],
        recentDefenses: [],
      });
      setTargets([]);
      setHistory({
        attacks: [],
        defenses: [],
        activities: [],
      });
      toast({
        title: 'Village supprimé',
        description: 'Ton village a été retiré du jeu. Tu restes inattaquable tant que tu n’en recrées pas un.',
      });
    } catch (error: any) {
      toast({
        title: 'Suppression impossible',
        description: error.response?.data?.error || 'Impossible de supprimer ton village.',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [confirm]);

  const handleUpgrade = useCallback(async (buildingType: ClashBuilding['type']) => {
    setUpgradeLoading(buildingType);
    try {
      const response = await clashApi.upgrade(buildingType);
      setState(response.data);
      await refreshUser();
      await Promise.all([refreshTargets(), loadPage({ silent: true })]);
      toast({
        title: 'Amélioration terminée',
        description: `${BUILDING_LABELS[buildingType]} amélioré avec succès.`,
      });
    } catch (error: any) {
      toast({
        title: 'Amélioration impossible',
        description: error.response?.data?.error || 'Impossible d’améliorer ce bâtiment.',
        variant: 'destructive',
      });
    } finally {
      setUpgradeLoading(null);
    }
  }, [loadPage, refreshTargets, refreshUser]);

  const handleAttack = useCallback(async (target: ClashTarget) => {
    if (!target.user) return;
    setAttackLoading(target.user.id);
    try {
      const response = await clashApi.attack(target.user.id);
      setState(response.data);
      await Promise.all([refreshTargets(), loadPage({ silent: true })]);
      toast({
        title: 'Raid lancé',
        description: `${response.data.attack.moneyStolen.toLocaleString('fr-FR')} money pillés pour ${response.data.attack.destructionPercent}% de destruction.`,
      });
    } catch (error: any) {
      toast({
        title: 'Attaque impossible',
        description: error.response?.data?.error || 'Impossible de lancer cette attaque.',
        variant: 'destructive',
      });
    } finally {
      setAttackLoading(null);
    }
  }, [loadPage, refreshTargets]);

  const village = state?.village ?? null;
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const attackCooldown = useMemo(
    () => formatCountdown(village?.attackCooldownUntil, now),
    [village?.attackCooldownUntil, now],
  );
  const shieldCountdown = useMemo(
    () => formatCountdown(village?.shieldUntil, now),
    [village?.shieldUntil, now],
  );
  const selectedBuilding = useMemo(
    () => village?.buildings.find((building) => building.id === selectedBuildingId) ?? village?.buildings[0] ?? null,
    [selectedBuildingId, village?.buildings],
  );
  const boardCells = useMemo(
    () => Array.from({ length: GRID_COLUMNS * GRID_ROWS }, (_, index) => ({
      x: (index % GRID_COLUMNS) + 1,
      y: Math.floor(index / GRID_COLUMNS) + 1,
    })),
    [],
  );

  useEffect(() => {
    if (!village?.buildings.length) {
      setSelectedBuildingId(null);
      return;
    }
    if (!selectedBuildingId || !village.buildings.some((building) => building.id === selectedBuildingId)) {
      setSelectedBuildingId(village.buildings[0].id);
    }
  }, [selectedBuildingId, village?.buildings]);

  if (loading && !state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <div className="w-full max-w-md">
          <CenteredSkeletonCard />
        </div>
      </div>
    );
  }

  if (!village) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted/10">
        <Card className="max-w-md w-full rounded-[32px] border-border/50 shadow-2xl overflow-hidden bg-background">
          <div className="h-32 bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center">
            <Sparkles className="h-16 w-16 text-white/20 animate-pulse" />
          </div>
          <CardContent className="space-y-6 p-8 text-center">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Clash Village</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Crée ton village pour commencer l&apos;aventure. Construis tes défenses et pille les ressources des autres.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button onClick={() => void handleCreateVillage()} disabled={createLoading} className="rounded-2xl h-12 text-base font-bold">
                {createLoading ? 'Fondation...' : 'Fonder mon village'}
              </Button>
              <Button variant="outline" onClick={() => void loadPage()} disabled={createLoading} className="rounded-2xl h-12 font-bold">
                Réessayer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const topBarControls = (
    <div className="space-y-4 text-xs">
      <div className="rounded-2xl border border-border/40 p-4 bg-muted/30 space-y-3 shadow-inner">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 font-bold">
          <Map className="h-3.5 w-3.5" />
          Mon Village
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border/30 bg-background p-2 shadow-sm">
            <p className="text-[8px] uppercase text-muted-foreground font-bold">HDV</p>
            <p className="font-bold">Niv. {village.townHallLevel}</p>
          </div>
          <div className="rounded-xl border border-border/30 bg-background p-2 shadow-sm">
            <p className="text-[8px] uppercase text-muted-foreground font-bold">Trophées</p>
            <p className="font-bold">{village.trophies.toLocaleString('fr-FR')}</p>
          </div>
        </div>
      </div>

      <Separator className="opacity-50" />

      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 font-bold px-1">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Gestion
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start h-10 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/20 font-bold"
          onClick={() => void handleDeleteVillage()}
          disabled={deleteLoading}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteLoading ? 'Suppression...' : 'Supprimer mon village'}
        </Button>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8"
    >
      <GameTopBar
        title="Clash Village"
        score={village.moneyInStorage}
        highScore={village.trophies}
        controls={topBarControls}
        showLeaderboard={showLeaderboard}
        onToggleLeaderboard={() => setShowLeaderboard(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full hover:bg-muted/50 transition-colors"
            onClick={() => setShowSettingsDialog(true)}
            title="Gestion du village"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </GameTopBar>

      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-sm rounded-[32px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Gestion Clash Village</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            {topBarControls}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-center gap-6">
        <div className="flex w-full max-w-[1280px] flex-col overflow-hidden space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-card/40 backdrop-blur-md border border-border/30 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0 shadow-sm border border-amber-500/10">
                <CurrencyIcon type="money" className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Réserve</p>
                <p className="text-base font-bold truncate">{formatMoney(village.moneyInStorage)} / {formatMoney(village.storageCapacity)}</p>
              </div>
            </div>
            <div className="bg-card/40 backdrop-blur-md border border-border/30 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-600 shrink-0 shadow-sm border border-sky-500/10">
                <Shield className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Défense</p>
                <p className="text-base font-bold truncate">Note: {village.defenseRating}</p>
              </div>
            </div>
            <div className="bg-card/40 backdrop-blur-md border border-border/30 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border", village.attackCooldownUntil ? "bg-red-500/10 text-red-600 border-red-500/10" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/10")}>
                <Sword className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Attaque</p>
                <p className="text-base font-bold truncate">{attackCooldown ?? 'Prête'}</p>
              </div>
            </div>
            <div className="bg-card/40 backdrop-blur-md border border-border/30 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border", village.shieldUntil ? "bg-sky-500/10 text-sky-600 border-sky-500/10" : "bg-muted/10 text-muted-foreground border-border/30")}>
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Bouclier</p>
                <p className="text-base font-bold truncate">{shieldCountdown ?? 'Aucun'}</p>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="w-full">
            <div className="flex justify-center mb-8">
              <TabsList className="h-11 p-1 bg-muted/30 backdrop-blur-md rounded-2xl border border-border/30 shadow-sm">
                <TabsTrigger value="village" className="rounded-xl px-8 h-9 data-[state=active]:bg-background data-[state=active]:shadow-md font-bold transition-all">Village</TabsTrigger>
                <TabsTrigger value="attack" className="rounded-xl px-8 h-9 data-[state=active]:bg-background data-[state=active]:shadow-md font-bold transition-all">Attaquer</TabsTrigger>
                <TabsTrigger value="journal" className="rounded-xl px-8 h-9 data-[state=active]:bg-background data-[state=active]:shadow-md font-bold transition-all">Journal</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="village" className="focus-visible:outline-none">
              <div className="grid gap-8 xl:grid-cols-[1fr_420px]">
                <div className="space-y-6">
                  <div className="overflow-hidden rounded-[48px] border border-border/40 bg-muted/5 p-6 shadow-2xl relative group">
                     <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-sky-500/5 pointer-events-none group-hover:opacity-100 opacity-50 transition-opacity" />
                     <div className="relative grid grid-cols-8 grid-rows-6 gap-3 min-h-[520px]">
                        {boardCells.map((cell) => {
                          const occupant = village.buildings.find((b) => {
                            const startX = b.x;
                            const endX = Math.min(GRID_COLUMNS, b.x + 1);
                            const startY = b.y;
                            const endY = Math.min(GRID_ROWS, b.y + 1);
                            return cell.x >= startX && cell.x <= endX && cell.y >= startY && cell.y <= endY;
                          });
                          const isAnchor = occupant?.x === cell.x && occupant?.y === cell.y;
                          const isSelected = occupant?.id === selectedBuilding?.id;

                          return (
                            <button
                              key={`${cell.x}-${cell.y}`}
                              type="button"
                              onClick={() => occupant && setSelectedBuildingId(occupant.id)}
                              className={cn(
                                'relative flex min-h-[76px] items-center justify-center rounded-2xl border transition-all duration-500',
                                occupant
                                  ? isSelected
                                    ? 'border-primary bg-background shadow-[0_0_30px_rgba(var(--primary),0.2)] scale-105 z-10'
                                    : 'border-border/40 bg-background/90 hover:bg-background hover:scale-[1.02] shadow-sm'
                                  : 'border-dashed border-border/10 bg-muted/5 hover:bg-muted/10',
                                occupant ? 'cursor-pointer' : 'cursor-default',
                              )}
                            >
                              {occupant ? (
                                isAnchor ? (
                                  <div className="flex flex-col items-center gap-1.5 animate-in fade-in zoom-in duration-300">
                                    <span className="text-3xl drop-shadow-md transform group-hover:scale-110 transition-transform">{BUILDING_ICONS[occupant.type]}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground/90 bg-muted/30 px-1.5 rounded-md">Lvl {occupant.level}</span>
                                  </div>
                                ) : null
                              ) : null}
                            </button>
                          );
                        })}
                     </div>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {village.buildings.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBuildingId(b.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-200",
                          selectedBuilding?.id === b.id 
                            ? "bg-primary/10 border-primary/40 shadow-sm" 
                            : "bg-card/40 border-border/30 hover:bg-muted/40 hover:scale-[1.02]"
                        )}
                      >
                        <span className="text-2xl drop-shadow-sm">{BUILDING_ICONS[b.type]}</span>
                        <span className="text-[9px] font-bold truncate w-full text-center uppercase tracking-tight text-muted-foreground">{BUILDING_LABELS[b.type]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  {selectedBuilding && (
                    <BuildingInspector
                      building={selectedBuilding}
                      canAfford={(village?.moneyInStorage ?? 0) >= getBuildingUpgradeCost(selectedBuilding)}
                      isLoading={upgradeLoading === selectedBuilding.type}
                      onUpgrade={(type) => void handleUpgrade(type)}
                    />
                  )}
                  <Card className="rounded-[32px] border-border/40 shadow-xl overflow-hidden bg-card/60 backdrop-blur-md">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 px-1">
                        <Sword className="h-4 w-4 text-muted-foreground" />
                        Armée disponible
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-2 p-5">
                      {village.troops.map((t) => (
                        <div key={t.type} className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/30 shadow-sm">
                          <span className="text-sm font-bold">{TROOP_LABELS[t.type]}</span>
                          <Badge variant="secondary" className="rounded-full h-7 px-3 font-bold text-xs">{t.count}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="attack" className="space-y-6 focus-visible:outline-none">
              <div className="flex items-center justify-between px-1">
                <div className="space-y-0.5">
                   <h3 className="text-xl font-bold tracking-tight">Matchmaking</h3>
                   <p className="text-xs text-muted-foreground font-medium">Trouve un village à attaquer pour gagner de l&apos;or et des trophées.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void refreshTargets()} disabled={refreshingTargets} className="rounded-full h-10 px-5 font-bold border-border/40 shadow-sm hover:shadow-md transition-all">
                  <RotateCcw className={cn("h-4 w-4 mr-2", refreshingTargets && "animate-spin")} />
                  Rafraîchir
                </Button>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {targets.map((t) => (
                  <Card key={t.user?.id ?? t.village.id} className="rounded-[40px] border-border/30 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden bg-card/40 backdrop-blur-md group">
                    <CardContent className="p-7 space-y-5">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-md transform group-hover:scale-105 transition-transform duration-300">
                          <AvatarImage src={t.user?.profilePicture ?? undefined} />
                          <AvatarFallback className="bg-primary/5 text-primary text-2xl font-bold">{getAvatarFallback(t.user?.username)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          {t.user ? (
                            <UsernameDisplay username={t.user.username} usernameColor={t.user.usernameColor} usernameClassName="text-lg font-bold" />
                          ) : <span className="font-bold text-lg text-muted-foreground">Village Inconnu</span>}
                          <div className="flex items-center gap-3 mt-1">
                            <Badge variant="outline" className="text-[10px] rounded-full h-6 px-3 bg-muted/30 font-bold border-border/30">HDV {t.village.townHallLevel}</Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-bold"><Trophy className="h-3.5 w-3.5 text-amber-500" /> {t.village.trophies}</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/20 rounded-[24px] p-4 border border-border/20 text-center shadow-inner">
                          <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest mb-1">Butin Estimé</p>
                          <p className="text-lg font-black text-amber-600">{formatMoney(t.availableLoot)} 🪙</p>
                        </div>
                        <div className="bg-muted/20 rounded-[24px] p-4 border border-border/20 text-center shadow-inner">
                          <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest mb-1">Défense</p>
                          <p className="text-lg font-black text-sky-600">{t.village.defenseRating}</p>
                        </div>
                      </div>
                      <Button
                        className="w-full rounded-2xl h-12 text-sm font-bold shadow-lg shadow-primary/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        onClick={() => void handleAttack(t)}
                        disabled={Boolean(village.attackCooldownUntil && new Date(village.attackCooldownUntil).getTime() > now) || attackLoading === t.user?.id}
                      >
                        {attackLoading === t.user?.id ? 'Raid en cours...' : 'Lancer le raid'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {targets.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-muted/5 rounded-[48px] border border-dashed border-border/30">
                  <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground/30">
                    <Target className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-muted-foreground">Aucune cible trouvée</p>
                    <p className="text-sm text-muted-foreground/60 max-w-xs">Le matchmaking est vide pour le moment. Réessaye plus tard ou rafraîchis la liste.</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="journal" className="space-y-8 focus-visible:outline-none">
               <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold tracking-tight px-1 flex items-center gap-3"><History className="h-6 w-6 text-muted-foreground" /> Combats récents</h3>
                    <div className="space-y-3">
                      {[...history.attacks, ...history.defenses]
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((e) => (
                          <div key={e.id} className="bg-card/40 backdrop-blur-md border border-border/30 rounded-[32px] p-5 flex items-center gap-5 shadow-sm hover:shadow-md transition-all group">
                            <div className={cn("h-12 w-12 rounded-[20px] flex items-center justify-center shrink-0 shadow-sm border transform group-hover:scale-105 transition-transform", e.trophiesDelta >= 0 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/10" : "bg-rose-500/10 text-rose-600 border-rose-500/10")}>
                              {e.trophiesDelta >= 0 ? <Trophy className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <UsernameDisplay username={e.opponent.username} usernameColor={e.opponent.usernameColor} usernameClassName="font-bold text-base" />
                              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{formatDate(e.createdAt)}</p>
                            </div>
                            <div className="text-right">
                               <p className={cn("font-black text-base tabular-nums", e.trophiesDelta >= 0 ? "text-emerald-600" : "text-rose-600")}>{e.trophiesDelta >= 0 ? '+' : ''}{e.trophiesDelta} 🏆</p>
                               <p className="text-[10px] text-muted-foreground font-bold">{formatMoney(e.moneyStolen)} 🪙</p>
                            </div>
                          </div>
                        ))}
                      
                      {history.attacks.length === 0 && history.defenses.length === 0 && (
                        <div className="text-center py-12 bg-muted/5 rounded-[32px] border border-dashed border-border/30">
                          <p className="text-sm font-bold text-muted-foreground/50">Aucun combat au journal</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold tracking-tight px-1 flex items-center gap-3"><Sparkles className="h-6 w-6 text-muted-foreground" /> Activités récentes</h3>
                    <div className="space-y-3">
                       {(state?.activities ?? []).slice(0, 15).map((act, i) => (
                         <div key={i} className="text-xs p-4 rounded-2xl bg-muted/10 border border-border/20 flex gap-4 backdrop-blur-sm group hover:bg-muted/20 transition-colors">
                            <div className="h-2 w-2 rounded-full bg-primary/40 mt-1.5 shrink-0 group-hover:bg-primary transition-colors" />
                            <div className="space-y-1">
                              <p className="leading-relaxed font-medium">{act.message ?? act.detail}</p>
                              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight">{formatDate(act.createdAt)}</p>
                            </div>
                         </div>
                       ))}

                       {(state?.activities.length ?? 0) === 0 && (
                        <div className="text-center py-12 bg-muted/5 rounded-[32px] border border-dashed border-border/30">
                          <p className="text-sm font-bold text-muted-foreground/50">Aucune activité enregistrée</p>
                        </div>
                      )}
                    </div>
                  </div>
               </div>
            </TabsContent>
          </Tabs>
        </div>

        {showLeaderboard && (
          <div className="w-[340px] shrink-0 hidden xl:block h-full space-y-6 animate-in slide-in-from-right duration-500">
             <div className="bg-card/40 backdrop-blur-md border border-border/30 rounded-[40px] p-8 shadow-2xl space-y-8 sticky top-6">
                <div className="space-y-6">
                   <h3 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3 text-muted-foreground px-1">
                     <Trophy className="h-4 w-4 text-amber-500" /> 
                     Top Trophées
                   </h3>
                   <div className="space-y-3">
                      {leaderboard.trophies.slice(0, 5).map((u, i) => (
                        <div key={u.id ?? u.user?.id ?? `trophy-${i}`} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-background/80 transition-all group shadow-sm border border-transparent hover:border-border/30">
                          <span className={cn("text-xs font-black w-6 text-center", i < 3 ? "text-amber-500" : "text-muted-foreground/40")}>{i+1}</span>
                          <UsernameDisplay username={u.username ?? u.user?.username ?? 'Inconnu'} usernameColor={u.usernameColor ?? u.user?.usernameColor} usernameClassName="text-sm font-bold flex-1 truncate" />
                          <span className="text-sm font-black tabular-nums">{u.trophies}</span>
                        </div>
                      ))}
                   </div>
                </div>
                
                <Separator className="opacity-30" />
                
                <div className="space-y-6">
                   <h3 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3 text-muted-foreground px-1">
                     <CurrencyIcon type="money" className="h-4 w-4 text-amber-600" /> 
                     Top Pilleurs
                   </h3>
                   <div className="space-y-3">
                      {leaderboard.loot.slice(0, 5).map((u, i) => (
                        <div key={u.id ?? u.user?.id ?? `loot-${i}`} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-background/80 transition-all group shadow-sm border border-transparent hover:border-border/30">
                          <span className={cn("text-xs font-black w-6 text-center", i < 3 ? "text-amber-600" : "text-muted-foreground/40")}>{i+1}</span>
                          <UsernameDisplay username={u.username ?? u.user?.username ?? 'Inconnu'} usernameColor={u.usernameColor ?? u.user?.usernameColor} usernameClassName="text-sm font-bold flex-1 truncate" />
                          <span className="text-sm font-black tabular-nums">{formatMoney(u.moneyStolen ?? u.totalLoot ?? 0)}</span>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

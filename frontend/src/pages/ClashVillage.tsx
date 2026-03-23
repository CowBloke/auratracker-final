import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Coins, Map, Shield, Sparkles, Sword, Target, Trophy } from 'lucide-react';
import { clashApi, type ClashBattleEntry, type ClashBuilding, type ClashLeaderboardEntry, type ClashStateResponse, type ClashTarget } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UsernameDisplay } from '@/components/ui/username-display';
import { toast } from '@/hooks/use-toast';
import { SPACING, TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';

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

function getActivityTone(type: string) {
  if (type.includes('WIN') || type === 'UPGRADE') return 'text-emerald-600';
  if (type === 'DEFENSE' || type === 'ATTACK_LOSS') return 'text-amber-600';
  if (type === 'COOLDOWN' || type === 'SHIELD') return 'text-sky-600';
  return 'text-muted-foreground';
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

function InfoStat({
  label,
  value,
  icon,
  detail,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  detail?: string;
}) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-none">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-xl border border-border/50 bg-muted/30 p-2.5 text-foreground/80">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold">{value}</p>
          {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
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
    <Card className="rounded-3xl border-border/50 shadow-none">
      <CardContent className="space-y-4 p-5">
        <div className={cn('rounded-3xl border bg-gradient-to-br p-4', getBuildingAccent(building.type))}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{BUILDING_ICONS[building.type]}</span>
                <div>
                  <p className="font-semibold">{BUILDING_LABELS[building.type]}</p>
                  <p className="text-xs text-muted-foreground">Position X{building.x} • Y{building.y}</p>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="rounded-full bg-background/70">
              Niveau {building.level}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/50 bg-muted/15 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Résistance</p>
            <p className="mt-1 font-semibold">{building.hp} / {building.maxHp} HP</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-muted/15 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Coût suivant</p>
            <p className="mt-1 font-semibold">{formatMoney(cost)} $</p>
          </div>
          {typeof building.storageCapacity === 'number' ? (
            <div className="rounded-2xl border border-border/50 bg-muted/15 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Capacité</p>
              <p className="mt-1 font-semibold">{formatMoney(building.storageCapacity)}</p>
            </div>
          ) : null}
          {typeof building.protectionPct === 'number' ? (
            <div className="rounded-2xl border border-border/50 bg-muted/15 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Protection</p>
              <p className="mt-1 font-semibold">{formatPercent(building.protectionPct)}</p>
            </div>
          ) : null}
          {typeof building.defensePower === 'number' ? (
            <div className="rounded-2xl border border-border/50 bg-muted/15 p-3 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Puissance défensive</p>
              <p className="mt-1 font-semibold">{building.defensePower}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={() => onUpgrade(building.type)}
            disabled={!canAfford || isLoading}
          >
            {isLoading ? 'Amélioration...' : `Améliorer pour ${formatMoney(cost)} $`}
          </Button>
          {!canAfford ? (
            <p className="text-xs text-amber-600">Solde insuffisant sur ton compte global.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClashVillage() {
  const { user, refreshUser } = useAuth();
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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const loadPage = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [stateRes, targetsRes, historyRes, leaderboardRes] = await Promise.all([
        clashApi.getState().catch(() => clashApi.bootstrap()),
        clashApi.getMatchmaking(),
        clashApi.getHistory(),
        clashApi.getLeaderboard(),
      ]);
      setState(stateRes.data);
      setTargets(targetsRes.data.targets);
      setHistory(historyRes.data);
      setLeaderboard(leaderboardRes.data);
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
  }, []);

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
      <PageShell>
        <div className="flex min-h-[40vh] items-center justify-center rounded-3xl border border-dashed border-border/70 bg-muted/10">
          <p className="text-sm text-muted-foreground">Chargement du village...</p>
        </div>
      </PageShell>
    );
  }

  if (!village) {
    return (
      <PageShell>
        <Card className="rounded-3xl border-border/50 shadow-none">
          <CardContent className="space-y-4 p-6">
            <h1 className={TYPOGRAPHY.PAGE_TITLE}>Clash Village</h1>
            <p className="text-sm text-muted-foreground">Impossible de charger le village pour le moment.</p>
            <Button onClick={() => void loadPage()}>Réessayer</Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell className={SPACING.SECTION_SPACING}>
      <PageHeader
        title="Clash Village"
        description="Construis ton village, renforce tes défenses et lance des raids asynchrones sur les autres joueurs."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              HDV {village.townHallLevel}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {village.trophies.toLocaleString('fr-FR')} trophées
            </Badge>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <InfoStat
          label="Stockage"
          value={`${formatMoney(village.moneyInStorage)} / ${formatMoney(village.storageCapacity)}`}
          icon={<Coins className="h-4 w-4" />}
          detail="Réserve attaquable du village"
        />
        <InfoStat
          label="Défense"
          value={String(village.defenseRating)}
          icon={<Shield className="h-4 w-4" />}
          detail={`Coffre protégé à ${formatPercent(village.vaultProtectionPct)}`}
        />
        <InfoStat
          label="Cooldown"
          value={attackCooldown ?? 'Disponible'}
          icon={<Sword className="h-4 w-4" />}
          detail={village.attackCooldownUntil ? `Fin le ${formatDate(village.attackCooldownUntil)}` : 'Ton armée est prête'}
        />
        <InfoStat
          label="Bouclier"
          value={shieldCountdown ?? 'Inactif'}
          icon={<Sparkles className="h-4 w-4" />}
          detail={village.shieldUntil ? `Fin le ${formatDate(village.shieldUntil)}` : 'Aucune protection active'}
        />
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)} className={SPACING.SECTION_SPACING}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="village">Village</TabsTrigger>
          <TabsTrigger value="attack">Attaquer</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="leaderboard">Classement</TabsTrigger>
        </TabsList>

        <TabsContent value="village" className={SPACING.SECTION_SPACING}>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="rounded-3xl border-border/50 shadow-none">
              <CardContent className="space-y-5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Plateau du village</h2>
                    <p className="text-sm text-muted-foreground">Quadrillage 8x6 avec emplacements visibles et sélection structure par structure.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full">
                      {village.layout.length} structures
                    </Badge>
                    <Badge variant="secondary" className="rounded-full">
                      <Map className="mr-1 h-3.5 w-3.5" />
                      {GRID_COLUMNS} x {GRID_ROWS}
                    </Badge>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[30px] border border-border/50 bg-gradient-to-br from-lime-100/70 via-emerald-50/70 to-sky-100/60 p-3 shadow-inner dark:from-lime-950/25 dark:via-emerald-950/20 dark:to-sky-950/20">
                  <div className="grid grid-cols-[auto_1fr] gap-3">
                    <div className="grid grid-rows-6 gap-2 pt-8">
                      {Array.from({ length: GRID_ROWS }, (_, index) => (
                        <div key={`y-${index + 1}`} className="flex h-[56px] items-center justify-center text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/45">
                          Y{index + 1}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-8 gap-2">
                        {Array.from({ length: GRID_COLUMNS }, (_, index) => (
                          <div key={`x-${index + 1}`} className="flex items-center justify-center text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/45">
                            X{index + 1}
                          </div>
                        ))}
                      </div>

                      <div className="relative grid min-h-[420px] grid-cols-8 grid-rows-6 gap-2 rounded-[28px] border border-emerald-900/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.38),_transparent_30%),linear-gradient(180deg,_rgba(132,204,22,0.28),_rgba(34,197,94,0.2))] p-2 dark:border-emerald-100/10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.08),_transparent_30%),linear-gradient(180deg,_rgba(132,204,22,0.18),_rgba(21,128,61,0.22))]">
                        {boardCells.map((cell) => {
                          const occupant = village.buildings.find((building) => {
                            const startX = building.x;
                            const endX = Math.min(GRID_COLUMNS, building.x + 1);
                            const startY = building.y;
                            const endY = Math.min(GRID_ROWS, building.y + 1);
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
                                'relative flex min-h-[56px] items-center justify-center rounded-2xl border text-center transition',
                                occupant
                                  ? isSelected
                                    ? 'border-foreground/60 bg-background/90 shadow-md'
                                    : 'border-border/50 bg-background/65 hover:bg-background/85'
                                  : 'border-dashed border-emerald-900/10 bg-white/20 text-foreground/35 dark:border-emerald-50/10 dark:bg-black/10',
                                occupant ? 'cursor-pointer' : 'cursor-default',
                              )}
                            >
                              <span className="absolute left-2 top-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground/35">
                                {cell.x}.{cell.y}
                              </span>
                              {occupant ? (
                                isAnchor ? (
                                  <span className="flex flex-col items-center px-1">
                                    <span className="text-xl leading-none">{BUILDING_ICONS[occupant.type]}</span>
                                    <span className="mt-1 text-[10px] font-semibold leading-tight">{BUILDING_LABELS[occupant.type]}</span>
                                    <span className="text-[9px] text-muted-foreground">Niv. {occupant.level}</span>
                                  </span>
                                ) : (
                                  <div className={cn('h-full w-full rounded-xl border border-dashed', isSelected ? 'border-foreground/35 bg-foreground/5' : 'border-border/30 bg-black/[0.03] dark:bg-white/[0.03]')} />
                                )
                              ) : (
                                <span className="text-[9px] font-medium uppercase tracking-[0.2em]">Libre</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {village.buildings.map((building) => (
                    <button
                      key={`chip-${building.id}`}
                      type="button"
                      onClick={() => setSelectedBuildingId(building.id)}
                      className={cn(
                        'rounded-2xl border p-3 text-left transition',
                        selectedBuilding?.id === building.id
                          ? 'border-foreground/50 bg-muted/35 shadow-sm'
                          : 'border-border/50 bg-muted/15 hover:bg-muted/25',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{BUILDING_ICONS[building.type]}</span>
                          <div>
                            <p className="text-sm font-medium">{BUILDING_LABELS[building.type]}</p>
                            <p className="text-[11px] text-muted-foreground">X{building.x} Y{building.y}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="rounded-full">Niv. {building.level}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {selectedBuilding ? (
                <BuildingInspector
                  building={selectedBuilding}
                  canAfford={(user?.money ?? 0) >= getBuildingUpgradeCost(selectedBuilding)}
                  isLoading={upgradeLoading === selectedBuilding.type}
                  onUpgrade={(buildingType) => void handleUpgrade(buildingType)}
                />
              ) : null}

              <Card className="rounded-3xl border-border/50 shadow-none">
                <CardContent className="space-y-3 p-5">
                  <h2 className="text-base font-semibold">Armée disponible</h2>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {village.troops.map((troop) => (
                      <div key={troop.type} className="rounded-2xl border border-border/50 bg-muted/15 p-3">
                        <p className="text-sm font-medium">{TROOP_LABELS[troop.type]}</p>
                        <p className="text-xs text-muted-foreground">{troop.count} unités prêtes</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="attack" className={SPACING.SECTION_SPACING}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Matchmaking</h2>
              <p className="text-sm text-muted-foreground">Cibles hors bouclier, proches de ton niveau de trophées.</p>
            </div>
            <Button variant="outline" onClick={() => void refreshTargets()} disabled={refreshingTargets}>
              {refreshingTargets ? 'Recherche...' : 'Nouvelles cibles'}
            </Button>
          </div>

          {village.attackCooldownUntil && new Date(village.attackCooldownUntil).getTime() > now ? (
            <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 shadow-none">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <div>
                  <p className="font-medium">Armée en récupération</p>
                  <p className="text-sm text-muted-foreground">Nouvelle attaque disponible dans {attackCooldown}.</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            {targets.map((target) => (
              <Card key={target.user?.id ?? target.village.id} className="rounded-3xl border-border/50 shadow-none">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border border-border/50">
                      <AvatarImage src={target.user?.profilePicture ?? undefined} />
                      <AvatarFallback>{getAvatarFallback(target.user?.username)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      {target.user ? (
                        <UsernameDisplay
                          username={target.user.username}
                          usernameColor={target.user.usernameColor}
                          usernameClassName="font-medium"
                        />
                      ) : (
                        <span className="font-medium">Village inconnu</span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        HDV {target.village.townHallLevel} • {target.village.trophies.toLocaleString('fr-FR')} trophées
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded-full">
                      {formatMoney(target.availableLoot)} $
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/50 bg-muted/15 p-3">
                      <p className="text-xs text-muted-foreground">Butin visible</p>
                      <p className="text-sm font-semibold">{formatMoney(target.availableLoot)} $</p>
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-muted/15 p-3">
                      <p className="text-xs text-muted-foreground">Défense</p>
                      <p className="text-sm font-semibold">{target.village.defenseRating}</p>
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-muted/15 p-3">
                      <p className="text-xs text-muted-foreground">Protection</p>
                      <p className="text-sm font-semibold">{formatPercent(target.village.vaultProtectionPct)}</p>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => void handleAttack(target)}
                    disabled={Boolean(village.attackCooldownUntil && new Date(village.attackCooldownUntil).getTime() > now) || attackLoading === target.user?.id}
                  >
                    {attackLoading === target.user?.id ? 'Raid en cours...' : 'Lancer le raid'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {targets.length === 0 ? (
            <Card className="rounded-3xl border-dashed border-border/70 shadow-none">
              <CardContent className="p-6 text-sm text-muted-foreground">
                Aucune cible disponible pour le moment. Rafraîchis le matchmaking dans quelques instants.
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="journal" className={SPACING.SECTION_SPACING}>
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="rounded-3xl border-border/50 shadow-none">
              <CardContent className="space-y-4 p-5">
                <h2 className="text-base font-semibold">Historique des raids</h2>
                <div className="space-y-3">
                  {[...history.attacks, ...history.defenses]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-border/50 bg-muted/15 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <UsernameDisplay
                              username={entry.opponent.username}
                              usernameColor={entry.opponent.usernameColor}
                              usernameClassName="font-medium"
                            />
                            <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                          </div>
                          <Badge variant={entry.trophiesDelta >= 0 ? 'secondary' : 'destructive'} className="rounded-full">
                            {entry.trophiesDelta >= 0 ? '+' : ''}{entry.trophiesDelta} trophées
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{entry.destructionPercent}% destruction</span>
                          <span>•</span>
                          <span>{formatMoney(entry.moneyStolen)} $</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/50 shadow-none">
              <CardContent className="space-y-4 p-5">
                <h2 className="text-base font-semibold">Activité du village</h2>
                <div className="space-y-3">
                  {history.activities.map((activity) => (
                    <div key={activity.id} className="rounded-2xl border border-border/50 bg-muted/15 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={cn('font-medium', getActivityTone(activity.type))}>{activity.title}</p>
                          <p className="text-sm text-muted-foreground">{activity.detail}</p>
                        </div>
                        <p className="shrink-0 text-xs text-muted-foreground">{formatDate(activity.createdAt)}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        <span className={activity.deltaMoney >= 0 ? 'text-emerald-600' : 'text-amber-600'}>
                          {activity.deltaMoney >= 0 ? '+' : ''}{formatMoney(activity.deltaMoney)} $
                        </span>
                        <span className={activity.deltaTrophies >= 0 ? 'text-sky-600' : 'text-rose-600'}>
                          {activity.deltaTrophies >= 0 ? '+' : ''}{activity.deltaTrophies} trophées
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className={SPACING.SECTION_SPACING}>
          <div className="grid gap-6 xl:grid-cols-3">
            {[
              { key: 'trophies', title: 'Top trophées', icon: <Trophy className="h-4 w-4" />, rows: leaderboard.trophies },
              { key: 'loot', title: 'Top pillage', icon: <Coins className="h-4 w-4" />, rows: leaderboard.loot },
              { key: 'defense', title: 'Top défense', icon: <Target className="h-4 w-4" />, rows: leaderboard.defense },
            ].map((column) => (
              <Card key={column.key} className="rounded-3xl border-border/50 shadow-none">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl border border-border/50 bg-muted/30 p-2">{column.icon}</span>
                    <h2 className="text-base font-semibold">{column.title}</h2>
                  </div>
                  <div className="space-y-3">
                    {column.rows.map((entry) => (
                      <div key={`${column.key}-${entry.rank}-${entry.user?.id ?? 'unknown'}`} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/15 p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/50 bg-background text-sm font-semibold">
                          {entry.rank}
                        </div>
                        <div className="min-w-0 flex-1">
                          {entry.user ? (
                            <UsernameDisplay
                              username={entry.user.username}
                              usernameColor={entry.user.usernameColor}
                              usernameClassName="font-medium"
                            />
                          ) : (
                            <span className="font-medium">Village inconnu</span>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {column.key === 'trophies' && `${entry.trophies?.toLocaleString('fr-FR')} trophées`}
                            {column.key === 'loot' && `${(entry.totalLoot ?? 0).toLocaleString('fr-FR')} $ pillés`}
                            {column.key === 'defense' && `${entry.averageDefense ?? 0}% moyenne défensive • ${entry.defenseCount ?? 0} défenses`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

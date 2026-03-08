import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Castle, Coins, Hammer, History, Shield, Sparkles, Swords } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { clashApi, type ClashBuildingInstance, type ClashOpponent, type ClashVillageState } from '@/services/api';

type ClashTab = 'base' | 'attack' | 'history';
type BuildingType = ClashBuildingInstance['type'];

const ATTACK_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const SLOT_LAYOUT = [
  { left: '50%', top: '16%' },
  { left: '30%', top: '28%' },
  { left: '70%', top: '28%' },
  { left: '18%', top: '44%' },
  { left: '50%', top: '44%' },
  { left: '82%', top: '44%' },
  { left: '30%', top: '62%' },
  { left: '70%', top: '62%' },
];

const BUILDINGS: Record<BuildingType, { name: string; emoji: string; cost: number; defense: number; limit: number; tint: string }> = {
  cannon: { name: 'Canon', emoji: '💣', cost: 500, defense: 30, limit: 2, tint: 'from-zinc-300 via-zinc-200 to-slate-100' },
  archer: { name: "Tour d'archers", emoji: '🏹', cost: 900, defense: 52, limit: 2, tint: 'from-emerald-300 via-lime-200 to-yellow-100' },
  mortar: { name: 'Mortier', emoji: '🪨', cost: 1500, defense: 85, limit: 1, tint: 'from-orange-300 via-amber-200 to-yellow-100' },
  tesla: { name: 'Tesla', emoji: '⚡', cost: 2400, defense: 130, limit: 1, tint: 'from-sky-300 via-cyan-200 to-blue-100' },
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
}

function constructionLimit(level: number) {
  return Math.min(SLOT_LAYOUT.length, 2 + level * 2);
}

function townHallUpgradeCost(level: number) {
  return 1500 * level * 2;
}

function sellPrice(type: BuildingType) {
  return Math.floor(BUILDINGS[type].cost / 2);
}

function formatRemaining(ms: number) {
  if (ms <= 0) return 'prêt';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}`;
  return `${minutes} min`;
}

function relativeTime(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export default function Clash() {
  const { user, updateBalance } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ClashTab>('base');
  const [village, setVillage] = useState<ClashVillageState | null>(null);
  const [opponents, setOpponents] = useState<ClashOpponent[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [stateRes, opponentsRes] = await Promise.all([
          clashApi.getState(),
          clashApi.getOpponents(),
        ]);
        setVillage(stateRes.data.village);
        setOpponents(opponentsRes.data.opponents);
      } catch (error) {
        toast({
          title: 'Clash indisponible',
          description: "Impossible de charger l'état du village.",
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [toast]);

  useEffect(() => {
    if (activeTab !== 'attack') return;
    refreshOpponents().catch(() => {
      // Silent refresh failure; initial load/toast path already covers hard failures.
    });
  }, [activeTab]);

  const refreshOpponents = async () => {
    const response = await clashApi.getOpponents();
    setOpponents(response.data.opponents);
  };

  const applyVillage = (nextVillage: ClashVillageState) => {
    setVillage(nextVillage);
    if (user) {
      updateBalance(user.aura, nextVillage.money);
    }
  };

  const runAction = async (key: string, action: () => Promise<void>) => {
    try {
      setBusyAction(key);
      await action();
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : 'Action impossible';

      toast({
        title: 'Clash',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const buildingCounts = useMemo(() => {
    if (!village) {
      return { cannon: 0, archer: 0, mortar: 0, tesla: 0 };
    }

    return village.buildings.reduce<Record<BuildingType, number>>((acc, item) => {
      acc[item.type] += 1;
      return acc;
    }, { cannon: 0, archer: 0, mortar: 0, tesla: 0 });
  }, [village]);

  const selectedBuilding = village?.buildings.find((item) => item.id === selectedBuildingId) ?? null;
  const shieldRemaining = village?.shieldUntil ? new Date(village.shieldUntil).getTime() - now : 0;
  const attackCooldownRemaining = village?.lastAttackAt ? new Date(village.lastAttackAt).getTime() + ATTACK_COOLDOWN_MS - now : 0;

  if (loading || !village) {
    return (
      <PageShell size="wide">
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
          Chargement du village...
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell size="wide">
      <PageHeader
        title="Clash"
        description="Construis une base isométrique, protège ton Hôtel de Ville, attaque de vrais joueurs et consulte l'historique réel des pillages."
        actions={(
          <>
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
              <Coins className="h-3.5 w-3.5" />
              {formatMoney(village.money)} or
            </Badge>
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
              <Shield className="h-3.5 w-3.5" />
              {shieldRemaining > 0 ? `Bouclier ${formatRemaining(shieldRemaining)}` : 'Pas de bouclier'}
            </Badge>
          </>
        )}
      />

      <div className="rounded-[32px] border border-border/60 bg-[radial-gradient(circle_at_top,#ecfccb,transparent_38%),linear-gradient(135deg,#fef3c7_0%,#ffffff_38%,#dcfce7_100%)] p-4 shadow-sm md:p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-white/70 bg-white/70 backdrop-blur">
            <CardContent className="flex items-center gap-3 p-4">
              <Castle className="h-9 w-9 rounded-2xl bg-amber-100 p-2 text-amber-700" />
              <div>
                <p className="text-xs text-muted-foreground">Hôtel de ville</p>
                <p className="text-xl font-semibold">Niv. {village.townHallLevel}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/70 bg-white/70 backdrop-blur">
            <CardContent className="flex items-center gap-3 p-4">
              <Hammer className="h-9 w-9 rounded-2xl bg-lime-100 p-2 text-lime-700" />
              <div>
                <p className="text-xs text-muted-foreground">Défenses</p>
                <p className="text-xl font-semibold">{village.buildings.length} / {constructionLimit(village.townHallLevel)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/70 bg-white/70 backdrop-blur">
            <CardContent className="flex items-center gap-3 p-4">
              <Shield className="h-9 w-9 rounded-2xl bg-sky-100 p-2 text-sky-700" />
              <div>
                <p className="text-xs text-muted-foreground">Score défensif</p>
                <p className="text-xl font-semibold">
                  {village.townHallLevel * 45 + village.buildings.reduce((sum, item) => sum + BUILDINGS[item.type].defense, 0)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/70 bg-white/70 backdrop-blur">
            <CardContent className="flex items-center gap-3 p-4">
              <Swords className="h-9 w-9 rounded-2xl bg-rose-100 p-2 text-rose-700" />
              <div>
                <p className="text-xs text-muted-foreground">Prochain raid</p>
                <p className="text-xl font-semibold">{attackCooldownRemaining > 0 ? formatRemaining(attackCooldownRemaining) : 'Disponible'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ClashTab)} className="mt-6 space-y-6">
          <TabsList className="h-auto flex-wrap bg-white/70 p-1 backdrop-blur">
            <TabsTrigger value="base" className="gap-2">
              <Hammer className="h-4 w-4" />
              Base
            </TabsTrigger>
            <TabsTrigger value="attack" className="gap-2">
              <Swords className="h-4 w-4" />
              Attaquer
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Historique
            </TabsTrigger>
          </TabsList>

          <TabsContent value="base" className="mt-0 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="overflow-hidden border-white/70 bg-white/75 backdrop-blur">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  Base isométrique
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <div className="relative mx-auto min-h-[420px] overflow-hidden rounded-[28px] border border-emerald-200/70 bg-[radial-gradient(circle_at_top,#bbf7d0,transparent_30%),linear-gradient(180deg,#ecfccb_0%,#d9f99d_35%,#86efac_100%)]">
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-[radial-gradient(circle_at_center,#166534_0%,transparent_72%)] opacity-20" />
                  <div className="absolute left-1/2 top-[43%] z-20 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 rotate-45 items-center justify-center rounded-3xl border-4 border-amber-200 bg-[linear-gradient(135deg,#f97316,#fb923c,#fed7aa)] shadow-[0_20px_40px_rgba(0,0,0,0.18)]">
                    <div className="-rotate-45 text-center text-white">
                      <div className="text-3xl">🏰</div>
                      <div className="text-xs font-semibold">Hôtel de ville {village.townHallLevel}</div>
                    </div>
                  </div>

                  {SLOT_LAYOUT.map((slot, index) => {
                    const building = village.buildings.find((item) => item.slot === index);
                    const unlocked = index < constructionLimit(village.townHallLevel);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setSelectedBuildingId(building?.id ?? null)}
                        disabled={!building}
                        className={cn('absolute h-20 w-20 -translate-x-1/2 -translate-y-1/2', !building && 'cursor-default')}
                        style={{ left: slot.left, top: slot.top }}
                      >
                        <div
                          className={cn(
                            'flex h-full w-full rotate-45 items-center justify-center rounded-3xl border shadow-[0_14px_24px_rgba(0,0,0,0.12)] transition',
                            unlocked ? 'border-emerald-300/70 bg-emerald-100/80' : 'border-dashed border-zinc-300 bg-zinc-200/50',
                            building && 'scale-105 border-white ring-2 ring-white/80',
                            building?.id === selectedBuildingId && 'ring-4 ring-amber-300'
                          )}
                        >
                          <div className="-rotate-45 text-center">
                            {building ? (
                              <>
                                <div className="text-3xl">{BUILDINGS[building.type].emoji}</div>
                                <div className="text-[10px] font-semibold text-zinc-700">
                                  {BUILDINGS[building.type].name}
                                </div>
                              </>
                            ) : unlocked ? (
                              <span className="text-xs font-semibold text-emerald-700">Libre</span>
                            ) : (
                              <span className="text-[10px] font-semibold text-zinc-500">Verrou</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">Troupes communes: Barbares, Archères, Géants</Badge>
                  <Badge variant="outline">Même composition pour tous les joueurs pour le moment</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-white/70 bg-white/75 backdrop-blur">
                <CardHeader className="border-b border-border/50">
                  <CardTitle>Améliorations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">Hôtel de Ville niv. {village.townHallLevel}</p>
                        <p className="text-sm text-muted-foreground">
                          Débloque plus d'emplacements de construction et augmente la résistance de la base.
                        </p>
                      </div>
                      <Badge variant="secondary">{constructionLimit(village.townHallLevel)} emplacements</Badge>
                    </div>
                    <Button
                      className="mt-4 w-full"
                      disabled={busyAction === 'upgrade' || village.money < townHallUpgradeCost(village.townHallLevel)}
                      onClick={() => runAction('upgrade', async () => {
                        const response = await clashApi.upgradeTownHall();
                        applyVillage(response.data.village);
                        toast({ title: 'Clash', description: "Hôtel de Ville amélioré." });
                      })}
                    >
                      Améliorer pour {formatMoney(townHallUpgradeCost(village.townHallLevel))} or
                    </Button>
                  </div>

                  {Object.entries(BUILDINGS).map(([key, def]) => {
                    const type = key as BuildingType;
                    const count = buildingCounts[type];
                    const disabled = village.money < def.cost || village.buildings.length >= constructionLimit(village.townHallLevel) || count >= def.limit || !!busyAction;

                    return (
                      <div key={key} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{def.emoji} {def.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Défense +{def.defense} · Limite {count}/{def.limit}
                            </p>
                          </div>
                          <Badge variant="outline">{formatMoney(def.cost)} or</Badge>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            className="flex-1"
                            disabled={disabled}
                            onClick={() => runAction(`build-${type}`, async () => {
                              const response = await clashApi.build(type);
                              applyVillage(response.data.village);
                              toast({ title: 'Clash', description: `${def.name} construit.` });
                            })}
                          >
                            Construire
                          </Button>
                          <Badge className={cn('border-0 bg-gradient-to-r text-zinc-900', def.tint)}>+{def.defense}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-white/70 bg-white/75 backdrop-blur">
                <CardHeader className="border-b border-border/50">
                  <CardTitle>Revente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {selectedBuilding ? (
                    <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                      <p className="font-semibold">{BUILDINGS[selectedBuilding.type].emoji} {BUILDINGS[selectedBuilding.type].name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Emplacement {selectedBuilding.slot + 1} · Revente à moitié prix: {formatMoney(sellPrice(selectedBuilding.type))} or
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4 w-full"
                        disabled={!!busyAction}
                        onClick={() => runAction(`sell-${selectedBuilding.id}`, async () => {
                          const response = await clashApi.sell(selectedBuilding.id);
                          applyVillage(response.data.village);
                          setSelectedBuildingId(null);
                          toast({ title: 'Clash', description: 'Bâtiment vendu.' });
                        })}
                      >
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        Vendre le bâtiment
                      </Button>
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                      Sélectionne une défense dans la base isométrique pour la vendre à moitié prix.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="attack" className="mt-0 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
            <Card className="border-white/70 bg-white/75 backdrop-blur">
              <CardHeader className="border-b border-border/50">
                <CardTitle>Armée commune</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                  <p className="font-semibold">Composition actuelle</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tous les joueurs déploient les mêmes troupes pour l'instant. Les différences viennent de la base et du timing des raids.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="secondary">20 Barbares</Badge>
                    <Badge variant="secondary">12 Archères</Badge>
                    <Badge variant="secondary">4 Géants</Badge>
                  </div>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <p className="font-semibold">Cooldown d'attaque</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Une attaque est possible toutes les 24 heures. Le défenseur obtient ensuite un bouclier de 11 heures.
                  </p>
                  <Badge variant="outline" className="mt-3">
                    {attackCooldownRemaining > 0 ? `Prochain raid dans ${formatRemaining(attackCooldownRemaining)}` : 'Raid disponible maintenant'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/70 bg-white/75 backdrop-blur">
              <CardHeader className="border-b border-border/50">
                <CardTitle>Joueurs à attaquer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {opponents.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                    Aucun autre joueur disponible pour le moment.
                  </p>
                ) : opponents.map((opponent) => {
                  const shieldActive = opponent.shieldUntil ? new Date(opponent.shieldUntil).getTime() > now : false;
                  const estimatedLoot = Math.floor(opponent.money * 0.24);

                  return (
                    <div key={opponent.id} className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-background/80 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold">{opponent.name}</p>
                          <Badge variant="secondary">Hôtel de ville {opponent.townHallLevel}</Badge>
                          <Badge variant="outline">Défense {opponent.defenseScore}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span>{formatMoney(opponent.money)} or en réserve</span>
                          <span>•</span>
                          <span>Butin estimé {formatMoney(estimatedLoot)} or</span>
                          {shieldActive && opponent.shieldUntil ? (
                            <>
                              <span>•</span>
                              <span>Bouclier {formatRemaining(new Date(opponent.shieldUntil).getTime() - now)}</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <Button
                        disabled={!!busyAction || attackCooldownRemaining > 0 || shieldActive}
                        onClick={() => runAction(`attack-${opponent.id}`, async () => {
                          const response = await clashApi.attack(opponent.id);
                          applyVillage(response.data.village);
                          await refreshOpponents();
                          toast({
                            title: response.data.attack.success ? 'Raid réussi' : 'Raid raté',
                            description: response.data.attack.success
                              ? `${response.data.attack.plunder} or pillé sur ${response.data.attack.targetUsername}.`
                              : `${response.data.attack.targetUsername} a tenu sa défense.`,
                          });
                        })}
                      >
                        <Swords className="mr-2 h-4 w-4" />
                        Lancer le raid
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <Card className="border-white/70 bg-white/75 backdrop-blur">
              <CardHeader className="border-b border-border/50">
                <CardTitle>Historique des actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                {village.history.map((entry) => (
                  <div key={entry.id} className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/80 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold">{entry.title}</p>
                      <p className="text-sm text-muted-foreground">{entry.detail}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{relativeTime(entry.timestamp)}</Badge>
                      <Badge variant={entry.deltaMoney >= 0 ? 'secondary' : 'destructive'}>
                        {entry.deltaMoney >= 0 ? '+' : ''}{formatMoney(entry.deltaMoney)} or
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { passApi, type PassClaimResponse, type PassRewardEntry, type PassStatus } from '@/services/api';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Clock3,
  Gem,
  Gift,
  Loader2,
  Package,
  Shield,
  Sparkles,
  Star,
  Wallet,
} from 'lucide-react';
import { useRewardQueue, type RewardItem } from '@/contexts/RewardQueueContext';

const rarityStyles: Record<
  PassRewardEntry['rarity'],
  {
    card: string;
    badge: string;
    iconWrap: string;
    icon: string;
  }
> = {
  common: {
    card: 'border-border/50 bg-background',
    badge: 'border-white/10 bg-muted/40 text-foreground',
    iconWrap: 'bg-muted/40',
    icon: 'text-foreground',
  },
  rare: {
    card: 'border-sky-400/25 bg-sky-400/10',
    badge: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
    iconWrap: 'bg-sky-400/15',
    icon: 'text-sky-300',
  },
  epic: {
    card: 'border-fuchsia-400/25 bg-fuchsia-400/10',
    badge: 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200',
    iconWrap: 'bg-fuchsia-400/15',
    icon: 'text-fuchsia-300',
  },
  legendary: {
    card: 'border-amber-400/30 bg-amber-400/10',
    badge: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
    iconWrap: 'bg-amber-400/15',
    icon: 'text-amber-300',
  },
};

function useCountdown(targetIso: string | null): string {
  const [display, setDisplay] = useState('--:--:--');

  useEffect(() => {
    if (!targetIso) return;

    const update = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) {
        setDisplay('00:00:00');
        return;
      }

      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1_000);
      setDisplay(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetIso]);

  return display;
}

function getDailyCycleProgress(targetIso: string | null): number {
  if (!targetIso) return 0;

  const end = new Date(targetIso).getTime();
  const start = end - 24 * 60 * 60 * 1000;
  const now = Date.now();
  const progress = ((now - start) / (end - start)) * 100;

  return Math.max(0, Math.min(100, progress));
}

function getRewardIcon(type: PassRewardEntry['type']) {
  if (type === 'money') return Wallet;
  if (type === 'aura') return Gem;
  return Package;
}

function formatRewardValue(reward: PassRewardEntry) {
  if (reward.type === 'money' && typeof reward.amount === 'number') {
    return `+${reward.amount.toLocaleString('fr-FR')}$`;
  }

  if (reward.type === 'aura' && typeof reward.amount === 'number') {
    return `+${reward.amount.toLocaleString('fr-FR')} aura`;
  }

  return reward.label;
}

function formatResetDate(value: string | null | undefined) {
  if (!value) return '--';

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Star;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/80 p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function Pass() {
  const [status, setStatus] = useState<PassStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [lastClaim, setLastClaim] = useState<PassClaimResponse | null>(null);
  const { enqueue } = useRewardQueue();

  const countdown = useCountdown(status?.nextReset ?? null);
  const cycleProgress = getDailyCycleProgress(status?.nextReset ?? null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const response = await passApi.getStatus();
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch pass status:', error);
      toast.error('Impossible de charger le pass.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const response = await passApi.claim();
      setLastClaim(response.data);
      await loadStatus();
      const rewardItems: RewardItem[] = response.data.rewards.map(
        (reward: PassRewardEntry, index: number) => ({
          id: String(index),
          type: reward.type,
          amount: reward.amount ?? reward.quantity ?? 0,
          label: reward.label,
          rarity: reward.rarity,
        }),
      );
      if (rewardItems.length > 0) enqueue(rewardItems);
    } catch (error) {
      console.error('Failed to claim pass reward:', error);
      toast.error("Impossible d’ouvrir la boite du jour.");
    } finally {
      setClaiming(false);
    }
  };

  const rewardSummary = useMemo(() => {
    if (!lastClaim) return null;
    return lastClaim.rewards.map((reward) => reward.label).join(' · ');
  }, [lastClaim]);

  const heroStatusLabel = status?.status === 'claimed' ? 'Déjà ouverte aujourd’hui' : 'Disponible maintenant';

  return (
    <PageShell size="wide">
      <PageHeader
        title="Pass"
        description="Une ouverture par jour, avec une base garantie en argent et en aura, plus une chance de drop un objet de la boutique."
        actions={
          <Badge variant="outline" className="h-9 rounded-full border-border/60 bg-background/80 px-4 text-sm font-medium">
            <Clock3 className="mr-2 h-4 w-4 text-sky-400" />
            Reset dans {countdown}
          </Badge>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
        <div className="space-y-6">
          <Card className="overflow-hidden rounded-3xl border-border/60 bg-gradient-to-br from-background via-background to-amber-500/10 shadow-none">
            <CardContent className="relative space-y-6 p-6 sm:p-7">
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-amber-400/10 to-transparent" />

              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-amber-100">
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Daily loot
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-border/60 bg-background/80 px-3 py-1">
                      {heroStatusLabel}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15">
                        <Gift className="h-6 w-6 text-amber-300" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Boîte du jour</h2>
                        <p className="text-sm text-muted-foreground">
                          La streak reste visible comme repère de régularité, mais elle n’augmente pas la valeur des drops.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <MetricCard
                        icon={Star}
                        label="Streak"
                        value={String(status?.streak ?? 0)}
                        hint="Compteur de présence quotidienne."
                        tone="bg-amber-400/15 text-amber-300"
                      />
                      <MetricCard
                        icon={Wallet}
                        label="Base money"
                        value={status ? `${status.moneyRange.min}-${status.moneyRange.max}$` : '--'}
                        hint="Toujours inclus dans l’ouverture."
                        tone="bg-emerald-400/15 text-emerald-300"
                      />
                      <MetricCard
                        icon={Gem}
                        label="Base aura"
                        value={status ? `${status.auraRange.min}-${status.auraRange.max}` : '--'}
                        hint="Toujours inclus dans l’ouverture."
                        tone="bg-sky-400/15 text-sky-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="relative w-full max-w-sm rounded-3xl border border-border/60 bg-background/85 p-5">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Ouverture</p>
                        <p className="mt-1 text-lg font-semibold">
                          {status?.status === 'claimed' ? 'Déjà récupérée' : 'Prête à être ouverte'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-muted/40 px-3 py-2 text-right">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Chance item</div>
                        <div className="text-xl font-semibold">{status ? `${status.itemDropChance}%` : '--'}</div>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {status?.status === 'claimed'
                        ? `Ta prochaine boîte arrive dans ${countdown}.`
                        : 'L’ouverture du jour est disponible maintenant. Les objets peu chers restent les plus probables.'}
                    </p>

                    <Button
                      size="lg"
                      onClick={handleClaim}
                      disabled={loading || claiming || status?.status === 'claimed'}
                      className="h-12 w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90"
                    >
                      {loading || claiming ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Gift className="mr-2 h-4 w-4" />
                      )}
                      {status?.status === 'claimed' ? 'Ouverture déjà faite' : 'Ouvrir la boîte du jour'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="relative grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Cycle quotidien</span>
                    <span className="font-medium">{countdown}</span>
                  </div>
                  <Progress value={cycleProgress} className="h-2 bg-muted/40 [&>div]:bg-amber-400" />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <span>Reset prévu le {formatResetDate(status?.nextReset)}</span>
                    <span>1 ouverture maximum par jour</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full border-border/60 bg-background/80 px-3 py-1">
                    Argent garanti
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-border/60 bg-background/80 px-3 py-1">
                    Aura garanti
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-border/60 bg-background/80 px-3 py-1">
                    Objet possible
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {status?.resetNotice ? (
            <Card className="border-rose-500/25 bg-rose-500/8 shadow-none">
              <CardContent className="flex items-start gap-3 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/12">
                  <Clock3 className="h-5 w-5 text-rose-300" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-rose-100">Streak réinitialisée</p>
                  <p className="text-sm text-rose-100/80">
                    Un jour a été manqué. La progression repart de zéro, mais les récompenses du pass restent indépendantes de cette streak.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {lastClaim ? (
            <Card className="rounded-3xl border-border/60 shadow-none">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-full bg-muted/40">
                        Dernière ouverture
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-border/60">
                        streak {lastClaim.streak}
                      </Badge>
                    </div>
                    <div>
                      <CardTitle className="text-2xl">{lastClaim.boxName}</CardTitle>
                      <CardDescription>{rewardSummary}</CardDescription>
                    </div>
                  </div>

                  <div className="grid min-w-[220px] gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                    <div className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Nouveau solde</div>
                      <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                        <Wallet className="h-4 w-4 text-emerald-400" />
                        {lastClaim.newBalance.money.toLocaleString('fr-FR')}$
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Aura</div>
                      <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                        <Gem className="h-4 w-4 text-sky-400" />
                        {lastClaim.newBalance.aura.toLocaleString('fr-FR')}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {lastClaim.rewards.map((reward, index) => {
                    const Icon = getRewardIcon(reward.type);
                    const style = rarityStyles[reward.rarity];

                    return (
                      <div
                        key={`${reward.type}-${index}`}
                        className={cn('rounded-3xl border p-4 transition-colors', style.card)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Badge variant="outline" className={cn('rounded-full capitalize', style.badge)}>
                            {reward.rarity}
                          </Badge>
                          <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', style.iconWrap)}>
                            <Icon className={cn('h-4 w-4', style.icon)} />
                          </div>
                        </div>

                        {reward.item ? (
                          <div className="mt-4 space-y-4">
                            {reward.item.imageUrl ? (
                              <img
                                src={resolveImageUrl(reward.item.imageUrl)}
                                alt={reward.item.name}
                                className="h-32 w-full rounded-2xl object-cover"
                              />
                            ) : (
                              <div className="flex h-32 w-full items-center justify-center rounded-2xl bg-muted/30">
                                <Package className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}

                            <div className="space-y-1.5">
                              <div className="text-lg font-semibold">{reward.item.name}</div>
                              <p className="text-sm text-muted-foreground">{reward.item.description}</p>
                            </div>

                            <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-background/60 px-3 py-2 text-sm">
                              <span className="text-muted-foreground">Valeur boutique</span>
                              <span className="font-medium">{reward.item.price.toLocaleString('fr-FR')}$</span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-6 space-y-2">
                            <div className="text-2xl font-semibold tracking-tight">{formatRewardValue(reward)}</div>
                            <p className="text-sm text-muted-foreground">
                              Récompense créditée immédiatement sur ton compte.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card className="rounded-3xl border-border/60 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock3 className="h-5 w-5 text-sky-400" />
                Réinitialisation
              </CardTitle>
              <CardDescription>La page suit un cycle fixe de 24h avec une seule ouverture autorisée.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Compte à rebours</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">{countdown}</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {status?.status === 'claimed'
                    ? 'La boîte est en cooldown jusqu’au prochain reset.'
                    : 'La fenêtre du jour est encore ouverte.'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/50 bg-background p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Prochain reset</div>
                  <div className="mt-2 text-sm font-medium">{formatResetDate(status?.nextReset)}</div>
                </div>
                <div className="rounded-2xl border border-border/50 bg-background p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Statut</div>
                  <div className="mt-2 text-sm font-medium">{heroStatusLabel}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/60 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-emerald-400" />
                Pool du jour
              </CardTitle>
              <CardDescription>Ce que l’ouverture peut contenir aujourd’hui.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4 text-emerald-400" />
                  Money garanti
                </div>
                <div className="text-lg font-semibold">
                  {status ? `${status.moneyRange.min.toLocaleString('fr-FR')} - ${status.moneyRange.max.toLocaleString('fr-FR')}$` : '--'}
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Gem className="h-4 w-4 text-sky-400" />
                  Aura garanti
                </div>
                <div className="text-lg font-semibold">
                  {status ? `${status.auraRange.min.toLocaleString('fr-FR')} - ${status.auraRange.max.toLocaleString('fr-FR')}` : '--'}
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Gift className="h-4 w-4 text-amber-400" />
                  Chance de drop un objet
                </div>
                <div className="text-lg font-semibold">{status ? `${status.itemDropChance}%` : '--'}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Les objets moins chers sortent beaucoup plus souvent que les items premium.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/60 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-fuchsia-400" />
                Exemples d’objets
              </CardTitle>
              <CardDescription>Quelques items actuellement éligibles dans le tirage.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {status?.featuredItems?.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/20 p-3">
                    {item.imageUrl ? (
                      <img
                        src={resolveImageUrl(item.imageUrl)}
                        alt={item.name}
                        className="h-16 w-16 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-background">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{item.name}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</div>
                    </div>

                    <div className="shrink-0 rounded-full bg-background px-3 py-1 text-sm font-medium">
                      {item.price.toLocaleString('fr-FR')}$
                    </div>
                  </div>
                ))}

                {!status?.featuredItems?.length && !loading ? (
                  <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
                    Aucun objet éligible aujourd’hui. L’ouverture donnera quand même de l’argent et de l’aura.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

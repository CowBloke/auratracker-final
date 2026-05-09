import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageShell } from '@/components/layout/PageShell';
import { passApi, type PassClaimResponse, type PassRewardEntry, type PassStatus } from '@/services/api';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import LootCrateOverlay, { type LootCrateTier } from '@/components/pass/LootCrateOverlay';
import {
  AlertCircle,
  Clock3,
  Flame,
  Gift,
  Loader2,
  Package,
} from 'lucide-react';
import { useRewardQueue, type RewardItem } from '@/contexts/RewardQueueContext';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';

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
  if (type === 'money') return () => <CurrencyIcon type="money" className="h-full w-full" />;
  if (type === 'aura') return () => <CurrencyIcon type="aura" className="h-full w-full" />;
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

interface LootCratePayload {
  tier: LootCrateTier;
  itemName: string;
  itemColor: string;
  itemImage?: string;
}

const rewardRarityRank: Record<PassRewardEntry['rarity'], number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

function getLootCrateTier(reward: PassRewardEntry): LootCrateTier {
  if (reward.rarity === 'legendary') {
    return reward.type === 'item' ? 'ruby' : 'emerald';
  }
  if (reward.rarity === 'epic') return 'diamond';
  if (reward.rarity === 'rare') return reward.type === 'item' ? 'gold' : 'iron';
  return reward.type === 'item' ? 'iron' : 'wood';
}

function getLootCrateColor(reward: PassRewardEntry): string {
  if (reward.type === 'money') return '#ffe066';
  if (reward.type === 'aura') return '#7cffb0';

  if (reward.rarity === 'legendary') return '#ff6080';
  if (reward.rarity === 'epic') return '#baf0ff';
  if (reward.rarity === 'rare') return '#ffd98c';
  return '#d7dbe3';
}

function pickFeaturedReward(rewards: PassRewardEntry[]): PassRewardEntry | null {
  if (rewards.length === 0) return null;

  const sorted = [...rewards].sort((a, b) => {
    const rarityDelta = rewardRarityRank[b.rarity] - rewardRarityRank[a.rarity];
    if (rarityDelta !== 0) return rarityDelta;

    if (a.type === b.type) return 0;
    if (a.type === 'item') return -1;
    if (b.type === 'item') return 1;
    return 0;
  });

  return sorted[0];
}

function createLootCratePayload(reward: PassRewardEntry): LootCratePayload {
  const resolvedName = reward.item?.name ?? reward.label;
  const resolvedImage = reward.item?.imageUrl ? resolveImageUrl(reward.item.imageUrl) : undefined;

  return {
    tier: getLootCrateTier(reward),
    itemName: resolvedName,
    itemColor: getLootCrateColor(reward),
    itemImage: resolvedImage,
  };
}

function PassMetricCard({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-background/80 text-muted-foreground">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className={cn('text-base font-semibold tracking-tight', valueClassName)}>{value}</p>
      </div>
    </div>
  );
}

function PassRewardPreview({ reward }: { reward: PassRewardEntry }) {
  const Icon = getRewardIcon(reward.type);
  const style = rarityStyles[reward.rarity];

  return (
    <div className={cn('rounded-2xl border p-3', style.card)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Badge variant="outline" className={cn('rounded-full capitalize text-[10px]', style.badge)}>
          {reward.rarity}
        </Badge>
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-xl', style.iconWrap)}>
          <Icon className={cn('h-3.5 w-3.5', style.icon)} />
        </div>
      </div>

      {reward.item ? (
        <div className="space-y-2">
          {reward.item.imageUrl ? (
            <img
              src={resolveImageUrl(reward.item.imageUrl)}
              alt={reward.item.name}
              className="h-24 w-full rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-24 w-full items-center justify-center rounded-xl bg-background/70">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="truncate text-sm font-semibold">{reward.item.name}</div>
        </div>
      ) : (
        <div className="text-lg font-semibold tracking-tight">{formatRewardValue(reward)}</div>
      )}
    </div>
  );
}

function PassLoadingState() {
  return (
    <PageShell>
      <div className="space-y-8 animate-pulse">
        <div className="space-y-3">
          <div className="h-8 w-52 rounded bg-muted" />
          <div className="h-4 w-full max-w-xl rounded bg-muted" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <div className="h-[420px] rounded-3xl bg-muted" />
          <div className="space-y-6">
            <div className="h-64 rounded-3xl bg-muted" />
            <div className="h-72 rounded-3xl bg-muted" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default function Pass() {
  const [status, setStatus] = useState<PassStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [lastClaim, setLastClaim] = useState<PassClaimResponse | null>(null);
  const [activeLootCrate, setActiveLootCrate] = useState<LootCratePayload | null>(null);
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

      const featuredReward = pickFeaturedReward(response.data.rewards);
      if (featuredReward) {
        setActiveLootCrate(createLootCratePayload(featuredReward));
      }

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

  const heroStatusLabel = status?.status === 'claimed' ? 'Déjà ouvert' : 'Disponible';
  const heroActionLabel = status?.status === 'claimed' ? 'Déjà ouvert aujourd’hui' : 'Ouvrir la boîte du jour';
  const featuredItems = status?.featuredItems?.slice(0, 9) ?? [];

  if (loading && !status) {
    return <PassLoadingState />;
  }

  return (
    <>
      <PageShell className="xl:h-[calc(100vh-5.5rem)] xl:overflow-hidden">
        <div className="grid gap-6 xl:h-full xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)] xl:items-stretch">
          <div className="space-y-6 xl:flex xl:min-h-0 xl:flex-col">
            <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-none xl:flex-[0_0_auto]">
              <CardContent className="p-0">
                <div className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_70%)]" />
                  <div className="relative space-y-6 p-6 sm:p-8">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="rounded-full border border-border/50 bg-background/70">
                        {heroStatusLabel}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-border/60 bg-background/80 tabular-nums">
                        <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                        {countdown}
                      </Badge>
                      <Badge variant="secondary" className="rounded-full border border-border/50 bg-muted/30">
                        <Flame className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
                        Streak {status?.streak ?? 0}
                      </Badge>
                    </div>

                    <div className="max-w-2xl">
                      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        Boîte du jour
                      </h2>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <PassMetricCard
                        icon={<CurrencyIcon type="money" className="h-4 w-4" />}
                        label="Argent possible"
                        value={status ? `${status.moneyRange.min.toLocaleString('fr-FR')} - ${status.moneyRange.max.toLocaleString('fr-FR')}$` : '--'}
                      />
                      <PassMetricCard
                        icon={<CurrencyIcon type="aura" className="h-4 w-4" />}
                        label="Aura possible"
                        value={status ? `${status.auraRange.min.toLocaleString('fr-FR')} - ${status.auraRange.max.toLocaleString('fr-FR')} aura` : '--'}
                      />
                      <PassMetricCard
                        icon={<Gift className="h-4 w-4 text-amber-400" />}
                        label="Chance d’objet"
                        value={status ? `${status.itemDropChance}%` : '--'}
                        valueClassName="text-amber-300"
                      />
                    </div>

                    <div className="space-y-3 rounded-2xl border border-border/50 bg-background/60 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm font-medium tabular-nums">{countdown}</div>
                        <Button
                          size="lg"
                          onClick={handleClaim}
                          disabled={loading || claiming || status?.status === 'claimed'}
                          className="h-12 rounded-2xl px-5"
                        >
                          {loading || claiming ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Gift className="mr-2 h-4 w-4" />
                          )}
                          {heroActionLabel}
                        </Button>
                      </div>
                      <Progress value={cycleProgress} className="h-2 bg-muted/40 [&>div]:bg-foreground" />
                    </div>

                    {status?.resetNotice ? (
                      <div className="flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="font-medium">Streak réinitialisé</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            {lastClaim ? (
              <Card className="rounded-3xl border-border/60 shadow-none xl:min-h-0 xl:flex-1">
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">Dernier drop</CardTitle>
                      <CardDescription>{rewardSummary}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="gap-1.5 rounded-full border-border/60">
                        <CurrencyIcon type="money" className="h-3 w-3" />
                        <span>{lastClaim.newBalance.money.toLocaleString('fr-FR')}$</span>
                      </Badge>
                      <Badge variant="outline" className="gap-1.5 rounded-full border-border/60">
                        <CurrencyIcon type="aura" className="h-3 w-3" />
                        <span>{lastClaim.newBalance.aura.toLocaleString('fr-FR')} aura</span>
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="xl:min-h-0 xl:overflow-y-auto">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {lastClaim.rewards.map((reward, index) => (
                      <PassRewardPreview key={`${reward.type}-${index}`} reward={reward} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6 xl:min-h-0">
            <Card className="rounded-3xl border-border/60 shadow-none xl:flex xl:h-full xl:flex-col">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Rotation d’objets</CardTitle>
              </CardHeader>
              <CardContent className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                {featuredItems.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
                    {featuredItems.map((item) => (
                      <div
                        key={item.id}
                        className="group rounded-2xl border border-border/50 bg-muted/20 p-2.5 transition-colors hover:bg-muted/30"
                      >
                        {item.imageUrl ? (
                          <img
                            src={resolveImageUrl(item.imageUrl)}
                            alt={item.name}
                            className="mb-3 h-24 w-full rounded-xl object-cover"
                          />
                        ) : (
                          <div className="mb-3 flex h-24 w-full items-center justify-center rounded-xl bg-background">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="truncate text-sm font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.type.toLowerCase()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
                    Aucun objet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </PageShell>

      {activeLootCrate ? (
        <LootCrateOverlay
          open={Boolean(activeLootCrate)}
          onClose={() => setActiveLootCrate(null)}
          tier={activeLootCrate.tier}
          itemName={activeLootCrate.itemName}
          itemColor={activeLootCrate.itemColor}
          itemImage={activeLootCrate.itemImage}
        />
      ) : null}
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageShell } from '@/components/layout/page-shell';
import { passApi, type PassClaimResponse, type PassRewardEntry, type PassStatus } from '@/services/api';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  AlertCircle,
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

  const heroStatusLabel = status?.status === 'claimed' ? 'Déjà ouvert' : 'Disponible';

  return (
    <PageShell>
      <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden rounded-3xl border-border/60 bg-background shadow-none">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="secondary" className="rounded-full border border-border/40 bg-muted/40">
                {heroStatusLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/60 bg-background/80 tabular-nums">
                {countdown}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/60 bg-background/80">
                Streak {status?.streak ?? 0}
              </Badge>
            </div>

            <Button
              size="lg"
              onClick={handleClaim}
              disabled={loading || claiming || status?.status === 'claimed'}
              className="h-14 w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90"
            >
              {loading || claiming ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Gift className="mr-2 h-5 w-5" />
              )}
              {status?.status === 'claimed' ? 'Déjà ouvert' : 'Ouvrir'}
            </Button>

            <Progress value={cycleProgress} className="h-2 bg-muted/40 [&>div]:bg-black" />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/50 bg-background/70 p-3">
                <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <CurrencyIcon type="money" className="h-4 w-4" />
                  <span className="text-xs">$</span>
                </div>
                <div className="text-sm font-semibold">
                  {status ? `${status.moneyRange.min.toLocaleString('fr-FR')} - ${status.moneyRange.max.toLocaleString('fr-FR')}` : '--'}
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-background/70 p-3">
                <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <CurrencyIcon type="aura" className="h-4 w-4" />
                  <span className="text-xs">Aura</span>
                </div>
                <div className="text-sm font-semibold">
                  {status ? `${status.auraRange.min.toLocaleString('fr-FR')} - ${status.auraRange.max.toLocaleString('fr-FR')}` : '--'}
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-background/70 p-3">
                <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <Gift className="h-4 w-4 text-amber-400" />
                  <span className="text-xs">Item</span>
                </div>
                <div className="text-sm font-semibold">{status ? `${status.itemDropChance}%` : '--'}</div>
              </div>
            </div>

            {status?.resetNotice ? (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                <AlertCircle className="h-4 w-4" />
                Streak remise a 0
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-3xl border-border/60 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Objets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {status?.featuredItems?.slice(0, 9).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border/50 bg-muted/20 p-2">
                    {item.imageUrl ? (
                      <img
                        src={resolveImageUrl(item.imageUrl)}
                        alt={item.name}
                        className="mb-2 h-20 w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="mb-2 flex h-20 w-full items-center justify-center rounded-xl bg-background">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="truncate text-xs font-medium">{item.name}</div>
                  </div>
                ))}
                {!status?.featuredItems?.length && !loading ? (
                  <div className="col-span-3 rounded-2xl border border-border/50 bg-muted/20 p-3 text-center text-sm text-muted-foreground">
                    --
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {lastClaim ? (
            <Card className="rounded-3xl border-border/60 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Dernier drop</CardTitle>
                <div className="text-sm text-muted-foreground">{rewardSummary}</div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Badge variant="outline" className="rounded-full border-border/60 gap-1.5">
                    <CurrencyIcon type="money" className="h-3 w-3" />
                    <span>{lastClaim.newBalance.money.toLocaleString('fr-FR')}$</span>
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-border/60 gap-1.5">
                    <CurrencyIcon type="aura" className="h-3 w-3" />
                    <span>{lastClaim.newBalance.aura.toLocaleString('fr-FR')} aura</span>
                  </Badge>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {lastClaim.rewards.map((reward, index) => {
                    const Icon = getRewardIcon(reward.type);
                    const style = rarityStyles[reward.rarity];

                    return (
                      <div key={`${reward.type}-${index}`} className={cn('rounded-2xl border p-3', style.card)}>
                        <div className="mb-2 flex items-center justify-between">
                          <Badge variant="outline" className={cn('rounded-full capitalize text-[10px]', style.badge)}>{reward.rarity}</Badge>
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
                            ) : null}
                            <div className="truncate text-sm font-semibold">{reward.item.name}</div>
                          </div>
                        ) : (
                          <div className="text-lg font-semibold tracking-tight">{formatRewardValue(reward)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}

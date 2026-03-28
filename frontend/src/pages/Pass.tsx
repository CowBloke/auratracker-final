import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { passApi, type PassClaimResponse, type PassRewardEntry, type PassStatus } from '@/services/api';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Clock3, Gem, Gift, Loader2, Shield, Sparkles, Star, Wallet } from 'lucide-react';
import { useRewardQueue, type RewardItem } from '@/contexts/RewardQueueContext';

const rarityStyles: Record<PassRewardEntry['rarity'], string> = {
  common: 'border-white/10 bg-white/5 text-foreground',
  rare: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
  epic: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-100',
  legendary: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
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

export default function Pass() {
  const [status, setStatus] = useState<PassStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [lastClaim, setLastClaim] = useState<PassClaimResponse | null>(null);
  const { enqueue } = useRewardQueue();

  const countdown = useCountdown(status?.nextReset ?? null);

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
        (r: PassRewardEntry, i: number) => ({
          id: String(i),
          type: r.type,
          amount: r.amount ?? r.quantity ?? 0,
          label: r.label,
          rarity: r.rarity,
        }),
      );
      if (rewardItems.length > 0) enqueue(rewardItems);
    } catch (error) {
      console.error("Failed to claim pass reward:", error);
      toast.error("Impossible d’ouvrir la boite du jour.");
    } finally {
      setClaiming(false);
    }
  };

  const rewardSummary = useMemo(() => {
    if (!lastClaim) return null;
    return lastClaim.rewards.map((reward) => reward.label).join(' · ');
  }, [lastClaim]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Pass"
        description="Une lootbox quotidienne inspirée des boîtes de récompenses. La streak continue d’exister, mais la valeur des drops n’augmente pas avec elle."
      />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
        <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-amber-500/10 via-background to-background">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Gift className="h-6 w-6 text-amber-400" />
                  Boite du jour
                </CardTitle>
                <CardDescription>
                  Argent, aura et objets de la boutique peuvent tomber. Les objets les moins chers ont beaucoup plus de chances d’apparaître.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="border border-amber-500/20 bg-amber-500/10 text-amber-100">
                {status ? `${status.itemDropChance}% chance d’objet` : '--'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 text-amber-400" />
                  Streak
                </div>
                <div className="text-3xl font-semibold">{status?.streak ?? 0}</div>
                <p className="mt-1 text-xs text-muted-foreground">Elle suit tes jours consécutifs, pas la valeur de la box.</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4 text-emerald-400" />
                  Argent
                </div>
                <div className="text-3xl font-semibold">
                  {status ? `$${status.moneyRange.min}-${status.moneyRange.max}` : '--'}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Base garantie à chaque ouverture.</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Gem className="h-4 w-4 text-sky-400" />
                  Aura
                </div>
                <div className="text-3xl font-semibold">
                  {status ? `${status.auraRange.min}-${status.auraRange.max}` : '--'}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Base garantie à chaque ouverture.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-amber-500/20 bg-black/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm uppercase tracking-[0.22em] text-amber-200/80">
                    <Sparkles className="h-4 w-4" />
                    Ouverture quotidienne
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {status?.status === 'claimed'
                      ? `Déjà ouverte aujourd’hui. Prochaine disponibilité dans ${countdown}.`
                      : 'La box est prête. Ouvre-la pour révéler tes drops du jour.'}
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={handleClaim}
                  disabled={loading || claiming || status?.status === 'claimed'}
                  className="min-w-[220px] bg-amber-500 text-black hover:bg-amber-400"
                >
                  {loading || claiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
                  {status?.status === 'claimed' ? 'Déjà ouverte' : 'Ouvrir la boite du jour'}
                </Button>
              </div>
            </div>

            {status?.resetNotice ? (
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-100">
                Ta streak a été réinitialisée parce qu’un jour a été manqué. Les récompenses restent de toute façon indépendantes de la streak.
              </div>
            ) : null}

            {lastClaim ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{lastClaim.boxName}</h2>
                    <p className="text-sm text-muted-foreground">{rewardSummary}</p>
                  </div>
                  <Badge variant="outline" className="border-border/60 bg-background/70">
                    streak {lastClaim.streak}
                  </Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {lastClaim.rewards.map((reward, index) => (
                    <div
                      key={`${reward.type}-${index}`}
                      className={cn('rounded-2xl border p-4 transition-colors', rarityStyles[reward.rarity])}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="bg-black/20 text-current">
                          {reward.rarity}
                        </Badge>
                        {reward.type === 'money' ? <Wallet className="h-4 w-4" /> : reward.type === 'aura' ? <Gem className="h-4 w-4" /> : <Gift className="h-4 w-4" />}
                      </div>

                      {reward.item ? (
                        <div className="space-y-3">
                          {reward.item.imageUrl ? (
                            <img
                              src={resolveImageUrl(reward.item.imageUrl)}
                              alt={reward.item.name}
                              className="h-24 w-full rounded-xl object-cover"
                            />
                          ) : null}
                          <div>
                            <div className="font-semibold">{reward.item.name}</div>
                            <div className="text-xs text-muted-foreground">{reward.item.description}</div>
                          </div>
                          <div className="text-sm text-amber-100">Valeur boutique: ${reward.item.price}</div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-xl font-semibold">{reward.label}</div>
                          <div className="text-xs text-muted-foreground">Drop monétaire instantané.</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock3 className="h-5 w-5 text-sky-400" />
                Réinitialisation
              </CardTitle>
              <CardDescription>Nouvelle boite disponible chaque jour à minuit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-semibold">{countdown}</div>
              <p className="text-sm text-muted-foreground">
                Si la box du jour a déjà été ouverte, il faut attendre le prochain reset.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-emerald-400" />
                Drops potentiels
              </CardTitle>
              <CardDescription>Exemples d’objets qui peuvent sortir aujourd’hui.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {status?.featuredItems?.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border/50 bg-background/70 p-3">
                    {item.imageUrl ? (
                      <img
                        src={resolveImageUrl(item.imageUrl)}
                        alt={item.name}
                        className="mb-3 h-24 w-full rounded-xl object-cover"
                      />
                    ) : null}
                    <div className="font-medium">{item.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.description}</div>
                    <div className="mt-2 text-sm text-amber-200">${item.price}</div>
                  </div>
                ))}

                {!status?.featuredItems?.length && !loading ? (
                  <div className="rounded-2xl border border-border/50 bg-background/70 p-4 text-sm text-muted-foreground sm:col-span-2">
                    Aucun objet éligible aujourd’hui. La box donnera quand même de l’argent et de l’aura.
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

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CandlestickChart, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TYPOGRAPHY } from '@/lib/design-system';
import { auraCoinApi, marketRoomApi } from '../services/api';

type CoinCardData = {
  key: string;
  name: string;
  symbol: string;
  description: string;
  route: string;
  feePercentage: number;
  price: number;
  change: number;
  personality: 'BALANCED' | 'STABLE' | 'VOLATILE';
};

const personalities: Record<CoinCardData['personality'], { label: string; icon: typeof CandlestickChart; chipClass: string }> = {
  BALANCED: { label: 'Equilibre', icon: CandlestickChart, chipClass: 'border-amber-500/30 bg-amber-500/10 text-amber-200' },
  STABLE: { label: 'Stable', icon: ShieldCheck, chipClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' },
  VOLATILE: { label: 'Tres instable', icon: Zap, chipClass: 'border-rose-500/30 bg-rose-500/10 text-rose-200' },
};

export default function MarketRoom() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState<CoinCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [auraRes, stableRes, chaosRes] = await Promise.all([
          auraCoinApi.getPrice(24),
          marketRoomApi.getCoin('stable-coin').getPrice(24),
          marketRoomApi.getCoin('chaos-coin').getPrice(24),
        ]);

        const buildChange = (history: Array<{ price: number }>, currentPrice: number) => {
          if (history.length <= 1 || history[0].price === 0) return 0;
          return ((currentPrice - history[0].price) / history[0].price) * 100;
        };

        setCoins([
          {
            key: 'aura-coin',
            name: 'Aura Coin',
            symbol: 'AURA',
            description: 'Le terminal historique du site, entre tendance centrale, spread dynamique et levier x10.',
            route: '/games/aura-coin',
            feePercentage: auraRes.data.feePercentage,
            price: auraRes.data.currentPrice,
            change: buildChange(auraRes.data.history, auraRes.data.currentPrice),
            personality: 'BALANCED',
          },
          {
            key: 'stable-coin',
            name: 'Aura Stable',
            symbol: 'AUST',
            description: 'Une version defensive, pensee pour les joueurs qui veulent trader sans grosses secousses.',
            route: '/games/stable-coin',
            feePercentage: stableRes.data.feePercentage,
            price: stableRes.data.currentPrice,
            change: buildChange(stableRes.data.history, stableRes.data.currentPrice),
            personality: 'STABLE',
          },
          {
            key: 'chaos-coin',
            name: 'Chaos Coin',
            symbol: 'CHAO',
            description: 'Une fusee nerveuse : variations brutales, levier plus haut et risques beaucoup plus violents.',
            route: '/games/chaos-coin',
            feePercentage: chaosRes.data.feePercentage,
            price: chaosRes.data.currentPrice,
            change: buildChange(chaosRes.data.history, chaosRes.data.currentPrice),
            personality: 'VOLATILE',
          },
        ]);
      } catch (error) {
        console.error('Failed to load market room:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const highlight = useMemo(() => {
    if (!coins.length) return null;
    return [...coins].sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
  }, [coins]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-border/50 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.22),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_26%),linear-gradient(135deg,#0f172a_0%,#111827_45%,#1f2937_100%)] p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.35)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/80">
              <Sparkles className="h-3.5 w-3.5" />
              Salle de marche
            </div>
            <div className="space-y-3">
              <h1 className={cn(TYPOGRAPHY.H1, 'text-white')}>Trois cryptos, trois temperaments, un seul hub.</h1>
              <p className="max-w-2xl text-sm text-white/70 sm:text-base">
                Aura Coin reste le marche de reference. Aura Stable vise la regularite. Chaos Coin pousse les fluctuations et le levier
                dans une direction beaucoup plus agressive.
              </p>
            </div>
          </div>
          {highlight && (
            <div className="min-w-[260px] rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">Coin a surveiller</p>
              <p className="mt-2 text-xl font-semibold">{highlight.name}</p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-white/60">Prix actuel</p>
                  <p className="text-2xl font-semibold">${highlight.price.toFixed(2)}</p>
                </div>
                <div className={cn('rounded-full px-3 py-1 text-sm font-semibold', highlight.change >= 0 ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200')}>
                  {highlight.change >= 0 ? '+' : ''}{highlight.change.toFixed(2)}%
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="border-border/60 bg-card/70">
                <CardContent className="space-y-4 p-6">
                  <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
                  <div className="h-10 w-40 animate-pulse rounded bg-muted/60" />
                  <div className="h-20 animate-pulse rounded bg-muted/50" />
                </CardContent>
              </Card>
            ))
          : coins.map((coin) => {
              const personality = personalities[coin.personality];
              const Icon = personality.icon;
              return (
                <Card key={coin.key} className="group relative overflow-hidden border-border/60 bg-card/80 shadow-none transition-transform duration-300 hover:-translate-y-1">
                  <CardContent className="space-y-5 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{coin.symbol}</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{coin.name}</h2>
                      </div>
                      <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]', personality.chipClass)}>
                        <Icon className="h-3.5 w-3.5" />
                        {personality.label}
                      </div>
                    </div>

                    <p className="text-sm leading-6 text-muted-foreground">{coin.description}</p>

                    <div className="grid gap-3 rounded-[22px] border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Prix</p>
                          <p className="mt-1 text-3xl font-semibold tabular-nums">${coin.price.toFixed(2)}</p>
                        </div>
                        <div className={cn('rounded-full px-3 py-1 text-sm font-semibold', coin.change >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600')}>
                          {coin.change >= 0 ? '+' : ''}{coin.change.toFixed(2)}%
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Frais de trading</span>
                        <span className="font-semibold tabular-nums">{(coin.feePercentage * 100).toFixed(1)}%</span>
                      </div>
                    </div>

                    <Button className="w-full gap-2" onClick={() => navigate(coin.route)}>
                      Ouvrir le terminal
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
      </section>
    </div>
  );
}

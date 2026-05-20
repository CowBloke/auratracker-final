import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TabsContent } from '@/components/ui/tabs';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn, humanizeUiLabel } from '@/lib/utils';
import { getPageMetaForPath } from '@/lib/page-meta';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  LineChart,
  Line,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  Loader2,
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Activity,
  Download,
  Gamepad2,
  TrendingUp,
  Trophy,
  Users,
  CalendarRange,
  Eye,
  Landmark,
} from 'lucide-react';

export type ActivityTabProps = Record<string, unknown>;

// School-level breakdown for the "online by level" chart. Keys match the
// uppercase values stored in User.schoolLevel; AUTRE catches everything else.
const LEVEL_CONFIG = [
  { key: 'TERMINALE', label: 'Terminale', color: '#ef4444' },
  { key: 'PREMIERE', label: 'Première', color: '#f59e0b' },
  { key: 'SECONDE', label: 'Seconde', color: '#3b82f6' },
  { key: 'AUTRE', label: 'Autre', color: '#a1a1aa' },
] as const;

export function ActivityTab(props: ActivityTabProps) {
  const [levelHoverIndex, setLevelHoverIndex] = useState<number | null>(null);
  const {
    loadingPlatformStats,
    downloadStatsCSV,
    platformStats,
    fetchPlatformStats,
    formatBigNumber,
    moneyDistribution,
    auraDistribution,
    wealthUsers,
    formatPercent,
    platformTopGamesChartHeight,
    platformTopGamesChartData,
    activityBreakdownColors,
    loadingGamesLeaderboard,
    gamesLeaderboard,
    onlineStats,
    loadingActivity,
    activityPeriod,
    setActivityPeriod,
    fetchActivity,
    snapshotting,
    setSnapshotting,
    adminApi,
    activityCustomStart,
    setActivityCustomStart,
    activityCustomEnd,
    setActivityCustomEnd,
    activitySpecificDay,
    setActivitySpecificDay,
    activityHistory,
    selectedActivity,
    hoveredActivity,
    activityChartDataRef,
    activityFullDomainRef,
    activityZoomDomain,
    setActivityDomain,
    panActivityDomain,
    zoomActivityDomain,
    activityChartRef,
    handleActivityPointerDown,
    handleActivityPointerMove,
    handleActivityPointerEnd,
    handleActivityPointerLeave,
    activityBreakdownDay,
    setActivityBreakdownDay,
    fetchActivityBreakdown,
    loadingActivityBreakdown,
    activityBreakdown,
    pageBreakdownKeys,
    pageBreakdownData,
    gameTypeLabels,
    gameBreakdownKeys,
    gameBreakdownData,
    gameDurationBreakdownKeys,
    gameDurationBreakdownData,
    formatDurationShort,
    playtimePeriod,
    setPlaytimePeriod,
    fetchPlaytimeLeaderboard,
    playtimeCustomStart,
    setPlaytimeCustomStart,
    playtimeCustomEnd,
    setPlaytimeCustomEnd,
    loadingPlaytimeLeaderboard,
    playtimeLeaderboard,
  } = props as any;

  return (
        <TabsContent value="activity" className={SPACING.SECTION_SPACING}>

          {/* ── PLATFORM OVERVIEW ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Vue d'ensemble de la plateforme</span>
                {loadingPlatformStats && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={downloadStatsCSV} disabled={!platformStats} className="h-7 w-7 p-0" title="Télécharger CSV">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={fetchPlatformStats} className="h-7 w-7 p-0" title="Rafraîchir">
                  <RefreshCw className={cn('h-3.5 w-3.5', loadingPlatformStats && 'animate-spin')} />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-blue-400" />
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Membres actifs</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-blue-400">{platformStats?.overview.approvedUsers ?? '—'}</p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>{platformStats?.overview.totalUsers ?? '—'} inscrits</p>
                </CardContent>
              </Card>
              <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Gamepad2 className="h-3.5 w-3.5 text-purple-400" />
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Parties jouées</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-purple-400">
                    {platformStats ? formatBigNumber(platformStats.overview.totalGamesPlayed) : '—'}
                  </p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>tous les temps</p>
                </CardContent>
              </Card>
              <Card className="border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-green-400" />
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Victoires</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-green-400">
                    {platformStats ? formatBigNumber(platformStats.overview.totalWins) : '—'}
                  </p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>
                    {platformStats && platformStats.overview.totalGamesPlayed > 0
                      ? `${Math.round(platformStats.overview.totalWins / platformStats.overview.totalGamesPlayed * 100)}% win rate`
                      : 'win rate'}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CurrencyIcon type="aura" className="h-3.5 w-3.5" />
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Aura totale</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-yellow-400">
                    {platformStats ? formatBigNumber(parseInt(platformStats.overview.totalAura)) : '—'}
                  </p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>en circulation</p>
                </CardContent>
              </Card>
              <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-600/5">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CurrencyIcon type="money" className="h-3.5 w-3.5" />
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Argent total</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-orange-400">
                    {platformStats ? formatBigNumber(platformStats.overview.totalMoney) : '—'}
                  </p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>en circulation</p>
                </CardContent>
              </Card>
              <Card className="border-pink-500/20 bg-gradient-to-br from-pink-500/10 to-pink-600/5">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-pink-400" />
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Transferts</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-pink-400">
                    {platformStats ? formatBigNumber(platformStats.overview.totalTransfers) : '—'}
                  </p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>
                    {platformStats ? `${formatBigNumber(platformStats.overview.totalAuraTransferred)} aura` : 'échangée'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── EXTRA STATS ROW ── */}
          {platformStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-border/40">
                <CardContent className="p-4 space-y-1">
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Argent échangé</p>
                  <p className="text-xl font-semibold tabular-nums">{formatBigNumber(platformStats.overview.totalMoneyTransferred)}</p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>via transferts</p>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardContent className="p-4 space-y-1">
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Mots tapés (Bombe)</p>
                  <p className="text-xl font-semibold tabular-nums">{formatBigNumber(platformStats.overview.totalWordsTyped)}</p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>tous les temps</p>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardContent className="p-4 space-y-1">
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Parties (30j)</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatBigNumber(platformStats.activityChart.reduce((s: number, d: { count: number }) => s + d.count, 0))}
                  </p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>sur les 30 derniers jours</p>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardContent className="p-4 space-y-1">
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Moy. / jour (30j)</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {(platformStats.activityChart.reduce((s: number, d: { count: number }) => s + d.count, 0) / 30).toFixed(1)}
                  </p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>parties par jour</p>
                </CardContent>
              </Card>
            </div>
          )}

          {(moneyDistribution || auraDistribution) && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-border/40">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Répartition des richesses</span>
                  </div>
                  <CardDescription>
                    Calculé sur {wealthUsers.length.toLocaleString('fr-FR')} comptes hors super admin.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Card className="border-emerald-500/20 bg-emerald-500/5">
                      <CardContent className="p-4 space-y-1">
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Médiane argent</p>
                        <p className="text-xl font-semibold tabular-nums text-emerald-300">
                          {moneyDistribution ? formatBigNumber(Math.round(moneyDistribution.median)) : '—'}
                        </p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>
                          moyenne {moneyDistribution ? formatBigNumber(Math.round(moneyDistribution.average)) : '—'}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-cyan-500/20 bg-cyan-500/5">
                      <CardContent className="p-4 space-y-1">
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Médiane aura</p>
                        <p className="text-xl font-semibold tabular-nums text-cyan-300">
                          {auraDistribution ? formatBigNumber(Math.round(auraDistribution.median)) : '—'}
                        </p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>
                          moyenne {auraDistribution ? formatBigNumber(Math.round(auraDistribution.average)) : '—'}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-amber-500/20 bg-amber-500/5">
                      <CardContent className="p-4 space-y-1">
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Inégalité argent</p>
                        <p className="text-xl font-semibold tabular-nums text-amber-300">
                          {moneyDistribution ? formatPercent(moneyDistribution.gini) : '—'}
                        </p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>
                          top 10%: {moneyDistribution ? formatPercent(moneyDistribution.top10Share) : '—'}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-fuchsia-500/20 bg-fuchsia-500/5">
                      <CardContent className="p-4 space-y-1">
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Inégalité aura</p>
                        <p className="text-xl font-semibold tabular-nums text-fuchsia-300">
                          {auraDistribution ? formatPercent(auraDistribution.gini) : '—'}
                        </p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>
                          top 10%: {auraDistribution ? formatPercent(auraDistribution.top10Share) : '—'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Argent par décile</p>
                          <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Qui détient quoi dans l’économie.</p>
                        </div>
                        <p className={cn(TYPOGRAPHY.XS, 'text-right text-muted-foreground')}>
                          Top 1%: {moneyDistribution ? formatPercent(moneyDistribution.top1Share) : '—'}
                        </p>
                      </div>
                      {moneyDistribution && moneyDistribution.deciles.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={moneyDistribution.deciles} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatBigNumber(value)} width={36} />
                            <RechartsTooltip
                              contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                              formatter={(value: number, _name: string, props: any) => [
                                `${value.toLocaleString('fr-FR')} total · moyenne ${Math.round(props.payload.average).toLocaleString('fr-FR')}`,
                                'Argent',
                              ]}
                            />
                            <Bar dataKey="total" fill="#10b981" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Aura par décile</p>
                          <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Distribution sociale et prestige accumulé.</p>
                        </div>
                        <p className={cn(TYPOGRAPHY.XS, 'text-right text-muted-foreground')}>
                          Top 1%: {auraDistribution ? formatPercent(auraDistribution.top1Share) : '—'}
                        </p>
                      </div>
                      {auraDistribution && auraDistribution.deciles.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={auraDistribution.deciles} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatBigNumber(value)} width={36} />
                            <RechartsTooltip
                              contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                              formatter={(value: number, _name: string, props: any) => [
                                `${value.toLocaleString('fr-FR')} total · moyenne ${Math.round(props.payload.average).toLocaleString('fr-FR')}`,
                                'Aura',
                              ]}
                            />
                            <Bar dataKey="total" fill="#06b6d4" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/40">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Concentration & écarts</span>
                  </div>
                  <CardDescription>
                    Vue rapide sur les poches de richesse et les écarts entre bas et haut de tableau.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">Argent</p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                          p10 {moneyDistribution ? formatBigNumber(Math.round(moneyDistribution.p10)) : '—'} · p90 {moneyDistribution ? formatBigNumber(Math.round(moneyDistribution.p90)) : '—'}
                        </p>
                      </div>
                      {moneyDistribution?.concentration.map((item: { label: string; share: number }) => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium tabular-nums">{formatPercent(item.share)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(2, Math.min(100, item.share))}%` }} />
                          </div>
                        </div>
                      ))}
                      <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                        Plus riche: <span className="font-medium text-foreground">{moneyDistribution?.richestUser?.username ?? '—'}</span> · {moneyDistribution ? formatBigNumber(Math.round(moneyDistribution.max)) : '—'}
                      </p>
                      <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                        Comptes à 0 ou moins: {moneyDistribution?.zeroCount.toLocaleString('fr-FR') ?? '—'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">Aura</p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                          p10 {auraDistribution ? formatBigNumber(Math.round(auraDistribution.p10)) : '—'} · p90 {auraDistribution ? formatBigNumber(Math.round(auraDistribution.p90)) : '—'}
                        </p>
                      </div>
                      {auraDistribution?.concentration.map((item: { label: string; share: number }) => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium tabular-nums">{formatPercent(item.share)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.max(2, Math.min(100, item.share))}%` }} />
                          </div>
                        </div>
                      ))}
                      <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                        Plus riche: <span className="font-medium text-foreground">{auraDistribution?.richestUser?.username ?? '—'}</span> · {auraDistribution ? formatBigNumber(Math.round(auraDistribution.max)) : '—'}
                      </p>
                      <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                        Comptes à 0 ou moins: {auraDistribution?.zeroCount.toLocaleString('fr-FR') ?? '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── GAME ACTIVITY CHART (30 days) ── */}
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Parties jouées (30 derniers jours)</span>
                  {loadingPlatformStats && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
                {platformStats && (
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                    {platformStats.activityChart.reduce((s: number, d: { count: number }) => s + d.count, 0).toLocaleString('fr-FR')} parties
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingPlatformStats && !platformStats ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : platformStats && platformStats.activityChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={platformStats.activityChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => {
                        const d = new Date(v + 'T12:00:00');
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                      interval={4}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={24}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                      formatter={(value: number) => [`${value} partie${value !== 1 ? 's' : ''}`, 'Jeux']}
                      labelFormatter={(label: string) => new Date(label + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
              )}
            </CardContent>
          </Card>

          {/* ── TOP GAMES + ALL-TIME LEADERBOARD ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top games by plays */}
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Jeux les plus joués (tous les temps)</span>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPlatformStats && !platformStats ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : platformStats && platformStats.topGames.length > 0 ? (
                  <ResponsiveContainer width="100%" height={platformTopGamesChartHeight}>
                    <BarChart
                      data={platformTopGamesChartData}
                      layout="vertical"
                      margin={{ top: 4, right: 50, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => formatBigNumber(v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={96}
                      />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                        formatter={(value: number, _name: string, props: any) => [
                          `${value.toLocaleString('fr-FR')} parties · ${(props.payload.wins ?? 0).toLocaleString('fr-FR')} victoires`,
                          'Stats',
                        ]}
                      />
                      <Bar dataKey="totalPlayed" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                        {platformTopGamesChartData.map((_g: { label: string }, index: number) => (
                          <Cell key={index} fill={activityBreakdownColors[index % activityBreakdownColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
                )}
              </CardContent>
            </Card>

            {/* All-time games played leaderboard */}
            <Card className="border-border/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Classement parties jouées (tous les temps)</span>
                  {loadingGamesLeaderboard && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
                <CardDescription>
                  Basé sur les stats de jeu — toutes les parties comptées pour tous les jeux, sans estimation de durée.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingGamesLeaderboard && gamesLeaderboard.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : gamesLeaderboard.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/40">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground w-10">#</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Joueur</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Parties</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gamesLeaderboard.map((entry: any, i: number) => (
                          <tr key={entry.userId} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                            <td className="py-2 px-3 font-semibold text-foreground">{entry.rank ?? i + 1}</td>
                            <td className="py-2 px-3">
                              <span style={{ color: entry.usernameColor || 'inherit' }} className="font-medium">
                                {entry.username}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums font-semibold">
                              {(entry.value ?? 0).toLocaleString('fr-FR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/40">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/40 bg-muted/20">
                  <Trophy className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Record absolu</p>
                  <p className="text-2xl font-semibold tabular-nums">{onlineStats?.allTimeRecord ?? '—'}</p>
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                    {onlineStats?.allTimeRecordAt
                      ? new Date(onlineStats.allTimeRecordAt).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Aucun record enregistre'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardContent className="space-y-1 p-4">
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>En ligne</p>
                <p className="text-2xl font-semibold tabular-nums">{onlineStats?.current ?? '—'}</p>
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardContent className="space-y-1 p-4">
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Pic 24h</p>
                <p className="text-2xl font-semibold tabular-nums">{onlineStats?.peak1d ?? '—'}</p>
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardContent className="space-y-1 p-4">
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Pic 7 jours</p>
                <p className="text-2xl font-semibold tabular-nums">{onlineStats?.peak7d ?? '—'}</p>
              </CardContent>
            </Card>
          </div>

          {/* ── CHART CARD ── */}
          <Card>
            <CardHeader className="pb-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Joueurs en ligne</span>
                  {loadingActivity && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(['day', 'week', 'month', 'specific', 'custom'] as const).map(p => (
                    <Button
                      key={p}
                      variant={activityPeriod === p ? 'default' : 'outline'}
                      onClick={() => {
                        setActivityPeriod(p);
                        if (p !== 'custom' && p !== 'specific') fetchActivity(p);
                      }}
                      className="h-8 px-3 text-xs"
                    >
                      {p === 'day' ? "Aujourd'hui" : p === 'week' ? '7j' : p === 'month' ? '30j' : p === 'specific' ? 'Jour' : 'Plage'}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => fetchActivity(activityPeriod)}
                    className="h-8 px-2"
                    title="Rafraîchir"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    setSnapshotting(true);
                    try {
                      await adminApi.takeOnlineSnapshot();
                      await fetchActivity(activityPeriod);
                    } finally {
                      setSnapshotting(false);
                    }
                  }}
                  disabled={snapshotting}
                  className="h-8 gap-1.5 px-3 text-xs"
                  title="Enregistrer un snapshot maintenant"
                >
                  {snapshotting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Snapshot
                </Button>
              </div>

              {/* Custom date range — native date pickers (open system calendar) */}
              {activityPeriod === 'custom' && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <CalendarRange className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input
                    type="date"
                    value={activityCustomStart}
                    onChange={e => setActivityCustomStart(e.target.value)}
                    className="h-8 w-auto text-xs"
                  />
                  <span className="text-xs text-muted-foreground">→</span>
                  <Input
                    type="date"
                    value={activityCustomEnd}
                    onChange={e => setActivityCustomEnd(e.target.value)}
                    className="h-8 w-auto text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => fetchActivity('custom', activityCustomStart, activityCustomEnd)}
                    disabled={!activityCustomStart || !activityCustomEnd}
                  >
                    Appliquer
                  </Button>
                </div>
              )}

              {/* Specific day picker */}
              {activityPeriod === 'specific' && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <CalendarRange className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input
                    type="date"
                    value={activitySpecificDay}
                    onChange={e => setActivitySpecificDay(e.target.value)}
                    className="h-8 w-auto text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => fetchActivity('specific')}
                    disabled={!activitySpecificDay}
                  >
                    Appliquer
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="pt-4">
              {loadingActivity && !activityHistory ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activityHistory && activityHistory.data.length > 0 ? (
                <>
                  {/* Big period title */}
                  <p className="text-2xl font-bold tracking-tight mb-4 capitalize">
                    {activityPeriod === 'day'
                      ? new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                      : activityPeriod === 'week'
                      ? '7 derniers jours'
                      : activityPeriod === 'month'
                      ? '30 derniers jours'
                      : activityPeriod === 'specific' && activitySpecificDay
                      ? new Date(activitySpecificDay + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                      : activityPeriod === 'custom' && activityCustomStart && activityCustomEnd
                      ? `${new Date(activityCustomStart + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → ${new Date(activityCustomEnd + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : 'Activité'}
                  </p>

                  {activityHistory.peak > 0 && (
                    <div className="mb-4 flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Pic sur la période</span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-semibold tabular-nums">
                          {activityHistory.peak}
                        </span>
                        <span className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                          {activityHistory.peakAt
                            ? new Date(activityHistory.peakAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : 'joueurs'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <Card className="border-border/40">
                      <CardContent className="space-y-1 p-4">
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Connectés au moins une fois</p>
                        <p className="text-2xl font-semibold tabular-nums">{(activityHistory.insights?.uniqueConnectedUsers ?? 0).toLocaleString('fr-FR')}</p>
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/70')}>
                          Utilisateurs vus en snapshot ou en connexion sur la période
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-border/40">
                      <CardContent className="space-y-1 p-4">
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Jour le plus joué</p>
                        {activityHistory.insights?.busiestWeekday ? (
                          <>
                            <p className="text-2xl font-semibold capitalize">{activityHistory.insights.busiestWeekday.label}</p>
                            <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/70')}>
                              {activityHistory.insights.busiestWeekday.totalGames.toLocaleString('fr-FR')} parties loggées, {activityHistory.insights.busiestWeekday.uniquePlayers.toLocaleString('fr-FR')} joueur{activityHistory.insights.busiestWeekday.uniquePlayers > 1 ? 's' : ''} actifs
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">Pas encore assez de logs de jeu</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-border/40">
                      <CardContent className="space-y-1 p-4">
                        <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Heures de pointe</p>
                        {(activityHistory.insights?.peakHours?.length ?? 0) > 0 ? (
                          <>
                            <p className="text-lg font-semibold">
                              {activityHistory.insights!.peakHours.map((entry: { label: string }) => entry.label).join(' • ')}
                            </p>
                            <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/70')}>
                              Moyenne de {activityHistory.insights!.peakHours[0]?.averageOnline.toLocaleString('fr-FR')} joueurs en ligne sur le créneau n°1
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">Pas encore assez de snapshots</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Chart + side panel */}
                  {(() => {
                    const activeActivity = selectedActivity ?? hoveredActivity;
                    return (
                      <div className="flex gap-4 items-start">
                    <div className="flex-1 min-w-0">
                      {(() => {
                        const MS_HOUR = 3600000;
                        const MS_DAY = 86400000;

                        // All periods use a numeric time axis for proportional spacing
                        const chartData = activityHistory.data.map((pt: any) => ({ ...pt, ts: new Date(pt.timestamp).getTime() }));
                        activityChartDataRef.current = chartData;

                        // Compute full domain boundaries for this period
                        const now = new Date();
                        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                        let domainStart: number, domainEnd: number;
                        if (activityPeriod === 'specific' && activitySpecificDay) {
                          domainStart = new Date(activitySpecificDay + 'T00:00:00').getTime();
                          domainEnd = domainStart + MS_DAY;
                        } else if (activityPeriod === 'day') {
                          domainStart = todayMidnight;
                          domainEnd = todayMidnight + MS_DAY;
                        } else if (activityPeriod === 'week') {
                          domainStart = todayMidnight - 7 * MS_DAY;
                          domainEnd = todayMidnight + MS_DAY;
                        } else if (activityPeriod === 'month') {
                          domainStart = todayMidnight - 30 * MS_DAY;
                          domainEnd = todayMidnight + MS_DAY;
                        } else if (activityPeriod === 'custom' && activityCustomStart && activityCustomEnd) {
                          domainStart = new Date(activityCustomStart + 'T00:00:00').getTime();
                          domainEnd = new Date(activityCustomEnd + 'T00:00:00').getTime() + MS_DAY;
                        } else {
                            const times = chartData.map((pt: { ts: number }) => pt.ts);
                          domainStart = Math.min(...times);
                          domainEnd = Math.max(...times);
                        }

                        // Keep full domain in ref so the wheel handler can read it
                        activityFullDomainRef.current = [domainStart, domainEnd];

                        // Apply zoom if active
                        const [viewStart, viewEnd] = activityZoomDomain ?? [domainStart, domainEnd];
                        const viewRange = viewEnd - viewStart;
                        const isZoomed = viewRange < domainEnd - domainStart;

                        // Adaptive ticks and separator lines based on visible range
                        const getTicksAndLines = (start: number, end: number, range: number) => {
                          const alignedStart = (interval: number) => Math.ceil(start / interval) * interval;
                          const generate = (interval: number, from: number, to: number) => {
                            const out: number[] = [];
                            for (let t = from; t <= to; t += interval) out.push(t);
                            return out;
                          };
                          if (range <= 3 * MS_HOUR) {
                            const lines = generate(30 * 60000, alignedStart(30 * 60000), end);
                            return { ticks: lines, lines };
                          } else if (range <= 8 * MS_HOUR) {
                            const lines = generate(MS_HOUR, alignedStart(MS_HOUR), end);
                            return { ticks: lines, lines };
                          } else if (range <= 18 * MS_HOUR) {
                            const lines = generate(MS_HOUR, alignedStart(MS_HOUR), end);
                            const ticks = generate(2 * MS_HOUR, alignedStart(2 * MS_HOUR), end);
                            return { ticks, lines };
                          } else if (range <= MS_DAY * 1.5) {
                            const lines = generate(MS_HOUR, alignedStart(MS_HOUR), end);
                            const ticks = generate(3 * MS_HOUR, alignedStart(3 * MS_HOUR), end);
                            return { ticks, lines };
                          } else if (range <= 4 * MS_DAY) {
                            const lines = generate(MS_DAY, alignedStart(MS_DAY), end);
                            const ticks = generate(MS_DAY, alignedStart(MS_DAY), end);
                            return { ticks, lines };
                          } else if (range <= 10 * MS_DAY) {
                            const lines = generate(MS_DAY, alignedStart(MS_DAY), end);
                            const ticks = generate(2 * MS_DAY, alignedStart(2 * MS_DAY), end);
                            return { ticks, lines };
                          } else {
                            const lines = generate(MS_DAY, alignedStart(MS_DAY), end);
                            const ticks = generate(5 * MS_DAY, alignedStart(5 * MS_DAY), end);
                            return { ticks, lines };
                          }
                        };

                        const { ticks: xAxisTicks, lines: separatorLines } = getTicksAndLines(viewStart, viewEnd, viewRange);

                        const tickFormatter = (ts: number) => {
                          const d = new Date(ts);
                          if (viewRange <= MS_DAY * 1.5) {
                            const h = d.getHours(), m = d.getMinutes();
                            return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
                          }
                          if (viewRange <= 8 * MS_DAY) return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
                          return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                        };

                        return (
                          <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">
                              Molette pour zoomer, glisser pour déplacer, clic pour figer
                            </p>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => panActivityDomain(-viewRange * 0.25)}
                                disabled={!isZoomed}
                                aria-label="DÃ©placer vers la gauche"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => zoomActivityDomain(1 / 1.25)}
                                aria-label="Zoomer"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => zoomActivityDomain(1.25)}
                                aria-label="DÃ©zoomer"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => setActivityDomain(null)}
                                disabled={!isZoomed}
                              >
                                Reset
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => panActivityDomain(viewRange * 0.25)}
                                disabled={!isZoomed}
                                aria-label="DÃ©placer vers la droite"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div
                            ref={activityChartRef}
                            onPointerDown={handleActivityPointerDown}
                            onPointerMove={handleActivityPointerMove}
                            onPointerUp={handleActivityPointerEnd}
                            onPointerCancel={handleActivityPointerEnd}
                            onPointerLeave={handleActivityPointerLeave}
                            className={cn('touch-none select-none', isZoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer')}
                          >
                          <ResponsiveContainer width="100%" height={300}>
                            <AreaChart
                              data={chartData}
                              margin={{ top: 6, right: 4, left: -8, bottom: 0 }}
                              style={{ cursor: isZoomed ? 'grab' : 'pointer' }}
                            >
                              <defs>
                                <linearGradient id="strokeGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.95} />
                                  <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0.35} />
                                </linearGradient>
                                <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.12} />
                                  <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis
                                dataKey="ts"
                                type="number"
                                domain={[viewStart, viewEnd]}
                                allowDataOverflow
                                ticks={xAxisTicks}
                                tickFormatter={tickFormatter}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                interval={0}
                              />
                              <YAxis
                                allowDecimals={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                width={24}
                              />
                              {activityHistory.peak > 0 && (
                                <ReferenceLine
                                  y={activityHistory.peak}
                                  stroke="hsl(var(--muted-foreground))"
                                  strokeDasharray="5 4"
                                  strokeWidth={1}
                                  label={{ value: `↑ ${activityHistory.peak}`, fill: 'hsl(var(--muted-foreground))', fontSize: 10, position: 'insideTopRight', dy: -4 }}
                                />
                              )}
                              {separatorLines.map(ts => (
                                <ReferenceLine
                                  key={`sep-${ts}`}
                                  x={ts}
                                  stroke="hsl(var(--border))"
                                  strokeWidth={1.5}
                                />
                              ))}
                              {activeActivity && (
                                <>
                                  <ReferenceLine
                                    x={activeActivity.cursorTs}
                                    stroke="hsl(var(--foreground))"
                                    strokeDasharray="4 4"
                                    strokeWidth={1.25}
                                  />
                                  <ReferenceDot
                                    x={activeActivity.cursorTs}
                                    y={activeActivity.point.max}
                                    r={5}
                                    fill="hsl(var(--foreground))"
                                    stroke="hsl(var(--background))"
                                    strokeWidth={2}
                                  />
                                </>
                              )}
                              <Area
                                type="stepAfter"
                                dataKey="max"
                                stroke="url(#strokeGradient)"
                                strokeWidth={2.5}
                                fill="url(#activityGradient)"
                                dot={false}
                                activeDot={{ r: 4, fill: 'hsl(var(--foreground))', strokeWidth: 0 }}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                          </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* User list side panel — always visible */}
                    {(() => {
                      const displayPoint = activeActivity?.point ?? null;
                      const users = displayPoint?.usernames ?? [];
                      return (
                        <div className="w-44 shrink-0 border border-border/40 rounded-lg bg-muted/10 flex flex-col" style={{ height: 300 }}>
                          <div className="px-3 py-2 border-b border-border/40 shrink-0">
                            {displayPoint ? (
                              <>
                                <p className="text-xs font-medium tabular-nums">{displayPoint.max} joueur{displayPoint.max !== 1 ? 's' : ''}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(activeActivity!.cursorTs).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                </p>
                                {selectedActivity && (
                                  <p className="text-[10px] text-muted-foreground/70 mt-1">Cliquer à nouveau pour libérer</p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground/60">Survolez ou cliquez sur le graphe</p>
                            )}
                          </div>
                          <div className="overflow-y-auto flex-1 p-1.5">
                            {!displayPoint ? (
                              <p className="text-xs text-muted-foreground/40 text-center py-4">—</p>
                            ) : users.length === 0 ? (
                              <p className="text-xs text-muted-foreground/60 text-center py-4">Aucun joueur enregistré</p>
                            ) : (
                              <ul className="space-y-0.5">
                                {users.map((u: { userId: string; username: string }) => (
                                  <li key={u.userId} className="text-xs px-1.5 py-1 rounded hover:bg-muted/30 truncate" title={u.username}>
                                    {u.username}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                    );
                  })()}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/40 bg-muted/20">
                    <Activity className="h-6 w-6 opacity-40" />
                  </div>
                  <div className="text-center">
                    <p className={TYPOGRAPHY.SMALL}>Aucune donnée pour cette période</p>
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60 mt-0.5')}>Les snapshots sont enregistrés automatiquement</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── ONLINE PLAYERS BY SCHOOL LEVEL ── */}
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Joueurs en ligne par niveau</span>
                {loadingActivity && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
              <CardDescription>
                Répartition des joueurs connectés par niveau scolaire sur la période sélectionnée ci-dessus.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingActivity && !activityHistory ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activityHistory && activityHistory.data.length > 0 ? (
                (() => {
                  const MS_DAY = 86400000;

                  const points = activityHistory.data.map((pt: any) => {
                    const groups: Record<string, { userId: string; username: string }[]> = {
                      TERMINALE: [], PREMIERE: [], SECONDE: [], AUTRE: [],
                    };
                    for (const u of pt.usernames) {
                      const key = String(u.schoolLevel ?? '').toUpperCase();
                      (groups[key] ?? groups.AUTRE).push(u);
                    }
                    return {
                      ts: new Date(pt.timestamp).getTime(),
                      TERMINALE: groups.TERMINALE.length,
                      PREMIERE: groups.PREMIERE.length,
                      SECONDE: groups.SECONDE.length,
                      AUTRE: groups.AUTRE.length,
                      _groups: groups,
                    };
                  });

                  const hasAutre = points.some((p: any) => p.AUTRE > 0);
                  const visibleLevels = LEVEL_CONFIG.filter(l => l.key !== 'AUTRE' || hasAutre);

                  const times = points.map((p: any) => p.ts);
                  const minTs = Math.min(...times);
                  const maxTs = Math.max(...times);
                  const range = maxTs - minTs;
                  const tickFormatter = (ts: number) => {
                    const d = new Date(ts);
                    if (range <= MS_DAY * 1.5) {
                      const h = d.getHours(), m = d.getMinutes();
                      return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
                    }
                    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                  };
                  const labelKey: Record<string, string> = Object.fromEntries(
                    LEVEL_CONFIG.map(l => [l.key, l.label])
                  );

                  const activeIndex = levelHoverIndex != null && points[levelHoverIndex]
                    ? levelHoverIndex
                    : points.length - 1;
                  const activePoint = points[activeIndex];

                  return (
                    <div className="flex gap-4 items-start">
                      <div className="flex-1 min-w-0">
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart
                            data={points}
                            margin={{ top: 6, right: 4, left: -8, bottom: 0 }}
                            onMouseMove={(state: any) => {
                              if (state && typeof state.activeTooltipIndex === 'number') {
                                setLevelHoverIndex(state.activeTooltipIndex);
                              }
                            }}
                            onMouseLeave={() => setLevelHoverIndex(null)}
                          >
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="ts"
                              type="number"
                              domain={['dataMin', 'dataMax']}
                              scale="time"
                              tickFormatter={tickFormatter}
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              allowDecimals={false}
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                              width={24}
                            />
                            <RechartsTooltip
                              contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                              formatter={(value: number, name: string) => [
                                `${value} joueur${value !== 1 ? 's' : ''}`,
                                labelKey[name] ?? name,
                              ]}
                              labelFormatter={(label: number) => new Date(label).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            />
                            <Legend formatter={(value: string) => labelKey[value] ?? value} wrapperStyle={{ fontSize: '12px' }} />
                            {visibleLevels.map(level => (
                              <Line
                                key={level.key}
                                type="monotone"
                                dataKey={level.key}
                                name={level.key}
                                stroke={level.color}
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Per-level user list for the hovered (or latest) point */}
                      <div className="w-48 shrink-0 border border-border/40 rounded-lg bg-muted/10 flex flex-col" style={{ height: 300 }}>
                        <div className="px-3 py-2 border-b border-border/40 shrink-0">
                          <p className="text-xs font-medium tabular-nums">
                            {(activePoint.TERMINALE + activePoint.PREMIERE + activePoint.SECONDE + activePoint.AUTRE)} joueur{(activePoint.TERMINALE + activePoint.PREMIERE + activePoint.SECONDE + activePoint.AUTRE) !== 1 ? 's' : ''}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(activePoint.ts).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-3">
                          {visibleLevels.map(level => {
                            const users = activePoint._groups[level.key] ?? [];
                            return (
                              <div key={level.key}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: level.color }} />
                                  <span className="text-xs font-medium">{level.label}</span>
                                  <span className="text-xs text-muted-foreground tabular-nums ml-auto">{users.length}</span>
                                </div>
                                {users.length > 0 ? (
                                  <ul className="space-y-0.5 pl-4">
                                    {users.map((u: { userId: string; username: string }) => (
                                      <li key={u.userId} className="text-xs text-muted-foreground truncate" title={u.username}>
                                        {u.username}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground/50 pl-4">—</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">Aucune donnée pour cette période</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="border-border/40">
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">Pages sur la journée</span>
                    </div>
                    <CardDescription>
                      Présence moyenne par page heure par heure.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={activityBreakdownDay}
                      onChange={(e) => setActivityBreakdownDay(e.target.value)}
                      className="h-8 w-auto text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => fetchActivityBreakdown(activityBreakdownDay)}
                      disabled={!activityBreakdownDay || loadingActivityBreakdown}
                    >
                      {loadingActivityBreakdown ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Appliquer'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingActivityBreakdown && !activityBreakdown ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : pageBreakdownKeys.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={pageBreakdownData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="hourLabel"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          interval={1}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={28}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.75rem',
                          }}
                          formatter={(value: number, name: string) => [
                            `${value} joueur${value > 1 ? 's' : ''}`,
                            getPageMetaForPath(name).title,
                          ]}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Legend
                          formatter={(value) => getPageMetaForPath(value).title}
                          wrapperStyle={{ fontSize: '12px' }}
                        />
                        {pageBreakdownKeys.map((page: string, index: number) => (
                          <Line
                            key={page}
                            type="monotone"
                            dataKey={page}
                            stroke={activityBreakdownColors[index % activityBreakdownColors.length]}
                            strokeWidth={2}
                            dot={false}
                            name={page}
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {activityBreakdown?.topPages.map((entry: { page: string; total: number }, index: number) => (
                        <div key={entry.page} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-xs">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: activityBreakdownColors[index % activityBreakdownColors.length] }}
                            />
                            <span className="truncate">{getPageMetaForPath(entry.page).title}</span>
                          </div>
                          <span className="tabular-nums text-muted-foreground">{entry.total}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Pas encore assez de snapshots avec la page courante pour cette date.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Jeux par heure</span>
                </div>
                <CardDescription>
                  Nombre d’actions de jeu enregistrées par heure sur la date choisie.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingActivityBreakdown && !activityBreakdown ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : gameBreakdownKeys.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={gameBreakdownData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="hourLabel"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          interval={1}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={28}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.75rem',
                          }}
                          formatter={(value: number, name: string) => [
                            `${value} action${value > 1 ? 's' : ''}`,
                            gameTypeLabels[name] ?? humanizeUiLabel(name),
                          ]}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Legend
                          formatter={(value) => gameTypeLabels[value] ?? humanizeUiLabel(value)}
                          wrapperStyle={{ fontSize: '12px' }}
                        />
                        {gameBreakdownKeys.map((gameType: string, index: number) => (
                          <Bar
                            key={gameType}
                            dataKey={gameType}
                            stackId="games"
                            fill={activityBreakdownColors[index % activityBreakdownColors.length]}
                            radius={index === gameBreakdownKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                            isAnimationActive={false}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {activityBreakdown?.topGames.map((entry: { gameType: string; total: number }, index: number) => (
                        <div key={entry.gameType} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-xs">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: activityBreakdownColors[index % activityBreakdownColors.length] }}
                            />
                            <span className="truncate">{gameTypeLabels[entry.gameType] ?? humanizeUiLabel(entry.gameType)}</span>
                          </div>
                          <span className="tabular-nums text-muted-foreground">{entry.total}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Aucun log de jeu disponible pour cette date.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Temps passé par jeu</span>
                </div>
                <CardDescription>
                  Durée cumulée des parties par heure (sur la date choisie).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingActivityBreakdown && !activityBreakdown ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : gameDurationBreakdownKeys.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={gameDurationBreakdownData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="hourLabel"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          interval={1}
                        />
                        <YAxis
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={44}
                          tickFormatter={(value: number) => `${Math.round(value / 60)}m`}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.75rem',
                          }}
                          formatter={(value: number, name: string) => [
                            formatDurationShort(value),
                            gameTypeLabels[name] ?? humanizeUiLabel(name),
                          ]}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Legend
                          formatter={(value) => gameTypeLabels[value] ?? humanizeUiLabel(value)}
                          wrapperStyle={{ fontSize: '12px' }}
                        />
                        {gameDurationBreakdownKeys.map((gameType: string, index: number) => (
                          <Bar
                            key={gameType}
                            dataKey={gameType}
                            stackId="durations"
                            fill={activityBreakdownColors[index % activityBreakdownColors.length]}
                            radius={index === gameDurationBreakdownKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                            isAnimationActive={false}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {activityBreakdown?.topGameDurations.map((entry: { gameType: string; totalSeconds: number }, index: number) => (
                        <div key={entry.gameType} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-xs">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: activityBreakdownColors[index % activityBreakdownColors.length] }}
                            />
                            <span className="truncate">{gameTypeLabels[entry.gameType] ?? humanizeUiLabel(entry.gameType)}</span>
                          </div>
                          <span className="tabular-nums text-muted-foreground">{formatDurationShort(entry.totalSeconds)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Aucune durée de partie exploitable pour cette date.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── PLAYTIME LEADERBOARD ── */}
          <Card className="border-border/40">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Classement temps de jeu</span>
                  </div>
                  <CardDescription>
                    Joueurs qui jouent le plus (en temps de jeu).
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(['day', 'week', 'month', 'custom'] as const).map(p => (
                    <Button
                      key={p}
                      variant={playtimePeriod === p ? 'default' : 'outline'}
                      onClick={() => {
                        setPlaytimePeriod(p);
                        if (p !== 'custom') fetchPlaytimeLeaderboard(p);
                      }}
                      className="h-8 px-3 text-xs"
                    >
                      {p === 'day' ? "Aujourd'hui" : p === 'week' ? '7j' : p === 'month' ? '30j' : 'Plage'}
                    </Button>
                  ))}
                </div>
              </div>

              {playtimePeriod === 'custom' && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    value={playtimeCustomStart}
                    onChange={(e) => setPlaytimeCustomStart(e.target.value)}
                    className="h-8 text-xs flex-1 min-w-max"
                    placeholder="Début"
                  />
                  <span className="text-xs text-muted-foreground">à</span>
                  <Input
                    type="date"
                    value={playtimeCustomEnd}
                    onChange={(e) => setPlaytimeCustomEnd(e.target.value)}
                    className="h-8 text-xs flex-1 min-w-max"
                    placeholder="Fin"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => fetchPlaytimeLeaderboard('custom', playtimeCustomStart, playtimeCustomEnd)}
                    disabled={!playtimeCustomStart || !playtimeCustomEnd || loadingPlaytimeLeaderboard}
                  >
                    {loadingPlaytimeLeaderboard ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Appliquer'}
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent>
              {loadingPlaytimeLeaderboard && !playtimeLeaderboard ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : playtimeLeaderboard && playtimeLeaderboard.leaderboard.length > 0 ? (
                <div className="space-y-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/40">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Rang</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Joueur</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Temps total</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Parties</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Moyenne/partie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playtimeLeaderboard.leaderboard.map((entry: { userId: string; totalSeconds: number; averageGameDuration: number; gamesPlayed: number; rank: number; profilePicture?: string | null; usernameColor?: string | null; username: string }) => {
                          const totalHours = Math.floor(entry.totalSeconds / 3600);
                          const totalMinutes = Math.floor((entry.totalSeconds % 3600) / 60);
                          const avgSeconds = Math.floor(entry.averageGameDuration);
                          const avgMinutes = Math.floor(avgSeconds / 60);
                          const avgSecs = avgSeconds % 60;
                          return (
                            <tr key={entry.userId} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                              <td className="py-2 px-3 font-semibold text-foreground">{entry.rank}</td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  {entry.profilePicture ? (
                                    <img src={entry.profilePicture} alt="" className="h-5 w-5 rounded" />
                                  ) : (
                                    <div className="h-5 w-5 rounded bg-muted" />
                                  )}
                                  <span style={{ color: entry.usernameColor || 'inherit' }} className="truncate font-medium">
                                    {entry.username}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums">
                                {totalHours > 0 ? `${totalHours}h ${totalMinutes}min` : `${totalMinutes}min`}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                                {entry.gamesPlayed}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                                {avgMinutes}m {String(avgSecs).padStart(2, '0')}s
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {playtimeLeaderboard.totalEntries > playtimeLeaderboard.limit && (
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60 text-center mt-3')}>
                      Affichage des {playtimeLeaderboard.limit} premiers sur {playtimeLeaderboard.totalEntries} joueurs
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Aucune donnée de temps de jeu pour cette période
                </p>
              )}
            </CardContent>
          </Card>

        </TabsContent>
  );
}


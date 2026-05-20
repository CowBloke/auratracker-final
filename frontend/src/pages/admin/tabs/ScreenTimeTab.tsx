import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TabsContent } from '@/components/ui/tabs';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import type { ScreenTimeLeaderboardEntry } from '@/services/api';
import { Loader2, Clock, Search, RefreshCw, Users, Gauge, CalendarRange } from 'lucide-react';

type ScreenTimePeriod = 'day' | 'week' | 'month' | 'custom';

export interface ScreenTimeTabProps {
  screenTimePeriod: ScreenTimePeriod;
  setScreenTimePeriod: (period: ScreenTimePeriod) => void;
  fetchScreenTimeLeaderboard: (period?: ScreenTimePeriod, customStart?: string, customEnd?: string) => void;
  screenTimeCustomStart: string;
  setScreenTimeCustomStart: (value: string) => void;
  screenTimeCustomEnd: string;
  setScreenTimeCustomEnd: (value: string) => void;
  loadingScreenTimeLeaderboard: boolean;
  screenTimeLeaderboard: {
    leaderboard: ScreenTimeLeaderboardEntry[];
    period: string;
    start: string;
    end: string;
    totalEntries: number;
    limit: number;
  } | null;
  screenTimeSearch: string;
  setScreenTimeSearch: (value: string) => void;
}

const formatScreenTime = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0min';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes}min`;
  return `${Math.round(totalSeconds)}s`;
};

export function ScreenTimeTab(props: ScreenTimeTabProps) {
  const {
    screenTimePeriod,
    setScreenTimePeriod,
    fetchScreenTimeLeaderboard,
    screenTimeCustomStart,
    setScreenTimeCustomStart,
    screenTimeCustomEnd,
    setScreenTimeCustomEnd,
    loadingScreenTimeLeaderboard,
    screenTimeLeaderboard,
    screenTimeSearch,
    setScreenTimeSearch,
  } = props;

  const entries = screenTimeLeaderboard?.leaderboard ?? [];

  const filteredEntries = useMemo(() => {
    const query = screenTimeSearch.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => entry.username.toLowerCase().includes(query));
  }, [entries, screenTimeSearch]);

  const totals = useMemo(() => {
    const totalSeconds = entries.reduce((sum, entry) => sum + entry.totalSeconds, 0);
    const count = entries.length;
    return {
      totalSeconds,
      count,
      averageSeconds: count > 0 ? totalSeconds / count : 0,
    };
  }, [entries]);

  const topSeconds = entries[0]?.totalSeconds ?? 0;

  return (
    <TabsContent value="screen-time" className={SPACING.SECTION_SPACING}>
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Temps d'écran des utilisateurs</span>
                {loadingScreenTimeLeaderboard && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
              <CardDescription>
                Temps total passé connecté (toutes pages confondues), calculé à partir des snapshots de présence.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['day', 'week', 'month', 'custom'] as const).map((p) => (
                <Button
                  key={p}
                  variant={screenTimePeriod === p ? 'default' : 'outline'}
                  onClick={() => {
                    setScreenTimePeriod(p);
                    if (p !== 'custom') fetchScreenTimeLeaderboard(p);
                  }}
                  className="h-8 px-3 text-xs"
                >
                  {p === 'day' ? "Aujourd'hui" : p === 'week' ? '7j' : p === 'month' ? '30j' : 'Plage'}
                </Button>
              ))}
              <Button
                variant="outline"
                onClick={() => fetchScreenTimeLeaderboard(screenTimePeriod)}
                className="h-8 px-2"
                title="Rafraîchir"
                disabled={loadingScreenTimeLeaderboard}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loadingScreenTimeLeaderboard && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {screenTimePeriod === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <CalendarRange className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                type="date"
                value={screenTimeCustomStart}
                onChange={(e) => setScreenTimeCustomStart(e.target.value)}
                className="h-8 w-auto text-xs"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <Input
                type="date"
                value={screenTimeCustomEnd}
                onChange={(e) => setScreenTimeCustomEnd(e.target.value)}
                className="h-8 w-auto text-xs"
              />
              <Button
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => fetchScreenTimeLeaderboard('custom', screenTimeCustomStart, screenTimeCustomEnd)}
                disabled={!screenTimeCustomStart || !screenTimeCustomEnd || loadingScreenTimeLeaderboard}
              >
                {loadingScreenTimeLeaderboard ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Appliquer'}
              </Button>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={screenTimeSearch}
              onChange={(e) => setScreenTimeSearch(e.target.value)}
              placeholder="Rechercher un utilisateur…"
              className="h-9 pl-8 text-sm"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-blue-400" />
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Utilisateurs actifs</p>
                </div>
                <p className="text-2xl font-bold tabular-nums text-blue-400">{totals.count.toLocaleString('fr-FR')}</p>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>vus en ligne sur la période</p>
              </CardContent>
            </Card>
            <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-purple-400" />
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Temps cumulé</p>
                </div>
                <p className="text-2xl font-bold tabular-nums text-purple-400">{formatScreenTime(totals.totalSeconds)}</p>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>tous utilisateurs confondus</p>
              </CardContent>
            </Card>
            <Card className="border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-green-400" />
                  <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Moyenne / utilisateur</p>
                </div>
                <p className="text-2xl font-bold tabular-nums text-green-400">{formatScreenTime(totals.averageSeconds)}</p>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60')}>temps d'écran moyen</p>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          {loadingScreenTimeLeaderboard && !screenTimeLeaderboard ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEntries.length > 0 ? (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground w-12">Rang</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Joueur</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground w-[34%]">Temps d'écran</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Parties</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Dernière connexion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => (
                      <tr key={entry.userId} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 font-semibold text-foreground tabular-nums">{entry.rank}</td>
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
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 min-w-[40px] rounded-full bg-muted/50 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-purple-400"
                                style={{ width: `${topSeconds > 0 ? Math.max(2, (entry.totalSeconds / topSeconds) * 100) : 0}%` }}
                              />
                            </div>
                            <span className="tabular-nums whitespace-nowrap font-semibold">{formatScreenTime(entry.totalSeconds)}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{entry.gamesPlayed}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                          {entry.lastSeen
                            ? new Date(entry.lastSeen).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {screenTimeSearch.trim() && (
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60 text-center mt-2')}>
                  {filteredEntries.length} résultat{filteredEntries.length > 1 ? 's' : ''} pour « {screenTimeSearch.trim()} »
                </p>
              )}
              {screenTimeLeaderboard && screenTimeLeaderboard.totalEntries > screenTimeLeaderboard.limit && (
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground/60 text-center')}>
                  Affichage des {screenTimeLeaderboard.limit} premiers sur {screenTimeLeaderboard.totalEntries} utilisateurs
                </p>
              )}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {screenTimeSearch.trim()
                ? 'Aucun utilisateur ne correspond à la recherche'
                : 'Aucune donnée de temps d\'écran pour cette période'}
            </p>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

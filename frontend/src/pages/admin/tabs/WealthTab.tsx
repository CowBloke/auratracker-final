import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Cell } from 'recharts';
import { Download, TrendingUp, Coins, DollarSign, Wallet } from 'lucide-react';
import type { AdminWealthStats } from '../../../services/api';

type WealthTabProps = {
  wealthStats: AdminWealthStats | null;
  wealthLoading: boolean;
  onExport: () => void;
  exporting: boolean;
};

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

const fmtMoney = (n: number) =>
  '$' + n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

const BRACKET_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d946ef', '#ec4899'];

const MetricRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
    <span className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground')}>{label}</span>
    <span className="text-sm font-semibold tabular-nums">{value}</span>
  </div>
);

const StatBlock = ({
  title,
  icon,
  metrics,
  gini,
  isMoney,
}: {
  title: string;
  icon: React.ReactNode;
  metrics: AdminWealthStats['aura'];
  gini: number;
  isMoney: boolean;
}) => {
  const f = isMoney ? fmtMoney : fmt;
  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-sm">{title}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-0">
        <MetricRow label="Total" value={f(metrics.total)} />
        <MetricRow label="Moyenne" value={f(metrics.mean)} />
        <MetricRow label="Médiane" value={f(metrics.median)} />
        <MetricRow label="25e percentile" value={f(metrics.p25)} />
        <MetricRow label="75e percentile" value={f(metrics.p75)} />
        <MetricRow label="90e percentile" value={f(metrics.p90)} />
        <MetricRow label="95e percentile" value={f(metrics.p95)} />
        <MetricRow label="Coefficient de Gini" value={(gini * 100).toFixed(1) + '%'} />
      </CardContent>
    </Card>
  );
};

export function WealthTab({ wealthStats, wealthLoading, onExport, exporting }: WealthTabProps) {
  return (
    <TabsContent value="wealth" className={SPACING.SECTION_SPACING}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground')}>
            {wealthStats
              ? `${wealthStats.userCount.toLocaleString('fr-FR')} joueurs analysés · Prix AuraCoin : $${wealthStats.auraCoinPrice.toFixed(2)}`
              : 'Statistiques de richesse du serveur'}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onExport}
          disabled={exporting || wealthLoading || !wealthStats}
          className="shrink-0"
        >
          <Download className="w-4 h-4 mr-1.5" />
          {exporting ? 'Export...' : 'Exporter CSV'}
        </Button>
      </div>

      {wealthLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
        </div>
      ) : !wealthStats ? (
        <p className={cn(TYPOGRAPHY.MUTED, 'text-center py-12')}>Impossible de charger les statistiques.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <StatBlock
              title="Richesse totale (Argent + AuraCoin)"
              icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
              metrics={wealthStats.wealth}
              gini={wealthStats.wealth.gini}
              isMoney
            />
            <StatBlock
              title="Argent ($)"
              icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
              metrics={wealthStats.money}
              gini={wealthStats.money.gini}
              isMoney
            />
            <StatBlock
              title="Aura"
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
              metrics={wealthStats.aura}
              gini={wealthStats.aura.gini}
              isMoney={false}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Distribution de la richesse totale</span>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={wealthStats.wealthBrackets} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={52}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                      formatter={(value: number) => [`${value} joueurs`, 'Richesse']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {wealthStats.wealthBrackets.map((_, i) => (
                        <Cell key={i} fill={BRACKET_COLORS[i % BRACKET_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Distribution de l'aura</span>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={wealthStats.auraBrackets} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={52}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                      formatter={(value: number) => [`${value} joueurs`, 'Aura']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#f59e0b" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </TabsContent>
  );
}

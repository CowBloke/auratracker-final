import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw } from 'lucide-react';

type ReferralStats = {
  overview: {
    referralEnabled: boolean;
    rewardAmount: number;
    totalUsersWithCode: number;
    totalReferredUsers: number;
    approvedReferredUsers: number;
    pendingReferredUsers: number;
    rewardedReferrals: number;
    rewardPayoutTotal: number;
    conversionRate: number;
    pendingRate: number;
    stalePendingOlderThan7Days: number;
  };
  topReferrers: Array<{
    userId: string;
    username: string;
    referralCode: string | null;
    isApproved: boolean;
    totalReferrals: number;
    approvedReferrals: number;
    pendingReferrals: number;
    rewardedReferrals: number;
    totalRewardsGiven: number;
  }>;
};

type ReferralsTabProps = {
  referralStats: ReferralStats | null;
  loadingReferralStats: boolean;
  fetchReferralStats: () => void;
};

export function ReferralsTab({
  referralStats,
  loadingReferralStats,
  fetchReferralStats,
}: ReferralsTabProps) {
  return (
    <TabsContent value="referrals" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Statistiques de parrainage</h2>
          <p className="text-xs text-muted-foreground">Suivi global du funnel et des meilleurs parrains.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReferralStats} disabled={loadingReferralStats}>
          <RefreshCw className={cn('h-3.5 w-3.5 mr-2', loadingReferralStats && 'animate-spin')} />
          Rafraîchir
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-1">
            <p className={cn('text-xs', 'text-muted-foreground')}>Système</p>
            <p className="text-xl font-semibold tabular-nums">
              {referralStats?.overview.referralEnabled ? 'Actif' : 'Désactivé'}
            </p>
            <p className={cn('text-xs', 'text-muted-foreground/60')}>état global</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-1">
            <p className={cn('text-xs', 'text-muted-foreground')}>Comptes avec code</p>
            <p className="text-xl font-semibold tabular-nums">{referralStats?.overview.totalUsersWithCode.toLocaleString('fr-FR') ?? '—'}</p>
            <p className={cn('text-xs', 'text-muted-foreground/60')}>parrains potentiels</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-1">
            <p className={cn('text-xs', 'text-muted-foreground')}>Inscrits via parrainage</p>
            <p className="text-xl font-semibold tabular-nums">{referralStats?.overview.totalReferredUsers.toLocaleString('fr-FR') ?? '—'}</p>
            <p className={cn('text-xs', 'text-muted-foreground/60')}>total filleuls</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-1">
            <p className={cn('text-xs', 'text-muted-foreground')}>Validés</p>
            <p className="text-xl font-semibold tabular-nums">{referralStats?.overview.approvedReferredUsers.toLocaleString('fr-FR') ?? '—'}</p>
            <p className={cn('text-xs', 'text-muted-foreground/60')}>{referralStats ? `${referralStats.overview.conversionRate}% conversion` : 'conversion'}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-1">
            <p className={cn('text-xs', 'text-muted-foreground')}>En attente</p>
            <p className="text-xl font-semibold tabular-nums">{referralStats?.overview.pendingReferredUsers.toLocaleString('fr-FR') ?? '—'}</p>
            <p className={cn('text-xs', 'text-muted-foreground/60')}>{referralStats ? `${referralStats.overview.pendingRate}% du flux` : 'du flux'}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-1">
            <p className={cn('text-xs', 'text-muted-foreground')}>Coût total</p>
            <p className="text-xl font-semibold tabular-nums">{referralStats ? referralStats.overview.rewardPayoutTotal.toLocaleString('fr-FR') : '—'}</p>
            <p className={cn('text-xs', 'text-muted-foreground/60')}>
              {referralStats ? `${referralStats.overview.rewardAmount.toLocaleString('fr-FR')} / validation` : 'récompenses'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardDescription>Parrainages récompensés</CardDescription>
            <p className="text-2xl font-semibold tabular-nums">{referralStats?.overview.rewardedReferrals.toLocaleString('fr-FR') ?? '—'}</p>
          </CardHeader>
          <CardContent>
            <p className={cn('text-xs', 'text-muted-foreground')}>
              Nombre de filleuls déjà approuvés ayant déclenché le versement.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardDescription>En attente depuis plus de 7 jours</CardDescription>
            <p className="text-2xl font-semibold tabular-nums">{referralStats?.overview.stalePendingOlderThan7Days.toLocaleString('fr-FR') ?? '—'}</p>
          </CardHeader>
          <CardContent>
            <p className={cn('text-xs', 'text-muted-foreground')}>
              Comptes parrainés toujours non validés après une semaine.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Top parrains</h3>
              <CardDescription>Classement par nombre total de filleuls.</CardDescription>
            </div>
            {loadingReferralStats && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent>
          {!referralStats ? (
            <p className="text-sm text-muted-foreground">Chargement des stats de parrainage...</p>
          ) : referralStats.topReferrers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun parrainage enregistré pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-left text-xs text-muted-foreground">
                    <TableHead>Parrain</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Validés</TableHead>
                    <TableHead className="text-right">En attente</TableHead>
                    <TableHead className="text-right">Récompensés</TableHead>
                    <TableHead className="text-right">Montant total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referralStats.topReferrers.map((entry) => (
                    <TableRow key={entry.userId} className="border-border/20">
                      <TableCell>
                        <span className="font-medium">{entry.username}</span>
                        {!entry.isApproved && <span className="ml-2 text-xs text-warning">(non validé)</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{entry.referralCode ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{entry.totalReferrals.toLocaleString('fr-FR')}</TableCell>
                      <TableCell className="text-right tabular-nums">{entry.approvedReferrals.toLocaleString('fr-FR')}</TableCell>
                      <TableCell className="text-right tabular-nums">{entry.pendingReferrals.toLocaleString('fr-FR')}</TableCell>
                      <TableCell className="text-right tabular-nums">{entry.rewardedReferrals.toLocaleString('fr-FR')}</TableCell>
                      <TableCell className="text-right tabular-nums">{entry.totalRewardsGiven.toLocaleString('fr-FR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

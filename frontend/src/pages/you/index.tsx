import { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { Card, CardContent } from '@/components/ui/card';
import { CenteredSkeletonCard } from '@/components/ui/loading-skeletons';
import { type YouState, youApi } from '@/services/api';
import { ExploreTab } from './tabs/ExploreTab';
import { FinanceTab } from './tabs/FinanceTab';
import { OverviewTab } from './tabs/OverviewTab';
import { SocialTab } from './tabs/SocialTab';
import { TravailTab } from './tabs/TravailTab';
import { PublicitesTab } from './tabs/PublicitesTab';
import { ShareMarketTab } from './tabs/ShareMarketTab';
import { SupplyTab } from './tabs/SupplyTab';
import { ActionsTab } from './tabs/ActionsTab';
import { MarketplaceTab } from './tabs/MarketplaceTab';
import YoutubeTab from './tabs/YoutubeTab';
import { YouDashboard } from './YouDashboard';

export default function You() {
  const [params] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const { maintenanceStatus } = useFeatures();
  const [data, setData] = useState<YouState | null>(null);
  const [loading, setLoading] = useState(true);

  const loadState = useCallback(async (refreshBalance = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const [stateResponse] = await Promise.all([youApi.getState(), refreshBalance ? refreshUser() : Promise.resolve()]);
      setData(stateResponse.data);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de charger la page YOU.');
    } finally {
      setLoading(false);
    }
  }, [refreshUser, user]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const tab = params.get('tab');
  const currentTab = tab === 'banques'
    ? 'finance'
    : tab === 'travail' || tab === 'social' || tab === 'explore' || tab === 'finance' || tab === 'carte' || tab === 'publicites' || tab === 'overview' || tab === 'marche-actions' || tab === 'supply' || tab === 'actions' || tab === 'youtube' || tab === 'salle-de-marche'
      ? tab
      : 'carte';
  const canBypassMaintenance = Boolean(user?.isAdmin || user?.isSuperAdmin || user?.isBetaTester);

  if (maintenanceStatus.youLogoAdminOnly && !canBypassMaintenance) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <CenteredSkeletonCard key={index} />
          ))}
        </div>
        <CenteredSkeletonCard className="min-h-[380px]" />
      </div>
    );
  }
  if (!data || !user) return <div className="space-y-4"><Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Impossible de charger les donnees YOU.</CardContent></Card></div>;
  const hasAdblock = Boolean(user.hasAdblock);

  if (currentTab === 'carte') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <YouDashboard data={data} userId={user.id} isAdmin={Boolean(user.isAdmin)} onReload={loadState} />
      </div>
    );
  }

  if (currentTab === 'supply') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <SupplyTab businessTypes={data.businessTypes} unlockedBusinessLevel={data.unlockedBusinessLevel ?? 0} ownedBusinesses={data.ownedBusinesses} players={data.players} userId={user.id} onReload={() => loadState()} />
      </div>
    );
  }

  return (
    <div className="animate-in space-y-6 fade-in pb-8 duration-300">
      {currentTab === 'overview' ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: 'Money personnel', value: user.money.toLocaleString('fr-FR') }, { label: 'Aura partagee', value: user.aura.toLocaleString('fr-FR') }, { label: 'Businesses', value: String(data.ownedBusinesses.length) }, { label: 'Relations', value: String(data.relationships.length) }].map((entry) => (
          <Card key={entry.label} className="min-w-0 overflow-hidden">
            <CardContent className="min-w-0 px-5 py-4">
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground/60">{entry.label}</p>
              <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{entry.value}</p>
            </CardContent>
          </Card>
        ))}
      </div> : null}
      {currentTab === 'overview' ? <OverviewTab data={data} userId={user.id} adblockActive={hasAdblock} onReload={loadState} /> : null}
      {currentTab === 'travail' ? <TravailTab data={data} players={data.players} currentUserId={user.id} adblockActive={hasAdblock} onReload={loadState} /> : null}
      {currentTab === 'social' ? <SocialTab data={data} onReload={() => loadState()} /> : null}
      {currentTab === 'explore' ? <ExploreTab data={data} players={data.players} userId={user.id} isAdmin={Boolean(user.isAdmin)} adblockActive={hasAdblock} onReload={loadState} /> : null}
      {currentTab === 'finance' ? <FinanceTab data={data} userId={user.id} onReload={loadState} /> : null}
      {currentTab === 'marche-actions' ? <ShareMarketTab data={data} userId={user.id} onReload={loadState} /> : null}
      {currentTab === 'publicites' ? <PublicitesTab ownedBusinesses={data.ownedBusinesses} onReload={loadState} /> : null}
      {currentTab === 'actions' ? <ActionsTab onReload={() => loadState()} /> : null}
      {currentTab === 'salle-de-marche' ? <MarketplaceTab ownedBusinesses={data.ownedBusinesses} /> : null}
      {currentTab === 'youtube' ? <YoutubeTab ownedBusinesses={data.ownedBusinesses} onReload={loadState} /> : null}
    </div>
  );
}

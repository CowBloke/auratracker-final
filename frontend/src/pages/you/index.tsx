import { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { CenteredSkeletonCard } from '@/components/ui/loading-skeletons';
import { Card, CardContent } from '@/components/ui/card';
import { type YouState, youApi } from '@/services/api';
import { ActionsTab } from './tabs/ActionsTab';
import { MarketplaceTab } from './tabs/MarketplaceTab';
import { SocialTab } from './tabs/SocialTab';
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
  const REMOVED_TAB_REDIRECTS: Record<string, string> = {
    travail: 'carte', overview: 'carte',
    finance: 'actions', banques: 'actions', 'marche-actions': 'actions',
    publicites: 'actions', supply: 'actions', explore: 'salle-de-marche',
  };
  const rawTab = tab ?? 'carte';
  const currentTab = (rawTab === 'carte' || rawTab === 'social' || rawTab === 'actions' || rawTab === 'youtube' || rawTab === 'salle-de-marche')
    ? rawTab
    : (REMOVED_TAB_REDIRECTS[rawTab] ?? 'carte');
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

  if (currentTab === 'carte') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <YouDashboard data={data} userId={user.id} isAdmin={Boolean(user.isAdmin)} onReload={loadState} />
      </div>
    );
  }

  if (currentTab === 'social') {
    return (
      <div className="space-y-6 pb-8">
        <SocialTab data={data} onReload={loadState} />
      </div>
    );
  }

  return (
    <div className="animate-in space-y-6 fade-in pb-8 duration-300">
      {currentTab === 'actions' ? <ActionsTab data={data} userId={user.id} onReload={() => loadState()} /> : null}
      {currentTab === 'salle-de-marche' ? <MarketplaceTab ownedBusinesses={data.ownedBusinesses} /> : null}
      {currentTab === 'youtube' ? <YoutubeTab ownedBusinesses={data.ownedBusinesses} onReload={loadState} /> : null}
    </div>
  );
}

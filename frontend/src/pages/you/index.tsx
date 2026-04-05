import { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { Card, CardContent } from '@/components/ui/card';
import { type YouState, youApi } from '@/services/api';
import { ExploreTab } from './tabs/ExploreTab';
import { FinanceTab } from './tabs/FinanceTab';
import { OverviewTab } from './tabs/OverviewTab';
import { SocialTab } from './tabs/SocialTab';
import { TravailTab } from './tabs/TravailTab';

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
  const currentTab = tab === 'travail' || tab === 'social' || tab === 'explore' || tab === 'finance' ? tab : 'overview';
  const canBypassMaintenance = Boolean(user?.isAdmin || user?.isSuperAdmin || user?.isBetaTester);

  if (maintenanceStatus.youLogoAdminOnly && !canBypassMaintenance) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading && !data) return <div className="space-y-4"><Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Chargement du hub YOU...</CardContent></Card></div>;
  if (!data || !user) return <div className="space-y-4"><Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Impossible de charger les donnees YOU.</CardContent></Card></div>;

  return (
    <div className="animate-in space-y-6 fade-in pb-8 duration-300">
      {currentTab === 'overview' ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: 'Money partage', value: user.money.toLocaleString('fr-FR') }, { label: 'Aura partagee', value: user.aura.toLocaleString('fr-FR') }, { label: 'Businesses', value: String(data.ownedBusinesses.length) }, { label: 'Relations', value: String(data.relationships.length) }].map((entry) => (
          <Card key={entry.label} className="min-w-0 overflow-hidden">
            <CardContent className="min-w-0 px-5 py-4">
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground/60">{entry.label}</p>
              <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{entry.value}</p>
            </CardContent>
          </Card>
        ))}
      </div> : null}
      {currentTab === 'overview' ? <OverviewTab data={data} userId={user.id} onReload={loadState} /> : null}
      {currentTab === 'travail' ? <TravailTab data={data} players={data.players} currentUserId={user.id} onReload={loadState} /> : null}
      {currentTab === 'social' ? <SocialTab data={data} onReload={() => loadState()} /> : null}
      {currentTab === 'explore' ? <ExploreTab data={data} players={data.players} userId={user.id} isAdmin={Boolean(user.isAdmin)} onReload={loadState} /> : null}
      {currentTab === 'finance' ? <FinanceTab data={data} userId={user.id} onReload={loadState} /> : null}
    </div>
  );
}

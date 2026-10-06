import { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { CenteredSkeletonCard } from '@/components/ui/loading-skeletons';
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty';
import { type YouState, youApi } from '@/services/api';
import { ActionsTab } from './tabs/ActionsTab';
import { ConstructionTab } from './tabs/ConstructionTab';
import { MarketplaceTab } from './tabs/MarketplaceTab';
import { SocialTab } from './tabs/SocialTab';
import { YouDashboard } from './YouDashboard';
import { PageHeader, PageShell } from '@/components/layout/PageShell';

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
    youtube: 'carte',
  };
  const rawTab = tab ?? 'carte';
  const currentTab = (rawTab === 'carte' || rawTab === 'construction' || rawTab === 'social' || rawTab === 'actions' || rawTab === 'salle-de-marche')
    ? rawTab
    : (REMOVED_TAB_REDIRECTS[rawTab] ?? 'carte');
  const canBypassMaintenance = Boolean(user?.isAdmin || user?.isSuperAdmin || user?.isBetaTester);

  if (maintenanceStatus.youLogoAdminOnly && !canBypassMaintenance) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading && !data) {
    return (
      <PageShell>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <CenteredSkeletonCard key={index} />
          ))}
        </div>
        <CenteredSkeletonCard className="min-h-[380px]" />
      </PageShell>
    );
  }
  if (!data || !user) return <PageShell><Empty className="border"><EmptyHeader><EmptyDescription>Impossible de charger les données YOU.</EmptyDescription></EmptyHeader></Empty></PageShell>;

  if (currentTab === 'carte') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <h1 className="sr-only">Carte</h1>
        <YouDashboard data={data} userId={user.id} isAdmin={Boolean(user.isAdmin)} onReload={loadState} />
      </div>
    );
  }

  const TAB_HEADERS: Record<string, { title: string; description: string }> = {
    social: { title: 'Social', description: 'Relations, contrats et interactions avec les autres joueurs.' },
    construction: { title: 'Construction', description: 'Stock de ressources et chantiers disponibles.' },
    actions: { title: 'Actions', description: 'Production, achats et gestion de tes entreprises.' },
    'salle-de-marche': { title: 'Marché des ressources', description: 'Achète et vends des ressources entre entreprises.' },
  };
  const header = TAB_HEADERS[currentTab];

  return (
    <PageShell>
      <PageHeader title={header.title} description={header.description} />
      {currentTab === 'social' ? <SocialTab data={data} userId={user.id} onReload={loadState} /> : null}
      {currentTab === 'construction' ? <ConstructionTab onReload={() => loadState()} /> : null}
      {currentTab === 'actions' ? <ActionsTab data={data} userId={user.id} onReload={() => loadState()} /> : null}
      {currentTab === 'salle-de-marche' ? <MarketplaceTab ownedBusinesses={data.ownedBusinesses} /> : null}
    </PageShell>
  );
}

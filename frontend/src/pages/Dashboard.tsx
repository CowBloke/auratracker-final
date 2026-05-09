import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardUpdatesApi, type DashboardUpdateEntry } from '@/services/api';
import { markChangelogSeen } from '@/lib/changelog';
import { DashboardUpdatesFeed } from '@/features/dashboard-updates/DashboardUpdatesFeed';
import { DashboardUpdatesManagerDialog } from '@/features/dashboard-updates/DashboardUpdatesManagerDialog';

export default function Dashboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DashboardUpdateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [managerOpen, setManagerOpen] = useState(false);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const { data } = await dashboardUpdatesApi.getAll();
      setEntries(data);
      if (data[0]) {
        markChangelogSeen(data[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEntries();
  }, []);

  return (
    <PageShell size="default" className="space-y-6 pb-10">
      <DashboardUpdatesFeed
        entries={entries}
        loading={loading}
        heading="Centre des mises à jour"
        welcomeName={user?.username}
        showWelcome
        action={user?.isAdmin ? (
          <Button onClick={() => setManagerOpen(true)} className="rounded-full px-5">
            <Sparkles className="mr-2 h-4 w-4" />
            Gérer les mises à jour
          </Button>
        ) : null}
      />

      {user?.isAdmin ? (
        <DashboardUpdatesManagerDialog
          open={managerOpen}
          onOpenChange={setManagerOpen}
          onUpdated={() => void loadEntries()}
        />
      ) : null}
    </PageShell>
  );
}

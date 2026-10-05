import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardUpdatesApi, type DashboardUpdateEntry } from '@/services/api';
import { markChangelogSeen } from '@/lib/changelog';
import { DashboardUpdatesFeed } from '@/features/dashboard-updates/DashboardUpdatesFeed';
import { DashboardUpdatesManagerDialog } from '@/features/dashboard-updates/DashboardUpdatesManagerDialog';

const WELCOME_TEMPLATES = [
  (name: string) => `Yo ${name}, y'a du neuf.`,
  (name: string) => `Salut ${name}, quoi de beau ?`,
  (name: string) => `Heureux de te revoir, ${name} !`,
  (name: string) => `Alors ${name}, on chasse l'Aura aujourd'hui ?`,
  (name: string) => `Bienvenue chez toi, ${name}.`,
  (name: string) => `Quelles sont les nouvelles, ${name} ?`,
  (name: string) => `Toujours au top, ${name} !`,
  (name: string) => `Prêt pour une nouvelle aventure, ${name} ?`,
  (name: string) => `AuraTracker t'attendait, ${name}.`,
  (name: string) => `Tiens, voilà ${name} ! Ça farte ?`,
  (name: string) => `Wesh ${name}, bien ou bien ?`,
  (name: string) => `Oh, ${name} ! Quel plaisir de te voir.`,
  (name: string) => `Le boss ${name} est dans la place !`,
  (name: string) => `${name}, t'as une mine radieuse !`,
  (name: string) => `Allez ${name}, au boulot !`,
  (name: string) => `C'est reparti pour un tour, ${name} !`,
];

export default function Dashboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DashboardUpdateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [managerOpen, setManagerOpen] = useState(false);
  const welcomeIndex = useMemo(() => Math.floor(Math.random() * WELCOME_TEMPLATES.length), []);

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
    <PageShell>
      <PageHeader
        title={WELCOME_TEMPLATES[welcomeIndex](user?.username || 'toi')}
        description="Les dernières nouveautés de la plateforme."
        actions={
          user?.isAdmin ? (
            <Button onClick={() => setManagerOpen(true)}>
              <Sparkles />
              Gérer les mises à jour
            </Button>
          ) : null
        }
      />

      <DashboardUpdatesFeed entries={entries} loading={loading} />

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

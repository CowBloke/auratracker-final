import { useEffect, useState } from 'react';
import { PageShell } from '@/components/layout/page-shell';
import { dashboardUpdatesApi, type DashboardUpdateEntry } from '@/services/api';
import { markChangelogSeen } from '@/lib/changelog';
import { DashboardUpdatesFeed } from '@/features/dashboard-updates/DashboardUpdatesFeed';

export default function Changelog() {
  const [entries, setEntries] = useState<DashboardUpdateEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    dashboardUpdatesApi.getAll()
      .then(({ data }) => {
        if (!active) {
          return;
        }
        setEntries(data);
        if (data[0]) {
          markChangelogSeen(data[0].id);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <PageShell size="default" className="space-y-6 pb-10">
      <DashboardUpdatesFeed
        entries={entries}
        loading={loading}
        heading="Changelog"
        subheading="Même base de données, autre point d’entrée : cette page reprend exactement les entrées publiées dans le dashboard, avec le même ordre, le même contenu et les mêmes détails."
      />
    </PageShell>
  );
}

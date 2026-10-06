import { useEffect, useState } from 'react';
import { auraCoinApi, clansApi, leaderboardsApi, usersApi } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, PageShell } from '@/components/layout/PageShell';

type StatItem = {
  label: string;
  value: string;
  hint?: string;
};

type StatSection = {
  title: string;
  items: StatItem[];
};

type UserSummary = {
  id: string;
  aura: number;
  money: number;
  auraCoinBalance: number;
  createdAt: string;
};

type GamesPlayedRanking = {
  value: number;
};

const gamesCatalog = [
  'Doodle Jump',
  'Sudoku',
  '2048',
  'Flappy Bird',
  'Casino',
  'Bombe de mots',
  'Poker',
  'Petit Bac',
  'Bataille Navale',
  'Solitaire',
  'Racer',
  'Tetris',
  'Polymarket',
];

const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const formatMoney = (value: number, digits = 0) => `$${formatNumber(value, digits)}`;

const StatCard = ({ label, value, hint }: StatItem) => (
  <Card>
    <CardHeader>
      <CardDescription>{label}</CardDescription>
      <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
    </CardHeader>
    {hint ? (
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    ) : null}
  </Card>
);

export default function Numbers() {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<StatSection[]>([]);

  useEffect(() => {
    let isActive = true;

    const fetchNumbers = async () => {
      try {
        setLoading(true);
        const [usersRes, clansRes, priceRes, gamesPlayedRes] = await Promise.all([
          usersApi.getAll(),
          clansApi.list(),
          auraCoinApi.getPrice(24),
          leaderboardsApi.get('games_played', { limit: 1000 }),
        ]);

        if (!isActive) return;

        const users = (usersRes.data.users || []) as UserSummary[];
        const totalUsers = users.length;
        const totalAura = users.reduce((sum, user) => sum + Number(user.aura || 0), 0);
        const totalMoney = users.reduce((sum, user) => sum + Number(user.money || 0), 0);
        const totalAuraCoin = users.reduce((sum, user) => sum + Number(user.auraCoinBalance || 0), 0);
        const auraCoinPrice = Number(priceRes.data.currentPrice || 0);
        const totalWealth = totalMoney + totalAuraCoin * auraCoinPrice;

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const newUsers7d = users.filter((user) => new Date(user.createdAt) >= sevenDaysAgo).length;

        const clans = clansRes.data.clans || [];
        const totalClans = clans.length;
        const totalClanMembers = clans.reduce((sum, clan) => sum + (clan.memberCount || 0), 0);

        const gamesPlayedRankings = (gamesPlayedRes.data.rankings || []) as GamesPlayedRanking[];
        const totalGamesPlayed = gamesPlayedRankings.reduce((sum, entry) => sum + Number(entry.value || 0), 0);

        const computedSections: StatSection[] = [
          {
            title: 'Communauté',
            items: [
              { label: 'Joueurs inscrits', value: formatNumber(totalUsers), hint: 'Tous les profils actifs et valides.' },
              { label: 'Nouveaux joueurs (7 jours)', value: formatNumber(newUsers7d), hint: 'Arrivées récentes dans la communaute.' },
              { label: 'Clans actifs', value: formatNumber(totalClans), hint: 'Clans qui comptent au moins un membre.' },
              { label: 'Membres en clan', value: formatNumber(totalClanMembers), hint: 'Somme des membres dans tous les clans.' },
            ],
          },
          {
            title: 'Économie',
            items: [
              { label: 'Aura totale', value: formatNumber(totalAura), hint: 'Aura cumulée sur tous les joueurs.' },
              { label: 'Argent total', value: formatMoney(totalMoney), hint: 'Solde global en dollars virtuels.' },
              { label: 'Aura Coin total', value: formatNumber(totalAuraCoin, 2), hint: 'Somme des balances Aura Coin.' },
              { label: 'Richesse estimée', value: formatMoney(totalWealth), hint: 'Argent + Aura Coin au prix actuel.' },
            ],
          },
          {
            title: 'Jeux',
            items: [
              { label: 'Jeux disponibles', value: formatNumber(gamesCatalog.length), hint: gamesCatalog.join(', ') + '.' },
              { label: 'Parties jouées (tous jeux)', value: formatNumber(totalGamesPlayed), hint: 'Total cumule des parties enregistrées.' },
            ],
          },
        ];

        setSections(computedSections);
      } catch (error) {
        console.error('Failed to fetch numbers:', error);
        setSections([]);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchNumbers();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <PageShell>
      <PageHeader />
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Chiffres indisponibles</EmptyTitle>
            <EmptyDescription>Impossible de charger les nombres pour le moment.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {section.items.map((item) => (
                <StatCard key={item.label} {...item} />
              ))}
            </div>
          </section>
        ))
      )}
    </PageShell>
  );
}

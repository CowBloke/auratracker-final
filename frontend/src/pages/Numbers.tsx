import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auraCoinApi, clansApi, leaderboardsApi, usersApi } from '../services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';

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
  '2048',
  'Flappy Bird',
  'Casino',
  'Bomb Party',
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
    <CardContent className="p-4 md:p-5 space-y-2">
      <p className={cn(TYPOGRAPHY.H2, "md:text-4xl tabular-nums")}>{value}</p>
      <p className={TYPOGRAPHY.SMALL}>{label}</p>
      {hint && (
        <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground/70")}>{hint}</p>
      )}
    </CardContent>
  </Card>
);

export default function Numbers() {
  const location = useLocation();
  const navigate = useNavigate();
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
            title: 'Communaute',
            items: [
              { label: 'Joueurs inscrits', value: formatNumber(totalUsers), hint: 'Tous les profils actifs et valides.' },
              { label: 'Nouveaux joueurs (7 jours)', value: formatNumber(newUsers7d), hint: 'Arrivees recentes dans la communaute.' },
              { label: 'Clans actifs', value: formatNumber(totalClans), hint: 'Clans qui comptent au moins un membre.' },
              { label: 'Membres en clan', value: formatNumber(totalClanMembers), hint: 'Somme des membres dans tous les clans.' },
            ],
          },
          {
            title: 'Economie',
            items: [
              { label: 'Aura totale', value: formatNumber(totalAura), hint: 'Aura cumulee sur tous les joueurs.' },
              { label: 'Argent total', value: formatMoney(totalMoney), hint: 'Solde global en dollars virtuels.' },
              { label: 'Aura Coin total', value: formatNumber(totalAuraCoin, 2), hint: 'Somme des balances Aura Coin.' },
              { label: 'Richesse estimee', value: formatMoney(totalWealth), hint: 'Argent + Aura Coin au prix actuel.' },
            ],
          },
          {
            title: 'Jeux',
            items: [
              { label: 'Jeux disponibles', value: formatNumber(gamesCatalog.length), hint: gamesCatalog.join(', ') + '.' },
              { label: 'Parties jouees (tous jeux)', value: formatNumber(totalGamesPlayed), hint: 'Total cumule des parties enregistrees.' },
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

  const navItems = useMemo(() => ([
    { to: '/leaderboards', label: 'Classements', end: true },
    { to: '/leaderboards/nombres', label: 'Nombres' },
  ]), []);
  const activeNavTab = location.pathname === '/leaderboards/nombres' ? '/leaderboards/nombres' : '/leaderboards';

  return (
    <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8">
      <Tabs value={activeNavTab} onValueChange={(value) => navigate(value)}>
        <TabsList className="h-auto flex-wrap">
          {navItems.map((item) => (
            <TabsTrigger key={item.to} value={item.to}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
        </div>
      ) : sections.length === 0 ? (
        <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>
          Impossible de charger les nombres pour le moment.
        </p>
      ) : (
        <div className={SPACING.PAGE_SPACING}>
          {sections.map((section) => (
            <div key={section.title} className={SPACING.CARD_SPACING}>
              <h2 className={TYPOGRAPHY.MUTED}>
                {section.title}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {section.items.map((item) => (
                  <StatCard key={item.label} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

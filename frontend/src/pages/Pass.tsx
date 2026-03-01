import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { passApi } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { PageShell } from '@/components/layout/page-shell';

const rewardSteps = [25, 40, 60, 90, 130, 180, 250];
const rewardStepGrowth = 50;

const getRewardForDay = (day: number) => {
  if (day <= rewardSteps.length) return rewardSteps[day - 1];
  return rewardSteps[rewardSteps.length - 1] + (day - rewardSteps.length) * rewardStepGrowth;
};

const formatCountdown = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

type ClaimStatus = 'available' | 'claimed';

export default function Pass() {
  const { user, updateBalance } = useAuth();
  const [now, setNow] = useState(new Date());
  const [streak, setStreak] = useState(0);
  const [status, setStatus] = useState<ClaimStatus>('available');
  const [message, setMessage] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState(false);
  const [claimDay, setClaimDay] = useState(1);
  const [claimReward, setClaimReward] = useState(0);
  const [nextReward, setNextReward] = useState(0);
  const [nextReset, setNextReset] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch pass status from server
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchStatus = async () => {
      try {
        setLoading(true);
        const response = await passApi.getStatus();
        const data = response.data;
        
        setStreak(data.streak);
        setStatus(data.status);
        setResetNotice(data.resetNotice);
        setClaimDay(data.claimDay);
        setClaimReward(data.claimReward);
        setNextReward(data.nextReward);
        setNextReset(new Date(data.nextReset));
      } catch (error) {
        console.error('Failed to fetch pass status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    
    // Refresh status every minute
    const refreshInterval = setInterval(fetchStatus, 60000);
    return () => clearInterval(refreshInterval);
  }, [user]);

  const countdown = useMemo(() => {
    if (!nextReset) return '00:00:00';
    return formatCountdown(nextReset.getTime() - now.getTime());
  }, [nextReset, now]);

  const handleClaim = async () => {
    if (status !== 'available' || claiming) return;

    try {
      setClaiming(true);
      const response = await passApi.claim();
      const data = response.data;

      setStatus('claimed');
      setStreak(data.streak);
      setClaimDay(data.claimDay);
      setNextReward(data.nextReward);
      setResetNotice(false);

      // Update balance
      updateBalance(user?.aura || 0, data.newBalance.money);

      setMessage(`Récompense récupérée : +$${data.reward}`);
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Failed to claim reward:', error);
      const errorMessage = error.response?.data?.error || 'Erreur lors de la récupération de la récompense';
      setMessage(errorMessage);
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8">
        <p className={TYPOGRAPHY.MUTED}>Chargement...</p>
      </div>
    );
  }

  return (
    <PageShell>
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className={SPACING.CARD_SPACING}>
                <CardDescription>Récompense du jour</CardDescription>
                <div className="flex items-baseline gap-3">
                  <span className={cn(TYPOGRAPHY.H1, 'tabular-nums')}>${claimReward}</span>
                  <span className={TYPOGRAPHY.SMALL}>argent</span>
                </div>
                <p className={TYPOGRAPHY.MUTED}>
                  Jour {claimDay} · Série actuelle {streak} jour{streak > 1 ? 's' : ''}
                </p>
              </div>

              <Button
                onClick={handleClaim}
                disabled={status === 'claimed' || claiming}
                variant={status === 'claimed' ? 'secondary' : 'default'}
                className="sm:min-w-44"
              >
                {claiming ? 'Récupération...' : status === 'claimed' ? 'Déjà récupérée' : 'Récupérer'}
              </Button>
            </div>

            {(message || resetNotice) && (
              <div className="rounded-md border border-border/60 bg-muted/30 px-4 py-3">
                <p className={TYPOGRAPHY.SMALL}>
                  {message ?? 'Série réinitialisée.'}
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 px-4 py-4">
                <p className={TYPOGRAPHY.XS}>Série</p>
                <p className={cn(TYPOGRAPHY.H4, 'mt-1 tabular-nums')}>{streak}</p>
              </div>
              <div className="rounded-lg border border-border/60 px-4 py-4">
                <p className={TYPOGRAPHY.XS}>Prochaine récompense</p>
                <p className={cn(TYPOGRAPHY.H4, 'mt-1 tabular-nums')}>${nextReward}</p>
              </div>
              <div className="rounded-lg border border-border/60 px-4 py-4">
                <p className={TYPOGRAPHY.XS}>Reset</p>
                <p className={cn(TYPOGRAPHY.H4, 'mt-1 tabular-nums')}>{countdown}</p>
              </div>
            </div>

            <p className={TYPOGRAPHY.XS}>
              Après le jour {rewardSteps.length}, les récompenses continuent de monter de ${rewardStepGrowth} par jour.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={TYPOGRAPHY.H5}>Paliers</CardTitle>
          <CardDescription>Vue rapide des 7 premiers jours.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rewardSteps.map((reward, index) => {
              const day = index + 1;
              const isClaimed = day <= streak;
              const isCurrent = day === claimDay;
              return (
                <div
                  key={day}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-4 py-3',
                    TYPOGRAPHY.SMALL,
                    isClaimed && 'border-foreground/30 bg-muted/20',
                    isCurrent && status === 'available' && 'border-foreground',
                    !isClaimed && !isCurrent && 'text-muted-foreground'
                  )}
                >
                  <span>Jour {day}</span>
                  <span className="font-medium tabular-nums">${reward}</span>
                </div>
              );
            })}
            <div className={cn('flex items-center justify-between rounded-lg border px-4 py-3', TYPOGRAPHY.SMALL)}>
              <span>Jour {rewardSteps.length + 1}+</span>
              <span className="font-medium tabular-nums">${getRewardForDay(rewardSteps.length + 1)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { passApi } from '@/services/api';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';

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

  const streakProgress = Math.min((streak / rewardSteps.length) * 100, 100);

  if (loading) {
    return (
      <PageLayout variant="compact">
        <p className={TYPOGRAPHY.MUTED}>Chargement...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout variant="compact">
      <p className={cn(TYPOGRAPHY.SMALL, "max-w-2xl")}>
        Connecte-toi chaque jour pour monter les paliers. Un jour manqué remet la série à zéro.
      </p>

      {/* Main Section */}
      <Card className="border-border/40">
        <CardContent className="p-6">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className={SPACING.SECTION_SPACING}>
              <div className={SPACING.CARD_SPACING}>
                <CardDescription>Récompense du jour</CardDescription>
                <div className="flex items-baseline gap-3">
                  <span className={cn(TYPOGRAPHY.H1, "tabular-nums")}>${claimReward}</span>
                  <span className={TYPOGRAPHY.SMALL}>argent</span>
                </div>
                <p className={TYPOGRAPHY.SMALL}>
                  Jour {claimDay} · Série {streak} jour{streak > 1 ? 's' : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleClaim}
                  disabled={status === 'claimed' || claiming}
                  variant={status === 'claimed' ? 'secondary' : 'default'}
                >
                  {claiming ? 'Récupération...' : status === 'claimed' ? 'Récompense récupérée' : 'Récupérer'}
                </Button>
                {message && <span className={TYPOGRAPHY.SMALL}>{message}</span>}
                {resetNotice && (
                  <span className={TYPOGRAPHY.SMALL}>
                    Série réinitialisée.
                  </span>
                )}
              </div>

              <div className={cn("flex items-center justify-between", TYPOGRAPHY.SMALL)}>
                <span>Prochaine récompense</span>
                <span className="font-medium tabular-nums">${nextReward}</span>
              </div>
            </div>

            <div className={SPACING.SECTION_SPACING}>
              <div className={SPACING.CARD_SPACING}>
                <CardDescription>Prochain reset</CardDescription>
                <p className={cn(TYPOGRAPHY.H3, "tabular-nums")}>{countdown}</p>
              </div>
              <div className={SPACING.CARD_SPACING}>
                <div className={cn("flex items-center justify-between", TYPOGRAPHY.SMALL)}>
                  <span>Progression série</span>
                  <span className="font-medium tabular-nums">
                    {Math.min(streak, rewardSteps.length)}/{rewardSteps.length}
                  </span>
                </div>
                <Progress value={streakProgress} className="h-1" />
                <p className={TYPOGRAPHY.XS}>
                  Après le jour {rewardSteps.length}, les récompenses continuent de monter.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Paliers */}
      <Card className="border-border/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>Paliers</CardDescription>
            <span className={TYPOGRAPHY.XS}>
              7 jours
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
            {rewardSteps.map((reward, index) => {
              const day = index + 1;
              const isClaimed = day <= streak;
              const isCurrent = day === claimDay;
              return (
                <div
                  key={day}
                  className={cn(
                    "border-b border-border/30 px-3 py-4 flex items-center justify-between last:border-0",
                    TYPOGRAPHY.SMALL,
                    isClaimed && "border-foreground/30",
                    isCurrent && status === 'available' && "border-foreground",
                    !isClaimed && !isCurrent && "text-muted-foreground"
                  )}
                >
                  <span>Jour {day}</span>
                  <span className="font-medium tabular-nums">${reward}</span>
                </div>
              );
            })}
            <div className={cn("border-b border-border/30 px-3 py-4 flex items-center justify-between last:border-0", TYPOGRAPHY.SMALL)}>
              <span>Jour {rewardSteps.length + 1}+</span>
              <span className="font-medium tabular-nums">${getRewardForDay(rewardSteps.length + 1)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}

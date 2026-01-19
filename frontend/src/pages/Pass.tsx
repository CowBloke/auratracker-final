import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { passApi } from '@/services/api';

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
      <div className="max-w-4xl mx-auto py-12 px-4">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div>
          <p className="text-sm text-muted-foreground tracking-wide uppercase">
            Fidélité
          </p>
          <h1 className="text-5xl md:text-7xl font-light tracking-tight">
            Pass quotidien
          </h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Connecte-toi chaque jour pour monter les paliers. Un jour manqué remet la série à zéro.
        </p>
      </header>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Main Section */}
      <section className="space-y-6">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground tracking-wide uppercase">
                Récompense du jour
              </p>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-light tabular-nums">${claimReward}</span>
                <span className="text-sm text-muted-foreground">argent</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Jour {claimDay} · Série {streak} jour{streak > 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleClaim}
                disabled={status === 'claimed' || claiming}
                className={cn(
                  "px-4 py-2 text-sm border transition-colors",
                  status === 'claimed' || claiming
                    ? "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                    : "border-foreground text-foreground hover:bg-foreground hover:text-background"
                )}
              >
                {claiming ? 'Récupération...' : status === 'claimed' ? 'Récompense récupérée' : 'Récupérer'}
              </button>
              {message && <span className="text-sm text-muted-foreground">{message}</span>}
              {resetNotice && (
                <span className="text-sm text-muted-foreground">
                  Série réinitialisée.
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Prochaine récompense</span>
              <span className="text-foreground font-medium tabular-nums">${nextReward}</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground tracking-wide uppercase">
                Prochain reset
              </p>
              <p className="text-2xl font-light tabular-nums">{countdown}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progression série</span>
                <span className="text-foreground font-medium tabular-nums">
                  {Math.min(streak, rewardSteps.length)}/{rewardSteps.length}
                </span>
              </div>
              <div className="h-1 bg-border/30 overflow-hidden">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{ width: `${streakProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Après le jour {rewardSteps.length}, les récompenses continuent de monter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Paliers */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
            Paliers
          </h2>
          <span className="text-xs text-muted-foreground">
            7 jours
          </span>
        </div>
        <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
          {rewardSteps.map((reward, index) => {
            const day = index + 1;
            const isClaimed = day <= streak;
            const isCurrent = day === claimDay;
            return (
              <div
                key={day}
                className={cn(
                  "border-b border-border/30 px-3 py-4 flex items-center justify-between text-sm last:border-0",
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
          <div className="border-b border-border/30 px-3 py-4 flex items-center justify-between text-sm text-muted-foreground last:border-0">
            <span>Jour {rewardSteps.length + 1}+</span>
            <span className="font-medium tabular-nums">${getRewardForDay(rewardSteps.length + 1)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

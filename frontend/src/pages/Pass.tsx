import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const rewardSteps = [25, 40, 60, 90, 130, 180, 250];
const rewardStepGrowth = 50;

const getRewardForDay = (day: number) => {
  if (day <= rewardSteps.length) return rewardSteps[day - 1];
  return rewardSteps[rewardSteps.length - 1] + (day - rewardSteps.length) * rewardStepGrowth;
};

const getLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getDayDiff = (fromKey: string, toKey: string) => {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  const diffMs = to.getTime() - from.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const getNextReset = (now: Date) => {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
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

  const storageKey = useMemo(() => (user ? `daily-pass:${user.id}` : null), [user?.id]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const todayKey = useMemo(() => getLocalDateKey(now), [now]);
  const nextReset = useMemo(() => getNextReset(now), [now]);
  const countdown = useMemo(() => formatCountdown(nextReset.getTime() - now.getTime()), [nextReset, now]);

  useEffect(() => {
    if (!storageKey) return;

    const raw = localStorage.getItem(storageKey);
    let storedStreak = 0;
    let storedLastClaim: string | null = null;

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        storedStreak = typeof parsed.streak === 'number' ? parsed.streak : 0;
        storedLastClaim = typeof parsed.lastClaimDate === 'string' ? parsed.lastClaimDate : null;
      } catch {
        storedStreak = 0;
        storedLastClaim = null;
      }
    }

    if (!storedLastClaim) {
      setStatus('available');
      setStreak(storedStreak);
      setResetNotice(false);
      return;
    }

    const dayDiff = getDayDiff(storedLastClaim, todayKey);
    if (dayDiff === 0) {
      setStatus('claimed');
      setStreak(storedStreak);
      setResetNotice(false);
      return;
    }

    if (dayDiff === 1) {
      setStatus('available');
      setStreak(storedStreak);
      setResetNotice(false);
      return;
    }

    const resetPayload = { streak: 0, lastClaimDate: null };
    localStorage.setItem(storageKey, JSON.stringify(resetPayload));
    setStatus('available');
    setStreak(0);
    setResetNotice(true);
  }, [storageKey, todayKey]);

  const persistState = (nextStreak: number, nextClaimDate: string) => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify({ streak: nextStreak, lastClaimDate: nextClaimDate }));
  };

  const handleClaim = () => {
    if (status !== 'available') return;

    const nextStreak = streak + 1;
    const reward = getRewardForDay(nextStreak);
    setStatus('claimed');
    setStreak(nextStreak);
    setResetNotice(false);
    persistState(nextStreak, todayKey);

    if (user) {
      updateBalance(user.aura, user.money + reward);
    }

    setMessage(`Récompense récupérée : +$${reward}`);
    setTimeout(() => setMessage(null), 3000);
  };

  const claimDay = status === 'claimed' ? streak : streak + 1;
  const claimReward = getRewardForDay(claimDay);
  const nextReward = getRewardForDay(claimDay + 1);
  const streakProgress = Math.min((streak / rewardSteps.length) * 100, 100);

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-12">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">
          Fidélité
        </p>
        <h1 className="text-5xl md:text-7xl font-light tracking-tight">
          Pass quotidien
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Connecte-toi chaque jour pour monter les paliers. Un jour manqué remet la série à zéro.
        </p>
      </header>

      <div className="h-px bg-border" />

      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Récompense du jour
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-semibold">${claimReward}</span>
              <span className="text-sm text-muted-foreground">argent</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Jour {claimDay} · Série {streak} jour{streak > 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleClaim} disabled={status === 'claimed'}>
              {status === 'claimed' ? 'Récompense récupérée' : 'Récupérer'}
            </Button>
            {message && <span className="text-sm text-emerald-400">{message}</span>}
            {resetNotice && (
              <span className="text-sm text-amber-400">
                Série réinitialisée.
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Prochaine récompense</span>
            <span className="text-foreground font-medium">${nextReward}</span>
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Prochain reset
              </p>
              <p className="text-2xl font-semibold tabular-nums">{countdown}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progression série</span>
              <span className="text-foreground font-medium">
                {Math.min(streak, rewardSteps.length)}/{rewardSteps.length}
              </span>
            </div>
            <Progress value={streakProgress} className="h-1.5" />
            <p className="text-xs text-muted-foreground">
              Après le jour {rewardSteps.length}, les récompenses continuent de monter.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Paliers</h2>
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            7 jours
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rewardSteps.map((reward, index) => {
            const day = index + 1;
            const isClaimed = day <= streak;
            const isCurrent = day === claimDay;
            return (
              <div
                key={day}
                className={cn(
                  "rounded-md border px-3 py-2 flex items-center justify-between text-sm",
                  isClaimed && "border-foreground/40",
                  isCurrent && status === 'available' && "border-foreground",
                  !isClaimed && !isCurrent && "border-border/60 text-muted-foreground"
                )}
              >
                <span>Jour {day}</span>
                <span className="font-medium text-foreground">${reward}</span>
              </div>
            );
          })}
          <div className="rounded-md border border-border/60 px-3 py-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>Jour {rewardSteps.length + 1}+</span>
            <span className="font-medium text-foreground">${getRewardForDay(rewardSteps.length + 1)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

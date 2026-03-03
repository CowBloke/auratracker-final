import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { passApi } from '@/services/api';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TYPOGRAPHY } from '@/lib/design-system';
import { PageShell } from '@/components/layout/page-shell';

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
  const [nextReset, setNextReset] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

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
        setNextReset(new Date(data.nextReset));
      } catch (error) {
        console.error('Failed to fetch pass status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

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
      setResetNotice(false);
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
      <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8">
        <p className={TYPOGRAPHY.MUTED}>Chargement...</p>
      </div>
    );
  }

  return (
    <PageShell>
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-5">
            <div className="space-y-2">
              <CardDescription>Pass quotidien</CardDescription>
              <div className="flex items-baseline gap-2">
                <span className={cn(TYPOGRAPHY.H1, 'tabular-nums')}>${claimReward}</span>
                <span className={TYPOGRAPHY.SMALL}>aujourd&apos;hui</span>
              </div>
              <p className={TYPOGRAPHY.MUTED}>
                Jour {claimDay} · Série {streak}
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleClaim}
                disabled={status === 'claimed' || claiming}
                variant={status === 'claimed' ? 'secondary' : 'default'}
                className="w-full sm:w-auto"
              >
                {claiming ? 'Récupération...' : status === 'claimed' ? 'Déjà récupérée' : 'Récupérer'}
              </Button>

              {(message || resetNotice) && (
                <div className="rounded-md border border-border/60 bg-muted/30 px-4 py-3">
                  <p className={TYPOGRAPHY.SMALL}>{message ?? 'Série réinitialisée.'}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
              <span className={TYPOGRAPHY.MUTED}>Prochain reset</span>
              <span className={cn(TYPOGRAPHY.H5, 'tabular-nums')}>{countdown}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

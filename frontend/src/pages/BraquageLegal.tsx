import { useEffect, useMemo, useState } from 'react';
import { PageShell, PageHeader } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { useAuth } from '@/contexts/AuthContext';
import { useSocketBase } from '@/contexts/SocketContext';
import { adminApi, type BraquageLegalDrawResult, type BraquageLegalHistoryEntry, type BraquageLegalSession, type BraquageLegalTier } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { Clock3, Crown, Loader2, Ticket, Trophy, Users } from 'lucide-react';

const TIER_CONFIG: Record<BraquageLegalTier, { cost: number; tickets: number; maxParticipations: number; label: string; description: string; color: string }> = {
  BRONZE: { cost: 500, tickets: 1, maxParticipations: 10, label: 'Bronze', description: 'Entrée la plus accessible.', color: 'border-amber-500/25 bg-amber-500/10 text-amber-200' },
  ARGENT: { cost: 700, tickets: 4, maxParticipations: 8, label: 'Argent', description: 'Plus de tickets pour une mise moyenne.', color: 'border-slate-300/25 bg-slate-300/10 text-slate-100' },
  OR: { cost: 900, tickets: 10, maxParticipations: 6, label: 'Or', description: 'Un ticket plus dense pour viser gros.', color: 'border-yellow-500/25 bg-yellow-500/10 text-yellow-100' },
  PLATINE: { cost: 1200, tickets: 25, maxParticipations: 4, label: 'Platine', description: 'Entrée premium.', color: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-100' },
  VIP: { cost: 1700, tickets: 60, maxParticipations: 2, label: 'VIP', description: 'Le ticket lourd du loto.', color: 'border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-100' },
};

const CONFETTI_COLORS = ['#f59e0b', '#f97316', '#eab308', '#38bdf8', '#22c55e', '#fb7185'];

type ConfettiPiece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  size: number;
};

function formatCountdown(targetIso: string | null): string {
  if (!targetIso) return '--:--:--';
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return '00:00:00';
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function createConfettiPieces(count = 64): ConfettiPiece[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    left: Math.random() * 100,
    delay: Math.random() * 450,
    duration: 1800 + Math.random() * 900,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] ?? '#ffffff',
    rotate: Math.random() * 720,
    size: 6 + Math.random() * 8,
  }));
}

export default function BraquageLegal() {
  const { user } = useAuth();
  const { socket } = useSocketBase();
  const [session, setSession] = useState<BraquageLegalSession | null>(null);
  const [history, setHistory] = useState<BraquageLegalHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [participatingTier, setParticipatingTier] = useState<BraquageLegalTier>('BRONZE');
  const [submitting, setSubmitting] = useState(false);
  const [timeNow, setTimeNow] = useState(Date.now());
  const [winnerResult, setWinnerResult] = useState<BraquageLegalDrawResult | null>(null);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  const loadSession = async () => {
    try {
      const [currentRes, historyRes] = await Promise.all([
        adminApi.getBraquageLegalCurrent(),
        adminApi.getBraquageLegalHistory(),
      ]);
      setSession(currentRes.data.session);
      setHistory(historyRes.data.sessions);
    } catch {
      toast.error('Impossible de charger Loto.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setTimeNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadSession();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleDrawn = (result: BraquageLegalDrawResult) => {
      setWinnerResult(result);
      setConfetti(result.winner ? createConfettiPieces() : []);
      void loadSession();
      if (result.cancelled) {
        toast.info('La session a été clôturée sans participation.');
        return;
      }

      if (result.winner?.id === user?.id) {
        toast.success(`Tu as gagné ${result.winnerPayout?.toLocaleString('fr-FR') ?? '0'} € !`);
        return;
      }

      toast.success(`Le tirage est tombé sur ${result.winner?.username ?? 'un joueur'}.`);
    };

    socket.on('braquage-legal:drawn', handleDrawn);
    return () => {
      socket.off('braquage-legal:drawn', handleDrawn);
    };
  }, [loadSession, socket, user?.id]);

  useEffect(() => {
    if (confetti.length === 0) return undefined;
    const timeout = window.setTimeout(() => setConfetti([]), 4500);
    return () => window.clearTimeout(timeout);
  }, [confetti]);

  const countdown = useMemo(() => formatCountdown(session?.endTime ?? null), [session?.endTime, timeNow]);

  const currentUserParticipation = useMemo(() => {
    if (!session) return undefined;
    return session.userParticipations.find((participation) => participation.tier === participatingTier);
  }, [participatingTier, session]);

  const remainingSlots = currentUserParticipation
    ? Math.max(0, TIER_CONFIG[participatingTier].maxParticipations - currentUserParticipation.participationCount)
    : TIER_CONFIG[participatingTier].maxParticipations;

  const handleParticipate = async () => {
    if (!session || session.isExpired || submitting || remainingSlots <= 0) return;

    setSubmitting(true);
    try {
      const response = await adminApi.participateBraquageLegal(participatingTier);
      setSession(response.data.session);
      toast.success(`Participation ${TIER_CONFIG[participatingTier].label} enregistrée.`);
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Impossible de participer.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const activeTierCard = (tier: BraquageLegalTier) => {
    const config = TIER_CONFIG[tier];
    const userParticipation = session?.userParticipations.find((entry) => entry.tier === tier);
    const used = userParticipation?.participationCount ?? 0;
    const slotsLeft = Math.max(0, config.maxParticipations - used);
    const isSelected = tier === participatingTier;
    const canSelect = Boolean(session) && !session?.isExpired && slotsLeft > 0;

    return (
      <button
        key={tier}
        type="button"
        onClick={() => setParticipatingTier(tier)}
        disabled={!canSelect}
        className={cn(
          'rounded-2xl border p-4 text-left transition-all',
          config.color,
          isSelected ? 'ring-2 ring-primary shadow-lg shadow-primary/10' : 'hover:-translate-y-0.5 hover:shadow-md',
          !canSelect && 'cursor-not-allowed opacity-50 hover:translate-y-0 hover:shadow-none'
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">{config.label}</p>
            <p className="mt-2 text-sm text-muted-foreground">{config.description}</p>
          </div>
          <Badge variant="secondary" className="shrink-0">{slotsLeft}/{config.maxParticipations}</Badge>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-xl bg-background/60 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Coût</p>
            <p className="mt-1 font-semibold tabular-nums">{config.cost.toLocaleString('fr-FR')} €</p>
          </div>
          <div className="rounded-xl bg-background/60 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tickets</p>
            <p className="mt-1 font-semibold tabular-nums">{config.tickets}</p>
          </div>
          <div className="rounded-xl bg-background/60 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Restant</p>
            <p className="mt-1 font-semibold tabular-nums">{slotsLeft}</p>
          </div>
        </div>
      </button>
    );
  };

  const latestWinners = history.slice(0, 5);

  return (
    <>
      <style>{`
        @keyframes braquage-confetti-fall {
          0% { transform: translate3d(0, -12vh, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(0, 110vh, 0) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {confetti.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
          {confetti.map((piece) => (
            <span
              key={piece.id}
              className="absolute rounded-sm"
              style={{
                left: `${piece.left}%`,
                top: '-12vh',
                width: `${piece.size}px`,
                height: `${piece.size * 0.65}px`,
                backgroundColor: piece.color,
                transform: `rotate(${piece.rotate}deg)`,
                animation: `braquage-confetti-fall ${piece.duration}ms ease-out ${piece.delay}ms forwards`,
              }}
            />
          ))}
        </div>
      )}

      <PageShell size="wide">
        <div className="space-y-6">
          <PageHeader
            title="Loto"
            description="Achetez des tickets par tier, alimentez le pool, puis laissez le tirage décider du gagnant et du propriétaire de la session."
          />

          <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-background via-background to-amber-500/5">
            <CardContent className="space-y-6 p-6 md:p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <img src="/braquage-legal-logo.png" alt="Loto" className="h-24 w-auto object-contain" />
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">Propriétaire actuel</p>
                  <div className="mt-2 flex items-center justify-center gap-3">
                    <Avatar className="h-10 w-10 border border-border/50">
                      <AvatarImage src={session?.owner?.profilePicture ? resolveImageUrl(session.owner.profilePicture) : undefined} alt={session?.owner?.username ?? 'Propriétaire'} />
                      <AvatarFallback>{session?.owner?.username?.slice(0, 1)?.toUpperCase() ?? '?'}</AvatarFallback>
                    </Avatar>
                    <p className="text-lg font-semibold">{session?.owner?.username ?? 'Aucun propriétaire désigné'}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Jackpot</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-amber-200">{session?.totalPool.toLocaleString('fr-FR') ?? '0'} €</p>
                  <p className="mt-1 text-sm text-muted-foreground">70% au gagnant, 30% au propriétaire.</p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fin de session</p>
                  <p className="mt-2 flex items-center gap-2 text-3xl font-bold tabular-nums">
                    <Clock3 className="h-5 w-5 text-muted-foreground" />
                    {countdown}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{session?.isExpired ? 'Session expirée, en attente du tirage.' : 'Session en cours.'}</p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tickets en jeu</p>
                  <p className="mt-2 flex items-center gap-2 text-3xl font-bold tabular-nums">
                    <Ticket className="h-5 w-5 text-muted-foreground" />
                    {session?.ticketPool.toLocaleString('fr-FR') ?? '0'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{session?.participationsCount ?? 0} participations enregistrées.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {Object.keys(TIER_CONFIG).map((tier) => activeTierCard(tier as BraquageLegalTier))}
          </div>

          <Card>
            <CardHeader>
              <CardDescription>Participation sélectionnée</CardDescription>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                {TIER_CONFIG[participatingTier].label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Coût: <span className="font-medium text-foreground">{TIER_CONFIG[participatingTier].cost.toLocaleString('fr-FR')} €</span></p>
                <p>Tickets obtenus: <span className="font-medium text-foreground">{TIER_CONFIG[participatingTier].tickets}</span></p>
                <p>Vos participations restantes: <span className="font-medium text-foreground">{remainingSlots}</span></p>
                <p>Votre solde: <span className="font-medium text-foreground">{user?.money.toLocaleString('fr-FR') ?? '0'} €</span></p>
              </div>
              <Button
                onClick={handleParticipate}
                disabled={!session || session.isExpired || submitting || remainingSlots <= 0 || (user?.money ?? 0) < TIER_CONFIG[participatingTier].cost}
                className="min-w-48"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Participer
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardDescription>Vos participations cette session</CardDescription>
                <CardTitle>Récapitulatif personnel</CardTitle>
              </CardHeader>
              <CardContent>
                {session?.userParticipations.length ? (
                  <div className="space-y-3">
                    {session.userParticipations.map((participation) => {
                      const config = TIER_CONFIG[participation.tier];
                      const remaining = Math.max(0, config.maxParticipations - participation.participationCount);
                      return (
                        <div key={participation.tier} className="flex items-center justify-between rounded-xl border border-border/50 bg-background/60 px-4 py-3">
                          <div>
                            <p className="font-medium">{config.label}</p>
                            <p className="text-sm text-muted-foreground">{participation.ticketCount} tickets gagnés à chaque participation</p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-semibold tabular-nums">{participation.participationCount}/{config.maxParticipations}</p>
                            <p className="text-muted-foreground">{remaining} restantes</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune participation enregistrée sur cette session.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Derniers gagnants</CardDescription>
                <CardTitle>Historique récent</CardTitle>
              </CardHeader>
              <CardContent>
                {latestWinners.length ? (
                  <div className="space-y-3">
                    {latestWinners.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-background/60 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={entry.winner?.profilePicture ? resolveImageUrl(entry.winner.profilePicture) : undefined} alt={entry.winner?.username ?? 'Gagnant'} />
                            <AvatarFallback>{entry.winner?.username?.slice(0, 1)?.toUpperCase() ?? '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{entry.winner?.username ?? 'Session annulée'}</p>
                            <p className="text-sm text-muted-foreground">{new Date(entry.endTime).toLocaleString('fr-FR')}</p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-semibold tabular-nums text-amber-200">{entry.winnerPayout?.toLocaleString('fr-FR') ?? 0} €</p>
                          <p className="text-muted-foreground">pool {entry.totalPool.toLocaleString('fr-FR')} €</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun tirage récent.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </PageShell>

      <Dialog open={Boolean(winnerResult)} onOpenChange={(open) => !open && setWinnerResult(null)}>
        <DialogContent className="max-w-lg border-border/60 bg-gradient-to-br from-background via-background to-amber-500/10">
          <DialogHeader className="text-center">
            <DialogTitle className="text-2xl">{winnerResult?.cancelled ? 'Session clôturée' : 'Tirage effectué'}</DialogTitle>
            <DialogDescription>
              {winnerResult?.cancelled
                ? 'Aucune participation n’a été enregistrée sur cette session.'
                : 'Le gagnant et le propriétaire ont été crédités automatiquement.'}
            </DialogDescription>
          </DialogHeader>
          {winnerResult?.cancelled ? (
            <div className="rounded-2xl border border-border/50 bg-background/70 p-4 text-sm text-muted-foreground">
              La session a été fermée sans payout.
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <Avatar className="mx-auto h-24 w-24 border-2 border-amber-400/30">
                <AvatarImage src={winnerResult?.winner?.profilePicture ? resolveImageUrl(winnerResult.winner.profilePicture) : undefined} alt={winnerResult?.winner?.username ?? 'Gagnant'} />
                <AvatarFallback className="text-xl">{winnerResult?.winner?.username?.slice(0, 1)?.toUpperCase() ?? '?'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Gagnant</p>
                <p className="mt-2 text-2xl font-bold">{winnerResult?.winner?.username ?? 'Inconnu'}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Gain</p>
                  <p className="mt-2 text-xl font-bold tabular-nums text-emerald-300">{winnerResult?.winnerPayout?.toLocaleString('fr-FR') ?? 0} €</p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Propriétaire</p>
                  <p className="mt-2 text-xl font-bold tabular-nums text-amber-200">{winnerResult?.ownerPayout?.toLocaleString('fr-FR') ?? 0} €</p>
                </div>
              </div>
              {winnerResult?.winner?.id === user?.id && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  Tu as remporté la session. C&apos;est toi le braqueur du jour.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
import { useEffect, useRef, useState, useCallback } from 'react';
import { Maximize2, Minimize2, Trophy, Clock, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { polytrackApi, type PolytrackTrack, type PolytrackLeaderboardEntry } from '@/services/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageShell } from '@/components/layout/PageShell';
import { ListSkeleton } from '@/components/ui/loading-skeletons';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useHideGameLeaderboards } from '@/lib/game-preferences';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';

const GAME_SRC = '/polytrack/index.html';

export default function Polytrack() {
  const { user } = useAuth();
  const hideGameLeaderboards = useHideGameLeaderboards();

  const [tracks, setTracks] = useState<PolytrackTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<number>(1);
  const [leaderboard, setLeaderboard] = useState<PolytrackLeaderboardEntry[]>([]);
  const [, setLoadingTracks] = useState(true);
  const [loadingLb, setLoadingLb] = useState(false);

  // In-game capture state
  const [pendingMs, setPendingMs] = useState<number | null>(null);
  const [submitResult, setSubmitResult] = useState<{ saved: boolean; isGlobalRecord: boolean; isNewPB: boolean; timeDisplay: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Fullscreen
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTrack = tracks.find((t) => t.number === selectedTrack) ?? null;

  const fetchTracks = async () => {
    setLoadingTracks(true);
    try {
      const res = await polytrackApi.getTracks();
      setTracks(res.data.tracks);
    } catch {
      // ignore
    } finally {
      setLoadingTracks(false);
    }
  };

  const fetchLeaderboard = async (trackNumber: number) => {
    setLoadingLb(true);
    try {
      const res = await polytrackApi.getLeaderboard(trackNumber, 15);
      setLeaderboard(res.data.rankings);
    } catch {
      setLeaderboard([]);
    } finally {
      setLoadingLb(false);
    }
  };

  const formatMsTime = (lapTimeMs: number): string => {
    const minutes = Math.floor(lapTimeMs / 60000);
    const seconds = Math.floor((lapTimeMs % 60000) / 1000);
    const milliseconds = lapTimeMs % 1000;
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
    return `${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  useEffect(() => {
    fetchTracks();
  }, [user]);

  useEffect(() => {
    fetchLeaderboard(selectedTrack);
    setSubmitResult(null);
    setPendingMs(null);
  }, [selectedTrack]);

  const submitTime = useCallback(async (ms: number, trackNum: number) => {
    if (!user) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await polytrackApi.submitRecord(trackNum, ms);
      const d = res.data;
      setSubmitResult({
        saved: d.saved,
        isGlobalRecord: d.isGlobalRecord,
        isNewPB: d.isNewPB,
        timeDisplay: d.personalBest.timeDisplay,
      });
      if (d.saved) {
        await Promise.all([fetchTracks(), fetchLeaderboard(trackNum)]);
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteScore = useCallback(async (userId: string, _username: string) => {
    if (!user?.isAdmin) return;

    try {
      await polytrackApi.deleteRecord(selectedTrack, userId);
      await Promise.all([fetchTracks(), fetchLeaderboard(selectedTrack)]);
      if (userId === user.id) {
        setSubmitResult(null);
        setPendingMs(null);
      }
    } catch (error) {
      console.error('Failed to delete polytrack score:', error);
    }
  }, [selectedTrack, user?.id, user?.isAdmin]);

  const leaderboardEntries: GameLeaderboardEntry[] = leaderboard.map((entry) => ({
    id: `${entry.userId}-${entry.rank}`,
    highScore: entry.timeMs,
    user: {
      id: entry.userId,
      username: entry.username,
      usernameColor: entry.usernameColor,
    },
  }));

  // Listen for finish events posted by the game iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; timeMs?: number; trackNumber?: number };
      if (data?.type !== 'polytrack:finish') return;
      const ms = Number(data.timeMs);
      if (!Number.isFinite(ms) || ms <= 0 || ms >= 600_000) return;
      const track = Number.isInteger(data.trackNumber) && data.trackNumber! >= 1 && data.trackNumber! <= 14
        ? data.trackNumber!
        : selectedTrack;
      setPendingMs(ms);
      setSelectedTrack(track);
      submitTime(ms, track);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [selectedTrack, submitTime]);

  const toggleFullscreen = () => {
    if (!fullscreen) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const trackOptions = tracks.length > 0 ? tracks : Array.from({ length: 14 }, (_, i) => ({ number: i + 1, name: `Track ${i + 1}`, globalRecord: null, personalBest: null }));

  return (
    <PageShell>
      <div className="flex flex-col gap-4 max-w-7xl mx-auto">
        {/* Game iframe */}
        <div
          ref={containerRef}
          className={cn(
            'relative w-full rounded-xl overflow-hidden border border-border bg-black',
            fullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : 'aspect-video'
          )}
        >
          <iframe
            src={GAME_SRC}
            className="w-full h-full"
            title="PolyTrack"
            allow="fullscreen; autoplay"
            style={{ border: 'none', display: 'block' }}
          />
          <div className="absolute left-2 top-2 z-10">
            <GamePauseButton isPaused={isPaused} onToggle={() => setIsPaused((current) => !current)} />
          </div>
          <button
            onClick={toggleFullscreen}
            className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-md p-1.5 transition-colors"
            title={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <GamePauseOverlay
            visible={isPaused}
            onResume={() => setIsPaused(false)}
            description="Le time trial reste affiché mais l'écran est mis en pause côté interface."
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Track selector + submit */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {/* Track picker */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ChevronDown size={15} className="text-muted-foreground" />
                  Circuit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-1.5">
                  {trackOptions.map((t) => {
                    const isPB = t.personalBest !== null;
                    const isSelected = t.number === selectedTrack;
                    return (
                      <button
                        key={t.number}
                        onClick={() => setSelectedTrack(t.number)}
                        className={cn(
                          'text-left px-3 py-2 rounded-lg text-xs transition-colors border',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/40 hover:bg-muted border-transparent',
                          isPB && !isSelected && 'border-emerald-500/30'
                        )}
                      >
                        <span className="font-medium">{t.name}</span>
                        {t.personalBest && (
                          <span className={cn('block mt-0.5 font-mono', isSelected ? 'text-primary-foreground/70' : 'text-emerald-500')}>
                            {t.personalBest.timeDisplay}
                          </span>
                        )}
                        {!t.personalBest && (
                          <span className={cn('block mt-0.5', isSelected ? 'text-primary-foreground/50' : 'text-muted-foreground/50')}>
                            —
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* In-game score capture */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock size={15} className="text-muted-foreground" />
                  Score en jeu — {currentTrack?.name ?? `Track ${selectedTrack}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {submitting ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                    <CheckCircle2 size={14} />
                    Enregistrement en cours…
                  </div>
                ) : pendingMs === null ? (
                  <p className="text-xs text-muted-foreground">
                    Termine un tour dans le jeu — ton temps sera capturé automatiquement.
                  </p>
                ) : null}

                {submitResult && (
                  <div className={cn(
                    'rounded-md px-3 py-2 text-xs',
                    submitResult.isGlobalRecord
                      ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                      : submitResult.isNewPB
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-muted text-muted-foreground'
                  )}>
                    {submitResult.isGlobalRecord && '🏆 Nouveau record mondial ! '}
                    {!submitResult.isGlobalRecord && submitResult.isNewPB && '✅ Nouveau record personnel ! '}
                    {!submitResult.saved && 'Pas un nouveau record personnel. '}
                    <span className="font-mono font-semibold">{submitResult.timeDisplay}</span>
                  </div>
                )}

                {currentTrack?.personalBest && (
                  <div className="flex items-center justify-between text-xs border-t pt-2 mt-1">
                    <span className="text-muted-foreground">Ton meilleur temps</span>
                    <span className="font-mono font-semibold text-emerald-500">{currentTrack.personalBest.timeDisplay}</span>
                  </div>
                )}
                {currentTrack?.globalRecord && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Record mondial</span>
                    <span className="font-mono font-semibold text-yellow-500">{currentTrack.globalRecord.timeDisplay}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Leaderboard */}
          {!hideGameLeaderboards && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy size={15} className="text-muted-foreground" />
                Classement — {currentTrack?.name ?? `Track ${selectedTrack}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingLb ? (
                <div className="px-4 py-4">
                  <ListSkeleton rows={5} />
                </div>
              ) : (
                <GameLeaderboard
                  entries={leaderboardEntries}
                  currentUserId={user?.id}
                  personalHighScore={currentTrack?.personalBest?.timeMs ?? null}
                  scoreFormatter={formatMsTime}
                  isAdmin={user?.isAdmin}
                  onDeleteScore={handleDeleteScore}
                  title="Classement"
                  noCard
                  maxHeight={520}
                />
              )}
            </CardContent>
          </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}

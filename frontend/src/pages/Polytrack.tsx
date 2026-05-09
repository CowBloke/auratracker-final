import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronDown, Clock, CheckCircle2, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { polytrackApi, type PolytrackTrack, type PolytrackLeaderboardEntry } from '@/services/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/ui/loading-skeletons';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { GameTopBar } from '@/components/game/GameTopBar';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';

const GAME_SRC = '/polytrack/index.html';
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

export default function Polytrack() {
  const { user } = useAuth();
  const { containerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [tracks, setTracks] = useState<PolytrackTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<number>(1);
  const [leaderboard, setLeaderboard] = useState<PolytrackLeaderboardEntry[]>([]);
  const [, setLoadingTracks] = useState(true);
  const [loadingLb, setLoadingLb] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // In-game capture state
  const [pendingMs, setPendingMs] = useState<number | null>(null);
  const [submitResult, setSubmitResult] = useState<{ saved: boolean; isGlobalRecord: boolean; isNewPB: boolean; timeDisplay: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

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

  const trackOptions = tracks.length > 0 ? tracks : Array.from({ length: 14 }, (_, i) => ({ number: i + 1, name: `Track ${i + 1}`, globalRecord: null, personalBest: null }));

  const personalHighScore = currentTrack?.personalBest?.timeMs ?? null;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8',
        isFullscreen && 'min-h-screen w-screen items-center bg-background px-4 py-4'
      )}
    >
      <GameTopBar
        title="PolyTrack"
        score={personalHighScore ?? 0}
        highScore={personalHighScore ?? 0}
        isNewHighScore={false}
        rewards={null}
        controls={(
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Course en time trial — termine un tour dans le jeu pour soumettre ton temps.</p>

            {/* Track selector */}
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <ChevronDown className="h-3 w-3" />
                Circuit
              </p>
              <div className="grid grid-cols-2 gap-1">
                {trackOptions.slice(0, 8).map((t) => {
                  const isSelected = t.number === selectedTrack;
                  return (
                    <button
                      key={t.number}
                      onClick={() => setSelectedTrack(t.number)}
                      className={cn(
                        'text-left px-2 py-1.5 rounded text-[10px] transition-colors border',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/40 hover:bg-muted border-transparent',
                        t.personalBest && !isSelected && 'border-emerald-500/30'
                      )}
                    >
                      <span className="font-medium">{t.name}</span>
                      {t.personalBest && (
                        <span className={cn('block font-mono', isSelected ? 'text-primary-foreground/70' : 'text-emerald-500')}>
                          {t.personalBest.timeDisplay}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {trackOptions.length > 8 && (
                <div className="grid grid-cols-2 gap-1">
                  {trackOptions.slice(8).map((t) => {
                    const isSelected = t.number === selectedTrack;
                    return (
                      <button
                        key={t.number}
                        onClick={() => setSelectedTrack(t.number)}
                        className={cn(
                          'text-left px-2 py-1.5 rounded text-[10px] transition-colors border',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/40 hover:bg-muted border-transparent',
                          t.personalBest && !isSelected && 'border-emerald-500/30'
                        )}
                      >
                        <span className="font-medium">{t.name}</span>
                        {t.personalBest && (
                          <span className={cn('block font-mono', isSelected ? 'text-primary-foreground/70' : 'text-emerald-500')}>
                            {t.personalBest.timeDisplay}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Score capture status */}
            <div className="space-y-1 border-t pt-2">
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Clock className="h-3 w-3" />
                {currentTrack?.name ?? `Track ${selectedTrack}`}
              </p>
              {submitting ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                  <CheckCircle2 className="h-3 w-3" />
                  Enregistrement en cours…
                </div>
              ) : pendingMs === null ? (
                <p className="text-xs text-muted-foreground">Termine un tour — ton temps sera capture automatiquement.</p>
              ) : null}

              {submitResult && (
                <div className={cn(
                  'rounded px-2 py-1.5 text-xs',
                  submitResult.isGlobalRecord
                    ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                    : submitResult.isNewPB
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-muted text-muted-foreground'
                )}>
                  {submitResult.isGlobalRecord && 'Record mondial ! '}
                  {!submitResult.isGlobalRecord && submitResult.isNewPB && 'Nouveau record perso ! '}
                  {!submitResult.saved && 'Pas un nouveau record. '}
                  <span className="font-mono font-semibold">{submitResult.timeDisplay}</span>
                </div>
              )}

              {currentTrack?.personalBest && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Ton meilleur</span>
                  <span className="font-mono font-semibold text-emerald-500">{currentTrack.personalBest.timeDisplay}</span>
                </div>
              )}
              {currentTrack?.globalRecord && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Record mondial</span>
                  <span className="font-mono font-semibold text-yellow-500">{currentTrack.globalRecord.timeDisplay}</span>
                </div>
              )}
            </div>
          </div>
        )}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showLeaderboard={showLeaderboard}
        onToggleLeaderboard={() => setShowLeaderboard((v) => !v)}
      >
        <GamePauseButton isPaused={isPaused} onToggle={() => setIsPaused((current) => !current)} />
        <Button size="sm" variant="outline" onClick={() => { setIsPaused(false); setSessionKey((prev) => prev + 1); }}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Recharger
        </Button>
      </GameTopBar>

      <div className="flex items-start justify-center gap-4">
        <div className="flex w-full max-w-[1280px] flex-col">
          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={GAME_WIDTH} baseHeight={GAME_HEIGHT}>
            <iframe
              ref={iframeRef}
              key={sessionKey}
              src={`${GAME_SRC}?k=${sessionKey}`}
              className="block h-full w-full rounded-lg border border-border/30 bg-black"
              title="PolyTrack"
              allow="fullscreen; autoplay; clipboard-read; clipboard-write; pointer-lock; keyboard-map"
              style={{ border: 'none', display: 'block' }}
              tabIndex={0}
            />
            <GamePauseOverlay
              visible={isPaused}
              onResume={() => setIsPaused(false)}
              description="Le time trial reste affiche mais l'ecran est mis en pause cote interface."
            />
          </GameFullscreenStage>
        </div>

        {showLeaderboard && !isFullscreen && (
          <div className="w-[240px] shrink-0 hidden lg:block">
            {loadingLb ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Classement</CardTitle>
                </CardHeader>
                <CardContent>
                  <ListSkeleton rows={5} />
                </CardContent>
              </Card>
            ) : (
              <GameLeaderboard
                entries={leaderboardEntries}
                currentUserId={user?.id}
                personalHighScore={personalHighScore}
                scoreFormatter={formatMsTime}
                isAdmin={user?.isAdmin}
                onDeleteScore={handleDeleteScore}
                title={`Classement — ${currentTrack?.name ?? `Track ${selectedTrack}`}`}
                maxHeight={480}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

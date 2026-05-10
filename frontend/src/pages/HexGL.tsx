import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { cn } from '@/lib/utils';
import { Play, RotateCcw, SlidersHorizontal, Rocket, Timer } from 'lucide-react';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameTopBar } from '@/components/game/GameTopBar';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';

const GAME_TYPE = 'hexgl';
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const GAME_SRC = '/hexgl/index.html';
const UPSTREAM_REPO = 'https://github.com/BKcore/HexGL';
const GAME_SOURCE = 'aura-hexgl';

interface HexGLMessage {
  source?: string;
  type?: 'ready' | 'finish' | 'destroyed';
  score?: number;
  lapTimes?: number[];
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatHexGlTime = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return '--';
  }

  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const minutes = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;

  return `${minutes}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

export default function HexGL() {
  const { user, refreshUser } = useAuth();
  const { containerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const submittedRunRef = useRef<string | null>(null);

  const [sessionKey, setSessionKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScore] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);

  const focusGame = useCallback(() => {
    window.requestAnimationFrame(() => {
      const frame = iframeRef.current;
      if (!frame) return;

      frame.focus();
      frame.contentWindow?.focus();
    });
  }, []);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await gamesApi.getStats(GAME_TYPE, user.id);
      const score = Number(response.data.stats?.highScore ?? 0);
      setHighScore(score > 0 ? score : null);
    } catch (error) {
      console.error('Failed to fetch HexGL stats:', error);
    }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch HexGL leaderboard:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  const restartSession = () => {
    setIsPaused(false);
    submittedRunRef.current = null;
    setSessionKey((prev) => prev + 1);
  };

  const submitScore = useCallback(async (score: number) => {
    if (!Number.isFinite(score) || score <= 0) return;

    const runKey = `${sessionKey}:${score.toFixed(3)}`;
    if (submittedRunRef.current === runKey) return;
    submittedRunRef.current = runKey;

    const maxAttempts = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await gamesApi.complete(GAME_TYPE, {
          score,
          won: true,
        });

        if (response.data.isNewHighScore) {
          setHighScore(score);
        } else {
          setHighScore((current) => {
            if (current === null) return score;
            return Math.min(current, score);
          });
        }

        await refreshUser();
        await fetchLeaderboard();
        return;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await wait(300 * attempt);
        }
      }
    }

    submittedRunRef.current = null;
    console.error('Failed to submit HexGL score after retries:', lastError);
    toast('Temps non comptabilise', {
      description: "Le chrono n'a pas pu etre enregistre. Relance une course dans quelques secondes.",
      duration: 4500,
    });
  }, [fetchLeaderboard, refreshUser, sessionKey]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<HexGLMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.source !== GAME_SOURCE) return;

      if (event.data.type === 'ready') {
        setIsPaused(false);
        submittedRunRef.current = null;
        return;
      }

      if (event.data.type === 'finish') {
        const nextScore = Number.isFinite(event.data.score) ? Number(event.data.score) : 0;
        setIsPaused(false);
        void submitScore(nextScore);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [submitScore]);

  useEffect(() => {
    if (!isPaused) {
      focusGame();
    }
  }, [focusGame, isFullscreen, isPaused, sessionKey]);

  const handleDeleteScore = useCallback(async (userId: string, _username: string) => {

    try {
      await gamesApi.deleteStats(GAME_TYPE, userId);
      if (userId === user?.id) {
        setHighScore(null);
      }
      await fetchLeaderboard();
    } catch (error) {
      console.error('Failed to delete HexGL score:', error);
    }
  }, [fetchLeaderboard, user?.id]);

  const topBarControls = (
    <div className="space-y-4 text-xs">
      <div className="rounded-lg border border-border/60 p-3 bg-muted/30 space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Rocket className="h-3 w-3" />
          À propos
        </p>
        <p className="text-muted-foreground leading-relaxed italic">
          Course futuriste WebGL inspirée de Wipeout. Battez le chrono sur chaque tour !
        </p>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Record</p>
          <p className="text-xs font-bold tabular-nums">{formatHexGlTime(highScore)}</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">
            <Timer className="h-2.5 w-2.5" />
            Top Global
          </p>
          <p className="text-xs font-bold tabular-nums">{formatHexGlTime(leaderboard[0]?.highScore ?? null)}</p>
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider">Liens</p>
        <p className="text-muted-foreground break-all">
          Repo: <a href={UPSTREAM_REPO} target="_blank" rel="noreferrer" className="underline">{UPSTREAM_REPO}</a>
        </p>
      </div>

      <Separator />

      <Button
        variant="outline"
        size="sm"
        className="w-full justify-center h-8 text-xs"
        onClick={restartSession}
      >
        <RotateCcw className="mr-2 h-3 w-3" />
        Reset Course
      </Button>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8 ${isFullscreen ? 'min-h-screen w-screen items-center bg-background px-4 py-4' : ''}`}
    >
      <GameTopBar
        title="HexGL"
        score={0}
        highScore={highScore || 0}
        controls={topBarControls}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showLeaderboard={showLeaderboard}
        onToggleLeaderboard={() => setShowLeaderboard(v => !v)}
      >
        <div className="flex items-center gap-2">
          <GamePauseButton
            isPaused={isPaused}
            onToggle={() => setIsPaused(v => !v)}
            className="h-7 w-7"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={() => setShowSettingsDialog(true)}
            title="Parametres"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </GameTopBar>

      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Parametres HexGL</DialogTitle>
          </DialogHeader>
          {topBarControls}
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-center gap-6">
        <div className="flex w-full max-w-[1280px] flex-col overflow-hidden">
          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={GAME_WIDTH} baseHeight={GAME_HEIGHT}>
            <iframe
              ref={iframeRef}
              key={sessionKey}
              src={`${GAME_SRC}?k=${sessionKey}`}
              title="HexGL"
              className="block h-full w-full rounded-[28px] border border-border/30 bg-black shadow-2xl"
              allow="fullscreen; autoplay; clipboard-read; clipboard-write; pointer-lock; keyboard-map; gamepad"
              tabIndex={0}
              onLoad={focusGame}
              onMouseDown={focusGame}
            />
            <GamePauseOverlay
              visible={isPaused}
              onResume={() => {
                setIsPaused(false);
                focusGame();
              }}
              description="Le jeu continue en dessous, mais les interactions sont bloquees par-dessus."
            />
          </GameFullscreenStage>
        </div>

        {showLeaderboard && !isFullscreen && (
          <div className="w-[280px] shrink-0 hidden lg:block h-full">
            <GameLeaderboard
              entries={leaderboard}
              currentUserId={user?.id}
              personalHighScore={highScore}
              scoreFormatter={formatHexGlTime}
              isAdmin={isAdmin}
              onDeleteScore={handleDeleteScore}
              title="Classement"
              maxHeight={600}
            />
          </div>
        )}
      </div>
    </div>
  );
}


import { useCallback, useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { PageShell, PageHeader } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { useAuth } from '@/contexts/AuthContext';
import { gamesApi } from '@/services/api';
import { cn } from '@/lib/utils';
import { useHideGameLeaderboards } from '@/lib/game-preferences';

const GAME_TYPE = 'qs_watermelon';
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 800;

export default function QSWatermelon() {
  const { user } = useAuth();
  const hideGameLeaderboards = useHideGameLeaderboards();
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await gamesApi.getStats(GAME_TYPE, user.id);
      setHighScore(response.data.stats.highScore || 0);
    } catch {
      // noop
    }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(response.data.rankings || []);
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  const handleDeleteScore = useCallback(async (userId: string, username: string) => {
    if (!confirm(`Supprimer le score de ${username} ?`)) return;
    try {
      await gamesApi.deleteStats(GAME_TYPE, userId);
      await fetchLeaderboard();
      if (userId === user?.id) {
        setHighScore(0);
      }
    } catch {
      // noop
    }
  }, [fetchLeaderboard, user?.id]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="QS Watermelon"
        description="Fusionne les fruits, fais grimper ton score et garde la pile sous la ligne rouge le plus longtemps possible."
      />

      <div className={cn(
        'grid gap-4',
        hideGameLeaderboards
          ? 'xl:grid-cols-1'
          : 'xl:grid-cols-[minmax(0,1fr)_280px]'
      )}>
        <div
          ref={gameContainerRef}
          className={`relative flex flex-col gap-3 ${isFullscreen ? 'min-h-screen w-screen items-center bg-background px-4 py-4' : ''}`}
        >
          <GameFullscreenToolbar
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            className="w-full max-w-[480px]"
          />

          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={CANVAS_WIDTH} baseHeight={CANVAS_HEIGHT}>
            <iframe
              src="/watermelon/index.html"
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block h-full w-full rounded-2xl border border-border/40 shadow-sm"
              style={{ display: 'block' }}
              allow="autoplay"
              title="Watermelon Game"
            />
          </GameFullscreenStage>
        </div>

        {!hideGameLeaderboards && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="px-4 py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  Conseils
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4 text-xs text-muted-foreground">
                <p>Garde le centre propre au début pour t'offrir plus de latitude quand les gros fruits arrivent.</p>
                <p>Ne force pas toutes les fusions en haut de pile : sécurise d'abord ton espace.</p>
                <p>Les grosses chaînes naissent souvent d'une base compacte, pas d'un empilement trop agressif.</p>
              </CardContent>
            </Card>

            <GameLeaderboard
              entries={leaderboard}
              currentUserId={user?.id}
              personalHighScore={highScore}
              isAdmin={user?.isAdmin}
              onDeleteScore={handleDeleteScore}
              title="Classement"
              maxHeight={420}
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}

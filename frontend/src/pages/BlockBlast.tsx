import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Grip, MousePointer2, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { gamesApi } from '@/services/api';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import {
  canPlacePiece,
  colorToHex,
  createEmptyBoard,
  createNextHand,
  createRandomHand,
  getBlockCount,
  getFilledBlockStyle,
  getModeConfig,
  getPlacementPreview,
  getPossiblePlacements,
  hasAnyLegalMove,
  placePiece,
  type BlockBlastMode,
  type BoardState,
  type HandState,
  type PieceData,
} from '@/lib/blockblast';

type GameStatus = 'idle' | 'playing' | 'game-over';

type BlockBlastState = {
  mode: BlockBlastMode;
  board: BoardState;
  hand: HandState;
  score: number;
  combo: number;
  lastBrokenLine: number;
  moves: number;
  status: GameStatus;
};

type DragState = {
  pieceIndex: number;
  pointerId: number;
  pointerX: number;
  pointerY: number;
  pieceWidth: number;
  pieceHeight: number;
};

const GAME_TYPE = 'blockblast';
const BASE_STAGE_SIZE = 920;

function createInitialState(mode: BlockBlastMode): BlockBlastState {
  const config = getModeConfig(mode);
  return {
    mode,
    board: createEmptyBoard(config.boardLength),
    hand: createRandomHand(config.handSize),
    score: 0,
    combo: 0,
    lastBrokenLine: 0,
    moves: 0,
    status: 'idle',
  };
}

function getWinThreshold(mode: BlockBlastMode) {
  return mode === 'chaos' ? 260 : 180;
}

function cellBelongsToPiece(piece: PieceData, startX: number, startY: number, cellX: number, cellY: number) {
  const localX = cellX - startX;
  const localY = cellY - startY;

  if (localX < 0 || localY < 0) return false;
  if (localY >= piece.matrix.length || localX >= piece.matrix[0].length) return false;

  return piece.matrix[localY][localX] === 1;
}

export default function BlockBlast() {
  const { user, refreshUser } = useAuth();
  const { containerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const boardRef = useRef<HTMLDivElement>(null);

  const [game, setGame] = useState<BlockBlastState>(() => createInitialState('classic'));
  const [selectedPieceIndex, setSelectedPieceIndex] = useState<number | null>(null);
  const [hoveredDrop, setHoveredDrop] = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [highScore, setHighScore] = useState(0);
  const [totalPlayed, setTotalPlayed] = useState(0);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const submittedThisRunRef = useRef(false);
  const runVersionRef = useRef(0);
  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);

  const modeConfig = getModeConfig(game.mode);
  const activePieceIndex = drag?.pieceIndex ?? selectedPieceIndex;
  const activePiece = activePieceIndex !== null ? game.hand[activePieceIndex] : null;
  const possiblePlacements = useMemo(
    () => getPossiblePlacements(game.board, activePiece),
    [activePiece, game.board],
  );
  const preview = useMemo(() => {
    if (!activePiece || !hoveredDrop) return null;
    return getPlacementPreview(game.board, activePiece, hoveredDrop.x, hoveredDrop.y);
  }, [activePiece, game.board, hoveredDrop]);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await gamesApi.getStats(GAME_TYPE, user.id);
      setHighScore(response.data.stats.highScore || 0);
      setTotalPlayed(response.data.stats.totalPlayed || 0);
    } catch (error) {
      console.error('Failed to fetch blockblast stats:', error);
    }
  }, [user?.id]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await gamesApi.getLeaderboard(GAME_TYPE, 20);
      setLeaderboard(response.data.rankings || []);
    } catch (error) {
      console.error('Failed to fetch blockblast leaderboard:', error);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    void fetchLeaderboard();
  }, [fetchLeaderboard, fetchStats]);

  const resetRun = useCallback((mode: BlockBlastMode = game.mode) => {
    runVersionRef.current += 1;
    submittedThisRunRef.current = false;
    setGame(createInitialState(mode));
    setSelectedPieceIndex(null);
    setHoveredDrop(null);
    setDrag(null);
    setRewards(null);
    setLastScore(null);
    setIsNewHighScore(false);
  }, [game.mode]);

  const changeMode = (mode: BlockBlastMode) => {
    resetRun(mode);
  };

  const placeActivePiece = useCallback((pieceIndex: number, x: number, y: number) => {
    setGame((current) => {
      const piece = current.hand[pieceIndex];
      if (!piece) return current;

      const placed = placePiece(current.board, piece, x, y);
      if (!placed) return current;

      const boardLength = current.board.length;
      const handSize = current.hand.length;
      const pieceBlockCount = getBlockCount(piece);

      let nextScore = current.score + pieceBlockCount;
      let nextCombo = current.combo;
      let nextLastBrokenLine = current.lastBrokenLine;

      if (placed.linesBroken > 0) {
        nextLastBrokenLine = 0;
        nextCombo += placed.linesBroken;
        nextScore += placed.linesBroken * boardLength * (nextCombo / 2) * pieceBlockCount;
      } else {
        nextLastBrokenLine += 1;
        if (nextLastBrokenLine >= handSize) {
          nextCombo = 0;
        }
      }

      const nextHand = createNextHand(current.hand, pieceIndex, handSize);
      const hasMovesLeft = hasAnyLegalMove(placed.board, nextHand);

      return {
        ...current,
        board: placed.board,
        hand: nextHand,
        score: Math.floor(nextScore),
        combo: nextCombo,
        lastBrokenLine: nextLastBrokenLine,
        moves: current.moves + 1,
        status: hasMovesLeft ? 'playing' : 'game-over',
      };
    });

    setSelectedPieceIndex(null);
    setHoveredDrop(null);
    setDrag(null);
  }, []);

  useEffect(() => {
    if (!drag) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;

      setDrag((current) => current
        ? {
            ...current,
            pointerX: event.clientX,
            pointerY: event.clientY,
          }
        : current);

      const boardElement = boardRef.current;
      const piece = game.hand[drag.pieceIndex];
      if (!boardElement || !piece) {
        setHoveredDrop(null);
        return;
      }

      const rect = boardElement.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        setHoveredDrop(null);
        return;
      }

      const cellSize = rect.width / game.board.length;
      
      const exactX = (event.clientX - rect.left) / cellSize;
      const exactY = (event.clientY - rect.top) / cellSize;

      const boardX = Math.round(exactX - piece.matrix[0].length / 2);
      const boardY = Math.round(exactY - piece.matrix.length / 2);

      const dropX = Math.max(0, Math.min(game.board.length - piece.matrix[0].length, boardX));
      const dropY = Math.max(0, Math.min(game.board.length - piece.matrix.length, boardY));

      setHoveredDrop(canPlacePiece(game.board, piece, dropX, dropY) ? { x: dropX, y: dropY } : null);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;

      const drop = hoveredDrop;
      const pieceIndex = drag.pieceIndex;
      const piece = game.hand[pieceIndex];

      if (piece && drop) {
        placeActivePiece(pieceIndex, drop.x, drop.y);
      } else {
        setDrag(null);
        setHoveredDrop(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [drag, game.board, game.hand, hoveredDrop, placeActivePiece]);

  useEffect(() => {
    if (game.status !== 'game-over' || submittedThisRunRef.current || !user?.id || game.moves === 0) {
      return;
    }

    submittedThisRunRef.current = true;
    const submittedRunVersion = runVersionRef.current;

    const submit = async () => {
      try {
        const response = await gamesApi.complete(GAME_TYPE, {
          score: game.score,
          won: game.score >= getWinThreshold(game.mode),
          difficulty: game.mode,
        });

        if (submittedRunVersion === runVersionRef.current) {
          setRewards({
            aura: response.data.auraReward,
            money: response.data.moneyReward,
          });
          setLastScore(game.score);
          setIsNewHighScore(Boolean(response.data.isNewHighScore));
        }

        if (response.data.isNewHighScore) {
          setHighScore((current) => Math.max(current, game.score));
        }

        await refreshUser();
        await Promise.all([fetchStats(), fetchLeaderboard()]);
      } catch (error) {
        console.error('Failed to submit blockblast score:', error);
      }
    };

    void submit();
  }, [fetchLeaderboard, fetchStats, game.mode, game.moves, game.score, game.status, refreshUser, user?.id]);

  const handleDeleteScore = useCallback(async (userId: string, _username: string) => {

    try {
      await gamesApi.deleteStats(GAME_TYPE, userId);
      if (userId === user?.id) {
        setHighScore(0);
      }
      await fetchLeaderboard();
    } catch (error) {
      console.error('Failed to delete blockblast score:', error);
    }
  }, [fetchLeaderboard, user?.id]);

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, pieceIndex: number) => {
    const piece = game.hand[pieceIndex];
    if (!piece || game.status === 'game-over') return;

    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedPieceIndex(pieceIndex);
    setDrag({
      pieceIndex,
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      pieceWidth: rect.width,
      pieceHeight: rect.height,
    });
  };

  const handleBoardClick = (cellX: number, cellY: number) => {
    if (activePieceIndex === null || !activePiece || drag || game.status === 'game-over') return;
    if (!canPlacePiece(game.board, activePiece, cellX, cellY)) return;
    placeActivePiece(activePieceIndex, cellX, cellY);
  };

  const gameOver = game.status === 'game-over';
  const boardContainerStyle: CSSProperties = {
    aspectRatio: '1 / 1',
    width: isFullscreen
      ? '100%'
      : 'min(100%, 620px, max(280px, calc(100vh - 28rem)))',
  };

  return (
    <PageShell size="wide">
      <PageHeader
        title="BlockBlast"
        description="Portage fidèle de Blockerino dans Aura: mêmes pièces, même scoring, mode Classic et Chaos, avec score persistant et classement."
      />

      <div className={cn('grid items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]', isFullscreen && 'grid-cols-1')}>
        <div className={cn('space-y-4', isFullscreen && 'hidden')}>
          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm font-medium">Run</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="text-2xl font-semibold tabular-nums">{game.score}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Record</p>
                  <p className="text-2xl font-semibold tabular-nums">{highScore}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Combo</p>
                  <p className="text-xl font-medium tabular-nums">x{Math.max(1, game.combo)}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Parties</p>
                  <p className="text-xl font-medium tabular-nums">{totalPlayed}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Mode</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['classic', 'chaos'] as BlockBlastMode[]).map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      variant={game.mode === mode ? 'default' : 'outline'}
                      className={cn('h-auto flex-col items-start gap-1 px-3 py-3 text-left', mode === 'chaos' && game.mode === mode && 'bg-black text-white hover:bg-black/90')}
                      onClick={() => changeMode(mode)}
                    >
                      <span>{getModeConfig(mode).label}</span>
                      <span className="text-[11px] font-normal opacity-80">
                        {mode === 'classic' ? '8x8, 3 pièces' : '10x10, 5 pièces'}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-sm">
                <p className="font-medium">Comment jouer</p>
                <p className="text-muted-foreground">Glisse une pièce sur la grille ou sélectionne-la puis clique un emplacement valide.</p>
                <p className="text-muted-foreground">Chaque bloc posé donne des points. Compléter une ligne ou une colonne déclenche un bonus combo.</p>
              </div>

              {lastScore !== null && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm">
                  <p className="font-medium text-emerald-200">Dernière run: {lastScore}</p>
                  <p className="mt-1 text-emerald-100/80">
                    {rewards ? `+${rewards.money} money, +${rewards.aura} aura` : 'Score enregistré.'}
                    {isNewHighScore ? ' Nouveau record personnel.' : ''}
                  </p>
                </div>
              )}

              <Button type="button" variant="outline" className="w-full" onClick={() => resetRun()}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Recommencer
              </Button>
            </CardContent>
          </Card>
        </div>

        <div
          ref={containerRef}
          className={cn(
            'rounded-2xl border border-border/50 bg-[radial-gradient(circle_at_top,_rgba(255,80,80,0.18),_transparent_35%),linear-gradient(180deg,_rgba(8,8,10,0.98),_rgba(20,20,28,0.96))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]',
            isFullscreen && 'fixed inset-0 z-50 rounded-none border-0 p-6',
          )}
        >
          <GameFullscreenToolbar
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            className="mb-4"
          >
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
              <Sparkles className="h-3.5 w-3.5" />
              {modeConfig.label} · {modeConfig.boardLength}x{modeConfig.boardLength}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
              <Trophy className="h-3.5 w-3.5" />
              Score {game.score}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
              <Grip className="h-3.5 w-3.5" />
              Combo x{Math.max(1, game.combo)}
            </div>
          </GameFullscreenToolbar>

          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={BASE_STAGE_SIZE} baseHeight={BASE_STAGE_SIZE}>
            <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_30%),linear-gradient(180deg,_rgba(14,14,18,0.98),_rgba(0,0,0,0.95))] px-4 py-6">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(255,255,255,0.02)_100%)]" />

              <div className="relative z-10 text-center">
                <p className="text-xs uppercase tracking-[0.36em] text-white/45">blockerino inside aura</p>
                <h2 className="mt-2 text-4xl font-black tracking-[0.18em] text-white">BLOCKBLAST</h2>
              </div>

              <div
                ref={boardRef}
                className="relative z-10 max-w-[620px] rounded-[22px] border-[3px] border-white/70 bg-[#0f0f11] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                style={boardContainerStyle}
              >
                <div
                  className="grid h-full w-full gap-[3px] rounded-[14px] bg-[#16161a] p-[3px]"
                  style={{ gridTemplateColumns: `repeat(${game.board.length}, minmax(0, 1fr))` }}
                >
                  {game.board.flatMap((row, y) =>
                    row.map((cell, x) => {
                      const pieceCell = activePiece && hoveredDrop && preview?.valid
                        ? cellBelongsToPiece(activePiece, hoveredDrop.x, hoveredDrop.y, x, y)
                        : false;
                      const willBreak = Boolean(preview?.valid && (preview.rowsToClear.has(y) || preview.colsToClear.has(x)));
                      const canDropHere = possiblePlacements.has(`${x}:${y}`);

                      let style: CSSProperties = {
                        backgroundColor: 'rgba(0, 0, 0, 0.18)',
                        border: '1px solid rgba(255,255,255,0.03)',
                      };

                      if (cell.filled) {
                        style = getFilledBlockStyle(cell.color, 5);
                      }

                      if (pieceCell && activePiece) {
                        style = {
                          ...getFilledBlockStyle(activePiece.color, 5),
                          opacity: willBreak ? 1 : 0.42,
                          boxShadow: willBreak ? `0 0 28px ${colorToHex(activePiece.color)}` : undefined,
                        };
                      } else if (willBreak && activePiece) {
                        style = {
                          ...getFilledBlockStyle(activePiece.color, 5),
                          opacity: cell.filled ? 1 : 0.72,
                          boxShadow: `0 0 28px ${colorToHex(activePiece.color)}`,
                        };
                      }

                      return (
                        <button
                          key={`${x}:${y}`}
                          type="button"
                          className={cn(
                            'relative aspect-square min-w-0 rounded-[3px] transition-transform duration-75',
                            canDropHere && activePiece && !pieceCell && !willBreak && 'hover:scale-[1.03]',
                          )}
                          style={style}
                          onMouseEnter={() => {
                            if (!drag && activePiece && canPlacePiece(game.board, activePiece, x, y)) {
                              setHoveredDrop({ x, y });
                            }
                          }}
                          onMouseLeave={() => {
                            if (!drag) {
                              setHoveredDrop((current) => (current?.x === x && current?.y === y ? null : current));
                            }
                          }}
                          onClick={() => handleBoardClick(x, y)}
                        >
                          {canDropHere && activePiece && !cell.filled && !pieceCell && !willBreak && (
                            <span className="pointer-events-none absolute inset-0 m-auto h-2 w-2 rounded-full bg-white/12" />
                          )}
                        </button>
                      );
                    }),
                  )}
                </div>

                {gameOver && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[20px] bg-black/78 backdrop-blur-sm">
                    <div className="space-y-4 px-6 text-center text-white">
                      <div>
                        <p className="text-xs uppercase tracking-[0.32em] text-white/50">run terminée</p>
                        <p className="mt-2 text-4xl font-black">{game.score}</p>
                        <p className="mt-2 text-sm text-white/70">Plus aucun placement possible avec la main actuelle.</p>
                      </div>
                      <Button type="button" onClick={() => resetRun()} className="bg-white text-black hover:bg-white/90">
                        Relancer une partie
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative z-10 flex w-full max-w-[760px] flex-wrap items-end justify-center gap-4 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                {game.hand.map((piece, pieceIndex) => {
                  if (!piece) {
                    return (
                      <div
                        key={`empty-${pieceIndex}`}
                        className="h-[92px] w-[92px] rounded-2xl border border-dashed border-white/10 bg-black/10"
                      />
                    );
                  }

                  return (
                    <button
                      key={`piece-${pieceIndex}`}
                      type="button"
                      className={cn(
                        'group relative rounded-2xl border px-3 py-3 transition duration-150',
                        selectedPieceIndex === pieceIndex
                          ? 'border-white/70 bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.16)]'
                          : 'border-white/10 bg-black/20 hover:border-white/30 hover:bg-white/[0.06]',
                        drag?.pieceIndex === pieceIndex && 'opacity-0',
                      )}
                      onClick={() => setSelectedPieceIndex((current) => (current === pieceIndex ? null : pieceIndex))}
                      onPointerDown={(event) => startDrag(event, pieceIndex)}
                    >
                      <div
                        className="relative"
                        style={{
                          width: `${piece.matrix[0].length * 22}px`,
                          height: `${piece.matrix.length * 22}px`,
                        }}
                      >
                        {piece.matrix.flatMap((cells, y) =>
                          cells.map((filled, x) => (
                            filled === 1 ? (
                              <span
                                key={`${pieceIndex}-${x}-${y}`}
                                className="absolute block rounded-[2px]"
                                style={{
                                  left: `${x * 22}px`,
                                  top: `${y * 22}px`,
                                  width: '22px',
                                  height: '22px',
                                  ...getFilledBlockStyle(piece.color, 4),
                                }}
                              />
                            ) : null
                          )),
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="relative z-10 flex items-center gap-3 text-sm text-white/60">
                <MousePointer2 className="h-4 w-4" />
                Glisser-déposer ou cliquer pour poser les pièces.
              </div>
            </div>
          </GameFullscreenStage>

          {drag && activePiece && (
            <div
              className="pointer-events-none fixed z-[70]"
              style={{
                left: drag.pointerX - ((activePiece.matrix[0].length * 28 + 24) * 1.08) / 2,
                top: drag.pointerY - ((activePiece.matrix.length * 28 + 24) * 1.08) / 2,
              }}
            >
              <div
                className="relative rounded-2xl border border-white/20 bg-black/20 px-3 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
                style={{ transform: 'scale(1.08)' }}
              >
                <div
                  className="relative"
                  style={{
                    width: `${activePiece.matrix[0].length * 28}px`,
                    height: `${activePiece.matrix.length * 28}px`,
                  }}
                >
                  {activePiece.matrix.flatMap((cells, y) =>
                    cells.map((filled, x) => (
                      filled === 1 ? (
                        <span
                          key={`drag-${x}-${y}`}
                          className="absolute block rounded-[3px]"
                          style={{
                            left: `${x * 28}px`,
                            top: `${y * 28}px`,
                            width: '28px',
                            height: '28px',
                            ...getFilledBlockStyle(activePiece.color, 5),
                          }}
                        />
                      ) : null
                    )),
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={cn(isFullscreen && 'hidden')}>
          <GameLeaderboard
            entries={leaderboard}
            currentUserId={user?.id}
            personalHighScore={highScore}
            isAdmin={isAdmin}
            onDeleteScore={handleDeleteScore}
            title="Classement BlockBlast"
          />
        </div>
      </div>
    </PageShell>
  );
}


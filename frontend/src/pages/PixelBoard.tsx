import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, Download, Lock, Minus, Pause, Play, Plus, RefreshCw, RotateCcw, SquarePen, Trophy } from 'lucide-react';
import { getSocket, initSocket } from '@/services/socket';
import { pixelBoardApi, type PixelBoardAnalysis, type PixelBoardSettings, type PixelBoardState } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const BOARD_SIZE = 100;
const DEFAULT_COLOR = '#FFFFFF';
const EXACT_COLORS = [
  '#6D001A', '#BE0039', '#FF4500', '#FFA800',
  '#FFD635', '#FFF8B8', '#00A368', '#00CC78',
  '#7EED56', '#00756F', '#009EAA', '#00CCC0',
  '#2450A4', '#3690EA', '#51E9F4', '#493AC1',
  '#6A5CFF', '#94B3FF', '#811E9F', '#B44AC0',
  '#E4ABFF', '#DE107F', '#FF3881', '#FF99AA',
  '#6D482F', '#9C6926', '#FFB470', '#000000',
  '#515252', '#898D90', '#D4D7D9', '#FFFFFF',
];

const emptyBoard = () => Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => DEFAULT_COLOR);

const formatRemaining = (target: string | null, now: number) => {
  if (!target) return 'Pret';
  const remainingMs = new Date(target).getTime() - now;
  if (remainingMs <= 0) return 'Pret';
  const seconds = Math.ceil(remainingMs / 1000);
  return `${seconds}s`;
};

const downloadJson = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function PixelBoard() {
  const { user } = useAuth();
  const [board, setBoard] = useState<string[]>(() => emptyBoard());
  const [settings, setSettings] = useState<PixelBoardSettings | null>(null);
  const [palette, setPalette] = useState<string[]>(EXACT_COLORS);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [leaderboard, setLeaderboard] = useState<PixelBoardState['leaderboard']>([]);
  const [nextPlaceAt, setNextPlaceAt] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [status, setStatus] = useState('Chargement...');
  const [adminCooldown, setAdminCooldown] = useState('30');
  const [adminDurationHours, setAdminDurationHours] = useState('168');
  const [adminLockedMessage, setAdminLockedMessage] = useState("Le Pixel Board n'est pas encore ouvert.");
  const [analysis, setAnalysis] = useState<PixelBoardAnalysis | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const canAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);

  const applyState = useCallback((state: PixelBoardState) => {
    const next = emptyBoard();
    for (const pixel of state.pixels) {
      if (pixel.x >= 0 && pixel.x < BOARD_SIZE && pixel.y >= 0 && pixel.y < BOARD_SIZE) {
        next[pixel.y * BOARD_SIZE + pixel.x] = pixel.color;
      }
    }
    setBoard(next);
    setSettings(state.settings);
    setPalette(state.colors);
    setLeaderboard(state.leaderboard);
    setNextPlaceAt(state.me.nextPlaceAt);
    setAdminCooldown(String(state.settings.cooldownSeconds));
    setAdminDurationHours(String(Math.round(state.settings.durationSeconds / 3600)));
    setAdminLockedMessage(state.settings.lockedMessage);
    setStatus('Connecte');
  }, []);

  const loadState = useCallback(async () => {
    const { data } = await pixelBoardApi.getState();
    applyState(data);
  }, [applyState]);

  useEffect(() => {
    void loadState();
    const socket = initSocket();
    socket.emit('pixel-board:join');

    const onState = (state: PixelBoardState) => applyState(state);
    const onPixel = (pixel: { x: number; y: number; color: string }) => {
      setBoard((prev) => {
        const next = [...prev];
        next[pixel.y * BOARD_SIZE + pixel.x] = pixel.color;
        return next;
      });
    };
    const onSettings = (nextSettings: PixelBoardSettings) => {
      setSettings(nextSettings);
      setAdminCooldown(String(nextSettings.cooldownSeconds));
      setAdminDurationHours(String(Math.round(nextSettings.durationSeconds / 3600)));
      setAdminLockedMessage(nextSettings.lockedMessage);
    };
    const onCooldown = (data: { nextPlaceAt?: string | null; cooldownRemainingMs?: number }) => {
      setNextPlaceAt(data.nextPlaceAt ?? null);
    };
    const onReset = () => setBoard(emptyBoard());
    const onError = (data: { message?: string }) => setStatus(data.message || 'Action refusee');

    socket.on('pixel-board:state', onState);
    socket.on('pixel-board:pixel', onPixel);
    socket.on('pixel-board:settings', onSettings);
    socket.on('pixel-board:cooldown', onCooldown);
    socket.on('pixel-board:reset', onReset);
    socket.on('pixel-board:error', onError);
    return () => {
      socket.off('pixel-board:state', onState);
      socket.off('pixel-board:pixel', onPixel);
      socket.off('pixel-board:settings', onSettings);
      socket.off('pixel-board:cooldown', onCooldown);
      socket.off('pixel-board:reset', onReset);
      socket.off('pixel-board:error', onError);
    };
  }, [applyState, loadState]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const cooldownLabel = formatRemaining(nextPlaceAt, nowTick);
  const canPlace = cooldownLabel === 'Pret' && !settings?.isPaused && !settings?.isEnded;
  const isPublicLocked = Boolean(settings?.isLocked && !canAdmin);
  const eventRemaining = useMemo(() => {
    if (!settings?.endsAt) return 'Sans limite';
    return formatRemaining(settings.endsAt, nowTick);
  }, [settings?.endsAt, nowTick]);

  const placePixel = (index: number) => {
    const socket = getSocket();
    if (!socket || !canPlace) return;
    socket.emit('pixel-board:place', {
      x: index % BOARD_SIZE,
      y: Math.floor(index / BOARD_SIZE),
      color: selectedColor,
    });
  };

  const saveAdminSettings = () => {
    const socket = getSocket();
    socket?.emit('pixel-board:admin-settings', {
      cooldownSeconds: Number(adminCooldown),
      durationSeconds: Number(adminDurationHours) * 3600,
      lockedMessage: adminLockedMessage,
    });
  };

  const togglePause = () => {
    getSocket()?.emit('pixel-board:admin-settings', { isPaused: !settings?.isPaused });
  };

  const toggleLocked = () => {
    getSocket()?.emit('pixel-board:admin-settings', {
      isLocked: !settings?.isLocked,
      lockedMessage: adminLockedMessage,
    });
  };

  const forceEnd = () => {
    getSocket()?.emit('pixel-board:admin-settings', { forceEnd: true });
  };

  const resetBoard = () => {
    if (window.confirm('Reset le canvas actuel ? Les logs restent conserves.')) {
      getSocket()?.emit('pixel-board:admin-reset');
    }
  };

  const loadAnalysis = async () => {
    const { data } = await pixelBoardApi.getAnalysis();
    setAnalysis(data);
  };

  const updateZoom = (nextZoom: number) => {
    setZoom(Math.min(4, Math.max(0.5, nextZoom)));
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <SquarePen className="h-4 w-4" />
            Pixel event
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Pixel Board</h1>
          <p className="text-sm text-muted-foreground">100x100 pixels, un placement par cooldown, score clans en fin d event.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadState()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />Sync
          </Button>
          {canAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowAdmin((value) => !value)}>
              <Crown className="mr-1.5 h-4 w-4" />Admin
            </Button>
          )}
        </div>
      </div>

      {isPublicLocked ? (
        <Card>
          <CardContent className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/30">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">Pixel Board bloque</h2>
            <p className="max-w-md text-sm text-muted-foreground">{settings?.lockedMessage}</p>
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className={cn('font-medium', canPlace ? 'text-green-500' : 'text-amber-500')}>
                Cooldown : {cooldownLabel}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {hoveredPixel ? `x:${hoveredPixel.x} y:${hoveredPixel.y}` : 'x:- y:-'}
              </span>
              <span className="text-muted-foreground">{settings?.isPaused ? 'Pause' : settings?.isEnded ? 'Termine' : `Fin : ${eventRemaining}`}</span>
              {settings?.isLocked && <span className="text-amber-500">Bloque public</span>}
              <span className="text-muted-foreground">{status}</span>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => updateZoom(zoom - 0.25)}>
                <Minus className="h-4 w-4" />
              </Button>
              <input
                aria-label="Zoom canvas"
                type="range"
                min="0.5"
                max="4"
                step="0.25"
                value={zoom}
                onChange={(event) => updateZoom(Number(event.target.value))}
                className="w-40"
              />
              <Button type="button" size="sm" variant="outline" onClick={() => updateZoom(zoom + 0.25)}>
                <Plus className="h-4 w-4" />
              </Button>
              <span className="font-mono text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="max-h-[78vh] overflow-auto rounded border border-border bg-muted/20 p-2">
              <div className="min-w-[640px]" style={{ width: `${zoom * 100}%` }}>
                <div
                  className="grid w-full border border-border bg-white shadow-sm"
                  style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`, aspectRatio: '1 / 1' }}
                >
                  {board.map((color, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-label={`Pixel ${index % BOARD_SIZE}, ${Math.floor(index / BOARD_SIZE)}`}
                      onClick={() => placePixel(index)}
                      onMouseEnter={() => setHoveredPixel({ x: index % BOARD_SIZE, y: Math.floor(index / BOARD_SIZE) })}
                      onFocus={() => setHoveredPixel({ x: index % BOARD_SIZE, y: Math.floor(index / BOARD_SIZE) })}
                      onMouseLeave={() => setHoveredPixel(null)}
                      onBlur={() => setHoveredPixel(null)}
                      className="aspect-square border-0 p-0 outline outline-0 outline-offset-0 hover:relative hover:z-10 hover:outline-1 hover:outline-black focus-visible:relative focus-visible:z-10 focus-visible:outline-1 focus-visible:outline-black"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <h2 className="text-sm font-semibold">Palette</h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-8 gap-2">
                {palette.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    onClick={() => setSelectedColor(color)}
                    className={cn('h-8 rounded border border-border', selectedColor === color && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4" />Leaderboard</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun pixel pose.</p>
              ) : leaderboard.slice(0, 6).map((entry, index) => (
                <div key={entry.userId} className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5 text-sm">
                  <span className="truncate" style={entry.usernameColor ? { color: entry.usernameColor } : undefined}>
                    {index + 1}. {entry.username}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{entry.actions}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <h2 className="text-sm font-semibold">Analyse</h2>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={loadAnalysis}>Calculer</Button>
              <Button size="sm" variant="outline" disabled={!analysis} onClick={() => analysis && downloadJson('pixel-board-analysis.json', analysis)}>
                <Download className="mr-1.5 h-4 w-4" />Export
              </Button>
              {analysis && <p className="w-full text-xs text-muted-foreground">{analysis.eventCount} events logs.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {canAdmin && showAdmin && (
        <Card>
          <CardHeader className="py-3">
            <h2 className="text-sm font-semibold">Admin Pixel Board</h2>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              Cooldown secondes
              <Input value={adminCooldown} onChange={(e) => setAdminCooldown(e.target.value)} className="w-32" />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Duree heures
              <Input value={adminDurationHours} onChange={(e) => setAdminDurationHours(e.target.value)} className="w-32" />
            </label>
            <label className="min-w-[260px] flex-1 space-y-1 text-xs text-muted-foreground">
              Message page bloquee
              <textarea
                value={adminLockedMessage}
                onChange={(e) => setAdminLockedMessage(e.target.value)}
                maxLength={240}
                className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <Button size="sm" onClick={saveAdminSettings}>Appliquer</Button>
            <Button size="sm" variant="outline" onClick={toggleLocked}>
              <Lock className="mr-1.5 h-4 w-4" />
              {settings?.isLocked ? 'Ouvrir public' : 'Bloquer public'}
            </Button>
            <Button size="sm" variant="outline" onClick={togglePause}>
              {settings?.isPaused ? <Play className="mr-1.5 h-4 w-4" /> : <Pause className="mr-1.5 h-4 w-4" />}
              {settings?.isPaused ? 'Reprendre' : 'Pause'}
            </Button>
            <Button size="sm" variant="outline" onClick={forceEnd}>Force end</Button>
            <Button size="sm" variant="outline" className="border-destructive/50 text-destructive" onClick={resetBoard}>
              <RotateCcw className="mr-1.5 h-4 w-4" />Reset canvas
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

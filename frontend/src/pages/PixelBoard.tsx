import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, Download, Lock, Minus, Pause, Play, Plus, RefreshCw, RotateCcw, SquarePen, Trophy } from 'lucide-react';
import { getSocket, initSocket } from '@/services/socket';
import { pixelBoardApi, type PixelBoardAnalysis, type PixelBoardSettings, type PixelBoardState } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from '@/components/ui/item';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
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
    <PageShell>
      <PageHeader
        title="Pixel Board"
        description="100x100 pixels, un placement par cooldown, score clans en fin d'event."
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => void loadState()}>
              <RefreshCw />Sync
            </Button>
            {canAdmin && (
              <Button variant="outline" size="sm" onClick={() => setShowAdmin((value) => !value)}>
                <Crown />Admin
              </Button>
            )}
          </>
        )}
      />

      {isPublicLocked ? (
        <Empty className="min-h-[360px] border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Lock /></EmptyMedia>
            <EmptyTitle>Pixel Board bloqué</EmptyTitle>
            <EmptyDescription>{settings?.lockedMessage}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Badge variant={canPlace ? 'success' : 'warning'}>Cooldown : {cooldownLabel}</Badge>
                {settings?.isLocked && <Badge variant="warning">Bloqué public</Badge>}
              </CardTitle>
              <CardDescription>
                {settings?.isPaused ? 'Pause' : settings?.isEnded ? 'Terminé' : `Fin : ${eventRemaining}`} · {status}
              </CardDescription>
              <CardAction>
                <span className="font-mono text-xs text-muted-foreground">
                  {hoveredPixel ? `x:${hoveredPixel.x} y:${hoveredPixel.y}` : 'x:- y:-'}
                </span>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Button type="button" size="icon-sm" variant="outline" aria-label="Zoom arrière" onClick={() => updateZoom(zoom - 0.25)}>
                  <Minus />
                </Button>
                <Slider
                  aria-label="Zoom canvas"
                  min={0.5}
                  max={4}
                  step={0.25}
                  value={[zoom]}
                  onValueChange={([value]) => updateZoom(value)}
                  className="w-40"
                />
                <Button type="button" size="icon-sm" variant="outline" aria-label="Zoom avant" onClick={() => updateZoom(zoom + 0.25)}>
                  <Plus />
                </Button>
                <span className="font-mono text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
              </div>
              <ScrollArea className="max-h-[78vh] rounded-md border bg-muted/20">
                <div className="min-w-[640px] p-2" style={{ width: `${zoom * 100}%` }}>
                  <div
                    className="grid w-full border bg-white"
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
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Palette</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-8 gap-2">
                  {palette.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={color}
                      onClick={() => setSelectedColor(color)}
                      className={cn('h-8 rounded-md border', selectedColor === color && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Trophy className="size-4" />Classement</CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboard.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun pixel posé.</p>
                ) : (
                  <ItemGroup>
                    {leaderboard.slice(0, 6).map((entry, index) => (
                      <Item key={entry.userId} size="sm">
                        <ItemContent>
                          <ItemTitle style={entry.usernameColor ? { color: entry.usernameColor } : undefined}>
                            {index + 1}. {entry.username}
                          </ItemTitle>
                        </ItemContent>
                        <ItemActions>
                          <span className="font-mono text-xs text-muted-foreground">{entry.actions}</span>
                        </ItemActions>
                      </Item>
                    ))}
                  </ItemGroup>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analyse</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={loadAnalysis}>Calculer</Button>
                <Button size="sm" variant="outline" disabled={!analysis} onClick={() => analysis && downloadJson('pixel-board-analysis.json', analysis)}>
                  <Download />Export
                </Button>
                {analysis && <p className="w-full text-xs text-muted-foreground">{analysis.eventCount} events logs.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {canAdmin && showAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Admin Pixel Board</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FieldGroup className="sm:grid sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="pixel-cooldown">Cooldown (secondes)</FieldLabel>
                <Input id="pixel-cooldown" value={adminCooldown} onChange={(e) => setAdminCooldown(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="pixel-duration">Durée (heures)</FieldLabel>
                <Input id="pixel-duration" value={adminDurationHours} onChange={(e) => setAdminDurationHours(e.target.value)} />
              </Field>
            </FieldGroup>
            <Field>
              <FieldLabel htmlFor="pixel-locked-message">Message page bloquée</FieldLabel>
              <Textarea
                id="pixel-locked-message"
                value={adminLockedMessage}
                onChange={(e) => setAdminLockedMessage(e.target.value)}
                maxLength={240}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={saveAdminSettings}>Appliquer</Button>
              <Button size="sm" variant="outline" onClick={toggleLocked}>
                <Lock />
                {settings?.isLocked ? 'Ouvrir public' : 'Bloquer public'}
              </Button>
              <Button size="sm" variant="outline" onClick={togglePause}>
                {settings?.isPaused ? <Play /> : <Pause />}
                {settings?.isPaused ? 'Reprendre' : 'Pause'}
              </Button>
              <Button size="sm" variant="outline" onClick={forceEnd}>Force end</Button>
              <Button size="sm" variant="destructive" onClick={resetBoard}>
                <RotateCcw />Reset canvas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}

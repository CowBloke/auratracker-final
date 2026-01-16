import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Flag, Gauge, Play, Users, Trophy, Clock, Car } from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type InputFlags = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
};

export default function MarioKart() {
  const { user } = useAuth();
  const {
    currentParty,
    partyMembers,
    marioKartState,
    marioKartResult,
    marioKartError,
    startMarioKart,
    sendMarioKartInput,
    requestMarioKartState,
  } = useSocket();

  const [laps, setLaps] = useState(3);
  const inputState = useRef<InputFlags>({ up: false, down: false, left: false, right: false, drift: false });
  const stateRef = useRef(marioKartState);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number>();

  const isLeader = useMemo(() => partyMembers.find((m) => m.userId === user?.id)?.isLeader, [partyMembers, user?.id]);
  const myPlayer = useMemo(
    () => marioKartState?.players.find((p) => p.userId === user?.id),
    [marioKartState?.players, user?.id]
  );

  // Keep local ref in sync for canvas drawing
  useEffect(() => {
    stateRef.current = marioKartState;
  }, [marioKartState]);

  // Fetch state when landing on the page
  useEffect(() => {
    if (currentParty) {
      requestMarioKartState();
    }
  }, [currentParty, requestMarioKartState]);

  // Keyboard controls
  useEffect(() => {
    const updateInputs = (draft: Partial<InputFlags>) => {
      inputState.current = { ...inputState.current, ...draft };
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          updateInputs({ up: true });
          break;
        case 'arrowdown':
        case 's':
          updateInputs({ down: true });
          break;
        case 'arrowleft':
        case 'a':
          updateInputs({ left: true });
          break;
        case 'arrowright':
        case 'd':
          updateInputs({ right: true });
          break;
        case 'shift':
          updateInputs({ drift: true });
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          updateInputs({ up: false });
          break;
        case 'arrowdown':
        case 's':
          updateInputs({ down: false });
          break;
        case 'arrowleft':
        case 'a':
          updateInputs({ left: false });
          break;
        case 'arrowright':
        case 'd':
          updateInputs({ right: false });
          break;
        case 'shift':
          updateInputs({ drift: false });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Send inputs to server on a short interval
  useEffect(() => {
    if (!marioKartState || marioKartState.status === 'finished') return;
    const interval = setInterval(() => {
      const inputs = inputState.current;
      sendMarioKartInput({
        throttle: inputs.up ? 1 : inputs.down ? -1 : 0,
        steer: inputs.left ? -1 : inputs.right ? 1 : 0,
        drift: inputs.drift,
        brake: inputs.down,
      });
    }, 50);
    return () => clearInterval(interval);
  }, [marioKartState, sendMarioKartInput]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const state = stateRef.current;
      const track = state?.track;
      if (!state || !track) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== track.width || canvas.height !== track.height) {
        canvas.width = track.width;
        canvas.height = track.height;
      }

      ctx.clearRect(0, 0, track.width, track.height);

      // Background + track ribbon
      const gradient = ctx.createLinearGradient(0, 0, track.width, track.height);
      gradient.addColorStop(0, '#0b1021');
      gradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, track.width, track.height);

      // Track path
      if (track.checkpoints.length) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 60;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(track.checkpoints[0].x, track.checkpoints[0].y);
        track.checkpoints.slice(1).forEach((cp) => ctx.lineTo(cp.x, cp.y));
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // Boost pads
      track.pads.forEach((pad) => {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.55)';
        ctx.fillRect(pad.x, pad.y, pad.width, pad.height);
      });

      // Checkpoints and start line
      track.checkpoints.forEach((cp, idx) => {
        ctx.beginPath();
        ctx.strokeStyle = idx === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = idx === 0 ? 4 : 2;
        ctx.arc(cp.x, cp.y, cp.radius, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Karts
      (state.players || []).forEach((player) => {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-12, -10);
        ctx.lineTo(-12, 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(-10, -6, 6, 12);
        ctx.restore();

        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(player.username, player.x - 22, player.y - 16);
      });

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const handleStart = () => {
    startMarioKart(laps);
  };

  const sortedPlayers = useMemo(() => {
    if (!marioKartState?.players) return [];
    return [...marioKartState.players].sort((a, b) => {
      if (a.finished && b.finished) {
        const aTime = a.finishTime || Infinity;
        const bTime = b.finishTime || Infinity;
        return aTime - bTime;
      }
      if (a.finished) return -1;
      if (b.finished) return 1;
      if (a.lap !== b.lap) return b.lap - a.lap;
      if (a.checkpointIndex !== b.checkpointIndex) return b.checkpointIndex - a.checkpointIndex;
      return b.speed - a.speed;
    });
  }, [marioKartState?.players]);

  const countdownPct = useMemo(() => {
    if (!marioKartState || marioKartState.status !== 'countdown') return 0;
    const remaining = Math.max(0, marioKartState.countdownEndsAt - Date.now());
    return (remaining / 3500) * 100;
  }, [marioKartState]);

  const currentLap = marioKartState
    ? Math.min(marioKartState.lapCount, (myPlayer?.lap ?? 0) + (myPlayer?.finished ? 0 : 1))
    : 1;
  const lapDisplay = marioKartState ? `${currentLap}/${marioKartState.lapCount}` : `${currentLap}/${laps}`;

  // Not in a party
  if (!currentParty) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
        <Link
          to="/games"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Jeux
        </Link>

        <header className="space-y-2">
          <p className="text-sm text-muted-foreground tracking-wide uppercase">
            Jeu multijoueur
          </p>
          <h1 className="text-5xl md:text-7xl font-light tracking-tight">
            Mario Kart Party
          </h1>
        </header>

        <div className="h-px bg-border" />

        <div className="text-center py-20 space-y-6">
          <Users className="h-16 w-16 mx-auto text-muted-foreground" />
          <div>
            <h2 className="text-2xl font-light mb-2">Besoin d'une party</h2>
            <p className="text-muted-foreground">
              Rejoins ou cree une party pour lancer une course.
            </p>
          </div>
          <Link
            to="/party"
            className="inline-flex items-center gap-2 px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            <Users className="h-4 w-4" />
            Aller aux parties
          </Link>
        </div>
      </div>
    );
  }

  // Lobby state
  if (!marioKartState) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 space-y-12">
        <header className="space-y-2">
          <Link
            to="/games"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Jeux
          </Link>
          <p className="text-sm text-muted-foreground tracking-wide uppercase">
            Jeu multijoueur
          </p>
          <h1 className="text-5xl md:text-7xl font-light tracking-tight">
            Mario Kart Party
          </h1>
        </header>

        <div className="h-px bg-border" />

        <section className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase flex items-center gap-2">
              <Users className="h-4 w-4" />
              Joueurs dans la party ({partyMembers.length})
            </h2>
            <div className="space-y-0 rounded-lg border border-border/50 divide-y divide-border/30">
              {partyMembers.map((member) => (
                <div
                  key={member.userId}
                  className={cn(
                    "flex items-center justify-between px-4 py-3",
                    member.userId === user?.id && "bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="font-medium"
                      style={member.usernameColor ? { color: member.usernameColor } : undefined}
                    >
                      {member.username}
                    </span>
                    {member.isLeader && <span className="text-xs text-yellow-400">leader</span>}
                    {member.userId === user?.id && (
                      <span className="text-xs text-muted-foreground">(toi)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="border border-border/60 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Flag className="h-5 w-5 text-yellow-400" />
                <div>
                  <p className="text-sm text-muted-foreground">Tours</p>
                  <p className="text-xl font-semibold">{laps}</p>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={9}
                value={laps}
                onChange={(e) => setLaps(parseInt(e.target.value) || 3)}
                className="w-full accent-foreground"
              />
              {marioKartError && (
                <div className="text-sm text-destructive">{marioKartError}</div>
              )}
              <button
                onClick={handleStart}
                disabled={!isLeader || partyMembers.length < 2}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-2 px-6 py-3 border rounded-lg transition-colors",
                  !isLeader || partyMembers.length < 2
                    ? "border-border/40 text-muted-foreground cursor-not-allowed"
                    : "border-foreground text-foreground hover:bg-foreground hover:text-background"
                )}
              >
                <Play className="h-4 w-4" />
                Lancer la course
              </button>
              <p className="text-xs text-muted-foreground">
                Leader uniquement · minimum 2 joueurs · ZQSD ou fleches pour conduire
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const countdownRemaining = marioKartState.status === 'countdown'
    ? Math.max(0, marioKartState.countdownEndsAt - Date.now())
    : 0;

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            to="/games"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Jeux
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl md:text-5xl font-light tracking-tight">Mario Kart Party</h1>
            <span className="text-xs uppercase tracking-[0.2em] text-purple-400">Party only</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 border border-border/60 rounded-lg">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Tours {lapDisplay}</span>
          </div>
          {marioKartState.status === 'countdown' && (
            <div className="flex items-center gap-2 px-3 py-2 border border-yellow-400/50 text-yellow-300 rounded-lg">
              <Clock className="h-4 w-4" />
              <span>Depart dans {(countdownRemaining / 1000).toFixed(1)}s</span>
            </div>
          )}
        </div>
      </header>

      <div className="grid lg:grid-cols-[2fr,1fr] gap-8 items-start">
        <div className="relative rounded-xl border border-border/60 overflow-hidden bg-muted/20">
          <canvas
            ref={canvasRef}
            className="w-full h-auto block"
            style={{ maxHeight: '70vh' }}
          />
          {marioKartState.status === 'countdown' && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Depart</p>
                <p className="text-6xl font-semibold text-yellow-300">
                  {(countdownRemaining / 1000).toFixed(1)}
                </p>
                <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden mx-auto">
                  <div
                    className="h-full bg-yellow-300 transition-all"
                    style={{ width: `${countdownPct}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="border border-border/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Hud</span>
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-[0.2em]">Live</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-border/40">
                <p className="text-xs text-muted-foreground uppercase">Vitesse</p>
                <p className="text-2xl font-semibold">{Math.max(0, Math.round((myPlayer?.speed || 0) / 10))} km/h</p>
              </div>
              <div className="p-3 rounded-lg border border-border/40">
                <p className="text-xs text-muted-foreground uppercase">Tours</p>
                <p className="text-2xl font-semibold">{lapDisplay}</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Commandes : Fleches / ZQSD pour diriger · Shift pour drift · Relancer via le leader
            </div>
          </div>

          <div className="border border-border/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Classement</span>
            </div>
            <div className="space-y-2">
              {sortedPlayers.map((player, index) => (
                <div
                  key={player.userId}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg border",
                    player.userId === user?.id ? "border-foreground/40" : "border-border/40",
                    player.finished && "bg-green-500/5 border-green-500/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: player.color }} />
                    <span className="font-medium" style={player.usernameColor ? { color: player.usernameColor } : undefined}>
                      {player.username}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {player.finished
                      ? player.finishTime
                        ? `${((player.finishTime - (marioKartState.startedAt || player.finishTime)) / 1000).toFixed(2)}s`
                        : 'DNF'
                      : `Lap ${player.lap + 1}`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {marioKartResult && (
            <div className="border border-border/60 rounded-xl p-4 space-y-3 bg-muted/40">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-medium">Course terminee</span>
              </div>
              <div className="space-y-2">
                {marioKartResult.standings.map((entry, idx) => (
                  <div
                    key={entry.userId}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg",
                      entry.rank === 1 ? "bg-yellow-500/10 border border-yellow-400/40" : "border border-border/40"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">#{entry.rank ?? idx + 1}</span>
                      <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                      <span className="font-medium" style={entry.usernameColor ? { color: entry.usernameColor } : undefined}>
                        {entry.username}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {entry.finishMs ? `${(entry.finishMs / 1000).toFixed(2)}s` : 'DNF'}
                    </div>
                  </div>
                ))}
              </div>
              {isLeader && (
                <button
                  onClick={() => startMarioKart(laps)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors rounded-lg"
                >
                  <Play className="h-4 w-4" />
                  Relancer une course
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

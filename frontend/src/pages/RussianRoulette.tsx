import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { ArrowLeft, Play, Skull, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';

// ─── Types ────────────────────────────────────────────────────────────────────
interface RRPlayerState {
  userId: string;
  username: string;
  usernameColor?: string | null;
  isAlive: boolean;
  pullCount: number;
  passedOut: boolean;
}

interface RRGameState {
  partyId: string;
  players: RRPlayerState[];
  currentPlayerId: string | null;
  cylinderPosition: number;
  round: number;
  isActive: boolean;
  lastEvent: { type: 'click' | 'bang' | 'pass'; playerId: string; username: string } | null;
  turnEndsAt: number;
  alivePlayers: number;
  totalPlayers: number;
}

interface JoinPrompt {
  partyId: string;
  leaderId: string;
  timeLimit: number;
  startTime: number;
  members: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; accepted: boolean }>;
}

interface GameOver {
  winnerId: string | null;
  winnerUsername: string | null;
  standings: Array<{ userId: string; username: string; isAlive: boolean; pullCount: number; passedOut: boolean }>;
}

interface PlayAgainPrompt {
  partyId: string;
  timeLimit: number;
  startTime: number;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  responses: Array<{ userId: string; playAgain: boolean }>;
  playAgainCount?: number;
}

// ─── Seat positions around ellipse ───────────────────────────────────────────
function seatPos(seatIndex: number, total: number) {
  const cx = 50, cy = 50, rx = 41, ry = 34;
  const startDeg = -90;
  const deg = startDeg - seatIndex * (360 / total);
  const rad = (deg * Math.PI) / 180;
  return {
    left: `${cx + rx * Math.cos(rad)}%`,
    top: `${cy + ry * Math.sin(rad)}%`,
  };
}

// ─── Cylinder SVG ─────────────────────────────────────────────────────────────
function CylinderDisplay({ position, spinning }: { position: number; spinning: boolean }) {
  const chambers = Array.from({ length: 6 });
  return (
    <svg
      width="64"
      height="64"
      viewBox="-32 -32 64 64"
      className={spinning ? 'rr-cylinder-spin' : ''}
      style={{ filter: 'drop-shadow(0 0 8px rgba(255,200,50,0.4))' }}
    >
      <circle cx="0" cy="0" r="28" fill="#1a1008" stroke="#7a5a20" strokeWidth="3" />
      <circle cx="0" cy="0" r="24" fill="#0f0a04" stroke="#5a3a10" strokeWidth="1" />
      {chambers.map((_, i) => {
        const angle = (i / 6) * 2 * Math.PI - Math.PI / 2;
        const cx2 = Math.cos(angle) * 14;
        const cy2 = Math.sin(angle) * 14;
        const isCurrent = i === position;
        return (
          <g key={i}>
            <circle
              cx={cx2}
              cy={cy2}
              r="6"
              fill={isCurrent ? '#2a1a0a' : '#0a0804'}
              stroke={isCurrent ? '#d4a020' : '#3a2a10'}
              strokeWidth={isCurrent ? 2 : 1}
            />
            {isCurrent && (
              <circle cx={cx2} cy={cy2} r="3" fill="rgba(255,180,0,0.6)" />
            )}
          </g>
        );
      })}
      <circle cx="0" cy="0" r="4" fill="#3a2a10" stroke="#7a5a20" strokeWidth="1.5" />
    </svg>
  );
}

// ─── Revolver SVG ─────────────────────────────────────────────────────────────
function RevolverSVG({ shaking, banged }: { shaking: boolean; banged: boolean }) {
  return (
    <svg
      viewBox="0 0 220 120"
      width="180"
      height="100"
      className={cn(shaking && 'rr-gun-shake')}
      style={{
        filter: banged
          ? 'drop-shadow(0 0 20px rgba(255,80,0,0.9)) drop-shadow(0 0 40px rgba(255,200,0,0.6))'
          : 'drop-shadow(0 2px 8px rgba(0,0,0,0.8)) drop-shadow(0 0 4px rgba(200,160,50,0.2))',
        transition: 'filter 0.3s',
      }}
    >
      {/* Barrel */}
      <rect x="80" y="42" width="120" height="16" rx="3" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
      <rect x="80" y="43" width="118" height="5" rx="2" fill="#3a3a3a" />
      <rect x="190" y="40" width="12" height="20" rx="2" fill="#222" stroke="#444" strokeWidth="1" />

      {/* Frame / Body */}
      <path d="M80 42 Q70 42 65 50 L60 80 Q58 88 70 90 L110 90 Q118 90 120 80 L120 58 L80 58 Z"
        fill="#252525" stroke="#4a4a4a" strokeWidth="1" />
      <path d="M80 43 Q72 43 68 50 L64 80 Q62 87 72 88"
        fill="none" stroke="#3a3a3a" strokeWidth="2" />

      {/* Cylinder */}
      <ellipse cx="95" cy="56" rx="18" ry="14" fill="#1e1e1e" stroke="#555" strokeWidth="2" />
      <ellipse cx="95" cy="56" rx="14" ry="10" fill="#161616" stroke="#3a3a3a" strokeWidth="1" />
      {[0,1,2,3,4,5].map((i) => {
        const a = (i / 6) * 2 * Math.PI;
        const cx2 = 95 + Math.cos(a) * 9;
        const cy2 = 56 + Math.sin(a) * 7;
        return <circle key={i} cx={cx2} cy={cy2} r="2.5" fill="#0a0a0a" stroke="#2a2a2a" strokeWidth="0.5" />;
      })}

      {/* Hammer */}
      <rect x="62" y="36" width="12" height="8" rx="2" fill="#1e1e1e" stroke="#444" strokeWidth="1" />
      <rect x="64" y="32" width="5" height="8" rx="1.5" fill="#252525" stroke="#3a3a3a" strokeWidth="1" />

      {/* Trigger guard */}
      <path d="M72 62 Q68 75 75 80 L85 80 Q88 75 88 68"
        fill="none" stroke="#444" strokeWidth="4" strokeLinecap="round" />
      {/* Trigger */}
      <line x1="80" y1="62" x2="78" y2="72" stroke="#888" strokeWidth="2.5" strokeLinecap="round" />

      {/* Grip */}
      <path d="M68 88 Q60 92 55 105 Q52 112 62 114 L80 114 Q90 112 92 102 L92 88 Z"
        fill="#1a1008" stroke="#3a2010" strokeWidth="1.5" />
      {/* Grip texture lines */}
      {[0,1,2,3,4].map((i) => (
        <line key={i} x1={58 + i * 4} y1="95" x2={56 + i * 4} y2="108"
          stroke="#3a2a18" strokeWidth="1" />
      ))}
      {/* Grip panel screw */}
      <circle cx="72" cy="100" r="2.5" fill="#0f0a04" stroke="#4a3020" strokeWidth="1" />

      {/* Muzzle flash (only when banged) */}
      {banged && (
        <g>
          <polygon points="200,50 220,45 210,40 220,35 202,38" fill="#ff8c00" opacity="0.9" />
          <polygon points="200,50 222,50 215,55 220,58 202,55" fill="#ffcc00" opacity="0.8" />
        </g>
      )}
    </svg>
  );
}

// ─── Player seat card ─────────────────────────────────────────────────────────
function PlayerSeat({
  player,
  isMe,
  isCurrent,
  isEliminated,
  turnProgress,
}: {
  player: RRPlayerState;
  isMe: boolean;
  isCurrent: boolean;
  isEliminated: boolean;
  turnProgress: number;
}) {
  const r = 26, strokeW = 3, c = 2 * Math.PI * r;
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        minWidth: 72,
      }}
    >
      {/* Timer ring */}
      {isCurrent && player.isAlive && (
        <svg
          width={(r + strokeW) * 2 + 4}
          height={(r + strokeW) * 2 + 4}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -54%) rotate(-90deg)',
            pointerEvents: 'none',
          }}
        >
          <circle
            cx={r + strokeW + 2}
            cy={r + strokeW + 2}
            r={r}
            fill="none"
            stroke="rgba(220,60,60,0.15)"
            strokeWidth={strokeW}
          />
          <circle
            cx={r + strokeW + 2}
            cy={r + strokeW + 2}
            r={r}
            fill="none"
            stroke="rgba(220,60,60,0.85)"
            strokeWidth={strokeW}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - turnProgress / 100)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.12s linear' }}
          />
        </svg>
      )}

      {/* Avatar circle */}
      <div
        className={cn(
          isCurrent && player.isAlive && 'rr-seat-pulse',
        )}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: isEliminated
            ? 'radial-gradient(circle, #1a0000 0%, #0a0000 100%)'
            : isCurrent
            ? 'radial-gradient(circle, #3a1a1a 0%, #1a0a0a 100%)'
            : 'radial-gradient(circle, #1a1210 0%, #0d0a08 100%)',
          border: isEliminated
            ? '2px solid #3a0000'
            : isCurrent
            ? '2px solid rgba(220,60,60,0.8)'
            : isMe
            ? '2px solid rgba(200,150,50,0.6)'
            : '2px solid rgba(100,80,50,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          boxShadow: isCurrent && player.isAlive
            ? '0 0 14px rgba(220,60,60,0.5), 0 2px 8px rgba(0,0,0,0.7)'
            : '0 2px 8px rgba(0,0,0,0.7)',
          transition: 'all 0.3s',
          flexShrink: 0,
        }}
      >
        {isEliminated ? (
          <Skull
            size={24}
            style={{
              color: player.passedOut ? '#888' : '#cc2222',
              filter: player.passedOut ? 'none' : 'drop-shadow(0 0 4px rgba(200,0,0,0.7))',
            }}
          />
        ) : (
          <span style={{ fontSize: 18, lineHeight: 1 }}>
            {player.username.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Name */}
      <div
        style={{
          maxWidth: 80,
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        <UsernameDisplay
          username={player.username}
          usernameColor={player.usernameColor}
          usernameClassName={`text-[10px] ${isMe ? 'font-bold' : 'font-semibold'} ${isEliminated ? 'opacity-35' : ''} truncate`}
        />
        {isEliminated && (
          <div style={{ fontSize: 9, color: player.passedOut ? '#666' : '#882222', fontWeight: 600, marginTop: 1 }}>
            {player.passedOut ? 'PASSÉ' : 'ÉLIMINÉ'}
          </div>
        )}
        {!isEliminated && (
          <div style={{ fontSize: 9, color: 'rgba(180,140,80,0.7)', marginTop: 1 }}>
            {player.pullCount > 0 ? `${player.pullCount} pull${player.pullCount > 1 ? 's' : ''}` : '—'}
          </div>
        )}
      </div>

      {isMe && (
        <div
          style={{
            position: 'absolute',
            top: -6,
            right: -8,
            background: 'rgba(200,150,50,0.9)',
            borderRadius: 4,
            padding: '1px 4px',
            fontSize: 8,
            fontWeight: 800,
            color: '#000',
            letterSpacing: 0.5,
          }}
        >
          TOI
        </div>
      )}
    </div>
  );
}

// ─── Table view ───────────────────────────────────────────────────────────────
function RouletteTable({
  game,
  myUserId,
  turnProgress,
  bangEffect,
  spinCylinder,
}: {
  game: RRGameState;
  myUserId: string;
  turnProgress: number;
  bangEffect: boolean;
  spinCylinder: boolean;
}) {
  const myIdx = game.players.findIndex((p) => p.userId === myUserId);
  const ordered = myIdx <= 0
    ? [...game.players]
    : [...game.players.slice(myIdx), ...game.players.slice(0, myIdx)];

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '56%', userSelect: 'none', minHeight: 280 }}>
      {/* Candle ambient glow */}
      <div
        className="rr-candle-flicker"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60%',
          height: '60%',
          background: 'radial-gradient(ellipse, rgba(140,80,20,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Outer wood rail */}
      <div
        style={{
          position: 'absolute',
          left: '6%', top: '7%', width: '88%', height: '86%',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #4a2808 0%, #2a1504 60%, #1a0d02 100%)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.85), inset 0 2px 4px rgba(255,200,100,0.08)',
        }}
      />
      {/* Inner wood rail */}
      <div
        style={{
          position: 'absolute',
          left: '7.5%', top: '9%', width: '85%', height: '82%',
          borderRadius: '50%',
          background: '#1e0e04',
        }}
      />
      {/* Felt surface */}
      <div
        style={{
          position: 'absolute',
          left: '10%', top: '12%', width: '80%', height: '76%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 40% 35%, #0d1f14 0%, #081510 55%, #040d08 100%)',
          boxShadow: 'inset 0 0 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Bang flash overlay */}
        {bangEffect && (
          <div
            className="rr-bang-flash"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,80,0,0.9) 0%, rgba(200,0,0,0.6) 60%, transparent 100%)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        )}

        {/* Center content: gun + cylinder */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <RevolverSVG shaking={game.lastEvent?.type === 'click'} banged={bangEffect} />
          <CylinderDisplay position={game.cylinderPosition} spinning={spinCylinder} />
          <div style={{ fontSize: 10, color: 'rgba(180,140,60,0.6)', letterSpacing: 1 }}>
            ROUND {game.round} · {game.alivePlayers}/{game.totalPlayers} EN VIE
          </div>

          {/* Last event */}
          {game.lastEvent && (
            <div
              className="rr-event-fade"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: game.lastEvent.type === 'bang'
                  ? '#ff4444'
                  : game.lastEvent.type === 'pass'
                  ? '#999'
                  : '#88cc88',
                textShadow: game.lastEvent.type === 'bang'
                  ? '0 0 10px rgba(255,0,0,0.8)'
                  : '0 1px 4px rgba(0,0,0,0.9)',
                letterSpacing: 1,
                textAlign: 'center',
              }}
            >
              {game.lastEvent.type === 'bang'
                ? `💥 ${game.lastEvent.username} — BANG!`
                : game.lastEvent.type === 'pass'
                ? `🐔 ${game.lastEvent.username} a passé`
                : `🔘 ${game.lastEvent.username} — click…`}
            </div>
          )}
        </div>
      </div>

      {/* Player seats positioned around table */}
      {ordered.map((player, si) => {
        const pos = seatPos(si, ordered.length);
        const isMe = player.userId === myUserId;
        const isCurrent = player.userId === game.currentPlayerId;
        const isEliminated = !player.isAlive;
        return (
          <div
            key={player.userId}
            style={{
              position: 'absolute',
              left: pos.left,
              top: pos.top,
              transform: 'translate(-50%, -50%)',
              zIndex: isCurrent ? 5 : 2,
            }}
          >
            <PlayerSeat
              player={player}
              isMe={isMe}
              isCurrent={isCurrent}
              isEliminated={isEliminated}
              turnProgress={isCurrent ? turnProgress : 0}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RussianRoulette() {
  const { user } = useAuth();
  const { socket, currentParty, partyMembers } = useSocket();

  const [game, setGame] = useState<RRGameState | null>(null);
  const [joinPrompt, setJoinPrompt] = useState<JoinPrompt | null>(null);
  const [gameOver, setGameOver] = useState<GameOver | null>(null);
  const [playAgainPrompt, setPlayAgainPrompt] = useState<PlayAgainPrompt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bangEffect, setBangEffect] = useState(false);
  const [spinCylinder, setSpinCylinder] = useState(false);
  const [turnProgress, setTurnProgress] = useState(100);
  const [playAgainResponded, setPlayAgainResponded] = useState(false);

  const animFrameRef = useRef<number | null>(null);
  const prevEventRef = useRef<string | null>(null);

  const myUserId = user?.id ?? '';
  const isLeader = partyMembers.find((m) => m.userId === myUserId)?.isLeader ?? false;
  const partyId = currentParty?.id ?? '';
  const isInGame = !!game?.players.find((p) => p.userId === myUserId);
  const myPlayer = game?.players.find((p) => p.userId === myUserId);
  const isMyTurn = game?.currentPlayerId === myUserId && myPlayer?.isAlive;

  // ── Turn progress ring ──
  useEffect(() => {
    if (!game?.isActive || !game.currentPlayerId) return;
    const tick = () => {
      const now = Date.now();
      const elapsed = now - (game.turnEndsAt - 20000);
      const progress = Math.max(0, 100 - (elapsed / 20000) * 100);
      setTurnProgress(progress);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [game?.currentPlayerId, game?.turnEndsAt, game?.isActive]);

  // ── Bang / click animations ──
  useEffect(() => {
    if (!game?.lastEvent) return;
    const eventKey = `${game.lastEvent.type}-${game.lastEvent.playerId}-${game.round}`;
    if (eventKey === prevEventRef.current) return;
    prevEventRef.current = eventKey;

    if (game.lastEvent.type === 'bang') {
      setBangEffect(true);
      setTimeout(() => setBangEffect(false), 1200);
    } else if (game.lastEvent.type === 'click') {
      setSpinCylinder(true);
      setTimeout(() => setSpinCylinder(false), 700);
    }
  }, [game?.lastEvent, game?.round]);

  // ── Cylinder spin when game starts / reloads ──
  useEffect(() => {
    if (game?.round && game.round > 1) {
      setSpinCylinder(true);
      setTimeout(() => setSpinCylinder(false), 900);
    }
  }, [game?.round]);

  // ── Socket setup ──
  useEffect(() => {
    if (!socket) return;

    socket.emit('roulette:register');

    socket.on('roulette:state', (data: RRGameState) => {
      setGame(data);
    });

    socket.on('roulette:join-prompt', (data: JoinPrompt) => {
      setJoinPrompt(data);
      setGameOver(null);
      setPlayAgainPrompt(null);
    });

    socket.on('roulette:join-response-update', (data: { partyId: string; responses: Array<{ userId: string; accepted: boolean }> }) => {
      setJoinPrompt((prev) => prev ? { ...prev, responses: data.responses } : prev);
    });

    socket.on('roulette:join-cancelled', (data: { reason: string }) => {
      setJoinPrompt(null);
      setError(data.reason);
      setTimeout(() => setError(null), 4000);
    });

    socket.on('roulette:bang', () => {
      setBangEffect(true);
      setTimeout(() => setBangEffect(false), 1400);
    });

    socket.on('roulette:game-over', (data: GameOver) => {
      setGame(null);
      setGameOver(data);
      setPlayAgainPrompt(null);
    });

    socket.on('roulette:play-again-prompt', (data: PlayAgainPrompt) => {
      setPlayAgainPrompt(data);
      setPlayAgainResponded(false);
    });

    socket.on('roulette:play-again-response-update', (data: { partyId: string; responses: Array<{ userId: string; playAgain: boolean }>; playAgainCount: number }) => {
      setPlayAgainPrompt((prev) => prev ? { ...prev, responses: data.responses, playAgainCount: data.playAgainCount } : prev);
    });

    socket.on('roulette:play-again-cancelled', () => {
      setPlayAgainPrompt(null);
      setGameOver(null);
    });

    socket.on('roulette:error', (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(null), 4000);
    });

    return () => {
      socket.off('roulette:state');
      socket.off('roulette:join-prompt');
      socket.off('roulette:join-response-update');
      socket.off('roulette:join-cancelled');
      socket.off('roulette:bang');
      socket.off('roulette:game-over');
      socket.off('roulette:play-again-prompt');
      socket.off('roulette:play-again-response-update');
      socket.off('roulette:play-again-cancelled');
      socket.off('roulette:error');
    };
  }, [socket]);

  const startGame = useCallback(() => {
    if (!socket || !partyId) return;
    socket.emit('roulette:start', { partyId });
  }, [socket, partyId]);

  const respondToJoin = useCallback((accepted: boolean) => {
    if (!socket || !joinPrompt) return;
    socket.emit('roulette:join-response', { partyId: joinPrompt.partyId, accepted });
    setJoinPrompt(null);
  }, [socket, joinPrompt]);

  const pullTrigger = useCallback(() => {
    if (!socket || !game || !isMyTurn) return;
    socket.emit('roulette:pull', { partyId: game.partyId });
  }, [socket, game, isMyTurn]);

  const passOut = useCallback(() => {
    if (!socket || !game || !isMyTurn) return;
    socket.emit('roulette:pass', { partyId: game.partyId });
  }, [socket, game, isMyTurn]);

  const respondToPlayAgain = useCallback((playAgain: boolean) => {
    if (!socket || !playAgainPrompt) return;
    socket.emit('roulette:play-again-response', { partyId: playAgainPrompt.partyId, playAgain });
    setPlayAgainResponded(true);
  }, [socket, playAgainPrompt]);

  // ─── No party ────────────────────────────────────────────────────────────
  if (!currentParty) {
    return (
      <PageShell>
        <PageHeader
          title="Russian Roulette"
          description="Rejoins ou crée une party pour jouer."
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: '60px 0',
            color: 'rgba(180,140,80,0.7)',
          }}
        >
          <Users size={48} style={{ opacity: 0.4 }} />
          <p style={{ fontSize: 14, textAlign: 'center', maxWidth: 300 }}>
            Tu dois être dans une party pour jouer à Russian Roulette.
          </p>
          <Button variant="outline" asChild>
            <Link to="/party">Rejoindre une party</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <>
      {/* Global animations */}
      <style>{`
        @keyframes rr-cylinder-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(1080deg); }
        }
        .rr-cylinder-spin {
          animation: rr-cylinder-spin 0.7s cubic-bezier(0.2, 0, 0.3, 1) forwards;
        }
        @keyframes rr-gun-shake {
          0%   { transform: translate(0, 0) rotate(0deg); }
          10%  { transform: translate(-3px, -2px) rotate(-2deg); }
          20%  { transform: translate(3px, 2px) rotate(2deg); }
          30%  { transform: translate(-4px, 1px) rotate(-1deg); }
          40%  { transform: translate(4px, -1px) rotate(1deg); }
          50%  { transform: translate(-2px, 2px) rotate(-1deg); }
          60%  { transform: translate(2px, -2px) rotate(1deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        .rr-gun-shake {
          animation: rr-gun-shake 0.35s ease-out forwards;
        }
        @keyframes rr-bang-flash {
          0%   { opacity: 1; }
          40%  { opacity: 0.85; }
          100% { opacity: 0; }
        }
        .rr-bang-flash {
          animation: rr-bang-flash 1.2s ease-out forwards;
        }
        @keyframes rr-seat-pulse {
          0%, 100% { box-shadow: 0 0 14px rgba(220,60,60,0.5), 0 2px 8px rgba(0,0,0,0.7); }
          50%       { box-shadow: 0 0 28px rgba(220,60,60,0.8), 0 4px 16px rgba(0,0,0,0.7); }
        }
        .rr-seat-pulse {
          animation: rr-seat-pulse 1.5s ease-in-out infinite;
        }
        @keyframes rr-event-fade {
          0%   { opacity: 0; transform: translateY(4px); }
          15%  { opacity: 1; transform: translateY(0); }
          70%  { opacity: 1; }
          100% { opacity: 0.6; }
        }
        .rr-event-fade {
          animation: rr-event-fade 2s ease forwards;
        }
        @keyframes rr-candle-flicker {
          0%, 100% { opacity: 1; }
          33%       { opacity: 0.85; }
          66%       { opacity: 0.95; }
        }
        .rr-candle-flicker {
          animation: rr-candle-flicker 3s ease-in-out infinite;
        }
        @keyframes rr-slide-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rr-slide-in {
          animation: rr-slide-in 0.35s ease forwards;
        }
      `}</style>

      <PageShell>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/games"><ArrowLeft size={18} /></Link>
          </Button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.5, color: 'rgba(220,140,60,0.95)' }}>
              Russian Roulette
            </h1>
            <p style={{ fontSize: 11, color: 'rgba(150,120,80,0.7)', marginTop: 1 }}>
              Qui ose tirer le dernier ?
            </p>
          </div>
        </div>

        {error && (
          <div
            className="rr-slide-in"
            style={{
              background: 'rgba(150,20,20,0.15)',
              border: '1px solid rgba(200,50,50,0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#cc4444',
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* ── Join prompt ─────────────────────────────────────────────────── */}
        {joinPrompt && !game && (
          <div className="rr-slide-in" style={{ marginBottom: 16 }}>
            <div
              style={{
                background: 'rgba(30,15,5,0.85)',
                border: '1px solid rgba(180,100,30,0.35)',
                borderRadius: 12,
                padding: '20px 24px',
              }}
            >
              <h3 style={{ fontWeight: 700, fontSize: 15, color: 'rgba(220,160,60,0.95)', marginBottom: 8 }}>
                Partie de Russian Roulette
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(180,140,80,0.75)', marginBottom: 16 }}>
                {partyMembers.find((m) => m.userId === joinPrompt.leaderId)?.username ?? 'Le leader'} lance une partie. Tu rejoins ?
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {joinPrompt.members.map((m) => {
                  const resp = joinPrompt.responses.find((r) => r.userId === m.userId);
                  return (
                    <div
                      key={m.userId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(20,10,5,0.6)',
                        borderRadius: 8,
                        padding: '5px 10px',
                        border: `1px solid ${resp?.accepted ? 'rgba(80,180,80,0.4)' : resp?.accepted === false ? 'rgba(180,60,60,0.4)' : 'rgba(80,60,30,0.3)'}`,
                        fontSize: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: resp?.accepted ? '#4c8' : resp?.accepted === false ? '#c44' : '#888',
                        }}
                      />
                      <UsernameDisplay username={m.username} usernameColor={m.usernameColor} usernameClassName="text-xs" />
                    </div>
                  );
                })}
              </div>
              {joinPrompt.leaderId !== myUserId && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    onClick={() => respondToJoin(true)}
                    style={{
                      background: 'rgba(180,30,30,0.85)',
                      border: '1px solid rgba(220,60,60,0.5)',
                      color: '#fff',
                      fontWeight: 700,
                    }}
                  >
                    Je joue
                  </Button>
                  <Button variant="outline" onClick={() => respondToJoin(false)}>
                    Refuser
                  </Button>
                </div>
              )}
              {joinPrompt.leaderId === myUserId && (
                <p style={{ fontSize: 12, color: 'rgba(180,140,80,0.6)' }}>
                  En attente des réponses…
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Active game ──────────────────────────────────────────────────── */}
        {game && isInGame && (
          <div className="rr-slide-in">
            {/* Table */}
            <div
              style={{
                background: 'radial-gradient(ellipse at 50% 40%, #0e0904 0%, #060402 100%)',
                border: '1px solid rgba(100,60,20,0.3)',
                borderRadius: 16,
                padding: '8px 4px 12px',
                marginBottom: 12,
              }}
            >
              <RouletteTable
                game={game}
                myUserId={myUserId}
                turnProgress={turnProgress}
                bangEffect={bangEffect}
                spinCylinder={spinCylinder}
              />
            </div>

            {/* Action bar */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'center',
                alignItems: 'center',
                padding: '12px 0',
              }}
            >
              {isMyTurn ? (
                <>
                  <button
                    onClick={pullTrigger}
                    className="rr-seat-pulse"
                    style={{
                      background: 'linear-gradient(135deg, #8a0000 0%, #5a0000 100%)',
                      border: '2px solid rgba(220,60,60,0.7)',
                      borderRadius: 10,
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 15,
                      letterSpacing: 1,
                      padding: '12px 32px',
                      cursor: 'pointer',
                      boxShadow: '0 0 20px rgba(180,0,0,0.5), 0 4px 12px rgba(0,0,0,0.6)',
                      transition: 'transform 0.1s, box-shadow 0.1s',
                      textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
                    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    🔫 Tirer
                  </button>
                  <button
                    onClick={passOut}
                    style={{
                      background: 'rgba(30,20,10,0.7)',
                      border: '1px solid rgba(100,80,50,0.4)',
                      borderRadius: 10,
                      color: 'rgba(160,130,80,0.8)',
                      fontWeight: 600,
                      fontSize: 13,
                      padding: '10px 22px',
                      cursor: 'pointer',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    🐔 Passer
                  </button>
                </>
              ) : myPlayer && !myPlayer.isAlive ? (
                <div style={{ fontSize: 13, color: 'rgba(120,80,80,0.8)', fontStyle: 'italic' }}>
                  {myPlayer.passedOut ? 'Tu as passé. Regarde les autres...' : 'Tu es éliminé. Regarde les survivants...'}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(150,120,70,0.7)', fontSize: 13 }}>
                  <div
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: '#882222',
                      boxShadow: '0 0 6px rgba(200,0,0,0.6)',
                      animation: 'rr-seat-pulse 1.2s ease-in-out infinite',
                    }}
                  />
                  {game.players.find((p) => p.userId === game.currentPlayerId)?.username ?? '...'} réfléchit…
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Game over ────────────────────────────────────────────────────── */}
        {gameOver && !game && (
          <div
            className="rr-slide-in"
            style={{
              background: 'rgba(15,8,4,0.9)',
              border: '1px solid rgba(180,100,30,0.3)',
              borderRadius: 14,
              padding: '24px',
              marginBottom: 16,
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'rgba(220,160,50,0.95)', marginBottom: 4 }}>
                {gameOver.winnerUsername
                  ? `${gameOver.winnerUsername} a survécu !`
                  : 'Tout le monde est éliminé'}
              </h2>
              <p style={{ fontSize: 12, color: 'rgba(150,120,70,0.7)' }}>La table est silencieuse.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {gameOver.standings.map((p) => (
                <div
                  key={p.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    background: p.isAlive ? 'rgba(30,20,5,0.8)' : 'rgba(10,5,5,0.6)',
                    borderRadius: 8,
                    border: `1px solid ${p.isAlive ? 'rgba(180,140,40,0.3)' : 'rgba(80,30,30,0.2)'}`,
                    opacity: p.isAlive ? 1 : 0.6,
                  }}
                >
                  <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>
                    {p.isAlive ? '🏆' : p.passedOut ? '🐔' : '💀'}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: p.isAlive ? 'rgba(220,180,80,0.95)' : 'rgba(140,100,80,0.7)' }}>
                    {p.username}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(130,100,60,0.7)' }}>
                    {p.isAlive ? 'SURVIT' : p.passedOut ? 'passé' : `${p.pullCount} pull${p.pullCount !== 1 ? 's' : ''}`}
                  </span>
                </div>
              ))}
            </div>

            {/* Play again */}
            {playAgainPrompt && !playAgainResponded && (
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'rgba(180,140,80,0.75)', marginBottom: 10 }}>
                  Rejouer ? ({playAgainPrompt.responses.filter((r) => r.playAgain).length} prêts)
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <Button
                    onClick={() => respondToPlayAgain(true)}
                    style={{
                      background: 'rgba(100,20,20,0.8)',
                      border: '1px solid rgba(180,50,50,0.5)',
                      color: '#fff',
                    }}
                  >
                    Rejouer
                  </Button>
                  <Button variant="outline" onClick={() => respondToPlayAgain(false)}>
                    Quitter
                  </Button>
                </div>
              </div>
            )}
            {playAgainResponded && (
              <p style={{ fontSize: 12, color: 'rgba(150,120,70,0.6)', textAlign: 'center', marginTop: 16 }}>
                En attente des autres joueurs…
              </p>
            )}
          </div>
        )}

        {/* ── Lobby (waiting to start) ─────────────────────────────────────── */}
        {!game && !joinPrompt && !gameOver && (
          <div
            className="rr-slide-in"
            style={{
              background: 'rgba(12,7,3,0.85)',
              border: '1px solid rgba(100,60,20,0.3)',
              borderRadius: 14,
              padding: '28px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔫</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(200,150,60,0.9)', marginBottom: 8 }}>
              Russian Roulette
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(150,120,70,0.7)', maxWidth: 320, margin: '0 auto 20px', lineHeight: 1.6 }}>
              2 à 6 joueurs s'assoient autour de la table. À tour de rôle, chacun tire — ou passe.
              Le dernier en vie gagne.
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 20,
              }}
            >
              {partyMembers.map((m) => (
                <div
                  key={m.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(20,12,5,0.7)',
                    borderRadius: 8,
                    padding: '5px 10px',
                    border: '1px solid rgba(80,55,25,0.35)',
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: m.isLeader ? '#d4a020' : 'rgba(120,90,50,0.6)',
                    }}
                  />
                  <UsernameDisplay username={m.username} usernameColor={m.usernameColor} usernameClassName="text-xs" />
                  {m.isLeader && (
                    <span style={{ fontSize: 9, color: 'rgba(180,140,50,0.7)', fontWeight: 600 }}>LEADER</span>
                  )}
                </div>
              ))}
            </div>
            {isLeader ? (
              <button
                onClick={startGame}
                style={{
                  background: 'linear-gradient(135deg, #7a1a00 0%, #4a0a00 100%)',
                  border: '2px solid rgba(180,50,30,0.6)',
                  borderRadius: 10,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: 0.5,
                  padding: '11px 28px',
                  cursor: 'pointer',
                  boxShadow: '0 0 16px rgba(150,20,0,0.4), 0 4px 10px rgba(0,0,0,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  margin: '0 auto',
                }}
              >
                <Play size={15} />
                Lancer la partie
              </button>
            ) : (
              <p style={{ fontSize: 12, color: 'rgba(140,110,60,0.6)', fontStyle: 'italic' }}>
                En attente du leader pour lancer…
              </p>
            )}
          </div>
        )}
      </PageShell>
    </>
  );
}

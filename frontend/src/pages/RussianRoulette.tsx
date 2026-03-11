import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { ArrowLeft, Play, Skull, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function seatPos(seatIndex: number, total: number) {
  const cx = 50, cy = 50, rx = 41, ry = 34;
  const deg = -90 - seatIndex * (360 / total);
  const rad = (deg * Math.PI) / 180;
  return { left: `${cx + rx * Math.cos(rad)}%`, top: `${cy + ry * Math.sin(rad)}%` };
}

function seatAngleDeg(seatIndex: number, total: number) {
  return -90 - seatIndex * (360 / total);
}

// ─── Cylinder SVG ─────────────────────────────────────────────────────────────
function CylinderDisplay({ position, spinning }: { position: number; spinning: boolean }) {
  return (
    <svg
      width="56"
      height="56"
      viewBox="-28 -28 56 56"
      className={spinning ? 'rr-cylinder-spin' : ''}
      style={{ filter: 'drop-shadow(0 0 6px rgba(255,200,50,0.3))' }}
    >
      <circle cx="0" cy="0" r="25" fill="#1a1008" stroke="#7a5a20" strokeWidth="2.5" />
      <circle cx="0" cy="0" r="21" fill="#0f0a04" stroke="#5a3a10" strokeWidth="1" />
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * 2 * Math.PI - Math.PI / 2;
        const cx2 = Math.cos(angle) * 12;
        const cy2 = Math.sin(angle) * 12;
        const isCurrent = i === position;
        return (
          <g key={i}>
            <circle cx={cx2} cy={cy2} r="5" fill={isCurrent ? '#2a1a0a' : '#0a0804'} stroke={isCurrent ? '#d4a020' : '#3a2a10'} strokeWidth={isCurrent ? 1.5 : 1} />
            {isCurrent && <circle cx={cx2} cy={cy2} r="2.5" fill="rgba(255,180,0,0.55)" />}
          </g>
        );
      })}
      <circle cx="0" cy="0" r="3.5" fill="#3a2a10" stroke="#7a5a20" strokeWidth="1.5" />
    </svg>
  );
}

// ─── Revolver SVG (barrel points right at 0°) ─────────────────────────────────
function RevolverSVG({ shaking, banged }: { shaking: boolean; banged: boolean }) {
  return (
    <svg
      viewBox="0 0 220 120"
      width="170"
      height="92"
      className={cn(shaking && 'rr-gun-shake')}
      style={{
        filter: banged
          ? 'drop-shadow(0 0 18px rgba(255,80,0,0.9)) drop-shadow(0 0 36px rgba(255,200,0,0.6))'
          : 'drop-shadow(0 2px 8px rgba(0,0,0,0.8)) drop-shadow(0 0 4px rgba(200,160,50,0.15))',
        transition: 'filter 0.3s',
      }}
    >
      <rect x="80" y="42" width="120" height="16" rx="3" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
      <rect x="80" y="43" width="118" height="5" rx="2" fill="#3a3a3a" />
      <rect x="190" y="40" width="12" height="20" rx="2" fill="#222" stroke="#444" strokeWidth="1" />
      <path d="M80 42 Q70 42 65 50 L60 80 Q58 88 70 90 L110 90 Q118 90 120 80 L120 58 L80 58 Z" fill="#252525" stroke="#4a4a4a" strokeWidth="1" />
      <path d="M80 43 Q72 43 68 50 L64 80 Q62 87 72 88" fill="none" stroke="#3a3a3a" strokeWidth="2" />
      <ellipse cx="95" cy="56" rx="18" ry="14" fill="#1e1e1e" stroke="#555" strokeWidth="2" />
      <ellipse cx="95" cy="56" rx="14" ry="10" fill="#161616" stroke="#3a3a3a" strokeWidth="1" />
      {[0,1,2,3,4,5].map((i) => {
        const a = (i / 6) * 2 * Math.PI;
        return <circle key={i} cx={95 + Math.cos(a) * 9} cy={56 + Math.sin(a) * 7} r="2.5" fill="#0a0a0a" stroke="#2a2a2a" strokeWidth="0.5" />;
      })}
      <rect x="62" y="36" width="12" height="8" rx="2" fill="#1e1e1e" stroke="#444" strokeWidth="1" />
      <rect x="64" y="32" width="5" height="8" rx="1.5" fill="#252525" stroke="#3a3a3a" strokeWidth="1" />
      <path d="M72 62 Q68 75 75 80 L85 80 Q88 75 88 68" fill="none" stroke="#444" strokeWidth="4" strokeLinecap="round" />
      <line x1="80" y1="62" x2="78" y2="72" stroke="#888" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M68 88 Q60 92 55 105 Q52 112 62 114 L80 114 Q90 112 92 102 L92 88 Z" fill="#1a1008" stroke="#3a2010" strokeWidth="1.5" />
      {[0,1,2,3,4].map((i) => (
        <line key={i} x1={58 + i * 4} y1="95" x2={56 + i * 4} y2="108" stroke="#3a2a18" strokeWidth="1" />
      ))}
      <circle cx="72" cy="100" r="2.5" fill="#0f0a04" stroke="#4a3020" strokeWidth="1" />
      {banged && (
        <g>
          <polygon points="200,50 222,44 212,39 222,34 203,37" fill="#ff8c00" opacity="0.9" />
          <polygon points="200,50 224,50 216,55 221,58 203,55" fill="#ffcc00" opacity="0.8" />
        </g>
      )}
    </svg>
  );
}

// ─── Player seat ──────────────────────────────────────────────────────────────
function PlayerSeat({
  player,
  isMe,
  isCurrent,
  isEliminated,
  turnProgress,
  justDied,
}: {
  player: { userId: string; username: string; usernameColor?: string | null; isAlive: boolean; pullCount: number; passedOut: boolean };
  isMe: boolean;
  isCurrent: boolean;
  isEliminated: boolean;
  turnProgress: number;
  justDied: boolean;
}) {
  const r = 26, strokeW = 3, c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 72 }}>
      {isCurrent && player.isAlive && (
        <svg
          width={(r + strokeW) * 2 + 4}
          height={(r + strokeW) * 2 + 4}
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -54%) rotate(-90deg)', pointerEvents: 'none' }}
        >
          <circle cx={r + strokeW + 2} cy={r + strokeW + 2} r={r} fill="none" stroke="rgba(220,60,60,0.15)" strokeWidth={strokeW} />
          <circle
            cx={r + strokeW + 2} cy={r + strokeW + 2} r={r}
            fill="none" stroke="rgba(220,60,60,0.85)" strokeWidth={strokeW}
            strokeDasharray={c} strokeDashoffset={c * (1 - turnProgress / 100)}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.12s linear' }}
          />
        </svg>
      )}

      <div
        className={cn(isCurrent && player.isAlive && 'rr-seat-pulse')}
        style={{
          width: 48, height: 48, borderRadius: '50%',
          background: isEliminated ? 'radial-gradient(circle, #1a0000 0%, #0a0000 100%)' : isCurrent ? 'radial-gradient(circle, #3a1a1a 0%, #1a0a0a 100%)' : 'radial-gradient(circle, #1a1210 0%, #0d0a08 100%)',
          border: isEliminated ? '2px solid #3a0000' : isCurrent ? '2px solid rgba(220,60,60,0.8)' : isMe ? '2px solid rgba(200,150,50,0.6)' : '2px solid rgba(100,80,50,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          boxShadow: isCurrent && player.isAlive ? '0 0 14px rgba(220,60,60,0.5), 0 2px 8px rgba(0,0,0,0.7)' : '0 2px 8px rgba(0,0,0,0.7)',
          transition: 'all 0.3s', flexShrink: 0,
        }}
      >
        {isEliminated ? (
          <Skull size={24} style={{ color: player.passedOut ? '#888' : '#cc2222', filter: player.passedOut ? 'none' : 'drop-shadow(0 0 4px rgba(200,0,0,0.7))' }} />
        ) : (
          <span style={{ fontSize: 18, lineHeight: 1 }}>{player.username.charAt(0).toUpperCase()}</span>
        )}
      </div>

      <div style={{ maxWidth: 80, textAlign: 'center', overflow: 'hidden' }}>
        <UsernameDisplay
          username={player.username}
          usernameColor={player.usernameColor}
          usernameClassName={`text-[10px] ${isMe ? 'font-bold' : 'font-semibold'} ${isEliminated ? 'opacity-35' : ''} truncate${justDied ? ' rr-name-erase' : ''}`}
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
        <div style={{ position: 'absolute', top: -6, right: -8, background: 'rgba(200,150,50,0.9)', borderRadius: 4, padding: '1px 4px', fontSize: 8, fontWeight: 800, color: '#000', letterSpacing: 0.5 }}>
          TOI
        </div>
      )}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
function RouletteTable({
  game,
  myUserId,
  turnProgress,
  bangEffect,
  spinCylinder,
  gunAngle,
  justDiedIds,
}: {
  game: { players: Array<{ userId: string; username: string; usernameColor?: string | null; isAlive: boolean; pullCount: number; passedOut: boolean }>; currentPlayerId: string | null; cylinderPosition: number; round: number; lastEvent: { type: 'click' | 'bang' | 'pass'; playerId: string; username: string } | null; alivePlayers: number; totalPlayers: number };
  myUserId: string;
  turnProgress: number;
  bangEffect: boolean;
  spinCylinder: boolean;
  gunAngle: number;
  justDiedIds: Set<string>;
}) {
  const myIdx = game.players.findIndex((p) => p.userId === myUserId);
  const ordered = myIdx <= 0 ? [...game.players] : [...game.players.slice(myIdx), ...game.players.slice(0, myIdx)];

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '56%', userSelect: 'none', minHeight: 280 }}>
      <div className="rr-candle-flicker" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '60%', height: '60%', background: 'radial-gradient(ellipse, rgba(140,80,20,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Table wood */}
      <div style={{ position: 'absolute', left: '6%', top: '7%', width: '88%', height: '86%', borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #4a2808 0%, #2a1504 60%, #1a0d02 100%)', boxShadow: '0 8px 40px rgba(0,0,0,0.85), inset 0 2px 4px rgba(255,200,100,0.08)' }} />
      <div style={{ position: 'absolute', left: '7.5%', top: '9%', width: '85%', height: '82%', borderRadius: '50%', background: '#1e0e04' }} />

      {/* Felt */}
      <div style={{ position: 'absolute', left: '10%', top: '12%', width: '80%', height: '76%', borderRadius: '50%', background: 'radial-gradient(ellipse at 40% 35%, #0d1f14 0%, #081510 55%, #040d08 100%)', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.6)' }}>
        {bangEffect && (
          <div className="rr-bang-flash" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,80,0,0.9) 0%, rgba(200,0,0,0.6) 60%, transparent 100%)', pointerEvents: 'none', zIndex: 10 }} />
        )}

        {/* Gun + cylinder center */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          {/* Rotating gun wrapper */}
          <div style={{ transform: `rotate(${gunAngle}deg)`, transition: 'transform 0.75s cubic-bezier(0.34,1.2,0.64,1)' }}>
            <RevolverSVG shaking={game.lastEvent?.type === 'click'} banged={bangEffect} />
          </div>
          <CylinderDisplay position={game.cylinderPosition} spinning={spinCylinder} />
          <div style={{ fontSize: 10, color: 'rgba(180,140,60,0.6)', letterSpacing: 1 }}>
            ROUND {game.round} · {game.alivePlayers}/{game.totalPlayers} EN VIE
          </div>
          {game.lastEvent && (
            <div
              className="rr-event-fade"
              style={{
                fontSize: 12, fontWeight: 700, letterSpacing: 1, textAlign: 'center',
                color: game.lastEvent.type === 'bang' ? '#ff4444' : game.lastEvent.type === 'pass' ? '#999' : '#88cc88',
                textShadow: game.lastEvent.type === 'bang' ? '0 0 10px rgba(255,0,0,0.8)' : '0 1px 4px rgba(0,0,0,0.9)',
              }}
            >
              {game.lastEvent.type === 'bang' ? `💥 ${game.lastEvent.username} — BANG!` : game.lastEvent.type === 'pass' ? `🐔 ${game.lastEvent.username} a passé` : `🔘 ${game.lastEvent.username} — click…`}
            </div>
          )}
        </div>
      </div>

      {/* Player seats */}
      {ordered.map((player, si) => {
        const pos = seatPos(si, ordered.length);
        return (
          <div key={player.userId} style={{ position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)', zIndex: player.userId === game.currentPlayerId ? 5 : 2 }}>
            <PlayerSeat
              player={player}
              isMe={player.userId === myUserId}
              isCurrent={player.userId === game.currentPlayerId}
              isEliminated={!player.isAlive}
              turnProgress={player.userId === game.currentPlayerId ? turnProgress : 0}
              justDied={justDiedIds.has(player.userId)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function RussianRoulette() {
  const { user } = useAuth();
  const {
    currentParty, partyMembers,
    rouletteGame, rouletteGameOver, roulettePlayAgainPrompt,
    startRoulette, pullRouletteTrigger, passRoulette,
    respondToRoulettePlayAgainPrompt, clearRouletteGameOver,
  } = useSocket();

  const [bangEffect, setBangEffect] = useState(false);
  const [spinCylinder, setSpinCylinder] = useState(false);
  const [turnProgress, setTurnProgress] = useState(100);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [deathOverlay, setDeathOverlay] = useState<'yellow' | 'black' | null>(null);
  const [justDiedIds, setJustDiedIds] = useState<Set<string>>(new Set());
  const [playAgainResponded, setPlayAgainResponded] = useState(false);

  const animFrameRef = useRef<number | null>(null);
  const prevEventRef = useRef<string | null>(null);
  const prevCurrentPlayerRef = useRef<string | null>(null);

  const myUserId = user?.id ?? '';
  const isLeader = partyMembers.find((m) => m.userId === myUserId)?.isLeader ?? false;
  const isInGame = !!rouletteGame?.players.find((p) => p.userId === myUserId);
  const myPlayer = rouletteGame?.players.find((p) => p.userId === myUserId);
  const isMyTurn = rouletteGame?.currentPlayerId === myUserId && myPlayer?.isAlive;

  // Gun angle
  const myIdx = rouletteGame ? rouletteGame.players.findIndex((p) => p.userId === myUserId) : 0;
  const orderedPlayers = rouletteGame
    ? (myIdx <= 0 ? [...rouletteGame.players] : [...rouletteGame.players.slice(myIdx), ...rouletteGame.players.slice(0, myIdx)])
    : [];
  const currentSeatIdx = rouletteGame?.currentPlayerId
    ? orderedPlayers.findIndex((p) => p.userId === rouletteGame.currentPlayerId)
    : 0;
  const gunAngle = rouletteGame && currentSeatIdx >= 0 ? seatAngleDeg(currentSeatIdx, orderedPlayers.length) : -90;

  // Turn progress ring
  useEffect(() => {
    if (!rouletteGame?.isActive || !rouletteGame.currentPlayerId) return;
    const tick = () => {
      const elapsed = Date.now() - (rouletteGame.turnEndsAt - 20000);
      setTurnProgress(Math.max(0, 100 - (elapsed / 20000) * 100));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [rouletteGame?.currentPlayerId, rouletteGame?.turnEndsAt, rouletteGame?.isActive]);

  // Countdown when current player changes
  useEffect(() => {
    if (!rouletteGame?.currentPlayerId) return;
    if (rouletteGame.currentPlayerId === prevCurrentPlayerRef.current) return;
    prevCurrentPlayerRef.current = rouletteGame.currentPlayerId;
    setCountdown(3);
    const t1 = setTimeout(() => setCountdown(2), 1000);
    const t2 = setTimeout(() => setCountdown(1), 2000);
    const t3 = setTimeout(() => setCountdown(null), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [rouletteGame?.currentPlayerId]);

  // Bang / click animations
  useEffect(() => {
    if (!rouletteGame?.lastEvent) return;
    const eventKey = `${rouletteGame.lastEvent.type}-${rouletteGame.lastEvent.playerId}-${rouletteGame.round}`;
    if (eventKey === prevEventRef.current) return;
    prevEventRef.current = eventKey;

    if (rouletteGame.lastEvent.type === 'bang') {
      const deadId = rouletteGame.lastEvent.playerId;
      setBangEffect(true);
      setDeathOverlay('yellow');
      setJustDiedIds((prev) => new Set([...prev, deadId]));
      setTimeout(() => { setBangEffect(false); setDeathOverlay('black'); }, 600);
      setTimeout(() => setDeathOverlay(null), 2600);
    } else if (rouletteGame.lastEvent.type === 'click') {
      setSpinCylinder(true);
      setTimeout(() => setSpinCylinder(false), 700);
    }
  }, [rouletteGame?.lastEvent, rouletteGame?.round]);

  // Cylinder spin on new round
  useEffect(() => {
    if (rouletteGame?.round && rouletteGame.round > 1) {
      setSpinCylinder(true);
      setTimeout(() => setSpinCylinder(false), 900);
    }
  }, [rouletteGame?.round]);

  // Reset justDied on game end
  useEffect(() => {
    if (!rouletteGame) setJustDiedIds(new Set());
  }, [rouletteGame]);

  // Reset play-again state on new prompt
  useEffect(() => {
    if (roulettePlayAgainPrompt) setPlayAgainResponded(false);
  }, [roulettePlayAgainPrompt]);

  const handlePlayAgain = (playAgain: boolean) => {
    respondToRoulettePlayAgainPrompt(playAgain);
    setPlayAgainResponded(true);
  };

  // ─── No party ──────────────────────────────────────────────────────────────
  if (!currentParty) {
    return (
      <PageShell>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Button variant="ghost" size="icon" asChild><Link to="/games"><ArrowLeft size={18} /></Link></Button>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.5, color: 'rgba(220,140,60,0.95)' }}>Russian Roulette</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '60px 0', color: 'rgba(180,140,80,0.7)' }}>
          <Users size={48} style={{ opacity: 0.4 }} />
          <p style={{ fontSize: 14, textAlign: 'center', maxWidth: 300 }}>Tu dois être dans une party pour jouer à Russian Roulette.</p>
          <Button variant="outline" asChild><Link to="/party">Rejoindre une party</Link></Button>
        </div>
      </PageShell>
    );
  }

  return (
    <>
      {/* ─── CSS ─────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes rr-cylinder-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(1080deg); }
        }
        .rr-cylinder-spin { animation: rr-cylinder-spin 0.7s cubic-bezier(0.2,0,0.3,1) forwards; }

        @keyframes rr-gun-shake {
          0%   { transform: translate(0,0) rotate(0deg); }
          15%  { transform: translate(-3px,-2px) rotate(-2deg); }
          30%  { transform: translate(3px,2px) rotate(2deg); }
          50%  { transform: translate(-4px,1px) rotate(-1deg); }
          70%  { transform: translate(4px,-1px) rotate(1deg); }
          100% { transform: translate(0,0) rotate(0deg); }
        }
        .rr-gun-shake { animation: rr-gun-shake 0.35s ease-out forwards; }

        @keyframes rr-bang-flash {
          0%   { opacity: 1; }
          40%  { opacity: 0.85; }
          100% { opacity: 0; }
        }
        .rr-bang-flash { animation: rr-bang-flash 1.2s ease-out forwards; }

        @keyframes rr-seat-pulse {
          0%,100% { box-shadow: 0 0 14px rgba(220,60,60,0.5), 0 2px 8px rgba(0,0,0,0.7); }
          50%      { box-shadow: 0 0 28px rgba(220,60,60,0.8), 0 4px 16px rgba(0,0,0,0.7); }
        }
        .rr-seat-pulse { animation: rr-seat-pulse 1.5s ease-in-out infinite; }

        @keyframes rr-event-fade {
          0%   { opacity: 0; transform: translateY(4px); }
          15%  { opacity: 1; transform: translateY(0); }
          70%  { opacity: 1; }
          100% { opacity: 0.6; }
        }
        .rr-event-fade { animation: rr-event-fade 2s ease forwards; }

        @keyframes rr-candle-flicker {
          0%,100% { opacity: 1; }
          33%      { opacity: 0.85; }
          66%      { opacity: 0.95; }
        }
        .rr-candle-flicker { animation: rr-candle-flicker 3s ease-in-out infinite; }

        @keyframes rr-slide-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rr-slide-in { animation: rr-slide-in 0.35s ease forwards; }

        @keyframes rr-countdown {
          0%   { opacity: 1; transform: scale(1.4); }
          60%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.85); }
        }
        .rr-countdown { animation: rr-countdown 0.9s ease forwards; }

        @keyframes rr-name-erase {
          0%   { filter: blur(0px); letter-spacing: normal; opacity: 1; }
          40%  { filter: blur(2px); letter-spacing: 0.15em; opacity: 0.6; }
          100% { filter: blur(6px); letter-spacing: 0.5em; opacity: 0; }
        }
        .rr-name-erase { animation: rr-name-erase 2s 0.6s ease forwards; }
      `}</style>

      {/* ─── Full-screen death overlay ───────────────────────────────────── */}
      {deathOverlay && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
            background: deathOverlay === 'yellow' ? 'rgba(255,220,0,0.92)' : '#000',
            transition: deathOverlay === 'black' ? 'background 0.15s' : 'none',
          }}
        />
      )}

      <PageShell>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Button variant="ghost" size="icon" asChild><Link to="/games"><ArrowLeft size={18} /></Link></Button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.5, color: 'rgba(220,140,60,0.95)' }}>Russian Roulette</h1>
            <p style={{ fontSize: 11, color: 'rgba(150,120,80,0.7)', marginTop: 1 }}>Qui ose tirer le dernier ?</p>
          </div>
        </div>

        {/* ── Active game ───────────────────────────────────────────────── */}
        {rouletteGame && isInGame && (
          <div className="rr-slide-in">
            {/* Countdown overlay on table */}
            <div style={{ position: 'relative' }}>
              {countdown !== null && (
                <div
                  key={countdown}
                  className="rr-countdown"
                  style={{
                    position: 'absolute', top: '40%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 20, pointerEvents: 'none',
                    fontSize: 80, fontWeight: 900, fontFamily: 'monospace',
                    color: '#fff', textShadow: '0 0 40px rgba(220,60,60,0.9), 0 0 80px rgba(200,0,0,0.6)',
                  }}
                >
                  {countdown}
                </div>
              )}
              <div style={{ background: 'radial-gradient(ellipse at 50% 40%, #0e0904 0%, #060402 100%)', border: '1px solid rgba(100,60,20,0.3)', borderRadius: 16, padding: '8px 4px 12px', marginBottom: 12 }}>
                <RouletteTable
                  game={rouletteGame}
                  myUserId={myUserId}
                  turnProgress={turnProgress}
                  bangEffect={bangEffect}
                  spinCylinder={spinCylinder}
                  gunAngle={gunAngle}
                  justDiedIds={justDiedIds}
                />
              </div>
            </div>

            {/* Action bar */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', padding: '12px 0' }}>
              {isMyTurn ? (
                <>
                  <button
                    onClick={pullRouletteTrigger}
                    className="rr-seat-pulse"
                    style={{ background: 'linear-gradient(135deg, #8a0000 0%, #5a0000 100%)', border: '2px solid rgba(220,60,60,0.7)', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: 1, padding: '12px 32px', cursor: 'pointer', boxShadow: '0 0 20px rgba(180,0,0,0.5), 0 4px 12px rgba(0,0,0,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
                    onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; }}
                    onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    🔫 Tirer
                  </button>
                  <button
                    onClick={passRoulette}
                    style={{ background: 'rgba(30,20,10,0.7)', border: '1px solid rgba(100,80,50,0.4)', borderRadius: 10, color: 'rgba(160,130,80,0.8)', fontWeight: 600, fontSize: 13, padding: '10px 22px', cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
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
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#882222', boxShadow: '0 0 6px rgba(200,0,0,0.6)', animation: 'rr-seat-pulse 1.2s ease-in-out infinite' }} />
                  {rouletteGame.players.find((p) => p.userId === rouletteGame.currentPlayerId)?.username ?? '...'} réfléchit…
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Game over ─────────────────────────────────────────────────── */}
        {rouletteGameOver && !rouletteGame && (
          <div className="rr-slide-in" style={{ background: 'rgba(15,8,4,0.9)', border: '1px solid rgba(180,100,30,0.3)', borderRadius: 14, padding: '24px', marginBottom: 16 }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'rgba(220,160,50,0.95)', marginBottom: 4 }}>
                {rouletteGameOver.winnerUsername ? `${rouletteGameOver.winnerUsername} a survécu !` : 'Tout le monde est éliminé'}
              </h2>
              <p style={{ fontSize: 12, color: 'rgba(150,120,70,0.7)' }}>La table est silencieuse.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rouletteGameOver.standings.map((p) => (
                <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: p.isAlive ? 'rgba(30,20,5,0.8)' : 'rgba(10,5,5,0.6)', borderRadius: 8, border: `1px solid ${p.isAlive ? 'rgba(180,140,40,0.3)' : 'rgba(80,30,30,0.2)'}`, opacity: p.isAlive ? 1 : 0.6 }}>
                  <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{p.isAlive ? '🏆' : p.passedOut ? '🐔' : '💀'}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: p.isAlive ? 'rgba(220,180,80,0.95)' : 'rgba(140,100,80,0.7)' }}>{p.username}</span>
                  <span style={{ fontSize: 11, color: 'rgba(130,100,60,0.7)' }}>{p.isAlive ? 'SURVIT' : p.passedOut ? 'passé' : `${p.pullCount} pull${p.pullCount !== 1 ? 's' : ''}`}</span>
                </div>
              ))}
            </div>
            {roulettePlayAgainPrompt && !playAgainResponded && (
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'rgba(180,140,80,0.75)', marginBottom: 10 }}>
                  Rejouer ? ({roulettePlayAgainPrompt.responses.filter((r) => r.playAgain).length} prêts)
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <Button onClick={() => handlePlayAgain(true)} style={{ background: 'rgba(100,20,20,0.8)', border: '1px solid rgba(180,50,50,0.5)', color: '#fff' }}>Rejouer</Button>
                  <Button variant="outline" onClick={() => handlePlayAgain(false)}>Quitter</Button>
                </div>
              </div>
            )}
            {playAgainResponded && (
              <p style={{ fontSize: 12, color: 'rgba(150,120,70,0.6)', textAlign: 'center', marginTop: 16 }}>En attente des autres joueurs…</p>
            )}
            {rouletteGameOver && !roulettePlayAgainPrompt && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Button variant="outline" onClick={clearRouletteGameOver}>Fermer</Button>
              </div>
            )}
          </div>
        )}

        {/* ── Lobby ─────────────────────────────────────────────────────── */}
        {!rouletteGame && !rouletteGameOver && (
          <div className="rr-slide-in" style={{ background: 'rgba(12,7,3,0.85)', border: '1px solid rgba(100,60,20,0.3)', borderRadius: 14, padding: '28px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔫</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(200,150,60,0.9)', marginBottom: 8 }}>Russian Roulette</h2>
            <p style={{ fontSize: 13, color: 'rgba(150,120,70,0.7)', maxWidth: 320, margin: '0 auto 20px', lineHeight: 1.6 }}>
              2 à 6 joueurs s'assoient autour de la table. À tour de rôle, chacun tire — ou passe. Le dernier en vie gagne.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {partyMembers.map((m) => (
                <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(20,12,5,0.7)', borderRadius: 8, padding: '5px 10px', border: '1px solid rgba(80,55,25,0.35)', fontSize: 12 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.isLeader ? '#d4a020' : 'rgba(120,90,50,0.6)' }} />
                  <UsernameDisplay username={m.username} usernameColor={m.usernameColor} usernameClassName="text-xs" />
                  {m.isLeader && <span style={{ fontSize: 9, color: 'rgba(180,140,50,0.7)', fontWeight: 600 }}>LEADER</span>}
                </div>
              ))}
            </div>
            {isLeader ? (
              <button
                onClick={startRoulette}
                style={{ background: 'linear-gradient(135deg, #7a1a00 0%, #4a0a00 100%)', border: '2px solid rgba(180,50,30,0.6)', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, letterSpacing: 0.5, padding: '11px 28px', cursor: 'pointer', boxShadow: '0 0 16px rgba(150,20,0,0.4), 0 4px 10px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto' }}
              >
                <Play size={15} />
                Lancer la partie
              </button>
            ) : (
              <p style={{ fontSize: 12, color: 'rgba(140,110,60,0.6)', fontStyle: 'italic' }}>En attente du leader pour lancer…</p>
            )}
          </div>
        )}
      </PageShell>
    </>
  );
}

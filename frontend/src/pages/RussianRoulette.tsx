import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePartySocket } from '@/contexts/PartySocketContext';
import { useGameSocket } from '@/contexts/GameSocketContext';
import { ArrowLeft, Play, Skull, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function seatPos(idx: number, total: number) {
  const deg = -90 - idx * (360 / total);
  const rad = (deg * Math.PI) / 180;
  return { left: `${50 + 40 * Math.cos(rad)}%`, top: `${50 + 40 * Math.sin(rad)}%` };
}

function seatAngleDeg(idx: number, total: number) {
  return -90 - idx * (360 / total);
}

// ─── Cylinder (no bullet highlight) ──────────────────────────────────────────
function CylinderDisplay({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="52" height="52" viewBox="-26 -26 52 52"
      className={spinning ? 'rr-cylinder-spin' : ''}
      style={{ filter: 'drop-shadow(0 0 5px rgba(180,180,180,0.15))' }}
    >
      <circle cx="0" cy="0" r="23" fill="#1c1c1c" stroke="#484848" strokeWidth="2" />
      <circle cx="0" cy="0" r="19" fill="#111" stroke="#333" strokeWidth="1" />
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * 2 * Math.PI - Math.PI / 2;
        return (
          <circle
            key={i}
            cx={Math.cos(a) * 11} cy={Math.sin(a) * 11}
            r="4.5" fill="#0a0a0a" stroke="#404040" strokeWidth="1"
          />
        );
      })}
      <circle cx="0" cy="0" r="3" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
    </svg>
  );
}

// ─── Revolver SVG (barrel points right at 0°) ─────────────────────────────────
function RevolverSVG({ shaking, banged }: { shaking: boolean; banged: boolean }) {
  return (
    <svg
      viewBox="0 0 220 120" width="160" height="87"
      className={cn(shaking && 'rr-gun-shake')}
      style={{
        filter: banged
          ? 'drop-shadow(0 0 18px rgba(255,80,0,0.9)) drop-shadow(0 0 36px rgba(255,200,0,0.6))'
          : 'drop-shadow(0 2px 6px rgba(0,0,0,0.9))',
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
  const avatarSize = 48;
  const ringR = 28;
  const ringW = 3;
  const ringSize = (ringR + ringW + 3) * 2;
  const c = 2 * Math.PI * ringR;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 72 }}>
      {/* Avatar + ring wrapper */}
      <div style={{ position: 'relative', width: avatarSize, height: avatarSize, flexShrink: 0 }}>
        {/* Timer ring — centered on avatar */}
        {isCurrent && player.isAlive && (
          <svg
            width={ringSize} height={ringSize}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: `translate(-50%, -50%) rotate(-90deg)`,
              pointerEvents: 'none',
            }}
          >
            <circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} fill="none" stroke="rgba(200,60,60,0.15)" strokeWidth={ringW} />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={ringR}
              fill="none" stroke="rgba(200,60,60,0.8)" strokeWidth={ringW}
              strokeDasharray={c}
              strokeDashoffset={c * (1 - turnProgress / 100)}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.12s linear' }}
            />
          </svg>
        )}

        {/* Avatar circle */}
        <div
          className={cn(isCurrent && player.isAlive && 'rr-seat-pulse')}
          style={{
            width: avatarSize, height: avatarSize, borderRadius: '50%',
            background: isEliminated
              ? 'radial-gradient(circle, #1a0a0a 0%, #0a0505 100%)'
              : isCurrent
              ? 'radial-gradient(circle, #2a1a1a 0%, #140a0a 100%)'
              : 'radial-gradient(circle, #2a2a2a 0%, #151515 100%)',
            border: isEliminated
              ? '2px solid #3a0000'
              : isCurrent
              ? '2px solid rgba(210,50,50,0.8)'
              : isMe
              ? '2px solid rgba(180,180,180,0.5)'
              : '2px solid rgba(80,80,80,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isCurrent && player.isAlive
              ? '0 0 12px rgba(200,50,50,0.5)'
              : '0 2px 6px rgba(0,0,0,0.7)',
            transition: 'all 0.3s',
          }}
        >
          {isEliminated ? (
            <Skull size={22} style={{ color: player.passedOut ? '#666' : '#bb2222', filter: player.passedOut ? 'none' : 'drop-shadow(0 0 4px rgba(180,0,0,0.6))' }} />
          ) : (
            <span style={{ fontSize: 17, lineHeight: 1, color: '#ccc' }}>{player.username.charAt(0).toUpperCase()}</span>
          )}
        </div>
      </div>

      {/* Name */}
      <div style={{ maxWidth: 80, textAlign: 'center', overflow: 'hidden' }}>
        <UsernameDisplay
          username={player.username}
          usernameColor={player.usernameColor}
          usernameClassName={`text-[10px] ${isMe ? 'font-bold' : 'font-semibold'} ${isEliminated ? 'opacity-35' : ''} truncate${justDied ? ' rr-name-erase' : ''}`}
        />
        {isEliminated ? (
          <div style={{ fontSize: 8, color: player.passedOut ? '#555' : '#7a1a1a', fontWeight: 600, marginTop: 1 }}>
            {player.passedOut ? 'PASSÉ' : 'ÉLIMINÉ'}
          </div>
        ) : (
          <div style={{ fontSize: 8, color: 'rgba(140,140,140,0.5)', marginTop: 1 }}>
            {player.pullCount > 0 ? `${player.pullCount}×` : '—'}
          </div>
        )}
      </div>

      {isMe && (
        <div style={{ position: 'absolute', top: -6, right: -8, background: 'rgba(180,180,180,0.9)', borderRadius: 3, padding: '1px 4px', fontSize: 7, fontWeight: 800, color: '#000', letterSpacing: 0.5 }}>
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
  showResult,
}: {
  game: { players: Array<{ userId: string; username: string; usernameColor?: string | null; isAlive: boolean; pullCount: number; passedOut: boolean }>; currentPlayerId: string | null; cylinderPosition: number; round: number; lastEvent: { type: 'click' | 'bang' | 'pass'; playerId: string; username: string } | null; alivePlayers: number; totalPlayers: number };
  myUserId: string;
  turnProgress: number;
  bangEffect: boolean;
  spinCylinder: boolean;
  gunAngle: number;
  justDiedIds: Set<string>;
  showResult: boolean;
}) {
  const myIdx = game.players.findIndex((p) => p.userId === myUserId);
  const ordered = myIdx <= 0
    ? [...game.players]
    : [...game.players.slice(myIdx), ...game.players.slice(0, myIdx)];

  return (
    // Square container, max 480px
    <div style={{ position: 'relative', maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <div style={{ paddingBottom: '100%' }} />
      <div style={{ position: 'absolute', inset: 0 }}>

        {/* Outer ring (grey) */}
        <div style={{
          position: 'absolute', left: '5%', top: '5%', width: '90%', height: '90%',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #4a4a4a 0%, #282828 55%, #1a1a1a 100%)',
          boxShadow: '0 6px 32px rgba(0,0,0,0.8), inset 0 1px 3px rgba(255,255,255,0.05)',
        }} />
        {/* Inner ring */}
        <div style={{
          position: 'absolute', left: '7%', top: '7%', width: '86%', height: '86%',
          borderRadius: '50%',
          background: '#1e1e1e',
        }} />
        {/* Surface */}
        <div style={{
          position: 'absolute', left: '10%', top: '10%', width: '80%', height: '80%',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 38%, #2e2e2e 0%, #1c1c1c 50%, #111 100%)',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.7)',
        }}>
          {bangEffect && (
            <div className="rr-bang-flash" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,80,0,0.85) 0%, rgba(180,0,0,0.5) 60%, transparent 100%)', pointerEvents: 'none', zIndex: 10 }} />
          )}

          {/* Center: gun + cylinder */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ transform: `rotate(${gunAngle}deg)`, transition: 'transform 0.75s cubic-bezier(0.34,1.2,0.64,1)' }}>
              <RevolverSVG shaking={game.lastEvent?.type === 'click' && showResult} banged={bangEffect} />
            </div>
            <CylinderDisplay spinning={spinCylinder} />
            <div style={{ fontSize: 9, color: 'rgba(140,140,140,0.5)', letterSpacing: 1 }}>
              R{game.round} · {game.alivePlayers}/{game.totalPlayers}
            </div>
            {showResult && game.lastEvent && (
              <div
                className="rr-event-fade"
                style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: 1, textAlign: 'center',
                  color: game.lastEvent.type === 'bang' ? '#ff4444' : game.lastEvent.type === 'pass' ? '#888' : '#66aa66',
                  textShadow: game.lastEvent.type === 'bang' ? '0 0 8px rgba(255,0,0,0.7)' : 'none',
                }}
              >
                {game.lastEvent.type === 'bang' ? `💥 ${game.lastEvent.username}` : game.lastEvent.type === 'pass' ? `🐔 ${game.lastEvent.username}` : `🔘 click…`}
              </div>
            )}
          </div>
        </div>

        {/* Player seats */}
        {ordered.map((player, si) => {
          const pos = seatPos(si, ordered.length);
          return (
            <div
              key={player.userId}
              style={{ position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)', zIndex: player.userId === game.currentPlayerId ? 5 : 2 }}
            >
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
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function RussianRoulette() {
  const { user } = useAuth();
  const { currentParty, partyMembers } = usePartySocket();
  const { rouletteGame, rouletteGameOver, roulettePlayAgainPrompt, startRoulette, pullRouletteTrigger, passRoulette, respondToRoulettePlayAgainPrompt, clearRouletteGameOver } = useGameSocket();

  const [bangEffect, setBangEffect] = useState(false);
  const [spinCylinder, setSpinCylinder] = useState(false);
  const [turnProgress, setTurnProgress] = useState(100);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [deathOverlay, setDeathOverlay] = useState<'yellow' | 'black' | null>(null);
  const [justDiedIds, setJustDiedIds] = useState<Set<string>>(new Set());
  const [showResult, setShowResult] = useState(false);
  const [playAgainResponded, setPlayAgainResponded] = useState(false);

  const animFrameRef = useRef<number | null>(null);
  const prevEventRef = useRef<string | null>(null);

  const myUserId = user?.id ?? '';
  const isLeader = partyMembers.find((m) => m.userId === myUserId)?.isLeader ?? false;
  const isInGame = !!rouletteGame?.players.find((p) => p.userId === myUserId);
  const myPlayer = rouletteGame?.players.find((p) => p.userId === myUserId);
  const isMyTurn = rouletteGame?.currentPlayerId === myUserId && myPlayer?.isAlive;

  // Gun angle: reorder players so current user is seat 0
  const myIdx = rouletteGame ? rouletteGame.players.findIndex((p) => p.userId === myUserId) : 0;
  const orderedPlayers = rouletteGame
    ? myIdx <= 0 ? [...rouletteGame.players] : [...rouletteGame.players.slice(myIdx), ...rouletteGame.players.slice(0, myIdx)]
    : [];
  const currentSeatIdx = rouletteGame?.currentPlayerId
    ? orderedPlayers.findIndex((p) => p.userId === rouletteGame.currentPlayerId)
    : 0;
  const gunAngle = rouletteGame && currentSeatIdx >= 0
    ? seatAngleDeg(currentSeatIdx, orderedPlayers.length)
    : -90;

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

  // Shoot countdown → reveal result → effects
  useEffect(() => {
    if (!rouletteGame?.lastEvent) return;
    const event = rouletteGame.lastEvent;
    const eventKey = `${event.type}-${event.playerId}-${rouletteGame.round}`;
    if (eventKey === prevEventRef.current) return;

    // New event — start 3-2-1 countdown before revealing
    setShowResult(false);
    setCountdown(3);

    const t1 = setTimeout(() => setCountdown(2), 1000);
    const t2 = setTimeout(() => setCountdown(1), 2000);
    const t3 = setTimeout(() => {
      setCountdown(null);
      setShowResult(true);
      prevEventRef.current = eventKey;

      if (event.type === 'bang') {
        setBangEffect(true);
        setDeathOverlay('yellow');
        setJustDiedIds((prev) => new Set([...prev, event.playerId]));
        setTimeout(() => { setBangEffect(false); setDeathOverlay('black'); }, 600);
        setTimeout(() => setDeathOverlay(null), 2600);
      } else if (event.type === 'click') {
        setSpinCylinder(true);
        setTimeout(() => setSpinCylinder(false), 700);
      }
    }, 3000);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [rouletteGame?.lastEvent, rouletteGame?.round]);

  // Cylinder spin on new round
  useEffect(() => {
    if (rouletteGame?.round && rouletteGame.round > 1) {
      setSpinCylinder(true);
      setTimeout(() => setSpinCylinder(false), 900);
    }
  }, [rouletteGame?.round]);

  // Reset on game end
  useEffect(() => {
    if (!rouletteGame) {
      setJustDiedIds(new Set());
      setShowResult(false);
      setCountdown(null);
    }
  }, [rouletteGame]);

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
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.5 }}>Russian Roulette</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '60px 0', color: 'rgba(140,140,140,0.7)' }}>
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
          to { transform: rotate(1080deg); }
        }
        .rr-cylinder-spin { animation: rr-cylinder-spin 0.7s cubic-bezier(0.2,0,0.3,1) forwards; }

        @keyframes rr-gun-shake {
          0%   { transform: translate(0,0) rotate(0deg); }
          15%  { transform: translate(-3px,-2px) rotate(-2deg); }
          35%  { transform: translate(3px,2px) rotate(2deg); }
          55%  { transform: translate(-3px,1px) rotate(-1deg); }
          75%  { transform: translate(3px,-1px) rotate(1deg); }
          100% { transform: translate(0,0) rotate(0deg); }
        }
        .rr-gun-shake { animation: rr-gun-shake 0.35s ease-out forwards; }

        @keyframes rr-bang-flash {
          0%   { opacity: 1; }
          50%  { opacity: 0.8; }
          100% { opacity: 0; }
        }
        .rr-bang-flash { animation: rr-bang-flash 1.1s ease-out forwards; }

        @keyframes rr-seat-pulse {
          0%,100% { box-shadow: 0 0 10px rgba(200,50,50,0.4); }
          50%      { box-shadow: 0 0 22px rgba(200,50,50,0.7); }
        }
        .rr-seat-pulse { animation: rr-seat-pulse 1.5s ease-in-out infinite; }

        @keyframes rr-event-fade {
          0%   { opacity: 0; transform: translateY(3px); }
          20%  { opacity: 1; transform: translateY(0); }
          70%  { opacity: 1; }
          100% { opacity: 0.55; }
        }
        .rr-event-fade { animation: rr-event-fade 2s ease forwards; }

        @keyframes rr-slide-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rr-slide-in { animation: rr-slide-in 0.3s ease forwards; }

        @keyframes rr-countdown-pop {
          0%   { opacity: 0; transform: scale(1.8); }
          20%  { opacity: 1; transform: scale(1); }
          75%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.7); }
        }
        .rr-countdown-num { animation: rr-countdown-pop 0.95s ease forwards; }

        @keyframes rr-name-erase {
          0%   { filter: blur(0px); letter-spacing: normal; opacity: 1; }
          40%  { filter: blur(2px); letter-spacing: 0.12em; opacity: 0.5; }
          100% { filter: blur(5px); letter-spacing: 0.4em; opacity: 0; }
        }
        .rr-name-erase { animation: rr-name-erase 1.8s 0.7s ease forwards; }
      `}</style>

      {/* ─── Death overlay ───────────────────────────────────────────────── */}
      {deathOverlay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
          background: deathOverlay === 'yellow' ? 'rgba(255,220,0,0.9)' : '#000',
          transition: deathOverlay === 'black' ? 'background 0.2s' : 'none',
        }} />
      )}

      <PageShell>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Button variant="ghost" size="icon" asChild><Link to="/games"><ArrowLeft size={18} /></Link></Button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.5 }}>Russian Roulette</h1>
            <p style={{ fontSize: 11, color: 'rgba(140,140,140,0.6)', marginTop: 1 }}>Qui ose tirer le dernier ?</p>
          </div>
        </div>

        {/* ── Active game ───────────────────────────────────────────────── */}
        {rouletteGame && isInGame && (
          <div className="rr-slide-in">
            {/* Table with countdown overlay */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              {countdown !== null && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
                  <span
                    key={countdown}
                    className="rr-countdown-num"
                    style={{ fontSize: 96, fontWeight: 900, fontFamily: 'monospace', color: '#fff', textShadow: '0 0 40px rgba(200,50,50,0.8), 0 0 80px rgba(180,0,0,0.5)' }}
                  >
                    {countdown}
                  </span>
                </div>
              )}
              <div style={{ background: '#0d0d0d', border: '1px solid rgba(70,70,70,0.4)', borderRadius: 16, padding: '8px 4px 12px' }}>
                <RouletteTable
                  game={rouletteGame}
                  myUserId={myUserId}
                  turnProgress={turnProgress}
                  bangEffect={bangEffect}
                  spinCylinder={spinCylinder}
                  gunAngle={gunAngle}
                  justDiedIds={justDiedIds}
                  showResult={showResult}
                />
              </div>
            </div>

            {/* Action bar */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', padding: '10px 0' }}>
              {isMyTurn && countdown === null ? (
                <>
                  <Button
                    onClick={pullRouletteTrigger}
                    style={{ background: 'hsl(var(--destructive))', color: 'hsl(var(--destructive-foreground))', fontWeight: 700, fontSize: 15, letterSpacing: 0.5, padding: '10px 28px', boxShadow: '0 0 16px rgba(180,0,0,0.35)' }}
                  >
                    🔫 Tirer
                  </Button>
                  <Button variant="outline" onClick={passRoulette} style={{ color: 'rgba(160,160,160,0.8)' }}>
                    🐔 Passer
                  </Button>
                </>
              ) : countdown !== null ? (
                <div style={{ fontSize: 13, color: 'rgba(150,150,150,0.6)', fontStyle: 'italic' }}>
                  …
                </div>
              ) : myPlayer && !myPlayer.isAlive ? (
                <div style={{ fontSize: 13, color: 'rgba(120,80,80,0.8)', fontStyle: 'italic' }}>
                  {myPlayer.passedOut ? 'Tu as passé. Regarde les autres...' : 'Tu es éliminé. Regarde les survivants...'}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(140,140,140,0.6)', fontSize: 13 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#882222', boxShadow: '0 0 5px rgba(180,0,0,0.5)', animation: 'rr-seat-pulse 1.2s ease-in-out infinite' }} />
                  {rouletteGame.players.find((p) => p.userId === rouletteGame.currentPlayerId)?.username ?? '...'} réfléchit…
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Game over ─────────────────────────────────────────────────── */}
        {rouletteGameOver && !rouletteGame && (
          <div className="rr-slide-in" style={{ border: '1px solid hsl(var(--border))', borderRadius: 14, padding: '24px', marginBottom: 16 }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                {rouletteGameOver.winnerUsername ? `${rouletteGameOver.winnerUsername} a survécu !` : 'Tout le monde est éliminé'}
              </h2>
              <p style={{ fontSize: 12, color: 'rgba(140,140,140,0.6)' }}>La table est silencieuse.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rouletteGameOver.standings.map((p) => (
                <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'hsl(var(--muted))', borderRadius: 8, border: '1px solid hsl(var(--border))', opacity: p.isAlive ? 1 : 0.6 }}>
                  <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{p.isAlive ? '🏆' : p.passedOut ? '🐔' : '💀'}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.username}</span>
                  <span style={{ fontSize: 11, color: 'rgba(140,140,140,0.7)' }}>{p.isAlive ? 'SURVIT' : p.passedOut ? 'passé' : `${p.pullCount}×`}</span>
                </div>
              ))}
            </div>
            {roulettePlayAgainPrompt && !playAgainResponded && (
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'rgba(140,140,140,0.7)', marginBottom: 10 }}>
                  Rejouer ? ({roulettePlayAgainPrompt.responses.filter((r) => r.playAgain).length} prêts)
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <Button onClick={() => handlePlayAgain(true)}>Rejouer</Button>
                  <Button variant="outline" onClick={() => handlePlayAgain(false)}>Quitter</Button>
                </div>
              </div>
            )}
            {playAgainResponded && <p style={{ fontSize: 12, color: 'rgba(140,140,140,0.5)', textAlign: 'center', marginTop: 16 }}>En attente des autres joueurs…</p>}
            {!roulettePlayAgainPrompt && <div style={{ marginTop: 16, textAlign: 'center' }}><Button variant="outline" onClick={clearRouletteGameOver}>Fermer</Button></div>}
          </div>
        )}

        {/* ── Lobby ─────────────────────────────────────────────────────── */}
        {!rouletteGame && !rouletteGameOver && (
          <div className="rr-slide-in" style={{ border: '1px solid hsl(var(--border))', borderRadius: 14, padding: '28px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔫</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Russian Roulette</h2>
            <p style={{ fontSize: 13, color: 'rgba(140,140,140,0.7)', maxWidth: 320, margin: '0 auto 20px', lineHeight: 1.6 }}>
              2 à 6 joueurs s'assoient autour de la table. À tour de rôle, chacun tire — ou passe. Le dernier en vie gagne.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {partyMembers.map((m) => (
                <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'hsl(var(--muted))', borderRadius: 8, padding: '5px 10px', border: '1px solid hsl(var(--border))', fontSize: 12 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.isLeader ? 'hsl(var(--primary))' : 'rgba(100,100,100,0.6)' }} />
                  <UsernameDisplay username={m.username} usernameColor={m.usernameColor} usernameClassName="text-xs" />
                  {m.isLeader && <span style={{ fontSize: 9, color: 'rgba(140,140,140,0.7)', fontWeight: 600 }}>Leader</span>}
                </div>
              ))}
            </div>
            {isLeader ? (
              <Button onClick={startRoulette} style={{ gap: 8 }}>
                <Play size={14} />
                Lancer la partie
              </Button>
            ) : (
              <p style={{ fontSize: 12, color: 'rgba(140,140,140,0.5)', fontStyle: 'italic' }}>En attente du leader pour lancer…</p>
            )}
          </div>
        )}
      </PageShell>
    </>
  );
}

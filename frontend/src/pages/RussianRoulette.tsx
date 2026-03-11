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
function seatPos(idx: number, total: number) {
  const deg = -90 - idx * (360 / total);
  const rad = (deg * Math.PI) / 180;
  return { left: `${50 + 40 * Math.cos(rad)}%`, top: `${50 + 40 * Math.sin(rad)}%` };
}

function seatAngleDeg(idx: number, total: number) {
  return -90 - idx * (360 / total);
}

// ─── Compact revolver SVG — barrel points right at 0° ────────────────────────
// Barrel is short (snub-nose) so it doesn't dominate the table center
function RevolverSVG({ shaking, banged }: { shaking: boolean; banged: boolean }) {
  return (
    <svg
      viewBox="20 28 100 90"
      width="90"
      height="80"
      className={cn(shaking && 'rr-gun-shake')}
      style={{
        filter: banged
          ? 'drop-shadow(0 0 14px rgba(255,80,0,0.9)) drop-shadow(0 0 28px rgba(255,200,0,0.6))'
          : 'drop-shadow(0 2px 5px rgba(0,0,0,0.9))',
        transition: 'filter 0.3s',
        overflow: 'visible',
      }}
    >
      {/* Short barrel stub */}
      <rect x="80" y="43" width="26" height="14" rx="3" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
      <rect x="80" y="44" width="25" height="5" rx="2" fill="#3a3a3a" />
      {/* Muzzle cap */}
      <rect x="101" y="41" width="8" height="18" rx="2" fill="#1e1e1e" stroke="#444" strokeWidth="1" />

      {/* Frame / body */}
      <path d="M80 43 Q70 43 65 51 L60 80 Q58 88 70 90 L110 90 Q118 90 120 80 L120 58 L80 58 Z" fill="#252525" stroke="#4a4a4a" strokeWidth="1" />
      <path d="M80 44 Q72 44 68 51 L64 80 Q62 87 72 88" fill="none" stroke="#3a3a3a" strokeWidth="1.5" />

      {/* Cylinder */}
      <ellipse cx="95" cy="56" rx="18" ry="14" fill="#1e1e1e" stroke="#555" strokeWidth="2" />
      <ellipse cx="95" cy="56" rx="14" ry="10" fill="#161616" stroke="#3a3a3a" strokeWidth="1" />
      {[0,1,2,3,4,5].map((i) => {
        const a = (i / 6) * 2 * Math.PI;
        return <circle key={i} cx={95 + Math.cos(a) * 9} cy={56 + Math.sin(a) * 7} r="2.5" fill="#0a0a0a" stroke="#2a2a2a" strokeWidth="0.5" />;
      })}

      {/* Hammer */}
      <rect x="62" y="36" width="12" height="8" rx="2" fill="#1e1e1e" stroke="#444" strokeWidth="1" />
      <rect x="64" y="32" width="5" height="8" rx="1.5" fill="#252525" stroke="#3a3a3a" strokeWidth="1" />

      {/* Trigger guard + trigger */}
      <path d="M72 62 Q68 75 75 80 L85 80 Q88 75 88 68" fill="none" stroke="#444" strokeWidth="4" strokeLinecap="round" />
      <line x1="80" y1="62" x2="78" y2="72" stroke="#888" strokeWidth="2.5" strokeLinecap="round" />

      {/* Grip */}
      <path d="M68 88 Q60 92 55 105 Q52 112 62 114 L80 114 Q90 112 92 102 L92 88 Z" fill="#1a1008" stroke="#3a2010" strokeWidth="1.5" />
      {[0,1,2,3,4].map((i) => (
        <line key={i} x1={58 + i * 4} y1="95" x2={56 + i * 4} y2="108" stroke="#3a2a18" strokeWidth="1" />
      ))}
      <circle cx="72" cy="100" r="2.5" fill="#0f0a04" stroke="#4a3020" strokeWidth="1" />

      {/* Muzzle flash */}
      {banged && (
        <g>
          <polygon points="109,52 126,46 118,41 126,37 110,39" fill="#ff8c00" opacity="0.9" />
          <polygon points="109,52 128,52 121,56 126,58 110,55" fill="#ffcc00" opacity="0.8" />
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
      {/* Avatar + ring in same-size wrapper so ring is always centered */}
      <div style={{ position: 'relative', width: avatarSize, height: avatarSize, flexShrink: 0 }}>
        {isCurrent && !isEliminated && (
          <svg
            width={ringSize} height={ringSize}
            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-90deg)', pointerEvents: 'none' }}
          >
            <circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} fill="none" stroke="rgba(200,60,60,0.15)" strokeWidth={ringW} />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={ringR}
              fill="none" stroke="rgba(200,60,60,0.8)" strokeWidth={ringW}
              strokeDasharray={c} strokeDashoffset={c * (1 - turnProgress / 100)}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.12s linear' }}
            />
          </svg>
        )}
        <div
          className={cn(isCurrent && !isEliminated && 'rr-seat-pulse')}
          style={{
            width: avatarSize, height: avatarSize, borderRadius: '50%',
            background: isEliminated
              ? 'radial-gradient(circle, #1a0a0a 0%, #0a0505 100%)'
              : isCurrent
              ? 'radial-gradient(circle, #2a1a1a 0%, #140a0a 100%)'
              : 'radial-gradient(circle, #2a2a2a 0%, #151515 100%)',
            border: isEliminated ? '2px solid #3a0000' : isCurrent ? '2px solid rgba(210,50,50,0.8)' : isMe ? '2px solid rgba(180,180,180,0.5)' : '2px solid rgba(80,80,80,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isCurrent && !isEliminated ? '0 0 12px rgba(200,50,50,0.5)' : '0 2px 6px rgba(0,0,0,0.7)',
            transition: 'all 0.3s',
          }}
        >
          {isEliminated
            ? <Skull size={22} style={{ color: '#bb2222', filter: 'drop-shadow(0 0 4px rgba(180,0,0,0.6))' }} />
            : <span style={{ fontSize: 17, lineHeight: 1, color: '#ccc' }}>{player.username.charAt(0).toUpperCase()}</span>
          }
        </div>
      </div>

      {/* Name */}
      <div style={{ maxWidth: 80, textAlign: 'center', overflow: 'hidden' }}>
        <UsernameDisplay
          username={player.username}
          usernameColor={player.usernameColor}
          usernameClassName={`text-[10px] ${isMe ? 'font-bold' : 'font-semibold'} ${isEliminated ? 'opacity-35' : ''} truncate${justDied ? ' rr-name-erase' : ''}`}
        />
        {isEliminated
          ? <div style={{ fontSize: 8, color: '#7a1a1a', fontWeight: 600, marginTop: 1 }}>ÉLIMINÉ</div>
          : <div style={{ fontSize: 8, color: 'rgba(140,140,140,0.5)', marginTop: 1 }}>{player.pullCount > 0 ? `${player.pullCount}×` : '—'}</div>
        }
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
  gunAngle,
  justDiedIds,
  showResult,
  pendingDeadIds,
}: {
  game: {
    players: Array<{ userId: string; username: string; usernameColor?: string | null; isAlive: boolean; pullCount: number; passedOut: boolean }>;
    currentPlayerId: string | null;
    round: number;
    lastEvent: { type: 'click' | 'bang' | 'pass'; playerId: string; username: string } | null;
    alivePlayers: number;
    totalPlayers: number;
    stake: number;
  };
  myUserId: string;
  turnProgress: number;
  bangEffect: boolean;
  gunAngle: number;
  justDiedIds: Set<string>;
  showResult: boolean;
  pendingDeadIds: Set<string>;
}) {
  const myIdx = game.players.findIndex((p) => p.userId === myUserId);
  const ordered = myIdx <= 0
    ? [...game.players]
    : [...game.players.slice(myIdx), ...game.players.slice(0, myIdx)];

  return (
    <div style={{ position: 'relative', maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <div style={{ paddingBottom: '100%' }} />
      <div style={{ position: 'absolute', inset: 0 }}>
        {/* Outer ring */}
        <div style={{ position: 'absolute', left: '5%', top: '5%', width: '90%', height: '90%', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #4a4a4a 0%, #282828 55%, #1a1a1a 100%)', boxShadow: '0 6px 32px rgba(0,0,0,0.8), inset 0 1px 3px rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', left: '7%', top: '7%', width: '86%', height: '86%', borderRadius: '50%', background: '#1e1e1e' }} />
        {/* Surface */}
        <div style={{ position: 'absolute', left: '10%', top: '10%', width: '80%', height: '80%', borderRadius: '50%', background: 'radial-gradient(circle at 40% 38%, #2e2e2e 0%, #1c1c1c 50%, #111 100%)', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.7)' }}>
          {bangEffect && (
            <div className="rr-bang-flash" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,80,0,0.85) 0%, rgba(180,0,0,0.5) 60%, transparent 100%)', pointerEvents: 'none', zIndex: 10 }} />
          )}

          {/* Center: gun only */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ transform: `rotate(${gunAngle}deg)`, transition: 'transform 0.75s cubic-bezier(0.34,1.2,0.64,1)', transformOrigin: 'center' }}>
              <RevolverSVG shaking={game.lastEvent?.type === 'click' && showResult} banged={bangEffect} />
            </div>
            <div style={{ fontSize: 10, color: 'rgba(160,160,160,0.5)', letterSpacing: 1, fontFamily: 'monospace' }}>
              1 / 6
            </div>
            {showResult && game.lastEvent && (
              <div
                className="rr-event-fade"
                style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: 1, textAlign: 'center',
                  color: game.lastEvent.type === 'bang' ? '#ff4444' : '#66aa66',
                  textShadow: game.lastEvent.type === 'bang' ? '0 0 8px rgba(255,0,0,0.7)' : 'none',
                }}
              >
                {game.lastEvent.type === 'bang' ? `💥 ${game.lastEvent.username}` : `🔘 click…`}
              </div>
            )}
          </div>
        </div>

        {/* Player seats */}
        {ordered.map((player, si) => {
          const pos = seatPos(si, ordered.length);
          // Buffer: show alive if death not yet revealed
          const displayAlive = player.isAlive || pendingDeadIds.has(player.userId);
          const displayPlayer = displayAlive === player.isAlive ? player : { ...player, isAlive: true };
          return (
            <div key={player.userId} style={{ position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)', zIndex: player.userId === game.currentPlayerId ? 5 : 2 }}>
              <PlayerSeat
                player={displayPlayer}
                isMe={player.userId === myUserId}
                isCurrent={player.userId === game.currentPlayerId}
                isEliminated={!displayPlayer.isAlive}
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
  const {
    currentParty, partyMembers,
    rouletteGame, rouletteGameOver, roulettePlayAgainPrompt,
    startRoulette, pullRouletteTrigger,
    respondToRoulettePlayAgainPrompt, clearRouletteGameOver,
  } = useSocket();

  const [bangEffect, setBangEffect] = useState(false);
  const [, setSpinCylinder] = useState(false);
  const [turnProgress, setTurnProgress] = useState(100);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [deathOverlay, setDeathOverlay] = useState<'yellow' | 'black' | null>(null);
  const [justDiedIds, setJustDiedIds] = useState<Set<string>>(new Set());
  const [pendingDeadIds, setPendingDeadIds] = useState<Set<string>>(new Set());
  const [showResult, setShowResult] = useState(false);
  const [countdownGunAngle, setCountdownGunAngle] = useState<number | null>(null);
  const [playAgainResponded, setPlayAgainResponded] = useState(false);
  const [stake, setStake] = useState(100);

  const animFrameRef = useRef<number | null>(null);
  const prevEventRef = useRef<string | null>(null);

  const myUserId = user?.id ?? '';
  const isLeader = partyMembers.find((m) => m.userId === myUserId)?.isLeader ?? false;
  const isInGame = !!rouletteGame?.players.find((p) => p.userId === myUserId);
  const myPlayer = rouletteGame?.players.find((p) => p.userId === myUserId);
  // isMyTurn: true only when it's my turn AND my death hasn't been buffered
  const isMyTurn = rouletteGame?.currentPlayerId === myUserId && (myPlayer?.isAlive || pendingDeadIds.has(myUserId) ? false : false) && myPlayer?.isAlive;

  // Gun angle pointing to current player
  const myIdx = rouletteGame ? rouletteGame.players.findIndex((p) => p.userId === myUserId) : 0;
  const orderedPlayers = rouletteGame
    ? myIdx <= 0 ? [...rouletteGame.players] : [...rouletteGame.players.slice(myIdx), ...rouletteGame.players.slice(0, myIdx)]
    : [];
  const currentSeatIdx = rouletteGame?.currentPlayerId
    ? orderedPlayers.findIndex((p) => p.userId === rouletteGame.currentPlayerId)
    : 0;
  const liveGunAngle = rouletteGame && currentSeatIdx >= 0 ? seatAngleDeg(currentSeatIdx, orderedPlayers.length) : -90;
  // During countdown: keep gun on shooter; after: point to next player
  const gunAngle = countdown !== null && countdownGunAngle !== null ? countdownGunAngle : liveGunAngle;

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

  // Shoot countdown → buffer death → reveal result → flash
  useEffect(() => {
    if (!rouletteGame?.lastEvent) return;
    const event = rouletteGame.lastEvent;
    const eventKey = `${event.type}-${event.playerId}-${rouletteGame.round}`;
    if (eventKey === prevEventRef.current) return;

    // Capture shooter's seat angle right now (before next-player state is applied)
    const myIdxLocal = rouletteGame.players.findIndex((p) => p.userId === myUserId);
    const ordLocal = myIdxLocal <= 0
      ? [...rouletteGame.players]
      : [...rouletteGame.players.slice(myIdxLocal), ...rouletteGame.players.slice(0, myIdxLocal)];
    const shooterIdx = ordLocal.findIndex((p) => p.userId === event.playerId);
    setCountdownGunAngle(shooterIdx >= 0 ? seatAngleDeg(shooterIdx, ordLocal.length) : liveGunAngle);

    // Buffer death so player doesn't appear dead during countdown
    if (event.type === 'bang') {
      setPendingDeadIds((prev) => new Set([...prev, event.playerId]));
    }

    setShowResult(false);
    setCountdown(3);
    const t1 = setTimeout(() => setCountdown(2), 1000);
    const t2 = setTimeout(() => setCountdown(1), 2000);
    const t3 = setTimeout(() => {
      setCountdown(null);
      setCountdownGunAngle(null);
      setShowResult(true);
      prevEventRef.current = eventKey;

      if (event.type === 'bang') {
        // Reveal death: remove from buffer → game state shows dead
        setPendingDeadIds((prev) => { const n = new Set(prev); n.delete(event.playerId); return n; });
        setJustDiedIds((prev) => new Set([...prev, event.playerId]));
        setBangEffect(true);
        setDeathOverlay('yellow');
        setTimeout(() => { setBangEffect(false); setDeathOverlay('black'); }, 600);
        setTimeout(() => setDeathOverlay(null), 2600);
      } else if (event.type === 'click') {
        setSpinCylinder(true);
        setTimeout(() => setSpinCylinder(false), 700);
      }
    }, 3000);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [rouletteGame?.lastEvent, rouletteGame?.round]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setPendingDeadIds(new Set());
      setShowResult(false);
      setCountdown(null);
      setCountdownGunAngle(null);
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
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Russian Roulette</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '60px 0' }}>
          <Users size={48} style={{ opacity: 0.3 }} />
          <p style={{ fontSize: 14, textAlign: 'center', maxWidth: 300, color: 'rgba(140,140,140,0.7)' }}>Tu dois être dans une party pour jouer.</p>
          <Button variant="outline" asChild><Link to="/party">Rejoindre une party</Link></Button>
        </div>
      </PageShell>
    );
  }

  return (
    <>
      {/* ─── CSS ──────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes rr-cylinder-spin {
          to { transform: rotate(1080deg); }
        }
        .rr-cylinder-spin { animation: rr-cylinder-spin 0.7s cubic-bezier(0.2,0,0.3,1) forwards; }

        @keyframes rr-gun-shake {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          20%  { transform: translate(-3px,-2px) rotate(-2deg); }
          40%  { transform: translate(3px,2px) rotate(2deg); }
          60%  { transform: translate(-3px,1px) rotate(-1deg); }
          80%  { transform: translate(2px,-1px) rotate(1deg); }
        }
        .rr-gun-shake { animation: rr-gun-shake 0.4s ease-out forwards; }

        @keyframes rr-bang-flash {
          0%   { opacity: 1; }
          60%  { opacity: 0.7; }
          100% { opacity: 0; }
        }
        .rr-bang-flash { animation: rr-bang-flash 1.1s ease-out forwards; }

        @keyframes rr-seat-pulse {
          0%,100% { box-shadow: 0 0 10px rgba(200,50,50,0.4); }
          50%      { box-shadow: 0 0 22px rgba(200,50,50,0.75); }
        }
        .rr-seat-pulse { animation: rr-seat-pulse 1.5s ease-in-out infinite; }

        @keyframes rr-event-fade {
          0%   { opacity: 0; transform: translateY(3px); }
          20%  { opacity: 1; transform: translateY(0); }
          70%  { opacity: 1; }
          100% { opacity: 0.5; }
        }
        .rr-event-fade { animation: rr-event-fade 2.2s ease forwards; }

        @keyframes rr-slide-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rr-slide-in { animation: rr-slide-in 0.3s ease forwards; }

        @keyframes rr-countdown-pop {
          0%   { opacity: 0; transform: scale(2); }
          18%  { opacity: 1; transform: scale(1); }
          72%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.6); }
        }
        .rr-countdown-num { animation: rr-countdown-pop 0.95s ease forwards; }

        @keyframes rr-name-erase {
          0%   { filter: blur(0px); letter-spacing: normal; opacity: 1; }
          40%  { filter: blur(2px); letter-spacing: 0.12em; opacity: 0.5; }
          100% { filter: blur(6px); letter-spacing: 0.45em; opacity: 0; }
        }
        .rr-name-erase { animation: rr-name-erase 1.8s 0.6s ease forwards; }
      `}</style>

      {/* ─── Death overlay ────────────────────────────────────────────────── */}
      {deathOverlay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
          background: deathOverlay === 'yellow' ? 'rgba(255,220,0,0.92)' : '#000',
          transition: deathOverlay === 'black' ? 'background 0.2s' : 'none',
        }} />
      )}

      <PageShell>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Button variant="ghost" size="icon" asChild><Link to="/games"><ArrowLeft size={18} /></Link></Button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>Russian Roulette</h1>
            <p style={{ fontSize: 11, color: 'rgba(140,140,140,0.55)', marginTop: 1 }}>Qui ose tirer le dernier ?</p>
          </div>
          {rouletteGame && (
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(140,140,140,0.6)', textAlign: 'right' }}>
              {rouletteGame.stake > 0 && <div style={{ fontWeight: 700, color: 'rgba(180,180,100,0.8)' }}>Mise : {rouletteGame.stake.toLocaleString()}$</div>}
              <div>R{rouletteGame.round} · {rouletteGame.alivePlayers}/{rouletteGame.totalPlayers}</div>
            </div>
          )}
        </div>

        {/* ── Active game ────────────────────────────────────────────────── */}
        {rouletteGame && isInGame && (
          <div className="rr-slide-in">
            <div style={{ position: 'relative', marginBottom: 12 }}>
              {countdown !== null && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
                  <span
                    key={countdown}
                    className="rr-countdown-num"
                    style={{ fontSize: 96, fontWeight: 900, fontFamily: 'monospace', color: '#fff', textShadow: '0 0 40px rgba(200,50,50,0.85), 0 0 80px rgba(180,0,0,0.5)' }}
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
                  gunAngle={gunAngle}
                  justDiedIds={justDiedIds}
                  showResult={showResult}
                  pendingDeadIds={pendingDeadIds}
                />
              </div>
            </div>

            {/* Action bar */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', padding: '10px 0' }}>
              {isMyTurn && countdown === null ? (
                <Button
                  onClick={pullRouletteTrigger}
                  style={{ background: 'hsl(var(--destructive))', color: 'hsl(var(--destructive-foreground))', fontWeight: 700, fontSize: 15, letterSpacing: 0.5, padding: '10px 36px', boxShadow: '0 0 16px rgba(180,0,0,0.35)' }}
                >
                  🔫 Tirer
                </Button>
              ) : countdown !== null ? (
                <div style={{ fontSize: 13, color: 'rgba(150,150,150,0.5)', fontStyle: 'italic', letterSpacing: 2 }}>· · ·</div>
              ) : myPlayer && !myPlayer.isAlive ? (
                <div style={{ fontSize: 13, color: 'rgba(120,80,80,0.7)', fontStyle: 'italic' }}>
                  Tu es éliminé. Regarde les survivants...
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

        {/* ── Game over ──────────────────────────────────────────────────── */}
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
                  <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{p.isAlive ? '🏆' : '💀'}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.username}</span>
                  <span style={{ fontSize: 11, color: 'rgba(140,140,140,0.7)' }}>{p.isAlive ? 'SURVIT' : `${p.pullCount}×`}</span>
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

        {/* ── Lobby ──────────────────────────────────────────────────────── */}
        {!rouletteGame && !rouletteGameOver && (
          <div className="rr-slide-in" style={{ border: '1px solid hsl(var(--border))', borderRadius: 14, padding: '28px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔫</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Russian Roulette</h2>
            <p style={{ fontSize: 13, color: 'rgba(140,140,140,0.7)', maxWidth: 320, margin: '0 auto 20px', lineHeight: 1.6 }}>
              2 à 6 joueurs. À tour de rôle, chacun tire. Le dernier en vie gagne la mise.
            </p>

            {/* Players */}
            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {partyMembers.map((m) => (
                <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'hsl(var(--muted))', borderRadius: 8, padding: '5px 10px', border: '1px solid hsl(var(--border))', fontSize: 12 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.isLeader ? 'hsl(var(--primary))' : 'rgba(100,100,100,0.6)' }} />
                  <UsernameDisplay username={m.username} usernameColor={m.usernameColor} usernameClassName="text-xs" />
                  {m.isLeader && <span style={{ fontSize: 9, color: 'rgba(140,140,140,0.7)', fontWeight: 600 }}>LEADER</span>}
                </div>
              ))}
            </div>

            {/* Stake input */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: 'rgba(180,180,180,0.8)', fontWeight: 600 }}>Mise :</label>
              {isLeader ? (
                <input
                  type="number"
                  min={0}
                  max={100000}
                  step={50}
                  value={stake}
                  onChange={(e) => setStake(Math.max(0, Math.min(100000, parseInt(e.target.value) || 0)))}
                  style={{
                    width: 100, padding: '6px 10px', borderRadius: 8, fontSize: 14, fontWeight: 700, textAlign: 'center',
                    background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))',
                    outline: 'none',
                  }}
                />
              ) : (
                <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(180,180,100,0.9)' }}>{stake}$</span>
              )}
              <span style={{ fontSize: 13, color: 'rgba(140,140,140,0.6)' }}>$</span>
            </div>

            {isLeader ? (
              <Button onClick={() => startRoulette(stake)} style={{ gap: 8 }}>
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { ArrowLeft, Clock, LogOut, Play, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Card as UICard, CardContent } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';
import { UsernameDisplay } from '@/components/ui/username-display';

const ACTION_TIME_LIMIT = 25000;

// ─── Suit config ─────────────────────────────────────────────────────────────
const SUIT_SYMBOL: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLOR: Record<string, string> = { h: '#e03030', d: '#e03030', c: '#111', s: '#111' };

// ─── Card sizes ───────────────────────────────────────────────────────────────
const CARD_SIZE = {
  sm: { w: 32, h: 48, rank: 9,  suit: 8,  center: 16 },
  md: { w: 42, h: 62, rank: 12, suit: 10, center: 22 },
  lg: { w: 58, h: 84, rank: 15, suit: 12, center: 30 },
};

// ─── PlayingCard ──────────────────────────────────────────────────────────────
function PlayingCard({
  card,
  muted = false,
  size = 'md',
  animClass,
  delay = 0,
}: {
  card: string;
  muted?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animClass?: string;
  delay?: number;
}) {
  const s = CARD_SIZE[size];

  const base: React.CSSProperties = {
    width: s.w,
    height: s.h,
    borderRadius: 6,
    flexShrink: 0,
    animationDelay: delay ? `${delay}ms` : undefined,
  };

  if (!card) {
    return (
      <div
        style={{
          ...base,
          border: '2px dashed rgba(255,255,255,0.18)',
          background: 'transparent',
        }}
      />
    );
  }

  if (card === '??') {
    return (
      <div
        className={animClass}
        style={{
          ...base,
          background: 'linear-gradient(145deg, #1e2d6e 0%, #0d1b4a 100%)',
          border: '2px solid rgba(255,255,255,0.15)',
          boxShadow: '0 3px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 3,
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.1)',
            backgroundImage:
              'repeating-linear-gradient(45deg,rgba(255,255,255,0.05) 0,rgba(255,255,255,0.05) 1px,transparent 1px,transparent 9px)',
          }}
        />
      </div>
    );
  }

  const rank = card[0];
  const suit = card[1];
  const color = SUIT_COLOR[suit] ?? '#111';

  return (
    <div
      className={animClass}
      style={{
        ...base,
        background: '#fff',
        border: '1px solid #ccc',
        boxShadow: '0 3px 10px rgba(0,0,0,0.4)',
        padding: 3,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        opacity: muted ? 0.3 : 1,
      }}
    >
      <div style={{ color, lineHeight: 1 }}>
        <div style={{ fontSize: s.rank, fontWeight: 800 }}>{rank}</div>
        <div style={{ fontSize: s.suit, marginTop: -2 }}>{SUIT_SYMBOL[suit]}</div>
      </div>
      <div style={{ textAlign: 'center', fontSize: s.center, color }}>{SUIT_SYMBOL[suit]}</div>
      <div style={{ color, lineHeight: 1, transform: 'rotate(180deg)', alignSelf: 'flex-end' }}>
        <div style={{ fontSize: s.rank, fontWeight: 800 }}>{rank}</div>
        <div style={{ fontSize: s.suit, marginTop: -2 }}>{SUIT_SYMBOL[suit]}</div>
      </div>
    </div>
  );
}

// ─── Chip colours ─────────────────────────────────────────────────────────────
const CHIP_TIERS = [
  { min: 1000, bg: '#f0c040', ring: '#b89000' },
  { min: 500,  bg: '#a855f7', ring: '#7e22ce' },
  { min: 100,  bg: '#374151', ring: '#111827' },
  { min: 25,   bg: '#16a34a', ring: '#14532d' },
  { min: 10,   bg: '#2563eb', ring: '#1e3a8a' },
  { min: 5,    bg: '#dc2626', ring: '#7f1d1d' },
  { min: 1,    bg: '#9ca3af', ring: '#6b7280' },
];

function chipColor(amount: number) {
  return CHIP_TIERS.find((t) => amount >= t.min) ?? CHIP_TIERS[CHIP_TIERS.length - 1];
}

function ChipStack({ amount, label, className: cn_ }: { amount: number; label?: string; className?: string }) {
  if (amount <= 0) return null;
  const c = chipColor(amount);
  const layers = Math.min(4, 1 + Math.floor(Math.log10(amount + 1)));
  return (
    <div className={cn_} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <div style={{ position: 'relative', width: 18, height: 18 + layers * 3 }}>
        {Array.from({ length: layers }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: c.bg,
              border: `2px solid ${c.ring}`,
              bottom: i * 3,
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
          >
            {i === layers - 1 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 3,
                  borderRadius: '50%',
                  border: `1px solid rgba(255,255,255,0.3)`,
                }}
              />
            )}
          </div>
        ))}
      </div>
      <span
        style={{
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          lineHeight: 1,
        }}
      >
        {label ?? amount}
      </span>
    </div>
  );
}

// ─── Role token (D / SB / BB) ─────────────────────────────────────────────────
function RoleToken({ label, bg }: { label: string; bg: string }) {
  return (
    <div
      style={{
        width: 17,
        height: 17,
        borderRadius: '50%',
        background: bg,
        color: '#fff',
        fontSize: 7,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(255,255,255,0.35)',
        flexShrink: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }}
    >
      {label}
    </div>
  );
}

// ─── Seat positions (ellipse formula) ─────────────────────────────────────────
function seatPos(seatIndex: number, total: number) {
  const cx = 50, cy = 50, rx = 43, ry = 37;
  const deg = 90 - seatIndex * (360 / total);
  const rad = (deg * Math.PI) / 180;
  return { left: `${cx + rx * Math.cos(rad)}%`, top: `${cy + ry * Math.sin(rad)}%` };
}

// ─── Turn timer ring (SVG) ────────────────────────────────────────────────────
function TurnTimerRing({ progress }: { progress: number }) {
  const r = 28, stroke = 3, c = 2 * Math.PI * r;
  return (
    <svg
      width={r * 2 + stroke * 2}
      height={r * 2 + stroke * 2}
      style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%) rotate(-90deg)', pointerEvents: 'none' }}
    >
      <circle cx={r + stroke} cy={r + stroke} r={r} fill="none" stroke="rgba(255,200,0,0.15)" strokeWidth={stroke} />
      <circle
        cx={r + stroke}
        cy={r + stroke}
        r={r}
        fill="none"
        stroke="rgba(255,200,0,0.9)"
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress / 100)}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.12s linear' }}
      />
    </svg>
  );
}

// ─── PlayerSeat ───────────────────────────────────────────────────────────────
interface SeatPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  hand: string[];
  chips: number;
  bet: number;
  hasFolded: boolean;
  isAllIn: boolean;
  lastAction?: string;
  isEliminated?: boolean;
}

function PlayerSeat({
  player,
  isDealer,
  isSB,
  isBB,
  isTurn,
  isMe,
  showHand,
  newlyRevealedIndexes,
  newHand,
  turnProgress,
}: {
  player: SeatPlayer;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  isTurn: boolean;
  isMe: boolean;
  showHand: boolean;
  newlyRevealedIndexes: Set<number>;
  newHand: boolean;
  turnProgress: number;
}) {
  const cards: string[] = showHand ? (player.hand ?? ['??', '??']) : ['??', '??'];

  const borderColor = isTurn
    ? 'rgba(255,200,0,0.9)'
    : isMe
    ? 'rgba(120,200,255,0.5)'
    : player.hasFolded
    ? 'rgba(255,255,255,0.1)'
    : 'rgba(255,255,255,0.2)';

  const plateBg = isTurn
    ? 'rgba(60,50,0,0.85)'
    : isMe
    ? 'rgba(0,40,80,0.85)'
    : 'rgba(0,0,0,0.72)';

  const lastActionColor =
    player.lastAction === 'fold'
      ? '#f87171'
      : player.lastAction === 'raise' || player.lastAction === 'bet'
      ? '#fbbf24'
      : '#86efac';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        transform: 'translate(-50%, -50%)',
        opacity: player.isEliminated ? 0.35 : 1,
        pointerEvents: player.isEliminated ? 'none' : undefined,
      }}
    >
      {!isMe && (
        <div style={{ display: 'flex', gap: 3 }}>
          {cards.map((c, i) => (
            <PlayingCard
              key={`${c}-${i}`}
              card={c}
              size="sm"
              muted={player.hasFolded}
              animClass={
                newlyRevealedIndexes.has(i)
                  ? 'poker-reveal'
                  : newHand
                  ? 'poker-deal'
                  : undefined
              }
              delay={newHand ? i * 120 : 0}
            />
          ))}
        </div>
      )}

      <div
        className={isTurn ? 'poker-pulse' : undefined}
        style={{
          background: plateBg,
          backdropFilter: 'blur(6px)',
          border: `2px solid ${borderColor}`,
          borderRadius: 9,
          padding: '5px 9px',
          minWidth: 82,
          textAlign: 'center',
          position: 'relative',
          boxShadow: isTurn ? '0 0 16px rgba(255,200,0,0.4)' : '0 2px 8px rgba(0,0,0,0.5)',
        }}
      >
        {isTurn && isMe && <TurnTimerRing progress={turnProgress} />}

        {(isDealer || isSB || isBB) && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginBottom: 3 }}>
            {isDealer && <RoleToken label="D" bg="#1a56db" />}
            {isSB && <RoleToken label="SB" bg="#9f1239" />}
            {isBB && <RoleToken label="BB" bg="#065f46" />}
          </div>
        )}

        <UsernameDisplay
          username={player.username}
          usernameColor={player.usernameColor}
          showLabel={false}
          className="text-[11px] font-semibold justify-center"
        />

        <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center' }}>
          <ChipStack amount={player.chips} />
        </div>

        {player.bet > 0 && (
          <div style={{ fontSize: 9, color: 'rgba(255,220,100,0.85)', marginTop: 2 }}>
            Mise: {player.bet}
          </div>
        )}

        {player.lastAction && !player.isAllIn && (
          <div style={{ fontSize: 9, color: lastActionColor, marginTop: 2, fontStyle: 'italic' }}>
            {player.lastAction}
          </div>
        )}
        {player.isAllIn && (
          <div style={{ fontSize: 9, color: '#fbbf24', fontWeight: 800, marginTop: 2 }}>
            ALL-IN
          </div>
        )}
      </div>

      {isMe && (
        <div style={{ display: 'flex', gap: 3 }}>
          {cards.map((c, i) => (
            <PlayingCard
              key={`${c}-${i}`}
              card={c}
              size="sm"
              muted={player.hasFolded}
              animClass={newHand ? 'poker-deal' : undefined}
              delay={newHand ? i * 120 : 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Poker table view ─────────────────────────────────────────────────────────
interface PokerGame {
  players: SeatPlayer[];
  communityCards: string[];
  pot: number;
  stage: string;
  dealerId: string;
  smallBlindId: string;
  bigBlindId: string;
  currentPlayerId: string;
  handNumber: number;
  maxHands: number;
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
  highestBet: number;
  minRaiseTo: number;
  callAmount: number;
  availableActions: string[];
  turnEndsAt?: number;
  lastHandResult?: { winners: { username: string }[]; pot: number } | null;
  yourHand?: string[];
}

function PokerTableView({
  game,
  myUserId,
  turnProgress,
}: {
  game: PokerGame;
  myUserId: string;
  turnProgress: number;
}) {
  const prevCommunityRef = useRef<string[]>([]);
  const prevHandNumberRef = useRef<number>(game.handNumber);

  const [revealedComm, setRevealedComm] = useState<Set<number>>(new Set());
  const [newHand, setNewHand] = useState(false);

  useEffect(() => {
    if (game.handNumber !== prevHandNumberRef.current) {
      prevHandNumberRef.current = game.handNumber;
      setNewHand(true);
      const t = setTimeout(() => setNewHand(false), 1000);
      return () => clearTimeout(t);
    }
  }, [game.handNumber]);

  useEffect(() => {
    const prev = prevCommunityRef.current;
    const curr = game.communityCards;
    const revealed = new Set<number>();
    curr.forEach((c, i) => {
      if (c && c !== '??' && (!prev[i] || prev[i] === '??')) revealed.add(i);
    });
    if (revealed.size) {
      setRevealedComm(revealed);
      const t = setTimeout(() => setRevealedComm(new Set()), 700);
      prevCommunityRef.current = [...curr];
      return () => clearTimeout(t);
    }
    prevCommunityRef.current = [...curr];
  }, [game.communityCards.join(',')]);

  const myIdx = game.players.findIndex((p) => p.userId === myUserId);
  const ordered =
    myIdx <= 0
      ? [...game.players]
      : [...game.players.slice(myIdx), ...game.players.slice(0, myIdx)];

  const stageLabel: Record<string, string> = {
    preflop: 'Préflop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown',
  };

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '58%', userSelect: 'none' }}>
      {/* outer rail */}
      <div style={{ position: 'absolute', left: '7%', top: '8%', width: '86%', height: '84%', borderRadius: '50%', background: '#3d2010', boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }} />
      {/* inner rail */}
      <div style={{ position: 'absolute', left: '8%', top: '9.5%', width: '84%', height: '81%', borderRadius: '50%', background: '#5c3317' }} />
      {/* felt */}
      <div
        style={{
          position: 'absolute', left: '10%', top: '12%', width: '80%', height: '76%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 40% 35%, #2d7a54 0%, #1e5c3c 45%, #133d28 80%, #0a2518 100%)',
          boxShadow: 'inset 0 0 50px rgba(0,0,0,0.45)',
        }}
      >
        {/* center: stage / community cards / pot */}
        <div
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -56%)',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}
        >
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {stageLabel[game.stage] ?? game.stage}
          </div>

          <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <PlayingCard
                key={i}
                card={game.communityCards[i] ?? ''}
                size="md"
                animClass={revealedComm.has(i) ? 'poker-reveal' : undefined}
                delay={revealedComm.has(i) ? i * 80 : 0}
              />
            ))}
          </div>

          {game.pot > 0 && (
            <div
              className="poker-chip-in"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.45)', borderRadius: 20, padding: '4px 10px' }}
            >
              <ChipStack amount={game.pot} label={`Pot: ${game.pot}`} />
            </div>
          )}

          {game.lastHandResult && (
            <div style={{ fontSize: 10, color: 'rgba(255,220,100,0.9)', background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '3px 8px', maxWidth: 200, textAlign: 'center' }}>
              {game.lastHandResult.winners.map((w) => w.username).join(', ')} +{game.lastHandResult.pot}
            </div>
          )}
        </div>
      </div>

      {/* player seats */}
      {ordered.map((player, si) => {
        const pos = seatPos(si, ordered.length);
        const isMe = player.userId === myUserId;
        const showHand = game.stage === 'showdown' || isMe;
        const revealedHoleIdxs = new Set<number>();
        if (game.stage === 'showdown' && !isMe) {
          (player.hand ?? []).forEach((c, i) => { if (c && c !== '??') revealedHoleIdxs.add(i); });
        }
        return (
          <div key={player.userId} style={{ position: 'absolute', left: pos.left, top: pos.top }}>
            <PlayerSeat
              player={player}
              isDealer={game.dealerId === player.userId}
              isSB={game.smallBlindId === player.userId}
              isBB={game.bigBlindId === player.userId}
              isTurn={game.currentPlayerId === player.userId}
              isMe={isMe}
              showHand={showHand}
              newlyRevealedIndexes={revealedHoleIdxs}
              newHand={newHand}
              turnProgress={isMe && game.currentPlayerId === player.userId ? turnProgress : 100}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Poker page ──────────────────────────────────────────────────────────
export default function Poker() {
  const { user } = useAuth();
  const {
    currentParty,
    partyMembers,
    pokerGame,
    pokerGameOver,
    startPoker,
    actInPoker,
    leavePoker,
    clearPokerGameOver,
  } = useSocket();

  const [startStack, setStartStack] = useState(800);
  const [bigBlind, setBigBlind] = useState(20);
  const [raiseTarget, setRaiseTarget] = useState(0);
  const [turnProgress, setTurnProgress] = useState(100);

  const me = useMemo(
    () => pokerGame?.players.find((p) => p.userId === user?.id),
    [pokerGame, user?.id],
  );
  const isLeader = useMemo(
    () => partyMembers.some((m) => m.userId === user?.id && m.isLeader),
    [partyMembers, user?.id],
  );
  const isMyTurn = pokerGame?.currentPlayerId === user?.id;
  const canAct = isMyTurn && (pokerGame?.availableActions?.length ?? 0) > 0;
  const maxBet = me ? me.bet + me.chips : 0;
  const callAmount = pokerGame?.callAmount ?? 0;
  const minRaiseTarget = pokerGame ? Math.min(maxBet, pokerGame.minRaiseTo) : 0;

  const stageLabel: Record<string, string> = {
    preflop: 'Préflop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown',
  };

  useEffect(() => {
    if (!pokerGame?.turnEndsAt) { setTurnProgress(100); return; }
    const iv = setInterval(() => {
      const rem = (pokerGame.turnEndsAt ?? Date.now()) - Date.now();
      setTurnProgress(Math.max(0, Math.min(100, (rem / ACTION_TIME_LIMIT) * 100)));
    }, 120);
    return () => clearInterval(iv);
  }, [pokerGame?.turnEndsAt]);

  useEffect(() => {
    if (!pokerGame || !me) return;
    const suggested = Math.max(0, Math.min(me.bet + me.chips, pokerGame.minRaiseTo || 0));
    setRaiseTarget(suggested || me.bet + me.chips);
  }, [pokerGame?.handNumber, pokerGame?.currentPlayerId, pokerGame?.minRaiseTo, me?.bet, me?.chips]);

  const handleCallOrCheck = () => {
    if (!pokerGame) return;
    actInPoker(callAmount > 0 ? 'call' : 'check');
  };
  const handleRaise = () => {
    if (!pokerGame) return;
    actInPoker(pokerGame.highestBet === 0 ? 'bet' : 'raise', raiseTarget);
  };

  // ── No party ──
  if (!currentParty) {
    return (
      <PageShell>
        <PageHeader
          title="Poker"
          description="Hold'em minimaliste en party, blindes fixes et rounds rapides."
          actions={(
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Jeux
              </Link>
            </Button>
          )}
        />
        <UICard>
          <CardContent className="py-14 text-center space-y-6">
            <p className="text-sm text-muted-foreground">
              Crée ou rejoins une party pour lancer une table de poker.
            </p>
            <Button asChild>
              <Link to="/party" className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" />
                Aller aux parties
              </Link>
            </Button>
          </CardContent>
        </UICard>
      </PageShell>
    );
  }

  const myHand = pokerGame?.yourHand?.length ? pokerGame.yourHand : me?.hand ?? [];
  const canRaise =
    !!canAct &&
    pokerGame?.availableActions.includes(pokerGame.highestBet === 0 ? 'bet' : 'raise');
  const canCall = !!canAct && pokerGame?.availableActions.includes('call');
  const canCheck = !!canAct && pokerGame?.availableActions.includes('check');
  const lobby = !pokerGame;

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Poker"
        description={`Party: ${currentParty.name || 'Sans nom'}`}
        actions={(
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Jeux
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={leavePoker}>
              <LogOut className="h-4 w-4" />
              Quitter
            </Button>
          </>
        )}
      />

      {lobby ? (
        /* ── Lobby ── */
        <div className="space-y-6">
          <UICard>
            <CardContent className="p-6 space-y-2">
              <h2 className="text-sm text-muted-foreground">
                Joueurs dans la party ({partyMembers.length})
              </h2>
              <div>
                {partyMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-foreground/50" />
                      <div>
                        <UsernameDisplay
                          username={member.username}
                          usernameColor={member.usernameColor}
                          showLabel={false}
                          className="font-medium"
                        />
                        {member.isLeader && (
                          <p className="text-xs text-muted-foreground">Leader</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </UICard>

          <UICard>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Paramètres rapides</p>
                  <h3 className="text-xl font-semibold">Démarrer une table</h3>
                </div>
                {isLeader && (
                  <Button onClick={() => startPoker(startStack, bigBlind)} className="gap-2">
                    <Play className="h-4 w-4" />
                    Lancer
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className="text-xs text-muted-foreground">Stack de départ</span>
                  <Input
                    type="number"
                    min={200}
                    max={2000}
                    value={startStack}
                    onChange={(e) => setStartStack(parseInt(e.target.value || '0', 10))}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs text-muted-foreground">Big blind</span>
                  <Input
                    type="number"
                    min={10}
                    max={startStack / 2}
                    value={bigBlind}
                    onChange={(e) => setBigBlind(parseInt(e.target.value || '0', 10))}
                  />
                </label>
              </div>
              {!isLeader && (
                <p className="text-sm text-muted-foreground">
                  En attente que le leader démarre la partie.
                </p>
              )}
            </CardContent>
          </UICard>
        </div>
      ) : (
        /* ── Game ── */
        <div className="space-y-4">
          {/* Info bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded border border-border font-medium">
              {stageLabel[pokerGame.stage] ?? pokerGame.stage}
            </span>
            <span>
              Blindes <strong className="text-foreground">{pokerGame.smallBlind}/{pokerGame.bigBlind}</strong>
            </span>
            <span>
              Manche <strong className="text-foreground">{pokerGame.handNumber}</strong>/{pokerGame.maxHands}
            </span>
            {isMyTurn && (
              <span className="flex items-center gap-1 text-amber-500 font-semibold">
                <Clock className="h-3 w-3" />
                {Math.max(0, Math.round((turnProgress / 100) * ACTION_TIME_LIMIT / 1000))}s
              </span>
            )}
          </div>

          {/* ── Poker table ── */}
          <PokerTableView
            game={pokerGame as unknown as PokerGame}
            myUserId={user?.id ?? ''}
            turnProgress={turnProgress}
          />

          {/* ── My action panel ── */}
          {me && !me.isEliminated && (
            <UICard>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Vos cartes</div>
                    <div className="flex gap-2">
                      {(myHand ?? []).map((card, i) => (
                        <PlayingCard key={i} card={card} size="lg" muted={me.hasFolded} />
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-sm space-y-1">
                    <div className="flex items-center justify-end gap-2">
                      <ChipStack amount={me.chips} />
                    </div>
                    {me.bet > 0 && (
                      <div className="text-xs text-muted-foreground">Engagé: {me.bet}</div>
                    )}
                  </div>
                </div>

                {isMyTurn && (
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all"
                      style={{ width: `${turnProgress}%` }}
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => actInPoker('fold')}
                    disabled={!canAct}
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Se coucher
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={handleCallOrCheck}
                    disabled={!canAct || (!canCall && !canCheck)}
                    className={cn(canAct && (canCall || canCheck) && 'ring-2 ring-green-500/50')}
                  >
                    {callAmount > 0 ? `Suivre (${callAmount})` : 'Check'}
                  </Button>

                  <div className="flex-1 min-w-[200px] space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{pokerGame.highestBet === 0 ? 'Miser' : 'Relancer'} à</span>
                      <span className="font-semibold text-foreground">{Math.round(raiseTarget)}</span>
                    </div>
                    <Slider
                      value={[Math.min(raiseTarget, maxBet)]}
                      min={Math.min(minRaiseTarget ?? 0, maxBet)}
                      max={Math.max(minRaiseTarget ?? 0, maxBet)}
                      step={5}
                      onValueChange={(v) => setRaiseTarget(v[0])}
                      disabled={!canRaise || maxBet <= 0}
                    />
                  </div>

                  <Button onClick={handleRaise} disabled={!canRaise || maxBet <= 0}>
                    {pokerGame.highestBet === 0 ? 'Miser' : 'Relancer'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => actInPoker('all-in')}
                    disabled={!canAct || me.chips <= 0}
                    className="text-amber-500 border-amber-500/40 hover:bg-amber-500/10"
                  >
                    All-in
                  </Button>
                </div>
              </CardContent>
            </UICard>
          )}
        </div>
      )}

      {/* ── Game over ── */}
      <Dialog open={!!pokerGameOver}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Partie terminée</DialogTitle>
          </DialogHeader>
          {pokerGameOver && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Vainqueur : {pokerGameOver.winnerUsername ?? 'aucun'}
              </p>
              <div className="space-y-2">
                {pokerGameOver.standings.map((s: { userId: string; username: string; chips: number }) => (
                  <div key={s.userId} className="flex items-center justify-between text-sm">
                    <UsernameDisplay username={s.username} showLabel={false} />
                    <span className="font-semibold">{s.chips}</span>
                  </div>
                ))}
              </div>
              <DialogFooter className="flex justify-end">
                <Button variant="outline" onClick={clearPokerGameOver}>
                  Fermer
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

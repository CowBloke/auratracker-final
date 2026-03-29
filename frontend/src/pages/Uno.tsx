import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocketBase } from '../contexts/SocketContext';
import { useChatSocket } from '../contexts/ChatSocketContext';
import { usePartySocket } from '../contexts/PartySocketContext';
import { useDuelSocket } from '../contexts/DuelSocketContext';
import {
  ArrowLeft, Play, LogOut, Swords, Trophy, RotateCcw,
  ChevronDown, ChevronUp, AlertCircle, Zap,
} from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { UsernameDisplay } from '@/components/ui/username-display';
import { cn } from '@/lib/utils';
import { DuelPlayerSelectionModal } from '@/components/game/DuelPlayerSelectionModal';

// ─── Types ───────────────────────────────────────────────────────────────────

type CardColor = 'red' | 'green' | 'blue' | 'yellow' | 'wild';
type CardValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

interface UnoCard {
  id: string;
  color: CardColor;
  value: CardValue;
}

interface PlayerInfo {
  userId: string;
  username: string;
  usernameColor?: string | null;
  playerIndex: number;
  handCount: number;
  calledUno: boolean;
}

interface LastAction {
  type: 'played' | 'drew' | 'challenged' | 'uno-called' | 'caught';
  userId: string;
  username: string;
  card?: UnoCard;
  count?: number;
  chosenColor?: CardColor;
}

interface ChallengeWindowInfo {
  challengedUserId: string;
  targetUserId: string;
  timeLimit: number;
  startTime: number;
}

interface GameState {
  partyId: string;
  players: PlayerInfo[];
  topCard: UnoCard;
  deckCount: number;
  myHand: UnoCard[];
  currentPlayerId: string;
  direction: 1 | -1;
  pendingDraw: number;
  pendingDrawType: 'draw2' | 'wild4' | null;
  chosenColor: CardColor | null;
  phase: 'playing' | 'finished';
  winnerId: string | null;
  turnDuration: number;
  turnStartTime: number;
  lastAction: LastAction | null;
  challengeWindow: ChallengeWindowInfo | null;
}

interface GameOverData {
  winnerId: string;
  winnerUsername: string;
  rewards: {
    winner: { aura: number; money: number };
    other: { aura: number; money: number };
  };
}

interface PlayAgainPrompt {
  partyId: string;
  players: Array<{ userId: string; username: string; usernameColor?: string | null }>;
  timeLimit: number;
  startTime: number;
  responses: Array<{ userId: string; playAgain: boolean }>;
}

// ─── Card rendering helpers ───────────────────────────────────────────────────

const COLOR_BG: Record<CardColor, string> = {
  red: 'bg-red-500',
  green: 'bg-green-500',
  blue: 'bg-blue-600',
  yellow: 'bg-yellow-400',
  wild: 'bg-zinc-800',
};

const COLOR_BORDER: Record<CardColor, string> = {
  red: 'border-red-700',
  green: 'border-green-700',
  blue: 'border-blue-800',
  yellow: 'border-yellow-600',
  wild: 'border-zinc-600',
};

function cardLabel(value: CardValue): string {
  if (value === 'skip') return '⊘';
  if (value === 'reverse') return '⇄';
  if (value === 'draw2') return '+2';
  if (value === 'wild') return 'W';
  if (value === 'wild4') return '+4';
  return value;
}

interface UnoCardProps {
  card: UnoCard;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  faceDown?: boolean;
  className?: string;
}

function UnoCardEl({ card, size = 'md', onClick, disabled, selected, faceDown, className }: UnoCardProps) {
  const sizes = {
    xs: 'w-8 h-12 text-xs rounded',
    sm: 'w-10 h-14 text-sm rounded-md',
    md: 'w-14 h-20 text-base rounded-lg',
    lg: 'w-16 h-24 text-lg rounded-xl',
  };
  const sizeClass = sizes[size];

  if (faceDown) {
    return (
      <div
        className={cn(
          sizeClass,
          'bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center',
          'shadow-md cursor-default select-none flex-shrink-0',
          className,
        )}
      >
        <span className="font-black text-white text-opacity-40 tracking-tighter" style={{ fontSize: '0.6em' }}>UNO</span>
      </div>
    );
  }

  const isWild = card.color === 'wild';

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={cn(
        sizeClass,
        'relative border-2 flex flex-col items-center justify-center cursor-pointer select-none flex-shrink-0',
        'font-bold transition-all duration-150',
        isWild ? 'border-zinc-600' : COLOR_BORDER[card.color],
        selected
          ? 'ring-2 ring-white ring-offset-1 ring-offset-background -translate-y-3 scale-105'
          : disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:-translate-y-2 hover:scale-105 active:scale-95',
        'shadow-lg',
        className,
      )}
      style={
        isWild
          ? {
              background: 'linear-gradient(135deg, #ef4444 0%, #ef4444 25%, #3b82f6 25%, #3b82f6 50%, #22c55e 50%, #22c55e 75%, #eab308 75%, #eab308 100%)',
            }
          : undefined
      }
    >
      {!isWild && (
        <div className={cn('absolute inset-0 rounded-[inherit]', COLOR_BG[card.color])} />
      )}

      {/* Inner oval */}
      {!isWild && (
        <div
          className="absolute inset-1 rounded-full opacity-20 bg-white"
          style={{ transform: 'rotate(-30deg) scaleX(0.6)' }}
        />
      )}

      {/* Center label */}
      <span
        className={cn(
          'relative z-10 font-black leading-none drop-shadow',
          isWild ? 'text-white' : 'text-white',
          size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-sm' : 'text-lg',
        )}
      >
        {cardLabel(card.value)}
      </span>

      {/* Corner labels */}
      {size !== 'xs' && (
        <>
          <span className="absolute top-0.5 left-1 text-white font-black leading-none z-10"
            style={{ fontSize: '0.55em' }}>
            {cardLabel(card.value)}
          </span>
          <span className="absolute bottom-0.5 right-1 text-white font-black leading-none z-10 rotate-180"
            style={{ fontSize: '0.55em' }}>
            {cardLabel(card.value)}
          </span>
        </>
      )}
    </div>
  );
}

// ─── Color picker ─────────────────────────────────────────────────────────────

const COLORS: CardColor[] = ['red', 'green', 'blue', 'yellow'];
const COLOR_NAMES: Record<CardColor, string> = {
  red: 'Rouge', green: 'Vert', blue: 'Bleu', yellow: 'Jaune', wild: 'Wild',
};

interface ColorPickerProps {
  open: boolean;
  onPick: (color: CardColor) => void;
}

function ColorPicker({ open, onPick }: ColorPickerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4 w-72">
        <p className="text-center font-semibold text-sm">Choisir une couleur</p>
        <div className="grid grid-cols-2 gap-3">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => onPick(c)}
              className={cn(
                'py-3 rounded-xl font-bold text-white text-sm transition-all',
                'hover:scale-105 active:scale-95 shadow-md',
                c === 'red' && 'bg-red-500 hover:bg-red-400',
                c === 'green' && 'bg-green-500 hover:bg-green-400',
                c === 'blue' && 'bg-blue-600 hover:bg-blue-500',
                c === 'yellow' && 'bg-yellow-400 hover:bg-yellow-300 text-black',
              )}
            >
              {COLOR_NAMES[c]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Small color dot ──────────────────────────────────────────────────────────

const DOT_BG: Record<CardColor, string> = {
  red: 'bg-red-500',
  green: 'bg-green-500',
  blue: 'bg-blue-600',
  yellow: 'bg-yellow-400',
  wild: 'bg-zinc-500',
};

// ─── Player seat (around the table) ──────────────────────────────────────────

interface SeatProps {
  player: PlayerInfo;
  isMe: boolean;
  isCurrentTurn: boolean;
  position: 'top' | 'left' | 'right';
  onCatch: () => void;
  canCatch: boolean;
}

function OpponentSeat({ player, isMe: _isMe, isCurrentTurn, position, onCatch, canCatch }: SeatProps) {
  const cardCount = Math.min(player.handCount, 12);

  const posClasses = {
    top: 'flex-col items-center',
    left: 'flex-col items-center',
    right: 'flex-col items-center',
  };

  return (
    <div className={cn('flex gap-2', posClasses[position])}>
      {/* Mini face-down hand */}
      <div className="flex items-center justify-center" style={{ height: 28 }}>
        {Array.from({ length: Math.min(cardCount, 8) }, (_, i) => (
          <div
            key={i}
            className="w-5 h-7 bg-zinc-700 border border-zinc-600 rounded-sm shadow"
            style={{ marginLeft: i === 0 ? 0 : -8, zIndex: i }}
          />
        ))}
        {cardCount > 8 && (
          <span className="text-xs text-muted-foreground ml-1">+{cardCount - 8}</span>
        )}
      </div>

      {/* Name + badges */}
      <div
        className={cn(
          'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl border transition-colors text-xs',
          isCurrentTurn
            ? 'border-foreground/60 bg-muted/50 shadow-sm'
            : 'border-border/40 bg-background/60',
        )}
      >
        <UsernameDisplay username={player.username} usernameColor={player.usernameColor} className="text-xs" />
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">{player.handCount} carte{player.handCount !== 1 ? 's' : ''}</span>
          {player.calledUno && (
            <span className="text-red-400 font-bold text-xs">UNO!</span>
          )}
        </div>
        {canCatch && (
          <Button
            size="sm"
            variant="destructive"
            className="h-5 text-xs px-2 mt-0.5 animate-pulse"
            onClick={onCatch}
          >
            Attraper!
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function Uno() {
  const { user, refreshUser } = useAuth();
  const { socket } = useSocketBase();
  const { onlineUsers, requestOnlineUsers } = useChatSocket();
  const { currentParty, partyMembers } = usePartySocket();
  const { challengeUserToDuel, outgoingDuelChallenge } = useDuelSocket();

  const [showChallengePicker, setShowChallengePicker] = useState(false);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [playAgainPrompt, setPlayAgainPrompt] = useState<PlayAgainPrompt | null>(null);

  // Color picker for wild
  const [pendingWildCard, setPendingWildCard] = useState<UnoCard | null>(null);

  // Selected card in hand
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  // UNO button highlight
  const [unoFlash, setUnoFlash] = useState(false);

  // Challenge result toast
  const [challengeResult, setChallengeResult] = useState<{ challengerWon: boolean; msg: string } | null>(null);
  const challengeResultRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Turn timer
  const [turnTimeLeftMs, setTurnTimeLeftMs] = useState(0);
  // Challenge window timer
  const [challengeTimeLeftMs, setChallengeTimeLeftMs] = useState(0);

  // UNO announce toast
  const [unoToast, setUnoToast] = useState<string | null>(null);
  const unoToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Card play animation: last played card visually
  const lastActionKeyRef = useRef<string>('');

  const isLeader = partyMembers.find(m => m.userId === user?.id)?.isLeader;
  const isMyTurn = gameState?.currentPlayerId === user?.id && gameState?.phase === 'playing';
  const myInfo = gameState?.players.find(p => p.userId === user?.id);
  const turnSecondsLeft = Math.max(0, Math.ceil(turnTimeLeftMs / 1000));
  const challengeSecondsLeft = Math.max(0, Math.ceil(challengeTimeLeftMs / 1000));

  const hasChallengeWindow =
    gameState?.challengeWindow?.targetUserId === user?.id;

  // Compute which cards are playable in my hand
  const playableIds = new Set<string>();
  if (gameState && isMyTurn && !hasChallengeWindow) {
    const { topCard, chosenColor, pendingDraw, pendingDrawType } = gameState;
    for (const c of gameState.myHand) {
      if (pendingDraw > 0) {
        if (pendingDrawType === 'draw2' && c.value === 'draw2') playableIds.add(c.id);
        if (pendingDrawType === 'wild4' && c.value === 'wild4') playableIds.add(c.id);
      } else {
        if (c.value === 'wild' || c.value === 'wild4') { playableIds.add(c.id); continue; }
        const activeColor = chosenColor ?? topCard.color;
        if (c.color === activeColor || c.value === topCard.value) playableIds.add(c.id);
      }
    }
  }

  const canCallUno = !!gameState && (gameState.myHand?.length === 1) && !myInfo?.calledUno;

  // ── Turn timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState?.phase !== 'playing' || !gameState.turnDuration || !gameState.turnStartTime) {
      setTurnTimeLeftMs(0);
      return;
    }
    const update = () => setTurnTimeLeftMs(Math.max(0, gameState.turnDuration - (Date.now() - gameState.turnStartTime)));
    update();
    const iv = setInterval(update, 200);
    return () => clearInterval(iv);
  }, [gameState?.phase, gameState?.turnDuration, gameState?.turnStartTime]);

  // ── Challenge window timer ────────────────────────────────────────────────
  useEffect(() => {
    const cw = gameState?.challengeWindow;
    if (!cw) { setChallengeTimeLeftMs(0); return; }
    const update = () => setChallengeTimeLeftMs(Math.max(0, cw.timeLimit - (Date.now() - cw.startTime)));
    update();
    const iv = setInterval(update, 200);
    return () => clearInterval(iv);
  }, [gameState?.challengeWindow?.startTime, gameState?.challengeWindow?.timeLimit]);

  // ── UNO flash when I have 1 card ─────────────────────────────────────────
  useEffect(() => {
    if (gameState?.myHand?.length === 1 && !myInfo?.calledUno) {
      setUnoFlash(true);
      const t = setTimeout(() => setUnoFlash(false), 3000);
      return () => clearTimeout(t);
    }
  }, [gameState?.myHand?.length]);

  // ── Card play animation ───────────────────────────────────────────────────
  useEffect(() => {
    const la = gameState?.lastAction;
    if (!la || la.type !== 'played' || !la.card) return;
    const key = `${la.userId}-${la.card.id}`;
    if (key === lastActionKeyRef.current) return;
    lastActionKeyRef.current = key;
  }, [gameState?.lastAction]);

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !user) return;

    socket.emit('uno:register');

    const onState = (s: GameState) => {
      setGameState(s);
      if (s.phase === 'playing') setGameOver(null);
    };

    const onGameOver = (d: GameOverData) => {
      setGameOver(d);
      setGameState(prev => prev ? { ...prev, phase: 'finished', winnerId: d.winnerId } : prev);
      refreshUser();
    };

    const onPlayAgainPrompt = (d: PlayAgainPrompt) => setPlayAgainPrompt(d);
    const onPlayAgainUpdate = (d: PlayAgainPrompt) => setPlayAgainPrompt(prev => prev ? { ...prev, responses: d.responses } : prev);
    const onPlayAgainCancelled = () => { setPlayAgainPrompt(null); setGameState(null); };

    const onLeft = () => setGameState(null);

    const onUnoAnnounced = (d: { userId: string; username: string }) => {
      if (unoToastRef.current) clearTimeout(unoToastRef.current);
      setUnoToast(d.userId === user.id ? 'UNO !' : `${d.username} : UNO !`);
      unoToastRef.current = setTimeout(() => setUnoToast(null), 2000);
    };

    const onCatchSuccess = (d: { catcherUsername: string; targetUsername: string }) => {
      if (unoToastRef.current) clearTimeout(unoToastRef.current);
      setUnoToast(`${d.catcherUsername} attrape ${d.targetUsername} ! +2 cartes`);
      unoToastRef.current = setTimeout(() => setUnoToast(null), 2500);
    };

    const onChallengeResult = (d: { challengerWon: boolean }) => {
      if (challengeResultRef.current) clearTimeout(challengeResultRef.current);
      setChallengeResult({
        challengerWon: d.challengerWon,
        msg: d.challengerWon ? 'Bluff détecté ! +4 pour le bluffeur.' : 'Pas de bluff. +6 pour le contesteur.',
      });
      challengeResultRef.current = setTimeout(() => setChallengeResult(null), 3000);
    };

    socket.on('uno:state', onState);
    socket.on('uno:game-over', onGameOver);
    socket.on('uno:play-again-prompt', onPlayAgainPrompt);
    socket.on('uno:play-again-response-update', onPlayAgainUpdate);
    socket.on('uno:play-again-cancelled', onPlayAgainCancelled);
    socket.on('uno:left', onLeft);
    socket.on('uno:uno-announced', onUnoAnnounced);
    socket.on('uno:catch-success', onCatchSuccess);
    socket.on('uno:challenge-result', onChallengeResult);

    return () => {
      socket.off('uno:state', onState);
      socket.off('uno:game-over', onGameOver);
      socket.off('uno:play-again-prompt', onPlayAgainPrompt);
      socket.off('uno:play-again-response-update', onPlayAgainUpdate);
      socket.off('uno:play-again-cancelled', onPlayAgainCancelled);
      socket.off('uno:left', onLeft);
      socket.off('uno:uno-announced', onUnoAnnounced);
      socket.off('uno:catch-success', onCatchSuccess);
      socket.off('uno:challenge-result', onChallengeResult);
    };
  }, [socket, user, refreshUser]);

  // Cleanup toasts on unmount
  useEffect(() => () => {
    if (unoToastRef.current) clearTimeout(unoToastRef.current);
    if (challengeResultRef.current) clearTimeout(challengeResultRef.current);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleStart = () => {
    if (!socket || !currentParty) return;
    socket.emit('uno:start', { partyId: currentParty.id });
  };

  const handleLeave = () => {
    if (!socket || !currentParty) return;
    socket.emit('uno:leave', { partyId: currentParty.id });
    setGameState(null);
  };

  const handleCardClick = useCallback((card: UnoCard) => {
    if (!socket || !currentParty || !isMyTurn) return;
    if (!playableIds.has(card.id)) return;

    if (card.value === 'wild' || card.value === 'wild4') {
      setPendingWildCard(card);
      setSelectedCard(card.id);
    } else {
      setSelectedCard(null);
      socket.emit('uno:play-card', { partyId: currentParty.id, cardId: card.id });
    }
  }, [socket, currentParty, isMyTurn, playableIds]);

  const handleColorPick = (color: CardColor) => {
    if (!socket || !currentParty || !pendingWildCard) return;
    socket.emit('uno:play-card', { partyId: currentParty.id, cardId: pendingWildCard.id, chosenColor: color });
    setPendingWildCard(null);
    setSelectedCard(null);
  };

  const handleDraw = () => {
    if (!socket || !currentParty || !isMyTurn) return;
    socket.emit('uno:draw', { partyId: currentParty.id });
  };

  const handleUnoCall = () => {
    if (!socket || !currentParty) return;
    socket.emit('uno:uno-call', { partyId: currentParty.id });
  };

  const handleCatch = (targetId: string) => {
    if (!socket || !currentParty) return;
    socket.emit('uno:catch', { partyId: currentParty.id, targetId });
  };

  const handleChallenge = () => {
    if (!socket || !currentParty) return;
    socket.emit('uno:challenge', { partyId: currentParty.id });
  };

  const handleAcceptWild4 = () => {
    if (!socket || !currentParty) return;
    socket.emit('uno:draw', { partyId: currentParty.id });
  };

  const handlePlayAgain = (playAgain: boolean) => {
    if (!socket || !currentParty) return;
    socket.emit('uno:play-again-response', { partyId: currentParty.id, playAgain });
  };

  // ── Seat layout ───────────────────────────────────────────────────────────
  // Returns opponents ordered for the circular table (left, top, right for up to 3 opponents)
  const getOpponentSeats = (): Array<{ player: PlayerInfo; position: 'top' | 'left' | 'right' }> => {
    if (!gameState) return [];
    const opponents = gameState.players.filter(p => p.userId !== user?.id);
    if (opponents.length === 1) return [{ player: opponents[0], position: 'top' }];
    if (opponents.length === 2) return [
      { player: opponents[0], position: 'left' },
      { player: opponents[1], position: 'right' },
    ];
    if (opponents.length === 3) return [
      { player: opponents[0], position: 'left' },
      { player: opponents[1], position: 'top' },
      { player: opponents[2], position: 'right' },
    ];
    return [];
  };

  // ── No party ──────────────────────────────────────────────────────────────
  if (!currentParty) {
    return (
      <PageShell>
        <PageHeader
          title="UNO"
          description="Le classique jeu de cartes en 2-4 joueurs."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Jeux
              </Link>
            </Button>
          }
        />
        <Card>
          <CardContent className="py-10 px-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Joue en 2-4 joueurs en créant ou rejoignant un groupe.</p>
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <Button onClick={() => setShowChallengePicker(true)}>
                <Swords className="h-4 w-4 mr-2" />
                Défier un joueur
              </Button>
              <Button asChild variant="outline">
                <Link to="/party">Via un groupe</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <DuelPlayerSelectionModal
          open={showChallengePicker}
          onOpenChange={setShowChallengePicker}
          title="Défier en UNO"
          gameType="uno"
          onlineUsers={onlineUsers}
          currentUserId={user?.id}
          outgoingDuelChallenge={outgoingDuelChallenge}
          challengeUserToDuel={challengeUserToDuel}
          requestOnlineUsers={requestOnlineUsers}
        />
      </PageShell>
    );
  }

  // ── Lobby ─────────────────────────────────────────────────────────────────
  if (!gameState) {
    return (
      <PageShell>
        <PageHeader
          title="UNO"
          description={`Groupe : ${currentParty.name || 'Sans nom'}`}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Jeux
              </Link>
            </Button>
          }
        />
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm text-muted-foreground">
              Joueurs ({partyMembers.length}/4)
            </h2>
            <div className="space-y-0">
              {partyMembers.map(member => (
                <div
                  key={member.userId}
                  className={cn(
                    'flex items-center justify-between py-4 border-b border-border/30 last:border-0',
                    member.userId === user?.id && 'bg-muted/30 -mx-4 px-4',
                  )}
                >
                  <span className="font-medium">
                    <UsernameDisplay username={member.username} usernameColor={member.usernameColor} />
                    {member.isLeader && <span className="ml-2 text-xs text-muted-foreground">leader</span>}
                    {member.userId === user?.id && <span className="ml-2 text-xs text-muted-foreground">(toi)</span>}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {partyMembers.length < 2 && (
          <p className="text-center text-muted-foreground text-sm">Il faut au moins 2 joueurs.</p>
        )}

        {isLeader && partyMembers.length >= 2 && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={handleStart}
              className="flex items-center gap-3 px-8 py-4 text-lg border border-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              <Play className="h-5 w-5" />
              Lancer la partie
            </Button>
          </div>
        )}

        {!isLeader && partyMembers.length >= 2 && (
          <p className="text-center text-muted-foreground py-8">En attente que le leader lance…</p>
        )}

        {/* Post-game modals even in lobby */}
        <PostGameDialog gameOver={gameOver} setGameOver={setGameOver} myId={user?.id} />
        <PlayAgainDialog
          prompt={playAgainPrompt}
          myId={user?.id}
          onResponse={handlePlayAgain}
          onClose={() => setPlayAgainPrompt(null)}
        />
      </PageShell>
    );
  }

  // ── Active game ───────────────────────────────────────────────────────────
  const opponentSeats = getOpponentSeats();
  const activeColor = gameState.chosenColor ?? (gameState.topCard.color !== 'wild' ? gameState.topCard.color : null);

  return (
    <PageShell>
      <style>{`
        @keyframes card-play {
          0%   { transform: scale(1.2) translateY(-8px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes uno-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
          50%       { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
        .animate-card-play { animation: card-play 0.25s ease-out; }
        .animate-slide-up  { animation: slide-up 0.2s ease-out; }
        .animate-uno-pulse { animation: uno-pulse 1s ease-in-out infinite; }
      `}</style>

      <PageHeader
        title="UNO"
        description={`Groupe : ${currentParty.name || 'Sans nom'}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Jeux
              </Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLeave}>
              <LogOut className="h-4 w-4 mr-2" />
              Quitter
            </Button>
          </>
        }
      />

      {/* ── Toasts ── */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 space-y-2 pointer-events-none">
        {unoToast && (
          <div className="bg-red-600 text-white px-4 py-2 rounded-xl shadow-xl text-sm font-bold animate-slide-up">
            {unoToast}
          </div>
        )}
        {challengeResult && (
          <div
            className={cn(
              'px-4 py-2 rounded-xl shadow-xl text-sm font-bold animate-slide-up',
              challengeResult.challengerWon ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
            )}
          >
            {challengeResult.msg}
          </div>
        )}
      </div>

      {/* ── Table area ── */}
      <div className="relative w-full max-w-2xl mx-auto" style={{ minHeight: 360 }}>
        {/* Table surface */}
        <div
          className="absolute inset-x-12 inset-y-12 rounded-full border border-border/30 bg-muted/20"
          style={{ top: '20%', bottom: '22%' }}
        />

        {/* Direction indicator */}
        <div className="absolute top-1/2 -translate-y-1/2 left-4 text-muted-foreground" title="Sens du jeu">
          {gameState.direction === 1
            ? <RotateCcw className="w-4 h-4" />
            : <RotateCcw className="w-4 h-4 scale-x-[-1]" />
          }
        </div>

        {/* Opponent seats */}
        {opponentSeats.map(({ player, position }) => {
          const canCatch = player.handCount === 1 && !player.calledUno && player.userId !== user?.id;
          return (
            <div
              key={player.userId}
              className={cn(
                'absolute flex flex-col items-center',
                position === 'top' && 'top-0 left-1/2 -translate-x-1/2',
                position === 'left' && 'left-0 top-1/2 -translate-y-1/2',
                position === 'right' && 'right-0 top-1/2 -translate-y-1/2',
              )}
            >
              <OpponentSeat
                player={player}
                isMe={false}
                isCurrentTurn={gameState.currentPlayerId === player.userId && gameState.phase === 'playing'}
                position={position}
                canCatch={canCatch}
                onCatch={() => handleCatch(player.userId)}
              />
            </div>
          );
        })}

        {/* Center: deck + discard pile */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-6">
          {/* Deck */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={isMyTurn && !hasChallengeWindow ? handleDraw : undefined}
              className={cn(
                'relative',
                isMyTurn && !hasChallengeWindow
                  ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform'
                  : 'cursor-default',
              )}
              title={isMyTurn ? 'Piocher' : undefined}
            >
              {/* Stacked deck effect */}
              {[2, 1, 0].map(offset => (
                <div
                  key={offset}
                  className={cn(
                    'absolute w-14 h-20 bg-zinc-800 border-2 border-zinc-700 rounded-lg',
                    offset === 0 && 'relative',
                  )}
                  style={{ top: offset * -2, left: offset * -2, zIndex: 3 - offset }}
                />
              ))}
              <div className="relative z-10 w-14 h-20 bg-zinc-800 border-2 border-zinc-600 rounded-lg flex items-center justify-center shadow-xl">
                <span className="font-black text-white text-xs tracking-tighter">UNO</span>
              </div>
            </button>
            <span className="text-xs text-muted-foreground">{gameState.deckCount} cartes</span>
          </div>

          {/* Discard pile */}
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              {/* Pending draw indicator */}
              {gameState.pendingDraw > 0 && (
                <div className="absolute -top-3 -right-3 z-20 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                  +{gameState.pendingDraw}
                </div>
              )}
              <div key={gameState.topCard.id} className="animate-card-play">
                <UnoCardEl card={gameState.topCard} size="lg" />
              </div>
            </div>

            {/* Active color dot */}
            {activeColor && activeColor !== 'wild' && (
              <div className="flex items-center gap-1">
                <div className={cn('w-3 h-3 rounded-full shadow-sm', DOT_BG[activeColor])} />
                <span className="text-xs text-muted-foreground">{COLOR_NAMES[activeColor]}</span>
              </div>
            )}
          </div>
        </div>

        {/* Current player "me" info at bottom of table area */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-colors',
              isMyTurn && gameState.phase === 'playing'
                ? 'border-foreground/60 bg-muted/50'
                : 'border-border/40 bg-background/60',
            )}
          >
            <UsernameDisplay username={user?.username ?? ''} usernameColor={user?.usernameColor} className="text-xs" />
            <span className="text-muted-foreground">{gameState.myHand.length} carte{gameState.myHand.length !== 1 ? 's' : ''}</span>
            {myInfo?.calledUno && <span className="text-red-400 font-bold">UNO!</span>}
          </div>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          {gameState.phase === 'finished'
            ? gameState.winnerId === user?.id ? '🏆 Tu as gagné !' : `${gameState.players.find(p => p.userId === gameState.winnerId)?.username ?? '?'} a gagné.`
            : hasChallengeWindow
            ? 'Conteste le Wild +4 ?'
            : isMyTurn
            ? gameState.pendingDraw > 0
              ? `Joue un ${gameState.pendingDrawType === 'draw2' ? '+2' : '+4'} ou pioche ${gameState.pendingDraw} cartes`
              : 'Ton tour — joue ou pioche'
            : `Au tour de ${gameState.players.find(p => p.userId === gameState.currentPlayerId)?.username ?? '...'}`}
        </p>

        {gameState.phase === 'playing' && !hasChallengeWindow && (
          <div className="flex items-center justify-center gap-2">
            {/* Turn timer bar */}
            <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  turnSecondsLeft <= 5 ? 'bg-red-500' : 'bg-primary',
                )}
                style={{ width: `${Math.max(0, (turnTimeLeftMs / gameState.turnDuration) * 100)}%` }}
              />
            </div>
            <span className={cn('text-xs tabular-nums', turnSecondsLeft <= 5 && isMyTurn ? 'text-red-500' : 'text-muted-foreground')}>
              {turnSecondsLeft}s
            </span>
          </div>
        )}
      </div>

      {/* ── Challenge window ── */}
      {hasChallengeWindow && gameState.phase === 'playing' && (
        <div className="flex flex-col items-center gap-3 p-4 border border-yellow-500/50 rounded-xl bg-yellow-500/5 max-w-sm mx-auto">
          <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
            <AlertCircle className="w-4 h-4" />
            <span>
              {gameState.players.find(p => p.userId === gameState.challengeWindow?.challengedUserId)?.username} a joué Wild +4
            </span>
          </div>
          {/* Timer bar */}
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-500 rounded-full transition-all"
              style={{
                width: `${Math.max(0, (challengeTimeLeftMs / (gameState.challengeWindow?.timeLimit ?? 8000)) * 100)}%`,
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={handleChallenge} className="gap-1">
              <Zap className="h-3.5 w-3.5" />
              Contester ({challengeSecondsLeft}s)
            </Button>
            <Button size="sm" variant="outline" onClick={handleAcceptWild4}>
              Piocher +4
            </Button>
          </div>
        </div>
      )}

      {/* ── My hand ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">Ma main ({gameState.myHand.length})</p>
          {gameState.phase === 'playing' && (
            <div className="flex items-center gap-2">
              {/* Catch buttons for opponents with 1 uncalled card */}
              {gameState.players
                .filter(p => p.userId !== user?.id && p.handCount === 1 && !p.calledUno)
                .map(p => (
                  <Button
                    key={p.userId}
                    size="sm"
                    variant="destructive"
                    className="h-6 text-xs px-2 animate-pulse"
                    onClick={() => handleCatch(p.userId)}
                  >
                    Attraper {p.username}!
                  </Button>
                ))
              }
            </div>
          )}
        </div>

        {/* Hand scroll */}
        <div className="w-full overflow-x-auto pb-2">
          <div className="flex gap-1.5 min-w-max px-2 py-1">
            {gameState.myHand.map(card => {
              const playable = playableIds.has(card.id);
              return (
                <UnoCardEl
                  key={card.id}
                  card={card}
                  size="md"
                  onClick={() => handleCardClick(card)}
                  disabled={!isMyTurn || !playable}
                  selected={selectedCard === card.id}
                  className={cn(
                    playable && isMyTurn && 'ring-1 ring-white/30',
                  )}
                />
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        {gameState.phase === 'playing' && isMyTurn && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {/* Draw button */}
            {!hasChallengeWindow && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDraw}
                className="gap-1"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                {gameState.pendingDraw > 0 ? `Piocher ${gameState.pendingDraw}` : 'Piocher'}
              </Button>
            )}
          </div>
        )}

        {/* UNO button */}
        {gameState.phase === 'playing' && canCallUno && (
          <div className="flex justify-center pt-1">
            <button
              onClick={handleUnoCall}
              className={cn(
                'px-8 py-2 rounded-full font-black text-white text-lg tracking-widest shadow-xl',
                'bg-red-600 hover:bg-red-500 active:scale-95 transition-all',
                unoFlash && 'animate-uno-pulse',
              )}
            >
              UNO !
            </button>
          </div>
        )}

        {/* Contre-UNO / challenge section in hand area (also shown above but kept here for mobile) */}
      </div>

      {/* Color picker overlay */}
      <ColorPicker open={!!pendingWildCard} onPick={handleColorPick} />

      {/* Post-game dialogs */}
      <PostGameDialog gameOver={gameOver} setGameOver={setGameOver} myId={user?.id} />
      <PlayAgainDialog
        prompt={playAgainPrompt}
        myId={user?.id}
        onResponse={handlePlayAgain}
        onClose={() => setPlayAgainPrompt(null)}
      />
    </PageShell>
  );
}

// ─── Post-game dialog ─────────────────────────────────────────────────────────

function PostGameDialog({
  gameOver,
  setGameOver,
  myId,
}: {
  gameOver: GameOverData | null;
  setGameOver: (v: GameOverData | null) => void;
  myId?: string;
}) {
  if (!gameOver) return null;
  const iWon = gameOver.winnerId === myId;
  return (
    <Dialog open={!!gameOver} onOpenChange={() => setGameOver(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-normal flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Partie terminée
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="text-center">
            <p className="text-2xl font-light">
              {iWon ? '🏆 Tu as gagné !' : `${gameOver.winnerUsername} a gagné`}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-3 px-3 border rounded border-yellow-500/50 bg-yellow-500/5">
              <span className="font-medium">{gameOver.winnerUsername}</span>
              <div className="text-sm">
                <span className="text-purple-400">+{gameOver.rewards.winner.aura} aura </span>
                <span className="text-green-400">+{gameOver.rewards.winner.money}$</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 px-3 border rounded border-border/30 text-sm text-muted-foreground">
              <span>Autres joueurs</span>
              <span className="text-green-400">+{gameOver.rewards.other.money}$</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setGameOver(null)} className="w-full">Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Play-again dialog ────────────────────────────────────────────────────────

function PlayAgainDialog({
  prompt,
  myId,
  onResponse,
  onClose,
}: {
  prompt: PlayAgainPrompt | null;
  myId?: string;
  onResponse: (v: boolean) => void;
  onClose: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(0);
  const myResponse = prompt?.responses.find(r => r.userId === myId);

  useEffect(() => {
    if (!prompt) return;
    const update = () => setTimeLeft(Math.max(0, Math.ceil((prompt.timeLimit - (Date.now() - prompt.startTime)) / 1000)));
    update();
    const iv = setInterval(update, 500);
    return () => clearInterval(iv);
  }, [prompt?.startTime, prompt?.timeLimit]);

  if (!prompt) return null;
  return (
    <Dialog open={!!prompt} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-normal flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Rejouer ? ({timeLeft}s)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {prompt.players.map(p => {
            const r = prompt.responses.find(r => r.userId === p.userId);
            return (
              <div key={p.userId} className="flex items-center justify-between text-sm">
                <UsernameDisplay username={p.username} usernameColor={p.usernameColor} />
                <span className={cn('text-xs', r === undefined ? 'text-muted-foreground' : r.playAgain ? 'text-green-500' : 'text-red-500')}>
                  {r === undefined ? '...' : r.playAgain ? 'Rejouer' : 'Quitter'}
                </span>
              </div>
            );
          })}
        </div>
        {!myResponse && (
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onResponse(false)}>
              <ChevronUp className="h-4 w-4 mr-1" />
              Quitter
            </Button>
            <Button className="flex-1" onClick={() => onResponse(true)}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Rejouer
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

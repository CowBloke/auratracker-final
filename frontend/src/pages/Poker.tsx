import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { ArrowLeft, Clock, Coins, LogOut, Play, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const ACTION_TIME_LIMIT = 25000;

const suitSymbol: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };

const Card = ({ card, muted = false }: { card: string; muted?: boolean }) => {
  if (!card) {
    return <div className="h-16 w-12 rounded border border-dashed border-muted-foreground/40" />;
  }
  const rank = card[0];
  const suit = card[1];
  const isHidden = card === '??';
  const isRed = suit === 'h' || suit === 'd';

  return (
    <div
      className={cn(
        'h-16 w-12 rounded border border-border bg-card px-2 py-2 text-sm flex flex-col justify-between',
        muted && 'opacity-50',
      )}
    >
      {isHidden ? (
        <div className="flex-1 bg-muted/60 rounded" />
      ) : (
        <>
          <span className={cn('font-semibold', isRed && 'text-red-500')}>{rank}</span>
          <span className={cn('text-xs', isRed && 'text-red-500')}>{suitSymbol[suit] || '?'}</span>
        </>
      )}
    </div>
  );
};

export default function Poker() {
  const { user } = useAuth();
  const {
    currentParty,
    partyMembers,
    pokerGame,
    pokerJoinPrompt,
    pokerPlayAgainPrompt,
    pokerGameOver,
    startPoker,
    respondToPokerJoinPrompt,
    actInPoker,
    leavePoker,
    respondToPokerPlayAgainPrompt,
    clearPokerGameOver,
  } = useSocket();

  const [startStack, setStartStack] = useState(800);
  const [bigBlind, setBigBlind] = useState(20);
  const [raiseTarget, setRaiseTarget] = useState(0);
  const [turnProgress, setTurnProgress] = useState(100);
  const [joinProgress, setJoinProgress] = useState(100);
  const [playAgainProgress, setPlayAgainProgress] = useState(100);

  const me = useMemo(() => pokerGame?.players.find((p) => p.userId === user?.id), [pokerGame, user?.id]);
  const isLeader = useMemo(
    () => partyMembers.some((m) => m.userId === user?.id && m.isLeader),
    [partyMembers, user?.id],
  );
  const isMyTurn = pokerGame?.currentPlayerId === user?.id;
  const canAct = isMyTurn && ((pokerGame?.availableActions?.length ?? 0) > 0);

  const maxBet = me ? me.bet + me.chips : 0;
  const callAmount = pokerGame?.callAmount ?? 0;
  const minRaiseTarget = pokerGame ? Math.min(maxBet || 0, pokerGame.minRaiseTo) : 0;
  const stageLabel: Record<string, string> = {
    preflop: 'Préflop',
    flop: 'Flop',
    turn: 'Turn',
    river: 'River',
    showdown: 'Showdown',
  };

  useEffect(() => {
    if (!pokerGame?.turnEndsAt) {
      setTurnProgress(100);
      return;
    }
    const interval = setInterval(() => {
      const remaining = pokerGame.turnEndsAt - Date.now();
      setTurnProgress(Math.max(0, Math.min(100, (remaining / ACTION_TIME_LIMIT) * 100)));
    }, 120);
    return () => clearInterval(interval);
  }, [pokerGame?.turnEndsAt]);

  useEffect(() => {
    if (!pokerJoinPrompt) {
      setJoinProgress(100);
      return;
    }
    const interval = setInterval(() => {
      const elapsed = Date.now() - pokerJoinPrompt.startTime;
      setJoinProgress(Math.max(0, 100 - (elapsed / pokerJoinPrompt.timeLimit) * 100));
    }, 120);
    return () => clearInterval(interval);
  }, [pokerJoinPrompt?.startTime, pokerJoinPrompt?.timeLimit]);

  useEffect(() => {
    if (!pokerPlayAgainPrompt) {
      setPlayAgainProgress(100);
      return;
    }
    const interval = setInterval(() => {
      const elapsed = Date.now() - pokerPlayAgainPrompt.startTime;
      setPlayAgainProgress(Math.max(0, 100 - (elapsed / pokerPlayAgainPrompt.timeLimit) * 100));
    }, 120);
    return () => clearInterval(interval);
  }, [pokerPlayAgainPrompt?.startTime, pokerPlayAgainPrompt?.timeLimit]);

  useEffect(() => {
    if (!pokerGame || !me) return;
    const suggested = Math.max(0, Math.min(me.bet + me.chips, pokerGame.minRaiseTo || 0));
    setRaiseTarget(suggested || me.bet + me.chips);
  }, [pokerGame?.handNumber, pokerGame?.currentPlayerId, pokerGame?.minRaiseTo, me?.bet, me?.chips]);

  const handleCallOrCheck = () => {
    if (!pokerGame) return;
    if (callAmount > 0) {
      actInPoker('call');
    } else {
      actInPoker('check');
    }
  };

  const handleRaise = () => {
    if (!pokerGame) return;
    actInPoker(pokerGame.highestBet === 0 ? 'bet' : 'raise', raiseTarget);
  };

  const handleAllIn = () => {
    actInPoker('all-in');
  };

  const renderPlayers = () => {
    if (!pokerGame) return null;
    return pokerGame.players.map((player) => {
      const isDealer = pokerGame.dealerId === player.userId;
      const isSmallBlind = pokerGame.smallBlindId === player.userId;
      const isBigBlind = pokerGame.bigBlindId === player.userId;
      const isTurn = pokerGame.currentPlayerId === player.userId;
      const isMe = player.userId === user?.id;
      const showHand =
        pokerGame.stage === 'showdown' || isMe ? player.hand : ['??', '??'];

      return (
        <div
          key={player.userId}
          className={cn(
            'flex items-center justify-between rounded border border-border/60 px-3 py-3',
            isTurn && 'border-foreground',
            player.hasFolded && 'opacity-50',
          )}
        >
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-foreground/60" />
            <div>
              <p className="text-sm font-medium" style={{ color: player.usernameColor || undefined }}>
                {player.username}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isDealer && <span>D</span>}
                {isSmallBlind && <span>SB</span>}
                {isBigBlind && <span>BB</span>}
                {player.lastAction && <span className="uppercase tracking-wide">{player.lastAction}</span>}
                {player.isAllIn && <span className="text-red-500">ALL-IN</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {showHand && (
              <div className="flex gap-1">
                {showHand.map((c, idx) => (
                  <Card key={idx} card={c} muted={player.hasFolded} />
                ))}
              </div>
            )}
            <div className="text-right">
              <div className="text-sm font-semibold flex items-center gap-1 justify-end">
                <Coins className="h-4 w-4 text-muted-foreground" />
                {player.chips}
              </div>
              {player.bet > 0 && (
                <p className="text-xs text-muted-foreground">Mise: {player.bet}</p>
              )}
            </div>
          </div>
        </div>
      );
    });
  };

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
            Poker
          </h1>
        </header>

        <div className="h-px bg-border" />

        <div className="text-center py-20 space-y-6">
          <Users className="h-16 w-16 mx-auto text-muted-foreground" />
          <div>
            <h2 className="text-2xl font-light mb-2">Besoin d'une party</h2>
            <p className="text-muted-foreground">
              Crée ou rejoins une party pour lancer une table de poker.
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

  const myHand = pokerGame?.yourHand?.length ? pokerGame.yourHand : me?.hand || [];
  const canRaise = !!canAct && pokerGame?.availableActions.includes(pokerGame.highestBet === 0 ? 'bet' : 'raise');
  const canCall = !!canAct && pokerGame?.availableActions.includes('call');
  const canCheck = !!canAct && pokerGame?.availableActions.includes('check');

  const lobby = !pokerGame;

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-10">
      <header className="space-y-2">
        <Link
          to="/games"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Jeux
        </Link>
        <p className="text-sm text-muted-foreground tracking-wide uppercase">
          Jeu multijoueur
        </p>
        <h1 className="text-5xl md:text-7xl font-light tracking-tight">
          Poker
        </h1>
      </header>

      <div className="h-px bg-border" />

      {lobby ? (
        <div className="space-y-12">
          <section className="space-y-2">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Joueurs dans la party ({partyMembers.length})
            </h2>
            <div className="space-y-0">
              {partyMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between py-3 border-b border-border/40 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-foreground/50" />
                    <div>
                      <p className="font-medium" style={{ color: member.usernameColor || undefined }}>
                        {member.username}
                      </p>
                      {member.isLeader && (
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Leader</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded border border-border/60 p-4 space-y-6">
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
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Stack de départ</span>
                <Input
                  type="number"
                  min={200}
                  max={2000}
                  value={startStack}
                  onChange={(e) => setStartStack(parseInt(e.target.value || '0', 10))}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Big blind</span>
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
              <p className="text-sm text-muted-foreground">En attente que le leader démarre la partie.</p>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="rounded border border-border/60 p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4 text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center gap-4">
                <span className="px-2 py-1 rounded border border-border">
                  {stageLabel[pokerGame.stage] || pokerGame.stage}
                </span>
                <span>Pot : <strong className="text-foreground">{pokerGame.pot}</strong></span>
                <span>Blindes : {pokerGame.smallBlind}/{pokerGame.bigBlind}</span>
                <span>Manche {pokerGame.handNumber}/{pokerGame.maxHands}</span>
                <span>Stack départ {pokerGame.startingStack}</span>
                {isMyTurn && (
                  <span className="flex items-center gap-2 text-foreground">
                    <Clock className="h-4 w-4" />
                    {Math.max(0, Math.round((turnProgress / 100) * ACTION_TIME_LIMIT / 1000))}s
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" className="gap-2" onClick={leavePoker}>
                <LogOut className="h-4 w-4" />
                Quitter la table
              </Button>
            </div>
            <div className="flex items-center gap-2 justify-center">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Card
                  key={idx}
                  card={pokerGame.communityCards[idx] || ''}
                  muted={!pokerGame.communityCards[idx]}
                />
              ))}
            </div>
            {pokerGame.lastHandResult && (
              <div className="rounded bg-muted/40 p-3 text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="uppercase tracking-wide text-xs text-muted-foreground">Main précédente</span>
                  <span className="font-medium">
                    {pokerGame.lastHandResult.winners.map((w) => w.username).join(', ')} remportent {pokerGame.lastHandResult.pot}
                  </span>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            {renderPlayers()}
          </section>

          {me && !me.isEliminated && (
            <section className="rounded border border-border/60 p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Vos cartes</span>
                  <div className="flex gap-1">
                    {(myHand || []).map((card, idx) => (
                      <Card key={idx} card={card} muted={me.hasFolded} />
                    ))}
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div>Stack: <span className="text-foreground font-semibold">{me.chips}</span></div>
                  <div>Engagé: {me.bet}</div>
                </div>
              </div>

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
                >
                  {callAmount > 0 ? `Suivre (${callAmount})` : 'Check'}
                </Button>
                <div className="flex-1 min-w-[220px] space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{pokerGame.highestBet === 0 ? 'Miser' : 'Relancer'} à</span>
                    <span className="text-foreground font-semibold">{Math.round(raiseTarget)}</span>
                  </div>
                  <Slider
                    value={[Math.min(raiseTarget, maxBet)]}
                    min={Math.min(minRaiseTarget || 0, maxBet)}
                    max={Math.max(minRaiseTarget || 0, maxBet)}
                    step={5}
                    onValueChange={(value) => setRaiseTarget(value[0])}
                    disabled={!canRaise || maxBet <= 0}
                  />
                </div>
                <Button
                  onClick={handleRaise}
                  disabled={!canRaise || maxBet <= 0}
                >
                  {pokerGame.highestBet === 0 ? 'Miser' : 'Relancer'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAllIn}
                  disabled={!canAct || me.chips <= 0}
                >
                  All-in
                </Button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Join prompt */}
      <Dialog open={!!pokerJoinPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Table de poker</DialogTitle>
          </DialogHeader>
          {pokerJoinPrompt && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {partyMembers.find((m) => m.userId === pokerJoinPrompt.leaderId)?.username || 'Le leader'} veut lancer une partie.
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded bg-muted/50">
                  <p className="text-muted-foreground">Stack</p>
                  <p className="font-semibold">{pokerJoinPrompt.startStack}</p>
                </div>
                <div className="p-3 rounded bg-muted/50">
                  <p className="text-muted-foreground">Blindes</p>
                  <p className="font-semibold">{pokerJoinPrompt.bigBlind / 2} / {pokerJoinPrompt.bigBlind}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Joueurs</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {pokerJoinPrompt.members.map((member) => {
                    const response = pokerJoinPrompt.responses.find((r) => r.userId === member.userId);
                    return (
                      <div key={member.userId} className="flex items-center justify-between text-sm">
                        <span style={{ color: member.usernameColor || undefined }}>{member.username}</span>
                        {response ? (
                          <span className={cn('text-xs uppercase', response.accepted ? 'text-green-500' : 'text-red-500')}>
                            {response.accepted ? 'OK' : 'Non'}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">En attente</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="h-1 rounded bg-muted">
                <div className="h-full bg-foreground transition-all" style={{ width: `${joinProgress}%` }} />
              </div>
              <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <Button variant="outline" onClick={() => respondToPokerJoinPrompt(false)}>
                  Refuser
                </Button>
                <Button onClick={() => respondToPokerJoinPrompt(true)}>
                  Rejoindre
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Play again prompt */}
      <Dialog open={!!pokerPlayAgainPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Relancer une partie ?</DialogTitle>
          </DialogHeader>
          {pokerPlayAgainPrompt && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Stack {pokerPlayAgainPrompt.startStack} — blindes {pokerPlayAgainPrompt.bigBlind / 2}/{pokerPlayAgainPrompt.bigBlind}
              </p>
              <div className="space-y-2">
                {pokerPlayAgainPrompt.players.map((p) => {
                  const response = pokerPlayAgainPrompt.responses.find((r) => r.userId === p.userId);
                  return (
                    <div key={p.userId} className="flex items-center justify-between text-sm">
                      <span style={{ color: p.usernameColor || undefined }}>{p.username}</span>
                      {response ? (
                        <span className={cn('text-xs uppercase', response.playAgain ? 'text-green-500' : 'text-red-500')}>
                          {response.playAgain ? 'OK' : 'Quitte'}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">En attente</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="h-1 rounded bg-muted">
                <div className="h-full bg-foreground transition-all" style={{ width: `${playAgainProgress}%` }} />
              </div>
              <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <Button variant="outline" onClick={() => respondToPokerPlayAgainPrompt(false)}>
                  Quitter
                </Button>
                <Button onClick={() => respondToPokerPlayAgainPrompt(true)}>
                  Relancer
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Game over */}
      <Dialog open={!!pokerGameOver}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Partie terminée</DialogTitle>
          </DialogHeader>
          {pokerGameOver && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Vainqueur : {pokerGameOver.winnerUsername || 'aucun'}
              </p>
              <div className="space-y-2">
                {pokerGameOver.standings.map((s) => (
                  <div key={s.userId} className="flex items-center justify-between text-sm">
                    <span>{s.username}</span>
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
    </div>
  );
}

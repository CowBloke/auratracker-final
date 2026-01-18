import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { ArrowLeft, Users, Dice6, Crown, Coins, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const colorMap: Record<string, string> = {
  brown: 'bg-amber-700',
  lightblue: 'bg-sky-400',
  pink: 'bg-pink-400',
  orange: 'bg-orange-400',
  red: 'bg-red-500',
  yellow: 'bg-yellow-400',
  green: 'bg-emerald-500',
  darkblue: 'bg-blue-600',
};

const shortName = (name: string) => {
  const parts = name.split(' ');
  if (parts.length === 1) return name.slice(0, 8);
  return parts.slice(0, 2).join(' ');
};

export default function Monopoly() {
  const { user } = useAuth();
  const {
    currentParty,
    partyMembers,
    monopolyGame,
    monopolyJoinPrompt,
    monopolyPlayAgainPrompt,
    monopolyGameOver,
    startMonopoly,
    rollMonopoly,
    jailRollMonopoly,
    jailPayMonopoly,
    jailUseCardMonopoly,
    buyMonopoly,
    declineMonopoly,
    auctionBidMonopoly,
    auctionPassMonopoly,
    buildMonopoly,
    sellMonopoly,
    mortgageMonopoly,
    unmortgageMonopoly,
    endMonopolyTurn,
    leaveMonopoly,
    respondToMonopolyPlayAgainPrompt,
    clearMonopolyGameOver,
  } = useSocket();

  const [selectedTile, setSelectedTile] = useState<string>('');
  const [buildCount, setBuildCount] = useState(1);
  const [sellCount, setSellCount] = useState(1);
  const [bidAmount, setBidAmount] = useState(1);
  const [hasRespondedPlayAgain, setHasRespondedPlayAgain] = useState(false);

  const isLeader = partyMembers.some((m) => m.userId === user?.id && m.isLeader);
  const me = monopolyGame?.players.find((p) => p.userId === user?.id);
  const currentPlayer = monopolyGame?.players.find((p) => p.userId === monopolyGame.currentPlayerId);
  const isMyTurn = monopolyGame?.currentPlayerId === user?.id;
  const pendingPurchase = monopolyGame?.pendingPurchase;
  const auction = monopolyGame?.auction;
  const isMyBidTurn = auction?.activeBidderIds[auction.currentBidderIndex] === user?.id;

  const ownedTiles = useMemo(() => {
    if (!monopolyGame || !user) return [];
    return monopolyGame.tiles.filter((tile) => tile.ownerId === user.id && tile.type !== 'go');
  }, [monopolyGame, user]);

  const buildableTiles = useMemo(() => ownedTiles.filter((tile) => tile.type === 'property'), [ownedTiles]);

  useEffect(() => {
    if (!selectedTile && ownedTiles.length > 0) {
      setSelectedTile(String(ownedTiles[0].index));
    }
  }, [ownedTiles, selectedTile]);

  useEffect(() => {
    if (monopolyPlayAgainPrompt) {
      setHasRespondedPlayAgain(false);
    }
  }, [monopolyPlayAgainPrompt]);

  useEffect(() => {
    if (auction) {
      setBidAmount(Math.max(auction.highestBid + 1, 1));
    }
  }, [auction?.highestBid, auction?.tileIndex]);

  const selectedTileIndex = selectedTile ? Number(selectedTile) : null;

  if (!currentParty) {
    return (
      <div className="max-w-6xl mx-auto py-12 px-4 space-y-8">
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
            Monopoly
          </h1>
        </header>

        <div className="h-px bg-border" />

        <div className="text-center py-20 space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              Crée ou rejoins une party pour lancer une partie de Monopoly.
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

  const myPlayAgainResponse = monopolyPlayAgainPrompt?.responses.find((r) => r.userId === user?.id);
  const hasAlreadyResponded = hasRespondedPlayAgain || !!myPlayAgainResponse;

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-8">
      <header className="space-y-3">
        <Link
          to="/games"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Jeux
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Party</p>
            <h1 className="text-4xl md:text-5xl font-light">Monopoly</h1>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>{currentParty.name || 'Party sans nom'}</p>
            <p>{partyMembers.length} joueurs</p>
          </div>
        </div>
      </header>

      <div className="h-px bg-border" />

      {!monopolyGame && !monopolyJoinPrompt && (
        <section className="rounded-lg border border-border/50 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Lobby</p>
              <h2 className="text-2xl font-light">Lancer une partie</h2>
            </div>
            {isLeader && (
              <Button onClick={startMonopoly} className="gap-2">
                <Dice6 className="h-4 w-4" />
                Demarrer
              </Button>
            )}
          </div>
          {!isLeader && (
            <p className="text-sm text-muted-foreground">
              Le chef de party doit lancer la partie.
            </p>
          )}
        </section>
      )}

      {monopolyGame && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-8">
          <section className="space-y-4">
            <div className="rounded-lg border border-border/50 p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Tour</p>
                  <p className="text-lg font-medium">{currentPlayer?.username || '—'}</p>
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Dice6 className="h-4 w-4" />
                  {monopolyGame.lastRoll ? (
                    <span>
                      {monopolyGame.lastRoll.die1} + {monopolyGame.lastRoll.die2} = {monopolyGame.lastRoll.total}
                    </span>
                  ) : (
                    <span>Pas encore lance</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Phase: {monopolyGame.phase}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-10 gap-2">
              {monopolyGame.tiles.map((tile) => {
                const playersHere = monopolyGame.players.filter((p) => p.position === tile.index && !p.isBankrupt);
                const owner = tile.ownerId
                  ? monopolyGame.players.find((p) => p.userId === tile.ownerId)
                  : null;

                return (
                  <div
                    key={tile.index}
                    className={cn(
                      'border border-border/40 rounded-md p-2 text-[10px] flex flex-col gap-1 min-h-[90px]',
                      tile.index === monopolyGame.players.find((p) => p.userId === monopolyGame.currentPlayerId)?.position &&
                        'border-foreground/60'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{tile.index}</span>
                      {tile.color && <span className={cn('h-2 w-6 rounded-full', colorMap[tile.color])} />}
                    </div>
                    <div className="font-medium text-foreground/90">{shortName(tile.name)}</div>
                    {tile.price && <div className="text-muted-foreground">${tile.price}</div>}
                    {tile.houses > 0 && (
                      <div className="text-emerald-400">
                        {tile.houses >= 5 ? 'Hotel' : `${tile.houses} maison(s)`}
                      </div>
                    )}
                    {tile.mortgaged && <div className="text-amber-400">Hypotheque</div>}
                    {owner && (
                      <div className="text-[10px]" style={owner.usernameColor ? { color: owner.usernameColor } : undefined}>
                        {owner.username}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {playersHere.map((p) => (
                        <span
                          key={p.userId}
                          className={cn(
                            'h-4 w-4 rounded-full border border-border/40 flex items-center justify-center text-[8px]',
                            p.userId === user?.id ? 'bg-foreground text-background' : 'bg-muted'
                          )}
                        >
                          {p.username.slice(0, 1).toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-lg border border-border/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Moi</span>
                <div className="flex items-center gap-2 text-sm">
                  <Coins className="h-4 w-4" />
                  {me?.cash ?? 0}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Position: {me?.position ?? 0} {me?.inJail ? '(Prison)' : ''}
              </div>
            </div>

            <div className="rounded-lg border border-border/50 p-4 space-y-3">
              <p className="text-sm font-medium">Actions</p>
              {!isMyTurn && (
                <p className="text-xs text-muted-foreground">En attente du tour adverse.</p>
              )}

              {isMyTurn && monopolyGame.phase === 'jail' && (
                <div className="space-y-2">
                  <Button onClick={jailRollMonopoly} variant="outline" className="w-full">
                    Tenter le double
                  </Button>
                  <Button onClick={jailPayMonopoly} variant="outline" className="w-full">
                    Payer $50
                  </Button>
                  <Button onClick={jailUseCardMonopoly} variant="outline" className="w-full" disabled={(me?.getOutOfJailCards || 0) === 0}>
                    Utiliser carte ({me?.getOutOfJailCards || 0})
                  </Button>
                </div>
              )}

              {isMyTurn && monopolyGame.phase === 'waiting-roll' && !me?.inJail && (
                <Button onClick={rollMonopoly} className="w-full gap-2">
                  <Dice6 className="h-4 w-4" />
                  Lancer les des
                </Button>
              )}

              {isMyTurn && pendingPurchase && (
                <div className="space-y-2">
                  <Button onClick={buyMonopoly} className="w-full">
                    Acheter (${pendingPurchase.price})
                  </Button>
                  <Button onClick={declineMonopoly} variant="outline" className="w-full">
                    Passer a l'enchere
                  </Button>
                </div>
              )}

              {isMyTurn && monopolyGame.phase === 'turn-end' && (
                <Button onClick={endMonopolyTurn} variant="outline" className="w-full">
                  Fin du tour
                </Button>
              )}

              {auction && (
                <div className="space-y-2 border-t border-border/40 pt-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Gavel className="h-4 w-4" />
                    Encheres: {monopolyGame.tiles[auction.tileIndex].name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Meilleure offre: ${auction.highestBid} {auction.highestBidderId ? '(leader)' : ''}
                  </div>
                  {isMyBidTurn ? (
                    <div className="space-y-2">
                      <Input
                        type="number"
                        min={auction.highestBid + 1}
                        value={bidAmount}
                        onChange={(e) => setBidAmount(Number(e.target.value))}
                      />
                      <Button onClick={() => auctionBidMonopoly(bidAmount)} className="w-full">
                        Miser
                      </Button>
                      <Button onClick={auctionPassMonopoly} variant="outline" className="w-full">
                        Passer
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">En attente des encheres...</p>
                  )}
                </div>
              )}

              {isMyTurn && !pendingPurchase && !auction && (
                <div className="space-y-2 border-t border-border/40 pt-3">
                  <p className="text-xs text-muted-foreground">Gestion de proprietes</p>
                  <select
                    className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                    value={selectedTile}
                    onChange={(e) => setSelectedTile(e.target.value)}
                  >
                    {ownedTiles.length === 0 && <option value="">Aucune propriete</option>}
                    {ownedTiles.map((tile) => (
                      <option key={tile.index} value={tile.index}>
                        {tile.name}
                      </option>
                    ))}
                  </select>
                  {selectedTileIndex !== null && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          className="w-full"
                          value={buildCount}
                          onChange={(e) => setBuildCount(Number(e.target.value))}
                        />
                        <Button
                          variant="outline"
                          onClick={() => buildMonopoly(selectedTileIndex, buildCount)}
                          disabled={!buildableTiles.some((tile) => tile.index === selectedTileIndex)}
                        >
                          Construire
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          className="w-full"
                          value={sellCount}
                          onChange={(e) => setSellCount(Number(e.target.value))}
                        />
                        <Button
                          variant="outline"
                          onClick={() => sellMonopoly(selectedTileIndex, sellCount)}
                          disabled={!buildableTiles.some((tile) => tile.index === selectedTileIndex)}
                        >
                          Vendre
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => mortgageMonopoly(selectedTileIndex)}>
                          Hypothequer
                        </Button>
                        <Button variant="outline" className="flex-1" onClick={() => unmortgageMonopoly(selectedTileIndex)}>
                          Lever
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border/50 p-4 space-y-2">
              <p className="text-sm font-medium">Joueurs</p>
              <div className="space-y-2">
                {monopolyGame.players.map((player) => (
                  <div
                    key={player.userId}
                    className={cn(
                      'flex items-center justify-between text-xs rounded border border-border/40 px-2 py-2',
                      player.userId === monopolyGame.currentPlayerId && 'border-foreground/60'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: player.usernameColor || '#999' }}
                      />
                      <span style={player.usernameColor ? { color: player.usernameColor } : undefined}>
                        {player.username}
                        {player.userId === user?.id && ' (toi)'}
                        {partyMembers.find((m) => m.userId === player.userId)?.isLeader && (
                          <Crown className="inline-block ml-1 h-3 w-3 text-yellow-500" />
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>${player.cash}</span>
                      {player.inJail && <span>Prison</span>}
                      {player.isBankrupt && <span>Out</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border/50 p-4 space-y-2">
              <p className="text-sm font-medium">Journal</p>
              <div className="space-y-1 text-xs text-muted-foreground max-h-40 overflow-y-auto">
                {monopolyGame.log.length === 0 && <p>Aucun evenement pour le moment.</p>}
                {monopolyGame.log.map((entry, index) => (
                  <p key={`${entry}-${index}`}>{entry}</p>
                ))}
              </div>
            </div>

            <Button variant="outline" onClick={leaveMonopoly}>
              Quitter la partie
            </Button>
          </aside>
        </div>
      )}

      <Dialog open={!!monopolyPlayAgainPrompt} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal">Rejouer ?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Gagnant: {monopolyPlayAgainPrompt?.gameOverData.winnerUsername || '—'}
            </div>
            <div className="space-y-2">
              {monopolyPlayAgainPrompt?.players.map((player) => {
                const response = monopolyPlayAgainPrompt.responses.find((r) => r.userId === player.userId);
                return (
                  <div key={player.userId} className="flex items-center justify-between text-sm">
                    <span style={player.usernameColor ? { color: player.usernameColor } : undefined}>
                      {player.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {response ? (response.playAgain ? 'Rejoue' : 'Quitte') : 'En attente'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="gap-2">
            {!hasAlreadyResponded ? (
              <>
                <Button variant="outline" onClick={() => { respondToMonopolyPlayAgainPrompt(false); setHasRespondedPlayAgain(true); }}>
                  Quitter
                </Button>
                <Button onClick={() => { respondToMonopolyPlayAgainPrompt(true); setHasRespondedPlayAgain(true); }}>
                  Rejouer
                </Button>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Reponse envoyee.</div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!monopolyGameOver && !monopolyPlayAgainPrompt} onOpenChange={clearMonopolyGameOver}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal">Partie terminee</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Gagnant: {monopolyGameOver?.winnerUsername || '—'}</p>
            <div className="space-y-1 text-sm">
              {monopolyGameOver?.standings.map((player) => (
                <div key={player.userId} className="flex items-center justify-between">
                  <span>{player.username}</span>
                  <span className="text-muted-foreground">${player.cash}</span>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { ArrowLeft, Users, Dice6, Crown, Coins, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import './Monopoly.css';

const colorMap: Record<string, string> = {
  brown: '#8B5A2B',
  lightblue: '#6EC6E8',
  pink: '#E573A7',
  orange: '#F59E0B',
  red: '#EF4444',
  yellow: '#FCD34D',
  green: '#22C55E',
  darkblue: '#1D4ED8',
};

const tileLabelMap: Record<string, string> = {
  go: 'Départ',
  property: 'Propriété',
  railroad: 'Gare',
  utility: 'Compagnie',
  chance: 'Chance',
  community: 'Caisse de communauté',
  tax: 'Taxe',
  jail: 'Prison',
  'free-parking': 'Parc Gratuit',
  'go-to-jail': 'Allez en prison',
};

const getTilePosition = (index: number) => {
  if (index <= 10) {
    return { row: 10, col: 10 - index };
  }
  if (index <= 19) {
    return { row: 10 - (index - 10), col: 0 };
  }
  if (index === 20) {
    return { row: 0, col: 0 };
  }
  if (index <= 29) {
    return { row: 0, col: index - 20 };
  }
  if (index === 30) {
    return { row: 0, col: 10 };
  }
  return { row: index - 30, col: 10 };
};

const formatMoney = (amount?: number | null) => `$${amount ?? 0}`;

const renderPropertyDetails = (tile: { type: string; rent?: number[]; price?: number; houseCost?: number }) => {
  if (tile.type === 'property' && tile.rent) {
    return (
      <div className="monopoly-rent-grid">
        <div>Sans maison</div>
        <div>{formatMoney(tile.rent[0])}</div>
        <div>1 maison</div>
        <div>{formatMoney(tile.rent[1])}</div>
        <div>2 maisons</div>
        <div>{formatMoney(tile.rent[2])}</div>
        <div>3 maisons</div>
        <div>{formatMoney(tile.rent[3])}</div>
        <div>4 maisons</div>
        <div>{formatMoney(tile.rent[4])}</div>
        <div>Hôtel</div>
        <div>{formatMoney(tile.rent[5])}</div>
      </div>
    );
  }

  if (tile.type === 'railroad') {
    return (
      <div className="monopoly-rent-grid">
        <div>1 gare</div>
        <div>$25</div>
        <div>2 gares</div>
        <div>$50</div>
        <div>3 gares</div>
        <div>$100</div>
        <div>4 gares</div>
        <div>$200</div>
      </div>
    );
  }

  if (tile.type === 'utility') {
    return (
      <div className="text-xs text-muted-foreground space-y-1">
        <p>1 compagnie: 4x le lancer</p>
        <p>2 compagnies: 10x le lancer</p>
      </div>
    );
  }

  return null;
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

  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);
  const [buildCount, setBuildCount] = useState(1);
  const [sellCount, setSellCount] = useState(1);
  const [bidAmount, setBidAmount] = useState(1);
  const [hasRespondedPlayAgain, setHasRespondedPlayAgain] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

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

  useEffect(() => {
    if (!selectedTileIndex && ownedTiles.length > 0) {
      setSelectedTileIndex(ownedTiles[0].index);
    }
  }, [ownedTiles, selectedTileIndex]);

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
  const selectedTile = selectedTileIndex !== null
    ? monopolyGame?.tiles.find((tile) => tile.index === selectedTileIndex)
    : null;

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 space-y-8">
      <header className="space-y-3">
        <Link
          to="/games"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Jeux
        </Link>
        <div className="flex items-center justify-between gap-4 flex-wrap">
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
                Démarrer
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
        <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_320px] gap-6">
          <aside className="space-y-4">
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
                      <span>{formatMoney(player.cash)}</span>
                      {player.inJail && <span>Prison</span>}
                      {player.isBankrupt && <span>Out</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border/50 p-4 space-y-2">
              <p className="text-sm font-medium">Journal</p>
              <div className="space-y-1 text-xs text-muted-foreground max-h-72 overflow-y-auto">
                {monopolyGame.log.length === 0 && <p>Aucun événement pour le moment.</p>}
                {monopolyGame.log.map((entry, index) => (
                  <p key={`${entry}-${index}`}>{entry}</p>
                ))}
              </div>
            </div>
          </aside>

          <section className="space-y-4">
            <div className="rounded-lg border border-border/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                    <span>Pas encore lancé</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Phase: {monopolyGame.phase}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
                  >
                    +
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.1))}
                  >
                    -
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setZoomLevel(1)}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <div className="monopoly-board-viewport">
              <div className="monopoly-board" style={{ transform: `scale(${zoomLevel})` }}>
                {monopolyGame.tiles.map((tile) => {
                  const position = getTilePosition(tile.index);
                  const playersHere = monopolyGame.players.filter((p) => p.position === tile.index && !p.isBankrupt);
                  const owner = tile.ownerId
                    ? monopolyGame.players.find((p) => p.userId === tile.ownerId)
                    : null;

                  return (
                    <div
                      key={tile.index}
                      className={cn(
                        'monopoly-tile',
                        tile.index === monopolyGame.players.find((p) => p.userId === monopolyGame.currentPlayerId)?.position &&
                          'is-current'
                      )}
                      style={{ gridRow: position.row + 1, gridColumn: position.col + 1 }}
                      onClick={() => setSelectedTileIndex(tile.index)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="monopoly-tile-header">
                        <span className="text-[9px] text-muted-foreground">{tile.index}</span>
                        {tile.color && (
                          <span className="monopoly-color-bar" style={{ backgroundColor: colorMap[tile.color] }} />
                        )}
                      </div>
                      <div className="monopoly-tile-name">{tile.name}</div>
                      {tile.price && <div className="text-muted-foreground">{formatMoney(tile.price)}</div>}
                      {!tile.price && tile.type !== 'go' && tile.type !== 'jail' && (
                        <div className="text-muted-foreground">{tileLabelMap[tile.type] || tile.type}</div>
                      )}
                      {tile.houses > 0 && (
                        <div className="monopoly-buildings">
                          {tile.houses >= 5 ? (
                            <span className="monopoly-hotel" />
                          ) : (
                            Array.from({ length: tile.houses }).map((_, idx) => (
                              <span key={`${tile.index}-house-${idx}`} className="monopoly-house" />
                            ))
                          )}
                        </div>
                      )}
                      {tile.mortgaged && <div className="text-amber-400">Hypothèque</div>}
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
                              'monopoly-token',
                              p.userId === user?.id ? 'is-me' : ''
                            )}
                            style={p.usernameColor ? { borderColor: p.usernameColor } : undefined}
                          >
                            {p.username.slice(0, 1).toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="monopoly-center">
                  <div className="monopoly-center-title">Monopoly</div>
                  <div className="text-xs text-muted-foreground">
                    {monopolyGame.turnNumber} tours joués
                  </div>
                </div>
              </div>
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
                  <Button
                    onClick={jailUseCardMonopoly}
                    variant="outline"
                    className="w-full"
                    disabled={(me?.getOutOfJailCards || 0) === 0}
                  >
                    Utiliser carte ({me?.getOutOfJailCards || 0})
                  </Button>
                </div>
              )}

              {isMyTurn && monopolyGame.phase === 'waiting-roll' && !me?.inJail && (
                <Button onClick={rollMonopoly} className="w-full gap-2">
                  <Dice6 className="h-4 w-4" />
                  Lancer les dés
                </Button>
              )}

              {isMyTurn && pendingPurchase && (
                <div className="space-y-2">
                  <Button onClick={buyMonopoly} className="w-full">
                    Acheter ({formatMoney(pendingPurchase.price)})
                  </Button>
                  <Button onClick={declineMonopoly} variant="outline" className="w-full">
                    Passer à l'enchère
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
                    Enchères: {monopolyGame.tiles[auction.tileIndex].name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Meilleure offre: {formatMoney(auction.highestBid)} {auction.highestBidderId ? '(leader)' : ''}
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
                    <p className="text-xs text-muted-foreground">En attente des enchères...</p>
                  )}
                </div>
              )}

              {isMyTurn && !pendingPurchase && !auction && (
                <div className="space-y-2 border-t border-border/40 pt-3">
                  <p className="text-xs text-muted-foreground">Gestion de propriétés</p>
                  <select
                    className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                    value={selectedTileIndex ?? ''}
                    onChange={(e) => setSelectedTileIndex(e.target.value ? Number(e.target.value) : null)}
                  >
                    {ownedTiles.length === 0 && <option value="">Aucune propriété</option>}
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
                          disabled={!ownedTiles.some((tile) => tile.index === selectedTileIndex && tile.type === 'property')}
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
                          disabled={!ownedTiles.some((tile) => tile.index === selectedTileIndex && tile.type === 'property')}
                        >
                          Vendre
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => mortgageMonopoly(selectedTileIndex)}>
                          Hypothéquer
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

            <div className="rounded-lg border border-border/50 p-4 space-y-3">
              <p className="text-sm font-medium">Mes propriétés</p>
              {ownedTiles.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune propriété pour le moment.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {ownedTiles.map((tile) => (
                    <button
                      key={tile.index}
                      className={cn(
                        'monopoly-mini-card',
                        tile.mortgaged && 'is-mortgaged'
                      )}
                      onClick={() => setSelectedTileIndex(tile.index)}
                    >
                      <span
                        className="monopoly-mini-card-color"
                        style={{ backgroundColor: tile.color ? colorMap[tile.color] : '#9CA3AF' }}
                      />
                      <span className="monopoly-mini-card-name">{tile.name}</span>
                      {tile.houses > 0 && (
                        <span className="monopoly-mini-card-houses">
                          {tile.houses >= 5 ? 'Hôtel' : `${tile.houses}m`}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button variant="outline" onClick={leaveMonopoly}>
              Quitter la partie
            </Button>
          </aside>
        </div>
      )}

      <Dialog open={selectedTileIndex !== null && !!selectedTile} onOpenChange={() => setSelectedTileIndex(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal">{selectedTile?.name}</DialogTitle>
          </DialogHeader>
          {selectedTile && (
            <div className="space-y-4">
              <div className="monopoly-property-card">
                <div
                  className="monopoly-property-card-header"
                  style={{ backgroundColor: selectedTile.color ? colorMap[selectedTile.color] : '#111827' }}
                >
                  {selectedTile.name}
                </div>
                <div className="monopoly-property-card-body">
                  {renderPropertyDetails(selectedTile)}
                </div>
                {selectedTile.price && (
                  <div className="monopoly-property-card-footer">
                    <div>Valeur hypothèque: {formatMoney(Math.floor(selectedTile.price / 2))}</div>
                    {selectedTile.houseCost && (
                      <div>Coût maison: {formatMoney(selectedTile.houseCost)}</div>
                    )}
                  </div>
                )}
              </div>
              {isMyTurn && selectedTile.ownerId === user?.id && (
                <div className="space-y-2">
                  {selectedTile.type === 'property' && (
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
                        onClick={() => buildMonopoly(selectedTile.index, buildCount)}
                      >
                        Construire
                      </Button>
                    </div>
                  )}
                  {selectedTile.type === 'property' && (
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
                        onClick={() => sellMonopoly(selectedTile.index, sellCount)}
                      >
                        Vendre
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => mortgageMonopoly(selectedTile.index)}>
                      Hypothéquer
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => unmortgageMonopoly(selectedTile.index)}>
                      Lever
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingPurchase} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal">Acheter une propriété ?</DialogTitle>
          </DialogHeader>
          {pendingPurchase && monopolyGame && (
            <div className="space-y-4">
              <div className="monopoly-property-card">
                <div
                  className="monopoly-property-card-header"
                  style={{
                    backgroundColor: monopolyGame.tiles[pendingPurchase.tileIndex].color
                      ? colorMap[monopolyGame.tiles[pendingPurchase.tileIndex].color as string]
                      : '#111827',
                  }}
                >
                  {monopolyGame.tiles[pendingPurchase.tileIndex].name}
                </div>
                <div className="monopoly-property-card-body">
                  {renderPropertyDetails(monopolyGame.tiles[pendingPurchase.tileIndex])}
                </div>
                <div className="monopoly-property-card-footer">
                  Prix: {formatMoney(pendingPurchase.price)}
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={declineMonopoly}>
                  Passer
                </Button>
                <Button onClick={buyMonopoly}>Acheter</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              <div className="text-xs text-muted-foreground">Réponse envoyée.</div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!monopolyGameOver && !monopolyPlayAgainPrompt} onOpenChange={clearMonopolyGameOver}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal">Partie terminée</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Gagnant: {monopolyGameOver?.winnerUsername || '—'}</p>
            <div className="space-y-1 text-sm">
              {monopolyGameOver?.standings.map((player) => (
                <div key={player.userId} className="flex items-center justify-between">
                  <span>{player.username}</span>
                  <span className="text-muted-foreground">{formatMoney(player.cash)}</span>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

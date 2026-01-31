import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { usersApi } from '../services/api';
import { Plus, LogOut, UserPlus, X, RefreshCw, Trash2, User } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import PageLayout from '@/components/layout/PageLayout';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';

interface User {
  id: string;
  username: string;
  usernameColor?: string | null;
}

const multiplayerGames = [
  {
    id: 'bomb-party',
    name: 'Bomb Party',
    description: 'Trouve des mots contenant les lettres avant que la bombe explose.',
    type: 'Party',
  },
  {
    id: 'petit-bac',
    name: 'Petit Bac',
    description: 'Remplis les categories avec la bonne lettre avant la fin du temps.',
    type: 'Party',
  },
  {
    id: 'poker',
    name: 'Poker',
    description: 'Joue une table entre amis, blindes et stack personnalisables.',
    type: 'Party',
  },
  {
    id: 'russian-roulette',
    name: 'Roulette Russe',
    description: '1/6 chance de perdre à chaque tour. Le dernier survivant gagne.',
    type: 'Party',
  },
];

const duelGames = [
  {
    id: 'bataille-navale',
    name: 'Bataille Navale',
    description: 'Place tes bateaux et coule ceux de ton adversaire.',
    type: 'Duel',
  },
];

const getGameLink = (gameId: string) => {
  if (gameId === 'bomb-party') {
    return '/games/bomb-party';
  }
  if (gameId === 'petit-bac') {
    return '/games/petit-bac';
  }
  if (gameId === 'poker') {
    return '/games/poker';
  }
  if (gameId === 'russian-roulette') {
    return '/games/russian-roulette';
  }
  if (gameId === 'bataille-navale') {
    return '/games/bataille-navale';
  }
  return `/games/${gameId}`;
};

export default function Party() {
  const { user } = useAuth();
  const {
    currentParty,
    partyMembers,
    partyInvites,
    publicParties,
    partyJoinRequests,
    pendingJoinRequests,
    createParty,
    joinParty,
    requestJoinParty,
    respondToJoinRequest,
    leaveParty,
    deleteParty,
    inviteToParty,
    rejectPartyInvite,
    kickFromParty,
    fetchPublicParties,
    syncParty,
    partyGameSuggestions,
    partySelectedGame,
    suggestPartyGame,
    selectPartyGame,
  } = useSocket();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxSize, setMaxSize] = useState<number>(8);
  const [partyType, setPartyType] = useState<'party' | 'duel' | ''>('');
  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    syncParty(); // Sync party state to resolve any ghost states
    fetchPublicParties();
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    try {
      const response = await usersApi.getAll();
      setAllUsers(response.data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleCreateParty = () => {
    const size = partyType === 'duel' ? 2 : maxSize;
    createParty(partyName || undefined, isPublic, size);
    setShowCreateModal(false);
    setPartyName('');
    setIsPublic(true);
    setMaxSize(8);
    setPartyType('');
  };

  const handleInvite = (userId: string) => {
    inviteToParty(userId);
    setShowInviteModal(false);
  };

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const availableUsersToInvite = allUsers.filter(
    (u) =>
      u.id !== user?.id &&
      !partyMembers.find((m) => m.userId === u.id)
  );
  const selectedGameId = partySelectedGame?.gameId;
  return (
    <>
      <PageLayout variant="compact">

      {/* Invites */}
      {partyInvites.length > 0 && (
        <Card className="border-border/40">
          <CardHeader>
            <h2 className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground tracking-wide uppercase")}>
              Invitations
            </h2>
          </CardHeader>
          <CardContent className="space-y-0">
            {partyInvites.map((invite) => (
              <div
                key={invite.partyId}
                className="flex items-center justify-between py-4 border-b border-border/30 last:border-0"
              >
                <div>
                  <p className={TYPOGRAPHY.SMALL}>{invite.partyName || 'Party sans nom'}</p>
                  <p className={TYPOGRAPHY.XS}>
                    de {invite.inviterUsername}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => rejectPartyInvite(invite.partyId)}
                    variant="outline"
                    size="sm"
                  >
                    Refuser
                  </Button>
                  <Button
                    onClick={() => joinParty(invite.partyId)}
                    variant="outline"
                    size="sm"
                  >
                    Rejoindre
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}


      {/* Current Party or Public Parties */}
      {currentParty ? (
        <Card className="border-border/40">
          <CardContent className={SPACING.SECTION_SPACING}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className={TYPOGRAPHY.H2}>
                  {currentParty.name || 'Ta party'}
                </h2>
                <p className={TYPOGRAPHY.SMALL}>
                  {currentParty.isPublic ? 'Publique' : 'Privée'} · {partyMembers.length}/{currentParty.maxSize}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isLeader && (
                  <Button
                    onClick={() => setShowInviteModal(true)}
                    variant="outline"
                    size="sm"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Inviter
                  </Button>
                )}
                {isLeader ? (
                  <Button
                    onClick={deleteParty}
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer la party
                  </Button>
                ) : (
                  <Button
                    onClick={leaveParty}
                    variant="destructive"
                    size="sm"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Quitter
                  </Button>
                )}
              </div>
            </div>

            {/* Members */}
            <Card className="border-border/40">
              <CardContent className="space-y-0">
                {partyMembers.map((member) => (
                  <div
                    key={member.userId}
                    className={cn(
                      "flex items-center justify-between py-4 border-b border-border/30 last:border-0",
                      member.userId === user?.id && "bg-muted/30 -mx-4 px-4"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <span className={TYPOGRAPHY.SMALL}>
                        <span style={member.usernameColor ? { color: member.usernameColor } : undefined}>
                          {member.username}
                        </span>
                        {member.isLeader && (
                          <span className={cn(TYPOGRAPHY.XS, "ml-2 text-muted-foreground")}>leader</span>
                        )}
                        {member.userId === user?.id && (
                          <span className={cn(TYPOGRAPHY.XS, "ml-2 text-muted-foreground")}>(toi)</span>
                        )}
                      </span>
                    </div>
                    {isLeader && member.userId !== user?.id && (
                      <Button
                        onClick={() => kickFromParty(member.userId)}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className={SPACING.CARD_SPACING}>
              <h3 className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground tracking-wide uppercase")}>
                {currentParty.maxSize === 2 ? 'Jeux de duel' : 'Jeux multijoueur'}
              </h3>
              {partySelectedGame ? (
                <Card className="border-border/40">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className={TYPOGRAPHY.SMALL}>{partySelectedGame.gameName}</p>
                        <p className={TYPOGRAPHY.XS}>
                          selectionne par{' '}
                          <span
                            style={partySelectedGame.selectedByColor ? { color: partySelectedGame.selectedByColor } : undefined}
                          >
                            {partySelectedGame.selectedByName}
                          </span>
                        </p>
                      </div>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                      >
                        <Link to={getGameLink(partySelectedGame.gameId)}>
                          Ouvrir
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <p className={TYPOGRAPHY.SMALL}>
                  Aucun jeu selectionne pour le moment
                </p>
              )}

              <div className="space-y-0">
                {(currentParty.maxSize === 2 ? duelGames : multiplayerGames).map((game) => {
                  const hasSuggested = partyGameSuggestions.some(
                    (suggestion) => suggestion.gameId === game.id && suggestion.suggestedById === user?.id
                  );
                  const isSelected = selectedGameId === game.id;
                  const isDisabled = isLeader ? isSelected : hasSuggested || isSelected;
                  return (
                    <div
                      key={game.id}
                      className="flex items-center justify-between py-4 border-b border-border/30 last:border-0"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <p className={TYPOGRAPHY.SMALL}>{game.name}</p>
                          <span className={cn(TYPOGRAPHY.XS, "uppercase tracking-wide text-muted-foreground")}>
                            {game.type}
                          </span>
                        </div>
                        <p className={TYPOGRAPHY.SMALL}>
                          {game.description}
                        </p>
                      </div>
                      <Button
                        onClick={() =>
                          isLeader
                            ? selectPartyGame(game.id, game.name)
                            : suggestPartyGame(game.id, game.name)
                        }
                        disabled={isDisabled}
                        variant="outline"
                        size="sm"
                      >
                        {isLeader
                          ? isSelected
                            ? 'Selectionne'
                            : 'Choisir'
                          : isSelected
                            ? 'Selectionne'
                            : hasSuggested
                              ? 'Suggere'
                              : 'Suggerer'}
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <p className={cn(TYPOGRAPHY.XS, "uppercase tracking-[0.2em] text-muted-foreground")}>
                  Suggestions
                </p>
                {partyGameSuggestions.length === 0 ? (
                  <p className={TYPOGRAPHY.SMALL}>Aucune suggestion</p>
                ) : (
                  <div className="space-y-0">
                    {partyGameSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                      >
                        <div className={TYPOGRAPHY.SMALL}>
                          <span className="font-medium">{suggestion.gameName}</span>
                          <span className="text-muted-foreground"> · par </span>
                          <span
                            style={suggestion.suggestedByColor ? { color: suggestion.suggestedByColor } : undefined}
                          >
                            {suggestion.suggestedByName}
                          </span>
                        </div>
                        {isLeader && suggestion.gameId !== selectedGameId && (
                          <Button
                            onClick={() => selectPartyGame(suggestion.gameId, suggestion.gameName)}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                        >
                          Choisir
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

            {isLeader && partyJoinRequests.length > 0 && (
              <div className={SPACING.CARD_SPACING}>
                <h3 className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground tracking-wide uppercase")}>
                  Demandes en attente
                </h3>
                <div className="space-y-0">
                  {partyJoinRequests.map((request) => (
                    <div
                      key={`${request.partyId}-${request.userId}`}
                      className="flex items-center justify-between py-4 border-b border-border/30 last:border-0"
                    >
                      <div className={TYPOGRAPHY.SMALL}>
                        <span style={request.usernameColor ? { color: request.usernameColor } : undefined}>
                          {request.username}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => respondToJoinRequest(request.userId, false)}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          Refuser
                        </Button>
                        <Button
                          onClick={() => respondToJoinRequest(request.userId, true)}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          Accepter
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/40">
          <CardContent className={SPACING.SECTION_SPACING}>
            <div className="flex items-center justify-between gap-3">
              <h2 className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground tracking-wide uppercase")}>
                Parties ouvertes
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowCreateModal(true)}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Créer
                </Button>
                <Button
                  onClick={fetchPublicParties}
                  variant="ghost"
                  size="icon"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {publicParties.length === 0 ? (
              <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>
                Aucune party disponible
              </p>
            ) : (
              <div className={SPACING.SECTION_SPACING}>
                <div className="space-y-0">
                  {publicParties.map((party) => {
                    const isPending = pendingJoinRequests.includes(party.id);
                    const isFull = party.memberCount >= party.maxSize;
                    const isDuel = party.maxSize === 2;
                    return (
                      <div
                        key={party.id}
                        className="flex items-center justify-between py-4 border-b border-border/30 last:border-0"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <p className={TYPOGRAPHY.SMALL}>{party.name || (isDuel ? 'Duel sans nom' : 'Party sans nom')}</p>
                            <span className={cn(TYPOGRAPHY.XS, "uppercase tracking-wide text-muted-foreground")}>
                              {isDuel ? 'Duel' : 'Party'}
                            </span>
                          </div>
                          <p className={TYPOGRAPHY.XS}>
                            {party.memberCount}/{party.maxSize} membres · {party.isPublic ? 'publique' : 'privée'}
                          </p>
                        </div>
                        {party.isPublic ? (
                          <Button
                            onClick={() => joinParty(party.id)}
                            disabled={isFull}
                            variant="outline"
                            size="sm"
                          >
                            {isFull ? 'Pleine' : 'Rejoindre'}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => requestJoinParty(party.id)}
                            disabled={isFull || isPending}
                            variant="outline"
                            size="sm"
                          >
                            {isFull ? 'Pleine' : isPending ? 'Demande envoyée' : 'Demander'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </PageLayout>

      {/* Create Party Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal">Créer une party</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partyType" className="text-sm text-muted-foreground">
                Type
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={partyType === 'party' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => {
                    setPartyType('party');
                    setMaxSize(8);
                  }}
                >
                  Party
                </Button>
                <Button
                  type="button"
                  variant={partyType === 'duel' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => {
                    setPartyType('duel');
                    setMaxSize(2);
                  }}
                >
                  Duel
                </Button>
              </div>
            </div>
            {partyType && (
              <>
                <Input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="Nom (optionnel)"
                  className="h-12 bg-transparent border-border/50"
                />
                {partyType === 'party' && (
                  <div className="space-y-2">
                    <Label htmlFor="maxSize" className="text-sm text-muted-foreground">
                      Taille maximale
                    </Label>
                    <div className="flex flex-wrap items-center justify-center gap-1 text-muted-foreground">
                      {Array.from({ length: maxSize }).map((_, index) => (
                        <User key={`${maxSize}-${index}`} className="h-3.5 w-3.5" />
                      ))}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>2</span>
                        <span className="text-foreground font-semibold">{maxSize} joueurs</span>
                        <span>16</span>
                      </div>
                      <Slider
                        value={[maxSize]}
                        min={2}
                        max={16}
                        step={1}
                        onValueChange={(value) => setMaxSize(value[0])}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="isPublic"
                    checked={isPublic}
                    onCheckedChange={(checked) => setIsPublic(checked === true)}
                  />
                  <Label htmlFor="isPublic" className="cursor-pointer text-sm text-muted-foreground">
                    Publique
                  </Label>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              className="border-border/30"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateParty}
              variant="outline"
              className="border-foreground"
              disabled={!partyType}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal">Inviter</DialogTitle>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-0">
            {availableUsersToInvite.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Personne à inviter
              </p>
            ) : (
              availableUsersToInvite.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleInvite(u.id)}
                  className="w-full text-left py-3 border-b border-border/30 last:border-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {u.username}
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteModal(false)}
              className="w-full border-border/30"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

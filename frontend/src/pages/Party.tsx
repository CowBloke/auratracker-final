import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { usersApi } from '../services/api';
import { Plus, LogOut, UserPlus, X, RefreshCw, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

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
    createParty(partyName || undefined, isPublic, maxSize);
    setShowCreateModal(false);
    setPartyName('');
    setIsPublic(true);
    setMaxSize(8);
  };

  const handleInvite = (userId: string) => {
    inviteToParty(userId);
    setShowInviteModal(false);
  };

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const publicPartyList = publicParties.filter((party) => party.isPublic);
  const privatePartyList = publicParties.filter((party) => !party.isPublic);
  const availableUsersToInvite = allUsers.filter(
    (u) =>
      u.id !== user?.id &&
      !partyMembers.find((m) => m.userId === u.id)
  );
  const selectedGameId = partySelectedGame?.gameId;
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Multijoueur
            </p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Party
            </h1>
          </div>
          {!currentParty && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              <Plus className="h-4 w-4" />
              Créer
            </button>
          )}
        </div>
      </header>

      {/* Invites */}
      {partyInvites.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
            Invitations
          </h2>
          <div className="space-y-0">
            {partyInvites.map((invite) => (
              <div
                key={invite.partyId}
                className="flex items-center justify-between py-4 border-b border-border/30"
              >
                <div>
                  <p className="font-medium">{invite.partyName || 'Party sans nom'}</p>
                  <p className="text-sm text-muted-foreground">
                    de {invite.inviterUsername}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => rejectPartyInvite(invite.partyId)}
                    className="px-4 py-2 text-sm border border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    Refuser
                  </button>
                  <button
                    onClick={() => joinParty(invite.partyId)}
                    className="px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
                  >
                    Rejoindre
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Current Party or Public Parties */}
      {currentParty ? (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-light">
                {currentParty.name || 'Ta party'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {currentParty.isPublic ? 'Publique' : 'Privée'} · {partyMembers.length}/{currentParty.maxSize}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isLeader && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  Inviter
                </button>
              )}
              {isLeader ? (
                <button
                  onClick={deleteParty}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer la party
                </button>
              ) : (
                <button
                  onClick={leaveParty}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Quitter
                </button>
              )}
            </div>
          </div>

          {/* Members */}
          <div className="space-y-0">
            {partyMembers.map((member) => (
              <div
                key={member.userId}
                className={cn(
                  "flex items-center justify-between py-4 border-b border-border/30 last:border-0",
                  member.userId === user?.id && "bg-muted/30 -mx-4 px-4"
                )}
              >
                <div className="flex items-center gap-4">
                  <span className="font-medium">
                    <span style={member.usernameColor ? { color: member.usernameColor } : undefined}>
                      {member.username}
                    </span>
                    {member.isLeader && (
                      <span className="ml-2 text-xs text-muted-foreground">leader</span>
                    )}
                    {member.userId === user?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(toi)</span>
                    )}
                  </span>
                </div>
                {isLeader && member.userId !== user?.id && (
                  <button
                    onClick={() => kickFromParty(member.userId)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-4 pt-6 border-t border-border/30">
            <h3 className="text-sm text-muted-foreground tracking-wide uppercase">
              Jeux multijoueur
            </h3>
            {partySelectedGame ? (
              <div className="flex flex-col gap-2 border border-border/30 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{partySelectedGame.gameName}</p>
                    <p className="text-sm text-muted-foreground">
                      selectionne par{' '}
                      <span
                        style={partySelectedGame.selectedByColor ? { color: partySelectedGame.selectedByColor } : undefined}
                      >
                        {partySelectedGame.selectedByName}
                      </span>
                    </p>
                  </div>
                  <Link
                    to={getGameLink(partySelectedGame.gameId)}
                    className="px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
                  >
                    Ouvrir
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun jeu selectionne pour le moment
              </p>
            )}

            <div className="space-y-0">
              {multiplayerGames.map((game) => {
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
                        <p className="font-medium">{game.name}</p>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          {game.type}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {game.description}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        isLeader
                          ? selectPartyGame(game.id, game.name)
                          : suggestPartyGame(game.id, game.name)
                      }
                      disabled={isDisabled}
                      className={cn(
                        "px-4 py-2 text-sm border transition-colors",
                        isDisabled
                          ? "border-border/30 text-muted-foreground/60 cursor-not-allowed"
                          : "border-foreground text-foreground hover:bg-foreground hover:text-background"
                      )}
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
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Suggestions
              </p>
              {partyGameSuggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune suggestion</p>
              ) : (
                <div className="space-y-0">
                  {partyGameSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                    >
                      <div className="text-sm">
                        <span className="font-medium">{suggestion.gameName}</span>
                        <span className="text-muted-foreground"> · par </span>
                        <span
                          style={suggestion.suggestedByColor ? { color: suggestion.suggestedByColor } : undefined}
                        >
                          {suggestion.suggestedByName}
                        </span>
                      </div>
                      {isLeader && suggestion.gameId !== selectedGameId && (
                        <button
                          onClick={() => selectPartyGame(suggestion.gameId, suggestion.gameName)}
                          className="px-3 py-1 text-xs border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
                        >
                          Choisir
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isLeader && partyJoinRequests.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-border/30">
              <h3 className="text-sm text-muted-foreground tracking-wide uppercase">
                Demandes en attente
              </h3>
              <div className="space-y-0">
                {partyJoinRequests.map((request) => (
                  <div
                    key={`${request.partyId}-${request.userId}`}
                    className="flex items-center justify-between py-4 border-b border-border/30 last:border-0"
                  >
                    <div className="font-medium">
                      <span style={request.usernameColor ? { color: request.usernameColor } : undefined}>
                        {request.username}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => respondToJoinRequest(request.userId, false)}
                        className="px-3 py-1 text-xs border border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                      >
                        Refuser
                      </button>
                      <button
                        onClick={() => respondToJoinRequest(request.userId, true)}
                        className="px-3 py-1 text-xs border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
                      >
                        Accepter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </section>
      ) : (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Parties ouvertes
            </h2>
            <button
              onClick={fetchPublicParties}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {publicParties.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucune party disponible
            </p>
          ) : (
            <div className="space-y-10">
              {publicPartyList.length > 0 && (
                <div className="space-y-0">
                  {publicPartyList.map((party) => (
                    <div
                      key={party.id}
                      className="flex items-center justify-between py-4 border-b border-border/30 last:border-0"
                    >
                      <div>
                        <p className="font-medium">{party.name || 'Party sans nom'}</p>
                        <p className="text-sm text-muted-foreground">
                          {party.memberCount}/{party.maxSize} membres · publique
                        </p>
                      </div>
                      <button
                        onClick={() => joinParty(party.id)}
                        disabled={party.memberCount >= party.maxSize}
                        className={cn(
                          "px-4 py-2 text-sm border transition-colors",
                          party.memberCount >= party.maxSize
                            ? "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                            : "border-foreground text-foreground hover:bg-foreground hover:text-background"
                        )}
                      >
                        {party.memberCount >= party.maxSize ? 'Pleine' : 'Rejoindre'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {privatePartyList.length > 0 && (
                <div className="space-y-0">
                  {privatePartyList.map((party) => {
                    const isPending = pendingJoinRequests.includes(party.id);
                    const isFull = party.memberCount >= party.maxSize;
                    return (
                      <div
                        key={party.id}
                        className="flex items-center justify-between py-4 border-b border-border/30 last:border-0"
                      >
                        <div>
                          <p className="font-medium">{party.name || 'Party sans nom'}</p>
                          <p className="text-sm text-muted-foreground">
                            {party.memberCount}/{party.maxSize} membres · privée
                          </p>
                        </div>
                        <button
                          onClick={() => requestJoinParty(party.id)}
                          disabled={isFull || isPending}
                          className={cn(
                            "px-4 py-2 text-sm border transition-colors",
                            isFull || isPending
                              ? "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                              : "border-foreground text-foreground hover:bg-foreground hover:text-background"
                          )}
                        >
                          {isFull ? 'Pleine' : isPending ? 'Demande envoyée' : 'Demander'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Create Party Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal">Créer une party</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="Nom (optionnel)"
              className="h-12 bg-transparent border-border/50"
            />
            <div className="space-y-2">
              <Label htmlFor="maxSize" className="text-sm text-muted-foreground">
                Taille maximale
              </Label>
              <Select value={maxSize.toString()} onValueChange={(value) => setMaxSize(parseInt(value))}>
                <SelectTrigger id="maxSize" className="h-12 bg-transparent border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 joueurs</SelectItem>
                  <SelectItem value="3">3 joueurs</SelectItem>
                  <SelectItem value="4">4 joueurs</SelectItem>
                  <SelectItem value="5">5 joueurs</SelectItem>
                  <SelectItem value="6">6 joueurs</SelectItem>
                  <SelectItem value="7">7 joueurs</SelectItem>
                  <SelectItem value="8">8 joueurs</SelectItem>
                  <SelectItem value="9">9 joueurs</SelectItem>
                  <SelectItem value="10">10 joueurs</SelectItem>
                  <SelectItem value="11">11 joueurs</SelectItem>
                  <SelectItem value="12">12 joueurs</SelectItem>
                  <SelectItem value="13">13 joueurs</SelectItem>
                  <SelectItem value="14">14 joueurs</SelectItem>
                  <SelectItem value="15">15 joueurs</SelectItem>
                  <SelectItem value="16">16 joueurs</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
    </div>
  );
}

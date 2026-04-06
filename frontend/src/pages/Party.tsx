import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePartySocket } from '../contexts/PartySocketContext';
import { useGameSocket } from '../contexts/GameSocketContext';
import { usersApi } from '../services/api';
import { Plus, LogOut, UserPlus, X, RefreshCw, Trash2, User, Play, Search, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { PageShell } from '@/components/layout/page-shell';
import { UsernameDisplay } from '@/components/ui/username-display';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveThemeImageUrl } from '@/lib/images';
import { getGameImage } from '@/lib/game-images';

interface User {
  id: string;
  username: string;
  usernameColor?: string | null;
}

const multiplayerGames = [
  {
    id: 'bomb-party',
    name: 'Bombe de mots',
    description: 'Trouve des mots contenant les lettres avant que la bombe explose.',
    type: 'Groupe',
    image: getGameImage('bomb-party'),
  },
  {
    id: 'petit-bac',
    name: 'Petit Bac',
    description: 'Remplis les categories avec la bonne lettre avant la fin du temps.',
    type: 'Groupe',
    image: getGameImage('petit-bac'),
  },
  {
    id: 'poker',
    name: 'Poker',
    description: 'Joue une table entre amis, blindes et stack personnalisables.',
    type: 'Groupe',
    image: getGameImage('poker'),
  },
];

const duelGames = [
  {
    id: 'bataille-navale',
    name: 'Bataille Navale',
    description: 'Place tes bateaux et coule ceux de ton adversaire.',
    type: 'Duel',
    image: getGameImage('bataille-navale'),
  },
  {
    id: 'puissance-quatre',
    name: 'Puissance 4',
    description: 'Aligne 4 jetons avant ton adversaire.',
    type: 'Duel',
    image: getGameImage('puissance-quatre'),
  },
  {
    id: 'echecs',
    name: 'Échecs',
    description: 'Joue une partie complète avec toutes les règles standard.',
    type: 'Duel',
    image: getGameImage('echecs'),
  },
  {
    id: 'morpion',
    name: 'Morpion',
    description: 'Un duel rapide: aligne 3 symboles avant ton adversaire.',
    type: 'Duel',
    image: getGameImage('morpion'),
  },
];

const getGameLink = (gameId: string) => {
  if (gameId === 'bomb-party') return '/games/bomb-party';
  if (gameId === 'petit-bac') return '/games/petit-bac';
  if (gameId === 'poker') return '/games/poker';
  if (gameId === 'bataille-navale') return '/games/bataille-navale';
  if (gameId === 'puissance-quatre') return '/games/puissance-quatre';
  if (gameId === 'echecs') return '/games/echecs';
  if (gameId === 'morpion') return '/games/morpion';
  return `/games/${gameId}`;
};

const DEFAULT_PETIT_BAC_CATEGORIES = ['Prenom', 'Ville', 'Pays', 'Animal', 'Objet', 'Metier'];

export default function Party() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
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
    updateParty,
    inviteToParty,
    rejectPartyInvite,
    kickFromParty,
    fetchPublicParties,
    syncParty,
    partyGameSuggestions,
    partySelectedGame,
    suggestPartyGame,
    selectPartyGame,
  } = usePartySocket();
  const { startBombParty, startPetitBac, startPoker, startP4, startMorpion } = useGameSocket();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxSize, setMaxSize] = useState<number>(8);
  const [partyType, setPartyType] = useState<'party' | 'duel' | ''>('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [inviteSearch, setInviteSearch] = useState('');
  const [appliedInviteSearch, setAppliedInviteSearch] = useState('');
  const [editPartyName, setEditPartyName] = useState('');
  const [editMaxSize, setEditMaxSize] = useState<number>(8);

  // Start game dialogs
  const [showBpDialog, setShowBpDialog] = useState(false);
  const [showPbDialog, setShowPbDialog] = useState(false);
  const [showPokerDialog, setShowPokerDialog] = useState(false);

  // BombParty settings
  const [bpLives, setBpLives] = useState(3);
  const [bpDifficulty, setBpDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // PetitBac settings
  const [pbRounds, setPbRounds] = useState(5);
  const [pbDuration, setPbDuration] = useState(60);

  // Poker settings
  const [pokerStack, setPokerStack] = useState(1000);
  const [pokerBlind, setPokerBlind] = useState(20);

  useEffect(() => {
    syncParty();
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
    setInviteSearch('');
    setAppliedInviteSearch('');
  };

  const handleInviteModalChange = (open: boolean) => {
    setShowInviteModal(open);
    if (!open) {
      setInviteSearch('');
      setAppliedInviteSearch('');
    }
  };

  const handleOpenEditModal = () => {
    if (!currentParty) return;
    setEditPartyName(currentParty.name || '');
    setEditMaxSize(Math.max(currentParty.maxSize, partyMembers.length, 2));
    setShowEditModal(true);
  };

  const handleUpdateParty = () => {
    if (!currentParty) return;
    updateParty({
      name: editPartyName,
      ...(currentParty.maxSize !== 2 ? { maxSize: editMaxSize } : {}),
    });
    setShowEditModal(false);
  };

  const handleInviteSearch = () => {
    setAppliedInviteSearch(inviteSearch.trim().toLowerCase());
  };

  const handleLaunchSelected = (gameId: string) => {
    if (gameId === 'bomb-party') {
      setShowBpDialog(true);
    } else if (gameId === 'petit-bac') {
      setShowPbDialog(true);
    } else if (gameId === 'poker') {
      setShowPokerDialog(true);
    } else if (gameId === 'puissance-quatre') {
      startP4();
      navigate('/games/puissance-quatre');
    } else if (gameId === 'morpion') {
      startMorpion();
      navigate('/games/morpion');
    } else {
      navigate(getGameLink(gameId));
    }
  };

  const handleStartBombParty = () => {
    startBombParty(bpLives, bpDifficulty);
    setShowBpDialog(false);
  };

  const handleStartPetitBac = () => {
    startPetitBac(pbRounds, pbDuration * 1000, DEFAULT_PETIT_BAC_CATEGORIES);
    setShowPbDialog(false);
  };

  const handleStartPoker = () => {
    startPoker(pokerStack, pokerBlind);
    setShowPokerDialog(false);
  };

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const availableUsersToInvite = allUsers.filter(
    (u) =>
      u.id !== user?.id &&
      !partyMembers.find((m) => m.userId === u.id)
  );
  const filteredUsersToInvite = availableUsersToInvite.filter((u) =>
    appliedInviteSearch ? u.username.toLowerCase().includes(appliedInviteSearch) : true
  );
  const selectedGameId = partySelectedGame?.gameId;

  const allGames = [...multiplayerGames, ...duelGames];

  return (
    <>
      <PageShell>
      {/* Invites */}
      {partyInvites.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground  ")}>
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
                  <p className={TYPOGRAPHY.SMALL}>{invite.partyName || 'Groupe sans nom'}</p>
                  <p className={TYPOGRAPHY.XS}>
                    de <UsernameDisplay username={invite.inviterUsername} />
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


      {/* Groupe actuel ou groupes publics */}
      {currentParty ? (
        <Card>
          <CardContent className={`p-6 ${SPACING.SECTION_SPACING}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className={TYPOGRAPHY.H2}>
                  {currentParty.name || 'Ton groupe'}
                </h2>
                <p className={TYPOGRAPHY.SMALL}>
                  {currentParty.isPublic ? 'Publique' : 'Privée'} · {partyMembers.length}/{currentParty.maxSize}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isLeader && (
                  <Button
                    onClick={handleOpenEditModal}
                    variant="outline"
                    size="sm"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                )}
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
                    Supprimer le groupe
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

            <Accordion type="single" collapsible className="rounded-xl border border-border/50 bg-card/40 px-4">
              <AccordionItem value="party-members" className="border-none">
                <AccordionTrigger className="py-4 hover:no-underline">
                  <div className="text-left">
                    <p className={TYPOGRAPHY.SMALL}>Utilisateurs du groupe</p>
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                      {partyMembers.length} membre{partyMembers.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <div className="space-y-0">
                    {partyMembers.map((member) => (
                      <div
                        key={member.userId}
                        className={cn(
                          "flex items-center justify-between rounded-lg py-3",
                          member.userId === user?.id && "bg-muted/30 px-3"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <span className={TYPOGRAPHY.SMALL}>
                            <UsernameDisplay username={member.username} usernameColor={member.usernameColor} />
                            {member.isLeader && (
                              <span className={cn(TYPOGRAPHY.XS, "ml-2 text-muted-foreground")}>chef</span>
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
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className={SPACING.CARD_SPACING}>
              <h3 className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground  ")}>
                {currentParty.maxSize === 2 ? 'Jeux de duel' : 'Jeux multijoueur'}
              </h3>
              {partySelectedGame ? (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const gameInfo = allGames.find((g) => g.id === partySelectedGame.gameId);
                          return gameInfo ? (
                            <img
                              src={resolveThemeImageUrl(gameInfo.image, theme)}
                              alt={gameInfo.name}
                              className="h-10 w-10 rounded-md object-cover shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : null;
                        })()}
                        <div>
                          <p className={TYPOGRAPHY.SMALL}>{partySelectedGame.gameName}</p>
                          <p className={TYPOGRAPHY.XS}>
                            sélectionné par{' '}
                            <UsernameDisplay
                              username={partySelectedGame.selectedByName}
                              usernameColor={partySelectedGame.selectedByColor}
                            />
                          </p>
                        </div>
                      </div>
                      {isLeader && (
                        <Button
                          onClick={() => handleLaunchSelected(partySelectedGame.gameId)}
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                        >
                          <Play className="h-3.5 w-3.5 mr-1.5" />
                          Lancer
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <p className={TYPOGRAPHY.SMALL}>
                  Aucun jeu sélectionné pour le moment
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
                      <div>
                        <p className={TYPOGRAPHY.SMALL}>{game.name}</p>
                      </div>
                      <button
                        onClick={() =>
                          !isDisabled && (isLeader
                            ? selectPartyGame(game.id, game.name)
                            : suggestPartyGame(game.id, game.name))
                        }
                        disabled={isDisabled}
                        title={isLeader
                          ? isSelected ? 'Sélectionné' : 'Choisir'
                          : isSelected ? 'Sélectionné' : hasSuggested ? 'Suggéré' : 'Suggérer'}
                        className={cn(
                          'relative h-12 w-12 shrink-0 rounded-md overflow-hidden border-2 transition-all',
                          isSelected
                            ? 'border-foreground opacity-100 ring-2 ring-foreground/30'
                            : isDisabled
                              ? 'border-border/30 opacity-40 cursor-not-allowed'
                              : 'border-border/50 opacity-80 hover:opacity-100 hover:border-foreground/60 cursor-pointer'
                        )}
                      >
                        <img
                          src={resolveThemeImageUrl(game.image, theme)}
                          alt={game.name}
                          className="h-full w-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-foreground/20 flex items-center justify-center">
                            <div className="h-3 w-3 rounded-full bg-foreground" />
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <p className={cn(TYPOGRAPHY.XS, "  text-muted-foreground")}>
                  Suggestions
                </p>
                {partyGameSuggestions.length === 0 ? (
                  <p className={TYPOGRAPHY.SMALL}>Aucune suggestion</p>
                ) : (
                  <div className="space-y-0">
                    {partyGameSuggestions.map((suggestion) => {
                      const gameInfo = allGames.find((g) => g.id === suggestion.gameId);
                      return (
                        <div
                          key={suggestion.id}
                          className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            {gameInfo && (
                              <img
                                src={resolveThemeImageUrl(gameInfo.image, theme)}
                                alt={gameInfo.name}
                                className="h-8 w-8 rounded-sm object-cover shrink-0"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            <div className={TYPOGRAPHY.SMALL}>
                              <span className="font-medium">{suggestion.gameName}</span>
                              <span className="text-muted-foreground"> · par </span>
                              <UsernameDisplay
                                username={suggestion.suggestedByName}
                                usernameColor={suggestion.suggestedByColor}
                              />
                            </div>
                          </div>
                          {isLeader && suggestion.gameId !== selectedGameId && (
                            <button
                              onClick={() => selectPartyGame(suggestion.gameId, suggestion.gameName)}
                              title="Choisir"
                              className={cn(
                                'relative h-10 w-10 shrink-0 rounded-md overflow-hidden border-2 transition-all',
                                'border-border/50 opacity-80 hover:opacity-100 hover:border-foreground/60 cursor-pointer'
                              )}
                            >
                              {gameInfo && (
                                <img
                                  src={resolveThemeImageUrl(gameInfo.image, theme)}
                                  alt={gameInfo.name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {isLeader && partyJoinRequests.length > 0 && (
              <div className={SPACING.CARD_SPACING}>
                <h3 className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground  ")}>
                  Demandes en attente
                </h3>
                <div className="space-y-0">
                  {partyJoinRequests.map((request) => (
                    <div
                      key={`${request.partyId}-${request.userId}`}
                      className="flex items-center justify-between py-4 border-b border-border/30 last:border-0"
                    >
                      <div className={TYPOGRAPHY.SMALL}>
                        <UsernameDisplay username={request.username} usernameColor={request.usernameColor} />
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
        <Card>
          <CardContent className={`p-6 ${SPACING.SECTION_SPACING}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground  ")}>
                Groupes ouverts
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowCreateModal(true)}
                  variant="default"
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
                Aucun groupe disponible
              </p>
            ) : (
              <div className={SPACING.SECTION_SPACING}>
                <div className="space-y-3">
                  {publicParties.map((party) => {
                    const isPending = pendingJoinRequests.includes(party.id);
                    const isFull = party.memberCount >= party.maxSize;
                    const isDuel = party.maxSize === 2;
                    return (
                      <Accordion
                        key={party.id}
                        type="single"
                        collapsible
                        className="rounded-xl border border-border/40 bg-card/30 px-4"
                      >
                        <AccordionItem value={`public-party-${party.id}`} className="border-none">
                          <div className="flex items-center gap-3 py-4">
                            <AccordionTrigger className="flex-1 py-0 hover:no-underline">
                              <div className="text-left">
                                <div className="flex items-center gap-3">
                                  <p className={TYPOGRAPHY.SMALL}>{party.name || (isDuel ? 'Duel sans nom' : 'Groupe sans nom')}</p>
                                  <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>
                                    {isDuel ? 'Duel' : 'Groupe'}
                                  </span>
                                </div>
                                <p className={TYPOGRAPHY.XS}>
                                  {party.memberCount}/{party.maxSize} membres · {party.isPublic ? 'publique' : 'privée'}
                                </p>
                              </div>
                            </AccordionTrigger>
                            {party.isPublic ? (
                              <Button
                                onClick={() => joinParty(party.id)}
                                disabled={isFull}
                                variant="outline"
                                size="sm"
                                className="shrink-0"
                              >
                                {isFull ? 'Pleine' : 'Rejoindre'}
                              </Button>
                            ) : (
                              <Button
                                onClick={() => requestJoinParty(party.id)}
                                disabled={isFull || isPending}
                                variant="outline"
                                size="sm"
                                className="shrink-0"
                              >
                                {isFull ? 'Pleine' : isPending ? 'Demande envoyée' : 'Demander'}
                              </Button>
                            )}
                          </div>
                          <AccordionContent className="pb-4">
                            {party.members && party.members.length > 0 ? (
                              <div className="space-y-2 border-t border-border/30 pt-3">
                                {party.members.map((member) => (
                                  <div
                                    key={member.userId}
                                    className="rounded-lg bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
                                  >
                                    <UsernameDisplay username={member.username} usernameColor={member.usernameColor} />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className={cn(TYPOGRAPHY.XS, "border-t border-border/30 pt-3 text-muted-foreground")}>
                                Aucun utilisateur visible dans ce groupe
                              </p>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </PageShell>

      {/* Fenêtre de création de groupe */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un groupe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Type
              </Label>
              <Tabs
                value={partyType}
                onValueChange={(value) => {
                  const nextType = value as 'party' | 'duel';
                  setPartyType(nextType);
                  setMaxSize(nextType === 'duel' ? 2 : 8);
                }}
              >
                <TabsList className="h-auto flex-wrap">
                  <TabsTrigger value="party">Groupe</TabsTrigger>
                  <TabsTrigger value="duel">Duel</TabsTrigger>
                </TabsList>
              </Tabs>
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
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateParty}
              disabled={!partyType}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={handleInviteModalChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inviter</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={inviteSearch}
              onChange={(e) => setInviteSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleInviteSearch();
                }
              }}
              placeholder="Rechercher un joueur"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleInviteSearch}
              className="shrink-0"
            >
              <Search className="h-4 w-4 mr-2" />
              Rechercher
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0">
            {availableUsersToInvite.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Personne à inviter
              </p>
            ) : filteredUsersToInvite.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Aucun joueur trouvé
              </p>
            ) : (
              filteredUsersToInvite.map((u) => (
                <Button variant="ghost"
                  key={u.id}
                  onClick={() => handleInvite(u.id)}
                  className="w-full text-left py-3 border-b border-border/30 last:border-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <UsernameDisplay username={u.username} />
                </Button>
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

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le groupe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="text"
              value={editPartyName}
              onChange={(e) => setEditPartyName(e.target.value)}
              placeholder="Nom du groupe"
              className="h-12 bg-transparent border-border/50"
            />
            {currentParty && currentParty.maxSize !== 2 && (
              <div className="space-y-2">
                <Label htmlFor="editMaxSize" className="text-sm text-muted-foreground">
                  Taille maximale
                </Label>
                <div className="flex flex-wrap items-center justify-center gap-1 text-muted-foreground">
                  {Array.from({ length: editMaxSize }).map((_, index) => (
                    <User key={`${editMaxSize}-${index}`} className="h-3.5 w-3.5" />
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{Math.max(2, partyMembers.length)}</span>
                    <span className="text-foreground font-semibold">{editMaxSize} joueurs</span>
                    <span>16</span>
                  </div>
                  <Slider
                    value={[editMaxSize]}
                    min={Math.max(2, partyMembers.length)}
                    max={16}
                    step={1}
                    onValueChange={(value) => setEditMaxSize(value[0])}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
            >
              Annuler
            </Button>
            <Button onClick={handleUpdateParty}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fenêtre de lancement Bombe de mots */}
      <Dialog open={showBpDialog} onOpenChange={setShowBpDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal">Bombe de mots — Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Vies</label>
              <div className="flex gap-2">
                {[2, 3, 4, 5].map((l) => (
                  <Button variant="ghost"
                    key={l}
                    onClick={() => setBpLives(l)}
                    className={cn(
                      'flex-1 py-3 border transition-colors',
                      bpLives === l
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border/50 text-muted-foreground hover:border-foreground hover:text-foreground'
                    )}
                  >
                    {l}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Difficulté</label>
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <Button variant="ghost"
                    key={d}
                    onClick={() => setBpDifficulty(d)}
                    className={cn(
                      'flex-1 py-3 border transition-colors',
                      bpDifficulty === d
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border/50 text-muted-foreground hover:border-foreground hover:text-foreground'
                    )}
                  >
                    {d === 'easy' ? 'Facile' : d === 'medium' ? 'Moyen' : 'Difficile'}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBpDialog(false)}>Annuler</Button>
            <Button onClick={handleStartBombParty} variant="outline" className="border-foreground">
              <Play className="h-4 w-4 mr-2" />
              Lancer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Petit Bac start dialog */}
      <Dialog open={showPbDialog} onOpenChange={setShowPbDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal">Petit Bac — Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Manches</label>
              <div className="flex gap-2">
                {[3, 5, 7, 10].map((r) => (
                  <Button variant="ghost"
                    key={r}
                    onClick={() => setPbRounds(r)}
                    className={cn(
                      'flex-1 py-3 border transition-colors',
                      pbRounds === r
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border/50 text-muted-foreground hover:border-foreground hover:text-foreground'
                    )}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Durée (secondes)</label>
              <div className="flex gap-2">
                {[30, 45, 60, 90].map((d) => (
                  <Button variant="ghost"
                    key={d}
                    onClick={() => setPbDuration(d)}
                    className={cn(
                      'flex-1 py-3 border transition-colors',
                      pbDuration === d
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border/50 text-muted-foreground hover:border-foreground hover:text-foreground'
                    )}
                  >
                    {d}s
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPbDialog(false)}>Annuler</Button>
            <Button onClick={handleStartPetitBac} variant="outline" className="border-foreground">
              <Play className="h-4 w-4 mr-2" />
              Lancer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Poker start dialog */}
      <Dialog open={showPokerDialog} onOpenChange={setShowPokerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal">Poker — Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Stack de départ</label>
              <div className="flex gap-2">
                {[500, 1000, 2000, 5000].map((s) => (
                  <Button variant="ghost"
                    key={s}
                    onClick={() => setPokerStack(s)}
                    className={cn(
                      'flex-1 py-3 border transition-colors',
                      pokerStack === s
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border/50 text-muted-foreground hover:border-foreground hover:text-foreground'
                    )}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Grosse blinde</label>
              <div className="flex gap-2">
                {[10, 20, 50, 100].map((b) => (
                  <Button variant="ghost"
                    key={b}
                    onClick={() => setPokerBlind(b)}
                    className={cn(
                      'flex-1 py-3 border transition-colors',
                      pokerBlind === b
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border/50 text-muted-foreground hover:border-foreground hover:text-foreground'
                    )}
                  >
                    {b}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPokerDialog(false)}>Annuler</Button>
            <Button onClick={handleStartPoker} variant="outline" className="border-foreground">
              <Play className="h-4 w-4 mr-2" />
              Lancer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

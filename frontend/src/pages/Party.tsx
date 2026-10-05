import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Pencil, Play, Plus, RefreshCw, Search, Trash2, User, UserPlus, Users, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePartySocket } from '../contexts/PartySocketContext';
import { useGameSocket } from '../contexts/GameSocketContext';
import { usersApi } from '../services/api';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { UsernameDisplay } from '@/components/ui/username-display';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveThemeImageUrl } from '@/lib/images';
import { getGameImage } from '@/lib/game-images';
import { getPartyDisplayName } from '@/lib/party-display-name';

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

function OptionGroup<T extends string | number>({
  value,
  options,
  onChange,
  format = (option) => String(option),
}: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  format?: (option: T) => string;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={String(value)}
      onValueChange={(next) => {
        const match = options.find((option) => String(option) === next);
        if (match !== undefined) onChange(match);
      }}
      className="w-full"
    >
      {options.map((option) => (
        <ToggleGroupItem key={String(option)} value={String(option)} className="flex-1">
          {format(option)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function SizeSlider({ id, label, value, min, onChange }: { id: string; label: string; value: number; min: number; onChange: (value: number) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex flex-wrap items-center justify-center gap-1 text-muted-foreground">
        {Array.from({ length: value }).map((_, index) => (
          <User key={`${value}-${index}`} className="size-3.5" />
        ))}
      </div>
      <Slider id={id} value={[value]} min={min} max={16} step={1} onValueChange={(next) => onChange(next[0])} />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span className="font-semibold text-foreground">{value} joueurs</span>
        <span>16</span>
      </div>
    </Field>
  );
}

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

  const gameList = currentParty?.maxSize === 2 ? duelGames : multiplayerGames;
  const gameThumb = (game: { image: string; name: string }) => (
    <ItemMedia variant="image">
      <img
        src={resolveThemeImageUrl(game.image, theme)}
        alt={game.name}
        onError={(event) => {
          (event.target as HTMLImageElement).style.display = 'none';
        }}
      />
    </ItemMedia>
  );

  const startDialog = (
    open: boolean,
    onOpenChange: (open: boolean) => void,
    title: string,
    onStart: () => void,
    children: React.ReactNode
  ) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title} — Options</DialogTitle>
          <DialogDescription>Réglez la partie avant de la lancer pour tout le groupe.</DialogDescription>
        </DialogHeader>
        <FieldGroup>{children}</FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={onStart}>
            <Play />
            Lancer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <PageShell>
        <PageHeader
          title={currentParty ? currentParty.name || 'Votre groupe' : 'Groupes'}
          description={
            currentParty
              ? `${currentParty.isPublic ? 'Publique' : 'Privée'} · ${partyMembers.length}/${currentParty.maxSize} membres`
              : 'Rejoignez un groupe ouvert ou créez le vôtre pour jouer à plusieurs.'
          }
          actions={
            currentParty ? (
              <>
                {isLeader ? (
                  <>
                    <Button variant="outline" onClick={handleOpenEditModal}>
                      <Pencil />
                      Modifier
                    </Button>
                    <Button variant="outline" onClick={() => setShowInviteModal(true)}>
                      <UserPlus />
                      Inviter
                    </Button>
                    <Button variant="destructive" onClick={deleteParty}>
                      <Trash2 />
                      Supprimer le groupe
                    </Button>
                  </>
                ) : (
                  <Button variant="destructive" onClick={leaveParty}>
                    <LogOut />
                    Quitter
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" size="icon" onClick={fetchPublicParties} aria-label="Actualiser">
                  <RefreshCw />
                </Button>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus />
                  Créer
                </Button>
              </>
            )
          }
        />

        {partyInvites.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Invitations</CardTitle>
            </CardHeader>
            <CardContent>
              <ItemGroup>
                {partyInvites.map((invite, index) => (
                  <div key={invite.partyId}>
                    {index > 0 ? <ItemSeparator /> : null}
                    <Item>
                      <ItemContent>
                        <ItemTitle>{invite.partyName || `Groupe de ${invite.inviterUsername}`}</ItemTitle>
                        <ItemDescription>
                          de <UsernameDisplay username={invite.inviterUsername} />
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button onClick={() => rejectPartyInvite(invite.partyId)} variant="outline" size="sm">
                          Refuser
                        </Button>
                        <Button onClick={() => joinParty(invite.partyId)} size="sm">
                          Rejoindre
                        </Button>
                      </ItemActions>
                    </Item>
                  </div>
                ))}
              </ItemGroup>
            </CardContent>
          </Card>
        ) : null}

        {currentParty ? (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Membres</CardTitle>
                <CardDescription>
                  {partyMembers.length} membre{partyMembers.length > 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ItemGroup>
                  {partyMembers.map((member, index) => (
                    <div key={member.userId}>
                      {index > 0 ? <ItemSeparator /> : null}
                      <Item size="sm" variant={member.userId === user?.id ? 'muted' : 'default'}>
                        <ItemContent>
                          <ItemTitle>
                            <UsernameDisplay username={member.username} usernameColor={member.usernameColor} />
                            {member.isLeader ? <Badge variant="secondary">Chef</Badge> : null}
                            {member.userId === user?.id ? <Badge variant="outline">Vous</Badge> : null}
                          </ItemTitle>
                        </ItemContent>
                        {isLeader && member.userId !== user?.id ? (
                          <ItemActions>
                            <Button onClick={() => kickFromParty(member.userId)} variant="ghost" size="icon-sm" aria-label="Exclure">
                              <X />
                            </Button>
                          </ItemActions>
                        ) : null}
                      </Item>
                    </div>
                  ))}
                </ItemGroup>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{currentParty.maxSize === 2 ? 'Jeux de duel' : 'Jeux multijoueur'}</CardTitle>
                  <CardDescription>
                    {isLeader ? 'Choisissez le jeu à lancer.' : 'Suggérez un jeu au chef du groupe.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {partySelectedGame ? (
                    <Item variant="outline">
                      {(() => {
                        const gameInfo = allGames.find((game) => game.id === partySelectedGame.gameId);
                        return gameInfo ? gameThumb(gameInfo) : null;
                      })()}
                      <ItemContent>
                        <ItemTitle>{partySelectedGame.gameName}</ItemTitle>
                        <ItemDescription>
                          sélectionné par{' '}
                          <UsernameDisplay username={partySelectedGame.selectedByName} usernameColor={partySelectedGame.selectedByColor} />
                        </ItemDescription>
                      </ItemContent>
                      {isLeader ? (
                        <ItemActions>
                          <Button onClick={() => handleLaunchSelected(partySelectedGame.gameId)}>
                            <Play />
                            Lancer
                          </Button>
                        </ItemActions>
                      ) : null}
                    </Item>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun jeu sélectionné pour le moment.</p>
                  )}

                  <ItemGroup>
                    {gameList.map((game, index) => {
                      const hasSuggested = partyGameSuggestions.some(
                        (suggestion) => suggestion.gameId === game.id && suggestion.suggestedById === user?.id
                      );
                      const isSelected = selectedGameId === game.id;
                      const isDisabled = isLeader ? isSelected : hasSuggested || isSelected;
                      const label = isLeader ? (isSelected ? 'Sélectionné' : 'Choisir') : isSelected ? 'Sélectionné' : hasSuggested ? 'Suggéré' : 'Suggérer';
                      return (
                        <div key={game.id}>
                          {index > 0 ? <ItemSeparator /> : null}
                          <Item size="sm">
                            {gameThumb(game)}
                            <ItemContent>
                              <ItemTitle>{game.name}</ItemTitle>
                              <ItemDescription>{game.description}</ItemDescription>
                            </ItemContent>
                            <ItemActions>
                              <Button
                                variant={isSelected ? 'secondary' : 'outline'}
                                size="sm"
                                disabled={isDisabled}
                                onClick={() => (isLeader ? selectPartyGame(game.id, game.name) : suggestPartyGame(game.id, game.name))}
                              >
                                {label}
                              </Button>
                            </ItemActions>
                          </Item>
                        </div>
                      );
                    })}
                  </ItemGroup>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  {partyGameSuggestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune suggestion.</p>
                  ) : (
                    <ItemGroup>
                      {partyGameSuggestions.map((suggestion, index) => {
                        const gameInfo = allGames.find((game) => game.id === suggestion.gameId);
                        return (
                          <div key={suggestion.id}>
                            {index > 0 ? <ItemSeparator /> : null}
                            <Item size="sm">
                              {gameInfo ? gameThumb(gameInfo) : null}
                              <ItemContent>
                                <ItemTitle>{suggestion.gameName}</ItemTitle>
                                <ItemDescription>
                                  par <UsernameDisplay username={suggestion.suggestedByName} usernameColor={suggestion.suggestedByColor} />
                                </ItemDescription>
                              </ItemContent>
                              {isLeader && suggestion.gameId !== selectedGameId ? (
                                <ItemActions>
                                  <Button variant="outline" size="sm" onClick={() => selectPartyGame(suggestion.gameId, suggestion.gameName)}>
                                    Choisir
                                  </Button>
                                </ItemActions>
                              ) : null}
                            </Item>
                          </div>
                        );
                      })}
                    </ItemGroup>
                  )}
                </CardContent>
              </Card>

              {isLeader && partyJoinRequests.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Demandes en attente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ItemGroup>
                      {partyJoinRequests.map((request, index) => (
                        <div key={`${request.partyId}-${request.userId}`}>
                          {index > 0 ? <ItemSeparator /> : null}
                          <Item size="sm">
                            <ItemContent>
                              <ItemTitle>
                                <UsernameDisplay username={request.username} usernameColor={request.usernameColor} />
                              </ItemTitle>
                            </ItemContent>
                            <ItemActions>
                              <Button onClick={() => respondToJoinRequest(request.userId, false)} variant="outline" size="sm">
                                Refuser
                              </Button>
                              <Button onClick={() => respondToJoinRequest(request.userId, true)} size="sm">
                                Accepter
                              </Button>
                            </ItemActions>
                          </Item>
                        </div>
                      ))}
                    </ItemGroup>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Groupes ouverts</CardTitle>
              <CardDescription>
                {publicParties.length} groupe{publicParties.length > 1 ? 's' : ''} disponible{publicParties.length > 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {publicParties.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Users />
                    </EmptyMedia>
                    <EmptyTitle>Aucun groupe disponible</EmptyTitle>
                    <EmptyDescription>Créez un groupe pour inviter vos amis.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ItemGroup className="gap-2">
                  {publicParties.map((party) => {
                    const isPending = pendingJoinRequests.includes(party.id);
                    const isFull = party.memberCount >= party.maxSize;
                    const isDuel = party.maxSize === 2;
                    return (
                      <Collapsible key={party.id}>
                        <Item variant="outline">
                          <ItemContent>
                            <ItemTitle>
                              {getPartyDisplayName(party)}
                              <Badge variant="secondary">{isDuel ? 'Duel' : 'Groupe'}</Badge>
                            </ItemTitle>
                            <ItemDescription>
                              {party.memberCount}/{party.maxSize} membres · {party.isPublic ? 'publique' : 'privée'}
                            </ItemDescription>
                          </ItemContent>
                          <ItemActions>
                            {party.isPublic ? (
                              <Button onClick={() => joinParty(party.id)} disabled={isFull} variant="outline" size="sm">
                                {isFull ? 'Pleine' : 'Rejoindre'}
                              </Button>
                            ) : (
                              <Button onClick={() => requestJoinParty(party.id)} disabled={isFull || isPending} variant="outline" size="sm">
                                {isFull ? 'Pleine' : isPending ? 'Demande envoyée' : 'Demander'}
                              </Button>
                            )}
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="Voir les membres">
                                <ChevronDown />
                              </Button>
                            </CollapsibleTrigger>
                          </ItemActions>
                        </Item>
                        <CollapsibleContent className="px-4 pt-2">
                          {party.members && party.members.length > 0 ? (
                            <ul className="flex flex-col gap-1 text-sm">
                              {party.members.map((member) => (
                                <li key={member.userId}>
                                  <UsernameDisplay username={member.username} usernameColor={member.usernameColor} />
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground">Aucun utilisateur visible dans ce groupe.</p>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </ItemGroup>
              )}
            </CardContent>
          </Card>
        )}
      </PageShell>

      {/* Création de groupe */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un groupe</DialogTitle>
            <DialogDescription>Choisissez un type de groupe puis réglez ses options.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <Tabs
                value={partyType}
                onValueChange={(value) => {
                  const nextType = value as 'party' | 'duel';
                  setPartyType(nextType);
                  setMaxSize(nextType === 'duel' ? 2 : 8);
                }}
              >
                <TabsList>
                  <TabsTrigger value="party">Groupe</TabsTrigger>
                  <TabsTrigger value="duel">Duel</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            {partyType ? (
              <>
                <Field>
                  <FieldLabel htmlFor="party-name">Nom</FieldLabel>
                  <Input id="party-name" type="text" value={partyName} onChange={(event) => setPartyName(event.target.value)} placeholder="Nom (optionnel)" />
                </Field>
                {partyType === 'party' ? <SizeSlider id="party-max-size" label="Taille maximale" value={maxSize} min={2} onChange={setMaxSize} /> : null}
                <Field orientation="horizontal">
                  <Checkbox id="party-public" checked={isPublic} onCheckedChange={(checked) => setIsPublic(checked === true)} />
                  <FieldLabel htmlFor="party-public">Publique</FieldLabel>
                </Field>
              </>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateParty} disabled={!partyType}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invitation */}
      <Dialog open={showInviteModal} onOpenChange={handleInviteModalChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inviter</DialogTitle>
            <DialogDescription>Recherchez un joueur pour l&apos;inviter dans votre groupe.</DialogDescription>
          </DialogHeader>
          <InputGroup>
            <InputGroupInput
              value={inviteSearch}
              onChange={(event) => setInviteSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleInviteSearch();
                }
              }}
              placeholder="Rechercher un joueur"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton variant="secondary" onClick={handleInviteSearch}>
                <Search />
                Rechercher
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <ScrollArea className="h-64">
            {availableUsersToInvite.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Personne à inviter.</p>
            ) : filteredUsersToInvite.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Aucun joueur trouvé.</p>
            ) : (
              <ItemGroup>
                {filteredUsersToInvite.map((candidate) => (
                  <Item key={candidate.id} asChild size="sm">
                    <button type="button" onClick={() => handleInvite(candidate.id)} className="text-left">
                      <ItemContent>
                        <ItemTitle>
                          <UsernameDisplay username={candidate.username} />
                        </ItemTitle>
                      </ItemContent>
                      <ItemActions>
                        <UserPlus className="size-4" />
                      </ItemActions>
                    </button>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modification */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le groupe</DialogTitle>
            <DialogDescription>Changez le nom ou la taille maximale du groupe.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-party-name">Nom</FieldLabel>
              <Input id="edit-party-name" type="text" value={editPartyName} onChange={(event) => setEditPartyName(event.target.value)} placeholder="Nom du groupe" />
            </Field>
            {currentParty && currentParty.maxSize !== 2 ? (
              <SizeSlider id="edit-party-max-size" label="Taille maximale" value={editMaxSize} min={Math.max(2, partyMembers.length)} onChange={setEditMaxSize} />
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateParty}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {startDialog(
        showBpDialog,
        setShowBpDialog,
        'Bombe de mots',
        handleStartBombParty,
        <>
          <Field>
            <FieldLabel>Vies</FieldLabel>
            <OptionGroup value={bpLives} options={[2, 3, 4, 5] as const} onChange={setBpLives} />
          </Field>
          <Field>
            <FieldLabel>Difficulté</FieldLabel>
            <OptionGroup
              value={bpDifficulty}
              options={['easy', 'medium', 'hard'] as const}
              onChange={setBpDifficulty}
              format={(option) => (option === 'easy' ? 'Facile' : option === 'medium' ? 'Moyen' : 'Difficile')}
            />
          </Field>
        </>
      )}

      {startDialog(
        showPbDialog,
        setShowPbDialog,
        'Petit Bac',
        handleStartPetitBac,
        <>
          <Field>
            <FieldLabel>Manches</FieldLabel>
            <OptionGroup value={pbRounds} options={[3, 5, 7, 10] as const} onChange={setPbRounds} />
          </Field>
          <Field>
            <FieldLabel>Durée</FieldLabel>
            <OptionGroup value={pbDuration} options={[30, 45, 60, 90] as const} onChange={setPbDuration} format={(option) => `${option} s`} />
            <FieldDescription>Durée de chaque manche.</FieldDescription>
          </Field>
        </>
      )}

      {startDialog(
        showPokerDialog,
        setShowPokerDialog,
        'Poker',
        handleStartPoker,
        <>
          <Field>
            <FieldLabel>Stack de départ</FieldLabel>
            <OptionGroup value={pokerStack} options={[500, 1000, 2000, 5000] as const} onChange={setPokerStack} />
          </Field>
          <Field>
            <FieldLabel>Grosse blinde</FieldLabel>
            <OptionGroup value={pokerBlind} options={[10, 20, 50, 100] as const} onChange={setPokerBlind} />
          </Field>
        </>
      )}
    </>
  );
}

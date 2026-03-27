import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocketBase } from '@/contexts/SocketContext';
import { useChatSocket } from '@/contexts/ChatSocketContext';
import { usePartySocket } from '@/contexts/PartySocketContext';
import { useGameSocket } from '@/contexts/GameSocketContext';
import { useDuelSocket } from '@/contexts/DuelSocketContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getPageMeta } from '@/components/chat/presence';
import { resolveImageUrl } from '@/lib/images';
import { usersApi } from '@/services/api';
import { cn } from '@/lib/utils';
import { getPageMetaForPath } from '@/lib/page-meta';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  ChevronDown,
  ChevronUp,
  Users,
  LogOut,
  Bomb,
  Gamepad2,
  Trash2,
  UserPlus,
  Eye,
  Monitor,
  Crosshair,
  Zap,
  Sparkles,
  CircleDollarSign,
} from 'lucide-react';
import { UsernameDisplay } from '@/components/ui/username-display';
import { InboxDropdown } from '@/components/inbox/InboxDropdown';
import { PlayerHoverCard } from '@/components/ui/player-hover-card';

export function SiteHeader() {
  const { user, refreshUser } = useAuth();
  const { connected, socket } = useSocketBase();
  const { onlineUsers, onlineCount, requestOnlineUsers, doodleSpectateSessions, requestDoodleSpectateSessions, chessSpectateSessions, requestChessSpectateSessions, sendMessage } = useChatSocket();
  const { currentParty, partyMembers, publicParties, createParty, leaveParty, deleteParty, joinParty, fetchPublicParties } = usePartySocket();
  const { bombPartyGame, petitBacGame } = useGameSocket();
  const { duelMatchmakingQueued, duelMatchmakingStats, joinDuelMatchmaking, leaveDuelMatchmaking } = useDuelSocket();
  const { maintenanceStatus } = useFeatures();
  const location = useLocation();
  const navigate = useNavigate();

  const [showUsers, setShowUsers] = useState(false);
  const [showParty, setShowParty] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [now, setNow] = useState(Date.now());
  const canViewConnectedStatus = Boolean(user?.isAdmin || user?.isSuperAdmin);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!socket || !user) return;
    const handleClanEffectsUpdated = () => {
      void refreshUser();
    };
    socket.on('clan:effects-updated', handleClanEffectsUpdated);
    return () => {
      socket.off('clan:effects-updated', handleClanEffectsUpdated);
    };
  }, [socket, user?.id, refreshUser]);

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (!mainEl) return;
    const handleScroll = () => setScrolled(mainEl.scrollTop > 10);
    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainEl.removeEventListener('scroll', handleScroll);
  }, []);

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const doodleSpectateSessionMap = useMemo(
    () => new Map(doodleSpectateSessions.map((session) => [session.hostUserId, session])),
    [doodleSpectateSessions]
  );
  const chessSpectateSessionMap = useMemo(() => {
    const sessionsByUser = new Map<string, { partyId: string; spectatorCount: number }>();
    for (const session of chessSpectateSessions) {
      for (const player of session.players) {
        sessionsByUser.set(player.userId, {
          partyId: session.partyId,
          spectatorCount: session.spectatorCount,
        });
      }
    }
    return sessionsByUser;
  }, [chessSpectateSessions]);
  const gameStatus = bombPartyGame
    ? `Bombe de mots - Manche ${bombPartyGame.round}`
    : petitBacGame
      ? `Petit Bac - Manche ${petitBacGame.round}/${petitBacGame.maxRounds}`
      : 'En attente';
  const inviteLabel = currentParty?.name ? `Rejoins ${currentParty.name}` : 'Rejoins mon groupe';
  const inviteVisibility = currentParty?.isPublic ? 'public' : 'private';
  const duelMatchmakingEnabled = maintenanceStatus.duelMatchmakingEnabled;
  const availableParties = useMemo(
    () => publicParties.filter((party) => party.memberCount < party.maxSize),
    [publicParties]
  );

  const sendChatInvite = () => {
    if (currentParty) {
      sendMessage(`[[party-invite:${currentParty.id}:${inviteVisibility}]]${inviteLabel}`);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchAnnouncement = async () => {
      try {
        const res = await usersApi.getAnnouncement();
        if (isMounted) {
          setAnnouncement(res.data.message || '');
        }
      } catch (error) {
        console.error('Failed to fetch announcement:', error);
      }
    };

    fetchAnnouncement();

    return () => {
      isMounted = false;
    };
  }, []);

  const getPageName = (pathname: string): string => getPageMetaForPath(pathname).title;

  const breadcrumbItems = useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const items = [];

    if (location.pathname === '/') {
      return [{ label: 'Tableau de bord', path: '/' }];
    }

    items.push({
      label: 'Tableau de bord',
      path: '/',
    });

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;

      if (isLast) {
        items.push({
          label: getPageName(location.pathname),
          path: currentPath,
        });
      } else {
        const segmentName = getPageName(currentPath);
        items.push({
          label: segmentName,
          path: currentPath,
        });
      }
    });

    return items;
  }, [location.pathname]);

  const clanEffects = user?.clanEffects ?? [];
  const formatRemaining = (target: string | null) => {
    if (!target) return '0m';
    const diff = new Date(target).getTime() - now;
    if (diff <= 0) return '0m';
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    if (minutes > 0) return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    return `${seconds}s`;
  };

  return (
    <header className={cn(
      "sticky top-0 z-10 flex h-14 items-center justify-between border-b px-3 sm:px-6 transition-all duration-300",
      scrolled
        ? "border-border/20 bg-background"
        : "border-border/40 bg-background"
    )}>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <SidebarTrigger className="flex-shrink-0 text-muted-foreground hover:text-foreground" />
        {announcement && (
          <div className="hidden sm:flex max-w-[45vw] min-w-0 items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
            <span className="font-medium  ">Annonce</span>
            <span className="truncate">{announcement}</span>
          </div>
        )}
        <div className="hidden sm:block">
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbItems.map((item, index) => {
                const isLast = index === breadcrumbItems.length - 1;
                return (
                  <div key={item.path} className="flex items-center gap-1.5">
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={item.path}>{item.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </div>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-8 text-sm">
          {!currentParty && (
            <DropdownMenu
              onOpenChange={(open) => {
                if (open) {
                  fetchPublicParties();
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  title="Rejoindre un groupe"
                  aria-label="Rejoindre un groupe"
                >
                  <Users className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Partys en cours</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableParties.length > 0 ? (
                  availableParties.map((party) => {
                    const isDuel = party.maxSize === 2;
                    return (
                      <DropdownMenuItem
                        key={party.id}
                        onSelect={(event) => event.preventDefault()}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {party.name || (isDuel ? 'Duel sans nom' : 'Groupe sans nom')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {party.memberCount}/{party.maxSize} membres
                            {party.selectedGame?.gameName ? ` · ${party.selectedGame.gameName}` : ''}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            joinParty(party.id);
                          }}
                        >
                          Rejoindre
                        </Button>
                      </DropdownMenuItem>
                    );
                  })
                ) : (
                  <>
                    <DropdownMenuItem disabled>Aucun groupe en cours</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        createParty(undefined, true, 8);
                        navigate('/party');
                      }}
                      className="gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      Créer un groupe
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {duelMatchmakingEnabled && (
            <Button
              type="button"
              variant={duelMatchmakingQueued ? 'default' : 'outline'}
              size="sm"
              className="hidden sm:inline-flex h-8 gap-2"
              onClick={() => {
                if (duelMatchmakingQueued) {
                  leaveDuelMatchmaking();
                } else {
                  joinDuelMatchmaking();
                }
              }}
              title={duelMatchmakingQueued ? 'Quitter la file de matchmaking duel' : 'Entrer en file de matchmaking duel'}
            >
              <Crosshair className="h-4 w-4" />
              {duelMatchmakingQueued ? 'Quitter matchmaking' : 'Matchmaking duel'}
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {duelMatchmakingStats.queuedCount} en queue / {duelMatchmakingStats.inGameCount} en jeu
              </span>
            </Button>
          )}

          {currentParty && (
            <div className="relative">
              <Collapsible open={showParty} onOpenChange={setShowParty}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto gap-1 px-0 py-0 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">{currentParty.name || 'Groupe'}</span>
                    <span className="text-xs">
                      ({partyMembers.length}/{currentParty.maxSize})
                    </span>
                    {showParty ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="absolute right-0 top-full z-50 mt-2 w-64">
                  <div className="rounded-md border border-border/60 bg-background/95 shadow-lg">
                    <div className="border-b border-border/30 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Gamepad2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{gameStatus}</span>
                      </div>
                    </div>

                    <ScrollArea className="h-32">
                      <div className="space-y-1 px-3 py-2">
                        {partyMembers.map((member) => (
                          <div key={member.userId} className="flex items-center gap-2 text-xs">
                            <div
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                bombPartyGame?.currentPlayerId === member.userId
                                  ? 'bg-yellow-500'
                                  : petitBacGame
                                    ? (petitBacGame.players.find((p) => p.userId === member.userId)?.submitted
                                        ? 'bg-green-500'
                                        : 'bg-yellow-500')
                                    : 'bg-green-500'
                              )}
                            />
                            <span className={cn(member.userId === user?.id && 'font-medium')}>
                              <PlayerHoverCard
                                userId={member.userId}
                                username={member.username}
                                usernameColor={member.usernameColor}
                              >
                                <UsernameDisplay
                                  username={member.username}
                                  usernameColor={member.usernameColor}
                                />
                              </PlayerHoverCard>
                              {member.isLeader && ' *'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="flex flex-wrap gap-2 border-t border-border/30 px-3 py-2">
                      {location.pathname !== '/party' && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                          onClick={() => setShowParty(false)}
                        >
                          <Link to="/party">
                            <Eye className="h-3 w-3" />
                            Ouvrir
                          </Link>
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={() => {
                          sendChatInvite();
                          setShowParty(false);
                        }}
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                        title="Inviter via le chat"
                      >
                        <UserPlus className="h-3 w-3" />
                        Inviter
                      </Button>
                      {bombPartyGame && location.pathname !== '/games/bomb-party' && (
                        <Button asChild size="sm" className="h-7 flex-1 gap-1 px-2 text-xs" onClick={() => setShowParty(false)}>
                          <Link to="/games/bomb-party">
                            <Bomb className="h-3 w-3" />
                            Rejoindre
                          </Link>
                        </Button>
                      )}
                      {petitBacGame && location.pathname !== '/games/petit-bac' && (
                        <Button asChild size="sm" className="h-7 flex-1 gap-1 px-2 text-xs" onClick={() => setShowParty(false)}>
                          <Link to="/games/petit-bac">
                            <Gamepad2 className="h-3 w-3" />
                            Rejoindre
                          </Link>
                        </Button>
                      )}
                      {isLeader ? (
                        <Button
                          type="button"
                          onClick={() => {
                            deleteParty();
                            setShowParty(false);
                          }}
                          variant="destructive"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                        >
                          <Trash2 className="h-3 w-3" />
                          Supprimer
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => {
                            leaveParty();
                            setShowParty(false);
                          }}
                          variant="destructive"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                        >
                          <LogOut className="h-3 w-3" />
                          Quitter
                        </Button>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-muted-foreground'}`} />
              <span className="hidden sm:inline text-muted-foreground">
                {connected ? 'online' : 'offline'}
              </span>
            </div>
            <div className="relative">
              <Collapsible
                open={showUsers}
                onOpenChange={(open) => {
                  setShowUsers(open);
                  if (open) {
                    requestOnlineUsers();
                    requestDoodleSpectateSessions();
                    requestChessSpectateSessions();
                  }
                }}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto gap-1 px-0 py-0 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <span className="text-green-500">{onlineCount}<span className="hidden sm:inline"> connectés</span></span>
                    {showUsers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="absolute right-0 top-full z-50 mt-2 w-64">
                  <div className="rounded-md border border-border/60 bg-background/95 shadow-lg">
                    <ScrollArea className="h-48">
                      <div className="space-y-1 px-3 py-2">
                        {onlineUsers.map((u) => (
                          <div key={u.userId} className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                            <Button
                              type="button"
                              onClick={() => {
                                setShowUsers(false);
                                navigate(`/profile/${u.userId}`);
                              }}
                              variant="ghost"
                              className="h-auto min-w-0 flex-1 justify-start gap-2 px-0 py-1 text-left transition-colors hover:bg-transparent hover:text-foreground"
                            >
                              {u.profilePicture ? (
                                <img
                                  src={resolveImageUrl(u.profilePicture)}
                                  alt={u.username}
                                  className="h-4 w-4 rounded-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="h-1 w-1 rounded-full bg-foreground/50" />
                              )}
                              <div className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5">
                                  <PlayerHoverCard
                                    userId={u.userId}
                                    username={u.username}
                                    usernameColor={u.usernameColor}
                                    profilePicture={u.profilePicture}
                                  >
                                    <UsernameDisplay
                                      username={u.username}
                                      usernameColor={u.usernameColor}
                                      className="block"
                                    />
                                  </PlayerHoverCard>
                                </span>
                                {(() => {
                                  const pageMeta = getPageMeta(u.currentPage);
                                  const PageIcon = pageMeta.icon;
                                  return (
                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                                      <PageIcon className="h-3 w-3" />
                                      <span className="truncate">{pageMeta.label}</span>
                                      {canViewConnectedStatus && (
                                        <>
                                          <Monitor className="ml-1 h-3 w-3" />
                                          <span>{u.isPageActive ? 'sur page' : 'arriere-plan'}</span>
                                        </>
                                      )}
                                    </span>
                                  );
                                })()}
                              </div>
                            </Button>
                            {(() => {
                              const session = doodleSpectateSessionMap.get(u.userId);
                              const canSpectate = Boolean(
                                session &&
                                  u.userId !== user?.id &&
                                  u.currentPage?.startsWith('/games/doodle-jump')
                              );
                              if (canSpectate && session) {
                                return (
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      setShowUsers(false);
                                      navigate('/games/doodle-jump', {
                                        state: { spectateHostUserId: u.userId },
                                      });
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1 px-2 text-[10px]"
                                    title={`Spectate ${u.username}`}
                                  >
                                    <Eye className="h-3 w-3" />
                                    <span className="tabular-nums">{session.spectatorCount}</span>
                                  </Button>
                                );
                              }

                              const chessSession = chessSpectateSessionMap.get(u.userId);
                              const canSpectateChess = Boolean(
                                chessSession &&
                                  u.userId !== user?.id &&
                                  u.currentPage?.startsWith('/games/echecs')
                              );
                              if (!canSpectateChess || !chessSession) return null;
                              return (
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setShowUsers(false);
                                    navigate('/games/echecs', {
                                      state: { spectatePartyId: chessSession.partyId },
                                    });
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 px-2 text-[10px]"
                                  title={`Spectate ${u.username}`}
                                >
                                  <Eye className="h-3 w-3" />
                                  <span className="tabular-nums">{chessSession.spectatorCount}</span>
                                </Button>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          <InboxDropdown />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" className="hidden sm:inline-flex h-auto gap-2 px-0 py-0 text-sm text-muted-foreground hover:text-foreground">
                <Zap className="h-4 w-4" />
                <span>Effets</span>
                <span className="text-xs text-foreground">{clanEffects.length}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Effets du clan</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {clanEffects.length === 0 ? (
                <DropdownMenuItem disabled>Aucun effet actif ou en cooldown</DropdownMenuItem>
              ) : (
                clanEffects.map((effect) => (
                  <DropdownMenuItem key={effect.id} onSelect={(event) => event.preventDefault()} className="flex flex-col items-start gap-1 py-3">
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="font-medium text-foreground">{effect.name}</span>
                      <span className={cn('text-[10px] uppercase tracking-[0.18em]', effect.isActive ? 'text-emerald-400' : 'text-amber-400')}>
                        {effect.isActive ? 'Actif' : 'Temps de recharge'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      +{effect.value}% d&apos;argent sur les récompenses de jeux
                    </div>
                    <div className="text-[11px] text-muted-foreground/80">
                      {effect.isActive ? `Fin: ${formatRemaining(effect.activeUntil)}` : `Prêt dans: ${formatRemaining(effect.cooldownUntil)}`}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-6 tabular-nums">
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
              {user?.aura.toLocaleString()} <span className="text-muted-foreground">aura</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <CircleDollarSign className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              ${user?.money.toLocaleString()} <span className="text-muted-foreground">argent</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

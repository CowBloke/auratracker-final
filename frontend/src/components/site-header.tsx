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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
import { usersApi, supportApi, changelogApi } from '@/services/api';
import { cn } from '@/lib/utils';
import { getPageMetaForPath } from '@/lib/page-meta';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
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
  Search,
  SendHorizonal,
  Megaphone,
} from 'lucide-react';
import { UsernameDisplay } from '@/components/ui/username-display';
import { InboxDropdown } from '@/components/inbox/InboxDropdown';
import { PlayerHoverCard } from '@/components/ui/player-hover-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { YouHeaderBar } from '@/components/you/YouHeaderBar';
import { UserAccountMenu } from '@/components/user-account-menu';
import { setMoneyIndicatorElement } from '@/lib/money-income-effects';
import { getPartyDisplayName } from '@/lib/party-display-name';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { computeNewChangelogCount, markChangelogSeen } from '@/lib/changelog';
import { t } from '@/lib/i18n';

interface SearchUser {
  id: string;
  username: string;
  firstName?: string | null;
  usernameColor?: string | null;
  profilePicture?: string | null;
  bio?: string | null;
}

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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchUsers, setSearchUsers] = useState<SearchUser[]>([]);
  const [isLoadingSearchUsers, setIsLoadingSearchUsers] = useState(false);
  const [searchLoadError, setSearchLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasFetchedSearchUsers, setHasFetchedSearchUsers] = useState(false);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [updatesUnread, setUpdatesUnread] = useState(0);

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
    ? `${t('site_header_bomb_party_status_prefix')} ${bombPartyGame.round}`
    : petitBacGame
      ? `${t('site_header_petit_bac_status_prefix')} ${petitBacGame.round}/${petitBacGame.maxRounds}`
      : t('site_header_waiting');
  const inviteLabel = currentParty?.name ? `${t('site_header_join_current_party_prefix')} ${currentParty.name}` : t('site_header_join_my_group');
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

  useEffect(() => {
    if (!isSearchOpen || hasFetchedSearchUsers) return;
    const fetchUsers = async () => {
      try {
        setIsLoadingSearchUsers(true);
        setSearchLoadError(null);
        const response = await usersApi.getAll();
        setSearchUsers(response.data.users || []);
        setHasFetchedSearchUsers(true);
      } catch {
        setSearchLoadError(t('site_header_search_error'));
      } finally {
        setIsLoadingSearchUsers(false);
      }
    };
    fetchUsers();
  }, [isSearchOpen, hasFetchedSearchUsers]);

  useEffect(() => {
    if (!user) return;
    supportApi.getUnreadCount().then(({ data }) => setMessagesUnread(data.count)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: { message: { fromAdmin: boolean; userId?: string } }) => {
      if (location.pathname !== '/messages' && data.message.fromAdmin) {
        setMessagesUnread((c) => c + 1);
      }
    };
    socket.on('support:message', handler);
    return () => { socket.off('support:message', handler); };
  }, [socket, location.pathname]);

  useEffect(() => {
    if (location.pathname === '/messages') setMessagesUnread(0);
  }, [location.pathname]);

  useEffect(() => {
    const syncUnread = () => {
      changelogApi.getIds()
        .then(({ data }) => setUpdatesUnread(computeNewChangelogCount(data.ids)))
        .catch(() => {});
    };
    if (location.pathname === '/changelog') {
      changelogApi.getIds()
        .then(({ data }) => {
          if (data.ids[0]) markChangelogSeen(data.ids[0]);
          setUpdatesUnread(0);
        })
        .catch(() => {});
    } else {
      syncUnread();
    }
    window.addEventListener('focus', syncUnread);
    window.addEventListener('storage', syncUnread);
    return () => {
      window.removeEventListener('focus', syncUnread);
      window.removeEventListener('storage', syncUnread);
    };
  }, [location.pathname]);

  const getPageName = (pathname: string): string => getPageMetaForPath(pathname).title;

  const breadcrumbItems = useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const items = [];

    if (location.pathname === '/') {
      return [{ label: t('site_header_dashboard'), path: '/' }];
    }

    items.push({
      label: t('site_header_dashboard'),
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
  const isYouPage = location.pathname.startsWith('/you');
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

  const filteredSearchUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return searchUsers;
    return searchUsers.filter((u) => u.username.toLowerCase().includes(term));
  }, [searchTerm, searchUsers]);

  const getBioPreview = (bio?: string | null, maxLength = 80) => {
    const trimmed = bio?.trim();
    if (!trimmed) return t('site_header_no_description');
    if (trimmed.length <= maxLength) return trimmed;
    return `${trimmed.slice(0, maxLength)}...`;
  };

  const handleSearchUserSelect = (userId: string) => {
    setIsSearchOpen(false);
    setSearchTerm('');
    navigate(`/profile/${userId}`);
  };

  const searchSheet = (
    <Sheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title={t('site_header_search_player')}>
          <Search className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Rechercher un joueur</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 pt-6">
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pseudo, identifiant..."
            autoFocus
            className="h-12 shrink-0 border-border/50"
          />
          <ScrollArea className="flex-1">
            <div className="space-y-0 pr-4">
              {isLoadingSearchUsers ? (
                <p className="text-sm text-muted-foreground py-4">Chargement des joueurs...</p>
              ) : searchLoadError ? (
                <p className="text-sm text-muted-foreground py-4">{searchLoadError}</p>
              ) : filteredSearchUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">{t('site_header_no_player_found')}</p>
              ) : (
                filteredSearchUsers.map((u) => (
                  <Button
                    key={u.id}
                    type="button"
                    onClick={() => handleSearchUserSelect(u.id)}
                    variant="ghost"
                    className="h-auto w-full justify-start gap-3 rounded-none border-b border-border/30 px-3 py-4 text-left last:border-0"
                  >
                    <Avatar className="h-9 w-9">
                      {u.profilePicture ? (
                        <AvatarImage src={resolveImageUrl(u.profilePicture)} alt={u.username} />
                      ) : null}
                      <AvatarFallback className="bg-muted text-foreground">
                        {u.username.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <UsernameDisplay
                        username={u.username}
                        firstName={u.firstName}
                        usernameColor={u.usernameColor}
                        className="block"
                        usernameClassName="text-sm font-medium"
                      />
                      <span className="block text-xs text-muted-foreground">
                        {getBioPreview(u.bio)}
                      </span>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );

  const messagesButton = (
    <Button asChild variant="ghost" size="sm" className="relative h-8 w-8 p-0" title="Messagerie">
      <Link to="/messages">
        <SendHorizonal className="h-4 w-4" />
        {messagesUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-0.5 text-white text-[9px] font-semibold">
            {messagesUnread > 99 ? '99+' : messagesUnread}
          </span>
        )}
      </Link>
    </Button>
  );

  const changelogButton = (
    <Button asChild variant="ghost" size="sm" className="relative h-8 w-8 p-0" title="Changelog">
      <Link to="/changelog">
        <Megaphone className="h-4 w-4" />
        {updatesUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-0.5 text-white text-[9px] font-semibold">
            {updatesUnread > 99 ? '99+' : updatesUnread}
          </span>
        )}
      </Link>
    </Button>
  );

  const onlineUsersControl = (
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
              <span className="text-green-500">{onlineCount}<span className="hidden sm:inline"> {t('site_header_connected_suffix')}</span></span>
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
  );

  if (isYouPage) {
    return (
      <header
        className={cn(
          'sticky top-0 z-50 shrink-0 flex h-14 items-center border-b px-3 sm:px-6 transition-all duration-300',
          scrolled ? 'border-border/20 bg-background shadow-sm' : 'border-border/40 bg-background'
        )}
      >
        <div className="flex w-full min-w-0 items-center gap-3">
          <SidebarTrigger className="flex-shrink-0 text-muted-foreground hover:text-foreground" />
          <div className="min-w-0 flex-1">
            <YouHeaderBar rightSlot={<div className="flex items-center gap-2">{onlineUsersControl}{searchSheet}{messagesButton}{changelogButton}<InboxDropdown /></div>} />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className={cn(
      "sticky top-0 z-50 shrink-0 flex h-14 items-center justify-between border-b px-3 sm:px-6 transition-all duration-300",
      scrolled
        ? "border-border/20 bg-background shadow-sm"
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

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
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
                    return (
                      <DropdownMenuItem
                        key={party.id}
                        onSelect={(event) => event.preventDefault()}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {getPartyDisplayName(party)}
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
                      {t('site_header_create_group')}
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

                    <div className="px-3 py-2">
                      <Accordion type="single" collapsible className="rounded-md border border-border/40 bg-muted/10 px-3">
                        <AccordionItem value="party-users" className="border-none">
                          <AccordionTrigger className="py-3 text-xs hover:no-underline">
                            <span className="text-muted-foreground">
                              Utilisateurs ({partyMembers.length})
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="pb-3">
                            <ScrollArea className="h-32 pr-2">
                              <div className="space-y-1">
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
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>

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
                    <span className="text-green-500">{onlineCount}<span className="hidden sm:inline"> {t('site_header_connected_suffix')}</span></span>
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

          {searchSheet}
          {messagesButton}
          {changelogButton}
          <InboxDropdown />

          {clanEffects.length > 0 && (
            <TooltipProvider delayDuration={100}>
              <div className="hidden sm:flex items-center gap-1">
                {clanEffects.map((effect) => (
                  <Tooltip key={effect.id}>
                    <TooltipTrigger asChild>
                      <div className="flex h-6 w-6 cursor-default items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/50 text-emerald-400 text-[10px] font-bold select-none">
                        +{effect.value}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-48 text-center">
                      <p className="font-medium">{effect.name}</p>
                      <p className="text-muted-foreground text-xs">+{effect.value}% {t('site_header_game_reward_bonus')}</p>
                      <p className="text-muted-foreground/70 text-xs mt-0.5">Fin : {formatRemaining(effect.activeUntil)}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          )}

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-lg bg-muted/30 px-2.5 py-1 sm:flex">
              <CurrencyIcon type="aura" className="h-3 w-3" />
              <span className="text-xs font-semibold tabular-nums">{user?.aura?.toLocaleString() ?? '0'}</span>
            </div>
            <div ref={setMoneyIndicatorElement} className="hidden items-center gap-1.5 rounded-lg bg-muted/30 px-2.5 py-1 sm:flex">
              <CurrencyIcon type="money" className="h-3 w-3" />
              <span className="text-xs font-semibold tabular-nums">{user?.money?.toLocaleString() ?? '0'} {'\u20AC'}</span>
            </div>
            <UserAccountMenu showLabel={false} />
          </div>
        </div>
      </div>
    </header>
  );
}

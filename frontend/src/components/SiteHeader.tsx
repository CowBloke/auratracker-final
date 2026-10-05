import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Crosshair, Eye, Megaphone, Monitor, Search, SendHorizonal, ShieldOff, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocketBase } from '@/contexts/SocketContext';
import { useChatSocket } from '@/contexts/ChatSocketContext';
import { useDuelSocket } from '@/contexts/DuelSocketContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Kbd } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPageMeta } from '@/components/chat/presence';
import { resolveImageUrl } from '@/lib/images';
import { usersApi, supportApi, youApi, type YouTemporaryEffect } from '@/services/api';
import { getPageMetaForPath } from '@/lib/page-meta';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
import { MoneyHistoryChip } from '@/components/currency/MoneyHistoryChip';
import { TemporaryEffectBadges } from '@/components/temporary-effects/TemporaryEffectBadges';
import { UsernameDisplay } from '@/components/ui/username-display';
import { InboxDropdown } from '@/components/inbox/InboxDropdown';
import { PlayerHoverCard } from '@/components/ui/player-hover-card';
import { TopbarCommandPalette } from '@/components/layout/TopbarCommandPalette';
import { t } from '@/lib/i18n';

function formatRemaining(target: string | null, now: number) {
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
}

export function SiteHeader() {
  const { user, refreshUser } = useAuth();
  const { connected, socket } = useSocketBase();
  const {
    onlineUsers,
    onlineCount,
    requestOnlineUsers,
    doodleSpectateSessions,
    requestDoodleSpectateSessions,
    chessSpectateSessions,
    requestChessSpectateSessions,
  } = useChatSocket();
  const { duelMatchmakingQueued, duelMatchmakingStats, joinDuelMatchmaking, leaveDuelMatchmaking } = useDuelSocket();
  const { maintenanceStatus } = useFeatures();
  const location = useLocation();
  const navigate = useNavigate();

  const [showUsers, setShowUsers] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [now, setNow] = useState(Date.now());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [temporaryEffects, setTemporaryEffects] = useState<YouTemporaryEffect[]>([]);
  const canViewConnectedStatus = Boolean(user?.isAdmin || user?.isSuperAdmin);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setShowUsers(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const load = async () => {
      try {
        const res = await youApi.getTemporaryEffects();
        if (active) setTemporaryEffects(res.data.effects ?? []);
      } catch {
        // ignore
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.id]);

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
    let isMounted = true;

    const fetchAnnouncement = async () => {
      try {
        const res = await usersApi.getAnnouncement();
        if (isMounted) setAnnouncement(res.data.message || '');
      } catch (error) {
        console.error('Failed to fetch announcement:', error);
      }
    };

    void fetchAnnouncement();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    supportApi.getUnreadCount().then(({ data }) => setMessagesUnread(data.count)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: { message: { fromAdmin: boolean; userId?: string } }) => {
      if (location.pathname !== '/messages' && data.message.fromAdmin) {
        setMessagesUnread((count) => count + 1);
      }
    };

    socket.on('support:message', handler);
    return () => {
      socket.off('support:message', handler);
    };
  }, [socket, location.pathname]);

  useEffect(() => {
    if (location.pathname === '/messages') setMessagesUnread(0);
  }, [location.pathname]);

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

  const breadcrumbItems = useMemo(() => {
    if (location.pathname === '/' || location.pathname === '/dashboard') {
      return [{ label: t('site_header_dashboard'), path: '/dashboard' }];
    }

    const items: Array<{ label: string; path: string }> = [{ label: t('site_header_dashboard'), path: '/dashboard' }];
    let currentPath = '';
    location.pathname
      .split('/')
      .filter(Boolean)
      .forEach((segment, index, segments) => {
        currentPath += `/${segment}`;
        const isLast = index === segments.length - 1;
        items.push({
          label: getPageMetaForPath(isLast ? location.pathname : currentPath).title,
          path: currentPath,
        });
      });
    return items;
  }, [location.pathname]);

  const clanEffects = user?.clanEffects ?? [];
  const duelMatchmakingEnabled = maintenanceStatus.duelMatchmakingEnabled;

  const spectateButton = (userId: string, username: string, count: number, onClick: () => void) => (
    <Button type="button" variant="outline" size="xs" onClick={onClick} aria-label={`Spectate ${username}`}>
      <Eye />
      <span className="tabular-nums">{count}</span>
    </Button>
  );

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {breadcrumbItems.map((item, index) => {
              const isLast = index === breadcrumbItems.length - 1;
              return (
                <Fragment key={item.path}>
                  <BreadcrumbItem className={isLast ? 'min-w-0' : 'hidden md:block'}>
                    {isLast ? (
                      <BreadcrumbPage className="truncate">{item.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={item.path}>{item.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast ? <BreadcrumbSeparator className="hidden md:block" /> : null}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="ml-auto flex items-center gap-2">
          {user?.hasAdblock ? (
            <Badge variant="outline" className="hidden lg:inline-flex">
              <ShieldOff />
              Adblock actif
            </Badge>
          ) : null}

          <TemporaryEffectBadges effects={temporaryEffects} nowTs={now} />

          {clanEffects.map((effect) => (
            <Tooltip key={effect.id}>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="hidden tabular-nums sm:inline-flex">
                  +{effect.value}%
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-medium">{effect.name}</p>
                <p>
                  +{effect.value}% {t('site_header_game_reward_bonus')}
                </p>
                <p>Fin : {formatRemaining(effect.activeUntil, now)}</p>
              </TooltipContent>
            </Tooltip>
          ))}

          {duelMatchmakingEnabled ? (
            <Button
              type="button"
              variant={duelMatchmakingQueued ? 'default' : 'outline'}
              className="hidden lg:inline-flex"
              onClick={() => (duelMatchmakingQueued ? leaveDuelMatchmaking() : joinDuelMatchmaking())}
            >
              <Crosshair />
              {duelMatchmakingQueued ? 'Quitter la file duel' : 'Matchmaking duel'}
              <Badge variant="secondary" className="tabular-nums">
                {duelMatchmakingStats.queuedCount} / {duelMatchmakingStats.inGameCount}
              </Badge>
            </Button>
          ) : null}

          <Popover
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
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" aria-label={connected ? `${onlineCount} connectés` : 'Déconnecté'}>
                <Users />
                <span className="tabular-nums">{onlineCount}</span>
                <span
                  className={connected ? 'size-2 rounded-full bg-primary' : 'size-2 rounded-full bg-muted-foreground'}
                  aria-hidden
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="p-3 text-sm font-semibold">En ligne ({onlineCount})</div>
              <Separator />
              <ScrollArea className="h-72">
                <ItemGroup className="p-1">
                  {onlineUsers.map((onlineUser) => {
                    const pageMeta = getPageMeta(onlineUser.currentPage);
                    const PageIcon = pageMeta.icon;
                    const doodleSession = doodleSpectateSessionMap.get(onlineUser.userId);
                    const canSpectateDoodle = Boolean(
                      doodleSession &&
                        onlineUser.userId !== user?.id &&
                        onlineUser.currentPage?.startsWith('/games/doodle-jump')
                    );
                    const chessSession = chessSpectateSessionMap.get(onlineUser.userId);
                    const canSpectateChess = Boolean(
                      chessSession &&
                        onlineUser.userId !== user?.id &&
                        onlineUser.currentPage?.startsWith('/games/echecs')
                    );

                    return (
                      <Item key={onlineUser.userId} size="sm">
                        <ItemMedia>
                          <Avatar className="size-8">
                            {onlineUser.profilePicture ? (
                              <AvatarImage src={resolveImageUrl(onlineUser.profilePicture)} alt={onlineUser.username} />
                            ) : null}
                            <AvatarFallback>{onlineUser.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>
                            <Button variant="ghost" size="xs" type="button" onClick={() => {
                                setShowUsers(false);
                                navigate(`/profile/${onlineUser.userId}`);
                              }}>
                              <PlayerHoverCard
                                userId={onlineUser.userId}
                                username={onlineUser.username}
                                usernameColor={onlineUser.usernameColor}
                                profilePicture={onlineUser.profilePicture}
                              >
                                <UsernameDisplay
                                  username={onlineUser.username}
                                  usernameColor={onlineUser.usernameColor}
                                  className="block"
                                />
                              </PlayerHoverCard>
                            </Button>
                          </ItemTitle>
                          <ItemDescription className="flex items-center gap-1">
                            <PageIcon className="size-3" />
                            <span className="truncate">{pageMeta.label}</span>
                            {canViewConnectedStatus ? (
                              <>
                                <Monitor className="ml-1 size-3" />
                                <span>{onlineUser.isPageActive ? 'sur page' : 'arrière-plan'}</span>
                              </>
                            ) : null}
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          {canSpectateDoodle && doodleSession
                            ? spectateButton(onlineUser.userId, onlineUser.username, doodleSession.spectatorCount, () => {
                                setShowUsers(false);
                                navigate('/games/doodle-jump', { state: { spectateHostUserId: onlineUser.userId } });
                              })
                            : canSpectateChess && chessSession
                              ? spectateButton(onlineUser.userId, onlineUser.username, chessSession.spectatorCount, () => {
                                  setShowUsers(false);
                                  navigate('/games/echecs', { state: { spectatePartyId: chessSession.partyId } });
                                })
                              : null}
                        </ItemActions>
                      </Item>
                    );
                  })}
                </ItemGroup>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="outline"
            className="text-muted-foreground sm:w-56 sm:justify-start"
            onClick={() => setIsSearchOpen(true)}
            aria-label={t('site_header_search_player')}
          >
            <Search />
            <span className="hidden flex-1 text-left sm:block">Rechercher…</span>
            <Kbd className="hidden md:inline-flex">Ctrl K</Kbd>
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="outline" size="icon" className="relative" aria-label="Messagerie">
                <Link to="/messages">
                  <SendHorizonal />
                  {messagesUnread > 0 ? (
                    <Badge className="absolute -right-2 -top-2 h-5 min-w-5 justify-center rounded-full px-1 tabular-nums">
                      {messagesUnread > 99 ? '99+' : messagesUnread}
                    </Badge>
                  ) : null}
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Messagerie</TooltipContent>
          </Tooltip>

          <InboxDropdown />

          <Badge variant="outline" className="hidden h-9 gap-1.5 px-3 text-sm sm:inline-flex">
            <CurrencyIcon type="aura" />
            <span className="tabular-nums">{user?.aura?.toLocaleString() ?? '0'}</span>
          </Badge>
          <div className="hidden sm:block">
            <MoneyHistoryChip amount={user?.money} />
          </div>
        </div>
      </header>

      {announcement ? (
        <Alert className="rounded-none border-x-0 border-t-0">
          <Megaphone />
          <AlertDescription>{announcement}</AlertDescription>
        </Alert>
      ) : null}

      <TopbarCommandPalette open={isSearchOpen} onOpenChange={setIsSearchOpen} currentUserId={user?.id} />
    </>
  );
}

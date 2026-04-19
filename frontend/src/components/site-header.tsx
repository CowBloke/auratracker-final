import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Crosshair,
  Eye,
  Monitor,
  Search,
  SendHorizonal,
  ShieldOff,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocketBase } from '@/contexts/SocketContext';
import { useChatSocket } from '@/contexts/ChatSocketContext';
import { useDuelSocket } from '@/contexts/DuelSocketContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { getPageMeta } from '@/components/chat/presence';
import { resolveImageUrl } from '@/lib/images';
import { usersApi, supportApi, youApi, type YouTemporaryEffect } from '@/services/api';
import { cn } from '@/lib/utils';
import { getPageMetaForPath } from '@/lib/page-meta';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
import { TemporaryEffectBadges } from '@/components/temporary-effects/TemporaryEffectBadges';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { UsernameDisplay } from '@/components/ui/username-display';
import { InboxDropdown } from '@/components/inbox/InboxDropdown';
import { PlayerHoverCard } from '@/components/ui/player-hover-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UserAccountMenu } from '@/components/user-account-menu';
import { YouHeaderBar } from '@/components/you/YouHeaderBar';
import { TopbarCommandPalette } from '@/components/layout/TopbarCommandPalette';
import { setMoneyIndicatorElement } from '@/lib/money-income-effects';
import { t } from '@/lib/i18n';

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
  const [showTitleTrail, setShowTitleTrail] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [scrolled, setScrolled] = useState(false);
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
    setShowTitleTrail(false);
    setShowUsers(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const load = async () => {
      try {
        const res = await youApi.getTemporaryEffects();
        if (active) {
          setTemporaryEffects(res.data.effects ?? []);
        }
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
    const mainEl = document.querySelector('main');
    if (!mainEl) return;
    const handleScroll = () => setScrolled(mainEl.scrollTop > 10);
    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainEl.removeEventListener('scroll', handleScroll);
  }, []);

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
    if (location.pathname === '/messages') {
      setMessagesUnread(0);
    }
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

  const getPageName = (pathname: string): string => getPageMetaForPath(pathname).title;

  const breadcrumbItems = useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const items: Array<{ label: string; path: string }> = [];

    if (location.pathname === '/') {
      return [{ label: t('site_header_dashboard'), path: '/' }];
    }

    items.push({ label: t('site_header_dashboard'), path: '/' });

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;

      items.push({
        label: isLast ? getPageName(location.pathname) : getPageName(currentPath),
        path: currentPath,
      });
    });

    return items;
  }, [location.pathname]);

  const currentPageTitle = breadcrumbItems[breadcrumbItems.length - 1]?.label ?? t('site_header_dashboard');
  const clanEffects = user?.clanEffects ?? [];
  const isYouPage = location.pathname.startsWith('/you');
  const duelMatchmakingEnabled = maintenanceStatus.duelMatchmakingEnabled;

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

  const chromeButtonClassName = 'relative h-9 w-9 rounded-xl border border-border/60 bg-background/80 text-muted-foreground shadow-sm transition-all hover:bg-muted/70 hover:text-foreground';
  const chromeChipClassName = 'hidden items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3.5 py-2 text-xs font-semibold shadow-sm sm:flex';

  const titleControl = (
    <div
      className="relative min-w-0"
      onMouseEnter={() => setShowTitleTrail(true)}
      onMouseLeave={() => setShowTitleTrail(false)}
    >
      <button
        type="button"
        onClick={() => setShowTitleTrail((open) => !open)}
        className="group flex min-w-0 items-center gap-2 rounded-2xl px-1 py-1 text-left transition-colors hover:text-foreground"
        aria-expanded={showTitleTrail}
        aria-label="Afficher le chemin de navigation"
      >
        <span className="truncate text-lg font-semibold tracking-tight text-foreground">{currentPageTitle}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', showTitleTrail && 'rotate-180')} />
      </button>
      {showTitleTrail && breadcrumbItems.length > 1 ? (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[16rem] max-w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-background/95 p-3 shadow-xl backdrop-blur-xl">
          <Breadcrumb>
            <BreadcrumbList className="flex-wrap gap-y-2">
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
      ) : null}
    </div>
  );

  const searchTrigger = (
    <Button
      type="button"
      variant="ghost"
      onClick={() => setIsSearchOpen(true)}
      className="h-10 w-10 justify-center rounded-full border border-border/60 bg-background/85 p-0 text-sm font-normal text-muted-foreground shadow-sm transition-all hover:bg-muted/70 hover:text-foreground sm:min-w-[18rem] sm:w-auto sm:justify-start sm:gap-3 sm:px-4"
      title={t('site_header_search_player')}
    >
      <Search className="h-4 w-4" />
      <span className="hidden min-w-0 flex-1 truncate text-left sm:block">Rechercher partout…</span>
      <span className="hidden items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:inline-flex">
        <span>Ctrl</span>
        <span>K</span>
      </span>
    </Button>
  );

  const messagesButton = (
    <Button asChild variant="ghost" size="sm" className={cn(chromeButtonClassName, 'p-0')} title="Messagerie">
      <Link to="/messages">
        <SendHorizonal className="h-4 w-4" />
        {messagesUnread > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-0.5 text-white text-[9px] font-semibold">
            {messagesUnread > 99 ? '99+' : messagesUnread}
          </span>
        ) : null}
      </Link>
    </Button>
  );

  const onlineUsersControl = (
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
            className="h-9 gap-2 rounded-full border border-border/60 bg-background/80 px-3 text-muted-foreground shadow-sm transition-all hover:bg-muted/70 hover:text-foreground"
            title={connected ? `${onlineCount} connectés` : 'Déconnecté'}
          >
            <div className={cn('h-2 w-2 rounded-full', connected ? 'bg-green-500' : 'bg-muted-foreground')} />
            <Users className="h-4 w-4" />
            <span className="text-xs font-semibold tabular-nums text-foreground">{onlineCount}</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform', showUsers && 'rotate-180')} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="absolute right-0 top-full z-50 mt-2 w-72">
          <div className="rounded-2xl border border-border/70 bg-background/95 shadow-xl backdrop-blur-xl">
            <ScrollArea className="h-56">
              <div className="space-y-1 px-3 py-3">
                {onlineUsers.map((onlineUser) => (
                  <div key={onlineUser.userId} className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                    <Button
                      type="button"
                      onClick={() => {
                        setShowUsers(false);
                        navigate(`/profile/${onlineUser.userId}`);
                      }}
                      variant="ghost"
                      className="h-auto min-w-0 flex-1 justify-start gap-2 px-0 py-1 text-left transition-colors hover:bg-transparent hover:text-foreground"
                    >
                      {onlineUser.profilePicture ? (
                        <img
                          src={resolveImageUrl(onlineUser.profilePicture)}
                          alt={onlineUser.username}
                          className="h-4 w-4 rounded-full object-cover"
                          onError={(event) => {
                            (event.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="h-1 w-1 rounded-full bg-foreground/50" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
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
                        </span>
                        {(() => {
                          const pageMeta = getPageMeta(onlineUser.currentPage);
                          const PageIcon = pageMeta.icon;
                          return (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                              <PageIcon className="h-3 w-3" />
                              <span className="truncate">{pageMeta.label}</span>
                              {canViewConnectedStatus ? (
                                <>
                                  <Monitor className="ml-1 h-3 w-3" />
                                  <span>{onlineUser.isPageActive ? 'sur page' : 'arriere-plan'}</span>
                                </>
                              ) : null}
                            </span>
                          );
                        })()}
                      </div>
                    </Button>
                    {(() => {
                      const doodleSession = doodleSpectateSessionMap.get(onlineUser.userId);
                      const canSpectateDoodle = Boolean(
                        doodleSession &&
                        onlineUser.userId !== user?.id &&
                        onlineUser.currentPage?.startsWith('/games/doodle-jump')
                      );

                      if (canSpectateDoodle && doodleSession) {
                        return (
                          <Button
                            type="button"
                            onClick={() => {
                              setShowUsers(false);
                              navigate('/games/doodle-jump', {
                                state: { spectateHostUserId: onlineUser.userId },
                              });
                            }}
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 px-2 text-[10px]"
                            title={`Spectate ${onlineUser.username}`}
                          >
                            <Eye className="h-3 w-3" />
                            <span className="tabular-nums">{doodleSession.spectatorCount}</span>
                          </Button>
                        );
                      }

                      const chessSession = chessSpectateSessionMap.get(onlineUser.userId);
                      const canSpectateChess = Boolean(
                        chessSession &&
                        onlineUser.userId !== user?.id &&
                        onlineUser.currentPage?.startsWith('/games/echecs')
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
                          title={`Spectate ${onlineUser.username}`}
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
  );

  const standardHeaderControls = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {user?.hasAdblock ? (
        <div className="hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-500 shadow-sm lg:flex">
          <ShieldOff className="h-3.5 w-3.5" />
          <span>Adblock actif</span>
        </div>
      ) : null}
      {onlineUsersControl}
      {duelMatchmakingEnabled ? (
        <Button
          type="button"
          variant={duelMatchmakingQueued ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            'hidden h-9 gap-2 rounded-xl border px-3 shadow-sm sm:inline-flex',
            duelMatchmakingQueued
              ? 'border-primary/40'
              : 'border-border/60 bg-background/80 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          )}
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
      ) : null}
      <TemporaryEffectBadges effects={temporaryEffects} nowTs={now} className="hidden sm:flex" />
      {searchTrigger}
      {messagesButton}
      <InboxDropdown buttonClassName={chromeButtonClassName} />
      {clanEffects.length > 0 ? (
        <TooltipProvider delayDuration={100}>
          <div className="hidden sm:flex items-center gap-1">
            {clanEffects.map((effect) => (
              <Tooltip key={effect.id}>
                <TooltipTrigger asChild>
                  <div className="flex h-7 w-7 cursor-default items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/15 text-[10px] font-bold text-emerald-500 shadow-sm select-none">
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
      ) : null}
      <div className="flex shrink-0 items-center gap-2">
        <div className={cn(chromeChipClassName, 'text-[hsl(45_86%_33%)]')}>
          <CurrencyIcon type="aura" className="h-3.5 w-3.5 text-yellow-400" />
          <span className="tabular-nums">{user?.aura?.toLocaleString() ?? '0'}</span>
        </div>
        <div ref={setMoneyIndicatorElement} className={cn(chromeChipClassName, 'text-emerald-600 dark:text-emerald-400')}>
          <CurrencyIcon type="money" className="h-3.5 w-3.5 text-emerald-400" />
          <span className="tabular-nums">{user?.money?.toLocaleString() ?? '0'} {'\u20AC'}</span>
        </div>
        <UserAccountMenu
          showLabel
          className="h-10 rounded-full border border-border/60 bg-background/85 px-2 shadow-sm hover:bg-muted/70"
        />
      </div>
    </div>
  );

  if (isYouPage) {
    return (
      <>
        <header
          className={cn(
            'sticky top-0 z-50 shrink-0 border-b px-3 py-3 sm:px-6 md:pl-[4.125rem] transition-all duration-300',
            scrolled
              ? 'border-border/30 bg-background/90 shadow-sm backdrop-blur-xl'
              : 'border-border/50 bg-background/80 backdrop-blur-xl'
          )}
        >
          <div className="flex w-full min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
              <YouHeaderBar
                titleSlot={titleControl}
                rightSlot={
                  <div className="flex items-center gap-2">
                    {onlineUsersControl}
                    {searchTrigger}
                    {messagesButton}
                    <InboxDropdown buttonClassName={chromeButtonClassName} />
                  </div>
                }
              />
            </div>
          </div>
        </header>
        <TopbarCommandPalette open={isSearchOpen} onOpenChange={setIsSearchOpen} currentUserId={user?.id} />
      </>
    );
  }

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 shrink-0 border-b px-3 py-3 sm:px-6 md:pl-[4.125rem] transition-all duration-300',
          scrolled
            ? 'border-border/30 bg-background/90 shadow-sm backdrop-blur-xl'
            : 'border-border/50 bg-background/80 backdrop-blur-xl'
        )}
      >
        <div className="flex w-full min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            {titleControl}
            {announcement ? (
              <div className="mt-1.5 hidden max-w-[48rem] min-w-0 items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-500 sm:flex">
                <span className="font-semibold uppercase tracking-[0.14em]">Annonce</span>
                <span className="truncate">{announcement}</span>
              </div>
            ) : null}
          </div>
          {standardHeaderControls}
        </div>
      </header>
      <TopbarCommandPalette open={isSearchOpen} onOpenChange={setIsSearchOpen} currentUserId={user?.id} />
    </>
  );
}

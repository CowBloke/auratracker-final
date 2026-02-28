import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
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
  Maximize2,
  Minimize2,
  Users,
  LogOut,
  Bomb,
  Gamepad2,
  Trash2,
  UserPlus,
  Eye,
} from 'lucide-react';

export function SiteHeader() {
  const { user } = useAuth();
  const {
    connected,
    onlineUsers,
    onlineCount,
    requestOnlineUsers,
    doodleSpectateSessions,
    requestDoodleSpectateSessions,
    currentParty,
    partyMembers,
    leaveParty,
    deleteParty,
    bombPartyGame,
    petitBacGame,
    sendMessage,
  } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const [showUsers, setShowUsers] = useState(false);
  const [showParty, setShowParty] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const isGameRoute = location.pathname.startsWith('/games/');
  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const doodleSpectateSessionMap = useMemo(
    () => new Map(doodleSpectateSessions.map((session) => [session.hostUserId, session])),
    [doodleSpectateSessions]
  );
  const gameStatus = bombPartyGame
    ? `Bomb Party - Round ${bombPartyGame.round}`
    : petitBacGame
      ? `Petit Bac - Manche ${petitBacGame.round}/${petitBacGame.maxRounds}`
      : 'En attente';
  const inviteLabel = currentParty?.name ? `Rejoins ${currentParty.name}` : 'Rejoins ma party';
  const inviteVisibility = currentParty?.isPublic ? 'public' : 'private';

  const sendChatInvite = () => {
    if (currentParty) {
      sendMessage(`[[party-invite:${currentParty.id}:${inviteVisibility}]]${inviteLabel}`);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
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

    fetchAnnouncement();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, []);

  const getPageName = (pathname: string): string => getPageMetaForPath(pathname).title;

  const breadcrumbItems = useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const items = [];

    if (location.pathname === '/') {
      return [{ label: 'Dashboard', path: '/' }];
    }

    items.push({
      label: 'Dashboard',
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

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/40 px-6">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        {announcement && (
          <div className="flex max-w-[45vw] min-w-0 items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
            <span className="font-medium  ">Annonce</span>
            <span className="truncate">{announcement}</span>
          </div>
        )}
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

      <div className="flex items-center gap-4">
        {isGameRoute && (
          <Button
            type="button"
            onClick={toggleFullscreen}
            variant="outline"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        )}
        <div className="flex items-center gap-8 text-sm">
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
                    <span>{currentParty.name || 'Party'}</span>
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
                            <span
                              style={member.usernameColor ? { color: member.usernameColor } : undefined}
                              className={cn(member.userId === user?.id && 'font-medium')}
                            >
                              {member.username}
                              {member.isLeader && ' *'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="flex flex-wrap gap-2 border-t border-border/30 px-3 py-2">
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
              <span className="text-muted-foreground">
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
                  }
                }}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto gap-1 px-0 py-0 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <span className="text-green-500">{onlineCount} connectés</span>
                    {showUsers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="absolute left-0 top-full z-50 mt-2 w-64">
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
                                <span
                                  className="block truncate"
                                  style={u.usernameColor ? { color: u.usernameColor } : undefined}
                                >
                                  {u.username}
                                </span>
                                {(() => {
                                  const pageMeta = getPageMeta(u.currentPage);
                                  const PageIcon = pageMeta.icon;
                                  return (
                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                                      <PageIcon className="h-3 w-3" />
                                      <span className="truncate">{pageMeta.label}</span>
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
                              if (!canSpectate || !session) return null;
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

          <div className="flex items-center gap-6 tabular-nums">
            <span className="text-foreground">
              {user?.aura.toLocaleString()} <span className="text-muted-foreground">aura</span>
            </span>
            <span className="text-foreground">
              ${user?.money.toLocaleString()} <span className="text-muted-foreground">argent</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

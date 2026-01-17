import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ChatSidebarProvider, ChatSidebarWrapper } from '../chat/ChatSidebarWrapper';
import ChatBubble from '../chat/ChatBubble';
import PartyBubble from '../party/PartyBubble';
import BombPartyJoinPrompt from '../game/BombPartyJoinPrompt';
import PokerJoinPrompt from '../game/PokerJoinPrompt';
import PetitBacJoinPrompt from '../game/PetitBacJoinPrompt';
import MonopolyJoinPrompt from '../game/MonopolyJoinPrompt';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useCallback, useEffect, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getPageMeta } from '@/components/chat/presence';
import { resolveImageUrl } from '@/lib/images';
import { usersApi } from '@/services/api';

export default function Layout() {
  const { user } = useAuth();
  const { connected, setCurrentPage, onlineUsers } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUsers, setShowUsers] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const isGameRoute = location.pathname.startsWith('/games/');

  useEffect(() => {
    if (connected) {
      setCurrentPage(location.pathname);
    }
  }, [connected, location.pathname, setCurrentPage]);

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

  return (
    <ChatSidebarProvider>
      <div className="min-h-screen bg-background flex">
        <SidebarProvider className="!w-auto flex-1">
          <Sidebar />
          <SidebarInset className="flex flex-col">
            <header className="flex items-center justify-between border-b border-border/40 px-6 py-4 h-14">
              <div className="flex items-center min-w-0 gap-3">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                {announcement && (
                  <div className="flex min-w-0 items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400 max-w-[45vw]">
                    <span className="font-medium uppercase tracking-wide">Annonce</span>
                    <span className="truncate">{announcement}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                {isGameRoute && (
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-2 border border-border/50 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                  >
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                )}
                <div className="flex items-center gap-8 text-sm">
                  {/* Connection indicator */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                      <span className="text-muted-foreground">
                        {connected ? 'online' : 'offline'}
                      </span>
                    </div>
                    <div className="relative">
                      <Collapsible open={showUsers} onOpenChange={setShowUsers}>
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                          >
                            <span className="text-green-500">{onlineUsers.length} connectés</span>
                            {showUsers ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="absolute left-0 top-full z-50 mt-2 w-64">
                          <div className="rounded-md border border-border/60 bg-background/95 shadow-lg">
                            <ScrollArea className="h-48">
                              <div className="px-3 py-2 space-y-1">
                                {onlineUsers.map((u) => (
                                  <button
                                    key={u.userId}
                                    onClick={() => {
                                      setShowUsers(false);
                                      navigate(`/profile/${u.userId}`);
                                    }}
                                    className="flex items-center gap-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                                  >
                                    {u.profilePicture ? (
                                      <img
                                        src={resolveImageUrl(u.profilePicture)}
                                        alt={u.username}
                                        className="w-4 h-4 rounded-full object-cover"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-1 h-1 rounded-full bg-foreground/50" />
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
                                  </button>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </div>

                  {/* Stats */}
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
            <main className="flex-1 overflow-auto">
              <Outlet />
            </main>
          </SidebarInset>
        </SidebarProvider>
        <ChatSidebarWrapper />
        <div className="fixed bottom-6 right-6 z-50 flex items-end gap-3">
          <PartyBubble />
          <ChatBubble />
        </div>
        <BombPartyJoinPrompt />
        <PokerJoinPrompt />
        <PetitBacJoinPrompt />
        <MonopolyJoinPrompt />
      </div>
    </ChatSidebarProvider>
  );
}

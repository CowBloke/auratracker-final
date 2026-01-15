import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ChatSidebarProvider, ChatSidebarWrapper } from '../chat/ChatSidebarWrapper';
import { ChatSidebarTrigger } from '../chat/ChatSidebarTrigger';
import PartyBubble from '../party/PartyBubble';
import BombPartyJoinPrompt from '../game/BombPartyJoinPrompt';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useEffect } from 'react';

export default function Layout() {
  const { user } = useAuth();
  const { connected, setCurrentPage } = useSocket();
  const location = useLocation();

  useEffect(() => {
    if (connected) {
      setCurrentPage(location.pathname);
    }
  }, [connected, location.pathname, setCurrentPage]);

  return (
    <ChatSidebarProvider>
      <div className="min-h-screen bg-background flex">
        <SidebarProvider className="!w-auto flex-1">
          <Sidebar />
          <SidebarInset className="flex flex-col">
            <header className="flex items-center justify-between border-b border-border/40 px-6 py-4 h-14">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-8 text-sm">
                  {/* Connection indicator */}
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                    <span className="text-muted-foreground">
                      {connected ? 'online' : 'offline'}
                    </span>
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
                <ChatSidebarTrigger className="text-muted-foreground hover:text-foreground" />
              </div>
            </header>
            <main className="flex-1 overflow-auto">
              <Outlet />
            </main>
          </SidebarInset>
        </SidebarProvider>
        <ChatSidebarWrapper />
        <PartyBubble />
        <BombPartyJoinPrompt />
      </div>
    </ChatSidebarProvider>
  );
}

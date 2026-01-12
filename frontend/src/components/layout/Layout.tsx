import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ChatSidebarWrapper, ChatSidebarTriggerWrapper } from '../chat/ChatSidebarWrapper';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';

export default function Layout() {
  const { user } = useAuth();
  const { connected } = useSocket();

  return (
    <div className="min-h-screen bg-background flex">
      <SidebarProvider className="!w-auto flex-1">
        <Sidebar />
        <SidebarInset className="flex flex-col">
          <header className="flex items-center justify-between border-b border-border/40 px-6 py-4 h-14">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

            <div className="flex items-center gap-8 text-sm">
              {/* Connection indicator */}
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-foreground' : 'bg-muted-foreground'}`} />
                <span className="text-muted-foreground">
                  {connected ? 'online' : 'offline'}
                </span>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 tabular-nums">
                <span className="text-muted-foreground">
                  {user?.aura.toLocaleString()} <span className="text-muted-foreground/60">aura</span>
                </span>
                <span className="text-muted-foreground">
                  ${user?.money.toLocaleString()} <span className="text-muted-foreground/60">money</span>
                </span>
              </div>

              <ChatSidebarTriggerWrapper />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
      <ChatSidebarWrapper />
    </div>
  );
}

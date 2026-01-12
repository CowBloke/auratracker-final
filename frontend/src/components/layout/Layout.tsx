import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ChatSidebarWrapper, ChatSidebarTriggerWrapper } from '../chat/ChatSidebarWrapper';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Sparkles, Coins, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Layout() {
  const { user } = useAuth();
  const { connected } = useSocket();

  return (
    <div className="min-h-screen bg-background flex">
      <SidebarProvider className="!w-auto flex-1">
        <Sidebar />
        <SidebarInset className="flex flex-col">
          <div className="flex items-center justify-between border-b px-4 py-2 h-16">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
            </div>

            {/* Currency Display */}
            <div className="flex items-center gap-6">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                {connected ? (
                  <Wifi className="w-4 h-4 text-accent-green" />
                ) : (
                  <WifiOff className="w-4 h-4 text-destructive" />
                )}
                <span className="text-xs text-muted-foreground">
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* Aura */}
              <Badge variant="outline" className="gap-2 px-4 py-2 bg-aura/10 border-aura/30">
                <Sparkles className="w-4 h-4 text-aura-light" />
                <span className="text-lg font-semibold text-aura-light">
                  {user?.aura.toLocaleString()}
                </span>
              </Badge>

              {/* Money */}
              <Badge variant="outline" className="gap-2 px-4 py-2 bg-money/10 border-money/30">
                <Coins className="w-4 h-4 text-money-light" />
                <span className="text-lg font-semibold text-money-light">
                  ${user?.money.toLocaleString()}
                </span>
              </Badge>

              {/* User Menu */}
              <div className="flex items-center gap-3">
                <ChatSidebarTriggerWrapper />
              </div>
            </div>
          </div>
          <main className="flex-1 p-6 min-h-[calc(100vh-4rem)] overflow-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
      <ChatSidebarWrapper />
    </div>
  );
}

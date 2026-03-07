import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, type CSSProperties } from 'react';
import { ChatSidebarProvider, ChatSidebarWrapper, useChatSidebar } from '../chat/ChatSidebarWrapper';
import ChatBubble from '../chat/ChatBubble';
import UpdatePopupModal from './UpdatePopupModal';
import GameJoinPrompt from '../game/GameJoinPrompt';
import GameReplayPrompt from '../game/GameReplayPrompt';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { CONTAINER } from '@/lib/design-system';
import { cn } from '@/lib/utils';

function ChatBubbleContainer() {
  const { open } = useChatSidebar();

  return (
    <div
      className="fixed bottom-6 z-50 flex items-end gap-3 transition-all"
      style={{ right: open ? 'calc(20rem + 1.5rem)' : '1.5rem' }}
    >
      <ChatBubble />
    </div>
  );
}

export default function Layout() {
  const { connected, setCurrentPage, activeJoinPrompt, activeReplayPrompt, respondToGameJoinPrompt, respondToGameReplayPrompt } = useSocket();
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (connected) {
      setCurrentPage(location.pathname);
    }
  }, [connected, location.pathname, setCurrentPage]);

  return (
    <ChatSidebarProvider>
      <div className="min-h-screen bg-background flex w-full">
        <SidebarProvider
          className="!w-auto flex-1"
          style={
            {
              '--sidebar-width': 'calc(var(--spacing) * 72)',
              '--header-height': 'calc(var(--spacing) * 12)',
            } as CSSProperties
          }
        >
          <AppSidebar variant="inset" />
          <SidebarInset>
            <SiteHeader />
            <div className="@container/main flex flex-1 flex-col">
              <main className="flex-1 overflow-auto">
                <div className={cn('mx-auto flex w-full flex-1 flex-col pt-6 lg:pt-8', CONTAINER.DEFAULT)}>
                  <Outlet />
                </div>
              </main>
            </div>
          </SidebarInset>
        </SidebarProvider>
        <ChatSidebarWrapper />
        <ChatBubbleContainer />

        {activeJoinPrompt && user && (
          <GameJoinPrompt
            key={activeJoinPrompt.startTime}
            title={activeJoinPrompt.title}
            settingsText={activeJoinPrompt.settingsText}
            navigateTo={activeJoinPrompt.navigateTo}
            leaderId={activeJoinPrompt.leaderId}
            members={activeJoinPrompt.members}
            responses={activeJoinPrompt.responses}
            timeLimit={activeJoinPrompt.timeLimit}
            startTime={activeJoinPrompt.startTime}
            currentUserId={user.id}
            onAccept={() => respondToGameJoinPrompt(true)}
            onDecline={() => respondToGameJoinPrompt(false)}
          />
        )}

        {activeReplayPrompt && user && (
          <GameReplayPrompt
            key={activeReplayPrompt.startTime}
            settingsText={activeReplayPrompt.settingsText}
            players={activeReplayPrompt.players}
            responses={activeReplayPrompt.responses}
            timeLimit={activeReplayPrompt.timeLimit}
            startTime={activeReplayPrompt.startTime}
            currentUserId={user.id}
            onPlayAgain={() => respondToGameReplayPrompt(true)}
            onLeave={() => respondToGameReplayPrompt(false)}
          />
        )}

        <UpdatePopupModal />
      </div>
    </ChatSidebarProvider>
  );
}

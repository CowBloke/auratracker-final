import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, type CSSProperties } from 'react';
import { ChatSidebarProvider, ChatSidebarWrapper, useChatSidebar } from '../chat/ChatSidebarWrapper';
import ChatBubble from '../chat/ChatBubble';
import GiftBubble from '../gifts/GiftBubble';
import UpdatePopupModal from './UpdatePopupModal';
import BombPartyJoinPrompt from '../game/BombPartyJoinPrompt';
import BombPartyPlayAgainPrompt from '../game/BombPartyPlayAgainPrompt';
import PokerJoinPrompt from '../game/PokerJoinPrompt';
import PetitBacJoinPrompt from '../game/PetitBacJoinPrompt';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { useSocket } from '@/contexts/SocketContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { CONTAINER, SPACING } from '@/lib/design-system';
import { getPageMetaForPath } from '@/lib/page-meta';
import { PageHeader } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';

function ChatBubbleContainer() {
  const { open } = useChatSidebar();

  return (
    <div
      className="fixed bottom-6 z-50 flex items-end gap-3 transition-all"
      style={{ right: open ? 'calc(20rem + 1.5rem)' : '1.5rem' }}
    >
      <GiftBubble />
      <ChatBubble />
    </div>
  );
}

export default function Layout() {
  const { connected, setCurrentPage } = useSocket();
  const location = useLocation();
  const pageMeta = getPageMetaForPath(location.pathname);
  const showContentHeader = pageMeta.contentHeader !== false;

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
                {showContentHeader ? (
                  <div className={cn('mx-auto w-full', CONTAINER.COMPACT, SPACING.PAGE_HEADER_PADDING)}>
                    <PageHeader title={pageMeta.title} description={pageMeta.description} />
                  </div>
                ) : null}
                <Outlet />
              </main>
            </div>
          </SidebarInset>
        </SidebarProvider>
        <ChatSidebarWrapper />
        <ChatBubbleContainer />
        <BombPartyJoinPrompt />
        <BombPartyPlayAgainPrompt />
        <PokerJoinPrompt />
        <PetitBacJoinPrompt />
        <UpdatePopupModal />
      </div>
    </ChatSidebarProvider>
  );
}

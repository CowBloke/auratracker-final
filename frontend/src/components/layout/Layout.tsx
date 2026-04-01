import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, type CSSProperties } from 'react';
import { ChatSidebarProvider, ChatSidebarWrapper, useChatSidebar } from '../chat/ChatSidebarWrapper';
import ChatBubble from '../chat/ChatBubble';
import UpdatePopupModal from './UpdatePopupModal';
import AdminWarningModal from './AdminWarningModal';
import GameJoinPrompt from '../game/GameJoinPrompt';
import GameReplayPrompt from '../game/GameReplayPrompt';
import DuelChallengePopup from '../game/DuelChallengePopup';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { useSocketBase } from '@/contexts/SocketContext';
import { useGameSocket } from '@/contexts/GameSocketContext';
import { useDuelSocket } from '@/contexts/DuelSocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import PartyChatFloating from '@/components/party/PartyChatFloating';
import SupportChat from '@/components/support/SupportChat';
import { CONTAINER } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { matchesShortcut, useKeyboardShortcuts } from '@/lib/keyboard-shortcuts';

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

function PartyChatFloatingContainer() {
  const { open } = useChatSidebar();

  return (
    <PartyChatFloating rightOffset={open ? 'calc(20rem + 1.5rem)' : '1.5rem'} />
  );
}

function SupportChatContainer() {
  const { open } = useChatSidebar();
  const { user } = useAuth();

  if (user?.isAdmin) return null;

  return (
    <SupportChat rightOffset={open ? 'calc(20rem + 1.5rem)' : '1.5rem'} />
  );
}

export default function Layout() {
  const { connected, setCurrentPage } = useSocketBase();
  const { activeJoinPrompt, activeReplayPrompt, respondToGameJoinPrompt, respondToGameReplayPrompt } = useGameSocket();
  const { incomingDuelChallenge, acceptDuelChallenge, declineDuelChallenge } = useDuelSocket();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLDivElement>(null);
  const keyboardShortcuts = useKeyboardShortcuts();

  useEffect(() => {
    if (connected) {
      setCurrentPage(location.pathname);
    }
  }, [connected, location.pathname, setCurrentPage]);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      if (target.isContentEditable) {
        return true;
      }

      const tagName = target.tagName.toLowerCase();
      return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) {
        return;
      }

      const matchedShortcut = keyboardShortcuts.find(
        (shortcut) => shortcut.enabled && matchesShortcut(event, shortcut.combo)
      );

      if (!matchedShortcut) {
        return;
      }

      event.preventDefault();

      switch (matchedShortcut.id) {
        case 'open_dashboard':
          navigate('/dashboard');
          break;
        case 'open_games':
          navigate('/games');
          break;
        case 'open_profile':
          if (user?.id) {
            navigate(`/profile/${user.id}`);
          }
          break;
        case 'open_inbox':
          navigate('/inbox');
          break;
        case 'open_shop':
          navigate('/market');
          break;
        case 'open_settings':
          navigate('/settings');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardShortcuts, navigate, user?.id]);

  return (
    <ChatSidebarProvider>
      <div className="flex h-svh w-full overflow-hidden bg-background">
        <SidebarProvider
          defaultOpen={false}
          className="!w-auto flex-1"
          style={
            {
              '--sidebar-width': 'calc(var(--spacing) * 72)',
              '--header-height': 'calc(var(--spacing) * 12)',
            } as CSSProperties
          }
        >
          <AppSidebar variant="inset" />
          <SidebarInset className="min-h-0 overflow-hidden">
            <SiteHeader />
            <div className="@container/main flex min-h-0 flex-1 flex-col">
              <div ref={mainRef} className="min-h-0 flex-1 overflow-auto">
                <div className={cn('mx-auto flex w-full flex-1 flex-col pt-6 lg:pt-8', CONTAINER.DEFAULT)}>
                  <Outlet />
                </div>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
        <ChatSidebarWrapper />
        <PartyChatFloatingContainer />
        <SupportChatContainer />
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

        {incomingDuelChallenge && (
          <DuelChallengePopup
            key={incomingDuelChallenge.sentAt}
            challengerUsername={incomingDuelChallenge.challengerUsername}
            challengerUsernameColor={incomingDuelChallenge.challengerUsernameColor}
            gameType={incomingDuelChallenge.gameType}
            timeLimit={incomingDuelChallenge.timeLimit}
            sentAt={incomingDuelChallenge.sentAt}
            onAccept={acceptDuelChallenge}
            onDecline={declineDuelChallenge}
          />
        )}

        <UpdatePopupModal />
        <AdminWarningModal />
      </div>
    </ChatSidebarProvider>
  );
}

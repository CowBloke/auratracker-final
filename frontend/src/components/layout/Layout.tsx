import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, type CSSProperties } from 'react';
import { ChatSidebarProvider, ChatSidebarWrapper, useChatSidebar } from '../chat/ChatSidebarWrapper';
import ChatBubble from '../chat/ChatBubble';
import AdminWarningModal from './AdminWarningModal';
import GameJoinPrompt from '../game/GameJoinPrompt';
import GameReplayPrompt from '../game/GameReplayPrompt';
import DuelChallengePopup from '../game/DuelChallengePopup';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useSocketBase } from '@/contexts/SocketContext';
import { useGameSocket } from '@/contexts/GameSocketContext';
import { useDuelSocket } from '@/contexts/DuelSocketContext';
import { useAuth } from '@/contexts/AuthContext';
import AppSidebar from '@/components/layout/Sidebar';
import { SiteHeader } from '@/components/site-header';
import PartyChatFloating from '@/components/party/PartyChatFloating';
import MoneyIncomeOverlay from '@/components/rewards/MoneyIncomeOverlay';
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

export default function Layout() {
  const { connected, setCurrentPage, updateAvailable, dismissUpdate } = useSocketBase();
  const { activeJoinPrompt, activeReplayPrompt, respondToGameJoinPrompt, respondToGameReplayPrompt } = useGameSocket();
  const { incomingDuelChallenge, acceptDuelChallenge, declineDuelChallenge } = useDuelSocket();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLDivElement>(null);
  const keyboardShortcuts = useKeyboardShortcuts();
  const isMessagesPage = location.pathname === '/messages';
  const youTab = new URLSearchParams(location.search).get('tab');
  const isCartePage = location.pathname === '/you' && (youTab === 'carte' || youTab === null);

  useEffect(() => {
    if (connected) {
      setCurrentPage(`${location.pathname}${location.search}`);
    }
  }, [connected, location.pathname, location.search, setCurrentPage]);

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
          <main className="relative min-h-0 flex w-full flex-1 flex-col overflow-hidden bg-background">
            {updateAvailable && (
              <div className="flex items-center justify-between gap-3 bg-primary px-4 py-2 text-sm text-primary-foreground">
                <span>Une mise à jour est disponible — rechargez la page pour en bénéficier.</span>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="rounded bg-primary-foreground/20 px-3 py-0.5 font-medium hover:bg-primary-foreground/30"
                  >
                    Recharger
                  </button>
                  <button
                    onClick={dismissUpdate}
                    className="rounded px-2 py-0.5 hover:bg-primary-foreground/20"
                    aria-label="Ignorer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            <SiteHeader />
            <div className="@container/main flex min-h-0 flex-1 flex-col">
              <div ref={mainRef} className={cn('min-h-0 flex-1', isMessagesPage || isCartePage ? 'overflow-hidden' : 'overflow-auto')}>
                <div
                  className={cn(
                    'mx-auto flex w-full flex-1 flex-col md:pl-[4.125rem]',
                    isMessagesPage || isCartePage ? 'h-full pt-0' : 'pt-6 lg:pt-8',
                    isCartePage ? CONTAINER.FULL : CONTAINER.DEFAULT
                  )}
                >
                  <Outlet />
                </div>
              </div>
            </div>
          </main>
        </SidebarProvider>
        <ChatSidebarWrapper />
        <PartyChatFloatingContainer />
        <ChatBubbleContainer />
        <MoneyIncomeOverlay />

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

        <AdminWarningModal />
      </div>
    </ChatSidebarProvider>
  );
}

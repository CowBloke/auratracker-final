import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Suspense, useEffect, useRef } from 'react';
import { CenteredSkeletonCard } from '@/components/ui/loading-skeletons';
import { ChatSidebarProvider, ChatSidebarWrapper, useChatSidebar } from '../chat/ChatSidebarWrapper';
import ChatBubble from '../chat/ChatBubble';
import AdminWarningModal from './AdminWarningModal';
import SurveyPopupModal from './SurveyPopupModal';
import { TutorialProvider } from '@/components/tutorial/TutorialContext';
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay';
import { TutorialWelcomeModal } from '@/components/tutorial/TutorialWelcomeModal';
import GameJoinPrompt from '../game/GameJoinPrompt';
import GameReplayPrompt from '../game/GameReplayPrompt';
import DuelChallengePopup from '../game/DuelChallengePopup';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useSocketBase } from '@/contexts/SocketContext';
import { useGameSocket } from '@/contexts/GameSocketContext';
import { useDuelSocket } from '@/contexts/DuelSocketContext';
import { useAuth } from '@/contexts/AuthContext';
import AppSidebar from '@/components/layout/Sidebar';
import { SiteHeader } from '@/components/SiteHeader';
import PartyChatFloating from '@/components/party/PartyChatFloating';
import MoneyIncomeOverlay from '@/components/rewards/MoneyIncomeOverlay';
import { cn } from '@/lib/utils';
import { matchesShortcut, useKeyboardShortcuts } from '@/lib/keyboard-shortcuts';

function ChatBubbleContainer() {
  const { open } = useChatSidebar();

  return (
    <div
      className="fixed bottom-6 z-50 flex items-end gap-3 transition-all"
      style={{ right: open ? 'calc(16rem + 1.5rem)' : '1.5rem' }}
    >
      <ChatBubble />
    </div>
  );
}

function PartyChatFloatingContainer() {
  const { open } = useChatSidebar();

  return (
    <PartyChatFloating rightOffset={open ? 'calc(16rem + 1.5rem)' : '1.5rem'} />
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
  const isCartePage = location.pathname === '/you' && (youTab === 'carte' || youTab === null || youTab === 'supply');

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
    <TutorialProvider>
    <ChatSidebarProvider>
      <div className="flex h-svh w-full overflow-hidden bg-background">
        <SidebarProvider defaultOpen className="h-svh min-h-0 w-auto flex-1">
          <AppSidebar />
          <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
            {updateAvailable && (
              <Alert className="rounded-none border-x-0 border-t-0">
                <RefreshCw />
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>Une mise à jour est disponible : rechargez la page pour en bénéficier.</span>
                  <span className="flex items-center gap-2">
                    <Button size="sm" onClick={() => window.location.reload()}>
                      Recharger
                    </Button>
                    <Button size="sm" variant="ghost" onClick={dismissUpdate}>
                      Ignorer
                    </Button>
                  </span>
                </AlertDescription>
              </Alert>
            )}
            <SiteHeader />
            <div
              ref={mainRef}
              className={cn('min-h-0 flex-1', isMessagesPage || isCartePage ? 'overflow-hidden' : 'overflow-auto')}
            >
              <Suspense fallback={<div className="p-4"><CenteredSkeletonCard /></div>}>
                <Outlet />
              </Suspense>
            </div>
          </SidebarInset>
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
        <SurveyPopupModal />
        <TutorialOverlay />
        <TutorialWelcomeModal />
      </div>
    </ChatSidebarProvider>
    </TutorialProvider>
  );
}

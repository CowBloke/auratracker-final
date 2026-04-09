/**
 * SocketContext — base context: socket instance, connected state,
 * setCurrentPage, presence management, ban handling.
 *
 * Domain-specific hooks live in their own context files:
 *   useChatSocket()  → ChatSocketContext
 *   usePartySocket() → PartySocketContext
 *   useGameSocket()  → GameSocketContext
 *   useDuelSocket()  → DuelSocketContext
 *
 * The legacy useSocket() shim below combines all four for backward compat.
 * Migrate consumers to domain hooks for maximum performance isolation.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import { initSocket, connectSocket, disconnectSocket, chatEvents } from '../services/socket';
import { storeBanInfo } from '../services/ban';
import { useAuth } from './AuthContext';
import { useChatSocket } from './ChatSocketContext';
import { usePartySocket } from './PartySocketContext';
import { useGameSocket } from './GameSocketContext';
import { useDuelSocket } from './DuelSocketContext';

// Re-export shared types so existing imports continue to work
export type { ChatBadge, ChatMessage, OnlineUser, DoodleSpectateSession, ChessSpectateSession } from './ChatSocketContext';
export type { PartyChatMessage } from './PartySocketContext';
export type { RRGameState, RRGameOver, ActiveJoinPrompt, ActiveReplayPrompt, PokerAction } from './GameSocketContext';

interface SocketBaseContextValue {
  socket: Socket | null;
  connected: boolean;
  setCurrentPage: (page: string) => void;
}

const SocketBaseContext = createContext<SocketBaseContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const logoutRef = useRef(logout);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  useEffect(() => { logoutRef.current = logout; }, [logout]);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return;
    const s = initSocket();
    setSocket(s);
    connectSocket();

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    const handleSiteReloadRequired = () => {
      window.location.reload();
    };

    const handleBan = (data: { message?: string; ban?: { reason?: string; type?: string; expiresAt?: string | null } }) => {
      storeBanInfo({
        reason: data?.ban?.reason ?? null,
        type: (data?.ban?.type as 'TEMPORARY' | 'PERMANENT' | null) ?? null,
        expiresAt: data?.ban?.expiresAt ?? null,
        message: data?.message,
      });
      logoutRef.current();
      disconnectSocket();
      navigateRef.current('/banned', { replace: true });
    };

    s.on('ban:enforced', handleBan);
    s.on('ban:active', handleBan);
    s.on('site:reload-required', handleSiteReloadRequired);

    return () => {
      disconnectSocket();
      s.off('site:reload-required', handleSiteReloadRequired);
      s.removeAllListeners();
      setSocket(null);
      setConnected(false);
    };
  }, [user?.id, user?.username]);

  // Presence: publish focus/visibility state
  useEffect(() => {
    if (!user || !connected) return;
    const publishPresence = () => {
      const isPageActive = document.visibilityState === 'visible' && document.hasFocus();
      chatEvents.setPresence(user.id, isPageActive);
    };
    publishPresence();
    document.addEventListener('visibilitychange', publishPresence);
    window.addEventListener('focus', publishPresence);
    window.addEventListener('blur', publishPresence);
    return () => {
      document.removeEventListener('visibilitychange', publishPresence);
      window.removeEventListener('focus', publishPresence);
      window.removeEventListener('blur', publishPresence);
    };
  }, [user?.id, connected]);

  const setCurrentPage = useCallback(
    (page: string) => {
      if (user) chatEvents.setPage(user.id, page);
    },
    [user?.id]
  );

  const value = useMemo(
    () => ({ socket, connected, setCurrentPage }),
    [socket, connected, setCurrentPage]
  );

  return <SocketBaseContext.Provider value={value}>{children}</SocketBaseContext.Provider>;
}

export function useSocketBase() {
  const ctx = useContext(SocketBaseContext);
  if (!ctx) throw new Error('useSocketBase must be used within SocketProvider');
  return ctx;
}

/**
 * Legacy compatibility hook — combines all sub-contexts.
 * Components using this still re-render on any sub-context change.
 * Prefer domain-specific hooks for perf-critical components.
 */
export function useSocket() {
  const base = useSocketBase();
  const chat = useChatSocket();
  const party = usePartySocket();
  const game = useGameSocket();
  const duel = useDuelSocket();
  return { ...base, ...chat, ...party, ...game, ...duel };
}

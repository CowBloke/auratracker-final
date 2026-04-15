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
import { api } from '../services/api';
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
  updateAvailable: boolean;
  dismissUpdate: () => void;
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
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const serverStartedAtRef = useRef<string | null>(null);
  const hasConnectedRef = useRef(false);
  // True when the most recent connect() call was triggered by a background-wake event,
  // meaning the user wasn't actively on the page — safe to auto-reload.
  const reconnectFromBackgroundRef = useRef(false);

  const dismissUpdate = useCallback(() => setUpdateAvailable(false), []);

  useEffect(() => {
    if (!user) return;
    const s = initSocket();
    setSocket(s);
    connectSocket();

    const handleConnect = async () => {
      setConnected(true);
      try {
        const res = await api.get<{ startedAt?: string }>('/health');
        const startedAt = res.data?.startedAt;
        if (startedAt) {
          if (hasConnectedRef.current && serverStartedAtRef.current !== startedAt) {
            // Server restarted since we last connected — a new deploy is live.
            // If the user was away from the page, reload silently; otherwise show the banner.
            if (reconnectFromBackgroundRef.current) {
              window.location.reload();
            } else {
              setUpdateAvailable(true);
            }
          }
          reconnectFromBackgroundRef.current = false;
          serverStartedAtRef.current = startedAt;
        }
      } catch {
        // Non-critical; ignore health check failures
      }
      hasConnectedRef.current = true;
    };

    s.on('connect', () => { void handleConnect(); });
    s.on('disconnect', () => setConnected(false));

    const handleSiteReloadRequired = () => {
      window.location.reload();
    };

    const handleBan = (data: {
      message?: string;
      userId?: string;
      ban?: { id?: string; userId?: string; reason?: string; type?: string; expiresAt?: string | null };
    }) => {
      storeBanInfo({
        reason: data?.ban?.reason ?? null,
        type: (data?.ban?.type as 'TEMPORARY' | 'PERMANENT' | null) ?? null,
        expiresAt: data?.ban?.expiresAt ?? null,
        message: data?.message,
        banId: data?.ban?.id ?? null,
        userId: data?.userId ?? data?.ban?.userId ?? null,
      });
      logoutRef.current();
      disconnectSocket();
      navigateRef.current('/banned', { replace: true });
    };

    s.on('ban:enforced', handleBan);
    s.on('ban:active', handleBan);
    s.on('site:reload-required', handleSiteReloadRequired);

    // Reconnect when the tab becomes visible again or network comes back — the browser
    // suspends timers during background sleep which kills Socket.io's reconnect loop.
    const handleReconnectTrigger = () => {
      if (!s.connected) {
        reconnectFromBackgroundRef.current = true;
        connectSocket();
      }
    };
    document.addEventListener('visibilitychange', handleReconnectTrigger);
    window.addEventListener('online', handleReconnectTrigger);
    // Periodic fallback: reconnect every 30 s if still disconnected
    const reconnectInterval = setInterval(handleReconnectTrigger, 30_000);

    return () => {
      disconnectSocket();
      document.removeEventListener('visibilitychange', handleReconnectTrigger);
      window.removeEventListener('online', handleReconnectTrigger);
      clearInterval(reconnectInterval);
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
    () => ({ socket, connected, updateAvailable, dismissUpdate, setCurrentPage }),
    [socket, connected, updateAvailable, dismissUpdate, setCurrentPage]
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

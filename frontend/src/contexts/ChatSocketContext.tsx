import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from './AuthContext';
import { chatEvents, initSocket, getSocket } from '../services/socket';

export interface ChatBadge {
  id: string;
  name: string;
  description: string;
  howToObtain?: string | null;
  backgroundType: string;
  backgroundColor: string;
  backgroundGradient?: string | null;
  backgroundImage?: string | null;
  icon: string;
  iconColor: string;
  borderColor: string;
  category: string;
  rarity: string;
}

export interface ChatMessage {
  id: string;
  type?: 'user' | 'system';
  userId: string | null;
  username: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
  message: string;
  imageUrl?: string | null;
  pinned: boolean;
  pinnedAt?: string | null;
  isTopMoney?: boolean;
  isTopAura?: boolean;
  badges: ChatBadge[];
  clanTag?: { text: string; style: string | null } | null;
  reactions: Array<{ emoji: string; count: number; users: string[] }>;
  replyTo?: {
    id: string;
    userId: string | null;
    username: string;
    usernameColor?: string | null;
    message: string;
    imageUrl?: string | null;
  } | null;
  timestamp: string;
}

export interface OnlineUser {
  userId: string;
  username: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
  currentPage?: string | null;
  isPageActive?: boolean;
  badges?: ChatBadge[];
  clanTag?: { text: string; style: string | null } | null;
}

export interface DoodleSpectateSession {
  hostUserId: string;
  hostUsername: string;
  mode: 'classic' | 'mort_subite';
  spectatorCount: number;
  score: number;
}

export interface ChessSpectateSession {
  partyId: string;
  players: Array<{
    userId: string;
    username: string;
    usernameColor?: string | null;
    color: 'w' | 'b';
  }>;
  spectatorCount: number;
  phase: 'playing' | 'finished';
}

interface TypingUser {
  userId: string;
  username: string;
}

interface ChatSocketContextValue {
  messages: ChatMessage[];
  onlineUsers: OnlineUser[];
  onlineCount: number;
  typingUsers: TypingUser[];
  doodleSpectateSessions: DoodleSpectateSession[];
  chessSpectateSessions: ChessSpectateSession[];
  sendMessage: (message?: string, replyToId?: string | null, imageUrl?: string | null) => void;
  reactToMessage: (messageId: string, emoji: string) => void;
  setTyping: (isTyping: boolean) => void;
  deleteMessage: (messageId: string) => void;
  pinMessage: (messageId: string, pinned: boolean) => void;
  requestOnlineUsers: () => void;
  requestDoodleSpectateSessions: () => void;
  requestChessSpectateSessions: () => void;
}

const ChatSocketContext = createContext<ChatSocketContextValue | null>(null);

export function ChatSocketProvider({ children }: { children: React.ReactNode }) {
  const { user, updateBalance } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [doodleSpectateSessions, setDoodleSpectateSessions] = useState<DoodleSpectateSession[]>([]);
  const [chessSpectateSessions, setChessSpectateSessions] = useState<ChessSpectateSession[]>([]);

  // Pending presence updates — batched every 500 ms to stop 52/sec re-renders
  type PresenceOp =
    | { op: 'add'; user: OnlineUser }
    | { op: 'remove'; userId: string }
    | { op: 'update'; user: Omit<OnlineUser, 'badges' | 'clanTag'> };
  const pendingPresenceRef = useRef<PresenceOp[]>([]);
  // Pending count updates — also batched
  const pendingCountRef = useRef<number | null>(null);

  // Flush presence queue every 500 ms
  useEffect(() => {
    const id = setInterval(() => {
      const pending = pendingPresenceRef.current.splice(0);
      if (pending.length > 0) {
        setOnlineUsers((prev) => {
          let result = [...prev];
          for (const op of pending) {
            if (op.op === 'add') {
              if (!result.find((u) => u.userId === op.user.userId)) result.push(op.user);
            } else if (op.op === 'update') {
              result = result.map((u) => u.userId === op.user.userId ? { ...u, ...op.user } : u);
            } else {
              result = result.filter((u) => u.userId !== op.userId);
            }
          }
          return result;
        });
      }
      if (pendingCountRef.current !== null) {
        setOnlineCount(pendingCountRef.current);
        pendingCountRef.current = null;
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) return;
    const s = initSocket();

    const handleConnect = () => {
      const initialPage = typeof window !== 'undefined' ? window.location.pathname : '/';
      const isPageActive =
        typeof document === 'undefined'
          ? true
          : document.visibilityState === 'visible' && document.hasFocus();
      chatEvents.join(user.id, user.username, initialPage, isPageActive);
      s.emit('doodle:spectate-list-request');
    };

    if (s.connected) handleConnect();
    s.on('connect', handleConnect);

    s.on('chat:history', (data: { messages: ChatMessage[] }) => {
      setMessages(
        data.messages.map((m) => ({
          ...m,
          reactions: m.reactions ?? [],
          pinned: m.pinned ?? false,
          pinnedAt: m.pinnedAt ?? null,
        }))
      );
    });

    s.on('chat:message', (message: ChatMessage) => {
      setMessages((prev) => [
        ...prev,
        {
          ...message,
          reactions: message.reactions ?? [],
          pinned: message.pinned ?? false,
          pinnedAt: message.pinnedAt ?? null,
        },
      ]);
    });

    s.on('chat:muted', (data: { message?: string }) => {
      if (typeof window !== 'undefined') {
        toast(data.message || 'Vous êtes mute du chat.');
      }
    });

    s.on('chat:blocked', (data: { message?: string }) => {
      if (typeof window !== 'undefined') {
        toast(data.message || 'Le chat est temporairement bloque.');
      }
    });

    s.on('chat:message-deleted', (data: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    });

    s.on('chat:reactions-updated', (data: { messageId: string; reactions: Array<{ emoji: string; count: number; users: string[] }> }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m))
      );
    });

    s.on('chat:pin-updated', (data: { messageId: string; pinned: boolean; pinnedAt: string | null }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId ? { ...m, pinned: data.pinned, pinnedAt: data.pinnedAt } : m
        )
      );
    });

    s.on('chat:typing', (data: TypingUser & { isTyping: boolean }) => {
      if (data.isTyping) {
        setTypingUsers((prev) => {
          if (prev.find((u) => u.userId === data.userId)) return prev;
          return [...prev, { userId: data.userId, username: data.username }];
        });
      } else {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      }
    });

    // Full list — set directly (infrequent, on demand)
    s.on('users:online-list', (data: { users: OnlineUser[] }) => {
      setOnlineUsers(data.users);
      setOnlineCount(data.users.length);
    });

    // Incremental updates — throttled via pending queue
    s.on('users:online-count', (data: { count: number }) => {
      pendingCountRef.current = data.count;
    });

    s.on('user:online', (user: OnlineUser) => {
      pendingPresenceRef.current.push({ op: 'add', user });
    });

    s.on('user:offline', (data: { userId: string }) => {
      pendingPresenceRef.current.push({ op: 'remove', userId: data.userId });
    });

    s.on('user:updated', (data: Omit<OnlineUser, 'badges' | 'clanTag'>) => {
      pendingPresenceRef.current.push({ op: 'update', user: data });
    });

    s.on('doodle:spectate-sessions', (data: { sessions: DoodleSpectateSession[] }) => {
      setDoodleSpectateSessions(Array.isArray(data.sessions) ? data.sessions : []);
    });

    s.on('chess:spectate-sessions', (data: { sessions: ChessSpectateSession[] }) => {
      setChessSpectateSessions(Array.isArray(data.sessions) ? data.sessions : []);
    });

    s.on('economy:balance-update', (data: { userId: string; aura: number; money: number }) => {
      if (data.userId === user.id) updateBalance(data.aura, data.money);
    });

    return () => {
      s.off('connect', handleConnect);
      s.off('chat:history');
      s.off('chat:message');
      s.off('chat:muted');
      s.off('chat:blocked');
      s.off('chat:message-deleted');
      s.off('chat:reactions-updated');
      s.off('chat:pin-updated');
      s.off('chat:typing');
      s.off('users:online-list');
      s.off('users:online-count');
      s.off('user:online');
      s.off('user:offline');
      s.off('user:updated');
      s.off('doodle:spectate-sessions');
      s.off('chess:spectate-sessions');
      s.off('economy:balance-update');
    };
  }, [user?.id, user?.username]);

  const sendMessage = useCallback(
    (message?: string, replyToId?: string | null, imageUrl?: string | null) => {
      if (user) chatEvents.sendMessage(user.id, message, replyToId, imageUrl);
    },
    [user?.id]
  );

  const reactToMessage = useCallback(
    (messageId: string, emoji: string) => {
      if (user) chatEvents.react(user.id, messageId, emoji);
    },
    [user?.id]
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (user) chatEvents.setTyping(user.id, isTyping);
    },
    [user?.id]
  );

  const deleteMessage = useCallback((messageId: string) => {
    if (user) getSocket()?.emit('chat:delete-message', { messageId, adminId: user.id });
  }, [user?.id]);

  const pinMessage = useCallback(
    (messageId: string, pinned: boolean) => {
      if (user) chatEvents.pinMessage(user.id, messageId, pinned);
    },
    [user?.id]
  );

  const requestOnlineUsers = useCallback(() => {
    getSocket()?.emit('chat:request-online-users');
  }, []);

  const requestDoodleSpectateSessions = useCallback(() => {
    getSocket()?.emit('doodle:spectate-list-request');
  }, []);

  const requestChessSpectateSessions = useCallback(() => {
    getSocket()?.emit('chess:spectate-list-request');
  }, []);

  const value = useMemo(
    () => ({
      messages,
      onlineUsers,
      onlineCount,
      typingUsers,
      doodleSpectateSessions,
      chessSpectateSessions,
      sendMessage,
      reactToMessage,
      setTyping,
      deleteMessage,
      pinMessage,
      requestOnlineUsers,
      requestDoodleSpectateSessions,
      requestChessSpectateSessions,
    }),
    [
      messages,
      onlineUsers,
      onlineCount,
      typingUsers,
      doodleSpectateSessions,
      chessSpectateSessions,
      sendMessage,
      reactToMessage,
      setTyping,
      deleteMessage,
      pinMessage,
      requestOnlineUsers,
      requestDoodleSpectateSessions,
      requestChessSpectateSessions,
    ]
  );

  return <ChatSocketContext.Provider value={value}>{children}</ChatSocketContext.Provider>;
}

export function useChatSocket() {
  const ctx = useContext(ChatSocketContext);
  if (!ctx) throw new Error('useChatSocket must be used within ChatSocketProvider');
  return ctx;
}

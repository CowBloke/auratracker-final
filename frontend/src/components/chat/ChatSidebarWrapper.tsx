import { createContext, useContext, useState, useEffect, useRef, ReactNode, Dispatch, SetStateAction } from 'react';
import { SidebarProvider as ShadcnSidebarProvider } from '@/components/ui/sidebar';
import ChatSidebar from './ChatSidebar';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';

const CHAT_SIDEBAR_STORAGE_KEY = 'chat-sidebar-open';
const CHAT_LAST_READ_STORAGE_KEY = 'global-chat-last-read';

type StoredLastRead = {
  messageId: string | null;
  timestamp: string | null;
};

const readLastReadState = (): StoredLastRead => {
  if (typeof window === 'undefined') {
    return { messageId: null, timestamp: null };
  }

  try {
    const raw = localStorage.getItem(CHAT_LAST_READ_STORAGE_KEY);
    if (!raw) return { messageId: null, timestamp: null };

    const parsed = JSON.parse(raw) as Partial<StoredLastRead>;
    return {
      messageId: typeof parsed.messageId === 'string' ? parsed.messageId : null,
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : null,
    };
  } catch {
    return { messageId: null, timestamp: null };
  }
};

const persistLastReadState = (value: StoredLastRead) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CHAT_LAST_READ_STORAGE_KEY, JSON.stringify(value));
};

// Contexte partagé pour l'état de la sidebar de chat
const ChatSidebarContext = createContext<{
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  unreadCount: number;
} | null>(null);

export function useChatSidebar() {
  const context = useContext(ChatSidebarContext);
  if (!context) {
    throw new Error('useChatSidebar must be used within ChatSidebarProvider');
  }
  return context;
}

export function ChatSidebarProvider({ children }: { children: ReactNode }) {
  const { messages } = useSocket();
  const { user } = useAuth();
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(CHAT_SIDEBAR_STORAGE_KEY);
    return stored !== null ? stored === 'true' : false;
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const hasInitializedUnreadRef = useRef(false);
  const lastReadRef = useRef<StoredLastRead>(readLastReadState());

  useEffect(() => {
    localStorage.setItem(CHAT_SIDEBAR_STORAGE_KEY, String(open));
  }, [open]);

  useEffect(() => {
    if (!user) {
      hasInitializedUnreadRef.current = false;
      lastReadRef.current = { messageId: null, timestamp: null };
      setUnreadCount(0);
      return;
    }

    if (messages.length === 0) {
      setUnreadCount(0);
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const markCurrentMessagesAsRead = () => {
      const nextLastRead = {
        messageId: lastMessage.id,
        timestamp: lastMessage.timestamp,
      };
      lastReadRef.current = nextLastRead;
      persistLastReadState(nextLastRead);
      setUnreadCount(0);
    };

    if (!hasInitializedUnreadRef.current) {
      hasInitializedUnreadRef.current = true;

      if (!lastReadRef.current.messageId && !lastReadRef.current.timestamp) {
        markCurrentMessagesAsRead();
        return;
      }
    }

    if (open) {
      markCurrentMessagesAsRead();
      return;
    }

    const { messageId: lastReadMessageId, timestamp: lastReadTimestamp } = lastReadRef.current;
    const lastReadIndex = lastReadMessageId
      ? messages.findIndex((message) => message.id === lastReadMessageId)
      : -1;

    const unreadMessages =
      lastReadIndex >= 0
        ? messages.slice(lastReadIndex + 1)
        : messages.filter((message) => {
            if (!lastReadTimestamp) return false;
            return new Date(message.timestamp).getTime() > new Date(lastReadTimestamp).getTime();
          });

    setUnreadCount(unreadMessages.filter((message) => message.userId !== user.id).length);
  }, [messages, open, user]);

  return (
    <ChatSidebarContext.Provider value={{ open, setOpen, unreadCount }}>
      {children}
    </ChatSidebarContext.Provider>
  );
}

export function ChatSidebarWrapper() {
  const { open, setOpen } = useChatSidebar();

  return (
    <ShadcnSidebarProvider className="!w-auto" open={open} onOpenChange={setOpen}>
      <ChatSidebar />
    </ShadcnSidebarProvider>
  );
}

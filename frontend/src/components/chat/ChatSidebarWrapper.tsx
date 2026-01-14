import { createContext, useContext, useState, useEffect, useRef, ReactNode, Dispatch, SetStateAction } from 'react';
import { SidebarProvider as ShadcnSidebarProvider } from '@/components/ui/sidebar';
import ChatSidebar from './ChatSidebar';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';

const CHAT_SIDEBAR_STORAGE_KEY = 'chat-sidebar-open';

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
  const lastMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem(CHAT_SIDEBAR_STORAGE_KEY, String(open));
  }, [open]);

  useEffect(() => {
    if (open) {
      setUnreadCount(0);
      if (messages.length > 0) {
        lastMessageIdRef.current = messages[messages.length - 1].id;
      }
    }
  }, [open, messages]);

  useEffect(() => {
    if (!open && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.id !== lastMessageIdRef.current && lastMessage.userId !== user?.id) {
        setUnreadCount((prev) => prev + 1);
        lastMessageIdRef.current = lastMessage.id;
      }
    }
  }, [messages, open, user?.id]);

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

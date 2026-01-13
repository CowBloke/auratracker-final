import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SidebarProvider as ShadcnSidebarProvider } from '@/components/ui/sidebar';
import ChatSidebar from './ChatSidebar';
import { ChatSidebarTrigger } from './ChatSidebarTrigger';

const CHAT_SIDEBAR_STORAGE_KEY = 'chat-sidebar-open';

// Contexte partagé pour l'état de la sidebar de chat
const ChatSidebarContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

export function useChatSidebar() {
  const context = useContext(ChatSidebarContext);
  if (!context) {
    throw new Error('useChatSidebar must be used within ChatSidebarProvider');
  }
  return context;
}

function ChatSidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(CHAT_SIDEBAR_STORAGE_KEY);
    return stored !== null ? stored === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem(CHAT_SIDEBAR_STORAGE_KEY, String(open));
  }, [open]);

  return (
    <ChatSidebarContext.Provider value={{ open, setOpen }}>
      <ShadcnSidebarProvider
        className="!w-auto"
        open={open}
        onOpenChange={setOpen}
      >
        {children}
      </ShadcnSidebarProvider>
    </ChatSidebarContext.Provider>
  );
}

export function ChatSidebarWrapper() {
  return (
    <ChatSidebarProvider>
      <ChatSidebar />
      <FloatingChatTrigger />
    </ChatSidebarProvider>
  );
}

function FloatingChatTrigger() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <ChatSidebarTrigger />
    </div>
  );
}

export function ChatSidebarTriggerWrapper() {
  return (
    <ChatSidebarProvider>
      <ChatSidebarTrigger />
    </ChatSidebarProvider>
  );
}

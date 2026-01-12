import { createContext, useContext, useState, ReactNode } from 'react';
import { SidebarProvider as ShadcnSidebarProvider } from '@/components/ui/sidebar';
import ChatSidebar from './ChatSidebar';
import { ChatSidebarTrigger } from './ChatSidebarTrigger';

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
  const [open, setOpen] = useState(true);

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
    </ChatSidebarProvider>
  );
}

export function ChatSidebarTriggerWrapper() {
  return (
    <ChatSidebarProvider>
      <ChatSidebarTrigger />
    </ChatSidebarProvider>
  );
}

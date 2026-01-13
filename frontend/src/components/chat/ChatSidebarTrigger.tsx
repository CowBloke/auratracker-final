import { MessageCircle } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { useSocket } from '@/contexts/SocketContext';

export function ChatSidebarTrigger() {
  const { toggleSidebar } = useSidebar();
  const { onlineUsers } = useSocket();

  return (
    <button
      data-sidebar="trigger"
      onClick={toggleSidebar}
      title="Toggle Chat"
      className="h-12 w-12 flex items-center justify-center bg-background border border-border/40 rounded-full shadow-lg hover:bg-muted transition-colors relative"
    >
      <MessageCircle className="h-5 w-5 text-muted-foreground" />
      {onlineUsers.length > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-[10px] font-medium bg-green-500 text-white rounded-full">
          {onlineUsers.length}
        </span>
      )}
      <span className="sr-only">Toggle Chat Sidebar</span>
    </button>
  );
}

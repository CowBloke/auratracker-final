import { MessageCircle } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { useChatSidebar } from './ChatSidebarWrapper';

export function ChatSidebarTrigger() {
  const { toggleSidebar } = useSidebar();
  const { unreadCount } = useChatSidebar();

  return (
    <button
      data-sidebar="trigger"
      onClick={toggleSidebar}
      title="Toggle Chat"
      className="h-12 w-12 flex items-center justify-center bg-background border border-border/40 rounded-full shadow-lg hover:bg-muted transition-colors relative"
    >
      <MessageCircle className="h-5 w-5 text-muted-foreground" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-[10px] font-medium bg-red-500 text-white rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      <span className="sr-only">Toggle Chat Sidebar</span>
    </button>
  );
}

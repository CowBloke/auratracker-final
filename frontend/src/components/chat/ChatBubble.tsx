import { MessageCircle } from 'lucide-react';
import { useChatSidebar } from './ChatSidebarWrapper';

export default function ChatBubble() {
  const { setOpen, unreadCount } = useChatSidebar();

  return (
    <button
        onClick={() => setOpen((prev) => !prev)}
        title="Toggle Chat"
        className="relative flex items-center justify-center w-14 h-14 bg-background border border-border rounded-full shadow-lg hover:bg-muted/50 transition-colors"
      >
        <MessageCircle className="h-7 w-7" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1.5 flex items-center justify-center text-xs font-bold bg-red-500 text-white rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}

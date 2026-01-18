import { MessageCircle } from 'lucide-react';
import { useChatSidebar } from './ChatSidebarWrapper';

export default function ChatBubble() {
  const { setOpen, unreadCount } = useChatSidebar();

  return (
    <button
      onClick={() => setOpen((prev) => !prev)}
      title="Toggle Chat"
      className="relative flex items-center justify-center transition-colors hover:opacity-80"
    >
      <MessageCircle className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center text-[10px] font-medium rounded-full bg-red-500 text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}

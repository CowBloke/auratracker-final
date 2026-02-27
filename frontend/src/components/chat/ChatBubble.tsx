import { MessageCircle } from 'lucide-react';
import { useChatSidebar } from './ChatSidebarWrapper';
import { Button } from '@/components/ui/button';

export default function ChatBubble() {
  const { setOpen, unreadCount } = useChatSidebar();

  return (
    <Button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      title="Toggle Chat"
      variant="outline"
      size="icon"
      className="relative h-11 w-11 rounded-full shadow-sm"
    >
      <MessageCircle className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center text-[10px] font-medium rounded-full bg-red-500 text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  );
}

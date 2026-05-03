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
      className="relative rounded-full shadow-sm"
    >
      <MessageCircle className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1.5 flex items-center justify-center text-[11px] font-semibold tabular-nums rounded-full border-2 border-background bg-red-500 text-white shadow-sm">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  );
}

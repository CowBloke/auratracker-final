import { PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useChatSidebar } from './ChatSidebarWrapper';

export function ChatSidebarTrigger({ className }: { className?: string }) {
  const { setOpen, unreadCount } = useChatSidebar();

  return (
    <Button
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      onClick={() => setOpen((prev) => !prev)}
      title="Toggle Chat"
      className={cn("relative h-7 w-7", className)}
    >
      <PanelRight className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center text-[9px] font-medium bg-red-500 text-white rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      <span className="sr-only">Toggle Chat Sidebar</span>
    </Button>
  );
}

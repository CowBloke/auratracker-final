import { MessageCircle } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';

export function ChatSidebarTrigger() {
  const { toggleSidebar } = useSidebar();
  
  return (
    <button
      data-sidebar="trigger"
      onClick={toggleSidebar}
      title="Toggle Chat"
      className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
    >
      <MessageCircle className="h-4 w-4" />
      <span className="sr-only">Toggle Chat Sidebar</span>
    </button>
  );
}

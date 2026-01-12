import { PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export function ChatSidebarTrigger() {
  const { toggleSidebar } = useSidebar();
  
  return (
    <Button
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7")}
      onClick={toggleSidebar}
      title="Toggle Chat"
    >
      <PanelRight />
      <span className="sr-only">Toggle Chat Sidebar</span>
    </Button>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  MessageCircle,
  Send,
  Users,
  Circle,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type TimeoutRef = ReturnType<typeof setTimeout> | null;

export default function ChatSidebar() {
  const { user } = useAuth();
  const { messages, onlineUsers, typingUsers, sendMessage, setTyping } = useSocket();
  const [input, setInput] = useState('');
  const [showUsers, setShowUsers] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<TimeoutRef>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Suivre les messages non lus
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Si c'est un nouveau message (pas déjà vu) et que ce n'est pas notre propre message
      if (lastMessage.id !== lastMessageIdRef.current && lastMessage.userId !== user?.id) {
        setUnreadCount((prev) => prev + 1);
        lastMessageIdRef.current = lastMessage.id;
      }
    }
  }, [messages, user?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input.trim());
      setInput('');
      setTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setTyping(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 2000);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Sidebar variant="inset" side="right" collapsible="offcanvas" className="border-t">
      <SidebarRail />
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="justify-start">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageCircle className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Global Chat</span>
                <span className="truncate text-xs">
                  {onlineUsers.length} online
                </span>
              </div>
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-auto min-w-[20px] h-5 rounded-full px-1"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="flex flex-col">
        {/* Messages */}
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 px-2">
            <div className="space-y-3 py-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    msg.userId === user?.id && 'flex-row-reverse'
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] border rounded-lg px-3 py-2",
                      msg.userId === user?.id
                        ? 'bg-primary/20 border-primary/30'
                        : 'bg-muted border-border'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          msg.userId === user?.id
                            ? 'text-primary-foreground'
                            : 'text-accent-cyan'
                        )}
                      >
                        {msg.username}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground break-words">{msg.message}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t">
              {typingUsers.map((u) => u.username).join(', ')}{' '}
              {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-2 border-t">
            <div className="flex gap-2">
              <Input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className="flex-1 h-9 text-sm"
              />
              <Button
                type="submit"
                disabled={!input.trim()}
                size="icon"
                className="h-9 w-9"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </SidebarContent>
      <SidebarFooter>
        <Collapsible open={showUsers} onOpenChange={setShowUsers}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton className="w-full justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Online Users</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {onlineUsers.length}
              </Badge>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="h-48">
              <div className="p-2 space-y-1">
                {onlineUsers.map((u) => (
                  <div
                    key={u.userId}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-sidebar-accent text-sm"
                  >
                    <Circle className="w-2 h-2 fill-accent-green text-accent-green" />
                    <span className="text-sidebar-foreground truncate">
                      {u.username}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      </SidebarFooter>
    </Sidebar>
  );
}

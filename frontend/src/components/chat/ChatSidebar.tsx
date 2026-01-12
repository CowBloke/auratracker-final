import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { Send, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenuButton,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type TimeoutRef = ReturnType<typeof setTimeout> | null;

export default function ChatSidebar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { messages, onlineUsers, typingUsers, sendMessage, setTyping } = useSocket();
  const [input, setInput] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<TimeoutRef>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
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
    <Sidebar variant="inset" side="right" collapsible="offcanvas" className="border-l border-border/40">
      <SidebarRail />
      <SidebarHeader className="border-b border-border/40">
        <Collapsible open={showUsers} onOpenChange={setShowUsers}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton size="lg" className="w-full justify-between">
              <span className="text-sm text-muted-foreground">en ligne</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">{onlineUsers.length}</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-foreground text-background">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {showUsers ? (
                  <ChevronUp className="w-3 h-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="h-32">
              <div className="px-3 py-2 space-y-1">
                {onlineUsers.map((u) => (
                  <button
                    key={u.userId}
                    onClick={() => navigate(`/profile/${u.userId}`)}
                    className="flex items-center gap-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                  >
                    <div className="w-1 h-1 rounded-full bg-foreground/50" />
                    <span className="truncate">{u.username}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      </SidebarHeader>
      
      <SidebarContent className="flex flex-col">
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 px-3">
            <div className="space-y-3 py-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col",
                    msg.userId === user?.id && 'items-end'
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[90%] px-3 py-2",
                      msg.userId === user?.id
                        ? 'bg-foreground/10'
                        : 'bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => navigate(`/profile/${msg.userId}`)}
                        className={cn(
                          "text-xs font-medium hover:underline cursor-pointer",
                          msg.userId === user?.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {msg.username}
                      </button>
                      <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm break-words">{msg.message}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {typingUsers.length > 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border/40">
              {typingUsers.map((u) => u.username).join(', ')} écrit...
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-3 border-t border-border/40">
            <div className="flex gap-2">
              <Input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Message..."
                className="flex-1 h-9 text-sm bg-transparent border-border/50"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="h-9 w-9 flex items-center justify-center border border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-30 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>
      </SidebarContent>
      
    </Sidebar>
  );
}

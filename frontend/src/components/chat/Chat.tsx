import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { Send, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getPageMeta } from './presence';

type TimeoutRef = ReturnType<typeof setTimeout> | null;

interface ChatProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function Chat({ isOpen, onToggle }: ChatProps) {
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
    if (isOpen) {
      setUnreadCount(0);
      if (messages.length > 0) {
        lastMessageIdRef.current = messages[messages.length - 1].id;
      }
    }
  }, [isOpen, messages]);

  useEffect(() => {
    if (!isOpen && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.id !== lastMessageIdRef.current && lastMessage.userId !== user?.id) {
        setUnreadCount((prev) => prev + 1);
        lastMessageIdRef.current = lastMessage.id;
      }
    }
  }, [messages, isOpen, user?.id]);

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
    <div
      className={cn(
        "fixed bottom-0 left-64 right-0 bg-background border-t border-border/40 transition-all duration-300 z-40",
        isOpen ? 'h-72' : 'h-12'
      )}
    >
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <button className="w-full h-12 px-6 flex items-center justify-between text-sm hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">chat</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {onlineUsers.length} en ligne
              </span>
              {!isOpen && unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-foreground text-background">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="flex h-[calc(100%-3rem)]">
          {/* Messages */}
          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-3 py-3">
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
                        "max-w-[70%] px-3 py-2 rounded-lg",
                        msg.userId === user?.id
                          ? 'bg-foreground/10'
                          : 'bg-muted'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {msg.profilePicture && (
                          <img 
                            src={msg.profilePicture} 
                            alt={msg.username}
                            className="w-5 h-5 rounded-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <button
                          onClick={() => navigate(`/profile/${msg.userId}`)}
                          className={cn(
                            "text-xs font-medium hover:underline cursor-pointer",
                            !msg.usernameColor && (msg.userId === user?.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')
                          )}
                          style={msg.usernameColor ? { color: msg.usernameColor } : undefined}
                        >
                          {msg.username}
                        </button>
                        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {typingUsers.length > 0 && (
              <div className="px-6 py-2 text-xs text-muted-foreground">
                {typingUsers.map((u) => u.username).join(', ')} écrit...
              </div>
            )}

            <form onSubmit={handleSubmit} className="px-6 py-3 border-t border-border/40">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Message..."
                  className="flex-1 h-9 bg-transparent border-border/50"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="h-9 w-9 flex items-center justify-center border border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-30 transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Online Users */}
          <div className="w-40 border-l border-border/40">
            <Collapsible open={showUsers} onOpenChange={setShowUsers}>
              <CollapsibleTrigger asChild>
                <button className="w-full px-4 py-3 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <span>en ligne</span>
                  <span className="tabular-nums">{onlineUsers.length}</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="h-40">
                  <div className="px-4 space-y-1">
                    {onlineUsers.map((u) => (
                      <button
                        key={u.userId}
                        onClick={() => navigate(`/profile/${u.userId}`)}
                        className="flex items-center gap-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                      >
                        <div className="w-1 h-1 rounded-full bg-foreground/50" />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate">{u.username}</span>
                          {(() => {
                            const pageMeta = getPageMeta(u.currentPage);
                            const PageIcon = pageMeta.icon;
                            return (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                                <PageIcon className="h-3 w-3" />
                                <span className="truncate">{pageMeta.label}</span>
                              </span>
                            );
                          })()}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  MessageCircle,
  Send,
  ChevronDown,
  ChevronUp,
  Users,
  Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type TimeoutRef = ReturnType<typeof setTimeout> | null;

interface ChatProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function Chat({ isOpen, onToggle }: ChatProps) {
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

  // Réinitialiser le compteur quand le chat s'ouvre
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      if (messages.length > 0) {
        lastMessageIdRef.current = messages[messages.length - 1].id;
      }
    }
  }, [isOpen, messages]);

  // Suivre les messages non lus quand le chat est fermé
  useEffect(() => {
    if (!isOpen && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Si c'est un nouveau message (pas déjà vu) et que ce n'est pas notre propre message
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
        "fixed bottom-0 left-64 right-0 bg-card border-t transition-all duration-300 z-40",
        isOpen ? 'h-80' : 'h-14'
      )}
    >
      {/* Header */}
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full h-14 px-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <MessageCircle className="w-5 h-5 text-primary" />
                {!isOpen && unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full px-1"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </div>
              <span className="font-medium">Global Chat</span>
              <Badge variant="outline" className="bg-primary/20 text-primary-foreground">
                {onlineUsers.length} online
              </Badge>
            </div>
            {isOpen ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="flex h-[calc(100%-3.5rem)]">
          {/* Messages */}
          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
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
                        "max-w-[70%] border rounded-lg px-4 py-2",
                        msg.userId === user?.id
                          ? 'bg-primary/20 border-primary/30'
                          : 'bg-muted border-border'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            msg.userId === user?.id
                              ? 'text-primary-foreground'
                              : 'text-accent-cyan'
                          )}
                        >
                          {msg.username}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <p className="text-foreground">{msg.message}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                {typingUsers.map((u) => u.username).join(', ')}{' '}
                {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={!input.trim()}
                  size="icon"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </form>
          </div>

          {/* Online Users Sidebar */}
          <div className="w-48 border-l bg-muted/50">
            <Collapsible open={showUsers} onOpenChange={setShowUsers}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Online</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{onlineUsers.length}</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="h-[calc(100vh-20rem)]">
                  <div className="p-2 space-y-1">
                    {onlineUsers.map((u) => (
                      <div
                        key={u.userId}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent"
                      >
                        <Circle className="w-2 h-2 fill-accent-green text-accent-green" />
                        <span className="text-sm text-foreground truncate">
                          {u.username}
                        </span>
                      </div>
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

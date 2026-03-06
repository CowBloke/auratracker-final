import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { Send, ChevronDown, ChevronUp, Trash2, MoreHorizontal, Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { getPageMeta } from './presence';
import { resolveImageUrl } from '@/lib/images';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UsernameDisplay } from '@/components/ui/username-display';

type TimeoutRef = ReturnType<typeof setTimeout> | null;

interface ChatProps {
  isOpen: boolean;
  onToggle: () => void;
}

const REACTION_OPTIONS = [
  { value: '❤️', label: 'Coeur' },
  { value: '👍', label: 'Like' },
  { value: '😂', label: 'Haha' },
  { value: '😮', label: 'Wow' },
  { value: '😢', label: 'Triste' },
  { value: '😡', label: 'Grr' },
];

export default function Chat({ isOpen, onToggle }: ChatProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { messages, onlineUsers, onlineCount, requestOnlineUsers, typingUsers, sendMessage, setTyping, deleteMessage, reactToMessage, pinMessage } = useSocket();
  const [input, setInput] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<TimeoutRef>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.pinned && b.pinned) {
        const aTime = a.pinnedAt ?? a.timestamp;
        const bTime = b.pinnedAt ?? b.timestamp;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      }
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }, [messages]);

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
          <Button variant="ghost" className="h-12 w-full justify-between rounded-none px-6 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">chat</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {onlineCount} en ligne
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
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="flex h-[calc(100%-3rem)]">
          {/* Messages */}
          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-3 py-3">
                {sortedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col group",
                      msg.userId === user?.id && 'items-end'
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[70%] px-3 py-2 rounded-lg relative",
                        msg.userId === user?.id
                          ? 'bg-foreground/10'
                          : 'bg-muted'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {msg.profilePicture && (
                          <img
                            src={resolveImageUrl(msg.profilePicture)}
                            alt={msg.username}
                            className="w-5 h-5 rounded-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <Button
                          type="button"
                          onClick={() => navigate(`/profile/${msg.userId}`)}
                          variant="link"
                          className={cn(
                            "h-auto px-0 py-0 text-xs font-medium",
                            !msg.usernameColor && (msg.userId === user?.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')
                          )}
                        >
                          <UsernameDisplay username={msg.username} usernameColor={msg.usernameColor} />
                        </Button>
                        {(msg.isTopMoney || msg.isTopAura) && (
                          <div className="flex items-center gap-1">
                            {msg.isTopMoney && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-border/60 px-1.5 text-[9px] font-semibold text-muted-foreground cursor-help">
                                      ARG
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <p className="font-medium">Top 5 Argent</p>
                                      <p className="text-xs text-muted-foreground">
                                        Ce joueur fait partie des 5 joueurs avec le plus d'argent
                                      </p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {msg.isTopAura && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-border/60 px-1.5 text-[9px] font-semibold text-muted-foreground cursor-help">
                                      AUR
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <p className="font-medium">Top 5 Aura</p>
                                      <p className="text-xs text-muted-foreground">
                                        Ce joueur fait partie des 5 joueurs avec le plus d'aura
                                      </p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        )}
                        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                          {formatTime(msg.timestamp)}
                        </span>
                        {msg.pinned && (
                          <Pin className="h-3 w-3 text-muted-foreground" />
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/70 hover:text-foreground"
                                title="Réagir"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align={msg.userId === user?.id ? 'end' : 'start'}
                              className="flex items-center gap-1 p-2"
                            >
                              {REACTION_OPTIONS.map((reaction) => (
                                <Button
                                  key={reaction.value}
                                  type="button"
                                  onClick={() => reactToMessage(msg.id, reaction.value)}
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title={reaction.label}
                                >
                                  <span className="text-base">{reaction.value}</span>
                                </Button>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {user?.isAdmin && (
                            <>
                              <Button
                                type="button"
                                onClick={() => pinMessage(msg.id, !msg.pinned)}
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 transition-opacity text-muted-foreground/70 group-hover:opacity-100 hover:text-foreground"
                                title={msg.pinned ? 'Désépingler' : 'Épingler'}
                              >
                                {msg.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                              </Button>
                              <Button
                                type="button"
                                onClick={() => deleteMessage(msg.id)}
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 transition-opacity text-destructive group-hover:opacity-100 hover:text-destructive/80"
                                title="Delete message"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                      {msg.reactions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {msg.reactions.map((reaction) => (
                            <span
                              key={`${msg.id}-${reaction.emoji}`}
                              className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                            >
                              <span>{reaction.emoji}</span>
                              <span className="tabular-nums">{reaction.count}</span>
                            </span>
                          ))}
                        </div>
                      )}
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
                <Button
                  type="submit"
                  disabled={!input.trim()}
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>

          {/* Online Users */}
          <div className="w-40 border-l border-border/40">
            <Collapsible open={showUsers} onOpenChange={(open) => {
              setShowUsers(open);
              if (open) requestOnlineUsers();
            }}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="h-auto w-full justify-between rounded-none px-4 py-3 text-xs text-muted-foreground">
                  <span>en ligne</span>
                  <span className="tabular-nums">{onlineCount}</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="h-40">
                  <div className="px-4 space-y-1">
                    {onlineUsers.map((u) => (
                      <Button
                        key={u.userId}
                        type="button"
                        onClick={() => navigate(`/profile/${u.userId}`)}
                        variant="ghost"
                        className="h-auto w-full justify-start gap-2 px-0 py-1 text-left text-xs text-muted-foreground"
                      >
                        <div className="w-1 h-1 rounded-full bg-foreground/50" />
                        <div className="min-w-0 flex-1">
                          <UsernameDisplay username={u.username} className="block" />
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
                      </Button>
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

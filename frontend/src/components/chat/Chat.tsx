import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatSocket } from '../../contexts/ChatSocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatures } from '../../contexts/FeaturesContext';
import { Send, ChevronDown, ChevronUp, Trash2, MoreHorizontal, Pin, PinOff, Monitor, BarChart3, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { getPageMeta } from './presence';
import { resolveImageUrl } from '@/lib/images';
import { UsernameDisplay } from '@/components/ui/username-display';
import { UserBadges } from '@/components/badges/UserBadges';
import { toClanTagData } from '@/components/clans/ClanTag';
import { PlayerHoverCard } from '@/components/ui/player-hover-card';

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

const getReactionUsersLabel = (users: string[]) => {
  if (users.length === 0) return 'Aucune reaction';
  return users.length === 1 ? `${users[0]} a reagi` : `${users.join(', ')} ont reagi`;
};

export default function Chat({ isOpen, onToggle }: ChatProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { maintenanceStatus } = useFeatures();
  const {
    messages,
    activePoll,
    onlineUsers,
    onlineCount,
    requestOnlineUsers,
    typingUsers,
    sendMessage,
    setTyping,
    deleteMessage,
    reactToMessage,
    pinMessage,
    createPoll,
    votePoll,
    closePoll,
  } = useChatSocket();
  const [input, setInput] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionsText, setPollOptionsText] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  const typingTimeoutRef = useRef<TimeoutRef>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const unreadMessageRef = useRef<HTMLDivElement>(null);
  const canViewConnectedStatus = Boolean(user?.isAdmin || user?.isSuperAdmin);
  const chatBlockedForUser = Boolean(
    maintenanceStatus.chatBlocked &&
    !user?.isAdmin &&
    !user?.isSuperAdmin
  );
  const chatBlockedLabel = maintenanceStatus.chatBlockMessage || 'Le chat est temporairement bloque.';
  const chatScheduleLabel = maintenanceStatus.chatAutoBlockEnabled &&
    maintenanceStatus.chatAutoBlockStart &&
    maintenanceStatus.chatAutoBlockEnd
    ? `Blocage auto: ${maintenanceStatus.chatAutoBlockStart} -> ${maintenanceStatus.chatAutoBlockEnd} (${maintenanceStatus.chatBlockTimezone})`
    : null;
  const pinnedMessages = useMemo(() => {
    return messages
      .filter((message) => message.pinned)
      .sort((a, b) => {
        const aTime = a.pinnedAt ?? a.timestamp;
        const bTime = b.pinnedAt ?? b.timestamp;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
  }, [messages]);
  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [messages]);

  const pollOptionsPreview = useMemo(() => {
    return pollOptionsText
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
  }, [pollOptionsText]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1].id;
        setLastReadMessageId(lastMsg);
        lastMessageIdRef.current = lastMsg;
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
    if (chatBlockedForUser) {
      return;
    }
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
    if (chatBlockedForUser) {
      return;
    }
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

  const scrollToUnread = () => {
    unreadMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleCreatePoll = () => {
    const options = pollOptionsText
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
    createPoll(pollQuestion.trim(), options);
    setPollQuestion('');
    setPollOptionsText('');
  };

  const getPollOptionPercent = (votes: number) => {
    if (!activePoll || activePoll.totalVotes === 0) return 0;
    return Math.round((votes / activePoll.totalVotes) * 100);
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
            {pinnedMessages.length > 0 && (
              <div className="border-b border-border/40 bg-muted/30 px-6 py-3">
                <div className="space-y-2">
                  {pinnedMessages.map((msg) => (
                    <div
                      key={`pinned-${msg.id}`}
                      className="rounded-lg border border-border/50 bg-background/80 px-3 py-2"
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Pin className="h-3 w-3" />
                        <span className="font-medium text-foreground">{msg.username}</span>
                        <span>{formatTime(msg.timestamp)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {msg.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activePoll && (
              <div className="border-b border-border/40 bg-muted/20 px-6 py-3">
                <div className="rounded-lg border border-border/60 bg-background/90 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <BarChart3 className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">Sondage actif</span>
                      <span>par {activePoll.createdByUsername}</span>
                      <span>• {activePoll.totalVotes} vote{activePoll.totalVotes > 1 ? 's' : ''}</span>
                    </div>
                    {(user?.isAdmin || user?.isSuperAdmin) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        onClick={() => closePoll(activePoll.id)}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Cloturer
                      </Button>
                    )}
                  </div>
                  <p className="mb-3 text-sm font-medium text-foreground">{activePoll.question}</p>
                  <div className="space-y-2">
                    {activePoll.options.map((option) => {
                      const percent = getPollOptionPercent(option.votes);
                      const isSelected = activePoll.userVoteOptionId === option.id;
                      return (
                        <Button
                          key={option.id}
                          type="button"
                          variant={isSelected ? 'secondary' : 'outline'}
                          className="relative h-auto w-full justify-between overflow-hidden px-3 py-2 text-left"
                          onClick={() => votePoll(activePoll.id, option.id)}
                        >
                          <span
                            className="pointer-events-none absolute inset-y-0 left-0 bg-foreground/10"
                            style={{ width: `${percent}%` }}
                            aria-hidden="true"
                          />
                          <span className="relative z-10 truncate text-xs">{option.text}</span>
                          <span className="relative z-10 ml-3 shrink-0 text-[11px] text-muted-foreground tabular-nums">
                            {option.votes} ({percent}%)
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-3 py-3">
                {[...sortedMessages].reverse().map((msg, index) => {
                  const isLastRead = msg.id === lastReadMessageId;
                  const nextMsg = [...sortedMessages].reverse()[index + 1];
                  const showSeparator = isLastRead && nextMsg;
                  
                  return (
                    <div key={msg.id}>
                      <div
                        className={cn(
                          "flex flex-col group",
                          msg.userId === user?.id && 'items-end'
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] min-w-0 px-3 py-2 rounded-lg relative",
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
                            <UserBadges
                              badges={msg.badges ?? []}
                              size="xs"
                              tooltipSide="top"
                              showEmptySlots={false}
                            />
                            <PlayerHoverCard
                              userId={msg.userId!}
                              username={msg.username}
                              usernameColor={msg.usernameColor}
                              clanTag={toClanTagData(msg.clanTag)}
                              profilePicture={msg.profilePicture}
                              className={cn(
                                "text-xs font-medium",
                                !msg.usernameColor && (msg.userId === user?.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')
                              )}
                            >
                              <UsernameDisplay username={msg.username} usernameColor={msg.usernameColor} clanTag={toClanTagData(msg.clanTag)} />
                            </PlayerHoverCard>
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
                                    className="h-6 w-6 opacity-0 transition-opacity text-muted-foreground/70 group-hover:opacity-100 hover:text-foreground"
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
                          <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.message}</p>
                          {msg.reactions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {msg.reactions.map((reaction) => (
                                <span
                                  key={`${msg.id}-${reaction.emoji}`}
                                  className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                                  title={getReactionUsersLabel(reaction.users)}
                                  aria-label={getReactionUsersLabel(reaction.users)}
                                >
                                  <span>{reaction.emoji}</span>
                                  <span className="tabular-nums">{reaction.count}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {showSeparator && (
                        <div
                          ref={unreadMessageRef}
                          className="flex items-center gap-3 my-3"
                        >
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent" />
                          <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                            Messages non lus
                          </span>
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {typingUsers.length > 0 && (
              <div className="px-6 py-2 text-xs text-muted-foreground">
                {typingUsers.map((u) => u.username).join(', ')} écrit...
              </div>
            )}

            {lastReadMessageId && lastReadMessageId !== messages[messages.length - 1]?.id && (
              <div className="px-6 py-2 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={scrollToUnread}
                  className="w-full text-xs"
                >
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Aller aux messages non lus
                </Button>
              </div>
            )}

            {chatBlockedForUser && (
              <div className="border-t border-amber-500/30 bg-amber-500/10 px-6 py-3">
                <p className="text-xs font-medium text-amber-200">{chatBlockedLabel}</p>
                {chatScheduleLabel && (
                  <p className="mt-1 text-[11px] text-amber-100/80">{chatScheduleLabel}</p>
                )}
              </div>
            )}

            {(user?.isAdmin || user?.isSuperAdmin) && !activePoll && (
              <div className="border-t border-border/40 bg-muted/20 px-6 py-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Creer un sondage</p>
                <div className="space-y-2">
                  <Input
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="Question du sondage"
                    className="h-8 bg-transparent border-border/50 text-sm"
                    maxLength={180}
                  />
                  <Textarea
                    value={pollOptionsText}
                    onChange={(e) => setPollOptionsText(e.target.value)}
                    placeholder={'Une option par ligne\nExemple:\nOui\nNon'}
                    className="min-h-[72px] resize-none bg-transparent border-border/50 text-xs"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {pollOptionsPreview.length} option{pollOptionsPreview.length > 1 ? 's' : ''} detectee{pollOptionsPreview.length > 1 ? 's' : ''}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleCreatePoll}
                      disabled={pollQuestion.trim().length < 3 || pollOptionsPreview.length < 2}
                      className="h-8"
                    >
                      Lancer le sondage
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="px-6 py-3 border-t border-border/40">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder={chatBlockedForUser ? 'Chat temporairement bloque' : 'Message...'}
                  className="flex-1 h-9 bg-transparent border-border/50"
                  disabled={chatBlockedForUser}
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || chatBlockedForUser}
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
                        <div className="w-1 h-1 rounded-full bg-foreground/50 shrink-0" />
                        {u.badges && u.badges.length > 0 && (
                          <UserBadges badges={u.badges} size="xs" showEmptySlots={false} tooltipSide="left" />
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <PlayerHoverCard userId={u.userId} username={u.username} usernameColor={u.usernameColor} clanTag={toClanTagData(u.clanTag)}>
                            <UsernameDisplay username={u.username} usernameColor={u.usernameColor} className="block" clanTag={toClanTagData(u.clanTag)} />
                          </PlayerHoverCard>
                          </span>
                          {(() => {
                            const pageMeta = getPageMeta(u.currentPage);
                            const PageIcon = pageMeta.icon;
                            return (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                                <PageIcon className="h-3 w-3" />
                                <span className="truncate">{pageMeta.label}</span>
                                {canViewConnectedStatus && (
                                  <>
                                    <Monitor className="ml-1 h-3 w-3" />
                                    <span>{u.isPageActive ? 'sur page' : 'arriere-plan'}</span>
                                  </>
                                )}
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

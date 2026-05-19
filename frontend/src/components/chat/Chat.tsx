import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatSocket } from '../../contexts/ChatSocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatures } from '../../contexts/FeaturesContext';
import { Send, ChevronDown, ChevronUp, Trash2, MoreHorizontal, Pin, PinOff, Monitor, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getPageMeta } from './presence';
import { resolveImageUrl } from '@/lib/images';
import { UsernameDisplay } from '@/components/ui/username-display';
import { UserBadges } from '@/components/badges/UserBadges';
import { toClanTagData } from '@/components/clans/ClanTag';
import { PlayerHoverCard } from '@/components/ui/player-hover-card';
import { t } from '@/lib/i18n';
import { FormattedMessageText } from '@/lib/message-formatting';

type TimeoutRef = ReturnType<typeof setTimeout> | null;

interface ChatProps {
  isOpen: boolean;
  onToggle: () => void;
}

const REACTION_OPTIONS = [
  { value: '❤️', label: t('chat_reaction_heart') },
  { value: '👍', label: t('chat_reaction_like') },
  { value: '😂', label: t('chat_reaction_haha') },
  { value: '😮', label: t('chat_reaction_wow') },
  { value: '😢', label: t('chat_reaction_sad') },
  { value: '😡', label: t('chat_reaction_angry') },
];

const getReactionUsersLabel = (users: string[]) => {
  if (users.length === 0) return t('chat_reactions_none');
  return users.length === 1 ? `${users[0]} ${t('chat_reaction_single_suffix')}` : `${users.join(', ')} ${t('chat_reaction_multiple_suffix')}`;
};

type ReactionDetails = {
  emoji: string;
  count: number;
  users: string[];
  author: string;
  preview: string;
};

export default function Chat({ isOpen, onToggle }: ChatProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { maintenanceStatus } = useFeatures();
  const { messages, onlineUsers, onlineCount, requestOnlineUsers, typingUsers, sendMessage, setTyping, deleteMessage, reactToMessage, pinMessage } = useChatSocket();
  const [input, setInput] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  const [selectedReaction, setSelectedReaction] = useState<ReactionDetails | null>(null);
  const typingTimeoutRef = useRef<TimeoutRef>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const unreadMessageRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const canViewConnectedStatus = Boolean(user?.isAdmin || user?.isSuperAdmin);
  const chatBlockedForUser = Boolean(
    maintenanceStatus.chatBlocked &&
    !user?.isAdmin &&
    !user?.isSuperAdmin
  );
  const chatBlockedLabel = maintenanceStatus.chatBlockMessage || t('chat_blocked_default');
  const chatScheduleLabel = maintenanceStatus.chatAutoBlockEnabled &&
    maintenanceStatus.chatAutoBlockStart &&
    maintenanceStatus.chatAutoBlockEnd
    ? `${t('chat_auto_block_prefix')} ${maintenanceStatus.chatAutoBlockStart} -> ${maintenanceStatus.chatAutoBlockEnd} (${maintenanceStatus.chatBlockTimezone})`
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

  const markAllAsRead = useCallback(() => {
    setUnreadCount(0);
    if (sortedMessages.length > 0) {
      const lastId = sortedMessages[sortedMessages.length - 1].id;
      setLastReadMessageId(lastId);
      lastMessageIdRef.current = lastId;
    }
  }, [sortedMessages]);

  // Scroll to bottom and mark as read when chat opens
  useEffect(() => {
    if (isOpen) {
      markAllAsRead();
      isAtBottomRef.current = true;
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }, 50);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (!isOpen) return;
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      markAllAsRead();
    }
  }, [sortedMessages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count unread when chat is closed
  useEffect(() => {
    if (!isOpen && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.id !== lastMessageIdRef.current && lastMessage.userId !== user?.id) {
        setUnreadCount((prev) => prev + 1);
        lastMessageIdRef.current = lastMessage.id;
      }
    }
  }, [messages, isOpen, user?.id]);

  const handleScrollMessages = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 100;
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      markAllAsRead();
    }
  }, [markAllAsRead]);

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
    unreadMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openReactionUsers = (
    msg: { username: string; message: string; imageUrl?: string | null },
    reaction: { emoji: string; count: number; users: string[] }
  ) => {
    setSelectedReaction({
      emoji: reaction.emoji,
      count: reaction.count,
      users: reaction.users,
      author: msg.username,
      preview: msg.message || (msg.imageUrl ? '[image]' : ''),
    });
  };

  const handleExportChat = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      messageCount: sortedMessages.length,
      messages: sortedMessages.map((msg) => ({
        id: msg.id,
        timestamp: msg.timestamp,
        username: msg.username,
        userId: msg.userId,
        message: msg.message,
        imageUrl: msg.imageUrl ?? null,
        pinned: msg.pinned,
        type: msg.type ?? 'user',
        reactions: msg.reactions,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        "fixed bottom-0 left-64 right-0 bg-background border-t border-border/40 transition-all duration-300 z-40",
        isOpen ? 'h-72' : 'h-12'
      )}
    >
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <div className="flex h-12 items-center">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="h-12 flex-1 justify-between rounded-none px-6 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{t('chat_title')}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {onlineCount} {t('chat_online')}
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
          {(user?.isAdmin || user?.isSuperAdmin) && (
            <button
              type="button"
              className="h-12 shrink-0 border-l border-border/40 px-3 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
              onClick={handleExportChat}
              title="Exporter le chat (admin)"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </div>

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
                        <FormattedMessageText text={msg.message} />
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div
              ref={scrollContainerRef}
              onScroll={handleScrollMessages}
              className="flex-1 overflow-y-auto px-6"
            >
              <div className="space-y-3 py-3">
                {sortedMessages.map((msg, index) => {
                  const isLastRead = msg.id === lastReadMessageId;
                  const nextMsg = sortedMessages[index + 1];
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
                                      title={t('chat_react')}
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
                                    title={msg.pinned ? t('chat_unpin') : t('chat_pin')}
                                  >
                                    {msg.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => deleteMessage(msg.id)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 transition-opacity text-destructive group-hover:opacity-100 hover:text-destructive/80"
                                    title={t('chat_delete_message')}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            <FormattedMessageText text={msg.message} />
                          </p>
                          {msg.reactions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {msg.reactions.map((reaction) => (
                                <button
                                  key={`${msg.id}-${reaction.emoji}`}
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                                  title={getReactionUsersLabel(reaction.users)}
                                  aria-label={getReactionUsersLabel(reaction.users)}
                                  onClick={() => openReactionUsers(msg, reaction)}
                                >
                                  <span>{reaction.emoji}</span>
                                  <span className="tabular-nums">{reaction.count}</span>
                                </button>
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
                            {t('chat_unread_messages')}
                          </span>
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent" />
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {typingUsers.length > 0 && (
              <div className="px-6 py-2 text-xs text-muted-foreground">
                {typingUsers.map((u) => u.username).join(', ')} {t('chat_typing_suffix')}
              </div>
            )}

            {lastReadMessageId && lastReadMessageId !== sortedMessages[sortedMessages.length - 1]?.id && (
              <div className="px-6 py-2 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={scrollToUnread}
                  className="w-full text-xs"
                >
                  <ChevronDown className="h-3 w-3 mr-1" />
                  {t('chat_go_to_unread')}
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

            <form onSubmit={handleSubmit} className="px-6 py-3 border-t border-border/40">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder={chatBlockedForUser ? t('chat_blocked_placeholder') : t('chat_message_placeholder')}
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

          <Dialog
            open={Boolean(selectedReaction)}
            onOpenChange={(open) => {
              if (!open) setSelectedReaction(null);
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {selectedReaction ? `${selectedReaction.emoji} ${t('chat_reaction_users_title')}` : t('chat_reaction_users_title')}
                </DialogTitle>
                {selectedReaction && (
                  <DialogDescription>
                    {`${selectedReaction.count} personne${selectedReaction.count > 1 ? 's' : ''} ${selectedReaction.count > 1 ? 'ont' : 'a'} réagi au message de ${selectedReaction.author}.`}
                  </DialogDescription>
                )}
              </DialogHeader>

              {selectedReaction && (
                <div className="space-y-3">
                  {selectedReaction.preview && (
                    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{selectedReaction.author}</span>
                      <span className="mx-1">•</span>
                      <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{selectedReaction.preview}</span>
                    </div>
                  )}

                  <ScrollArea className="max-h-72 rounded-lg border border-border/60">
                    <div className="divide-y divide-border/60">
                      {selectedReaction.users.map((username) => (
                        <div key={username} className="px-3 py-2 text-sm text-foreground">
                          {username}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Online Users */}
          <div className="w-40 border-l border-border/40">
            <Collapsible open={showUsers} onOpenChange={(open) => {
              setShowUsers(open);
              if (open) requestOnlineUsers();
            }}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="h-auto w-full justify-between rounded-none px-4 py-3 text-xs text-muted-foreground">
                  <span>{t('chat_online')}</span>
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
                                    <span>{u.isPageActive ? t('chat_online_page') : t('chat_background')}</span>
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

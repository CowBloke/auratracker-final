import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { Send, X, MoreHorizontal, Pin, PinOff, Reply, Plus, ChevronDown, BarChart3, Loader2, ImagePlus } from 'lucide-react';
import { useSmartScroll } from '@/hooks/useSmartScroll';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useChatSidebar } from './ChatSidebarWrapper';
import { resolveImageUrl } from '@/lib/images';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UsernameDisplay } from '@/components/ui/username-display';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserBadges } from '@/components/badges/UserBadges';
import { toClanTagData } from '@/components/clans/ClanTag';
import { uploadUserImage } from '@/services/api';
import { IMAGE_UPLOAD_INPUT_ACCEPT, prepareImageUploadPayload } from '@/lib/image-upload';

type TimeoutRef = ReturnType<typeof setTimeout> | null;
type ReplyTarget = {
  id: string;
  userId: string;
  username: string;
  usernameColor?: string | null;
  message: string;
};
type MentionState = {
  start: number;
  end: number;
  query: string;
};
type MentionableUser = {
  userId: string;
  username: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
};

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

export default function ChatSidebar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    messages,
    hasOlderMessages,
    isLoadingOlderMessages,
    activePoll,
    onlineUsers,
    typingUsers,
    sendMessage,
    setTyping,
    reactToMessage,
    pinMessage,
    createPoll,
    votePoll,
    closePoll,
    loadOlderMessages,
    joinParty,
    requestJoinParty,
    currentParty,
    pendingJoinRequests,
  } = useSocket();
  const { unreadCount, lastReadMessageId, lastReadTimestamp, markAllAsRead } = useChatSidebar();
  const [input, setInput] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionsText, setPollOptionsText] = useState('');
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const scrollViewportRef = useRef<HTMLElement | null>(null);
  const pendingScrollRestoreRef = useRef<number | null>(null);
  const [showLoadOlderButton, setShowLoadOlderButton] = useState(false);
  const { messagesEndRef, hasNewMessage, scrollToBottom, setScrollAreaRef } = useSmartScroll({
    dependency: [messages],
  });
  const typingTimeoutRef = useRef<TimeoutRef>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [imageUrl, setImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const mentionMap = new Map<string, MentionableUser>();
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
  const canManagePolls = Boolean(user?.isAdmin || user?.isSuperAdmin);
  const firstUnreadMessageId = useMemo(() => {
    if (!user || unreadCount <= 0 || sortedMessages.length === 0) return null;

    const lastReadIndex = lastReadMessageId
      ? sortedMessages.findIndex((message) => message.id === lastReadMessageId)
      : -1;

    const unreadCandidates =
      lastReadIndex >= 0
        ? sortedMessages.slice(lastReadIndex + 1)
        : sortedMessages.filter((message) => {
            if (!lastReadTimestamp) return false;
            return new Date(message.timestamp).getTime() > new Date(lastReadTimestamp).getTime();
          });

    const firstUnread = unreadCandidates.find((message) => message.userId !== user.id);
    return firstUnread?.id ?? null;
  }, [user, unreadCount, sortedMessages, lastReadMessageId, lastReadTimestamp]);
  const latestUnreadMessageId = useMemo(() => {
    if (!user || unreadCount <= 0 || sortedMessages.length === 0) return null;

    const lastReadIndex = lastReadMessageId
      ? sortedMessages.findIndex((message) => message.id === lastReadMessageId)
      : -1;

    const unreadCandidates =
      lastReadIndex >= 0
        ? sortedMessages.slice(lastReadIndex + 1)
        : sortedMessages.filter((message) => {
            if (!lastReadTimestamp) return false;
            return new Date(message.timestamp).getTime() > new Date(lastReadTimestamp).getTime();
          });

    const unreadFromOthers = unreadCandidates.filter((message) => message.userId !== user.id);
    const latestUnread = unreadFromOthers[unreadFromOthers.length - 1];
    return latestUnread?.id ?? null;
  }, [user, unreadCount, sortedMessages, lastReadMessageId, lastReadTimestamp]);
  const pollOptionsPreview = useMemo(() => {
    return pollOptionsText
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
  }, [pollOptionsText]);

  onlineUsers.forEach((u) => {
    mentionMap.set(u.username.toLowerCase(), {
      userId: u.userId,
      username: u.username,
      usernameColor: u.usernameColor,
      profilePicture: u.profilePicture,
    });
  });

  messages.forEach((m) => {
    if (m.userId && !mentionMap.has(m.username.toLowerCase())) {
      mentionMap.set(m.username.toLowerCase(), {
        userId: m.userId,
        username: m.username,
        usernameColor: m.usernameColor ?? null,
        profilePicture: m.profilePicture ?? null,
      });
    }
  });

  const mentionableUsers = Array.from(mentionMap.values());

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionState?.query]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      setShowLoadOlderButton(viewport.scrollTop <= 24 && hasOlderMessages);
    };

    handleScroll();
    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [hasOlderMessages]);

  useEffect(() => {
    if (isLoadingOlderMessages) return;
    const viewport = scrollViewportRef.current;
    const previousHeight = pendingScrollRestoreRef.current;
    if (!viewport || previousHeight === null) return;

    viewport.scrollTop = viewport.scrollHeight - previousHeight + viewport.scrollTop;
    pendingScrollRestoreRef.current = null;
  }, [isLoadingOlderMessages, messages]);

  const getMentionState = (value: string, cursor: number | null): MentionState | null => {
    if (cursor === null) return null;
    const uptoCursor = value.slice(0, cursor);
    const atIndex = uptoCursor.lastIndexOf('@');
    if (atIndex === -1) return null;
    if (atIndex > 0 && !/\s/.test(uptoCursor[atIndex - 1])) return null;
    const query = uptoCursor.slice(atIndex + 1);
    if (/\s/.test(query)) return null;
    return { start: atIndex, end: cursor, query };
  };

  const updateMentionState = (value: string, cursor: number | null) => {
    const nextState = getMentionState(value, cursor);
    setMentionState(nextState);
  };

  const mentionCandidates = mentionState
    ? mentionableUsers
        .filter((u) => u.userId !== user?.id)
        .filter((u) => u.username.toLowerCase().includes(mentionState.query.toLowerCase()))
        .sort((a, b) => a.username.localeCompare(b.username))
        .slice(0, 6)
    : [];
  const showMentionList = mentionState && mentionCandidates.length > 0;

  const applyMention = (username: string) => {
    if (!mentionState) return;
    const before = input.slice(0, mentionState.start);
    const after = input.slice(mentionState.end);
    const mentionText = `@${username} `;
    const nextValue = `${before}${mentionText}${after}`;
    setInput(nextValue);
    setTyping(true);
    setMentionState(null);
    setMentionIndex(0);
    requestAnimationFrame(() => {
      const cursor = before.length + mentionText.length;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(cursor, cursor);
    });
  };

  const getSnippet = (text: string) => {
    if (text.length <= 120) return text;
    return `${text.slice(0, 120)}...`;
  };

  const handleImageSelection = async (file: File | null) => {
    if (!file || isUploadingImage) return;
    if (!file.type.startsWith('image/')) return;

    try {
      setIsUploadingImage(true);
      const { base64Data, mimeType } = await prepareImageUploadPayload(file);
      const response = await uploadUserImage({ base64Data, mimeType });
      setImageUrl(response.data.imageUrl);
    } catch (error) {
      console.error('Failed to upload chat image:', error);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const parsePartyInvite = (text: string) => {
    const prefix = '[[party-invite:';
    if (!text.startsWith(prefix)) return null;
    const endIndex = text.indexOf(']]');
    if (endIndex === -1) return null;
    const payload = text.slice(prefix.length, endIndex);
    const [partyId, visibility] = payload.split(':');
    if (!partyId) return null;
    const label = text.slice(endIndex + 2).trim() || 'Rejoins la party';
    return {
      partyId,
      visibility: visibility === 'private' ? 'private' : 'public',
      label,
    };
  };

  const renderMessageContent = (text: string) => {
    const parts: ReactNode[] = [];
    const regex = /@([A-Za-z0-9_.-]+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const [fullMatch, username] = match;
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(text.slice(lastIndex, matchIndex));
      }
      const resolved = mentionMap.get(username.toLowerCase());
      if (resolved) {
        parts.push(
          <Button
            key={`${resolved.userId}-${matchIndex}`}
            type="button"
            onClick={() => navigate(`/profile/${resolved.userId}`)}
            variant="link"
            className="h-auto px-0 py-0 font-medium"
            style={resolved.usernameColor ? { color: resolved.usernameColor } : undefined}
          >
            @{resolved.username}
          </Button>
        );
      } else {
        parts.push(fullMatch);
      }
      lastIndex = matchIndex + fullMatch.length;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts;
  };

  const sendCurrentMessage = () => {
    if (input.trim() || imageUrl) {
      sendMessage(input.trim(), replyTarget?.id ?? null, imageUrl || null);
      setInput('');
      setImageUrl('');
      setReplyTarget(null);
      setMentionState(null);
      setTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendCurrentMessage();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setTyping(true);
    updateMentionState(e.target.value, e.target.selectionStart);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 2000);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionList) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyMention(mentionCandidates[mentionIndex].username);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionState(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || imageUrl) {
        sendCurrentMessage();
      }
    }
  };

  const handleInputCursorChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    updateMentionState(target.value, target.selectionStart);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCreatePoll = () => {
    const options = pollOptionsText
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
    createPoll(pollQuestion.trim(), options);
    setPollQuestion('');
    setPollOptionsText('');
    setPollModalOpen(false);
  };

  const getPollOptionPercent = (votes: number) => {
    if (!activePoll || activePoll.totalVotes === 0) return 0;
    return Math.round((votes / activePoll.totalVotes) * 100);
  };

  const scrollToLatestUnread = () => {
    if (!latestUnreadMessageId) return;
    const node = messageRefs.current[latestUnreadMessageId];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    markAllAsRead();
  };

  const handleLoadOlderMessages = () => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      pendingScrollRestoreRef.current = viewport.scrollHeight;
    }
    loadOlderMessages();
  };

  return (
    <Sidebar variant="inset" side="right" collapsible="offcanvas" className="border-l border-border/40">
      <SidebarRail />
      <SidebarHeader className="border-b border-border/40">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Chat</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-foreground text-background">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col">
        <div className="flex-1 flex flex-col min-h-0">
          {pinnedMessages.length > 0 && (
            <div className="border-b border-border/40 bg-muted/20 px-3 py-3">
              <div className="space-y-2">
                {pinnedMessages.map((msg) => (
                  <div
                    key={`pinned-${msg.id}`}
                    className="rounded-lg border border-border/50 bg-background/85 px-3 py-2"
                  >
                    <div className="mb-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Pin className="h-3 w-3" />
                      <span className="font-medium text-foreground">{msg.username}</span>
                      <span className="tabular-nums">{formatTime(msg.timestamp)}</span>
                      {user?.isAdmin && (
                        <Button
                          type="button"
                          onClick={() => pinMessage(msg.id, false)}
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-6 w-6 text-muted-foreground/70 hover:text-foreground"
                          title="Désépingler"
                        >
                          <PinOff className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {msg.message && (
                        <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {renderMessageContent(msg.message)}
                        </p>
                      )}
                      {msg.imageUrl && (
                        <img
                          src={resolveImageUrl(msg.imageUrl)}
                          alt={`Image épinglée envoyee par ${msg.username}`}
                          className="max-h-48 w-full rounded-md border border-border/50 object-cover"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activePoll && (
            <div className="border-b border-border/40 bg-muted/20 px-3 py-3">
              <div className="rounded-lg border border-border/60 bg-background/90 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">Sondage actif</span>
                    <span>• {activePoll.totalVotes} vote{activePoll.totalVotes > 1 ? 's' : ''}</span>
                  </div>
                  {canManagePolls && (
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
          <ScrollArea 
            className="flex-1 px-3 relative group"
            ref={(el) => {
              if (el) {
                const viewport = el.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
                if (viewport) {
                  scrollViewportRef.current = viewport;
                  setScrollAreaRef(viewport);
                }
              }
            }}
          >
            <div className="space-y-3 py-4">
              {showLoadOlderButton && (
                <div className="sticky top-0 z-10 flex justify-center pb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadOlderMessages}
                    disabled={isLoadingOlderMessages}
                    className="h-8 rounded-full border-border/60 bg-background/95 px-3 text-xs shadow-sm backdrop-blur"
                  >
                    {isLoadingOlderMessages ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Chargement...
                      </>
                    ) : (
                      'Charger les messages plus anciens'
                    )}
                  </Button>
                </div>
              )}
              {sortedMessages.map((msg) => {
                const invite = parsePartyInvite(msg.message);
                const isSystemMessage = msg.type === 'system';
                const isSameParty = invite && currentParty?.id === invite.partyId;
                const isOtherParty = invite && currentParty && currentParty.id !== invite.partyId;
                const isPendingInvite = invite?.visibility === 'private' && pendingJoinRequests.includes(invite.partyId);
                const inviteDisabled = Boolean(isSameParty || isOtherParty || isPendingInvite);
                const inviteActionLabel = isSameParty
                  ? 'Deja dans la party'
                  : isOtherParty
                    ? 'Quitte ta party pour rejoindre'
                    : invite?.visibility === 'private'
                      ? isPendingInvite
                        ? 'Demande envoyee'
                        : 'Demander a rejoindre'
                      : 'Rejoindre';

                return (
                  <div key={msg.id}>
                    {msg.id === firstUnreadMessageId && (
                      <div className="my-2 flex items-center gap-2 px-1">
                        <div className="h-px flex-1 bg-border/70" />
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Non lus
                        </span>
                        <div className="h-px flex-1 bg-border/70" />
                      </div>
                    )}
                    <div
                      ref={(el) => {
                        messageRefs.current[msg.id] = el;
                      }}
                      className={cn(
                        "flex flex-col group",
                        msg.userId === user?.id && !isSystemMessage && 'items-end'
                      )}
                    >
                      <div
                        className={cn(
                          "relative w-fit max-w-[85%] min-w-0 px-3 py-2 rounded-lg",
                          !isSystemMessage && 'pr-12',
                          isSystemMessage
                            ? 'border border-amber-500/30 bg-amber-500/10'
                            : msg.userId === user?.id
                            ? 'bg-foreground/10'
                            : 'bg-muted'
                        )}
                      >
                      {!isSystemMessage && (
                        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md bg-background/70 p-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground/70 hover:text-foreground"
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
                            <Button
                              type="button"
                              onClick={() => pinMessage(msg.id, !msg.pinned)}
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-[10px] text-muted-foreground/60 hover:text-foreground"
                              title={msg.pinned ? 'Désépingler' : 'Épingler'}
                            >
                              {msg.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                            </Button>
                          )}
                          <Button
                            type="button"
                            onClick={() =>
                              setReplyTarget({
                                id: msg.id,
                                userId: msg.userId ?? '',
                                username: msg.username,
                                usernameColor: msg.usernameColor,
                                message: msg.message || (msg.imageUrl ? '[image]' : ''),
                              })
                            }
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground/70 hover:text-foreground"
                            title="Répondre"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      {msg.replyTo && (
                        <div className="mb-2 border-l-2 border-border/60 pl-2 text-xs text-muted-foreground">
                          <UsernameDisplay
                            username={msg.replyTo.username}
                            usernameColor={msg.replyTo.usernameColor}
                            className="block font-medium"
                          />
                          <span className="block whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            {getSnippet(msg.replyTo.message || (msg.replyTo.imageUrl ? '[image]' : ''))}
                          </span>
                        </div>
                      )}
                      <div className="mb-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pr-1">
                        {msg.profilePicture && (
                          <img 
                            src={resolveImageUrl(msg.profilePicture)} 
                            alt={msg.username}
                            className="w-4 h-4 rounded-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        {msg.userId ? (
                          <Button
                            type="button"
                            onClick={() => navigate(`/profile/${msg.userId}`)}
                            variant="link"
                            className={cn(
                              "h-auto min-w-0 max-w-full px-0 py-0 text-xs font-medium",
                              !msg.usernameColor && (msg.userId === user?.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')
                            )}
                          >
                            <UsernameDisplay
                              username={msg.username}
                              usernameColor={msg.usernameColor}
                              clanTag={toClanTagData(msg.clanTag)}
                              className="max-w-[13rem]"
                            />
                          </Button>
                        ) : (
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            {msg.username}
                          </span>
                        )}
                        {msg.badges.length > 0 && (
                          <UserBadges
                            badges={msg.badges}
                            size="xs"
                            tooltipSide="top"
                            showEmptySlots={false}
                          />
                        )}
                        {(msg.isTopMoney || msg.isTopAura) && !isSystemMessage && (
                          <div className="flex items-center gap-1">
                            {msg.isTopMoney && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-border/60 px-1.5 text-[9px] font-semibold text-muted-foreground cursor-help">
                                      Argent
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
                                      Aura
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
                      </div>
                      {invite ? (
                        <div className="space-y-2">
                          <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{renderMessageContent(invite.label)}</p>
                          <Button
                            type="button"
                            onClick={() => {
                              if (inviteDisabled) return;
                              if (invite.visibility === 'private') {
                                requestJoinParty(invite.partyId);
                              } else {
                                joinParty(invite.partyId);
                              }
                            }}
                            disabled={inviteDisabled}
                            variant={inviteDisabled ? 'outline' : 'default'}
                            className="h-8 w-full text-xs"
                          >
                            {inviteActionLabel}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {msg.message && (
                            <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                              {renderMessageContent(msg.message)}
                            </p>
                          )}
                          {msg.imageUrl && (
                            <img
                              src={resolveImageUrl(msg.imageUrl)}
                              alt={`Image envoyee par ${msg.username}`}
                              className="max-h-72 w-full rounded-md border border-border/50 object-cover"
                            />
                          )}
                        </div>
                      )}
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
                  </div>
                );
              })}
              {latestUnreadMessageId && (
                <div className="sticky bottom-0 flex justify-center py-2">
                  <button
                    onClick={scrollToLatestUnread}
                    className="flex items-center gap-1 rounded-full bg-foreground/15 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-foreground/25"
                    title="Aller au message non lu le plus récent"
                  >
                    <ChevronDown className="h-3 w-3" />
                    <span>Dernier non lu</span>
                  </button>
                </div>
              )}
              {hasNewMessage && (
                <div className="sticky bottom-0 flex justify-center py-2">
                  <button
                    onClick={scrollToBottom}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-foreground/10 hover:bg-foreground/20 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title="Aller au dernier message"
                  >
                    <ChevronDown className="h-3 w-3" />
                    <span>Nouveau message</span>
                  </button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {typingUsers.length > 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border/40">
              {typingUsers.map((u) => u.username).join(', ')} écrit...
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-3 border-t border-border/40">
            <input
              ref={imageInputRef}
              type="file"
              accept={IMAGE_UPLOAD_INPUT_ACCEPT}
              className="hidden"
              onChange={(e) => {
                void handleImageSelection(e.target.files?.[0] || null);
                e.currentTarget.value = '';
              }}
            />
            {replyTarget && (
              <div className="mb-2 flex items-start justify-between gap-3 rounded-md border border-border/60 bg-foreground/5 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <UsernameDisplay
                    username={replyTarget.username}
                    usernameColor={replyTarget.usernameColor}
                    className="block font-medium text-foreground/80"
                  />
                  <span className="block whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-muted-foreground">{getSnippet(replyTarget.message)}</span>
                </div>
                <Button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {imageUrl && (
              <div className="mb-2 relative overflow-hidden rounded-md border border-border/60 bg-background/60 p-2">
                <img
                  src={resolveImageUrl(imageUrl)}
                  alt="Apercu de l'image"
                  className="max-h-40 w-full rounded object-cover"
                />
                <Button
                  type="button"
                  onClick={() => setImageUrl('')}
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-3 h-7 w-7 rounded-full border border-border/60 bg-background/85"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  onKeyUp={handleInputCursorChange}
                  onClick={handleInputCursorChange}
                  placeholder="Message..."
                  rows={1}
                  className="min-h-9 max-h-40 resize-none overflow-y-hidden text-sm bg-transparent border-border/50 py-2"
                />
                {showMentionList && (
                  <div className="absolute bottom-full z-50 mb-2 w-full rounded-md border border-border/60 bg-background/95 shadow-lg">
                    <div className="max-h-40 overflow-auto py-1">
                      {mentionCandidates.map((candidate, index) => (
                        <Button
                          key={candidate.userId}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyMention(candidate.username)}
                          variant="ghost"
                          className={cn(
                            "h-auto w-full justify-start gap-2 px-2 py-1 text-sm transition-colors",
                            index === mentionIndex
                              ? "bg-foreground/10 text-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                          )}
                        >
                          {candidate.profilePicture ? (
                            <img
                              src={resolveImageUrl(candidate.profilePicture)}
                              alt={candidate.username}
                              className="h-5 w-5 rounded-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-foreground/50" />
                          )}
                          <UsernameDisplay
                            username={candidate.username}
                            usernameColor={candidate.usernameColor}
                            className="truncate"
                          />
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    disabled={isUploadingImage}
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground"
                    title="Actions"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-48">
                  <DropdownMenuItem onClick={() => imageInputRef.current?.click()} disabled={isUploadingImage}>
                    <ImagePlus className="mr-2 h-4 w-4" />
                    {isUploadingImage ? "Upload de l'image..." : 'Image'}
                  </DropdownMenuItem>
                  {canManagePolls && !activePoll && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setPollModalOpen(true)}>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Sondage
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="submit"
                disabled={(!input.trim() && !imageUrl) || isUploadingImage}
                variant="outline"
                size="icon"
                className="h-9 w-9 text-muted-foreground"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </form>
        </div>
      </SidebarContent>
      <Dialog open={pollModalOpen} onOpenChange={setPollModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Creer un sondage</DialogTitle>
            <DialogDescription>
              Ajoute une question et au moins deux options. Le sondage sera publie dans le chat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Question du sondage"
              rows={2}
              className="min-h-9 resize-none text-sm bg-transparent border-border/50 py-2"
            />
            <Textarea
              value={pollOptionsText}
              onChange={(e) => setPollOptionsText(e.target.value)}
              placeholder={'Une option par ligne\nExemple:\nOui\nNon'}
              rows={4}
              className="min-h-[96px] resize-none text-xs bg-transparent border-border/50 py-2"
            />
            <p className="text-[11px] text-muted-foreground">
              {pollOptionsPreview.length} option{pollOptionsPreview.length > 1 ? 's' : ''} detectee{pollOptionsPreview.length > 1 ? 's' : ''}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPollModalOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleCreatePoll}
              disabled={pollQuestion.trim().length < 3 || pollOptionsPreview.length < 2}
            >
              Lancer le sondage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </Sidebar>
  );
}

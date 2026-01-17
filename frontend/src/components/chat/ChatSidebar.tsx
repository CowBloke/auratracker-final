import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { Send, X, MoreHorizontal, Pin, PinOff } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useChatSidebar } from './ChatSidebarWrapper';
import { resolveImageUrl } from '@/lib/images';

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
  { emoji: '❤️', label: 'Coeur' },
  { emoji: '👍', label: 'Like' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Triste' },
  { emoji: '😡', label: 'Grr' },
];

export default function ChatSidebar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    messages,
    onlineUsers,
    typingUsers,
    sendMessage,
    setTyping,
    reactToMessage,
    pinMessage,
    joinParty,
    requestJoinParty,
    currentParty,
    pendingJoinRequests,
  } = useSocket();
  const { unreadCount } = useChatSidebar();
  const [input, setInput] = useState('');
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<TimeoutRef>(null);
  const mentionMap = new Map<string, MentionableUser>();
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

  onlineUsers.forEach((u) => {
    mentionMap.set(u.username.toLowerCase(), {
      userId: u.userId,
      username: u.username,
      usernameColor: u.usernameColor,
      profilePicture: u.profilePicture,
    });
  });

  messages.forEach((m) => {
    if (!mentionMap.has(m.username.toLowerCase())) {
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionState?.query]);

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
          <button
            key={`${resolved.userId}-${matchIndex}`}
            type="button"
            onClick={() => navigate(`/profile/${resolved.userId}`)}
            className="font-medium hover:underline"
            style={resolved.usernameColor ? { color: resolved.usernameColor } : undefined}
          >
            @{resolved.username}
          </button>
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input.trim(), replyTarget?.id ?? null);
      setInput('');
      setReplyTarget(null);
      setMentionState(null);
      setTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMentionList) return;
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
    }
  };

  const handleInputCursorChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    updateMentionState(target.value, target.selectionStart);
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
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm text-muted-foreground">Chat</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-foreground text-background">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="flex flex-col">
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 px-3">
            <div className="space-y-3 py-4">
              {sortedMessages.map((msg) => {
                const invite = parsePartyInvite(msg.message);
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
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col group",
                      msg.userId === user?.id && 'items-end'
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[90%] px-3 py-2 rounded-lg",
                        msg.userId === user?.id
                          ? 'bg-foreground/10'
                          : 'bg-muted'
                      )}
                    >
                      {msg.replyTo && (
                        <div className="mb-2 border-l-2 border-border/60 pl-2 text-xs text-muted-foreground">
                          <span
                            className="block font-medium"
                            style={msg.replyTo.usernameColor ? { color: msg.replyTo.usernameColor } : undefined}
                          >
                            {msg.replyTo.username}
                          </span>
                          <span className="block break-words whitespace-normal">{getSnippet(msg.replyTo.message)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-1">
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
                        {(msg.isTopMoney || msg.isTopAura) && (
                          <div className="flex items-center gap-1">
                            {msg.isTopMoney && (
                              <span
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-300 text-[9px] font-semibold text-yellow-900"
                                title="Top 5 argent"
                              >
                                $
                              </span>
                            )}
                            {msg.isTopAura && (
                              <span
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-semibold text-white"
                                title="Top 5 aura"
                              >
                                A
                              </span>
                            )}
                          </div>
                        )}
                        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                          {formatTime(msg.timestamp)}
                        </span>
                        {msg.pinned && (
                          <Pin className="h-3 w-3 text-amber-500" title="Message épinglé" />
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/70 hover:text-foreground"
                                title="Réagir"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align={msg.userId === user?.id ? 'end' : 'start'}
                              className="flex items-center gap-1 p-2"
                            >
                              {REACTION_OPTIONS.map((reaction) => (
                                <button
                                  key={reaction.emoji}
                                  type="button"
                                  onClick={() => reactToMessage(msg.id, reaction.emoji)}
                                  className="h-8 w-8 rounded-md hover:bg-muted/60 transition-colors"
                                  title={reaction.label}
                                >
                                  <span className="text-base">{reaction.emoji}</span>
                                </button>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {user?.isAdmin && (
                            <button
                              type="button"
                              onClick={() => pinMessage(msg.id, !msg.pinned)}
                              className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                              title={msg.pinned ? 'Désépingler' : 'Épingler'}
                            >
                              {msg.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setReplyTarget({
                                id: msg.id,
                                userId: msg.userId,
                                username: msg.username,
                                usernameColor: msg.usernameColor,
                                message: msg.message,
                              })
                            }
                            className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
                          >
                            Répondre
                          </button>
                        </div>
                      </div>
                      {invite ? (
                        <div className="space-y-2">
                          <p className="text-sm break-words">{renderMessageContent(invite.label)}</p>
                          <button
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
                            className={cn(
                              "w-full rounded border px-2 py-1 text-xs transition-colors",
                              inviteDisabled
                                ? "border-border/50 text-muted-foreground cursor-not-allowed"
                                : "border-foreground text-foreground hover:bg-foreground hover:text-background"
                            )}
                          >
                            {inviteActionLabel}
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm break-words">{renderMessageContent(msg.message)}</p>
                      )}
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
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {typingUsers.length > 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border/40">
              {typingUsers.map((u) => u.username).join(', ')} écrit...
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-3 pb-16 border-t border-border/40">
            {replyTarget && (
              <div className="mb-2 flex items-start justify-between gap-3 rounded-md border border-border/60 bg-foreground/5 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <span
                    className="block font-medium text-foreground/80"
                    style={replyTarget.usernameColor ? { color: replyTarget.usernameColor } : undefined}
                  >
                    {replyTarget.username}
                  </span>
                  <span className="block break-words whitespace-normal text-muted-foreground">{getSnippet(replyTarget.message)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  onKeyUp={handleInputCursorChange}
                  onClick={handleInputCursorChange}
                  placeholder="Message..."
                  className="h-9 text-sm bg-transparent border-border/50"
                />
                {showMentionList && (
                  <div className="absolute bottom-full z-50 mb-2 w-full rounded-md border border-border/60 bg-background/95 shadow-lg">
                    <div className="max-h-40 overflow-auto py-1">
                      {mentionCandidates.map((candidate, index) => (
                        <button
                          key={candidate.userId}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyMention(candidate.username)}
                          className={cn(
                            "flex w-full items-center gap-2 px-2 py-1 text-sm transition-colors",
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
                          <span
                            className="truncate"
                            style={candidate.usernameColor ? { color: candidate.usernameColor } : undefined}
                          >
                            {candidate.username}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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

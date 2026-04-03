import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  MessageCircleMore,
  MessageSquare,
  PencilLine,
  Search,
  SendHorizonal,
  Sparkles,
} from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import {
  DirectConversation,
  DirectConversationMessage,
  messagesApi,
  SocialUser,
  usersApi,
} from '@/services/api';

const POLL_INTERVAL_MS = 15000;

const formatMessageTime = (value: string) => {
  const date = new Date(value);

  if (isToday(date)) {
    return format(date, 'HH:mm');
  }

  if (isYesterday(date)) {
    return 'Hier';
  }

  return format(date, 'dd MMM', { locale: fr });
};

const formatMessageMeta = (value: string) =>
  formatDistanceToNow(new Date(value), { addSuffix: true, locale: fr });

const getConversationPreview = (conversation: DirectConversation) => {
  if (!conversation.lastMessage) {
    return 'Commencez la discussion.';
  }

  return conversation.lastMessage.body;
};

const getInitials = (username?: string | null) => {
  const value = (username ?? '?').trim();
  return value.slice(0, 2).toUpperCase();
};

export default function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [players, setPlayers] = useState<SocialUser[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectConversationMessage[]>([]);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isConversationLoading, setIsConversationLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const initializedFromQueryRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const deferredSearch = useDeferredValue(search);
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const selectedOtherUser = selectedConversation?.otherUser ?? null;

  const refreshConversations = async (options?: { preserveSelection?: boolean }) => {
    const response = await messagesApi.getConversations();
    const nextConversations = response.data.conversations;
    setConversations(nextConversations);

    if (!options?.preserveSelection && !selectedConversationId && nextConversations[0]) {
      setSelectedConversationId(nextConversations[0].id);
    }

    if (
      options?.preserveSelection &&
      selectedConversationId &&
      !nextConversations.some((conversation) => conversation.id === selectedConversationId)
    ) {
      setSelectedConversationId(nextConversations[0]?.id ?? null);
    }

    return nextConversations;
  };

  const loadConversationMessages = async (conversationId: string, options?: { markRead?: boolean }) => {
    setIsConversationLoading(true);

    try {
      const response = await messagesApi.getMessages(conversationId);
      setMessages(response.data.messages);

      if (options?.markRead) {
        await messagesApi.markRead(conversationId);
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? { ...conversation, unreadCount: 0 }
              : conversation
          )
        );
      }
    } finally {
      setIsConversationLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const [conversationResponse, playersResponse] = await Promise.all([
          messagesApi.getConversations(),
          usersApi.getAll(),
        ]);

        if (cancelled) return;

        const nextConversations = conversationResponse.data.conversations;
        setConversations(nextConversations);
        setPlayers(playersResponse.data.users ?? []);
        setSelectedConversationId((current) => current ?? nextConversations[0]?.id ?? null);
      } catch (error) {
        console.error('Failed to bootstrap messages page:', error);
        toast({
          title: 'Messagerie indisponible',
          description: "Impossible de charger les conversations pour l'instant.",
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) {
          setIsBootLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    loadConversationMessages(selectedConversationId, { markRead: true }).catch((error) => {
      console.error('Failed to load conversation messages:', error);
      toast({
        title: 'Conversation indisponible',
        description: "Impossible d'ouvrir cette conversation.",
        variant: 'destructive',
      });
    });
  }, [selectedConversationId]);

  useEffect(() => {
    if (isBootLoading) return;

    const params = new URLSearchParams(location.search);
    const conversationId = params.get('conversation');
    const targetUserId = params.get('user');

    if (initializedFromQueryRef.current && !conversationId && !targetUserId) {
      return;
    }

    const hydrateFromQuery = async () => {
      if (conversationId) {
        initializedFromQueryRef.current = true;
        setSelectedConversationId(conversationId);
        return;
      }

      if (!targetUserId || isStartingConversation) return;

      initializedFromQueryRef.current = true;
      setIsStartingConversation(true);

      try {
        const response = await messagesApi.createConversation(targetUserId);
        const conversation = response.data.conversation;
        setConversations((current) => {
          const next = [conversation, ...current.filter((item) => item.id !== conversation.id)];
          next.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
          return next;
        });
        setSelectedConversationId(conversation.id);
        navigate('/messages', { replace: true });
      } catch (error) {
        console.error('Failed to create direct conversation:', error);
        toast({
          title: 'DM impossible',
          description: "Impossible d'ouvrir cette conversation.",
          variant: 'destructive',
        });
      } finally {
        setIsStartingConversation(false);
      }
    };

    hydrateFromQuery().catch(() => {});
  }, [isBootLoading, isStartingConversation, location.search, navigate]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refreshConversations({ preserveSelection: true }).catch(() => {});

      if (selectedConversationId) {
        loadConversationMessages(selectedConversationId).catch(() => {});
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, selectedConversationId]);

  const filteredConversations = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return conversations;

    return conversations.filter((conversation) => {
      const username = conversation.otherUser?.username.toLowerCase() ?? '';
      const firstName = conversation.otherUser?.firstName?.toLowerCase() ?? '';
      const preview = getConversationPreview(conversation).toLowerCase();

      return username.includes(term) || firstName.includes(term) || preview.includes(term);
    });
  }, [conversations, deferredSearch]);

  const suggestedPlayers = useMemo(() => {
    const activeConversationUserIds = new Set(
      conversations
        .map((conversation) => conversation.otherUser?.id)
        .filter((value): value is string => Boolean(value))
    );
    const term = deferredSearch.trim().toLowerCase();

    return players
      .filter((player) => player.id !== user?.id)
      .filter((player) => !activeConversationUserIds.has(player.id))
      .filter((player) => {
        if (!term) return true;

        const username = player.username.toLowerCase();
        const firstName = player.firstName?.toLowerCase() ?? '';
        const bio = player.bio?.toLowerCase() ?? '';
        return username.includes(term) || firstName.includes(term) || bio.includes(term);
      })
      .slice(0, term ? 8 : 5);
  }, [conversations, deferredSearch, players, user?.id]);

  const handleOpenConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    navigate('/messages', { replace: true });
  };

  const handleStartConversation = async (targetUserId: string) => {
    try {
      setIsStartingConversation(true);
      const response = await messagesApi.createConversation(targetUserId);
      const conversation = response.data.conversation;

      setConversations((current) => {
        const next = [conversation, ...current.filter((item) => item.id !== conversation.id)];
        next.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
        return next;
      });
      setSelectedConversationId(conversation.id);
      navigate('/messages', { replace: true });
    } catch (error) {
      console.error('Failed to start direct conversation:', error);
      toast({
        title: 'DM impossible',
        description: "Impossible de démarrer cette conversation.",
        variant: 'destructive',
      });
    } finally {
      setIsStartingConversation(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedConversationId) return;

    const body = draft.trim();
    if (!body) return;

    try {
      setIsSending(true);
      const response = await messagesApi.sendMessage(selectedConversationId, body);
      const createdMessage = response.data.message;

      setMessages((current) => [...current, createdMessage]);
      setDraft('');

      await refreshConversations({ preserveSelection: true });
    } catch (error) {
      console.error('Failed to send direct message:', error);
      toast({
        title: 'Envoi impossible',
        description: "Le message n'a pas pu être envoyé.",
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  if (isBootLoading) {
    return (
      <PageShell size="full" className="space-y-0 px-4 pb-8 lg:px-6">
        <div className="min-h-[calc(100vh-9rem)] rounded-[32px] border border-border/60 bg-card/80 p-6 shadow-sm">
          <div className="grid h-full gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-[28px] border border-border/50 bg-muted/40" />
            <div className="rounded-[28px] border border-border/50 bg-muted/30" />
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell size="full" className="space-y-0 px-4 pb-8 lg:px-6">
      <div className="relative min-h-[calc(100vh-9rem)] overflow-hidden rounded-[32px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.84))] shadow-[0_28px_90px_-48px_rgba(15,23,42,0.45)] dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_26%),linear-gradient(180deg,rgba(6,10,18,0.96),rgba(8,12,22,0.9))]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/40 to-transparent" />

        <div className="grid min-h-[calc(100vh-9rem)] lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className={cn('border-r border-border/60 bg-background/50 backdrop-blur-xl', selectedConversationId ? 'hidden lg:flex' : 'flex')}>
            <div className="flex w-full flex-col">
              <div className="border-b border-border/60 px-5 pb-5 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground/70">Aura DM</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">Messages</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Une messagerie privee reservee aux joueurs connectes.
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-background/80 shadow-sm">
                    <MessageCircleMore className="h-5 w-5" />
                  </div>
                </div>

                <div className="relative mt-5">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher une conversation ou un joueur"
                    className="h-12 rounded-2xl border-border/60 bg-background/80 pl-11 pr-4"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-6 px-3 py-4">
                  <section className="space-y-2">
                    <div className="flex items-center justify-between px-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">Conversations</p>
                      <span className="rounded-full border border-border/60 px-2 py-1 text-[11px] text-muted-foreground">
                        {filteredConversations.length}
                      </span>
                    </div>

                    {filteredConversations.length === 0 ? (
                      <Card className="rounded-[24px] border-border/60 bg-background/70 p-5">
                        <p className="text-sm font-medium text-foreground">Aucune conversation pour l'instant</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Lancez un DM depuis un profil ou en choisissant un joueur ci-dessous.
                        </p>
                      </Card>
                    ) : (
                      filteredConversations.map((conversation) => {
                        const isActive = conversation.id === selectedConversationId;
                        const otherUser = conversation.otherUser;

                        return (
                          <button
                            key={conversation.id}
                            type="button"
                            onClick={() => handleOpenConversation(conversation.id)}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition-all',
                              isActive
                                ? 'border-sky-400/50 bg-sky-500/10 shadow-[0_14px_40px_-28px_rgba(14,165,233,0.8)]'
                                : 'border-transparent bg-background/55 hover:border-border/60 hover:bg-background/85'
                            )}
                          >
                            <Avatar className="h-12 w-12 border border-border/50">
                              {otherUser?.profilePicture ? (
                                <AvatarImage src={resolveImageUrl(otherUser.profilePicture)} alt={otherUser.username} />
                              ) : null}
                              <AvatarFallback>{getInitials(otherUser?.username)}</AvatarFallback>
                            </Avatar>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p
                                    className="truncate text-sm font-semibold"
                                    style={otherUser?.usernameColor ? { color: otherUser.usernameColor } : undefined}
                                  >
                                    {otherUser?.username ?? 'Conversation'}
                                  </p>
                                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                    {getConversationPreview(conversation)}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <span className="text-[11px] text-muted-foreground">
                                    {formatMessageTime(conversation.lastMessageAt)}
                                  </span>
                                  {conversation.unreadCount > 0 ? (
                                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-sky-500 px-2 py-1 text-[11px] font-semibold text-white">
                                      {conversation.unreadCount}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </section>

                  <section className="space-y-2">
                    <div className="flex items-center justify-between px-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">Nouveau DM</p>
                      <PencilLine className="h-4 w-4 text-muted-foreground" />
                    </div>

                    {suggestedPlayers.length === 0 ? (
                      <Card className="rounded-[24px] border-border/60 bg-background/70 p-5">
                        <p className="text-sm text-muted-foreground">
                          Aucun joueur supplementaire ne correspond a cette recherche.
                        </p>
                      </Card>
                    ) : (
                      suggestedPlayers.map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => handleStartConversation(player.id)}
                          className="flex w-full items-center gap-3 rounded-[22px] border border-transparent bg-background/50 px-4 py-3 text-left transition hover:border-border/60 hover:bg-background/85"
                        >
                          <Avatar className="h-11 w-11 border border-border/50">
                            {player.profilePicture ? (
                              <AvatarImage src={resolveImageUrl(player.profilePicture)} alt={player.username} />
                            ) : null}
                            <AvatarFallback>{getInitials(player.username)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate text-sm font-semibold"
                              style={player.usernameColor ? { color: player.usernameColor } : undefined}
                            >
                              {player.username}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">
                              {player.bio?.trim() || 'Ouvrir une nouvelle conversation'}
                            </p>
                          </div>
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))
                    )}
                  </section>
                </div>
              </ScrollArea>
            </div>
          </aside>

          <section className={cn('flex min-h-[calc(100vh-9rem)] min-w-0 flex-col', selectedConversationId ? 'flex' : 'hidden lg:flex')}>
            {selectedConversation && selectedOtherUser ? (
              <>
                <div className="border-b border-border/60 bg-background/45 px-4 py-4 backdrop-blur-xl sm:px-6">
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-full lg:hidden"
                      onClick={() => setSelectedConversationId(null)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>

                    <Avatar className="h-11 w-11 border border-border/60">
                      {selectedOtherUser.profilePicture ? (
                        <AvatarImage src={resolveImageUrl(selectedOtherUser.profilePicture)} alt={selectedOtherUser.username} />
                      ) : null}
                      <AvatarFallback>{getInitials(selectedOtherUser.username)}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="truncate text-left text-base font-semibold transition hover:opacity-80"
                        style={selectedOtherUser.usernameColor ? { color: selectedOtherUser.usernameColor } : undefined}
                        onClick={() => navigate(`/profile/${selectedOtherUser.id}`)}
                      >
                        {selectedOtherUser.username}
                      </button>
                      <p className="truncate text-sm text-muted-foreground">
                        {selectedOtherUser.bio?.trim() || 'Discussion privee entre joueurs'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative flex-1 overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_38%),linear-gradient(180deg,transparent,rgba(2,6,23,0.04))]" />

                  <ScrollArea className="h-full px-4 py-6 sm:px-6">
                    <div className="mx-auto flex max-w-3xl flex-col gap-3">
                      <div className="mb-3 flex justify-center">
                        <div className="rounded-full border border-border/60 bg-background/80 px-4 py-2 text-xs text-muted-foreground shadow-sm">
                          Conversation ouverte {formatMessageMeta(selectedConversation.createdAt)}
                        </div>
                      </div>

                      {isConversationLoading ? (
                        <Card className="rounded-[24px] border-border/60 bg-background/75 p-6 text-sm text-muted-foreground">
                          Chargement des messages...
                        </Card>
                      ) : messages.length === 0 ? (
                        <Card className="rounded-[28px] border-border/60 bg-background/75 p-8 text-center shadow-sm">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/50">
                            <MessageSquare className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <h2 className="mt-4 text-lg font-semibold">Lance la conversation</h2>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Envoie un premier message a {selectedOtherUser.username} pour demarrer ce DM.
                          </p>
                        </Card>
                      ) : (
                        messages.map((message) => {
                          const isOwnMessage = message.sender.id === user?.id;

                          return (
                            <div
                              key={message.id}
                              className={cn('flex', isOwnMessage ? 'justify-end' : 'justify-start')}
                            >
                              <div
                                className={cn(
                                  'max-w-[85%] rounded-[26px] px-4 py-3 shadow-sm sm:max-w-[70%]',
                                  isOwnMessage
                                    ? 'rounded-br-md bg-sky-500 text-white shadow-[0_16px_44px_-30px_rgba(14,165,233,0.85)]'
                                    : 'rounded-bl-md border border-border/60 bg-background/88 text-foreground'
                                )}
                              >
                                {!isOwnMessage ? (
                                  <p
                                    className="mb-1 text-xs font-semibold"
                                    style={message.sender.usernameColor ? { color: message.sender.usernameColor } : undefined}
                                  >
                                    {message.sender.username}
                                  </p>
                                ) : null}
                                <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                                <p className={cn('mt-2 text-[11px]', isOwnMessage ? 'text-white/75' : 'text-muted-foreground')}>
                                  {formatMessageTime(message.createdAt)}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>

                <div className="border-t border-border/60 bg-background/55 px-4 py-4 backdrop-blur-xl sm:px-6">
                  <div className="mx-auto flex max-w-3xl flex-col gap-3">
                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          if (!isSending) {
                            void handleSendMessage();
                          }
                        }
                      }}
                      placeholder={`Envoyer un message a ${selectedOtherUser.username}`}
                      className="min-h-[88px] resize-none rounded-[24px] border-border/60 bg-background/85 px-4 py-3"
                      maxLength={1500}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        Entrée pour envoyer, Maj + Entrée pour passer a la ligne
                      </p>
                      <Button
                        type="button"
                        className="rounded-full px-5"
                        disabled={isSending || !draft.trim()}
                        onClick={() => void handleSendMessage()}
                      >
                        <SendHorizonal className="h-4 w-4" />
                        Envoyer
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <Card className="w-full max-w-xl rounded-[30px] border-border/60 bg-background/80 p-8 text-center shadow-sm">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-border/60 bg-muted/50">
                    <MessageCircleMore className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold tracking-tight">Ta messagerie privee</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Choisis une conversation sur la gauche ou demarre un nouveau DM avec un joueur de la communaute.
                  </p>
                </Card>
              </div>
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
}

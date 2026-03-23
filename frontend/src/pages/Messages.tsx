import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageCircle, Send, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocketBase } from '@/contexts/SocketContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UsernameDisplay } from '@/components/ui/username-display';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { socialEvents } from '@/services/socket';
import { usersApi, type PrivateConversationSummary, type PrivateMessage, type SocialStats, type SocialUser } from '@/services/api';

export default function Messages() {
  const { user } = useAuth();
  const { socket } = useSocketBase();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<PrivateConversationSummary[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, PrivateMessage[]>>({});
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [stats, setStats] = useState<SocialStats | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const [overviewRes, conversationsRes] = await Promise.all([
          usersApi.getSocialOverview(),
          usersApi.getConversations(),
        ]);

        if (!mounted) return;

        setFriends(overviewRes.data.friends);
        setStats(overviewRes.data.stats);
        setConversations(conversationsRes.data.conversations);

        const queryConversationId = searchParams.get('conversationId');
        if (queryConversationId) {
          setSelectedConversationId(queryConversationId);
          return;
        }

        const targetUserId = searchParams.get('userId');
        if (targetUserId) {
          const existing = conversationsRes.data.conversations.find(
            (conversation) => conversation.otherUser.id === targetUserId
          );

          if (existing) {
            setSelectedConversationId(existing.id);
          } else {
            const createRes = await usersApi.createConversationWith(targetUserId);
            if (!mounted) return;
            setConversations((prev) => [createRes.data.conversation, ...prev]);
            setSelectedConversationId(createRes.data.conversation.id);
          }
          return;
        }

        if (conversationsRes.data.conversations[0]) {
          setSelectedConversationId(conversationsRes.data.conversations[0].id);
        }
      } catch (error) {
        console.error('Failed to load social messages:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedConversationId) return;

    socialEvents.joinConversation(selectedConversationId);

    const loadMessages = async () => {
      try {
        const res = await usersApi.getConversationMessages(selectedConversationId, 150);
        setMessagesByConversation((prev) => ({
          ...prev,
          [selectedConversationId]: res.data.messages,
        }));
        await usersApi.markConversationRead(selectedConversationId);
        socialEvents.markConversationRead(selectedConversationId);
      } catch (error) {
        console.error('Failed to load conversation messages:', error);
      }
    };

    void loadMessages();

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('conversationId', selectedConversationId);
      next.delete('userId');
      return next;
    });

    return () => {
      socialEvents.leaveConversation(selectedConversationId);
    };
  }, [selectedConversationId]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (payload: { message: PrivateMessage }) => {
      const message = payload.message;
      setMessagesByConversation((prev) => {
        const existing = prev[message.conversationId] ?? [];
        if (existing.some((entry) => entry.id === message.id)) return prev;
        return {
          ...prev,
          [message.conversationId]: [...existing, message],
        };
      });
    };

    const handleConversationUpdated = (payload: { conversation: PrivateConversationSummary }) => {
      const updated = payload.conversation;
      setConversations((prev) => {
        const next = prev.some((conversation) => conversation.id === updated.id)
          ? prev.map((conversation) => (conversation.id === updated.id ? updated : conversation))
          : [updated, ...prev];

        return [...next].sort(
          (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        );
      });

      if (!selectedConversationId) {
        setSelectedConversationId(updated.id);
      }
    };

    socket.on('social:message', handleMessage);
    socket.on('social:conversation-updated', handleConversationUpdated);

    return () => {
      socket.off('social:message', handleMessage);
      socket.off('social:conversation-updated', handleConversationUpdated);
    };
  }, [socket, selectedConversationId]);

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const selectedMessages = selectedConversationId ? (messagesByConversation[selectedConversationId] ?? []) : [];

  const sortedFriends = useMemo(
    () =>
      [...friends].sort((a, b) => a.username.localeCompare(b.username, 'fr')),
    [friends]
  );

  const handleSelectFriend = async (friendId: string) => {
    const existing = conversations.find((conversation) => conversation.otherUser.id === friendId);
    if (existing) {
      setSelectedConversationId(existing.id);
      return;
    }

    try {
      const res = await usersApi.createConversationWith(friendId);
      setConversations((prev) => [res.data.conversation, ...prev]);
      setSelectedConversationId(res.data.conversation.id);
    } catch (error) {
      console.error('Failed to start private conversation:', error);
    }
  };

  const handleSend = async () => {
    if (!selectedConversation || !draft.trim()) return;

    try {
      setSending(true);
      socialEvents.sendMessage(selectedConversation.otherUser.id, draft.trim());
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 px-4 pb-6 lg:px-6 lg:pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Messages privés</h1>
          <p className="text-sm text-muted-foreground">
            {stats ? `${stats.connectionCount} connexions · ${stats.followerCount} followers · ${stats.followingCount} followings` : 'Ton réseau social en direct'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Connexions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sortedFriends.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune connexion mutuelle pour le moment.</p>
                ) : (
                  sortedFriends.map((friend) => (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => handleSelectFriend(friend.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border/50 px-3 py-3 text-left transition hover:bg-muted/40"
                    >
                      <Avatar className="h-10 w-10">
                        {friend.profilePicture ? (
                          <AvatarImage src={resolveImageUrl(friend.profilePicture)} alt={friend.username} />
                        ) : null}
                        <AvatarFallback>{friend.username.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <UsernameDisplay
                          username={friend.username}
                          firstName={friend.firstName}
                          usernameColor={friend.usernameColor}
                          usernameClassName="text-sm font-medium"
                        />
                        <p className="truncate text-xs text-muted-foreground">
                          {friend.bio?.trim() || 'Connexion mutuelle'}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-4 w-4" />
                Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Chargement des conversations...</p>
                ) : conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Démarre une discussion depuis un profil ou une connexion.</p>
                ) : (
                  conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition',
                        selectedConversationId === conversation.id
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border/50 hover:bg-muted/40'
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        {conversation.otherUser.profilePicture ? (
                          <AvatarImage
                            src={resolveImageUrl(conversation.otherUser.profilePicture)}
                            alt={conversation.otherUser.username}
                          />
                        ) : null}
                        <AvatarFallback>{conversation.otherUser.username.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <UsernameDisplay
                            username={conversation.otherUser.username}
                            firstName={conversation.otherUser.firstName}
                            usernameColor={conversation.otherUser.usernameColor}
                            usernameClassName="text-sm font-medium"
                          />
                          {conversation.unreadCount > 0 ? (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                              {conversation.unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {conversation.lastMessage?.body || 'Aucun message pour le moment'}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="min-h-[70vh]">
          <CardHeader className="border-b border-border/40">
            <CardTitle className="text-base">
              {selectedConversation ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {selectedConversation.otherUser.profilePicture ? (
                      <AvatarImage
                        src={resolveImageUrl(selectedConversation.otherUser.profilePicture)}
                        alt={selectedConversation.otherUser.username}
                      />
                    ) : null}
                    <AvatarFallback>{selectedConversation.otherUser.username.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <UsernameDisplay
                      username={selectedConversation.otherUser.username}
                      firstName={selectedConversation.otherUser.firstName}
                      usernameColor={selectedConversation.otherUser.usernameColor}
                    />
                    <p className="text-xs font-normal text-muted-foreground">
                      Conversation privée en direct
                    </p>
                  </div>
                </div>
              ) : (
                'Sélectionne une conversation'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex h-[calc(70vh-72px)] flex-col p-0">
            {selectedConversation ? (
              <>
                <ScrollArea className="flex-1 px-4 py-4">
                  <div className="space-y-3">
                    {selectedMessages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Envoie le premier message.</p>
                    ) : (
                      selectedMessages.map((message) => {
                        const isOwn = message.senderId === user?.id;
                        return (
                          <div
                            key={message.id}
                            className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}
                          >
                            <div
                              className={cn(
                                'max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm',
                                isOwn
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-foreground'
                              )}
                            >
                              {!isOwn ? (
                                <div className="mb-1 text-[11px] font-semibold opacity-70">
                                  {message.sender.username}
                                </div>
                              ) : null}
                              <p className="whitespace-pre-wrap break-words">{message.body}</p>
                              <div className="mt-1 text-[10px] opacity-70">
                                {new Date(message.createdAt).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
                <div className="border-t border-border/40 p-4">
                  <div className="flex items-center gap-3">
                    <Input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={`Écrire à ${selectedConversation.otherUser.username}...`}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void handleSend();
                        }
                      }}
                    />
                    <Button onClick={() => void handleSend()} disabled={sending || !draft.trim()}>
                      <Send className="mr-2 h-4 w-4" />
                      Envoyer
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                Choisis une connexion ou une conversation pour lancer un chat privé live.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

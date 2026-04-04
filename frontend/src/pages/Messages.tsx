import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowLeft,
  MessageCircleMore,
  MessagesSquare,
  Plus,
  Search,
  SendHorizonal,
  Shield,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useSocketBase } from '@/contexts/SocketContext';
import { toast } from '@/hooks/use-toast';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { MessagingConversationDetail, MessagingConversationSummary, SocialUser, supportApi, usersApi } from '@/services/api';

const POLL_INTERVAL_MS = 15000;

const formatMessageTime = (value: string) => {
  const date = new Date(value);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Hier';
  return format(date, 'dd MMM', { locale: fr });
};

const formatMessageMeta = (value: string) => formatDistanceToNow(new Date(value), { addSuffix: true, locale: fr });
const getInitials = (username?: string | null) => ((username ?? '?').trim().slice(0, 2) || '?').toUpperCase();
const getConversationPreview = (conversation: MessagingConversationSummary) => conversation.lastMessage?.body || 'Commence la discussion.';
const getConversationAvatar = (conversation: MessagingConversationSummary) => conversation.participants.find((entry) => entry.user.id !== 'support')?.user ?? null;

export default function MessagesPage() {
  const { user } = useAuth();
  const { socket } = useSocketBase();
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState<MessagingConversationSummary[]>([]);
  const [players, setPlayers] = useState<SocialUser[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessagingConversationDetail | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'DM' | 'GROUP'>('DM');
  const [createTitle, setCreateTitle] = useState('');
  const [createParticipantIds, setCreateParticipantIds] = useState<string[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [respectOpen, setRespectOpen] = useState(false);
  const initializedFromQueryRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const deferredSearch = useDeferredValue(search);
  const selectedConversation = detail?.conversation ?? conversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const selectedConversationIdSafe = selectedConversation?.id ?? null;

  const refreshConversations = async () => {
    const response = await supportApi.getConversations();
    setConversations(response.data.conversations);
    return response.data.conversations;
  };

  const loadConversation = async (conversationId: string, markRead = true) => {
    setConversationLoading(true);
    try {
      const response = await supportApi.getConversation(conversationId);
      setDetail(response.data);
      if (markRead) {
        await supportApi.markConversationRead(conversationId);
        setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation));
      }
    } finally {
      setConversationLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        const [conversationResponse, playersResponse] = await Promise.all([supportApi.getConversations(), usersApi.getAll()]);
        if (cancelled) return;
        setConversations(conversationResponse.data.conversations);
        setPlayers(playersResponse.data.users ?? []);
        setSelectedConversationId((current) => current ?? conversationResponse.data.conversations[0]?.id ?? null);
      } catch (error) {
        console.error('Failed to bootstrap messaging center:', error);
        toast({ title: 'Messagerie indisponible', description: 'Impossible de charger les conversations.', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    bootstrap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setDetail(null);
      return;
    }
    loadConversation(selectedConversationId, true).catch((error) => {
      console.error('Failed to load conversation:', error);
      toast({ title: 'Conversation indisponible', description: 'Impossible d\'ouvrir cette conversation.', variant: 'destructive' });
    });
  }, [selectedConversationId]);

  useEffect(() => {
    const key = `messaging-rules-seen-${user?.id ?? 'anon'}`;
    if (user && !localStorage.getItem(key)) {
      setRespectOpen(true);
    }
  }, [user?.id]);

  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(location.search);
    const conversationId = params.get('conversation');
    if (initializedFromQueryRef.current || !conversationId) return;
    initializedFromQueryRef.current = true;
    setSelectedConversationId(conversationId);
  }, [loading, location.search]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refreshConversations().catch(() => {});
      if (selectedConversationIdSafe) {
        loadConversation(selectedConversationIdSafe, false).catch(() => {});
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [selectedConversationIdSafe]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      refreshConversations().catch(() => {});
      if (selectedConversationIdSafe) {
        loadConversation(selectedConversationIdSafe, false).catch(() => {});
      }
    };
    socket.on('messaging:message', refresh);
    socket.on('messaging:conversation', refresh);
    socket.on('support:message', refresh);
    return () => {
      socket.off('messaging:message', refresh);
      socket.off('messaging:conversation', refresh);
      socket.off('support:message', refresh);
    };
  }, [socket, selectedConversationIdSafe]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [detail?.messages.length, selectedConversationIdSafe]);

  const filteredConversations = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((conversation) => {
      const names = [conversation.displayName, conversation.title ?? '', ...conversation.participants.map((entry) => entry.user.username)].join(' ').toLowerCase();
      return names.includes(term) || getConversationPreview(conversation).toLowerCase().includes(term);
    });
  }, [conversations, deferredSearch]);

  const handleSendMessage = async () => {
    if (!selectedConversationIdSafe) return;
    const body = draft.trim();
    if (!body) return;
    try {
      setSending(true);
      await supportApi.sendConversationMessage(selectedConversationIdSafe, body);
      setDraft('');
      await refreshConversations();
      await loadConversation(selectedConversationIdSafe, false);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({ title: 'Envoi impossible', description: 'Le message n\'a pas pu etre envoye.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async () => {
    if (createParticipantIds.length === 0) return;
    if (createMode === 'DM' && createParticipantIds.length !== 1) return;
    if (createMode === 'GROUP' && createParticipantIds.length < 2) return;

    try {
      const response = await supportApi.createConversation({
        type: createMode,
        title: createMode === 'GROUP' ? createTitle.trim() : undefined,
        participantIds: createParticipantIds,
      });
      setCreateOpen(false);
      setCreateMode('DM');
      setCreateTitle('');
      setCreateParticipantIds([]);
      await refreshConversations();
      setSelectedConversationId(response.data.conversation.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      toast({ title: 'Creation impossible', description: 'Impossible d\'ouvrir cette conversation.', variant: 'destructive' });
    }
  };

  const handleReportConversation = async () => {
    if (!selectedConversation || selectedConversation.type === 'SUPPORT') return;
    try {
      await supportApi.reportConversation(selectedConversation.id, reportReason.trim() || undefined);
      setReportOpen(false);
      setReportReason('');
      toast({ title: 'Conversation signalee', description: 'Le signalement a ete envoye a l\'inbox admin.' });
    } catch (error) {
      console.error('Failed to report conversation:', error);
      toast({ title: 'Signalement impossible', description: 'Impossible d\'envoyer ce signalement.', variant: 'destructive' });
    }
  };

  const openProfileForConversation = () => {
    const other = selectedConversation?.participants.find((entry) => entry.user.id !== user?.id)?.user;
    if (selectedConversation?.type === 'DM' && other) {
      navigate(`/profile/${other.id}`);
    }
  };

  const currentMessages = detail?.messages ?? [];

  if (loading) {
    return <PageShell size="full" className="space-y-0 px-4 pb-8 lg:px-6"><div className="min-h-[calc(100vh-9rem)] rounded-[32px] border border-border/60 bg-card/80 p-6 shadow-sm" /></PageShell>;
  }

  return (
    <PageShell size="full" className="space-y-0 px-4 pb-8 lg:px-6">
      <Dialog open={respectOpen} onOpenChange={setRespectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avant d'utiliser la messagerie</DialogTitle>
            <DialogDescription>Reste respectueux, ne harcele personne, et n'utilise pas les DMs ou groupes pour mettre quelqu'un mal a l'aise.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => {
              localStorage.setItem(`messaging-rules-seen-${user?.id ?? 'anon'}`, '1');
              setRespectOpen(false);
            }}>J'ai compris</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouvelle conversation</DialogTitle>
            <DialogDescription>Crée un DM ou un groupe.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button type="button" variant={createMode === 'DM' ? 'default' : 'outline'} onClick={() => { setCreateMode('DM'); setCreateParticipantIds([]); }}>DM</Button>
              <Button type="button" variant={createMode === 'GROUP' ? 'default' : 'outline'} onClick={() => { setCreateMode('GROUP'); setCreateParticipantIds([]); }}>Groupe</Button>
            </div>
            {createMode === 'GROUP' && (
              <Input value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} placeholder="Nom du groupe (optionnel)" />
            )}
            <div className="max-h-80 overflow-y-auto rounded-2xl border border-border/60 p-3 space-y-2">
              {players.filter((player) => player.id !== user?.id).map((player) => {
                const checked = createParticipantIds.includes(player.id);
                const disabled = createMode === 'DM' && !checked && createParticipantIds.length >= 1;
                return (
                  <label key={player.id} className={cn('flex items-center gap-3 rounded-xl px-3 py-2', disabled ? 'opacity-50' : 'hover:bg-muted/50')}>
                    <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => {
                      setCreateParticipantIds((current) => value ? [...current, player.id] : current.filter((id) => id !== player.id));
                    }} />
                    <Avatar className="h-10 w-10 border border-border/50">
                      {player.profilePicture ? <AvatarImage src={resolveImageUrl(player.profilePicture)} alt={player.username} /> : null}
                      <AvatarFallback>{getInitials(player.username)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={player.usernameColor ? { color: player.usernameColor } : undefined}>{player.username}</p>
                      <p className="truncate text-xs text-muted-foreground">{player.bio?.trim() || 'Membre de la communaute'}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateConversation}>Creer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signaler cette conversation</DialogTitle>
            <DialogDescription>Les derniers messages seront transmis a l'inbox admin pour examen.</DialogDescription>
          </DialogHeader>
          <Textarea value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="Explique rapidement le probleme (optionnel)" maxLength={280} className="min-h-[120px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleReportConversation}>Envoyer le signalement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative min-h-[calc(100vh-9rem)] overflow-hidden rounded-[32px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.84))] shadow-[0_28px_90px_-48px_rgba(15,23,42,0.45)]">
        <div className="grid min-h-[calc(100vh-9rem)] lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className={cn('border-r border-border/60 bg-background/50 backdrop-blur-xl', selectedConversationIdSafe ? 'hidden lg:flex' : 'flex')}>
            <div className="flex w-full flex-col">
              <div className="border-b border-border/60 px-5 pb-5 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground/70">Aura Tracker</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">Messagerie</h1>
                    <p className="mt-1 text-sm text-muted-foreground">DMs, groupes, et support centralises au meme endroit.</p>
                  </div>
                  <Button type="button" size="icon" className="h-12 w-12 rounded-2xl" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
                <div className="relative mt-5">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une conversation" className="h-12 rounded-2xl border-border/60 bg-background/80 pl-11 pr-4" />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-2 px-3 py-4">
                  {filteredConversations.map((conversation) => {
                    const isActive = conversation.id === selectedConversationIdSafe;
                    const avatarUser = getConversationAvatar(conversation);
                    return (
                      <button key={conversation.id} type="button" onClick={() => { setSelectedConversationId(conversation.id); navigate('/messages', { replace: true }); }} className={cn('flex w-full items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition-all', isActive ? 'border-sky-400/50 bg-sky-500/10' : 'border-transparent bg-background/55 hover:border-border/60 hover:bg-background/85')}>
                        <div className="relative">
                          <Avatar className="h-12 w-12 border border-border/50">
                            {avatarUser?.profilePicture ? <AvatarImage src={resolveImageUrl(avatarUser.profilePicture)} alt={conversation.displayName} /> : null}
                            <AvatarFallback>{conversation.type === 'SUPPORT' ? 'SP' : getInitials(conversation.displayName)}</AvatarFallback>
                          </Avatar>
                          {conversation.type === 'SUPPORT' && <span className="absolute -bottom-1 -right-1 rounded-full bg-sky-500 p-1 text-white"><Shield className="h-3 w-3" /></span>}
                          {conversation.type === 'GROUP' && <span className="absolute -bottom-1 -right-1 rounded-full bg-amber-500 p-1 text-white"><Users className="h-3 w-3" /></span>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{conversation.displayName}</p>
                              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{getConversationPreview(conversation)}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <span className="text-[11px] text-muted-foreground">{conversation.lastMessage?.createdAt ? formatMessageTime(conversation.lastMessage.createdAt) : '-'}</span>
                              {conversation.unreadCount > 0 && <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-sky-500 px-2 py-1 text-[11px] font-semibold text-white">{conversation.unreadCount}</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </aside>

          <section className={cn('flex min-h-[calc(100vh-9rem)] min-w-0 flex-col', selectedConversationIdSafe ? 'flex' : 'hidden lg:flex')}>
            {selectedConversation ? (
              <>
                <div className="border-b border-border/60 bg-background/45 px-4 py-4 backdrop-blur-xl sm:px-6">
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="ghost" size="icon" className="rounded-full lg:hidden" onClick={() => setSelectedConversationId(null)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Avatar className="h-11 w-11 border border-border/60">
                      {getConversationAvatar(selectedConversation)?.profilePicture ? <AvatarImage src={resolveImageUrl(getConversationAvatar(selectedConversation)!.profilePicture!)} alt={selectedConversation.displayName} /> : null}
                      <AvatarFallback>{selectedConversation.type === 'SUPPORT' ? 'SP' : getInitials(selectedConversation.displayName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <button type="button" className="truncate text-left text-base font-semibold transition hover:opacity-80" onClick={openProfileForConversation}>
                        {selectedConversation.displayName}
                      </button>
                      <p className="truncate text-sm text-muted-foreground">
                        {selectedConversation.type === 'SUPPORT' ? 'Support prioritaire, toujours epingle en haut.' : selectedConversation.type === 'GROUP' ? 'Conversation de groupe' : 'Discussion privee entre joueurs'}
                      </p>
                    </div>
                    {selectedConversation.type !== 'SUPPORT' && (
                      <Button type="button" variant="outline" className="rounded-full" onClick={() => setReportOpen(true)}>
                        <ShieldAlert className="h-4 w-4" />
                        Signaler
                      </Button>
                    )}
                  </div>
                </div>
                <div className="relative flex-1 overflow-hidden">
                  <ScrollArea className="h-full px-4 py-6 sm:px-6">
                    <div className="mx-auto flex max-w-3xl flex-col gap-3">
                      <div className="mb-3 flex justify-center">
                        <div className="rounded-full border border-border/60 bg-background/80 px-4 py-2 text-xs text-muted-foreground shadow-sm">
                          Conversation ouverte {selectedConversation.lastMessage?.createdAt ? formatMessageMeta(selectedConversation.lastMessage.createdAt) : 'recemment'}
                        </div>
                      </div>
                      {conversationLoading ? (
                        <Card className="rounded-[24px] border-border/60 bg-background/75 p-6 text-sm text-muted-foreground">Chargement des messages...</Card>
                      ) : currentMessages.length === 0 ? (
                        <Card className="rounded-[28px] border-border/60 bg-background/75 p-8 text-center shadow-sm">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/50"><MessagesSquare className="h-6 w-6 text-muted-foreground" /></div>
                          <h2 className="mt-4 text-lg font-semibold">Lance la conversation</h2>
                          <p className="mt-2 text-sm text-muted-foreground">Envoie un premier message pour demarrer cet echange.</p>
                        </Card>
                      ) : currentMessages.map((message) => {
                        const isOwnMessage = (message.sender?.id ?? message.userId) === user?.id && !message.fromAdmin;
                        const supportImages = message.images ? JSON.parse(message.images) as string[] : [];
                        return (
                          <div key={message.id} className={cn('flex', isOwnMessage ? 'justify-end' : 'justify-start')}>
                            <div className={cn('max-w-[85%] rounded-[26px] px-4 py-3 shadow-sm sm:max-w-[72%]', isOwnMessage ? 'rounded-br-md bg-sky-500 text-white' : 'rounded-bl-md border border-border/60 bg-background/88 text-foreground')}>
                              {!isOwnMessage && <p className="mb-1 text-xs font-semibold" style={message.sender?.usernameColor ? { color: message.sender.usernameColor } : undefined}>{message.sender?.username ?? (message.fromAdmin ? 'Support' : 'Systeme')}</p>}
                              {supportImages.length > 0 && <div className="mb-2 flex flex-wrap gap-2">{supportImages.map((image, index) => <img key={index} src={resolveImageUrl(image)} alt={`Support ${index + 1}`} className="h-20 w-20 rounded-lg object-cover" />)}</div>}
                              <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                              <p className={cn('mt-2 text-[11px]', isOwnMessage ? 'text-white/75' : 'text-muted-foreground')}>{formatMessageTime(message.createdAt)}</p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>
                <div className="border-t border-border/60 bg-background/55 px-4 py-4 backdrop-blur-xl sm:px-6">
                  <div className="mx-auto flex max-w-3xl flex-col gap-3">
                    <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        if (!sending) void handleSendMessage();
                      }
                    }} placeholder={`Envoyer un message dans ${selectedConversation.displayName}`} className="min-h-[88px] resize-none rounded-[24px] border-border/60 bg-background/85 px-4 py-3" maxLength={1000} />
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" />Entree pour envoyer, Maj + Entree pour passer a la ligne</p>
                      <Button type="button" className="rounded-full px-5" disabled={sending || !draft.trim()} onClick={() => void handleSendMessage()}>
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
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-border/60 bg-muted/50"><MessageCircleMore className="h-7 w-7 text-muted-foreground" /></div>
                  <h2 className="mt-5 text-2xl font-semibold tracking-tight">Centre de messagerie</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">Choisis une conversation sur la gauche ou cree un nouveau DM / groupe.</p>
                </Card>
              </div>
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
}


import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowLeft,
  MessageCircleMore,
  MessagesSquare,
  Plus,
  Search,
  SendHorizonal,
  Settings2,
  Shield,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
import { useAuth } from '@/contexts/AuthContext';
import { useSocketBase } from '@/contexts/SocketContext';
import { toast } from '@/hooks/use-toast';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { MessagingConversationDetail, MessagingConversationSummary, SocialUser, supportApi, usersApi } from '@/services/api';

const POLL_INTERVAL_MS = 15000;

const GROUP_ICONS = ['👥', '🎮', '🎯', '🏆', '💬', '🔥', '⚡', '🌟', '🎲', '🎪', '🚀', '🎭', '🦁', '🐉', '💎', '🌈'];

const formatMessageTime = (value: string) => {
  const date = new Date(value);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Hier';
  return format(date, 'dd MMM', { locale: fr });
};

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
  const [createSearch, setCreateSearch] = useState('');
  const [createParticipantIds, setCreateParticipantIds] = useState<string[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [respectOpen, setRespectOpen] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [groupEditName, setGroupEditName] = useState('');
  const [groupEditIcon, setGroupEditIcon] = useState('');
  const [groupSettingsSaving, setGroupSettingsSaving] = useState(false);
  const initializedFromQueryRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const deferredSearch = useDeferredValue(search);
  const selectedConversation = detail?.conversation ?? conversations.find((c) => c.id === selectedConversationId) ?? null;
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
        setConversations((current) => current.map((c) => c.id === conversationId ? { ...c, unreadCount: 0 } : c));
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
    if (!selectedConversationId) { setDetail(null); return; }
    loadConversation(selectedConversationId, true).catch((error) => {
      console.error('Failed to load conversation:', error);
      toast({ title: 'Conversation indisponible', description: 'Impossible d\'ouvrir cette conversation.', variant: 'destructive' });
    });
  }, [selectedConversationId]);

  useEffect(() => {
    const key = `messaging-rules-seen-${user?.id ?? 'anon'}`;
    if (user && !localStorage.getItem(key)) setRespectOpen(true);
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
      if (selectedConversationIdSafe) loadConversation(selectedConversationIdSafe, false).catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [selectedConversationIdSafe]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      refreshConversations().catch(() => {});
      if (selectedConversationIdSafe) loadConversation(selectedConversationIdSafe, false).catch(() => {});
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
    return conversations.filter((c) => {
      const names = [c.displayName, c.title ?? '', ...c.participants.map((e) => e.user.username)].join(' ').toLowerCase();
      return names.includes(term) || getConversationPreview(c).toLowerCase().includes(term);
    });
  }, [conversations, deferredSearch]);

  const filteredPlayers = useMemo(() => {
    const term = createSearch.trim().toLowerCase();
    const list = players.filter((p) => p.id !== user?.id);
    if (!term) return list;
    return list.filter((p) => p.username.toLowerCase().includes(term) || (p.bio ?? '').toLowerCase().includes(term));
  }, [players, user?.id, createSearch]);

  const handleSendMessage = async () => {
    if (!selectedConversationIdSafe) return;
    const body = draft.trim();
    if (!body) return;
    try {
      setSending(true);
      await supportApi.sendConversationMessage(selectedConversationIdSafe, body);
      setDraft('');
      if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
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
      setCreateSearch('');
      setCreateParticipantIds([]);
      await refreshConversations();
      setSelectedConversationId(response.data.conversation.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      toast({ title: 'Creation impossible', description: 'Impossible de creer cette conversation.', variant: 'destructive' });
    }
  };

  const handleReportConversation = async () => {
    if (!selectedConversation || selectedConversation.type === 'SUPPORT') return;
    try {
      await supportApi.reportConversation(selectedConversation.id, reportReason.trim() || undefined);
      setReportOpen(false);
      setReportReason('');
      toast({ title: 'Conversation signalee', description: 'Le signalement a ete envoye.' });
    } catch (error) {
      console.error('Failed to report conversation:', error);
      toast({ title: 'Signalement impossible', description: 'Impossible d\'envoyer ce signalement.', variant: 'destructive' });
    }
  };

  const handleSaveGroupSettings = async () => {
    if (!selectedConversation || selectedConversation.type !== 'GROUP') return;
    setGroupSettingsSaving(true);
    try {
      await supportApi.updateConversation(selectedConversation.id, {
        title: groupEditName,
        icon: groupEditIcon,
      });
      await refreshConversations();
      if (selectedConversationIdSafe) await loadConversation(selectedConversationIdSafe, false);
      setGroupSettingsOpen(false);
    } catch (error) {
      console.error('Failed to save group settings:', error);
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder les parametres.', variant: 'destructive' });
    } finally {
      setGroupSettingsSaving(false);
    }
  };

  const handleHeaderClick = () => {
    if (!selectedConversation) return;
    if (selectedConversation.type === 'GROUP') {
      setGroupEditName(selectedConversation.title ?? '');
      setGroupEditIcon(selectedConversation.icon ?? '');
      setGroupSettingsOpen(true);
    } else if (selectedConversation.type === 'DM') {
      const other = selectedConversation.participants.find((e) => e.user.id !== user?.id)?.user;
      if (other) navigate(`/profile/${other.id}`);
    }
  };

  const currentMessages = detail?.messages ?? [];

  if (loading) {
    return (
      <PageShell size="full" className="space-y-0 px-4 pb-8 lg:px-6">
        <div className="min-h-[calc(100vh-9rem)] rounded-2xl border border-border/60 bg-card" />
      </PageShell>
    );
  }

  return (
    <PageShell size="full" className="space-y-0 px-4 pb-8 lg:px-6">
      {/* Respect modal */}
      <Dialog open={respectOpen} onOpenChange={setRespectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Avant d'utiliser la messagerie</DialogTitle>
            <DialogDescription>Reste respectueux, ne harcele personne, et n'utilise pas les DMs ou groupes pour mettre quelqu'un mal a l'aise.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" onClick={() => { localStorage.setItem(`messaging-rules-seen-${user?.id ?? 'anon'}`, '1'); setRespectOpen(false); }}>J'ai compris</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create conversation modal */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setCreateSearch(''); setCreateParticipantIds([]); setCreateTitle(''); setCreateMode('DM'); } }}>
        <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
          <div className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Nouvelle conversation</DialogTitle>
          </div>
          <div className="flex border-b border-border/60">
            <button
              type="button"
              onClick={() => { setCreateMode('DM'); setCreateParticipantIds([]); }}
              className={cn('flex-1 py-2 text-xs font-medium transition-colors', createMode === 'DM' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50 text-muted-foreground')}
            >
              Message privé
            </button>
            <button
              type="button"
              onClick={() => { setCreateMode('GROUP'); setCreateParticipantIds([]); }}
              className={cn('flex-1 py-2 text-xs font-medium transition-colors', createMode === 'GROUP' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50 text-muted-foreground')}
            >
              Groupe
            </button>
          </div>
          <div className="p-3 space-y-2">
            {createMode === 'GROUP' && (
              <Input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Nom du groupe (optionnel)"
                className="h-8 text-sm"
              />
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={createSearch}
                onChange={(e) => setCreateSearch(e.target.value)}
                placeholder="Rechercher un joueur..."
                className="h-8 pl-8 text-xs"
              />
            </div>
            {createMode === 'GROUP' && createParticipantIds.length > 0 && (
              <p className="text-xs text-muted-foreground">{createParticipantIds.length} selectionne{createParticipantIds.length > 1 ? 's' : ''}</p>
            )}
          </div>
          <ScrollArea className="max-h-64 border-t border-border/60">
            <div className="divide-y divide-border/40">
              {filteredPlayers.map((player) => {
                const checked = createParticipantIds.includes(player.id);
                const disabled = createMode === 'DM' && !checked && createParticipantIds.length >= 1;
                return (
                  <label
                    key={player.id}
                    className={cn('flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors', disabled ? 'cursor-not-allowed opacity-40' : checked ? 'bg-primary/8' : 'hover:bg-muted/40')}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(value) => {
                        setCreateParticipantIds((current) => value ? [...current, player.id] : current.filter((id) => id !== player.id));
                      }}
                      className="shrink-0"
                    />
                    <Avatar className="h-7 w-7 shrink-0">
                      {player.profilePicture ? <AvatarImage src={resolveImageUrl(player.profilePicture)} alt={player.username} /> : null}
                      <AvatarFallback className="text-[10px]">{getInitials(player.username)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm font-medium" style={player.usernameColor ? { color: player.usernameColor } : undefined}>
                      {player.username}
                    </span>
                  </label>
                );
              })}
              {filteredPlayers.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">Aucun joueur trouve.</p>
              )}
            </div>
          </ScrollArea>
          <div className="flex items-center justify-end gap-2 border-t border-border/60 px-3 py-2.5">
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              size="sm"
              disabled={createParticipantIds.length === 0 || (createMode === 'DM' && createParticipantIds.length !== 1) || (createMode === 'GROUP' && createParticipantIds.length < 2)}
              onClick={handleCreateConversation}
            >
              Creer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report modal */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Signaler cette conversation</DialogTitle>
            <DialogDescription className="text-xs">Les derniers messages seront transmis a l'inbox admin.</DialogDescription>
          </DialogHeader>
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Explique rapidement le probleme (optionnel)"
            maxLength={280}
            rows={3}
            className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setReportOpen(false)}>Annuler</Button>
            <Button variant="destructive" size="sm" onClick={handleReportConversation}>Signaler</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group settings modal */}
      <Dialog open={groupSettingsOpen} onOpenChange={setGroupSettingsOpen}>
        <DialogContent className="max-w-sm gap-0 p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Parametres du groupe</DialogTitle>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Nom du groupe</p>
              <Input
                value={groupEditName}
                onChange={(e) => setGroupEditName(e.target.value)}
                placeholder="Nom du groupe"
                className="h-8 text-sm"
                maxLength={80}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Icone du groupe</p>
              <div className="grid grid-cols-8 gap-1">
                {GROUP_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setGroupEditIcon(groupEditIcon === emoji ? '' : emoji)}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors',
                      groupEditIcon === emoji ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-muted/60'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {groupEditIcon && (
                <button
                  type="button"
                  onClick={() => setGroupEditIcon('')}
                  className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />Retirer l'icone
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/60 px-4 py-2.5">
            <Button variant="ghost" size="sm" onClick={() => setGroupSettingsOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={groupSettingsSaving} onClick={handleSaveGroupSettings}>
              {groupSettingsSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main layout */}
      <div className="relative min-h-[calc(100vh-9rem)] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="grid min-h-[calc(100vh-9rem)] lg:grid-cols-[300px_minmax(0,1fr)]">

          {/* Sidebar */}
          <aside className={cn('flex flex-col border-r border-border/60 bg-card', selectedConversationIdSafe ? 'hidden lg:flex' : 'flex')}>
            {/* Sidebar header */}
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
              <h1 className="flex-1 text-sm font-semibold">Messages</h1>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {/* Search */}
            <div className="border-b border-border/60 px-3 py-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full rounded-lg border border-border/60 bg-background/60 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary/50 focus:bg-background"
                />
              </div>
            </div>
            {/* Conversation list */}
            <ScrollArea className="flex-1">
              <div className="py-1">
                {filteredConversations.map((conversation) => {
                  const isActive = conversation.id === selectedConversationIdSafe;
                  const avatarUser = getConversationAvatar(conversation);
                  const hasIcon = conversation.type === 'GROUP' && conversation.icon;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => { setSelectedConversationId(conversation.id); navigate('/messages', { replace: true }); }}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                        isActive ? 'bg-primary/10' : 'hover:bg-muted/50'
                      )}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9">
                          {hasIcon ? (
                            <AvatarFallback className="text-base">{conversation.icon}</AvatarFallback>
                          ) : avatarUser?.profilePicture ? (
                            <AvatarImage src={resolveImageUrl(avatarUser.profilePicture)} alt={conversation.displayName} />
                          ) : null}
                          {!hasIcon && <AvatarFallback className="text-xs">{conversation.type === 'SUPPORT' ? 'SP' : getInitials(conversation.displayName)}</AvatarFallback>}
                        </Avatar>
                        {conversation.type === 'SUPPORT' && <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-sky-500 p-0.5"><Shield className="h-2.5 w-2.5 text-white" /></span>}
                        {conversation.type === 'GROUP' && !hasIcon && <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-amber-500 p-0.5"><Users className="h-2.5 w-2.5 text-white" /></span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className={cn('truncate text-xs font-semibold', isActive && 'text-primary')}>{conversation.displayName}</p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{conversation.lastMessage?.createdAt ? formatMessageTime(conversation.lastMessage.createdAt) : ''}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-[11px] text-muted-foreground">{getConversationPreview(conversation)}</p>
                          {conversation.unreadCount > 0 && (
                            <span className="shrink-0 inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[10px] font-semibold text-primary-foreground">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filteredConversations.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">Aucune conversation.</p>
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* Chat area */}
          <section className={cn('flex min-h-[calc(100vh-9rem)] min-w-0 flex-col', selectedConversationIdSafe ? 'flex' : 'hidden lg:flex')}>
            {selectedConversation ? (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-2 border-b border-border/60 bg-card px-3 py-2 shadow-sm">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg lg:hidden" onClick={() => setSelectedConversationId(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    className="flex items-center gap-2 min-w-0 flex-1 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted/50 text-left"
                    onClick={handleHeaderClick}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      {selectedConversation.type === 'GROUP' && selectedConversation.icon ? (
                        <AvatarFallback className="text-base">{selectedConversation.icon}</AvatarFallback>
                      ) : getConversationAvatar(selectedConversation)?.profilePicture ? (
                        <AvatarImage src={resolveImageUrl(getConversationAvatar(selectedConversation)!.profilePicture!)} alt={selectedConversation.displayName} />
                      ) : null}
                      {!(selectedConversation.type === 'GROUP' && selectedConversation.icon) && !(getConversationAvatar(selectedConversation)?.profilePicture) && (
                        <AvatarFallback className="text-xs">{selectedConversation.type === 'SUPPORT' ? 'SP' : getInitials(selectedConversation.displayName)}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight">{selectedConversation.displayName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {selectedConversation.type === 'SUPPORT' ? 'Support' : selectedConversation.type === 'GROUP' ? `${selectedConversation.participants.length} membres` : 'Discussion privee'}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {selectedConversation.type === 'GROUP' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg text-muted-foreground"
                        onClick={() => { setGroupEditName(selectedConversation.title ?? ''); setGroupEditIcon(selectedConversation.icon ?? ''); setGroupSettingsOpen(true); }}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    )}
                    {selectedConversation.type !== 'SUPPORT' && (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => setReportOpen(true)}>
                        <ShieldAlert className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="relative flex-1 overflow-hidden bg-muted/20">
                  <ScrollArea className="h-full px-3 py-4 sm:px-5">
                    <div className="mx-auto flex max-w-2xl flex-col gap-1.5">
                      {conversationLoading ? (
                        <p className="py-8 text-center text-xs text-muted-foreground">Chargement...</p>
                      ) : currentMessages.length === 0 ? (
                        <div className="flex flex-col items-center py-12 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-card">
                            <MessagesSquare className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="mt-3 text-sm font-medium">Lance la conversation</p>
                          <p className="mt-1 text-xs text-muted-foreground">Envoie un premier message.</p>
                        </div>
                      ) : currentMessages.map((message, index) => {
                        const isOwn = (message.sender?.id ?? message.userId) === user?.id && !message.fromAdmin;
                        const prevMessage = currentMessages[index - 1];
                        const prevIsOwn = prevMessage ? (prevMessage.sender?.id ?? prevMessage.userId) === user?.id && !prevMessage.fromAdmin : false;
                        const showSender = !isOwn && (!prevMessage || prevIsOwn || prevMessage.sender?.id !== message.sender?.id);
                        const supportImages = message.images ? JSON.parse(message.images) as string[] : [];
                        return (
                          <div key={message.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                            <div className={cn(
                              'max-w-[75%] rounded-2xl px-3 py-2 text-sm sm:max-w-[60%]',
                              isOwn
                                ? 'rounded-br-sm bg-primary text-primary-foreground'
                                : 'rounded-bl-sm bg-card border border-border/60 text-foreground'
                            )}>
                              {showSender && (
                                <p className="mb-0.5 text-[11px] font-semibold" style={message.sender?.usernameColor ? { color: message.sender.usernameColor } : undefined}>
                                  {message.sender?.username ?? (message.fromAdmin ? 'Support' : 'Systeme')}
                                </p>
                              )}
                              {supportImages.length > 0 && (
                                <div className="mb-1.5 flex flex-wrap gap-1.5">
                                  {supportImages.map((img, i) => <img key={i} src={resolveImageUrl(img)} alt="" className="h-16 w-16 rounded-lg object-cover" />)}
                                </div>
                              )}
                              <p className="whitespace-pre-wrap break-words leading-5">{message.body}</p>
                              <p className={cn('mt-1 text-[10px] text-right', isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                                {formatMessageTime(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>

                {/* Inline input bar */}
                <div className="border-t border-border/60 bg-card px-3 py-2.5 sm:px-4">
                  <div className="mx-auto flex max-w-2xl items-end gap-2">
                    <div className="flex-1 rounded-2xl border border-border/60 bg-background/80 px-3 py-2 focus-within:border-primary/50 focus-within:bg-background transition-colors">
                      <textarea
                        ref={textareaRef}
                        value={draft}
                        rows={1}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          e.currentTarget.style.height = 'auto';
                          e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 112) + 'px';
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (!sending) void handleSendMessage();
                          }
                        }}
                        placeholder={`Message ${selectedConversation.displayName}`}
                        className="w-full resize-none bg-transparent text-sm outline-none leading-5 placeholder:text-muted-foreground/60"
                        maxLength={1000}
                        style={{ height: 'auto', minHeight: '20px' }}
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-xl"
                      disabled={sending || !draft.trim()}
                      onClick={() => void handleSendMessage()}
                    >
                      <SendHorizonal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/40">
                    <MessageCircleMore className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="mt-3 text-sm font-medium">Aucune conversation selectionnee</p>
                  <p className="mt-1 text-xs text-muted-foreground">Choisis une conversation ou cree un nouveau DM.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
}

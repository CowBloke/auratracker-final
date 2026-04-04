import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Camera,
  MessageCircleMore,
  MessagesSquare,
  MoreVertical,
  Plus,
  Search,
  SendHorizonal,
  Settings2,
  Shield,
  ShieldAlert,
  Star,
  UserMinus,
  UserPlus,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useSocketBase } from '@/contexts/SocketContext';
import { toast } from '@/hooks/use-toast';
import { prepareImageUploadPayload } from '@/lib/image-upload';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import {
  MessagingConversationDetail,
  MessagingConversationSummary,
  SocialUser,
  supportApi,
  uploadUserImage,
  usersApi,
} from '@/services/api';

const POLL_INTERVAL_MS = 15000;

const REACTION_OPTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

const GROUP_ICONS = ['👥', '🎮', '🎯', '🏆', '💬', '🔥', '⚡', '🌟', '🎲', '🎪', '🚀', '🎭', '🦁', '🐉', '💎', '🌈'];

const formatTime = (value: string) => {
  const date = new Date(value);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Hier';
  return format(date, 'dd MMM', { locale: fr });
};

const getInitials = (name?: string | null) => ((name ?? '?').trim().slice(0, 2) || '?').toUpperCase();
const getPreview = (c: MessagingConversationSummary) => c.lastMessage?.body || 'Commence la discussion.';

function ConversationAvatar({ conversation, size = 'md' }: { conversation: MessagingConversationSummary; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-10 w-10' : 'h-9 w-9';
  const fallbackCls = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const avatarUser = conversation.participants.find((e) => e.user.id !== 'support')?.user ?? null;
  const hasImage = conversation.type === 'GROUP' && conversation.imageUrl;
  const hasIcon = conversation.type === 'GROUP' && conversation.icon;

  return (
    <div className="relative shrink-0">
      <Avatar className={cls}>
        {hasImage ? (
          <AvatarImage src={resolveImageUrl(conversation.imageUrl)} alt={conversation.displayName} />
        ) : avatarUser?.profilePicture && conversation.type !== 'GROUP' ? (
          <AvatarImage src={resolveImageUrl(avatarUser.profilePicture)} alt={conversation.displayName} />
        ) : null}
        <AvatarFallback className={cn(fallbackCls, hasIcon && 'text-base')}>
          {hasIcon ? conversation.icon : conversation.type === 'SUPPORT' ? 'SP' : getInitials(conversation.displayName)}
        </AvatarFallback>
      </Avatar>
      {conversation.type === 'SUPPORT' && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500">
          <Shield className="h-2 w-2 text-white" />
        </span>
      )}
      {conversation.type === 'GROUP' && !hasImage && !hasIcon && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500">
          <Users className="h-2 w-2 text-white" />
        </span>
      )}
    </div>
  );
}

export default function MessagesPage() {
  const { user } = useAuth();
  const { socket } = useSocketBase();
  const navigate = useNavigate();
  const location = useLocation();

  const [conversations, setConversations] = useState<MessagingConversationSummary[]>([]);
  const [players, setPlayers] = useState<SocialUser[]>([]);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessagingConversationDetail | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [convLoading, setConvLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'DM' | 'GROUP'>('DM');
  const [createTitle, setCreateTitle] = useState('');
  const [createSearch, setCreateSearch] = useState('');
  const [createParticipantIds, setCreateParticipantIds] = useState<string[]>([]);
  const [respectOpen, setRespectOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [groupEditName, setGroupEditName] = useState('');
  const [groupEditIcon, setGroupEditIcon] = useState('');
  const [groupEditImageUrl, setGroupEditImageUrl] = useState<string | null>(null);
  const [groupImageUploading, setGroupImageUploading] = useState(false);
  const [groupSettingsSaving, setGroupSettingsSaving] = useState(false);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [blockConfirmId, setBlockConfirmId] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const groupImageInputRef = useRef<HTMLInputElement | null>(null);

  const deferredSearch = useDeferredValue(search);
  const selectedConversation = detail?.conversation ?? conversations.find((c) => c.id === selectedId) ?? null;
  const selectedIdSafe = selectedConversation?.id ?? null;

  // ── Data Loading ─────────────────────────────────────────────────────────
  const refreshConversations = async () => {
    const r = await supportApi.getConversations();
    setConversations(r.data.conversations);
    return r.data.conversations;
  };

  const loadConversation = async (id: string, markRead = true) => {
    setConvLoading(true);
    try {
      const r = await supportApi.getConversation(id);
      setDetail(r.data);
      if (markRead) {
        await supportApi.markConversationRead(id);
        setConversations((prev) => prev.map((c) => c.id === id ? { ...c, unreadCount: 0 } : c));
      }
    } finally {
      setConvLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [convRes, playersRes, blockedRes] = await Promise.all([
          supportApi.getConversations(),
          usersApi.getAll(),
          supportApi.getBlockedUsers(),
        ]);
        if (cancelled) return;
        setConversations(convRes.data.conversations);
        setPlayers(playersRes.data.users ?? []);
        setBlockedIds(new Set(blockedRes.data.blockedUsers.map((b) => b.id)));
        setSelectedId((cur) => cur ?? convRes.data.conversations[0]?.id ?? null);
      } catch {
        toast({ title: 'Messagerie indisponible', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    loadConversation(selectedId, true).catch(() => {
      toast({ title: 'Conversation indisponible', variant: 'destructive' });
    });
  }, [selectedId]);

  useEffect(() => {
    const key = `messaging-rules-seen-${user?.id ?? 'anon'}`;
    if (user && !localStorage.getItem(key)) setRespectOpen(true);
  }, [user?.id]);

  useEffect(() => {
    if (loading) return;
    const conversationId = new URLSearchParams(location.search).get('conversation');
    if (initializedRef.current || !conversationId) return;
    initializedRef.current = true;
    setSelectedId(conversationId);
  }, [loading, location.search]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refreshConversations().catch(() => {});
      if (selectedIdSafe) loadConversation(selectedIdSafe, false).catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [selectedIdSafe]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      refreshConversations().catch(() => {});
      if (selectedIdSafe) loadConversation(selectedIdSafe, false).catch(() => {});
    };
    socket.on('messaging:message', refresh);
    socket.on('messaging:conversation', refresh);
    socket.on('support:message', refresh);
    return () => {
      socket.off('messaging:message', refresh);
      socket.off('messaging:conversation', refresh);
      socket.off('support:message', refresh);
    };
  }, [socket, selectedIdSafe]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [detail?.messages.length, selectedIdSafe]);

  // ── Filtered lists ────────────────────────────────────────────────────────
  const { favorites, regular } = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const all = term
      ? conversations.filter((c) => {
          const names = [c.displayName, c.title ?? '', ...c.participants.map((e) => e.user.username)].join(' ').toLowerCase();
          return names.includes(term) || getPreview(c).toLowerCase().includes(term);
        })
      : conversations;
    return {
      favorites: all.filter((c) => c.isFavorite),
      regular: all.filter((c) => !c.isFavorite),
    };
  }, [conversations, deferredSearch]);

  const filteredPlayers = useMemo(() => {
    const term = createSearch.trim().toLowerCase();
    const base = players.filter((p) => p.id !== user?.id);
    if (!term) return base;
    return base.filter((p) => p.username.toLowerCase().includes(term));
  }, [players, user?.id, createSearch]);

  const nonMembers = useMemo(() => {
    if (!selectedConversation) return players.filter((p) => p.id !== user?.id);
    const memberIds = new Set(selectedConversation.participants.map((e) => e.user.id));
    const term = addMemberSearch.trim().toLowerCase();
    return players.filter((p) => !memberIds.has(p.id) && p.id !== user?.id && (!term || p.username.toLowerCase().includes(term)));
  }, [players, selectedConversation, user?.id, addMemberSearch]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!selectedIdSafe || !draft.trim() || sending) return;
    const body = draft.trim();
    setSending(true);
    setDraft('');
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
    try {
      await supportApi.sendConversationMessage(selectedIdSafe, body);
      await Promise.all([refreshConversations(), loadConversation(selectedIdSafe, false)]);
    } catch {
      toast({ title: 'Envoi impossible', variant: 'destructive' });
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async () => {
    if (!createParticipantIds.length) return;
    if (createMode === 'DM' && createParticipantIds.length !== 1) return;
    if (createMode === 'GROUP' && createParticipantIds.length < 2) return;
    try {
      const r = await supportApi.createConversation({
        type: createMode,
        title: createMode === 'GROUP' ? createTitle.trim() : undefined,
        participantIds: createParticipantIds,
      });
      setCreateOpen(false);
      setCreateMode('DM'); setCreateTitle(''); setCreateSearch(''); setCreateParticipantIds([]);
      await refreshConversations();
      setSelectedId(r.data.conversation.id);
    } catch {
      toast({ title: 'Creation impossible', variant: 'destructive' });
    }
  };

  const handleReport = async () => {
    if (!selectedConversation || selectedConversation.type === 'SUPPORT') return;
    try {
      await supportApi.reportConversation(selectedConversation.id, reportReason.trim() || undefined);
      setReportOpen(false); setReportReason('');
      toast({ title: 'Signalement envoyé' });
    } catch {
      toast({ title: 'Signalement impossible', variant: 'destructive' });
    }
  };

  const handleToggleFavorite = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const r = await supportApi.toggleFavorite(id);
      setConversations((prev) => prev.map((c) => c.id === id ? { ...c, isFavorite: r.data.isFavorite } : c));
      if (detail?.conversation.id === id) {
        setDetail((prev) => prev ? { ...prev, conversation: { ...prev.conversation, isFavorite: r.data.isFavorite } } : prev);
      }
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const handleGroupImageUpload = async (file: File) => {
    setGroupImageUploading(true);
    try {
      const payload = await prepareImageUploadPayload(file);
      const r = await uploadUserImage(payload);
      setGroupEditImageUrl(r.data.imageUrl);
    } catch {
      toast({ title: 'Upload impossible', variant: 'destructive' });
    } finally {
      setGroupImageUploading(false);
    }
  };

  const handleSaveGroupSettings = async () => {
    if (!selectedConversation || selectedConversation.type !== 'GROUP') return;
    setGroupSettingsSaving(true);
    try {
      await supportApi.updateConversation(selectedConversation.id, {
        title: groupEditName,
        icon: groupEditIcon,
        imageUrl: groupEditImageUrl ?? '',
      });
      await Promise.all([refreshConversations(), selectedIdSafe ? loadConversation(selectedIdSafe, false) : Promise.resolve()]);
      setGroupSettingsOpen(false);
    } catch {
      toast({ title: 'Erreur de sauvegarde', variant: 'destructive' });
    } finally {
      setGroupSettingsSaving(false);
    }
  };

  const handleKickMember = async (memberId: string) => {
    if (!selectedIdSafe) return;
    try {
      await supportApi.removeMember(selectedIdSafe, memberId);
      await Promise.all([refreshConversations(), loadConversation(selectedIdSafe, false)]);
      toast({ title: 'Membre retiré' });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const handleAddMember = async (memberId: string) => {
    if (!selectedIdSafe) return;
    try {
      await supportApi.addMember(selectedIdSafe, memberId);
      await Promise.all([refreshConversations(), loadConversation(selectedIdSafe, false)]);
      toast({ title: 'Membre ajouté' });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!selectedIdSafe) return;
    try {
      await supportApi.reactToMessage(selectedIdSafe, messageId, emoji);
      await loadConversation(selectedIdSafe, false);
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const handleBlock = async (userId: string) => {
    try {
      if (blockedIds.has(userId)) {
        await supportApi.unblockUser(userId);
        setBlockedIds((prev) => { const s = new Set(prev); s.delete(userId); return s; });
        toast({ title: 'Utilisateur débloqué' });
      } else {
        await supportApi.blockUser(userId);
        setBlockedIds((prev) => new Set([...prev, userId]));
        toast({ title: 'Utilisateur bloqué' });
      }
      setBlockConfirmId(null);
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const openGroupSettings = () => {
    if (!selectedConversation || selectedConversation.type !== 'GROUP') return;
    setGroupEditName(selectedConversation.title ?? '');
    setGroupEditIcon(selectedConversation.icon ?? '');
    setGroupEditImageUrl(selectedConversation.imageUrl ?? null);
    setGroupSettingsOpen(true);
  };

  const handleHeaderClick = () => {
    if (!selectedConversation) return;
    if (selectedConversation.type === 'GROUP') openGroupSettings();
    else if (selectedConversation.type === 'DM') {
      const other = selectedConversation.participants.find((e) => e.user.id !== user?.id)?.user;
      if (other) navigate(`/profile/${other.id}`);
    }
  };

  const dmOtherUser = selectedConversation?.type === 'DM'
    ? selectedConversation.participants.find((e) => e.user.id !== user?.id)?.user
    : null;

  const currentMessages = detail?.messages ?? [];

  if (loading) {
    return (
      <PageShell size="full" className="space-y-0 px-4 pb-8 lg:px-6">
        <div className="min-h-[calc(100vh-9rem)] rounded-2xl border border-border/60 bg-card" />
      </PageShell>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PageShell size="full" className="space-y-0 px-4 pb-8 lg:px-6">

      {/* ── Respect modal ── */}
      <Dialog open={respectOpen} onOpenChange={setRespectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Avant d'utiliser la messagerie
            </DialogTitle>
            <DialogDescription>
              Reste respectueux, ne harcèle personne, et n'utilise pas les DMs ou groupes pour mettre quelqu'un mal à l'aise.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" onClick={() => { localStorage.setItem(`messaging-rules-seen-${user?.id ?? 'anon'}`, '1'); setRespectOpen(false); }}>
              J'ai compris
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create conversation modal ── */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setCreateSearch(''); setCreateParticipantIds([]); setCreateTitle(''); setCreateMode('DM'); } }}>
        <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
          <div className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Nouvelle conversation</DialogTitle>
          </div>
          <div className="flex border-b border-border/60">
            {(['DM', 'GROUP'] as const).map((mode) => (
              <button key={mode} type="button"
                onClick={() => { setCreateMode(mode); setCreateParticipantIds([]); }}
                className={cn('flex-1 py-2 text-xs font-medium transition-colors', createMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50')}
              >
                {mode === 'DM' ? 'Message privé' : 'Groupe'}
              </button>
            ))}
          </div>
          <div className="space-y-2 p-3">
            {createMode === 'GROUP' && (
              <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Nom du groupe (optionnel)" className="h-8 text-sm" />
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={createSearch} onChange={(e) => setCreateSearch(e.target.value)} placeholder="Rechercher..." className="h-8 pl-8 text-xs" />
            </div>
            {createMode === 'GROUP' && createParticipantIds.length > 0 && (
              <p className="text-xs text-muted-foreground">{createParticipantIds.length} sélectionné{createParticipantIds.length > 1 ? 's' : ''}</p>
            )}
          </div>
          <ScrollArea className="max-h-56 border-t border-border/60">
            <div className="divide-y divide-border/40">
              {filteredPlayers.map((player) => {
                const checked = createParticipantIds.includes(player.id);
                const disabled = createMode === 'DM' && !checked && createParticipantIds.length >= 1;
                return (
                  <label key={player.id} className={cn('flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors', disabled ? 'cursor-not-allowed opacity-40' : checked ? 'bg-primary/8' : 'hover:bg-muted/40')}>
                    <Checkbox checked={checked} disabled={disabled}
                      onCheckedChange={(v) => setCreateParticipantIds((cur) => v ? [...cur, player.id] : cur.filter((id) => id !== player.id))}
                      className="shrink-0" />
                    <Avatar className="h-7 w-7 shrink-0">
                      {player.profilePicture ? <AvatarImage src={resolveImageUrl(player.profilePicture)} alt={player.username} /> : null}
                      <AvatarFallback className="text-[10px]">{getInitials(player.username)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm font-medium" style={player.usernameColor ? { color: player.usernameColor } : undefined}>{player.username}</span>
                    {blockedIds.has(player.id) && <Ban className="ml-auto h-3 w-3 shrink-0 text-destructive" />}
                  </label>
                );
              })}
              {filteredPlayers.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">Aucun joueur trouvé.</p>}
            </div>
          </ScrollArea>
          <div className="flex items-center justify-end gap-2 border-t border-border/60 px-3 py-2.5">
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button size="sm"
              disabled={!createParticipantIds.length || (createMode === 'DM' && createParticipantIds.length !== 1) || (createMode === 'GROUP' && createParticipantIds.length < 2)}
              onClick={handleCreateConversation}>
              Créer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Report modal ── */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Signaler</DialogTitle>
            <DialogDescription className="text-xs">Les derniers messages seront transmis aux admins.</DialogDescription>
          </DialogHeader>
          <textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="Explique le problème (optionnel)" maxLength={280} rows={3}
            className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setReportOpen(false)}>Annuler</Button>
            <Button variant="destructive" size="sm" onClick={handleReport}>Signaler</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Block confirm modal ── */}
      <Dialog open={!!blockConfirmId} onOpenChange={() => setBlockConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {blockConfirmId && blockedIds.has(blockConfirmId) ? 'Débloquer cet utilisateur ?' : 'Bloquer cet utilisateur ?'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {blockConfirmId && blockedIds.has(blockConfirmId)
                ? 'Il pourra de nouveau vous envoyer des messages.'
                : 'Vous ne recevrez plus de messages de sa part.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setBlockConfirmId(null)}>Annuler</Button>
            <Button variant={blockConfirmId && blockedIds.has(blockConfirmId) ? 'outline' : 'destructive'} size="sm"
              onClick={() => blockConfirmId && handleBlock(blockConfirmId)}>
              {blockConfirmId && blockedIds.has(blockConfirmId) ? 'Débloquer' : 'Bloquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Group settings modal ── */}
      <Dialog open={groupSettingsOpen} onOpenChange={setGroupSettingsOpen}>
        <DialogContent className="max-w-sm gap-0 p-0 overflow-hidden">
          <div className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Paramètres du groupe</DialogTitle>
          </div>
          <div className="space-y-4 p-4">
            {/* Group photo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-14 w-14">
                  {groupEditImageUrl ? <AvatarImage src={resolveImageUrl(groupEditImageUrl)} /> : null}
                  <AvatarFallback className={cn('text-2xl', !groupEditImageUrl && groupEditIcon && 'text-2xl')}>
                    {groupEditIcon || getInitials(groupEditName || selectedConversation?.displayName)}
                  </AvatarFallback>
                </Avatar>
                <button type="button"
                  onClick={() => groupImageInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </button>
                <input ref={groupImageInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleGroupImageUpload(f); e.target.value = ''; }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">Nom du groupe</p>
                <Input value={groupEditName} onChange={(e) => setGroupEditName(e.target.value)} placeholder="Nom du groupe" className="h-8 text-sm" maxLength={80} />
              </div>
            </div>
            {groupImageUploading && <p className="text-xs text-muted-foreground">Upload en cours...</p>}
            {/* Emoji icon picker */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Icône (si pas de photo)</p>
              <div className="grid grid-cols-8 gap-1">
                {GROUP_ICONS.map((emoji) => (
                  <button key={emoji} type="button"
                    onClick={() => setGroupEditIcon(groupEditIcon === emoji ? '' : emoji)}
                    className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors', groupEditIcon === emoji ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-muted/60')}>
                    {emoji}
                  </button>
                ))}
              </div>
              {(groupEditIcon || groupEditImageUrl) && (
                <button type="button" onClick={() => { setGroupEditIcon(''); setGroupEditImageUrl(null); }}
                  className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />Retirer photo & icône
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/60 px-4 py-2.5">
            <Button variant="ghost" size="sm" onClick={() => setGroupSettingsOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={groupSettingsSaving || groupImageUploading} onClick={handleSaveGroupSettings}>
              {groupSettingsSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Manage members modal ── */}
      <Dialog open={manageMembersOpen} onOpenChange={setManageMembersOpen}>
        <DialogContent className="max-w-sm gap-0 p-0 overflow-hidden">
          <div className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Membres du groupe</DialogTitle>
          </div>
          <ScrollArea className="max-h-56">
            <div className="divide-y divide-border/40">
              {selectedConversation?.participants.map((entry) => {
                const isMe = entry.user.id === user?.id;
                const amOwner = selectedConversation.participants.find((e) => e.user.id === user?.id)?.role === 'OWNER';
                return (
                  <div key={entry.user.id} className="flex items-center gap-2.5 px-3 py-2">
                    <Avatar className="h-7 w-7 shrink-0">
                      {entry.user.profilePicture ? <AvatarImage src={resolveImageUrl(entry.user.profilePicture)} /> : null}
                      <AvatarFallback className="text-[10px]">{getInitials(entry.user.username)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm font-medium" style={entry.user.usernameColor ? { color: entry.user.usernameColor } : undefined}>
                      {entry.user.username}
                    </span>
                    {entry.role === 'OWNER' && <span className="text-[10px] text-amber-500 font-medium">Owner</span>}
                    {!isMe && amOwner && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive"
                        onClick={() => handleKickMember(entry.user.id)}>
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className="border-t border-border/60 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Ajouter un membre</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={addMemberSearch} onChange={(e) => setAddMemberSearch(e.target.value)} placeholder="Rechercher..." className="h-8 pl-8 text-xs" />
            </div>
            <ScrollArea className="max-h-36">
              <div className="divide-y divide-border/40">
                {nonMembers.filter((p) => !addMemberSearch || p.username.toLowerCase().includes(addMemberSearch.toLowerCase())).map((player) => (
                  <div key={player.id} className="flex items-center gap-2 px-1 py-1.5">
                    <Avatar className="h-6 w-6 shrink-0">
                      {player.profilePicture ? <AvatarImage src={resolveImageUrl(player.profilePicture)} /> : null}
                      <AvatarFallback className="text-[9px]">{getInitials(player.username)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-xs">{player.username}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleAddMember(player.id)}>
                      <UserPlus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {nonMembers.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">Tous les joueurs sont déjà membres.</p>}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Main layout ── */}
      <div className="relative min-h-[calc(100vh-9rem)] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="grid min-h-[calc(100vh-9rem)] lg:grid-cols-[280px_minmax(0,1fr)]">

          {/* ── Sidebar ── */}
          <aside className={cn('flex flex-col border-r border-border/60', selectedIdSafe ? 'hidden lg:flex' : 'flex')}>
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
              <h1 className="flex-1 text-sm font-semibold">Messages</h1>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="border-b border-border/60 px-3 py-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..."
                  className="w-full rounded-lg border border-border/50 bg-muted/30 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary/40 focus:bg-background transition-colors" />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="py-1">
                {favorites.length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Favoris</p>
                    {favorites.map((c) => <ConvRow key={c.id} conversation={c} isActive={c.id === selectedIdSafe} onSelect={() => { setSelectedId(c.id); navigate('/messages', { replace: true }); }} onToggleFavorite={(e) => handleToggleFavorite(c.id, e)} />)}
                    {regular.length > 0 && <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Toutes</p>}
                  </>
                )}
                {regular.map((c) => <ConvRow key={c.id} conversation={c} isActive={c.id === selectedIdSafe} onSelect={() => { setSelectedId(c.id); navigate('/messages', { replace: true }); }} onToggleFavorite={(e) => handleToggleFavorite(c.id, e)} />)}
                {favorites.length === 0 && regular.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">Aucune conversation.</p>
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* ── Chat area ── */}
          <section className={cn('flex min-h-[calc(100vh-9rem)] min-w-0 flex-col', selectedIdSafe ? 'flex' : 'hidden lg:flex')}>
            {selectedConversation ? (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-2 border-b border-border/60 bg-card px-3 py-2">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-lg lg:hidden" onClick={() => setSelectedId(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <button type="button" onClick={handleHeaderClick}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/50">
                    <ConversationAvatar conversation={selectedConversation} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight">{selectedConversation.displayName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {selectedConversation.type === 'SUPPORT' ? 'Support'
                          : selectedConversation.type === 'GROUP' ? `${selectedConversation.participants.length} membres`
                          : 'Discussion privée'}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
                      onClick={() => handleToggleFavorite(selectedConversation.id)}>
                      <Star className={cn('h-4 w-4', selectedConversation.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {selectedConversation.type === 'GROUP' && (
                          <>
                            <DropdownMenuItem onClick={openGroupSettings}>
                              <Settings2 className="mr-2 h-3.5 w-3.5" />Paramètres du groupe
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setAddMemberSearch(''); setManageMembersOpen(true); }}>
                              <Users className="mr-2 h-3.5 w-3.5" />Gérer les membres
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {selectedConversation.type === 'DM' && dmOtherUser && (
                          <>
                            <DropdownMenuItem onClick={() => setBlockConfirmId(dmOtherUser.id)}>
                              <Ban className="mr-2 h-3.5 w-3.5" />
                              {blockedIds.has(dmOtherUser.id) ? 'Débloquer' : 'Bloquer'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {selectedConversation.type !== 'SUPPORT' && (
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setReportOpen(true)}>
                            <ShieldAlert className="mr-2 h-3.5 w-3.5" />Signaler
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Messages */}
                <div className="relative flex-1 overflow-hidden bg-muted/15">
                  <ScrollArea className="h-full px-4 py-4 sm:px-6">
                    <div className="mx-auto flex max-w-2xl flex-col gap-0.5">
                      {convLoading ? (
                        <p className="py-8 text-center text-xs text-muted-foreground">Chargement...</p>
                      ) : currentMessages.length === 0 ? (
                        <div className="flex flex-col items-center py-12 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-card">
                            <MessagesSquare className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="mt-3 text-sm font-medium">Lance la conversation</p>
                          <p className="mt-1 text-xs text-muted-foreground">Envoie un premier message.</p>
                        </div>
                      ) : currentMessages.map((msg, index) => {
                        const isOwn = (msg.sender?.id ?? msg.userId) === user?.id && !msg.fromAdmin;
                        const prevMsg = currentMessages[index - 1];
                        const nextMsg = currentMessages[index + 1];
                        const prevIsOwn = prevMsg ? (prevMsg.sender?.id ?? prevMsg.userId) === user?.id && !prevMsg.fromAdmin : false;
                        const nextIsOwn = nextMsg ? (nextMsg.sender?.id ?? nextMsg.userId) === user?.id && !nextMsg.fromAdmin : false;
                        const sameSenderAsPrev = prevMsg && prevMsg.sender?.id === msg.sender?.id && prevIsOwn === isOwn;
                        const sameSenderAsNext = nextMsg && nextMsg.sender?.id === msg.sender?.id && nextIsOwn === isOwn;
                        const isFirst = !sameSenderAsPrev;
                        const isLast = !sameSenderAsNext;
                        const showAvatar = !isOwn && selectedConversation.type === 'GROUP' && isLast;
                        const showSender = !isOwn && isFirst && selectedConversation.type === 'GROUP';
                        const reactions = msg.reactions ?? [];
                        const supportImages = msg.images ? JSON.parse(msg.images) as string[] : [];
                        const isBlocked = dmOtherUser && blockedIds.has(dmOtherUser.id);
                        return (
                          <div key={msg.id}
                            className={cn('flex items-end gap-1.5', isOwn ? 'flex-row-reverse' : 'flex-row', isLast ? 'mb-1' : 'mb-0')}>
                            {/* Avatar placeholder for alignment in group */}
                            {selectedConversation.type === 'GROUP' && !isOwn && (
                              <div className="w-6 shrink-0">
                                {showAvatar && (
                                  <Avatar className="h-6 w-6">
                                    {msg.sender?.profilePicture ? <AvatarImage src={resolveImageUrl(msg.sender.profilePicture)} /> : null}
                                    <AvatarFallback className="text-[9px]">{getInitials(msg.sender?.username)}</AvatarFallback>
                                  </Avatar>
                                )}
                              </div>
                            )}
                            <div className={cn('flex max-w-[72%] flex-col', isOwn ? 'items-end' : 'items-start')}>
                              {showSender && (
                                <p className="mb-0.5 px-1 text-[11px] font-semibold" style={msg.sender?.usernameColor ? { color: msg.sender.usernameColor } : undefined}>
                                  {msg.sender?.username ?? (msg.fromAdmin ? 'Support' : 'Système')}
                                </p>
                              )}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className={cn(
                                    'group cursor-pointer select-text px-3 py-1.5 text-sm leading-5',
                                    // WhatsApp-style rounded corners: full radius except the "tail" corner
                                    isOwn
                                      ? cn('bg-primary text-primary-foreground', isFirst ? 'rounded-tl-2xl rounded-tr-2xl rounded-br-sm rounded-bl-2xl' : isLast ? 'rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl' : 'rounded-2xl rounded-tr-sm rounded-br-sm')
                                      : cn('bg-card border border-border/60 text-foreground', isFirst ? 'rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl' : isLast ? 'rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-sm' : 'rounded-2xl rounded-tl-sm rounded-bl-sm'),
                                    isBlocked && !isOwn && 'opacity-50'
                                  )}>
                                    {supportImages.length > 0 && (
                                      <div className="mb-1.5 flex flex-wrap gap-1">
                                        {supportImages.map((img, i) => <img key={i} src={resolveImageUrl(img)} alt="" className="h-16 w-16 rounded-lg object-cover" />)}
                                      </div>
                                    )}
                                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                                    <p className={cn('mt-0.5 text-right text-[10px]', isOwn ? 'text-primary-foreground/55' : 'text-muted-foreground')}>
                                      {formatTime(msg.createdAt)}
                                    </p>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-1.5" side={isOwn ? 'left' : 'right'} align="center">
                                  <div className="flex items-center gap-0.5">
                                    {REACTION_OPTIONS.map((emoji) => (
                                      <button key={emoji} type="button"
                                        onClick={() => handleReact(msg.id, emoji)}
                                        className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors hover:bg-muted/60', reactions.find((r) => r.emoji === emoji)?.myReaction && 'bg-primary/15')}>
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              {reactions.length > 0 && (
                                <div className={cn('mt-0.5 flex flex-wrap gap-1 px-1', isOwn ? 'justify-end' : 'justify-start')}>
                                  {reactions.map((r) => (
                                    <button key={r.emoji} type="button"
                                      onClick={() => handleReact(msg.id, r.emoji)}
                                      title={r.users.join(', ')}
                                      className={cn('inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors hover:bg-muted/60', r.myReaction ? 'border-primary/40 bg-primary/10' : 'border-border/60 bg-card')}>
                                      <span>{r.emoji}</span>
                                      <span className="font-medium">{r.count}</span>
                                    </button>
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
                </div>

                {/* Input bar */}
                <div className="border-t border-border/60 bg-card px-3 py-2.5 sm:px-4">
                  <div className="mx-auto flex max-w-2xl items-end gap-2">
                    <div className="flex-1 rounded-2xl border border-border/50 bg-muted/20 px-3 py-2 focus-within:border-primary/40 focus-within:bg-background transition-colors">
                      <textarea ref={textareaRef} value={draft} rows={1}
                        onChange={(e) => { setDraft(e.target.value); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 112) + 'px'; }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                        placeholder={`Message ${selectedConversation.displayName}`}
                        className="w-full resize-none bg-transparent text-sm leading-5 outline-none placeholder:text-muted-foreground/50"
                        maxLength={1000} style={{ minHeight: '20px' }} />
                    </div>
                    <Button type="button" size="icon" className="h-9 w-9 shrink-0 rounded-xl"
                      disabled={sending || !draft.trim()} onClick={() => void handleSend()}>
                      <SendHorizonal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
                    <MessageCircleMore className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="mt-3 text-sm font-medium">Aucune conversation</p>
                  <p className="mt-1 text-xs text-muted-foreground">Sélectionne une conversation ou crée un DM.</p>
                  <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Nouveau message
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
}

// ── Sidebar conversation row ──────────────────────────────────────────────────
function ConvRow({
  conversation,
  isActive,
  onSelect,
  onToggleFavorite,
}: {
  conversation: MessagingConversationSummary;
  isActive: boolean;
  onSelect: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}) {
  return (
    <button type="button" onClick={onSelect}
      className={cn('group flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors', isActive ? 'bg-primary/10' : 'hover:bg-muted/50')}>
      <ConversationAvatar conversation={conversation} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-1">
          <p className={cn('truncate text-xs font-semibold', isActive && 'text-primary')}>{conversation.displayName}</p>
          <span className="shrink-0 text-[10px] text-muted-foreground">{conversation.lastMessage?.createdAt ? formatTime(conversation.lastMessage.createdAt) : ''}</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-[11px] text-muted-foreground">{getPreview(conversation)}</p>
          {conversation.unreadCount > 0 && (
            <span className="shrink-0 inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
      <button type="button"
        onClick={onToggleFavorite}
        className={cn('ml-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity', conversation.isFavorite && 'opacity-100')}
        tabIndex={-1}>
        <Star className={cn('h-3.5 w-3.5', conversation.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
      </button>
    </button>
  );
}

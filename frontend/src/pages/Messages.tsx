import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Briefcase,
  Building2,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  Download,
  FileText,
  Gavel,
  Loader2,
  MessageCircleMore,
  MessagesSquare,
  ImagePlus,
  MoreVertical,
  Pin,
  Plus,
  Scale,
  Search,
  SendHorizonal,
  Settings2,
  Shield,
  ShieldAlert,
  Star,
  Trash2,
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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChatSkeleton, ListSkeleton } from '@/components/ui/loading-skeletons';
import { useAuth } from '@/contexts/AuthContext';
import { useSocketBase } from '@/contexts/SocketContext';
import { toast } from '@/hooks/use-toast';
import { prepareImageUploadPayload } from '@/lib/image-upload';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import {
  CourtArgument,
  CourtCase,
  LawFirmPreview,
  MessagingConversationDetail,
  MessagingConversationSummary,
  SocialUser,
  SupportThread,
  justiceApi,
  supportApi,
  youApi,
  uploadUserImage,
  usersApi,
} from '@/services/api';
import SanctionModal from '@/components/sanctions/SanctionModal';

const POLL_INTERVAL_MS = 15000;

const REACTION_OPTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

const COURT_ROLE_LABELS: Record<string, string> = {
  JUDGE: 'Juge',
  PLAINTIFF: 'Plaignant',
  DEFENDANT: 'Défendeur',
  LAWYER_PLAINTIFF: 'Avocat (Plaignant)',
  LAWYER_DEFENDANT: 'Avocat (Défendeur)',
  PUBLIC_DEFENDER_PLAINTIFF: 'Défenseur public (Plaignant)',
  PUBLIC_DEFENDER_DEFENDANT: 'Défenseur public (Défendeur)',
};

const COURT_ROLE_COLORS: Record<string, { bubble: string; badge: string; sender: string }> = {
  JUDGE: { bubble: 'bg-amber-500/10 border border-amber-500/30 text-foreground', badge: 'bg-amber-500/15 text-amber-500', sender: 'text-amber-500' },
  PLAINTIFF: { bubble: 'bg-sky-500/10 border border-sky-500/30 text-foreground', badge: 'bg-sky-500/15 text-sky-500', sender: 'text-sky-500' },
  DEFENDANT: { bubble: 'bg-red-500/10 border border-red-500/30 text-foreground', badge: 'bg-red-500/15 text-red-500', sender: 'text-red-500' },
  LAWYER_PLAINTIFF: { bubble: 'bg-sky-500/10 border border-sky-500/25 text-foreground', badge: 'bg-sky-400/15 text-sky-400', sender: 'text-sky-400' },
  LAWYER_DEFENDANT: { bubble: 'bg-red-500/10 border border-red-500/25 text-foreground', badge: 'bg-red-400/15 text-red-400', sender: 'text-red-400' },
  PUBLIC_DEFENDER_PLAINTIFF: { bubble: 'bg-sky-400/10 border border-sky-400/25 text-foreground', badge: 'bg-sky-300/15 text-sky-300', sender: 'text-sky-300' },
  PUBLIC_DEFENDER_DEFENDANT: { bubble: 'bg-red-400/10 border border-red-400/25 text-foreground', badge: 'bg-red-300/15 text-red-300', sender: 'text-red-300' },
};

const COURT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'En cours', color: 'text-sky-500' },
  DELIBERATION: { label: 'Délibération', color: 'text-amber-500' },
  VERDICT_GIVEN: { label: 'Verdict rendu', color: 'text-emerald-500' },
  CLOSED: { label: 'Clôturé', color: 'text-muted-foreground' },
};

COURT_ROLE_LABELS.DEFENDANT = 'Coupable';
COURT_ROLE_LABELS.LAWYER_PLAINTIFF = 'Avocat du plaignant';
COURT_ROLE_LABELS.LAWYER_DEFENDANT = 'Avocat du coupable';
COURT_ROLE_LABELS.PUBLIC_DEFENDER_PLAINTIFF = 'Defenseur public du plaignant';
COURT_ROLE_LABELS.PUBLIC_DEFENDER_DEFENDANT = 'Defenseur public du coupable';
COURT_STATUS_LABELS.DELIBERATION = { label: 'Deliberation', color: 'text-slate-500' };

const getCourtAnonymousSenderLabel = (role: string | null) => {
  if (role && COURT_ROLE_LABELS[role]) return COURT_ROLE_LABELS[role];
  return 'Participant';
};

const getCourtPartyLabel = (courtCase: CourtCase | null, side: 'PLAINTIFF' | 'DEFENDANT') => {
  if (side === 'PLAINTIFF') return courtCase?.plaintif?.username ?? COURT_ROLE_LABELS.PLAINTIFF;
  return courtCase?.defendant?.username ?? COURT_ROLE_LABELS.DEFENDANT;
};

const getCourtSenderLabel = (role: string | null, courtCase: CourtCase | null) => {
  if (role === 'LAWYER_PLAINTIFF') return `Avocat du plaignant ${getCourtPartyLabel(courtCase, 'PLAINTIFF')}`;
  if (role === 'LAWYER_DEFENDANT') return `Avocat du coupable ${getCourtPartyLabel(courtCase, 'DEFENDANT')}`;
  if (role === 'PUBLIC_DEFENDER_PLAINTIFF') return `Défenseur public du plaignant ${getCourtPartyLabel(courtCase, 'PLAINTIFF')}`;
  if (role === 'PUBLIC_DEFENDER_DEFENDANT') return `Défenseur public du coupable ${getCourtPartyLabel(courtCase, 'DEFENDANT')}`;
  return getCourtAnonymousSenderLabel(role);
};

const getCourtVisibleLabel = (role: string | null, username: string | null, revealUsername: boolean, fallbackLabel: string) => {
  if (!revealUsername || !username) return fallbackLabel;
  const baseLabel = role ? getCourtAnonymousSenderLabel(role) : fallbackLabel;
  return baseLabel === username ? baseLabel : `${baseLabel} (${username})`;
};

const getCourtRoleInitials = (role: string | null) => {
  const label = getCourtAnonymousSenderLabel(role);
  if (!label) return '?';
  return label
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join('')
    .toUpperCase();
};

const isAnonymousCourtRole = (role: string | null) =>
  role !== 'PLAINTIFF' && role !== 'DEFENDANT';

const COURT_WITNESS_REQUEST_MARKER = /\s*\[\[WITNESS_REQUEST:([^:\]]+):(0|1)\]\]\s*$/;

const parseCourtWitnessRequest = (body: string) => {
  const match = body.match(COURT_WITNESS_REQUEST_MARKER);
  if (!match) return { body, witnessUserId: null as string | null };
  return {
    body: body.replace(COURT_WITNESS_REQUEST_MARKER, '').trim(),
    witnessUserId: match[1],
  };
};

const formatTime = (value: string) => {
  const date = new Date(value);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Hier';
  return format(date, 'dd MMM', { locale: fr });
};

const formatDayLabel = (value: string) => {
  const date = new Date(value);
  if (isToday(date)) return 'Aujourd’hui';
  if (isYesterday(date)) return 'Hier';
  return format(date, 'EEEE d MMMM', { locale: fr });
};

const isSameCalendarDay = (left: string, right: string) => {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

const getInitials = (name?: string | null) => ((name ?? '?').trim().slice(0, 2) || '?').toUpperCase();
const getPreview = (c: MessagingConversationSummary) => c.lastMessage?.body || 'Commence la discussion.';
const getLastOutgoingMessageReadState = (
  conversation: MessagingConversationSummary,
  currentUserId: string | null | undefined,
): 'READ' | 'UNREAD' | null => {
  const lastMessage = conversation.lastMessage;
  if (!currentUserId || !lastMessage?.createdAt || lastMessage.senderId !== currentUserId) {
    return null;
  }

  const messageCreatedAt = Date.parse(lastMessage.createdAt);
  if (Number.isNaN(messageCreatedAt)) return 'UNREAD';

  const recipients = conversation.participants.filter(
    (entry) => entry.user.id !== currentUserId && entry.user.id !== 'support',
  );
  if (recipients.length === 0) return 'UNREAD';

  const everyoneRead = recipients.every((entry) => {
    const readAt = entry.lastReadAt ? Date.parse(entry.lastReadAt) : Number.NaN;
    return !Number.isNaN(readAt) && readAt >= messageCreatedAt;
  });

  return everyoneRead ? 'READ' : 'UNREAD';
};
const getConversationActivityAt = (conversation: MessagingConversationSummary) => {
  const timestamp = conversation.lastMessage?.createdAt;
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortConversationsByRecent = (items: MessagingConversationSummary[]) =>
  [...items].sort((a, b) => {
    const timeDiff = getConversationActivityAt(b) - getConversationActivityAt(a);
    if (timeDiff !== 0) return timeDiff;
    return a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' });
  });

const sortConversationsByRecentRegardlessOfReadState = (items: MessagingConversationSummary[]) =>
  sortConversationsByRecent(items);

const DM_SORT_OPTIONS = {
  RECENT: 'Recentes',
  UNREAD: 'Non lus',
  ALPHA: 'A-Z',
} as const;

type DmSortMode = keyof typeof DM_SORT_OPTIONS;

const BUSINESS_SORT_OPTIONS = {
  RECENT: 'Recentes',
  UNREAD: 'Non lus',
  ALPHA: 'A-Z',
} as const;

type BusinessSortMode = keyof typeof BUSINESS_SORT_OPTIONS;

const MESSAGING_TABS = {
  BUSINESS: 'business',
  OTHER: 'other',
} as const;

type MessagingTab = (typeof MESSAGING_TABS)[keyof typeof MESSAGING_TABS];

const BUSINESS_CONVERSATION_TAG = 'Professionnel';

const isBusinessConversation = (conversation: MessagingConversationSummary) =>
  Boolean(conversation.courtCaseId)
  || conversation.tagType === BUSINESS_CONVERSATION_TAG
  || conversation.tagLabel === BUSINESS_CONVERSATION_TAG;

const ADMIN_SUPPORT_CONVERSATION_PREFIX = 'admin-support:';

const getAdminSupportConversationId = (userId: string) => `${ADMIN_SUPPORT_CONVERSATION_PREFIX}${userId}`;
const getAdminSupportUserId = (conversationId: string) =>
  conversationId.startsWith(ADMIN_SUPPORT_CONVERSATION_PREFIX)
    ? conversationId.slice(ADMIN_SUPPORT_CONVERSATION_PREFIX.length)
    : null;

const buildAdminSupportConversationSummary = (thread: SupportThread): MessagingConversationSummary => ({
  id: getAdminSupportConversationId(thread.userId),
  type: 'SUPPORT',
  title: 'Support',
  description: null,
  icon: null,
  imageUrl: null,
  courtCaseId: null,
  isFavorite: false,
  displayName: thread.user?.username ?? 'Support',
  isPinned: true,
  unreadCount: thread.unreadCount,
  lastMessage: {
    body: thread.lastBody || 'Commence la discussion.',
    createdAt: thread.lastCreatedAt,
    senderId: thread.lastFromAdmin ? 'support' : thread.userId,
  },
  participants: thread.user
    ? [{ user: thread.user, role: 'USER', courtRole: null, lastReadAt: null }]
    : [],
});

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
          {hasIcon ? conversation.icon : getInitials(avatarUser?.username ?? conversation.displayName)}
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
  const [adminSupportThreads, setAdminSupportThreads] = useState<SupportThread[]>([]);
  const [players, setPlayers] = useState<SocialUser[]>([]);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessagingConversationDetail | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [imageUrlToSend, setImageUrlToSend] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pinnedDmIds, setPinnedDmIds] = useState<Set<string>>(new Set());
  const [dmSortMode, setDmSortMode] = useState<DmSortMode>('RECENT');
  const [businessSortMode, setBusinessSortMode] = useState<BusinessSortMode>('RECENT');
  const [activeMessagesTab, setActiveMessagesTab] = useState<MessagingTab>(MESSAGING_TABS.OTHER);
  const [loading, setLoading] = useState(true);
  const [convLoading, setConvLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isMessagesAtBottom, setIsMessagesAtBottom] = useState(true);
  const [typingByConversation, setTypingByConversation] = useState<Record<string, { userId: string; username: string }>>({});

  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingConversationRef = useRef<string | null>(null);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'DM' | 'GROUP'>('DM');
  const [createTitle, setCreateTitle] = useState('');
  const [createSearch, setCreateSearch] = useState('');
  const [createParticipantIds, setCreateParticipantIds] = useState<string[]>([]);
  const [respectOpen, setRespectOpen] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [groupEditName, setGroupEditName] = useState('');
  const [groupEditDescription, setGroupEditDescription] = useState('');
  const [groupEditIcon, setGroupEditIcon] = useState('');
  const [groupEditImageUrl, setGroupEditImageUrl] = useState<string | null>(null);
  const [groupImageUploading, setGroupImageUploading] = useState(false);
  const [groupSettingsSaving, setGroupSettingsSaving] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [groupReportOpen, setGroupReportOpen] = useState(false);
  const [groupReportReason, setGroupReportReason] = useState('');
  const [groupReportSubmitting, setGroupReportSubmitting] = useState(false);
  const [witnessRequestOpen, setWitnessRequestOpen] = useState(false);
  const [witnessSearch, setWitnessSearch] = useState('');
  const [witnessUserId, setWitnessUserId] = useState<string | null>(null);
  const [witnessAnonymous, setWitnessAnonymous] = useState(true);
  const [witnessSubmitting, setWitnessSubmitting] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');

  // Court case state
  const [courtCase, setCourtCase] = useState<CourtCase | null>(null);
  const [courtCaseStatusById, setCourtCaseStatusById] = useState<Record<string, CourtCase['status']>>({});
  const [courtArguments, setCourtArguments] = useState<CourtArgument[]>([]);
  const [argumentsLoading, setArgumentsLoading] = useState(false);
  const [showArgumentsDialog, setShowArgumentsDialog] = useState(false);
  const [selectedCourtRole, setSelectedCourtRole] = useState<string | null>(null);
  const [showVerdictPanel, setShowVerdictPanel] = useState(false);
  const [verdictDraft, setVerdictDraft] = useState('');
  const [sentencingDraft, setSentencingDraft] = useState('');
  const [verdictSaving, setVerdictSaving] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [lawFirms, setLawFirms] = useState<LawFirmPreview[]>([]);
  const [lawFirmsLoading, setLawFirmsLoading] = useState(false);
  const [showRepresentationDialog, setShowRepresentationDialog] = useState(false);
  const [representationType, setRepresentationType] = useState<'PRIVATE_LAWYER' | 'PUBLIC_DEFENDER'>('PRIVATE_LAWYER');
  const [selectedLawFirmId, setSelectedLawFirmId] = useState<string | null>(null);
  const [selectedLawyerUserId, setSelectedLawyerUserId] = useState<string | null>(null);
  const [representationSubmitting, setRepresentationSubmitting] = useState(false);
  const [showLawyerRatingDialog, setShowLawyerRatingDialog] = useState(false);
  const [lawyerRating, setLawyerRating] = useState(0);
  const [lawyerRatingComment, setLawyerRatingComment] = useState('');
  const [lawyerRatingSubmitting, setLawyerRatingSubmitting] = useState(false);
  const [showSanctionModal, setShowSanctionModal] = useState(false);
  const [courtImagePreviewUrl, setCourtImagePreviewUrl] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false,
  );

  const handledSearchRef = useRef<string | null>(null);
  const messagesScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const groupImageInputRef = useRef<HTMLInputElement | null>(null);
  const previousSelectedConversationRef = useRef<string | null>(null);
  const previousMessageCountRef = useRef(0);

  const deferredSearch = useDeferredValue(search);
  const isAdminViewer = Boolean(user?.isAdmin || user?.isSuperAdmin);
  const selectedConversation = detail?.conversation ?? conversations.find((c) => c.id === selectedId) ?? null;
  const isCourtConversation = Boolean(selectedConversation?.courtCaseId);
  const conversationDisplayTitle = isCourtConversation && courtCase?.plainte?.title
    ? courtCase.plainte.title
    : selectedConversation?.displayName ?? '';
  const myCourtParty = courtCase?.parties?.find((p) => p.userId === user?.id);
  const myCourtRole = myCourtParty?.courtRole ?? null;
  const myCourtSide = myCourtRole === 'PLAINTIFF' ? 'PLAINTIFF' : myCourtRole === 'DEFENDANT' ? 'DEFENDANT' : null;
  const isEligibleCourtClient = Boolean(myCourtSide && !isAdminViewer);
  const isCourtJudge = Boolean(isCourtConversation && (myCourtRole === 'JUDGE' || isAdminViewer));
  // Non-admin judge: has the JUDGE court role but is not an admin
  const isNonAdminJudge = Boolean(isCourtConversation && myCourtRole === 'JUDGE' && !isAdminViewer);
  const canManageCourtGroup = Boolean(!isCourtConversation || isAdminViewer || isCourtJudge);
  const assignedLawFirm = myCourtSide === 'PLAINTIFF'
    ? courtCase?.plaintiffLawFirm ?? null
    : myCourtSide === 'DEFENDANT'
      ? courtCase?.defendantLawFirm ?? null
      : null;
  const assignedLawyer = myCourtSide === 'PLAINTIFF'
    ? courtCase?.plaintiffLawyer ?? null
    : myCourtSide === 'DEFENDANT'
      ? courtCase?.defendantLawyer ?? null
      : null;
  const assignedPublicDefenderRole = myCourtSide === 'PLAINTIFF'
    ? 'PUBLIC_DEFENDER_PLAINTIFF'
    : myCourtSide === 'DEFENDANT'
      ? 'PUBLIC_DEFENDER_DEFENDANT'
      : null;
  const hasAssignedPublicDefender = Boolean(
    assignedPublicDefenderRole && selectedConversation?.participants.some((entry) => entry.courtRole === assignedPublicDefenderRole),
  );
  const hasCourtRepresentation = !isEligibleCourtClient || Boolean(assignedLawyer || hasAssignedPublicDefender);
  const selectedIdSafe = selectedConversation?.id ?? null;
  const selectedAdminSupportUserId = selectedIdSafe ? getAdminSupportUserId(selectedIdSafe) : null;
  const conversationReactionsEnabled = selectedConversation?.type === 'DM' || selectedConversation?.type === 'GROUP';
  const currentMessages = detail?.messages ?? [];
  const dmTypingUser = selectedConversation?.type === 'DM' && selectedIdSafe
    ? (typingByConversation[selectedIdSafe] ?? null)
    : null;
  const isCourtChatLocked = Boolean(isCourtConversation && courtCase && courtCase.status !== 'OPEN');
  const scrollMessagesToBottom = () => {
    const viewport = messagesScrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const updateViewport = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };

    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);


  // ── Data Loading ─────────────────────────────────────────────────────────
  const refreshConversations = async () => {
    const [conversationsRes, supportThreadsRes, courtCasesRes] = await Promise.all([
      supportApi.getConversations(),
      isAdminViewer ? supportApi.getThreads() : Promise.resolve({ data: { threads: [] as SupportThread[] } }),
      justiceApi.listCases().catch(() => ({ data: { cases: [] as CourtCase[] } })),
    ]);
    const mergedConversations = [
      ...conversationsRes.data.conversations,
      ...supportThreadsRes.data.threads.map(buildAdminSupportConversationSummary),
    ];
    setCourtCaseStatusById(
      Object.fromEntries(courtCasesRes.data.cases.map((courtEntry) => [courtEntry.id, courtEntry.status])),
    );
    setAdminSupportThreads(supportThreadsRes.data.threads);
    setConversations(sortConversationsByRecent(mergedConversations));
    return mergedConversations;
  };

  const loadConversation = async (id: string, markRead = true, showLoader = true) => {
    if (showLoader) setConvLoading(true);
    try {
      const adminSupportUserId = getAdminSupportUserId(id);
      if (adminSupportUserId) {
        const [threadRes, supportThreadsRes] = await Promise.all([
          supportApi.getThread(adminSupportUserId),
          isAdminViewer ? supportApi.getThreads() : Promise.resolve({ data: { threads: [] as SupportThread[] } }),
        ]);
        const latestMessage = threadRes.data.messages[threadRes.data.messages.length - 1];
        const matchingThread =
          supportThreadsRes.data.threads.find((thread) => thread.userId === adminSupportUserId) ??
          adminSupportThreads.find((thread) => thread.userId === adminSupportUserId) ?? {
            userId: adminSupportUserId,
            user: threadRes.data.user,
            lastBody: latestMessage?.body ?? '',
            lastFromAdmin: latestMessage?.fromAdmin ?? false,
            lastCreatedAt: latestMessage?.createdAt ?? new Date(0).toISOString(),
            unreadCount: 0,
          };

        setAdminSupportThreads(supportThreadsRes.data.threads);
        setDetail({
          conversation: buildAdminSupportConversationSummary(matchingThread),
          messages: threadRes.data.messages.map((message) => ({
            ...message,
            conversationId: id,
            senderId: message.fromAdmin ? 'support' : adminSupportUserId,
            type: 'TEXT',
            sender: message.fromAdmin
              ? { id: 'support', username: 'Support', profilePicture: null, usernameColor: null }
              : {
                  id: adminSupportUserId,
                  username: threadRes.data.user?.username ?? 'Utilisateur',
                  profilePicture: threadRes.data.user?.profilePicture ?? null,
                  usernameColor: threadRes.data.user?.usernameColor ?? null,
                },
            courtRole: null,
            reactions: [],
          })),
        });
        if (markRead) {
          await supportApi.markThreadRead(adminSupportUserId);
          setConversations((prev) => sortConversationsByRecent(prev.map((c) => c.id === id ? { ...c, unreadCount: 0 } : c)));
        }
        return;
      }

      const r = await supportApi.getConversation(id);
      setDetail(r.data);
      if (markRead) {
        await supportApi.markConversationRead(id);
        setConversations((prev) => sortConversationsByRecent(prev.map((c) => c.id === id ? { ...c, unreadCount: 0 } : c)));
      }
    } finally {
      if (showLoader) setConvLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [convRes, supportThreadsRes, playersRes, blockedRes, courtCasesRes] = await Promise.all([
          supportApi.getConversations(),
          isAdminViewer ? supportApi.getThreads() : Promise.resolve({ data: { threads: [] as SupportThread[] } }),
          usersApi.getAll(),
          supportApi.getBlockedUsers(),
          justiceApi.listCases().catch(() => ({ data: { cases: [] as CourtCase[] } })),
        ]);
        if (cancelled) return;
        const sortedConversations = sortConversationsByRecent([
          ...convRes.data.conversations,
          ...supportThreadsRes.data.threads.map(buildAdminSupportConversationSummary),
        ]);
        setCourtCaseStatusById(
          Object.fromEntries(courtCasesRes.data.cases.map((courtEntry) => [courtEntry.id, courtEntry.status])),
        );
        setAdminSupportThreads(supportThreadsRes.data.threads);
        setConversations(sortedConversations);
        setPlayers(playersRes.data.users ?? []);
        setBlockedIds(new Set(blockedRes.data.blockedUsers.map((b) => b.id)));
        setSelectedId((cur) => {
          if (cur) return cur;
          if (isMobileViewport) return null;
          return sortedConversations[0]?.id ?? null;
        });
      } catch {
        toast({ title: 'Messagerie indisponible', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdminViewer, isMobileViewport]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    loadConversation(selectedId, true, true).catch(() => {
      toast({ title: 'Conversation indisponible', variant: 'destructive' });
    });
  }, [selectedId]);

  useEffect(() => {
    const key = `messaging-rules-seen-${user?.id ?? 'anon'}`;
    if (user && !localStorage.getItem(key)) setRespectOpen(true);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setPinnedDmIds(new Set());
      return;
    }
    const key = `messaging-pinned-dms-${user.id}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      setPinnedDmIds(new Set());
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const pinned = parsed.filter((id): id is string => typeof id === 'string');
        setPinnedDmIds(new Set(pinned));
      } else {
        setPinnedDmIds(new Set());
      }
    } catch {
      setPinnedDmIds(new Set());
    }
  }, [user?.id]);

  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams(location.search);
    const conversationId = params.get('conversation');
    const targetUserId = params.get('user');

    if (!conversationId && !targetUserId) {
      handledSearchRef.current = null;
      return;
    }

    if (handledSearchRef.current === location.search) return;
    handledSearchRef.current = location.search;

    if (conversationId) {
      setSelectedId(conversationId);
      return;
    }

    if (!targetUserId || targetUserId === user?.id) return;

    const existingDm = conversations.find(
      (conversation) =>
        conversation.type === 'DM' &&
        conversation.participants.some((entry) => entry.user.id === targetUserId),
    );

    if (existingDm) {
      setSelectedId(existingDm.id);
      return;
    }

    void supportApi.createConversation({ type: 'DM', participantIds: [targetUserId] })
      .then(async (response) => {
        const dmConversationId = response.data.conversation.id;
        await refreshConversations();
        setSelectedId(dmConversationId);
      })
      .catch(() => {
        toast({ title: 'Conversation indisponible', variant: 'destructive' });
      });
  }, [conversations, loading, location.search, user?.id]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refreshConversations().catch(() => {});
      if (selectedIdSafe) loadConversation(selectedIdSafe, false, false).catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [selectedIdSafe]);

  useEffect(() => {
    if (!socket) return;
    const handleTyping = (payload: { conversationId?: string; userId?: string; username?: string; isTyping?: boolean }) => {
      const conversationId = typeof payload?.conversationId === 'string' ? payload.conversationId : null;
      const userId = typeof payload?.userId === 'string' ? payload.userId : null;
      if (!conversationId || !userId || userId === user?.id) return;

      if (payload.isTyping) {
        setTypingByConversation((prev) => ({
          ...prev,
          [conversationId]: {
            userId,
            username: typeof payload.username === 'string' && payload.username.trim() ? payload.username : 'Quelqu’un',
          },
        }));
        return;
      }

      setTypingByConversation((prev) => {
        if (!prev[conversationId]) return prev;
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    };

    const refresh = () => {
      refreshConversations().catch(() => {});
      if (selectedIdSafe) loadConversation(selectedIdSafe, false, false).catch(() => {});
    };
    socket.on('messaging:message', refresh);
    socket.on('messaging:conversation', refresh);
    socket.on('messaging:typing', handleTyping);
    socket.on('support:message', refresh);
    return () => {
      socket.off('messaging:message', refresh);
      socket.off('messaging:conversation', refresh);
      socket.off('messaging:typing', handleTyping);
      socket.off('support:message', refresh);
    };
  }, [socket, selectedIdSafe, user?.id]);

  useEffect(() => {
    if (!socket) return;

    const previousConversationId = lastTypingConversationRef.current;
    if (previousConversationId && previousConversationId !== selectedIdSafe) {
      socket.emit('messaging:typing', { conversationId: previousConversationId, isTyping: false });
      setTypingByConversation((prev) => {
        if (!prev[previousConversationId]) return prev;
        const next = { ...prev };
        delete next[previousConversationId];
        return next;
      });
      lastTypingConversationRef.current = null;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      const activeConversationId = lastTypingConversationRef.current;
      if (activeConversationId) {
        socket.emit('messaging:typing', { conversationId: activeConversationId, isTyping: false });
      }
    };
  }, [socket, selectedIdSafe]);

  useEffect(() => {
    const currentMessageCount = detail?.messages.length ?? 0;
    const previousConversationId = previousSelectedConversationRef.current;
    const previousMessageCount = previousMessageCountRef.current;
    const conversationChanged = previousConversationId !== selectedIdSafe;
    const receivedNewMessage = !conversationChanged && currentMessageCount > previousMessageCount;
    const shouldAutoScroll = conversationChanged || (receivedNewMessage && isMessagesAtBottom);

    previousSelectedConversationRef.current = selectedIdSafe;
    previousMessageCountRef.current = currentMessageCount;

    if (!shouldAutoScroll) return;

    const frame = window.requestAnimationFrame(() => {
      scrollMessagesToBottom();
      window.setTimeout(scrollMessagesToBottom, 0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detail?.messages.length, selectedIdSafe, isMessagesAtBottom]);

  // Load court case when switching to a court conversation
  useEffect(() => {
    const caseId = selectedConversation?.courtCaseId;
    if (!caseId) {
      setCourtCase(null);
      setCourtArguments([]);
      setShowArgumentsDialog(false);
      setSelectedCourtRole(null);
      setShowRepresentationDialog(false);
      setShowLawyerRatingDialog(false);
      setCourtImagePreviewUrl(null);
      return;
    }
    let cancelled = false;
    justiceApi.getCase(caseId).then((r) => {
      if (cancelled) return;
      setCourtCase(r.data.courtCase);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [selectedConversation?.courtCaseId]);

  useEffect(() => {
    if (!isCourtConversation || !courtCase?.plainte?.title || !selectedConversation) return;
    const caseTitle = courtCase.plainte.title;
    setConversations((prev) => prev.map((conversation) =>
      conversation.id === selectedConversation.id
        ? { ...conversation, displayName: caseTitle, title: caseTitle }
        : conversation,
    ));
    setDetail((prev) => prev
      ? { ...prev, conversation: { ...prev.conversation, displayName: caseTitle, title: caseTitle } }
      : prev);
  }, [courtCase?.plainte?.title, isCourtConversation, selectedConversation]);

  useEffect(() => {
    if (!courtCase?.id) return;
    setCourtCaseStatusById((prev) => (
      prev[courtCase.id] === courtCase.status
        ? prev
        : { ...prev, [courtCase.id]: courtCase.status }
    ));
  }, [courtCase?.id, courtCase?.status]);

  useEffect(() => {
    if (!isCourtConversation || !courtCase) return;
    if (lawFirms.length > 0 || lawFirmsLoading) return;
    if (!isEligibleCourtClient && !assignedLawFirm && !assignedLawyer) return;
    let cancelled = false;
    setLawFirmsLoading(true);
    justiceApi.getLawFirms().then((response) => {
      if (!cancelled) {
        setLawFirms(response.data.lawFirms);
      }
    }).catch(() => {
      if (!cancelled) {
        toast({ title: 'Cabinets indisponibles', variant: 'destructive' });
      }
    }).finally(() => {
      if (!cancelled) setLawFirmsLoading(false);
    });
    return () => { cancelled = true; };
  }, [assignedLawFirm, assignedLawyer, courtCase, isCourtConversation, isEligibleCourtClient, lawFirms.length, lawFirmsLoading]);

  // ── Filtered lists ────────────────────────────────────────────────────────
  const { pinnedDms, dms, others } = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const all = term
      ? conversations.filter((c) => {
          const names = [c.displayName, c.title ?? '', ...c.participants.map((e) => e.user.username)].join(' ').toLowerCase();
          return names.includes(term) || getPreview(c).toLowerCase().includes(term);
        })
      : conversations;

    const businessConversations = all.filter(isBusinessConversation);
    const nonBusinessConversations = all.filter((conversation) => !isBusinessConversation(conversation));

    const sortDmList = (items: MessagingConversationSummary[]) => [...items].sort((a, b) => {
      if (dmSortMode === 'ALPHA') {
        const nameDiff = a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' });
        if (nameDiff !== 0) return nameDiff;
        return getConversationActivityAt(b) - getConversationActivityAt(a);
      }
      if (dmSortMode === 'UNREAD') {
        const unreadDiff = b.unreadCount - a.unreadCount;
        if (unreadDiff !== 0) return unreadDiff;
        return getConversationActivityAt(b) - getConversationActivityAt(a);
      }
      const timeDiff = getConversationActivityAt(b) - getConversationActivityAt(a);
      if (timeDiff !== 0) return timeDiff;
      return a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' });
    });

    const sortBusinessList = (items: MessagingConversationSummary[]) => [...items].sort((a, b) => {
      if (businessSortMode === 'ALPHA') {
        const nameDiff = a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' });
        if (nameDiff !== 0) return nameDiff;
        return getConversationActivityAt(b) - getConversationActivityAt(a);
      }
      if (businessSortMode === 'UNREAD') {
        const unreadDiff = b.unreadCount - a.unreadCount;
        if (unreadDiff !== 0) return unreadDiff;
        return getConversationActivityAt(b) - getConversationActivityAt(a);
      }
      const timeDiff = getConversationActivityAt(b) - getConversationActivityAt(a);
      if (timeDiff !== 0) return timeDiff;
      return a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' });
    });

    if (activeMessagesTab === MESSAGING_TABS.BUSINESS) {
      return {
        pinnedDms: [],
        dms: [],
        others: sortBusinessList(businessConversations),
      };
    }

    const dmsOnly = nonBusinessConversations.filter((c) => c.type === 'DM');
    const pinnedDmsOnly = dmsOnly.filter((c) => pinnedDmIds.has(c.id));
    const unpinnedDmsOnly = dmsOnly.filter((c) => !pinnedDmIds.has(c.id));
    const nonDmOnly = nonBusinessConversations.filter((c) => c.type !== 'DM');

    if (dmSortMode === 'RECENT') {
      return {
        pinnedDms: sortConversationsByRecentRegardlessOfReadState(pinnedDmsOnly),
        dms: sortConversationsByRecentRegardlessOfReadState([...unpinnedDmsOnly, ...nonDmOnly]),
        others: [],
      };
    }

    const nonDm = sortConversationsByRecent(nonDmOnly);

    return {
      pinnedDms: sortDmList(pinnedDmsOnly),
      dms: sortDmList(unpinnedDmsOnly),
      others: nonDm,
    };
  }, [activeMessagesTab, businessSortMode, conversations, deferredSearch, dmSortMode, pinnedDmIds]);

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

  const sortedLawFirms = useMemo(
    () => [...lawFirms].sort((a, b) => {
      const primaryA = a.lawyers?.find((entry) => entry.isPrimaryLawyer) ?? a.lawyers?.[0] ?? null;
      const primaryB = b.lawyers?.find((entry) => entry.isPrimaryLawyer) ?? b.lawyers?.[0] ?? null;
      const ratingDiff = (b.avgRating ?? 0) - (a.avgRating ?? 0);
      if (Math.abs(ratingDiff) > 0.05) return ratingDiff;
      if ((primaryA?.displayOrder ?? 0) !== (primaryB?.displayOrder ?? 0)) return (primaryA?.displayOrder ?? 0) - (primaryB?.displayOrder ?? 0);
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    }),
    [lawFirms],
  );
  const selectedLawFirm = useMemo(
    () => sortedLawFirms.find((entry) => entry.id === selectedLawFirmId) ?? null,
    [selectedLawFirmId, sortedLawFirms],
  );
  const unavailableLawyerIds = useMemo(() => {
    if (!courtCase) return new Set<string>();
    return new Set(
      (courtCase.parties ?? [])
        .filter((party) => party.userId !== assignedLawyer?.id)
        .map((party) => party.userId),
    );
  }, [assignedLawyer?.id, courtCase]);
  const selectedLawFirmLawyers = useMemo(
    () => (selectedLawFirm?.lawyers ?? []).filter((lawyer) => !unavailableLawyerIds.has(lawyer.userId)),
    [selectedLawFirm, unavailableLawyerIds],
  );
  const assignedLawyerProfile = useMemo(() => {
    if (!assignedLawyer) return null;
    for (const firm of sortedLawFirms) {
      const lawyer = firm.lawyers?.find((entry) => entry.userId === assignedLawyer.id);
      if (lawyer) {
        return lawyer;
      }
    }
    return null;
  }, [assignedLawyer, sortedLawFirms]);
  const canChooseRepresentation = Boolean(courtCase && isEligibleCourtClient && courtCase.status === 'OPEN');
  const canRateAssignedLawyer = Boolean(
    courtCase &&
    isEligibleCourtClient &&
    courtCase.status === 'CLOSED' &&
    assignedLawFirm &&
    assignedLawyer,
  );
  const canRequestWitness = Boolean(isCourtConversation && courtCase && !isAdminViewer && courtCase.status === 'OPEN');

  useEffect(() => {
    if (!selectedConversation) return;
    if (selectedConversation.courtCaseId && isAdminViewer) {
      setSelectedCourtRole('JUDGE');
      return;
    }
    setSelectedCourtRole(null);
  }, [selectedConversation?.id, isAdminViewer]);

  const witnessCandidates = useMemo(() => {
    if (!selectedConversation) return [] as SocialUser[];
    const memberIds = new Set(selectedConversation.participants.map((entry) => entry.user.id));
    const term = witnessSearch.trim().toLowerCase();
    return players.filter((player) => {
      if (player.id === user?.id) return false;
      if (memberIds.has(player.id)) return false;
      if (!term) return true;
      return player.username.toLowerCase().includes(term);
    });
  }, [players, selectedConversation, user?.id, witnessSearch]);

  useEffect(() => {
    if (representationType !== 'PRIVATE_LAWYER') return;
    const lawyers = selectedLawFirmLawyers;
    if (lawyers.length === 0) {
      setSelectedLawyerUserId(null);
      return;
    }
    if (!selectedLawyerUserId || !lawyers.some((entry) => entry.userId === selectedLawyerUserId)) {
      setSelectedLawyerUserId((lawyers.find((entry) => entry.isPrimaryLawyer) ?? lawyers[0] ?? null)?.userId ?? null);
    }
  }, [representationType, selectedLawFirmLawyers, selectedLawyerUserId]);

  useEffect(() => {
    if (showLawyerRatingDialog) return;
    setLawyerRating(0);
    setLawyerRatingComment('');
  }, [showLawyerRatingDialog]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
      if (!selectedIdSafe || (!draft.trim() && !imageUrlToSend) || sending || isUploadingImage || isCourtChatLocked) return;
      const body = draft.trim();
      const currentImageUrl = imageUrlToSend;
      setSending(true);
      setDraft('');
      setImageUrlToSend('');
      if (selectedConversation?.type === 'DM') {
        socket?.emit('messaging:typing', { conversationId: selectedIdSafe, isTyping: false });
        lastTypingConversationRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
      try {
        if (selectedAdminSupportUserId) {
          await supportApi.reply(
            selectedAdminSupportUserId,
            body,
            currentImageUrl ? [currentImageUrl] : undefined,
          );
        } else {
          const roleToSend = isCourtConversation
            ? (isAdminViewer ? (selectedCourtRole ?? 'JUDGE') : myCourtRole)
            : null;
          await supportApi.sendConversationMessage(selectedIdSafe, body, roleToSend, currentImageUrl || null);
        }
        await Promise.all([refreshConversations(), loadConversation(selectedIdSafe, false, false)]);
      } catch (error: any) {
        toast({
          title: error?.response?.data?.error || 'Envoi impossible',
          variant: 'destructive',
        });
        setDraft(body);
        setImageUrlToSend(currentImageUrl);
      } finally {
        setSending(false);
      }
    };

    const handleImageSelection = async (file: File | null) => {
      if (!file || isUploadingImage) return;
      if (!file.type.startsWith('image/')) return;

      try {
        setIsUploadingImage(true);
        const { base64Data, mimeType } = await prepareImageUploadPayload(file);
        const response = await uploadUserImage({ base64Data, mimeType });
        setImageUrlToSend(response.data.imageUrl);
      } finally {
        setIsUploadingImage(false);
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

  const handleToggleFavorite = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const conversation = conversations.find((entry) => entry.id === id);
    if (!conversation || conversation.type === 'SUPPORT') return;
    try {
      const r = await supportApi.toggleFavorite(id);
      setConversations((prev) => sortConversationsByRecent(prev.map((c) => c.id === id ? { ...c, isFavorite: r.data.isFavorite } : c)));
      if (detail?.conversation.id === id) {
        setDetail((prev) => prev ? { ...prev, conversation: { ...prev.conversation, isFavorite: r.data.isFavorite } } : prev);
      }
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const handleToggleDmPin = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const conversation = conversations.find((entry) => entry.id === id);
    if (!conversation || conversation.type !== 'DM') return;
    const key = `messaging-pinned-dms-${user?.id ?? 'anon'}`;
    setPinnedDmIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem(key, JSON.stringify(Array.from(next)));
      return next;
    });
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
    if (!canManageCourtGroup) {
      toast({ title: 'Seuls les admins peuvent renommer un groupe de dossier', variant: 'destructive' });
      return;
    }
    setGroupSettingsSaving(true);
    try {
      await supportApi.updateConversation(selectedConversation.id, {
        title: groupEditName,
        description: groupEditDescription,
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
    if (!canManageCourtGroup) {
      toast({ title: 'Seuls les admins ou le juge du dossier peuvent ajouter des personnes sur un dossier', variant: 'destructive' });
      return;
    }
    try {
      await supportApi.addMember(selectedIdSafe, memberId);
      await Promise.all([refreshConversations(), loadConversation(selectedIdSafe, false)]);
      toast({ title: 'Membre ajouté' });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedConversation || selectedConversation.type !== 'GROUP' || !selectedIdSafe || !user) return;
    try {
      await supportApi.removeMember(selectedIdSafe, user.id);
      const refreshedConversations = await refreshConversations();
      const nextConversation = sortConversationsByRecent(refreshedConversations).find((conversation) => conversation.id !== selectedIdSafe) ?? null;
      setSelectedId(nextConversation?.id ?? null);
      setGroupSettingsOpen(false);
      setAddMembersOpen(false);
      setGroupReportOpen(false);
      toast({ title: 'Tu as quitté le groupe' });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const handleReportGroup = async () => {
    if (!selectedConversation || selectedConversation.type !== 'GROUP' || !selectedIdSafe) return;
    const reason = groupReportReason.trim();
    setGroupReportSubmitting(true);
    try {
      await supportApi.reportConversation(selectedIdSafe, reason || undefined);
      setGroupReportOpen(false);
      setGroupReportReason('');
      toast({ title: 'Conversation signalée' });
    } catch {
      toast({ title: 'Impossible de signaler', variant: 'destructive' });
    } finally {
      setGroupReportSubmitting(false);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!selectedIdSafe || !conversationReactionsEnabled) return;
    try {
      await supportApi.reactToMessage(selectedIdSafe, messageId, emoji);
      await loadConversation(selectedIdSafe, false, false);
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedIdSafe || !isAdminViewer) return;
    try {
      await supportApi.deleteConversationMessage(selectedIdSafe, messageId);
      await Promise.all([refreshConversations(), loadConversation(selectedIdSafe, false, false)]);
      toast({ title: 'Message supprimé' });
    } catch {
      toast({ title: 'Suppression impossible', variant: 'destructive' });
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
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const handleExportConversation = () => {
    if (!detail) return;
    const data = {
      exportedAt: new Date().toISOString(),
      conversation: {
        id: detail.conversation.id,
        displayName: detail.conversation.displayName,
        type: detail.conversation.type,
        participants: detail.conversation.participants.map((p) => ({
          id: p.user.id,
          username: p.user.username,
          role: p.role,
        })),
      },
      messageCount: detail.messages.length,
      messages: detail.messages.map((msg) => ({
        id: msg.id,
        createdAt: msg.createdAt,
        sender: msg.sender ? { id: msg.sender.id, username: msg.sender.username } : null,
        body: msg.body,
        type: msg.type,
        imageUrl: msg.imageUrl ?? null,
        courtRole: msg.courtRole ?? null,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = detail.conversation.displayName.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
    a.download = `conversation-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleChangeStatus = async (status: string) => {
    if (!courtCase) return;
    setStatusChanging(true);
    try {
      const r = await justiceApi.changeStatus(courtCase.id, status);
      setCourtCase(r.data.courtCase);
      await Promise.all([refreshConversations(), selectedIdSafe ? loadConversation(selectedIdSafe, false, false) : Promise.resolve()]);
      toast({ title: 'Statut mis à jour' });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setStatusChanging(false);
    }
  };

  const handleDeliverVerdict = async () => {
    if (!courtCase || !verdictDraft.trim()) return;
    setVerdictSaving(true);
    try {
      const r = await justiceApi.deliverVerdict(courtCase.id, { verdict: verdictDraft.trim(), sentencing: sentencingDraft.trim() || undefined });
      setCourtCase(r.data.courtCase);
      setShowVerdictPanel(false);
      await Promise.all([refreshConversations(), selectedIdSafe ? loadConversation(selectedIdSafe, false, false) : Promise.resolve()]);
      toast({ title: 'Verdict rendu' });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setVerdictSaving(false);
    }
  };

  const handleOpenArgumentsDialog = async () => {
    if (!courtCase) return;
    setArgumentsLoading(true);
    setShowArgumentsDialog(true);
    try {
      const response = await justiceApi.getArguments(courtCase.id);
      setCourtArguments(response.data.arguments);
    } catch {
      toast({ title: 'Arguments indisponibles', variant: 'destructive' });
    } finally {
      setArgumentsLoading(false);
    }
  };

  const openRepresentationDialog = async () => {
    if (!courtCase || !canChooseRepresentation) return;
    if (lawFirms.length === 0 && !lawFirmsLoading) {
      setLawFirmsLoading(true);
      try {
        const response = await justiceApi.getLawFirms();
        setLawFirms(response.data.lawFirms);
      } catch {
        toast({ title: 'Cabinets indisponibles', variant: 'destructive' });
        setLawFirmsLoading(false);
        return;
      } finally {
        setLawFirmsLoading(false);
      }
    }

    const existingLawFirmId = assignedLawFirm?.id ?? null;
    const existingLawyerId = assignedLawyer?.id ?? null;
    setRepresentationType(existingLawFirmId ? 'PRIVATE_LAWYER' : 'PUBLIC_DEFENDER');
    setSelectedLawFirmId(existingLawFirmId);
    setSelectedLawyerUserId(existingLawyerId);
    setShowRepresentationDialog(true);
  };

  const handleSubmitRepresentation = async () => {
    if (!courtCase) return;
    if (representationType === 'PRIVATE_LAWYER' && (!selectedLawFirmId || !selectedLawyerUserId)) return;
    setRepresentationSubmitting(true);
    try {
      const response = await justiceApi.chooseRepresentation(courtCase.id, representationType === 'PRIVATE_LAWYER'
        ? { type: 'PRIVATE_LAWYER', lawFirmId: selectedLawFirmId!, lawyerUserId: selectedLawyerUserId! }
        : { type: 'PUBLIC_DEFENDER' });
      setCourtCase(response.data.courtCase);
      setShowRepresentationDialog(false);
      void Promise.all([refreshConversations(), selectedIdSafe ? loadConversation(selectedIdSafe, false, false) : Promise.resolve()]).catch(() => {});
      toast({ title: representationType === 'PRIVATE_LAWYER' ? 'Representation mise a jour' : 'Defenseur public demande' });
    } catch (error: any) {
      const apiError = typeof error?.response?.data?.error === 'string' ? error.response.data.error : null;
      toast({ title: 'Representation impossible', description: apiError ?? undefined, variant: 'destructive' });
    } finally {
      setRepresentationSubmitting(false);
    }
  };

  const handleSubmitLawyerRating = async () => {
    if (!courtCase || !assignedLawyer || !canRateAssignedLawyer || lawyerRating === 0) return;
    setLawyerRatingSubmitting(true);
    try {
      await youApi.rateLawyerForCase(courtCase.id, assignedLawyer.id, lawyerRating, lawyerRatingComment.trim());
      setShowLawyerRatingDialog(false);
      setLawyerRating(0);
      setLawyerRatingComment('');
      toast({ title: 'Avis avocat enregistre' });
    } catch {
      toast({ title: "Impossible d'enregistrer l'avis", variant: 'destructive' });
    } finally {
      setLawyerRatingSubmitting(false);
    }
  };

  const openGroupSettings = () => {
    if (!selectedConversation || selectedConversation.type !== 'GROUP') return;
    setGroupEditName(selectedConversation.title ?? '');
    setGroupEditDescription(selectedConversation.description ?? '');
    setGroupEditIcon(selectedConversation.icon ?? '');
    setGroupEditImageUrl(selectedConversation.imageUrl ?? null);
    setAddMemberSearch('');
    setAddMembersOpen(false);
    setGroupReportOpen(false);
    setGroupSettingsOpen(true);
  };

  const openWitnessRequestDialog = () => {
    setWitnessSearch('');
    setWitnessUserId(null);
    setWitnessAnonymous(true);
    setWitnessRequestOpen(true);
  };

  const handleRequestWitness = async () => {
    if (!selectedIdSafe || !witnessUserId || !canRequestWitness) return;
    setWitnessSubmitting(true);
    try {
      await supportApi.requestWitness(selectedIdSafe, {
        witnessUserId,
        anonymous: witnessAnonymous,
      });
      setWitnessRequestOpen(false);
      await Promise.all([refreshConversations(), loadConversation(selectedIdSafe, false, false)]);
      toast({ title: 'Demande de temoin envoyee aux admins' });
    } catch {
      toast({ title: 'Impossible de demander ce temoin', variant: 'destructive' });
    } finally {
      setWitnessSubmitting(false);
    }
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

  const viewerLastReadAt =
    selectedConversation?.type === 'SUPPORT'
      ? null
      : selectedConversation?.participants.find((entry) => entry.user.id === user?.id)?.lastReadAt ?? null;
  const firstUnreadMessageId =
    currentMessages.find((message) => {
      const isOwnSupportMessage = selectedConversation?.type === 'SUPPORT'
        ? Boolean(selectedAdminSupportUserId ? message.fromAdmin : !message.fromAdmin)
        : (message.senderId ?? message.userId) === user?.id;

      if (isOwnSupportMessage) return false;
      if (selectedConversation?.type === 'SUPPORT') return message.isRead === false;
      if (!viewerLastReadAt) return true;
      return Date.parse(message.createdAt) > Date.parse(viewerLastReadAt);
    })?.id ?? null;

  useEffect(() => {
    const viewport = messagesScrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    if (!viewport) return;

    const updateIsAtBottom = () => {
      const distanceFromBottom = viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
      setIsMessagesAtBottom(distanceFromBottom < 100);
    };

    updateIsAtBottom();
    viewport.addEventListener('scroll', updateIsAtBottom);
    return () => viewport.removeEventListener('scroll', updateIsAtBottom);
  }, [selectedIdSafe, convLoading, currentMessages.length]);

  if (loading) {
    return (
      <PageShell size="full" className="min-h-0 h-full overflow-hidden !space-y-0 !px-4 !pt-0 !pb-0 lg:!px-6">
        <ChatSkeleton className="h-full" />
      </PageShell>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PageShell size="full" className="min-h-0 h-full overflow-hidden !space-y-0 !px-4 !pt-0 !pb-0 lg:!px-6">

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

      <Dialog
        open={groupSettingsOpen}
        onOpenChange={(open) => {
          setGroupSettingsOpen(open);
          if (!open) {
            setAddMembersOpen(false);
            setGroupReportOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          <div className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Infos du groupe</DialogTitle>
            <DialogDescription className="text-xs">Gérez le nom, la description, l’icône et les membres du groupe depuis un seul endroit.</DialogDescription>
            {!canManageCourtGroup && (
              <p className="mt-1 text-[11px] text-muted-foreground">Sur un dossier judiciaire, seuls les admins ou le juge du dossier peuvent renommer le groupe et ajouter des membres.</p>
            )}
          </div>
          <ScrollArea className="max-h-[75vh]">
            <div className="space-y-5 p-4">
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <Avatar className="h-14 w-14">
                    {groupEditImageUrl ? <AvatarImage src={resolveImageUrl(groupEditImageUrl)} /> : null}
                    <AvatarFallback className={cn('text-2xl', !groupEditImageUrl && groupEditIcon && 'text-2xl')}>
                      {groupEditIcon || getInitials(groupEditName || selectedConversation?.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => groupImageInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity hover:opacity-100"
                    disabled={!canManageCourtGroup}
                  >
                    <Camera className="h-5 w-5 text-white" />
                  </button>
                  <input
                    ref={groupImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (!canManageCourtGroup) return;
                      const f = e.target.files?.[0];
                      if (f) void handleGroupImageUpload(f);
                      e.target.value = '';
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Nom du groupe</p>
                    <Input value={groupEditName} onChange={(e) => setGroupEditName(e.target.value)} placeholder="Nom du groupe" className="h-8 text-sm" maxLength={80} disabled={!canManageCourtGroup} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Description du groupe</p>
                    <Textarea
                      value={groupEditDescription}
                      onChange={(e) => setGroupEditDescription(e.target.value)}
                      placeholder="Description du groupe"
                      className="min-h-[72px] resize-none text-sm"
                      maxLength={280}
                      disabled={!canManageCourtGroup}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Icône du groupe</p>
                    <div className="flex items-center gap-2">
                      <Input
                        value={groupEditIcon}
                        onChange={(e) => setGroupEditIcon(e.target.value.slice(0, 8))}
                        placeholder="👥"
                        className="h-8 w-24 text-sm"
                        maxLength={8}
                        disabled={!canManageCourtGroup}
                      />
                      {(groupEditIcon || groupEditImageUrl) && (
                        <button
                          type="button"
                          onClick={() => { setGroupEditIcon(''); setGroupEditImageUrl(null); }}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          disabled={!canManageCourtGroup}
                        >
                          <X className="h-3 w-3" />Retirer photo & icône
                        </button>
                      )}
                    </div>
                  </div>
                  {groupImageUploading && <p className="text-xs text-muted-foreground">Upload en cours...</p>}
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Membres</p>
                    <p className="text-xs text-muted-foreground">{selectedConversation?.participants.length ?? 0} membres dans le groupe</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setAddMembersOpen(true)}
                    disabled={!canManageCourtGroup || nonMembers.length === 0}
                  >
                    <UserPlus className="h-3.5 w-3.5" />Add
                  </Button>
                </div>
                <ScrollArea className="max-h-72 rounded-lg border border-border/50">
                  <div className="divide-y divide-border/40">
                    {selectedConversation?.participants.map((entry) => {
                      const isMe = entry.user.id === user?.id;
                      const amOwner = selectedConversation.participants.find((e) => e.user.id === user?.id)?.role === 'OWNER';
                      const isCourtMemberEntry = Boolean(isCourtConversation && courtCase);
                      const isPlaintiffMember = Boolean(courtCase?.plaintifId && entry.user.id === courtCase.plaintifId);
                      const isDefendantMember = Boolean(courtCase?.defendantId && entry.user.id === courtCase.defendantId);
                      const shouldMaskCourtMember = isCourtMemberEntry && !isPlaintiffMember && !isDefendantMember;
                      const memberDisplayName = isCourtJudge && isCourtMemberEntry
                        ? getCourtVisibleLabel(entry.courtRole ?? null, entry.user.username, true, entry.user.username)
                        : shouldMaskCourtMember
                          ? getCourtAnonymousSenderLabel(entry.courtRole ?? null)
                          : entry.user.username;
                      return (
                        <div key={entry.user.id} className="flex items-center gap-2.5 px-3 py-2">
                          <Avatar className="h-7 w-7 shrink-0">
                            {!shouldMaskCourtMember && entry.user.profilePicture ? <AvatarImage src={resolveImageUrl(entry.user.profilePicture)} /> : null}
                            <AvatarFallback className="text-[10px]">{getInitials(isCourtJudge ? entry.user.username : memberDisplayName)}</AvatarFallback>
                          </Avatar>
                          <span className="flex-1 truncate text-sm font-medium" style={!shouldMaskCourtMember && entry.user.usernameColor ? { color: entry.user.usernameColor } : undefined}>
                            {memberDisplayName}
                          </span>
                          {!isCourtMemberEntry && entry.role === 'OWNER' && <span className="text-[10px] font-medium text-amber-500">Owner</span>}
                          {!isMe && amOwner && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive" onClick={() => handleKickMember(entry.user.id)}>
                              <UserMinus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </ScrollArea>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setGroupReportOpen(true)}>
                <ShieldAlert className="h-3.5 w-3.5" />Signaler
              </Button>
              <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void handleLeaveGroup()}>
                Quitter le groupe
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setGroupSettingsOpen(false)}>Annuler</Button>
              <Button size="sm" disabled={!canManageCourtGroup || groupSettingsSaving || groupImageUploading} onClick={() => void handleSaveGroupSettings()}>
                {groupSettingsSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={witnessRequestOpen} onOpenChange={setWitnessRequestOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <div className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Demander un témoin</DialogTitle>
            <DialogDescription className="text-xs">Les admins recevront la demande et décideront d'ajouter ou non le témoin.</DialogDescription>
          </div>
          <div className="space-y-3 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={witnessSearch} onChange={(e) => setWitnessSearch(e.target.value)} placeholder="Rechercher un témoin..." className="h-8 pl-8 text-xs" />
            </div>
            <ScrollArea className="max-h-60 rounded-lg border border-border/50">
              <div className="divide-y divide-border/40">
                {witnessCandidates.map((player) => {
                  const selected = witnessUserId === player.id;
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => setWitnessUserId(player.id)}
                      className={cn('flex w-full items-center gap-2 px-3 py-2 text-left transition-colors', selected ? 'bg-primary/10' : 'hover:bg-muted/40')}
                    >
                      <Avatar className="h-6 w-6 shrink-0">
                        {player.profilePicture ? <AvatarImage src={resolveImageUrl(player.profilePicture)} /> : null}
                        <AvatarFallback className="text-[9px]">{getInitials(player.username)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate text-xs" style={player.usernameColor ? { color: player.usernameColor } : undefined}>{player.username}</span>
                    </button>
                  );
                })}
                {witnessCandidates.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">Aucun témoin disponible.</p>}
              </div>
            </ScrollArea>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={witnessAnonymous} onCheckedChange={(checked) => setWitnessAnonymous(Boolean(checked))} />
              Garder le témoin anonyme (visible uniquement comme rôle)
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/60 px-4 py-2.5">
            <Button variant="ghost" size="sm" onClick={() => setWitnessRequestOpen(false)} disabled={witnessSubmitting}>Annuler</Button>
            <Button size="sm" disabled={witnessSubmitting || !witnessUserId} onClick={() => void handleRequestWitness()}>
              {witnessSubmitting ? 'Envoi...' : 'Envoyer la demande'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addMembersOpen} onOpenChange={setAddMembersOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <div className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Ajouter des membres</DialogTitle>
            <DialogDescription className="text-xs">Recherchez un joueur puis ajoutez-le au groupe.</DialogDescription>
          </div>
          <div className="space-y-3 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={addMemberSearch} onChange={(e) => setAddMemberSearch(e.target.value)} placeholder="Rechercher..." className="h-8 pl-8 text-xs" />
            </div>
            <ScrollArea className="max-h-72 rounded-lg border border-border/50">
              <div className="divide-y divide-border/40">
                {nonMembers.map((player) => (
                  <div key={player.id} className="flex items-center gap-2 px-3 py-2">
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

      <Dialog open={groupReportOpen} onOpenChange={setGroupReportOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <div className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Signaler la conversation</DialogTitle>
            <DialogDescription className="text-xs">Décris brièvement le problème rencontré.</DialogDescription>
          </div>
          <div className="space-y-3 p-4">
            <Textarea
              value={groupReportReason}
              onChange={(e) => setGroupReportReason(e.target.value)}
              placeholder="Raison du signalement"
              className="min-h-[120px] resize-none text-sm"
              maxLength={280}
            />
            <p className="text-[11px] text-muted-foreground/70">{groupReportReason.trim().length}/280</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/60 px-4 py-2.5">
            <Button variant="ghost" size="sm" onClick={() => setGroupReportOpen(false)} disabled={groupReportSubmitting}>
              Annuler
            </Button>
            <Button size="sm" disabled={groupReportSubmitting || !groupReportReason.trim()} onClick={() => void handleReportGroup()}>
              {groupReportSubmitting ? 'Envoi...' : 'Signaler'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showArgumentsDialog} onOpenChange={setShowArgumentsDialog}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
          <div className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Arguments des deux côtés</DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              Historique des plaidoiries enregistrées pour cette affaire.
            </DialogDescription>
          </div>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
            {argumentsLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />Chargement des arguments...
              </div>
            ) : courtArguments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucun argument pour le moment.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-sky-500/25 bg-sky-500/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Plaignant</p>
                  {courtArguments.filter((argument) => argument.side === 'PLAINTIFF').map((argument) => (
                    <div key={argument.id} className="rounded-lg border border-sky-500/25 bg-background/70 p-3">
                      <p className="text-[11px] text-muted-foreground">
                        {argument.author?.username ?? 'Anonyme'} · {format(new Date(argument.createdAt), 'dd MMM HH:mm', { locale: fr })}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{argument.content}</p>
                    </div>
                  ))}
                  {courtArguments.every((argument) => argument.side !== 'PLAINTIFF') && (
                    <p className="text-xs text-muted-foreground">Aucun argument du plaignant.</p>
                  )}
                </div>
                <div className="space-y-3 rounded-xl border border-red-500/25 bg-red-500/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Coupable</p>
                  {courtArguments.filter((argument) => argument.side === 'DEFENDANT').map((argument) => (
                    <div key={argument.id} className="rounded-lg border border-red-500/25 bg-background/70 p-3">
                      <p className="text-[11px] text-muted-foreground">
                        {argument.author?.username ?? 'Anonyme'} · {format(new Date(argument.createdAt), 'dd MMM HH:mm', { locale: fr })}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{argument.content}</p>
                    </div>
                  ))}
                  {courtArguments.every((argument) => argument.side !== 'DEFENDANT') && (
                    <p className="text-xs text-muted-foreground">Aucun argument du coupable.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Judge sanction modal ── */}
      {isNonAdminJudge && courtCase && (
        <SanctionModal
          open={showSanctionModal}
          onClose={() => setShowSanctionModal(false)}
          issuerRole="JUDGE"
          caseId={courtCase.id}
          parties={courtCase.parties
            .filter((p) => p.courtRole !== 'JUDGE' && p.user)
            .map((p) => ({ id: p.userId, username: p.user!.username }))}
          onSubmit={async (data) => {
            await justiceApi.proposeJudgeSanction(courtCase.id, {
              type: data.type,
              targetUserId: data.targetUserId,
              beneficiaryUserId: data.beneficiaryUserId,
              amount: data.amount,
              message: data.message,
            });
            toast({ title: 'Sanction proposée', description: 'Votre proposition a été transmise aux administrateurs.' });
          }}
        />
      )}

      {/* ── Verdict panel ── */}
      <Dialog open={showVerdictPanel} onOpenChange={setShowVerdictPanel}>
        <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden">
          <div className="border-b border-border/60 px-4 py-3 flex items-center gap-2">
            <Gavel className="h-4 w-4 text-amber-400" />
            <DialogTitle className="text-sm font-semibold">Rendre le verdict</DialogTitle>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs font-medium mb-1">Verdict <span className="text-destructive">*</span></p>
              <textarea value={verdictDraft} onChange={(e) => setVerdictDraft(e.target.value)} rows={4} maxLength={1000}
                placeholder="Résumez votre décision judiciaire..."
                className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <p className="text-xs font-medium mb-1">Sanction / Peine (optionnel)</p>
              <textarea value={sentencingDraft} onChange={(e) => setSentencingDraft(e.target.value)} rows={2} maxLength={500}
                placeholder="Amende, suspension, etc."
                className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/60 px-4 py-2.5">
            <Button variant="ghost" size="sm" onClick={() => setShowVerdictPanel(false)}>Annuler</Button>
            <Button size="sm" disabled={verdictSaving || !verdictDraft.trim()} onClick={handleDeliverVerdict}>
              {verdictSaving ? 'Envoi...' : 'Rendre le verdict'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Main layout ── */}
      <Dialog open={showRepresentationDialog} onOpenChange={setShowRepresentationDialog}>
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
          <div className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Choisir une representation</DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              Selectionne un cabinet prive ou demande un defenseur public pour ce dossier.
            </DialogDescription>
          </div>
          <div className="space-y-4 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setRepresentationType('PRIVATE_LAWYER')}
                className={cn(
                  'rounded-xl border px-4 py-3 text-left transition-colors',
                  representationType === 'PRIVATE_LAWYER' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border/40 bg-muted/10',
                )}
              >
                <p className="text-sm font-semibold">Cabinet prive</p>
                <p className="mt-1 text-xs text-muted-foreground">Choisis un avocat et sa specialite.</p>
              </button>
              <button
                type="button"
                onClick={() => setRepresentationType('PUBLIC_DEFENDER')}
                className={cn(
                  'rounded-xl border px-4 py-3 text-left transition-colors',
                  representationType === 'PUBLIC_DEFENDER' ? 'border-sky-500/40 bg-sky-500/10' : 'border-border/40 bg-muted/10',
                )}
              >
                <p className="text-sm font-semibold">Defenseur public</p>
                <p className="mt-1 text-xs text-muted-foreground">Representation par l'institution judiciaire.</p>
              </button>
            </div>

            {representationType === 'PRIVATE_LAWYER' ? (
              lawFirmsLoading ? (
                <div className="flex items-center justify-center rounded-xl border border-border/40 bg-muted/10 px-4 py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />Chargement des cabinets...
                </div>
              ) : sortedLawFirms.length === 0 ? (
                <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                  Aucun cabinet disponible pour le moment.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                    {sortedLawFirms.map((firm) => {
                      const primaryLawyer = firm.lawyers?.find((entry) => entry.isPrimaryLawyer) ?? firm.lawyers?.[0] ?? null;
                      return (
                        <button
                          key={firm.id}
                          type="button"
                          onClick={() => setSelectedLawFirmId(firm.id)}
                          className={cn(
                            'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                            selectedLawFirmId === firm.id ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border/40 bg-muted/10 hover:bg-muted/20',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/20">
                              {firm.logoUrl ? (
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={resolveImageUrl(firm.logoUrl)} alt={firm.name} />
                                  <AvatarFallback className="text-[10px]">{firm.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                              ) : (
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{firm.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {primaryLawyer?.user.username ?? firm.owner?.username ?? 'Cabinet'} · {primaryLawyer?.specialty ?? 'Avocat generaliste'}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {firm.avgRating ? `${firm.avgRating.toFixed(1)}/5` : 'Sans note'} · {firm.ratingCount ?? 0} avis
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
                    {selectedLawFirm ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-semibold">{selectedLawFirm.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{selectedLawFirm.description || 'Cabinet disponible pour cette affaire.'}</p>
                        </div>
                        <div className="space-y-2">
                          {selectedLawFirmLawyers.length === 0 ? (
                            <div className="rounded-xl border border-border/40 bg-background/70 px-3 py-3 text-xs text-muted-foreground">
                              Aucun avocat disponible dans ce cabinet pour ce dossier.
                            </div>
                          ) : selectedLawFirmLawyers.map((lawyer) => (
                            <button
                              key={lawyer.userId}
                              type="button"
                              onClick={() => setSelectedLawyerUserId(lawyer.userId)}
                              className={cn(
                                'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                                selectedLawyerUserId === lawyer.userId ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border/40 bg-background/70 hover:bg-muted/20',
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">{lawyer.user.username}</p>
                                  <p className="text-xs text-muted-foreground">{lawyer.specialty || 'Avocat generaliste'} · {lawyer.lawFirmName}</p>
                                </div>
                                {lawyer.isPrimaryLawyer ? <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Principal</span> : null}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Selectionne un cabinet puis un avocat.
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-4 text-sm text-muted-foreground">
                Les administrateurs et juges disponibles pourront intervenir comme defenseurs publics sur ce dossier.
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-border/60 px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => setShowRepresentationDialog(false)} disabled={representationSubmitting}>
              Annuler
            </Button>
            <Button size="sm" onClick={() => void handleSubmitRepresentation()} disabled={representationSubmitting || (representationType === 'PRIVATE_LAWYER' && (!selectedLawFirmId || !selectedLawyerUserId))}>
              {representationSubmitting ? 'Envoi...' : 'Confirmer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLawyerRatingDialog} onOpenChange={setShowLawyerRatingDialog}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <div className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Noter l'avocat</DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              Cet avis concerne la representation de ton dossier cloture.
            </DialogDescription>
          </div>
          <div className="space-y-4 p-4">
            {assignedLawyer ? (
              <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
                <p className="text-sm font-semibold">{assignedLawyer.username}</p>
                <p className="mt-1 text-xs text-muted-foreground">{assignedLawyerProfile?.specialty ?? 'Avocat generaliste'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{assignedLawyerProfile?.lawFirmName ?? assignedLawFirm?.name ?? 'Cabinet prive'}</p>
              </div>
            ) : null}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" onClick={() => setLawyerRating(value)} className="transition-transform hover:scale-110">
                  <Star className={cn('h-8 w-8', lawyerRating >= value ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-muted-foreground/30')} />
                </button>
              ))}
            </div>
            <textarea
              value={lawyerRatingComment}
              onChange={(e) => setLawyerRatingComment(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Decris ton experience avec cet avocat..."
              className="w-full resize-none rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-amber-400/40"
            />
            <p className="text-[11px] text-muted-foreground/60">{lawyerRatingComment.trim().length}/500</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/60 px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => setShowLawyerRatingDialog(false)} disabled={lawyerRatingSubmitting}>
              Fermer
            </Button>
            <Button size="sm" onClick={() => void handleSubmitLawyerRating()} disabled={lawyerRatingSubmitting || lawyerRating === 0 || !canRateAssignedLawyer}>
              {lawyerRatingSubmitting ? 'Envoi...' : 'Envoyer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="grid h-full min-h-0 lg:grid-cols-[300px_minmax(0,1fr)]">

          {/* ── Sidebar ── */}
          <aside className={cn('min-h-0 flex-col border-r border-border/60', selectedIdSafe ? 'hidden lg:flex' : 'flex')}>
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
              <h1 className="flex-1 text-sm font-semibold">Messages</h1>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="border-b border-border/60 px-3 py-2">
              <Tabs value={activeMessagesTab} onValueChange={(value) => setActiveMessagesTab(value as MessagingTab)}>
                <TabsList className="grid h-8 w-full grid-cols-2 bg-muted/20 p-0.5">
                  <TabsTrigger value={MESSAGING_TABS.OTHER} className="h-7 text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground">
                    Autres messages
                  </TabsTrigger>
                  <TabsTrigger value={MESSAGING_TABS.BUSINESS} className="h-7 text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground">
                    Affaires
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="mt-2 relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..."
                  className="w-full rounded-lg border border-border/50 bg-muted/30 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary/40 focus:bg-background transition-colors" />
              </div>
              <div className="mt-2 flex items-center gap-1">
                {(activeMessagesTab === MESSAGING_TABS.BUSINESS ? BUSINESS_SORT_OPTIONS : DM_SORT_OPTIONS)
                  && (Object.keys(activeMessagesTab === MESSAGING_TABS.BUSINESS ? BUSINESS_SORT_OPTIONS : DM_SORT_OPTIONS) as Array<DmSortMode | BusinessSortMode>).map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      size="sm"
                      variant={activeMessagesTab === MESSAGING_TABS.BUSINESS ? (businessSortMode === mode ? 'secondary' : 'ghost') : (dmSortMode === mode ? 'secondary' : 'ghost')}
                      className="h-6 rounded-full px-2 text-[10px]"
                      onClick={() => {
                        if (activeMessagesTab === MESSAGING_TABS.BUSINESS) {
                          setBusinessSortMode(mode as BusinessSortMode);
                        } else {
                          setDmSortMode(mode as DmSortMode);
                        }
                      }}
                    >
                      {activeMessagesTab === MESSAGING_TABS.BUSINESS
                        ? BUSINESS_SORT_OPTIONS[mode as BusinessSortMode]
                        : DM_SORT_OPTIONS[mode as DmSortMode]}
                    </Button>
                  ))}
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="w-full min-w-0 overflow-hidden py-1">
                {pinnedDms.length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">DM épinglés</p>
                    {pinnedDms.map((c) => <ConvRow key={c.id} conversation={c} currentUserId={user?.id} isActive={c.id === selectedIdSafe} isPinnedDm={pinnedDmIds.has(c.id)} isClosedAffaire={Boolean(c.courtCaseId && courtCaseStatusById[c.courtCaseId] === 'CLOSED')} onSelect={() => { setSelectedId(c.id); navigate('/messages', { replace: true }); }} onToggleFavorite={(e) => handleToggleFavorite(c.id, e)} onToggleDmPin={(e) => handleToggleDmPin(c.id, e)} />)}
                    {(dms.length > 0 || others.length > 0) && <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Conversations</p>}
                  </>
                )}
                {dms.map((c) => <ConvRow key={c.id} conversation={c} currentUserId={user?.id} isActive={c.id === selectedIdSafe} isPinnedDm={pinnedDmIds.has(c.id)} isClosedAffaire={Boolean(c.courtCaseId && courtCaseStatusById[c.courtCaseId] === 'CLOSED')} onSelect={() => { setSelectedId(c.id); navigate('/messages', { replace: true }); }} onToggleFavorite={(e) => handleToggleFavorite(c.id, e)} onToggleDmPin={(e) => handleToggleDmPin(c.id, e)} />)}
                {others.map((c) => <ConvRow key={c.id} conversation={c} currentUserId={user?.id} isActive={c.id === selectedIdSafe} isPinnedDm={false} isClosedAffaire={Boolean(c.courtCaseId && courtCaseStatusById[c.courtCaseId] === 'CLOSED')} onSelect={() => { setSelectedId(c.id); navigate('/messages', { replace: true }); }} onToggleFavorite={(e) => handleToggleFavorite(c.id, e)} onToggleDmPin={(e) => handleToggleDmPin(c.id, e)} />)}
                {pinnedDms.length === 0 && dms.length === 0 && others.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">{activeMessagesTab === MESSAGING_TABS.BUSINESS ? 'Aucune affaire.' : 'Aucune conversation.'}</p>
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* ── Chat area ── */}
          <section className={cn('min-h-0 min-w-0 flex-col overflow-hidden', selectedIdSafe ? 'flex' : 'hidden lg:flex')}>
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
                      <p className="truncate text-sm font-semibold leading-tight">{conversationDisplayTitle}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {selectedConversation.type === 'SUPPORT' ? 'Support'
                          : selectedConversation.type === 'GROUP' ? `${selectedConversation.participants.length} membres`
                          : 'Discussion privée'}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {isAdminViewer && detail && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={handleExportConversation}
                        title="Exporter la conversation (admin)"
                      >
                        <Download className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                    {selectedConversation.type === 'DM' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => handleToggleDmPin(selectedConversation.id)}
                      >
                        <Pin className={cn('h-4 w-4', pinnedDmIds.has(selectedConversation.id) ? 'fill-primary/20 text-primary' : 'text-muted-foreground')} />
                      </Button>
                    )}
                    {selectedConversation.type !== 'SUPPORT' && (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
                        onClick={() => handleToggleFavorite(selectedConversation.id)}>
                        <Star className={cn('h-4 w-4', selectedConversation.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
                      </Button>
                    )}
                    {selectedConversation.type === 'GROUP' ? (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={openGroupSettings}>
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {selectedConversation.type === 'DM' && dmOtherUser && (
                            <>
                              <DropdownMenuItem onClick={() => void handleBlock(dmOtherUser.id)}>
                                <Ban className="mr-2 h-3.5 w-3.5" />
                                {blockedIds.has(dmOtherUser.id) ? 'Débloquer' : 'Bloquer'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {selectedConversation.type !== 'SUPPORT' && (
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setGroupReportOpen(true)}>
                              <ShieldAlert className="mr-2 h-3.5 w-3.5" />Signaler
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Court banner */}
                {isCourtConversation && courtCase && (
                  <div className="border-b border-slate-300/40 bg-slate-500/5 px-3 py-2 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Scale className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="text-[11px] font-mono font-semibold text-foreground">#{courtCase.caseNumber}</span>
                    </div>
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wide', COURT_STATUS_LABELS[courtCase.status]?.color ?? 'text-muted-foreground')}>
                      {COURT_STATUS_LABELS[courtCase.status]?.label ?? courtCase.status}
                    </span>
                    {courtCase.plainte && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" size="sm" variant="outline" className="h-6 gap-1.5 rounded-full px-2 text-[10px]">
                            <FileText className="h-3 w-3" />
                            Voir plainte
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-80 max-w-[92vw] p-3" sideOffset={6}>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Titre initial</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{courtCase.plainte.title}</p>
                          <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Description initiale</p>
                          <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs text-foreground/90">
                            {courtCase.plainte.description}
                          </p>
                        </PopoverContent>
                      </Popover>
                    )}
                    {courtCase.plaintif && (
                      <span className="text-[10px] text-sky-500 font-medium">Plaignant</span>
                    )}
                    {courtCase.defendant && (
                      <span className="text-[10px] text-red-500 font-medium">Coupable</span>
                    )}
                    {assignedLawyer ? (
                      <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1">
                        <Briefcase className="h-3 w-3 shrink-0 text-emerald-500" />
                        <span className="text-[10px] font-medium text-foreground">{myCourtSide === 'PLAINTIFF' ? 'Avocat du plaignant' : 'Avocat du coupable'}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {(assignedLawyerProfile?.specialty ?? 'Avocat generaliste')} · {(assignedLawyerProfile?.lawFirmName ?? assignedLawFirm?.name ?? 'Cabinet prive')}
                        </span>
                      </div>
                    ) : null}
                    {hasAssignedPublicDefender && !assignedLawyer ? (
                      <div className="flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-2.5 py-1">
                        <Shield className="h-3 w-3 shrink-0 text-teal-500" />
                        <span className="text-[10px] font-medium text-foreground">{myCourtSide === 'PLAINTIFF' ? 'Defenseur public du plaignant' : 'Defenseur public du coupable'}</span>
                      </div>
                    ) : null}
                    <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 rounded-full px-2.5 text-[10px] gap-1"
                        onClick={() => void handleOpenArgumentsDialog()}
                      >
                        <FileText className="h-3 w-3" />
                        Voir arguments
                      </Button>
                      {canChooseRepresentation ? (
                        <Button type="button" variant="outline" size="sm" className="h-6 rounded-full px-2.5 text-[10px] gap-1" onClick={() => void openRepresentationDialog()}>
                          <Briefcase className="h-3 w-3" />
                          {hasCourtRepresentation ? 'Changer avocat' : 'Choisir avocat'}
                        </Button>
                      ) : null}
                      {canRequestWitness ? (
                        <Button type="button" variant="outline" size="sm" className="h-6 rounded-full px-2.5 text-[10px] gap-1" onClick={openWitnessRequestDialog}>
                          <Users className="h-3 w-3" />
                          Demander témoin
                        </Button>
                      ) : null}
                      {canRateAssignedLawyer ? (
                        <Button type="button" variant="outline" size="sm" className="h-6 rounded-full px-2.5 text-[10px] gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10" onClick={() => setShowLawyerRatingDialog(true)}>
                          <Star className="h-3 w-3" />
                          Noter l'avocat
                        </Button>
                      ) : null}
                      {isNonAdminJudge && courtCase && courtCase.status !== 'CLOSED' && (
                        <Button type="button" variant="outline" size="sm" className="h-6 rounded-full px-2.5 text-[10px] gap-1 border-amber-500/40 text-amber-600 hover:bg-amber-500/10" onClick={() => setShowSanctionModal(true)}>
                          <Gavel className="h-3 w-3" />
                          Sanction
                        </Button>
                      )}
                      {isAdminViewer && (
                        <>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" size="sm" className="h-6 rounded-full px-2.5 text-[10px] gap-1" disabled={statusChanging}>
                                Statut <ChevronDown className="h-2.5 w-2.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {Object.entries(COURT_STATUS_LABELS).map(([s, meta]) => (
                                <DropdownMenuItem key={s} onClick={() => void handleChangeStatus(s)}
                                  className={cn(courtCase?.status === s && 'bg-muted/60 font-medium')}>
                                  <span className={meta.color}>{meta.label}</span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button type="button" variant="outline" size="sm" className="h-6 rounded-full px-2.5 text-[10px] gap-1 border-slate-400/40 text-foreground hover:bg-muted/60"
                            onClick={() => { setVerdictDraft(courtCase?.verdict ?? ''); setSentencingDraft(courtCase?.sentencing ?? ''); setShowVerdictPanel(true); }}>
                            <Gavel className="h-3 w-3" />
                            Verdict
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {isCourtConversation && courtCase?.verdict && (
                  <div className="border-b border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-0.5">Verdict</p>
                    <p className="text-xs text-foreground">{courtCase.verdict}</p>
                    {courtCase.sentencing && <p className="text-[11px] text-muted-foreground mt-0.5">Sanction : {courtCase.sentencing}</p>}
                  </div>
                )}

                {/* Messages */}
                <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/15">
                  <ScrollArea ref={messagesScrollAreaRef} className="h-full px-4 py-4 sm:px-6">
                    <div className="flex w-full flex-col gap-0.5">
                      {convLoading ? (
                        <div className="py-2">
                          <ListSkeleton rows={4} showAvatar={false} />
                        </div>
                      ) : currentMessages.length === 0 ? (
                        <div className="flex flex-col items-center py-12 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-card">
                            <MessagesSquare className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="mt-3 text-sm font-medium">Lance la conversation</p>
                          <p className="mt-1 text-xs text-muted-foreground">Envoie un premier message.</p>
                        </div>
                      ) : currentMessages.map((msg, index) => {
                        // System messages render as centered announcements.
                        if (msg.type === 'COURT_SYSTEM' || msg.type === 'SYSTEM') {
                          const witnessRequest = msg.type === 'COURT_SYSTEM' ? parseCourtWitnessRequest(msg.body) : null;
                          const witnessUserId = witnessRequest?.witnessUserId ?? null;
                          return (
                            <div key={msg.id} className="flex justify-center py-2">
                              <div className={cn(
                                'flex max-w-[92vw] flex-wrap items-center justify-center gap-1.5 rounded-full border bg-background px-3 py-1 text-[11px] font-medium text-foreground shadow-sm',
                                msg.type === 'COURT_SYSTEM' ? 'border-slate-300/40' : 'border-border/60',
                              )}>
                                {msg.type === 'COURT_SYSTEM' ? <Scale className="h-3 w-3 shrink-0" /> : <Users className="h-3 w-3 shrink-0" />}
                                <span>{witnessRequest?.body ?? msg.body}</span>
                                {witnessUserId && canManageCourtGroup && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="ml-1 h-6 rounded-full px-2 text-[10px]"
                                    onClick={() => void handleAddMember(witnessUserId)}
                                  >
                                    Ajouter le témoin
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        }
                        const msgCourtRole = msg.courtRole ?? null;
                        const courtColors = msgCourtRole ? COURT_ROLE_COLORS[msgCourtRole] : null;
                        const isOwn = selectedConversation.type === 'SUPPORT'
                          ? Boolean(selectedAdminSupportUserId ? msg.fromAdmin : !msg.fromAdmin)
                          : (msg.sender?.id ?? msg.senderId ?? msg.userId) === user?.id && !msg.fromAdmin;
                        const prevMsg = currentMessages[index - 1];
                        const nextMsg = currentMessages[index + 1];
                        const prevIsOwn = prevMsg
                          ? selectedConversation.type === 'SUPPORT'
                            ? Boolean(selectedAdminSupportUserId ? prevMsg.fromAdmin : !prevMsg.fromAdmin)
                            : (prevMsg.sender?.id ?? prevMsg.senderId ?? prevMsg.userId) === user?.id && !prevMsg.fromAdmin
                          : false;
                        const nextIsOwn = nextMsg
                          ? selectedConversation.type === 'SUPPORT'
                            ? Boolean(selectedAdminSupportUserId ? nextMsg.fromAdmin : !nextMsg.fromAdmin)
                            : (nextMsg.sender?.id ?? nextMsg.senderId ?? nextMsg.userId) === user?.id && !nextMsg.fromAdmin
                          : false;
                        const sameSenderAsPrev = prevMsg && prevMsg.sender?.id === msg.sender?.id && prevIsOwn === isOwn;
                        const sameSenderAsNext = nextMsg && nextMsg.sender?.id === msg.sender?.id && nextIsOwn === isOwn;
                        const isFirst = !sameSenderAsPrev;
                        const isLast = !sameSenderAsNext;
                        const showDaySeparator = !prevMsg || !isSameCalendarDay(prevMsg.createdAt, msg.createdAt);
                        const showUnreadSeparator = firstUnreadMessageId === msg.id && !isMessagesAtBottom;
                        const isAnonymousCourtMessage = Boolean(isCourtConversation && isAnonymousCourtRole(msgCourtRole));
                        const showAvatar = !isOwn && selectedConversation.type === 'GROUP' && isLast;
                        const showSender = !isOwn && isFirst && selectedConversation.type === 'GROUP';
                        const reactions = msg.reactions ?? [];
                        const canDeleteMessage = isAdminViewer && msg.type !== 'COURT_SYSTEM';
                        const supportImages = msg.images ? JSON.parse(msg.images) as string[] : [];
                        if (msg.imageUrl) supportImages.push(msg.imageUrl);
                        const isBlocked = dmOtherUser && blockedIds.has(dmOtherUser.id);
                        const senderFallbackLabel = isAnonymousCourtMessage
                          ? getCourtSenderLabel(msgCourtRole, courtCase)
                          : (msg.sender?.username ?? (msg.fromAdmin ? 'Support' : 'Système'));
                        const senderDisplayLabel = getCourtVisibleLabel(
                          msgCourtRole,
                          msg.sender?.username ?? null,
                          isCourtJudge,
                          senderFallbackLabel,
                        );
                        return (
                          <div key={msg.id} className="flex flex-col gap-2">
                            {showDaySeparator && (
                              <div className="flex justify-center py-2">
                                <span className="rounded-full border border-border/50 bg-background/95 px-3 py-1 text-[11px] font-medium capitalize text-muted-foreground shadow-sm">
                                  {formatDayLabel(msg.createdAt)}
                                </span>
                              </div>
                            )}
                            {showUnreadSeparator && (
                              <div className="flex items-center gap-3 py-1">
                                <div className="h-px flex-1 bg-emerald-500/30" />
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
                                  Messages non lus
                                </span>
                                <div className="h-px flex-1 bg-emerald-500/30" />
                              </div>
                            )}
                            <div
                              className={cn('group flex items-end gap-1.5', isOwn ? 'flex-row-reverse' : 'flex-row', isLast ? 'mb-1' : 'mb-0')}
                            >
                            {/* Avatar placeholder for alignment in group */}
                            {selectedConversation.type === 'GROUP' && !isOwn && (
                              <div className="w-6 shrink-0">
                                {showAvatar && (
                                  <Avatar className="h-6 w-6">
                                    {!isAnonymousCourtMessage && msg.sender?.profilePicture ? <AvatarImage src={resolveImageUrl(msg.sender.profilePicture)} /> : null}
                                    <AvatarFallback className="text-[9px]">{isCourtJudge && msg.sender?.username ? getInitials(msg.sender.username) : isAnonymousCourtMessage ? getCourtRoleInitials(msgCourtRole) : getInitials(msg.sender?.username)}</AvatarFallback>
                                  </Avatar>
                                )}
                              </div>
                            )}
                            <div className={cn('flex max-w-[72%] flex-col', isOwn ? 'items-end' : 'items-start')}>
                              {showSender && (
                                <div className="mb-0.5 px-1 flex items-center gap-1.5">
                                  <p className={cn('text-[11px] font-semibold', courtColors ? courtColors.sender : undefined)} style={!courtColors && msg.sender?.usernameColor ? { color: msg.sender.usernameColor } : undefined}>
                                    {senderDisplayLabel}
                                  </p>
                                  {msgCourtRole && courtColors && !isAnonymousCourtMessage && (
                                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide', courtColors.badge)}>
                                      {COURT_ROLE_LABELS[msgCourtRole] ?? msgCourtRole}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="relative">
                                {conversationReactionsEnabled ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <div className={cn(
                                        'group cursor-pointer select-text px-3 py-1.5 text-sm leading-5',
                                        courtColors
                                          ? cn(courtColors.bubble, 'rounded-2xl')
                                          : isOwn
                                            ? cn('bg-primary text-primary-foreground', isFirst ? 'rounded-tl-2xl rounded-tr-2xl rounded-br-sm rounded-bl-2xl' : isLast ? 'rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl' : 'rounded-2xl rounded-tr-sm rounded-br-sm')
                                            : cn('bg-card border border-border/60 text-foreground', isFirst ? 'rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl' : isLast ? 'rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-sm' : 'rounded-2xl rounded-tl-sm rounded-bl-sm'),
                                        isBlocked && !isOwn && 'opacity-50'
                                      )}>
                                        {supportImages.length > 0 && (
                                          <div className="mb-1.5 flex flex-wrap gap-1">
                                            {supportImages.map((img, i) => {
                                              const resolvedImageUrl = resolveImageUrl(img);
                                              return (
                                                <button
                                                  key={i}
                                                  type="button"
                                                  aria-label="Aperçu de l'image"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    setCourtImagePreviewUrl(resolvedImageUrl);
                                                  }}
                                                  className="overflow-hidden rounded-lg"
                                                >
                                                  <img src={resolvedImageUrl} alt="" className="h-16 w-16 rounded-lg object-cover transition-transform hover:scale-105" />
                                                </button>
                                              );
                                            })}
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
                                ) : (
                                  <div className={cn(
                                    'group select-text px-3 py-1.5 text-sm leading-5',
                                    courtColors
                                      ? cn(courtColors.bubble, 'rounded-2xl')
                                      : isOwn
                                        ? cn('bg-primary text-primary-foreground', isFirst ? 'rounded-tl-2xl rounded-tr-2xl rounded-br-sm rounded-bl-2xl' : isLast ? 'rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl' : 'rounded-2xl rounded-tr-sm rounded-br-sm')
                                        : cn('bg-card border border-border/60 text-foreground', isFirst ? 'rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl' : isLast ? 'rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-sm' : 'rounded-2xl rounded-tl-sm rounded-bl-sm'),
                                    isBlocked && !isOwn && 'opacity-50'
                                  )}>
                                    {supportImages.length > 0 && (
                                      <div className="mb-1.5 flex flex-wrap gap-1">
                                        {supportImages.map((img, i) => {
                                          const resolvedImageUrl = resolveImageUrl(img);
                                          return (
                                            <button
                                              key={i}
                                              type="button"
                                              aria-label="Aperçu de l'image"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setCourtImagePreviewUrl(resolvedImageUrl);
                                              }}
                                              className="overflow-hidden rounded-lg"
                                            >
                                              <img src={resolvedImageUrl} alt="" className="h-16 w-16 rounded-lg object-cover transition-transform hover:scale-105" />
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                                    <p className={cn('mt-0.5 text-right text-[10px]', isOwn ? 'text-primary-foreground/55' : 'text-muted-foreground')}>
                                      {formatTime(msg.createdAt)}
                                    </p>
                                  </div>
                                )}
                                {canDeleteMessage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!window.confirm('Supprimer ce message ?')) return;
                                      void handleDeleteMessage(msg.id);
                                    }}
                                    className={cn(
                                      'absolute top-1/2 z-10 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/95 text-destructive/80 opacity-0 shadow-sm transition-all pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive',
                                      isOwn ? 'right-full mr-2' : 'left-full ml-2',
                                    )}
                                    title="Supprimer le message"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                              {conversationReactionsEnabled && reactions.length > 0 && (
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
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>

                {/* Input bar */}
                <div className="border-t border-border/60 bg-card px-3 py-2.5 sm:px-4">
                  {dmTypingUser && (
                    <p className="mb-2 text-[11px] text-muted-foreground">{dmTypingUser.username} est en train d'écrire...</p>
                  )}
                  {/* Admin court role selector */}
                  {isCourtConversation && isAdminViewer && (
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-medium">Envoyer en tant que :</span>
                      {Object.entries(COURT_ROLE_LABELS).map(([role, label]) => (
                        <button key={role} type="button"
                          onClick={() => setSelectedCourtRole(role)}
                          className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors border', selectedCourtRole === role
                            ? cn(COURT_ROLE_COLORS[role]?.badge ?? 'bg-primary/15 text-primary', 'border-transparent')
                            : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground')}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* My court role badge (non-admin in court chat) */}
                  {isCourtConversation && !isAdminViewer && myCourtRole && (
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">Vous parlez en tant que</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', COURT_ROLE_COLORS[myCourtRole]?.badge ?? 'bg-muted text-muted-foreground')}>
                        {COURT_ROLE_LABELS[myCourtRole] ?? myCourtRole}
                      </span>
                    </div>
                  )}
                  {isCourtChatLocked && (
                    <div className="mb-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                      Cette affaire n est pas en cours. Le chat est verrouille.
                    </div>
                  )}
                  <div className="flex w-full items-end gap-2 flex-wrap">
                      {imageUrlToSend && (
                        <div className="relative inline-block w-full mb-2 border border-border rounded-xl px-2 py-2 w-max max-w-sm">
                          <img src={resolveImageUrl(imageUrlToSend)} alt="Upload preview" className="h-40 rounded-lg object-cover" />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow-md"
                            onClick={() => setImageUrlToSend('')}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 rounded-xl bg-background border shadow-sm"
                        disabled={isUploadingImage || isCourtChatLocked}
                        onClick={() => imageInputRef.current?.click()}
                      >
                        {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      
                      <input
                        type="file"
                        ref={imageInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void handleImageSelection(file);
                          }
                          e.target.value = '';
                        }}
                      />
                      <div className="flex-1 rounded-2xl border border-border/50 bg-muted/20 px-3 py-2 focus-within:border-primary/40 focus-within:bg-background transition-colors">
                      <textarea ref={textareaRef} value={draft} rows={1}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setDraft(nextValue);

                          if (socket && selectedConversation?.type === 'DM' && selectedIdSafe) {
                            lastTypingConversationRef.current = selectedIdSafe;
                            socket.emit('messaging:typing', { conversationId: selectedIdSafe, isTyping: nextValue.trim().length > 0 });
                            if (typingTimeoutRef.current) {
                              clearTimeout(typingTimeoutRef.current);
                            }
                            if (nextValue.trim().length > 0) {
                              typingTimeoutRef.current = setTimeout(() => {
                                socket.emit('messaging:typing', { conversationId: selectedIdSafe, isTyping: false });
                                typingTimeoutRef.current = null;
                              }, 2000);
                            } else {
                              typingTimeoutRef.current = null;
                              lastTypingConversationRef.current = null;
                            }
                          }

                          e.currentTarget.style.height = 'auto';
                          e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 112) + 'px';
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                        placeholder={isCourtChatLocked ? 'Le chat est disponible uniquement quand l affaire est en cours' : `Message ${selectedConversation.displayName}`}
                        className="w-full resize-none bg-transparent text-sm leading-5 outline-none placeholder:text-muted-foreground/50"
                        maxLength={1000} style={{ minHeight: '20px' }} disabled={isCourtChatLocked} />
                    </div>
                    <Button type="button" size="icon" className="h-9 w-9 shrink-0 rounded-xl"
                        disabled={sending || (!draft.trim() && !imageUrlToSend) || isCourtChatLocked} onClick={() => void handleSend()}>
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

      <Dialog open={Boolean(courtImagePreviewUrl)} onOpenChange={(open) => { if (!open) setCourtImagePreviewUrl(null); }}>
        <DialogContent className="h-[95vh] w-[95vw] max-w-none overflow-hidden border-0 bg-black/95 p-0 text-white sm:rounded-2xl">
          {courtImagePreviewUrl && (
            <div className="flex h-full w-full items-center justify-center p-4">
              <img src={courtImagePreviewUrl} alt="Aperçu du message" className="max-h-full max-w-full object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>

    </PageShell>
  );
}

// ── Sidebar conversation row ──────────────────────────────────────────────────
function ConvRow({
  conversation,
  currentUserId,
  isActive,
  isPinnedDm,
  isClosedAffaire,
  onSelect,
  onToggleFavorite,
  onToggleDmPin,
}: {
  conversation: MessagingConversationSummary;
  currentUserId?: string | null;
  isActive: boolean;
  isPinnedDm: boolean;
  isClosedAffaire: boolean;
  onSelect: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onToggleDmPin: (e: React.MouseEvent) => void;
}) {
  const dmParticipant = conversation.type === 'DM'
    ? conversation.participants.find((entry) => entry.user.id !== 'support')?.user ?? null
    : null;
  const lastOutgoingMessageReadState = getLastOutgoingMessageReadState(conversation, currentUserId);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden px-3 py-2 text-left transition-colors',
        isClosedAffaire && 'opacity-55',
        isActive ? 'bg-primary/10' : 'hover:bg-muted/50',
      )}
    >
      <div className={cn(isClosedAffaire && 'grayscale')}>
        <ConversationAvatar conversation={conversation} />
      </div>
      <div className="w-0 min-w-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 items-baseline gap-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            <p
              className={cn(
                'min-w-0 flex-1 truncate text-xs font-semibold',
                conversation.type === 'DM' && 'text-foreground',
                isActive && conversation.type !== 'DM' && 'text-primary',
                isClosedAffaire && 'text-muted-foreground',
              )}
              style={conversation.type === 'DM' && dmParticipant?.usernameColor ? { color: dmParticipant.usernameColor } : undefined}
            >
              {conversation.displayName}
            </p>
            {conversation.type === 'SUPPORT' && (
              <span className="shrink-0 rounded-full bg-sky-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-600">
                Support
              </span>
            )}
            {conversation.courtCaseId && (
              <span className="shrink-0 rounded-full bg-amber-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 flex items-center gap-0.5">
                <Scale className="h-2.5 w-2.5" />Tribunal
              </span>
            )}
            {conversation.tagType === 'Professionnel' && (
              <span className="shrink-0 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-600">
                {conversation.tagLabel ?? 'Professionnel'}
              </span>
            )}
          </div>
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{conversation.lastMessage?.createdAt ? formatTime(conversation.lastMessage.createdAt) : ''}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
          {lastOutgoingMessageReadState && (
            <span
              className={cn(
                'inline-flex shrink-0 items-center justify-center',
                lastOutgoingMessageReadState === 'READ' ? 'text-sky-500' : 'text-muted-foreground/70',
              )}
              title={lastOutgoingMessageReadState === 'READ' ? 'Lu' : 'Non lu'}
              aria-label={lastOutgoingMessageReadState === 'READ' ? 'Dernier message lu' : 'Dernier message non lu'}
            >
              {lastOutgoingMessageReadState === 'READ' ? (
                <CheckCheck className="h-3.5 w-3.5" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </span>
          )}
          <p className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted-foreground">{getPreview(conversation)}</p>
          {conversation.unreadCount > 0 && (
            <span
              className="ml-auto shrink-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-primary/20 bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground shadow-sm"
              title={`${conversation.unreadCount} message${conversation.unreadCount > 1 ? 's' : ''} non lu${conversation.unreadCount > 1 ? 's' : ''}`}
            >
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
      {conversation.type !== 'SUPPORT' && (
        <div className="ml-0.5 flex shrink-0 items-center gap-1">
          {conversation.type === 'DM' && (
            <button
              type="button"
              onClick={onToggleDmPin}
              className={cn('opacity-0 transition-opacity group-hover:opacity-100', isPinnedDm && 'opacity-100')}
              tabIndex={-1}
            >
              <Pin className={cn('h-3.5 w-3.5', isPinnedDm ? 'fill-primary/20 text-primary' : 'text-muted-foreground')} />
            </button>
          )}
          <button type="button"
            onClick={onToggleFavorite}
            className={cn('opacity-0 transition-opacity group-hover:opacity-100', conversation.isFavorite && 'opacity-100')}
            tabIndex={-1}>
            <Star className={cn('h-3.5 w-3.5', conversation.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
          </button>
        </div>
      )}
    </button>
  );
}

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TabsContent } from '@/components/ui/tabs';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import {
  Archive,
  AlertTriangle,
  Bug,
  Check,
  Gavel,
  Inbox,
  Loader2,
  Send,
  Upload,
  UserCog,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import type { BanAppeal, BugReport, NameChangeRequest, PendingUser } from '../../../services/api';

type ArchivedRegistration = PendingUser & {
  registrationStatus: 'APPROVED' | 'REJECTED';
  reviewedAt?: string;
  importedFromLegacy?: boolean;
};

type InboxTabProps = {
  pendingUsers: PendingUser[];
  bugReports: BugReport[];
  banAppeals: BanAppeal[];
  nameChangeRequests: NameChangeRequest[];
  archivedRegistrations: ArchivedRegistration[];
  inboxFilter: 'all' | 'registrations' | 'bugs' | 'appeals' | 'namechanges' | 'archived';
  selectedInboxItem: string | null;
  legacyArchivedRegistrationsCount: number;
  importingArchivedRegistrations: boolean;
  loadingPending: boolean;
  loadingBugs: boolean;
  loadingAppeals: boolean;
  loadingNameChanges: boolean;
  approvingUser: string | null;
  rejectingUser: string | null;
  updatingBug: string | null;
  reviewingAppeal: string | null;
  reviewingNameChange: string | null;
  bugReply: Record<string, string>;
  importArchivedRegistrations: () => void;
  setInboxFilter: (value: 'all' | 'registrations' | 'bugs' | 'appeals' | 'namechanges' | 'archived') => void;
  setSelectedInboxItem: (value: string | null) => void;
  approveUser: (userId: string) => void;
  rejectUser: (userId: string) => void;
  setBugReply: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  sendBugReply: (bug: BugReport) => void;
  toggleBugStatus: (bug: BugReport) => void;
  reviewBanAppeal: (appealId: string, action: 'approve' | 'reject') => void;
  reviewNameChangeRequest: (requestId: string, action: 'approve' | 'reject') => void;
};

export function InboxTab(props: InboxTabProps) {
  const {
    pendingUsers,
    bugReports,
    banAppeals,
    nameChangeRequests,
    archivedRegistrations,
    inboxFilter,
    selectedInboxItem,
    legacyArchivedRegistrationsCount,
    importingArchivedRegistrations,
    loadingPending,
    loadingBugs,
    loadingAppeals,
    loadingNameChanges,
    approvingUser,
    rejectingUser,
    updatingBug,
    reviewingAppeal,
    reviewingNameChange,
    bugReply,
    importArchivedRegistrations,
    setInboxFilter,
    setSelectedInboxItem,
    approveUser,
    rejectUser,
    setBugReply,
    sendBugReply,
    toggleBugStatus,
    reviewBanAppeal,
    reviewNameChangeRequest,
  } = props;

  return (
    <TabsContent value="inbox" className={SPACING.SECTION_SPACING}>
      {(() => {
        const registrationItems = pendingUsers.map(u => ({
          id: `reg-${u.id}`, type: 'registration' as const, date: new Date(u.createdAt), data: u,
        }));
        const allBugItems = bugReports.map(b => ({
          id: `bug-${b.id}`, type: 'bug' as const, date: new Date(b.createdAt), data: b,
        }));
        const allAppealItems = banAppeals.map(a => ({
          id: `appeal-${a.id}`, type: 'appeal' as const, date: new Date(a.createdAt), data: a,
        }));
        const allNameChangeItems = nameChangeRequests.map(n => ({
          id: `nc-${n.id}`, type: 'namechange' as const, date: new Date(n.createdAt), data: n,
        }));

        const pendingBugItems = allBugItems.filter(i => (i.data as BugReport).status === 'PENDING');
        const pendingAppealItems = allAppealItems.filter(i => (i.data as BanAppeal).status === 'PENDING');
        const pendingNameChangeItems = allNameChangeItems.filter(i => (i.data as NameChangeRequest).status === 'PENDING');

        const archivedRegistrationItems = archivedRegistrations.map(u => ({
          id: `reg-${u.id}`, type: 'registration' as const, date: new Date(u.createdAt), data: u,
        }));

        const archivedItems = [
          ...archivedRegistrationItems,
          ...allBugItems.filter(i => (i.data as BugReport).status === 'DONE'),
          ...allAppealItems.filter(i => (i.data as BanAppeal).status !== 'PENDING'),
          ...allNameChangeItems.filter(i => (i.data as NameChangeRequest).status !== 'PENDING'),
        ].sort((a, b) => b.date.getTime() - a.date.getTime());

        const allPending = pendingUsers.length + pendingBugItems.length + pendingAppealItems.length + pendingNameChangeItems.length;

        const activeItems = inboxFilter === 'registrations' ? registrationItems
          : inboxFilter === 'bugs' ? pendingBugItems
          : inboxFilter === 'appeals' ? pendingAppealItems
          : inboxFilter === 'namechanges' ? pendingNameChangeItems
          : inboxFilter === 'archived' ? archivedItems
          : [...registrationItems, ...pendingBugItems, ...pendingAppealItems, ...pendingNameChangeItems]
              .sort((a, b) => b.date.getTime() - a.date.getTime());

        const allItemsPool = [...registrationItems, ...archivedRegistrationItems, ...allBugItems, ...allAppealItems, ...allNameChangeItems];
        const selectedItem = selectedInboxItem ? allItemsPool.find(i => i.id === selectedInboxItem) ?? null : null;

        const ADMIN_CATS = [
          { key: 'all' as const, label: 'Tout', Icon: Inbox, count: allPending },
          { key: 'registrations' as const, label: 'Inscriptions', Icon: UserPlus, count: pendingUsers.length },
          { key: 'bugs' as const, label: 'Bugs', Icon: Bug, count: pendingBugItems.length },
          { key: 'appeals' as const, label: 'Appels de ban', Icon: Gavel, count: pendingAppealItems.length },
          { key: 'namechanges' as const, label: 'Pseudos', Icon: UserCog, count: pendingNameChangeItems.length },
          { key: 'archived' as const, label: 'Archivé', Icon: Archive, count: archivedItems.length },
        ];

        return (
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/30 pb-3 shrink-0">
              <div className="flex items-center justify-between gap-4">
                <CardDescription>Boîte de réception</CardDescription>
                {legacyArchivedRegistrationsCount > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={importArchivedRegistrations}
                    disabled={importingArchivedRegistrations}
                    className="h-8 gap-1.5"
                  >
                    {importingArchivedRegistrations ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Importer {legacyArchivedRegistrationsCount} archive{legacyArchivedRegistrationsCount > 1 ? 's' : ''} locale{legacyArchivedRegistrationsCount > 1 ? 's' : ''}
                  </Button>
                )}
                <div className={cn('flex items-center gap-2', TYPOGRAPHY.SMALL)}>
                  <Inbox className="h-4 w-4" />
                  <span>{allPending} en attente</span>
                </div>
              </div>
            </CardHeader>

            <div className="flex" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
              <div className="w-44 shrink-0 border-r border-border/40 p-1.5 space-y-0.5 overflow-y-auto custom-scroll">
                {ADMIN_CATS.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => { setInboxFilter(cat.key); setSelectedInboxItem(null); }}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors text-left',
                      inboxFilter === cat.key
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    )}
                  >
                    <cat.Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 truncate">{cat.label}</span>
                    {cat.count > 0 && (
                      <span className="text-[10px] font-semibold bg-primary/15 text-primary rounded px-1 shrink-0">
                        {cat.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="w-72 shrink-0 border-r border-border/40 overflow-y-auto custom-scroll">
                {(loadingPending || loadingBugs || loadingAppeals || loadingNameChanges) ? (
                  <div className="flex justify-center py-12">
                    <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
                  </div>
                ) : activeItems.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    {inboxFilter === 'archived'
                      ? <Archive className="h-8 w-8 mx-auto text-muted-foreground/50" />
                      : <Inbox className="h-8 w-8 mx-auto text-muted-foreground/50" />}
                    <p className={TYPOGRAPHY.MUTED}>
                      {inboxFilter === 'archived' ? 'Aucun élément archivé' : 'Boîte de réception vide'}
                    </p>
                  </div>
                ) : (
                  <div>
                    {activeItems.map((item) => {
                      const isSelected = selectedInboxItem === item.id;

                      let title = '';
                      let subtitle = '';
                      let badgeLabel = '';
                      let badgeColor = '';
                      let borderAccent = '';

                      if (item.type === 'registration') {
                        const u = item.data as PendingUser & { registrationStatus?: 'APPROVED' | 'REJECTED' };
                        title = u.username;
                        subtitle = u.email;
                        badgeLabel = u.registrationStatus === 'APPROVED' ? 'Approuvé' : u.registrationStatus === 'REJECTED' ? 'Rejeté' : 'Inscription';
                        badgeColor = u.registrationStatus === 'APPROVED' ? 'bg-green-500/20 text-green-400' : u.registrationStatus === 'REJECTED' ? 'bg-zinc-500/20 text-zinc-400' : 'bg-blue-500/20 text-blue-400';
                        borderAccent = u.registrationStatus === 'APPROVED' ? 'border-l-green-500' : u.registrationStatus === 'REJECTED' ? 'border-l-zinc-500' : 'border-l-blue-500';
                      } else if (item.type === 'bug') {
                        const b = item.data as BugReport;
                        title = b.title;
                        subtitle = b.user.username;
                        const done = b.status === 'DONE';
                        badgeLabel = done ? 'Résolu' : 'Bug';
                        badgeColor = done ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400';
                        borderAccent = done ? 'border-l-green-500' : 'border-l-amber-500';
                      } else if (item.type === 'appeal') {
                        const a = item.data as BanAppeal;
                        title = a.user.username;
                        subtitle = a.ban.reason;
                        badgeLabel = a.status === 'PENDING' ? 'Appel' : a.status === 'APPROVED' ? 'Accepté' : 'Rejeté';
                        badgeColor = a.status === 'PENDING' ? 'bg-red-500/20 text-red-400' : a.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400';
                        borderAccent = 'border-l-red-500';
                      } else {
                        const n = item.data as NameChangeRequest;
                        title = n.requestedUsername;
                        subtitle = `de ${n.currentUsername}`;
                        badgeLabel = n.status === 'PENDING' ? 'Pseudo' : n.status === 'APPROVED' ? 'Accepté' : 'Rejeté';
                        badgeColor = n.status === 'PENDING' ? 'bg-purple-500/20 text-purple-400' : n.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400';
                        borderAccent = 'border-l-purple-500';
                      }

                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelectedInboxItem(isSelected ? null : item.id)}
                          className={cn(
                            'w-full text-left border-l-2 border-b border-b-border/20 transition-colors',
                            borderAccent,
                            isSelected ? 'bg-accent/70' : 'hover:bg-accent/30'
                          )}
                        >
                          <div className="px-3 py-3">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0', badgeColor)}>
                                {badgeLabel}
                              </span>
                              <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                {item.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                            <p className="text-sm font-medium truncate leading-tight">{title}</p>
                            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{subtitle}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 overflow-y-auto custom-scroll">
                {!selectedItem ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-2 text-center px-8">
                    <Inbox className="h-10 w-10 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground/50">Sélectionne un élément</p>
                  </div>
                ) : selectedItem.type === 'registration' ? (
                  (() => {
                    const u = selectedItem.data as PendingUser & { registrationStatus?: 'APPROVED' | 'REJECTED' };
                    return (
                      <div className="p-6 space-y-5">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            {u.registrationStatus === 'APPROVED' ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">Approuvé</span>
                            ) : u.registrationStatus === 'REJECTED' ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-zinc-500/20 text-zinc-400">Rejeté</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">Inscription</span>
                            )}
                            <span className="text-xs text-muted-foreground/60">
                              {selectedItem.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold">{u.username}</h3>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                          {u.firstName && <p className="text-sm text-muted-foreground">Prénom : {u.firstName}</p>}
                          {(u.schoolLevel || u.classLetter) && (
                            <p className="text-sm text-muted-foreground">
                              Classe : {[u.schoolLevel === 'SECONDE' ? 'Seconde' : u.schoolLevel === 'PREMIERE' ? 'Première' : u.schoolLevel === 'TERMINALE' ? 'Terminale' : null, u.classLetter].filter(Boolean).join(' ')}
                            </p>
                          )}
                        </div>
                        <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                          <p className="text-xs font-medium text-muted-foreground/70 mb-2">Message de motivation</p>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {u.motivationMessage?.trim() || 'Non renseigné'}
                          </p>
                        </div>
                        {!u.registrationStatus && (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => approveUser(u.id)} disabled={approvingUser === u.id} className="h-8 border-green-500/50 text-green-500 hover:bg-green-500/10">
                              {approvingUser === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Approuver</>}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" disabled={rejectingUser === u.id} className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10">
                                  {rejectingUser === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserX className="h-4 w-4 mr-1" />Rejeter</>}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-destructive" />
                                    Rejeter la demande de {u.username} ?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    L'utilisateur devra créer un nouveau compte s'il souhaite réessayer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => rejectUser(u.id)} className="bg-destructive hover:bg-destructive/90">Rejeter</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : selectedItem.type === 'bug' ? (
                  (() => {
                    const bug = selectedItem.data as BugReport;
                    const isArchived = bug.status === 'DONE';
                    const replyValue = bugReply[bug.id] ?? '';
                    return (
                      <div className="p-6 space-y-5">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={cn('text-xs px-2 py-0.5 rounded', isArchived ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400')}>
                              {isArchived ? 'Résolu' : 'Bug'}
                            </span>
                            <span className="text-xs text-muted-foreground/60">
                              {selectedItem.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h3 className={cn('text-lg font-semibold', isArchived && 'opacity-60')}>{bug.title}</h3>
                          <p className="text-sm text-muted-foreground">Par {bug.user.username}</p>
                        </div>
                        <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                          <p className="text-sm whitespace-pre-wrap break-words">{bug.description}</p>
                        </div>
                        {bug.images && JSON.parse(bug.images).length > 0 && (
                          <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                            <p className="text-xs font-medium text-muted-foreground/70 mb-3">Images jointes</p>
                            <div className="grid grid-cols-2 gap-2">
                              {JSON.parse(bug.images).map((imgUrl: string, idx: number) => (
                                <img
                                  key={idx}
                                  src={imgUrl}
                                  alt={`Bug image ${idx + 1}`}
                                  className="w-full h-32 object-cover rounded border border-border/30"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {bug.adminReply && (
                          <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4">
                            <p className="text-xs font-medium text-indigo-400/70 mb-2">Réponse envoyée</p>
                            <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground">{bug.adminReply}</p>
                          </div>
                        )}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground/70">
                            {bug.adminReply ? 'Modifier la réponse' : 'Répondre au signalement'}
                          </p>
                          <textarea
                            className="w-full rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-muted-foreground/40"
                            rows={3}
                            placeholder="Écrivez votre réponse… Elle sera envoyée par notification et par e-mail."
                            value={replyValue}
                            onChange={e => setBugReply(prev => ({ ...prev, [bug.id]: e.target.value }))}
                            disabled={updatingBug === bug.id}
                          />
                          <div className="flex items-center gap-2">
                            {replyValue.trim() && (
                              <Button size="sm" variant="outline" onClick={() => sendBugReply(bug)} disabled={updatingBug === bug.id}
                                className="h-8 border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10">
                                {updatingBug === bug.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" />Envoyer</>}
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => toggleBugStatus(bug)} disabled={updatingBug === bug.id}
                              className={cn('h-8', isArchived ? 'border-amber-500/50 text-amber-500 hover:bg-amber-500/10' : 'border-green-500/50 text-green-500 hover:bg-green-500/10')}>
                              {updatingBug === bug.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isArchived ? <><X className="h-4 w-4 mr-1" />Rouvrir</> : <><Check className="h-4 w-4 mr-1" />Résolu</>}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : selectedItem.type === 'appeal' ? (
                  (() => {
                    const appeal = selectedItem.data as BanAppeal;
                    const isPending = appeal.status === 'PENDING';
                    return (
                      <div className="p-6 space-y-5">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={cn('text-xs px-2 py-0.5 rounded',
                              appeal.status === 'PENDING' ? 'bg-red-500/20 text-red-400' :
                              appeal.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                              'bg-zinc-500/20 text-zinc-400')}>
                              {appeal.status === 'PENDING' ? 'Appel en attente' : appeal.status === 'APPROVED' ? 'Accepté' : 'Rejeté'}
                            </span>
                            <span className="text-xs text-muted-foreground/60">
                              {selectedItem.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold">{appeal.user.username}</h3>
                          <p className="text-sm text-muted-foreground">{appeal.user.email}</p>
                        </div>
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                          <p className="text-xs font-medium text-muted-foreground/70 mb-1.5">Motif du bannissement</p>
                          <p className="text-sm font-medium">{appeal.ban.reason}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {appeal.ban.type === 'PERMANENT' ? 'Permanent' : appeal.ban.expiresAt ? `Expire le ${new Date(appeal.ban.expiresAt).toLocaleDateString('fr-FR')}` : 'Temporaire'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                          <p className="text-xs font-medium text-muted-foreground/70 mb-2">Message de l'utilisateur</p>
                          <p className="text-sm whitespace-pre-wrap break-words">{appeal.message}</p>
                        </div>
                        {isPending && (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => reviewBanAppeal(appeal.id, 'approve')} disabled={reviewingAppeal === appeal.id} className="h-8 border-green-500/50 text-green-500 hover:bg-green-500/10">
                              {reviewingAppeal === appeal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Lever le ban</>}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => reviewBanAppeal(appeal.id, 'reject')} disabled={reviewingAppeal === appeal.id} className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10">
                              {reviewingAppeal === appeal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" />Rejeter</>}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  (() => {
                    const req = selectedItem.data as NameChangeRequest;
                    const isPending = req.status === 'PENDING';
                    return (
                      <div className="p-6 space-y-5">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={cn('text-xs px-2 py-0.5 rounded',
                              req.status === 'PENDING' ? 'bg-purple-500/20 text-purple-400' :
                              req.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                              'bg-zinc-500/20 text-zinc-400')}>
                              {req.status === 'PENDING' ? 'Changement de pseudo' : req.status === 'APPROVED' ? 'Accepté' : 'Rejeté'}
                            </span>
                            <span className="text-xs text-muted-foreground/60">
                              {selectedItem.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold">{req.user.username}</h3>
                          <p className="text-sm text-muted-foreground">{req.user.email}</p>
                        </div>
                        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                          <p className="text-xs font-medium text-muted-foreground/70 mb-3">Changement demandé</p>
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="text-[11px] text-muted-foreground/60 mb-0.5">Actuel</p>
                              <p className="text-sm font-medium">{req.currentUsername}</p>
                            </div>
                            <span className="text-muted-foreground/50 text-lg">→</span>
                            <div>
                              <p className="text-[11px] text-muted-foreground/60 mb-0.5">Demandé</p>
                              <p className="text-sm font-semibold text-purple-400">{req.requestedUsername}</p>
                            </div>
                          </div>
                        </div>
                        {req.reason && (
                          <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                            <p className="text-xs font-medium text-muted-foreground/70 mb-2">Raison</p>
                            <p className="text-sm whitespace-pre-wrap break-words">{req.reason}</p>
                          </div>
                        )}
                        {isPending && (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => reviewNameChangeRequest(req.id, 'approve')} disabled={reviewingNameChange === req.id} className="h-8 border-green-500/50 text-green-500 hover:bg-green-500/10">
                              {reviewingNameChange === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Approuver</>}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => reviewNameChangeRequest(req.id, 'reject')} disabled={reviewingNameChange === req.id} className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10">
                              {reviewingNameChange === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" />Rejeter</>}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          </Card>
        );
      })()}
    </TabsContent>
  );
}

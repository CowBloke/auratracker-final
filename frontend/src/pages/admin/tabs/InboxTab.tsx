import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TabsContent } from '@/components/ui/tabs';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { Archive, Award, Bug, Check, FileText, Gavel, Inbox, Loader2, Send, Upload, UserCog, UserPlus, UserX, X } from 'lucide-react';
import { BadgeIcon } from '@/components/badges/BadgeIcon';
import type { BanAppeal, BugReport, CustomBadgeRequest, NameChangeRequest, PendingFormationReviewItem, PendingUser } from '../../../services/api';

type ArchivedRegistration = PendingUser & {
  registrationStatus: 'APPROVED' | 'REJECTED';
  reviewedAt?: string;
  importedFromLegacy?: boolean;
};

type InboxFilter = 'all' | 'registrations' | 'bugs' | 'appeals' | 'namechanges' | 'badges' | 'formations' | 'archived';
type ItemType = 'registration' | 'bug' | 'appeal' | 'namechange' | 'badge' | 'formation';
type InboxItem = { id: string; type: ItemType; date: Date; data: unknown };

type InboxTabProps = {
  pendingUsers: PendingUser[];
  bugReports: BugReport[];
  banAppeals: BanAppeal[];
  nameChangeRequests: NameChangeRequest[];
  customBadgeRequests: CustomBadgeRequest[];
  pendingFormationReviews: PendingFormationReviewItem[];
  archivedRegistrations: ArchivedRegistration[];
  inboxFilter: InboxFilter;
  selectedInboxItem: string | null;
  legacyArchivedRegistrationsCount: number;
  importingArchivedRegistrations: boolean;
  loadingPending: boolean;
  loadingBugs: boolean;
  loadingAppeals: boolean;
  loadingNameChanges: boolean;
  loadingCustomBadgeRequests: boolean;
  loadingPendingFormationReviews: boolean;
  approvingUser: string | null;
  rejectingUser: string | null;
  updatingBug: string | null;
  reviewingAppeal: string | null;
  reviewingNameChange: string | null;
  reviewingFormationProductId: string | null;
  bugReply: Record<string, string>;
  rejectNotes: Record<string, string>;
  importArchivedRegistrations: () => void;
  setInboxFilter: (value: InboxFilter) => void;
  setSelectedInboxItem: (value: string | null) => void;
  approveUser: (userId: string) => void;
  rejectUser: (userId: string) => void;
  setBugReply: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setRejectNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  sendBugReply: (bug: BugReport) => void;
  toggleBugStatus: (bug: BugReport) => void;
  reviewBanAppeal: (appealId: string, action: 'approve' | 'reject') => void;
  reviewNameChangeRequest: (requestId: string, action: 'approve' | 'reject') => void;
  approveCustomBadgeRequest: (requestId: string) => void;
  rejectCustomBadgeRequest: (requestId: string) => void;
  reviewFormationProduct: (businessId: string, productId: string, action: 'approve' | 'reject') => void;
};

export function InboxTab(props: InboxTabProps) {
  const { pendingUsers, bugReports, banAppeals, nameChangeRequests, customBadgeRequests, pendingFormationReviews, archivedRegistrations, inboxFilter, selectedInboxItem, legacyArchivedRegistrationsCount, importingArchivedRegistrations, loadingPending, loadingBugs, loadingAppeals, loadingNameChanges, loadingCustomBadgeRequests, loadingPendingFormationReviews, approvingUser, rejectingUser, updatingBug, reviewingAppeal, reviewingNameChange, reviewingFormationProductId, bugReply, rejectNotes, importArchivedRegistrations, setInboxFilter, setSelectedInboxItem, approveUser, rejectUser, setBugReply, setRejectNotes, sendBugReply, toggleBugStatus, reviewBanAppeal, reviewNameChangeRequest, approveCustomBadgeRequest, rejectCustomBadgeRequest, reviewFormationProduct } = props;

  const registrationItems: InboxItem[] = pendingUsers.map((u) => ({ id: `reg-${u.id}`, type: 'registration', date: new Date(u.createdAt), data: u }));
  const archivedRegistrationItems: InboxItem[] = archivedRegistrations.map((u) => ({ id: `reg-${u.id}`, type: 'registration', date: new Date(u.createdAt), data: u }));
  const allBugItems: InboxItem[] = bugReports.map((b) => ({ id: `bug-${b.id}`, type: 'bug', date: new Date(b.createdAt), data: b }));
  const allAppealItems: InboxItem[] = banAppeals.map((a) => ({ id: `appeal-${a.id}`, type: 'appeal', date: new Date(a.createdAt), data: a }));
  const allNameChangeItems: InboxItem[] = nameChangeRequests.map((n) => ({ id: `nc-${n.id}`, type: 'namechange', date: new Date(n.createdAt), data: n }));
  const badgeItems: InboxItem[] = customBadgeRequests.map((b) => ({ id: `badge-${b.id}`, type: 'badge', date: new Date(b.createdAt), data: b }));
  const formationItems: InboxItem[] = pendingFormationReviews.map((p) => ({ id: `formation-${p.id}`, type: 'formation', date: new Date(p.createdAt), data: p }));
  const pendingBugItems = allBugItems.filter((i) => (i.data as BugReport).status === 'PENDING');
  const pendingAppealItems = allAppealItems.filter((i) => (i.data as BanAppeal).status === 'PENDING');
  const pendingNameChangeItems = allNameChangeItems.filter((i) => (i.data as NameChangeRequest).status === 'PENDING');
  const archivedItems: InboxItem[] = [...archivedRegistrationItems, ...allBugItems.filter((i) => (i.data as BugReport).status === 'DONE'), ...allAppealItems.filter((i) => (i.data as BanAppeal).status !== 'PENDING'), ...allNameChangeItems.filter((i) => (i.data as NameChangeRequest).status !== 'PENDING')].sort((a, b) => b.date.getTime() - a.date.getTime());
  const allPending = pendingUsers.length + pendingBugItems.length + pendingAppealItems.length + pendingNameChangeItems.length + badgeItems.length + formationItems.length;
  const activeItems = (inboxFilter === 'registrations' ? registrationItems : inboxFilter === 'bugs' ? pendingBugItems : inboxFilter === 'appeals' ? pendingAppealItems : inboxFilter === 'namechanges' ? pendingNameChangeItems : inboxFilter === 'badges' ? badgeItems : inboxFilter === 'formations' ? formationItems : inboxFilter === 'archived' ? archivedItems : [...registrationItems, ...pendingBugItems, ...pendingAppealItems, ...pendingNameChangeItems, ...badgeItems, ...formationItems]).sort((a, b) => b.date.getTime() - a.date.getTime());
  const selectedItem = selectedInboxItem ? [...registrationItems, ...archivedRegistrationItems, ...allBugItems, ...allAppealItems, ...allNameChangeItems, ...badgeItems, ...formationItems].find((item) => item.id === selectedInboxItem) ?? null : null;
  const loading = loadingPending || loadingBugs || loadingAppeals || loadingNameChanges || loadingCustomBadgeRequests || loadingPendingFormationReviews;

  const categories = [
    { key: 'all' as const, label: 'Tout', Icon: Inbox, count: allPending },
    { key: 'registrations' as const, label: 'Inscriptions', Icon: UserPlus, count: pendingUsers.length },
    { key: 'bugs' as const, label: 'Bugs', Icon: Bug, count: pendingBugItems.length },
    { key: 'appeals' as const, label: 'Appels de ban', Icon: Gavel, count: pendingAppealItems.length },
    { key: 'namechanges' as const, label: 'Pseudos', Icon: UserCog, count: pendingNameChangeItems.length },
    { key: 'badges' as const, label: 'Badges', Icon: Award, count: badgeItems.length },
    { key: 'formations' as const, label: 'Formations', Icon: FileText, count: formationItems.length },
    { key: 'archived' as const, label: 'ArchivÃ©', Icon: Archive, count: archivedItems.length },
  ];

  const renderDetail = () => {
    if (!selectedItem) return <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground/50"><Inbox className="h-10 w-10 text-muted-foreground/20 mb-2" />SÃ©lectionne un Ã©lÃ©ment</div>;
    if (selectedItem.type === 'formation') {
      const product = selectedItem.data as PendingFormationReviewItem;
      return <div className="p-6 space-y-5"><div><span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">Formation en attente</span><h3 className="mt-3 text-lg font-semibold">{product.title}</h3><p className="text-sm text-muted-foreground">{product.business.name} · par {product.business.owner.username}</p></div><div className="rounded-lg border border-border/40 bg-muted/20 p-4 space-y-3"><p className="text-sm font-medium">{product.price.toLocaleString('fr-FR')} €</p>{product.description ? <p className="text-sm whitespace-pre-wrap break-words">{product.description}</p> : null}{product.url ? <a href={product.url} target="_blank" rel="noreferrer" className="text-xs text-sky-400 underline underline-offset-2 break-all">{product.url}</a> : null}<p className="text-xs text-muted-foreground">{product.attachmentOriginalName ?? 'Sans fichier joint'}</p>{product.reviewerNote ? <div className="rounded-md border border-border/50 bg-background/70 px-3 py-2"><p className="text-xs font-medium text-muted-foreground/70 mb-1">DerniÃ¨re note reviewer</p><p className="text-sm whitespace-pre-wrap break-words">{product.reviewerNote}</p></div> : null}</div><div className="space-y-2"><p className="text-xs font-medium text-muted-foreground/70">Note reviewer</p><Input value={rejectNotes[product.id] ?? ''} onChange={(e) => setRejectNotes((prev) => ({ ...prev, [product.id]: e.target.value }))} placeholder="Motif ou retour visible par le propriÃ©taire" /></div><div className="flex items-center gap-2"><Button size="sm" onClick={() => reviewFormationProduct(product.businessId, product.id, 'approve')} disabled={reviewingFormationProductId === product.id}>{reviewingFormationProductId === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Approuver</>}</Button><Button size="sm" variant="destructive" onClick={() => reviewFormationProduct(product.businessId, product.id, 'reject')} disabled={reviewingFormationProductId === product.id}>{reviewingFormationProductId === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" />Refuser</>}</Button></div></div>;
    }
    if (selectedItem.type === 'registration') {
      const user = selectedItem.data as PendingUser & { registrationStatus?: 'APPROVED' | 'REJECTED' };
      return <div className="p-6 space-y-5"><div><h3 className="text-lg font-semibold">{user.username}</h3><p className="text-sm text-muted-foreground">{user.email}</p></div><div className="rounded-lg border border-border/40 bg-muted/20 p-4"><p className="text-xs font-medium text-muted-foreground/70 mb-2">Message de motivation</p><p className="text-sm whitespace-pre-wrap break-words">{user.motivationMessage?.trim() || 'Non renseignÃ©'}</p></div>{!user.registrationStatus ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => approveUser(user.id)} disabled={approvingUser === user.id}>{approvingUser === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Approuver</>}</Button><Button size="sm" variant="outline" onClick={() => rejectUser(user.id)} disabled={rejectingUser === user.id} className="border-destructive/50 text-destructive hover:bg-destructive/10">{rejectingUser === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserX className="h-4 w-4 mr-1" />Rejeter</>}</Button></div> : null}</div>;
    }
    if (selectedItem.type === 'bug') {
      const bug = selectedItem.data as BugReport;
      const replyValue = bugReply[bug.id] ?? '';
      return <div className="p-6 space-y-5"><div><h3 className="text-lg font-semibold">{bug.title}</h3><p className="text-sm text-muted-foreground">Par {bug.user.username}</p></div><div className="rounded-lg border border-border/40 bg-muted/20 p-4"><p className="text-sm whitespace-pre-wrap break-words">{bug.description}</p></div><textarea className="w-full rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-sm resize-none" rows={3} value={replyValue} onChange={(e) => setBugReply((prev) => ({ ...prev, [bug.id]: e.target.value }))} /><div className="flex gap-2">{replyValue.trim() ? <Button size="sm" variant="outline" onClick={() => sendBugReply(bug)} disabled={updatingBug === bug.id}>{updatingBug === bug.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" />Envoyer</>}</Button> : null}<Button size="sm" variant="outline" onClick={() => toggleBugStatus(bug)} disabled={updatingBug === bug.id}>{bug.status === 'DONE' ? 'Rouvrir' : 'RÃ©solu'}</Button></div></div>;
    }
    if (selectedItem.type === 'appeal') {
      const appeal = selectedItem.data as BanAppeal;
      return <div className="p-6 space-y-5"><div><h3 className="text-lg font-semibold">{appeal.user.username}</h3><p className="text-sm text-muted-foreground">{appeal.user.email}</p></div><div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4"><p className="text-sm font-medium">{appeal.ban.reason}</p></div><div className="rounded-lg border border-border/40 bg-muted/20 p-4"><p className="text-sm whitespace-pre-wrap break-words">{appeal.message}</p></div>{appeal.status === 'PENDING' ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => reviewBanAppeal(appeal.id, 'approve')} disabled={reviewingAppeal === appeal.id}>Lever le ban</Button><Button size="sm" variant="outline" onClick={() => reviewBanAppeal(appeal.id, 'reject')} disabled={reviewingAppeal === appeal.id} className="border-destructive/50 text-destructive hover:bg-destructive/10">Rejeter</Button></div> : null}</div>;
    }
    if (selectedItem.type === 'badge') {
      const req = selectedItem.data as CustomBadgeRequest;
      return <div className="p-6 space-y-5"><div><h3 className="text-lg font-semibold">{req.name}</h3><p className="text-sm text-muted-foreground">{req.user?.username ? `Demande par ${req.user.username}` : 'Auteur inconnu'}</p></div><div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4"><div className="flex items-start gap-4"><BadgeIcon badge={{ id: req.id, name: req.name, description: req.description, icon: req.icon, iconColor: '#ffffff', backgroundColor: req.backgroundColor, backgroundType: 'solid', borderColor: req.borderColor, rarity: req.rarity, category: 'custom' }} size="md" /><div className="min-w-0 flex-1"><p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{req.description}</p></div></div></div><Input placeholder="Raison ou note interne" value={rejectNotes[req.id] ?? ''} onChange={(e) => setRejectNotes((prev) => ({ ...prev, [req.id]: e.target.value }))} /><div className="flex gap-2"><Button size="sm" onClick={() => approveCustomBadgeRequest(req.id)}><Check className="h-4 w-4 mr-1" />Approuver</Button><Button size="sm" variant="destructive" onClick={() => rejectCustomBadgeRequest(req.id)}><X className="h-4 w-4 mr-1" />Refuser</Button></div></div>;
    }
    const req = selectedItem.data as NameChangeRequest;
    return <div className="p-6 space-y-5"><div><h3 className="text-lg font-semibold">{req.user.username}</h3><p className="text-sm text-muted-foreground">{req.currentUsername} → {req.requestedUsername}</p></div>{req.reason ? <div className="rounded-lg border border-border/40 bg-muted/20 p-4"><p className="text-sm whitespace-pre-wrap break-words">{req.reason}</p></div> : null}{req.status === 'PENDING' ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => reviewNameChangeRequest(req.id, 'approve')} disabled={reviewingNameChange === req.id}>Approuver</Button><Button size="sm" variant="outline" onClick={() => reviewNameChangeRequest(req.id, 'reject')} disabled={reviewingNameChange === req.id} className="border-destructive/50 text-destructive hover:bg-destructive/10">Rejeter</Button></div> : null}</div>;
  };

  return <TabsContent value="inbox" className={SPACING.SECTION_SPACING}><Card className="overflow-hidden"><CardHeader className="border-b border-border/30 pb-3 shrink-0"><div className="flex items-center justify-between gap-4"><CardDescription>BoÃ®te de rÃ©ception</CardDescription>{legacyArchivedRegistrationsCount > 0 ? <Button type="button" size="sm" variant="outline" onClick={importArchivedRegistrations} disabled={importingArchivedRegistrations} className="h-8 gap-1.5">{importingArchivedRegistrations ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Importer {legacyArchivedRegistrationsCount}</Button> : null}<div className={cn('flex items-center gap-2', TYPOGRAPHY.SMALL)}><Inbox className="h-4 w-4" /><span>{allPending} en attente</span></div></div></CardHeader><div className="flex" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}><div className="w-44 shrink-0 border-r border-border/40 p-1.5 space-y-0.5 overflow-y-auto custom-scroll">{categories.map((cat) => <button key={cat.key} onClick={() => { setInboxFilter(cat.key); setSelectedInboxItem(null); }} className={cn('w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors text-left', inboxFilter === cat.key ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground')}><cat.Icon className="h-3.5 w-3.5 shrink-0" /><span className="flex-1 truncate">{cat.label}</span>{cat.count > 0 ? <span className="text-[10px] font-semibold bg-primary/15 text-primary rounded px-1 shrink-0">{cat.count}</span> : null}</button>)}</div><div className="w-72 shrink-0 border-r border-border/40 overflow-y-auto custom-scroll">{loading ? <div className="flex justify-center py-12"><div className="w-1 h-8 bg-foreground/20 animate-pulse" /></div> : activeItems.length === 0 ? <div className="text-center py-12 space-y-2"><Inbox className="h-8 w-8 mx-auto text-muted-foreground/50" /><p className={TYPOGRAPHY.MUTED}>BoÃ®te de rÃ©ception vide</p></div> : activeItems.map((item) => { const isSelected = selectedInboxItem === item.id; const title = item.type === 'registration' ? (item.data as PendingUser).username : item.type === 'bug' ? (item.data as BugReport).title : item.type === 'appeal' ? (item.data as BanAppeal).user.username : item.type === 'namechange' ? (item.data as NameChangeRequest).requestedUsername : item.type === 'badge' ? (item.data as CustomBadgeRequest).name : (item.data as PendingFormationReviewItem).title; const subtitle = item.type === 'formation' ? `${(item.data as PendingFormationReviewItem).business.name} · ${(item.data as PendingFormationReviewItem).business.owner.username}` : item.type === 'registration' ? (item.data as PendingUser).email : item.type === 'bug' ? (item.data as BugReport).user.username : item.type === 'appeal' ? (item.data as BanAppeal).ban.reason : item.type === 'namechange' ? `de ${(item.data as NameChangeRequest).currentUsername}` : (item.data as CustomBadgeRequest).user?.username ?? 'Demande'; return <button key={item.id} onClick={() => setSelectedInboxItem(isSelected ? null : item.id)} className={cn('w-full text-left border-l-2 border-b border-b-border/20 transition-colors border-l-primary/40', isSelected ? 'bg-accent/70' : 'hover:bg-accent/30')}><div className="px-3 py-3"><p className="text-sm font-medium truncate leading-tight">{title}</p><p className="text-xs text-muted-foreground/70 truncate mt-0.5">{subtitle}</p></div></button>; })}</div><div className="flex-1 min-w-0 overflow-y-auto custom-scroll">{renderDetail()}</div></div></Card></TabsContent>;
}

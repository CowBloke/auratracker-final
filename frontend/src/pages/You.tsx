import { type ElementType, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Building2, ChevronRight, CreditCard, Heart, Landmark, Search, TrendingUp, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TYPOGRAPHY } from '@/lib/design-system';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { type YouBusiness, type YouBusinessType, type YouPlayer, type YouRelationship, type YouState, youApi } from '@/services/api';

const BUSINESS_ICON_MAP = {
  startup: Building2,
  bank: Landmark,
  agency: BarChart3,
} as const;

const ACTION_META = {
  invite: { label: 'Inviter des joueurs', help: 'Envoyer des invitations de recrutement.', icon: UserPlus, tone: 'bg-purple-400/15 text-purple-400' },
  loan: { label: 'Emprunter', help: 'Recevoir un pret directement du joueur proprietaire.', icon: CreditCard, tone: 'bg-amber-400/15 text-amber-400' },
  invest: { label: 'Investir', help: 'Transferer du money vers le business d un autre joueur.', icon: TrendingUp, tone: 'bg-sky-400/15 text-sky-400' },
} as const;

function Pill({ label, color }: { label: string; color: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', color)}>{label}</span>;
}

function ProgressBar({ value, max = 100, color = 'bg-primary' }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/40">
      <div className={cn('h-full rounded-full transition-all duration-300', color)} style={{ width: `${Math.max(0, Math.min(100, Math.round((value / max) * 100)))}%` }} />
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className={cn(TYPOGRAPHY.XS, 'mb-2 font-medium uppercase tracking-wider text-muted-foreground/60')}>{children}</p>;
}

function ModalWrap({
  open,
  onClose,
  title,
  desc,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  desc?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className={wide ? 'max-w-2xl' : 'max-w-md'}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {desc ? <DialogDescription>{desc}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-4 py-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SelectBox({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
      {children}
    </select>
  );
}

function ActionRow({
  icon: Icon,
  label,
  sub,
  iconBg,
  iconColor,
  onClick,
}: {
  icon: ElementType;
  label: string;
  sub: string;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/20">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function ActionCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y divide-border/30">{children}</div>
      </CardContent>
    </Card>
  );
}

function UserAvatar({ player, className }: { player: Pick<YouPlayer, 'username' | 'profilePicture'>; className?: string }) {
  return (
    <Avatar className={className}>
      {player.profilePicture ? <AvatarImage src={resolveImageUrl(player.profilePicture)} alt={player.username} /> : null}
      <AvatarFallback>{player.username.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

async function withRouteError<T>(fn: () => Promise<T>, fallback: string) {
  try {
    return await fn();
  } catch (error: any) {
    const message = error?.response?.data?.error || fallback;
    toast.error(message);
    throw error;
  }
}

function CreateBusinessModal({
  open,
  onClose,
  businessTypes,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  businessTypes: YouBusinessType[];
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [typeKey, setTypeKey] = useState(businessTypes[0]?.key ?? '');
  const [capital, setCapital] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const firstType = businessTypes[0];
    if (firstType) {
      setTypeKey(firstType.key);
      setCapital(String(firstType.minCapital));
    }
    setName('');
  }, [businessTypes, open]);

  const selectedType = businessTypes.find((type) => type.key === typeKey) ?? businessTypes[0];

  const submit = async () => {
    if (!selectedType) return;
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.createBusiness({ name, typeKey: selectedType.key, capital: Number(capital) }), 'Impossible de creer le business.');
      toast.success('Business cree');
      await onCreated();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title="Creer une entreprise" desc="Le capital de depart est pris sur ton argent global.">
      <FieldRow label="Type d activite">
        <SelectBox value={typeKey} onChange={(value) => {
          setTypeKey(value);
          const nextType = businessTypes.find((type) => type.key === value);
          if (nextType) setCapital(String(nextType.minCapital));
        }}>
          {businessTypes.map((type) => <option key={type.key} value={type.key}>{type.label} · {type.category}</option>)}
        </SelectBox>
      </FieldRow>
      {selectedType ? <div className="rounded-xl border border-border/40 bg-muted/10 p-4"><p className="text-sm font-medium">{selectedType.label}</p><p className="mt-1 text-xs text-muted-foreground">{selectedType.description}</p><p className="mt-2 text-[11px] text-muted-foreground">Capital mini: {selectedType.minCapital.toLocaleString('fr-FR')} money</p></div> : null}
      <FieldRow label="Nom"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="ex : Citizen Bank" /></FieldRow>
      <FieldRow label="Capital de depart"><Input type="number" value={capital} onChange={(event) => setCapital(event.target.value)} min={selectedType?.minCapital ?? 0} /></FieldRow>
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button><Button size="sm" onClick={submit} disabled={submitting || !selectedType || !name.trim() || Number(capital) < selectedType.minCapital}>Creer</Button></div>
    </ModalWrap>
  );
}

function InvitePlayersModal({
  open,
  onClose,
  business,
  players,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness | null;
  players: YouPlayer[];
  onSubmitted: () => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('employee');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setRole('employee');
      setSelectedIds([]);
    }
  }, [open]);

  const availablePlayers = useMemo(() => players.filter((player) => {
    if (player.id === business?.ownerId) return false;
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return player.username.toLowerCase().includes(query) || player.firstName?.toLowerCase().includes(query) || player.bio?.toLowerCase().includes(query);
  }), [business?.ownerId, players, search]);

  const submit = async () => {
    if (!business || selectedIds.length === 0) return;
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.runBusinessAction(business.id, 'invite', { inviteeIds: selectedIds, role }), 'Impossible d envoyer les invitations.');
      toast.success('Invitations envoyees');
      await onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title={business ? `Inviter des joueurs · ${business.name}` : 'Inviter des joueurs'} desc="Toutes les invitations ciblent de vrais joueurs." wide>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <FieldRow label="Recherche"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pseudo, prenom..." /></FieldRow>
        <FieldRow label="Role propose"><SelectBox value={role} onChange={setRole}><option value="employee">Employe</option><option value="partner">Associe</option><option value="advisor">Conseiller</option></SelectBox></FieldRow>
      </div>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {availablePlayers.map((player) => {
          const selected = selectedIds.includes(player.id);
          return <div key={player.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3"><UserAvatar player={player} className="h-9 w-9" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{player.username}</p><p className="line-clamp-2 text-xs text-muted-foreground">{player.bio?.trim() || 'Disponible pour une collaboration.'}</p></div><Button size="sm" variant={selected ? 'secondary' : 'outline'} className="h-8 text-xs" onClick={() => setSelectedIds((current) => current.includes(player.id) ? current.filter((entry) => entry !== player.id) : [...current, player.id])}>{selected ? 'Selectionne' : 'Inviter'}</Button></div>;
        })}
        {availablePlayers.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Aucun joueur disponible pour cette recherche.</p> : null}
      </div>
      <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">{selectedIds.length === 0 ? 'Aucune invitation preparee.' : `${selectedIds.length} invitation(s) preparee(s) pour le role ${role}.`}</div>
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Fermer</Button><Button size="sm" onClick={submit} disabled={submitting || !business || selectedIds.length === 0}>Envoyer</Button></div>
    </ModalWrap>
  );
}

function LoanModal({ open, onClose, business, onSubmitted }: { open: boolean; onClose: () => void; business: YouBusiness | null; onSubmitted: () => Promise<void> }) {
  const [amount, setAmount] = useState('5000');
  const [durationMonths, setDurationMonths] = useState('12');
  const [submitting, setSubmitting] = useState(false);
  const monthly = Math.round((Number(amount || 0) * 1.04) / Math.max(1, Number(durationMonths || 1)));

  const submit = async () => {
    if (!business) return;
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.runBusinessAction(business.id, 'loan', { amount: Number(amount), durationMonths: Number(durationMonths) }), 'Impossible d emprunter.');
      toast.success('Pret accorde');
      await onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title={business ? `Emprunter · ${business.name}` : 'Emprunter'} desc="Le montant est transfere du proprietaire vers ton solde global.">
      <FieldRow label="Montant"><Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min={500} /></FieldRow>
      <FieldRow label="Duree"><SelectBox value={durationMonths} onChange={setDurationMonths}>{['6', '12', '24', '36', '60'].map((value) => <option key={value} value={value}>{value} mois</option>)}</SelectBox></FieldRow>
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/40 bg-muted/10 p-4"><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Mensualite</p><p className="text-lg font-bold tabular-nums">{monthly.toLocaleString('fr-FR')}</p></div><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Total estime</p><p className="text-lg font-bold tabular-nums text-red-400">{Math.round(Number(amount || 0) * 1.04).toLocaleString('fr-FR')}</p></div></div>
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button><Button size="sm" onClick={submit} disabled={submitting || !business}>Confirmer</Button></div>
    </ModalWrap>
  );
}

function InvestModal({ open, onClose, business, onSubmitted }: { open: boolean; onClose: () => void; business: YouBusiness | null; onSubmitted: () => Promise<void> }) {
  const [amount, setAmount] = useState('1000');
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [submitting, setSubmitting] = useState(false);
  const ranges = { low: { label: 'Faible', color: 'text-emerald-400', min: 2, max: 5 }, medium: { label: 'Moyen', color: 'text-yellow-400', min: 5, max: 15 }, high: { label: 'Eleve', color: 'text-red-400', min: 10, max: 40 } } as const;
  const selected = ranges[riskLevel];

  const submit = async () => {
    if (!business) return;
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.runBusinessAction(business.id, 'invest', { amount: Number(amount), riskLevel }), 'Impossible d investir.');
      toast.success('Investissement enregistre');
      await onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title={business ? `Investir · ${business.name}` : 'Investir'} desc="Le money est retire de ton solde global puis credite au proprietaire.">
      <FieldRow label="Montant"><Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min={100} /></FieldRow>
      <FieldRow label="Risque"><SelectBox value={riskLevel} onChange={(value) => setRiskLevel(value as 'low' | 'medium' | 'high')}><option value="low">Faible risque</option><option value="medium">Risque modere</option><option value="high">Risque eleve</option></SelectBox></FieldRow>
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/40 bg-muted/10 p-3 text-center"><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Risque</p><p className={cn('text-sm font-bold', selected.color)}>{selected.label}</p></div><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Min</p><p className={cn('text-sm font-bold', selected.color)}>+{selected.min}%</p></div><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Max</p><p className={cn('text-sm font-bold', selected.color)}>+{selected.max}%</p></div></div>
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button><Button size="sm" onClick={submit} disabled={submitting || !business}>Investir</Button></div>
    </ModalWrap>
  );
}

function MeetModal({ open, onClose, players, onSubmitted }: { open: boolean; onClose: () => void; players: YouPlayer[]; onSubmitted: () => Promise<void> }) {
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedUserId('');
    }
  }, [open]);

  const candidates = useMemo(() => players.filter((player) => {
    if (player.alreadyInRelationship) return false;
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return player.username.toLowerCase().includes(query) || player.firstName?.toLowerCase().includes(query) || player.bio?.toLowerCase().includes(query);
  }), [players, search]);

  const submit = async () => {
    if (!selectedUserId) return;
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.createRelationship(selectedUserId), 'Impossible de creer la relation.');
      toast.success('Relation creee');
      await onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title="Nouvelle relation" desc="Choisis un vrai joueur avec qui ouvrir une relation sociale.">
      <FieldRow label="Recherche"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pseudo, prenom..." /></FieldRow>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {candidates.map((player) => {
          const selected = player.id === selectedUserId;
          return <button key={player.id} type="button" onClick={() => setSelectedUserId(player.id)} className={cn('flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors', selected ? 'border-foreground bg-muted/20' : 'border-border/40 bg-muted/10 hover:bg-muted/20')}><UserAvatar player={player} className="h-9 w-9" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{player.username}</p><p className="line-clamp-2 text-xs text-muted-foreground">{player.bio?.trim() || 'Pret a ouvrir une nouvelle relation.'}</p></div>{selected ? <Pill label="Selection" color="bg-foreground text-background" /> : null}</button>;
        })}
        {candidates.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Aucun joueur disponible.</p> : null}
      </div>
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button><Button size="sm" onClick={submit} disabled={submitting || !selectedUserId}>Creer la relation</Button></div>
    </ModalWrap>
  );
}

function MarriageModal({ open, onClose, relationships, onSubmitted }: { open: boolean; onClose: () => void; relationships: YouRelationship[]; onSubmitted: () => Promise<void> }) {
  const [relationshipId, setRelationshipId] = useState(relationships[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setRelationshipId(relationships[0]?.id ?? '');
      setMessage('');
    }
  }, [open, relationships]);

  const submit = async () => {
    if (!relationshipId) return;
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.proposeMarriage(relationshipId, message.trim() || undefined), 'Impossible d envoyer la demande.');
      toast.success('Demande en mariage envoyee');
      await onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title="Demander en mariage" desc="La demande reste en attente tant que l autre joueur ne repond pas.">
      <FieldRow label="Relation eligible"><SelectBox value={relationshipId} onChange={setRelationshipId}>{relationships.map((relationship) => <option key={relationship.id} value={relationship.id}>{relationship.otherUser.username} · {relationship.connectionLevel}%</option>)}</SelectBox></FieldRow>
      <FieldRow label="Message (optionnel)"><Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Un petit mot..." /></FieldRow>
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button><Button size="sm" onClick={submit} disabled={submitting || !relationshipId}>Envoyer</Button></div>
    </ModalWrap>
  );
}

function OverviewTab({ data }: { data: YouState }) {
  const latestBusinesses = data.ownedBusinesses.slice(0, 2);
  const latestRelationships = data.relationships.slice(0, 3);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <SectionTitle>Activite business</SectionTitle>
        <Card><CardContent className="space-y-3 px-5 py-4">{latestBusinesses.length === 0 ? <p className="text-sm text-muted-foreground">Aucun business cree pour le moment.</p> : latestBusinesses.map((business) => { const profit = business.monthlyRevenue - business.monthlyExpenses; const Icon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2; return <div key={business.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/30"><Icon className="h-4 w-4 text-foreground" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-semibold">{business.name}</p>{business.type ? <Pill label={business.type.label} color="bg-sky-400/15 text-sky-400" /> : null}</div><p className="text-xs text-muted-foreground">{business.memberCount} membre(s) · {business.location || 'Lieu non defini'}</p></div><div className="text-right"><p className={cn('text-sm font-bold tabular-nums', profit >= 0 ? 'text-emerald-400' : 'text-red-400')}>{profit >= 0 ? '+' : ''}{profit.toLocaleString('fr-FR')}</p><p className="text-[10px] text-muted-foreground">mensuel</p></div></div>; })}</CardContent></Card>
      </div>
      <div className="space-y-4">
        <SectionTitle>Relations</SectionTitle>
        <Card><CardContent className="space-y-3 px-5 py-4">{latestRelationships.length === 0 ? <p className="text-sm text-muted-foreground">Aucune relation active pour le moment.</p> : latestRelationships.map((relationship) => <div key={relationship.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3"><div className="flex items-center gap-3"><UserAvatar player={relationship.otherUser} className="h-9 w-9" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-semibold">{relationship.otherUser.username}</p><Pill label={relationship.status === 'MARRIED' ? 'Marie' : 'Relation'} color={relationship.status === 'MARRIED' ? 'bg-red-400/15 text-red-400' : 'bg-pink-400/15 text-pink-400'} /></div><p className="text-xs text-muted-foreground">{relationship.pendingProposal ? `Demande ${relationship.pendingProposal.direction === 'sent' ? 'envoyee' : 'recue'}` : 'Aucune demande en attente'}</p></div><span className="text-xs font-medium text-muted-foreground">{relationship.connectionLevel}%</span></div><div className="mt-3"><ProgressBar value={relationship.connectionLevel} color="bg-pink-400" /></div></div>)}</CardContent></Card>
      </div>
    </div>
  );
}

function TravailTab({ data, players, onReload }: { data: YouState; players: YouPlayer[]; onReload: (refreshBalance?: boolean) => Promise<void> }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteBusiness, setInviteBusiness] = useState<YouBusiness | null>(null);

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionTitle>Actions</SectionTitle>
          <ActionCard><ActionRow icon={Building2} label="Creer une entreprise" sub={`${data.ownedBusinesses.length} business possede(s)`} iconBg="bg-emerald-400/15" iconColor="text-emerald-400" onClick={() => setCreateOpen(true)} /></ActionCard>
        </div>
        <div className="space-y-4">
          <SectionTitle>Mes entreprises ({data.ownedBusinesses.length})</SectionTitle>
          {data.ownedBusinesses.length === 0 ? <Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Aucune entreprise creee. Ouvre-en une depuis cette page pour utiliser ton argent reel du site.</CardContent></Card> : data.ownedBusinesses.map((business) => { const profit = business.monthlyRevenue - business.monthlyExpenses; const Icon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2; return <Card key={business.id}><CardContent className="space-y-4 px-5 py-4"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/20"><Icon className="h-5 w-5 text-foreground" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-base font-semibold">{business.name}</p>{business.type ? <Pill label={business.type.label} color="bg-sky-400/15 text-sky-400" /> : null}{business.pendingInvitations.length > 0 ? <Pill label={`${business.pendingInvitations.length} invitation(s)`} color="bg-purple-400/15 text-purple-400" /> : null}</div><p className="mt-1 text-sm text-muted-foreground">{business.description || 'Aucune description.'}</p></div><div className="text-right"><p className={cn('text-sm font-bold tabular-nums', profit >= 0 ? 'text-emerald-400' : 'text-red-400')}>{profit >= 0 ? '+' : ''}{profit.toLocaleString('fr-FR')}</p><p className="text-[10px] text-muted-foreground">benefice mensuel</p></div></div><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{[{ label: 'Capital', value: business.startingCapital.toLocaleString('fr-FR') }, { label: 'Membres', value: String(business.memberCount) }, { label: 'Satisfaction', value: `${business.satisfaction}/100` }, { label: 'Lieu', value: business.location || 'n/a' }].map((entry) => <div key={entry.label} className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{entry.label}</p><p className="mt-1 text-sm font-medium">{entry.value}</p></div>)}</div><div className="space-y-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Equipe</p>{business.members.length === 0 ? <p className="text-sm text-muted-foreground">Aucun membre actif pour le moment.</p> : business.members.map((member) => <div key={member.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3"><UserAvatar player={member.user} className="h-8 w-8" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{member.user.username}</p><p className="text-xs text-muted-foreground">{member.role} · {member.status}</p></div></div>)}</div>{business.recentLoans.length > 0 ? <div className="space-y-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prets recents</p>{business.recentLoans.map((loan) => <div key={loan.id} className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-sm"><span>{loan.borrower.username}</span><span>{loan.amount.toLocaleString('fr-FR')} · {loan.termMonths} mois</span></div>)}</div> : null}<div className="flex justify-end"><Button size="sm" variant="outline" className="text-xs" onClick={() => setInviteBusiness(business)}><UserPlus className="mr-1.5 h-3.5 w-3.5" />Inviter des joueurs</Button></div></CardContent></Card>; })}
        </div>
      </div>
      <CreateBusinessModal open={createOpen} onClose={() => setCreateOpen(false)} businessTypes={data.businessTypes} onCreated={() => onReload(true)} />
      <InvitePlayersModal open={Boolean(inviteBusiness)} onClose={() => setInviteBusiness(null)} business={inviteBusiness} players={players} onSubmitted={() => onReload()} />
    </>
  );
}

function SocialTab({ data, onReload }: { data: YouState; onReload: () => Promise<void> }) {
  const [meetOpen, setMeetOpen] = useState(false);
  const [marryOpen, setMarryOpen] = useState(false);
  const eligibleForMarriage = data.relationships.filter((relationship) => relationship.canProposeMarriage);
  const incomingProposals = data.relationships.filter((relationship) => relationship.pendingProposal?.canRespond);

  const respondToProposal = async (proposalId: string, decision: 'accept' | 'reject') => {
    await withRouteError(() => youApi.respondToMarriageProposal(proposalId, decision), 'Impossible de traiter la demande.');
    toast.success(decision === 'accept' ? 'Mariage valide' : 'Demande refusee');
    await onReload();
  };

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionTitle>Actions</SectionTitle>
          <ActionCard><ActionRow icon={UserPlus} label="Nouvelle relation" sub={`${data.players.filter((player) => !player.alreadyInRelationship).length} joueur(s) disponible(s)`} iconBg="bg-purple-400/15" iconColor="text-purple-400" onClick={() => setMeetOpen(true)} /><ActionRow icon={Heart} label="Demander en mariage" sub={eligibleForMarriage.length > 0 ? `${eligibleForMarriage.length} relation(s) eligible(s)` : 'Relation +70 requise'} iconBg="bg-red-400/15" iconColor="text-red-400" onClick={() => setMarryOpen(true)} /></ActionCard>
          {incomingProposals.length > 0 ? <><SectionTitle>Demandes recues</SectionTitle><Card><CardContent className="space-y-3 px-5 py-4">{incomingProposals.map((relationship) => <div key={relationship.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3"><p className="text-sm font-semibold">{relationship.otherUser.username}</p><p className="mt-1 text-xs text-muted-foreground">{relationship.pendingProposal?.message?.trim() || 'Aucun message joint.'}</p><div className="mt-3 flex gap-2"><Button size="sm" className="text-xs" onClick={() => void respondToProposal(relationship.pendingProposal!.id, 'accept')}>Accepter</Button><Button size="sm" variant="outline" className="text-xs" onClick={() => void respondToProposal(relationship.pendingProposal!.id, 'reject')}>Refuser</Button></div></div>)}</CardContent></Card></> : null}
        </div>
        <div className="space-y-4">
          <SectionTitle>Relations ({data.relationships.length})</SectionTitle>
          {data.relationships.length === 0 ? <Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Aucune relation en base. Cree-en une avec un vrai joueur depuis le panneau de gauche.</CardContent></Card> : data.relationships.map((relationship) => <Card key={relationship.id}><CardContent className="space-y-4 px-5 py-4"><div className="flex items-start gap-3"><UserAvatar player={relationship.otherUser} className="h-11 w-11" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-base font-semibold">{relationship.otherUser.username}</p><Pill label={relationship.status === 'MARRIED' ? 'Marie' : 'Relation'} color={relationship.status === 'MARRIED' ? 'bg-red-400/15 text-red-400' : 'bg-pink-400/15 text-pink-400'} />{relationship.pendingProposal ? <Pill label={relationship.pendingProposal.direction === 'sent' ? 'Demande envoyee' : 'Demande recue'} color="bg-amber-400/15 text-amber-400" /> : null}</div><p className="mt-1 text-sm text-muted-foreground">{relationship.otherUser.bio?.trim() || 'Aucune bio renseignee.'}</p></div><span className="text-sm font-bold tabular-nums text-pink-400">{relationship.connectionLevel}%</span></div><div className="space-y-1"><div className="flex justify-between text-[11px] text-muted-foreground"><span>Connexion</span><span>{relationship.status === 'MARRIED' ? 'Statut finalise' : 'Evolution active'}</span></div><ProgressBar value={relationship.connectionLevel} color="bg-pink-400" /></div>{relationship.pendingProposal ? <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">{relationship.pendingProposal.direction === 'sent' ? 'Ta demande en mariage est en attente.' : 'Une demande en mariage attend ta reponse.'}</div> : null}</CardContent></Card>)}
        </div>
      </div>
      <MeetModal open={meetOpen} onClose={() => setMeetOpen(false)} players={data.players} onSubmitted={onReload} />
      <MarriageModal open={marryOpen} onClose={() => setMarryOpen(false)} relationships={eligibleForMarriage} onSubmitted={onReload} />
    </>
  );
}

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn('w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors', active ? 'border-foreground bg-foreground text-background' : 'border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground')}>{label}</button>;
}

function ExploreTab({ data, players, userId, onReload }: { data: YouState; players: YouPlayer[]; userId: string; onReload: (refreshBalance?: boolean) => Promise<void> }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'you' | 'player'>('all');
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>(data.exploreBusinesses[0]?.id ?? data.ownedBusinesses[0]?.id ?? '');
  const [inviteBusiness, setInviteBusiness] = useState<YouBusiness | null>(null);
  const [loanBusiness, setLoanBusiness] = useState<YouBusiness | null>(null);
  const [investBusiness, setInvestBusiness] = useState<YouBusiness | null>(null);

  const allBusinesses = useMemo(() => [...data.ownedBusinesses, ...data.exploreBusinesses], [data.exploreBusinesses, data.ownedBusinesses]);
  const categories = useMemo(() => ['all', ...new Set(data.businessTypes.map((type) => type.category))], [data.businessTypes]);

  const filteredBusinesses = useMemo(() => allBusinesses.filter((business) => {
    const query = search.trim().toLowerCase();
    const matchesCategory = category === 'all' || business.type?.category === category;
    const matchesOwner = ownerFilter === 'all' || (ownerFilter === 'you' ? business.ownerId === userId : business.ownerId !== userId);
    const matchesQuery = !query || business.name.toLowerCase().includes(query) || business.owner.username.toLowerCase().includes(query) || business.description?.toLowerCase().includes(query);
    return matchesCategory && matchesOwner && matchesQuery;
  }), [allBusinesses, category, ownerFilter, search, userId]);

  useEffect(() => {
    if (!filteredBusinesses.some((business) => business.id === selectedBusinessId)) {
      setSelectedBusinessId(filteredBusinesses[0]?.id ?? '');
    }
  }, [filteredBusinesses, selectedBusinessId]);

  const selectedBusiness = filteredBusinesses.find((business) => business.id === selectedBusinessId) ?? filteredBusinesses[0] ?? null;

  const onAction = (business: YouBusiness, action: 'invite' | 'loan' | 'invest') => {
    if (action === 'invite') setInviteBusiness(business);
    if (action === 'loan') setLoanBusiness(business);
    if (action === 'invest') setInvestBusiness(business);
  };

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card><CardContent className="space-y-4 px-5 py-4"><div className="flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-semibold">Filtres</p></div><div className="space-y-2"><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Categorie</p><div className="space-y-1.5">{categories.map((entry) => <FilterButton key={entry} active={category === entry} label={entry === 'all' ? 'Toutes' : entry} onClick={() => setCategory(entry)} />)}</div></div><div className="space-y-2"><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Proprietaire</p><div className="space-y-1.5"><FilterButton active={ownerFilter === 'all'} label="Tous" onClick={() => setOwnerFilter('all')} /><FilterButton active={ownerFilter === 'you'} label="Mes businesses" onClick={() => setOwnerFilter('you')} /><FilterButton active={ownerFilter === 'player'} label="Autres joueurs" onClick={() => setOwnerFilter('player')} /></div></div></CardContent></Card>
        </div>
        <div className="space-y-4">
          <Card><CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un business ou un joueur..." className="pl-9" /></div><div className="text-xs text-muted-foreground">{filteredBusinesses.length} resultat{filteredBusinesses.length > 1 ? 's' : ''}</div></CardContent></Card>
          <Card><CardContent className="p-0"><div className="divide-y divide-border/30">{filteredBusinesses.map((business) => { const Icon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2; const selected = business.id === selectedBusiness?.id; const profit = business.monthlyRevenue - business.monthlyExpenses; return <button key={business.id} type="button" onClick={() => setSelectedBusinessId(business.id)} className={cn('w-full px-5 py-4 text-left transition-colors', selected ? 'bg-muted/25' : 'hover:bg-muted/15')}><div className="flex items-start gap-3"><div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/20"><Icon className="h-4 w-4 text-foreground" /></div><div className="min-w-0 flex-1 space-y-1.5"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{business.name}</p>{business.type ? <Pill label={business.type.label} color="bg-sky-400/15 text-sky-400" /> : null}{business.ownerId === userId ? <Pill label="A toi" color="bg-purple-400/15 text-purple-400" /> : null}</div><p className="text-xs text-muted-foreground">par {business.owner.username} · {business.location || 'Lieu non defini'}</p><p className="line-clamp-2 text-xs text-muted-foreground">{business.description || 'Aucune description.'}</p></div><div className="text-right"><p className={cn('text-sm font-bold tabular-nums', profit >= 0 ? 'text-emerald-400' : 'text-red-400')}>{profit >= 0 ? '+' : ''}{profit.toLocaleString('fr-FR')}</p><p className="text-[10px] text-muted-foreground">{business.satisfaction}/100</p></div></div></button>; })}{filteredBusinesses.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aucun business ne correspond a tes filtres.</p> : null}</div></CardContent></Card>
        </div>
        <div className="space-y-4">
          {selectedBusiness ? <><Card><CardContent className="space-y-4 px-5 py-4"><div className="flex items-start gap-3"><UserAvatar player={selectedBusiness.owner} className="h-11 w-11" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-base font-semibold">{selectedBusiness.name}</p>{selectedBusiness.verified ? <Pill label="Verifie" color="bg-emerald-400/15 text-emerald-400" /> : null}</div><p className="mt-1 text-sm text-muted-foreground">{selectedBusiness.description || 'Aucune description.'}</p></div></div><div className="grid grid-cols-2 gap-2">{[{ label: 'Proprietaire', value: selectedBusiness.owner.username }, { label: 'Fondation', value: selectedBusiness.foundedLabel }, { label: 'Lieu', value: selectedBusiness.location || 'n/a' }, { label: 'Satisfaction', value: `${selectedBusiness.satisfaction}/100` }].map((entry) => <div key={entry.label} className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{entry.label}</p><p className="mt-1 text-sm font-medium">{entry.value}</p></div>)}</div></CardContent></Card><Card><CardContent className="space-y-3 px-5 py-4"><SectionTitle>Actions disponibles</SectionTitle><div className="space-y-2">{selectedBusiness.actions.map((action) => { const meta = ACTION_META[action]; const Icon = meta.icon; const disabled = action === 'invite' && selectedBusiness.ownerId !== userId; const [toneBg, toneText] = meta.tone.split(' '); return <button key={action} type="button" disabled={disabled} onClick={() => onAction(selectedBusiness, action)} className={cn('flex w-full items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-left transition-colors', disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-muted/20')}><div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', toneBg)}><Icon className={cn('h-4 w-4', toneText)} /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{meta.label}</p><p className="text-xs text-muted-foreground">{meta.help}</p></div><ChevronRight className="h-4 w-4 text-muted-foreground/40" /></button>; })}</div></CardContent></Card></> : <Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Selectionne un business pour voir ses details.</CardContent></Card>}
        </div>
      </div>
      <InvitePlayersModal open={Boolean(inviteBusiness)} onClose={() => setInviteBusiness(null)} business={inviteBusiness} players={players} onSubmitted={() => onReload()} />
      <LoanModal open={Boolean(loanBusiness)} onClose={() => setLoanBusiness(null)} business={loanBusiness} onSubmitted={() => onReload(true)} />
      <InvestModal open={Boolean(investBusiness)} onClose={() => setInvestBusiness(null)} business={investBusiness} onSubmitted={() => onReload(true)} />
    </>
  );
}

export default function You() {
  const [params] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState<YouState | null>(null);
  const [loading, setLoading] = useState(true);

  const loadState = useCallback(async (refreshBalance = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const [stateResponse] = await Promise.all([youApi.getState(), refreshBalance ? refreshUser() : Promise.resolve()]);
      setData(stateResponse.data);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de charger la page YOU.');
    } finally {
      setLoading(false);
    }
  }, [refreshUser, user]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const tab = params.get('tab');
  const currentTab = tab === 'travail' || tab === 'social' || tab === 'explore' ? tab : 'overview';

  if (loading && !data) return <div className="space-y-4"><Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Chargement du hub YOU...</CardContent></Card></div>;
  if (!data || !user) return <div className="space-y-4"><Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Impossible de charger les donnees YOU.</CardContent></Card></div>;

  return (
    <div className="animate-in space-y-6 fade-in pb-8 duration-300">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: 'Money partage', value: user.money.toLocaleString('fr-FR') }, { label: 'Aura partagee', value: user.aura.toLocaleString('fr-FR') }, { label: 'Businesses', value: String(data.ownedBusinesses.length) }, { label: 'Relations', value: String(data.relationships.length) }].map((entry) => <Card key={entry.label}><CardContent className="px-5 py-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{entry.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{entry.value}</p></CardContent></Card>)}
      </div>
      {currentTab === 'overview' ? <OverviewTab data={data} /> : null}
      {currentTab === 'travail' ? <TravailTab data={data} players={data.players} onReload={loadState} /> : null}
      {currentTab === 'social' ? <SocialTab data={data} onReload={() => loadState()} /> : null}
      {currentTab === 'explore' ? <ExploreTab data={data} players={data.players} userId={user.id} onReload={loadState} /> : null}
    </div>
  );
}

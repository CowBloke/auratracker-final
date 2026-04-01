import { type ElementType, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle, BarChart3, Building2, Check, ChevronRight, CreditCard, Heart, Landmark, PiggyBank, Search, ShieldAlert, Trash2, TrendingUp, UserPlus, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/FeaturesContext';
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

const BUSINESS_STYLE_MAP = {
  startup: { card: 'border-sky-400/30 bg-sky-400/10', badge: 'bg-sky-400/15 text-sky-400', iconWrap: 'bg-sky-400/15', icon: 'text-sky-400' },
  bank: { card: 'border-emerald-400/30 bg-emerald-400/10', badge: 'bg-emerald-400/15 text-emerald-400', iconWrap: 'bg-emerald-400/15', icon: 'text-emerald-400' },
  agency: { card: 'border-violet-400/30 bg-violet-400/10', badge: 'bg-violet-400/15 text-violet-400', iconWrap: 'bg-violet-400/15', icon: 'text-violet-400' },
} as const;

const ACTION_META = {
  invite: { label: 'Inviter des joueurs', help: 'Envoyer des invitations de recrutement.', icon: UserPlus, tone: 'bg-purple-400/15 text-purple-400' },
  loan: { label: 'Demander un pret', help: 'Envoyer une demande de pret au proprietaire du business.', icon: CreditCard, tone: 'bg-amber-400/15 text-amber-400' },
  invest: { label: 'Investir', help: 'Transferer du money vers la tresorerie d un autre joueur.', icon: TrendingUp, tone: 'bg-sky-400/15 text-sky-400' },
  deposit: { label: 'Deposer', help: 'Envoyer ton money partage dans la tresorerie du business.', icon: ArrowDownCircle, tone: 'bg-emerald-400/15 text-emerald-400' },
  withdraw: { label: 'Retirer', help: 'Sortir du money de la tresorerie vers ton solde partage.', icon: ArrowUpCircle, tone: 'bg-red-400/15 text-red-400' },
} as const;

type BusinessAction = keyof typeof ACTION_META;

function formatMoney(value: number) {
  return value.toLocaleString('fr-FR');
}

function getRelationshipPill(status: YouRelationship['status']) {
  if (status === 'MARRIED') {
    return { label: 'Marie', color: 'bg-red-400/15 text-red-400' };
  }

  if (status === 'DIVORCED') {
    return { label: 'Divorce', color: 'bg-slate-400/15 text-slate-300' };
  }

  return { label: 'Relation', color: 'bg-pink-400/15 text-pink-400' };
}

function canUseBusinessAction(business: YouBusiness, action: BusinessAction, userId: string) {
  if (action === 'invite' || action === 'deposit' || action === 'withdraw') {
    return business.ownerId === userId;
  }

  if (action === 'loan' || action === 'invest') {
    return business.ownerId !== userId;
  }

  return false;
}

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
  const isBank = selectedType?.key === 'bank';

  const submit = async () => {
    if (!selectedType) return;
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.createBusiness({ name, typeKey: selectedType.key, capital: isBank ? 0 : Number(capital) }), 'Impossible de creer le business.');
      toast.success('Business cree');
      await onCreated();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title="Creer une entreprise" desc={isBank ? 'La creation de la banque coute 10 000 money et la tresorerie demarre a 0.' : 'Le capital de depart est pris sur ton argent global.'}>
      <FieldRow label="Type d activite">
        <div className="space-y-3">
          {businessTypes.map((type) => {
            const Icon = BUSINESS_ICON_MAP[type.key as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
            const style = BUSINESS_STYLE_MAP[type.key as keyof typeof BUSINESS_STYLE_MAP] ?? { card: 'border-border/40 bg-muted/10', badge: 'bg-muted text-muted-foreground', iconWrap: 'bg-muted/20', icon: 'text-foreground' };
            const active = type.key === typeKey;
            return (
              <button
                key={type.key}
                type="button"
                onClick={() => {
                  setTypeKey(type.key);
                  setCapital(String(type.minCapital));
                }}
                className={cn('w-full rounded-2xl border px-4 py-4 text-left transition-all', active ? style.card : 'border-border/40 bg-muted/10 hover:bg-muted/20')}
              >
                <div className="flex items-start gap-4">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', active ? style.iconWrap : 'bg-muted/20')}>
                    <Icon className={cn('h-5 w-5', active ? style.icon : 'text-foreground')} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{type.label}</p>
                      <Pill label={type.category} color={active ? style.badge : 'bg-muted text-muted-foreground'} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{type.description}</p>
                    <p className="mt-3 text-[11px] font-medium text-muted-foreground">Frais: {type.creationFee.toLocaleString('fr-FR')} money{type.minCapital > 0 ? ` · capital min. ${type.minCapital.toLocaleString('fr-FR')}` : ''}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </FieldRow>
      {selectedType ? <div className="rounded-xl border border-border/40 bg-muted/10 p-4"><p className="text-sm font-medium">{selectedType.label}</p><p className="mt-1 text-xs text-muted-foreground">{selectedType.description}</p><p className="mt-2 text-[11px] text-muted-foreground">Frais de creation: {formatMoney(selectedType.creationFee)} money{selectedType.key === 'bank' ? ' · tresorerie initiale: 0' : ` · capital mini: ${formatMoney(selectedType.minCapital)} money`}</p></div> : null}
      <FieldRow label="Nom"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="ex : Citizen Bank" /></FieldRow>
      {!isBank ? <FieldRow label="Capital de depart"><Input type="number" value={capital} onChange={(event) => setCapital(event.target.value)} min={selectedType?.minCapital ?? 0} /></FieldRow> : null}
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button><Button size="sm" onClick={submit} disabled={submitting || !selectedType || !name.trim() || (!isBank && Number(capital) < selectedType.minCapital)}>Creer</Button></div>
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
  const [durationDays, setDurationDays] = useState('30');
  const [submitting, setSubmitting] = useState(false);
  const dailyRepayment = Math.round((Number(amount || 0) * 1.04) / Math.max(1, Number(durationDays || 1)));

  const submit = async () => {
    if (!business) return;
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.runBusinessAction(business.id, 'loan', { amount: Number(amount), durationDays: Number(durationDays) }), 'Impossible d emprunter.');
      toast.success('Demande de pret envoyee');
      await onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title={business ? `Demander un pret · ${business.name}` : 'Demander un pret'} desc="Le proprietaire devra accepter la demande avant que le money soit debloque.">
      <FieldRow label="Montant"><Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min={500} /></FieldRow>
      <FieldRow label="Duree"><SelectBox value={durationDays} onChange={setDurationDays}>{['7', '14', '30', '60', '90'].map((value) => <option key={value} value={value}>{value} jours</option>)}</SelectBox></FieldRow>
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/40 bg-muted/10 p-4"><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Remboursement / jour</p><p className="text-lg font-bold tabular-nums">{formatMoney(dailyRepayment)}</p></div><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Total estime</p><p className="text-lg font-bold tabular-nums text-red-400">{formatMoney(Math.round(Number(amount || 0) * 1.04))}</p></div></div>
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button><Button size="sm" onClick={submit} disabled={submitting || !business}>Envoyer</Button></div>
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
    <ModalWrap open={open} onClose={onClose} title={business ? `Investir · ${business.name}` : 'Investir'} desc="Le money est retire de ton solde partage puis credite a la tresorerie du business.">
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

function OverviewTab({ data, userId }: { data: YouState; userId: string }) {
  const latestBusinesses = data.ownedBusinesses.slice(0, 2);
  const latestRelationships = data.relationships.slice(0, 3);
  const activeRepayments = [...data.ownedBusinesses, ...data.exploreBusinesses]
    .flatMap((business) =>
      business.recentLoans
        .filter((loan) => loan.status === 'ACTIVE' && loan.borrower.id === userId)
        .map((loan) => ({
          businessName: business.name,
          amount: loan.amount,
          termDays: loan.termDays,
          dailyRepayment: Math.round((loan.amount * (1 + loan.interestRate / 100)) / Math.max(1, loan.termDays)),
          loanId: loan.id,
        }))
    )
    .slice(0, 4);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <SectionTitle>Activite business</SectionTitle>
        <Card><CardContent className="space-y-3 px-5 py-4">{latestBusinesses.length === 0 ? <p className="text-sm text-muted-foreground">Aucun business cree pour le moment.</p> : latestBusinesses.map((business) => { const revenue = business.monthlyRevenue; const Icon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2; return <div key={business.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/30"><Icon className="h-4 w-4 text-foreground" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-semibold">{business.name}</p>{business.type ? <Pill label={business.type.label} color="bg-sky-400/15 text-sky-400" /> : null}</div><p className="text-xs text-muted-foreground">{business.memberCount} membre(s) · {business.location || 'Lieu non defini'}</p></div><div className="text-right"><p className="text-sm font-bold tabular-nums text-emerald-400">+{formatMoney(revenue)}</p><p className="text-[10px] text-muted-foreground">revenu</p></div></div>; })}</CardContent></Card>
        <SectionTitle>Remboursements</SectionTitle>
        <Card><CardContent className="space-y-3 px-5 py-4">{activeRepayments.length === 0 ? <p className="text-sm text-muted-foreground">Aucun remboursement actif a suivre.</p> : activeRepayments.map((loan) => <div key={loan.loanId} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{loan.businessName}</p><p className="text-xs text-muted-foreground">{formatMoney(loan.amount)} money sur {loan.termDays} jours</p></div><div className="text-right"><p className="text-sm font-bold tabular-nums text-amber-400">{formatMoney(loan.dailyRepayment)}</p><p className="text-[10px] text-muted-foreground">par jour</p></div></div></div>)}</CardContent></Card>
      </div>
      <div className="space-y-4">
        <SectionTitle>Relations</SectionTitle>
        <Card><CardContent className="space-y-3 px-5 py-4">{latestRelationships.length === 0 ? <p className="text-sm text-muted-foreground">Aucune relation active pour le moment.</p> : latestRelationships.map((relationship) => { const pill = getRelationshipPill(relationship.status); return <div key={relationship.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3"><div className="flex items-center gap-3"><UserAvatar player={relationship.otherUser} className="h-9 w-9" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-semibold">{relationship.otherUser.username}</p><Pill label={pill.label} color={pill.color} /></div><p className="text-xs text-muted-foreground">{relationship.pendingProposal ? `Demande ${relationship.pendingProposal.direction === 'sent' ? 'envoyee' : 'recue'}` : 'Aucune demande en attente'}</p></div><span className="text-xs font-medium text-muted-foreground">{relationship.connectionLevel}%</span></div><div className="mt-3"><ProgressBar value={relationship.connectionLevel} color="bg-pink-400" /></div></div>; })}</CardContent></Card>
      </div>
    </div>
  );
}

function ManageBusinessModal({
  open,
  onClose,
  business,
  onInviteRequested,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness | null;
  onInviteRequested: (business: YouBusiness) => void;
  onSubmitted: (refreshBalance?: boolean) => Promise<void>;
}) {
  const [depositAmount, setDepositAmount] = useState('1000');
  const [withdrawAmount, setWithdrawAmount] = useState('1000');
  const [activeTreasuryAction, setActiveTreasuryAction] = useState<'deposit' | 'withdraw' | null>(null);
  const [reviewingLoanId, setReviewingLoanId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDepositAmount('1000');
      setWithdrawAmount('1000');
      setActiveTreasuryAction(null);
      setReviewingLoanId(null);
    }
  }, [open, business?.id]);

  const pendingLoans = business?.recentLoans.filter((loan) => loan.status === 'PENDING') ?? [];
  const isBank = business?.typeKey === 'bank';

  const runTreasuryAction = async (action: 'deposit' | 'withdraw', amount: string) => {
    if (!business) return;
    setActiveTreasuryAction(action);
    try {
      await withRouteError(
        () => youApi.runBusinessAction(business.id, action, { amount: Number(amount) }),
        action === 'deposit' ? 'Impossible de deposer dans la tresorerie.' : 'Impossible de retirer de la tresorerie.'
      );
      toast.success(action === 'deposit' ? 'Depot enregistre' : 'Retrait enregistre');
      await onSubmitted(true);
    } finally {
      setActiveTreasuryAction(null);
    }
  };

  const reviewLoan = async (loanId: string, decision: 'accept' | 'reject') => {
    setReviewingLoanId(loanId);
    try {
      await withRouteError(() => youApi.respondToBusinessLoan(loanId, decision), 'Impossible de traiter la demande de pret.');
      toast.success(decision === 'accept' ? 'Pret accepte' : 'Pret refuse');
      await onSubmitted(true);
    } finally {
      setReviewingLoanId(null);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title={business ? `Gerer business · ${business.name}` : 'Gerer business'} desc="Actions de gestion sur la structure selectionnee." wide>
      {business ? (
        <>
          {isBank ? (
            <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/10 px-6 py-8 text-center">
              <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300/80">Tresorerie</p>
              <p className="mt-3 text-5xl font-semibold tabular-nums text-emerald-200">{formatMoney(business.treasuryMoney)}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {[{ label: 'Tresorerie', value: formatMoney(business.treasuryMoney) }, { label: 'Membres', value: String(business.memberCount) }, { label: 'Revenue', value: `+${formatMoney(business.monthlyRevenue)}` }].map((entry) => <div key={entry.label} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{entry.label}</p><p className="mt-1 text-base font-semibold tabular-nums">{entry.value}</p></div>)}
            </div>
          )}

          <div className="space-y-3">
            <SectionTitle>Actions business</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2">
              {business.actions.includes('deposit') ? (
                <Card><CardContent className="space-y-3 px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/15"><ArrowDownCircle className="h-4 w-4 text-emerald-400" /></div><div><p className="text-sm font-semibold">Deposer dans la tresorerie</p><p className="text-xs text-muted-foreground">Transfert depuis ton money partage.</p></div></div><div className="flex gap-2"><Input type="number" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} min={1} /><Button size="sm" onClick={() => void runTreasuryAction('deposit', depositAmount)} disabled={activeTreasuryAction !== null || Number(depositAmount) <= 0}>Deposer</Button></div></CardContent></Card>
              ) : null}
              {business.actions.includes('withdraw') ? (
                <Card><CardContent className="space-y-3 px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-400/15"><ArrowUpCircle className="h-4 w-4 text-red-400" /></div><div><p className="text-sm font-semibold">Retirer de la tresorerie</p><p className="text-xs text-muted-foreground">Retour vers ton money partage.</p></div></div><div className="flex gap-2"><Input type="number" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} min={1} /><Button size="sm" variant="outline" onClick={() => void runTreasuryAction('withdraw', withdrawAmount)} disabled={activeTreasuryAction !== null || Number(withdrawAmount) <= 0}>Retirer</Button></div></CardContent></Card>
              ) : null}
            </div>
            {business.actions.includes('invite') ? <div className="flex justify-start"><Button size="sm" variant="outline" className="text-xs" onClick={() => { onClose(); onInviteRequested(business); }}><UserPlus className="mr-1.5 h-3.5 w-3.5" />Inviter des joueurs</Button></div> : null}
          </div>

          <div className="space-y-3">
            <SectionTitle>Demandes de pret</SectionTitle>
            {pendingLoans.length === 0 ? <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">Aucune demande de pret en attente.</div> : pendingLoans.map((loan) => <div key={loan.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold">{loan.borrower.username}</p><p className="text-xs text-muted-foreground">{formatMoney(loan.amount)} money · {loan.termDays} jours · {loan.interestRate}% d interet</p></div><div className="flex gap-2"><Button size="sm" className="text-xs" onClick={() => void reviewLoan(loan.id, 'accept')} disabled={reviewingLoanId !== null}><Check className="mr-1.5 h-3.5 w-3.5" />Accepter</Button><Button size="sm" variant="outline" className="text-xs" onClick={() => void reviewLoan(loan.id, 'reject')} disabled={reviewingLoanId !== null}><X className="mr-1.5 h-3.5 w-3.5" />Refuser</Button></div></div></div>)}
          </div>
        </>
      ) : null}
    </ModalWrap>
  );
}

function TravailTab({ data, players, onReload }: { data: YouState; players: YouPlayer[]; onReload: (refreshBalance?: boolean) => Promise<void> }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteBusiness, setInviteBusiness] = useState<YouBusiness | null>(null);
  const [managedBusiness, setManagedBusiness] = useState<YouBusiness | null>(null);

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionTitle>Actions</SectionTitle>
          <ActionCard><ActionRow icon={Building2} label="Creer une entreprise" sub={`${data.ownedBusinesses.length} business possede(s)`} iconBg="bg-emerald-400/15" iconColor="text-emerald-400" onClick={() => setCreateOpen(true)} /></ActionCard>
        </div>
        <div className="space-y-4">
          <SectionTitle>Mes entreprises ({data.ownedBusinesses.length})</SectionTitle>
          {data.ownedBusinesses.length === 0 ? <Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Aucune entreprise creee. Ouvre-en une depuis cette page pour utiliser ton argent reel du site.</CardContent></Card> : data.ownedBusinesses.map((business) => { const Icon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2; return <Card key={business.id}><CardContent className="flex items-center gap-4 px-5 py-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/20"><Icon className="h-5 w-5 text-foreground" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-base font-semibold">{business.name}</p>{business.type ? <Pill label={business.type.label} color="bg-sky-400/15 text-sky-400" /> : null}</div><p className="mt-1 text-sm text-muted-foreground">Revenue: +{formatMoney(business.monthlyRevenue)}</p></div><Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => setManagedBusiness(business)}>Gerer business</Button></CardContent></Card>; })}
        </div>
      </div>
      <CreateBusinessModal open={createOpen} onClose={() => setCreateOpen(false)} businessTypes={data.businessTypes} onCreated={() => onReload(true)} />
      <InvitePlayersModal open={Boolean(inviteBusiness)} onClose={() => setInviteBusiness(null)} business={inviteBusiness} players={players} onSubmitted={() => onReload()} />
      <ManageBusinessModal open={Boolean(managedBusiness)} onClose={() => setManagedBusiness(null)} business={managedBusiness} onInviteRequested={setInviteBusiness} onSubmitted={onReload} />
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

  const divorce = async (relationshipId: string) => {
    await withRouteError(() => youApi.divorceRelationship(relationshipId), 'Impossible d enregistrer le divorce.');
    toast.success('Divorce enregistre');
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
          {data.relationships.length === 0 ? <Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Aucune relation en base. Cree-en une avec un vrai joueur depuis le panneau de gauche.</CardContent></Card> : data.relationships.map((relationship) => { const pill = getRelationshipPill(relationship.status); return <Card key={relationship.id}><CardContent className="space-y-4 px-5 py-4"><div className="flex items-start gap-3"><UserAvatar player={relationship.otherUser} className="h-11 w-11" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-base font-semibold">{relationship.otherUser.username}</p><Pill label={pill.label} color={pill.color} />{relationship.pendingProposal ? <Pill label={relationship.pendingProposal.direction === 'sent' ? 'Demande envoyee' : 'Demande recue'} color="bg-amber-400/15 text-amber-400" /> : null}</div><p className="mt-1 text-sm text-muted-foreground">{relationship.otherUser.bio?.trim() || 'Aucune bio renseignee.'}</p></div><span className="text-sm font-bold tabular-nums text-pink-400">{relationship.connectionLevel}%</span></div><div className="space-y-1"><div className="flex justify-between text-[11px] text-muted-foreground"><span>Connexion</span><span>{relationship.status === 'MARRIED' ? 'Statut finalise' : relationship.status === 'DIVORCED' ? 'Relation terminee' : 'Evolution active'}</span></div><ProgressBar value={relationship.connectionLevel} color="bg-pink-400" /></div>{relationship.pendingProposal ? <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">{relationship.pendingProposal.direction === 'sent' ? 'Ta demande en mariage est en attente.' : 'Une demande en mariage attend ta reponse.'}</div> : null}{relationship.canDivorce ? <div className="flex justify-end"><Button size="sm" variant="outline" className="text-xs text-red-300" onClick={() => void divorce(relationship.id)}>Divorcer</Button></div> : null}</CardContent></Card>; })}
        </div>
      </div>
      <MeetModal open={meetOpen} onClose={() => setMeetOpen(false)} players={data.players} onSubmitted={onReload} />
      <MarriageModal open={marryOpen} onClose={() => setMarryOpen(false)} relationships={eligibleForMarriage} onSubmitted={onReload} />
    </>
  );
}

function FilterButton({
  active,
  label,
  icon: Icon,
  onClick,
  colorClass,
}: {
  active: boolean;
  label: string;
  icon: ElementType;
  onClick: () => void;
  colorClass: string;
}) {
  return <button type="button" onClick={onClick} className={cn('flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors', active ? `${colorClass} border-transparent text-white` : 'border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground')}><Icon className="h-3.5 w-3.5" /><span>{label}</span></button>;
}

function ExploreTab({ data, players, userId, isAdmin, onReload }: { data: YouState; players: YouPlayer[]; userId: string; isAdmin: boolean; onReload: (refreshBalance?: boolean) => Promise<void> }) {
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
  const visibleActions = selectedBusiness ? selectedBusiness.actions.filter((action) => canUseBusinessAction(selectedBusiness, action as BusinessAction, userId)) : [];

  const onAction = (business: YouBusiness, action: BusinessAction) => {
    if (action === 'invite') setInviteBusiness(business);
    if (action === 'loan') setLoanBusiness(business);
    if (action === 'invest') setInvestBusiness(business);
  };

  const deleteSelectedBusiness = async () => {
    if (!selectedBusiness || !isAdmin) return;
    await withRouteError(() => youApi.deleteBusiness(selectedBusiness.id), 'Impossible de supprimer le business.');
    toast.success('Business supprime');
    await onReload();
  };

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[190px_minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card><CardContent className="space-y-4 px-4 py-4"><div className="flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-semibold">Filtres</p></div><div className="space-y-2"><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Categorie</p><div className="space-y-1.5">{categories.map((entry) => <FilterButton key={entry} active={category === entry} label={entry === 'all' ? 'Toutes' : entry} icon={entry === 'all' ? Wallet : entry === 'Finance' ? Landmark : entry === 'Tech' ? Building2 : BarChart3} colorClass={entry === 'Finance' ? 'bg-emerald-500' : entry === 'Tech' ? 'bg-sky-500' : entry === 'Services' ? 'bg-violet-500' : 'bg-slate-600'} onClick={() => setCategory(entry)} />)}</div></div><div className="space-y-2"><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Proprietaire</p><div className="space-y-1.5"><FilterButton active={ownerFilter === 'all'} label="Tous" icon={Wallet} colorClass="bg-slate-600" onClick={() => setOwnerFilter('all')} /><FilterButton active={ownerFilter === 'you'} label="Mes businesses" icon={PiggyBank} colorClass="bg-purple-500" onClick={() => setOwnerFilter('you')} /><FilterButton active={ownerFilter === 'player'} label="Autres joueurs" icon={UserPlus} colorClass="bg-amber-500" onClick={() => setOwnerFilter('player')} /></div></div></CardContent></Card>
        </div>
        <div className="space-y-4">
          <Card><CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un business ou un joueur..." className="pl-9" /></div><div className="text-xs text-muted-foreground">{filteredBusinesses.length} resultat{filteredBusinesses.length > 1 ? 's' : ''}</div></CardContent></Card>
          <Card><CardContent className="p-0"><div className="divide-y divide-border/30">{filteredBusinesses.map((business) => { const Icon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2; const selected = business.id === selectedBusiness?.id; const profit = business.monthlyRevenue - business.monthlyExpenses; return <button key={business.id} type="button" onClick={() => setSelectedBusinessId(business.id)} className={cn('w-full px-5 py-4 text-left transition-colors', selected ? 'bg-muted/25' : 'hover:bg-muted/15')}><div className="flex items-start gap-3"><div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/20"><Icon className="h-4 w-4 text-foreground" /></div><div className="min-w-0 flex-1 space-y-1.5"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{business.name}</p>{business.type ? <Pill label={business.type.label} color="bg-sky-400/15 text-sky-400" /> : null}{business.ownerId === userId ? <Pill label="A toi" color="bg-purple-400/15 text-purple-400" /> : null}</div><p className="text-xs text-muted-foreground">par {business.owner.username} · {business.location || 'Lieu non defini'}</p><p className="line-clamp-2 text-xs text-muted-foreground">{business.description || 'Aucune description.'}</p></div><div className="text-right"><p className={cn('text-sm font-bold tabular-nums', profit >= 0 ? 'text-emerald-400' : 'text-red-400')}>{profit >= 0 ? '+' : ''}{profit.toLocaleString('fr-FR')}</p><p className="text-[10px] text-muted-foreground">{business.satisfaction}/100</p></div></div></button>; })}{filteredBusinesses.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aucun business ne correspond a tes filtres.</p> : null}</div></CardContent></Card>
        </div>
        <div className="space-y-4">
          {selectedBusiness ? <><Card><CardContent className="space-y-4 px-5 py-4"><div className="flex items-start gap-3"><UserAvatar player={selectedBusiness.owner} className="h-11 w-11" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-base font-semibold">{selectedBusiness.name}</p>{selectedBusiness.verified ? <Pill label="Verifie" color="bg-emerald-400/15 text-emerald-400" /> : null}</div><p className="mt-1 text-sm text-muted-foreground">{selectedBusiness.description || 'Aucune description.'}</p></div></div><div className="grid grid-cols-2 gap-2">{[{ label: 'Proprietaire', value: selectedBusiness.owner.username }, { label: 'Fondation', value: selectedBusiness.foundedLabel }, { label: 'Lieu', value: selectedBusiness.location || 'n/a' }, { label: 'Satisfaction', value: `${selectedBusiness.satisfaction}/100` }].map((entry) => <div key={entry.label} className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{entry.label}</p><p className="mt-1 text-sm font-medium">{entry.value}</p></div>)}</div>{isAdmin ? <Button size="sm" variant="outline" className="w-full justify-start border-red-400/30 text-red-300 hover:bg-red-500/10" onClick={() => void deleteSelectedBusiness()}><Trash2 className="mr-2 h-4 w-4" />Supprimer ce business</Button> : null}</CardContent></Card><Card><CardContent className="space-y-3 px-5 py-4"><SectionTitle>Actions utilisateur</SectionTitle>{visibleActions.length === 0 ? <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">{selectedBusiness.ownerId === userId ? 'Les actions de gestion se trouvent dans l onglet travail via le bouton Gerer business.' : 'Aucune action disponible pour ce business.'}</div> : <div className="space-y-2">{visibleActions.map((action) => { const meta = ACTION_META[action as BusinessAction]; const Icon = meta.icon; const [toneBg, toneText] = meta.tone.split(' '); return <button key={action} type="button" onClick={() => onAction(selectedBusiness, action as BusinessAction)} className="flex w-full items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-left transition-colors hover:bg-muted/20"><div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', toneBg)}><Icon className={cn('h-4 w-4', toneText)} /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{meta.label}</p><p className="text-xs text-muted-foreground">{meta.help}</p></div><ChevronRight className="h-4 w-4 text-muted-foreground/40" /></button>; })}</div>}{isAdmin ? <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-100"><div className="flex items-start gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>Mode admin actif: tu peux supprimer un business directement depuis cette fiche.</p></div></div> : null}</CardContent></Card></> : <Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Selectionne un business pour voir ses details.</CardContent></Card>}
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
  const { maintenanceStatus } = useFeatures();
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

  if (maintenanceStatus.youLogoAdminOnly && !user?.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading && !data) return <div className="space-y-4"><Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Chargement du hub YOU...</CardContent></Card></div>;
  if (!data || !user) return <div className="space-y-4"><Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Impossible de charger les donnees YOU.</CardContent></Card></div>;

  return (
    <div className="animate-in space-y-6 fade-in pb-8 duration-300">
      {currentTab !== 'travail' ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: 'Money partage', value: user.money.toLocaleString('fr-FR') }, { label: 'Aura partagee', value: user.aura.toLocaleString('fr-FR') }, { label: 'Businesses', value: String(data.ownedBusinesses.length) }, { label: 'Relations', value: String(data.relationships.length) }].map((entry) => (
          <Card key={entry.label} className="min-w-0 overflow-hidden">
            <CardContent className="min-w-0 px-5 py-4">
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground/60">{entry.label}</p>
              <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{entry.value}</p>
            </CardContent>
          </Card>
        ))}
      </div> : null}
      {currentTab === 'overview' ? <OverviewTab data={data} userId={user.id} /> : null}
      {currentTab === 'travail' ? <TravailTab data={data} players={data.players} onReload={loadState} /> : null}
      {currentTab === 'social' ? <SocialTab data={data} onReload={() => loadState()} /> : null}
      {currentTab === 'explore' ? <ExploreTab data={data} players={data.players} userId={user.id} isAdmin={Boolean(user.isAdmin)} onReload={loadState} /> : null}
    </div>
  );
}

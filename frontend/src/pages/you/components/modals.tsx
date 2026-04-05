import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, Building2, CalendarDays, Check, ChevronRight,
  CreditCard, Download, Edit2, ExternalLink, GraduationCap, Landmark, Loader2, Percent,
  Plus, Scale, Sparkles, Star, Trash2, TrendingUp, UserPlus, Users, Wallet, X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  type YouBankAccount, type YouBusiness, type YouBusinessLoan, type YouBusinessTransaction,
  type YouBusinessType, type YouFormationProduct, type YouPlayer, type YouRelationship, type YouStartupProduct, youApi,
} from '@/services/api';
import { BUSINESS_ICON_MAP, BUSINESS_STYLE_MAP } from '../constants';
import { formatDurationMinutes, formatMoney, withRouteError } from '../utils';
import { ActionCard, ActionRow, FieldRow, ModalWrap, Pill, SectionTitle, SelectBox, UserAvatar } from './ui';

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return window.btoa(binary);
}

async function openFormationAccess(
  businessId: string,
  productId: string,
  mode: 'file' | 'external' | 'auto' = 'auto',
) {
  const access = await withRouteError(
    () => youApi.accessFormationProduct(businessId, productId),
    'Impossible d acceder a cette formation.',
  );
  const result = access.data.result;

  if ((mode === 'external' || mode === 'auto') && result.url && (mode === 'external' || !result.hasAttachment)) {
    window.open(result.url, '_blank', 'noopener,noreferrer');
    return;
  }

  if (mode === 'external' && !result.url) {
    throw new Error('FORMATION_EXTERNAL_URL_UNAVAILABLE');
  }

  if (!result.hasAttachment) {
    if (result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer');
      return;
    }
    throw new Error('FORMATION_ATTACHMENT_UNAVAILABLE');
  }

  const blobResponse = await withRouteError(
    () => youApi.downloadFormationProductFile(businessId, productId),
    'Impossible de telecharger ce fichier.',
  );
  const blob = new Blob([blobResponse.data], { type: result.attachmentMimeType ?? 'application/octet-stream' });
  const objectUrl = window.URL.createObjectURL(blob);
  if (result.attachmentMimeType === 'application/pdf') {
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
  } else {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = result.attachmentOriginalName ?? `${result.title}.bin`;
    link.click();
  }
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}

function getLoanStartDate(loan: YouBusinessLoan) {
  return new Date(loan.decidedAt ?? loan.createdAt);
}

function getLoanDueDate(loan: YouBusinessLoan) {
  const dueDate = new Date(getLoanStartDate(loan));
  dueDate.setDate(dueDate.getDate() + Math.max(0, loan.termDays));
  return dueDate;
}

function formatLoanDate(value: string | Date) {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getLoanTimeLeftLabel(loan: YouBusinessLoan) {
  const dueDate = getLoanDueDate(loan);
  const diffMs = dueDate.getTime() - Date.now();

  if (diffMs <= 0) {
    return 'Echeance depassee';
  }

  const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days <= 0) {
    return `${hours}h restantes`;
  }

  if (hours === 0) {
    return `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;
  }

  return `${days}j ${hours}h restantes`;
}

function BusinessTypePickerModal({
  open,
  onClose,
  businessTypes,
  selectedKey,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  businessTypes: YouBusinessType[];
  selectedKey: string;
  onSelect: (type: YouBusinessType) => void;
}) {
  return (
    <ModalWrap open={open} onClose={onClose} title="Choisir un type d activite" desc="Selectionne le type de structure a creer.">
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        {businessTypes.map((type) => {
          const Icon = BUSINESS_ICON_MAP[type.key as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
          const style = BUSINESS_STYLE_MAP[type.key as keyof typeof BUSINESS_STYLE_MAP] ?? { card: 'border-border/40 bg-muted/10', badge: 'bg-muted text-muted-foreground', iconWrap: 'bg-muted/20', icon: 'text-foreground' };
          const active = type.key === selectedKey;
          return (
            <button
              key={type.key}
              type="button"
              onClick={() => { onSelect(type); onClose(); }}
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
    </ModalWrap>
  );
}

export function CreateBusinessModal({
  open,
  onClose,
  businessTypes,
  unlockedBusinessLevel,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  businessTypes: YouBusinessType[];
  unlockedBusinessLevel: number;
  onCreated: () => Promise<void>;
}) {
  // Filter types to those accessible given unlocked level
  const accessibleTypes = businessTypes.filter((t) => t.level === 1 || t.level <= (unlockedBusinessLevel + 1));

  const [name, setName] = useState('');
  const [typeKey, setTypeKey] = useState(accessibleTypes[0]?.key ?? '');
  const [capital, setCapital] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const firstType = accessibleTypes[0];
    if (firstType) {
      setTypeKey(firstType.key);
      setCapital(String(firstType.minCapital));
    }
    setName('');
  }, [businessTypes, open]);

  const selectedType = accessibleTypes.find((type) => type.key === typeKey) ?? accessibleTypes[0];
  const isBank = selectedType?.key === 'bank';

  const submit = async () => {
    if (!selectedType) return;
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.createBusiness({ name, typeKey: selectedType.key, capital: isBank ? 0 : Number(capital) }), 'Impossible de creer le business.');
      toast.success('Business cree');
      await onCreated();
      onClose();
    } catch {
      // withRouteError already displayed the backend message
    } finally {
      setSubmitting(false);
    }
  };

  const SelectedIcon = selectedType ? (BUSINESS_ICON_MAP[selectedType.key as keyof typeof BUSINESS_ICON_MAP] ?? Building2) : Building2;
  const selectedStyle = selectedType ? (BUSINESS_STYLE_MAP[selectedType.key as keyof typeof BUSINESS_STYLE_MAP] ?? { iconWrap: 'bg-muted/20', icon: 'text-foreground', badge: 'bg-muted text-muted-foreground' }) : { iconWrap: 'bg-muted/20', icon: 'text-foreground', badge: 'bg-muted text-muted-foreground' };

  return (
    <>
      <ModalWrap open={open} onClose={onClose} title="Creer une entreprise" desc={isBank ? 'La creation de la banque coute 10 000 money et la tresorerie demarre a 0.' : 'Le capital de depart est pris sur ton argent global.'}>
        <FieldRow label="Type d activite">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full rounded-2xl border border-border/40 bg-muted/10 px-4 py-4 text-left transition-all hover:bg-muted/20"
          >
            {selectedType ? (
              <div className="flex items-center gap-4">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', selectedStyle.iconWrap)}>
                  <SelectedIcon className={cn('h-5 w-5', selectedStyle.icon)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{selectedType.label}</p>
                    <Pill label={selectedType.category} color={selectedStyle.badge} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{selectedType.description}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">Changer →</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Choisir un type...</p>
            )}
          </button>
        </FieldRow>
        {selectedType ? <div className="rounded-xl border border-border/40 bg-muted/10 p-4"><p className="text-[11px] text-muted-foreground">Frais de creation: {formatMoney(selectedType.creationFee)} money{selectedType.key === 'bank' ? ' · tresorerie initiale: 0' : ` · capital mini: ${formatMoney(selectedType.minCapital)} money`}</p></div> : null}
        <FieldRow label="Nom"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="ex : Citizen Bank" /></FieldRow>
        {!isBank ? <FieldRow label="Capital de depart"><Input type="number" value={capital} onChange={(event) => setCapital(event.target.value)} min={selectedType?.minCapital ?? 0} /></FieldRow> : null}
        <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button><Button size="sm" onClick={submit} disabled={submitting || !selectedType || !name.trim() || (!isBank && Number(capital) < selectedType.minCapital)}>Creer</Button></div>
      </ModalWrap>
      <BusinessTypePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        businessTypes={accessibleTypes}
        selectedKey={typeKey}
        onSelect={(type) => {
          setTypeKey(type.key);
          setCapital(String(type.minCapital));
        }}
      />
    </>
  );
}

export function InvitePlayersModal({
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
  const [salary, setSalary] = useState('0');
  const [message, setMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setRole('employee');
      setSalary('0');
      setMessage('');
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
      await withRouteError(() => youApi.runBusinessAction(business.id, 'invite', { inviteeIds: selectedIds, role, salary: Number(salary), message: message.trim() }), 'Impossible d envoyer les invitations.');
      toast.success('Invitations envoyees');
      await onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title={business ? `Inviter des joueurs · ${business.name}` : 'Inviter des joueurs'} desc="Toutes les invitations ciblent de vrais joueurs." wide>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px_140px]">
        <FieldRow label="Recherche"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pseudo, prenom..." /></FieldRow>
        <FieldRow label="Role propose"><SelectBox value={role} onChange={setRole}><option value="employee">Employe</option><option value="partner">Associe</option><option value="advisor">Conseiller</option></SelectBox></FieldRow>
        <FieldRow label="Salaire / jour"><Input type="number" min={0} value={salary} onChange={(event) => setSalary(event.target.value)} /></FieldRow>
      </div>
      <FieldRow label="Message facultatif">
        <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={240} placeholder="Propose le poste, explique l'objectif ou le cadre du contrat." />
      </FieldRow>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {availablePlayers.map((player) => {
          const selected = selectedIds.includes(player.id);
          return <div key={player.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3"><UserAvatar player={player} className="h-9 w-9" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{player.username}</p><p className="line-clamp-2 text-xs text-muted-foreground">{player.bio?.trim() || 'Disponible pour une collaboration.'}</p></div><Button size="sm" variant={selected ? 'secondary' : 'outline'} className="h-8 text-xs" onClick={() => setSelectedIds((current) => current.includes(player.id) ? current.filter((entry) => entry !== player.id) : [...current, player.id])}>{selected ? 'Selectionne' : 'Inviter'}</Button></div>;
        })}
        {availablePlayers.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Aucun joueur disponible pour cette recherche.</p> : null}
      </div>
      <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">{selectedIds.length === 0 ? 'Aucune invitation preparee.' : `${selectedIds.length} invitation(s) preparee(s) pour le role ${role} a ${Number(salary).toLocaleString('fr-FR')} money/jour.`}</div>
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Fermer</Button><Button size="sm" onClick={submit} disabled={submitting || !business || selectedIds.length === 0}>Envoyer</Button></div>
    </ModalWrap>
  );
}

export function LoanModal({ open, onClose, business, onSubmitted }: { open: boolean; onClose: () => void; business: YouBusiness | null; onSubmitted: () => Promise<void> }) {
  const [amount, setAmount] = useState('5000');
  const [durationDays, setDurationDays] = useState('30');
  const [collateralAura, setCollateralAura] = useState('0');
  const [motivationMessage, setMotivationMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const rate = business?.loanInterestRate ?? 4;
  const total = Math.round(Number(amount || 0) * (1 + rate / 100));
  const dailyRepayment = Math.round(total / Math.max(1, Number(durationDays || 1)));

  const submit = async () => {
    if (!business) return;
    setSubmitting(true);
    try {
      await withRouteError(
        () => youApi.runBusinessAction(business.id, 'loan', {
          amount: Number(amount),
          durationDays: Number(durationDays),
          collateralAura: Number(collateralAura),
          motivationMessage: motivationMessage.trim(),
        }),
        'Impossible d emprunter.'
      );
      toast.success('Demande de pret envoyee');
      setCollateralAura('0');
      setMotivationMessage('');
      await onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title={business ? `Demander un pret · ${business.name}` : 'Demander un pret'} desc="Le proprietaire devra accepter la demande avant que le money soit debloque.">
      <FieldRow label="Montant"><Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min={500} /></FieldRow>
      <FieldRow label="Duree (jours)"><Input type="number" value={durationDays} onChange={(event) => setDurationDays(event.target.value)} min={1} placeholder="ex : 7" /></FieldRow>
      <FieldRow label="Hypotheque (aura)"><Input type="number" value={collateralAura} onChange={(event) => setCollateralAura(event.target.value)} min={0} placeholder="0 si aucun gage" /></FieldRow>
      <FieldRow label="Lettre de motivation">
        <Textarea
          value={motivationMessage}
          onChange={(event) => setMotivationMessage(event.target.value)}
          rows={4}
          maxLength={400}
          placeholder="Explique ce que tu comptes faire de l argent, comment tu vas rembourser et pourquoi ce pret a du sens."
        />
      </FieldRow>
      <div className="grid grid-cols-3 gap-3 rounded-xl border border-border/40 bg-muted/10 p-4">
        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Taux</p><p className="text-lg font-bold tabular-nums text-amber-400">{rate}%</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Remb. / jour</p><p className="text-lg font-bold tabular-nums">{formatMoney(dailyRepayment)}</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Total estime</p><p className="text-lg font-bold tabular-nums text-red-400">{formatMoney(total)}</p></div>
      </div>
      <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
        {Number(collateralAura || 0) > 0
          ? `${Number(collateralAura).toLocaleString('fr-FR')} aura seront bloquees a l acceptation puis rendues au remboursement. Si l echeance est depassee et que le joueur ne peut pas payer, elles seront saisies.`
          : 'Sans hypothèque, le pret repose uniquement sur la capacite du joueur a rembourser.'}
      </div>
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button><Button size="sm" onClick={submit} disabled={submitting || !business || Number(durationDays) < 1 || Number(collateralAura) < 0 || motivationMessage.length > 400}>Envoyer</Button></div>
    </ModalWrap>
  );
}

export function InvestModal({ open, onClose, business, onSubmitted }: { open: boolean; onClose: () => void; business: YouBusiness | null; onSubmitted: () => Promise<void> }) {
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

export function TransferBusinessModal({
  open,
  onClose,
  business,
  players,
  currentUserId,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness | null;
  players: YouPlayer[];
  currentUserId: string;
  onSubmitted: () => Promise<void>;
}) {
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('1000');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setRecipientId('');
      setAmount('1000');
      setSearch('');
    }
  }, [open]);

  const availablePlayers = useMemo(() => players.filter((player) => {
    if (player.id === currentUserId) return false;
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return player.username.toLowerCase().includes(query) || player.firstName?.toLowerCase().includes(query) || player.bio?.toLowerCase().includes(query);
  }), [currentUserId, players, search]);

  const submit = async () => {
    if (!business || !recipientId) return;
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.transferWithBusiness(business.id, { recipientId, amount: Number(amount) }), 'Impossible d effectuer ce transfert.');
      toast.success('Transfert envoye');
      await onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title={business ? `Transfert via ${business.name}` : 'Service de transfert'} desc="Le montant est envoye au joueur choisi et les frais sont credites a la tresorerie du service.">
      <FieldRow label="Recherche"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pseudo, prenom..." /></FieldRow>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {availablePlayers.map((player) => {
          const selected = player.id === recipientId;
          return <button key={player.id} type="button" onClick={() => setRecipientId(player.id)} className={cn('flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors', selected ? 'border-cyan-400/50 bg-cyan-400/10' : 'border-border/40 bg-muted/10 hover:bg-muted/20')}><UserAvatar player={player} className="h-9 w-9" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{player.username}</p><p className="line-clamp-1 text-xs text-muted-foreground">{player.bio?.trim() || 'Disponible pour recevoir un transfert.'}</p></div>{selected ? <Pill label="Destinataire" color="bg-cyan-400/15 text-cyan-300" /> : null}</button>;
        })}
      </div>
      <FieldRow label="Montant"><Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min={1} /></FieldRow>
      <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
        Frais de service actuels: {business?.transferFeeRate ?? 2}% du montant envoye.
      </div>
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button><Button size="sm" onClick={submit} disabled={submitting || !business || !recipientId || Number(amount) <= 0}>Transferer</Button></div>
    </ModalWrap>
  );
}

export function BuyoutOfferModal({ open, onClose, business, onSubmitted }: { open: boolean; onClose: () => void; business: YouBusiness | null; onSubmitted: () => Promise<void> }) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setAmount('');
      setMessage('');
    }
  }, [open]);

  const submit = async () => {
    if (!business) return;
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.createBuyoutOffer(business.id, { amount: Number(amount), message: message.trim() || undefined }), 'Impossible d envoyer l offre.');
      toast.success('Offre de rachat envoyee');
      await onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title={business ? `Faire une offre · ${business.name}` : 'Faire une offre'} desc="Le montant est debite tout de suite et garde en escrow jusqu a la decision du proprietaire.">
      <FieldRow label="Montant"><Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min={1} placeholder="Montant propose" /></FieldRow>
      <FieldRow label="Message (optionnel)"><Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ex : reprise complete, maintien de l equipe..." /></FieldRow>
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button><Button size="sm" onClick={submit} disabled={submitting || !business || Number(amount) <= 0}>Envoyer l offre</Button></div>
    </ModalWrap>
  );
}

export function ShareholderProposalModal({ open, onClose, business, onSubmitted }: { open: boolean; onClose: () => void; business: YouBusiness | null; onSubmitted: () => Promise<void> }) {
  const [sharePercent, setSharePercent] = useState('10');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSharePercent('10');
      setAmount('');
      setMessage('');
      return;
    }
    const suggested = business?.suggestedShareAmount ?? 0;
    setAmount(suggested > 0 ? String(suggested) : '');
  }, [business?.suggestedShareAmount, open]);

  const numericSharePercent = Math.max(0, Number(sharePercent) || 0);
  const suggestedAmount = business
    ? Math.max(500, Math.round((business.suggestedShareAmount * Math.max(1, numericSharePercent)) / 10))
    : 0;

  const submit = async () => {
    if (!business) return;
    setSubmitting(true);
    try {
      await withRouteError(
        () => youApi.createShareholderProposal(business.id, { sharePercent: numericSharePercent, amount: Number(amount), message: message.trim() || undefined }),
        'Impossible d envoyer la proposition d actionnariat.',
      );
      toast.success('Proposition d actionnariat envoyee');
      await onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title={business ? `Devenir actionnaire · ${business.name}` : 'Devenir actionnaire'} desc="Propose un pourcentage et une somme. Le proprietaire devra accepter pour partager l entreprise.">
      <FieldRow label="Part souhaitee (%)">
        <Input type="number" min={1} max={99} step={0.5} value={sharePercent} onChange={(event) => setSharePercent(event.target.value)} />
      </FieldRow>
      <FieldRow label="Somme proposee">
        <Input type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} />
      </FieldRow>
      <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Montant suggere auto-calcule</span>
          <button type="button" className="font-semibold text-amber-300 transition-opacity hover:opacity-80" onClick={() => setAmount(String(suggestedAmount))}>
            Utiliser {formatMoney(suggestedAmount)}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Ta part</p><p className="text-sm font-bold text-amber-300">{numericSharePercent.toLocaleString('fr-FR')}%</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Owner restant</p><p className="text-sm font-bold">{Math.max(0, 100 - numericSharePercent).toLocaleString('fr-FR')}%</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Base actuelle</p><p className="text-sm font-bold">{formatMoney(business?.treasuryMoney ?? 0)}</p></div>
        </div>
      </div>
      <FieldRow label="Message (optionnel)">
        <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ex : je veux financer votre croissance." />
      </FieldRow>
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button><Button size="sm" onClick={submit} disabled={submitting || !business || numericSharePercent <= 0 || numericSharePercent >= 100 || Number(amount) <= 0}>Envoyer</Button></div>
    </ModalWrap>
  );
}

export function MeetModal({ open, onClose, players, onSubmitted }: { open: boolean; onClose: () => void; players: YouPlayer[]; onSubmitted: () => Promise<void> }) {
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

export function NewRelationModal({ open, onClose, players, onSubmitted }: { open: boolean; onClose: () => void; players: YouPlayer[]; onSubmitted: () => Promise<void> }) {
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [type, setType] = useState<'FRIEND' | 'DATING'>('DATING');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) { setSearch(''); setSelectedUserId(''); setType('DATING'); }
  }, [open]);

  const candidates = useMemo(() => players.filter((player) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return player.username.toLowerCase().includes(q) || player.firstName?.toLowerCase().includes(q) || player.bio?.toLowerCase().includes(q);
  }), [players, search]);

  const submit = async () => {
    if (!selectedUserId) return;
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.createRelationship(selectedUserId, type), 'Impossible de creer la relation.');
      toast.success('Relation creee');
      await onSubmitted();
      onClose();
    } finally { setSubmitting(false); }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title="Ajouter une relation" desc="Choisis un joueur et le type de relation.">
      <FieldRow label="Type">
        <div className="flex gap-2">
          {(['DATING', 'FRIEND'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} className={cn('flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors', type === t ? 'border-foreground bg-muted/20' : 'border-border/40 bg-muted/10 hover:bg-muted/20')}>
              {t === 'DATING' ? 'En relation' : 'Ami(e)'}
            </button>
          ))}
        </div>
      </FieldRow>
      <FieldRow label="Recherche"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pseudo, prenom..." /></FieldRow>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {candidates.map((player) => {
          const sel = player.id === selectedUserId;
          return <button key={player.id} type="button" onClick={() => setSelectedUserId(player.id)} className={cn('flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors', sel ? 'border-foreground bg-muted/20' : 'border-border/40 bg-muted/10 hover:bg-muted/20')}><UserAvatar player={player} className="h-9 w-9" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{player.username}</p><p className="line-clamp-1 text-xs text-muted-foreground">{player.bio?.trim() || 'Aucune bio.'}</p></div>{sel && <Pill label="Selection" color="bg-foreground text-background" />}</button>;
        })}
        {candidates.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aucun joueur disponible.</p>}
      </div>
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button><Button size="sm" onClick={submit} disabled={submitting || !selectedUserId}>Ajouter</Button></div>
    </ModalWrap>
  );
}

export function MarriageModal({ open, onClose, relationships, onSubmitted }: { open: boolean; onClose: () => void; relationships: YouRelationship[]; onSubmitted: () => Promise<void> }) {
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

// Transaction type metadata
const TX_META: Record<string, { icon: typeof TrendingUp; color: string; label: string }> = {
  DEPOSIT: { icon: ArrowDownCircle, color: 'text-emerald-400', label: 'Dépôt' },
  WITHDRAW: { icon: ArrowUpCircle, color: 'text-red-400', label: 'Retrait' },
  BANK_DEPOSIT: { icon: Landmark, color: 'text-emerald-400', label: 'Dépôt client' },
  BANK_WITHDRAW: { icon: Landmark, color: 'text-red-400', label: 'Retrait client' },
  FORMATION_SALE: { icon: GraduationCap, color: 'text-amber-400', label: 'Vente formation' },
  SALARY: { icon: Users, color: 'text-orange-400', label: 'Salaires' },
  SERVICE_FEE: { icon: CreditCard, color: 'text-cyan-400', label: 'Frais de service' },
  LOAN_ISSUE: { icon: CreditCard, color: 'text-amber-400', label: 'Prêt accordé' },
  LOAN_REPAY: { icon: CreditCard, color: 'text-emerald-400', label: 'Remboursement' },
  NPC_COLLECT: { icon: TrendingUp, color: 'text-yellow-400', label: 'Recettes clients' },
  ITEM_SALE: { icon: TrendingUp, color: 'text-lime-400', label: 'Vente article' },
};

function TxRow({ tx }: { tx: YouBusinessTransaction }) {
  const meta = TX_META[tx.type] ?? { icon: TrendingUp, color: 'text-muted-foreground', label: tx.type };
  const Icon = meta.icon;
  const isPositive = tx.amount > 0;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-muted/5 px-4 py-3">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/20')}>
        <Icon className={cn('h-3.5 w-3.5', meta.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">{tx.label}</p>
        <p className="text-[10px] text-muted-foreground">{new Date(tx.createdAt).toLocaleString('fr-FR')}</p>
      </div>
      <p className={cn('shrink-0 text-sm font-bold tabular-nums', isPositive ? 'text-emerald-400' : 'text-red-400')}>
        {isPositive ? '+' : ''}{tx.amount.toLocaleString('fr-FR')} €
      </p>
    </div>
  );
}

// Expandable inline section within ActionCard
function InlineSection({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open) return null;
  return <div className="px-5 pb-4 pt-1">{children}</div>;
}

export function ManageBusinessModal({
  open,
  onClose,
  business,
  players,
  currentUserId,
  onInviteRequested,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness | null;
  players: YouPlayer[];
  currentUserId: string;
  onInviteRequested: (business: YouBusiness) => void;
  onSubmitted: (refreshBalance?: boolean) => Promise<void>;
}) {
  const [activeSection, setActiveSection] = useState<'deposit' | 'withdraw' | 'loanRate' | 'transferFee' | null>(null);
  const [depositAmount, setDepositAmount] = useState('1000');
  const [withdrawAmount, setWithdrawAmount] = useState('1000');
  const [activeTreasuryAction, setActiveTreasuryAction] = useState<'deposit' | 'withdraw' | null>(null);
  const [reviewingLoanId, setReviewingLoanId] = useState<string | null>(null);
  const [repayingLoanId, setRepayingLoanId] = useState<string | null>(null);
  const [reviewingBuyoutId, setReviewingBuyoutId] = useState<string | null>(null);
  const [reviewingShareProposalId, setReviewingShareProposalId] = useState<string | null>(null);
  const [actingProductKey, setActingProductKey] = useState<string | null>(null);
  const [loanRateInput, setLoanRateInput] = useState('4');
  const [transferFeeInput, setTransferFeeInput] = useState('2');
  const [savingBankRate, setSavingBankRate] = useState(false);
  const [savingTransferFee, setSavingTransferFee] = useState(false);
  const [liquidating, setLiquidating] = useState(false);
  const [collectingNpc, setCollectingNpc] = useState(false);
  const [txFilter, setTxFilter] = useState<'all' | 'in' | 'out'>('all');
  const [transactions, setTransactions] = useState<YouBusinessTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [manageTeamOpen, setManageTeamOpen] = useState(false);
  const [manageFormationsOpen, setManageFormationsOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const toggleSection = (s: typeof activeSection) => setActiveSection((prev) => (prev === s ? null : s));

  useEffect(() => {
    if (open) {
      setActiveSection(null);
      setDepositAmount('1000');
      setWithdrawAmount('1000');
      setActiveTreasuryAction(null);
      setReviewingLoanId(null);
      setRepayingLoanId(null);
      setReviewingBuyoutId(null);
      setActingProductKey(null);
      setLoanRateInput(String(business?.loanInterestRate ?? 4));
      setTransferFeeInput(String(business?.transferFeeRate ?? 2));
      setTransactions([]);
      setTransferOpen(false);
    }
  }, [open, business?.id]);

  // Load transactions when modal opens
  useEffect(() => {
    if (!open || !business || business.ownerKind !== 'you') return;
    let cancelled = false;
    setLoadingTx(true);
    youApi.getBusinessTransactions(business.id)
      .then((res) => { if (!cancelled) setTransactions(res.data.transactions); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingTx(false); });
    return () => { cancelled = true; };
  }, [open, business?.id]);

  const pendingLoans = business?.recentLoans.filter((loan) => loan.status === 'PENDING') ?? [];
  const activeLoans = business?.recentLoans.filter((loan) => loan.status === 'ACTIVE') ?? [];
  const pendingBuyoutOffers = business?.pendingBuyoutOffers.filter((offer) => offer.status === 'PENDING') ?? [];
  const pendingShareholderProposals = business?.pendingShareholderProposals.filter((proposal) => proposal.status === 'PENDING') ?? [];
  const isBank = business?.typeKey === 'bank';
  const isStartup = business?.typeKey === 'startup';
  const isTransfer = business?.typeKey === 'transfer';
  const isFormation = business?.typeKey === 'formation';
  const isNpcCommerce = business?.typeKey === 'lemonade' || business?.typeKey === 'epicerie';
  const npcCooldownHours = isNpcCommerce ? (business?.typeKey === 'lemonade' ? 6 : 6) : 0;
  const npcOnCooldown = Boolean(business?.npcLastCollectedAt && (Date.now() - new Date(business.npcLastCollectedAt).getTime()) < npcCooldownHours * 3600 * 1000);
  const businessIconTypeKey = business?.typeKey as keyof typeof BUSINESS_ICON_MAP | undefined;
  const BusinessIcon = businessIconTypeKey ? (BUSINESS_ICON_MAP[businessIconTypeKey] ?? Building2) : Building2;
  const businessIconStyle = businessIconTypeKey
    ? (BUSINESS_STYLE_MAP[businessIconTypeKey] ?? { iconWrap: 'bg-muted/20', icon: 'text-foreground' })
    : { iconWrap: 'bg-muted/20', icon: 'text-foreground' };

  const filteredTx = transactions.filter((tx) => {
    if (txFilter === 'in') return tx.amount > 0;
    if (txFilter === 'out') return tx.amount < 0;
    return true;
  });

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

  const reviewBuyout = async (offerId: string, decision: 'accept' | 'reject') => {
    setReviewingBuyoutId(offerId);
    try {
      await withRouteError(() => youApi.respondToBuyoutOffer(offerId, decision), 'Impossible de traiter cette offre de rachat.');
      toast.success(decision === 'accept' ? 'Offre de rachat acceptee' : 'Offre de rachat refusee');
      await onSubmitted(true);
      if (decision === 'accept') {
        onClose();
      }
    } finally {
      setReviewingBuyoutId(null);
    }
  };

  const reviewShareholderProposal = async (proposalId: string, decision: 'accept' | 'reject') => {
    setReviewingShareProposalId(proposalId);
    try {
      await withRouteError(() => youApi.respondToShareholderProposal(proposalId, decision), 'Impossible de traiter cette proposition d actionnariat.');
      toast.success(decision === 'accept' ? 'Actionnaire ajoute' : 'Proposition refusee');
      await onSubmitted(true);
    } finally {
      setReviewingShareProposalId(null);
    }
  };

  const saveLoanRate = async () => {
    if (!business) return;
    setSavingBankRate(true);
    try {
      await withRouteError(() => youApi.setLoanRate(business.id, Number(loanRateInput)), 'Impossible de modifier le taux.');
      toast.success('Taux d\'emprunt mis à jour');
      await onSubmitted(true);
      setActiveSection(null);
    } finally {
      setSavingBankRate(false);
    }
  };

  const saveTransferFee = async () => {
    if (!business) return;
    setSavingTransferFee(true);
    try {
      await withRouteError(() => youApi.setTransferFeeRate(business.id, Number(transferFeeInput)), 'Impossible de modifier les frais.');
      toast.success('Frais de transfert mis à jour');
      await onSubmitted(true);
      setActiveSection(null);
    } finally {
      setSavingTransferFee(false);
    }
  };

  const buyLivret = async () => {
    if (!business) return;
    try {
      await withRouteError(() => youApi.buyLivretEpargneUpgrade(business.id), "Impossible d'acheter cet upgrade.");
      toast.success('Livret Epargne active');
      await onSubmitted(true);
    } catch {
      // error already toasted by withRouteError
    }
  };

  const startResearch = async (product: YouStartupProduct) => {
    if (!business) return;
    setActingProductKey(`research:${product.slotIndex}`);
    try {
      await withRouteError(() => youApi.runBusinessAction(business.id, 'start_research', { slotIndex: product.slotIndex }), 'Impossible de lancer la recherche.');
      toast.success(`Recherche lancee pour ${product.name}`);
      await onSubmitted(true);
    } finally {
      setActingProductKey(null);
    }
  };

  const deployProduct = async (product: YouStartupProduct) => {
    if (!business) return;
    setActingProductKey(`deploy:${product.slotIndex}`);
    try {
      await withRouteError(() => youApi.runBusinessAction(business.id, 'deploy_product', { slotIndex: product.slotIndex }), 'Impossible de deployer ce produit.');
      toast.success(`${product.name} deploye`);
      await onSubmitted(true);
    } finally {
      setActingProductKey(null);
    }
  };

  const collectNpc = async () => {
    if (!business) return;
    setCollectingNpc(true);
    try {
      const res = await withRouteError(() => youApi.collectNpc(business.id), 'Impossible de collecter les recettes.');
      toast.success(`+${(res as any)?.data?.result?.amount?.toLocaleString('fr-FR') ?? '?'} money collectes`);
      await onSubmitted(true);
    } finally {
      setCollectingNpc(false);
    }
  };

  const repayLoanNow = async (loanId: string) => {
    setRepayingLoanId(loanId);
    try {
      await withRouteError(() => youApi.repayLoan(loanId), 'Impossible de saisir l hypotheque.');
      toast.success('Hypotheque saisie');
      await onSubmitted(true);
    } finally {
      setRepayingLoanId(null);
    }
  };

  const liquidateBusiness = async () => {
    if (!business) return;
    const confirmed = window.confirm(`Liquider ${business.name} ? Cette action est irreversible.`);
    if (!confirmed) return;

    setLiquidating(true);
    try {
      await withRouteError(() => youApi.deleteBusiness(business.id), 'Impossible de liquider ce business.');
      toast.success('Business liquide');
      onClose();
      await onSubmitted();
    } finally {
      setLiquidating(false);
    }
  };

  return (
    <>
    <ModalWrap
      open={open}
      onClose={onClose}
      title={business ? <span className="inline-flex items-center justify-center gap-2"><span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', businessIconStyle.iconWrap)}><BusinessIcon className={cn('h-4 w-4', businessIconStyle.icon)} /></span><span>{business.name}</span></span> : 'Entreprise'}
      desc="Gestion de ta structure."
      wide
      centerTitle
    >
      {business ? (
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* LEFT: Actions — all consistent ActionRow height */}
          <div className="space-y-3">
            <ActionCard>
              {/* Deposit */}
              {business.actions.includes('deposit') ? (
                <>
                  <ActionRow
                    icon={ArrowDownCircle}
                    label="Déposer"
                    sub="Injecter du money dans la trésorerie"
                    iconBg="bg-emerald-400/15"
                    iconColor="text-emerald-400"
                    onClick={() => toggleSection('deposit')}
                  />
                  <InlineSection open={activeSection === 'deposit'}>
                    <div className="flex gap-2">
                      <Input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} min={1} placeholder="Montant" />
                      <Button size="sm" onClick={() => void runTreasuryAction('deposit', depositAmount)} disabled={activeTreasuryAction !== null || Number(depositAmount) <= 0}>Déposer</Button>
                    </div>
                  </InlineSection>
                </>
              ) : null}

              {/* Withdraw */}
              {business.actions.includes('withdraw') ? (
                <>
                  <ActionRow
                    icon={ArrowUpCircle}
                    label="Retirer"
                    sub="Récupérer du money vers ton solde"
                    iconBg="bg-red-400/15"
                    iconColor="text-red-400"
                    onClick={() => toggleSection('withdraw')}
                  />
                  <InlineSection open={activeSection === 'withdraw'}>
                    <div className="flex gap-2">
                      <Input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} min={1} placeholder="Montant" />
                      <Button size="sm" variant="outline" onClick={() => void runTreasuryAction('withdraw', withdrawAmount)} disabled={activeTreasuryAction !== null || Number(withdrawAmount) <= 0}>Retirer</Button>
                    </div>
                  </InlineSection>
                </>
              ) : null}

              {/* Collecter les recettes (lemonade/epicerie) */}
              {isNpcCommerce && business.ownerKind === 'you' ? (
                <ActionRow
                  icon={Wallet}
                  label={npcOnCooldown ? 'Collecter les recettes (cooldown)' : 'Collecter les recettes'}
                  sub={npcOnCooldown ? 'Disponible dans quelques heures' : 'Ajoute les recettes clients a la tresorerie'}
                  iconBg="bg-yellow-400/15"
                  iconColor="text-yellow-400"
                  onClick={() => { if (!npcOnCooldown && !collectingNpc) void collectNpc(); }}
                />
              ) : null}

              {/* Gérer l'équipe */}
              {business.ownerKind === 'you' ? (
                <ActionRow icon={Users} label="Gérer l'équipe" sub="Salaires, invitations et départs" iconBg="bg-violet-400/15" iconColor="text-violet-400" onClick={() => setManageTeamOpen(true)} />
              ) : null}

              {/* Modifier le profil */}
              {business.ownerKind === 'you' ? (
                <ActionRow icon={Edit2} label="Modifier le profil" sub="Nom, description et logo" iconBg="bg-sky-400/15" iconColor="text-sky-400" onClick={() => setEditProfileOpen(true)} />
              ) : null}

              {/* Settings section */}
              {(isBank || isTransfer || isFormation) ? (
                <>
                  <div className="mx-5 border-t border-border/20" />

                  {/* Bank: taux d'emprunt */}
                  {isBank ? (
                    <>
                      <ActionRow
                        icon={Percent}
                        label={`Taux d'emprunt · ${business.loanInterestRate ?? 4} %`}
                        sub="Applicable aux nouveaux prêts accordés"
                        iconBg="bg-amber-400/15"
                        iconColor="text-amber-400"
                        onClick={() => toggleSection('loanRate')}
                      />
                      <InlineSection open={activeSection === 'loanRate'}>
                        <div className="flex gap-2">
                          <Input type="number" min={1} max={50} step={0.5} value={loanRateInput} onChange={(e) => setLoanRateInput(e.target.value)} />
                          <Button size="sm" variant="outline" onClick={() => void saveLoanRate()} disabled={savingBankRate || Number(loanRateInput) < 1 || Number(loanRateInput) > 50}>Modifier</Button>
                        </div>
                      </InlineSection>
                    </>
                  ) : null}

                  {/* Bank: livret épargne */}
                  {isBank ? (
                    <ActionRow
                      icon={Sparkles}
                      label={business.livretEpargneUnlocked ? 'Livret Épargne · Actif' : 'Livret Épargne · Débloquer'}
                      sub={business.livretEpargneUnlocked ? '+0,5 % / jour pour les clients' : `Coût : ${formatMoney(5000)} · Passe de 0,2 % à 0,5 % / jour`}
                      iconBg="bg-amber-400/15"
                      iconColor="text-amber-400"
                      onClick={() => { if (!business.livretEpargneUnlocked) void buyLivret(); }}
                    />
                  ) : null}

                  {/* Transfer: frais */}
                  {isTransfer ? (
                    <>
                      {business.ownerKind === 'you' ? (
                        <ActionRow
                          icon={ArrowUpCircle}
                          label="Envoyer via ma plateforme"
                          sub="Utiliser ce service de transfert pour envoyer de l'argent"
                          iconBg="bg-cyan-400/15"
                          iconColor="text-cyan-400"
                          onClick={() => setTransferOpen(true)}
                        />
                      ) : null}
                      <ActionRow
                        icon={Percent}
                        label={`Frais de transfert · ${business.transferFeeRate ?? 2} %`}
                        sub="Prélevés sur chaque transfert entre joueurs"
                        iconBg="bg-cyan-400/15"
                        iconColor="text-cyan-400"
                        onClick={() => toggleSection('transferFee')}
                      />
                      <InlineSection open={activeSection === 'transferFee'}>
                        <div className="flex gap-2">
                          <Input type="number" min={0} max={25} step={0.25} value={transferFeeInput} onChange={(e) => setTransferFeeInput(e.target.value)} />
                          <Button size="sm" variant="outline" onClick={() => void saveTransferFee()} disabled={savingTransferFee || Number(transferFeeInput) < 0 || Number(transferFeeInput) > 25}>Modifier</Button>
                        </div>
                      </InlineSection>
                    </>
                  ) : null}

                  {/* Formation: manage products */}
                  {isFormation ? (
                    <ActionRow
                      icon={GraduationCap}
                      label="Gérer les formations"
                      sub={`${business.formationProducts?.length ?? 0} formation(s) en ligne`}
                      iconBg="bg-amber-400/15"
                      iconColor="text-amber-400"
                      onClick={() => setManageFormationsOpen(true)}
                    />
                  ) : null}
                </>
              ) : null}

              {/* Startup products */}
              {isStartup ? (
                <>
                  <div className="mx-5 border-t border-border/20" />
                  {business.startupProducts.map((product) => {
                    const isClickable = product.canDeploy || product.canStartResearch;
                    const isBusy = actingProductKey !== null;
                    const statusLabel = product.isResearchActive
                      ? `Recherche niv. ${product.activeResearchLevel} · ${product.progressPercent}%`
                      : product.canDeploy
                        ? `Prêt à déployer · niv. ${product.activeResearchLevel}`
                        : product.isMaxLevel
                          ? 'Niveau maximum atteint'
                          : `Lancer recherche niv. ${product.deployedLevel + 1} · ${product.nextResearchDurationMinutes ? formatDurationMinutes(product.nextResearchDurationMinutes) : '–'}`;
                    const handleClick = () => {
                      if (isBusy) return;
                      if (product.canDeploy) { void deployProduct(product); return; }
                      if (product.canStartResearch) { void startResearch(product); }
                    };
                    return (
                      <div key={product.id} className={cn('transition-colors', isBusy && actingProductKey !== `research:${product.slotIndex}` && actingProductKey !== `deploy:${product.slotIndex}` ? 'pointer-events-none opacity-60' : '')}>
                        <button
                          type="button"
                          disabled={!isClickable || isBusy}
                          onClick={handleClick}
                          className={cn(
                            'group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors',
                            isClickable ? 'hover:bg-sky-400/5' : 'cursor-default',
                          )}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-400/15">
                            <TrendingUp className="h-4 w-4 text-sky-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">{product.name}</p>
                              <span className="shrink-0 text-xs font-semibold text-sky-300">+{product.currentRevenue.toLocaleString('fr-FR')} €</span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{statusLabel}</p>
                            {(product.isResearchActive || product.canDeploy) && (
                              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted/40">
                                <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${product.progressPercent}%` }} />
                              </div>
                            )}
                          </div>
                          {isClickable ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" /> : null}
                        </button>
                      </div>
                    );
                  })}
                </>
              ) : null}

              {/* Liquidate — always last */}
              {business.ownerKind === 'you' ? (
                <>
                  <div className="mx-5 border-t border-border/20" />
                  <ActionRow
                    icon={Trash2}
                    label={liquidating ? 'Liquidation en cours…' : 'Liquider l\'entreprise'}
                    sub="Action irréversible — la structure sera supprimée."
                    iconBg="bg-red-400/15"
                    iconColor="text-red-400"
                    onClick={() => { if (!liquidating) void liquidateBusiness(); }}
                  />
                </>
              ) : null}
            </ActionCard>
          </div>

          {/* RIGHT: Treasury + Log */}
          <div className="space-y-4">
            {/* Trésorerie */}
            <Card>
              <CardContent className="space-y-4 px-5 py-4">
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-6 text-center">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/70">Trésorerie</p>
                  <p className="mt-2 text-5xl font-semibold tabular-nums text-emerald-200">{business.treasuryMoney.toLocaleString('fr-FR')} €</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Membres', value: String(business.memberCount) },
                    { label: 'Revenu mensuel', value: `+${business.monthlyRevenue.toLocaleString('fr-FR')} €` },
                  ].map((entry) => (
                    <div key={entry.label} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{entry.label}</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">{entry.value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Capital partage</p>
                      <p className="mt-1 text-sm font-semibold">{business.isShared ? 'Entreprise partagee' : 'Fondateur seul'}</p>
                    </div>
                    <Pill label={`${business.ownerSharePercent.toFixed(0)}% fondateur`} color="bg-amber-400/15 text-amber-300" />
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2 text-sm">
                      <span>{business.owner.username}</span>
                      <span className="font-semibold">{business.ownerSharePercent.toFixed(2)}%</span>
                    </div>
                    {business.shareholders.map((shareholder) => (
                      <div key={shareholder.id} className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2 text-sm">
                        <span>{shareholder.user.username}</span>
                        <span className="font-semibold">{shareholder.sharePercent.toFixed(2)}%</span>
                      </div>
                    ))}
                    {business.shareholders.length === 0 ? <p className="text-xs text-muted-foreground">Aucun actionnaire externe pour l instant.</p> : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active loans — shown at top, above tx log (bank only) */}
            {isBank && activeLoans.length > 0 ? (
              <Card>
                <CardContent className="space-y-3 px-5 py-4">
                  <SectionTitle>Prêts actifs ({activeLoans.length})</SectionTitle>
                  {activeLoans.map((loan) => {
                    const totalOwed = Math.round(loan.amount * (1 + loan.interestRate / 100));
                    const repaid = loan.repaidAmount ?? 0;
                    const remaining = Math.max(0, totalOwed - repaid);
                    const pct = totalOwed > 0 ? Math.round((repaid / totalOwed) * 100) : 0;
                    const dueDate = getLoanDueDate(loan);
                    const isPastDue = new Date() >= dueDate;
                    const canClaimCollateral = isPastDue && loan.collateralAuraHeld > 0;
                    return (
                      <div key={loan.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{loan.borrower.username}</p>
                            <p className="text-xs text-muted-foreground">{loan.amount.toLocaleString('fr-FR')} € principal · {loan.interestRate} % · {loan.termDays} jours</p>
                            <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                              <div className="rounded-lg bg-background/50 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Reste du</p>
                                <p className="mt-1 text-sm font-semibold text-foreground">{remaining.toLocaleString('fr-FR')} €</p>
                              </div>
                              <div className="rounded-lg bg-background/50 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Echeance</p>
                                <p className={`mt-1 text-sm font-semibold ${isPastDue ? 'text-rose-400' : 'text-foreground'}`}>{formatLoanDate(dueDate)}</p>
                              </div>
                              <div className="rounded-lg bg-background/50 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Temps restant</p>
                                <p className={`mt-1 text-sm font-semibold ${isPastDue ? 'text-rose-400' : 'text-foreground'}`}>{getLoanTimeLeftLabel(loan)}</p>
                              </div>
                              <div className="rounded-lg bg-background/50 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Accorde le</p>
                                <p className="mt-1 text-sm font-semibold text-foreground">{formatLoanDate(loan.decidedAt ?? loan.createdAt)}</p>
                              </div>
                            </div>
                            {loan.collateralAuraHeld > 0 ? (
                              <p className="mt-2 text-xs text-amber-400">{loan.collateralAuraHeld.toLocaleString('fr-FR')} aura bloquees en hypothèque</p>
                            ) : null}
                            {loan.motivationMessage ? <p className="mt-2 text-xs text-muted-foreground">Motivation: "{loan.motivationMessage}"</p> : null}
                            <p className="mt-2 text-xs text-muted-foreground">{repaid.toLocaleString('fr-FR')} / {totalOwed.toLocaleString('fr-FR')} € rembourses</p>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                              <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          {canClaimCollateral ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0 text-xs border-rose-400/40 text-rose-400 hover:bg-rose-400/10"
                              onClick={() => void repayLoanNow(loan.id)}
                              disabled={repayingLoanId !== null}
                            >
                              Saisir l'hypothèque
                            </Button>
                          ) : isPastDue ? (
                            <p className="shrink-0 text-xs text-rose-400/70">En defaut · pas d'hypothèque</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ) : null}

            {/* Transaction log */}
            <Card>
              <CardContent className="space-y-3 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <SectionTitle>Mouvements de trésorerie</SectionTitle>
                  <select
                    value={txFilter}
                    onChange={(e) => setTxFilter(e.target.value as typeof txFilter)}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none"
                  >
                    <option value="all">Tous</option>
                    <option value="in">Entrées</option>
                    <option value="out">Sorties</option>
                  </select>
                </div>
                {loadingTx ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">Chargement…</p>
                ) : filteredTx.length === 0 ? (
                  <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                    Aucun mouvement enregistré.
                  </div>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {filteredTx.map((tx) => <TxRow key={tx.id} tx={tx} />)}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending loans (bank only) */}
            {isBank && pendingLoans.length > 0 ? (
              <Card>
                <CardContent className="space-y-3 px-5 py-4">
                  <SectionTitle>Demandes de prêt ({pendingLoans.length})</SectionTitle>
                  {pendingLoans.map((loan) => (
                    <div key={loan.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold">{loan.borrower.username}</p>
                          <p className="text-xs text-muted-foreground">{loan.amount.toLocaleString('fr-FR')} € · {loan.termDays} jours · {loan.interestRate} % d'intérêt{loan.collateralAura > 0 ? ` · ${loan.collateralAura.toLocaleString('fr-FR')} aura en hypothèque` : ''}</p>
                          {loan.motivationMessage ? <p className="mt-1 text-xs text-muted-foreground/80">Motivation: "{loan.motivationMessage}"</p> : null}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="text-xs" onClick={() => void reviewLoan(loan.id, 'accept')} disabled={reviewingLoanId !== null}><Check className="mr-1.5 h-3.5 w-3.5" />Accepter</Button>
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => void reviewLoan(loan.id, 'reject')} disabled={reviewingLoanId !== null}><X className="mr-1.5 h-3.5 w-3.5" />Refuser</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {/* Pending buyout offers */}
            {pendingBuyoutOffers.length > 0 ? (
              <Card>
                <CardContent className="space-y-3 px-5 py-4">
                  <SectionTitle>Offres de rachat ({pendingBuyoutOffers.length})</SectionTitle>
                  {pendingBuyoutOffers.map((offer) => (
                    <div key={offer.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold">{offer.bidder.username}</p>
                          <p className="text-xs text-muted-foreground">{offer.amount.toLocaleString('fr-FR')} € en escrow</p>
                          {offer.message ? <p className="mt-0.5 text-xs text-muted-foreground/70">"{offer.message}"</p> : null}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="text-xs" onClick={() => void reviewBuyout(offer.id, 'accept')} disabled={reviewingBuyoutId !== null}><Check className="mr-1.5 h-3.5 w-3.5" />Accepter</Button>
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => void reviewBuyout(offer.id, 'reject')} disabled={reviewingBuyoutId !== null}><X className="mr-1.5 h-3.5 w-3.5" />Refuser</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {pendingShareholderProposals.length > 0 ? (
              <Card>
                <CardContent className="space-y-3 px-5 py-4">
                  <SectionTitle>Propositions actionnaires ({pendingShareholderProposals.length})</SectionTitle>
                  {pendingShareholderProposals.map((proposal) => (
                    <div key={proposal.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold">{proposal.investor.username}</p>
                          <p className="text-xs text-muted-foreground">{proposal.sharePercent.toLocaleString('fr-FR')}% contre {proposal.amount.toLocaleString('fr-FR')} €</p>
                          <p className="mt-0.5 text-xs text-muted-foreground/70">Suggestion systeme: {proposal.suggestedAmount.toLocaleString('fr-FR')} €</p>
                          {proposal.message ? <p className="mt-1 text-xs text-muted-foreground/70">"{proposal.message}"</p> : null}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="text-xs" onClick={() => void reviewShareholderProposal(proposal.id, 'accept')} disabled={reviewingShareProposalId !== null}><Check className="mr-1.5 h-3.5 w-3.5" />Accepter</Button>
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => void reviewShareholderProposal(proposal.id, 'reject')} disabled={reviewingShareProposalId !== null}><X className="mr-1.5 h-3.5 w-3.5" />Refuser</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}
    </ModalWrap>

    {business ? (
      <ManageTeamModal
        open={manageTeamOpen}
        onClose={() => setManageTeamOpen(false)}
        business={business}
        onInviteRequested={() => { setManageTeamOpen(false); onClose(); onInviteRequested(business); }}
        onSubmitted={onSubmitted}
      />
    ) : null}
    {business ? (
      <ManageFormationsModal
        open={manageFormationsOpen}
        onClose={() => setManageFormationsOpen(false)}
        business={business}
        onSubmitted={onSubmitted}
      />
    ) : null}
    {business ? (
      <BusinessProfileModal
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        business={business}
        onSubmitted={onSubmitted}
      />
    ) : null}
    {business ? (
      <TransferBusinessModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        business={business}
        players={players}
        currentUserId={currentUserId}
        onSubmitted={() => onSubmitted(true)}
      />
    ) : null}
    </>
  );
}

// --- ManageTeamModal ---

export function ManageTeamModal({
  open,
  onClose,
  business,
  onInviteRequested,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness;
  onInviteRequested: () => void;
  onSubmitted: (refreshBalance?: boolean) => Promise<void>;
}) {
  const [sackingId, setSackingId] = useState<string | null>(null);
  const [reviewingInvitationId, setReviewingInvitationId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<typeof business.members[number] | null>(null);

  useEffect(() => {
    if (!open) setEditingMember(null);
  }, [open]);

  const sack = async (memberId: string) => {
    if (!window.confirm('Renvoyer cet employé ? Il perdra l\'accès à l\'entreprise.')) return;
    setSackingId(memberId);
    try {
      await withRouteError(() => youApi.sackMember(business.id, memberId), 'Impossible de renvoyer ce membre.');
      toast.success('Membre renvoyé');
      await onSubmitted();
    } finally {
      setSackingId(null);
    }
  };

  const reviewInvitation = async (invitationId: string, decision: 'accept' | 'reject') => {
    setReviewingInvitationId(invitationId);
    try {
      await withRouteError(() => youApi.respondToBusinessInvitation(invitationId, decision), 'Impossible de traiter ce contrat.');
      toast.success(decision === 'accept' ? 'Contrat mis à jour' : 'Contrat refusé');
      await onSubmitted();
    } finally {
      setReviewingInvitationId(null);
    }
  };

  const activeMembers = business.members.filter((m) => m.status === 'ACTIVE');
  const pendingInvitations = business.pendingInvitations;
  const isLawFirm = business.typeKey === 'law_firm';

  return (
    <>
      <ModalWrap open={open} onClose={onClose} title="Gérer l'équipe" desc={`${activeMembers.length} membre(s) actif(s)`}>
        <Button size="sm" variant="outline" className="w-full justify-start" onClick={onInviteRequested}>
          <UserPlus className="mr-2 h-4 w-4" />Inviter des joueurs
        </Button>

        {pendingInvitations.length > 0 ? (
          <div className="space-y-2">
            <SectionTitle>Contrats en attente ({pendingInvitations.length})</SectionTitle>
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {pendingInvitations.map((invitation) => (
                <div key={invitation.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{invitation.employee.username}</p>
                        <Pill label={invitation.initiatedByRole === 'EMPLOYER' ? 'Offre envoyée' : 'Candidature'} color="bg-violet-400/15 text-violet-300" />
                        <Pill label={`${invitation.salary.toLocaleString('fr-FR')} €/j`} color="bg-emerald-400/15 text-emerald-300" />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Rôle : {{ OWNER: 'Propriétaire', MANAGER: 'Manager', EMPLOYEE: 'Employé' }[invitation.role] ?? invitation.role}</p>
                      {invitation.message ? <p className="mt-1 text-xs text-muted-foreground/80">"{invitation.message}"</p> : null}
                      {!invitation.needsViewerAcceptance ? (
                        <p className="mt-1 text-xs text-muted-foreground/70">En attente de validation par {invitation.waitingOn === 'EMPLOYEE' ? "l'employé" : invitation.waitingOn === 'EMPLOYER' ? "l'employeur" : "les deux parties"}.</p>
                      ) : null}
                    </div>
                    {invitation.needsViewerAcceptance ? (
                      <div className="flex gap-2">
                        <Button size="sm" className="h-8 text-xs" onClick={() => void reviewInvitation(invitation.id, 'accept')} disabled={reviewingInvitationId !== null}>Accepter</Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void reviewInvitation(invitation.id, 'reject')} disabled={reviewingInvitationId !== null}>Refuser</Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeMembers.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
            Aucun membre dans cette équipe.
          </div>
        ) : (
          <div className="space-y-2">
            <SectionTitle>Membres actifs</SectionTitle>
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {activeMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                  <UserAvatar player={member.user} className="h-8 w-8 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium">{member.user.username}</p>
                      <Pill label={{ OWNER: 'Propriétaire', MANAGER: 'Manager', EMPLOYEE: 'Employé' }[member.role] ?? member.role} color="bg-violet-400/15 text-violet-400" />
                      {isLawFirm && member.isPrimaryLawyer ? <Pill label="Principal" color="bg-amber-400/15 text-amber-300" /> : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {(member.salary ?? 0).toLocaleString('fr-FR')} €/jour
                      {member.specialty ? ` · ${member.specialty}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setEditingMember(member)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-red-400/30 text-red-300 hover:bg-red-500/10" onClick={() => void sack(member.id)} disabled={sackingId !== null}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ModalWrap>

      <MemberEditModal
        open={editingMember !== null}
        onClose={() => setEditingMember(null)}
        business={business}
        member={editingMember}
        onSubmitted={async () => { await onSubmitted(); }}
      />
    </>
  );
}

// --- MemberEditModal ---

export function MemberEditModal({
  open,
  onClose,
  business,
  member,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness;
  member: YouBusiness['members'][number] | null;
  onSubmitted: () => Promise<void>;
}) {
  const [salary, setSalary] = useState('0');
  const [title, setTitle] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);

  const isLawFirm = business.typeKey === 'law_firm';

  useEffect(() => {
    if (member) {
      setSalary(String(member.salary ?? 0));
      setTitle(isLawFirm ? '' : (member.specialty ?? ''));
      setSpecialty(isLawFirm ? (member.specialty ?? '') : '');
      setDisplayOrder(String(member.displayOrder ?? 0));
      setIsPrimary(Boolean(member.isPrimaryLawyer));
    }
  }, [member, isLawFirm]);

  const save = async () => {
    if (!member) return;
    setSaving(true);
    try {
      const salaryVal = Math.max(0, Math.floor(Number(salary) || 0));
      await withRouteError(
        () => youApi.updateMemberSalary(business.id, member.id, salaryVal),
        'Impossible de modifier le salaire.',
      );
      if (isLawFirm) {
        await withRouteError(
          () => youApi.updateLawFirmMemberMetadata(business.id, member.id, {
            specialty: specialty.trim() || null,
            isPrimaryLawyer: isPrimary,
            displayOrder: Math.max(0, Math.floor(Number(displayOrder) || 0)),
          }),
          'Impossible de modifier le profil avocat.',
        );
      } else {
        await withRouteError(
          () => youApi.updateMemberProfile(business.id, member.id, title.trim() || null),
          'Impossible de modifier le titre.',
        );
      }
      toast.success('Profil mis à jour');
      await onSubmitted();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!member) return null;

  const roleLabel = ({ OWNER: 'Propriétaire', MANAGER: 'Manager', EMPLOYEE: 'Employé' } as Record<string, string>)[member.role] ?? member.role;

  return (
    <ModalWrap open={open} onClose={onClose} title={member.user.username} desc={`${roleLabel} · ${business.name}`}>
      <div className="flex items-center gap-4 rounded-xl border border-border/40 bg-muted/10 px-4 py-4">
        <UserAvatar player={member.user} className="h-12 w-12 shrink-0" />
        <div>
          <p className="font-semibold">{member.user.username}</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
          {member.specialty ? <p className="text-xs text-muted-foreground">{member.specialty}</p> : null}
        </div>
      </div>

      {/* Salary */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Salaire quotidien</p>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={0}
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            className="h-10 w-36 text-sm"
            placeholder="0"
          />
          <span className="text-sm text-muted-foreground">€ / jour</span>
        </div>
        <p className="text-[11px] text-muted-foreground/60">Débité quotidiennement depuis la trésorerie.</p>
      </div>

      {/* Title (non-law-firm) */}
      {!isLawFirm ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Titre / Poste</p>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 text-sm"
            placeholder="ex: Caissier principal, Responsable logistique…"
            maxLength={60}
          />
          <p className="text-[11px] text-muted-foreground/60">Affiché sur la fiche publique de l'entreprise.</p>
        </div>
      ) : null}

      {/* Law firm profile */}
      {isLawFirm ? (
        <div className="space-y-4 rounded-xl border border-indigo-400/20 bg-indigo-400/5 px-4 py-4">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-indigo-300" />
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Profil avocat</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Spécialité</p>
            <Input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="h-10 text-sm"
              placeholder="ex: Droit pénal, Droit des affaires…"
              maxLength={60}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Ordre d'affichage</p>
            <Input
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              className="h-10 w-28 text-sm"
              placeholder="0"
            />
            <p className="text-[11px] text-muted-foreground/60">Les avocats sont triés par ordre croissant, puis alphabétiquement.</p>
          </div>
          <label className="flex cursor-pointer select-none items-center gap-3 rounded-xl border border-border/40 bg-background/40 px-4 py-3">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <div>
              <p className="text-sm font-medium text-amber-300">Avocat principal</p>
              <p className="text-[11px] text-muted-foreground/70">Mis en avant sur la fiche publique du cabinet.</p>
            </div>
          </label>
        </div>
      ) : null}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Annuler</Button>
        <Button className="flex-1" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Sauvegarder
        </Button>
      </div>
    </ModalWrap>
  );
}

// --- TeamRosterModal (public read-only team view) ---

export function TeamRosterModal({
  open,
  onClose,
  business,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness | null;
}) {
  if (!business) return null;
  const isLawFirm = business.typeKey === 'law_firm';
  const members = [
    {
      user: business.owner,
      role: 'OWNER',
      specialty: isLawFirm ? 'Associé gérant' : null,
      isPrimaryLawyer: false,
      displayOrder: -1,
      salary: null as number | null,
    },
    ...business.members
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => ({ ...m, salary: m.salary ?? null })),
  ].sort((a, b) =>
    Number(Boolean((b as any).isPrimaryLawyer)) - Number(Boolean((a as any).isPrimaryLawyer)) ||
    ((a as any).displayOrder ?? 0) - ((b as any).displayOrder ?? 0) ||
    a.user.username.localeCompare(b.user.username),
  );

  const roleLabel = (role: string) => ({ OWNER: 'Propriétaire', MANAGER: 'Manager', EMPLOYEE: 'Employé' }[role] ?? role);

  return (
    <ModalWrap open={open} onClose={onClose} title={`Équipe · ${business.name}`} desc={`${members.length} membre(s)`}>
      {members.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
          Aucun membre pour le moment.
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={`${m.user.id}-${i}`} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
              <UserAvatar player={m.user} className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-semibold">{m.user.username}</p>
                  <Pill label={roleLabel(m.role)} color="bg-violet-400/15 text-violet-400" />
                  {isLawFirm && (m as any).isPrimaryLawyer ? <Pill label="Principal" color="bg-amber-400/15 text-amber-300" /> : null}
                </div>
                {m.specialty ? <p className="mt-0.5 text-xs text-muted-foreground">{m.specialty}</p> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalWrap>
  );
}

// --- BankAccountModal ---

export function BankAccountModal({
  open,
  onClose,
  business,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness | null;
  onSubmitted: () => Promise<void>;
}) {
  const [accounts, setAccounts] = useState<YouBankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [action, setAction] = useState<'deposit' | 'withdraw' | null>(null);
  const [amount, setAmount] = useState('500');
  const [acting, setActing] = useState(false);

  const loadAccounts = async () => {
    if (!business) return;
    setLoading(true);
    try {
      const res = await youApi.getBankAccounts(business.id);
      setAccounts(res.data.accounts);
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && business) { void loadAccounts(); }
    if (!open) { setAccounts([]); setActiveAccountId(null); setAction(null); setAmount('500'); }
  }, [open, business?.id]);

  const openAccount = async (accountType: 'COURANT' | 'EPARGNE') => {
    if (!business) return;
    setOpening(true);
    try {
      await withRouteError(() => youApi.openBankAccount(business.id, accountType), 'Impossible d\'ouvrir ce compte.');
      toast.success('Compte ouvert');
      await loadAccounts();
      await onSubmitted();
    } finally {
      setOpening(false);
    }
  };

  const doAction = async () => {
    if (!activeAccountId || !action) return;
    setActing(true);
    try {
      if (action === 'deposit') {
        await withRouteError(() => youApi.bankAccountDeposit(activeAccountId, Number(amount)), 'Impossible de déposer.');
        toast.success('Dépôt effectué');
      } else {
        await withRouteError(() => youApi.bankAccountWithdraw(activeAccountId, Number(amount)), 'Impossible de retirer.');
        toast.success('Retrait effectué');
      }
      await loadAccounts();
      await onSubmitted();
      setAction(null);
      setAmount('500');
    } finally {
      setActing(false);
    }
  };

  const hasCourant = accounts.some((a) => a.accountType === 'COURANT');
  const hasEpargne = accounts.some((a) => a.accountType === 'EPARGNE');

  return (
    <ModalWrap
      open={open}
      onClose={onClose}
      title={business ? `Mes comptes · ${business.name}` : 'Mes comptes bancaires'}
      desc="Déposez et retirez de l'argent. Vos fonds contribuent à la trésorerie de la banque."
    >
      {loading ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="space-y-3">
          {/* Open account buttons */}
          <div className="flex gap-2">
            {!hasCourant ? (
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => void openAccount('COURANT')} disabled={opening}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />Compte courant
              </Button>
            ) : null}
            {!hasEpargne && business?.livretEpargneUnlocked ? (
              <Button size="sm" variant="outline" className="flex-1 text-xs border-amber-400/30 text-amber-300 hover:bg-amber-400/10" onClick={() => void openAccount('EPARGNE')} disabled={opening}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />Compte épargne
              </Button>
            ) : null}
          </div>

          {accounts.length === 0 ? (
            <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
              Ouvre un compte pour commencer à épargner.
            </div>
          ) : (
            accounts.map((account) => {
              const isEpargne = account.accountType === 'EPARGNE';
              const isActive = activeAccountId === account.id;
              return (
                <div key={account.id} className={cn('rounded-xl border bg-muted/10 px-4 py-4', isEpargne ? 'border-amber-400/25' : 'border-border/40')}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {isEpargne ? <Sparkles className="h-3.5 w-3.5 text-amber-400" /> : <Landmark className="h-3.5 w-3.5 text-emerald-400" />}
                        <p className="text-sm font-semibold">{isEpargne ? 'Compte Épargne' : 'Compte Courant'}</p>
                      </div>
                      <p className={cn('mt-1 text-xl font-bold tabular-nums', isEpargne ? 'text-amber-300' : 'text-emerald-300')}>
                        {account.balance.toLocaleString('fr-FR')} €
                      </p>
                      {isEpargne ? <p className="mt-0.5 text-[10px] text-amber-400/70">+0,5 % / jour</p> : <p className="mt-0.5 text-[10px] text-emerald-400/70">+0,2 % / jour</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => { setActiveAccountId(account.id); setAction('deposit'); setAmount('500'); }}>
                        <ArrowDownCircle className="mr-1 h-3.5 w-3.5" />Déposer
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => { setActiveAccountId(account.id); setAction('withdraw'); setAmount('500'); }}>
                        <ArrowUpCircle className="mr-1 h-3.5 w-3.5" />Retirer
                      </Button>
                    </div>
                  </div>

                  {/* Inline action form */}
                  {isActive && action ? (
                    <div className="mt-3 flex gap-2">
                      <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Montant" />
                      <Button size="sm" onClick={() => void doAction()} disabled={acting || Number(amount) <= 0}>
                        {action === 'deposit' ? 'Déposer' : 'Retirer'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setAction(null); setActiveAccountId(null); }}>Annuler</Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      )}
    </ModalWrap>
  );
}

// --- FormationPurchaseModal ---

export function FormationPurchaseModal({
  open,
  onClose,
  business,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness | null;
  onSubmitted: () => Promise<void>;
}) {
  const [buying, setBuying] = useState(false);
  const [purchased, setPurchased] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setPurchased(null); }
  }, [open]);

  const buy = async () => {
    if (!business) return;
    setBuying(true);
    try {
      const res = await withRouteError(() => youApi.buyFormation(business.id), 'Impossible d\'acheter cette formation.');
      toast.success('Formation achetée !');
      setPurchased(res.data.result.formationUrl);
      await onSubmitted();
    } finally {
      setBuying(false);
    }
  };

  const price = business?.formationPrice ?? 500;

  return (
    <ModalWrap
      open={open}
      onClose={onClose}
      title={business ? business.name : 'Formation'}
      desc="Accède à la formation proposée par ce centre."
    >
      {purchased ? (
        <div className="space-y-4 text-center">
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-6">
            <GraduationCap className="mx-auto h-10 w-10 text-emerald-400" />
            <p className="mt-3 text-sm font-semibold">Formation achetée !</p>
            <p className="mt-1 text-xs text-muted-foreground">Clique sur le bouton pour accéder au contenu.</p>
          </div>
          <a href={purchased} target="_blank" rel="noopener noreferrer">
            <Button className="w-full"><ExternalLink className="mr-2 h-4 w-4" />Accéder à la formation</Button>
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/8 px-4 py-4">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-amber-400" />
              <div>
                <p className="text-sm font-semibold">{business?.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Propriétaire : {business?.owner.username}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Prix de la formation</span>
              <span className="font-bold text-amber-300">{price.toLocaleString('fr-FR')} €</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={buying}>Annuler</Button>
            <Button size="sm" onClick={() => void buy()} disabled={buying}>
              Acheter · {price.toLocaleString('fr-FR')} €
            </Button>
          </div>
        </div>
      )}
    </ModalWrap>
  );
}

// --- ManageFormationsModal (owner: add/edit/delete formation products) ---

type FormationDraft = {
  title: string;
  description: string;
  price: string;
  url: string;
  imageUrl: string;
  attachmentFile: File | null;
  removeAttachment: boolean;
};

const EMPTY_DRAFT: FormationDraft = { title: '', description: '', price: '500', url: '', imageUrl: '', attachmentFile: null, removeAttachment: false };

export function ManageFormationsModal({
  open,
  onClose,
  business,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness;
  onSubmitted: (refreshBalance?: boolean) => Promise<void>;
}) {
  const [draft, setDraft] = useState<FormationDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const products: YouFormationProduct[] = business.formationProducts ?? [];

  useEffect(() => {
    if (!open) { setDraft(EMPTY_DRAFT); setEditingId(null); setFormOpen(false); }
  }, [open]);

  const startEdit = (p: YouFormationProduct) => {
    setDraft({
      title: p.title,
      description: p.description ?? '',
      price: String(p.price),
      url: p.url ?? '',
      imageUrl: p.imageUrl ?? '',
      attachmentFile: null,
      removeAttachment: false,
    });
    setEditingId(p.id);
    setFormOpen(true);
  };

  const startAdd = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setFormOpen(true);
  };

  const cancelForm = () => { setFormOpen(false); setEditingId(null); setDraft(EMPTY_DRAFT); };

  const save = async () => {
    const currentProduct = editingId ? products.find((entry) => entry.id === editingId) ?? null : null;
    const hasExistingAccess = Boolean(currentProduct?.url || currentProduct?.attachmentPath) && !draft.removeAttachment;
    if (!draft.title.trim() || (!draft.url.trim() && !draft.attachmentFile && !hasExistingAccess)) return;
    setSaving(true);
    try {
      const attachment = draft.attachmentFile
        ? {
            base64Data: await fileToBase64(draft.attachmentFile),
            mimeType: draft.attachmentFile.type,
            fileName: draft.attachmentFile.name,
          }
        : undefined;
      if (editingId) {
        await withRouteError(
          () => youApi.updateFormationProduct(business.id, editingId, {
            title: draft.title, description: draft.description || null,
            price: Number(draft.price), url: draft.url || null, imageUrl: draft.imageUrl || null,
            ...(attachment ? { attachment } : {}),
            ...(draft.removeAttachment ? { removeAttachment: true } : {}),
          }),
          'Impossible de modifier la formation.',
        );
        toast.success('Formation mise à jour');
      } else {
        await withRouteError(
          () => youApi.addFormationProduct(business.id, {
            title: draft.title, description: draft.description || undefined,
            price: Number(draft.price), url: draft.url || null, imageUrl: draft.imageUrl || undefined,
            ...(attachment ? { attachment } : {}),
          }),
          'Impossible d\'ajouter la formation.',
        );
        toast.success('Formation ajoutée');
      }
      await onSubmitted(true);
      cancelForm();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (productId: string) => {
    if (!window.confirm('Supprimer cette formation ?')) return;
    setDeletingId(productId);
    try {
      await withRouteError(() => youApi.deleteFormationProduct(business.id, productId), 'Impossible de supprimer.');
      toast.success('Formation supprimée');
      await onSubmitted(true);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title="Gérer les formations" desc="Ajoute, modifie ou supprime les formations vendues sur ce centre." wide>
      {products.length === 0 && !formOpen ? (
        <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
          Aucune formation configurée. Clique sur "Ajouter" pour commencer.
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.title} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/15">
                  <GraduationCap className="h-5 w-5 text-amber-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{p.title}</p>
                {p.description ? <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p> : null}
                <p className="text-xs font-medium text-amber-300">{p.price.toLocaleString('fr-FR')} €</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-xs" onClick={() => startEdit(p)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0 border-red-400/30 text-red-300 hover:bg-red-500/10"
                  onClick={() => void remove(p.id)}
                  disabled={deletingId === p.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen ? (
        <div className="space-y-3 rounded-xl border border-border/40 bg-muted/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {editingId ? 'Modifier la formation' : 'Nouvelle formation'}
          </p>
          <FieldRow label="Titre">
            <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="ex : Formation Excel Avancé" />
          </FieldRow>
          <FieldRow label="Description (optionnel)">
            <Input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Ce que l'acheteur apprend..." />
          </FieldRow>
          <FieldRow label="Prix (€)">
            <Input type="number" min={0} value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} />
          </FieldRow>
          <FieldRow label="Lien (PDF, vidéo, site...)">
            <Input value={draft.url} onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))} placeholder="https://drive.google.com/..." />
          </FieldRow>
          <FieldRow label="Fichier joint (optionnel)">
            <Input type="file" onChange={(e) => setDraft((d) => ({ ...d, attachmentFile: e.target.files?.[0] ?? null, removeAttachment: false }))} />
          </FieldRow>
          <FieldRow label="Miniature (URL image, optionnel)">
            <Input value={draft.imageUrl} onChange={(e) => setDraft((d) => ({ ...d, imageUrl: e.target.value }))} placeholder="https://..." />
          </FieldRow>
          {editingId ? (() => {
            const currentProduct = products.find((entry) => entry.id === editingId) ?? null;
            if (!currentProduct) return null;
            return (
              <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-xs space-y-2">
                <p className={cn('font-medium', currentProduct.status === 'APPROVED' ? 'text-emerald-400' : currentProduct.status === 'REJECTED' ? 'text-rose-400' : 'text-amber-400')}>
                  Statut: {currentProduct.status === 'APPROVED' ? 'ApprouvÃ©e' : currentProduct.status === 'REJECTED' ? 'RefusÃ©e' : 'En attente'}
                </p>
                <p className="text-muted-foreground">Fichier actuel: {draft.attachmentFile?.name ?? currentProduct.attachmentOriginalName ?? 'Aucun'}</p>
                {currentProduct.reviewerNote ? <p className="text-muted-foreground whitespace-pre-wrap break-words">Note reviewer: {currentProduct.reviewerNote}</p> : null}
                {(currentProduct.hasAttachment || draft.attachmentFile) ? (
                  <label className="flex items-center gap-2 text-foreground">
                    <input
                      type="checkbox"
                      checked={draft.removeAttachment}
                      onChange={(e) => setDraft((d) => ({ ...d, removeAttachment: e.target.checked, attachmentFile: e.target.checked ? null : d.attachmentFile }))}
                    />
                    Supprimer le fichier joint
                  </label>
                ) : null}
              </div>
            );
          })() : null}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={cancelForm} disabled={saving}>Annuler</Button>
            <Button size="sm" onClick={() => void save()} disabled={saving || !draft.title.trim() || (!draft.url.trim() && !draft.attachmentFile && !(editingId && !draft.removeAttachment))}>
              {editingId ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="w-full justify-start" onClick={startAdd}>
          <Plus className="mr-2 h-4 w-4" />Ajouter une formation
        </Button>
      )}
    </ModalWrap>
  );
}

// --- BusinessProfileModal (owner: rename, description, logo) ---

export function BusinessProfileModal({
  open,
  onClose,
  business,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness;
  onSubmitted: (refreshBalance?: boolean) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(business.name);
      setDescription(business.description ?? '');
      setLogoUrl(business.logoUrl ?? '');
    }
  }, [open, business.name, business.description, business.logoUrl]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await withRouteError(
        () => youApi.updateBusinessProfile(business.id, {
          name: name.trim(),
          description: description.trim() || null,
          logoUrl: logoUrl.trim() || null,
        }),
        'Impossible de modifier le profil.',
      );
      toast.success('Profil mis à jour');
      await onSubmitted(true);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title="Modifier le profil" desc="Personnalise le nom, la description et le logo de ton entreprise.">
      <FieldRow label="Nom">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'entreprise" />
      </FieldRow>
      <FieldRow label="Description (optionnel)">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ce que fait cette entreprise..." />
      </FieldRow>
      <FieldRow label="Logo (URL d'image, optionnel)">
        <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
      </FieldRow>
      {logoUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
          <img src={logoUrl} alt="apercu" className="h-10 w-10 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <p className="text-xs text-muted-foreground">Apercu du logo</p>
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Annuler</Button>
        <Button size="sm" onClick={() => void save()} disabled={saving || !name.trim()}>Enregistrer</Button>
      </div>
    </ModalWrap>
  );
}

// --- FormationCatalogModal (buyer: browse and buy formation products) ---

export function FormationCatalogModal({
  open,
  onClose,
  business,
  onSubmitted,
  onAccessed,
  onShowProductReviews,
  onRateProduct,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness | null;
  onSubmitted: () => Promise<void>;
  onAccessed?: () => void;
  onShowProductReviews?: (productId: string) => void;
  onRateProduct?: (productId: string) => void;
}) {
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [purchasedAccess, setPurchasedAccess] = useState<{ title: string; productId: string } | null>(null);
  const [accessingTarget, setAccessingTarget] = useState<{ productId: string; mode: 'file' | 'external' } | null>(null);

  useEffect(() => {
    if (!open) {
      setPurchasedAccess(null);
      setBuyingId(null);
      setAccessingTarget(null);
    }
  }, [open]);

  const products: YouFormationProduct[] = business?.formationProducts ?? [];
  const getHasPurchased = (product: YouFormationProduct) => Boolean(product.viewerHasPurchased ?? product.hasPurchased);
  const visibleProducts = useMemo(() => {
    if (!business) return [] as YouFormationProduct[];
    const items = business.ownerKind === 'you'
      ? products
      : products.filter((product) => product.status === 'APPROVED' || getHasPurchased(product));

    return [...items].sort((a, b) => {
      const statusRank = (value: string) => (value === 'APPROVED' ? 0 : value === 'PENDING' ? 1 : 2);
      const rankDiff = statusRank(a.status) - statusRank(b.status);
      if (rankDiff !== 0) return rankDiff;
      const purchasedDiff = Number(getHasPurchased(b)) - Number(getHasPurchased(a));
      if (purchasedDiff !== 0) return purchasedDiff;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }, [business, products]);

  const buy = async (product: YouFormationProduct) => {
    if (!business) return;
    setBuyingId(product.id);
    try {
      const res = await withRouteError(
        () => youApi.buyFormationProduct(business.id, product.id),
        "Impossible d'acheter cette formation.",
      );
      toast.success(`Formation "${product.title}" achetee !`);
      setPurchasedAccess({ title: res.data.result.title, productId: product.id });
      await onSubmitted();
    } finally {
      setBuyingId(null);
    }
  };

  if (!business) return null;

  const isOwnerPreview = business.ownerKind === 'you';
  const catalogDescription = purchasedAccess
    ? 'Accede a ta formation ci-dessous.'
    : isOwnerPreview
      ? `${visibleProducts.length} formation(s) visibles cote client`
      : `${visibleProducts.length} formation(s) disponible(s)`;

  const handleAccess = async (productId: string, mode: 'file' | 'external') => {
    setAccessingTarget({ productId, mode });
    try {
      await openFormationAccess(business.id, productId, mode);
      onAccessed?.();
    } finally {
      setAccessingTarget(null);
    }
  };

  const getFileActionLabel = (product: YouFormationProduct) =>
    product.attachmentMimeType === 'application/pdf'
      ? 'Ouvrir le PDF'
      : 'Telecharger le fichier';

  return (
    <ModalWrap
      open={open}
      onClose={onClose}
      title={business.name}
      desc={catalogDescription}
      wide
    >
      {purchasedAccess ? (
        <div className="space-y-4 text-center">
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-6">
            <GraduationCap className="mx-auto h-10 w-10 text-emerald-400" />
            <p className="mt-3 text-sm font-semibold">{purchasedAccess.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">Clique pour reouvrir ton acces securise.</p>
          </div>
          <Button className="w-full" onClick={() => void openFormationAccess(business.id, purchasedAccess.productId).then(onAccessed)}>
            <Download className="mr-2 h-4 w-4" />Acceder a la formation
          </Button>
          {visibleProducts.length > 1 ? (
            <Button variant="ghost" className="w-full text-xs" onClick={() => setPurchasedAccess(null)}>
              Voir les autres formations
            </Button>
          ) : null}
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
          {isOwnerPreview ? 'Aucune formation creee pour le moment.' : 'Aucune formation disponible pour le moment.'}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.map((product) => {
            const hasPurchased = getHasPurchased(product);
            const canAccess = isOwnerPreview || hasPurchased;
            const ratingCount = product.ratingCount ?? product.ratings?.length ?? 0;
            const isAccessingFile = accessingTarget?.productId === product.id && accessingTarget.mode === 'file';
            const isAccessingExternal = accessingTarget?.productId === product.id && accessingTarget.mode === 'external';

            return (
              <div key={product.id} className="overflow-hidden rounded-xl border border-border/40 bg-muted/10">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="h-32 w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : null}
                <div className="space-y-3 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/15">
                      <GraduationCap className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold">{product.title}</p>
                        {hasPurchased ? <Pill label="Achetee" color="bg-emerald-400/15 text-emerald-300" /> : null}
                        {product.status === 'PENDING' ? <Pill label="En attente" color="bg-amber-400/15 text-amber-300" /> : null}
                        {product.status === 'REJECTED' ? <Pill label="Refusee" color="bg-rose-400/15 text-rose-300" /> : null}
                      </div>
                      {product.description ? <p className="mt-0.5 text-xs text-muted-foreground">{product.description}</p> : null}
                      <p className="mt-1.5 text-sm font-bold text-amber-300">{product.price.toLocaleString('fr-FR')} EUR</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>Publie le {new Date(product.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    {product.hasAttachment ? (
                      <p>
                        Fichier protege: {product.attachmentOriginalName ?? 'piece jointe'}
                        {product.attachmentMimeType ? ` (${product.attachmentMimeType})` : ''}
                      </p>
                    ) : null}
                    {product.url ? <p>Lien externe disponible</p> : null}
                    {hasPurchased && product.viewerPurchasedAt ? (
                      <p>Achetee le {new Date(product.viewerPurchasedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    ) : null}
                    {hasPurchased && product.viewerLastAccessedAt ? (
                      <p>Dernier acces le {new Date(product.viewerLastAccessedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    ) : null}
                  </div>

                  {isOwnerPreview && product.status === 'REJECTED' && product.reviewerNote ? (
                    <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
                      Note moderation: {product.reviewerNote}
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onShowProductReviews?.(product.id)}
                      disabled={!onShowProductReviews}
                      className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-muted/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 transition-colors hover:bg-muted/20 disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Star className="h-3 w-3 fill-amber-400" />
                      <span>{product.avgRating?.toFixed(1) ?? '--'}</span>
                      <span className="text-muted-foreground/70">({ratingCount})</span>
                    </button>
                    {!isOwnerPreview ? (
                      product.canReview ? (
                        <button
                          type="button"
                          onClick={() => onRateProduct?.(product.id)}
                          disabled={!onRateProduct}
                          className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-muted/10 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      ) : hasPurchased ? (
                        <span className="text-[10px] text-muted-foreground/60">Note dispo après consultation</span>
                      ) : null
                    ) : null}
                  </div>

                  {canAccess ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {product.hasAttachment ? (
                        <Button size="sm" className="w-full" onClick={() => void handleAccess(product.id, 'file')} disabled={Boolean(accessingTarget)}>
                          {isAccessingFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                          {getFileActionLabel(product)}
                        </Button>
                      ) : null}
                      {product.url ? (
                        <Button size="sm" variant={product.hasAttachment ? 'outline' : 'default'} className="w-full" onClick={() => void handleAccess(product.id, 'external')} disabled={Boolean(accessingTarget)}>
                          {isAccessingExternal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                          Ouvrir le lien
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <Button size="sm" className="w-full" onClick={() => void buy(product)} disabled={buyingId !== null || isOwnerPreview || product.status !== 'APPROVED' || hasPurchased}>
                      {buyingId === product.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Acheter - {product.price.toLocaleString('fr-FR')} EUR
                    </Button>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}
    </ModalWrap>
  );
}

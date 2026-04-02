import { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Building2, Check, Trash2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { type YouBusiness, type YouBusinessType, type YouPlayer, type YouRelationship, type YouStartupProduct, youApi } from '@/services/api';
import { BUSINESS_ICON_MAP, BUSINESS_STYLE_MAP } from '../constants';
import { formatDurationMinutes, formatMoney, withRouteError } from '../utils';
import { ActionCard, ActionRow, FieldRow, ModalWrap, Pill, ProgressBar, SectionTitle, SelectBox, UserAvatar } from './ui';

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
  const [pickerOpen, setPickerOpen] = useState(false);

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
        businessTypes={businessTypes}
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

export function LoanModal({ open, onClose, business, onSubmitted }: { open: boolean; onClose: () => void; business: YouBusiness | null; onSubmitted: () => Promise<void> }) {
  const [amount, setAmount] = useState('5000');
  const [durationDays, setDurationDays] = useState('30');
  const [submitting, setSubmitting] = useState(false);
  const rate = business?.loanInterestRate ?? 4;
  const total = Math.round(Number(amount || 0) * (1 + rate / 100));
  const dailyRepayment = Math.round(total / Math.max(1, Number(durationDays || 1)));

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
      <FieldRow label="Duree (jours)"><Input type="number" value={durationDays} onChange={(event) => setDurationDays(event.target.value)} min={1} placeholder="ex : 7" /></FieldRow>
      <div className="grid grid-cols-3 gap-3 rounded-xl border border-border/40 bg-muted/10 p-4">
        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Taux</p><p className="text-lg font-bold tabular-nums text-amber-400">{rate}%</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Remb. / jour</p><p className="text-lg font-bold tabular-nums">{formatMoney(dailyRepayment)}</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Total estime</p><p className="text-lg font-bold tabular-nums text-red-400">{formatMoney(total)}</p></div>
      </div>
      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button><Button size="sm" onClick={submit} disabled={submitting || !business || Number(durationDays) < 1}>Envoyer</Button></div>
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

export function TransferBusinessModal({ open, onClose, business, players, onSubmitted }: { open: boolean; onClose: () => void; business: YouBusiness | null; players: YouPlayer[]; onSubmitted: () => Promise<void> }) {
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
    if (player.id === business?.ownerId) return true;
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return player.username.toLowerCase().includes(query) || player.firstName?.toLowerCase().includes(query) || player.bio?.toLowerCase().includes(query);
  }), [business?.ownerId, players, search]);

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

export function ManageBusinessModal({
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
  const [reviewingBuyoutId, setReviewingBuyoutId] = useState<string | null>(null);
  const [actingProductKey, setActingProductKey] = useState<string | null>(null);
  const [liquidating, setLiquidating] = useState(false);

  useEffect(() => {
    if (open) {
      setDepositAmount('1000');
      setWithdrawAmount('1000');
      setActiveTreasuryAction(null);
      setReviewingLoanId(null);
      setReviewingBuyoutId(null);
      setActingProductKey(null);
    }
  }, [open, business?.id]);

  const pendingLoans = business?.recentLoans.filter((loan) => loan.status === 'PENDING') ?? [];
  const pendingBuyoutOffers = business?.pendingBuyoutOffers.filter((offer) => offer.status === 'PENDING') ?? [];
  const isBank = business?.typeKey === 'bank';
  const isStartup = business?.typeKey === 'startup';
  const businessIconTypeKey = business?.typeKey as keyof typeof BUSINESS_ICON_MAP | undefined;
  const BusinessIcon = businessIconTypeKey ? (BUSINESS_ICON_MAP[businessIconTypeKey] ?? Building2) : Building2;
  const businessIconStyle = businessIconTypeKey
    ? (BUSINESS_STYLE_MAP[businessIconTypeKey] ?? { iconWrap: 'bg-muted/20', icon: 'text-foreground' })
    : { iconWrap: 'bg-muted/20', icon: 'text-foreground' };

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
    <ModalWrap
      open={open}
      onClose={onClose}
      title={business ? <span className="inline-flex items-center justify-center gap-2"><span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', businessIconStyle.iconWrap)}><BusinessIcon className={cn('h-4 w-4', businessIconStyle.icon)} /></span><span>{business.name}</span></span> : 'Business'}
      desc="Actions de gestion sur la structure selectionnee."
      wide
      centerTitle
    >
      {business ? (
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <SectionTitle>Actions</SectionTitle>
            {business.actions.includes('deposit') ? (
              <Card><CardContent className="space-y-3 px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/15"><ArrowDownCircle className="h-4 w-4 text-emerald-400" /></div><div><p className="text-sm font-semibold">Deposer</p><p className="text-xs text-muted-foreground">Transfert depuis ton money partage.</p></div></div><div className="flex gap-2"><Input type="number" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} min={1} /><Button size="sm" onClick={() => void runTreasuryAction('deposit', depositAmount)} disabled={activeTreasuryAction !== null || Number(depositAmount) <= 0}>Deposer</Button></div></CardContent></Card>
            ) : null}
            {business.actions.includes('withdraw') ? (
              <Card><CardContent className="space-y-3 px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-400/15"><ArrowUpCircle className="h-4 w-4 text-red-400" /></div><div><p className="text-sm font-semibold">Retirer</p><p className="text-xs text-muted-foreground">Retour vers ton money partage.</p></div></div><div className="flex gap-2"><Input type="number" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} min={1} /><Button size="sm" variant="outline" onClick={() => void runTreasuryAction('withdraw', withdrawAmount)} disabled={activeTreasuryAction !== null || Number(withdrawAmount) <= 0}>Retirer</Button></div></CardContent></Card>
            ) : null}
            <ActionCard>
              {business.actions.includes('invite') && business.ownerKind === 'you' ? <ActionRow icon={UserPlus} label="Inviter des joueurs" sub="Envoyer de nouvelles invitations." iconBg="bg-violet-400/15" iconColor="text-violet-400" onClick={() => { onClose(); onInviteRequested(business); }} /> : null}
              {business.ownerKind === 'you' ? <ActionRow icon={Trash2} label={liquidating ? 'Liquidation en cours' : 'Liquider l entreprise'} sub="Suppression definitive de la structure." iconBg="bg-red-400/15" iconColor="text-red-400" onClick={() => { if (!liquidating) void liquidateBusiness(); }} /> : null}
            </ActionCard>
            {isStartup ? <div className="space-y-3">
              <SectionTitle>Time Tasks</SectionTitle>
              {business.startupProducts.map((product) => {
                const levelLabel = `Niveau ${product.deployedLevel}/10`;
                const statusLabel = product.isResearchActive
                  ? `Recherche niv. ${product.activeResearchLevel}`
                  : product.canDeploy
                    ? `Pret a deployer niv. ${product.activeResearchLevel}`
                    : product.isMaxLevel
                      ? 'Maximum atteint'
                      : `Prochaine recherche niv. ${product.deployedLevel + 1}`;
                const progressLabel = product.isResearchActive || product.canDeploy
                  ? `${product.progressPercent}%`
                  : product.nextResearchDurationMinutes
                    ? formatDurationMinutes(product.nextResearchDurationMinutes)
                    : 'termine';
                const progressValue = product.isResearchActive || product.canDeploy
                  ? product.progressPercent
                  : product.isMaxLevel
                    ? 100
                    : 0;
                const actionLabel = product.canDeploy
                  ? 'Cliquer pour deployer'
                  : product.isResearchActive
                    ? 'Recherche en cours'
                    : product.isMaxLevel
                      ? 'Niveau max'
                      : 'Cliquer pour lancer la recherche';
                const isClickable = product.canDeploy || product.canStartResearch;
                const isBusy = actingProductKey !== null;

                return (
                  <Card
                    key={product.id}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    className={cn(
                      'transition-colors',
                      isClickable ? 'cursor-pointer hover:border-sky-400/40 hover:bg-sky-400/5' : 'opacity-80',
                      isBusy && actingProductKey !== product.id ? 'pointer-events-none opacity-60' : null,
                    )}
                    onClick={() => {
                      if (isBusy) return;
                      if (product.canDeploy) {
                        void deployProduct(product);
                        return;
                      }
                      if (product.canStartResearch) {
                        void startResearch(product);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (!isClickable || isBusy) return;
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      if (product.canDeploy) {
                        void deployProduct(product);
                        return;
                      }
                      if (product.canStartResearch) {
                        void startResearch(product);
                      }
                    }}
                  >
                    <CardContent className="space-y-3 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{levelLabel}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Pill label={`+${formatMoney(product.currentRevenue)}`} color="bg-sky-400/15 text-sky-300" />
                          <span className="text-[11px] font-medium text-muted-foreground">{actionLabel}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between gap-3 text-[11px] text-muted-foreground">
                          <span>{statusLabel}</span>
                          <span>{progressLabel}</span>
                        </div>
                        <ProgressBar value={progressValue} color="bg-sky-400" />
                      </div>

                      <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
                        {product.canDeploy ? (
                          <p>La recherche est terminee. Tu peux deployer le produit pour augmenter le revenue.</p>
                        ) : product.isResearchActive ? (
                          <p>Recherche en cours jusqu au {product.researchEndsAt ? new Date(product.researchEndsAt).toLocaleString('fr-FR') : 'bientot'}.</p>
                        ) : product.isMaxLevel ? (
                          <p>Ce produit est deja au niveau maximum.</p>
                        ) : (
                          <p>Prochaine recherche: {product.nextResearchCost ? `${formatMoney(product.nextResearchCost)} money` : 'n/a'} · {product.nextResearchDurationMinutes ? formatDurationMinutes(product.nextResearchDurationMinutes) : 'n/a'}.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div> : null}
          </div>

          <div className="space-y-4">
            <SectionTitle>Informations</SectionTitle>
            <Card><CardContent className="space-y-4 px-5 py-4">
              <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/10 px-6 py-8 text-center">
                <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300/80">Tresorerie</p>
                <p className="mt-3 text-6xl font-semibold tabular-nums text-emerald-200">{formatMoney(business.treasuryMoney)}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[{ label: 'Membres', value: String(business.memberCount) }, { label: 'Revenue', value: `+${formatMoney(business.monthlyRevenue)}` }].map((entry) => <div key={entry.label} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{entry.label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{entry.value}</p></div>)}
              </div>
            </CardContent></Card>

            {isStartup ? <Card><CardContent className="space-y-3 px-5 py-4">
              <SectionTitle>Produits</SectionTitle>
              {business.startupProducts.map((product) => <div key={product.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{product.name}</p><p className="mt-1 text-xs text-muted-foreground">Niveau {product.deployedLevel}/10 · revenue {formatMoney(product.currentRevenue)}</p></div><span className="text-xs font-medium text-muted-foreground">{product.canDeploy ? 'Pret' : product.isResearchActive ? 'En cours' : product.isMaxLevel ? 'Max' : 'Disponible'}</span></div></div>)}
            </CardContent></Card> : null}

            {isBank ? <Card><CardContent className="space-y-3 px-5 py-4">
              <SectionTitle>Demandes de pret</SectionTitle>
              {pendingLoans.length === 0 ? <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">Aucune demande de pret en attente.</div> : pendingLoans.map((loan) => <div key={loan.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold">{loan.borrower.username}</p><p className="text-xs text-muted-foreground">{formatMoney(loan.amount)} money · {loan.termDays} jours · {loan.interestRate}% d interet</p></div><div className="flex gap-2"><Button size="sm" className="text-xs" onClick={() => void reviewLoan(loan.id, 'accept')} disabled={reviewingLoanId !== null}><Check className="mr-1.5 h-3.5 w-3.5" />Accepter</Button><Button size="sm" variant="outline" className="text-xs" onClick={() => void reviewLoan(loan.id, 'reject')} disabled={reviewingLoanId !== null}><X className="mr-1.5 h-3.5 w-3.5" />Refuser</Button></div></div></div>)}
            </CardContent></Card> : null}

            {business.ownerKind === 'you' ? <Card><CardContent className="space-y-3 px-5 py-4">
              <SectionTitle>Offres de rachat</SectionTitle>
              {pendingBuyoutOffers.length === 0 ? <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">Aucune offre de rachat en attente.</div> : pendingBuyoutOffers.map((offer) => <div key={offer.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="space-y-1"><p className="text-sm font-semibold">{offer.bidder.username}</p><p className="text-xs text-muted-foreground">{formatMoney(offer.amount)} money en escrow</p>{offer.message ? <p className="text-xs text-muted-foreground/80">"{offer.message}"</p> : null}</div><div className="flex gap-2"><Button size="sm" className="text-xs" onClick={() => void reviewBuyout(offer.id, 'accept')} disabled={reviewingBuyoutId !== null}><Check className="mr-1.5 h-3.5 w-3.5" />Accepter</Button><Button size="sm" variant="outline" className="text-xs" onClick={() => void reviewBuyout(offer.id, 'reject')} disabled={reviewingBuyoutId !== null}><X className="mr-1.5 h-3.5 w-3.5" />Refuser</Button></div></div></div>)}
            </CardContent></Card> : null}
          </div>
        </div>
      ) : null}
    </ModalWrap>
  );
}

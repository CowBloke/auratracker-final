import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, Building2, CalendarDays, Check, ChevronRight,
  CreditCard, Download, Droplets, Edit2, ExternalLink, Factory, GraduationCap, Image, Landmark, Loader2, Percent,
  Megaphone, Plus, Scale, Sparkles, Star, Trash2, TrendingUp, UserPlus, Users, Wallet, X, Utensils,
  ShieldAlert,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  type YouBankAccount, type YouBusiness, type YouBusinessLoan, type YouBusinessTransaction,
  type YouBusinessType, type YouFormationProduct, type YouPlayer, type YouRelationship, type YouStartupProduct, youApi, uploadUserImage,
} from '@/services/api';
import { resolveImageUrl } from '@/lib/images';
import { BUSINESS_COLOR_HEX, BUSINESS_ICON_MAP, BUSINESS_STYLE_MAP } from '../constants';
import { PRODUCER_TYPES, BUSINESS_PRODUCES, RECIPES, RESOURCE_META, type ResourceType } from '@/lib/resources';
import { ProductionModal } from './ProductionModal';
import { formatDurationMinutes, formatMoney, withRouteError } from '../utils';
import { openFormationAccess } from '../formation-access';
import {
  fileToBase64,
  formatLoanDate,
  getLoanDueDate,
  getLoanStatusLabel,
  getLoanStatusPillColor,
  getLoanTimeLeftLabel,
} from './modal-helpers';
import { ActionCard, ActionRow, FieldRow, Pill, SectionTitle, SelectBox, UserAvatar } from './YouPrimitives';
import { AppModal } from '@/components/ui/app-modal';

const PICKER_DEFAULT_STYLE = { card: 'border-border/40 bg-muted/10', badge: 'bg-muted text-muted-foreground', iconWrap: 'bg-muted/20', icon: 'text-foreground/60' };

function StatRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn('text-[11px] font-semibold tabular-nums', accent ?? 'text-foreground')}>{value}</span>
    </div>
  );
}

function BusinessTypeDetailPanel({ type }: { type: YouBusinessType }) {
  const Icon = BUSINESS_ICON_MAP[type.key as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
  const style = BUSINESS_STYLE_MAP[type.key as keyof typeof BUSINESS_STYLE_MAP] ?? PICKER_DEFAULT_STYLE;
  const color = BUSINESS_COLOR_HEX[type.key] ?? '#9ca3af';
  const produces = (BUSINESS_PRODUCES[type.key] ?? []) as ResourceType[];
  const typeRecipes = RECIPES.filter((r) => !r.forTypes.includes('*') && r.forTypes.includes(type.key));

  return (
    <div className="space-y-3">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl p-4" style={{ background: `${color}14` }}>
        <div className="pointer-events-none absolute bottom-0 right-0 select-none overflow-hidden">
          <Icon className="translate-x-5 translate-y-5 h-28 w-28" style={{ color, opacity: 0.12 }} />
        </div>
        <div className={cn('mb-3 flex h-11 w-11 items-center justify-center rounded-xl', style.iconWrap)}>
          <Icon className={cn('h-[22px] w-[22px]', style.icon)} />
        </div>
        <p className="font-bold text-foreground">{type.label}</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{type.description}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-semibold', style.badge)}>{type.category}</span>
          {type.level > 1 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">Niveau {type.level} requis</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="divide-y divide-border/40">
        <StatRow label="Frais de création" value={type.creationFee > 0 ? `${type.creationFee.toLocaleString('fr-FR')} money` : 'Gratuit'} />
        {type.minCapital > 0 && <StatRow label="Capital minimum" value={`${type.minCapital.toLocaleString('fr-FR')} money`} />}
        {type.monthlyRevenue > 0 && <StatRow label="Revenus estimés" value={`${type.monthlyRevenue.toLocaleString('fr-FR')} /mois`} accent="text-emerald-500" />}
        {type.monthlyExpenses > 0 && <StatRow label="Dépenses estimées" value={`${type.monthlyExpenses.toLocaleString('fr-FR')} /mois`} accent="text-red-400" />}
        {produces.length > 0 && (
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-[11px] text-muted-foreground">Production</span>
            <div className="flex flex-wrap justify-end gap-1">
              {produces.map((r) => {
                const meta = RESOURCE_META[r];
                const { Icon: RIcon } = meta;
                return (
                  <span key={r} className={cn('flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium', meta.bg, meta.iconColor)}>
                    <RIcon className="h-2.5 w-2.5" />{meta.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {typeRecipes.map((recipe) => (
          <StatRow key={recipe.id} label={recipe.name} value={recipe.inputs.map((i) => `${i.qty}×${RESOURCE_META[i.resource]?.label ?? i.resource}`).join(' + ')} />
        ))}
      </div>
    </div>
  );
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
  const [previewKey, setPreviewKey] = useState(selectedKey);

  // Reset preview to current selection each time the modal opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setPreviewKey(selectedKey); }, [open]);

  const previewType = businessTypes.find((bt) => bt.key === previewKey) ?? businessTypes[0];

  return (
    <AppModal open={open} onClose={onClose} tone="cyan" size="xl" description="Choisir un type d'activité">
      <AppModal.Header tone="cyan" title="Choisir un type d'activité" />
      <AppModal.Body scrollable>
      <div className="flex min-h-0 gap-5" data-tutorial-id="business-type-picker-modal">
        {/* Left — grouped scrollable grid */}
        <div className="max-h-[60vh] min-w-0 flex-1 overflow-y-auto pr-1">
          {(() => {
            const groups = businessTypes.reduce<Record<string, typeof businessTypes>>((acc, type) => {
              const cat = type.category ?? 'Autre';
              (acc[cat] ??= []).push(type);
              return acc;
            }, {});
            return Object.entries(groups).map(([cat, types]) => (
              <div key={cat} className="mb-4">
                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 px-0.5">{cat}</p>
                <div className="grid grid-cols-3 gap-2">
                  {types.map((type) => {
                    const Icon = BUSINESS_ICON_MAP[type.key as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
                    const style = BUSINESS_STYLE_MAP[type.key as keyof typeof BUSINESS_STYLE_MAP] ?? PICKER_DEFAULT_STYLE;
                    const color = BUSINESS_COLOR_HEX[type.key] ?? '#9ca3af';
                    const isPreviewing = previewKey === type.key;
                    const isConfirmed = selectedKey === type.key;
                    return (
                      <button
                        key={type.key}
                        type="button"
                        onClick={() => setPreviewKey(type.key)}
                        data-tutorial-id={`business-type-option-${type.key}`}
                        className={cn(
                          'relative overflow-hidden rounded-xl border p-3 text-left transition-all',
                          isPreviewing ? style.card : 'border-border/40 bg-muted/10 hover:bg-muted/20',
                        )}
                      >
                        {/* Watermark */}
                        <div className="pointer-events-none absolute bottom-0 right-0 select-none overflow-hidden">
                          <Icon className="h-16 w-16 translate-x-4 translate-y-4" style={{ color, opacity: 0.11 }} />
                        </div>
                        {/* Confirmed dot */}
                        {isConfirmed && (
                          <div className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                        )}
                        {/* Content */}
                        <div className="relative flex flex-col gap-2.5">
                          <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', isPreviewing ? style.iconWrap : 'bg-muted/20')}>
                            <Icon className={cn('h-[18px] w-[18px] transition-colors', isPreviewing ? style.icon : 'text-foreground/55')} />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold leading-tight text-foreground">{type.label}</p>
                            <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/45">
                              {type.creationFee > 0 ? type.creationFee.toLocaleString('fr-FR') : 'Gratuit'}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>

        {/* Divider */}
        <div className="w-px shrink-0 bg-border" />

        {/* Right — detail panel */}
        <div className="flex w-64 shrink-0 flex-col gap-3">
          {previewType && (
            <>
              <div className="max-h-[calc(60vh-60px)] overflow-y-auto">
                <BusinessTypeDetailPanel type={previewType} />
              </div>
              <button
                type="button"
                onClick={() => { onSelect(previewType); onClose(); }}
                data-tutorial-id="business-type-picker-confirm"
                className="mt-auto w-full rounded-xl py-3 text-[13px] font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: BUSINESS_COLOR_HEX[previewType.key] ?? '#6366f1' }}
              >
                Choisir · {previewType.label}
              </button>
            </>
          )}
        </div>
      </div>
      </AppModal.Body>
    </AppModal>
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
  const [description, setDescription] = useState('');
  const [typeKey, setTypeKey] = useState(accessibleTypes[0]?.key ?? '');
  const [capital, setCapital] = useState('');
  const [juiceSpecialization, setJuiceSpecialization] = useState('');
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
    setDescription('');
    setJuiceSpecialization('');
  }, [businessTypes, open]);

  const selectedType = accessibleTypes.find((type) => type.key === typeKey) ?? accessibleTypes[0];
  const isBank = selectedType?.key === 'bank';

  const isJuterie = selectedType?.key === 'juterie';
  const JUICE_OPTIONS = [
    { value: 'JUICE_ABRICOT',    label: "Jus d'abricot",    desc: 'Change ta photo de profil' },
    { value: 'JUICE_GINGEMBRE',  label: 'Jus de gingembre', desc: 'Change la couleur de ton pseudo' },
    { value: 'JUICE_PAPAYE',     label: 'Jus de papaye',    desc: '+100€ par unité achetée' },
    { value: 'JUICE_MALAKOUKOU', label: 'Jus de malakoukou', desc: 'Change la bannière de profil' },
    { value: 'JUICE_GOYAVE',     label: 'Jus de Goyave',    desc: '+10 aura par unité achetée' },
  ] as const;

  const submit = async () => {
    if (!selectedType) return;
    if (isJuterie && !juiceSpecialization) {
      toast.error('Choisissez une spécialisation pour la juicerie.');
      return;
    }
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.createBusiness({
        name, description, typeKey: selectedType.key,
        capital: isBank ? 0 : Number(capital),
        juiceSpecialization: isJuterie ? juiceSpecialization : undefined,
      }), 'Impossible de creer le business.');
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
      <AppModal
        open={open}
        onClose={onClose}
        tone="cyan"
        size="md"
        description="Creer une entreprise"
      >
        <AppModal.Header tone="cyan" title="Creer une entreprise" subtitle={isBank ? 'La creation de la banque coute 10 000 money et la tresorerie demarre a 0.' : 'Le capital de depart est pris sur ton argent global.'} />
        <AppModal.Body scrollable>
        <div data-tutorial-id="create-business-modal" className="space-y-3">
        <FieldRow label="Type d activite">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full rounded-2xl border border-border/40 bg-muted/10 px-4 py-4 text-left transition-all hover:bg-muted/20"
            data-tutorial-id="create-business-type"
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
        <FieldRow label="Nom">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="ex : Citizen Bank"
            data-tutorial-id="create-business-name"
          />
        </FieldRow>
        <FieldRow label="Description">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Decris ton business..."
            data-tutorial-id="create-business-description"
          />
        </FieldRow>
        {!isBank ? (
          <FieldRow label="Capital de depart">
            <Input
              type="number"
              value={capital}
              onChange={(event) => setCapital(event.target.value)}
              min={selectedType?.minCapital ?? 0}
              data-tutorial-id="create-business-capital"
            />
          </FieldRow>
        ) : null}
        {isJuterie && (
          <FieldRow label="Spécialisation">
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">Chaque juicerie ne produit qu'un seul type de jus. Choisissez votre spécialité :</p>
              <div className="grid grid-cols-1 gap-1.5">
                {JUICE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setJuiceSpecialization(opt.value)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                      juiceSpecialization === opt.value
                        ? 'border-pink-500/50 bg-pink-500/10'
                        : 'border-border/40 bg-muted/10 hover:bg-muted/20',
                    )}
                  >
                    <Droplets className={cn('h-4 w-4 shrink-0', juiceSpecialization === opt.value ? 'text-pink-500' : 'text-muted-foreground')} />
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[13px] font-semibold leading-tight', juiceSpecialization === opt.value ? 'text-pink-500' : 'text-foreground')}>{opt.label}</p>
                      <p className="text-[10.5px] text-muted-foreground">{opt.desc}</p>
                    </div>
                    {juiceSpecialization === opt.value && <Check className="h-3.5 w-3.5 shrink-0 text-pink-500" />}
                  </button>
                ))}
              </div>
            </div>
          </FieldRow>
        )}
        </div>
        </AppModal.Body>
        <AppModal.Footer>
          <AppModal.Button variant="ghost" onClick={onClose} disabled={submitting}>Annuler</AppModal.Button>
          <AppModal.Button tone="cyan" variant="soft" onClick={submit} disabled={submitting || !selectedType || !name.trim() || !description.trim() || (!isBank && Number(capital) < selectedType.minCapital) || (isJuterie && !juiceSpecialization)} data-tutorial-id="create-business-submit">Creer</AppModal.Button>
        </AppModal.Footer>
      </AppModal>
      <BusinessTypePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        businessTypes={accessibleTypes}
        selectedKey={typeKey}
        onSelect={(type) => {
          setTypeKey(type.key);
          setCapital(String(type.minCapital));
          setJuiceSpecialization('');
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
    <AppModal open={open} onClose={onClose} tone="cyan" size="xl" description="Inviter des joueurs">
      <AppModal.Header tone="cyan" title={business ? `Inviter des joueurs · ${business.name}` : 'Inviter des joueurs'} subtitle="Toutes les invitations ciblent de vrais joueurs." />
      <AppModal.Body scrollable>
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
            return (
              <div key={player.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
                <UserAvatar player={player} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{player.username}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{player.bio?.trim() || 'Disponible pour une collaboration.'}</p>
                </div>
                <Button size="sm" variant={selected ? 'secondary' : 'outline'} className="h-8 text-xs" onClick={() => setSelectedIds((current) => current.includes(player.id) ? current.filter((entry) => entry !== player.id) : [...current, player.id])}>
                  {selected ? 'Selectionne' : 'Inviter'}
                </Button>
              </div>
            );
          })}
          {availablePlayers.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Aucun joueur disponible pour cette recherche.</p> : null}
        </div>
        <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">{selectedIds.length === 0 ? 'Aucune invitation preparee.' : `${selectedIds.length} invitation(s) preparee(s) pour le role ${role} a ${Number(salary).toLocaleString('fr-FR')} money/jour.`}</div>
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose} disabled={submitting}>Fermer</AppModal.Button>
        <AppModal.Button tone="cyan" variant="soft" onClick={submit} disabled={submitting || !business || selectedIds.length === 0}>Envoyer</AppModal.Button>
      </AppModal.Footer>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="orange" size="md" description="Demander un pret">
      <AppModal.Header tone="orange" title={business ? `Demander un pret · ${business.name}` : 'Demander un pret'} subtitle="Le proprietaire devra accepter la demande avant que le money soit debloque." />
      <AppModal.Body>
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
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose} disabled={submitting}>Annuler</AppModal.Button>
        <AppModal.Button tone="orange" variant="soft" onClick={submit} disabled={submitting || !business || Number(durationDays) < 1 || Number(collateralAura) < 0 || motivationMessage.length > 400}>Envoyer</AppModal.Button>
      </AppModal.Footer>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="green" size="md" description="Investir">
      <AppModal.Header tone="green" title={business ? `Investir · ${business.name}` : 'Investir'} subtitle="Le money est retire de ton argent personnel puis credite a la tresorerie du business." />
      <AppModal.Body>
      <FieldRow label="Montant"><Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min={100} /></FieldRow>
      <FieldRow label="Risque"><SelectBox value={riskLevel} onChange={(value) => setRiskLevel(value as 'low' | 'medium' | 'high')}><option value="low">Faible risque</option><option value="medium">Risque modere</option><option value="high">Risque eleve</option></SelectBox></FieldRow>
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/40 bg-muted/10 p-3 text-center"><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Risque</p><p className={cn('text-sm font-bold', selected.color)}>{selected.label}</p></div><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Min</p><p className={cn('text-sm font-bold', selected.color)}>+{selected.min}%</p></div><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Max</p><p className={cn('text-sm font-bold', selected.color)}>+{selected.max}%</p></div></div>
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose} disabled={submitting}>Annuler</AppModal.Button>
        <AppModal.Button tone="green" variant="soft" onClick={submit} disabled={submitting || !business}>Investir</AppModal.Button>
      </AppModal.Footer>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="cyan" size="lg" description="Service de transfert">
      <AppModal.Header tone="cyan" title={business ? `Transfert via ${business.name}` : 'Service de transfert'} subtitle="Le montant est envoye au joueur choisi et les frais sont credites a la tresorerie du service." />
      <AppModal.Body scrollable>
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
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose} disabled={submitting}>Annuler</AppModal.Button>
        <AppModal.Button tone="cyan" variant="soft" onClick={submit} disabled={submitting || !business || !recipientId || Number(amount) <= 0}>Transferer</AppModal.Button>
      </AppModal.Footer>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="money" size="md" description="Faire une offre de rachat">
      <AppModal.Header tone="money" title={business ? `Faire une offre · ${business.name}` : 'Faire une offre'} subtitle="Le montant est debite tout de suite et garde en escrow jusqu a la decision du proprietaire." />
      <AppModal.Body>
      <FieldRow label="Montant"><Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min={1} placeholder="Montant propose" /></FieldRow>
      <FieldRow label="Message (optionnel)"><Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ex : reprise complete, maintien de l equipe..." /></FieldRow>
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose} disabled={submitting}>Annuler</AppModal.Button>
        <AppModal.Button tone="money" variant="soft" onClick={submit} disabled={submitting || !business || Number(amount) <= 0}>Envoyer l offre</AppModal.Button>
      </AppModal.Footer>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="money" size="md" description="Devenir actionnaire">
      <AppModal.Header tone="money" title={business ? `Devenir actionnaire · ${business.name}` : 'Devenir actionnaire'} subtitle="Propose un pourcentage et une somme. Le proprietaire devra accepter pour partager l entreprise." />
      <AppModal.Body>
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
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose} disabled={submitting}>Annuler</AppModal.Button>
        <AppModal.Button tone="money" variant="soft" onClick={submit} disabled={submitting || !business || numericSharePercent <= 0 || numericSharePercent >= 100 || Number(amount) <= 0}>Envoyer</AppModal.Button>
      </AppModal.Footer>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="pink" size="md" description="Nouvelle relation">
      <AppModal.Header tone="pink" title="Nouvelle relation" subtitle="Choisis un vrai joueur avec qui ouvrir une relation sociale." />
      <AppModal.Body scrollable>
      <FieldRow label="Recherche"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pseudo, prenom..." /></FieldRow>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {candidates.map((player) => {
          const selected = player.id === selectedUserId;
          return <button key={player.id} type="button" onClick={() => setSelectedUserId(player.id)} className={cn('flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors', selected ? 'border-foreground bg-muted/20' : 'border-border/40 bg-muted/10 hover:bg-muted/20')}><UserAvatar player={player} className="h-9 w-9" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{player.username}</p><p className="line-clamp-2 text-xs text-muted-foreground">{player.bio?.trim() || 'Pret a ouvrir une nouvelle relation.'}</p></div>{selected ? <Pill label="Selection" color="bg-foreground text-background" /> : null}</button>;
        })}
        {candidates.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Aucun joueur disponible.</p> : null}
      </div>
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose} disabled={submitting}>Annuler</AppModal.Button>
        <AppModal.Button tone="pink" variant="soft" onClick={submit} disabled={submitting || !selectedUserId}>Creer la relation</AppModal.Button>
      </AppModal.Footer>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="pink" size="md" description="Ajouter une relation">
      <AppModal.Header tone="pink" title="Ajouter une relation" subtitle="Choisis un joueur et le type de relation." />
      <AppModal.Body scrollable>
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
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose} disabled={submitting}>Annuler</AppModal.Button>
        <AppModal.Button tone="pink" variant="soft" onClick={submit} disabled={submitting || !selectedUserId}>Ajouter</AppModal.Button>
      </AppModal.Footer>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="pink" size="md" description="Demander en mariage">
      <AppModal.Header tone="pink" title="Demander en mariage" subtitle="La demande reste en attente tant que l autre joueur ne repond pas." />
      <AppModal.Body>
      <FieldRow label="Relation eligible"><SelectBox value={relationshipId} onChange={setRelationshipId}>{relationships.map((relationship) => <option key={relationship.id} value={relationship.id}>{relationship.otherUser.username} · {relationship.connectionLevel}%</option>)}</SelectBox></FieldRow>
      <FieldRow label="Message (optionnel)"><Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Un petit mot..." /></FieldRow>
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose} disabled={submitting}>Annuler</AppModal.Button>
        <AppModal.Button tone="pink" variant="soft" onClick={submit} disabled={submitting || !relationshipId}>Envoyer</AppModal.Button>
      </AppModal.Footer>
    </AppModal>
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
  const { confirm } = useAppDialog();
  const [activeSection, setActiveSection] = useState<'deposit' | 'withdraw' | 'loanRate' | 'transferFee' | 'illegalUpgrades' | null>(null);
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
  const [productionOpen, setProductionOpen] = useState(false);
  const [manageFormationsOpen, setManageFormationsOpen] = useState(false);
  const [manageMenuOpen, setManageMenuOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [loanViewTab, setLoanViewTab] = useState<'active' | 'history'>('active');
  const [loanHistory, setLoanHistory] = useState<YouBusinessLoan[]>([]);
  const [loadingLoanHistory, setLoadingLoanHistory] = useState(false);
  const [buybackTarget, setBuybackTarget] = useState<{ shareholderId: string; username: string; sharePercent: number } | null>(null);
  const [buybackAmountInput, setBuybackAmountInput] = useState('');
  const [sendingBuybackOffer, setSendingBuybackOffer] = useState(false);

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
      setLoanViewTab('active');
      setLoanHistory([]);
      setBuybackTarget(null);
      setBuybackAmountInput('');
      setSendingBuybackOffer(false);
      setProductionOpen(false);
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

  useEffect(() => {
    if (!open || !business || business.ownerKind !== 'you' || business.typeKey !== 'bank') return;
    let cancelled = false;
    setLoadingLoanHistory(true);
    youApi.getBusinessLoansHistory(business.id)
      .then((res) => { if (!cancelled) setLoanHistory(res.data.loans); })
      .catch(() => { if (!cancelled) setLoanHistory([]); })
      .finally(() => { if (!cancelled) setLoadingLoanHistory(false); });
    return () => { cancelled = true; };
  }, [open, business?.id, business?.typeKey, business?.ownerKind]);

  const bankLoans = loanHistory.length > 0 ? loanHistory : (business?.recentLoans ?? []);
  const pendingLoans = bankLoans.filter((loan) => loan.status === 'PENDING');
  const activeLoans = bankLoans.filter((loan) => loan.status === 'ACTIVE');
  const pendingBuyoutOffers = business?.pendingBuyoutOffers.filter((offer) => offer.status === 'PENDING') ?? [];
  const pendingShareholderProposals = business?.pendingShareholderProposals.filter((proposal) => proposal.status === 'PENDING') ?? [];
  const isBank = business?.typeKey === 'bank';
  const isStartup = business?.typeKey === 'startup';
  const isTransfer = business?.typeKey === 'transfer';
  const isFormation = business?.typeKey === 'formation';
  const isIllegalMarket = business?.typeKey === 'illegal_market';
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

  const buyIllegalUpgrade = async (upgradeKey: string) => {
    if (!business) return;
    try {
      await withRouteError(() => youApi.buyIllegalBusinessUpgrade(business.id, upgradeKey), "Impossible d'acheter cette amelioration.");
      toast.success('Amelioration illegale debloquee');
      await onSubmitted(true);
    } catch {
      // withRouteError already shows a message
    }
  };

  const startResearch = async (product: YouStartupProduct) => {
    if (!business) return;

    const confirmed = await confirm({
      title: 'Lancer la recherche ?',
      description: `Voulez-vous lancer la recherche pour "${product.name}" (niv. ${product.deployedLevel + 1}) pour ${product.nextResearchCost ? formatMoney(product.nextResearchCost) : '0'} money ?`,
      confirmLabel: 'Lancer',
      cancelLabel: 'Annuler',
    });

    if (!confirmed) return;

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
    const confirmed = await confirm({
      title: `Liquider ${business.name} ?`,
      description: 'Cette action est irreversible.',
      confirmLabel: 'Liquider',
      cancelLabel: 'Annuler',
      variant: 'destructive',
    });
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

  const openShareBuybackDialog = (shareholderId: string, username: string, sharePercent: number) => {
    setBuybackTarget({ shareholderId, username, sharePercent });
    setBuybackAmountInput('');
  };

  const closeShareBuybackDialog = () => {
    if (sendingBuybackOffer) return;
    setBuybackTarget(null);
    setBuybackAmountInput('');
  };

  const submitShareBuybackOffer = async () => {
    if (!business || !buybackTarget) return;
    const amount = Number(buybackAmountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Montant invalide', variant: 'destructive', description: 'Veuillez entrer un montant valide superieur a 0.' });
      return;
    }

    setSendingBuybackOffer(true);
    try {
      const success = await withRouteError(
        () => youApi.createShareBuybackOffer(business.id, { shareholderId: buybackTarget.shareholderId, amount }),
        'Impossible d\'envoyer l\'offre de rachat.'
      );
      if (success) {
        toast({
          title: 'Offre de rachat envoyee',
          description: `L'offre de ${amount.toLocaleString('fr-FR')} money a bien ete envoyee a ${buybackTarget.username}.`,
        });
        setBuybackTarget(null);
        setBuybackAmountInput('');
      }
    } finally {
      setSendingBuybackOffer(false);
    }
  };

  return (
    <>
    <AppModal
      open={open}
      onClose={onClose}
      tone="money"
      size="xl"
      description="Gestion de ta structure."
    >
      <AppModal.Header
        tone="money"
        title={business ? business.name : 'Entreprise'}
        subtitle="Gestion de ta structure."
        icon={<Building2 />}
      />
      {business ? (
        <div className="grid h-[500px]" style={{ gridTemplateColumns: '360px minmax(0,1fr)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* LEFT: Actions — all consistent ActionRow height */}
          <div className="overflow-y-auto p-2" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
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

              {/* Production & Ressources */}
              {business.ownerKind === 'you' && PRODUCER_TYPES.has(business.typeKey) ? (
                <ActionRow icon={Factory} label="Production & Ressources" sub="Stock, équipe, fabrication et stockage" iconBg="bg-emerald-400/15" iconColor="text-emerald-400" onClick={() => setProductionOpen(true)} />
              ) : null}

              {/* Gérer l'équipe */}
              {business.ownerKind === 'you' ? (
                <ActionRow icon={Users} label="Gérer l'équipe" sub="Salaires, invitations et départs" iconBg="bg-violet-400/15" iconColor="text-violet-400" onClick={() => setManageTeamOpen(true)} />
              ) : null}

              {/* Créer une pub */}
              {business.ownerKind === 'you' ? (
                <ActionRow
                  icon={Megaphone}
                  label="Créer une pub"
                  sub="Crée des annonces pour tes entreprises"
                  iconBg="bg-fuchsia-400/15"
                  iconColor="text-fuchsia-300"
                  onClick={() => { window.location.href = '?tab=publicites'; }}
                />
              ) : null}

              {/* Gérer le menu */}
              {business.ownerKind === 'you' && (business.typeKey === 'restaurant' || business.typeKey === 'lemonade' || business.typeKey === 'epicerie' || business.typeKey === 'illegal_market') ? (
                <ActionRow icon={Utensils} label="Gérer le menu" sub="Modifier les articles et prix" iconBg="bg-orange-400/15" iconColor="text-orange-400" onClick={() => setManageMenuOpen(true)} />
              ) : null}

              {business.ownerKind === 'you' && isIllegalMarket ? (
                <>
                  <ActionRow
                    icon={ShieldAlert}
                    label="Ameliorations illegales"
                    sub="Augmente revenus, satisfaction et XP Illegalite"
                    iconBg="bg-fuchsia-400/15"
                    iconColor="text-fuchsia-300"
                    onClick={() => toggleSection('illegalUpgrades')}
                  />
                  <InlineSection open={activeSection === 'illegalUpgrades'}>
                    <div className="space-y-2">
                      {(business.illegalUpgrades ?? []).map((upgrade) => (
                        <div key={upgrade.key} className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{upgrade.label}</p>
                              <p className="text-xs text-muted-foreground">{upgrade.description}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                +{upgrade.revenueBonus.toLocaleString('fr-FR')} EUR/mois · +{upgrade.satisfactionBonus} satisfaction
                              </p>
                            </div>
                            {upgrade.purchased ? (
                              <Pill label="Debloquee" color="bg-emerald-400/15 text-emerald-300" />
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void buyIllegalUpgrade(upgrade.key)}
                                disabled={business.treasuryMoney < upgrade.cost}
                              >
                                {formatMoney(upgrade.cost)}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      {(business.illegalUpgrades ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucune amelioration disponible.</p>
                      ) : null}
                    </div>
                  </InlineSection>
                </>
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
                          : `Lancer recherche niv. ${product.deployedLevel + 1} · ${product.nextResearchCost ? formatMoney(product.nextResearchCost) : 'Gratuit'} · ${product.nextResearchDurationMinutes ? formatDurationMinutes(product.nextResearchDurationMinutes) : '–'}`;
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
          </div>

          {/* RIGHT: Treasury + Log */}
          <div className="overflow-y-auto p-4">
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
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{shareholder.sharePercent.toFixed(2)}%</span>
                          {currentUserId === business.owner.id && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-6 text-xs px-2 h-auto py-0.5"
                              onClick={() => openShareBuybackDialog(shareholder.user.id, shareholder.user.username, shareholder.sharePercent)}
                            >
                              Racheter
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {business.shareholders.length === 0 ? <p className="text-xs text-muted-foreground">Aucun actionnaire externe pour l instant.</p> : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bank loans: active + full history */}
            {isBank ? (
              <Card>
                <CardContent className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SectionTitle>Prêts banque</SectionTitle>
                    <div className="inline-flex items-center rounded-lg border border-border/40 bg-muted/10 p-1">
                      <button
                        type="button"
                        onClick={() => setLoanViewTab('active')}
                        className={cn('rounded-md px-2.5 py-1 text-xs transition-colors', loanViewTab === 'active' ? 'bg-amber-400/20 text-amber-300' : 'text-muted-foreground hover:text-foreground')}
                      >
                        Actifs ({activeLoans.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoanViewTab('history')}
                        className={cn('rounded-md px-2.5 py-1 text-xs transition-colors', loanViewTab === 'history' ? 'bg-emerald-400/20 text-emerald-300' : 'text-muted-foreground hover:text-foreground')}
                      >
                        Historique ({bankLoans.length})
                      </button>
                    </div>
                  </div>

                  {loadingLoanHistory && bankLoans.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">Chargement de l'historique des prêts…</p>
                  ) : ((loanViewTab === 'active' ? activeLoans : bankLoans).length === 0) ? (
                    <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                      {loanViewTab === 'active' ? 'Aucun prêt actif actuellement.' : 'Aucun prêt enregistré pour cette banque.'}
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[34rem] overflow-y-auto pr-1">
                      {(loanViewTab === 'active' ? activeLoans : bankLoans).map((loan) => {
                        const totalOwed = Math.round(loan.amount * (1 + loan.interestRate / 100));
                        const repaid = loan.repaidAmount ?? 0;
                        const remaining = Math.max(0, totalOwed - repaid);
                        const borrowerMoney = Number(loan.borrower.money ?? 0);
                        const borrowerAura = Number(loan.borrower.aura ?? 0);
                        const canBorrowerRepayNow = borrowerMoney >= remaining;
                        const pct = totalOwed > 0 ? Math.round((repaid / totalOwed) * 100) : 0;
                        const dueDate = getLoanDueDate(loan);
                        const isPastDue = loan.status === 'ACTIVE' && new Date() >= dueDate;
                        const canClaimCollateral = isPastDue && loan.collateralAuraHeld > 0;
                        const isActive = loan.status === 'ACTIVE';
                        return (
                          <div key={loan.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 space-y-2">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold">{loan.borrower.username}</p>
                                  <Pill label={getLoanStatusLabel(loan.status)} color={getLoanStatusPillColor(loan.status)} />
                                </div>
                                <p className="text-xs text-muted-foreground">{loan.amount.toLocaleString('fr-FR')} € principal · {loan.interestRate} % · {loan.termDays} jours</p>
                                <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                                  <div className="rounded-lg bg-background/50 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Reste du</p>
                                    <p className="mt-1 text-sm font-semibold text-foreground">{remaining.toLocaleString('fr-FR')} €</p>
                                  </div>
                                  <div className="rounded-lg bg-background/50 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Finance client</p>
                                    <p className="mt-1 text-sm font-semibold text-foreground">{borrowerMoney.toLocaleString('fr-FR')} €</p>
                                    <p className="text-[11px] text-amber-300/90">Aura: {borrowerAura.toLocaleString('fr-FR')}</p>
                                  </div>
                                  <div className="rounded-lg bg-background/50 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Echeance</p>
                                    <p className={`mt-1 text-sm font-semibold ${isPastDue ? 'text-rose-400' : 'text-foreground'}`}>{formatLoanDate(dueDate)}</p>
                                  </div>
                                  <div className="rounded-lg bg-background/50 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Temps restant</p>
                                    <p className={`mt-1 text-sm font-semibold ${isPastDue ? 'text-rose-400' : 'text-foreground'}`}>{isActive ? getLoanTimeLeftLabel(loan) : '-'}</p>
                                  </div>
                                  <div className="rounded-lg bg-background/50 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Accorde le</p>
                                    <p className="mt-1 text-sm font-semibold text-foreground">{formatLoanDate(loan.decidedAt ?? loan.createdAt)}</p>
                                  </div>
                                </div>
                                {loan.collateralAura > 0 || loan.collateralAuraHeld > 0 ? (
                                  <p className="mt-2 text-xs text-amber-400">Hypothèque aura: {Math.max(loan.collateralAuraHeld, loan.collateralAura).toLocaleString('fr-FR')}</p>
                                ) : null}
                                {loan.motivationMessage ? <p className="mt-2 text-xs text-muted-foreground">Motivation: "{loan.motivationMessage}"</p> : null}
                                <p className="mt-2 text-xs text-muted-foreground">{repaid.toLocaleString('fr-FR')} / {totalOwed.toLocaleString('fr-FR')} € rembourses</p>
                                <p className={`mt-1 text-xs ${canBorrowerRepayNow ? 'text-emerald-300' : 'text-muted-foreground'}`}>
                                  {canBorrowerRepayNow
                                    ? 'Le client peut rembourser integralement maintenant.'
                                    : `Le client ne peut pas encore solder le pret (manque ${(remaining - borrowerMoney).toLocaleString('fr-FR')} €).`}
                                </p>
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
                              ) : isActive ? (
                                <p className="shrink-0 text-xs text-muted-foreground">Remboursement en cours</p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
        </div>
      ) : null}
    </AppModal>

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
      <ManageMenuModal
        open={manageMenuOpen}
        onClose={() => setManageMenuOpen(false)}
        business={business}
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

    {business ? (
      <ProductionModal open={productionOpen} onClose={() => setProductionOpen(false)} business={business} currentUserId={currentUserId} onReload={onSubmitted} />
    ) : null}

    <AppModal
      open={Boolean(buybackTarget)}
      onClose={closeShareBuybackDialog}
      tone="money"
      size="md"
      description="Proposer un rachat de parts"
    >
      <AppModal.Header
        tone="money"
        title="Proposer un rachat de parts"
        subtitle={buybackTarget
          ? `Tu proposes une offre pour racheter ${buybackTarget.sharePercent.toFixed(2)}% detenus par ${buybackTarget.username}.`
          : 'Tu proposes une offre de rachat.'}
      />
      <AppModal.Body>
      <FieldRow label="Montant propose (money)">
        <Input
          type="number"
          min={1}
          value={buybackAmountInput}
          onChange={(event) => setBuybackAmountInput(event.target.value)}
          placeholder="Exemple: 250000"
          disabled={sendingBuybackOffer}
        />
      </FieldRow>
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={closeShareBuybackDialog} disabled={sendingBuybackOffer}>Annuler</AppModal.Button>
        <AppModal.Button tone="money" variant="soft" onClick={() => void submitShareBuybackOffer()} disabled={sendingBuybackOffer || Number(buybackAmountInput) <= 0}>
          {sendingBuybackOffer ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Envoyer l offre
        </AppModal.Button>
      </AppModal.Footer>
    </AppModal>
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
  const { confirm } = useAppDialog();
  const [sackingId, setSackingId] = useState<string | null>(null);
  const [reviewingInvitationId, setReviewingInvitationId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<typeof business.members[number] | null>(null);

  useEffect(() => {
    if (!open) setEditingMember(null);
  }, [open]);

  const sack = async (memberId: string) => {
    const confirmed = await confirm({
      title: 'Renvoyer cet employe ?',
      description: 'Il perdra l acces a l entreprise.',
      confirmLabel: 'Renvoyer',
      cancelLabel: 'Annuler',
      variant: 'destructive',
    });
    if (!confirmed) return;
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
      <AppModal open={open} onClose={onClose} tone="cyan" size="md" description="Gérer l'équipe">
        <AppModal.Header tone="cyan" title="Gérer l'équipe" subtitle={`${activeMembers.length} membre(s) actif(s)`} />
        <AppModal.Body scrollable>
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
        </AppModal.Body>
      </AppModal>

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

const LAW_ROLES: { value: string; label: string; isManager: boolean }[] = [
  { value: 'Associé', label: 'Associé', isManager: true },
  { value: 'Associée', label: 'Associée', isManager: true },
  { value: 'Collaborateur', label: 'Collaborateur', isManager: false },
  { value: 'Collaboratrice', label: 'Collaboratrice', isManager: false },
  { value: 'Stagiaire', label: 'Stagiaire', isManager: false },
  { value: 'Of Counsel', label: 'Of Counsel', isManager: false },
];

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
  const [lawRole, setLawRole] = useState('Collaborateur');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);

  const isLawFirm = business.typeKey === 'law_firm';

  useEffect(() => {
    if (member) {
      setSalary(String(member.salary ?? 0));
      setTitle(isLawFirm ? '' : (member.specialty ?? ''));
      setSpecialty(isLawFirm ? (member.specialty ?? '') : '');
      const knownRole = LAW_ROLES.find((r) => r.value === member.role);
      setLawRole(knownRole ? member.role : 'Collaborateur');
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
            role: lawRole,
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
    <AppModal open={open} onClose={onClose} tone="cyan" size="md" description={`${roleLabel} · ${business.name}`}>
      <AppModal.Header tone="cyan" title={member.user.username} subtitle={`${roleLabel} · ${business.name}`} />
      <AppModal.Body scrollable>
      <div className="flex items-center gap-4 rounded-xl border border-border/40 bg-muted/10 px-4 py-4">
        <UserAvatar player={member.user} className="h-12 w-12 shrink-0" />
        <div>
          <p className="font-semibold">{member.user.username}</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
          {isLawFirm && member.specialty ? <p className="text-xs text-muted-foreground/70">{member.specialty}</p> : null}
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
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Titre</p>
            <SelectBox value={lawRole} onChange={setLawRole}>
              {LAW_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}{r.isManager ? ' ★' : ''}</option>
              ))}
            </SelectBox>
            <p className="text-[11px] text-muted-foreground/60">
              Les <span className="text-indigo-300">Associé(e)s ★</span> ont accès à la gestion du cabinet (invitations, trésorerie…).
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Expertise</p>
            <Input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="h-10 text-sm"
              placeholder="ex: Droit pénal, Droit des affaires…"
              maxLength={60}
            />
            <p className="text-[11px] text-muted-foreground/60">Purement indicatif — affiché sur la fiche publique du cabinet.</p>
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

      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose} disabled={saving}>Annuler</AppModal.Button>
        <AppModal.Button tone="cyan" variant="soft" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
          Sauvegarder
        </AppModal.Button>
      </AppModal.Footer>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="cyan" size="md" description={`${members.length} membre(s)`}>
      <AppModal.Header tone="cyan" title={`Équipe · ${business.name}`} subtitle={`${members.length} membre(s)`} />
      <AppModal.Body scrollable>
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
      </AppModal.Body>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="money" size="md" description="Mes comptes bancaires">
      <AppModal.Header tone="money" title={business ? `Mes comptes · ${business.name}` : 'Mes comptes bancaires'} subtitle="Déposez et retirez de l'argent." />
      <AppModal.Body scrollable>
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
      </AppModal.Body>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="blue" size="md" description="Accède à la formation proposée par ce centre.">
      <AppModal.Header tone="blue" title={business ? business.name : 'Formation'} subtitle="Accède à la formation proposée par ce centre." />
      <AppModal.Body scrollable>
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
        </div>
      )}
      </AppModal.Body>
      {!purchased ? (
        <AppModal.Footer>
          <AppModal.Button variant="ghost" onClick={onClose} disabled={buying}>Annuler</AppModal.Button>
          <AppModal.Button tone="blue" variant="soft" onClick={() => void buy()} disabled={buying}>
            Acheter · {price.toLocaleString('fr-FR')} €
          </AppModal.Button>
        </AppModal.Footer>
      ) : null}
    </AppModal>
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
  const { confirm } = useAppDialog();
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
    const confirmed = await confirm({
      title: 'Supprimer cette formation ?',
      description: 'Cette action est irreversible.',
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      variant: 'destructive',
    });
    if (!confirmed) return;
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
    <AppModal open={open} onClose={onClose} tone="blue" size="xl" description="Ajoute, modifie ou supprime les formations vendues sur ce centre.">
      <AppModal.Header tone="blue" title="Gérer les formations" subtitle="Ajoute, modifie ou supprime les formations vendues sur ce centre." />
      <AppModal.Body scrollable>
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
      </AppModal.Body>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="neutral" size="md" description="Personnalise le nom, la description et le logo de ton entreprise.">
      <AppModal.Header tone="neutral" title="Modifier le profil" subtitle="Personnalise le nom, la description et le logo de ton entreprise." />
      <AppModal.Body scrollable>
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
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose} disabled={saving}>Annuler</AppModal.Button>
        <AppModal.Button tone="neutral" variant="soft" onClick={() => void save()} disabled={saving || !name.trim()}>Enregistrer</AppModal.Button>
      </AppModal.Footer>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="blue" size="xl" description={catalogDescription}>
      <AppModal.Header tone="blue" title={business.name} subtitle={catalogDescription} />
      <AppModal.Body scrollable>
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
      </AppModal.Body>
    </AppModal>
  );
}

type MenuItem = { key: string; label: string; price: number; emoji: string; imageUrl: string; section: string };

function MenuItemImagePicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).replace(/^data:[^;]+;base64,/, ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await uploadUserImage({ base64Data, mimeType: file.type });
      onChange(res.data.imageUrl);
    } catch {
      toast.error('Erreur lors du téléchargement');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {value ? (
        <div className="relative h-9 w-9 shrink-0">
          <img src={resolveImageUrl(value)} className="h-9 w-9 rounded object-cover border border-border/40" alt="" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center text-[10px]"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded border border-dashed border-border/60 hover:border-border text-muted-foreground hover:text-foreground transition-colors"
          title="Ajouter une image"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

export function ManageMenuModal({
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
  const getDefaults = (typeKey: string) => {
    switch(typeKey) {
      case 'lemonade': return [
        { key: 'citronnade', label: 'Citronnade', price: 10, emoji: '🍋' },
        { key: 'limonade_fraise', label: 'Limonade fraise', price: 15, emoji: '🍓' },
        { key: 'eau_petillante', label: 'Eau pétillante', price: 8, emoji: '💧' },
      ];
      case 'epicerie': return [
        { key: 'baguette', label: 'Baguette', price: 5, emoji: '🥖' },
        { key: 'fromage', label: 'Fromage', price: 20, emoji: '🧀' },
        { key: 'vin', label: 'Vin', price: 35, emoji: '🍷' },
        { key: 'confiture', label: 'Confiture', price: 12, emoji: '🫙' },
      ];
      case 'restaurant': return [
        { key: 'burger', label: 'Burger', price: 15, emoji: '🍔' },
        { key: 'pizza', label: 'Pizza', price: 18, emoji: '🍕' },
        { key: 'fried_chicken', label: 'Poulet Frit', price: 12, emoji: '🍗' },
        { key: 'soda', label: 'Soda', price: 5, emoji: '🥤' },
      ];
      case 'illegal_market': return [
        { key: 'puff', label: 'Puff', price: 45, emoji: '🚬' },
        { key: 'weed_pack', label: 'Pack de weed', price: 110, emoji: '🌿' },
        { key: 'resine', label: 'Resine', price: 160, emoji: '🧪' },
        { key: 'pilules', label: 'Pilules', price: 220, emoji: '💊' },
      ];
      default: return [];
    }
  };

  const sourceItems = business.customData ?? getDefaults(business.typeKey);

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [draggedItemIdx, setDraggedItemIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setMenu(sourceItems.map((item: any) => ({
        key: item.key || Math.random().toString(36).substring(7),
        label: item.label ?? '',
        price: item.price ?? 5,
        emoji: item.emoji ?? '',
        imageUrl: item.imageUrl ?? '',
        section: item.section ?? '',
      })));
    }
  }, [open, business]);

  const updateItem = (idx: number, patch: Partial<MenuItem>) => {
    setMenu((prev) => { const n = [...prev]; n[idx] = { ...n[idx]!, ...patch }; return n; });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = menu.filter((m) => m.label.trim().length > 0).map((m) => ({
        key: m.key,
        label: m.label.trim().substring(0, 50),
        price: Math.max(1, Math.min(100000, Number(m.price))),
        emoji: m.emoji.trim().substring(0, 10),
        imageUrl: m.imageUrl.trim() || undefined,
        section: m.section?.trim().substring(0, 50) || '',
      }));

      await withRouteError(() => youApi.updateBusinessMenu(business.id, payload), 'Impossible de mettre à jour le menu.');
      toast.success('Menu à jour');
      await onSubmitted();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal open={open} onClose={onClose} tone="orange" size="lg" description="Modifie au maximum 20 articles. Emoji ou image au choix.">
      <AppModal.Header tone="orange" title={`Menu : ${business.name}`} subtitle="Modifie au maximum 20 articles. Emoji ou image au choix." />
      <AppModal.Body scrollable>
      <div className="space-y-3">
        {menu.map((item, idx) => (
          <div
            key={item.key}
            draggable
            onDragStart={(e) => { setDraggedItemIdx(idx); e.currentTarget.style.opacity = '0.5'; }}
            onDragEnd={(e) => { setDraggedItemIdx(null); e.currentTarget.style.opacity = '1'; }}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              if (draggedItemIdx === null || draggedItemIdx === idx) return;
              e.preventDefault();
              const newMenu = [...menu];
              const [dragged] = newMenu.splice(draggedItemIdx, 1);
              newMenu.splice(idx, 0, dragged!);
              setMenu(newMenu);
              setDraggedItemIdx(null);
            }}
            className="flex flex-col gap-2 rounded-xl border border-border/40 p-2 cursor-grab active:cursor-grabbing hover:bg-muted/10 transition-colors"
          >
            <div className="flex gap-2 items-center w-full">
              <div title="Maintient pour glisser" className="select-none text-muted-foreground mr-1">⋮⋮</div>
              <Input
                placeholder="Section"
                value={item.section}
                onChange={(e) => updateItem(idx, { section: e.target.value })}
                className="w-[120px] text-xs h-9"
              />
              {/* Emoji or image — image takes priority */}
              {item.imageUrl ? (
                <MenuItemImagePicker value={item.imageUrl} onChange={(url) => updateItem(idx, { imageUrl: url })} />
              ) : (
                <div className="flex items-center gap-1">
                  <Input
                    placeholder="Emoji"
                    value={item.emoji}
                    onChange={(e) => updateItem(idx, { emoji: e.target.value })}
                    className="w-[58px] h-9"
                  />
                  <MenuItemImagePicker value="" onChange={(url) => updateItem(idx, { imageUrl: url, emoji: '' })} />
                </div>
              )}
              <Input
                placeholder="Nom"
                value={item.label}
                onChange={(e) => updateItem(idx, { label: e.target.value })}
                className="flex-1 h-9"
              />
              <Input
                type="number"
                placeholder="Prix"
                value={item.price}
                onChange={(e) => updateItem(idx, { price: Number(e.target.value) })}
                className="w-20 h-9"
                min={1}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-400"
                onClick={() => setMenu((prev) => prev.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {menu.length < 20 && (
          <Button
            variant="outline"
            className="w-full mt-2"
            onClick={() => setMenu((prev) => [...prev, { key: Math.random().toString(36).substring(7), label: '', price: 10, emoji: '🍔', imageUrl: '', section: '' }])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un article
          </Button>
        )}
      </div>
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose} disabled={saving}>Annuler</AppModal.Button>
        <AppModal.Button tone="orange" variant="soft" onClick={() => void save()} disabled={saving || menu.length === 0 || menu.some(m => !m.label.trim() || Number(m.price) < 1)}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer
        </AppModal.Button>
      </AppModal.Footer>
    </AppModal>
  );
}

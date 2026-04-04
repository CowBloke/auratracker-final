import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Building2,
  ChevronDown,
  ChevronRight,
  Coffee,
  GraduationCap,
  HandCoins,
  Landmark,
  PiggyBank,
  Search,
  ShieldAlert,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { type YouBusiness, type YouPlayer, type YouState, youApi } from '@/services/api';
import {
  BankAccountModal,
  BuyoutOfferModal,
  FormationCatalogModal,
  InvestModal,
  LoanModal,
  ShareholderProposalModal,
  TransferBusinessModal,
} from '../components/modals';
import { Input, ModalWrap, Pill, SectionTitle } from '../components/ui';
import { BUSINESS_ICON_MAP, BUSINESS_STYLE_MAP } from '../constants';
import { withRouteError } from '../utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

function formatMoney(n: number) {
  return `${n.toLocaleString('fr-FR')} EUR`;
}

const BUSINESS_TYPE_ORDER = ['bank', 'transfer', 'formation', 'startup', 'agency', 'lemonade', 'epicerie', 'coffee_shop'] as const;

const SECTION_META: Record<
  (typeof BUSINESS_TYPE_ORDER)[number],
  { label: string; icon: typeof Building2; pillColor: string }
> = {
  bank: { label: 'Banks', icon: Landmark, pillColor: 'bg-emerald-400/15 text-emerald-400' },
  transfer: { label: 'Transfer', icon: ArrowLeftRight, pillColor: 'bg-cyan-400/15 text-cyan-300' },
  formation: { label: 'Formations', icon: GraduationCap, pillColor: 'bg-amber-400/15 text-amber-400' },
  startup: { label: 'Tech startups', icon: TrendingUp, pillColor: 'bg-sky-400/15 text-sky-400' },
  agency: { label: 'Agencies', icon: Building2, pillColor: 'bg-violet-400/15 text-violet-400' },
  lemonade: { label: 'Stands limonade', icon: Store, pillColor: 'bg-yellow-400/15 text-yellow-400' },
  epicerie: { label: 'Epiceries', icon: ShoppingBasket, pillColor: 'bg-lime-400/15 text-lime-400' },
  coffee_shop: { label: 'Coffee Shops', icon: Coffee, pillColor: 'bg-orange-400/15 text-orange-400' },
};

function isNewBusiness(business: YouBusiness) {
  const foundedAt = new Date(business.foundedAt).getTime();
  if (Number.isNaN(foundedAt)) return false;
  return Date.now() - foundedAt < 3 * 24 * 60 * 60 * 1000;
}

function getBusinessRevenue(business: YouBusiness) {
  return business.monthlyRevenue;
}

function BusinessHeader({ business, userId }: { business: YouBusiness; userId: string }) {
  const Icon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
  const style = BUSINESS_STYLE_MAP[business.typeKey as keyof typeof BUSINESS_STYLE_MAP] ?? { iconWrap: 'bg-muted/20', icon: 'text-foreground' };
  return (
    <div className="flex items-center gap-3">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', style.iconWrap)}>
        <Icon className={cn('h-5 w-5', style.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{business.name}</p>
          {business.verified ? <Pill label="Verifie" color="bg-emerald-400/15 text-emerald-400" /> : null}
          {isNewBusiness(business) ? <Pill label="New" color="bg-rose-400/15 text-rose-300" /> : null}
          {business.ownerId === userId ? <Pill label="A toi" color="bg-purple-400/15 text-purple-400" /> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {business.type?.label ?? business.typeKey} · {business.owner.username} · {business.foundedLabel}
        </p>
      </div>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{label}</p>
      <p className={cn('mt-1 text-base font-bold tabular-nums', color ?? 'text-foreground')}>{value}</p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  sub,
  tone,
  onClick,
  primary,
  disabled,
}: {
  icon: typeof Building2;
  label: string;
  sub?: string;
  tone: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const [toneBg, toneText] = tone.split(' ');
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
        primary ? 'border-transparent bg-muted/20 hover:bg-muted/30' : 'border-border/40 bg-muted/10 hover:bg-muted/20',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', toneBg)}>
        <Icon className={cn('h-4 w-4', toneText)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
    </button>
  );
}

function StartupProductsReadonly({ business }: { business: YouBusiness }) {
  if (!business.startupProducts.length) return null;
  return (
    <div className="space-y-2">
      {business.startupProducts.map((product) => {
        const isActive = product.isResearchActive || product.canDeploy;
        return (
          <div key={product.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">Niveau {product.deployedLevel}/10</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-sky-300">+{product.currentRevenue.toLocaleString('fr-FR')} EUR</p>
                {isActive ? <span className="mt-0.5 inline-block text-[10px] text-amber-400">{product.isResearchActive ? 'En recherche' : 'Pret'}</span> : null}
              </div>
            </div>
            {isActive ? (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${product.progressPercent}%` }} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// --- Business Interaction Modal ---

function BusinessInteractionModal({
  business,
  userId,
  isAdmin,
  onClose,
  onAction,
  onAdminDelete,
}: {
  business: YouBusiness | null;
  userId: string;
  isAdmin: boolean;
  onClose: () => void;
  onAction: (action: 'bank' | 'loan' | 'invest' | 'buyout' | 'shareholder' | 'transfer' | 'formation' | 'purchase' | 'apply') => void;
  onAdminDelete: () => Promise<void>;
}) {
  if (!business) return null;

  const isOwned = business.ownerId === userId;
  const isEmployee = business.members.some((member) => member.user.id === userId);
  const hasPendingApplication = business.pendingInvitations.some((invitation) => invitation.employee.id === userId);
  const canApply = !isOwned && !isEmployee && !hasPendingApplication && business.hiring;
  const profit = business.monthlyRevenue - business.monthlyExpenses;
  const formationComments = business.typeKey === 'formation'
    ? business.ratings.filter((entry) => entry.comment && entry.comment.trim().length > 0)
    : [];

  const stats = (() => {
    if (business.typeKey === 'bank') return [
      { label: 'Tresorerie', value: formatMoney(business.treasuryMoney), color: 'text-emerald-400' },
      { label: "Taux d'emprunt", value: `${business.loanInterestRate ?? 4} %`, color: 'text-amber-400' },
    ];
    if (business.typeKey === 'transfer') return [
      { label: 'Tresorerie', value: formatMoney(business.treasuryMoney), color: 'text-emerald-400' },
      { label: 'Frais', value: `${business.transferFeeRate ?? 2} %`, color: 'text-cyan-400' },
    ];
    if (business.typeKey === 'formation') return [
      { label: 'Revenue mensuel', value: formatMoney(business.monthlyRevenue), color: 'text-emerald-400' },
      { label: 'Formations', value: `${business.formationProducts?.length ?? 0} disponible(s)`, color: 'text-amber-400' },
    ];
    if (business.typeKey === 'lemonade' || business.typeKey === 'epicerie') return [
      { label: 'Revenue mensuel', value: formatMoney(business.monthlyRevenue), color: 'text-emerald-400' },
      { label: 'Tresorerie', value: formatMoney(business.treasuryMoney), color: 'text-muted-foreground' },
    ];
    return [
      { label: 'Profit mensuel', value: formatMoney(profit), color: profit >= 0 ? 'text-emerald-400' : 'text-red-400' },
      { label: 'Satisfaction', value: `${business.satisfaction}/100`, color: 'text-sky-400' },
    ];
  })();

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto p-0">
        <DialogTitle className="sr-only">{business.name}</DialogTitle>
        <div className="space-y-4 p-6">
          {/* Header */}
          <BusinessHeader business={business} userId={userId} />
          {business.description ? (
            <p className="text-xs text-muted-foreground">{business.description}</p>
          ) : null}

          {/* Admin controls */}
          {isAdmin ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-amber-300">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Mode admin</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 w-full justify-start border-red-400/30 text-red-300 hover:bg-red-500/10"
                onClick={() => { void onAdminDelete(); onClose(); }}
              >
                Supprimer ce business
              </Button>
            </div>
          ) : null}

          {/* Owned business */}
          {isOwned ? (
            <div className="rounded-xl border border-border/40 bg-muted/10 px-5 py-6 text-center">
              <p className="text-sm font-medium text-muted-foreground">C'est ton entreprise.</p>
              <p className="mt-1 text-xs text-muted-foreground/60">Gere-la depuis l'onglet Travail.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Primary action */}
              {business.typeKey === 'bank' ? (
                <ActionButton
                  icon={Landmark}
                  label="Gerer mes comptes"
                  sub={`Taux d'emprunt : ${business.loanInterestRate ?? 4} % · ${business.livretEpargneUnlocked ? 'Livret epargne dispo' : 'Compte courant'}`}
                  tone="bg-emerald-400/15 text-emerald-400"
                  primary
                  onClick={() => onAction('bank')}
                />
              ) : business.typeKey === 'transfer' ? (
                <ActionButton
                  icon={ArrowLeftRight}
                  label="Envoyer de l'argent"
                  sub={`Frais de service : ${business.transferFeeRate ?? 2} %`}
                  tone="bg-cyan-400/15 text-cyan-300"
                  primary
                  onClick={() => onAction('transfer')}
                />
              ) : business.typeKey === 'lemonade' ? (
                <ActionButton
                  icon={Store}
                  label="Acheter"
                  sub="Parcourir les articles disponibles"
                  tone="bg-yellow-400/15 text-yellow-400"
                  primary
                  onClick={() => onAction('purchase')}
                />
              ) : business.typeKey === 'epicerie' ? (
                <ActionButton
                  icon={ShoppingBasket}
                  label="Acheter"
                  sub="Parcourir les articles disponibles"
                  tone="bg-lime-400/15 text-lime-400"
                  primary
                  onClick={() => onAction('purchase')}
                />
              ) : business.typeKey === 'agency' ? (
                <ActionButton
                  icon={Building2}
                  label="Acheter un bien immobilier"
                  sub="Studio, appartement, maison, villa — gagne du XP Social."
                  tone="bg-violet-400/15 text-violet-400"
                  primary
                  onClick={() => onAction('purchase')}
                />
              ) : business.typeKey === 'coffee_shop' ? (
                <ActionButton
                  icon={Coffee}
                  label="Investir"
                  sub="Le rendement depend du niveau de risque choisi."
                  tone="bg-orange-400/15 text-orange-400"
                  primary
                  onClick={() => onAction('invest')}
                />
              ) : business.typeKey === 'formation' ? (
                <ActionButton
                  icon={GraduationCap}
                  label={(business.formationProducts?.length ?? 0) > 0 ? 'Acceder aux formations' : 'Formations non disponibles'}
                  sub={(business.formationProducts?.length ?? 0) > 0
                    ? `${business.formationProducts!.length} formation(s) disponible(s)`
                    : "Le proprietaire n'a pas encore mis de formations en ligne."}
                  tone="bg-amber-400/15 text-amber-400"
                  primary
                  disabled={(business.formationProducts?.length ?? 0) === 0}
                  onClick={() => onAction('formation')}
                />
              ) : business.typeKey === 'startup' ? (
                <div className="space-y-3">
                  <StartupProductsReadonly business={business} />
                  <ActionButton
                    icon={TrendingUp}
                    label="Investir dans cette startup"
                    sub="Le rendement depend du niveau de risque choisi."
                    tone="bg-sky-400/15 text-sky-400"
                    primary
                    onClick={() => onAction('invest')}
                  />
                </div>
              ) : (
                <ActionButton
                  icon={TrendingUp}
                  label="Investir"
                  sub="Le rendement depend du niveau de risque choisi."
                  tone="bg-sky-400/15 text-sky-400"
                  primary
                  onClick={() => onAction('invest')}
                />
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                {stats.map((s) => <StatTile key={s.label} label={s.label} value={s.value} color={s.color} />)}
              </div>

              {canApply ? (
                <ActionButton
                  icon={HandCoins}
                  label="Postuler"
                  sub="Envoyer une proposition de role et de salaire au proprietaire."
                  tone="bg-violet-400/15 text-violet-300"
                  onClick={() => onAction('apply')}
                />
              ) : hasPendingApplication ? (
                <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 px-4 py-3 text-xs text-muted-foreground">
                  Une candidature ou proposition de contrat est deja en attente pour toi.
                </div>
              ) : null}

              {business.typeKey === 'formation' ? (
                <div className="space-y-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Avis clients</p>
                      <p className="text-xs text-muted-foreground">
                        {business.avgRating !== null
                          ? `${business.avgRating.toFixed(1)}/5 · ${business.ratingCount} avis`
                          : 'Aucun avis pour le moment'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400">
                      <Star className="h-4 w-4 fill-amber-400" />
                      <span className="text-sm font-semibold">{business.avgRating?.toFixed(1) ?? '--'}</span>
                    </div>
                  </div>

                  {formationComments.length > 0 ? (
                    <div className="space-y-2">
                      {formationComments.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="rounded-xl border border-border/40 bg-background/60 px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{entry.user.username}</p>
                            <span className="flex items-center gap-1 text-xs font-semibold text-amber-400">
                              <Star className="h-3.5 w-3.5 fill-amber-400" />
                              {entry.rating}/5
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(entry.updatedAt).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="mt-2 text-sm text-foreground/90">{entry.comment}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Pas encore de commentaire visible pour cette formation.</p>
                  )}
                </div>
              ) : null}

              {business.isShared ? (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/8 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-300">Capital partage</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fondateur: {business.ownerSharePercent.toFixed(2)}% · {business.shareholders.length} actionnaire(s)
                    {business.viewerSharePercent > 0 ? ` · toi: ${business.viewerSharePercent.toFixed(2)}%` : ''}
                  </p>
                </div>
              ) : null}

              {business.typeKey === 'bank' && business.livretEpargneUnlocked ? (
                <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-xs text-amber-300">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>Livret epargne disponible · +0,5 % / jour</span>
                </div>
              ) : null}

              {/* Secondary actions */}
              <div className="space-y-2 pt-1">
                <SectionTitle>Autres actions</SectionTitle>
                {business.typeKey === 'bank' ? (
                  <ActionButton
                    icon={Landmark}
                    label="Demander un pret"
                    sub={`Taux ${business.loanInterestRate ?? 4} % · Le proprietaire doit accepter.`}
                    tone="bg-amber-400/15 text-amber-400"
                    onClick={() => onAction('loan')}
                  />
                ) : null}
                <ActionButton
                  icon={HandCoins}
                  label={business.viewerSharePercent > 0 ? 'Augmenter ma participation' : 'Devenir actionnaire'}
                  sub="Proposer un pourcentage et une somme au proprietaire."
                  tone="bg-amber-400/15 text-amber-400"
                  onClick={() => onAction('shareholder')}
                />
                <ActionButton
                  icon={HandCoins}
                  label="Faire une offre de rachat"
                  sub="Le montant est bloque jusqu'a la decision du proprietaire."
                  tone="bg-rose-400/15 text-rose-400"
                  onClick={() => onAction('buyout')}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Purchase Item Modal for lemonade/epicerie ---

const ITEMS_CONFIG: Record<string, Array<{ key: string; label: string; price: number; emoji?: string; xpHint?: string }>> = {
  lemonade: [
    { key: 'citronnade', label: 'Citronnade', price: 10, emoji: '🍋' },
    { key: 'limonade_fraise', label: 'Limonade fraise', price: 15, emoji: '🍓' },
    { key: 'eau_petillante', label: 'Eau petillante', price: 8, emoji: '💧' },
  ],
  epicerie: [
    { key: 'baguette', label: 'Baguette', price: 5, emoji: '🥖' },
    { key: 'fromage', label: 'Fromage', price: 20, emoji: '🧀' },
    { key: 'vin', label: 'Vin', price: 35, emoji: '🍷' },
    { key: 'confiture', label: 'Confiture', price: 12, emoji: '🫙' },
  ],
  agency: [
    { key: 'studio', label: 'Studio 20m²', price: 800, emoji: '🏠', xpHint: '+5 XP Social' },
    { key: 'appartement', label: 'Appartement T3', price: 3000, emoji: '🏢', xpHint: '+6 XP Social' },
    { key: 'maison', label: 'Maison avec jardin', price: 8000, emoji: '🏡', xpHint: '+16 XP Social' },
    { key: 'villa', label: 'Villa de luxe', price: 25000, emoji: '🏰', xpHint: '+50 XP Social' },
  ],
};

function PurchaseItemModal({ open, onClose, business, onSubmitted }: { open: boolean; onClose: () => void; business: YouBusiness | null; onSubmitted: () => void }) {
  const [buying, setBuying] = useState<string | null>(null);
  if (!business) return null;

  const items = ITEMS_CONFIG[business.typeKey] ?? [];

  const buy = async (itemKey: string) => {
    setBuying(itemKey);
    try {
      await withRouteError(() => youApi.purchaseItem(business.id, itemKey), 'Impossible d\'acheter cet article.');
      const item = items.find((i) => i.key === itemKey);
      toast.success(`${item?.label ?? 'Article'} acheté !`);
      onSubmitted();
    } finally {
      setBuying(null);
    }
  };

  const isAgency = business.typeKey === 'agency';

  return (
    <ModalWrap open={open} onClose={onClose} title={business.name} desc={isAgency ? 'Acheter un bien immobilier. Gagne du XP Social.' : 'Parcourir les articles disponibles.'}>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-400/15 text-lg">
                {item.emoji ?? <ShoppingCart className="h-4 w-4 text-yellow-400" />}
              </div>
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.price.toLocaleString('fr-FR')} money</p>
                {item.xpHint ? <p className="text-[10px] text-purple-400/80">{item.xpHint}</p> : null}
              </div>
            </div>
            <Button size="sm" onClick={() => void buy(item.key)} disabled={buying !== null}>
              {isAgency ? 'Acheter' : 'Acheter'}
            </Button>
          </div>
        ))}
      </div>
    </ModalWrap>
  );
}

// --- Rating Modal ---

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              'h-8 w-8 transition-colors',
              (hovered || value) >= star ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-muted-foreground/30',
            )}
          />
        </button>
      ))}
    </div>
  );
}

function RatingModal({
  open,
  onClose,
  businessId,
  businesses,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string | null;
  businesses: YouBusiness[];
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const business = businessId ? businesses.find((b) => b.id === businessId) ?? null : null;

  useEffect(() => {
    if (!open) {
      setRating(0);
      setComment('');
    }
  }, [open]);

  const LABELS: Record<number, string> = {
    1: 'Tres mauvais',
    2: 'Mauvais',
    3: 'Correct',
    4: 'Bien',
    5: 'Excellent !',
  };

  const submit = async () => {
    if (!businessId || rating === 0) return;
    setSubmitting(true);
    try {
      await youApi.rateBusiness(businessId, rating, comment.trim());
      toast.success('Note enregistree, merci !');
      onSubmitted();
      onClose();
    } catch {
      toast.error('Impossible d\'enregistrer la note.');
    } finally {
      setSubmitting(false);
      setRating(0);
      setComment('');
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title="Comment c'etait ?" centerTitle>
      {business ? (
        <div className="space-y-6 text-center">
          <p className="text-sm text-muted-foreground">
            Note le service de <span className="font-semibold text-foreground">{business.name}</span>
          </p>
          <StarRatingInput value={rating} onChange={setRating} />
          {rating > 0 ? (
            <p className="text-sm font-medium text-amber-400">{LABELS[rating]}</p>
          ) : (
            <p className="text-xs text-muted-foreground/60">Clique sur une etoile</p>
          )}
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
            placeholder="Ajoute un commentaire..."
            className="min-h-24 w-full rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-amber-400/40"
          />
          <p className="text-[11px] text-muted-foreground/60">{comment.trim().length}/500</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
              Passer
            </Button>
            <Button className="flex-1" onClick={() => void submit()} disabled={rating === 0 || submitting}>
              Envoyer
            </Button>
          </div>
        </div>
      ) : null}
    </ModalWrap>
  );
}

// --- Main ExploreTab ---

export function ExploreTab({
  data,
  players,
  userId,
  isAdmin,
  onReload,
}: {
  data: YouState;
  players: YouPlayer[];
  userId: string;
  isAdmin: boolean;
  onReload: (refreshBalance?: boolean) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'you' | 'player'>('all');
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Which business's interaction modal is open
  const [detailBusinessId, setDetailBusinessId] = useState<string | null>(null);

  // Action modals (triggered after closing detail modal)
  const [bankBusinessId, setBankBusinessId] = useState<string | null>(null);
  const [loanBusinessId, setLoanBusinessId] = useState<string | null>(null);
  const [investBusinessId, setInvestBusinessId] = useState<string | null>(null);
  const [buyoutBusinessId, setBuyoutBusinessId] = useState<string | null>(null);
  const [shareholderBusinessId, setShareholderBusinessId] = useState<string | null>(null);
  const [transferBusinessId, setTransferBusinessId] = useState<string | null>(null);
  const [formationBusinessId, setFormationBusinessId] = useState<string | null>(null);
  const [purchaseBusinessId, setPurchaseBusinessId] = useState<string | null>(null);
  const [applyBusinessId, setApplyBusinessId] = useState<string | null>(null);
  const [ratingBusinessId, setRatingBusinessId] = useState<string | null>(null);

  const handleServiceSuccess = (businessId: string) => async () => {
    await onReload(true);
    setTimeout(() => setRatingBusinessId(businessId), 1000);
  };

  const allBusinesses = useMemo(
    () => [...data.ownedBusinesses, ...data.exploreBusinesses],
    [data.exploreBusinesses, data.ownedBusinesses],
  );

  const availableTypeKeys = useMemo(
    () => BUSINESS_TYPE_ORDER.filter((typeKey) => allBusinesses.some((business) => business.typeKey === typeKey)),
    [allBusinesses],
  );

  const filteredBusinesses = useMemo(
    () =>
      allBusinesses.filter((business) => {
        const query = search.trim().toLowerCase();
        const matchesType = typeFilter === 'all' || business.typeKey === typeFilter;
        const matchesOwner =
          ownerFilter === 'all' ||
          (ownerFilter === 'you' ? business.ownerId === userId : business.ownerId !== userId);
        const matchesQuery =
          !query ||
          business.name.toLowerCase().includes(query) ||
          business.owner.username.toLowerCase().includes(query) ||
          business.description?.toLowerCase().includes(query);
        return matchesType && matchesOwner && matchesQuery;
      }),
    [allBusinesses, ownerFilter, search, typeFilter, userId],
  );

  const groupedBusinesses = useMemo(
    () =>
      BUSINESS_TYPE_ORDER.map((typeKey) => ({
        typeKey,
        businesses: filteredBusinesses
          .filter((business) => business.typeKey === typeKey)
          .sort((a, b) => {
            const ratingDiff = (b.avgRating ?? 0) - (a.avgRating ?? 0);
            if (Math.abs(ratingDiff) > 0.05) return ratingDiff;
            return getBusinessRevenue(b) - getBusinessRevenue(a);
          }),
      })).filter((section) => section.businesses.length > 0),
    [filteredBusinesses],
  );

  const detailBusiness = detailBusinessId ? allBusinesses.find((b) => b.id === detailBusinessId) ?? null : null;
  const bankBusiness = bankBusinessId ? allBusinesses.find((b) => b.id === bankBusinessId) ?? null : null;
  const loanBusiness = loanBusinessId ? allBusinesses.find((b) => b.id === loanBusinessId) ?? null : null;
  const investBusiness = investBusinessId ? allBusinesses.find((b) => b.id === investBusinessId) ?? null : null;
  const buyoutBusiness = buyoutBusinessId ? allBusinesses.find((b) => b.id === buyoutBusinessId) ?? null : null;
  const shareholderBusiness = shareholderBusinessId ? allBusinesses.find((b) => b.id === shareholderBusinessId) ?? null : null;
  const transferBusiness = transferBusinessId ? allBusinesses.find((b) => b.id === transferBusinessId) ?? null : null;
  const formationBusiness = formationBusinessId ? allBusinesses.find((b) => b.id === formationBusinessId) ?? null : null;
  const purchaseBusiness = purchaseBusinessId ? allBusinesses.find((b) => b.id === purchaseBusinessId) ?? null : null;
  const applyBusiness = applyBusinessId ? allBusinesses.find((b) => b.id === applyBusinessId) ?? null : null;

  // Open an action modal after closing the detail modal
  const openAction = (businessId: string, action: 'bank' | 'loan' | 'invest' | 'buyout' | 'shareholder' | 'transfer' | 'formation' | 'purchase' | 'apply') => {
    setDetailBusinessId(null);
    setTimeout(() => {
      if (action === 'bank') setBankBusinessId(businessId);
      else if (action === 'loan') setLoanBusinessId(businessId);
      else if (action === 'invest') setInvestBusinessId(businessId);
      else if (action === 'buyout') setBuyoutBusinessId(businessId);
      else if (action === 'shareholder') setShareholderBusinessId(businessId);
      else if (action === 'transfer') setTransferBusinessId(businessId);
      else if (action === 'formation') setFormationBusinessId(businessId);
      else if (action === 'purchase') setPurchaseBusinessId(businessId);
      else if (action === 'apply') setApplyBusinessId(businessId);
    }, 150);
  };

  const deleteDetailBusiness = async () => {
    if (!detailBusiness || !isAdmin) return;
    await withRouteError(() => youApi.deleteBusiness(detailBusiness.id), 'Impossible de supprimer le business.');
    toast.success('Business supprime');
    setDetailBusinessId(null);
    await onReload();
  };

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        {/* Filters sidebar */}
        <div className="space-y-3">
          <Card>
            <CardContent className="px-3 py-3">
              <button
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-2 px-1 py-0.5 text-left"
              >
                <div className="flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtres</p>
                </div>
                <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground/50 transition-transform', filtersOpen ? 'rotate-180' : '')} />
              </button>

              {filtersOpen ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="mb-1.5 px-1 text-[10px] uppercase tracking-wider text-muted-foreground/50">Type</p>
                    <div className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => setTypeFilter('all')}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors text-xs',
                          typeFilter === 'all' ? 'bg-muted/30 font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted/20 hover:text-foreground',
                        )}
                      >
                        <Wallet className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1">Tous</span>
                        <span className="tabular-nums text-muted-foreground/60">{filteredBusinesses.length}</span>
                      </button>

                      {availableTypeKeys.map((typeKey) => {
                        const meta = SECTION_META[typeKey];
                        const Icon = meta.icon;
                        const count = allBusinesses.filter((business) => business.typeKey === typeKey).length;
                        return (
                          <button
                            key={typeKey}
                            type="button"
                            onClick={() => setTypeFilter(typeKey)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors text-xs',
                              typeFilter === typeKey ? 'bg-muted/30 font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted/20 hover:text-foreground',
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="flex-1 truncate">{meta.label}</span>
                            <span className="tabular-nums text-muted-foreground/60">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-border/30 pt-3">
                    <p className="mb-1.5 px-1 text-[10px] uppercase tracking-wider text-muted-foreground/50">Proprietaire</p>
                    <div className="space-y-0.5">
                      {([
                        { key: 'all', label: 'Tous', icon: Wallet },
                        { key: 'you', label: 'Mes entreprises', icon: PiggyBank },
                        { key: 'player', label: 'Autres joueurs', icon: Building2 },
                      ] as const).map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setOwnerFilter(key)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors text-xs',
                            ownerFilter === key ? 'bg-muted/30 font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted/20 hover:text-foreground',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Business list */}
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une entreprise ou un joueur..."
                  className="pl-9"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {filteredBusinesses.length} resultat{filteredBusinesses.length > 1 ? 's' : ''}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-4 py-4">
                <div className="space-y-5">
                  {groupedBusinesses.map((section) => {
                    const meta = SECTION_META[section.typeKey];
                    const Icon = meta.icon;
                    const sectionStyle = BUSINESS_STYLE_MAP[section.typeKey] ?? { iconWrap: 'bg-muted/20', icon: 'text-foreground' };
                    return (
                      <div key={section.typeKey} className="space-y-2">
                        <div className="flex items-center gap-3 px-1">
                          <div className={cn('flex h-8 w-8 items-center justify-center rounded-xl', sectionStyle.iconWrap)}>
                            <Icon className={cn('h-4 w-4', sectionStyle.icon)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{meta.label}</p>
                            <p className="text-[11px] text-muted-foreground">Trie par note · cliquer pour interagir</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {section.businesses.map((business) => {
                            const BusinessIcon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
                            const style = BUSINESS_STYLE_MAP[business.typeKey as keyof typeof BUSINESS_STYLE_MAP] ?? { iconWrap: 'bg-muted/20', icon: 'text-foreground' };
                            const profit = business.monthlyRevenue - business.monthlyExpenses;
                            return (
                              <button
                                key={business.id}
                                type="button"
                                onClick={() => setDetailBusinessId(business.id)}
                                className="w-full rounded-2xl border border-border/30 bg-background px-4 py-3 text-left transition-colors hover:bg-muted/15 hover:border-border/50"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', style.iconWrap)}>
                                    <BusinessIcon className={cn('h-4 w-4', style.icon)} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <p className="text-sm font-semibold">{business.name}</p>
                                      {isNewBusiness(business) ? <Pill label="New" color="bg-rose-400/15 text-rose-300" /> : null}
                                      {business.ownerId === userId ? <Pill label="A toi" color="bg-purple-400/15 text-purple-400" /> : null}
                                      {business.isShared ? <Pill label={`Capital partage · ${business.shareholders.length + 1}`} color="bg-amber-400/15 text-amber-300" /> : null}
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-2">
                                      <p className="text-xs text-muted-foreground">{business.owner.username}</p>
                                      {business.avgRating !== null ? (
                                        <span className="flex items-center gap-0.5 text-[11px] text-amber-400">
                                          <Star className="h-3 w-3 fill-amber-400" />
                                          {business.avgRating.toFixed(1)}
                                          <span className="text-muted-foreground/60">({business.ratingCount})</span>
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-sm font-bold tabular-nums text-emerald-400">{business.monthlyRevenue.toLocaleString('fr-FR')} EUR</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {business.typeKey === 'bank'
                                        ? `${business.loanInterestRate ?? 4} % emprunt`
                                        : `${profit >= 0 ? '+' : ''}${profit.toLocaleString('fr-FR')} EUR`}
                                    </p>
                                  </div>
                                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {filteredBusinesses.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aucune entreprise ne correspond a tes filtres.</p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Business interaction modal */}
      {detailBusiness ? (
        <BusinessInteractionModal
          business={detailBusiness}
          userId={userId}
          isAdmin={isAdmin}
          onClose={() => setDetailBusinessId(null)}
          onAction={(action) => openAction(detailBusiness.id, action)}
          onAdminDelete={deleteDetailBusiness}
        />
      ) : null}

      {/* Action modals */}
      <BankAccountModal open={Boolean(bankBusiness)} onClose={() => setBankBusinessId(null)} business={bankBusiness} onSubmitted={bankBusiness ? handleServiceSuccess(bankBusiness.id) : () => onReload(true)} />
      <LoanModal open={Boolean(loanBusiness)} onClose={() => setLoanBusinessId(null)} business={loanBusiness} onSubmitted={loanBusiness ? handleServiceSuccess(loanBusiness.id) : () => onReload(true)} />
      <InvestModal open={Boolean(investBusiness)} onClose={() => setInvestBusinessId(null)} business={investBusiness} onSubmitted={investBusiness ? handleServiceSuccess(investBusiness.id) : () => onReload(true)} />
      <ShareholderProposalModal open={Boolean(shareholderBusiness)} onClose={() => setShareholderBusinessId(null)} business={shareholderBusiness} onSubmitted={() => onReload(true)} />
      <BuyoutOfferModal open={Boolean(buyoutBusiness)} onClose={() => setBuyoutBusinessId(null)} business={buyoutBusiness} onSubmitted={() => onReload(true)} />
      <TransferBusinessModal open={Boolean(transferBusiness)} onClose={() => setTransferBusinessId(null)} business={transferBusiness} players={players} currentUserId={userId} onSubmitted={transferBusiness ? handleServiceSuccess(transferBusiness.id) : () => onReload(true)} />
      <FormationCatalogModal open={Boolean(formationBusiness)} onClose={() => setFormationBusinessId(null)} business={formationBusiness} onSubmitted={formationBusiness ? handleServiceSuccess(formationBusiness.id) : () => onReload(true)} />
      <PurchaseItemModal open={Boolean(purchaseBusiness)} onClose={() => setPurchaseBusinessId(null)} business={purchaseBusiness} onSubmitted={purchaseBusiness ? () => { void handleServiceSuccess(purchaseBusiness.id)(); } : () => onReload(true)} />
      <ApplyBusinessModal open={Boolean(applyBusiness)} onClose={() => setApplyBusinessId(null)} business={applyBusiness} onSubmitted={applyBusiness ? handleServiceSuccess(applyBusiness.id) : () => onReload(true)} />
      <RatingModal open={Boolean(ratingBusinessId)} onClose={() => setRatingBusinessId(null)} businessId={ratingBusinessId} businesses={allBusinesses} onSubmitted={() => onReload()} />
    </>
  );
}

function ApplyBusinessModal({ open, onClose, business, onSubmitted }: { open: boolean; onClose: () => void; business: YouBusiness | null; onSubmitted: () => Promise<void> }) {
  const [role, setRole] = useState('employee');
  const [salary, setSalary] = useState('0');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setRole('employee');
      setSalary('0');
      setMessage('');
    }
  }, [open]);

  const submit = async () => {
    if (!business) return;
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.applyToBusiness(business.id, { role, salary: Number(salary), message: message.trim() }), 'Impossible d envoyer cette candidature.');
      toast.success('Candidature envoyee');
      await onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title={business ? `Postuler · ${business.name}` : 'Postuler'} desc="Le proprietaire doit valider le contrat pour l activer.">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Role vise</p>
        <Input value={role} onChange={(event) => setRole(event.target.value)} placeholder="employee" />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Salaire demande / jour</p>
        <Input type="number" min={0} value={salary} onChange={(event) => setSalary(event.target.value)} />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Message</p>
        <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} maxLength={240} placeholder="Explique ce que tu peux apporter a cette entreprise." />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button>
        <Button size="sm" onClick={submit} disabled={submitting || !business || !role.trim()}>Envoyer</Button>
      </div>
    </ModalWrap>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Coffee,
  Crown,
  GraduationCap,
  HandCoins,
  Landmark,
  MessageSquare,
  PiggyBank,
  Plus,
  Scale,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  Utensils,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { type JusticePlainte, type YouBusiness, type YouFormationProduct, type YouPlayer, type YouState, youApi, justiceApi } from '@/services/api';
import {
  BankAccountModal,
  BuyoutOfferModal,
  FormationCatalogModal,
  InvestModal,
  LoanModal,
  ManageBusinessModal,
  ShareholderProposalModal,
  TeamRosterModal,
  TransferBusinessModal,
} from '../components/modals';
import { Input, ModalWrap, Pill, SectionTitle } from '../components/ui';
import { BUSINESS_ICON_MAP, BUSINESS_STYLE_MAP } from '../constants';
import { withRouteError } from '../utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function formatMoney(n: number) {
  return `${n.toLocaleString('fr-FR')} EUR`;
}

const BUSINESS_TYPE_ORDER = ['supreme_court', 'law_firm', 'bank', 'transfer', 'formation', 'startup', 'agency', 'lemonade', 'restaurant', 'epicerie', 'coffee_shop'] as const;

const SECTION_META: Record<
  (typeof BUSINESS_TYPE_ORDER)[number],
  { label: string; icon: typeof Building2; pillColor: string }
> = {
  supreme_court: { label: 'Cour Suprême', icon: Scale, pillColor: 'bg-indigo-400/15 text-indigo-300' },
  law_firm: { label: "Cabinets d'avocats", icon: Briefcase, pillColor: 'bg-purple-400/15 text-purple-400' },
  bank: { label: 'Banks', icon: Landmark, pillColor: 'bg-emerald-400/15 text-emerald-400' },
  transfer: { label: 'Transfer', icon: ArrowLeftRight, pillColor: 'bg-cyan-400/15 text-cyan-300' },
  formation: { label: 'Formations', icon: GraduationCap, pillColor: 'bg-amber-400/15 text-amber-400' },
  startup: { label: 'Tech startups', icon: TrendingUp, pillColor: 'bg-sky-400/15 text-sky-400' },
  agency: { label: 'Agencies', icon: Building2, pillColor: 'bg-violet-400/15 text-violet-400' },
  lemonade: { label: 'Stands limonade', icon: Store, pillColor: 'bg-yellow-400/15 text-yellow-400' },
  restaurant: { label: 'Restaurants', icon: Utensils, pillColor: 'bg-red-400/15 text-red-400' },
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

function formatPostedDate(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getBusinessListStats(business: YouBusiness) {
  if (business.typeKey === 'bank') {
    return [
      { label: 'Tresorerie', value: formatMoney(business.treasuryMoney), color: 'text-emerald-400' },
      { label: "Taux d'emprunt", value: `${business.loanInterestRate ?? 4} %`, color: 'text-amber-400' },
    ];
  }
  if (business.typeKey === 'transfer') {
    return [
      { label: 'Tresorerie', value: formatMoney(business.treasuryMoney), color: 'text-emerald-400' },
      { label: 'Frais', value: `${business.transferFeeRate ?? 2} %`, color: 'text-cyan-400' },
    ];
  }
  if (business.typeKey === 'formation') {
    return [
      { label: 'Formations', value: `${business.formationProducts?.length ?? 0}`, color: 'text-amber-400' },
      { label: 'Tresorerie', value: formatMoney(business.treasuryMoney), color: 'text-emerald-400' },
    ];
  }
  return [
    { label: 'Tresorerie', value: formatMoney(business.treasuryMoney), color: 'text-emerald-400' },
    { label: 'Satisfaction', value: `${business.satisfaction}/100`, color: 'text-sky-400' },
  ];
}

function BusinessHeader({
  business,
  userId,
  onOpenReviews,
  onRate,
  canRate,
}: {
  business: YouBusiness;
  userId: string;
  onOpenReviews?: () => void;
  onRate?: () => void;
  canRate?: boolean;
}) {
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
          {onOpenReviews ? (
            <button
              type="button"
              onClick={onOpenReviews}
              className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-muted/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 transition-colors hover:bg-muted/20"
            >
              <Star className="h-3 w-3 fill-amber-400" />
              <span>{business.avgRating?.toFixed(1) ?? '--'}</span>
              <span className="text-muted-foreground/70">({business.ratingCount})</span>
            </button>
          ) : null}
          {onRate ? (
            canRate ? (
              <button
                type="button"
                onClick={onRate}
                className="inline-flex items-center justify-center rounded-full border border-border/40 bg-muted/10 px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-default items-center justify-center rounded-full border border-border/30 bg-muted/5 px-1.5 py-0.5 text-muted-foreground/40">
                    <Plus className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px] text-center text-xs">
                  La note se débloque après une interaction avec cet établissement
                </TooltipContent>
              </Tooltip>
            )
          ) : null}
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{label}</p>
      <p className={cn('text-sm font-bold tabular-nums text-right', color ?? 'text-foreground')}>{value}</p>
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
  onManage,
  onShowReviews,
  onRate,
  onShowTeam,
  onOpenSupport,
  onReviewed,
  onAdminDeleteRequest,
}: {
  business: YouBusiness | null;
  userId: string;
  isAdmin: boolean;
  onClose: () => void;
  onAction: (action: 'bank' | 'loan' | 'invest' | 'buyout' | 'shareholder' | 'transfer' | 'formation' | 'purchase' | 'apply' | 'plainte') => void;
  onManage: () => void;
  onShowReviews: () => void;
  onRate: () => void;
  onShowTeam: () => void;
  onOpenSupport: () => void;
  onReviewed: () => Promise<void>;
  onAdminDeleteRequest: () => void;
}) {
  const navigate = useNavigate();
  const [plaintes, setPlaintes] = useState<JusticePlainte[]>([]);
  const [plaintesLoading, setPlaintesLoading] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [plaintesProcessing, setPlaintesProcessing] = useState<Set<string>>(new Set());
  const [reviewingFormationId, setReviewingFormationId] = useState<string | null>(null);

  useEffect(() => {
    if (!business || business.typeKey !== 'supreme_court' || !isAdmin) return;
    let cancelled = false;
    setPlaintesLoading(true);
    justiceApi.listPlaintes({ courtId: business.id }).then((r) => {
      if (!cancelled) setPlaintes(r.data.plaintes);
    }).catch(() => {}).finally(() => { if (!cancelled) setPlaintesLoading(false); });
    return () => { cancelled = true; };
  }, [business?.id, isAdmin]);

  const handleAcceptPlainte = async (id: string) => {
    setPlaintesProcessing((s) => new Set([...s, id]));
    try {
      const r = await justiceApi.acceptPlainte(id);
      setPlaintes((prev) => prev.map((p) => p.id === id ? { ...p, status: 'ACCEPTED' } : p));
      navigate(`/messages?conversation=${r.data.courtCase.conversationId}`);
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setPlaintesProcessing((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const handleRejectPlainte = async (id: string) => {
    setPlaintesProcessing((s) => new Set([...s, id]));
    try {
      await justiceApi.rejectPlainte(id, rejectReason.trim() || undefined);
      setPlaintes((prev) => prev.map((p) => p.id === id ? { ...p, status: 'REJECTED' } : p));
      setRejectingId(null);
      setRejectReason('');
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setPlaintesProcessing((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  if (!business) return null;

  const isOwned = business.ownerId === userId;
  const isEmployee = business.members.some((member) => member.user.id === userId);
  const hasPendingApplication = business.pendingInvitations.some((invitation) => invitation.employee.id === userId);
  const canApply = !isOwned && !isEmployee && !hasPendingApplication && business.hiring;
  const profit = business.monthlyRevenue - business.monthlyExpenses;
  const pendingFormationProducts = business.typeKey === 'formation'
    ? (business.formationProducts ?? []).filter((product) => product.status === 'PENDING')
    : [];

  const reviewFormation = async (productId: string, decision: 'approve' | 'reject') => {
    if (!business) return;
    setReviewingFormationId(productId);
    try {
      await withRouteError(
        () => youApi.reviewFormationProduct(business.id, productId, decision),
        decision === 'approve' ? 'Impossible d approuver cette formation.' : 'Impossible de refuser cette formation.',
      );
      toast.success(decision === 'approve' ? 'Formation approuvee' : 'Formation refusee');
      await onReviewed();
    } finally {
      setReviewingFormationId(null);
    }
  };

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
      { label: 'Formations', value: `${business.formationProducts?.length ?? 0} disponible(s)`, color: 'text-amber-400' },
      { label: 'Tresorerie', value: formatMoney(business.treasuryMoney), color: 'text-emerald-400' },
    ];
    if (business.typeKey === 'lemonade' || business.typeKey === 'epicerie' || business.typeKey === 'restaurant') return [
      { label: 'Tresorerie', value: formatMoney(business.treasuryMoney), color: 'text-emerald-400' },
      { label: 'Satisfaction', value: `${business.satisfaction}/100`, color: 'text-sky-400' },
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
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <BusinessHeader
                business={business}
                userId={userId}
                onOpenReviews={!business.isStateOwned && business.typeKey !== 'formation' ? onShowReviews : undefined}
                onRate={!business.isStateOwned && !isOwned && business.typeKey !== 'formation' ? onRate : undefined}
                canRate={business.canRate}
              />
            </div>
            {isAdmin ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0 border-red-400/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                onClick={onAdminDeleteRequest}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Supprimer ce business</span>
              </Button>
            ) : null}
          </div>
          {business.description ? (
            <p className="text-xs text-muted-foreground">{business.description}</p>
          ) : null}

          <div className="space-y-3">
              {isOwned ? (
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={onManage}>Gerer</Button>
                  <Button variant="outline" className="flex-1" onClick={onShowReviews}>Avis</Button>
                </div>
              ) : null}
              {/* Primary action */}
              {business.typeKey === 'supreme_court' ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-indigo-400/20 bg-indigo-400/8 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
                      <Crown className="h-4 w-4 shrink-0" />
                      <span>Institution de l'État</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Cette cour traite les plaintes formelles entre joueurs. Les juges examinent chaque dossier.</p>
                  </div>
                  <ActionButton
                    icon={Scale}
                    label="Déposer une plainte"
                    sub="Initier une procédure judiciaire formelle contre un autre joueur."
                    tone="bg-indigo-400/15 text-indigo-300"
                    primary
                    onClick={() => onAction('plainte')}
                  />
                  {/* Admin plainte review */}
                  {isAdmin && (
                    <div className="space-y-2">
                      <SectionTitle>Plaintes en attente</SectionTitle>
                      {plaintesLoading && <p className="text-xs text-muted-foreground">Chargement...</p>}
                      {!plaintesLoading && plaintes.filter(p => p.status === 'PENDING').length === 0 && (
                        <p className="text-xs text-muted-foreground italic">Aucune plainte en attente.</p>
                      )}
                      {plaintes.filter(p => p.status === 'PENDING').map((plainte) => (
                        <div key={plainte.id} className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{plainte.title}</p>
                              <p className="text-[11px] text-muted-foreground">
                                Par <span className="text-sky-400">{plainte.plaintif?.username ?? '?'}</span>
                                {plainte.defendant && <> contre <span className="text-red-400">{plainte.defendant.username}</span> <span>(coupable)</span></>}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-500">
                              En attente
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{plainte.description}</p>
                          {plainte.evidence && (
                            <p className="text-xs text-foreground/70 italic">Preuves : {plainte.evidence}</p>
                          )}
                          {rejectingId === plainte.id ? (
                            <div className="space-y-1.5">
                              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                                rows={2} maxLength={280} placeholder="Motif du rejet (optionnel)"
                                className="w-full resize-none rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring" />
                              <div className="flex gap-1.5">
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setRejectingId(null)}>Annuler</Button>
                                <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2"
                                  disabled={plaintesProcessing.has(plainte.id)}
                                  onClick={() => handleRejectPlainte(plainte.id)}>Confirmer le rejet</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <Button size="sm" className="h-6 text-[10px] px-2 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border-0"
                                disabled={plaintesProcessing.has(plainte.id)}
                                onClick={() => handleAcceptPlainte(plainte.id)}>
                                Accepter & ouvrir le dossier
                              </Button>
                              <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2"
                                disabled={plaintesProcessing.has(plainte.id)}
                                onClick={() => setRejectingId(plainte.id)}>
                                Rejeter
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                      {/* Closed plaintes (last 5) */}
                      {plaintes.filter(p => p.status !== 'PENDING').length > 0 && (
                        <details className="group">
                          <summary className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground">
                            Voir les dossiers traités ({plaintes.filter(p => p.status !== 'PENDING').length})
                          </summary>
                          <div className="mt-2 space-y-1.5">
                            {plaintes.filter(p => p.status !== 'PENDING').slice(0, 5).map((plainte) => (
                              <div key={plainte.id} className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 flex items-center gap-2">
                                <p className="flex-1 truncate text-xs">{plainte.title}</p>
                                <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                                  plainte.status === 'ACCEPTED' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-destructive/15 text-destructive')}>
                                  {plainte.status === 'ACCEPTED' ? 'Acceptée' : 'Rejetée'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              ) : business.typeKey === 'law_firm' ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-purple-400/20 bg-purple-400/8 px-4 py-3">
                    <p className="text-sm font-semibold text-purple-300">Cabinet d'avocats</p>
                    <p className="mt-1 text-xs text-muted-foreground">Ce cabinet peut vous représenter lors d'une procédure judiciaire en cours.</p>
                  </div>
                  <ActionButton
                    icon={Users}
                    label="Voir l'équipe"
                    sub={`${business.members.filter((m) => m.status === 'ACTIVE').length + 1} membre(s) · Avocats et spécialités`}
                    tone="bg-purple-400/15 text-purple-300"
                    onClick={onShowTeam}
                  />
                </div>
              ) : business.typeKey === 'bank' ? (
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
                  label={isOwned ? 'Achat indisponible' : 'Acheter'}
                  sub={isOwned ? 'Tu ne peux pas acheter tes propres articles.' : 'Parcourir les articles disponibles'}
                  tone="bg-yellow-400/15 text-yellow-400"
                  primary
                  onClick={() => onAction('purchase')}
                  disabled={isOwned}
                />
              ) : business.typeKey === 'epicerie' ? (
                <ActionButton
                  icon={ShoppingBasket}
                  label={isOwned ? 'Achat indisponible' : 'Acheter'}
                  sub={isOwned ? 'Tu ne peux pas acheter tes propres articles.' : 'Parcourir les articles disponibles'}
                  tone="bg-lime-400/15 text-lime-400"
                  primary
                  onClick={() => onAction('purchase')}
                  disabled={isOwned}
                />
              ) : business.typeKey === 'restaurant' ? (
                <ActionButton
                  icon={Utensils}
                  label={isOwned ? 'Achat indisponible' : 'Acheter'}
                  sub={isOwned ? 'Tu ne peux pas acheter tes propres articles.' : 'Parcourir les articles disponibles'}
                  tone="bg-red-400/15 text-red-400"
                  primary
                  onClick={() => onAction('purchase')}
                  disabled={isOwned}
                />
              ) : business.typeKey === 'agency' ? (
                <ActionButton
                  icon={Building2}
                  label={isOwned ? 'Achat indisponible' : 'Acheter un bien immobilier'}
                  sub="Studio, appartement, maison, villa — gagne du XP Social."
                  tone="bg-violet-400/15 text-violet-400"
                  primary
                  onClick={() => onAction('purchase')}
                  disabled={isOwned}
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
                  label={isOwned ? 'Apercu client des formations' : (business.formationProducts?.length ?? 0) > 0 ? 'Acceder aux formations' : 'Formations non disponibles'}
                  sub={isOwned
                    ? `${business.formationProducts?.length ?? 0} formation(s) visibles cote client`
                    : (business.formationProducts?.length ?? 0) > 0
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

              {!isOwned && business.supportEnabled ? (
                <ActionButton
                  icon={MessageSquare}
                  label="Contacter le support"
                  sub={business.supportAgent ? `Conversation professionnelle avec ${business.supportAgent.username}` : 'Ouvrir la conversation professionnelle'}
                  tone="bg-emerald-400/15 text-emerald-400"
                  onClick={onOpenSupport}
                />
              ) : null}

              {isAdmin && pendingFormationProducts.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-amber-300">Moderation des formations</p>
                    <p className="text-xs text-muted-foreground">Ces formations restent invisibles dans la boutique tant qu elles ne sont pas approuvees.</p>
                  </div>
                  {pendingFormationProducts.map((product) => (
                    <div key={product.id} className="rounded-xl border border-border/40 bg-background/60 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{product.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Publie le {formatPostedDate(product.createdAt)}</p>
                        </div>
                        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">En attente</span>
                      </div>
                      {product.description ? <p className="mt-2 text-sm text-muted-foreground">{product.description}</p> : null}
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" className="flex-1" disabled={reviewingFormationId !== null} onClick={() => void reviewFormation(product.id, 'approve')}>
                          Approuver
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" disabled={reviewingFormationId !== null} onClick={() => void reviewFormation(product.id, 'reject')}>
                          Refuser
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Stats */}
              <div className="space-y-2">
                {stats.map((s) => <StatTile key={s.label} label={s.label} value={s.value} color={s.color} />)}
              </div>

              {!business.isStateOwned && business.typeKey === 'formation' ? (
                <ActionButton
                  icon={GraduationCap}
                  label="Catalogue des formations"
                  sub="Chaque produit possède sa propre note et liste d'avis."
                  tone="bg-amber-400/15 text-amber-400"
                  primary
                  onClick={() => onAction('formation')}
                />
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
                  <span>Livret epargne disponible</span>
                </div>
              ) : null}

              {/* Secondary actions — hide for state institutions */}
              {!business.isStateOwned ? (
                <div className="space-y-2 pt-1">
                  <SectionTitle>Autres actions</SectionTitle>
                  {!isOwned && business.typeKey !== 'law_firm' && business.members.filter((m) => m.status === 'ACTIVE').length > 0 ? (
                    <ActionButton
                      icon={Users}
                      label="Voir l'équipe"
                      sub={`${business.members.filter((m) => m.status === 'ACTIVE').length + 1} membre(s)`}
                      tone="bg-violet-400/15 text-violet-300"
                      onClick={onShowTeam}
                    />
                  ) : null}
                  {business.typeKey === 'bank' ? (
                    <ActionButton
                      icon={Landmark}
                      label="Demander un pret"
                      sub={`Taux ${business.loanInterestRate ?? 4} % · Le proprietaire doit accepter.`}
                      tone="bg-amber-400/15 text-amber-400"
                      onClick={() => onAction('loan')}
                    />
                  ) : null}
                  {!isOwned ? (
                    <ActionButton
                      icon={HandCoins}
                      label={business.viewerSharePercent > 0 ? 'Augmenter ma participation' : 'Devenir actionnaire'}
                      sub="Proposer un pourcentage et une somme au proprietaire."
                      tone="bg-amber-400/15 text-amber-400"
                      onClick={() => onAction('shareholder')}
                    />
                  ) : null}
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
                  {!isOwned ? (
                    <ActionButton
                      icon={HandCoins}
                      label="Faire une offre de rachat"
                      sub="Le montant est bloque jusqu'a la decision du proprietaire."
                      tone="bg-rose-400/15 text-rose-400"
                      onClick={() => onAction('buyout')}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          
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
  restaurant: [
    { key: 'burger', label: 'Burger', price: 15, emoji: '🍔' },
    { key: 'pizza', label: 'Pizza', price: 18, emoji: '🍕' },
    { key: 'fried_chicken', label: 'Poulet Frit', price: 12, emoji: '🍗' },
    { key: 'soda', label: 'Soda', price: 5, emoji: '🥤' },
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

  const items = business.customData ?? ITEMS_CONFIG[business.typeKey] ?? [];

  const buy = async (itemKey: string) => {
    setBuying(itemKey);
    try {
      await withRouteError(() => youApi.purchaseItem(business.id, itemKey), 'Impossible d\'acheter cet article.');
      const item = items.find((i: any) => i.key === itemKey);
      toast.success(`${item?.label ?? 'Article'} acheté !`);
      onSubmitted();
    } finally {
      setBuying(null);
    }
  };

  const isAgency = business.typeKey === 'agency';

  const groupedItems = items.reduce((acc: any, item: any) => {
    const section = item.section || 'Général';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  return (
    <ModalWrap open={open} onClose={onClose} title={business.name} desc={isAgency ? 'Acheter un bien immobilier. Gagne du XP Social.' : 'Parcourir les articles disponibles.'}>
      <div className="space-y-4">
        {Object.entries(groupedItems).map(([section, sectionItems]: [string, any]) => (
          <div key={section} className="space-y-2">
            {section !== 'Général' || Object.keys(groupedItems).length > 1 ? (
              <h3 className="text-sm font-semibold text-muted-foreground px-1">{section}</h3>
            ) : null}
            {(sectionItems as any[]).map((item) => (
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
    if (!businessId || rating === 0 || !business?.canRate) return;
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
          {!business.canRate ? (
            <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
              Cet avis sera disponible apres une interaction avec cet etablissement.
            </div>
          ) : null}
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
            <Button className="flex-1" onClick={() => void submit()} disabled={rating === 0 || submitting || !business.canRate}>
              Envoyer
            </Button>
          </div>
        </div>
      ) : null}
    </ModalWrap>
  );
}

function ReviewsModal({ open, onClose, business }: { open: boolean; onClose: () => void; business: YouBusiness | null }) {
  const [ratingFilter, setRatingFilter] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'best'>('recent');

  useEffect(() => {
    if (!open) {
      setRatingFilter('all');
      setSortOrder('recent');
    }
  }, [open]);

  const filteredRatings = useMemo(() => {
    if (!business) return [];
    const minimumRating = ratingFilter === 'all' ? null : Number(ratingFilter);
    const items = business.ratings.filter((entry) => minimumRating === null || entry.rating === minimumRating);
    return [...items].sort((a, b) => {
      if (sortOrder === 'best') {
        if (b.rating !== a.rating) return b.rating - a.rating;
      }
      if (sortOrder === 'oldest') {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [business, ratingFilter, sortOrder]);

  return (
    <ModalWrap
      open={open}
      onClose={onClose}
      title={business ? `Avis - ${business.name}` : 'Avis'}
      desc={business && business.avgRating !== null ? `${business.avgRating.toFixed(1)}/5 - ${business.ratingCount} avis` : 'Aucun avis pour le moment.'}
      wide
    >
      {business ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value as typeof ratingFilter)} className="w-full bg-transparent text-sm outline-none">
                <option value="all">Toutes les notes</option>
                <option value="5">5 etoiles</option>
                <option value="4">4 etoiles</option>
                <option value="3">3 etoiles</option>
                <option value="2">2 etoiles</option>
                <option value="1">1 etoile</option>
              </select>
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)} className="w-full bg-transparent text-sm outline-none">
                <option value="recent">Plus recents</option>
                <option value="oldest">Plus anciens</option>
                <option value="best">Meilleures notes</option>
              </select>
            </div>
          </div>

          {filteredRatings.length === 0 ? (
            <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
              Aucun avis ne correspond aux filtres.
            </div>
          ) : (
            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {filteredRatings.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{entry.user.username}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatPostedDate(entry.updatedAt)}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-400">
                      <Star className="h-3.5 w-3.5 fill-amber-400" />
                      {entry.rating}/5
                    </span>
                  </div>
                  {entry.comment ? (
                    <p className="mt-2 text-sm text-foreground/90">{entry.comment}</p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Cet avis ne contient pas de commentaire.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </ModalWrap>
  );
}

function FormationProductRatingModal({
  open,
  onClose,
  business,
  product,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness | null;
  product: YouFormationProduct | null;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    if (!business || !product || rating === 0 || !product.canReview) return;
    setSubmitting(true);
    try {
      await youApi.rateFormationProduct(business.id, product.id, rating, comment.trim());
      toast.success('Avis enregistre, merci !');
      onSubmitted();
      onClose();
    } catch {
      toast.error("Impossible d'enregistrer l'avis.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title="Donner un avis" centerTitle>
      {business && product ? (
        <div className="space-y-6 text-center">
          <p className="text-sm text-muted-foreground">
            Note <span className="font-semibold text-foreground">{product.title}</span>
            <span className="text-muted-foreground"> chez </span>
            <span className="font-semibold text-foreground">{business.name}</span>
          </p>
          {!product.canReview ? (
            <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
              Cet avis sera disponible apres consultation de cette formation.
            </div>
          ) : null}
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
            <Button className="flex-1" onClick={() => void submit()} disabled={rating === 0 || submitting || !product.canReview}>
              Envoyer
            </Button>
          </div>
        </div>
      ) : null}
    </ModalWrap>
  );
}

function FormationProductReviewsModal({
  open,
  onClose,
  business,
  product,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness | null;
  product: YouFormationProduct | null;
}) {
  const [ratingFilter, setRatingFilter] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'best'>('recent');

  useEffect(() => {
    if (!open) {
      setRatingFilter('all');
      setSortOrder('recent');
    }
  }, [open]);

  const filteredRatings = useMemo(() => {
    if (!product?.ratings) return [];
    const exactRating = ratingFilter === 'all' ? null : Number(ratingFilter);
    const items = product.ratings.filter((entry) => exactRating === null || entry.rating === exactRating);
    return [...items].sort((a, b) => {
      if (sortOrder === 'best' && b.rating !== a.rating) return b.rating - a.rating;
      if (sortOrder === 'oldest') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [product?.ratings, ratingFilter, sortOrder]);

  return (
    <ModalWrap
      open={open}
      onClose={onClose}
      title={product ? `Avis - ${product.title}` : 'Avis'}
      desc={product && product.avgRating !== null && product.avgRating !== undefined ? `${product.avgRating.toFixed(1)}/5 - ${product.ratingCount ?? product.ratings?.length ?? 0} avis` : 'Aucun avis pour le moment.'}
      wide
    >
      {business && product ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
            <p className="text-sm font-semibold">{product.title}</p>
            <p className="text-xs text-muted-foreground">{business.name}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value as typeof ratingFilter)} className="w-full bg-transparent text-sm outline-none">
                <option value="all">Toutes les notes</option>
                <option value="5">5 etoiles</option>
                <option value="4">4 etoiles</option>
                <option value="3">3 etoiles</option>
                <option value="2">2 etoiles</option>
                <option value="1">1 etoile</option>
              </select>
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)} className="w-full bg-transparent text-sm outline-none">
                <option value="recent">Plus recents</option>
                <option value="oldest">Plus anciens</option>
                <option value="best">Meilleures notes</option>
              </select>
            </div>
          </div>

          {filteredRatings.length === 0 ? (
            <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
              Aucun avis ne correspond aux filtres.
            </div>
          ) : (
            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {filteredRatings.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{entry.user.username}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatPostedDate(entry.updatedAt)}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-400">
                      <Star className="h-3.5 w-3.5 fill-amber-400" />
                      {entry.rating}/5
                    </span>
                  </div>
                  {entry.comment ? (
                    <p className="mt-2 text-sm text-foreground/90">{entry.comment}</p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Cet avis ne contient pas de commentaire.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </ModalWrap>
  );
}

// --- File Plainte Modal ---

function FilePlainteModal({
  business,
  userId,
  players,
  open,
  onClose,
  onSubmitted,
}: {
  business: YouBusiness | null;
  userId: string;
  players: YouPlayer[];
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const [defendantId, setDefendantId] = useState('');
  const [defendantSearch, setDefendantSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredPlayers = useMemo(
    () => players.filter((p) => p.id !== userId && p.username.toLowerCase().includes(defendantSearch.toLowerCase())).slice(0, 10),
    [players, userId, defendantSearch],
  );

  const selectedPlayer = players.find((p) => p.id === defendantId);

  const submit = async () => {
    if (!business) return;
    setSubmitting(true);
    try {
      await justiceApi.filePlainte({
        courtId: business.id,
        title: title.trim(),
        description: description.trim(),
        evidence: evidence.trim() || undefined,
        defendantId: defendantId || undefined,
      });
      toast.success('Plainte déposée. Les juges vont l\'examiner.');
      setTitle(''); setDescription(''); setEvidence(''); setDefendantId(''); setDefendantSearch('');
      onSubmitted();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Impossible de déposer la plainte.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title="Déposer une plainte">
      {business ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-400/20 bg-indigo-400/8 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-indigo-300">
              <Scale className="h-3.5 w-3.5 shrink-0" />
              <span>Cour : <span className="font-semibold">{business.name}</span></span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground/70">Les juges examineront votre plainte. Si acceptée, une procédure judiciaire sera ouverte.</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Titre de la plainte *</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Ex: Arnaque lors d'un échange de monnaie"
              className="w-full rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-indigo-400/40"
            />
            <p className="text-[10px] text-muted-foreground/50">{title.length}/100</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Description des faits *</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Décrivez les faits en détail : que s'est-il passé, quand, et pourquoi c'est une violation des règles..."
              className="w-full resize-none rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-indigo-400/40"
            />
            <p className="text-[10px] text-muted-foreground/50">{description.length}/2000</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Coupable (optionnel)</p>
            {selectedPlayer ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
                <span className="flex-1 text-sm font-medium">{selectedPlayer.username}</span>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setDefendantId(''); setDefendantSearch(''); }}>✕</button>
              </div>
            ) : (
              <div className="space-y-1">
                <input
                  value={defendantSearch}
                  onChange={(e) => setDefendantSearch(e.target.value)}
                  placeholder="Rechercher un joueur..."
                  className="w-full rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-border/60"
                />
                {defendantSearch.length > 0 && filteredPlayers.length > 0 && (
                  <div className="rounded-xl border border-border/40 bg-background">
                    {filteredPlayers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setDefendantId(p.id); setDefendantSearch(''); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/20 first:rounded-t-xl last:rounded-b-xl"
                      >
                        <span>{p.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Preuves (optionnel)</p>
            <textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Captures d'écran, liens, témoignages..."
              className="w-full resize-none rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-border/60"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
              Annuler
            </Button>
            <Button
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              onClick={() => void submit()}
              disabled={submitting || title.trim().length < 5 || description.trim().length < 20}
            >
              {submitting ? 'Dépôt...' : 'Déposer la plainte'}
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
  const navigate = useNavigate();
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
  const [manageBusinessId, setManageBusinessId] = useState<string | null>(null);
  const [reviewsBusinessId, setReviewsBusinessId] = useState<string | null>(null);
  const [ratingBusinessId, setRatingBusinessId] = useState<string | null>(null);
  const [teamRosterBusinessId, setTeamRosterBusinessId] = useState<string | null>(null);
  const [formationReviewsTarget, setFormationReviewsTarget] = useState<{ businessId: string; productId: string } | null>(null);
  const [formationRatingTarget, setFormationRatingTarget] = useState<{ businessId: string; productId: string } | null>(null);
  const [adminDeleteBusinessId, setAdminDeleteBusinessId] = useState<string | null>(null);
  const [plainteBusinessId, setPlainteBusinessId] = useState<string | null>(null);
  const handleServiceSuccess = async () => {
    await onReload(true);
  };

  const handleFormationPurchaseSuccess = async () => {
    await onReload(true);
  };

  const handleFormationAccess = async () => {
    await onReload(true);
  };

  const allBusinesses = useMemo(
    () => [...data.ownedBusinesses, ...data.exploreBusinesses],
    [data.exploreBusinesses, data.ownedBusinesses],
  );

  useEffect(() => {
    const now = Date.now();
    const dueBusiness = allBusinesses.find((business) =>
      business.ownerId !== userId &&
      business.canRate &&
      business.reviewPromptAt &&
      !business.reviewPromptedAt &&
      Date.parse(business.reviewPromptAt) <= now,
    );
    if (dueBusiness && ratingBusinessId !== dueBusiness.id) {
      void youApi.markReviewPromptShown({ businessId: dueBusiness.id }).catch(() => {});
      setRatingBusinessId(dueBusiness.id);
      return;
    }

    const dueFormation = allBusinesses.find((business) =>
      business.typeKey === 'formation' &&
      business.ownerId !== userId &&
      (business.formationProducts ?? []).some((product) =>
        product.canReview &&
        product.reviewPromptAt &&
        !product.reviewPromptedAt &&
        Date.parse(product.reviewPromptAt) <= now,
      ),
    );
    if (dueFormation) {
      const product = (dueFormation.formationProducts ?? []).find((entry) =>
        entry.canReview &&
        entry.reviewPromptAt &&
        !entry.reviewPromptedAt &&
        Date.parse(entry.reviewPromptAt) <= now,
      );
      if (product && (!formationRatingTarget || formationRatingTarget.productId !== product.id)) {
        void youApi.markReviewPromptShown({ productId: product.id }).catch(() => {});
        setFormationRatingTarget({ businessId: dueFormation.id, productId: product.id });
      }
    }
  }, [allBusinesses, formationRatingTarget, ratingBusinessId, userId]);

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
  const manageBusiness = manageBusinessId ? allBusinesses.find((b) => b.id === manageBusinessId) ?? null : null;
  const reviewsBusiness = reviewsBusinessId ? allBusinesses.find((b) => b.id === reviewsBusinessId) ?? null : null;
  const teamRosterBusiness = teamRosterBusinessId ? allBusinesses.find((b) => b.id === teamRosterBusinessId) ?? null : null;
  const formationReviewsBusiness = formationReviewsTarget ? allBusinesses.find((b) => b.id === formationReviewsTarget.businessId) ?? null : null;
  const formationReviewsProduct = formationReviewsTarget && formationReviewsBusiness
    ? formationReviewsBusiness.formationProducts?.find((product) => product.id === formationReviewsTarget.productId) ?? null
    : null;
  const formationRatingBusiness = formationRatingTarget ? allBusinesses.find((b) => b.id === formationRatingTarget.businessId) ?? null : null;
  const formationRatingProduct = formationRatingTarget && formationRatingBusiness
    ? formationRatingBusiness.formationProducts?.find((product) => product.id === formationRatingTarget.productId) ?? null
    : null;
  const adminDeleteBusiness = adminDeleteBusinessId ? allBusinesses.find((b) => b.id === adminDeleteBusinessId) ?? null : null;
  const plainteBusiness = plainteBusinessId ? allBusinesses.find((b) => b.id === plainteBusinessId) ?? null : null;

  // Open an action modal after closing the detail modal
  const openAction = (businessId: string, action: 'bank' | 'loan' | 'invest' | 'buyout' | 'shareholder' | 'transfer' | 'formation' | 'purchase' | 'apply' | 'plainte') => {
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
      else if (action === 'plainte') setPlainteBusinessId(businessId);
    }, 150);
  };

  const deleteDetailBusiness = async () => {
    if (!adminDeleteBusiness || !isAdmin) return;
    await withRouteError(() => youApi.deleteBusiness(adminDeleteBusiness.id), 'Impossible de supprimer le business.');
    toast.success('Business supprime');
    setAdminDeleteBusinessId(null);
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
                  {/* State institutions always at top */}
                  {allBusinesses.some((b) => b.isStateOwned) && typeFilter === 'all' && !search && ownerFilter === 'all' ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 px-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-400/15">
                          <Crown className="h-4 w-4 text-indigo-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">Institutions de l'État</p>
                          <p className="text-[11px] text-muted-foreground">Organismes officiels gérés par les administrateurs</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {allBusinesses.filter((b) => b.isStateOwned).map((business) => {
                          const BusinessIcon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Scale;
                          return (
                            <button
                              key={business.id}
                              type="button"
                              onClick={() => setDetailBusinessId(business.id)}
                              className="w-full rounded-2xl border border-indigo-400/20 bg-indigo-400/5 px-4 py-3 text-left transition-colors hover:bg-indigo-400/10"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-400/15">
                                  <BusinessIcon className="h-4 w-4 text-indigo-300" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <p className="text-sm font-semibold">{business.name}</p>
                                    <span className="rounded-full bg-indigo-400/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">État</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{business.type?.label ?? business.typeKey}</p>
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {groupedBusinesses.map((section) => {
                    // In "show all" view, state-owned businesses are already shown in the top "Institutions" section
                    const showingStateInstitutions = typeFilter === 'all' && !search && ownerFilter === 'all';
                    const isStateSectionHidden = showingStateInstitutions && allBusinesses.some((b) => b.isStateOwned && b.typeKey === section.typeKey);
                    if (isStateSectionHidden) return null;
                    const meta = SECTION_META[section.typeKey as keyof typeof SECTION_META];
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
                            const cardStats = getBusinessListStats(business);
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
                                    {cardStats.map((stat) => (
                                      <p key={stat.label} className={cn('text-[11px] tabular-nums', stat.color ?? 'text-foreground')}>
                                        <span className="text-muted-foreground">{stat.label}:</span> {stat.value}
                                      </p>
                                    ))}
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
          onManage={() => {
            setDetailBusinessId(null);
            setTimeout(() => setManageBusinessId(detailBusiness.id), 150);
          }}
          onShowReviews={() => setReviewsBusinessId(detailBusiness.id)}
          onRate={() => setRatingBusinessId(detailBusiness.id)}
          onShowTeam={() => setTeamRosterBusinessId(detailBusiness.id)}
          onOpenSupport={() => {
            void youApi.openBusinessSupportConversation(detailBusiness.id).then((res) => {
              setDetailBusinessId(null);
              navigate(`/messages?conversation=${res.data.result.conversationId}`);
            }).catch(() => {
              toast.error('Impossible d ouvrir la conversation support.');
            });
          }}
          onReviewed={() => onReload()}
          onAdminDeleteRequest={() => setAdminDeleteBusinessId(detailBusiness.id)}
        />
      ) : null}

      <ModalWrap
        open={Boolean(adminDeleteBusiness)}
        onClose={() => setAdminDeleteBusinessId(null)}
        title={adminDeleteBusiness ? `Supprimer ${adminDeleteBusiness.name} ?` : 'Supprimer ce business ?'}
        desc="Cette action est reservee aux admins et ne peut pas etre annulee."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-red-400/20 bg-red-500/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-red-300">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Le business sera supprime definitivement.</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdminDeleteBusinessId(null)}>
              Annuler
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void deleteDetailBusiness()}>
              Supprimer
            </Button>
          </div>
        </div>
      </ModalWrap>

      {/* Action modals */}
      <BankAccountModal open={Boolean(bankBusiness)} onClose={() => setBankBusinessId(null)} business={bankBusiness} onSubmitted={bankBusiness ? handleServiceSuccess : () => onReload(true)} />
      <LoanModal open={Boolean(loanBusiness)} onClose={() => setLoanBusinessId(null)} business={loanBusiness} onSubmitted={loanBusiness ? handleServiceSuccess : () => onReload(true)} />
      <InvestModal open={Boolean(investBusiness)} onClose={() => setInvestBusinessId(null)} business={investBusiness} onSubmitted={investBusiness ? handleServiceSuccess : () => onReload(true)} />
      <ShareholderProposalModal open={Boolean(shareholderBusiness)} onClose={() => setShareholderBusinessId(null)} business={shareholderBusiness} onSubmitted={() => onReload(true)} />
      <BuyoutOfferModal open={Boolean(buyoutBusiness)} onClose={() => setBuyoutBusinessId(null)} business={buyoutBusiness} onSubmitted={() => onReload(true)} />
      <TransferBusinessModal open={Boolean(transferBusiness)} onClose={() => setTransferBusinessId(null)} business={transferBusiness} players={players} currentUserId={userId} onSubmitted={transferBusiness ? handleServiceSuccess : () => onReload(true)} />
      <FormationCatalogModal
        open={Boolean(formationBusiness)}
        onClose={() => setFormationBusinessId(null)}
        business={formationBusiness}
        onSubmitted={handleFormationPurchaseSuccess}
        onAccessed={formationBusiness ? () => { void handleFormationAccess(); } : undefined}
        onShowProductReviews={formationBusiness ? (productId) => setFormationReviewsTarget({ businessId: formationBusiness.id, productId }) : undefined}
        onRateProduct={formationBusiness ? (productId) => setFormationRatingTarget({ businessId: formationBusiness.id, productId }) : undefined}
      />
      <PurchaseItemModal open={Boolean(purchaseBusiness)} onClose={() => setPurchaseBusinessId(null)} business={purchaseBusiness} onSubmitted={purchaseBusiness ? handleServiceSuccess : () => onReload(true)} />
      <ApplyBusinessModal open={Boolean(applyBusiness)} onClose={() => setApplyBusinessId(null)} business={applyBusiness} onSubmitted={applyBusiness ? handleServiceSuccess : () => onReload(true)} />
      <ManageBusinessModal
        open={Boolean(manageBusiness)}
        onClose={() => setManageBusinessId(null)}
        business={manageBusiness}
        players={players}
        currentUserId={userId}
        onInviteRequested={() => {}}
        onSubmitted={onReload}
      />
      <ReviewsModal open={Boolean(reviewsBusiness)} onClose={() => setReviewsBusinessId(null)} business={reviewsBusiness} />
      <TeamRosterModal open={Boolean(teamRosterBusiness)} onClose={() => setTeamRosterBusinessId(null)} business={teamRosterBusiness} />
      <RatingModal open={Boolean(ratingBusinessId)} onClose={() => setRatingBusinessId(null)} businessId={ratingBusinessId} businesses={allBusinesses} onSubmitted={() => onReload()} />
      <FormationProductReviewsModal
        open={Boolean(formationReviewsProduct)}
        onClose={() => setFormationReviewsTarget(null)}
        business={formationReviewsBusiness}
        product={formationReviewsProduct}
      />
      <FormationProductRatingModal
        open={Boolean(formationRatingProduct)}
        onClose={() => setFormationRatingTarget(null)}
        business={formationRatingBusiness}
        product={formationRatingProduct}
        onSubmitted={() => void onReload(true)}
      />
      <FilePlainteModal
        open={Boolean(plainteBusiness)}
        onClose={() => setPlainteBusinessId(null)}
        business={plainteBusiness}
        userId={userId}
        players={players}
        onSubmitted={() => void onReload()}
      />
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

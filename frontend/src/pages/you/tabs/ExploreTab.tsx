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
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type YouBusiness, type YouPlayer, type YouState, youApi } from '@/services/api';
import {
  BankAccountModal,
  BuyoutOfferModal,
  FormationPurchaseModal,
  InvestModal,
  LoanModal,
  TransferBusinessModal,
} from '../components/modals';
import { FilterButton, Input, ModalWrap, Pill, SectionTitle } from '../components/ui';
import { BUSINESS_ICON_MAP, BUSINESS_STYLE_MAP } from '../constants';
import { withRouteError } from '../utils';

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
}: {
  icon: typeof Building2;
  label: string;
  sub?: string;
  tone: string;
  onClick: () => void;
  primary?: boolean;
}) {
  const [toneBg, toneText] = tone.split(' ');
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
        primary ? 'border-transparent bg-muted/20 hover:bg-muted/30' : 'border-border/40 bg-muted/10 hover:bg-muted/20',
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

function BusinessDetailPanel({
  business,
  userId,
  onBankAccounts,
  onTransfer,
  onInvest,
  onLoan,
  onBuyout,
  onFormation,
  onPurchase,
}: {
  business: YouBusiness;
  userId: string;
  onBankAccounts: () => void;
  onTransfer: () => void;
  onInvest: () => void;
  onLoan: () => void;
  onBuyout: () => void;
  onFormation: () => void;
  onPurchase: () => void;
}) {
  const isOwned = business.ownerId === userId;

  if (isOwned) {
    return (
      <Card>
        <CardContent className="px-5 py-6 text-center">
          <p className="text-sm font-medium text-muted-foreground">C'est ton entreprise.</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Gere-la depuis l'onglet Travail.</p>
        </CardContent>
      </Card>
    );
  }

  const primarySection = (() => {
    if (business.typeKey === 'bank') {
      return (
        <ActionButton
          icon={Landmark}
          label="Gerer mes comptes"
          sub={`Taux d'emprunt : ${business.loanInterestRate ?? 4} % · ${business.livretEpargneUnlocked ? 'Livret epargne dispo' : 'Compte courant'}`}
          tone="bg-emerald-400/15 text-emerald-400"
          primary
          onClick={onBankAccounts}
        />
      );
    }
    if (business.typeKey === 'transfer') {
      return (
        <ActionButton
          icon={ArrowLeftRight}
          label="Envoyer de l'argent"
          sub={`Frais de service : ${business.transferFeeRate ?? 2} %`}
          tone="bg-cyan-400/15 text-cyan-300"
          primary
          onClick={onTransfer}
        />
      );
    }
    if (business.typeKey === 'lemonade' || business.typeKey === 'epicerie') {
      const Icon = business.typeKey === 'lemonade' ? Store : ShoppingBasket;
      const tone = business.typeKey === 'lemonade' ? 'bg-yellow-400/15 text-yellow-400' : 'bg-lime-400/15 text-lime-400';
      return (
        <ActionButton
          icon={Icon}
          label="Acheter"
          sub="Parcourir les articles disponibles"
          tone={tone}
          primary
          onClick={onPurchase}
        />
      );
    }
    if (business.typeKey === 'coffee_shop') {
      return (
        <ActionButton
          icon={Coffee}
          label="Investir"
          sub="Le rendement depend du niveau de risque choisi."
          tone="bg-orange-400/15 text-orange-400"
          primary
          onClick={onInvest}
        />
      );
    }
    if (business.typeKey === 'formation') {
      const hasFormation = Boolean(business.formationUrl);
      return (
        <ActionButton
          icon={GraduationCap}
          label={hasFormation ? 'Acceder a la formation' : 'Formation non disponible'}
          sub={hasFormation ? `Prix : ${formatMoney(business.formationPrice ?? 500)}` : "Le proprietaire n'a pas encore mis de formation en ligne."}
          tone="bg-amber-400/15 text-amber-400"
          primary
          onClick={hasFormation ? onFormation : () => {}}
        />
      );
    }
    if (business.typeKey === 'startup') {
      return (
        <div className="space-y-3">
          <StartupProductsReadonly business={business} />
          <ActionButton
            icon={TrendingUp}
            label="Investir dans cette startup"
            sub="Le rendement depend du niveau de risque choisi."
            tone="bg-sky-400/15 text-sky-400"
            primary
            onClick={onInvest}
          />
        </div>
      );
    }
    return (
      <ActionButton
        icon={TrendingUp}
        label="Investir"
        sub="Le rendement depend du niveau de risque choisi."
        tone="bg-sky-400/15 text-sky-400"
        primary
        onClick={onInvest}
      />
    );
  })();

  const stats = (() => {
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
        { label: 'Revenue mensuel', value: formatMoney(business.monthlyRevenue), color: 'text-emerald-400' },
        { label: 'Prix formation', value: formatMoney(business.formationPrice ?? 500), color: 'text-amber-400' },
      ];
    }
    if (business.typeKey === 'lemonade' || business.typeKey === 'epicerie') {
      return [
        { label: 'Revenue mensuel', value: formatMoney(business.monthlyRevenue), color: 'text-emerald-400' },
        { label: 'Tresorerie', value: formatMoney(business.treasuryMoney), color: 'text-muted-foreground' },
      ];
    }
    const profit = business.monthlyRevenue - business.monthlyExpenses;
    return [
      { label: 'Profit mensuel', value: formatMoney(profit), color: profit >= 0 ? 'text-emerald-400' : 'text-red-400' },
      { label: 'Satisfaction', value: `${business.satisfaction}/100`, color: 'text-sky-400' },
    ];
  })();

  const secondaryActions: Array<{ icon: typeof Building2; label: string; sub: string; tone: string; onClick: () => void }> = [];
  if (business.typeKey === 'bank') {
    secondaryActions.push({
      icon: Landmark,
      label: 'Demander un pret',
      sub: `Taux ${business.loanInterestRate ?? 4} % · Le proprietaire doit accepter.`,
      tone: 'bg-amber-400/15 text-amber-400',
      onClick: onLoan,
    });
  }
  secondaryActions.push({
    icon: HandCoins,
    label: 'Faire une offre de rachat',
    sub: "Le montant est bloque jusqu'a la decision du proprietaire.",
    tone: 'bg-rose-400/15 text-rose-400',
    onClick: onBuyout,
  });

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-4 px-5 py-4">
          <div>
            <SectionTitle>Utiliser le service</SectionTitle>
            {primarySection}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {stats.map((s) => <StatTile key={s.label} label={s.label} value={s.value} color={s.color} />)}
          </div>

          {business.typeKey === 'bank' && business.livretEpargneUnlocked ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-xs text-amber-300">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Livret epargne disponible · +0,5 % / jour</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 px-5 py-4">
          <SectionTitle>Autres actions</SectionTitle>
          {secondaryActions.map((action) => (
            <ActionButton key={action.label} {...action} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

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
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>(
    data.exploreBusinesses[0]?.id ?? data.ownedBusinesses[0]?.id ?? '',
  );

  const [bankBusinessId, setBankBusinessId] = useState<string | null>(null);
  const [loanBusinessId, setLoanBusinessId] = useState<string | null>(null);
  const [investBusinessId, setInvestBusinessId] = useState<string | null>(null);
  const [buyoutBusinessId, setBuyoutBusinessId] = useState<string | null>(null);
  const [transferBusinessId, setTransferBusinessId] = useState<string | null>(null);
  const [formationBusinessId, setFormationBusinessId] = useState<string | null>(null);
  const [purchaseBusinessId, setPurchaseBusinessId] = useState<string | null>(null);

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
          .sort((a, b) => getBusinessRevenue(b) - getBusinessRevenue(a)),
      })).filter((section) => section.businesses.length > 0),
    [filteredBusinesses],
  );

  const selectedBusiness =
    filteredBusinesses.find((business) => business.id === selectedBusinessId) ?? filteredBusinesses[0] ?? null;

  const bankBusiness = bankBusinessId ? allBusinesses.find((business) => business.id === bankBusinessId) ?? null : null;
  const loanBusiness = loanBusinessId ? allBusinesses.find((business) => business.id === loanBusinessId) ?? null : null;
  const investBusiness = investBusinessId ? allBusinesses.find((business) => business.id === investBusinessId) ?? null : null;
  const buyoutBusiness = buyoutBusinessId ? allBusinesses.find((business) => business.id === buyoutBusinessId) ?? null : null;
  const transferBusiness = transferBusinessId ? allBusinesses.find((business) => business.id === transferBusinessId) ?? null : null;
  const formationBusiness = formationBusinessId ? allBusinesses.find((business) => business.id === formationBusinessId) ?? null : null;
  const purchaseBusiness = purchaseBusinessId ? allBusinesses.find((business) => business.id === purchaseBusinessId) ?? null : null;

  useEffect(() => {
    if (selectedBusinessId && filteredBusinesses.some((business) => business.id === selectedBusinessId)) return;
    setSelectedBusinessId(filteredBusinesses[0]?.id ?? '');
  }, [filteredBusinesses, selectedBusinessId]);

  const deleteSelectedBusiness = async () => {
    if (!selectedBusiness || !isAdmin) return;
    await withRouteError(() => youApi.deleteBusiness(selectedBusiness.id), 'Impossible de supprimer le business.');
    toast.success('Business supprime');
    await onReload();
  };

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 px-4 py-4">
              <button
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/40 bg-muted/10 px-3 py-3 text-left transition-colors hover:bg-muted/20"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Filtres</p>
                </div>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', filtersOpen ? 'rotate-180' : '')} />
              </button>

              {filtersOpen ? (
                <>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Type d'entreprise</p>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setTypeFilter('all')}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                          typeFilter === 'all' ? 'border-foreground/20 bg-muted/25' : 'border-border/40 bg-muted/10 hover:bg-muted/20',
                        )}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/30">
                          <Wallet className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">Tous les types</p>
                          <p className="text-xs text-muted-foreground">{filteredBusinesses.length} visible{filteredBusinesses.length > 1 ? 's' : ''}</p>
                        </div>
                      </button>

                      {availableTypeKeys.map((typeKey) => {
                        const meta = SECTION_META[typeKey];
                        const Icon = meta.icon;
                        const style = BUSINESS_STYLE_MAP[typeKey] ?? { iconWrap: 'bg-muted/20', icon: 'text-foreground' };
                        const count = allBusinesses.filter((business) => business.typeKey === typeKey).length;
                        return (
                          <button
                            key={typeKey}
                            type="button"
                            onClick={() => setTypeFilter(typeKey)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                              typeFilter === typeKey ? 'border-foreground/20 bg-muted/25' : 'border-border/40 bg-muted/10 hover:bg-muted/20',
                            )}
                          >
                            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', style.iconWrap)}>
                              <Icon className={cn('h-4 w-4', style.icon)} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{meta.label}</p>
                              <p className="text-xs text-muted-foreground">{count} entreprise{count > 1 ? 's' : ''}</p>
                            </div>
                            <Pill label={typeKey} color={meta.pillColor} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Proprietaire</p>
                    <div className="space-y-1.5">
                      <FilterButton active={ownerFilter === 'all'} label="Tous" icon={Wallet} colorClass="bg-slate-600" onClick={() => setOwnerFilter('all')} />
                      <FilterButton active={ownerFilter === 'you'} label="Mes entreprises" icon={PiggyBank} colorClass="bg-purple-500" onClick={() => setOwnerFilter('you')} />
                      <FilterButton active={ownerFilter === 'player'} label="Autres joueurs" icon={Building2} colorClass="bg-amber-500" onClick={() => setOwnerFilter('player')} />
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>

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

          <Card>
            <CardContent className="space-y-5 px-4 py-4">
              {groupedBusinesses.map((section) => {
                const meta = SECTION_META[section.typeKey];
                const Icon = meta.icon;
                const sectionStyle = BUSINESS_STYLE_MAP[section.typeKey] ?? { iconWrap: 'bg-muted/20', icon: 'text-foreground' };
                return (
                  <div key={section.typeKey} className="space-y-2">
                    <div className="flex items-center gap-3 px-1">
                      <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', sectionStyle.iconWrap)}>
                        <Icon className={cn('h-4 w-4', sectionStyle.icon)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{meta.label}</p>
                        <p className="text-[11px] text-muted-foreground">Trie par revenu mensuel decroissant</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {section.businesses.map((business) => {
                        const BusinessIcon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
                        const style = BUSINESS_STYLE_MAP[business.typeKey as keyof typeof BUSINESS_STYLE_MAP] ?? { iconWrap: 'bg-muted/20', icon: 'text-foreground' };
                        const selected = business.id === selectedBusiness?.id;
                        const profit = business.monthlyRevenue - business.monthlyExpenses;
                        return (
                          <button
                            key={business.id}
                            type="button"
                            onClick={() => setSelectedBusinessId(business.id)}
                            className={cn(
                              'w-full rounded-2xl border px-4 py-4 text-left transition-colors',
                              selected ? 'border-foreground/20 bg-muted/25' : 'border-border/30 bg-background hover:bg-muted/15',
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', style.iconWrap)}>
                                <BusinessIcon className={cn('h-4 w-4', style.icon)} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="text-sm font-semibold">{business.name}</p>
                                  {business.type ? <Pill label={business.type.label} color="bg-sky-400/15 text-sky-400" /> : null}
                                  {isNewBusiness(business) ? <Pill label="New" color="bg-rose-400/15 text-rose-300" /> : null}
                                  {business.ownerId === userId ? <Pill label="A toi" color="bg-purple-400/15 text-purple-400" /> : null}
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">{business.owner.username} · {business.foundedLabel}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-bold tabular-nums text-emerald-400">{business.monthlyRevenue.toLocaleString('fr-FR')} EUR</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {business.typeKey === 'bank'
                                    ? `${business.loanInterestRate ?? 4} % emprunt`
                                    : `${profit >= 0 ? '+' : ''}${profit.toLocaleString('fr-FR')} EUR profit`}
                                </p>
                              </div>
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
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          {selectedBusiness ? (
            <>
              {isAdmin ? (
                <Card>
                  <CardContent className="px-5 py-3">
                    <div className="flex items-center gap-2 text-xs text-amber-300">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      <span>Mode admin actif</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full justify-start border-red-400/30 text-red-300 hover:bg-red-500/10"
                      onClick={() => void deleteSelectedBusiness()}
                    >
                      Supprimer ce business
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardContent className="px-5 py-4">
                  <BusinessHeader business={selectedBusiness} userId={userId} />
                  {selectedBusiness.description ? (
                    <p className="mt-3 text-xs text-muted-foreground">{selectedBusiness.description}</p>
                  ) : null}
                </CardContent>
              </Card>

              <BusinessDetailPanel
                business={selectedBusiness}
                userId={userId}
                onBankAccounts={() => setBankBusinessId(selectedBusiness.id)}
                onTransfer={() => setTransferBusinessId(selectedBusiness.id)}
                onInvest={() => setInvestBusinessId(selectedBusiness.id)}
                onLoan={() => setLoanBusinessId(selectedBusiness.id)}
                onBuyout={() => setBuyoutBusinessId(selectedBusiness.id)}
                onFormation={() => setFormationBusinessId(selectedBusiness.id)}
                onPurchase={() => setPurchaseBusinessId(selectedBusiness.id)}
              />
            </>
          ) : (
            <Card>
              <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">
                Selectionne une entreprise pour voir ses details.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <BankAccountModal open={Boolean(bankBusiness)} onClose={() => setBankBusinessId(null)} business={bankBusiness} onSubmitted={() => onReload(true)} />
      <LoanModal open={Boolean(loanBusiness)} onClose={() => setLoanBusinessId(null)} business={loanBusiness} onSubmitted={() => onReload(true)} />
      <InvestModal open={Boolean(investBusiness)} onClose={() => setInvestBusinessId(null)} business={investBusiness} onSubmitted={() => onReload(true)} />
      <BuyoutOfferModal open={Boolean(buyoutBusiness)} onClose={() => setBuyoutBusinessId(null)} business={buyoutBusiness} onSubmitted={() => onReload(true)} />
      <TransferBusinessModal open={Boolean(transferBusiness)} onClose={() => setTransferBusinessId(null)} business={transferBusiness} players={players} onSubmitted={() => onReload(true)} />
      <FormationPurchaseModal open={Boolean(formationBusiness)} onClose={() => setFormationBusinessId(null)} business={formationBusiness} onSubmitted={() => onReload(true)} />
      <PurchaseItemModal open={Boolean(purchaseBusiness)} onClose={() => setPurchaseBusinessId(null)} business={purchaseBusiness} onSubmitted={() => onReload(true)} />
    </>
  );
}

// --- Purchase Item Modal for lemonade/epicerie ---

const ITEMS_CONFIG: Record<string, Array<{ key: string; label: string; price: number }>> = {
  lemonade: [
    { key: 'citronnade', label: 'Citronnade', price: 10 },
    { key: 'limonade_fraise', label: 'Limonade fraise', price: 15 },
    { key: 'eau_petillante', label: 'Eau petillante', price: 8 },
  ],
  epicerie: [
    { key: 'baguette', label: 'Baguette', price: 5 },
    { key: 'fromage', label: 'Fromage', price: 20 },
    { key: 'vin', label: 'Vin', price: 35 },
    { key: 'confiture', label: 'Confiture', price: 12 },
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

  return (
    <ModalWrap open={open} onClose={onClose} title={business.name} desc="Parcourir les articles disponibles.">
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-400/15">
                <ShoppingCart className="h-4 w-4 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.price.toLocaleString('fr-FR')} money</p>
              </div>
            </div>
            <Button size="sm" onClick={() => void buy(item.key)} disabled={buying !== null}>
              Acheter
            </Button>
          </div>
        ))}
      </div>
    </ModalWrap>
  );
}

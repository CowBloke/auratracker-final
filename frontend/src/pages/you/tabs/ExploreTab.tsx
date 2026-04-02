import { useState, useMemo, useEffect } from 'react';
import { BarChart3, Building2, ChevronRight, Landmark, PiggyBank, Search, ShieldAlert, Sparkles, Trash2, UserPlus, Vault, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type YouBusiness, type YouPlayer, type YouState, youApi } from '@/services/api';
import { InvestModal, InvitePlayersModal, LoanModal } from '../components/modals';
import { FilterButton, Input, Pill, SectionTitle, UserAvatar } from '../components/ui';
import { ACTION_META, BUSINESS_ICON_MAP } from '../constants';
import { type BusinessAction } from '../types';
import { canUseBusinessAction, withRouteError } from '../utils';

const LIVRET_EPARGNE_COST = 5000;

function formatMoney(n: number) {
  return n.toLocaleString('fr-FR');
}

function BankDetailCard({ business, userId, onReload }: { business: YouBusiness; userId: string; onReload: () => Promise<void> }) {
  const isOwner = business.ownerId === userId;
  const [buying, setBuying] = useState(false);
  const [rateInput, setRateInput] = useState(String(business.loanInterestRate ?? 4));
  const [savingRate, setSavingRate] = useState(false);

  const handleSaveRate = async () => {
    setSavingRate(true);
    try {
      await withRouteError(() => youApi.setLoanRate(business.id, Number(rateInput)), 'Impossible de modifier le taux.');
      toast.success('Taux d emprunt mis a jour');
      await onReload();
    } finally {
      setSavingRate(false);
    }
  };

  const handleBuyUpgrade = async () => {
    setBuying(true);
    try {
      await withRouteError(() => youApi.buyLivretEpargneUpgrade(business.id), "Impossible d'acheter cet upgrade.");
      toast.success('Livret Epargne activé !');
      await onReload();
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Founder + treasury */}
      <Card>
        <CardContent className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <UserAvatar player={business.owner} className="h-11 w-11" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">Fondateur</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm font-semibold">{business.owner.username}</p>
                {business.verified ? <Pill label="Verifie" color="bg-emerald-400/15 text-emerald-400" /> : null}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Tresorerie disponible</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-emerald-400">{formatMoney(business.treasuryMoney)}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Taux d emprunt</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-amber-400">{business.loanInterestRate ?? 4}%</p>
            </div>
          </div>
          {isOwner && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                step={0.5}
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="h-8 w-24 rounded-lg border border-border/40 bg-muted/10 px-3 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-400/40"
              />
              <span className="text-xs text-muted-foreground">% / pret</span>
              <Button
                size="sm"
                variant="outline"
                disabled={savingRate || Number(rateInput) < 1 || Number(rateInput) > 50}
                onClick={() => void handleSaveRate()}
                className="h-7 border-amber-400/30 text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
              >
                {savingRate ? 'Sauvegarde...' : 'Modifier'}
              </Button>
            </div>
          )}
          {business.livretEpargneUnlocked ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-xs text-amber-300">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Livret Epargne actif · +0.5% / jour</span>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/50">+0.2% de rendement quotidien</p>
          )}
        </CardContent>
      </Card>

      {/* Upgrade: livret épargne (owner only, not yet unlocked) */}
      {isOwner && !business.livretEpargneUnlocked ? (
        <Card>
          <CardContent className="px-5 py-4 space-y-3">
            <SectionTitle>Upgrades</SectionTitle>
            <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                  <Vault className="h-4 w-4 text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Livret Epargne</p>
                  <p className="text-xs text-muted-foreground">Booste le rendement quotidien de 0.2% à 0.5%</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <p className="text-xs text-muted-foreground">
                  Coût :{' '}
                  <span className={cn('font-semibold', business.treasuryMoney >= LIVRET_EPARGNE_COST ? 'text-foreground' : 'text-red-400')}>
                    {formatMoney(LIVRET_EPARGNE_COST)}
                  </span>
                  {business.treasuryMoney < LIVRET_EPARGNE_COST ? (
                    <span className="ml-1.5 text-red-400/80">· fonds insuffisants</span>
                  ) : null}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={buying || business.treasuryMoney < LIVRET_EPARGNE_COST}
                  onClick={() => void handleBuyUpgrade()}
                  className="h-7 border-amber-400/30 text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
                >
                  {buying ? 'Achat...' : 'Acheter'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function DefaultDetailCard({ business, userId, isAdmin, onDeleteBusiness, onAction, visibleActions }: {
  business: YouBusiness;
  userId: string;
  isAdmin: boolean;
  onDeleteBusiness: () => void;
  onAction: (b: YouBusiness, a: BusinessAction) => void;
  visibleActions: string[];
}) {
  return (
    <>
      <Card>
        <CardContent className="space-y-4 px-5 py-4">
          <div className="flex items-start gap-3">
            <UserAvatar player={business.owner} className="h-11 w-11" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold">{business.name}</p>
                {business.verified ? <Pill label="Verifie" color="bg-emerald-400/15 text-emerald-400" /> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{business.description || 'Aucune description.'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Proprietaire', value: business.owner.username },
              { label: 'Fondation', value: business.foundedLabel },
              { label: 'Lieu', value: business.location || 'n/a' },
              { label: 'Satisfaction', value: `${business.satisfaction}/100` },
            ].map((entry) => (
              <div key={entry.label} className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{entry.label}</p>
                <p className="mt-1 text-sm font-medium">{entry.value}</p>
              </div>
            ))}
          </div>
          {isAdmin ? (
            <Button size="sm" variant="outline" className="w-full justify-start border-red-400/30 text-red-300 hover:bg-red-500/10" onClick={onDeleteBusiness}>
              <Trash2 className="mr-2 h-4 w-4" />Supprimer ce business
            </Button>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 px-5 py-4">
          <SectionTitle>Actions utilisateur</SectionTitle>
          {visibleActions.length === 0 ? (
            <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
              {business.ownerId === userId
                ? "Les actions de gestion se trouvent dans l'onglet travail via le bouton Ouvrir."
                : 'Aucune action disponible pour ce business.'}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleActions.map((action) => {
                const meta = ACTION_META[action as BusinessAction];
                const Icon = meta.icon;
                const [toneBg, toneText] = meta.tone.split(' ');
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => onAction(business, action as BusinessAction)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                  >
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', toneBg)}>
                      <Icon className={cn('h-4 w-4', toneText)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{meta.help}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </button>
                );
              })}
            </div>
          )}
          {isAdmin ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Mode admin actif: tu peux supprimer un business directement depuis cette fiche.</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

export function ExploreTab({ data, players, userId, isAdmin, onReload }: { data: YouState; players: YouPlayer[]; userId: string; isAdmin: boolean; onReload: (refreshBalance?: boolean) => Promise<void> }) {
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
    if (!filteredBusinesses.some((b) => b.id === selectedBusinessId)) {
      setSelectedBusinessId(filteredBusinesses[0]?.id ?? '');
    }
  }, [filteredBusinesses, selectedBusinessId]);

  const selectedBusiness = filteredBusinesses.find((b) => b.id === selectedBusinessId) ?? filteredBusinesses[0] ?? null;
  const visibleActions = selectedBusiness
    ? selectedBusiness.actions.filter((action) => canUseBusinessAction(selectedBusiness, action as BusinessAction, userId))
    : [];

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
        {/* Filters */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 px-4 py-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Filtres</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Categorie</p>
                <div className="space-y-1.5">
                  {categories.map((entry) => (
                    <FilterButton
                      key={entry}
                      active={category === entry}
                      label={entry === 'all' ? 'Toutes' : entry}
                      icon={entry === 'all' ? Wallet : entry === 'Finance' ? Landmark : entry === 'Tech' ? Building2 : BarChart3}
                      colorClass={entry === 'Finance' ? 'bg-emerald-500' : entry === 'Tech' ? 'bg-sky-500' : entry === 'Services' ? 'bg-violet-500' : 'bg-slate-600'}
                      onClick={() => setCategory(entry)}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Proprietaire</p>
                <div className="space-y-1.5">
                  <FilterButton active={ownerFilter === 'all'} label="Tous" icon={Wallet} colorClass="bg-slate-600" onClick={() => setOwnerFilter('all')} />
                  <FilterButton active={ownerFilter === 'you'} label="Mes businesses" icon={PiggyBank} colorClass="bg-purple-500" onClick={() => setOwnerFilter('you')} />
                  <FilterButton active={ownerFilter === 'player'} label="Autres joueurs" icon={UserPlus} colorClass="bg-amber-500" onClick={() => setOwnerFilter('player')} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un business ou un joueur..." className="pl-9" />
              </div>
              <div className="text-xs text-muted-foreground">{filteredBusinesses.length} resultat{filteredBusinesses.length > 1 ? 's' : ''}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border/30">
                {filteredBusinesses.map((business) => {
                  const Icon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
                  const selected = business.id === selectedBusiness?.id;
                  const isBank = business.typeKey === 'bank';

                  return (
                    <button
                      key={business.id}
                      type="button"
                      onClick={() => setSelectedBusinessId(business.id)}
                      className={cn('w-full px-5 py-4 text-left transition-colors', selected ? 'bg-muted/25' : 'hover:bg-muted/15')}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/20">
                          <Icon className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{business.name}</p>
                            {business.type ? <Pill label={business.type.label} color="bg-sky-400/15 text-sky-400" /> : null}
                            {business.ownerId === userId ? <Pill label="A toi" color="bg-purple-400/15 text-purple-400" /> : null}
                          </div>
                          <p className="text-xs text-muted-foreground">par {business.owner.username}</p>
                        </div>
                        {isBank ? (
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold tabular-nums text-emerald-400">{formatMoney(business.treasuryMoney)}</p>
                            <p className="text-[10px] text-amber-400/80 mt-0.5">{business.loanInterestRate ?? 4}% emprunt</p>
                            {business.livretEpargneUnlocked ? (
                              <p className="text-[10px] text-amber-400/60 flex items-center justify-end gap-0.5 mt-0.5">
                                <Sparkles className="h-2.5 w-2.5" />Livret
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="text-right shrink-0">
                            {(() => { const profit = business.monthlyRevenue - business.monthlyExpenses; return <>
                              <p className={cn('text-sm font-bold tabular-nums', profit >= 0 ? 'text-emerald-400' : 'text-red-400')}>{profit >= 0 ? '+' : ''}{profit.toLocaleString('fr-FR')}</p>
                              <p className="text-[10px] text-muted-foreground">{business.satisfaction}/100</p>
                            </>; })()}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                {filteredBusinesses.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aucun business ne correspond a tes filtres.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          {selectedBusiness ? (
            selectedBusiness.typeKey === 'bank' ? (
              <>
                {isAdmin ? (
                  <Card>
                    <CardContent className="px-5 py-3">
                      <Button size="sm" variant="outline" className="w-full justify-start border-red-400/30 text-red-300 hover:bg-red-500/10" onClick={() => void deleteSelectedBusiness()}>
                        <Trash2 className="mr-2 h-4 w-4" />Supprimer ce business
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}
                <BankDetailCard business={selectedBusiness} userId={userId} onReload={() => onReload(true)} />
                {/* Non-owner bank actions (loan, invest) */}
                {visibleActions.length > 0 ? (
                  <Card>
                    <CardContent className="space-y-2 px-5 py-4">
                      <SectionTitle>Actions</SectionTitle>
                      <div className="space-y-2">
                        {visibleActions.map((action) => {
                          const meta = ACTION_META[action as BusinessAction];
                          const Icon = meta.icon;
                          const [toneBg, toneText] = meta.tone.split(' ');
                          return (
                            <button
                              key={action}
                              type="button"
                              onClick={() => onAction(selectedBusiness, action as BusinessAction)}
                              className="flex w-full items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                            >
                              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', toneBg)}>
                                <Icon className={cn('h-4 w-4', toneText)} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{meta.label}</p>
                                <p className="text-xs text-muted-foreground">{meta.help}</p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </>
            ) : (
              <DefaultDetailCard
                business={selectedBusiness}
                userId={userId}
                isAdmin={isAdmin}
                onDeleteBusiness={() => void deleteSelectedBusiness()}
                onAction={onAction}
                visibleActions={visibleActions}
              />
            )
          ) : (
            <Card>
              <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">
                Selectionne un business pour voir ses details.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <InvitePlayersModal open={Boolean(inviteBusiness)} onClose={() => setInviteBusiness(null)} business={inviteBusiness} players={players} onSubmitted={() => onReload()} />
      <LoanModal open={Boolean(loanBusiness)} onClose={() => setLoanBusiness(null)} business={loanBusiness} onSubmitted={() => onReload(true)} />
      <InvestModal open={Boolean(investBusiness)} onClose={() => setInvestBusiness(null)} business={investBusiness} onSubmitted={() => onReload(true)} />
    </>
  );
}

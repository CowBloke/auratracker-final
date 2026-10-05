import { useMemo, useRef, useEffect, useState } from 'react';
import { Building2, Wallet, MapPin, AlertTriangle, ChevronRight, Hammer, Gauge, TrendingUp } from 'lucide-react';
import { Area, AreaChart } from 'recharts';
import { toast } from 'sonner';
import { useNotifications } from '@/contexts/NotificationContext';
import { UsernameDisplay } from '@/components/ui/username-display';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { type YouState, type YouJobOffer, type YouBusiness, youApi } from '@/services/api';
import { PRODUCER_TYPES } from '@/lib/resources';
import { ManageBusinessModal } from './components/modals';
import { ProductionModal } from './components/ProductionModal';
import { BUSINESS_ICON_MAP } from './constants';
import { isYouNotification, withRouteError } from './utils';
import { FeedCard } from './components/YouPrimitives';
import { YouSkillsCard } from './components/YouSkillsCard';
import { type FeedItem } from './types';
import { CarteTab, type CarteTabHandle } from './tabs/CarteTab';
import { BusinessBrowserModal } from './components/BusinessBrowserModal';

const sparklineConfig = { value: { label: 'Revenu', color: 'var(--chart-1)' } } satisfies ChartConfig;

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  return (
    <ChartContainer config={sparklineConfig} className="aspect-auto h-8 w-full">
      <AreaChart data={data.map((value, index) => ({ index, value }))}>
        <Area dataKey="value" type="monotone" stroke="var(--color-value)" fill="var(--color-value)" fillOpacity={0.15} strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ChartContainer>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-semibold tabular-nums', tone)}>{value}</span>
    </div>
  );
}

function OwnedBizTile({ b, onManage, onWork, onStartPlacing, currentUserId }: {
  b: YouBusiness;
  onManage: () => void;
  onWork: () => void;
  onStartPlacing: (id: string) => void;
  currentUserId: string;
}) {
  const Icon = BUSINESS_ICON_MAP[b.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
  const net = b.monthlyRevenue - b.monthlyExpenses;
  const isUnplaced = b.mapX == null || b.mapY == null;
  const sparkData = (b.revenueHistory ?? []).slice(-30);
  const isProducer = PRODUCER_TYPES.has(b.typeKey);
  const myMember = b.members.find((m) => m.user.id === currentUserId);
  const needsWork = isProducer && myMember != null && !myMember.workedToday && !b.underConstruction;
  const f = b.financials;
  const displayNet = f?.netDaily ?? Math.round(net / 30);
  const runwayLabel = f?.runwayDays == null ? 'stable' : `${f.runwayDays}j`;

  return (
    <Card className="gap-3 py-3" data-tutorial-id="you-dashboard-owned-business-card">
      {isUnplaced ? (
        <div className="px-3">
          <Alert variant="warning">
            <AlertTriangle />
            <AlertDescription className="flex items-center justify-between gap-2">
              Non placé sur la carte
              <Button size="xs" variant="outline" onClick={() => onStartPlacing(b.id)} data-tutorial-id="you-dashboard-place-business">
                <MapPin />
                Placer
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      {needsWork ? (
        <div className="px-3">
          <Alert variant="warning">
            <Hammer />
            <AlertDescription className="flex items-center justify-between gap-2">
              Travail journalier requis
              <Button size="xs" variant="outline" onClick={onWork} data-tutorial-id="you-dashboard-work-button">
                <Hammer />
                Travailler
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      <Button variant="ghost" size="xs" type="button" onClick={onManage}>
        <Item size="sm" className="p-0">
          <ItemMedia variant="icon">
            <Icon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{b.name}</ItemTitle>
            <ItemDescription>
              {b.type?.label ?? b.typeKey} · Niv. {b.level}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <ChevronRight className="size-4 text-muted-foreground" />
          </ItemActions>
        </Item>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Trésorerie" value={`${b.treasuryMoney.toLocaleString('fr-FR')}€`} />
          <Stat
            label="Net /jour"
            value={`${displayNet >= 0 ? '+' : ''}${displayNet.toLocaleString('fr-FR')}€`}
            tone={displayNet >= 0 ? 'text-success' : 'text-destructive'}
          />
        </div>
        {f ? (
          <>
            <Separator />
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Runway" value={runwayLabel} tone={f.runwayDays != null && f.runwayDays < 5 ? 'text-warning' : undefined} />
              <Stat label="Crédit" value={String(f.creditScore)} />
              <Stat
                label="Intrants"
                value={`${f.inputCoverage.percent}%`}
                tone={f.inputCoverage.percent >= 80 ? 'text-success' : f.inputCoverage.percent >= 45 ? 'text-warning' : 'text-destructive'}
              />
            </div>
          </>
        ) : null}
        <Sparkline data={sparkData} />
      </Button>
    </Card>
  );
}

function MemberBizTile({ b, currentUserId, onOpen, onWork }: {
  b: YouBusiness;
  currentUserId: string;
  onOpen: () => void;
  onWork: () => void;
}) {
  const Icon = BUSINESS_ICON_MAP[b.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
  const isProducer = PRODUCER_TYPES.has(b.typeKey);
  const myMember = b.members.find((m) => m.user.id === currentUserId);
  const needsWork = isProducer && myMember != null && !myMember.workedToday && !b.underConstruction;
  const owner = b.owner as typeof b.owner & { usernameColor?: string | null };

  return (
    <Card className="gap-3 py-3">
      {needsWork ? (
        <div className="px-3">
          <Alert variant="warning">
            <Hammer />
            <AlertDescription className="flex items-center justify-between gap-2">
              Travail journalier requis
              <Button size="xs" variant="outline" onClick={onWork}>
                <Hammer />
                Travailler
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      <Button variant="ghost" size="xs" type="button" onClick={onOpen}>
        <Item size="sm" className="p-0">
          <ItemMedia variant="icon">
            <Icon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{b.name}</ItemTitle>
            <ItemDescription className="flex items-center gap-1">
              @
              <UsernameDisplay
                username={owner.username}
                userId={owner.id}
                firstName={owner.firstName}
                usernameColor={owner.usernameColor}
                preset="minimal"
                clickable
              />
              · {b.type?.label ?? b.typeKey}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <ChevronRight className="size-4 text-muted-foreground" />
          </ItemActions>
        </Item>
      </Button>
    </Card>
  );
}

function DashLeftRail({ data, currentUserId, onManageBiz, onWorkBiz, onStartPlacing, onOpenBrowser }: {
  data: YouState;
  currentUserId: string;
  onManageBiz: (id: string) => void;
  onWorkBiz: (id: string) => void;
  onStartPlacing: (id: string) => void;
  onOpenBrowser: () => void;
}) {
  const owned = data.ownedBusinesses;
  const memberOnly = data.memberBusinesses;
  const allCount = useMemo(() => {
    const ids = new Set<string>();
    [data.ownedBusinesses, data.exploreBusinesses, data.memberBusinesses, data.shareholderBusinesses].forEach((g) => g.forEach((b) => ids.add(b.id)));
    return ids.size;
  }, [data]);

  const totalTreasury = owned.reduce((sum, b) => sum + b.treasuryMoney, 0);
  const totalNet = owned.reduce((sum, b) => sum + b.monthlyRevenue - b.monthlyExpenses, 0);

  return (
    <aside className="flex min-h-0 flex-col border-r" data-tutorial-id="you-dashboard-left-rail">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Ton empire</h2>
            <Badge variant="secondary">
              {owned.length}/{data.businessSlots}
            </Badge>
          </div>

          {owned.length > 0 ? (
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardDescription>Valeur totale</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{totalTreasury.toLocaleString('fr-FR')} €</CardTitle>
                <CardDescription className={totalNet >= 0 ? 'text-success' : 'text-destructive'}>
                  {totalNet >= 0 ? '+' : ''}
                  {totalNet.toLocaleString('fr-FR')}€ /mois
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-1 px-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Gauge className="size-3" />
                  Crédit moyen {Math.round(owned.reduce((sum, b) => sum + (b.financials?.creditScore ?? 500), 0) / Math.max(1, owned.length))}
                </span>
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="size-3" />
                  {owned.reduce((sum, b) => sum + (b.financials?.receivables ?? 0), 0).toLocaleString('fr-FR')}€ à recevoir
                </span>
              </CardContent>
            </Card>
          ) : null}

          <YouSkillsCard />

          <div className="flex flex-col gap-2">
            {owned.map((b) => (
              <OwnedBizTile key={b.id} b={b} onManage={() => onManageBiz(b.id)} onWork={() => onWorkBiz(b.id)} onStartPlacing={onStartPlacing} currentUserId={currentUserId} />
            ))}
            {owned.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyDescription>Aucun business pour le moment</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
          </div>

          {memberOnly.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Employé</h3>
              {memberOnly.map((b) => (
                <MemberBizTile key={b.id} b={b} currentUserId={currentUserId} onOpen={() => onManageBiz(b.id)} onWork={() => onWorkBiz(b.id)} />
              ))}
            </section>
          ) : null}
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        <Item asChild variant="outline" size="sm">
          <button type="button" onClick={onOpenBrowser} className="w-full text-left">
            <ItemMedia variant="icon">
              <Building2 />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Parcourir les entreprises</ItemTitle>
              <ItemDescription>{allCount} disponibles</ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronRight className="size-4 text-muted-foreground" />
            </ItemActions>
          </button>
        </Item>
      </div>
    </aside>
  );
}


// ---- Right Rail (feed — real FeedCard with actions) ----

const FEED_TABS = [
  { key: 'all',    label: 'Tout'     },
  { key: 'biz',    label: 'Business' },
  { key: 'money',  label: 'Argent'   },
  { key: 'social', label: 'Social'   },
] as const;

type FeedTab = typeof FEED_TABS[number]['key'];

function DashRightRail({ data, userId, onReload }: { data: YouState; userId: string; onReload: () => Promise<void> }) {
  const [tab, setTab] = useState<FeedTab>('all');
  const { notifications } = useNotifications();
  const youNotifs = useMemo(() => notifications.filter(isYouNotification).slice(0, 6), [notifications]);

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    const seenLoanIds = new Set<string>();

    for (const n of youNotifs) {
      items.push({ kind: 'notification', date: n.createdAt, id: `notif-${n.id}`, notification: n });
    }
    for (const offer of data.jobOffers) {
      items.push({ kind: 'job_offer', date: offer.createdAt, id: `offer-${offer.id}`, offer });
    }
    for (const r of data.relationships) {
      if (r.pendingProposal?.canRespond) {
        items.push({ kind: 'marriage_proposal', date: r.pendingProposal.createdAt, id: `marry-${r.id}`, relationship: r });
      }
      if (r.pendingDivorceProposal?.canRespond) {
        items.push({ kind: 'divorce_proposal', date: r.pendingDivorceProposal.createdAt, id: `divorce-${r.id}`, relationship: r });
      }
      items.push({ kind: 'relationship', date: r.createdAt, id: `rel-${r.id}`, relationship: r });
    }
    for (const business of [...data.ownedBusinesses, ...data.exploreBusinesses]) {
      for (const loan of business.recentLoans) {
        if (loan.status === 'ACTIVE' && loan.borrower.id === userId && !seenLoanIds.has(loan.id)) {
          seenLoanIds.add(loan.id);
          items.push({ kind: 'active_loan', date: loan.createdAt, id: `loan-${loan.id}`, businessName: business.name, loan });
        }
      }
    }
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data, userId, youNotifs]);

  const respondToJobOffer = async (offer: YouJobOffer, decision: 'accept' | 'reject') => {
    await withRouteError(() => youApi.respondToBusinessInvitation(offer.id, decision), 'Impossible de traiter cette offre.');
    toast.success(decision === 'accept' ? 'Offre acceptée' : 'Offre refusée');
    await onReload();
  };

  const respondToMarriage = async (proposalId: string, decision: 'accept' | 'reject') => {
    await withRouteError(() => youApi.respondToMarriageProposal(proposalId, decision), 'Impossible de traiter la demande.');
    toast.success(decision === 'accept' ? 'Mariage validé' : 'Demande refusée');
    await onReload();
  };

  const respondToDivorce = async (proposalId: string, decision: 'accept' | 'reject') => {
    await withRouteError(() => youApi.respondToDivorceProposal(proposalId, decision), 'Impossible de traiter la demande de divorce.');
    toast.success(decision === 'accept' ? 'Divorce validé' : 'Divorce refusé');
    await onReload();
  };

  const repayLoan = async (loanId: string, percentage: number) => {
    await withRouteError(() => youApi.borrowerRepayLoan(loanId, percentage), 'Impossible de rembourser ce prêt.');
    toast.success(percentage === 100 ? 'Tentative de remboursement intégral' : `${percentage}% remboursé`);
    await onReload();
  };

  const filtered = tab === 'all' ? feedItems
    : tab === 'biz'    ? feedItems.filter((f) => f.kind === 'job_offer')
    : tab === 'money'  ? feedItems.filter((f) => f.kind === 'active_loan')
    : feedItems.filter((f) => f.kind === 'marriage_proposal' || f.kind === 'divorce_proposal' || f.kind === 'relationship');

  return (
    <aside className="flex min-h-0 flex-col border-l">
      <div className="flex items-center justify-between gap-2 p-3 pb-0">
        <h2 className="text-sm font-semibold">Fil d&apos;actualité</h2>
        {filtered.length > 0 ? <Badge variant="secondary">{filtered.length}</Badge> : null}
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as FeedTab)} className="min-h-0 flex-1 gap-3 p-3">
        <TabsList className="w-full">
          {FEED_TABS.map(({ key, label }) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollArea className="min-h-0 flex-1">
          {filtered.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyDescription>Aucun événement récent</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-2 pr-3">
              {filtered.map((item) => (
                <FeedCard
                  key={item.id}
                  item={item}
                  onRespondJobOffer={respondToJobOffer}
                  onRespondMarriage={respondToMarriage}
                  onRespondDivorce={respondToDivorce}
                  onRepayLoan={repayLoan}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </Tabs>
    </aside>
  );
}

// ---- Bottom Ticker ----

function DashTicker({ data }: { data: YouState }) {
  const offsetRef = useRef(0);
  const [, forceUpdate] = useState(0);

  const items = useMemo(() => {
    const base = [
      { sym: 'EMP', label: `${data.ownedBusinesses.length} businesses` },
      { sym: 'TRE', label: `${data.ownedBusinesses.reduce((s, b) => s + b.treasuryMoney, 0).toLocaleString('fr-FR')}€ trésorerie` },
      { sym: 'REV', label: `+${data.ownedBusinesses.reduce((s, b) => s + b.monthlyRevenue, 0).toLocaleString('fr-FR')}€ /mois` },
      { sym: 'SOC', label: `${data.relationships.length} relations` },
    ];
    const market = data.shareMarketListings
      .filter((l) => l.status === 'ACTIVE').slice(0, 6)
      .map((l) => ({ sym: l.business.name.slice(0, 5).toUpperCase(), label: `${l.business.name} · ${l.sharePercent}% · ${l.price.toLocaleString('fr-FR')}€` }));
    return [...base, ...market, ...base, ...market];
  }, [data]);

  useEffect(() => {
    const id = setInterval(() => { offsetRef.current = (offsetRef.current + 0.4) % 2400; forceUpdate((n) => n + 1); }, 40);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="col-span-full flex h-12 items-center gap-4 overflow-hidden border-t bg-card px-4">
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Wallet className="size-3" />
        Flux
      </span>
      <Separator orientation="vertical" className="h-4" />
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-6 whitespace-nowrap" style={{ transform: `translateX(${-offsetRef.current}px)` }}>
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-xs">
              <Badge variant="secondary" className="font-mono">
                {item.sym}
              </Badge>
              <span>{item.label}</span>
              <span className="text-muted-foreground">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Main Dashboard ----

export function YouDashboard({ data, userId, isAdmin, onReload }: {
  data: YouState;
  userId: string;
  isAdmin: boolean;
  onReload: () => Promise<void>;
}) {
  const carteRef = useRef<CarteTabHandle>(null);
  const [managedBizId, setManagedBizId] = useState<string | null>(null);
  const [productionBizId, setProductionBizId] = useState<string | null>(null);
  const [showBrowserModal, setShowBrowserModal] = useState(false);

  const allBusinesses = useMemo(() => {
    const map = new Map<string, YouBusiness>();
    [data.ownedBusinesses, data.exploreBusinesses, data.memberBusinesses, data.shareholderBusinesses]
      .forEach((g) => g.forEach((b) => map.set(b.id, b)));
    return Array.from(map.values());
  }, [data]);

  const managedBusiness = managedBizId
    ? (data.ownedBusinesses.find((b) => b.id === managedBizId) ??
       data.memberBusinesses.find((b) => b.id === managedBizId) ?? null)
    : null;

  const productionBusiness = productionBizId
    ? (data.ownedBusinesses.find((b) => b.id === productionBizId) ??
       data.memberBusinesses.find((b) => b.id === productionBizId) ?? null)
    : null;

  function handleStartPlacing(id: string) {
    carteRef.current?.startPlacing(id);
  }

  return (
    <>
      <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)_3rem] overflow-hidden lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)_22rem]">
        <div className="hidden min-h-0 lg:flex lg:flex-col">
          <DashLeftRail
            data={data}
            currentUserId={userId}
            onManageBiz={setManagedBizId}
            onWorkBiz={setProductionBizId}
            onStartPlacing={handleStartPlacing}
            onOpenBrowser={() => setShowBrowserModal(true)}
          />
        </div>
        <div className="relative min-h-0 overflow-hidden" data-tutorial-id="you-dashboard-map">
          <CarteTab ref={carteRef} data={data} userId={userId} isAdmin={isAdmin} onReload={onReload} embedded />
        </div>
        <div className="hidden min-h-0 xl:flex xl:flex-col">
          <DashRightRail data={data} userId={userId} onReload={onReload} />
        </div>
        <DashTicker data={data} />
      </div>

      <BusinessBrowserModal
        open={showBrowserModal}
        onClose={() => setShowBrowserModal(false)}
        businesses={allBusinesses}
        userId={userId}
        players={data.players}
        onReload={onReload}
      />

      <ManageBusinessModal
        open={Boolean(managedBusiness)}
        onClose={() => setManagedBizId(null)}
        business={managedBusiness}
        players={data.players}
        currentUserId={userId}
        onInviteRequested={() => {}}
        onSubmitted={onReload}
      />

      {productionBusiness && (
        <ProductionModal
          open
          onClose={() => setProductionBizId(null)}
          business={productionBusiness}
          currentUserId={userId}
          onReload={onReload}
        />
      )}

    </>
  );
}

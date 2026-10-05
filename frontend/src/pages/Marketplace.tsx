import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BellRing, CheckCircle2, Package, Search, Tag, TrendingUp, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import {
  marketplaceApi,
  type MarketplaceListing,
  type MarketplaceListingItem,
  type MarketplaceProductStats,
  type MarketplaceProductStatsPoint,
} from '../services/api';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { DoodleJumpSkinPreview } from '@/components/shop/DoodleJumpSkinPreview';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn, humanizeUiLabel } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';

// ── Types ────────────────────────────────────────────────
interface InventoryItem {
  id: string;
  quantity: number;
  acquiredAt: string;
  item: MarketplaceListingItem;
}

type TopTab = 'items' | 'sell' | 'mine';
type ItemsSubTab = 'market' | 'history' | 'stats';
type MarketplaceSortMode = 'newest' | 'price-asc' | 'price-desc' | 'quantity-desc';
type ItemTypeFilter = 'ALL' | 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';

const TYPE_LABELS: Record<ItemTypeFilter, string> = {
  ALL: 'Tous',
  CONSUMABLE: 'Objets',
  COSMETIC: 'Cosmétiques',
  UPGRADE: 'Améliorations',
};

const SORT_OPTIONS: Array<{ value: MarketplaceSortMode; label: string }> = [
  { value: 'newest',        label: 'Plus récents' },
  { value: 'price-asc',     label: 'Prix croissant' },
  { value: 'price-desc',    label: 'Prix décroissant' },
  { value: 'quantity-desc', label: 'Quantité décroissante' },
];

// ── Formatters ───────────────────────────────────────────
function formatMoney(amount: number) {
  return `$${amount.toLocaleString('fr-FR')}`;
}

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr);
  const diffH = Math.floor((Date.now() - date.getTime()) / 3_600_000);
  if (diffH < 1) return "À l'instant";
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `Il y a ${diffD}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatEvolution(value: number | null) {
  if (value === null) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function evolutionTone(value: number | null) {
  if (value === null) return 'text-muted-foreground';
  if (value > 0) return 'text-success';
  if (value < 0) return 'text-destructive';
  return 'text-muted-foreground';
}

function getTypeLabel(type: string) {
  return TYPE_LABELS[type as ItemTypeFilter] ?? humanizeUiLabel(type);
}

function getStatusLabel(status: MarketplaceListing['status']) {
  switch (status) {
    case 'ACTIVE': return 'En vente';
    case 'SOLD': return 'Vendue';
    case 'CANCELLED': return 'Annulée';
    default: return humanizeUiLabel(status);
  }
}

function statusVariant(status: MarketplaceListing['status']): 'success' | 'secondary' | 'warning' | 'outline' {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'SOLD': return 'secondary';
    case 'CANCELLED': return 'warning';
    default: return 'outline';
  }
}

function parseEffectLabel(effect?: string | null) {
  if (!effect) return null;
  try {
    const parsed = JSON.parse(effect) as { type?: string; bonusAura?: number; bonusMoney?: number };
    if (typeof parsed.bonusAura === 'number') return `+${parsed.bonusAura} aura`;
    if (typeof parsed.bonusMoney === 'number') return `+${parsed.bonusMoney} money`;
    if (parsed.type) return humanizeUiLabel(parsed.type);
  } catch { return null; }
  return null;
}

function getSkinImageUrl(effect?: string | null): string | null {
  if (!effect) return null;
  try {
    const parsed = JSON.parse(effect) as { type?: string; skinImageUrl?: string };
    if (parsed.type === 'DOODLE_JUMP_SKIN' && parsed.skinImageUrl) return parsed.skinImageUrl;
  } catch { return null; }
  return null;
}


const priceChartConfig = { price: { label: 'Prix moyen', color: 'var(--chart-1)' } } satisfies ChartConfig;

// ── Price history chart ───────────────────────────────────
function PriceHistoryChart({ timeline }: { timeline: MarketplaceProductStatsPoint[] }) {
  const hasData = timeline.some((point) => point.averageUnitPrice !== null);

  if (!hasData) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyDescription>Pas de ventes enregistrées sur 30 jours.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const data = timeline.map((point) => ({ date: point.date, price: point.averageUnitPrice }));

  return (
    <ChartContainer config={priceChartConfig} className="h-32 w-full">
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          minTickGap={32}
        />
        <YAxis width={48} tickLine={false} axisLine={false} tickFormatter={(value) => formatMoney(Math.round(value))} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatMoney(Math.round(Number(value)))} />} />
        <Area dataKey="price" type="monotone" stroke="var(--color-price)" fill="var(--color-price)" fillOpacity={0.2} connectNulls />
      </AreaChart>
    </ChartContainer>
  );
}

// ── Sparkline (stats tab) ────────────────────────────────
function MarketplaceTrendSparkline({ timeline }: { timeline: MarketplaceProductStats['timeline'] }) {
  if (!timeline.some((point) => point.averageUnitPrice !== null)) {
    return <p className="text-xs text-muted-foreground">Pas de ventes sur 30 jours.</p>;
  }

  return (
    <ChartContainer config={priceChartConfig} className="h-14 w-full">
      <LineChart data={timeline.map((point) => ({ date: point.date, price: point.averageUnitPrice }))}>
        <Line dataKey="price" type="monotone" stroke="var(--color-price)" strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ChartContainer>
  );
}

// ── Item thumbnail ────────────────────────────────────────
function ItemThumb({ item }: { item: MarketplaceListingItem }) {
  const skinImageUrl = getSkinImageUrl(item.effect);
  const imageUrl = item.imageUrl ? resolveImageUrl(item.imageUrl) : null;

  return (
    <ItemMedia variant={skinImageUrl || imageUrl ? 'image' : 'icon'}>
      {skinImageUrl ? (
        <DoodleJumpSkinPreview skinImageUrl={skinImageUrl} className="h-full" height="100%" />
      ) : imageUrl ? (
        <img src={imageUrl} alt={item.name} />
      ) : (
        <Package />
      )}
    </ItemMedia>
  );
}

function SellerAvatar({ seller }: { seller: MarketplaceListing['seller'] }) {
  return (
    <Avatar className="size-6">
      {seller.profilePicture ? <AvatarImage src={resolveImageUrl(seller.profilePicture)} alt={seller.username} /> : null}
      <AvatarFallback className="text-xs">{seller.username.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

function StatTile({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: React.ReactNode }) {
  return (
    <Card className="gap-0 py-0 shadow-none"><CardContent className="p-3 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('flex items-center gap-1 text-sm font-semibold tabular-nums', tone)}>
        {icon}
        {value}
      </span>
    </CardContent></Card>
  );
}

// ── Item Detail Modal ────────────────────────────────────
function ItemDetailModal({
  listing,
  otherListings,
  stat,
  currentUserId,
  buyingListingId,
  onBuy,
  onClose,
}: {
  listing: MarketplaceListing;
  otherListings: MarketplaceListing[];
  stat: MarketplaceProductStats | null;
  currentUserId?: string;
  buyingListingId: string | null;
  onBuy: (listing: MarketplaceListing) => void;
  onClose: () => void;
}) {
  const effectLabel = parseEffectLabel(listing.item.effect);
  const isOwner = currentUserId === listing.sellerId;
  const evolution = stat?.priceEvolutionPct30d ?? null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{getTypeLabel(listing.item.type)}</Badge>
            {effectLabel ? (
              <Badge variant="outline">
                <Tag />
                {effectLabel}
              </Badge>
            ) : null}
          </div>
          <DialogTitle>{listing.item.name}</DialogTitle>
          <DialogDescription>{listing.item.description}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="listing" className="gap-4">
          <TabsList className="w-full">
            <TabsTrigger value="listing">Cette annonce</TabsTrigger>
            <TabsTrigger value="others">
              Autres offres
              {otherListings.length > 0 ? <Badge variant="secondary">{otherListings.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="trend">Tendance 30j</TabsTrigger>
          </TabsList>

          <TabsContent value="listing" className="flex flex-col gap-4">
            <Item variant="outline" size="sm">
              <ItemMedia>
                <SellerAvatar seller={listing.seller} />
              </ItemMedia>
              <ItemContent>
                <ItemDescription>Vendeur</ItemDescription>
                <ItemTitle style={listing.seller.usernameColor ? { color: listing.seller.usernameColor } : undefined}>
                  {listing.seller.username}
                </ItemTitle>
              </ItemContent>
              <ItemActions>
                <span className="text-xs text-muted-foreground">Publié {formatRelativeDate(listing.createdAt)}</span>
              </ItemActions>
            </Item>
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Prix / unité" value={formatMoney(listing.unitPrice)} />
              <StatTile label="Quantité" value={`x${listing.quantity}`} />
              <StatTile label="Total" value={formatMoney(listing.totalPrice)} />
            </div>
            {isOwner ? (
              <p className="text-center text-sm text-muted-foreground">C&apos;est votre annonce.</p>
            ) : (
              <Button onClick={() => onBuy(listing)} disabled={!!buyingListingId}>
                {buyingListingId === listing.id ? <Spinner /> : null}
                Acheter · {formatMoney(listing.totalPrice)}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="others">
            {otherListings.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyDescription>Aucune autre offre pour cet objet.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ScrollArea className="h-60">
                <ItemGroup>
                  {otherListings.map((other, index) => {
                    const isMine = currentUserId === other.sellerId;
                    return (
                      <div key={other.id}>
                        {index > 0 ? <ItemSeparator /> : null}
                        <Item size="sm">
                          <ItemMedia>
                            <SellerAvatar seller={other.seller} />
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle style={other.seller.usernameColor ? { color: other.seller.usernameColor } : undefined}>
                              {other.seller.username}
                            </ItemTitle>
                            <ItemDescription>
                              x{other.quantity} · {formatMoney(other.unitPrice)} / u.
                            </ItemDescription>
                          </ItemContent>
                          <ItemActions>
                            {isMine ? (
                              <Badge variant="outline">Vous</Badge>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => onBuy(other)} disabled={!!buyingListingId}>
                                {buyingListingId === other.id ? <Spinner /> : 'Acheter'}
                              </Button>
                            )}
                          </ItemActions>
                        </Item>
                      </div>
                    );
                  })}
                </ItemGroup>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="trend" className="flex flex-col gap-4">
            {stat ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <StatTile
                    label="Prix moyen 30j"
                    value={stat.averageUnitPrice30d === null ? 'N/A' : formatMoney(Math.round(stat.averageUnitPrice30d))}
                  />
                  <StatTile
                    label="Évolution 30j"
                    value={formatEvolution(evolution)}
                    tone={evolutionTone(evolution)}
                    icon={(evolution ?? 0) > 0 ? <ArrowUpRight className="size-3.5" /> : (evolution ?? 0) < 0 ? <ArrowDownRight className="size-3.5" /> : null}
                  />
                  <StatTile label="Offre la plus basse" value={stat.lowestOffer === null ? 'Aucune' : formatMoney(stat.lowestOffer)} />
                  <StatTile label="Ventes 30j" value={`${stat.soldUnits30d.toLocaleString('fr-FR')} u.`} />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <TrendingUp className="size-4" />
                    Prix moyen journalier
                  </span>
                  <PriceHistoryChart timeline={stat.timeline} />
                </div>
              </>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyDescription>Aucune donnée disponible pour cet objet.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Inventory listing card (sell tab) ─────────────────────
function InventoryListingCard({ item, selected, onSelect }: { item: InventoryItem; selected: boolean; onSelect: (item: InventoryItem) => void }) {
  const effectLabel = parseEffectLabel(item.item.effect);
  return (
    <Item asChild variant={selected ? 'muted' : 'outline'} size="sm" className={cn(selected && 'border-primary')}>
      <button type="button" aria-pressed={selected} onClick={() => onSelect(item)} className="text-left">
        <ItemThumb item={item.item} />
        <ItemContent>
          <ItemTitle>
            {item.item.name}
            <Badge variant="secondary">x{item.quantity}</Badge>
          </ItemTitle>
          <ItemDescription>{getTypeLabel(item.item.type)}</ItemDescription>
          {effectLabel ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Tag className="size-3" />
              {effectLabel}
            </span>
          ) : null}
        </ItemContent>
      </button>
    </Item>
  );
}

function GridLoading({ cards }: { cards: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: cards }, (_, index) => (
        <Skeleton key={index} className="h-32" />
      ))}
    </div>
  );
}

function EmptyBlock({ icon, title, description }: { icon?: React.ReactNode; title: string; description?: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        {icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
    </Empty>
  );
}

export default function Marketplace() {
  const { user, updateBalance } = useAuth();
  const [loading, setLoading] = useState(true);
  const [marketListings, setMarketListings] = useState<MarketplaceListing[]>([]);
  const [salesHistoryListings, setSalesHistoryListings] = useState<MarketplaceListing[]>([]);
  const [marketStats, setMarketStats] = useState<MarketplaceProductStats[]>([]);
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Tab state
  const [topTab, setTopTab] = useState<TopTab>('items');
  const [itemsSubTab, setItemsSubTab] = useState<ItemsSubTab>('market');

  // Item marketplace state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ItemTypeFilter>('ALL');
  const [sortMode, setSortMode] = useState<MarketplaceSortMode>('newest');
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [sellQuantity, setSellQuantity] = useState('1');
  const [sellPrice, setSellPrice] = useState('');
  const [submittingListing, setSubmittingListing] = useState(false);
  const [buyingListingId, setBuyingListingId] = useState<string | null>(null);
  const [cancellingListingId, setCancellingListingId] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [inventoryRes, marketRes, salesHistoryRes, myListingsRes, marketStatsRes] = await Promise.all([
        marketplaceApi.getInventory(user.id),
        marketplaceApi.getListings({ status: 'ACTIVE' }),
        marketplaceApi.getListings({ status: 'SOLD' }),
        marketplaceApi.getListings({ sellerId: user.id, status: 'ALL' }),
        marketplaceApi.getListingStats(30),
      ]);
      setInventory((inventoryRes.data.items || []).filter((entry: InventoryItem) => entry.item.type !== 'GIFT'));
      setMarketListings(marketRes.data.listings || []);
      setSalesHistoryListings(salesHistoryRes.data.listings || []);
      setMarketStats(marketStatsRes.data.products || []);
      setMyListings(myListingsRes.data.listings || []);
    } catch {
      toast.error('Impossible de charger le marché.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user?.id]);

  const selectedInventoryItem = useMemo(
    () => inventory.find((item) => item.id === selectedInventoryId) ?? null,
    [inventory, selectedInventoryId],
  );

  useEffect(() => {
    if (!selectedInventoryItem) { setSellQuantity('1'); setSellPrice(''); return; }
    setSellQuantity('1');
    setSellPrice(String(selectedInventoryItem.item.price));
  }, [selectedInventoryItem]);

  const activeListings = useMemo(() => marketListings.filter((l) => l.status === 'ACTIVE'), [marketListings]);

  const filteredMarketListings = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activeListings
      .filter((l) => typeFilter === 'ALL' || l.item.type === typeFilter)
      .filter((l) => !term || [l.item.name, l.item.description, l.seller.username].join(' ').toLowerCase().includes(term))
      .sort((a, b) => {
        switch (sortMode) {
          case 'price-asc': return a.unitPrice - b.unitPrice;
          case 'price-desc': return b.unitPrice - a.unitPrice;
          case 'quantity-desc': return b.quantity - a.quantity;
          default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
  }, [activeListings, search, typeFilter, sortMode]);

  const selectedListing = useMemo(() => activeListings.find((l) => l.id === selectedListingId) ?? null, [activeListings, selectedListingId]);
  const otherListings = useMemo(() => {
    if (!selectedListing) return [];
    return activeListings.filter((l) => l.item.id === selectedListing.item.id && l.id !== selectedListing.id).sort((a, b) => a.unitPrice - b.unitPrice);
  }, [activeListings, selectedListing]);
  const selectedStat = useMemo(() => marketStats.find((s) => s.itemId === selectedListing?.item.id) ?? null, [marketStats, selectedListing]);
  useEffect(() => { if (selectedListingId && !selectedListing) setSelectedListingId(null); }, [selectedListingId, selectedListing]);

  const sortedSalesHistoryListings = useMemo(
    () => [...salesHistoryListings].sort((a, b) => {
      const aT = a.soldAt ? new Date(a.soldAt).getTime() : new Date(a.createdAt).getTime();
      const bT = b.soldAt ? new Date(b.soldAt).getTime() : new Date(b.createdAt).getTime();
      return bT - aT;
    }),
    [salesHistoryListings],
  );
  const myActiveListings = useMemo(() => myListings.filter((l) => l.status === 'ACTIVE'), [myListings]);
  const myHistoryListings = useMemo(() => myListings.filter((l) => l.status !== 'ACTIVE'), [myListings]);

  const handleCreateListing = async () => {
    if (!user || !selectedInventoryItem || submittingListing) return;
    const quantity = Number.parseInt(sellQuantity, 10);
    const unitPrice = Number.parseInt(sellPrice, 10);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > selectedInventoryItem.quantity) { toast.error('Quantité invalide.'); return; }
    if (!Number.isInteger(unitPrice) || unitPrice < 1) { toast.error('Prix invalide.'); return; }
    try {
      setSubmittingListing(true);
      await marketplaceApi.createListing({ userItemId: selectedInventoryItem.id, quantity, unitPrice });
      toast.success('Annonce créée', { description: `${selectedInventoryItem.item.name} est maintenant en vente.` });
      await loadData();
      setTopTab('items');
      setItemsSubTab('market');
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Impossible de créer l'annonce.");
    } finally {
      setSubmittingListing(false);
    }
  };

  const handleBuyListing = async (listing: MarketplaceListing) => {
    if (!user || buyingListingId) return;
    try {
      setBuyingListingId(listing.id);
      const response = await marketplaceApi.buyListing(listing.id);
      updateBalance(response.data.newBalance.aura, response.data.newBalance.money);
      toast.success('Achat confirmé', { description: `${listing.item.name} a été ajouté à ton inventaire.` });
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Impossible d'acheter cette annonce.");
    } finally {
      setBuyingListingId(null);
    }
  };

  const handleCancelListing = async (listing: MarketplaceListing) => {
    if (!user || cancellingListingId) return;
    try {
      setCancellingListingId(listing.id);
      await marketplaceApi.cancelListing(listing.id);
      toast.success('Annonce annulée', { description: `${listing.item.name} est retourné dans ton inventaire.` });
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Impossible d'annuler cette annonce.");
    } finally {
      setCancellingListingId(null);
    }
  };


  const selectedMaxQuantity = selectedInventoryItem?.quantity ?? 0;

  return (
    <PageShell>
      <PageHeader title="Marché" description="Achetez et vendez des objets entre joueurs." />

      <Tabs value={topTab} onValueChange={(value) => setTopTab(value as TopTab)} className="gap-6">
        <TabsList>
          <TabsTrigger value="items">Objets</TabsTrigger>
          <TabsTrigger value="sell">Vendre</TabsTrigger>
          <TabsTrigger value="mine">Mes annonces</TabsTrigger>
        </TabsList>

        {/* ── ITEMS TAB ─────────────────────────────── */}
        <TabsContent value="items" className="flex flex-col gap-6">
          {loading ? (
            <GridLoading cards={6} />
          ) : (
            <Tabs value={itemsSubTab} onValueChange={(value) => setItemsSubTab(value as ItemsSubTab)} className="gap-6">
              <TabsList>
                <TabsTrigger value="market">Marché</TabsTrigger>
                <TabsTrigger value="history">Historique ventes</TabsTrigger>
                <TabsTrigger value="stats">Tendances 30j</TabsTrigger>
              </TabsList>

              <TabsContent value="market" className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={typeFilter}
                    onValueChange={(value) => value && setTypeFilter(value as ItemTypeFilter)}
                    className="flex-wrap"
                  >
                    {(Object.keys(TYPE_LABELS) as ItemTypeFilter[]).map((value) => (
                      <ToggleGroupItem key={value} value={value}>
                        {TYPE_LABELS[value]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <InputGroup className="sm:w-64">
                      <InputGroupAddon>
                        <Search />
                      </InputGroupAddon>
                      <InputGroupInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher objet ou vendeur…" />
                    </InputGroup>
                    <Select value={sortMode} onValueChange={(value) => setSortMode(value as MarketplaceSortMode)}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Trier" />
                      </SelectTrigger>
                      <SelectContent>
                        {SORT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {filteredMarketListings.length === 0 ? (
                  <EmptyBlock icon={<BellRing />} title="Aucune annonce" description="Aucune annonce ne correspond à ces filtres." />
                ) : (
                  <Card className="py-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Objet</TableHead>
                          <TableHead className="text-right">Prix</TableHead>
                          <TableHead className="hidden md:table-cell">Vendeur</TableHead>
                          <TableHead className="hidden text-right lg:table-cell">Qté</TableHead>
                          <TableHead className="hidden text-right xl:table-cell">Publié</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMarketListings.map((listing) => (
                          <TableRow key={listing.id} className="cursor-pointer" onClick={() => setSelectedListingId(listing.id)}>
                            <TableCell>
                              <Item size="sm" className="p-0">
                                <ItemThumb item={listing.item} />
                                <ItemContent>
                                  <ItemTitle>{listing.item.name}</ItemTitle>
                                  <ItemDescription>{getTypeLabel(listing.item.type)}</ItemDescription>
                                </ItemContent>
                              </Item>
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{formatMoney(listing.unitPrice)}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="flex items-center gap-2">
                                <SellerAvatar seller={listing.seller} />
                                <span style={listing.seller.usernameColor ? { color: listing.seller.usernameColor } : undefined}>
                                  {listing.seller.username}
                                </span>
                              </span>
                            </TableCell>
                            <TableCell className="hidden text-right tabular-nums lg:table-cell">x{listing.quantity}</TableCell>
                            <TableCell className="hidden text-right text-muted-foreground xl:table-cell">
                              {formatRelativeDate(listing.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
                {filteredMarketListings.length > 0 ? (
                  <p className="text-right text-xs text-muted-foreground">
                    {filteredMarketListings.length} annonce{filteredMarketListings.length > 1 ? 's' : ''}
                  </p>
                ) : null}
              </TabsContent>

              <TabsContent value="history">
                {sortedSalesHistoryListings.length === 0 ? (
                  <EmptyBlock title="Aucune vente" description="Aucune vente enregistrée pour le moment." />
                ) : (
                  <Card className="py-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Objet</TableHead>
                          <TableHead className="hidden md:table-cell">Vendeur</TableHead>
                          <TableHead className="hidden lg:table-cell">Date</TableHead>
                          <TableHead className="text-right">Qté</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedSalesHistoryListings.map((listing) => (
                          <TableRow key={listing.id}>
                            <TableCell>
                              <Item size="sm" className="p-0">
                                <ItemThumb item={listing.item} />
                                <ItemContent>
                                  <ItemTitle>{listing.item.name}</ItemTitle>
                                  <ItemDescription>Achat vendeur : {formatMoney(listing.item.price)}</ItemDescription>
                                </ItemContent>
                              </Item>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{listing.seller.username}</TableCell>
                            <TableCell className="hidden text-muted-foreground lg:table-cell">
                              {new Date(listing.soldAt ?? listing.createdAt).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{listing.quantity.toLocaleString('fr-FR')}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{formatMoney(listing.totalPrice)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="stats">
                {marketStats.length === 0 ? (
                  <EmptyBlock title="Aucune donnée" description="Aucune donnée marché disponible pour les 30 derniers jours." />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {marketStats.map((stat) => {
                      const evolution = stat.priceEvolutionPct30d;
                      return (
                        <Card key={stat.itemId}>
                          <CardHeader>
                            <Item size="sm" className="p-0">
                              <ItemMedia variant={stat.imageUrl ? 'image' : 'icon'}>
                                {stat.imageUrl ? <img src={resolveImageUrl(stat.imageUrl)} alt={stat.itemName} /> : <Package />}
                              </ItemMedia>
                              <ItemContent>
                                <ItemTitle>{stat.itemName}</ItemTitle>
                                <ItemDescription>
                                  {getTypeLabel(stat.itemType)} · {stat.soldUnits30d.toLocaleString('fr-FR')} unités vendues
                                </ItemDescription>
                              </ItemContent>
                            </Item>
                          </CardHeader>
                          <CardContent className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-2">
                              <StatTile label="Prix moyen 30j" value={stat.averageUnitPrice30d === null ? 'N/A' : formatMoney(stat.averageUnitPrice30d)} />
                              <StatTile
                                label="Évolution 30j"
                                value={formatEvolution(evolution)}
                                tone={evolutionTone(evolution)}
                                icon={(evolution ?? 0) > 0 ? <ArrowUpRight className="size-3.5" /> : (evolution ?? 0) < 0 ? <ArrowDownRight className="size-3.5" /> : null}
                              />
                              <StatTile label="Offre la plus basse" value={stat.lowestOffer === null ? 'Aucune' : formatMoney(stat.lowestOffer)} />
                              <StatTile label="Offre la plus haute" value={stat.highestOffer === null ? 'Aucune' : formatMoney(stat.highestOffer)} />
                            </div>
                            <MarketplaceTrendSparkline timeline={stat.timeline} />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        {/* ── SELL TAB ──────────────────────────────── */}
        <TabsContent value="sell">
          {loading ? (
            <GridLoading cards={6} />
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>Votre inventaire</CardTitle>
                  <CardDescription>Sélectionnez l&apos;objet à vendre.</CardDescription>
                  <Badge variant="secondary" className="w-fit">
                    {inventory.length} objet{inventory.length > 1 ? 's' : ''}
                  </Badge>
                </CardHeader>
                <CardContent>
                  {inventory.length === 0 ? (
                    <EmptyBlock title="Inventaire vide" description="Aucun objet vendable dans votre inventaire." />
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {inventory.map((item) => (
                        <InventoryListingCard
                          key={item.id}
                          item={item}
                          selected={selectedInventoryId === item.id}
                          onSelect={(next) => setSelectedInventoryId(next.id)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:sticky lg:top-20">
                <CardHeader>
                  <CardTitle>Créer une annonce</CardTitle>
                  <CardDescription>L&apos;objet est retiré de l&apos;inventaire tant que l&apos;annonce reste active.</CardDescription>
                </CardHeader>
                {selectedInventoryItem ? (
                  <>
                    <CardContent className="flex flex-col gap-4">
                      <Item variant="outline" size="sm">
                        <ItemThumb item={selectedInventoryItem.item} />
                        <ItemContent>
                          <ItemTitle>
                            {selectedInventoryItem.item.name}
                            <Badge variant="secondary">{getTypeLabel(selectedInventoryItem.item.type)}</Badge>
                          </ItemTitle>
                          <ItemDescription>{selectedInventoryItem.item.description}</ItemDescription>
                          <span className="text-xs text-muted-foreground">Prix de base : {formatMoney(selectedInventoryItem.item.price)}</span>
                        </ItemContent>
                      </Item>
                      <FieldGroup className="sm:grid sm:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor="sell-quantity">Quantité</FieldLabel>
                          <Input
                            id="sell-quantity"
                            type="number"
                            min="1"
                            max={selectedMaxQuantity}
                            value={sellQuantity}
                            onChange={(event) => setSellQuantity(event.target.value)}
                          />
                          <FieldDescription>Maximum disponible : {selectedMaxQuantity}</FieldDescription>
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="sell-price">Prix unitaire</FieldLabel>
                          <Input id="sell-price" type="number" min="1" value={sellPrice} onChange={(event) => setSellPrice(event.target.value)} />
                          <FieldDescription>
                            Montant reçu : {formatMoney(Number.parseInt(sellPrice || '0', 10) * Number.parseInt(sellQuantity || '1', 10))}
                          </FieldDescription>
                        </Field>
                      </FieldGroup>
                      <p className="text-sm text-muted-foreground">
                        {selectedInventoryItem.quantity > 1
                          ? 'Vous pouvez vendre une partie de votre pile ou la totalité.'
                          : "Cet objet sera retiré de votre inventaire dès la mise en vente."}
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full" onClick={handleCreateListing} disabled={submittingListing}>
                        {submittingListing ? <Spinner /> : <CheckCircle2 />}
                        Mettre en vente
                      </Button>
                    </CardFooter>
                  </>
                ) : (
                  <CardContent>
                    <EmptyBlock title="Aucun objet sélectionné" description="Sélectionnez un objet dans votre inventaire pour préparer une annonce." />
                  </CardContent>
                )}
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── MINE TAB ──────────────────────────────── */}
        <TabsContent value="mine">
          {loading ? (
            <GridLoading cards={4} />
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Annonces actives</CardTitle>
                  <CardDescription>Annulez ou gardez vos objets en vente.</CardDescription>
                  <Badge variant="secondary" className="w-fit">
                    {myActiveListings.length}
                  </Badge>
                </CardHeader>
                <CardContent>
                  {myActiveListings.length === 0 ? (
                    <EmptyBlock title="Aucune annonce" description="Aucune annonce active pour le moment." />
                  ) : (
                    <ItemGroup>
                      {myActiveListings.map((listing, index) => (
                        <div key={listing.id}>
                          {index > 0 ? <ItemSeparator /> : null}
                          <Item size="sm">
                            <ItemThumb item={listing.item} />
                            <ItemContent>
                              <ItemTitle>{listing.item.name}</ItemTitle>
                              <ItemDescription>
                                x{listing.quantity} · {formatMoney(listing.unitPrice)} / u.
                              </ItemDescription>
                            </ItemContent>
                            <ItemActions>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                aria-label="Annuler l'annonce"
                                onClick={() => handleCancelListing(listing)}
                                disabled={cancellingListingId === listing.id}
                              >
                                {cancellingListingId === listing.id ? <Spinner /> : <X />}
                              </Button>
                            </ItemActions>
                          </Item>
                        </div>
                      ))}
                    </ItemGroup>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Historique</CardTitle>
                  <CardDescription>Retrouvez les annonces déjà traitées.</CardDescription>
                  <Badge variant="secondary" className="w-fit">
                    {myHistoryListings.length}
                  </Badge>
                </CardHeader>
                <CardContent>
                  {myHistoryListings.length === 0 ? (
                    <EmptyBlock title="Aucun historique" description="Vos annonces soldées ou annulées apparaîtront ici." />
                  ) : (
                    <ItemGroup>
                      {myHistoryListings.map((listing, index) => (
                        <div key={listing.id}>
                          {index > 0 ? <ItemSeparator /> : null}
                          <Item size="sm">
                            <ItemContent>
                              <ItemTitle>{listing.item.name}</ItemTitle>
                              <ItemDescription>
                                {listing.quantity} x {formatMoney(listing.unitPrice)}
                              </ItemDescription>
                            </ItemContent>
                            <ItemActions>
                              <Badge variant={statusVariant(listing.status)}>{getStatusLabel(listing.status)}</Badge>
                            </ItemActions>
                          </Item>
                        </div>
                      ))}
                    </ItemGroup>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedListing ? (
        <ItemDetailModal
          listing={selectedListing}
          otherListings={otherListings}
          stat={selectedStat}
          currentUserId={user?.id}
          buyingListingId={buyingListingId}
          onBuy={handleBuyListing}
          onClose={() => setSelectedListingId(null)}
        />
      ) : null}
    </PageShell>
  );
}

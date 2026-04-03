import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeDollarSign, BellRing, CheckCircle2, Loader2, Package, Search, Store, Tag, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi, type MarketplaceListing, type MarketplaceListingItem } from '../services/api';
import { PageShell, PageHeader } from '@/components/layout/page-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, humanizeUiLabel } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { toast } from '@/hooks/use-toast';

interface InventoryItem {
  id: string;
  quantity: number;
  acquiredAt: string;
  item: MarketplaceListingItem;
}

type MarketplaceTab = 'market' | 'sell' | 'mine';
type MarketplaceSortMode = 'newest' | 'price-asc' | 'price-desc' | 'quantity-desc';
type ItemTypeFilter = 'ALL' | 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';

const TYPE_LABELS: Record<ItemTypeFilter, string> = {
  ALL: 'Tous',
  CONSUMABLE: 'Objets',
  COSMETIC: 'Cosmétiques',
  UPGRADE: 'Améliorations',
};

const SORT_OPTIONS: Array<{ value: MarketplaceSortMode; label: string }> = [
  { value: 'newest', label: 'Plus récents' },
  { value: 'price-asc', label: 'Prix croissant' },
  { value: 'price-desc', label: 'Prix décroissant' },
  { value: 'quantity-desc', label: 'Quantité décroissante' },
];

function formatMoney(amount: number) {
  return `$${amount.toLocaleString('fr-FR')}`;
}

function parseEffectLabel(effect?: string | null) {
  if (!effect) return null;
  try {
    const parsed = JSON.parse(effect) as { type?: string; bonusAura?: number; bonusMoney?: number; skinImageUrl?: string };
    if (typeof parsed.bonusAura === 'number') return `+${parsed.bonusAura} aura`;
    if (typeof parsed.bonusMoney === 'number') return `+${parsed.bonusMoney} money`;
    if (parsed.type) return humanizeUiLabel(parsed.type);
  } catch {
    return null;
  }
  return null;
}

function getTypeLabel(type: string) {
  return TYPE_LABELS[type as ItemTypeFilter] ?? humanizeUiLabel(type);
}

function getStatusLabel(status: MarketplaceListing['status']) {
  switch (status) {
    case 'ACTIVE':
      return 'En vente';
    case 'SOLD':
      return 'Vendue';
    case 'CANCELLED':
      return 'Annulée';
    default:
      return humanizeUiLabel(status);
  }
}

function statusTone(status: MarketplaceListing['status']) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
    case 'SOLD':
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20';
    case 'CANCELLED':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function MarketplaceListingCard({
  listing,
  currentUserId,
  busy,
  onBuy,
  onCancel,
  showSeller = true,
}: {
  listing: MarketplaceListing;
  currentUserId?: string;
  busy?: boolean;
  onBuy: (listing: MarketplaceListing) => void;
  onCancel: (listing: MarketplaceListing) => void;
  showSeller?: boolean;
}) {
  const isOwner = currentUserId === listing.sellerId;
  const isActive = listing.status === 'ACTIVE';
  const effectLabel = parseEffectLabel(listing.item.effect);
  const imageUrl = listing.item.imageUrl ? resolveImageUrl(listing.item.imageUrl) : null;

  return (
    <Card className="overflow-hidden border-border/60 bg-card/90 shadow-none backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-0">
        <div className="relative">
          <div className="aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-amber-50 via-background to-emerald-50 dark:from-amber-950/30 dark:via-card dark:to-emerald-950/20">
            {imageUrl ? (
              <img src={imageUrl} alt={listing.item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package className="h-12 w-12 text-muted-foreground/40" />
              </div>
            )}
          </div>
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <Badge className={cn('border px-2 py-1 text-[11px] font-medium', statusTone(listing.status))}>
              {getStatusLabel(listing.status)}
            </Badge>
            <Badge variant="secondary" className="border-border/60 bg-background/90 text-[11px] font-medium backdrop-blur-sm">
              {getTypeLabel(listing.item.type)}
            </Badge>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold tracking-tight">{listing.item.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{listing.item.description}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{formatMoney(listing.unitPrice)}</div>
                <div className="text-xs text-muted-foreground">par unité</div>
              </div>
            </div>
            {effectLabel ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Tag className="h-3.5 w-3.5" />
                {effectLabel}
              </div>
            ) : null}
          </div>

          {showSeller ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
              <Avatar className="h-8 w-8">
                {listing.seller.profilePicture ? (
                  <AvatarImage src={resolveImageUrl(listing.seller.profilePicture)} alt={listing.seller.username} />
                ) : null}
                <AvatarFallback className="bg-background text-xs font-medium text-foreground">
                  {listing.seller.username.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Vendeur</p>
                <p className="truncate text-sm font-medium" style={listing.seller.usernameColor ? { color: listing.seller.usernameColor } : undefined}>
                  {listing.seller.username}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Quantité</p>
                <p className="text-sm font-medium">x{listing.quantity}</p>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Valeur totale</span>
            <span className="font-medium text-foreground">{formatMoney(listing.totalPrice)}</span>
          </div>

          <div className="flex gap-2">
            {isActive ? (
              isOwner ? (
                <Button variant="outline" className="flex-1" onClick={() => onCancel(listing)} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Annuler'}
                </Button>
              ) : (
                <Button className="flex-1" onClick={() => onBuy(listing)} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Acheter'}
                </Button>
              )
            ) : (
              <Button variant="outline" className="flex-1" disabled>
                {getStatusLabel(listing.status)}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InventoryListingCard({
  item,
  selected,
  onSelect,
}: {
  item: InventoryItem;
  selected: boolean;
  onSelect: (item: InventoryItem) => void;
}) {
  const imageUrl = item.item.imageUrl ? resolveImageUrl(item.item.imageUrl) : null;
  const effectLabel = parseEffectLabel(item.item.effect);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        'group w-full rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-border/90 hover:bg-muted/20',
        selected ? 'border-primary/50 bg-primary/5 shadow-sm' : 'border-border/60 bg-card',
      )}
    >
      <div className="flex gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
          {imageUrl ? (
            <img src={imageUrl} alt={item.item.name} className="h-full w-full object-cover" />
          ) : (
            <Package className="h-6 w-6 text-muted-foreground/50" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{item.item.name}</p>
              <p className="text-xs text-muted-foreground">{getTypeLabel(item.item.type)}</p>
            </div>
            <Badge variant="secondary" className="shrink-0 border-border/60 bg-background text-[11px]">
              x{item.quantity}
            </Badge>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{item.item.description}</p>
          {effectLabel ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Tag className="h-3.5 w-3.5" />
              {effectLabel}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default function Marketplace() {
  const { user, updateBalance } = useAuth();
  const [loading, setLoading] = useState(true);
  const [marketListings, setMarketListings] = useState<MarketplaceListing[]>([]);
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('market');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ItemTypeFilter>('ALL');
  const [sortMode, setSortMode] = useState<MarketplaceSortMode>('newest');
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [sellQuantity, setSellQuantity] = useState('1');
  const [sellPrice, setSellPrice] = useState('');
  const [submittingListing, setSubmittingListing] = useState(false);
  const [buyingListingId, setBuyingListingId] = useState<string | null>(null);
  const [cancellingListingId, setCancellingListingId] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [inventoryRes, marketRes, myListingsRes] = await Promise.all([
        marketplaceApi.getInventory(user.id),
        marketplaceApi.getListings({ status: 'ACTIVE' }),
        marketplaceApi.getListings({ sellerId: user.id, status: 'ALL' }),
      ]);

      setInventory((inventoryRes.data.items || []).filter((entry: InventoryItem) => entry.item.type !== 'GIFT'));
      setMarketListings(marketRes.data.listings || []);
      setMyListings(myListingsRes.data.listings || []);
    } catch (error) {
      console.error('Failed to load marketplace data:', error);
      toast.error('Impossible de charger le marché.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const selectedInventoryItem = useMemo(
    () => inventory.find((item) => item.id === selectedInventoryId) ?? null,
    [inventory, selectedInventoryId],
  );

  useEffect(() => {
    if (!selectedInventoryItem) {
      setSellQuantity('1');
      setSellPrice('');
      return;
    }

    setSellQuantity('1');
    setSellPrice(String(selectedInventoryItem.item.price));
  }, [selectedInventoryItem]);

  const activeListings = useMemo(() => marketListings.filter((listing) => listing.status === 'ACTIVE'), [marketListings]);
  const myActiveListings = useMemo(() => myListings.filter((listing) => listing.status === 'ACTIVE'), [myListings]);
  const myHistoryListings = useMemo(() => myListings.filter((listing) => listing.status !== 'ACTIVE'), [myListings]);

  const filteredMarketListings = useMemo(() => {
    const term = search.trim().toLowerCase();

    return activeListings
      .filter((listing) => typeFilter === 'ALL' || listing.item.type === typeFilter)
      .filter((listing) => {
        if (!term) return true;
        return [listing.item.name, listing.item.description, listing.seller.username].join(' ').toLowerCase().includes(term);
      })
      .sort((a, b) => {
        switch (sortMode) {
          case 'price-asc':
            return a.unitPrice - b.unitPrice;
          case 'price-desc':
            return b.unitPrice - a.unitPrice;
          case 'quantity-desc':
            return b.quantity - a.quantity;
          case 'newest':
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
  }, [activeListings, search, sortMode, typeFilter]);

  const stats = useMemo(() => {
    const listedValue = activeListings.reduce((total, listing) => total + listing.totalPrice, 0);
    const inventoryValue = inventory.reduce((total, entry) => total + entry.item.price * entry.quantity, 0);

    return [
      { label: 'Annonces actives', value: String(activeListings.length), icon: Store },
      { label: 'Objets en stock', value: String(inventory.length), icon: Package },
      { label: 'Valeur visible', value: formatMoney(listedValue + inventoryValue), icon: Wallet },
    ];
  }, [activeListings, inventory]);

  const handleCreateListing = async () => {
    if (!user || !selectedInventoryItem || submittingListing) {
      return;
    }

    const quantity = Number.parseInt(sellQuantity, 10);
    const unitPrice = Number.parseInt(sellPrice, 10);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > selectedInventoryItem.quantity) {
      toast.error('Quantité invalide.');
      return;
    }

    if (!Number.isInteger(unitPrice) || unitPrice < 1) {
      toast.error('Prix invalide.');
      return;
    }

    try {
      setSubmittingListing(true);
      await marketplaceApi.createListing({
        userItemId: selectedInventoryItem.id,
        quantity,
        unitPrice,
      });
      toast.success('Annonce créée', {
        description: `${selectedInventoryItem.item.name} est maintenant en vente.`,
      });
      await loadData();
      setActiveTab('market');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Impossible de créer l’annonce.');
    } finally {
      setSubmittingListing(false);
    }
  };

  const handleBuyListing = async (listing: MarketplaceListing) => {
    if (!user || buyingListingId) {
      return;
    }

    try {
      setBuyingListingId(listing.id);
      const response = await marketplaceApi.buyListing(listing.id);
      updateBalance(response.data.newBalance.aura, response.data.newBalance.money);
      toast.success('Achat confirmé', {
        description: `${listing.item.name} a été ajouté à ton inventaire.`,
      });
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Impossible d’acheter cette annonce.');
    } finally {
      setBuyingListingId(null);
    }
  };

  const handleCancelListing = async (listing: MarketplaceListing) => {
    if (!user || cancellingListingId) {
      return;
    }

    try {
      setCancellingListingId(listing.id);
      await marketplaceApi.cancelListing(listing.id);
      toast.success('Annonce annulée', {
        description: `${listing.item.name} est retourné dans ton inventaire.`,
      });
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Impossible d’annuler cette annonce.');
    } finally {
      setCancellingListingId(null);
    }
  };

  const selectedMaxQuantity = selectedInventoryItem?.quantity ?? 0;

  return (
    <PageShell>
      <div className="space-y-6">
        <Card className="overflow-hidden border-border/60 bg-[linear-gradient(135deg,rgba(249,115,22,0.14),rgba(16,185,129,0.10),rgba(245,158,11,0.16))] shadow-none">
          <CardContent className="relative p-6 md:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.15),transparent_35%)]" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)] lg:items-end">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                  <BadgeDollarSign className="h-3.5 w-3.5 text-amber-600" />
                  Marché communautaire
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Vends tes objets à d’autres joueurs</h1>
                  <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                    Mets en vente les objets de ton inventaire, fixe ton prix et récupère du money dès qu’un autre joueur achète ton annonce.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to="/inventory">
                      Ouvrir l’inventaire
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/market">
                      Boutique officielle
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="rounded-2xl border border-border/60 bg-background/75 p-4 backdrop-blur-sm">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40 text-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-xl font-semibold tracking-tight">{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <PageHeader
          title="Marché"
          description="Choisis un objet à vendre, explore les annonces en cours et gère tes propres listings dans le même espace."
        />

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MarketplaceTab)} className="space-y-6">
          <TabsList className="h-auto flex-wrap border-border/60 bg-muted/20">
            <TabsTrigger value="market" className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
              Marché
            </TabsTrigger>
            <TabsTrigger value="sell" className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
              Vendre
            </TabsTrigger>
            <TabsTrigger value="mine" className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
              Mes annonces
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-border/60 bg-card/70">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <TabsContent value="market" className="space-y-6">
                <Card className="border-border/60 bg-card/80 shadow-none">
                  <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full lg:max-w-md">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Rechercher un objet ou un vendeur..."
                        className="pl-9"
                      />
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as ItemTypeFilter)}>
                        <SelectTrigger className="w-full sm:w-44">
                          <SelectValue placeholder="Catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={sortMode} onValueChange={(value) => setSortMode(value as MarketplaceSortMode)}>
                        <SelectTrigger className="w-full sm:w-44">
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
                  </CardContent>
                </Card>

                {filteredMarketListings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-10 text-center">
                    <BellRing className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground">Aucune annonce ne correspond à ces filtres.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredMarketListings.map((listing) => (
                      <MarketplaceListingCard
                        key={listing.id}
                        listing={listing}
                        currentUserId={user?.id}
                        busy={buyingListingId === listing.id || cancellingListingId === listing.id}
                        onBuy={handleBuyListing}
                        onCancel={handleCancelListing}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sell" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <Card className="border-border/60 bg-card/80 shadow-none">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h2 className="text-lg font-semibold tracking-tight">Ton inventaire</h2>
                          <p className="text-sm text-muted-foreground">Sélectionne l’objet à vendre.</p>
                        </div>
                        <Badge variant="secondary" className="border-border/60 bg-background">
                          {inventory.length} objet{inventory.length > 1 ? 's' : ''}
                        </Badge>
                      </div>

                      {inventory.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                          Aucun objet vendable dans ton inventaire.
                        </div>
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

                  <Card className="border-border/60 bg-card/90 shadow-none lg:sticky lg:top-6">
                    <CardContent className="space-y-5 p-4">
                      <div className="space-y-1">
                        <h2 className="text-lg font-semibold tracking-tight">Créer une annonce</h2>
                        <p className="text-sm text-muted-foreground">
                          Ton objet sera retiré de l’inventaire tant que l’annonce reste active.
                        </p>
                      </div>

                      {selectedInventoryItem ? (
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-background">
                                {selectedInventoryItem.item.imageUrl ? (
                                  <img
                                    src={resolveImageUrl(selectedInventoryItem.item.imageUrl)}
                                    alt={selectedInventoryItem.item.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Package className="h-6 w-6 text-muted-foreground/60" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="truncate text-base font-semibold">{selectedInventoryItem.item.name}</h3>
                                  <Badge variant="secondary" className="border-border/60 bg-background text-[11px]">
                                    {getTypeLabel(selectedInventoryItem.item.type)}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{selectedInventoryItem.item.description}</p>
                                <p className="text-xs text-muted-foreground">Prix de base: {formatMoney(selectedInventoryItem.item.price)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Quantité</label>
                              <Input
                                type="number"
                                min="1"
                                max={selectedMaxQuantity}
                                value={sellQuantity}
                                onChange={(event) => setSellQuantity(event.target.value)}
                              />
                              <p className="text-xs text-muted-foreground">Maximum disponible: {selectedMaxQuantity}</p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Prix unitaire</label>
                              <Input
                                type="number"
                                min="1"
                                value={sellPrice}
                                onChange={(event) => setSellPrice(event.target.value)}
                              />
                              <p className="text-xs text-muted-foreground">Montant reçu: {selectedInventoryItem ? formatMoney(Number.parseInt(sellPrice || '0', 10) * Number.parseInt(sellQuantity || '1', 10)) : '$0'}</p>
                            </div>
                          </div>

                          <div className="rounded-xl border border-border/60 bg-background p-4 text-sm text-muted-foreground">
                            {selectedInventoryItem.quantity > 1
                              ? 'Tu peux vendre une partie de ta pile ou la totalité.'
                              : 'Cet objet sera retiré de ton inventaire dès la mise en vente.'}
                          </div>

                          <Button className="w-full" onClick={handleCreateListing} disabled={submittingListing}>
                            {submittingListing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Mettre en vente
                          </Button>
                        </div>
                      ) : (
                        <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                          Sélectionne un objet dans ton inventaire pour préparer une annonce.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="mine" className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-2">
                  <Card className="border-border/60 bg-card/80 shadow-none">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h2 className="text-lg font-semibold tracking-tight">Annonces actives</h2>
                          <p className="text-sm text-muted-foreground">Annule ou garde tes objets en vente.</p>
                        </div>
                        <Badge variant="secondary" className="border-border/60 bg-background">
                          {myActiveListings.length}
                        </Badge>
                      </div>

                      {myActiveListings.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                          Aucune annonce active pour le moment.
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {myActiveListings.map((listing) => (
                            <MarketplaceListingCard
                              key={listing.id}
                              listing={listing}
                              currentUserId={user?.id}
                              busy={cancellingListingId === listing.id}
                              onBuy={handleBuyListing}
                              onCancel={handleCancelListing}
                              showSeller={false}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/60 bg-card/80 shadow-none">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h2 className="text-lg font-semibold tracking-tight">Historique</h2>
                          <p className="text-sm text-muted-foreground">Retrouve les annonces déjà traitées.</p>
                        </div>
                        <Badge variant="secondary" className="border-border/60 bg-background">
                          {myHistoryListings.length}
                        </Badge>
                      </div>

                      {myHistoryListings.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                          Tes annonces soldées ou annulées apparaîtront ici.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {myHistoryListings.map((listing) => (
                            <div key={listing.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background p-4">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{listing.item.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {listing.quantity} x {formatMoney(listing.unitPrice)}
                                </p>
                              </div>
                              <Badge className={cn('border px-2 py-1 text-[11px] font-medium', statusTone(listing.status))}>
                                {getStatusLabel(listing.status)}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </PageShell>
  );
}

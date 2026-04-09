import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BellRing, CheckCircle2, Loader2, Package, Search, Tag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi, type MarketplaceListing, type MarketplaceListingItem, type MarketplaceProductStats } from '../services/api';
import { PageShell } from '@/components/layout/page-shell';
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
import { GridSkeleton } from '@/components/ui/loading-skeletons';

const DJ_COLORS = {
  background: '#0a0a0a',
  platformNormal: '#e5e7eb',
  platformBounce: '#7c3aed',
  platformMoving: '#9ca3af',
};
const PW = 80;
const PH = 15;

interface InventoryItem {
  id: string;
  quantity: number;
  acquiredAt: string;
  item: MarketplaceListingItem;
}

type MarketplaceTab = 'market' | 'history' | 'stats' | 'sell' | 'mine';
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

function getSkinImageUrl(effect?: string | null): string | null {
  if (!effect) return null;
  try {
    const parsed = JSON.parse(effect) as { type?: string; skinImageUrl?: string };
    if (parsed.type === 'DOODLE_JUMP_SKIN' && parsed.skinImageUrl) return parsed.skinImageUrl;
  } catch {
    return null;
  }
  return null;
}

function drawPlatform(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  const r = 5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + PW - r, y);
  ctx.arcTo(x + PW, y, x + PW, y + PH, r);
  ctx.lineTo(x + PW, y + PH);
  ctx.arcTo(x + PW, y + PH, x, y + PH, r);
  ctx.lineTo(x + r, y + PH);
  ctx.arcTo(x, y + PH, x, y, r);
  ctx.arcTo(x, y, x + PW, y, r);
  ctx.closePath();
  ctx.fill();
}

function DoodleJumpSkinPreview({ skinImageUrl, className, height }: { skinImageUrl: string; className?: string; height?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const CW = 400;
  const CH = 220;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const draw = (skinImg: HTMLImageElement | null) => {
      ctx.fillStyle = DJ_COLORS.background;
      ctx.fillRect(0, 0, CW, CH);

      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x < CW; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CH);
        ctx.stroke();
      }

      const platY1 = CH - 28;
      const platY2 = CH - 90;
      const platY3 = CH - 152;
      const p1x = 40;
      const p2x = CW / 2 - PW / 2;
      const p3x = CW - 40 - PW;

      drawPlatform(ctx, p1x, platY1, DJ_COLORS.platformNormal);
      drawPlatform(ctx, p2x, platY2, DJ_COLORS.platformBounce);
      drawPlatform(ctx, p3x, platY3, DJ_COLORS.platformMoving);

      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const arcStartX = p2x + PW / 2;
      const arcEndX = p3x + PW / 2;
      ctx.moveTo(arcStartX, platY2);
      ctx.quadraticCurveTo((arcStartX + arcEndX) / 2, Math.min(platY2, platY3) - 50, arcEndX, platY3);
      ctx.stroke();
      ctx.setLineDash([]);

      const charSize = 70;
      const charX = p2x + PW / 2 - charSize / 2;
      const charY = platY2 - charSize;
      if (skinImg && skinImg.complete && skinImg.naturalWidth > 0) {
        ctx.drawImage(skinImg, charX, charY, charSize, charSize);
      } else {
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.arc(p2x + PW / 2, platY2 - charSize / 2, charSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.textAlign = 'right';
      ctx.fillText('Doodle Jump', CW - 12, 18);
      ctx.textAlign = 'left';
    };

    draw(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => draw(img);
    img.src = resolveImageUrl(skinImageUrl);
  }, [skinImageUrl]);

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      className={cn('w-full', className)}
      style={{ display: 'block', height: height ?? '180px' }}
    />
  );
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

function formatEvolution(value: number | null) {
  if (value === null) {
    return 'N/A';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function evolutionTone(value: number | null) {
  if (value === null) {
    return 'text-muted-foreground';
  }
  if (value > 0) {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  if (value < 0) {
    return 'text-rose-600 dark:text-rose-400';
  }
  return 'text-muted-foreground';
}

function MarketplaceTrendSparkline({ timeline }: { timeline: MarketplaceProductStats['timeline'] }) {
  const values = timeline.map((point) => point.averageUnitPrice).filter((value): value is number => value !== null);

  if (values.length === 0) {
    return (
      <div className="flex h-14 items-center justify-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground">
        Pas de ventes sur 30 jours
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = timeline
    .map((point, index) => {
      const x = (index / Math.max(timeline.length - 1, 1)) * 100;
      const fallback = values[values.length - 1] ?? 0;
      const sourceValue = point.averageUnitPrice ?? fallback;
      const normalized = max === min ? 0.5 : (sourceValue - min) / (max - min);
      const y = 100 - normalized * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="h-14 w-full rounded-md border border-border/60 bg-muted/20 px-2 py-1">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-amber-600 dark:text-amber-400"
          points={points}
        />
      </svg>
    </div>
  );
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
  const skinImageUrl = getSkinImageUrl(listing.item.effect);
  const imageUrl = listing.item.imageUrl ? resolveImageUrl(listing.item.imageUrl) : null;

  return (
    <Card className="overflow-hidden border-border/60 bg-card/90 shadow-none backdrop-blur-sm">
      <CardContent className="p-0">
        <div className="relative">
          <div className="aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-amber-50 via-background to-emerald-50 dark:from-amber-950/30 dark:via-card dark:to-emerald-950/20">
            {skinImageUrl ? (
              <DoodleJumpSkinPreview skinImageUrl={skinImageUrl} className="h-full" height="100%" />
            ) : imageUrl ? (
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

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Prix d'achat vendeur</span>
            <span className="font-medium text-foreground">{formatMoney(listing.item.price)}</span>
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
  const skinImageUrl = getSkinImageUrl(item.item.effect);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        'group w-full rounded-xl border p-3 text-left',
        selected ? 'border-primary/50 bg-primary/5 shadow-sm' : 'border-border/60 bg-card',
      )}
    >
      <div className="flex gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
          {skinImageUrl ? (
            <DoodleJumpSkinPreview skinImageUrl={skinImageUrl} className="h-full" height="100%" />
          ) : imageUrl ? (
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
  const [salesHistoryListings, setSalesHistoryListings] = useState<MarketplaceListing[]>([]);
  const [marketStats, setMarketStats] = useState<MarketplaceProductStats[]>([]);
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
  const selectedInventorySkinImageUrl = getSkinImageUrl(selectedInventoryItem?.item.effect);

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
  const sortedSalesHistoryListings = useMemo(
    () => [...salesHistoryListings].sort((a, b) => {
      const aTime = a.soldAt ? new Date(a.soldAt).getTime() : new Date(a.createdAt).getTime();
      const bTime = b.soldAt ? new Date(b.soldAt).getTime() : new Date(b.createdAt).getTime();
      return bTime - aTime;
    }),
    [salesHistoryListings],
  );
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
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MarketplaceTab)} className="space-y-6">
          <TabsList className="h-auto flex-wrap border-border/60 bg-muted/20">
            <TabsTrigger value="market" className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
              Marché
            </TabsTrigger>
            <TabsTrigger value="history" className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
              Historique ventes
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
              Tendances 30j
            </TabsTrigger>
            <TabsTrigger value="sell" className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
              Vendre
            </TabsTrigger>
            <TabsTrigger value="mine" className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
              Mes annonces
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
              <GridSkeleton cards={6} />
            </div>
          ) : (
            <>
              <TabsContent value="market" className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                </div>

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

              <TabsContent value="history" className="space-y-6">
                {sortedSalesHistoryListings.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Aucune vente enregistrée pour le moment.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {sortedSalesHistoryListings.map((listing) => {
                      const skinImageUrl = getSkinImageUrl(listing.item.effect);
                      const imageUrl = listing.item.imageUrl ? resolveImageUrl(listing.item.imageUrl) : null;
                      return (
                        <Card key={listing.id} className="border-border/60 bg-card/80 shadow-none">
                          <CardContent className="flex items-center gap-3 py-3">
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                              {skinImageUrl ? (
                                <DoodleJumpSkinPreview skinImageUrl={skinImageUrl} className="h-full" height="100%" />
                              ) : imageUrl ? (
                                <img src={imageUrl} alt={listing.item.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full bg-muted" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold leading-snug">{listing.item.name}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">Vendue</Badge>
                                <span className="text-xs text-muted-foreground">
                                  Vendeur: {listing.seller.username}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Achat vendeur: {formatMoney(listing.item.price)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {listing.soldAt
                                    ? `Vendue le ${new Date(listing.soldAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                    : `Publiée le ${new Date(listing.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <div className="text-xs text-muted-foreground">Quantité</div>
                              <div className="text-lg font-bold tabular-nums">{listing.quantity.toLocaleString('fr-FR')}</div>
                              <div className="mt-1 text-xs text-muted-foreground">Montant total</div>
                              <div className="text-sm font-semibold tabular-nums">{formatMoney(listing.totalPrice)}</div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="stats" className="space-y-6">
                {marketStats.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Aucune donnée marché disponible pour les 30 derniers jours.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {marketStats.map((stat) => {
                      const imageUrl = stat.imageUrl ? resolveImageUrl(stat.imageUrl) : null;
                      const isPositive = (stat.priceEvolutionPct30d ?? 0) > 0;
                      const isNegative = (stat.priceEvolutionPct30d ?? 0) < 0;

                      return (
                        <Card key={stat.itemId} className="border-border/60 bg-card/85 shadow-none">
                          <CardContent className="space-y-4 p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
                                {imageUrl ? (
                                  <img src={imageUrl} alt={stat.itemName} className="h-full w-full object-cover" />
                                ) : (
                                  <Package className="h-6 w-6 text-muted-foreground/50" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{stat.itemName}</p>
                                <div className="mt-1 flex items-center gap-2">
                                  <Badge variant="secondary" className="border-border/60 bg-background text-[11px]">
                                    {getTypeLabel(stat.itemType)}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {stat.soldUnits30d.toLocaleString('fr-FR')} unités vendues
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="rounded-lg border border-border/60 bg-background p-2">
                                <p className="text-xs text-muted-foreground">Prix moyen 30j</p>
                                <p className="mt-1 font-semibold">
                                  {stat.averageUnitPrice30d === null ? 'N/A' : formatMoney(stat.averageUnitPrice30d)}
                                </p>
                              </div>
                              <div className="rounded-lg border border-border/60 bg-background p-2">
                                <p className="text-xs text-muted-foreground">Evolution 30j</p>
                                <p className={cn('mt-1 flex items-center gap-1 font-semibold', evolutionTone(stat.priceEvolutionPct30d))}>
                                  {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}
                                  {isNegative ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
                                  {formatEvolution(stat.priceEvolutionPct30d)}
                                </p>
                              </div>
                              <div className="rounded-lg border border-border/60 bg-background p-2">
                                <p className="text-xs text-muted-foreground">Offre la plus basse</p>
                                <p className="mt-1 font-semibold">
                                  {stat.lowestOffer === null ? 'Aucune' : formatMoney(stat.lowestOffer)}
                                </p>
                              </div>
                              <div className="rounded-lg border border-border/60 bg-background p-2">
                                <p className="text-xs text-muted-foreground">Offre la plus haute</p>
                                <p className="mt-1 font-semibold">
                                  {stat.highestOffer === null ? 'Aucune' : formatMoney(stat.highestOffer)}
                                </p>
                              </div>
                            </div>

                            <MarketplaceTrendSparkline timeline={stat.timeline} />
                          </CardContent>
                        </Card>
                      );
                    })}
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
                                {selectedInventorySkinImageUrl ? (
                                  <DoodleJumpSkinPreview skinImageUrl={selectedInventorySkinImageUrl} className="h-full" height="100%" />
                                ) : selectedInventoryItem.item.imageUrl ? (
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

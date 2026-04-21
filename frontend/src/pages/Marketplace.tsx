import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  Building2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Package,
  Search,
  SlidersHorizontal,
  Tag,
  TrendingUp,
  X,
} from 'lucide-react';
import { type ResourceType, type ResourceTier, RESOURCE_META, TIER_META } from '@/lib/resources';
import { useAuth } from '../contexts/AuthContext';
import {
  marketplaceApi,
  type MarketplaceListing,
  type MarketplaceListingItem,
  type MarketplaceProductStats,
  type MarketplaceProductStatsPoint,
} from '../services/api';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, humanizeUiLabel } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { toast } from '@/hooks/use-toast';
import { GridSkeleton } from '@/components/ui/loading-skeletons';

// ── Canvas constants ─────────────────────────────────────
const DJ_COLORS = {
  background: '#0a0a0a',
  platformNormal: '#e5e7eb',
  platformBounce: '#7c3aed',
  platformMoving: '#9ca3af',
};
const PW = 80;
const PH = 15;

// ── Types ────────────────────────────────────────────────
interface InventoryItem {
  id: string;
  quantity: number;
  acquiredAt: string;
  item: MarketplaceListingItem;
}

type TopTab = 'resources' | 'items' | 'sell' | 'mine';
type ItemsSubTab = 'market' | 'history' | 'stats';
type SellSubTab = 'items' | 'resources';
type MarketplaceSortMode = 'newest' | 'price-asc' | 'price-desc' | 'quantity-desc';
type ItemTypeFilter = 'ALL' | 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';

type ResourceSortMode = 'price-asc' | 'price-desc' | 'qty-desc' | 'newest';

interface ResourceListing {
  id: string;
  resourceType: ResourceType;
  unitPrice: number;
  quantity: number;
  sellerId: string;
  seller: { id: string; username: string; profilePicture?: string; usernameColor?: string };
  createdAt: string;
  priceChange24h: number | null;
}

const RESOURCE_SORT_OPTIONS: Array<{ value: ResourceSortMode; label: string }> = [
  { value: 'price-asc',  label: 'Prix croissant' },
  { value: 'price-desc', label: 'Prix décroissant' },
  { value: 'qty-desc',   label: 'Quantité décroissante' },
  { value: 'newest',     label: 'Plus récents' },
];

// ── Mock resource listings (replaced by API once backend exists) ──
const now = new Date();
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const mkSeller = (id: string, username: string, color?: string) => ({ id, username, usernameColor: color });

const MOCK_RESOURCE_LISTINGS: ResourceListing[] = [
  { id: 'r1',  resourceType: 'WOOD',         unitPrice: 45,   quantity: 200, sellerId: 'u2', seller: mkSeller('u2', 'ThomasR'),    createdAt: ago(2),  priceChange24h: 2.1 },
  { id: 'r2',  resourceType: 'WOOD',         unitPrice: 48,   quantity: 80,  sellerId: 'u3', seller: mkSeller('u3', 'Sophie_M'),   createdAt: ago(5),  priceChange24h: 2.1 },
  { id: 'r3',  resourceType: 'STONE',        unitPrice: 35,   quantity: 350, sellerId: 'u4', seller: mkSeller('u4', 'le_mineur'),  createdAt: ago(1),  priceChange24h: -0.5 },
  { id: 'r4',  resourceType: 'IRON',         unitPrice: 120,  quantity: 150, sellerId: 'u5', seller: mkSeller('u5', 'ClanAlpha', '#f59e0b'), createdAt: ago(3),  priceChange24h: 5.2 },
  { id: 'r5',  resourceType: 'FOOD',         unitPrice: 25,   quantity: 500, sellerId: 'u6', seller: mkSeller('u6', 'lemonade_pro'), createdAt: ago(4), priceChange24h: -1.3 },
  { id: 'r6',  resourceType: 'FOOD',         unitPrice: 28,   quantity: 200, sellerId: 'u1', seller: mkSeller('u1', 'Admin'),      createdAt: ago(10), priceChange24h: null },
  { id: 'r7',  resourceType: 'CLOTH',        unitPrice: 85,   quantity: 120, sellerId: 'u3', seller: mkSeller('u3', 'Sophie_M'),   createdAt: ago(6),  priceChange24h: 1.0 },
  { id: 'r8',  resourceType: 'CONCRETE',     unitPrice: 180,  quantity: 90,  sellerId: 'u4', seller: mkSeller('u4', 'le_mineur'),  createdAt: ago(8),  priceChange24h: 8.4 },
  { id: 'r9',  resourceType: 'STEEL',        unitPrice: 350,  quantity: 40,  sellerId: 'u5', seller: mkSeller('u5', 'ClanAlpha', '#f59e0b'), createdAt: ago(12), priceChange24h: 12.1 },
  { id: 'r10', resourceType: 'FUEL',         unitPrice: 95,   quantity: 60,  sellerId: 'u2', seller: mkSeller('u2', 'ThomasR'),    createdAt: ago(7),  priceChange24h: -3.2 },
  { id: 'r11', resourceType: 'PAPER',        unitPrice: 55,   quantity: 180, sellerId: 'u3', seller: mkSeller('u3', 'Sophie_M'),   createdAt: ago(9),  priceChange24h: 0.3 },
  { id: 'r12', resourceType: 'LUXURY_GOODS', unitPrice: 800,  quantity: 15,  sellerId: 'u1', seller: mkSeller('u1', 'Admin'),      createdAt: ago(14), priceChange24h: 4.1 },
  { id: 'r13', resourceType: 'MEDICINE',     unitPrice: 450,  quantity: 30,  sellerId: 'u1', seller: mkSeller('u1', 'Admin'),      createdAt: ago(20), priceChange24h: -1.8 },
  { id: 'r14', resourceType: 'DATA',         unitPrice: 200,  quantity: 75,  sellerId: 'u5', seller: mkSeller('u5', 'ClanAlpha', '#f59e0b'), createdAt: ago(3),  priceChange24h: 6.7 },
  { id: 'r15', resourceType: 'CONTRABAND',   unitPrice: 1200, quantity: 8,   sellerId: 'u2', seller: mkSeller('u2', 'ThomasR'),    createdAt: ago(16), priceChange24h: null },
];

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
  if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (value < 0) return 'text-rose-600 dark:text-rose-400';
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

function statusTone(status: MarketplaceListing['status']) {
  switch (status) {
    case 'ACTIVE': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
    case 'SOLD': return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20';
    case 'CANCELLED': return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
    default: return 'bg-muted text-muted-foreground';
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

// ── DoodleJump canvas preview ────────────────────────────
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
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke();
      }
      const platY1 = CH - 28, platY2 = CH - 90, platY3 = CH - 152;
      const p1x = 40, p2x = CW / 2 - PW / 2, p3x = CW - 40 - PW;
      drawPlatform(ctx, p1x, platY1, DJ_COLORS.platformNormal);
      drawPlatform(ctx, p2x, platY2, DJ_COLORS.platformBounce);
      drawPlatform(ctx, p3x, platY3, DJ_COLORS.platformMoving);
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p2x + PW / 2, platY2);
      ctx.quadraticCurveTo((p2x + PW / 2 + p3x + PW / 2) / 2, Math.min(platY2, platY3) - 50, p3x + PW / 2, platY3);
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

// ── Price history chart ───────────────────────────────────
function PriceHistoryChart({ timeline }: { timeline: MarketplaceProductStatsPoint[] }) {
  const values = timeline.map((p) => p.averageUnitPrice).filter((v): v is number => v !== null);

  if (values.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
        Pas de ventes enregistrées sur 30 jours
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 460, H = 120;
  const PAD = { top: 14, right: 12, bottom: 24, left: 52 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const pts = timeline.map((point, i) => {
    const x = PAD.left + (i / Math.max(timeline.length - 1, 1)) * plotW;
    const fallback = values[values.length - 1] ?? 0;
    const v = point.averageUnitPrice ?? fallback;
    const y = PAD.top + (1 - (v - min) / range) * plotH;
    return { x, y, hasData: point.averageUnitPrice !== null };
  });

  const linePoints = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPoints = `${pts[0].x},${H - PAD.bottom} ${linePoints} ${pts[pts.length - 1].x},${H - PAD.bottom}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '120px' }}>
      <defs>
        <linearGradient id="price-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => {
        const y = PAD.top + t * plotH;
        return (
          <g key={t}>
            <line x1={PAD.left} y1={y} x2={PAD.left + plotW} y2={y} stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" />
            <text x={PAD.left - 5} y={y + 4} textAnchor="end" fontSize="8" fill="currentColor" fillOpacity="0.4" fontFamily="monospace">
              {formatMoney(Math.round(max - t * range))}
            </text>
          </g>
        );
      })}
      <polygon points={areaPoints} fill="url(#price-grad)" />
      <polyline fill="none" stroke="#f59e0b" strokeWidth="1.75" strokeLinejoin="round" points={linePoints} />
      {pts.filter((p) => p.hasData).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#f59e0b" />
      ))}
      {timeline.length > 1 && (
        <>
          <text x={PAD.left} y={H - 6} fontSize="8" fill="currentColor" fillOpacity="0.4" fontFamily="monospace">
            {new Date(timeline[0].date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </text>
          <text x={PAD.left + plotW} y={H - 6} textAnchor="end" fontSize="8" fill="currentColor" fillOpacity="0.4" fontFamily="monospace">
            {new Date(timeline[timeline.length - 1].date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </text>
        </>
      )}
    </svg>
  );
}

// ── Sparkline (stats tab) ────────────────────────────────
function MarketplaceTrendSparkline({ timeline }: { timeline: MarketplaceProductStats['timeline'] }) {
  const values = timeline.map((p) => p.averageUnitPrice).filter((v): v is number => v !== null);
  if (values.length === 0) {
    return (
      <div className="flex h-14 items-center justify-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground">
        Pas de ventes sur 30 jours
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = timeline.map((point, index) => {
    const x = (index / Math.max(timeline.length - 1, 1)) * 100;
    const fallback = values[values.length - 1] ?? 0;
    const v = point.averageUnitPrice ?? fallback;
    const normalized = max === min ? 0.5 : (v - min) / (max - min);
    return `${x},${100 - normalized * 100}`;
  }).join(' ');

  return (
    <div className="h-14 w-full rounded-md border border-border/60 bg-muted/20 px-2 py-1">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <polyline fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-600 dark:text-amber-400" points={points} />
      </svg>
    </div>
  );
}

// ── Item thumbnail ────────────────────────────────────────
function ItemThumb({ item, size = 'md' }: { item: MarketplaceListingItem; size?: 'sm' | 'md' | 'lg' }) {
  const skinImageUrl = getSkinImageUrl(item.effect);
  const imageUrl = item.imageUrl ? resolveImageUrl(item.imageUrl) : null;
  const dim = size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-20 w-20' : 'h-12 w-12';

  return (
    <div className={cn(dim, 'shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/30')}>
      {skinImageUrl ? (
        <DoodleJumpSkinPreview skinImageUrl={skinImageUrl} className="h-full" height="100%" />
      ) : imageUrl ? (
        <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Package className="h-4 w-4 text-muted-foreground/40" />
        </div>
      )}
    </div>
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

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <div className="flex gap-4 p-5 pb-4">
          <ItemThumb item={listing.item} size="lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="border-border/60 bg-background text-[11px]">
                {getTypeLabel(listing.item.type)}
              </Badge>
              {effectLabel ? (
                <Badge variant="outline" className="gap-1 text-[11px]">
                  <Tag className="h-3 w-3" />
                  {effectLabel}
                </Badge>
              ) : null}
            </div>
            <h2 className="text-base font-bold leading-tight">{listing.item.name}</h2>
            <p className="line-clamp-2 text-xs text-muted-foreground">{listing.item.description}</p>
          </div>
        </div>

        <Tabs defaultValue="listing" className="border-t border-border/60">
          <TabsList className="grid h-10 w-full grid-cols-3 rounded-none border-b border-border/60 bg-muted/20 p-0">
            {(['listing', 'others', 'trend'] as const).map((v, i) => (
              <TabsTrigger
                key={v}
                value={v}
                className={cn(
                  'h-10 rounded-none text-xs data-[state=active]:bg-background data-[state=active]:shadow-none',
                  i < 2 && 'border-r border-border/60',
                )}
              >
                {v === 'listing' ? 'Cette annonce' : v === 'others' ? (
                  <>Autres offres{otherListings.length > 0 ? <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums">{otherListings.length}</span> : null}</>
                ) : 'Tendance 30j'}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="listing" className="mt-0 space-y-3 p-5">
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
              <Avatar className="h-8 w-8 shrink-0">
                {listing.seller.profilePicture ? <AvatarImage src={resolveImageUrl(listing.seller.profilePicture)} alt={listing.seller.username} /> : null}
                <AvatarFallback className="bg-background text-xs font-medium">{listing.seller.username.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground">Vendeur</p>
                <p className="truncate text-sm font-medium" style={listing.seller.usernameColor ? { color: listing.seller.usernameColor } : undefined}>{listing.seller.username}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Publié</p>
                <p className="text-xs font-medium">{formatRelativeDate(listing.createdAt)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Prix / unité', value: formatMoney(listing.unitPrice) },
                { label: 'Quantité', value: `x${listing.quantity}` },
                { label: 'Total', value: formatMoney(listing.totalPrice) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="mt-1 text-sm font-bold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
            {isOwner ? (
              <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3 text-center text-sm text-muted-foreground">C'est votre annonce</div>
            ) : (
              <Button className="w-full" onClick={() => onBuy(listing)} disabled={!!buyingListingId}>
                {buyingListingId === listing.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Acheter · {formatMoney(listing.totalPrice)}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="others" className="mt-0">
            {otherListings.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Aucune autre offre pour cet objet.</div>
            ) : (
              <ScrollArea className="h-56">
                <div className="space-y-0">
                  {otherListings.map((other, idx) => {
                    const isMine = currentUserId === other.sellerId;
                    const busy = buyingListingId === other.id;
                    return (
                      <div key={other.id} className={cn('flex items-center gap-3 px-4 py-3 text-sm', idx !== 0 && 'border-t border-border/50')}>
                        <Avatar className="h-7 w-7 shrink-0">
                          {other.seller.profilePicture ? <AvatarImage src={resolveImageUrl(other.seller.profilePicture)} alt={other.seller.username} /> : null}
                          <AvatarFallback className="bg-background text-xs font-medium">{other.seller.username.slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium" style={other.seller.usernameColor ? { color: other.seller.usernameColor } : undefined}>{other.seller.username}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">x<span className="font-medium text-foreground">{other.quantity}</span></span>
                        <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">{formatMoney(other.unitPrice)}</span>
                        {!isMine ? (
                          <Button size="sm" variant="outline" className="shrink-0" onClick={() => onBuy(other)} disabled={!!buyingListingId}>
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Acheter'}
                          </Button>
                        ) : <Badge variant="outline" className="shrink-0 text-[10px]">Vous</Badge>}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="trend" className="mt-0 space-y-3 p-5">
            {stat ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Prix moyen 30j', value: stat.averageUnitPrice30d === null ? 'N/A' : formatMoney(Math.round(stat.averageUnitPrice30d)) },
                    { label: 'Évolution 30j', value: formatEvolution(stat.priceEvolutionPct30d), tone: evolutionTone(stat.priceEvolutionPct30d), icon: (stat.priceEvolutionPct30d ?? 0) > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : (stat.priceEvolutionPct30d ?? 0) < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : null },
                    { label: 'Offre la plus basse', value: stat.lowestOffer === null ? 'Aucune' : formatMoney(stat.lowestOffer) },
                    { label: 'Ventes 30j', value: `${stat.soldUnits30d.toLocaleString('fr-FR')} u.` },
                  ].map(({ label, value, tone, icon }) => (
                    <div key={label} className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                      <p className={cn('mt-0.5 flex items-center gap-1 text-sm font-semibold', tone)}>{icon}{value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium text-muted-foreground">Prix moyen journalier</span>
                  </div>
                  <PriceHistoryChart timeline={stat.timeline} />
                </div>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Aucune donnée disponible pour cet objet.</div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Market list row (items) ───────────────────────────────
function MarketListRow({ listing, onClick }: { listing: MarketplaceListing; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 border-b border-border/50 px-4 py-3 text-left last:border-0 transition-colors hover:bg-muted/30"
    >
      <ItemThumb item={listing.item} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-snug">{listing.item.name}</p>
        <p className="text-xs text-muted-foreground">{getTypeLabel(listing.item.type)}</p>
      </div>
      <div className="hidden w-24 shrink-0 text-right sm:block">
        <p className="text-sm font-bold tabular-nums">{formatMoney(listing.unitPrice)}</p>
        <p className="text-[11px] text-muted-foreground">/ unité</p>
      </div>
      <div className="hidden min-w-0 w-32 shrink-0 md:flex md:items-center md:gap-2">
        <Avatar className="h-6 w-6 shrink-0">
          {listing.seller.profilePicture ? <AvatarImage src={resolveImageUrl(listing.seller.profilePicture)} alt={listing.seller.username} /> : null}
          <AvatarFallback className="bg-muted text-[10px] font-medium">{listing.seller.username.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="truncate text-xs font-medium" style={listing.seller.usernameColor ? { color: listing.seller.usernameColor } : undefined}>{listing.seller.username}</span>
      </div>
      <div className="hidden w-14 shrink-0 text-right lg:block">
        <p className="text-sm font-medium tabular-nums">x{listing.quantity}</p>
        <p className="text-[11px] text-muted-foreground">dispo</p>
      </div>
      <div className="hidden w-20 shrink-0 text-right xl:block">
        <p className="text-xs text-muted-foreground">{formatRelativeDate(listing.createdAt)}</p>
      </div>
      <div className="shrink-0 text-right sm:hidden">
        <p className="text-sm font-bold tabular-nums">{formatMoney(listing.unitPrice)}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

// ── Inventory listing card (sell tab) ─────────────────────
function InventoryListingCard({ item, selected, onSelect }: { item: InventoryItem; selected: boolean; onSelect: (item: InventoryItem) => void }) {
  const effectLabel = parseEffectLabel(item.item.effect);
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn('group w-full rounded-xl border p-3 text-left', selected ? 'border-primary/50 bg-primary/5 shadow-sm' : 'border-border/60 bg-card')}
    >
      <div className="flex gap-3">
        <ItemThumb item={item.item} size="md" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{item.item.name}</p>
              <p className="text-xs text-muted-foreground">{getTypeLabel(item.item.type)}</p>
            </div>
            <Badge variant="secondary" className="shrink-0 border-border/60 bg-background text-[11px]">x{item.quantity}</Badge>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{item.item.description}</p>
          {effectLabel ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Tag className="h-3.5 w-3.5" />{effectLabel}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

// ── Resource icon ─────────────────────────────────────────
function ResourceIcon({ type, size = 'md' }: { type: ResourceType; size?: 'sm' | 'md' | 'lg' }) {
  const meta = RESOURCE_META[type];
  const { Icon } = meta;
  const dim = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  const iconDim = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-6 w-6' : 'h-4 w-4';
  return (
    <div className={cn(dim, 'shrink-0 flex items-center justify-center rounded-lg', meta.bg)}>
      <Icon className={cn(iconDim, meta.iconColor)} />
    </div>
  );
}

// ── Resource list row ─────────────────────────────────────
function ResourceListRow({ listing, onClick }: { listing: ResourceListing; onClick: () => void }) {
  const meta = RESOURCE_META[listing.resourceType];
  const tier = TIER_META[meta.tier];
  const hasChange = listing.priceChange24h !== null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 border-b border-border/50 px-4 py-3 text-left last:border-0 transition-colors hover:bg-muted/30"
    >
      <ResourceIcon type={listing.resourceType} size="sm" />

      <div className="min-w-0 flex-[2]">
        <p className="truncate text-sm font-semibold">{meta.label}</p>
        <Badge className={cn('mt-0.5 border px-1.5 py-0 text-[10px] font-medium leading-4', tier.cls)}>{tier.label}</Badge>
      </div>

      <div className="w-24 shrink-0 text-right">
        <p className="text-sm font-bold tabular-nums">{formatMoney(listing.unitPrice)}</p>
        <p className="text-[11px] text-muted-foreground">/ unité</p>
      </div>

      <div className="hidden w-20 shrink-0 text-right sm:block">
        {hasChange ? (
          <p className={cn('flex items-center justify-end gap-0.5 text-xs font-medium', evolutionTone(listing.priceChange24h))}>
            {(listing.priceChange24h ?? 0) > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {formatEvolution(listing.priceChange24h)}
          </p>
        ) : <p className="text-xs text-muted-foreground">—</p>}
        <p className="text-[10px] text-muted-foreground">24h</p>
      </div>

      <div className="hidden w-28 shrink-0 text-right md:block">
        <p className="text-sm font-medium tabular-nums">{listing.quantity.toLocaleString('fr-FR')}</p>
        <p className="text-[11px] text-muted-foreground">disponibles</p>
      </div>

      <div className="hidden min-w-0 w-32 shrink-0 lg:flex lg:items-center lg:gap-2">
        <Avatar className="h-6 w-6 shrink-0">
          {listing.seller.profilePicture ? <AvatarImage src={resolveImageUrl(listing.seller.profilePicture)} alt={listing.seller.username} /> : null}
          <AvatarFallback className="bg-muted text-[10px] font-medium">{listing.seller.username.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="truncate text-xs font-medium" style={listing.seller.usernameColor ? { color: listing.seller.usernameColor } : undefined}>{listing.seller.username}</span>
      </div>

      <div className="hidden w-20 shrink-0 text-right xl:block">
        <p className="text-xs text-muted-foreground">{formatRelativeDate(listing.createdAt)}</p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

// ── Resource detail modal ─────────────────────────────────
function ResourceDetailModal({
  listing,
  otherListings,
  currentUserId,
  onClose,
}: {
  listing: ResourceListing;
  otherListings: ResourceListing[];
  currentUserId?: string;
  onClose: () => void;
}) {
  const [buyQty, setBuyQty] = useState('1');
  const meta = RESOURCE_META[listing.resourceType];
  const tier = TIER_META[meta.tier];
  const isOwner = currentUserId === listing.sellerId;
  const qty = Math.max(1, Math.min(listing.quantity, Number.parseInt(buyQty, 10) || 1));
  const total = qty * listing.unitPrice;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <div className="flex gap-4 p-5 pb-4">
          <ResourceIcon type={listing.resourceType} size="lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className={cn('border text-[11px]', tier.cls)}>{tier.label}</Badge>
            </div>
            <h2 className="text-base font-bold leading-tight">{meta.label}</h2>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>
        </div>

        <Tabs defaultValue="listing" className="border-t border-border/60">
          <TabsList className="grid h-10 w-full grid-cols-2 rounded-none border-b border-border/60 bg-muted/20 p-0">
            <TabsTrigger value="listing" className="h-10 rounded-none border-r border-border/60 text-xs data-[state=active]:bg-background data-[state=active]:shadow-none">
              Cette offre
            </TabsTrigger>
            <TabsTrigger value="others" className="h-10 rounded-none text-xs data-[state=active]:bg-background data-[state=active]:shadow-none">
              Autres offres
              {otherListings.length > 0 ? <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums">{otherListings.length}</span> : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="listing" className="mt-0 space-y-3 p-5">
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
              <Avatar className="h-8 w-8 shrink-0">
                {listing.seller.profilePicture ? <AvatarImage src={resolveImageUrl(listing.seller.profilePicture)} alt={listing.seller.username} /> : null}
                <AvatarFallback className="bg-background text-xs font-medium">{listing.seller.username.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground">Vendeur</p>
                <p className="truncate text-sm font-medium" style={listing.seller.usernameColor ? { color: listing.seller.usernameColor } : undefined}>{listing.seller.username}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Publié</p>
                <p className="text-xs font-medium">{formatRelativeDate(listing.createdAt)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Prix / unité</p>
                <p className="mt-1 text-sm font-bold tabular-nums">{formatMoney(listing.unitPrice)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Stock disponible</p>
                <p className="mt-1 text-sm font-bold tabular-nums">{listing.quantity.toLocaleString('fr-FR')} u.</p>
              </div>
            </div>

            {!isOwner ? (
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">Quantité à acheter</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max={listing.quantity}
                      value={buyQty}
                      onChange={(e) => setBuyQty(e.target.value)}
                      className="w-24 text-right tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => setBuyQty(String(listing.quantity))}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Max
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold tabular-nums">{formatMoney(total)}</span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => toast.info('Bientôt disponible', { description: 'Les ressources seront achetables une fois le système de production en ligne.' })}
                >
                  Acheter {qty} {meta.label.toLowerCase()} · {formatMoney(total)}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3 text-center text-sm text-muted-foreground">C'est votre annonce</div>
            )}
          </TabsContent>

          <TabsContent value="others" className="mt-0">
            {otherListings.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Aucune autre offre pour cette ressource.</div>
            ) : (
              <ScrollArea className="h-64">
                {otherListings.map((other, idx) => {
                  const isMine = currentUserId === other.sellerId;
                  return (
                    <div key={other.id} className={cn('flex items-center gap-3 px-4 py-3', idx !== 0 && 'border-t border-border/50')}>
                      <Avatar className="h-7 w-7 shrink-0">
                        {other.seller.profilePicture ? <AvatarImage src={resolveImageUrl(other.seller.profilePicture)} alt={other.seller.username} /> : null}
                        <AvatarFallback className="bg-background text-xs font-medium">{other.seller.username.slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium" style={other.seller.usernameColor ? { color: other.seller.usernameColor } : undefined}>{other.seller.username}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{other.quantity.toLocaleString('fr-FR')} u.</span>
                      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">{formatMoney(other.unitPrice)}</span>
                      {isMine ? <Badge variant="outline" className="shrink-0 text-[10px]">Vous</Badge> : (
                        <Button size="sm" variant="outline" className="shrink-0" onClick={() => toast.info('Bientôt disponible')}>Acheter</Button>
                      )}
                    </div>
                  );
                })}
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────
export default function Marketplace() {
  const { user, updateBalance } = useAuth();
  const [loading, setLoading] = useState(true);
  const [marketListings, setMarketListings] = useState<MarketplaceListing[]>([]);
  const [salesHistoryListings, setSalesHistoryListings] = useState<MarketplaceListing[]>([]);
  const [marketStats, setMarketStats] = useState<MarketplaceProductStats[]>([]);
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Tab state
  const [topTab, setTopTab] = useState<TopTab>('resources');
  const [itemsSubTab, setItemsSubTab] = useState<ItemsSubTab>('market');
  const [sellSubTab, setSellSubTab] = useState<SellSubTab>('items');

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

  // Resource marketplace state
  const [resourceTypeFilter, setResourceTypeFilter] = useState<ResourceType | 'ALL'>('ALL');
  const [resourceTierFilter, setResourceTierFilter] = useState<ResourceTier | 'ALL'>('ALL');
  const [resourceSearch, setResourceSearch] = useState('');
  const [resourceSortMode, setResourceSortMode] = useState<ResourceSortMode>('price-asc');
  const [resourcePriceMin, setResourcePriceMin] = useState('');
  const [resourcePriceMax, setResourcePriceMax] = useState('');
  const [resourceMinQty, setResourceMinQty] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [showResourceFilters, setShowResourceFilters] = useState(false);

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

  // Resource filtering
  const filteredResourceListings = useMemo(() => {
    const term = resourceSearch.trim().toLowerCase();
    const priceMin = resourcePriceMin ? Number(resourcePriceMin) : null;
    const priceMax = resourcePriceMax ? Number(resourcePriceMax) : null;
    const minQty = resourceMinQty ? Number(resourceMinQty) : null;

    return MOCK_RESOURCE_LISTINGS
      .filter((l) => resourceTierFilter === 'ALL' || RESOURCE_META[l.resourceType].tier === resourceTierFilter)
      .filter((l) => resourceTypeFilter === 'ALL' || l.resourceType === resourceTypeFilter)
      .filter((l) => !term || RESOURCE_META[l.resourceType].label.toLowerCase().includes(term) || l.seller.username.toLowerCase().includes(term))
      .filter((l) => priceMin === null || l.unitPrice >= priceMin)
      .filter((l) => priceMax === null || l.unitPrice <= priceMax)
      .filter((l) => minQty === null || l.quantity >= minQty)
      .sort((a, b) => {
        switch (resourceSortMode) {
          case 'price-asc': return a.unitPrice - b.unitPrice;
          case 'price-desc': return b.unitPrice - a.unitPrice;
          case 'qty-desc': return b.quantity - a.quantity;
          default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
  }, [resourceTypeFilter, resourceTierFilter, resourceSearch, resourceSortMode, resourcePriceMin, resourcePriceMax, resourceMinQty]);

  const selectedResource = useMemo(() => MOCK_RESOURCE_LISTINGS.find((l) => l.id === selectedResourceId) ?? null, [selectedResourceId]);
  const otherResourceListings = useMemo(() => {
    if (!selectedResource) return [];
    return MOCK_RESOURCE_LISTINGS
      .filter((l) => l.resourceType === selectedResource.resourceType && l.id !== selectedResource.id)
      .sort((a, b) => a.unitPrice - b.unitPrice);
  }, [selectedResource]);

  // Visible resource type pills (filtered by tier)
  const visibleResourceTypes = useMemo(() => {
    const types = Object.keys(RESOURCE_META) as ResourceType[];
    return resourceTierFilter === 'ALL' ? types : types.filter((t) => RESOURCE_META[t].tier === resourceTierFilter);
  }, [resourceTierFilter]);

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
  const selectedInventorySkinImageUrl = getSkinImageUrl(selectedInventoryItem?.item.effect);

  return (
    <PageShell>
      <div className="space-y-6">
        <Tabs value={topTab} onValueChange={(v) => setTopTab(v as TopTab)} className="space-y-6">
          <TabsList className="h-auto flex-wrap border-border/60 bg-muted/20">
            {([
              { value: 'resources', label: 'Ressources' },
              { value: 'items', label: 'Objets' },
              { value: 'sell', label: 'Vendre' },
              { value: 'mine', label: 'Mes annonces' },
            ] as const).map(({ value, label }) => (
              <TabsTrigger key={value} value={value} className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── RESOURCES TAB ────────────────────────── */}
          <TabsContent value="resources" className="space-y-4">

            {/* Tier pills */}
            <div className="flex flex-wrap gap-2">
              {(['ALL', 'RAW', 'REFINED', 'FINISHED', 'SPECIAL'] as const).map((tier) => {
                const label = tier === 'ALL' ? 'Tous' : TIER_META[tier].label;
                const active = resourceTierFilter === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => { setResourceTierFilter(tier); setResourceTypeFilter('ALL'); }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm transition-colors',
                      active ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Resource type pills */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setResourceTypeFilter('ALL')}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  resourceTypeFilter === 'ALL' ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
                )}
              >
                Toutes
              </button>
              {visibleResourceTypes.map((type) => {
                const meta = RESOURCE_META[type];
                const { Icon } = meta;
                const active = resourceTypeFilter === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setResourceTypeFilter(type)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                      active ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </button>
                );
              })}
            </div>

            {/* Search + sort + advanced filters toggle */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 gap-2">
                <div className="relative flex-1 sm:max-w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={resourceSearch}
                    onChange={(e) => setResourceSearch(e.target.value)}
                    placeholder="Ressource ou vendeur…"
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResourceFilters((v) => !v)}
                  className={cn('gap-1.5', showResourceFilters && 'border-primary/60 bg-primary/5 text-primary')}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtres
                </Button>
              </div>
              <Select value={resourceSortMode} onValueChange={(v) => setResourceSortMode(v as ResourceSortMode)}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Trier" />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Advanced filters panel */}
            {showResourceFilters && (
              <div className="flex flex-wrap gap-3 rounded-xl border border-border/60 bg-muted/10 p-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Prix min / unité</label>
                  <Input type="number" min="0" value={resourcePriceMin} onChange={(e) => setResourcePriceMin(e.target.value)} placeholder="0" className="w-28" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Prix max / unité</label>
                  <Input type="number" min="0" value={resourcePriceMax} onChange={(e) => setResourcePriceMax(e.target.value)} placeholder="∞" className="w-28" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Qté min disponible</label>
                  <Input type="number" min="0" value={resourceMinQty} onChange={(e) => setResourceMinQty(e.target.value)} placeholder="0" className="w-28" />
                </div>
                {(resourcePriceMin || resourcePriceMax || resourceMinQty) && (
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" onClick={() => { setResourcePriceMin(''); setResourcePriceMax(''); setResourceMinQty(''); }}>
                      Réinitialiser
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Resource table */}
            {filteredResourceListings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-10 text-center">
                <BellRing className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">Aucune offre ne correspond à ces filtres.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/60 bg-card/80">
                <div className="hidden border-b border-border/60 bg-muted/30 px-4 py-2 sm:flex sm:items-center sm:gap-3">
                  <div className="w-8 shrink-0" />
                  <div className="min-w-0 flex-[2] text-xs font-medium text-muted-foreground">Ressource</div>
                  <div className="w-24 shrink-0 text-right text-xs font-medium text-muted-foreground">Prix / u.</div>
                  <div className="hidden w-20 shrink-0 text-right text-xs font-medium text-muted-foreground sm:block">Δ 24h</div>
                  <div className="hidden w-28 shrink-0 text-right text-xs font-medium text-muted-foreground md:block">Quantité</div>
                  <div className="hidden w-32 shrink-0 text-xs font-medium text-muted-foreground lg:block">Vendeur</div>
                  <div className="hidden w-20 shrink-0 text-right text-xs font-medium text-muted-foreground xl:block">Publié</div>
                  <div className="w-4 shrink-0" />
                </div>
                {filteredResourceListings.map((listing) => (
                  <ResourceListRow key={listing.id} listing={listing} onClick={() => setSelectedResourceId(listing.id)} />
                ))}
              </div>
            )}

            {filteredResourceListings.length > 0 && (
              <p className="text-right text-xs text-muted-foreground">
                {filteredResourceListings.length} offre{filteredResourceListings.length > 1 ? 's' : ''}
                {' · '}
                {new Set(filteredResourceListings.map((l) => l.sellerId)).size} vendeur{new Set(filteredResourceListings.map((l) => l.sellerId)).size > 1 ? 's' : ''}
              </p>
            )}
          </TabsContent>

          {/* ── ITEMS TAB ─────────────────────────────── */}
          <TabsContent value="items" className="space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                <GridSkeleton cards={6} />
              </div>
            ) : (
              <Tabs value={itemsSubTab} onValueChange={(v) => setItemsSubTab(v as ItemsSubTab)} className="space-y-4">
                <TabsList className="h-auto border-border/60 bg-muted/20">
                  {([
                    { value: 'market', label: 'Marché' },
                    { value: 'history', label: 'Historique ventes' },
                    { value: 'stats', label: 'Tendances 30j' },
                  ] as const).map(({ value, label }) => (
                    <TabsTrigger key={value} value={value} className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Market sub-tab */}
                <TabsContent value="market" className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(TYPE_LABELS) as ItemTypeFilter[]).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTypeFilter(value)}
                          className={cn(
                            'rounded-full border px-3 py-1 text-sm transition-colors',
                            typeFilter === value ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
                          )}
                        >
                          {TYPE_LABELS[value]}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher objet ou vendeur…" className="pl-9 sm:w-56" />
                      </div>
                      <Select value={sortMode} onValueChange={(v) => setSortMode(v as MarketplaceSortMode)}>
                        <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Trier" /></SelectTrigger>
                        <SelectContent>
                          {SORT_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
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
                    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/80">
                      <div className="hidden border-b border-border/60 bg-muted/30 px-4 py-2 sm:flex sm:items-center sm:gap-3">
                        <div className="w-10 shrink-0" />
                        <div className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">Objet</div>
                        <div className="hidden w-24 shrink-0 text-right text-xs font-medium text-muted-foreground sm:block">Prix</div>
                        <div className="hidden w-32 shrink-0 text-xs font-medium text-muted-foreground md:block">Vendeur</div>
                        <div className="hidden w-14 shrink-0 text-right text-xs font-medium text-muted-foreground lg:block">Qté</div>
                        <div className="hidden w-20 shrink-0 text-right text-xs font-medium text-muted-foreground xl:block">Publié</div>
                        <div className="w-4 shrink-0" />
                      </div>
                      {filteredMarketListings.map((listing) => (
                        <MarketListRow key={listing.id} listing={listing} onClick={() => setSelectedListingId(listing.id)} />
                      ))}
                    </div>
                  )}
                  {filteredMarketListings.length > 0 && (
                    <p className="text-right text-xs text-muted-foreground">{filteredMarketListings.length} annonce{filteredMarketListings.length > 1 ? 's' : ''}</p>
                  )}
                </TabsContent>

                {/* History sub-tab */}
                <TabsContent value="history" className="space-y-6">
                  {sortedSalesHistoryListings.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune vente enregistrée pour le moment.</CardContent></Card>
                  ) : (
                    <div className="space-y-2">
                      {sortedSalesHistoryListings.map((listing) => (
                        <Card key={listing.id} className="border-border/60 bg-card/80 shadow-none">
                          <CardContent className="flex items-center gap-3 py-3">
                            <ItemThumb item={listing.item} size="md" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">{listing.item.name}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">Vendue</Badge>
                                <span className="text-xs text-muted-foreground">Vendeur: {listing.seller.username}</span>
                                <span className="text-xs text-muted-foreground">Achat vendeur: {formatMoney(listing.item.price)}</span>
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
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Stats sub-tab */}
                <TabsContent value="stats" className="space-y-6">
                  {marketStats.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune donnée marché disponible pour les 30 derniers jours.</CardContent></Card>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {marketStats.map((stat) => {
                        const isPositive = (stat.priceEvolutionPct30d ?? 0) > 0;
                        const isNegative = (stat.priceEvolutionPct30d ?? 0) < 0;
                        return (
                          <Card key={stat.itemId} className="border-border/60 bg-card/85 shadow-none">
                            <CardContent className="space-y-4 p-4">
                              <div className="flex items-start gap-3">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
                                  {stat.imageUrl ? <img src={resolveImageUrl(stat.imageUrl)} alt={stat.itemName} className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-muted-foreground/50" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold">{stat.itemName}</p>
                                  <div className="mt-1 flex items-center gap-2">
                                    <Badge variant="secondary" className="border-border/60 bg-background text-[11px]">{getTypeLabel(stat.itemType)}</Badge>
                                    <span className="text-xs text-muted-foreground">{stat.soldUnits30d.toLocaleString('fr-FR')} unités vendues</span>
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {[
                                  { label: 'Prix moyen 30j', value: stat.averageUnitPrice30d === null ? 'N/A' : formatMoney(stat.averageUnitPrice30d) },
                                  { label: 'Evolution 30j', value: formatEvolution(stat.priceEvolutionPct30d), extra: <>{isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}{isNegative ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}</>, tone: evolutionTone(stat.priceEvolutionPct30d) },
                                  { label: 'Offre la plus basse', value: stat.lowestOffer === null ? 'Aucune' : formatMoney(stat.lowestOffer) },
                                  { label: 'Offre la plus haute', value: stat.highestOffer === null ? 'Aucune' : formatMoney(stat.highestOffer) },
                                ].map(({ label, value, extra, tone }) => (
                                  <div key={label} className="rounded-lg border border-border/60 bg-background p-2">
                                    <p className="text-xs text-muted-foreground">{label}</p>
                                    <p className={cn('mt-1 flex items-center gap-1 font-semibold', tone)}>{extra}{value}</p>
                                  </div>
                                ))}
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
          <TabsContent value="sell" className="space-y-4">
            <Tabs value={sellSubTab} onValueChange={(v) => setSellSubTab(v as SellSubTab)}>
              <TabsList className="h-auto border-border/60 bg-muted/20">
                <TabsTrigger value="items" className="text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground">Objets</TabsTrigger>
                <TabsTrigger value="resources" className="text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground">Ressources</TabsTrigger>
              </TabsList>

              <TabsContent value="items" className="space-y-6">
                {loading ? (
                  <div className="rounded-2xl border border-border/60 bg-card/70 p-4"><GridSkeleton cards={6} /></div>
                ) : (
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                    <Card className="border-border/60 bg-card/80 shadow-none">
                      <CardContent className="space-y-4 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h2 className="text-lg font-semibold tracking-tight">Ton inventaire</h2>
                            <p className="text-sm text-muted-foreground">Sélectionne l'objet à vendre.</p>
                          </div>
                          <Badge variant="secondary" className="border-border/60 bg-background">{inventory.length} objet{inventory.length > 1 ? 's' : ''}</Badge>
                        </div>
                        {inventory.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">Aucun objet vendable dans ton inventaire.</div>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {inventory.map((item) => (
                              <InventoryListingCard key={item.id} item={item} selected={selectedInventoryId === item.id} onSelect={(next) => setSelectedInventoryId(next.id)} />
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/90 shadow-none lg:sticky lg:top-6">
                      <CardContent className="space-y-5 p-4">
                        <div className="space-y-1">
                          <h2 className="text-lg font-semibold tracking-tight">Créer une annonce</h2>
                          <p className="text-sm text-muted-foreground">Ton objet sera retiré de l'inventaire tant que l'annonce reste active.</p>
                        </div>
                        {selectedInventoryItem ? (
                          <div className="space-y-4">
                            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                              <div className="flex items-start gap-3">
                                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-background">
                                  {selectedInventorySkinImageUrl ? (
                                    <DoodleJumpSkinPreview skinImageUrl={selectedInventorySkinImageUrl} className="h-full" height="100%" />
                                  ) : selectedInventoryItem.item.imageUrl ? (
                                    <img src={resolveImageUrl(selectedInventoryItem.item.imageUrl)} alt={selectedInventoryItem.item.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <Package className="h-6 w-6 text-muted-foreground/60" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="truncate text-base font-semibold">{selectedInventoryItem.item.name}</h3>
                                    <Badge variant="secondary" className="border-border/60 bg-background text-[11px]">{getTypeLabel(selectedInventoryItem.item.type)}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{selectedInventoryItem.item.description}</p>
                                  <p className="text-xs text-muted-foreground">Prix de base: {formatMoney(selectedInventoryItem.item.price)}</p>
                                </div>
                              </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Quantité</label>
                                <Input type="number" min="1" max={selectedMaxQuantity} value={sellQuantity} onChange={(e) => setSellQuantity(e.target.value)} />
                                <p className="text-xs text-muted-foreground">Maximum disponible: {selectedMaxQuantity}</p>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Prix unitaire</label>
                                <Input type="number" min="1" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
                                <p className="text-xs text-muted-foreground">Montant reçu: {formatMoney(Number.parseInt(sellPrice || '0', 10) * Number.parseInt(sellQuantity || '1', 10))}</p>
                              </div>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-background p-4 text-sm text-muted-foreground">
                              {selectedInventoryItem.quantity > 1 ? 'Tu peux vendre une partie de ta pile ou la totalité.' : 'Cet objet sera retiré de ton inventaire dès la mise en vente.'}
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
                )}
              </TabsContent>

              <TabsContent value="resources">
                <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/10 p-10 text-center">
                  <Building2 className="h-10 w-10 text-muted-foreground/30" />
                  <div>
                    <p className="text-sm font-medium">Vente de ressources</p>
                    <p className="mt-1 text-xs text-muted-foreground">Les ressources sont produites et vendues depuis la page de votre entreprise.</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ── MINE TAB ──────────────────────────────── */}
          <TabsContent value="mine" className="space-y-6">
            {loading ? (
              <div className="rounded-2xl border border-border/60 bg-card/70 p-4"><GridSkeleton cards={4} /></div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-2">
                <Card className="border-border/60 bg-card/80 shadow-none">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-semibold tracking-tight">Annonces actives</h2>
                        <p className="text-sm text-muted-foreground">Annule ou garde tes objets en vente.</p>
                      </div>
                      <Badge variant="secondary" className="border-border/60 bg-background">{myActiveListings.length}</Badge>
                    </div>
                    {myActiveListings.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">Aucune annonce active pour le moment.</div>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-border/60">
                        {myActiveListings.map((listing, idx) => {
                          const busy = cancellingListingId === listing.id;
                          return (
                            <div key={listing.id} className={cn('flex items-center gap-3 px-4 py-3', idx !== 0 && 'border-t border-border/60')}>
                              <ItemThumb item={listing.item} size="sm" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{listing.item.name}</p>
                                <p className="text-xs text-muted-foreground">x{listing.quantity} · {formatMoney(listing.unitPrice)} / u.</p>
                              </div>
                              <Button variant="outline" size="sm" className="shrink-0" onClick={() => handleCancelListing(listing)} disabled={busy}>
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          );
                        })}
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
                      <Badge variant="secondary" className="border-border/60 bg-background">{myHistoryListings.length}</Badge>
                    </div>
                    {myHistoryListings.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">Tes annonces soldées ou annulées apparaîtront ici.</div>
                    ) : (
                      <div className="space-y-3">
                        {myHistoryListings.map((listing) => (
                          <div key={listing.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background p-4">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{listing.item.name}</p>
                              <p className="text-xs text-muted-foreground">{listing.quantity} x {formatMoney(listing.unitPrice)}</p>
                            </div>
                            <Badge className={cn('border px-2 py-1 text-[11px] font-medium', statusTone(listing.status))}>{getStatusLabel(listing.status)}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {selectedListing && (
        <ItemDetailModal
          listing={selectedListing}
          otherListings={otherListings}
          stat={selectedStat}
          currentUserId={user?.id}
          buyingListingId={buyingListingId}
          onBuy={handleBuyListing}
          onClose={() => setSelectedListingId(null)}
        />
      )}

      {selectedResource && (
        <ResourceDetailModal
          listing={selectedResource}
          otherListings={otherResourceListings}
          currentUserId={user?.id}
          onClose={() => setSelectedResourceId(null)}
        />
      )}
    </PageShell>
  );
}

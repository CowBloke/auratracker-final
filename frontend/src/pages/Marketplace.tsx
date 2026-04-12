import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Package,
  Search,
  Tag,
  TrendingUp,
  X,
} from 'lucide-react';
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

        {/* ── Fixed header ───────────────────────────── */}
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

        {/* ── Tabs ───────────────────────────────────── */}
        <Tabs defaultValue="listing" className="border-t border-border/60">
          <TabsList className="grid h-10 w-full grid-cols-3 rounded-none border-b border-border/60 bg-muted/20 p-0">
            <TabsTrigger
              value="listing"
              className="h-10 rounded-none border-r border-border/60 text-xs data-[state=active]:bg-background data-[state=active]:shadow-none"
            >
              Cette annonce
            </TabsTrigger>
            <TabsTrigger
              value="others"
              className="h-10 rounded-none border-r border-border/60 text-xs data-[state=active]:bg-background data-[state=active]:shadow-none"
            >
              Autres offres
              {otherListings.length > 0 ? (
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                  {otherListings.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger
              value="trend"
              className="h-10 rounded-none text-xs data-[state=active]:bg-background data-[state=active]:shadow-none"
            >
              Tendance 30j
            </TabsTrigger>
          </TabsList>

          {/* ── Cette annonce ──────────────────────── */}
          <TabsContent value="listing" className="mt-0 space-y-3 p-5">
            {/* Seller */}
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
              <Avatar className="h-8 w-8 shrink-0">
                {listing.seller.profilePicture ? (
                  <AvatarImage src={resolveImageUrl(listing.seller.profilePicture)} alt={listing.seller.username} />
                ) : null}
                <AvatarFallback className="bg-background text-xs font-medium">
                  {listing.seller.username.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground">Vendeur</p>
                <p
                  className="truncate text-sm font-medium"
                  style={listing.seller.usernameColor ? { color: listing.seller.usernameColor } : undefined}
                >
                  {listing.seller.username}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Publié</p>
                <p className="text-xs font-medium">{formatRelativeDate(listing.createdAt)}</p>
              </div>
            </div>

            {/* Price / qty breakdown */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Prix / unité</p>
                <p className="mt-1 text-sm font-bold tabular-nums">{formatMoney(listing.unitPrice)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Quantité</p>
                <p className="mt-1 text-sm font-bold tabular-nums">x{listing.quantity}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Total</p>
                <p className="mt-1 text-sm font-bold tabular-nums">{formatMoney(listing.totalPrice)}</p>
              </div>
            </div>

            {/* Action */}
            {isOwner ? (
              <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3 text-center text-sm text-muted-foreground">
                C'est votre annonce
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={() => onBuy(listing)}
                disabled={!!buyingListingId}
              >
                {buyingListingId === listing.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Acheter · {formatMoney(listing.totalPrice)}
              </Button>
            )}
          </TabsContent>

          {/* ── Autres offres ──────────────────────── */}
          <TabsContent value="others" className="mt-0">
            {otherListings.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Aucune autre offre pour cet objet.
              </div>
            ) : (
              <ScrollArea className="h-56">
                <div className="space-y-0">
                  {otherListings.map((other, idx) => {
                    const isMine = currentUserId === other.sellerId;
                    const busy = buyingListingId === other.id;
                    return (
                      <div
                        key={other.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 text-sm',
                          idx !== 0 && 'border-t border-border/50',
                        )}
                      >
                        <Avatar className="h-7 w-7 shrink-0">
                          {other.seller.profilePicture ? (
                            <AvatarImage src={resolveImageUrl(other.seller.profilePicture)} alt={other.seller.username} />
                          ) : null}
                          <AvatarFallback className="bg-background text-xs font-medium">
                            {other.seller.username.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className="min-w-0 flex-1 truncate text-sm font-medium"
                          style={other.seller.usernameColor ? { color: other.seller.usernameColor } : undefined}
                        >
                          {other.seller.username}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          x<span className="font-medium text-foreground">{other.quantity}</span>
                        </span>
                        <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
                          {formatMoney(other.unitPrice)}
                        </span>
                        {!isMine ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => onBuy(other)}
                            disabled={!!buyingListingId}
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Acheter'}
                          </Button>
                        ) : (
                          <Badge variant="outline" className="shrink-0 text-[10px]">Vous</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* ── Tendance 30j ───────────────────────── */}
          <TabsContent value="trend" className="mt-0 space-y-3 p-5">
            {stat ? (
              <>
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                    <p className="text-[11px] text-muted-foreground">Prix moyen 30j</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">
                      {stat.averageUnitPrice30d === null ? 'N/A' : formatMoney(Math.round(stat.averageUnitPrice30d))}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                    <p className="text-[11px] text-muted-foreground">Évolution 30j</p>
                    <p className={cn('mt-0.5 flex items-center gap-1 text-sm font-semibold', evolutionTone(stat.priceEvolutionPct30d))}>
                      {(stat.priceEvolutionPct30d ?? 0) > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}
                      {(stat.priceEvolutionPct30d ?? 0) < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
                      {formatEvolution(stat.priceEvolutionPct30d)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                    <p className="text-[11px] text-muted-foreground">Offre la plus basse</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">
                      {stat.lowestOffer === null ? 'Aucune' : formatMoney(stat.lowestOffer)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                    <p className="text-[11px] text-muted-foreground">Ventes 30j</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">
                      {stat.soldUnits30d.toLocaleString('fr-FR')} u.
                    </p>
                  </div>
                </div>
                {/* Chart */}
                <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium text-muted-foreground">Prix moyen journalier</span>
                  </div>
                  <PriceHistoryChart timeline={stat.timeline} />
                </div>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Aucune donnée disponible pour cet objet.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Market list row (one row = one listing) ───────────────
function MarketListRow({
  listing,
  onClick,
}: {
  listing: MarketplaceListing;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 border-b border-border/50 px-4 py-3 text-left last:border-0 transition-colors hover:bg-muted/30"
    >
      <ItemThumb item={listing.item} size="sm" />

      {/* Name + type */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-snug">{listing.item.name}</p>
        <p className="text-xs text-muted-foreground">{getTypeLabel(listing.item.type)}</p>
      </div>

      {/* Unit price */}
      <div className="hidden w-24 shrink-0 text-right sm:block">
        <p className="text-sm font-bold tabular-nums">{formatMoney(listing.unitPrice)}</p>
        <p className="text-[11px] text-muted-foreground">/ unité</p>
      </div>

      {/* Seller */}
      <div className="hidden min-w-0 w-32 shrink-0 md:flex md:items-center md:gap-2">
        <Avatar className="h-6 w-6 shrink-0">
          {listing.seller.profilePicture ? (
            <AvatarImage src={resolveImageUrl(listing.seller.profilePicture)} alt={listing.seller.username} />
          ) : null}
          <AvatarFallback className="bg-muted text-[10px] font-medium">
            {listing.seller.username.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span
          className="truncate text-xs font-medium"
          style={listing.seller.usernameColor ? { color: listing.seller.usernameColor } : undefined}
        >
          {listing.seller.username}
        </span>
      </div>

      {/* Qty */}
      <div className="hidden w-14 shrink-0 text-right lg:block">
        <p className="text-sm font-medium tabular-nums">x{listing.quantity}</p>
        <p className="text-[11px] text-muted-foreground">dispo</p>
      </div>

      {/* Date */}
      <div className="hidden w-20 shrink-0 text-right xl:block">
        <p className="text-xs text-muted-foreground">{formatRelativeDate(listing.createdAt)}</p>
      </div>

      {/* Price on mobile only */}
      <div className="shrink-0 text-right sm:hidden">
        <p className="text-sm font-bold tabular-nums">{formatMoney(listing.unitPrice)}</p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

// ── Inventory listing card (sell tab) ─────────────────────
function InventoryListingCard({
  item,
  selected,
  onSelect,
}: {
  item: InventoryItem;
  selected: boolean;
  onSelect: (item: InventoryItem) => void;
}) {
  const effectLabel = parseEffectLabel(item.item.effect);

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
        <ItemThumb item={item.item} size="md" />
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

// ── Main page ─────────────────────────────────────────────
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
    } catch (error) {
      console.error('Failed to load marketplace data:', error);
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

  const activeListings = useMemo(
    () => marketListings.filter((l) => l.status === 'ACTIVE'),
    [marketListings],
  );

  const filteredMarketListings = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activeListings
      .filter((l) => typeFilter === 'ALL' || l.item.type === typeFilter)
      .filter((l) => {
        if (!term) return true;
        return [l.item.name, l.item.description, l.seller.username].join(' ').toLowerCase().includes(term);
      })
      .sort((a, b) => {
        switch (sortMode) {
          case 'price-asc': return a.unitPrice - b.unitPrice;
          case 'price-desc': return b.unitPrice - a.unitPrice;
          case 'quantity-desc': return b.quantity - a.quantity;
          case 'newest': default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
  }, [activeListings, search, typeFilter, sortMode]);

  // Modal data — keep live with loaded state
  const selectedListing = useMemo(
    () => activeListings.find((l) => l.id === selectedListingId) ?? null,
    [activeListings, selectedListingId],
  );
  const otherListings = useMemo(() => {
    if (!selectedListing) return [];
    return activeListings
      .filter((l) => l.item.id === selectedListing.item.id && l.id !== selectedListing.id)
      .sort((a, b) => a.unitPrice - b.unitPrice);
  }, [activeListings, selectedListing]);
  const selectedStat = useMemo(
    () => marketStats.find((s) => s.itemId === selectedListing?.item.id) ?? null,
    [marketStats, selectedListing],
  );
  // Auto-close if listing sold out / cancelled
  useEffect(() => {
    if (selectedListingId && !selectedListing) setSelectedListingId(null);
  }, [selectedListingId, selectedListing]);

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
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > selectedInventoryItem.quantity) {
      toast.error('Quantité invalide.'); return;
    }
    if (!Number.isInteger(unitPrice) || unitPrice < 1) {
      toast.error('Prix invalide.'); return;
    }
    try {
      setSubmittingListing(true);
      await marketplaceApi.createListing({ userItemId: selectedInventoryItem.id, quantity, unitPrice });
      toast.success('Annonce créée', { description: `${selectedInventoryItem.item.name} est maintenant en vente.` });
      await loadData();
      setActiveTab('market');
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MarketplaceTab)} className="space-y-6">
          <TabsList className="h-auto flex-wrap border-border/60 bg-muted/20">
            {(['market', 'history', 'stats', 'sell', 'mine'] as const).map((tab) => {
              const labels: Record<typeof tab, string> = {
                market: 'Marché', history: 'Historique ventes',
                stats: 'Tendances 30j', sell: 'Vendre', mine: 'Mes annonces',
              };
              return (
                <TabsTrigger key={tab} value={tab} className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
                  {labels[tab]}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {loading ? (
            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
              <GridSkeleton cards={6} />
            </div>
          ) : (
            <>
              {/* ── MARKET TAB ──────────────────────── */}
              <TabsContent value="market" className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  {/* Type pills */}
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(TYPE_LABELS) as ItemTypeFilter[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTypeFilter(value)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-sm transition-colors',
                          typeFilter === value
                            ? 'border-primary/60 bg-primary/10 text-primary'
                            : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
                        )}
                      >
                        {TYPE_LABELS[value]}
                      </button>
                    ))}
                  </div>
                  {/* Search + sort */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher objet ou vendeur…"
                        className="pl-9 sm:w-56"
                      />
                    </div>
                    <Select value={sortMode} onValueChange={(v) => setSortMode(v as MarketplaceSortMode)}>
                      <SelectTrigger className="w-full sm:w-44">
                        <SelectValue placeholder="Trier" />
                      </SelectTrigger>
                      <SelectContent>
                        {SORT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Listings */}
                {filteredMarketListings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-10 text-center">
                    <BellRing className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground">Aucune annonce ne correspond à ces filtres.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border/60 bg-card/80">
                    {/* Column headers */}
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
                      <MarketListRow
                        key={listing.id}
                        listing={listing}
                        onClick={() => setSelectedListingId(listing.id)}
                      />
                    ))}
                  </div>
                )}

                {filteredMarketListings.length > 0 ? (
                  <p className="text-right text-xs text-muted-foreground">
                    {filteredMarketListings.length} annonce{filteredMarketListings.length > 1 ? 's' : ''}
                  </p>
                ) : null}
              </TabsContent>

              {/* ── HISTORY TAB ─────────────────────── */}
              <TabsContent value="history" className="space-y-6">
                {sortedSalesHistoryListings.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Aucune vente enregistrée pour le moment.
                    </CardContent>
                  </Card>
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

              {/* ── STATS TAB ───────────────────────── */}
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
                      const isPositive = (stat.priceEvolutionPct30d ?? 0) > 0;
                      const isNegative = (stat.priceEvolutionPct30d ?? 0) < 0;
                      return (
                        <Card key={stat.itemId} className="border-border/60 bg-card/85 shadow-none">
                          <CardContent className="space-y-4 p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
                                {stat.imageUrl ? (
                                  <img src={resolveImageUrl(stat.imageUrl)} alt={stat.itemName} className="h-full w-full object-cover" />
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

              {/* ── SELL TAB ────────────────────────── */}
              <TabsContent value="sell" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <Card className="border-border/60 bg-card/80 shadow-none">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h2 className="text-lg font-semibold tracking-tight">Ton inventaire</h2>
                          <p className="text-sm text-muted-foreground">Sélectionne l'objet à vendre.</p>
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
                          Ton objet sera retiré de l'inventaire tant que l'annonce reste active.
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
                                  <img src={resolveImageUrl(selectedInventoryItem.item.imageUrl)} alt={selectedInventoryItem.item.name} className="h-full w-full object-cover" />
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
                              <Input type="number" min="1" max={selectedMaxQuantity} value={sellQuantity} onChange={(e) => setSellQuantity(e.target.value)} />
                              <p className="text-xs text-muted-foreground">Maximum disponible: {selectedMaxQuantity}</p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Prix unitaire</label>
                              <Input type="number" min="1" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
                              <p className="text-xs text-muted-foreground">
                                Montant reçu: {formatMoney(Number.parseInt(sellPrice || '0', 10) * Number.parseInt(sellQuantity || '1', 10))}
                              </p>
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

              {/* ── MINE TAB ────────────────────────── */}
              <TabsContent value="mine" className="space-y-6">
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
                        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                          Aucune annonce active pour le moment.
                        </div>
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
                        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                          Tes annonces soldées ou annulées apparaîtront ici.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {myHistoryListings.map((listing) => (
                            <div key={listing.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background p-4">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{listing.item.name}</p>
                                <p className="text-xs text-muted-foreground">{listing.quantity} x {formatMoney(listing.unitPrice)}</p>
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

      {/* Item detail modal */}
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

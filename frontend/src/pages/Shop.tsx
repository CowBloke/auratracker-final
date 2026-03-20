import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { marketplaceApi, giftsApi, usersApi, ShopItem, ShopCategory, AdminInventoryItem } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageShell } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { toast } from 'sonner';
import {
  Coins, Loader2, Package, Gift, Send, Sparkles, Zap, TrendingUp,
  Timer, Flame, Star, Gamepad2, RotateCcw, ShoppingCart,
} from 'lucide-react';

// ─── Category config ───────────────────────────────────────────────────────────

const CATEGORY_CFG: Record<string, {
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
  strip: string;
  headerBg: string;
  headerText: string;
  priceBadge: string;
  buyBtn: string;
  pillActive: string;
}> = {
  COSMETIC: {
    Icon: Sparkles,
    color: 'text-violet-400',
    strip: 'from-violet-500 to-purple-600',
    headerBg: 'from-violet-900/40 to-violet-800/10 border-violet-500/25',
    headerText: 'text-violet-300',
    priceBadge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    buyBtn: 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white shadow-md shadow-violet-900/40',
    pillActive: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  },
  CONSUMABLE: {
    Icon: Zap,
    color: 'text-amber-400',
    strip: 'from-amber-500 to-orange-500',
    headerBg: 'from-amber-900/40 to-orange-800/10 border-amber-500/25',
    headerText: 'text-amber-300',
    priceBadge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    buyBtn: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-md shadow-amber-900/40',
    pillActive: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  UPGRADE: {
    Icon: TrendingUp,
    color: 'text-sky-400',
    strip: 'from-sky-500 to-cyan-500',
    headerBg: 'from-sky-900/40 to-cyan-800/10 border-sky-500/25',
    headerText: 'text-sky-300',
    priceBadge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    buyBtn: 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white shadow-md shadow-sky-900/40',
    pillActive: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  GIFT: {
    Icon: Gift,
    color: 'text-pink-400',
    strip: 'from-pink-500 to-rose-500',
    headerBg: 'from-pink-900/40 to-rose-800/10 border-pink-500/25',
    headerText: 'text-pink-300',
    priceBadge: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    buyBtn: 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white shadow-md shadow-pink-900/40',
    pillActive: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
  },
};

const FALLBACK_CFG = CATEGORY_CFG.COSMETIC;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseEffectType = (effect: string | null): string | null => {
  if (!effect) return null;
  try {
    const p = JSON.parse(effect);
    if (typeof p.bonusAura === 'number') return 'BONUS_AURA';
    if (typeof p.bonusMoney === 'number') return 'BONUS_MONEY';
    return p.type ?? null;
  } catch {
    return null;
  }
};

const getEffectLabel = (effect: string | null) => {
  if (!effect) return null;
  try {
    const p = JSON.parse(effect) as { type?: string; bonusAura?: number; bonusMoney?: number };
    if (typeof p.bonusAura === 'number') return `+${p.bonusAura} aura`;
    if (typeof p.bonusMoney === 'number') return `+$${p.bonusMoney}`;
    if (p.type === 'USERNAME_COLOR') return 'Couleur de pseudo';
    if (p.type === 'PROFILE_PICTURE') return 'Photo de profil';
    if (p.type === 'DOODLE_JUMP_SKIN') return 'Skin Doodle Jump';
    if (p.type === 'GIFT') return 'Cadeau à envoyer';
  } catch { /**/ }
  return null;
};

const getSkinImageUrl = (effect: string | null): string | null => {
  if (!effect) return null;
  try {
    const p = JSON.parse(effect);
    if (p.type === 'DOODLE_JUMP_SKIN' && p.skinImageUrl) return p.skinImageUrl as string;
  } catch { /**/ }
  return null;
};

const isDoodleJumpSkin = (item: { effect: string | null }) => parseEffectType(item.effect) === 'DOODLE_JUMP_SKIN';

// ─── Doodle Jump Canvas Preview ────────────────────────────────────────────────

const DJ_COLORS = {
  background: '#0a0a0a',
  platformNormal: '#e5e7eb',
  platformBounce: '#7c3aed',
  platformMoving: '#9ca3af',
};
const PW = 80;
const PH = 15;

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

function DoodleJumpSkinPreview({ skinImageUrl }: { skinImageUrl: string }) {
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

      // Subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x < CW; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke();
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

      // Jump arc
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

      // Character
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
      className="w-full"
      style={{ display: 'block', height: '180px' }}
    />
  );
}

// ─── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(targetIso: string | null): string {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!targetIso) return;
    const update = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) { setDisplay('00:00:00'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setDisplay(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return display;
}

// ─── Price color helper ────────────────────────────────────────────────────────

function priceColor(price: number) {
  if (price === 0) return 'text-green-400';
  if (price <= 100) return 'text-emerald-400';
  if (price <= 500) return 'text-amber-400';
  return 'text-red-400';
}

// ─── ShopCard ─────────────────────────────────────────────────────────────────

function ShopCard({
  item,
  user,
  buyingItemId,
  ownedSkinItemIds,
  onPurchase,
  onSend,
}: {
  item: ShopItem;
  user: ReturnType<typeof useAuth>['user'];
  buyingItemId: string | null;
  ownedSkinItemIds: Set<string>;
  onPurchase: (item: ShopItem) => void;
  onSend: (item: ShopItem) => void;
}) {
  const isGift = item.type === 'GIFT' || parseEffectType(item.effect) === 'GIFT';
  const effectLabel = isGift ? null : getEffectLabel(item.effect);
  const canAfford = (user?.money ?? 0) >= item.price;
  const skinUrl = getSkinImageUrl(item.effect);
  const cfg = CATEGORY_CFG[item.type] ?? FALLBACK_CFG;
  const isBuying = buyingItemId === item.id;
  const isOwnedSkin = isDoodleJumpSkin(item) && ownedSkinItemIds.has(item.id);

  const renderMedia = () => {
    if (skinUrl) return <DoodleJumpSkinPreview skinImageUrl={skinUrl} />;
    if (item.imageUrl) {
      return (
        <div className="relative overflow-hidden">
          <img
            src={resolveImageUrl(item.imageUrl)}
            alt={item.name}
            className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      );
    }
    return (
      <div className={cn('flex h-36 w-full items-center justify-center', cfg.headerBg.split(' ')[0])}>
        {isGift
          ? <Gift className={cn('h-12 w-12 opacity-40', cfg.color)} />
          : <Package className={cn('h-12 w-12 opacity-40', cfg.color)} />
        }
      </div>
    );
  };

  return (
    <Card className={cn(
      'group overflow-hidden transition-all duration-200',
      'hover:-translate-y-0.5 hover:shadow-xl',
    )}>
      {/* Colored accent strip */}
      <div className={cn('h-1 w-full bg-gradient-to-r', cfg.strip)} />
      <CardContent className="p-0">
        {renderMedia()}
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-foreground">{item.name}</h3>
              {effectLabel && (
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border mt-1',
                  cfg.priceBadge,
                )}>
                  <cfg.Icon className="h-3 w-3" />
                  {effectLabel}
                </span>
              )}
            </div>
            <div className={cn(
              'shrink-0 rounded-lg border px-2.5 py-1 text-sm font-bold tabular-nums',
              cfg.priceBadge,
            )}>
              ${item.price}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">{item.description}</p>

          {isGift ? (
            <button
              onClick={() => onSend(item)}
              disabled={!canAfford}
              className={cn(
                'w-full rounded-lg py-2 text-sm font-semibold transition-all duration-150',
                canAfford
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white shadow-md shadow-pink-900/30'
                  : 'bg-muted/20 text-muted-foreground/50 cursor-not-allowed border border-border/20',
              )}
            >
              <span className="flex items-center justify-center gap-2">
                <Gift className="h-4 w-4" />
                {canAfford ? 'Envoyer en cadeau' : 'Solde insuffisant'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => onPurchase(item)}
              disabled={!canAfford || isBuying || isOwnedSkin}
              className={cn(
                'w-full rounded-lg py-2 text-sm font-semibold transition-all duration-150',
                canAfford && !isBuying && !isOwnedSkin
                  ? cn(cfg.buyBtn)
                  : 'bg-muted/20 text-muted-foreground/50 cursor-not-allowed border border-border/20',
              )}
            >
              <span className="flex items-center justify-center gap-2">
                {isBuying ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Achat...</>
                ) : isOwnedSkin ? (
                  'Deja possede'
                ) : canAfford ? (
                  <><ShoppingCart className="h-4 w-4" /> Acheter</>
                ) : (
                  'Solde insuffisant'
                )}
              </span>
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── DJ Skin Card (mini, for the dedicated section) ───────────────────────────

function DjSkinCard({
  item,
  user,
  buyingItemId,
  ownedSkinItemIds,
  onPurchase,
}: {
  item: ShopItem;
  user: ReturnType<typeof useAuth>['user'];
  buyingItemId: string | null;
  ownedSkinItemIds: Set<string>;
  onPurchase: (item: ShopItem) => void;
}) {
  const canAfford = (user?.money ?? 0) >= item.price;
  const skinUrl = getSkinImageUrl(item.effect);
  const isBuying = buyingItemId === item.id;
  const isOwnedSkin = ownedSkinItemIds.has(item.id);

  return (
    <Card className="group overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-900/20 border-violet-500/10">
      <div className="h-1 bg-gradient-to-r from-violet-500 to-indigo-600" />
      <CardContent className="p-0">
        {skinUrl
          ? <DoodleJumpSkinPreview skinImageUrl={skinUrl} />
          : <div className="flex h-36 items-center justify-center bg-violet-950/20">
              <Gamepad2 className="h-12 w-12 text-violet-500/30" />
            </div>
        }
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
            <span className={cn('shrink-0 text-sm font-bold tabular-nums', priceColor(item.price))}>
              ${item.price}
            </span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
          <button
            onClick={() => onPurchase(item)}
            disabled={!canAfford || isBuying || isOwnedSkin}
            className={cn(
              'w-full rounded-lg py-2 text-sm font-semibold transition-all duration-150',
              canAfford && !isBuying && !isOwnedSkin
                ? 'bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white shadow-md shadow-violet-900/40'
                : 'bg-muted/20 text-muted-foreground/50 cursor-not-allowed border border-border/20',
            )}
          >
            <span className="flex items-center justify-center gap-2">
              {isBuying
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Achat...</>
                : isOwnedSkin
                  ? 'Deja possede'
                : canAfford
                  ? <><Gamepad2 className="h-4 w-4" /> Débloquer</>
                  : 'Solde insuffisant'
              }
            </span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Doodle Jump Shop Section ─────────────────────────────────────────────────

function DoodleJumpShopSection({
  user,
  buyingItemId,
  ownedSkinItemIds,
  onPurchase,
}: {
  user: ReturnType<typeof useAuth>['user'];
  buyingItemId: string | null;
  ownedSkinItemIds: Set<string>;
  onPurchase: (item: ShopItem) => void;
}) {
  const [staticSkins, setStaticSkins] = useState<ShopItem[]>([]);
  const [rotatingSkins, setRotatingSkins] = useState<ShopItem[]>([]);
  const [nextRefresh, setNextRefresh] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const countdown = useCountdown(nextRefresh);

  useEffect(() => {
    marketplaceApi.getDoodleSkins()
      .then(res => {
        setStaticSkins(res.data.static);
        setRotatingSkins(res.data.rotating);
        setNextRefresh(res.data.nextRefresh);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const hasStatic = staticSkins.length > 0;
  const hasRotating = rotatingSkins.length > 0;

  if (!loading && !hasStatic && !hasRotating) return null;

  return (
    <div className="space-y-6 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 via-indigo-950/20 to-transparent p-6">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20">
          <Gamepad2 className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-violet-200">Skins Doodle Jump</h2>
          <p className="text-xs text-violet-400/70">Personnalise ton personnage dans Doodle Jump</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : (
        <div className="space-y-8">

          {/* Rotating / daily skins — first */}
          {hasRotating && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-300 border border-orange-500/25">
                  <Flame className="h-3.5 w-3.5" />
                  SKINS DU JOUR
                </span>
                {countdown && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground border border-border/20">
                    <Timer className="h-3 w-3" />
                    Renouvellement dans {countdown}
                    <RotateCcw className="h-3 w-3" />
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rotatingSkins.map(item => (
                  <DjSkinCard
                    key={item.id}
                    item={item}
                    user={user}
                    buyingItemId={buyingItemId}
                    ownedSkinItemIds={ownedSkinItemIds}
                    onPurchase={onPurchase}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Static / permanent skins — below */}
          {hasStatic && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-300 border border-violet-500/25">
                  <Star className="h-3.5 w-3.5" />
                  SKINS PERMANENTS
                </span>
                <span className="text-xs text-muted-foreground">Toujours disponibles</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {staticSkins.map(item => (
                  <DjSkinCard
                    key={item.id}
                    item={item}
                    user={user}
                    buyingItemId={buyingItemId}
                    ownedSkinItemIds={ownedSkinItemIds}
                    onPurchase={onPurchase}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Shop ────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES: ShopCategory[] = [
  { id: 'COSMETIC', label: 'Cosmétiques' },
  { id: 'CONSUMABLE', label: 'Consommables' },
  { id: 'UPGRADE', label: 'Améliorations' },
  { id: 'GIFT', label: 'Cadeaux' },
];

export default function Shop() {
  const { user, updateBalance } = useAuth();
  const [filter, setFilter] = useState<string>('ALL');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<AdminInventoryItem[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null);

  // Gift dialog
  const [sendDialogItem, setSendDialogItem] = useState<ShopItem | null>(null);
  const [giftUsers, setGiftUsers] = useState<{ id: string; username: string }[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [sendingGift, setSendingGift] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const inventoryRequest = user?.id
          ? marketplaceApi.getInventory(user.id)
          : Promise.resolve({ data: { items: [] as AdminInventoryItem[] } });
        const [itemsRes, categoriesRes, inventoryRes] = await Promise.all([
          marketplaceApi.getItems({ limit: 100 }),
          marketplaceApi.getCategories(),
          inventoryRequest,
        ]);
        setItems(itemsRes.data.items || []);
        setInventoryItems(inventoryRes.data.items || []);
        if (categoriesRes.data.categories?.length) {
          setCategories(categoriesRes.data.categories);
        }
      } catch {
        toast.error('Impossible de charger la boutique.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  const ownedSkinItemIds = useMemo(() => new Set(
    inventoryItems
      .filter(entry => isDoodleJumpSkin(entry.item))
      .map(entry => entry.item.id),
  ), [inventoryItems]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await usersApi.getAll();
      const allUsers = (res.data as { users?: { id: string; username: string }[] }).users || res.data as unknown as { id: string; username: string }[];
      const list = Array.isArray(allUsers) ? allUsers : [];
      setGiftUsers(list.filter((u: { id: string }) => u.id !== user?.id));
    } catch { /**/ }
    setLoadingUsers(false);
  }, [user?.id]);

  // Exclude DJ skins from the main grid (they get their own section)
  const nonDjItems = useMemo(() =>
    items.filter(item => {
      if (!item.expiresAt || new Date(item.expiresAt) >= new Date()) {
        return parseEffectType(item.effect) !== 'DOODLE_JUMP_SKIN';
      }
      return false;
    }),
    [items],
  );

  const VIRTUAL_FILTERS = useMemo(() => [
    { value: 'ALL', label: 'Tous' },
    ...categories.map(c => ({ value: c.id, label: c.label })),
    { value: 'DOODLE_JUMP', label: '🎮 Doodle Jump' },
  ], [categories]);

  const filteredItems = useMemo(() => {
    if (filter === 'ALL' || filter === 'DOODLE_JUMP') return nonDjItems;
    return nonDjItems.filter(item => item.type === filter);
  }, [nonDjItems, filter]);

  const sections = useMemo(() =>
    categories
      .map(cat => ({
        id: cat.id,
        label: cat.label,
        items: nonDjItems.filter(item => item.type === cat.id),
      }))
      .filter(s => s.items.length > 0),
    [nonDjItems, categories],
  );

  const showDjSection = filter === 'ALL' || filter === 'DOODLE_JUMP';
  const showRegularGrid = filter !== 'DOODLE_JUMP';

  const handlePurchase = async (item: ShopItem) => {
    if (!user || buyingItemId) return;
    if (isDoodleJumpSkin(item) && ownedSkinItemIds.has(item.id)) {
      toast.error('Tu possedes deja ce skin.');
      return;
    }
    setBuyingItemId(item.id);
    try {
      const response = await marketplaceApi.purchase({ itemId: item.id, quantity: 1 });
      updateBalance(response.data.newBalance.aura, response.data.newBalance.money);
      if (response.data.item) {
        setInventoryItems(prev => {
          if (prev.some(entry => entry.item.id === item.id)) return prev;
          return [
            {
              id: response.data.item.id,
              quantity: response.data.item.quantity,
              acquiredAt: response.data.item.acquiredAt,
              item: response.data.item.item,
            },
            ...prev,
          ];
        });
      }

      const isClanTagUnlock = response.data.effect?.type === 'CLAN_TAG_UNLOCK';
      const isDj = parseEffectType(item.effect) === 'DOODLE_JUMP_SKIN';
      toast.success(
        isClanTagUnlock
          ? 'Tag de clan debloque !'
          : isDj
          ? `Skin "${item.name}" débloqué !`
          : 'Achat confirme',
        {
          description: isClanTagUnlock
            ? 'Le tag est maintenant actif pour ton clan. Va dans Clans pour le personnaliser.'
            : isDj
            ? 'Disponible dans Doodle Jump.'
            : `${item.name} a ete ajoute a ton inventaire.`,
        },
      );
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Achat impossible.');
    } finally {
      setBuyingItemId(null);
    }
  };

  const openSendDialog = (item: ShopItem) => {
    setSendDialogItem(item);
    setSelectedReceiver('');
    setGiftMessage('');
    fetchUsers();
  };

  const handleSendGift = async () => {
    if (!sendDialogItem || !selectedReceiver) return;
    setSendingGift(true);
    try {
      const res = await giftsApi.sendShopItem({
        itemId: sendDialogItem.id,
        receiverId: selectedReceiver,
        message: giftMessage.trim() || undefined,
      });
      updateBalance(res.data.newBalance.aura, res.data.newBalance.money);
      setSendDialogItem(null);
      toast.success('Cadeau envoye', {
        description: `"${sendDialogItem.name}" a bien ete envoye.`,
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Envoi impossible.');
    } finally {
      setSendingGift(false);
    }
  };

  return (
    <PageShell>
      <div className="space-y-6">

        {/* ── Category filter tabs + balance ── */}
        <div className="flex flex-wrap items-center gap-2">
          {VIRTUAL_FILTERS.map(entry => {
            const cfg = entry.value === 'ALL'
              ? null
              : entry.value === 'DOODLE_JUMP'
                ? null
                : CATEGORY_CFG[entry.value];
            const isActive = filter === entry.value;

            return (
              <button
                key={entry.value}
                onClick={() => setFilter(entry.value)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-150',
                  isActive
                    ? entry.value === 'DOODLE_JUMP'
                      ? 'bg-violet-500/20 text-violet-200 border-violet-500/40 shadow-sm'
                      : entry.value === 'ALL'
                        ? 'bg-foreground/10 text-foreground border-foreground/20 shadow-sm'
                        : cfg?.pillActive ?? 'bg-foreground/10 text-foreground border-foreground/20'
                    : 'border-border/30 bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground',
                )}
              >
                {cfg && <cfg.Icon className={cn('h-3.5 w-3.5', isActive ? cfg.color : 'text-muted-foreground')} />}
                {entry.value === 'DOODLE_JUMP' && <Gamepad2 className={cn('h-3.5 w-3.5', isActive ? 'text-violet-400' : 'text-muted-foreground')} />}
                {entry.label}
              </button>
            );
          })}
          {/* Balance badge — right-aligned in the same row */}
          <div className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-sm">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            <span className="font-bold tabular-nums text-amber-300">${user?.money ?? 0}</span>
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-8">

            {/* Doodle Jump skins section */}
            {showDjSection && (
              <DoodleJumpShopSection
                user={user}
                buyingItemId={buyingItemId}
                ownedSkinItemIds={ownedSkinItemIds}
                onPurchase={handlePurchase}
              />
            )}

            {/* Regular items */}
            {showRegularGrid && filteredItems.length === 0 && !showDjSection && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Aucun objet disponible pour le moment.
              </p>
            )}

            {showRegularGrid && filter === 'ALL' && sections.map(section => {
              const cfg = CATEGORY_CFG[section.id];
              return (
                <div key={section.id} className="space-y-4">
                  {/* Section header */}
                  <div className={cn(
                    'flex items-center gap-3 rounded-xl border bg-gradient-to-r px-4 py-3',
                    cfg?.headerBg ?? 'from-muted/20 to-muted/10 border-border/20',
                  )}>
                    {cfg && <cfg.Icon className={cn('h-4 w-4', cfg.color)} />}
                    <span className={cn('font-semibold text-sm', cfg?.headerText ?? 'text-foreground')}>
                      {section.label}
                    </span>
                    <span className="ml-auto rounded-full bg-black/20 px-2 py-0.5 text-xs text-muted-foreground">
                      {section.items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {section.items.map(item => (
                      <ShopCard
                        key={item.id}
                        item={item}
                        user={user}
                        buyingItemId={buyingItemId}
                        ownedSkinItemIds={ownedSkinItemIds}
                        onPurchase={handlePurchase}
                        onSend={openSendDialog}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {showRegularGrid && filter !== 'ALL' && filter !== 'DOODLE_JUMP' && (
              filteredItems.length === 0
                ? <p className="py-12 text-center text-sm text-muted-foreground">Aucun objet dans cette catégorie.</p>
                : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredItems.map(item => (
                      <ShopCard
                        key={item.id}
                        item={item}
                        user={user}
                        buyingItemId={buyingItemId}
                        ownedSkinItemIds={ownedSkinItemIds}
                        onPurchase={handlePurchase}
                        onSend={openSendDialog}
                      />
                    ))}
                  </div>
            )}
          </div>
        )}
      </div>

      {/* ── Send gift dialog ── */}
      <Dialog open={!!sendDialogItem} onOpenChange={open => { if (!open) setSendDialogItem(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-pink-400" />
              Envoyer {sendDialogItem?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-xl border border-pink-500/20 bg-pink-500/5 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Prix</span>
              <span className="font-bold tabular-nums text-pink-300">${sendDialogItem?.price}</span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Destinataire</label>
              {loadingUsers ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
                </div>
              ) : (
                <Select value={selectedReceiver} onValueChange={setSelectedReceiver}>
                  <SelectTrigger><SelectValue placeholder="Choisir un utilisateur..." /></SelectTrigger>
                  <SelectContent>
                    {giftUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Message (optionnel)</label>
              <Textarea
                value={giftMessage}
                onChange={e => setGiftMessage(e.target.value.slice(0, 200))}
                placeholder="Ajouter un message..."
                rows={2}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">{giftMessage.length}/200</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogItem(null)}>Annuler</Button>
            <button
              onClick={handleSendGift}
              disabled={!selectedReceiver || sendingGift}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all',
                selectedReceiver && !sendingGift
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white shadow-md'
                  : 'bg-muted/20 text-muted-foreground cursor-not-allowed',
              )}
            >
              {sendingGift
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi...</>
                : <><Send className="h-4 w-4" /> Envoyer</>
              }
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

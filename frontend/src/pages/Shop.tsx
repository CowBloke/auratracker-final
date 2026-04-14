import { useEffect, useMemo, useRef, useState } from 'react';
import { type Ad, adsApi, marketplaceApi, clansApi, ShopItem, ShopCategory, AdminInventoryItem } from '../services/api';
import { AdCard } from '@/components/ads/AdCard';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/layout/page-shell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { toast } from '@/hooks/use-toast';
import {
  Loader2, Package,
  Timer, Gamepad2, RotateCcw, ShoppingCart,
} from 'lucide-react';

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
    const p = JSON.parse(effect) as { type?: string; bonusAura?: number; bonusMoney?: number; percentage?: number };
    if (typeof p.bonusAura === 'number') return `+${p.bonusAura} aura`;
    if (typeof p.bonusMoney === 'number') return `+$${p.bonusMoney}`;
    if (p.type === 'USERNAME_COLOR') return 'Couleur de pseudo';
    if (p.type === 'PROFILE_PICTURE') return 'Photo de profil';
    if (p.type === 'PROFILE_BANNER') return 'Banniere de profil';
    if (p.type === 'DOODLE_JUMP_SKIN') return 'Apparence Doodle Jump';
    if (p.type === 'CLAN_GAME_MONEY_BOOST') return `Boost clan +${p.percentage ?? 0}%`;
    if (p.type === 'CLAN_PROFILE_PICTURE') return 'Photo de profil de clan';
    if (p.type === 'CLAN_BANNER') return 'Bannière de clan';
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
  return price === 0 ? 'text-foreground' : 'text-muted-foreground';
}

// ─── ShopCard ─────────────────────────────────────────────────────────────────

function ShopCard({
  item,
  user,
  buyingItemId,
  ownedSkinItemIds,
  clanStatus,
  onPurchase,
}: {
  item: ShopItem;
  user: ReturnType<typeof useAuth>['user'];
  buyingItemId: string | null;
  ownedSkinItemIds: Set<string>;
  clanStatus: { inClan: boolean; tagUnlocked: boolean; slotUpgraded: boolean; maxMembers: number; clanBankMoney: number } | null;
  onPurchase: (item: ShopItem) => void;
}) {
  const effectType = parseEffectType(item.effect);
  const isClanTagUnlock = effectType === 'CLAN_TAG_UNLOCK';
  const isClanSlotUpgrade = effectType === 'CLAN_SLOT_UPGRADE';
  const isClanMoneyBoost = effectType === 'CLAN_GAME_MONEY_BOOST';
  const isClanProfilePicture = effectType === 'CLAN_PROFILE_PICTURE';
  const isClanBanner = effectType === 'CLAN_BANNER';
  const isClanUpgrade = isClanTagUnlock || isClanSlotUpgrade || isClanMoneyBoost || isClanProfilePicture || isClanBanner;
  const isAlreadyPurchased =
    (isClanTagUnlock && !!clanStatus?.tagUnlocked) ||
    (isClanSlotUpgrade && (clanStatus?.maxMembers ?? 0) >= 7);
  const effectLabel = getEffectLabel(item.effect);
  const canAfford = isClanUpgrade
    ? (clanStatus?.clanBankMoney ?? 0) >= item.price
    : (user?.money ?? 0) >= item.price;
  const skinUrl = getSkinImageUrl(item.effect);
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
            className="h-44 w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      );
    }
    return (
      <div className="flex h-36 w-full items-center justify-center bg-muted/20">
        <Package className="h-12 w-12 opacity-30 text-muted-foreground" />
      </div>
    );
  };

  return (
    <Card className="overflow-hidden border-border/60 bg-card shadow-none">
      <CardContent className="p-0">
        {renderMedia()}
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-foreground">{item.name}</h3>
              {effectLabel && (
                <span className="mt-1 inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {effectLabel}
                </span>
              )}
            </div>
            <div className="shrink-0 rounded-lg border border-border/60 px-2.5 py-1 text-sm font-medium tabular-nums text-muted-foreground">
              ${item.price}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">{item.description}</p>

          <Button
            onClick={() => onPurchase(item)}
            disabled={!canAfford || isBuying || isOwnedSkin || isAlreadyPurchased}
            className={cn(
              'w-full rounded-lg border text-sm font-medium',
              canAfford && !isBuying && !isOwnedSkin && !isAlreadyPurchased
                ? 'border-border/60 bg-transparent text-foreground'
                : 'border-border/40 bg-muted/20 text-muted-foreground/50',
            )}
          >
            <span className="flex items-center justify-center gap-2">
              {isBuying ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Achat...</>
              ) : isAlreadyPurchased ? (
                'Déjà acheté'
              ) : isOwnedSkin ? (
                'Deja possede'
              ) : canAfford ? (
                <><ShoppingCart className="h-4 w-4" /> Acheter</>
              ) : (
                'Solde insuffisant'
              )}
            </span>
          </Button>
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
    <Card className="overflow-hidden border-border/60 bg-card shadow-none">
      <CardContent className="p-0">
        {skinUrl
          ? <DoodleJumpSkinPreview skinImageUrl={skinUrl} />
          : <div className="flex h-36 items-center justify-center bg-muted/20">
              <Gamepad2 className="h-12 w-12 text-muted-foreground/40" />
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
          <Button
            onClick={() => onPurchase(item)}
            disabled={!canAfford || isBuying || isOwnedSkin}
            className={cn(
              'w-full rounded-lg border text-sm font-medium',
              canAfford && !isBuying && !isOwnedSkin
                ? 'border-border/60 bg-transparent text-foreground'
                : 'border-border/40 bg-muted/20 text-muted-foreground/50',
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
          </Button>
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
  cardAds,
}: {
  user: ReturnType<typeof useAuth>['user'];
  buyingItemId: string | null;
  ownedSkinItemIds: Set<string>;
  onPurchase: (item: ShopItem) => void;
  cardAds: Ad[];
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
    <div className="space-y-6 rounded-xl border border-border/60 bg-card p-5 shadow-none md:p-6">
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">

          {/* Rotating / daily skins — first */}
          {hasRotating && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">
                  Apparences du jour
                </h3>
                <div className="h-px flex-1 bg-border/70" />
                {countdown && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
                    <Timer className="h-3 w-3" />
                    Renouvellement dans {countdown}
                    <RotateCcw className="h-3 w-3" />
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rotatingSkins.flatMap((item, i) => {
                  const el = <DjSkinCard key={item.id} item={item} user={user} buyingItemId={buyingItemId} ownedSkinItemIds={ownedSkinItemIds} onPurchase={onPurchase} />;
                  const rotAdIdx = Math.floor(i / 3);
                  if ((i + 1) % 3 === 0 && rotAdIdx < cardAds.length) {
                    return [el, <AdCard key={`dj-rot-ad-${i}`} ad={cardAds[rotAdIdx]!} />];
                  }
                  return [el];
                })}
              </div>
            </div>
          )}

          {/* Static / permanent skins — below */}
          {hasStatic && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">
                  Apparences permanentes
                </h3>
                <div className="h-px flex-1 bg-border/70" />
                <span className="text-xs text-muted-foreground">Toujours disponibles</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {staticSkins.flatMap((item, i) => {
                  const el = <DjSkinCard key={item.id} item={item} user={user} buyingItemId={buyingItemId} ownedSkinItemIds={ownedSkinItemIds} onPurchase={onPurchase} />;
                  const staticAdIdx = Math.floor(i / 6);
                  if ((i + 1) % 6 === 0 && staticAdIdx < cardAds.length) {
                    return [el, <AdCard key={`dj-static-ad-${i}`} ad={cardAds[staticAdIdx]!} />];
                  }
                  return [el];
                })}
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
  { id: 'CONSUMABLE', label: 'Objets' },
  { id: 'UPGRADE', label: 'Améliorations' },
];

export default function Shop() {
  const { user, updateBalance } = useAuth();
  const [filter, setFilter] = useState<string>('ALL');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<AdminInventoryItem[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null);
  const [clanStatus, setClanStatus] = useState<{ inClan: boolean; tagUnlocked: boolean; slotUpgraded: boolean; maxMembers: number; clanBankMoney: number } | null>(null);
  const [cardAds, setCardAds] = useState<Ad[]>([]);
  const effectiveCardAds = user?.hasAdblock ? [] : cardAds;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const inventoryRequest = user?.id
          ? marketplaceApi.getInventory(user.id)
          : Promise.resolve({ data: { items: [] as AdminInventoryItem[] } });
        const clanStatusRequest = user?.id
          ? clansApi.myStatus()
          : Promise.resolve({ data: { inClan: false, tagUnlocked: false, slotUpgraded: false, maxMembers: 0, clanBankMoney: 0 } });
        const [itemsRes, categoriesRes, inventoryRes, clanStatusRes] = await Promise.all([
          marketplaceApi.getItems({ limit: 100 }),
          marketplaceApi.getCategories(),
          inventoryRequest,
          clanStatusRequest,
        ]);
        setItems(itemsRes.data.items || []);
        setInventoryItems(inventoryRes.data.items || []);
        if (categoriesRes.data.categories?.length) {
          setCategories(categoriesRes.data.categories.filter((category) => category.id !== 'GIFT'));
        }
        setClanStatus({
          inClan: clanStatusRes.data.inClan,
          tagUnlocked: clanStatusRes.data.tagUnlocked,
          slotUpgraded: clanStatusRes.data.slotUpgraded,
          maxMembers: clanStatusRes.data.maxMembers,
          clanBankMoney: clanStatusRes.data.clanBankMoney,
        });
      } catch {
        toast.error('Impossible de charger la boutique.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    void adsApi.listPublic().then((res) => setCardAds(res.data.ads)).catch(() => {});
  }, [user?.id]);

  const ownedSkinItemIds = useMemo(() => new Set(
    inventoryItems
      .filter(entry => isDoodleJumpSkin(entry.item))
      .map(entry => entry.item.id),
  ), [inventoryItems]);

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

  const visibleCategories = useMemo(() =>
    categories.filter(category =>
      nonDjItems.some(item => item.type === category.id),
    ),
    [categories, nonDjItems],
  );

  const VIRTUAL_FILTERS = useMemo(() => [
    { value: 'ALL', label: 'Tous' },
    ...visibleCategories.map(c => ({ value: c.id, label: c.label })),
    { value: 'DOODLE_JUMP', label: 'Doodle Jump' },
  ], [visibleCategories]);

  const sections = useMemo(() =>
    visibleCategories
      .map(cat => ({
        id: cat.id,
        label: cat.label,
        items: nonDjItems.filter(item => item.type === cat.id),
      }))
      .filter(s => s.items.length > 0),
    [nonDjItems, visibleCategories],
  );

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
      const isClanSlotUpgrade = response.data.effect?.type === 'CLAN_SLOT_UPGRADE';
      const isClanMoneyBoost = response.data.effect?.type === 'CLAN_GAME_MONEY_BOOST';
      const isClanProfilePicturePurchase = response.data.effect?.type === 'CLAN_PROFILE_PICTURE';
      const isClanBannerPurchase = response.data.effect?.type === 'CLAN_BANNER';
      const isDj = parseEffectType(item.effect) === 'DOODLE_JUMP_SKIN';
      if (isClanTagUnlock) {
        setClanStatus(prev => prev ? { ...prev, tagUnlocked: true, clanBankMoney: prev.clanBankMoney - item.price } : prev);
      }
      if (isClanSlotUpgrade) {
        setClanStatus(prev => prev ? { ...prev, slotUpgraded: true, maxMembers: prev.maxMembers + 1, clanBankMoney: prev.clanBankMoney - item.price } : prev);
      }
      if (isClanMoneyBoost || isClanProfilePicturePurchase || isClanBannerPurchase) {
        setClanStatus(prev => prev ? { ...prev, clanBankMoney: prev.clanBankMoney - item.price } : prev);
      }
      toast.success(
        isClanTagUnlock
          ? 'Tag de clan debloque !'
          : isClanSlotUpgrade
          ? 'Slot de clan debloque !'
          : isClanMoneyBoost
          ? 'Objet de clan acheté'
          : isClanProfilePicturePurchase
          ? 'Photo de profil de clan achetée'
          : isClanBannerPurchase
          ? 'Bannière de clan achetée'
          : isDj
          ? `Apparence "${item.name}" débloquée !`
          : 'Achat confirme',
        {
          description: isClanTagUnlock
            ? 'Le tag est maintenant actif pour ton clan. Va dans Clans pour le personnaliser.'
            : isClanSlotUpgrade
            ? 'Ton clan gagne un membre maximum supplémentaire, jusqu\'à 7 membres.'
            : isClanMoneyBoost
            ? `${item.name} a ete ajoute aux objets du clan. Active-le depuis la page Clan.`
            : isClanProfilePicturePurchase
            ? `${item.name} a ete ajoute aux objets du clan. Active-le depuis la page Clan pour choisir l'image.`
            : isClanBannerPurchase
            ? `${item.name} a ete ajoute aux objets du clan. Active-le depuis la page Clan pour choisir l'image.`
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

  return (
    <PageShell>
      <Tabs value={filter} onValueChange={setFilter} className="space-y-6">
        <TabsList className="h-auto flex-wrap border-border/60 bg-muted/20">
          {VIRTUAL_FILTERS.map(entry => (
            <TabsTrigger
              key={entry.value}
              value={entry.value}
              className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <TabsContent value="ALL" className="space-y-8">
              <DoodleJumpShopSection
                user={user}
                buyingItemId={buyingItemId}
                ownedSkinItemIds={ownedSkinItemIds}
                onPurchase={handlePurchase}
                cardAds={effectiveCardAds}
              />

              {sections.map(section => {
                return (
                  <div key={section.id} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">
                        {section.label}
                      </h2>
                      <div className="h-px flex-1 bg-border/70" />
                      <span className="text-xs text-muted-foreground">
                        {section.items.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {section.items.flatMap((item, i) => {
                        const el = <ShopCard key={item.id} item={item} user={user} buyingItemId={buyingItemId} ownedSkinItemIds={ownedSkinItemIds} clanStatus={clanStatus} onPurchase={handlePurchase} />;
                        if ((i + 1) % 6 === 0 && effectiveCardAds.length > 0) {
                          return [el, <AdCard key={`shop-ad-${section.id}-${i}`} ad={effectiveCardAds[Math.floor(i / 6) % effectiveCardAds.length]!} />];
                        }
                        return [el];
                      })}
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="DOODLE_JUMP" className="space-y-8">
              <DoodleJumpShopSection
                user={user}
                buyingItemId={buyingItemId}
                ownedSkinItemIds={ownedSkinItemIds}
                onPurchase={handlePurchase}
                cardAds={effectiveCardAds}
              />
            </TabsContent>

            {visibleCategories.map(category => {
              const categoryItems = nonDjItems.filter(item => item.type === category.id);

              return (
                <TabsContent key={category.id} value={category.id} className="space-y-8">
                  {categoryItems.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">Aucun objet dans cette catégorie.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {categoryItems.flatMap((item, i) => {
                        const el = <ShopCard key={item.id} item={item} user={user} buyingItemId={buyingItemId} ownedSkinItemIds={ownedSkinItemIds} clanStatus={clanStatus} onPurchase={handlePurchase} />;
                        if ((i + 1) % 6 === 0 && effectiveCardAds.length > 0) {
                          return [el, <AdCard key={`cat-ad-${category.id}-${i}`} ad={effectiveCardAds[Math.floor(i / 6) % effectiveCardAds.length]!} />];
                        }
                        return [el];
                      })}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </>
        )}
      </Tabs>

    </PageShell>
  );
}

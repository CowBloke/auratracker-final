import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { type Ad, adsApi, marketplaceApi, clansApi, ShopItem, ShopCategory, AdminInventoryItem } from '../services/api';
import { AdCard } from '@/components/ads/AdCard';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { DoodleJumpSkinPreview } from '@/components/shop/DoodleJumpSkinPreview';
import { resolveImageUrl } from '@/lib/images';
import { toast } from 'sonner';
import { Gamepad2, Package, RotateCcw, ShoppingBasket, ShoppingCart, Timer } from 'lucide-react';

// Effect types that are now craftable and sold on the items market — hidden from shop
const CRAFTABLE_EFFECT_TYPES = new Set([
  'YOU_ADBLOCK', 'BONUS_AURA', 'PROFILE_PICTURE', 'USERNAME_COLOR', 'PROFILE_BANNER',
]);

function isCraftableItem(item: ShopItem): boolean {
  const et = parseEffectType(item.effect);
  if (et && CRAFTABLE_EFFECT_TYPES.has(et)) return true;
  // Jus de papaye has bonusMoney in effect, no explicit type
  try {
    const p = JSON.parse(item.effect ?? '{}');
    if (typeof p.bonusMoney === 'number') return true;
  } catch { /**/ }
  return false;
}

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

// ─── ProductCard ──────────────────────────────────────────────────────────────

type ProductCardProps = {
  media: React.ReactNode;
  title: string;
  badge?: string | null;
  price: number;
  description: string;
  action: React.ReactNode;
};

function ProductCard({ media, title, badge, price, description, action }: ProductCardProps) {
  return (
    <Card className="gap-4 overflow-hidden pt-0">
      {media}
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="truncate">{title}</span>
          <Badge variant="outline" className="tabular-nums">
            ${price}
          </Badge>
        </CardTitle>
        {badge ? (
          <CardDescription>
            <Badge variant="secondary">{badge}</Badge>
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
      </CardContent>
      <CardFooter>{action}</CardFooter>
    </Card>
  );
}

function PurchaseButton({
  onClick,
  disabled,
  isBuying,
  label,
  icon,
  unavailableLabel,
}: {
  onClick: () => void;
  disabled: boolean;
  isBuying: boolean;
  label: string;
  icon: React.ReactNode;
  unavailableLabel: string | null;
}) {
  return (
    <Button onClick={onClick} disabled={disabled} className="w-full">
      {isBuying ? (
        <>
          <Spinner /> Achat…
        </>
      ) : unavailableLabel ? (
        unavailableLabel
      ) : (
        <>
          {icon} {label}
        </>
      )}
    </Button>
  );
}

function ProductPlaceholder({ icon }: { icon: React.ReactNode }) {
  return (
    <AspectRatio ratio={16 / 9} className="flex items-center justify-center bg-muted text-muted-foreground [&_svg]:size-10">
      {icon}
    </AspectRatio>
  );
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
  const isClanUpgrade =
    isClanTagUnlock ||
    isClanSlotUpgrade ||
    effectType === 'CLAN_GAME_MONEY_BOOST' ||
    effectType === 'CLAN_PROFILE_PICTURE' ||
    effectType === 'CLAN_BANNER';
  const isAlreadyPurchased =
    (isClanTagUnlock && !!clanStatus?.tagUnlocked) || (isClanSlotUpgrade && (clanStatus?.maxMembers ?? 0) >= 7);
  const canAfford = isClanUpgrade ? (clanStatus?.clanBankMoney ?? 0) >= item.price : (user?.money ?? 0) >= item.price;
  const skinUrl = getSkinImageUrl(item.effect);
  const isBuying = buyingItemId === item.id;
  const isOwnedSkin = isDoodleJumpSkin(item) && ownedSkinItemIds.has(item.id);

  const media = skinUrl ? (
    <DoodleJumpSkinPreview skinImageUrl={skinUrl} />
  ) : item.imageUrl ? (
    <AspectRatio ratio={16 / 9}>
      <img src={resolveImageUrl(item.imageUrl)} alt={item.name} className="size-full object-cover" />
    </AspectRatio>
  ) : (
    <ProductPlaceholder icon={<Package />} />
  );

  return (
    <ProductCard
      media={media}
      title={item.name}
      badge={getEffectLabel(item.effect)}
      price={item.price}
      description={item.description}
      action={
        <PurchaseButton
          onClick={() => onPurchase(item)}
          disabled={!canAfford || isBuying || isOwnedSkin || isAlreadyPurchased}
          isBuying={isBuying}
          label="Acheter"
          icon={<ShoppingCart />}
          unavailableLabel={isAlreadyPurchased ? 'Déjà acheté' : isOwnedSkin ? 'Déjà possédé' : !canAfford ? 'Solde insuffisant' : null}
        />
      }
    />
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
    <ProductCard
      media={skinUrl ? <DoodleJumpSkinPreview skinImageUrl={skinUrl} /> : <ProductPlaceholder icon={<Gamepad2 />} />}
      title={item.name}
      price={item.price}
      description={item.description}
      action={
        <PurchaseButton
          onClick={() => onPurchase(item)}
          disabled={!canAfford || isBuying || isOwnedSkin}
          isBuying={isBuying}
          label="Débloquer"
          icon={<Gamepad2 />}
          unavailableLabel={isOwnedSkin ? 'Déjà possédé' : !canAfford ? 'Solde insuffisant' : null}
        />
      }
    />
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <Separator className="flex-1" />
      {aside}
    </div>
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

  const renderGrid = (skins: ShopItem[], adEvery: number, adKeyPrefix: string) => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {skins.flatMap((item, i) => {
        const el = (
          <DjSkinCard
            key={item.id}
            item={item}
            user={user}
            buyingItemId={buyingItemId}
            ownedSkinItemIds={ownedSkinItemIds}
            onPurchase={onPurchase}
          />
        );
        const adIdx = Math.floor(i / adEvery);
        if ((i + 1) % adEvery === 0 && adIdx < cardAds.length) {
          return [el, <AdCard key={`${adKeyPrefix}-${i}`} ad={cardAds[adIdx]!} />];
        }
        return [el];
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-80" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {hasRotating ? (
        <section className="flex flex-col gap-4">
          <SectionHeading
            title="Apparences du jour"
            aside={
              countdown ? (
                <Badge variant="outline">
                  <Timer />
                  Renouvellement dans {countdown}
                  <RotateCcw />
                </Badge>
              ) : null
            }
          />
          {renderGrid(rotatingSkins, 3, 'dj-rot-ad')}
        </section>
      ) : null}

      {hasStatic ? (
        <section className="flex flex-col gap-4">
          <SectionHeading title="Apparences permanentes" aside={<Badge variant="secondary">Toujours disponibles</Badge>} />
          {renderGrid(staticSkins, 6, 'dj-static-ad')}
        </section>
      ) : null}
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

  // Exclude DJ skins and craftable items from the main grid
  const nonDjItems = useMemo(() =>
    items.filter(item => {
      if (item.expiresAt && new Date(item.expiresAt) < new Date()) return false;
      if (parseEffectType(item.effect) === 'DOODLE_JUMP_SKIN') return false;
      if (isCraftableItem(item)) return false;
      return true;
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

  const renderItemGrid = (list: ShopItem[], adKeyPrefix: string) => (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {list.flatMap((item, i) => {
        const el = (
          <ShopCard
            key={item.id}
            item={item}
            user={user}
            buyingItemId={buyingItemId}
            ownedSkinItemIds={ownedSkinItemIds}
            clanStatus={clanStatus}
            onPurchase={handlePurchase}
          />
        );
        if ((i + 1) % 6 === 0 && effectiveCardAds.length > 0) {
          return [el, <AdCard key={`${adKeyPrefix}-${i}`} ad={effectiveCardAds[Math.floor(i / 6) % effectiveCardAds.length]!} />];
        }
        return [el];
      })}
    </div>
  );

  const doodleSection = (
    <DoodleJumpShopSection
      user={user}
      buyingItemId={buyingItemId}
      ownedSkinItemIds={ownedSkinItemIds}
      onPurchase={handlePurchase}
      cardAds={effectiveCardAds}
    />
  );

  return (
    <PageShell>
      <PageHeader title="Boutique" description="Cosmétiques, objets et améliorations à acheter avec votre argent." />

      <Alert>
        <ShoppingBasket />
        <AlertTitle>Jus, AdBlock et items fonctionnels</AlertTitle>
        <AlertDescription>
          <span>
            Ils sont désormais craftés par des entreprises et vendus sur le Marché des Items, dans l&apos;onglet Salle de marché de
            votre page You.
          </span>
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link to="/you?tab=salle-de-marche">Ouvrir le Marché des Items</Link>
          </Button>
        </AlertDescription>
      </Alert>

      <Tabs value={filter} onValueChange={setFilter} className="gap-6">
        <TabsList className="h-auto flex-wrap justify-start">
          {VIRTUAL_FILTERS.map((entry) => (
            <TabsTrigger key={entry.value} value={entry.value}>
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-80" />
            ))}
          </div>
        ) : (
          <>
            <TabsContent value="ALL" className="flex flex-col gap-8">
              {doodleSection}
              {sections.map((section) => (
                <section key={section.id} className="flex flex-col gap-4">
                  <SectionHeading title={section.label} aside={<Badge variant="secondary">{section.items.length}</Badge>} />
                  {renderItemGrid(section.items, `shop-ad-${section.id}`)}
                </section>
              ))}
            </TabsContent>

            <TabsContent value="DOODLE_JUMP" className="flex flex-col gap-8">
              {doodleSection}
            </TabsContent>

            {visibleCategories.map((category) => {
              const categoryItems = nonDjItems.filter((item) => item.type === category.id);

              return (
                <TabsContent key={category.id} value={category.id} className="flex flex-col gap-8">
                  {categoryItems.length === 0 ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Package />
                        </EmptyMedia>
                        <EmptyTitle>Aucun objet</EmptyTitle>
                        <EmptyDescription>Aucun objet dans cette catégorie.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    renderItemGrid(categoryItems, `cat-ad-${category.id}`)
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

import { useEffect, useMemo, useState } from 'react';
import { Award, Camera, LayoutGrid, List, Package, Palette, Search, ShoppingBag, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { type Ad, type BusinessPurchasedItem, adsApi, marketplaceApi, uploadUserImage, youApi } from '../services/api';
import { AdCard } from '@/components/ads/AdCard';
import { AdBanner } from '@/components/ads/AdBanner';
import { BadgeIcon } from '@/components/badges/BadgeIcon';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ImagePicker } from '@/components/ui/image-picker';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn, humanizeUiLabel } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { prepareImageUploadPayload } from '@/lib/image-upload';

interface UserItem {
  id: string;
  quantity: number;
  acquiredAt: string;
  item: {
    id: string;
    name: string;
    description: string;
    type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';
    price: number;
    effect?: string;
    imageUrl?: string;
  };
}

interface ItemEffect {
  type: string;
  value?: string;
  skinImageUrl?: string;
}

type ImageEffectType = 'PROFILE_PICTURE' | 'PROFILE_BANNER';
type InventoryViewMode = 'list' | 'grid';
type InventorySortMode = 'recent' | 'name' | 'quantity-desc' | 'quantity-asc';

const typeLabels: Record<string, string> = {
  CONSUMABLE: 'Objet',
  COSMETIC: 'Cosmétique',
  UPGRADE: 'Amélioration',
};

const INVENTORY_TYPE_ORDER = ['COSMETIC', 'CONSUMABLE', 'UPGRADE'] as const;

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ffffff', '#a1a1aa', '#71717a',
];

const BADGE_BG_PRESETS = [
  '#374151', '#1e3a5f', '#4c1d95', '#7c2d12', '#14532d',
  '#1f2937', '#0f172a', '#3b0764', '#431407', '#052e16',
];

const BADGE_BORDER_PRESETS = [
  '#6b7280', '#3b82f6', '#a855f7', '#f97316', '#22c55e',
  '#fbbf24', '#ef4444', '#06b6d4', '#ec4899', '#ffffff',
];

const RARITY_OPTIONS = [
  { value: 'common', label: 'Commun' },
  { value: 'uncommon', label: 'Peu commun' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Épique' },
  { value: 'legendary', label: 'Légendaire' },
];

const INVENTORY_SORT_OPTIONS: Array<{ value: InventorySortMode; label: string }> = [
  { value: 'recent', label: 'Plus récents' },
  { value: 'name', label: 'Nom (A-Z)' },
  { value: 'quantity-desc', label: 'Quantité (max-min)' },
  { value: 'quantity-asc', label: 'Quantité (min-max)' },
];

export default function Inventory() {
  const { user, refreshUser } = useAuth();
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [using, setUsing] = useState<string | null>(null);
  // Clan tag unlock state
  const [clanTagDialogOpen, setClanTagDialogOpen] = useState(false);
  const [clanTagItem, setClanTagItem] = useState<UserItem | null>(null);
  const [clanTagError, setClanTagError] = useState<string | null>(null);

  // Color picker state
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [colorPickerItem, setColorPickerItem] = useState<UserItem | null>(null);
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [customColor, setCustomColor] = useState('#ffffff');

  // Image upload state
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageItem, setImageItem] = useState<UserItem | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageEffectType, setImageEffectType] = useState<ImageEffectType | null>(null);

  // Custom badge state
  const [customBadgeDialogOpen, setCustomBadgeDialogOpen] = useState(false);
  const [customBadgeItem, setCustomBadgeItem] = useState<UserItem | null>(null);
  const [customBadgeName, setCustomBadgeName] = useState('');
  const [customBadgeDesc, setCustomBadgeDesc] = useState('');
  const [customBadgeIcon, setCustomBadgeIcon] = useState('⭐');
  const [customBadgeBg, setCustomBadgeBg] = useState('#374151');
  const [customBadgeBorder, setCustomBadgeBorder] = useState('#6b7280');
  const [customBadgeRarity, setCustomBadgeRarity] = useState('common');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<InventorySortMode>('recent');
  const [viewMode, setViewMode] = useState<InventoryViewMode>('list');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [cardAds, setCardAds] = useState<Ad[]>([]);
  const [bannerAd, setBannerAd] = useState<Ad | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [mainTab, setMainTab] = useState<'inventory' | 'purchases'>('inventory');
  const [purchases, setPurchases] = useState<BusinessPurchasedItem[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchInventory();
    }
  }, [user]);

  useEffect(() => {
    void adsApi.listPublic().then((res) => setCardAds(res.data.ads)).catch(() => {});
    void adsApi.listPublic({ limit: 1 }).then((res) => setBannerAd(res.data.ads[0] ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (mainTab === 'purchases' && purchases.length === 0) {
      setPurchasesLoading(true);
      youApi.getMyBusinessPurchases().then((res) => setPurchases(res.data.items)).catch(() => {}).finally(() => setPurchasesLoading(false));
    }
  }, [mainTab]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await marketplaceApi.getInventory(user!.id);
      setItems(((response.data.items || []) as Array<UserItem | { item: { type: string } }>).filter((entry) => entry.item.type !== 'GIFT') as UserItem[]);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseEffect = (effectStr?: string): ItemEffect | null => {
    if (!effectStr) return null;
    try {
      return JSON.parse(effectStr);
    } catch {
      return null;
    }
  };

  const handleUseItem = async (userItem: UserItem) => {
    if (using) return;
    
    const effect = parseEffect(userItem.item.effect);
    
    // Handle upgrade items
    if (userItem.item.type === 'UPGRADE') {
      if (effect?.type === 'CLAN_TAG_UNLOCK') {
        setClanTagItem(userItem);
        setClanTagDialogOpen(true);
        return;
      }
      // AWARD_BADGE and other upgrades fall through to the generic use flow below
    }

    // Custom badge request
    if (effect?.type === 'CUSTOM_BADGE') {
      setCustomBadgeItem(userItem);
      setCustomBadgeName('');
      setCustomBadgeDesc('');
      setCustomBadgeIcon('⭐');
      setCustomBadgeBg('#374151');
      setCustomBadgeBorder('#6b7280');
      setCustomBadgeRarity('common');
      setCustomBadgeDialogOpen(true);
      return;
    }

    // Handle cosmetic items that need user input
    if (userItem.item.type === 'COSMETIC' && effect) {
      if (effect.type === 'USERNAME_COLOR') {
        setColorPickerItem(userItem);
        setSelectedColor('#ffffff');
        setCustomColor('#ffffff');
        setColorDialogOpen(true);
        return;
      }
      if (effect.type === 'PROFILE_PICTURE' || effect.type === 'PROFILE_BANNER') {
        setImageItem(userItem);
        setImageUrl('');
        setImageEffectType(effect.type);
        setImageDialogOpen(true);
        return;
      }
    }
    
    // Regular consumable items
    try {
      setUsing(userItem.id);
      
      const response = await marketplaceApi.useItem(userItem.id);
      await refreshUser();
      await fetchInventory();
      
      let effectText = `${userItem.item.name} utilisé`;
      if (response.data.effect) {
        if (response.data.effect.bonusAura) {
          effectText += ` • +${response.data.effect.bonusAura} aura`;
        }
        if (response.data.effect.bonusMoney) {
          effectText += ` • +${response.data.effect.bonusMoney} €`;
        }
        if (response.data.effect.type === 'CLAN_SLOT_UPGRADE') {
          effectText += ' • +1 slot clan (jusqu\'à 7 membres)';
        }
        if (response.data.effect.type === 'AWARD_BADGE' && response.data.effect.badgeName) {
          effectText += ` • Badge "${response.data.effect.badgeName}" obtenu`;
        }
        if ((response.data.effect.type === 'YOU_ADBLOCK' || response.data.effect.type === 'GLOBAL_ADBLOCK') && response.data.effect.expiresAt) {
          effectText += ` • Adblock global jusqu'à ${new Date(response.data.effect.expiresAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
        }
      }
      
      toast.success(effectText);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Echec');
    } finally {
      setUsing(null);
    }
  };

  // Apply username color
  const applyUsernameColor = async () => {
    if (!colorPickerItem) return;
    
    try {
      setUsing(colorPickerItem.id);
      
      await marketplaceApi.useItem(colorPickerItem.id, { color: selectedColor });
      await refreshUser();
      await fetchInventory();
      
      toast.success('Couleur de pseudo appliquee', {
        description: selectedColor,
      });
      setColorDialogOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Echec');
    } finally {
      setUsing(null);
      setColorPickerItem(null);
    }
  };

  const uploadProfileImageFile = async (file: File): Promise<string> => {
    const { base64Data, mimeType } = await prepareImageUploadPayload(file);
    const res = await uploadUserImage({ base64Data, mimeType });
    return res.data.imageUrl;
  };

  // Apply profile picture
  const applyProfilePicture = async () => {
    if (!imageItem) return;
    
    try {
      setUsing(imageItem.id);

      if (!imageUrl.trim()) return;
      const finalUrl = imageUrl.trim();

      await marketplaceApi.useItem(imageItem.id, { imageUrl: finalUrl });
      await refreshUser();
      await fetchInventory();
      
      toast.success(imageEffectType === 'PROFILE_BANNER' ? 'Bannière de profil appliquee' : 'Photo de profil appliquee');
      setImageDialogOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Echec');
    } finally {
      setUsing(null);
      setImageItem(null);
      setImageEffectType(null);
    }
  };

  const applyClanTagUnlock = async () => {
    if (!clanTagItem) return;
    try {
      setUsing(clanTagItem.id);
      setClanTagError(null);
      await marketplaceApi.useItem(clanTagItem.id);
      await fetchInventory();
      toast.success('Tag de clan debloque !', {
        description: 'Configure-le ensuite dans les parametres du clan.',
      });
      setClanTagDialogOpen(false);
      setClanTagItem(null);
    } catch (error: any) {
      setClanTagError(error.response?.data?.error || 'Échec');
    } finally {
      setUsing(null);
    }
  };

  const submitCustomBadge = async () => {
    if (!customBadgeItem) return;
    if (!customBadgeName.trim() || !customBadgeDesc.trim()) {
      toast.error('Nom et description requis');
      return;
    }
    try {
      setUsing(customBadgeItem.id);
      await marketplaceApi.useItem(customBadgeItem.id, {
        name: customBadgeName.trim(),
        description: customBadgeDesc.trim(),
        icon: customBadgeIcon,
        backgroundColor: customBadgeBg,
        borderColor: customBadgeBorder,
        rarity: customBadgeRarity,
      });
      await fetchInventory();
      toast.success('Demande envoyée', {
        description: 'Les admins examineront ta demande de badge.',
      });
      setCustomBadgeDialogOpen(false);
      setCustomBadgeItem(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec');
    } finally {
      setUsing(null);
    }
  };

  const getEffectIcon = (effect: ItemEffect | null) => {
    if (!effect) return null;
    switch (effect.type) {
      case 'USERNAME_COLOR':
        return <Palette className="w-4 h-4" />;
      case 'PROFILE_PICTURE':
        return <Camera className="w-4 h-4" />;
      case 'PROFILE_BANNER':
        return <Camera className="w-4 h-4" />;
      case 'DOODLE_JUMP_SKIN':
        return <Package className="w-4 h-4" />;
      case 'CLAN_TAG_UNLOCK':
        return <Tag className="w-4 h-4" />;
      case 'AWARD_BADGE':
        return <Package className="w-4 h-4" />;
      case 'CUSTOM_BADGE':
        return <Award className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getEffectLabel = (effect: ItemEffect | null) => {
    if (!effect) return '';
    switch (effect.type) {
      case 'USERNAME_COLOR':
        return 'Couleur de pseudo';
      case 'PROFILE_PICTURE':
        return 'Photo de profil';
      case 'PROFILE_BANNER':
        return 'Bannière de profil';
      case 'DOODLE_JUMP_SKIN':
        return 'Apparence Doodle Jump';
      case 'CLAN_TAG_UNLOCK':
        return 'Tag de clan';
      case 'CLAN_SLOT_UPGRADE':
        return '+1 slot clan';
      case 'AWARD_BADGE':
        return 'Badge';
      case 'CUSTOM_BADGE':
        return 'Badge personnalisé';
      case 'BONUS_AURA':
        return `+${effect.value || '?'} aura`;
      case 'BONUS_MONEY':
        return `+${effect.value || '?'} €`;
      default:
      return humanizeUiLabel(effect.type);
    }
  };

  const availableTypes = useMemo(() => {
    return INVENTORY_TYPE_ORDER.filter((type) =>
      items.some((item) => item.item.type === type),
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((userItem) => {
      if (!query) return true;
      const searchable = [
        userItem.item.name,
        userItem.item.description,
        typeLabels[userItem.item.type] ?? userItem.item.type,
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [items, searchQuery]);

  const sortInventoryItems = (inventoryItems: UserItem[]) => {
    return [...inventoryItems].sort((a, b) => {
      switch (sortMode) {
        case 'name':
          return a.item.name.localeCompare(b.item.name, 'fr', { sensitivity: 'base' });
        case 'quantity-desc':
          return b.quantity - a.quantity;
        case 'quantity-asc':
          return a.quantity - b.quantity;
        case 'recent':
        default:
          return new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime();
      }
    });
  };

  const displayedItems = useMemo(() => {
    const scopedItems = filterType === 'ALL'
      ? filteredItems
      : filteredItems.filter((userItem) => userItem.item.type === filterType);

    return sortInventoryItems(scopedItems);
  }, [filteredItems, filterType, sortMode]);

  const groupedDisplayedItems = useMemo(() => {
    if (filterType !== 'ALL') return [];

    return availableTypes
      .map((type) => ({
        type,
        label: typeLabels[type],
        items: sortInventoryItems(
          filteredItems.filter((userItem) => userItem.item.type === type),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [availableTypes, filteredItems, filterType, sortMode]);

  const canUse = (userItem: UserItem) => {
    const effect = parseEffect(userItem.item.effect);
    return (
      userItem.item.type === 'CONSUMABLE' ||
      (userItem.item.type === 'COSMETIC' && effect?.type !== 'DOODLE_JUMP_SKIN') ||
      userItem.item.type === 'UPGRADE' ||
      effect?.type === 'CLAN_TAG_UNLOCK'
    );
  };

  const renderUseAction = (userItem: UserItem, fullWidth = false) => {
    const effect = parseEffect(userItem.item.effect);
    if (canUse(userItem)) {
      return (
        <Button
          onClick={() => handleUseItem(userItem)}
          disabled={using === userItem.id}
          variant="outline"
          size="sm"
          className={fullWidth ? 'w-full' : undefined}
        >
          {using === userItem.id ? <Spinner /> : 'Utiliser'}
        </Button>
      );
    }
    if (effect?.type === 'DOODLE_JUMP_SKIN') {
      return <span className="text-xs text-muted-foreground">Sélectionnable dans Doodle Jump</span>;
    }
    return null;
  };

  const getPreviewUrl = (userItem: UserItem) => {
    const effect = parseEffect(userItem.item.effect);
    return effect?.type === 'DOODLE_JUMP_SKIN' && effect.skinImageUrl ? effect.skinImageUrl : userItem.item.imageUrl;
  };

  const renderInventoryItem = (userItem: UserItem) => {
    const effect = parseEffect(userItem.item.effect);
    const effectIcon = getEffectIcon(effect);
    const effectLabel = getEffectLabel(effect);
    const previewImageUrl = getPreviewUrl(userItem);

    if (viewMode === 'list') {
      return (
        <Item key={userItem.id}>
          <ItemMedia variant={previewImageUrl ? 'image' : 'icon'}>
            {previewImageUrl ? <img src={resolveImageUrl(previewImageUrl)} alt={userItem.item.name} /> : <Package />}
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              {userItem.item.name}
              <Badge variant="secondary">{typeLabels[userItem.item.type]}</Badge>
              <Badge variant="outline">×{userItem.quantity}</Badge>
            </ItemTitle>
            <ItemDescription>{userItem.item.description}</ItemDescription>
            {effectLabel ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {effectIcon}
                {effectLabel}
              </span>
            ) : null}
          </ItemContent>
          <ItemActions>{renderUseAction(userItem)}</ItemActions>
        </Item>
      );
    }

    return (
      <Card key={userItem.id} className="gap-4 overflow-hidden pt-0">
        <AspectRatio ratio={16 / 9} className="flex items-center justify-center bg-muted">
          {previewImageUrl ? (
            <img src={resolveImageUrl(previewImageUrl)} alt={userItem.item.name} className="size-full object-cover" />
          ) : (
            <Package className="size-10 text-muted-foreground" />
          )}
        </AspectRatio>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="truncate">{userItem.item.name}</span>
            <Badge variant="outline">×{userItem.quantity}</Badge>
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{typeLabels[userItem.item.type]}</Badge>
            {effectLabel ? (
              <span className="flex items-center gap-1">
                {effectIcon}
                {effectLabel}
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="line-clamp-3 text-sm text-muted-foreground">{userItem.item.description}</p>
        </CardContent>
        <CardFooter>{renderUseAction(userItem, true)}</CardFooter>
      </Card>
    );
  };

  const renderItems = (list: UserItem[], adKeyPrefix: string) => {
    if (viewMode === 'list') {
      return (
        <Card className="py-2">
          <ItemGroup>
            {list.map((userItem, index) => (
              <div key={userItem.id}>
                {index > 0 ? <ItemSeparator /> : null}
                {renderInventoryItem(userItem)}
              </div>
            ))}
          </ItemGroup>
        </Card>
      );
    }

    const showAds = cardAds.length > 0 && !user?.hasAdblock;
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {showAds
          ? list.flatMap((item, i) => {
              const el = renderInventoryItem(item);
              return (i + 1) % 6 === 0
                ? [el, <AdCard key={`${adKeyPrefix}-${i}`} ad={cardAds[Math.floor(i / 6) % cardAds.length]!} />]
                : [el];
            })
          : list.map(renderInventoryItem)}
      </div>
    );
  };

  const swatchButton = (color: string, selected: boolean, onClick: () => void, label: string) => (
    <button
      key={color}
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn('size-6 rounded-full border-2 transition-transform hover:scale-110', selected ? 'border-foreground' : 'border-transparent')}
      style={{ backgroundColor: color }}
    />
  );

  if (loading) {
    return (
      <PageShell>
        <PageHeader />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader />

      <Tabs value={mainTab} onValueChange={(value) => setMainTab(value as 'inventory' | 'purchases')}>
        <TabsList>
          <TabsTrigger value="inventory">Inventaire</TabsTrigger>
          <TabsTrigger value="purchases">Achats</TabsTrigger>
        </TabsList>
      </Tabs>

      {mainTab === 'purchases' ? (
        purchasesLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : purchases.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShoppingBag />
              </EmptyMedia>
              <EmptyTitle>Aucun achat</EmptyTitle>
              <EmptyDescription>Aucun achat en boutique pour l&apos;instant.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card className="py-2">
            <ItemGroup>
              {purchases.map((purchase, index) => (
                <div key={purchase.id}>
                  {index > 0 ? <ItemSeparator /> : null}
                  <Item size="sm">
                    <ItemMedia variant={purchase.itemImageUrl ? 'image' : 'icon'}>
                      {purchase.itemImageUrl ? (
                        <img src={purchase.itemImageUrl} alt={purchase.itemLabel} />
                      ) : (
                        purchase.itemEmoji ?? <ShoppingBag />
                      )}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        {purchase.itemLabel}
                        {purchase.quantity > 1 ? <Badge variant="outline">×{purchase.quantity}</Badge> : null}
                      </ItemTitle>
                      <ItemDescription>
                        {purchase.businessName} · {purchase.price.toLocaleString('fr-FR')} money
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <span className="text-xs text-muted-foreground">{new Date(purchase.acquiredAt).toLocaleDateString('fr-FR')}</span>
                    </ItemActions>
                  </Item>
                </div>
              ))}
            </ItemGroup>
          </Card>
        )
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {availableTypes.length > 1 ? (
              <ToggleGroup type="single" variant="outline" value={filterType} onValueChange={(value) => value && setFilterType(value)} className="flex-wrap">
                <ToggleGroupItem value="ALL">Tous</ToggleGroupItem>
                {availableTypes.map((type) => (
                  <ToggleGroupItem key={type} value={type}>
                    {typeLabels[type]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : (
              <span />
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <InputGroup className="sm:w-64">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Rechercher un objet…" />
              </InputGroup>
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as InventorySortMode)}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="Trier" />
                </SelectTrigger>
                <SelectContent>
                  {INVENTORY_SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ToggleGroup type="single" variant="outline" value={viewMode} onValueChange={(value) => value && setViewMode(value as InventoryViewMode)}>
                <ToggleGroupItem value="list" aria-label="Vue liste">
                  <List />
                </ToggleGroupItem>
                <ToggleGroupItem value="grid" aria-label="Vue grille">
                  <LayoutGrid />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {items.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Package />
                </EmptyMedia>
                <EmptyTitle>Inventaire vide</EmptyTitle>
                <EmptyDescription>Achète des objets en boutique pour les retrouver ici.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : displayedItems.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Aucun résultat</EmptyTitle>
                <EmptyDescription>Aucun objet ne correspond à ta recherche.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : filterType === 'ALL' ? (
            <div className="flex flex-col gap-8">
              {groupedDisplayedItems.flatMap((section, sectionIdx) => {
                const sectionEl = (
                  <section key={section.type} className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-lg font-semibold">{section.label}</h2>
                      <Separator className="flex-1" />
                      <Badge variant="secondary">{section.items.length}</Badge>
                    </div>
                    {renderItems(section.items, `inv-ad-${sectionIdx}`)}
                  </section>
                );
                if (sectionIdx === 0 && bannerAd && !bannerDismissed && !user?.hasAdblock) {
                  return [sectionEl, <AdBanner key="inv-banner" ad={bannerAd} onDismiss={() => setBannerDismissed(true)} />];
                }
                return [sectionEl];
              })}
            </div>
          ) : (
            renderItems(displayedItems, 'inv-ad-filtered')
          )}
        </>
      )}

      {/* Couleur de pseudo */}
      <Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Choisir une couleur</DialogTitle>
            <DialogDescription>Sélectionne la couleur de ton pseudo dans le chat.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Item variant="outline" className="justify-center">
              <span className="text-lg font-semibold" style={{ color: selectedColor }}>
                {user?.username}
              </span>
            </Item>
            <Field>
              <FieldLabel>Couleurs prédéfinies</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) =>
                  swatchButton(color, selectedColor === color, () => {
                    setSelectedColor(color);
                    setCustomColor(color);
                  }, color)
                )}
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="custom-color-hex">Couleur personnalisée</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  aria-label="Sélecteur de couleur"
                  value={customColor}
                  onChange={(event) => {
                    setCustomColor(event.target.value);
                    setSelectedColor(event.target.value);
                  }}
                  className="size-9 cursor-pointer p-1"
                />
                <Input
                  id="custom-color-hex"
                  value={customColor}
                  onChange={(event) => {
                    setCustomColor(event.target.value);
                    if (/^#[0-9A-Fa-f]{6}$/.test(event.target.value)) setSelectedColor(event.target.value);
                  }}
                  placeholder="#ffffff"
                  className="flex-1 font-mono"
                />
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColorDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={applyUsernameColor} disabled={using !== null}>
              {using ? <Spinner /> : <Palette />}
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo / bannière de profil */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{imageEffectType === 'PROFILE_BANNER' ? 'Bannière de profil' : 'Photo de profil'}</DialogTitle>
            <DialogDescription>
              {imageEffectType === 'PROFILE_BANNER'
                ? 'Importe la bannière qui sera affichée en haut de ton profil joueur.'
                : 'Importe ta photo de profil qui sera affichée dans le chat.'}
            </DialogDescription>
          </DialogHeader>
          {imageUrl ? (
            <div className={cn('overflow-hidden border bg-muted', imageEffectType === 'PROFILE_BANNER' ? 'h-24 w-full rounded-xl' : 'mx-auto size-20 rounded-full')}>
              <img
                src={imageUrl}
                alt="Aperçu"
                className="size-full object-cover"
                onError={(event) => {
                  (event.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : null}
          <ImagePicker value={imageUrl} onChange={setImageUrl} uploadFn={uploadProfileImageFile} hidePreview />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImageDialogOpen(false);
                setImageEffectType(null);
                setImageItem(null);
                setImageUrl('');
              }}
            >
              Annuler
            </Button>
            <Button onClick={applyProfilePicture} disabled={using !== null || !imageUrl.trim()}>
              {using ? <Spinner /> : <Camera />}
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag de clan */}
      <AlertDialog
        open={clanTagDialogOpen}
        onOpenChange={(open) => {
          setClanTagDialogOpen(open);
          if (!open) {
            setClanTagItem(null);
            setClanTagError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Débloquer le tag de clan</AlertDialogTitle>
            <AlertDialogDescription>
              Cela débloquera le tag pour votre clan. Vous pourrez ensuite le personnaliser dans les paramètres du clan. Action irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {clanTagError ? (
            <Alert variant="destructive">
              <AlertDescription>{clanTagError}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={using !== null}
              onClick={(event) => {
                event.preventDefault();
                void applyClanTagUnlock();
              }}
            >
              {using ? <Spinner /> : <Tag />}
              Débloquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Badge personnalisé */}
      <Dialog
        open={customBadgeDialogOpen}
        onOpenChange={(open) => {
          setCustomBadgeDialogOpen(open);
          if (!open) setCustomBadgeItem(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un badge personnalisé</DialogTitle>
            <DialogDescription>Conçois ton badge. Un admin le validera avant qu&apos;il soit ajouté à ton profil.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <div className="flex justify-center py-2">
              <BadgeIcon
                badge={{
                  id: 'preview',
                  name: customBadgeName || 'Nom du badge',
                  description: customBadgeDesc || '',
                  backgroundType: 'solid',
                  backgroundColor: customBadgeBg,
                  icon: customBadgeIcon,
                  iconColor: '#ffffff',
                  borderColor: customBadgeBorder,
                  category: 'custom',
                  rarity: customBadgeRarity,
                }}
                size="lg"
              />
            </div>
            <Field>
              <FieldLabel htmlFor="badge-name">Nom</FieldLabel>
              <Input id="badge-name" value={customBadgeName} onChange={(event) => setCustomBadgeName(event.target.value)} placeholder="Nom du badge" maxLength={40} />
            </Field>
            <Field>
              <FieldLabel htmlFor="badge-description">Description</FieldLabel>
              <Textarea id="badge-description" value={customBadgeDesc} onChange={(event) => setCustomBadgeDesc(event.target.value)} placeholder="Description du badge" maxLength={120} rows={2} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="badge-icon">Icône (emoji)</FieldLabel>
                <Input id="badge-icon" value={customBadgeIcon} onChange={(event) => setCustomBadgeIcon(event.target.value)} placeholder="⭐" maxLength={4} />
              </Field>
              <Field>
                <FieldLabel htmlFor="badge-rarity">Rareté</FieldLabel>
                <Select value={customBadgeRarity} onValueChange={setCustomBadgeRarity}>
                  <SelectTrigger id="badge-rarity" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RARITY_OPTIONS.map((rarity) => (
                      <SelectItem key={rarity.value} value={rarity.value}>
                        {rarity.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel>Fond</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                {BADGE_BG_PRESETS.map((color) => swatchButton(color, customBadgeBg === color, () => setCustomBadgeBg(color), color))}
                <Input type="color" aria-label="Couleur de fond" value={customBadgeBg} onChange={(event) => setCustomBadgeBg(event.target.value)} className="h-7 w-9 cursor-pointer p-0.5" />
              </div>
            </Field>
            <Field>
              <FieldLabel>Bordure</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                {BADGE_BORDER_PRESETS.map((color) => swatchButton(color, customBadgeBorder === color, () => setCustomBadgeBorder(color), color))}
                <Input type="color" aria-label="Couleur de bordure" value={customBadgeBorder} onChange={(event) => setCustomBadgeBorder(event.target.value)} className="h-7 w-9 cursor-pointer p-0.5" />
              </div>
              <FieldDescription>Les couleurs sont validées par un administrateur avec le reste du badge.</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomBadgeDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submitCustomBadge} disabled={using !== null || !customBadgeName.trim() || !customBadgeDesc.trim()}>
              {using ? <Spinner /> : <Award />}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { type Ad, type BusinessPurchasedItem, adsApi, marketplaceApi, uploadUserImage, youApi } from '../services/api';
import { AdCard } from '@/components/ads/AdCard';
import { AdBanner } from '@/components/ads/AdBanner';
import { ImagePicker } from '@/components/ui/image-picker';
import { Loader2, Palette, Camera, Package, ShoppingBag, Tag, Award } from 'lucide-react';
import { cn, humanizeUiLabel } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BadgeIcon } from '@/components/badges/BadgeIcon';
import { Card, CardContent } from '@/components/ui/card';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { resolveImageUrl } from '@/lib/images';
import { prepareImageUploadPayload } from '@/lib/image-upload';
import { PageShell } from '@/components/layout/page-shell';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { ViewModeSwitcher } from '@/components/ui/view-mode-switcher';
import { GridSkeleton, ListSkeleton } from '@/components/ui/loading-skeletons';

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
    void adsApi.listPublic({ type: 'CARD' }).then((res) => setCardAds(res.data.ads)).catch(() => {});
    void adsApi.listPublic({ type: 'BANNER', limit: 1 }).then((res) => setBannerAd(res.data.ads[0] ?? null)).catch(() => {});
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
          effectText += ` • +$${response.data.effect.bonusMoney}`;
        }
        if (response.data.effect.type === 'CLAN_SLOT_UPGRADE') {
          effectText += ' • +1 slot clan (jusqu\'à 7 membres)';
        }
        if (response.data.effect.type === 'AWARD_BADGE' && response.data.effect.badgeName) {
          effectText += ` • Badge "${response.data.effect.badgeName}" obtenu`;
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
      
      toast.success(imageEffectType === 'PROFILE_BANNER' ? 'Banniere de profil appliquee' : 'Photo de profil appliquee');
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
        return 'Banniere de profil';
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
        return `+$${effect.value || '?'}`;
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

  const renderInventoryItem = (userItem: UserItem) => {
    const effect = parseEffect(userItem.item.effect);
    const effectIcon = getEffectIcon(effect);
    const effectLabel = getEffectLabel(effect);
    const previewImageUrl = effect?.type === 'DOODLE_JUMP_SKIN' && effect.skinImageUrl
      ? effect.skinImageUrl
      : userItem.item.imageUrl;
    const isDoodleJumpSkin = effect?.type === 'DOODLE_JUMP_SKIN';

    return (
      <div
        key={userItem.id}
        className={cn(
          viewMode === 'list'
            ? 'flex items-center justify-between py-6 px-6'
            : 'flex h-full flex-col justify-between gap-3 rounded-lg border border-border/40 p-4'
        )}
      >
        <div className={cn('flex gap-4 flex-1', viewMode === 'list' ? 'items-center' : 'items-start')}>
          {previewImageUrl ? (
            <img
              src={resolveImageUrl(previewImageUrl)}
              alt={userItem.item.name}
              className={cn('object-cover rounded shrink-0', viewMode === 'list' ? 'w-14 h-14' : 'w-16 h-16')}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className={cn('bg-muted/30 flex items-center justify-center rounded shrink-0', viewMode === 'list' ? 'w-14 h-14' : 'w-16 h-16')}>
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
          )}

          <div className="space-y-1 flex-1 min-w-0">
            <div className={cn('flex items-center gap-4', viewMode === 'grid' && 'flex-wrap gap-2')}>
              <h2 className={cn(TYPOGRAPHY.H5, "truncate")}>{userItem.item.name}</h2>
              <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground   shrink-0")}>
                {typeLabels[userItem.item.type]}
              </span>
              <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground shrink-0")}>
                ×{userItem.quantity}
              </span>
            </div>
            <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground", viewMode === 'list' ? 'max-w-md truncate' : 'line-clamp-3')}>
              {userItem.item.description}
            </p>
            {effectLabel && (
              <div className={cn("flex items-center gap-2", TYPOGRAPHY.XS, "text-muted-foreground/80")}>
                {effectIcon}
                <span>{effectLabel}</span>
              </div>
            )}
          </div>
        </div>

        {(userItem.item.type === 'CONSUMABLE' || (userItem.item.type === 'COSMETIC' && !isDoodleJumpSkin) || userItem.item.type === 'UPGRADE' || effect?.type === 'CLAN_TAG_UNLOCK') ? (
          <Button
            onClick={() => handleUseItem(userItem)}
            disabled={using === userItem.id}
            variant="outline"
            size="sm"
            className={cn('shrink-0', viewMode === 'list' ? 'ml-4' : 'w-full')}
          >
            {using === userItem.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Utiliser'
            )}
          </Button>
        ) : isDoodleJumpSkin ? (
          <span className={cn(TYPOGRAPHY.XS, "shrink-0 text-muted-foreground", viewMode === 'list' ? 'ml-4' : '')}>
            Sélectionnable dans Doodle Jump
          </span>
        ) : null}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="w-full space-y-8 px-4 pb-6 lg:px-6 lg:pb-8">
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
          <GridSkeleton cards={3} columns="sm:grid-cols-3" />
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
          <ListSkeleton rows={6} />
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <div className={SPACING.PAGE_CONTENT}>
      <div className={SPACING.SECTION_SPACING}>

        {/* Main tab: Inventaire / Achats */}
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'inventory' | 'purchases')}>
          <TabsList className="border-border/60 bg-muted/20">
            <TabsTrigger value="inventory" className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Inventaire
            </TabsTrigger>
            <TabsTrigger value="purchases" className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Achats
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mainTab === 'purchases' ? (
          purchasesLoading ? (
            <ListSkeleton />
          ) : purchases.length === 0 ? (
            <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>Aucun achat en boutique pour l'instant</p>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y divide-border/30">
                {purchases.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/30 text-xl overflow-hidden">
                      {p.itemImageUrl
                        ? <img src={p.itemImageUrl} className="h-10 w-10 object-cover" alt={p.itemLabel} />
                        : (p.itemEmoji ?? <ShoppingBag className="h-5 w-5 text-muted-foreground" />)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.itemLabel}</p>
                      <p className="text-xs text-muted-foreground">{p.businessName} · {p.price.toLocaleString('fr-FR')} money</p>
                    </div>
                    {p.quantity > 1 && (
                      <span className="text-xs font-semibold text-muted-foreground bg-muted/40 rounded-full px-2 py-0.5">×{p.quantity}</span>
                    )}
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(p.acquiredAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        ) : (
          <>

        {availableTypes.length > 1 && (
          <Tabs value={filterType} onValueChange={setFilterType}>
            <TabsList className="h-auto flex-wrap border-border/60 bg-muted/20">
              <TabsTrigger value="ALL" className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
                Tous
              </TabsTrigger>
              {availableTypes.map((t) => (
                <TabsTrigger key={t} value={t} className="text-muted-foreground data-[state=active]:border-border/60 data-[state=active]:bg-background data-[state=active]:text-foreground">
                  {typeLabels[t]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:max-w-sm">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un objet..."
              className="bg-transparent"
            />
          </div>

          <div className="flex w-full items-center justify-end gap-2 md:w-auto">
            <Select value={sortMode} onValueChange={(value) => setSortMode(value as InventorySortMode)}>
              <SelectTrigger className="w-full md:w-[210px]">
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

            <ViewModeSwitcher value={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>
            Inventaire vide
          </p>
        ) : displayedItems.length === 0 ? (
          <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>
            Aucun objet ne correspond à votre recherche
          </p>
        ) : (
          filterType === 'ALL' ? (
            <div className="space-y-8">
              {groupedDisplayedItems.flatMap((section, sectionIdx) => {
                const sectionEl = (
                  <div key={section.type} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">
                        {section.label}
                      </h2>
                      <div className="h-px flex-1 bg-border/70" />
                      <span className="text-xs text-muted-foreground">
                        {section.items.length}
                      </span>
                    </div>

                    <Card>
                      <CardContent className="p-0">
                        <div className={viewMode === 'list' ? 'divide-y divide-border/30' : 'p-4'}>
                          <div className={viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : ''}>
                            {viewMode === 'grid' && cardAds.length > 0
                              ? section.items.flatMap((item, i) => {
                                  const el = renderInventoryItem(item);
                                  if ((i + 1) % 6 === 0) {
                                    return [el, <AdCard key={`inv-ad-${sectionIdx}-${i}`} ad={cardAds[Math.floor(i / 6) % cardAds.length]!} />];
                                  }
                                  return [el];
                                })
                              : section.items.map(renderInventoryItem)
                            }
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
                if (sectionIdx === 0 && bannerAd && !bannerDismissed) {
                  return [sectionEl, <AdBanner key="inv-banner" ad={bannerAd} onDismiss={() => setBannerDismissed(true)} />];
                }
                return [sectionEl];
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className={viewMode === 'list' ? 'divide-y divide-border/30' : 'p-4'}>
                  <div className={viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : ''}>
                    {displayedItems.map(renderInventoryItem)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        )}
        </>
        )}
      </div>

      {/* Color Picker Dialog */}
      <Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={cn(TYPOGRAPHY.H5, "flex items-center gap-2")}>
              <Palette className="w-5 h-5" />
              Choisir une couleur
            </DialogTitle>
            <DialogDescription>
              Sélectionnez la couleur de votre pseudo dans le chat.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Color preview */}
            <div className="flex items-center justify-center p-4 bg-muted/30 rounded">
              <span 
                className={TYPOGRAPHY.H5}
                style={{ color: selectedColor }}
              >
                {user?.username}
              </span>
            </div>

            {/* Preset colors */}
            <div className="grid grid-cols-10 gap-2">
              {PRESET_COLORS.map((color) => (
                <Button
                  key={color}
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedColor(color);
                    setCustomColor(color);
                  }}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 p-0",
                    selectedColor === color ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* Custom color input */}
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  setSelectedColor(e.target.value);
                }}
                className="h-10 w-10 cursor-pointer p-1"
              />
              <Input
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    setSelectedColor(e.target.value);
                  }
                }}
                placeholder="#ffffff"
                className="flex-1 bg-transparent font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setColorDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={applyUsernameColor}
              disabled={using !== null}
            >
              {using ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Picture Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={cn(TYPOGRAPHY.H5, "flex items-center gap-2")}>
              <Camera className="w-5 h-5" />
              {imageEffectType === 'PROFILE_BANNER' ? 'Banniere de profil' : 'Photo de profil'}
            </DialogTitle>
            <DialogDescription>
              {imageEffectType === 'PROFILE_BANNER'
                ? 'Importez la banniere qui sera affichee en haut de votre profil joueur.'
                : 'Importez votre photo de profil qui sera affichee dans le chat.'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Preview */}
            {imageUrl && (
              <div className="flex justify-center">
                <div className={cn(
                  "overflow-hidden border-2 border-border bg-muted/20",
                  imageEffectType === 'PROFILE_BANNER' ? "h-24 w-full rounded-2xl" : "w-20 h-20 rounded-full"
                )}>
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}

            <ImagePicker
              value={imageUrl}
              onChange={setImageUrl}
              uploadFn={uploadProfileImageFile}
              hidePreview
            />
          </div>

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
            <Button 
              onClick={applyProfilePicture}
              disabled={
                using !== null ||
                !imageUrl.trim()
              }
            >
              {using ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clan Tag Unlock Dialog */}
      <Dialog open={clanTagDialogOpen} onOpenChange={(open) => {
        setClanTagDialogOpen(open);
        if (!open) { setClanTagItem(null); setClanTagError(null); }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={cn(TYPOGRAPHY.H5, "flex items-center gap-2")}>
              <Tag className="w-5 h-5" />
              Débloquer le tag de clan
            </DialogTitle>
            <DialogDescription>
              Cela débloquera le tag pour ton clan. Tu pourras ensuite le personnaliser dans les paramètres du clan. Action irréversible.
            </DialogDescription>
          </DialogHeader>
          {clanTagError && (
            <p className="text-sm text-destructive px-1">{clanTagError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setClanTagDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={applyClanTagUnlock} disabled={using !== null}>
              {using ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Débloquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Custom Badge Dialog */}
      <Dialog open={customBadgeDialogOpen} onOpenChange={(open) => {
        setCustomBadgeDialogOpen(open);
        if (!open) setCustomBadgeItem(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={cn(TYPOGRAPHY.H5, "flex items-center gap-2")}>
              <Award className="w-5 h-5" />
              Créer un badge personnalisé
            </DialogTitle>
            <DialogDescription>
              Conçois ton badge. Un admin le validera avant qu'il soit ajouté à ton profil.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {/* Live preview */}
            <div className="flex justify-center py-2">
              <BadgeIcon badge={{
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
              }} size="lg" />
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className={cn(TYPOGRAPHY.XS, "text-muted-foreground uppercase tracking-wide")}>Nom</label>
              <Input
                value={customBadgeName}
                onChange={(e) => setCustomBadgeName(e.target.value)}
                placeholder="Nom du badge"
                maxLength={40}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className={cn(TYPOGRAPHY.XS, "text-muted-foreground uppercase tracking-wide")}>Description</label>
              <Textarea
                value={customBadgeDesc}
                onChange={(e) => setCustomBadgeDesc(e.target.value)}
                placeholder="Description du badge"
                maxLength={120}
                rows={2}
              />
            </div>

            {/* Icon + Rarity row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={cn(TYPOGRAPHY.XS, "text-muted-foreground uppercase tracking-wide")}>Icône (emoji)</label>
                <Input
                  value={customBadgeIcon}
                  onChange={(e) => setCustomBadgeIcon(e.target.value)}
                  placeholder="⭐"
                  maxLength={4}
                />
              </div>
              <div className="space-y-1.5">
                <label className={cn(TYPOGRAPHY.XS, "text-muted-foreground uppercase tracking-wide")}>Rareté</label>
                <Select value={customBadgeRarity} onValueChange={setCustomBadgeRarity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RARITY_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Background color */}
            <div className="space-y-1.5">
              <label className={cn(TYPOGRAPHY.XS, "text-muted-foreground uppercase tracking-wide")}>Fond</label>
              <div className="flex flex-wrap gap-2">
                {BADGE_BG_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCustomBadgeBg(c)}
                    className={cn(
                      "w-6 h-6 rounded border-2 transition-transform hover:scale-110",
                      customBadgeBg === c ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <Input
                  type="color"
                  value={customBadgeBg}
                  onChange={(e) => setCustomBadgeBg(e.target.value)}
                  className="w-8 h-6 p-0.5 cursor-pointer"
                />
              </div>
            </div>

            {/* Border color */}
            <div className="space-y-1.5">
              <label className={cn(TYPOGRAPHY.XS, "text-muted-foreground uppercase tracking-wide")}>Bordure</label>
              <div className="flex flex-wrap gap-2">
                {BADGE_BORDER_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCustomBadgeBorder(c)}
                    className={cn(
                      "w-6 h-6 rounded border-2 transition-transform hover:scale-110",
                      customBadgeBorder === c ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <Input
                  type="color"
                  value={customBadgeBorder}
                  onChange={(e) => setCustomBadgeBorder(e.target.value)}
                  className="w-8 h-6 p-0.5 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomBadgeDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={submitCustomBadge}
              disabled={using !== null || !customBadgeName.trim() || !customBadgeDesc.trim()}
            >
              {using ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PageShell>
  );
}

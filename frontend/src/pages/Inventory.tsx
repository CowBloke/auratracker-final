import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi, uploadUserImage } from '../services/api';
import { ImagePicker } from '@/components/ui/image-picker';
import { Loader2, Palette, Camera, Package, Tag, Award } from 'lucide-react';
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
import { PageShell } from '@/components/layout/page-shell';
import { toast } from 'sonner';

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

const typeLabels: Record<string, string> = {
  CONSUMABLE: 'Consommable',
  COSMETIC: 'Cosmétique',
  UPGRADE: 'Amélioration',
};

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

  useEffect(() => {
    if (user) {
      fetchInventory();
    }
  }, [user]);

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
          effectText += ' • +1 slot clan';
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
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = typeof reader.result === 'string' ? reader.result : '';
        const payload = raw.includes(',') ? raw.split(',')[1] : '';
        if (!payload) reject(new Error('Invalid file'));
        else resolve(payload);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await uploadUserImage({ base64Data, mimeType: file.type });
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
        return 'Skin Doodle Jump';
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

  if (loading) {
    return (
      <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <div className={SPACING.PAGE_CONTENT}>
      <div className={SPACING.SECTION_SPACING}>

        {/* Items */}
        {items.length === 0 ? (
          <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>
            Inventaire vide
          </p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border/30">
                {items.map((userItem) => {
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
                      className="flex items-center justify-between py-6 px-6"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        {/* Item Image */}
                        {previewImageUrl ? (
                          <img 
                            src={resolveImageUrl(previewImageUrl)} 
                            alt={userItem.item.name}
                            className="w-14 h-14 object-cover rounded shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-14 h-14 bg-muted/30 flex items-center justify-center rounded shrink-0">
                            <Package className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-4">
                            <h2 className={cn(TYPOGRAPHY.H5, "truncate")}>{userItem.item.name}</h2>
                            <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground   shrink-0")}>
                              {typeLabels[userItem.item.type]}
                            </span>
                            <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground shrink-0")}>
                              ×{userItem.quantity}
                            </span>
                          </div>
                          <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground max-w-md truncate")}>
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
                          className="ml-4 shrink-0"
                        >
                          {using === userItem.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Utiliser'
                          )}
                        </Button>
                      ) : isDoodleJumpSkin ? (
                        <span className={cn(TYPOGRAPHY.XS, "ml-4 shrink-0 text-muted-foreground")}>
                          Sélectionnable dans Doodle Jump
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
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

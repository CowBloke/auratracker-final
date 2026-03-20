import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi, uploadUserImage } from '../services/api';
import { ImagePicker } from '@/components/ui/image-picker';
import { Loader2, Palette, Camera, Package, Tag } from 'lucide-react';
import { cn, humanizeUiLabel } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
    type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE' | 'GIFT';
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

const typeLabels: Record<string, string> = {
  CONSUMABLE: 'Consommable',
  COSMETIC: 'Cosmétique',
  UPGRADE: 'Amélioration',
  GIFT: 'Cadeau',
};

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', 
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ffffff', '#a1a1aa', '#71717a',
];

export default function Inventory() {
  const { user, refreshUser } = useAuth();
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [using, setUsing] = useState<string | null>(null);
  const [selling, setSelling] = useState<string | null>(null);
  const [chucking, setChucking] = useState<string | null>(null);

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

  useEffect(() => {
    if (user) {
      fetchInventory();
    }
  }, [user]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await marketplaceApi.getInventory(user!.id);
      setItems((response.data.items || []) as UserItem[]);
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

    // Handle cosmetic items that need user input
    if (userItem.item.type === 'COSMETIC' && effect) {
      if (effect.type === 'USERNAME_COLOR') {
        setColorPickerItem(userItem);
        setSelectedColor('#ffffff');
        setCustomColor('#ffffff');
        setColorDialogOpen(true);
        return;
      }
      if (effect.type === 'PROFILE_PICTURE') {
        setImageItem(userItem);
        setImageUrl('');
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

  const handleSellGiftItem = async (userItem: UserItem) => {
    if (selling) return;
    setSelling(userItem.id);
    try {
      const res = await marketplaceApi.sellGiftItem(userItem.id);
      await fetchInventory();
      await refreshUser();
      toast.success('Objet vendu', {
        description: `Tu as recupere $${res.data.moneyEarned}.`,
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Echec');
    } finally {
      setSelling(null);
    }
  };

  const handleChuckGiftItem = async (userItem: UserItem) => {
    if (chucking) return;
    setChucking(userItem.id);
    try {
      await marketplaceApi.chuckGiftItem(userItem.id);
      await fetchInventory();
      toast.success('Objet jete', {
        description: `${userItem.item.name} a ete retire de ton inventaire.`,
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Echec');
    } finally {
      setChucking(null);
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
      
      toast.success('Photo de profil appliquee');
      setImageDialogOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Echec');
    } finally {
      setUsing(null);
      setImageItem(null);
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

  const getEffectIcon = (effect: ItemEffect | null) => {
    if (!effect) return null;
    switch (effect.type) {
      case 'USERNAME_COLOR':
        return <Palette className="w-4 h-4" />;
      case 'PROFILE_PICTURE':
        return <Camera className="w-4 h-4" />;
      case 'DOODLE_JUMP_SKIN':
        return <Package className="w-4 h-4" />;
      case 'CLAN_TAG_UNLOCK':
        return <Tag className="w-4 h-4" />;
      case 'AWARD_BADGE':
        return <Package className="w-4 h-4" />;
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
      case 'DOODLE_JUMP_SKIN':
        return 'Skin Doodle Jump';
      case 'CLAN_TAG_UNLOCK':
        return 'Tag de clan';
      case 'AWARD_BADGE':
        return 'Badge';
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
                      
                      {userItem.item.type === 'GIFT' ? (
                        <div className="flex gap-2 ml-4 shrink-0">
                          <Button
                            onClick={() => handleSellGiftItem(userItem)}
                            disabled={selling === userItem.id || chucking === userItem.id}
                            variant="outline"
                            size="sm"
                          >
                            {selling === userItem.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              `Vendre ($${Math.floor(userItem.item.price / 2)})`
                            )}
                          </Button>
                          <Button
                            onClick={() => handleChuckGiftItem(userItem)}
                            disabled={selling === userItem.id || chucking === userItem.id}
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            {chucking === userItem.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Jeter'
                            )}
                          </Button>
                        </div>
                      ) : (userItem.item.type === 'CONSUMABLE' || (userItem.item.type === 'COSMETIC' && !isDoodleJumpSkin) || userItem.item.type === 'UPGRADE') ? (
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
              Photo de profil
            </DialogTitle>
            <DialogDescription>
              Importez votre photo de profil qui sera affichée dans le chat.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Preview */}
            {imageUrl && (
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border">
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
            <Button variant="outline" onClick={() => setImageDialogOpen(false)}>
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
      </div>
    </PageShell>
  );
}

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi } from '../services/api';
import { Loader2, Palette, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface UserItem {
  id: string;
  quantity: number;
  acquiredAt: string;
  item: {
    id: string;
    name: string;
    description: string;
    type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';
    effect?: string;
    imageUrl?: string;
  };
}

interface ItemEffect {
  type: string;
  value?: string;
}

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

export default function Inventory() {
  const { user, refreshUser } = useAuth();
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [using, setUsing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      setItems(response.data.items);
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
      setMessage(null);
      
      const response = await marketplaceApi.useItem(userItem.id);
      await refreshUser();
      await fetchInventory();
      
      let effectText = `${userItem.item.name} utilisé`;
      if (response.data.effect) {
        if (response.data.effect.bonusAura) {
          effectText += ` → +${response.data.effect.bonusAura} aura`;
        }
        if (response.data.effect.bonusMoney) {
          effectText += ` → +$${response.data.effect.bonusMoney}`;
        }
      }
      
      setMessage({ type: 'success', text: effectText });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec',
      });
    } finally {
      setUsing(null);
    }
  };

  // Apply username color
  const applyUsernameColor = async () => {
    if (!colorPickerItem) return;
    
    try {
      setUsing(colorPickerItem.id);
      setMessage(null);
      
      await marketplaceApi.useItem(colorPickerItem.id, { color: selectedColor });
      await refreshUser();
      await fetchInventory();
      
      setMessage({ type: 'success', text: `Couleur de pseudo appliquée: ${selectedColor}` });
      setTimeout(() => setMessage(null), 3000);
      setColorDialogOpen(false);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec',
      });
    } finally {
      setUsing(null);
      setColorPickerItem(null);
    }
  };

  // Apply profile picture
  const applyProfilePicture = async () => {
    if (!imageItem || !imageUrl.trim()) return;
    
    try {
      setUsing(imageItem.id);
      setMessage(null);
      
      await marketplaceApi.useItem(imageItem.id, { imageUrl: imageUrl.trim() });
      await refreshUser();
      await fetchInventory();
      
      setMessage({ type: 'success', text: 'Photo de profil appliquée' });
      setTimeout(() => setMessage(null), 3000);
      setImageDialogOpen(false);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec',
      });
    } finally {
      setUsing(null);
      setImageItem(null);
    }
  };

  const getEffectIcon = (effect: ItemEffect | null) => {
    if (!effect) return null;
    switch (effect.type) {
      case 'USERNAME_COLOR':
        return <Palette className="w-4 h-4" />;
      case 'PROFILE_PICTURE':
        return <Camera className="w-4 h-4" />;
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
      case 'BONUS_AURA':
        return `+${effect.value || '?'} aura`;
      case 'BONUS_MONEY':
        return `+$${effect.value || '?'}`;
      default:
        return effect.type;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Objets
            </p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Inventaire
            </h1>
          </div>
          <div className="text-right text-sm text-muted-foreground tabular-nums">
            {items.length} objet{items.length !== 1 ? 's' : ''}
          </div>
        </div>
      </header>

      {/* Message */}
      {message && (
        <p className={cn(
          "text-sm",
          message.type === 'success' ? 'text-foreground' : 'text-destructive'
        )}>
          {message.text}
        </p>
      )}

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Items */}
      {items.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          Inventaire vide
        </p>
      ) : (
        <div className="space-y-0">
          {items.map((userItem) => {
            const effect = parseEffect(userItem.item.effect);
            const effectIcon = getEffectIcon(effect);
            const effectLabel = getEffectLabel(effect);
            
            return (
              <div
                key={userItem.id}
                className="flex items-center justify-between py-6 border-b border-border/30 last:border-0"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-4">
                    <h2 className="text-lg font-medium">{userItem.item.name}</h2>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      {typeLabels[userItem.item.type]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ×{userItem.quantity}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-md">
                    {userItem.item.description}
                  </p>
                  {effectLabel && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
                      {effectIcon}
                      <span>{effectLabel}</span>
                    </div>
                  )}
                </div>
                
                {(userItem.item.type === 'CONSUMABLE' || userItem.item.type === 'COSMETIC') && (
                  <button
                    onClick={() => handleUseItem(userItem)}
                    disabled={using === userItem.id}
                    className="px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
                  >
                    {using === userItem.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Utiliser'
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Color Picker Dialog */}
      <Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
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
                className="text-lg font-medium"
                style={{ color: selectedColor }}
              >
                {user?.username}
              </span>
            </div>

            {/* Preset colors */}
            <div className="grid grid-cols-10 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setSelectedColor(color);
                    setCustomColor(color);
                  }}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                    selectedColor === color ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* Custom color input */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  setSelectedColor(e.target.value);
                }}
                className="w-10 h-10 rounded cursor-pointer"
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
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Photo de profil
            </DialogTitle>
            <DialogDescription>
              Entrez l'URL de votre photo de profil qui sera affichée dans le chat.
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

            {/* URL input */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">URL de l'image</label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="bg-transparent"
              />
              <p className="text-xs text-muted-foreground">
                Utilisez un service d'hébergement d'images comme Imgur, ImgBB, etc.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={applyProfilePicture}
              disabled={using !== null || !imageUrl.trim()}
            >
              {using ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

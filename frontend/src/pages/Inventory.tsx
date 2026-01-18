import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi, uploadsApi, UserNft } from '../services/api';
import { Loader2, Palette, Camera, Package } from 'lucide-react';
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
import { readFileAsDataUrl } from '@/lib/uploads';
import { resolveImageUrl } from '@/lib/images';

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

const nftRarityLabels: Record<string, string> = {
  COMMON: 'Commun',
  UNCOMMON: 'Inhabituel',
  RARE: 'Rare',
  EPIC: 'Épique',
  LEGENDARY: 'Légendaire',
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
  const [nfts, setNfts] = useState<UserNft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingNfts, setLoadingNfts] = useState(true);
  const [using, setUsing] = useState<string | null>(null);
  const [displayingNft, setDisplayingNft] = useState<string | null>(null);
  const [displayedNftId, setDisplayedNftId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'items' | 'nfts'>('items');

  // Color picker state
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [colorPickerItem, setColorPickerItem] = useState<UserItem | null>(null);
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [customColor, setCustomColor] = useState('#ffffff');

  // Image upload state
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageItem, setImageItem] = useState<UserItem | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');

  useEffect(() => {
    if (user) {
      fetchInventory();
      fetchNftInventory();
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

  const fetchNftInventory = async () => {
    try {
      setLoadingNfts(true);
      const response = await marketplaceApi.getNftInventory(user!.id);
      setNfts(response.data.items);
      setDisplayedNftId(response.data.displayedNftId);
    } catch (error) {
      console.error('Failed to fetch NFT inventory:', error);
    } finally {
      setLoadingNfts(false);
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
        setImageDataUrl('');
        setImageUrl('');
        setImageInputMode('upload');
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
    if (!imageItem) return;
    
    try {
      setUsing(imageItem.id);
      setMessage(null);

      let finalUrl = '';
      if (imageInputMode === 'upload') {
        if (!imageDataUrl) return;
        const uploadRes = await uploadsApi.uploadImage({
          purpose: 'profile',
          imageData: imageDataUrl,
        });
        finalUrl = uploadRes.data.url;
      } else {
        if (!imageUrl.trim()) return;
        finalUrl = imageUrl.trim();
      }

      await marketplaceApi.useItem(imageItem.id, { imageUrl: finalUrl });
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

  const handleDisplayNft = async (userNftId: string | null) => {
    if (displayingNft) return;

    try {
      setDisplayingNft(userNftId ?? displayedNftId ?? 'clear');
      setMessage(null);
      const res = await marketplaceApi.setDisplayedNft(userNftId);
      setDisplayedNftId(res.data.displayedNftId);
      setMessage({ type: 'success', text: userNftId ? 'NFT affiché sur le profil' : 'NFT retiré du profil' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec',
      });
    } finally {
      setDisplayingNft(null);
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
            {items.length} objet{items.length !== 1 ? 's' : ''} • {nfts.length} NFT{nfts.length !== 1 ? 's' : ''}
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

      <div className="space-y-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('items')}
            className={cn(
              "px-4 py-2 text-sm border transition-colors",
              activeTab === 'items'
                ? "border-foreground text-foreground"
                : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            Objets
          </button>
          <button
            onClick={() => setActiveTab('nfts')}
            className={cn(
              "px-4 py-2 text-sm border transition-colors",
              activeTab === 'nfts'
                ? "border-foreground text-foreground"
                : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            NFT
          </button>
        </div>

        {activeTab === 'items' && (
          <div className="space-y-6">
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
                    <div className="flex items-center gap-4 flex-1">
                      {/* Item Image */}
                      {userItem.item.imageUrl ? (
                        <img 
                          src={resolveImageUrl(userItem.item.imageUrl)} 
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
                          <h2 className="text-lg font-medium truncate">{userItem.item.name}</h2>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0">
                            {typeLabels[userItem.item.type]}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            ×{userItem.quantity}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground max-w-md truncate">
                          {userItem.item.description}
                        </p>
                        {effectLabel && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
                            {effectIcon}
                            <span>{effectLabel}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {(userItem.item.type === 'CONSUMABLE' || userItem.item.type === 'COSMETIC') && (
                      <button
                        onClick={() => handleUseItem(userItem)}
                        disabled={using === userItem.id}
                        className="px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-50 ml-4 shrink-0"
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
          </div>
        )}

        {activeTab === 'nfts' && (
          <div className="space-y-6">
          <div className="h-px bg-border" />

          {loadingNfts ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : nfts.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun NFT dans l'inventaire
            </p>
          ) : (
            <div className="space-y-0">
              {nfts.map((userNft) => (
                <div
                  key={userNft.id}
                  className="flex items-center justify-between py-6 border-b border-border/30 last:border-0"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {userNft.nft.imageUrl ? (
                      <img 
                        src={resolveImageUrl(userNft.nft.imageUrl)} 
                        alt={userNft.nft.name}
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
                        <h2 className="text-lg font-medium truncate">{userNft.nft.name}</h2>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0">
                          {nftRarityLabels[userNft.nft.rarity] || userNft.nft.rarity}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground max-w-md truncate">
                        {userNft.nft.description}
                      </p>
                      <div className="text-xs text-muted-foreground/80 flex items-center gap-4">
                        <span>Acheté ${userNft.purchasePrice}</span>
                        <span>
                          Ajouté le {new Date(userNft.acquiredAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDisplayNft(displayedNftId === userNft.id ? null : userNft.id)}
                    disabled={displayingNft === userNft.id}
                    className={cn(
                      "px-4 py-2 text-sm border transition-colors ml-4 shrink-0",
                      displayedNftId === userNft.id
                        ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                        : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                    )}
                  >
                    {displayingNft === userNft.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : displayedNftId === userNft.id ? (
                      'Retirer'
                    ) : (
                      'Afficher'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
          </div>
        )}
      </div>

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
              Importez votre photo de profil qui sera affichée dans le chat.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Preview */}
            {(imageInputMode === 'upload' ? imageDataUrl : imageUrl) && (
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border">
                  <img 
                    src={imageInputMode === 'upload' ? imageDataUrl : imageUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}

            {/* File input */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={imageInputMode === 'upload' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setImageInputMode('upload')}
                >
                  Upload
                </Button>
                <Button
                  type="button"
                  variant={imageInputMode === 'url' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setImageInputMode('url')}
                >
                  URL
                </Button>
              </div>
              {imageInputMode === 'upload' ? (
                <Input
                  type="file"
                  accept="image/*"
                  className="bg-transparent"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                      setImageDataUrl('');
                      return;
                    }
                    try {
                      const dataUrl = await readFileAsDataUrl(file);
                      setImageDataUrl(dataUrl);
                    } catch (error) {
                      console.error('Failed to read image:', error);
                      setImageDataUrl('');
                    }
                  }}
                />
              ) : (
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-transparent"
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={applyProfilePicture}
              disabled={
                using !== null ||
                (imageInputMode === 'upload' ? !imageDataUrl : !imageUrl.trim())
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
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { galleryApi, Painting, GallerySettings, ArtPackage, NpcStatus } from '../services/api';
import { Loader2, Package, Users, Warehouse, Settings, ShoppingBag, ArrowRight, ArrowLeft } from 'lucide-react';
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
import { resolveImageUrl } from '@/lib/images';

const rarityLabels: Record<string, string> = {
  COMMON: 'Commun',
  RARE: 'Rare',
  GOLDEN: 'Doré',
};

const rarityColors: Record<string, string> = {
  COMMON: 'text-muted-foreground',
  RARE: 'text-blue-400',
  GOLDEN: 'text-yellow-400',
};

const rarityFilters: Record<string, string> = {
  COMMON: 'grayscale',
  RARE: '',
  GOLDEN: 'sepia brightness-110 saturate-150',
};

export default function Gallery() {
  const { userId } = useParams<{ userId?: string }>();
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'gallery' | 'warehouse' | 'packages'>('gallery');
  const [loading, setLoading] = useState(true);
  const [gallery, setGallery] = useState<GallerySettings>({ backgroundColor: '#1a1a2e' });
  const [paintings, setPaintings] = useState<Painting[]>([]);
  const [warehousePaintings, setWarehousePaintings] = useState<Painting[]>([]);
  const [packages, setPackages] = useState<ArtPackage[]>([]);
  const [npcStatus, setNpcStatus] = useState<NpcStatus | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [visitingNpc, setVisitingNpc] = useState(false);

  // Settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#1a1a2e');

  // Reveal dialog for package purchase
  const [revealDialog, setRevealDialog] = useState<{ open: boolean; painting?: Painting }>({ open: false });

  const isOwnGallery = !userId || userId === user?.id;
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchGallery();
    }
    if (isOwnGallery && user) {
      fetchWarehouse();
      fetchPackages();
      fetchNpcStatus();
    }
  }, [targetUserId, isOwnGallery, user]);

  const fetchGallery = async () => {
    try {
      setLoading(true);
      const response = await galleryApi.getGallery(targetUserId!);
      setGallery(response.data.gallery);
      setPaintings(response.data.paintings);
      setBackgroundColor(response.data.gallery.backgroundColor);
    } catch (error) {
      console.error('Failed to fetch gallery:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouse = async () => {
    try {
      const response = await galleryApi.getWarehouse();
      setWarehousePaintings(response.data.paintings);
    } catch (error) {
      console.error('Failed to fetch warehouse:', error);
    }
  };

  const fetchPackages = async () => {
    try {
      const response = await galleryApi.getPackagesStatus();
      setPackages(response.data.packages);
    } catch (error) {
      console.error('Failed to fetch packages:', error);
    }
  };

  const fetchNpcStatus = async () => {
    try {
      const response = await galleryApi.getNpcStatus();
      setNpcStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch NPC status:', error);
    }
  };

  const handlePurchasePackage = async (tier: number) => {
    if (purchasing) return;

    try {
      setPurchasing(tier);
      setMessage(null);

      const response = await galleryApi.purchasePackage(tier);
      await refreshUser();
      await fetchPackages();
      await fetchWarehouse();

      // Show reveal dialog
      setRevealDialog({ open: true, painting: response.data.painting });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec de l\'achat',
      });
    } finally {
      setPurchasing(null);
    }
  };

  const handleMovePainting = async (copyId: string, toGallery: boolean) => {
    if (moving) return;

    try {
      setMoving(copyId);
      setMessage(null);

      await galleryApi.movePainting({ copyId, toGallery });
      await fetchGallery();
      await fetchWarehouse();

      setMessage({
        type: 'success',
        text: toGallery ? 'Tableau ajouté à la galerie' : 'Tableau déplacé vers l\'entrepôt',
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec du déplacement',
      });
    } finally {
      setMoving(null);
    }
  };

  const handleNpcVisit = async () => {
    if (visitingNpc) return;

    try {
      setVisitingNpc(true);
      setMessage(null);

      const response = await galleryApi.triggerNpcVisit();
      await refreshUser();
      await fetchNpcStatus();

      const bonusText = response.data.hadGoldenBonus ? ' (bonus doré!)' : '';
      setMessage({
        type: 'success',
        text: `Les PNJ ont visité votre galerie! +$${response.data.revenue}${bonusText}`,
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec de la visite',
      });
    } finally {
      setVisitingNpc(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await galleryApi.updateSettings({ backgroundColor });
      setGallery({ ...gallery, backgroundColor });
      setSettingsOpen(false);
      setMessage({ type: 'success', text: 'Paramètres sauvegardés' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec de la sauvegarde',
      });
    }
  };

  const canAffordPackage = (price: number) => (user?.money || 0) >= price;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-end">
        <div className="text-right text-sm text-muted-foreground tabular-nums">
          <div>{paintings.length}/20 tableaux exposés</div>
          {isOwnGallery && <div>${user?.money.toLocaleString()}</div>}
        </div>
      </div>

      {/* Message */}
      {message && (
        <p className={cn(
          "text-sm",
          message.type === 'success' ? 'text-foreground' : 'text-destructive'
        )}>
          {message.text}
        </p>
      )}

      {/* NPC Visit Section (only for own gallery) */}
      {isOwnGallery && npcStatus && (
        <div className="flex items-center justify-between p-4 border border-border/30 rounded-lg">
          <div className="flex items-center gap-4">
            <Users className="w-8 h-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Visite des PNJ</p>
              <p className="text-sm text-muted-foreground">
                {npcStatus.canVisit
                  ? `${npcStatus.paintingsInGallery} tableaux exposés → +$${npcStatus.potentialRevenue}/jour`
                  : 'Déjà visité aujourd\'hui'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleNpcVisit}
            disabled={!npcStatus.canVisit || visitingNpc || npcStatus.paintingsInGallery === 0}
            variant={npcStatus.canVisit ? 'default' : 'outline'}
          >
            {visitingNpc ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : npcStatus.canVisit ? (
              'Ouvrir aux visiteurs'
            ) : (
              'Revenir demain'
            )}
          </Button>
        </div>
      )}

      {/* Tabs */}
      {isOwnGallery && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('gallery')}
            className={cn(
              "px-4 py-2 text-sm border transition-colors flex items-center gap-2",
              activeTab === 'gallery'
                ? "border-foreground text-foreground"
                : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            <Package className="w-4 h-4" />
            Galerie
          </button>
          <button
            onClick={() => setActiveTab('warehouse')}
            className={cn(
              "px-4 py-2 text-sm border transition-colors flex items-center gap-2",
              activeTab === 'warehouse'
                ? "border-foreground text-foreground"
                : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            <Warehouse className="w-4 h-4" />
            Entrepôt ({warehousePaintings.length})
          </button>
          <button
            onClick={() => setActiveTab('packages')}
            className={cn(
              "px-4 py-2 text-sm border transition-colors flex items-center gap-2",
              activeTab === 'packages'
                ? "border-foreground text-foreground"
                : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            <ShoppingBag className="w-4 h-4" />
            Paquets d'art
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="px-4 py-2 text-sm border border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center gap-2 ml-auto"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Gallery View */}
      {activeTab === 'gallery' && (
        <div className="space-y-6">
          <div className="h-px bg-border" />

          {/* Gallery Wall */}
          <div
            className="p-8 rounded-lg min-h-[400px]"
            style={{ backgroundColor: gallery.backgroundColor }}
          >
            {paintings.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <p>Galerie vide - Ajoutez des tableaux depuis l'entrepôt</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {paintings.map((painting) => (
                  <div
                    key={painting.id}
                    className="group relative bg-black/20 rounded overflow-hidden aspect-square"
                  >
                    <img
                      src={resolveImageUrl(painting.imageUrl)}
                      alt={painting.title}
                      className={cn(
                        "w-full h-full object-cover transition-transform group-hover:scale-105",
                        rarityFilters[painting.rarity]
                      )}
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                      <p className="text-white text-sm font-medium truncate">{painting.title}</p>
                      <p className="text-white/70 text-xs truncate">{painting.artist}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={cn("text-xs", rarityColors[painting.rarity])}>
                          {rarityLabels[painting.rarity]}
                        </span>
                        <span className="text-white/50 text-xs">
                          {painting.copyNumber}/{painting.maxCopies}
                        </span>
                      </div>
                      {isOwnGallery && (
                        <button
                          onClick={() => handleMovePainting(painting.id, false)}
                          disabled={moving === painting.id}
                          className="mt-2 px-2 py-1 text-xs bg-white/20 hover:bg-white/30 rounded transition-colors flex items-center gap-1"
                        >
                          {moving === painting.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <ArrowLeft className="w-3 h-3" />
                              Entrepôt
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warehouse View */}
      {activeTab === 'warehouse' && isOwnGallery && (
        <div className="space-y-6">
          <div className="h-px bg-border" />

          {warehousePaintings.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Entrepôt vide - Achetez des paquets d'art pour obtenir des tableaux
            </p>
          ) : (
            <div className="space-y-0">
              {warehousePaintings.map((painting) => (
                <div
                  key={painting.id}
                  className="flex items-center justify-between py-6 border-b border-border/30 last:border-0"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="relative w-16 h-16 rounded overflow-hidden shrink-0">
                      <img
                        src={resolveImageUrl(painting.imageUrl)}
                        alt={painting.title}
                        className={cn(
                          "w-full h-full object-cover",
                          rarityFilters[painting.rarity]
                        )}
                      />
                    </div>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium truncate">{painting.title}</h3>
                        <span className={cn("text-xs uppercase tracking-wide", rarityColors[painting.rarity])}>
                          {rarityLabels[painting.rarity]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {painting.copyNumber}/{painting.maxCopies}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{painting.artist}</p>
                      {painting.isListed && (
                        <p className="text-xs text-yellow-500">En vente sur le marché</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Link
                      to="/market"
                      className="px-3 py-2 text-sm border border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                    >
                      Vendre
                    </Link>
                    <button
                      onClick={() => handleMovePainting(painting.id, true)}
                      disabled={moving === painting.id || painting.isListed || paintings.length >= 20}
                      className={cn(
                        "px-3 py-2 text-sm border transition-colors flex items-center gap-1",
                        painting.isListed || paintings.length >= 20
                          ? "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                          : "border-foreground text-foreground hover:bg-foreground hover:text-background"
                      )}
                    >
                      {moving === painting.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Exposer
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Art Packages View */}
      {activeTab === 'packages' && isOwnGallery && (
        <div className="space-y-6">
          <div className="h-px bg-border" />

          <div className="text-center text-muted-foreground text-sm mb-8">
            <p>Achetez des paquets d'art pour obtenir des tableaux aléatoires.</p>
            <p>Tous les paquets ont les mêmes chances de raretés.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div
                key={pkg.tier}
                className={cn(
                  "p-6 border rounded-lg text-center space-y-4",
                  pkg.purchased
                    ? "border-border/30 opacity-50"
                    : "border-border hover:border-foreground/30 transition-colors"
                )}
              >
                <div>
                  <Package className="w-12 h-12 mx-auto text-muted-foreground" />
                  <h3 className="text-lg font-medium mt-2">Paquet {pkg.tier}</h3>
                  <p className="text-2xl font-light">${pkg.price}</p>
                </div>

                <button
                  onClick={() => handlePurchasePackage(pkg.tier)}
                  disabled={pkg.purchased || !canAffordPackage(pkg.price) || purchasing !== null}
                  className={cn(
                    "w-full px-4 py-2 text-sm border transition-colors",
                    pkg.purchased
                      ? "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                      : canAffordPackage(pkg.price)
                        ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                        : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                  )}
                >
                  {purchasing === pkg.tier ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : pkg.purchased ? (
                    'Acheté'
                  ) : canAffordPackage(pkg.price) ? (
                    'Acheter'
                  ) : (
                    'Insuffisant'
                  )}
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Les paquets se renouvellent chaque jour à minuit UTC.
          </p>
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Paramètres de la galerie
            </DialogTitle>
            <DialogDescription>
              Personnalisez l'apparence de votre galerie.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Couleur du mur</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  placeholder="#1a1a2e"
                  className="flex-1 bg-transparent font-mono"
                />
              </div>
            </div>

            {/* Preview */}
            <div
              className="h-20 rounded-lg flex items-center justify-center text-muted-foreground text-sm"
              style={{ backgroundColor }}
            >
              Aperçu du mur
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveSettings}>
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal Dialog */}
      <Dialog open={revealDialog.open} onOpenChange={(open) => setRevealDialog({ open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Nouveau tableau!</DialogTitle>
          </DialogHeader>

          {revealDialog.painting && (
            <div className="py-4 space-y-4">
              <div className="relative mx-auto w-48 h-48 rounded-lg overflow-hidden">
                <img
                  src={resolveImageUrl(revealDialog.painting.imageUrl)}
                  alt={revealDialog.painting.title}
                  className={cn(
                    "w-full h-full object-cover",
                    rarityFilters[revealDialog.painting.rarity]
                  )}
                />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-xl font-medium">{revealDialog.painting.title}</h3>
                <p className="text-muted-foreground">{revealDialog.painting.artist}</p>
                <div className="flex items-center justify-center gap-2">
                  <span className={cn("text-sm uppercase tracking-wide", rarityColors[revealDialog.painting.rarity])}>
                    {rarityLabels[revealDialog.painting.rarity]}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    ({revealDialog.painting.copyNumber}/{revealDialog.painting.maxCopies})
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setRevealDialog({ open: false })} className="w-full">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

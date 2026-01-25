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
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { resolveImageUrl } from '@/lib/images';
import PageLayout from '@/components/layout/PageLayout';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';

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
    <>
      <PageLayout>
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
          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className={TYPOGRAPHY.SMALL}>Visite des PNJ</p>
                    <p className={TYPOGRAPHY.XS}>
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
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {npcStatus.canVisit ? 'Ouvrir aux visiteurs' : 'Revenir demain'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        {isOwnGallery && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'gallery' | 'warehouse' | 'packages')}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="gallery">
                  <Package className="w-4 h-4 mr-2" />
                  Galerie
                </TabsTrigger>
                <TabsTrigger value="warehouse">
                  <Warehouse className="w-4 h-4 mr-2" />
                  Entrepôt ({warehousePaintings.length})
                </TabsTrigger>
                <TabsTrigger value="packages">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Paquets d'art
                </TabsTrigger>
              </TabsList>
              <Button
                onClick={() => setSettingsOpen(true)}
                variant="outline"
                size="icon"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            <TabsContent value="gallery" className={SPACING.SECTION_SPACING}>
              {/* Gallery Wall */}
              <Card
                className="min-h-[400px]"
                style={{ backgroundColor: gallery.backgroundColor }}
              >
                <CardContent className="p-8">
                  {paintings.length === 0 ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className={TYPOGRAPHY.MUTED}>Galerie vide - Ajoutez des tableaux depuis l'entrepôt</p>
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
                            <p className={cn("text-white", TYPOGRAPHY.SMALL, "truncate")}>{painting.title}</p>
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
                              <Button
                                onClick={() => handleMovePainting(painting.id, false)}
                                disabled={moving === painting.id}
                                variant="ghost"
                                size="sm"
                                className="mt-2 text-xs bg-white/20 hover:bg-white/30 text-white"
                              >
                                {moving === painting.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <ArrowLeft className="w-3 h-3 mr-1" />
                                )}
                                Entrepôt
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="warehouse" className={SPACING.SECTION_SPACING}>
              {warehousePaintings.length === 0 ? (
                <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>
                  Entrepôt vide - Achetez des paquets d'art pour obtenir des tableaux
                </p>
              ) : (
                <div className="space-y-0">
                  {warehousePaintings.map((painting) => (
                    <Card
                      key={painting.id}
                      className="border-border/40 border-b last:border-b"
                    >
                      <CardContent className="py-6">
                        <div className="flex items-center justify-between">
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
                                <h3 className={TYPOGRAPHY.SMALL}>{painting.title}</h3>
                                <span className={cn(TYPOGRAPHY.XS, "uppercase tracking-wide", rarityColors[painting.rarity])}>
                                  {rarityLabels[painting.rarity]}
                                </span>
                                <span className={TYPOGRAPHY.XS}>
                                  {painting.copyNumber}/{painting.maxCopies}
                                </span>
                              </div>
                              <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground truncate")}>{painting.artist}</p>
                              {painting.isListed && (
                                <p className={cn(TYPOGRAPHY.XS, "text-yellow-500")}>En vente sur le marché</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-4 shrink-0">
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                            >
                              <Link to="/market">
                                Vendre
                              </Link>
                            </Button>
                            <Button
                              onClick={() => handleMovePainting(painting.id, true)}
                              disabled={moving === painting.id || painting.isListed || paintings.length >= 20}
                              variant="outline"
                              size="sm"
                            >
                              {moving === painting.id ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                              ) : (
                                <>
                                  Exposer
                                  <ArrowRight className="w-4 h-4 ml-1" />
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="packages" className={SPACING.SECTION_SPACING}>
              <div className={cn("text-center", TYPOGRAPHY.SMALL, "text-muted-foreground mb-8")}>
                <p>Achetez des paquets d'art pour obtenir des tableaux aléatoires.</p>
                <p>Tous les paquets ont les mêmes chances de raretés.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {packages.map((pkg) => (
                  <Card
                    key={pkg.tier}
                    className={cn(
                      "text-center",
                      SPACING.CARD_SPACING,
                      pkg.purchased
                        ? "border-border/30 opacity-50"
                        : "border-border/40 hover:border-foreground/30 transition-colors"
                    )}
                  >
                    <CardContent className="p-6">
                      <div>
                        <Package className="w-12 h-12 mx-auto text-muted-foreground" />
                        <h3 className={cn(TYPOGRAPHY.H5, "mt-2")}>Paquet {pkg.tier}</h3>
                        <p className={cn(TYPOGRAPHY.H2, "tabular-nums")}>${pkg.price}</p>
                      </div>

                      <Button
                        onClick={() => handlePurchasePackage(pkg.tier)}
                        disabled={pkg.purchased || !canAffordPackage(pkg.price) || purchasing !== null}
                        variant="outline"
                        className="w-full"
                      >
                        {purchasing === pkg.tier ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        {pkg.purchased ? 'Acheté' : canAffordPackage(pkg.price) ? 'Acheter' : 'Insuffisant'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <p className={cn(TYPOGRAPHY.XS, "text-center text-muted-foreground")}>
                Les paquets se renouvellent chaque jour à minuit UTC.
              </p>
            </TabsContent>
          </Tabs>
        )}
      </PageLayout>

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
                <h3 className={TYPOGRAPHY.H4}>{revealDialog.painting.title}</h3>
                <p className={TYPOGRAPHY.MUTED}>{revealDialog.painting.artist}</p>
                <div className="flex items-center justify-center gap-2">
                  <span className={cn(TYPOGRAPHY.SMALL, "uppercase tracking-wide", rarityColors[revealDialog.painting.rarity])}>
                    {rarityLabels[revealDialog.painting.rarity]}
                  </span>
                  <span className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground")}>
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
              <label className={TYPOGRAPHY.SMALL}>Couleur du mur</label>
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
    </>
  );
}

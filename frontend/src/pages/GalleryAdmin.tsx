import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { galleryApi } from '../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Eye, EyeOff, ImageIcon, BarChart3 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';

interface PaintingWithCopies {
  id: string;
  title: string;
  artist: string;
  description: string | null;
  imageUrl: string;
  isVaulted: boolean;
  createdAt: string;
  copies: Array<{
    id: string;
    rarity: string;
    copyNumber: number;
    owner: { id: string; username: string } | null;
    inGallery: boolean;
  }>;
}

interface Analytics {
  totalPaintings: number;
  totalCopies: number;
  ownedCopies: number;
  availableCopies: number;
  copiesByRarity: Array<{ rarity: string; count: number }>;
  topCollectors: Array<{ userId: string; username: string | null; count: number }>;
}

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

export default function GalleryAdmin() {
  const { user } = useAuth();
  const [paintings, setPaintings] = useState<PaintingWithCopies[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'paintings' | 'analytics'>('paintings');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create painting dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    description: '',
    imageUrl: '',
  });
  const [creating, setCreating] = useState(false);

  // Vault/unvault state
  const [vaulting, setVaulting] = useState<string | null>(null);

  useEffect(() => {
    fetchPaintings();
    fetchAnalytics();
  }, []);

  const fetchPaintings = async () => {
    try {
      setLoading(true);
      const response = await galleryApi.getPaintings();
      setPaintings(response.data.paintings);
    } catch (error) {
      console.error('Failed to fetch paintings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await galleryApi.getAnalytics();
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const handleCreatePainting = async () => {
    if (creating) return;

    try {
      setCreating(true);
      setMessage(null);

      const finalImageUrl = formData.imageUrl;

      if (!finalImageUrl) {
        setMessage({ type: 'error', text: 'Une image est requise' });
        return;
      }

      await galleryApi.createPainting({
        title: formData.title,
        artist: formData.artist,
        description: formData.description || undefined,
        imageUrl: finalImageUrl,
      });

      await fetchPaintings();
      await fetchAnalytics();
      setCreateDialogOpen(false);
      setFormData({ title: '', artist: '', description: '', imageUrl: '' });

      setMessage({ type: 'success', text: 'Tableau créé avec 6 copies' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec de la création',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleVault = async (id: string, currentVaulted: boolean) => {
    if (vaulting) return;

    try {
      setVaulting(id);
      setMessage(null);

      await galleryApi.vaultPainting(id, !currentVaulted);
      await fetchPaintings();

      setMessage({
        type: 'success',
        text: currentVaulted ? 'Tableau retiré du coffre' : 'Tableau mis au coffre',
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec de l\'opération',
      });
    } finally {
      setVaulting(null);
    }
  };

  // Non-admin redirect
  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Administration
            </p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Galerie
            </h1>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau tableau
          </Button>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div className={cn(
          "px-4 py-3 border",
          message.type === 'success' ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-destructive/30 bg-destructive/10 text-destructive'
        )}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('paintings')}
          className={cn(
            "px-4 py-2 text-sm border transition-colors flex items-center gap-2",
            activeTab === 'paintings'
              ? "border-foreground text-foreground"
              : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
          )}
        >
          <ImageIcon className="w-4 h-4" />
          Tableaux ({paintings.length})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={cn(
            "px-4 py-2 text-sm border transition-colors flex items-center gap-2",
            activeTab === 'analytics'
              ? "border-foreground text-foreground"
              : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
          )}
        >
          <BarChart3 className="w-4 h-4" />
          Statistiques
        </button>
      </div>

      {/* Paintings Tab */}
      {activeTab === 'paintings' && (
        <div className="space-y-6">
          <div className="h-px bg-border" />

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : paintings.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun tableau créé
            </p>
          ) : (
            <div className="space-y-4">
              {paintings.map((painting) => (
                <div
                  key={painting.id}
                  className={cn(
                    "border rounded-lg p-4",
                    painting.isVaulted ? "border-yellow-500/30 bg-yellow-500/5" : "border-border/30"
                  )}
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="w-24 h-24 rounded overflow-hidden shrink-0">
                      <img
                        src={resolveImageUrl(painting.imageUrl)}
                        alt={painting.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{painting.title}</h3>
                          <p className="text-sm text-muted-foreground">{painting.artist}</p>
                          {painting.description && (
                            <p className="text-sm text-muted-foreground/70 mt-1">
                              {painting.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {painting.isVaulted && (
                            <span className="text-xs text-yellow-500 px-2 py-1 border border-yellow-500/30 rounded">
                              Au coffre
                            </span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleVault(painting.id, painting.isVaulted)}
                            disabled={vaulting === painting.id}
                          >
                            {vaulting === painting.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : painting.isVaulted ? (
                              <>
                                <Eye className="w-4 h-4 mr-1" />
                                Activer
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-4 h-4 mr-1" />
                                Coffrer
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Copies */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {painting.copies.map((copy) => (
                          <div
                            key={copy.id}
                            className={cn(
                              "px-2 py-1 text-xs border rounded flex items-center gap-1",
                              copy.owner ? "border-foreground/30" : "border-border/30"
                            )}
                          >
                            <span className={rarityColors[copy.rarity]}>
                              {rarityLabels[copy.rarity]} #{copy.copyNumber}
                            </span>
                            {copy.owner ? (
                              <span className="text-muted-foreground">
                                → {copy.owner.username}
                                {copy.inGallery && ' (exposé)'}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">disponible</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          <div className="h-px bg-border" />

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-border/30 rounded-lg p-4 text-center">
              <p className="text-3xl font-light">{analytics.totalPaintings}</p>
              <p className="text-sm text-muted-foreground">Tableaux</p>
            </div>
            <div className="border border-border/30 rounded-lg p-4 text-center">
              <p className="text-3xl font-light">{analytics.totalCopies}</p>
              <p className="text-sm text-muted-foreground">Copies totales</p>
            </div>
            <div className="border border-border/30 rounded-lg p-4 text-center">
              <p className="text-3xl font-light">{analytics.ownedCopies}</p>
              <p className="text-sm text-muted-foreground">Copies possédées</p>
            </div>
            <div className="border border-border/30 rounded-lg p-4 text-center">
              <p className="text-3xl font-light">{analytics.availableCopies}</p>
              <p className="text-sm text-muted-foreground">Copies disponibles</p>
            </div>
          </div>

          {/* Rarity Distribution */}
          <div className="border border-border/30 rounded-lg p-4">
            <h3 className="font-medium mb-4">Distribution par rareté</h3>
            <div className="space-y-2">
              {analytics.copiesByRarity.map((item) => (
                <div key={item.rarity} className="flex items-center justify-between">
                  <span className={rarityColors[item.rarity]}>
                    {rarityLabels[item.rarity]}
                  </span>
                  <span className="text-muted-foreground">{item.count} possédées</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Collectors */}
          <div className="border border-border/30 rounded-lg p-4">
            <h3 className="font-medium mb-4">Top collectionneurs</h3>
            {analytics.topCollectors.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun collectionneur</p>
            ) : (
              <div className="space-y-2">
                {analytics.topCollectors.map((collector, index) => (
                  <div key={collector.userId} className="flex items-center justify-between">
                    <span>
                      <span className="text-muted-foreground mr-2">#{index + 1}</span>
                      {collector.username || 'Utilisateur inconnu'}
                    </span>
                    <span className="text-muted-foreground">{collector.count} tableaux</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Painting Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau tableau</DialogTitle>
            <DialogDescription>
              Créer un nouveau tableau créera automatiquement 6 copies:
              3 communes, 2 rares, 1 dorée.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Titre *</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="La Joconde"
                className="bg-transparent"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Artiste *</label>
              <Input
                value={formData.artist}
                onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                placeholder="Léonard de Vinci"
                className="bg-transparent"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Une description du tableau..."
                className="bg-transparent resize-none"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Image * (URL uniquement)</label>
              <Input
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://..."
                className="bg-transparent"
              />

              {/* Preview */}
              {formData.imageUrl && (
                <div className="mt-2 w-32 h-32 rounded overflow-hidden border border-border">
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreatePainting}
              disabled={
                creating ||
                !formData.title ||
                !formData.artist ||
                !formData.imageUrl
              }
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

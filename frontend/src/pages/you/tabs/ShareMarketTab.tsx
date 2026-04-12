import { useMemo, useState } from 'react';
import { Building2, Loader2, ShoppingCart, Tag } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type YouState, youApi } from '@/services/api';
import { SectionTitle } from '../components/ui';
import { formatMoney } from '../utils';

function pct(value: number) {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%`;
}

export function ShareMarketTab({
  data,
  userId,
  onReload,
}: {
  data: YouState;
  userId: string;
  onReload: (refreshBalance?: boolean) => Promise<void>;
}) {
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>(data.shareholderBusinesses[0]?.id ?? '');
  const [sharePercent, setSharePercent] = useState('');
  const [price, setPrice] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);

  const sellableBusinesses = useMemo(
    () => data.shareholderBusinesses.filter((business) => business.viewerSharePercent > 0),
    [data.shareholderBusinesses],
  );

  const selectedBusiness = sellableBusinesses.find((business) => business.id === selectedBusinessId) ?? null;

  const createListing = async () => {
    const parsedShare = Number(sharePercent.replace(',', '.'));
    const parsedPrice = Number(price.replace(',', '.'));

    if (!selectedBusinessId) {
      toast.error('Choisis un business.');
      return;
    }

    if (!Number.isFinite(parsedShare) || parsedShare <= 0) {
      toast.error('Part invalide.');
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error('Prix invalide.');
      return;
    }

    setCreating(true);
    try {
      await youApi.createShareMarketListing({
        businessId: selectedBusinessId,
        sharePercent: parsedShare,
        price: Math.round(parsedPrice),
      });
      toast.success('Annonce publiee sur le marche.');
      setSharePercent('');
      setPrice('');
      await onReload(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de publier l annonce.');
    } finally {
      setCreating(false);
    }
  };

  const buyListing = async (listingId: string) => {
    setBusyListingId(listingId);
    try {
      await youApi.buyShareMarketListing(listingId);
      toast.success('Actions achetees avec succes.');
      await onReload(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible d acheter cette annonce.');
    } finally {
      setBusyListingId(null);
    }
  };

  const cancelListing = async (listingId: string) => {
    setBusyListingId(listingId);
    try {
      await youApi.cancelShareMarketListing(listingId);
      toast.success('Annonce annulee.');
      await onReload();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible d annuler cette annonce.');
    } finally {
      setBusyListingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 px-5 py-4">
          <SectionTitle>Mettre en vente des actions</SectionTitle>
          {sellableBusinesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tu ne possedes aucune action revendable pour le moment.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Business</Label>
                <select
                  value={selectedBusinessId}
                  onChange={(event) => setSelectedBusinessId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {sellableBusinesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name} ({pct(business.viewerSharePercent)} max)
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Part a vendre (%)</Label>
                <Input
                  value={sharePercent}
                  onChange={(event) => setSharePercent(event.target.value)}
                  placeholder="Ex: 5"
                  type="number"
                  min="0.01"
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Prix total (money)</Label>
                <Input
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="Ex: 12000"
                  type="number"
                  min="1"
                  step="1"
                />
              </div>
            </div>
          )}

          {selectedBusiness ? (
            <p className="text-xs text-muted-foreground">
              Tu possedes actuellement {pct(selectedBusiness.viewerSharePercent)} de {selectedBusiness.name}.
            </p>
          ) : null}

          <div>
            <Button onClick={() => void createListing()} disabled={creating || !selectedBusinessId}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tag className="mr-2 h-4 w-4" />}
              Publier l annonce
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <SectionTitle>Mes annonces ({data.myShareMarketListings.length})</SectionTitle>
        {data.myShareMarketListings.length === 0 ? (
          <Card>
            <CardContent className="px-5 py-8 text-sm text-muted-foreground">Aucune annonce active.</CardContent>
          </Card>
        ) : (
          data.myShareMarketListings.map((listing) => (
            <Card key={listing.id}>
              <CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-semibold">{listing.business.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {pct(listing.sharePercent)} · {formatMoney(listing.price)} · publiee le {new Date(listing.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  disabled={busyListingId === listing.id}
                  onClick={() => void cancelListing(listing.id)}
                >
                  {busyListingId === listing.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Annuler'}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="space-y-4">
        <SectionTitle>Marche secondaire ({data.shareMarketListings.length})</SectionTitle>
        {data.shareMarketListings.length === 0 ? (
          <Card>
            <CardContent className="px-5 py-8 text-sm text-muted-foreground">Aucune action en vente actuellement.</CardContent>
          </Card>
        ) : (
          data.shareMarketListings.map((listing) => (
            <Card key={listing.id}>
              <CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <p className="text-base font-semibold">{listing.business.name}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Vendeur: {listing.seller.username} · {pct(listing.sharePercent)} · {formatMoney(listing.price)}
                  </p>
                  <p className="text-xs text-muted-foreground/70">Fondateur: {listing.business.owner.username}</p>
                </div>
                <Button
                  size="sm"
                  className="text-xs"
                  disabled={busyListingId === listing.id || listing.seller.id === userId}
                  onClick={() => void buyListing(listing.id)}
                >
                  {busyListingId === listing.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                  Acheter
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

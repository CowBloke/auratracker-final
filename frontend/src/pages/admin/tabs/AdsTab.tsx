import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { resolveImageUrl } from '@/lib/images';
import { Eye, Loader2, Trash2 } from 'lucide-react';

export type AdsTabProps = Record<string, unknown>;

export function AdsTab(props: AdsTabProps) {
  const {
    pendingAds,
    pendingAdsLoading,
    allAds,
    allAdsLoading,
    handleReviewAd,
    handleDeleteAdForever,
    reviewingAdId,
    handleToggleAdVisibility,
  } = props as any;

  return (
    <TabsContent value="ads" className={SPACING.SECTION_SPACING}>
      <div className="space-y-8">
        {pendingAds.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">A valider</h2>
              <span className={TYPOGRAPHY.XS}>{pendingAds.length} en attente</span>
            </div>
            <div className="space-y-3">
              {pendingAdsLoading ? (
                <Card><CardContent className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</CardContent></Card>
              ) : pendingAds.map((ad: any) => (
                <Card key={ad.id} className="overflow-hidden">
                  <CardContent className="space-y-4 px-5 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold">{ad.title}</p>
                          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-300">{ad.adType}</span>
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">En attente</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{ad.tagline}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">{ad.business.name} - par {ad.business.owner.username}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>CTA: {ad.ctaText}</span>
                          <span>-</span>
                          <span className="break-all">{ad.ctaLink}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => void handleReviewAd(ad.id, 'approve')} disabled={reviewingAdId === ad.id}>
                          Approuver
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleReviewAd(ad.id, 'reject')} disabled={reviewingAdId === ad.id}>
                          Rejeter
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => void handleDeleteAdForever(ad.id)} disabled={reviewingAdId === ad.id}>
                          Supprimer
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                      <div className="overflow-hidden rounded-xl border border-border/40 bg-background/50">
                        {ad.imageUrl ? (
                          <img src={resolveImageUrl(ad.imageUrl)} alt={ad.title} className="h-40 w-full object-cover" />
                        ) : (
                          <div className="flex h-40 items-center justify-center bg-muted/30 text-xs text-muted-foreground">Pas d'image</div>
                        )}
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Apercu joueur</p>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{ad.title}</p>
                          <p className="text-sm text-muted-foreground">{ad.tagline}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{ad.business.owner.username}</span>
                          <span>-</span>
                          <span>{ad.business.verified ? 'Entreprise verifiee' : 'Entreprise non verifiee'}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Toutes les publicites</h2>
            <span className={TYPOGRAPHY.XS}>{allAds.length} au total</span>
          </div>
          {allAdsLoading ? (
            <Card><CardContent className="px-5 py-8 text-center text-sm text-muted-foreground">Chargement...</CardContent></Card>
          ) : allAds.length === 0 ? (
            <Card><CardContent className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune publicite creee par les utilisateurs.</CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {allAds.map((ad: any) => (
                <Card key={`all-${ad.id}`} className="overflow-hidden flex flex-col">
                  <div className="relative">
                    {ad.imageUrl ? (
                      <img src={resolveImageUrl(ad.imageUrl)} alt={ad.title} className="h-44 w-full object-cover" />
                    ) : (
                      <div className="flex h-44 items-center justify-center bg-muted/30 text-xs text-muted-foreground">Pas d'image</div>
                    )}
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      <span className={ad.status === 'APPROVED' ? 'rounded-full bg-emerald-600/90 px-2 py-0.5 text-[11px] text-white font-medium' : ad.status === 'PENDING' ? 'rounded-full bg-amber-600/90 px-2 py-0.5 text-[11px] text-white font-medium' : 'rounded-full bg-red-600/90 px-2 py-0.5 text-[11px] text-white font-medium'}>
                        {ad.status === 'APPROVED' ? 'Approuvee' : ad.status === 'PENDING' ? 'En attente' : 'Rejetee'}
                      </span>
                      {!ad.isActive && (
                        <span className="rounded-full bg-background/80 border border-border/50 px-2 py-0.5 text-[11px] text-muted-foreground font-medium">Masquee</span>
                      )}
                    </div>
                  </div>
                  <CardContent className="flex flex-col gap-3 px-4 py-3 flex-1">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{ad.title}</p>
                        <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[11px] text-violet-300">{ad.adType}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{ad.tagline}</p>
                      <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60">{ad.business.name} - {ad.business.owner.username}</p>
                      <div className="flex gap-3 text-[11px] text-muted-foreground pt-0.5">
                        <span>{ad.impressions.toLocaleString('fr-FR')} impressions</span>
                        <span>-</span>
                        <span>{ad.clicks.toLocaleString('fr-FR')} clics</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/30">
                      {ad.status === 'PENDING' && (
                        <>
                          <Button size="sm" className="h-7 text-xs" onClick={() => void handleReviewAd(ad.id, 'approve')} disabled={reviewingAdId === ad.id}>
                            Approuver
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void handleReviewAd(ad.id, 'reject')} disabled={reviewingAdId === ad.id}>
                            Rejeter
                          </Button>
                        </>
                      )}
                      {ad.status === 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => void handleToggleAdVisibility(ad.id, ad.isActive)}
                          disabled={reviewingAdId === ad.id}
                        >
                          {reviewingAdId === ad.id ? <Loader2 className="w-3 h-3 animate-spin" /> : ad.isActive ? <Eye className="w-3 h-3" /> : <Eye className="w-3 h-3 opacity-40" />}
                          {ad.isActive ? 'Masquer' : 'Afficher'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs ml-auto"
                        onClick={() => void handleDeleteAdForever(ad.id)}
                        disabled={reviewingAdId === ad.id}
                      >
                        <Trash2 className="w-3 h-3" />
                        Supprimer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </TabsContent>
  );
}

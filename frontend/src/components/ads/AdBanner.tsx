import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveImageUrl } from '@/lib/images';
import { type Ad, adsApi } from '@/services/api';

function isExternalLink(url: string) {
  return /^https?:\/\//i.test(url);
}

export function AdBanner({ ad, onDismiss }: { ad: Ad; onDismiss: () => void }) {
  useEffect(() => {
    void adsApi.trackImpression(ad.id).catch(() => {});
  }, [ad.id]);

  const external = isExternalLink(ad.ctaLink);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-300/30 bg-amber-400/10 p-3 sm:flex-row sm:items-center">
      <div className="h-16 w-full overflow-hidden rounded-lg bg-black/20 sm:w-24">
        {ad.imageUrl ? (
          <img src={resolveImageUrl(ad.imageUrl)} alt={ad.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Pub</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Publicite · {ad.business.name}</p>
        <p className="truncate text-sm font-semibold">{ad.title}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{ad.tagline}</p>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild size="sm" className="h-8 text-xs">
          <a
            href={ad.ctaLink}
            target={external ? '_blank' : undefined}
            rel={external ? 'noreferrer noopener' : undefined}
            onClick={() => {
              void adsApi.trackClick(ad.id).catch(() => {});
            }}
          >
            {ad.ctaText}
          </a>
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onDismiss} aria-label="Fermer la publicite">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

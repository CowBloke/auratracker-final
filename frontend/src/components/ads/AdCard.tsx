import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { type Ad, adsApi } from '@/services/api';

function isExternalLink(url: string) {
  return /^https?:\/\//i.test(url);
}

export function AdCard({ ad }: { ad: Ad }) {
  useEffect(() => {
    void adsApi.trackImpression(ad.id).catch(() => {});
  }, [ad.id]);

  const external = isExternalLink(ad.ctaLink);
  const cardImage = resolveImageUrl(ad.imageUrl) || resolveImageUrl(ad.business.logoUrl) || '';

  return (
    <a
      href={ad.ctaLink}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer noopener' : undefined}
      onClick={() => {
        void adsApi.trackClick(ad.id).catch(() => {});
      }}
      className="group block"
    >
      <div
        className={cn(
          'relative isolate aspect-square overflow-hidden rounded-xl border border-white/10 transition hover:border-foreground/40 hover:shadow-md',
          ad.business.verified ? 'ring-1 ring-amber-300/40' : ''
        )}
      >
        {cardImage ? (
          <img
            src={cardImage}
            alt={ad.title}
            className="absolute inset-0 h-full w-full scale-110 object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-600/40 via-orange-500/30 to-rose-500/40" />
        )}

        <div className="absolute left-3 top-3 z-20 rounded-full border border-white/30 bg-black/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/95">
          Sponsorise
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />

        <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 p-3 text-white">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7 border border-white/30">
              {ad.business.logoUrl ? <AvatarImage src={resolveImageUrl(ad.business.logoUrl)} alt={ad.business.name} /> : null}
              <AvatarFallback>{ad.business.name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <p className="truncate text-xs font-medium text-white/90">{ad.business.name}</p>
          </div>

          <div>
            <p className="line-clamp-1 text-sm font-semibold">{ad.title}</p>
            <p className="line-clamp-2 text-xs text-white/80">{ad.tagline}</p>
          </div>

          <span className="inline-flex items-center gap-1 rounded-md border border-white/25 bg-white/10 px-2 py-1 text-[11px] font-semibold">
            {ad.ctaText}
            <ExternalLink className="h-3 w-3" />
          </span>
        </div>
      </div>
    </a>
  );
}

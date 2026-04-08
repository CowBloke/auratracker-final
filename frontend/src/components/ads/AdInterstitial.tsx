import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { resolveImageUrl } from '@/lib/images';
import { type Ad, adsApi } from '@/services/api';

function isExternalLink(url: string) {
  return /^https?:\/\//i.test(url);
}

export function AdInterstitial({
  ad,
  open,
  onComplete,
}: {
  ad: Ad | null;
  open: boolean;
  onComplete: () => void;
}) {
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!open || !ad) return;

    setCountdown(5);
    void adsApi.trackImpression(ad.id).catch(() => {});

    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [open, ad]);

  if (!ad) return null;

  const external = isExternalLink(ad.ctaLink);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && countdown > 0) return;
        if (!next) onComplete();
      }}
    >
      <DialogContent
        className="max-w-2xl overflow-hidden p-0 [&>button]:hidden"
        onInteractOutside={(event) => {
          if (countdown > 0) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (countdown > 0) event.preventDefault();
        }}
      >
        <div className="flex items-center justify-between bg-yellow-400 px-4 py-3 text-yellow-950">
          <p className="text-sm font-black uppercase tracking-[0.22em]">PUBLICITE</p>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-950 text-xs font-bold text-yellow-300">
            {countdown}
          </div>
        </div>

        <div className="space-y-4 p-4">
          {ad.imageUrl ? (
            <img src={resolveImageUrl(ad.imageUrl)} alt={ad.title} className="h-56 w-full rounded-lg object-cover" />
          ) : (
            <div className="flex h-56 w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">Annonce sponsorisee</div>
          )}

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{ad.business.name}</p>
            <h3 className="text-xl font-bold">{ad.title}</h3>
            <p className="text-sm text-muted-foreground">{ad.tagline}</p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={countdown > 0}
              onClick={onComplete}
            >
              {countdown > 0 ? `Attends ${countdown}s...` : 'Passer la pub'}
            </Button>
            <Button
              type="button"
              onClick={() => {
                void adsApi.trackClick(ad.id).catch(() => {});
                if (external) {
                  window.open(ad.ctaLink, '_blank', 'noopener,noreferrer');
                } else {
                  window.location.href = ad.ctaLink;
                }
                onComplete();
              }}
            >
              {ad.ctaText}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

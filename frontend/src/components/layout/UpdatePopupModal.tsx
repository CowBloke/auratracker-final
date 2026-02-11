import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usersApi, UserUpdatePopup } from '@/services/api';
import { resolveImageUrl } from '@/lib/images';

export default function UpdatePopupModal() {
  const [loading, setLoading] = useState(true);
  const [popups, setPopups] = useState<UserUpdatePopup[]>([]);
  const [index, setIndex] = useState(0);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadPendingPopups = async () => {
      try {
        const res = await usersApi.getPendingUpdatePopups();
        if (!mounted) {
          return;
        }
        setPopups(res.data.popups || []);
        setIndex(0);
      } catch {
        // Ignore to avoid blocking UI if endpoint fails.
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadPendingPopups();

    return () => {
      mounted = false;
    };
  }, []);

  const currentPopup = useMemo(() => {
    if (index < 0 || index >= popups.length) {
      return null;
    }
    return popups[index];
  }, [index, popups]);

  const handleNext = async () => {
    if (!currentPopup || marking) {
      return;
    }

    setMarking(true);
    try {
      await usersApi.markUpdatePopupViewed(currentPopup.id);
    } catch {
      // Keep UX moving even if marking fails once.
    } finally {
      setMarking(false);
    }

    if (index >= popups.length - 1) {
      setPopups([]);
      setIndex(0);
      return;
    }

    setIndex((value) => value + 1);
  };

  if (loading || !currentPopup) {
    return null;
  }

  const releaseDate = new Date(currentPopup.releaseDate);
  const releaseDateLabel = isNaN(releaseDate.getTime())
    ? currentPopup.releaseDate
    : releaseDate.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  const isLast = index === popups.length - 1;

  return (
    <Dialog open>
      <DialogContent
        className="max-w-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{currentPopup.title}</DialogTitle>
          <DialogDescription>
            Mise a jour du {releaseDateLabel} • {index + 1}/{popups.length}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {currentPopup.summary && (
            <p className="text-sm font-medium text-foreground/90">{currentPopup.summary}</p>
          )}

          {currentPopup.imageUrl && (
            <img
              src={resolveImageUrl(currentPopup.imageUrl)}
              alt={currentPopup.title}
              className="w-full max-h-72 rounded-lg border border-border/40 object-cover"
            />
          )}

          <div className="rounded-md border border-border/40 bg-muted/20 p-4">
            <p className="whitespace-pre-wrap text-sm text-foreground/90">{currentPopup.message}</p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleNext} disabled={marking}>
            {isLast ? 'Fermer' : 'Suivant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

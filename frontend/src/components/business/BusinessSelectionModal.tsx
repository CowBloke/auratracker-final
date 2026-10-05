import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Building2, Check, Star } from 'lucide-react';
import { AppModal } from '@/components/ui/app-modal';
import { cn } from '@/lib/utils';
import { Empty, EmptyHeader, EmptyDescription } from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import { Item } from '@/components/ui/item';

export type SelectableBusiness = {
  id: string;
  name: string;
  typeKey?: string;
  owner?: { username?: string | null } | null;
  avgRating?: number | null;
  ratingCount?: number;
};

type BusinessSelectionModalProps<TBusiness extends SelectableBusiness> = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  businesses: TBusiness[];
  selectedId?: string | null;
  confirmLabel?: string;
  emptyLabel?: string;
  isBusinessDisabled?: (business: TBusiness) => boolean;
  renderMeta?: (business: TBusiness) => ReactNode;
  onConfirm: (business: TBusiness) => void;
};

export function BusinessSelectionModal<TBusiness extends SelectableBusiness>({
  open,
  onClose,
  title,
  subtitle,
  businesses,
  selectedId,
  confirmLabel = 'Choisir',
  emptyLabel = 'Aucune entreprise disponible.',
  isBusinessDisabled,
  renderMeta,
  onConfirm,
}: BusinessSelectionModalProps<TBusiness>) {
  const firstAvailableId = useMemo(
    () => businesses.find((business) => !isBusinessDisabled?.(business))?.id ?? null,
    [businesses, isBusinessDisabled],
  );
  const [currentId, setCurrentId] = useState<string | null>(selectedId ?? firstAvailableId);

  useEffect(() => {
    if (open) setCurrentId(selectedId ?? firstAvailableId);
  }, [firstAvailableId, open, selectedId]);

  const selected = businesses.find((business) => business.id === currentId) ?? null;

  return (
    <AppModal open={open} onClose={onClose} tone="cyan" size="lg" description={subtitle ?? title}>
      <AppModal.Header icon={<Building2 />} tone="cyan" title={title} subtitle={subtitle} />
      <AppModal.Body scrollable maxHeight="62vh" className="space-y-2">
        {businesses.length === 0 ? (
          <Empty className="border"><EmptyHeader><EmptyDescription>
            {emptyLabel}
          </EmptyDescription></EmptyHeader></Empty>
        ) : (
          businesses.map((business) => {
            const disabled = Boolean(isBusinessDisabled?.(business));
            const active = business.id === currentId;
            return (
              <Item asChild size="sm" key={business.id} className={active ? 'bg-accent' : undefined}><button type="button" disabled={disabled} onClick={() => setCurrentId(business.id)} className="w-full text-left">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/12 text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{business.name}</p>
                    {business.avgRating != null && business.ratingCount ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                        <Star className="h-3 w-3 fill-current" />
                        {business.avgRating.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {business.owner?.username ? `Par ${business.owner.username}` : business.typeKey ?? 'Entreprise'}
                  </p>
                  {renderMeta ? <div className="mt-1">{renderMeta(business)}</div> : null}
                </div>
                {active && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-background">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
              </button></Item>
            );
          })
        )}
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose}>Annuler</AppModal.Button>
        <AppModal.Button
          tone="cyan"
          variant="solid"
          disabled={!selected || Boolean(selected && isBusinessDisabled?.(selected))}
          onClick={() => selected && onConfirm(selected)}
        >
          {confirmLabel}
        </AppModal.Button>
      </AppModal.Footer>
    </AppModal>
  );
}

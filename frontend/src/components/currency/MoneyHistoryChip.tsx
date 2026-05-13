import { useEffect, useState } from 'react';
import { Loader2, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
import { cn } from '@/lib/utils';
import { setMoneyIndicatorElement } from '@/lib/money-income-effects';
import { usersApi, type UserMoneyHistoryEntry } from '@/services/api';

type MoneyHistoryChipProps = {
  amount: number | undefined;
  className?: string;
};

export function MoneyHistoryChip({ amount, className }: MoneyHistoryChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<UserMoneyHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchEntries = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await usersApi.getMyMoneyHistory();
        setEntries(response.data.entries ?? []);
      } catch (fetchError) {
        console.error('Failed to fetch money history:', fetchError);
        setError("Impossible de charger l'historique.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchEntries();
  }, [isOpen]);

  const formatEntryDate = (date: string) =>
    new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));

  return (
    <>
      <div className="group relative flex shrink-0 items-center">
        <div ref={setMoneyIndicatorElement} className={cn(className)}>
          <CurrencyIcon type="money" className="h-3.5 w-3.5 text-emerald-400" />
          <span className="tabular-nums">{amount?.toLocaleString() ?? '0'} {'\u20AC'}</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setIsOpen(true)}
          className="pointer-events-none absolute right-0 top-[calc(100%-1px)] z-50 h-8 gap-2 whitespace-nowrap opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        >
          <ReceiptText className="h-4 w-4" />
          Historique
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Historique du money</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          ) : error ? (
            <p className="py-8 text-sm text-muted-foreground">{error}</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">Aucun mouvement trouve.</p>
          ) : (
            <ScrollArea className="max-h-[55vh] pr-4">
              <div className="divide-y divide-border/60">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.reason}</p>
                      <p className="text-xs text-muted-foreground">{formatEntryDate(entry.createdAt)}</p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-sm font-semibold',
                        entry.direction === 'in' ? 'text-emerald-500' : 'text-destructive'
                      )}
                    >
                      {entry.amount > 0 ? '+' : '-'}{Math.abs(entry.amount).toLocaleString()} {'\u20AC'}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

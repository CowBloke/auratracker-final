import { useEffect, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
import { setMoneyIndicatorElement } from '@/lib/money-income-effects';
import { usersApi, type UserMoneyHistoryEntry } from '@/services/api';

type MoneyHistoryChipProps = {
  amount: number | undefined;
};

const formatEntryDate = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

export function MoneyHistoryChip({ amount }: MoneyHistoryChipProps) {
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

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={setMoneyIndicatorElement}
            type="button"
            variant="outline"
            onClick={() => setIsOpen(true)}
            aria-label="Historique du money"
          >
            <CurrencyIcon type="money" />
            <span className="tabular-nums">{amount?.toLocaleString() ?? '0'} €</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Historique du money</TooltipContent>
      </Tooltip>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Historique du money</DialogTitle>
            <DialogDescription>Tes derniers mouvements d'argent.</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Spinner />
              Chargement…
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{error}</p>
          ) : entries.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ReceiptText />
                </EmptyMedia>
                <EmptyTitle>Aucun mouvement</EmptyTitle>
                <EmptyDescription>Tes transactions apparaîtront ici.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ScrollArea className="max-h-[55vh]">
              <ItemGroup>
                {entries.map((entry) => (
                  <Item key={entry.id} size="sm">
                    <ItemContent>
                      <ItemTitle>{entry.reason}</ItemTitle>
                      <ItemDescription>{formatEntryDate(entry.createdAt)}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <span className={entry.direction === 'in' ? 'font-semibold' : 'font-semibold text-destructive'}>
                        {entry.amount > 0 ? '+' : '-'}
                        {Math.abs(entry.amount).toLocaleString()} €
                      </span>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

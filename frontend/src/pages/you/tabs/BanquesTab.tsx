import { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark, Loader2, PiggyBank, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { type YouBankAccount, type YouBusiness, type YouState, youApi } from '@/services/api';
import { BankAccountModal } from '../components/modals';
import { formatMoney } from '../utils';

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="px-5 py-4">
        <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground/60">{label}</p>
        <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">{sub}</p>
      </CardContent>
    </Card>
  );
}

export function BanquesTab({
  data,
  onReload,
}: {
  data: YouState;
  userId: string;
  onReload: (refreshBalance?: boolean) => Promise<void>;
}) {
  const [accountsByBank, setAccountsByBank] = useState<Record<string, YouBankAccount[]>>({});
  const [loading, setLoading] = useState(true);
  const [managingBankId, setManagingBankId] = useState<string | null>(null);

  const allBanks = useMemo(() => {
    const map = new Map<string, YouBusiness>();
    [...data.ownedBusinesses, ...data.exploreBusinesses]
      .filter((business) => business.typeKey === 'bank')
      .forEach((bank) => map.set(bank.id, bank));
    return Array.from(map.values());
  }, [data.exploreBusinesses, data.ownedBusinesses]);

  const loadAccounts = useCallback(async () => {
    if (allBanks.length === 0) {
      setAccountsByBank({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const responses = await Promise.all(
        allBanks.map((bank) =>
          youApi.getBankAccounts(bank.id).catch(() => ({ data: { accounts: [] as YouBankAccount[] } })),
        ),
      );

      const next: Record<string, YouBankAccount[]> = {};
      allBanks.forEach((bank, index) => {
        next[bank.id] = responses[index]?.data.accounts ?? [];
      });
      setAccountsByBank(next);
    } finally {
      setLoading(false);
    }
  }, [allBanks]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const banksWithAccounts = useMemo(
    () => allBanks.filter((bank) => (accountsByBank[bank.id]?.length ?? 0) > 0),
    [accountsByBank, allBanks],
  );

  const totalAccounts = useMemo(
    () => Object.values(accountsByBank).reduce((count, accounts) => count + accounts.length, 0),
    [accountsByBank],
  );

  const totalBalance = useMemo(
    () => Object.values(accountsByBank).flat().reduce((sum, account) => sum + account.balance, 0),
    [accountsByBank],
  );

  const sortedBanks = useMemo(
    () =>
      [...allBanks].sort((a, b) => {
        const aCount = accountsByBank[a.id]?.length ?? 0;
        const bCount = accountsByBank[b.id]?.length ?? 0;
        if (bCount !== aCount) return bCount - aCount;
        return a.name.localeCompare(b.name, 'fr');
      }),
    [accountsByBank, allBanks],
  );

  const managingBank = managingBankId ? allBanks.find((bank) => bank.id === managingBankId) ?? null : null;

  const handleSubmitted = async () => {
    await loadAccounts();
    await onReload(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="Comptes ouverts"
          value={loading ? '...' : String(totalAccounts)}
          sub={loading ? 'Chargement des banques...' : `${banksWithAccounts.length} banque${banksWithAccounts.length > 1 ? 's' : ''} utilisee${banksWithAccounts.length > 1 ? 's' : ''}`}
        />
        <SummaryCard
          label="Solde total en banque"
          value={loading ? '...' : `${formatMoney(totalBalance)} €`}
          sub="Cumule de tous tes comptes courants et epargne"
        />
        <SummaryCard
          label="Banques disponibles"
          value={String(allBanks.length)}
          sub="Tu peux ouvrir des comptes depuis chaque banque"
        />
      </div>

      {allBanks.length === 0 ? (
        <Card>
          <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">
            Aucune banque n&apos;est disponible pour le moment.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3 px-5 py-4">
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement des comptes...
              </div>
            ) : (
              sortedBanks.map((bank) => {
                const accounts = accountsByBank[bank.id] ?? [];
                return (
                  <div key={bank.id} className="rounded-2xl border border-border/40 bg-muted/10 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Landmark className="h-4 w-4 text-emerald-400" />
                          <p className="text-sm font-semibold">{bank.name}</p>
                          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            {accounts.length} compte{accounts.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Proprietaire: {bank.owner.username} · Taux: {(bank.loanInterestRate ?? 4).toLocaleString('fr-FR')} %
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                            <PiggyBank className="h-3 w-3" />
                            Compte courant
                          </span>
                          {bank.livretEpargneUnlocked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                              <Sparkles className="h-3 w-3" />
                              Livret epargne disponible
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => setManagingBankId(bank.id)}
                      >
                        Gerer mes comptes
                      </Button>
                    </div>

                    {accounts.length > 0 ? (
                      <div className="mt-3 space-y-2 border-t border-border/30 pt-3">
                        {accounts.map((account) => {
                          const isEpargne = account.accountType === 'EPARGNE';
                          return (
                            <div key={account.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/30 bg-background/40 px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="text-xs font-medium">
                                  {isEpargne ? 'Livret epargne' : 'Compte courant'}
                                </p>
                                <p className="text-[11px] text-muted-foreground">Ouvert le {new Date(account.createdAt).toLocaleDateString('fr-FR')}</p>
                              </div>
                              <p className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(account.balance)} €</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">Aucun compte dans cette banque.</p>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      <BankAccountModal
        open={Boolean(managingBank)}
        onClose={() => setManagingBankId(null)}
        business={managingBank}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}

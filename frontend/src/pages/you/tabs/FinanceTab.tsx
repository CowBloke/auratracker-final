import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeDollarSign,
  Building2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Coins,
  Landmark,
  Loader2,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import {
  type AuraCoinTransaction,
  type AuraTransferEntry,
  type YouBankAccount,
  type YouBusiness,
  type YouBusinessTransaction,
  type YouState,
  auraCoinApi,
  economyApi,
  youApi,
} from '@/services/api';
import { cn } from '@/lib/utils';
import { Pill, SectionTitle } from '../components/ui';
import { formatMoney } from '../utils';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const TX_META: Record<string, { label: string; color: string; bg: string; Icon: typeof TrendingUp; sign: '+' | '-' | '~' }> = {
  DEPOSIT:        { label: 'Dépôt propriétaire',   color: 'text-emerald-400', bg: 'bg-emerald-400/15', Icon: ArrowDownLeft,       sign: '+' },
  WITHDRAW:       { label: 'Retrait propriétaire',  color: 'text-rose-400',    bg: 'bg-rose-400/15',    Icon: ArrowUpRight,        sign: '-' },
  LOAN_ISSUE:     { label: 'Prêt accordé',          color: 'text-amber-400',   bg: 'bg-amber-400/15',   Icon: Landmark,            sign: '-' },
  LOAN_REPAY:     { label: 'Remboursement prêt',    color: 'text-sky-400',     bg: 'bg-sky-400/15',     Icon: Landmark,            sign: '+' },
  NPC_COLLECT:    { label: 'Recettes clients',       color: 'text-lime-400',    bg: 'bg-lime-400/15',    Icon: BadgeDollarSign,     sign: '+' },
  ITEM_SALE:      { label: 'Vente article',          color: 'text-lime-400',    bg: 'bg-lime-400/15',    Icon: BadgeDollarSign,     sign: '+' },
  DAILY_REVENUE:  { label: 'Revenu quotidien',       color: 'text-emerald-400', bg: 'bg-emerald-400/15', Icon: TrendingUp,          sign: '+' },
  BANK_DEPOSIT:   { label: 'Dépôt bancaire',         color: 'text-emerald-400', bg: 'bg-emerald-400/15', Icon: Landmark,            sign: '+' },
  BANK_WITHDRAW:  { label: 'Retrait bancaire',        color: 'text-rose-400',    bg: 'bg-rose-400/15',    Icon: Landmark,            sign: '-' },
  BANK_INTEREST:  { label: 'Intérêts bancaires',     color: 'text-sky-400',     bg: 'bg-sky-400/15',     Icon: TrendingUp,          sign: '+' },
  FORMATION_SALE: { label: 'Vente formation',        color: 'text-purple-400',  bg: 'bg-purple-400/15',  Icon: CircleDollarSign,    sign: '+' },
  SALARY_PAYMENT: { label: 'Salaire versé',          color: 'text-rose-400',    bg: 'bg-rose-400/15',    Icon: Users,               sign: '-' },
};

function getDailyBusinessRevenue(monthlyRevenue: number) {
  return monthlyRevenue > 0 ? Math.max(1, Math.round(monthlyRevenue / 30)) : 0;
}

function getTxMeta(type: string) {
  return TX_META[type] ?? { label: type, color: 'text-muted-foreground', bg: 'bg-muted/20', Icon: Coins, sign: '~' as const };
}

// ── stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: typeof Wallet; color: string }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground/60">{label}</p>
            <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</p>
            {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground/70">{sub}</p> : null}
          </div>
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', color)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── bank account row ──────────────────────────────────────────────────────────

function BankAccountRow({
  account,
  business,
  isOwner,
  onAction,
}: {
  account: YouBankAccount;
  business: YouBusiness;
  isOwner: boolean;
  onAction: (accountId: string, businessId: string, action: 'deposit' | 'withdraw') => void;
}) {
  const typeLabel = account.accountType === 'COURANT' ? 'Compte courant' : 'Livret épargne';
  const typeColor = account.accountType === 'COURANT' ? 'bg-sky-400/15 text-sky-400' : 'bg-purple-400/15 text-purple-400';

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Landmark className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-sm font-medium">{business.name}</span>
          <Pill label={typeLabel} color={typeColor} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Solde : <span className="font-semibold text-foreground">{formatMoney(account.balance)} €</span>
          <span className="ml-2 text-muted-foreground/50">Ouvert le {fmtDate(account.createdAt)}</span>
        </p>
      </div>
      {isOwner ? (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction(account.id, business.id, 'deposit')}>
            Déposer
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction(account.id, business.id, 'withdraw')}>
            Retirer
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ── transfer row ──────────────────────────────────────────────────────────────

function TransferRow({ transfer, userId }: { transfer: AuraTransferEntry; userId: string }) {
  const isOutgoing = transfer.senderId === userId;
  const counterparty = isOutgoing ? transfer.receiver : transfer.sender;
  const Icon = isOutgoing ? ArrowUpRight : ArrowDownLeft;
  const iconColor = isOutgoing ? 'text-rose-400' : 'text-emerald-400';
  const iconBg = isOutgoing ? 'bg-rose-400/15' : 'bg-emerald-400/15';

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-3.5 w-3.5', iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {isOutgoing ? 'Envoi à' : 'Reçu de'}{' '}
          <span className="font-semibold">{counterparty?.username ?? 'inconnu'}</span>
        </p>
        {transfer.message ? (
          <p className="text-[11px] text-muted-foreground/70 italic truncate">"{transfer.message}"</p>
        ) : null}
        <p className="text-[11px] text-muted-foreground/50">{fmtDateTime(transfer.createdAt)}</p>
      </div>
      <div className="shrink-0 text-right">
        {transfer.auraAmount !== 0 ? (
          <p className={cn('text-sm font-semibold tabular-nums', isOutgoing ? 'text-rose-400' : 'text-emerald-400')}>
            {isOutgoing ? '-' : '+'}{Math.abs(transfer.auraAmount).toLocaleString('fr-FR')} aura
          </p>
        ) : null}
        {transfer.moneyAmount !== 0 ? (
          <p className={cn('text-xs tabular-nums', isOutgoing ? 'text-rose-300' : 'text-emerald-300')}>
            {isOutgoing ? '-' : '+'}{formatMoney(Math.abs(transfer.moneyAmount))} €
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── auracoin tx row ───────────────────────────────────────────────────────────

function AuraCoinTxRow({ tx }: { tx: AuraCoinTransaction }) {
  const isBuy = tx.type === 'BUY';
  const Icon = isBuy ? TrendingUp : TrendingDown;
  const iconColor = isBuy ? 'text-emerald-400' : 'text-rose-400';
  const iconBg = isBuy ? 'bg-emerald-400/15' : 'bg-rose-400/15';
  const moneySign = isBuy ? '-' : '+';
  const moneyColor = isBuy ? 'text-rose-400' : 'text-emerald-400';

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-3.5 w-3.5', iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{isBuy ? 'Achat AuraCoin' : 'Vente AuraCoin'}</p>
        <p className="text-[11px] text-muted-foreground/60">
          {tx.coinAmount.toLocaleString('fr-FR')} coins · prix {tx.price.toFixed(2)} € · frais {formatMoney(tx.fee)} €
        </p>
        <p className="text-[11px] text-muted-foreground/50">{fmtDateTime(tx.createdAt)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn('text-sm font-semibold tabular-nums', isBuy ? 'text-emerald-400' : 'text-rose-400')}>
          {isBuy ? '+' : '-'}{tx.coinAmount.toLocaleString('fr-FR')} <span className="text-xs font-normal">coins</span>
        </p>
        <p className={cn('text-xs tabular-nums', moneyColor)}>
          {moneySign}{formatMoney(tx.moneyAmount)} €
        </p>
      </div>
    </div>
  );
}

// ── collapsible section ───────────────────────────────────────────────────────

function Section({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between group"
      >
        <SectionTitle>
          {title}{count !== undefined ? ` (${count})` : ''}
        </SectionTitle>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
        )}
      </button>
      {open ? children : null}
    </div>
  );
}

// ── inline bank action form ────────────────────────────────────────────────────

function BankActionForm({
  action,
  onSubmit,
  onCancel,
  loading,
}: {
  action: 'deposit' | 'withdraw';
  onSubmit: (amount: number) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(value.replace(',', '.'));
    if (isNaN(n) || n <= 0) { toast.error('Montant invalide'); return; }
    onSubmit(n);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
      <Input
        ref={inputRef}
        type="number"
        min="1"
        step="1"
        placeholder={action === 'deposit' ? 'Montant à déposer' : 'Montant à retirer'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 text-sm"
      />
      <Button type="submit" size="sm" className="h-8 shrink-0 text-xs" disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (action === 'deposit' ? 'Déposer' : 'Retirer')}
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-8 shrink-0 text-xs" onClick={onCancel} disabled={loading}>
        Annuler
      </Button>
    </form>
  );
}

// ── main tab ──────────────────────────────────────────────────────────────────

export function FinanceTab({
  data,
  userId,
  onReload,
}: {
  data: YouState;
  userId: string;
  onReload: (refreshBalance?: boolean) => Promise<void>;
}) {
  const { user } = useAuth();

  // Async data
  const [bankAccounts, setBankAccounts] = useState<Record<string, YouBankAccount[]>>({});
  const [businessTxns, setBusinessTxns] = useState<YouBusinessTransaction[]>([]);
  const [selectedBizId, setSelectedBizId] = useState<string | null>(data.ownedBusinesses[0]?.id ?? null);
  const [txLoading, setTxLoading] = useState(false);
  const [transfers, setTransfers] = useState<AuraTransferEntry[]>([]);
  const [auraCoinTxns, setAuraCoinTxns] = useState<AuraCoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Bank action
  const [activeBank, setActiveBank] = useState<{ accountId: string; businessId: string; action: 'deposit' | 'withdraw' } | null>(null);
  const [bankLoading, setBankLoading] = useState(false);

  // Transfer filter
  const [transferFilter, setTransferFilter] = useState<'all' | 'sent' | 'received'>('all');

  // Load on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [transfersRes, auraCoinRes] = await Promise.all([
          economyApi.getTransfers({ limit: 100 }),
          auraCoinApi.getMyTransactions({ limit: 50 }),
        ]);
        if (cancelled) return;
        setTransfers(transfersRes.data.transfers);
        setAuraCoinTxns(auraCoinRes.data.transactions);

        if (data.ownedBusinesses.length > 0) {
          const results = await Promise.all(
            data.ownedBusinesses.map((b) =>
              youApi.getBankAccounts(b.id).catch(() => ({ data: { accounts: [] as YouBankAccount[] } }))
            )
          );
          if (cancelled) return;
          const map: Record<string, YouBankAccount[]> = {};
          data.ownedBusinesses.forEach((b, i) => { map[b.id] = results[i].data.accounts; });
          setBankAccounts(map);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [data.ownedBusinesses]);

  // Load business transactions when selection changes
  useEffect(() => {
    if (!selectedBizId) return;
    setTxLoading(true);
    setBusinessTxns([]);
    youApi.getBusinessTransactions(selectedBizId)
      .then((res) => setBusinessTxns(res.data.transactions))
      .catch(() => setBusinessTxns([]))
      .finally(() => setTxLoading(false));
  }, [selectedBizId]);

  // Bank action handler
  const handleBankSubmit = async (amount: number) => {
    if (!activeBank) return;
    setBankLoading(true);
    try {
      if (activeBank.action === 'deposit') {
        await youApi.bankAccountDeposit(activeBank.accountId, amount);
        toast.success('Dépôt effectué');
      } else {
        await youApi.bankAccountWithdraw(activeBank.accountId, amount);
        toast.success('Retrait effectué');
      }
      // Refresh accounts for this business
      const res = await youApi.getBankAccounts(activeBank.businessId);
      setBankAccounts((prev) => ({ ...prev, [activeBank.businessId]: res.data.accounts }));
      // Refresh business transactions if we're viewing this business
      if (selectedBizId === activeBank.businessId) {
        const txRes = await youApi.getBusinessTransactions(activeBank.businessId);
        setBusinessTxns(txRes.data.transactions);
      }
      setActiveBank(null);
      await onReload(true);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Erreur lors de l\'opération.');
    } finally {
      setBankLoading(false);
    }
  };

  // Computed aggregates
  const marriedRel = data.relationships.find((r) => r.status === 'MARRIED');
  const totalBankBalance = Object.values(bankAccounts).flat().reduce((sum, a) => sum + a.balance, 0);
  const totalTreasury = data.ownedBusinesses.reduce((sum, b) => sum + b.treasuryMoney, 0);
  const totalDailyRevenue = data.ownedBusinesses.reduce((sum, b) => sum + getDailyBusinessRevenue(b.monthlyRevenue), 0);
  const dailySalary = data.memberBusinesses.reduce((sum, b) => {
    const me = b.members.find((m) => m.user.id === userId);
    return sum + (me?.salary ?? 0);
  }, 0);

  // All active loans across owned businesses
  const activeLoans = data.ownedBusinesses.flatMap((b) =>
    b.recentLoans
      .filter((l) => l.status === 'ACCEPTED' || l.status === 'ACTIVE')
      .map((l) => ({ ...l, businessName: b.name, businessId: b.id }))
  );

  // Recent investments received across owned businesses
  const recentInvestments = data.ownedBusinesses.flatMap((b) =>
    b.recentInvestments.map((inv) => ({ ...inv, businessName: b.name }))
  );

  // Transfer history (from business data, not API — P2P between businesses)
  const allTransferHistory = data.ownedBusinesses.flatMap((b) =>
    b.transferHistory.map((t) => ({ ...t, businessName: b.name }))
  );

  const filteredTransfers = transfers.filter((t) => {
    if (transferFilter === 'sent') return t.senderId === userId;
    if (transferFilter === 'received') return t.receiverId === userId;
    return true;
  });

  const allBankAccountsList = data.ownedBusinesses.flatMap((b) =>
    (bankAccounts[b.id] ?? []).map((a) => ({ account: a, business: b }))
  );

  const selectedBusiness = data.ownedBusinesses.find((b) => b.id === selectedBizId);

  // Business tx running balance
  const txWithBalance = (() => {
    let running = selectedBusiness?.treasuryMoney ?? 0;
    return businessTxns.map((tx) => {
      const balance = running;
      running -= tx.amount;
      return { tx, balanceAfter: balance };
    });
  })();

  return (
    <div className="space-y-8">

      {/* ── Summary ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Argent sur toi"
          value={`${(user?.money ?? 0).toLocaleString('fr-FR')} €`}
          sub={marriedRel ? `Compte commun : ${formatMoney(marriedRel.coupleBalance)} €` : undefined}
          icon={Wallet}
          color="bg-emerald-400/15 text-emerald-400"
        />
        <StatCard
          label="Trésoreries entreprises"
          value={`${formatMoney(totalTreasury)} €`}
          sub={`sur ${data.ownedBusinesses.length} entreprise${data.ownedBusinesses.length !== 1 ? 's' : ''}`}
          icon={Building2}
          color="bg-sky-400/15 text-sky-400"
        />
        <StatCard
          label="Comptes bancaires"
          value={loading ? '—' : `${formatMoney(totalBankBalance)} €`}
          sub={loading ? 'Chargement…' : `${allBankAccountsList.length} compte${allBankAccountsList.length !== 1 ? 's' : ''}`}
          icon={Landmark}
          color="bg-purple-400/15 text-purple-400"
        />
        <StatCard
          label="Revenus journaliers"
          value={`${formatMoney(totalDailyRevenue + dailySalary)} €`}
          sub={`${formatMoney(totalDailyRevenue)} entreprises · ${formatMoney(dailySalary)} salaires`}
          icon={TrendingUp}
          color="bg-amber-400/15 text-amber-400"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-8">

          {/* ── Bank accounts ── */}
          <Section title="Comptes bancaires" count={allBankAccountsList.length}>
            {loading ? (
              <Card><CardContent className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
              </CardContent></Card>
            ) : allBankAccountsList.length === 0 ? (
              <Card><CardContent className="px-5 py-6 text-center text-sm text-muted-foreground">
                Aucun compte bancaire. Ouvre un compte depuis un business de type banque.
              </CardContent></Card>
            ) : (
              <Card>
                <CardContent className="divide-y divide-border/30 px-5 py-2">
                  {allBankAccountsList.map(({ account, business }) => {
                    const isActionActive = activeBank?.accountId === account.id;
                    return (
                      <div key={account.id} className="py-3">
                        <BankAccountRow
                          account={account}
                          business={business}
                          isOwner={business.ownerId === userId}
                          onAction={(accountId, businessId, action) =>
                            setActiveBank(isActionActive ? null : { accountId, businessId, action })
                          }
                        />
                        {isActionActive ? (
                          <BankActionForm
                            action={activeBank.action}
                            onSubmit={handleBankSubmit}
                            onCancel={() => setActiveBank(null)}
                            loading={bankLoading}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </Section>

          {/* ── Active loans ── */}
          <Section title="Prêts actifs" count={activeLoans.length} defaultOpen={activeLoans.length > 0}>
            {activeLoans.length === 0 ? (
              <Card><CardContent className="px-5 py-6 text-center text-sm text-muted-foreground">
                Aucun prêt actif en cours.
              </CardContent></Card>
            ) : (
              <Card>
                <CardContent className="divide-y divide-border/30 px-5 py-2">
                  {activeLoans.map((loan) => {
                    const totalOwed = Math.round(loan.amount * (1 + loan.interestRate / 100));
                    const remaining = Math.max(0, totalOwed - (loan.repaidAmount ?? 0));
                    const repaidPct = totalOwed > 0 ? Math.round(((loan.repaidAmount ?? 0) / totalOwed) * 100) : 0;
                    return (
                      <div key={loan.id} className="py-3">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Landmark className="h-3.5 w-3.5 text-amber-400" />
                          <span className="text-sm font-medium">{loan.businessName}</span>
                          <Pill label={`${loan.borrower.username}`} color="bg-amber-400/15 text-amber-300" />
                          <Pill label={`${loan.interestRate}%`} color="bg-muted/30 text-muted-foreground" />
                          <Pill label={`${loan.termDays}j`} color="bg-muted/30 text-muted-foreground" />
                        </div>
                        <div className="space-y-1 mt-2">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Principal : {formatMoney(loan.amount)} €</span>
                            <span>Total dû : {formatMoney(totalOwed)} €</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${repaidPct}%` }} />
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground/60">Remboursé : {repaidPct}%</span>
                            <span className="font-semibold text-amber-400">Reste : {formatMoney(remaining)} €</span>
                          </div>
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground/50">Demandé le {fmtDate(loan.createdAt)}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </Section>

          {/* ── Recent investments ── */}
          <Section title="Investissements reçus" count={recentInvestments.length} defaultOpen={recentInvestments.length > 0}>
            {recentInvestments.length === 0 ? (
              <Card><CardContent className="px-5 py-6 text-center text-sm text-muted-foreground">
                Aucun investissement reçu.
              </CardContent></Card>
            ) : (
              <Card>
                <CardContent className="divide-y divide-border/30 px-5 py-2">
                  {recentInvestments.map((inv) => {
                    const riskColor = inv.riskLevel === 'low' ? 'bg-emerald-400/15 text-emerald-400'
                      : inv.riskLevel === 'high' ? 'bg-rose-400/15 text-rose-400'
                      : 'bg-amber-400/15 text-amber-400';
                    return (
                      <div key={inv.id} className="py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <TrendingUp className="h-3.5 w-3.5 text-sky-400" />
                          <span className="text-sm font-medium">{inv.businessName}</span>
                          <Pill label={inv.investor.username} color="bg-sky-400/15 text-sky-400" />
                          <Pill label={inv.riskLevel} color={riskColor} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Montant : <span className="font-semibold text-foreground">{formatMoney(inv.amount)} €</span>
                          <span className="ml-2">Retour estimé : {formatMoney(inv.expectedReturnMin)}–{formatMoney(inv.expectedReturnMax)} €</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground/50">{fmtDate(inv.createdAt)}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </Section>

          {/* ── Business transfer history ── */}
          {allTransferHistory.length > 0 ? (
            <Section title="Virements inter-entreprises" count={allTransferHistory.length} defaultOpen={false}>
              <Card>
                <CardContent className="divide-y divide-border/30 px-5 py-2">
                  {allTransferHistory.map((t) => {
                    const isOutgoing = t.sender.id === userId;
                    return (
                      <div key={t.id} className="flex items-center gap-3 py-2.5">
                        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', isOutgoing ? 'bg-rose-400/15' : 'bg-emerald-400/15')}>
                          {isOutgoing ? <ArrowUpRight className="h-3.5 w-3.5 text-rose-400" /> : <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {isOutgoing ? `Virement vers ${t.recipient.username}` : `Virement de ${t.sender.username}`}
                            <span className="ml-2 text-[11px] text-muted-foreground/60">· {t.businessName}</span>
                          </p>
                          {t.fee > 0 ? <p className="text-[11px] text-muted-foreground/60">Frais : {formatMoney(t.fee)} € ({(t.feeRate * 100).toFixed(1)}%)</p> : null}
                          <p className="text-[11px] text-muted-foreground/50">{fmtDateTime(t.createdAt)}</p>
                        </div>
                        <span className={cn('shrink-0 text-sm font-semibold tabular-nums', isOutgoing ? 'text-rose-400' : 'text-emerald-400')}>
                          {isOutgoing ? '-' : '+'}{formatMoney(t.amount)} €
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </Section>
          ) : null}

        </div>

        <div className="space-y-8">

          {/* ── Business transaction ledger ── */}
          <Section title="Ledger entreprise">
            {data.ownedBusinesses.length === 0 ? (
              <Card><CardContent className="px-5 py-6 text-center text-sm text-muted-foreground">
                Aucune entreprise. Crée-en une dans l'onglet Travail.
              </CardContent></Card>
            ) : (
              <div className="space-y-3">
                {/* Business selector */}
                <div className="flex flex-wrap gap-2">
                  {data.ownedBusinesses.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBizId(b.id)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                        selectedBizId === b.id
                          ? 'border-transparent bg-foreground text-background'
                          : 'border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground'
                      )}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>

                {/* Trésorerie actuelle */}
                {selectedBusiness ? (
                  <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/30 bg-muted/10 px-4 py-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Trésorerie actuelle</p>
                      <p className="text-lg font-semibold tabular-nums">{formatMoney(selectedBusiness.treasuryMoney)} €</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Rev. mensuel</p>
                      <p className="text-lg font-semibold tabular-nums text-emerald-400">+{formatMoney(selectedBusiness.monthlyRevenue)} €</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Dépenses mens.</p>
                      <p className="text-lg font-semibold tabular-nums text-rose-400">-{formatMoney(selectedBusiness.monthlyExpenses)} €</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Solde net</p>
                      <p className={cn('text-lg font-semibold tabular-nums', (selectedBusiness.monthlyRevenue - selectedBusiness.monthlyExpenses) >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                        {selectedBusiness.monthlyRevenue - selectedBusiness.monthlyExpenses >= 0 ? '+' : ''}
                        {formatMoney(selectedBusiness.monthlyRevenue - selectedBusiness.monthlyExpenses)} €
                      </p>
                    </div>
                  </div>
                ) : null}

                <Card>
                  <CardContent className="px-5 py-2">
                    {txLoading ? (
                      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Chargement du ledger…
                      </div>
                    ) : businessTxns.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">Aucune transaction enregistrée.</p>
                    ) : (
                      <div className="divide-y divide-border/20">
                        {txWithBalance.map(({ tx, balanceAfter }) => (
                          <div key={tx.id} className="flex items-center gap-3 py-2.5">
                            {(() => {
                              const meta = getTxMeta(tx.type);
                              const Icon = meta.Icon;
                              const isPos = tx.amount > 0;
                              return (
                                <>
                                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.bg)}>
                                    <Icon className={cn('h-3.5 w-3.5', meta.color)} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium leading-tight">{tx.label}</p>
                                    <p className="text-[11px] text-muted-foreground/60">{meta.label} · {fmtDateTime(tx.createdAt)}</p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className={cn('text-sm font-semibold tabular-nums', isPos ? 'text-emerald-400' : 'text-rose-400')}>
                                      {isPos ? '+' : ''}{formatMoney(tx.amount)} €
                                    </p>
                                    <p className="text-[11px] text-muted-foreground/50 tabular-nums">{formatMoney(balanceAfter)} €</p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </Section>

          {/* ── P2P Transfers ── */}
          <Section title="Transferts aura / money" count={filteredTransfers.length}>
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['all', 'sent', 'received'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTransferFilter(f)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      transferFilter === f
                        ? 'border-transparent bg-foreground text-background'
                        : 'border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground'
                    )}
                  >
                    {f === 'all' ? 'Tous' : f === 'sent' ? 'Envoyés' : 'Reçus'}
                  </button>
                ))}
              </div>
              <Card>
                <CardContent className="px-5 py-2">
                  {loading ? (
                    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                    </div>
                  ) : filteredTransfers.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Aucun transfert trouvé.</p>
                  ) : (
                    <div className="divide-y divide-border/20">
                      {filteredTransfers.map((t) => (
                        <TransferRow key={t.id} transfer={t} userId={userId} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </Section>

          {/* ── AuraCoin ── */}
          <Section title="AuraCoin — historique" count={auraCoinTxns.length} defaultOpen={auraCoinTxns.length > 0}>
            <Card>
              <CardContent className="px-5 py-2">
                {loading ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                  </div>
                ) : auraCoinTxns.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Aucune transaction AuraCoin.</p>
                ) : (
                  <div className="divide-y divide-border/20">
                    {auraCoinTxns.map((tx) => (
                      <AuraCoinTxRow key={tx.id} tx={tx} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </Section>

        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Coins, Gift, Sparkles, X } from 'lucide-react';
import { type RewardItem } from '../../contexts/RewardQueueContext';

interface Props {
  items: RewardItem[];
  currentIndex: number;
  phase: 'collecting' | 'summary';
  onAdvance: () => void;
  onClose: () => void;
}

const rarityBorder: Record<string, string> = {
  common: 'border-border',
  rare: 'border-sky-500/60',
  epic: 'border-fuchsia-500/60',
  legendary: 'border-amber-500/70',
};

const rarityBg: Record<string, string> = {
  common: 'bg-card',
  rare: 'bg-sky-950/60',
  epic: 'bg-fuchsia-950/60',
  legendary: 'bg-amber-950/60',
};

const rarityIconColor: Record<string, string> = {
  common: '',
  rare: 'text-sky-400',
  epic: 'text-fuchsia-400',
  legendary: 'text-amber-400',
};

const typeIconColor: Record<string, string> = {
  money: 'text-yellow-400',
  aura: 'text-purple-400',
  item: 'text-blue-400',
};

function RewardIcon({ item }: { item: RewardItem }) {
  const color =
    item.rarity && item.rarity !== 'common'
      ? rarityIconColor[item.rarity]
      : typeIconColor[item.type];
  const Icon = item.type === 'money' ? Coins : item.type === 'aura' ? Sparkles : Gift;
  return <Icon className={`h-14 w-14 ${color}`} strokeWidth={1.5} />;
}

export default function RewardCollector({ items, currentIndex, phase, onAdvance, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, [currentIndex, phase]);

  const current = items[currentIndex];
  const remaining = items.length - currentIndex - 1;

  const handleCardClick = () => {
    setVisible(false);
    setTimeout(onAdvance, 150);
  };

  if (phase === 'summary') {
    const totals = items.reduce(
      (acc, item) => {
        if (item.type === 'money') acc.money += item.amount;
        else if (item.type === 'aura') acc.aura += item.amount;
        else acc.itemRewards.push(item);
        return acc;
      },
      { money: 0, aura: 0, itemRewards: [] as RewardItem[] },
    );

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div
          className={`w-80 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/60 transition-all duration-200 ${
            visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Récompenses collectées
            </p>
            <button
              onClick={onClose}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {totals.money > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3">
                <Coins className="h-5 w-5 text-yellow-400" />
                <span className="text-lg font-bold">+{totals.money.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">coins</span>
              </div>
            )}
            {totals.aura > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-purple-500/20 bg-purple-500/10 px-4 py-3">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <span className="text-lg font-bold">+{totals.aura.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">aura</span>
              </div>
            )}
            {totals.itemRewards.map((item, i) => {
              const border = item.rarity ? rarityBorder[item.rarity] : 'border-blue-500/20';
              const bg = item.rarity ? rarityBg[item.rarity] : 'bg-blue-500/10';
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-xl border ${border} ${bg} px-4 py-3`}
                >
                  <Gift className="h-5 w-5 text-blue-400" />
                  <span className="font-bold">{item.label}</span>
                </div>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const rarity = current.rarity ?? 'common';

  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleCardClick}
    >
      <div
        className={`relative flex w-72 select-none flex-col items-center gap-6 rounded-3xl border ${rarityBorder[rarity]} ${rarityBg[rarity]} px-10 py-12 shadow-2xl shadow-black/60 transition-all duration-200 ${
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-6 scale-90 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {remaining > 0 && (
          <div className="absolute right-4 top-4 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
            +{remaining}
          </div>
        )}

        <RewardIcon item={current} />

        <div className="space-y-1 text-center">
          <p className="text-4xl font-bold">
            {current.amount > 0 ? `+${current.amount.toLocaleString()}` : current.label}
          </p>
          {current.amount > 0 && (
            <p className="text-base text-muted-foreground">{current.label}</p>
          )}
        </div>

        <button
          onClick={handleCardClick}
          className="mt-2 rounded-xl bg-primary px-8 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {remaining > 0 ? 'Continuer' : 'Voir le résumé'}
        </button>
      </div>
    </div>
  );
}

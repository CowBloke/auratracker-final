import { type ComponentType } from 'react';
import { Coins, Zap } from 'lucide-react';

type CurrencyType = 'aura' | 'money';

const ICONS: Record<CurrencyType, ComponentType<{ className?: string }>> = {
  aura: Zap,
  money: Coins,
};

export function CurrencyIcon({ type, className }: { type: CurrencyType; className?: string }) {
  const Icon = ICONS[type];

  return <Icon className={className} />;
}

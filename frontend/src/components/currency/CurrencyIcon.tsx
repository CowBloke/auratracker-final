import { type ComponentType } from 'react';
import { Coins, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type CurrencyType = 'aura' | 'money';

const ICONS: Record<CurrencyType, { Icon: ComponentType<{ className?: string }>; color: string }> = {
  aura: { Icon: Zap, color: 'text-yellow-400' },
  money: { Icon: Coins, color: 'text-emerald-400' },
};

export function CurrencyIcon({ type, className }: { type: CurrencyType; className?: string }) {
  const { Icon, color } = ICONS[type];

  return <Icon className={cn(className, color)} />;
}

import { useEffect, useState } from 'react';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
import { getMoneyIndicatorRect, subscribeToMoneyIncome } from '@/lib/money-income-effects';

type CoinParticle = {
  id: string;
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  delay: number;
  duration: number;
  size: number;
};

type MoneyBurst = {
  id: string;
  amount: number;
  labelStartX: number;
  labelStartY: number;
  particles: CoinParticle[];
};

function createBurst(amount: number): MoneyBurst {
  const targetRect = getMoneyIndicatorRect();
  const targetX = targetRect ? targetRect.left + targetRect.width / 2 : window.innerWidth - 72;
  const targetY = targetRect ? targetRect.top + targetRect.height / 2 : 44;
  const originX = targetX;
  const originY = targetY + 24;
  const particleCount = Math.max(4, Math.min(10, Math.round(Math.log10(amount + 10) * 4)));
  const idBase = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: idBase,
    amount,
    labelStartX: originX,
    labelStartY: originY + 6,
    particles: Array.from({ length: particleCount }, (_, index) => ({
      id: `${idBase}-${index}`,
      startX: originX + (Math.random() - 0.5) * 42,
      startY: originY + Math.random() * 16,
      driftX: (Math.random() - 0.5) * 24,
      driftY: -8 - Math.random() * 12,
      delay: index * 36,
      duration: 560 + Math.random() * 140,
      size: 14 + Math.round(Math.random() * 8),
    })),
  };
}

export default function MoneyIncomeOverlay() {
  const [bursts, setBursts] = useState<MoneyBurst[]>([]);

  useEffect(() => {
    return subscribeToMoneyIncome((amount) => {
      const burst = createBurst(amount);
      setBursts((prev) => [...prev, burst]);

      window.setTimeout(() => {
        setBursts((prev) => prev.filter((entry) => entry.id !== burst.id));
      }, 1100);
    });
  }, []);

  if (!bursts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      <style>{`
        @keyframes money-income-label {
          0% {
            opacity: 0;
            transform: translate(-50%, 10px) scale(0.84);
          }
          22% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
          84% {
            opacity: 0.92;
            transform: translate(-50%, -16px) scale(0.9);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -22px) scale(0.72);
          }
        }

        @keyframes money-income-coin {
          0% {
            opacity: 0;
            transform: translate(var(--drift-x), var(--drift-y)) scale(0.5);
          }
          20% {
            opacity: 1;
            transform: translate(calc(var(--drift-x) * 0.45), calc(var(--drift-y) * 0.45)) scale(1);
          }
          82% {
            opacity: 0.9;
            transform: translate(calc(var(--target-x) * 0.8), calc(var(--target-y) * 0.8)) scale(0.74);
          }
          100% {
            opacity: 0;
            transform: translate(var(--target-x), var(--target-y)) scale(0.22);
          }
        }
      `}</style>

      {bursts.map((burst) => (
        <div key={burst.id} className="absolute inset-0">
          <div
            className="absolute flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-400/18 px-3 py-1 text-xs font-bold text-emerald-50 shadow-[0_10px_30px_rgba(16,185,129,0.25)] backdrop-blur-sm"
            style={{
              left: burst.labelStartX,
              top: burst.labelStartY,
              animation: 'money-income-label 720ms cubic-bezier(0.2, 0.9, 0.25, 1) forwards',
            }}
          >
            <CurrencyIcon type="money" className="h-3.5 w-3.5" />
            <span>+{burst.amount.toLocaleString('fr-FR')}</span>
          </div>

          {burst.particles.map((particle) => (
            <div
              key={particle.id}
              className="absolute flex items-center justify-center rounded-full border border-amber-200/50 bg-gradient-to-br from-yellow-300 via-amber-300 to-orange-400 text-[10px] font-black text-amber-950 shadow-[0_8px_20px_rgba(251,191,36,0.35)]"
              style={{
                left: particle.startX,
                top: particle.startY,
                width: particle.size,
                height: particle.size,
                ['--target-x' as string]: `${burst.labelStartX - particle.startX}px`,
                ['--target-y' as string]: `${burst.labelStartY - 28 - particle.startY}px`,
                ['--drift-x' as string]: `${particle.driftX}px`,
                ['--drift-y' as string]: `${particle.driftY}px`,
                animation: `money-income-coin ${particle.duration}ms cubic-bezier(0.2, 0.9, 0.25, 1) ${particle.delay}ms forwards`,
                opacity: 0,
              }}
            >
              €
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

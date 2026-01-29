import { useState, useCallback } from 'react';
import { Gift } from '@/services/api';
import { Gift as GiftIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveImageUrl } from '@/lib/images';

interface GiftOpenAnimationProps {
  gift: Gift;
  onComplete: () => void;
  onClose: () => void;
}

const CLICKS_NEEDED = 3;

export default function GiftOpenAnimation({ gift, onComplete, onClose }: GiftOpenAnimationProps) {
  const [clicks, setClicks] = useState(0);
  const [phase, setPhase] = useState<'clicking' | 'burst' | 'reveal'>('clicking');
  const [completed, setCompleted] = useState(false);

  const handleClick = useCallback(() => {
    if (phase !== 'clicking') return;

    const newClicks = clicks + 1;
    setClicks(newClicks);

    if (newClicks >= CLICKS_NEEDED) {
      setPhase('burst');
      if (!completed) {
        setCompleted(true);
        onComplete();
      }
      setTimeout(() => {
        setPhase('reveal');
      }, 800);
    }
  }, [clicks, phase, completed, onComplete]);

  const shakeIntensity = Math.min(clicks / CLICKS_NEEDED, 1);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      {/* Clicking phase */}
      {phase === 'clicking' && (
        <div className="flex flex-col items-center gap-6">
          <p className="text-white/70 text-sm animate-pulse">
            Clique pour ouvrir ! ({clicks}/{CLICKS_NEEDED})
          </p>

          <button
            onClick={handleClick}
            className="relative cursor-pointer select-none transition-transform active:scale-95"
            style={{
              animation: clicks > 0
                ? `gift-shake ${Math.max(0.15, 0.5 - shakeIntensity * 0.35)}s ease-in-out infinite`
                : undefined,
              filter: `brightness(${1 + shakeIntensity * 0.3})`,
            }}
          >
            <div className="h-32 w-32 rounded-2xl bg-gradient-to-br from-red-500 via-red-600 to-pink-600 flex items-center justify-center shadow-2xl shadow-red-500/30 border-2 border-red-400/50">
              {/* Ribbon horizontal */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 bg-yellow-400/80" />
              {/* Ribbon vertical */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-4 bg-yellow-400/80" />
              {/* Bow */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-6 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-yellow-500" />
                <div className="absolute -left-1 top-0 w-5 h-4 bg-yellow-400 rounded-full rotate-[-30deg]" />
                <div className="absolute -right-1 top-0 w-5 h-4 bg-yellow-400 rounded-full rotate-[30deg]" />
              </div>
              <GiftIcon className="h-12 w-12 text-white/90 relative z-10" />
            </div>

            {/* Glow effect based on progress */}
            {clicks > 0 && (
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  boxShadow: `0 0 ${20 + shakeIntensity * 40}px ${shakeIntensity * 20}px rgba(255, 200, 50, ${shakeIntensity * 0.5})`,
                }}
              />
            )}
          </button>

          {/* Progress dots */}
          <div className="flex gap-2">
            {Array.from({ length: CLICKS_NEEDED }).map((_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  i < clicks ? 'bg-yellow-400 scale-125' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Burst phase */}
      {phase === 'burst' && (
        <div className="flex items-center justify-center">
          <div
            className="h-40 w-40 rounded-full bg-white"
            style={{
              animation: 'gift-light-burst 0.8s ease-out forwards',
            }}
          />
        </div>
      )}

      {/* Reveal phase */}
      {phase === 'reveal' && (
        <div
          className="flex flex-col items-center gap-6 max-w-sm mx-auto px-6"
          style={{ animation: 'appear 0.5s ease-out forwards' }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Gift icon */}
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-xl shadow-amber-500/30">
            <GiftIcon className="h-10 w-10 text-white" />
          </div>

          {/* Gifter */}
          <div className="text-center">
            <p className="text-white/60 text-sm">Cadeau de</p>
            <p className="text-white text-xl font-bold">{gift.sender.username}</p>
          </div>

          {/* Contents */}
          <div className="w-full space-y-3">
            {(gift.moneyAmount > 0 || gift.auraAmount > 0) && (
              <div className="bg-white/10 rounded-xl p-4 text-center space-y-2">
                {gift.moneyAmount > 0 && (
                  <>
                    <p className="text-yellow-400 text-2xl font-bold">${gift.moneyAmount}</p>
                    <p className="text-white/50 text-xs">argent</p>
                  </>
                )}
                {gift.auraAmount > 0 && (
                  <>
                    <p className="text-purple-400 text-2xl font-bold">{gift.auraAmount}</p>
                    <p className="text-white/50 text-xs">aura</p>
                  </>
                )}
              </div>
            )}

            {gift.items.length > 0 && (
              <div className="bg-white/10 rounded-xl p-4">
                <p className="text-white/50 text-xs mb-2 text-center">Articles</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {gift.items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 bg-white/10 text-white text-sm px-3 py-2 rounded-lg border border-white/10"
                    >
                      {item.giftTemplate.imageUrl ? (
                        <img src={resolveImageUrl(item.giftTemplate.imageUrl)} alt={item.giftTemplate.name} className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <GiftIcon className="h-10 w-10 text-white/60" />
                      )}
                      {item.giftTemplate.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {gift.message && (
              <div className="bg-white/10 rounded-xl p-4 text-center">
                <p className="text-white italic">"{gift.message}"</p>
              </div>
            )}
          </div>

          {/* Close */}
          <Button
            onClick={onClose}
            variant="outline"
            className="mt-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            Fermer
          </Button>
        </div>
      )}
    </div>
  );
}

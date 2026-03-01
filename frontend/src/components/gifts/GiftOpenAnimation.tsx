import { useState, useCallback } from 'react';
import { Gift } from '@/services/api';
import { Gift as GiftIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UsernameDisplay } from '@/components/ui/username-display';

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

          <Button
            type="button"
            onClick={handleClick}
            variant="ghost"
            className="relative h-auto w-auto cursor-pointer select-none p-0 transition-transform hover:bg-transparent active:scale-95"
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
          </Button>

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
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="absolute right-6 top-6 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Gift icon */}
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-xl shadow-amber-500/30">
            <GiftIcon className="h-10 w-10 text-white" />
          </div>

          {/* Gifter */}
          <div className="text-center">
            <p className="text-white/60 text-sm">Cadeau de</p>
            <UsernameDisplay
              username={gift.sender.username}
              className="justify-center text-xl font-bold"
              usernameClassName="text-white"
              labelClassName="text-white/60"
            />
          </div>

          {/* Contents */}
          <div className="w-full space-y-3">
            {gift.auraAmount > 0 && (
              <div className="bg-white/10 rounded-xl p-4 text-center space-y-2">
                {gift.auraAmount > 0 && (
                  <>
                    <p className="text-purple-400 text-2xl font-bold">{gift.auraAmount}</p>
                    <p className="text-white/50 text-xs">aura</p>
                  </>
                )}
              </div>
            )}

            {gift.message && (
              <div className="bg-white/10 rounded-xl p-4 text-center">
                <p className="text-white ">"{gift.message}"</p>
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

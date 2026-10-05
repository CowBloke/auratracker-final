import { useEffect, useState } from 'react';
import { Copy, Sparkles, Ticket, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface ReferralClaimAnimationProps {
  open: boolean;
  code: string;
  rewardAmount: number;
  successfulReferrals: number;
  onClose: () => void;
}

const CLICKS_NEEDED = 3;

export default function ReferralClaimAnimation({
  open,
  code,
  rewardAmount,
  successfulReferrals,
  onClose,
}: ReferralClaimAnimationProps) {
  const [clicks, setClicks] = useState(0);
  const [phase, setPhase] = useState<'charging' | 'burst' | 'reveal'>('charging');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setClicks(0);
      setPhase('charging');
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || phase !== 'reveal' || copied) {
      return;
    }

    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    toast('Code copie', {
      description: `${code} a ete copie. Chaque inscription valide rapporte ${rewardAmount} money.`,
      duration: 4000,
    });
  }, [code, copied, open, phase, rewardAmount]);

  if (!open) {
    return null;
  }

  const handleCharge = () => {
    if (phase !== 'charging') {
      return;
    }

    const nextClicks = clicks + 1;
    setClicks(nextClicks);

    if (nextClicks >= CLICKS_NEEDED) {
      setPhase('burst');
      window.setTimeout(() => {
        setPhase('reveal');
      }, 850);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      {phase === 'charging' && (
        <div className="flex flex-col items-center gap-6">
          <p className="text-sm text-white/70">
            Reclame ton code ({clicks}/{CLICKS_NEEDED})
          </p>

          <button
            type="button"
            onClick={handleCharge}
            className="referral-claim-token group relative flex h-36 w-36 items-center justify-center rounded-[2rem] border border-white/15 bg-[radial-gradient(circle_at_top,#facc15,transparent_55%),linear-gradient(140deg,#1f2937,#0f172a_55%,#111827)] shadow-[0_25px_80px_rgba(250,204,21,0.18)] transition-transform active:scale-95"
            style={{ ['--claim-progress' as string]: `${clicks / CLICKS_NEEDED}` }}
          >
            <div className="referral-claim-ring absolute inset-0 rounded-[2rem]" />
            <Ticket className="h-14 w-14 text-amber-200 transition-transform group-hover:scale-110" />
            <div className="absolute inset-x-5 bottom-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-400 transition-all duration-300"
                style={{ width: `${(clicks / CLICKS_NEEDED) * 100}%` }}
              />
            </div>
          </button>

          <div className="flex gap-2">
            {Array.from({ length: CLICKS_NEEDED }).map((_, index) => (
              <span
                key={index}
                className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                  index < clicks ? 'bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.9)]' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {phase === 'burst' && (
        <div className="referral-burst relative flex h-48 w-48 items-center justify-center rounded-full bg-white/90">
          <Sparkles className="h-14 w-14 text-amber-500" />
        </div>
      )}

      {phase === 'reveal' && (
        <div className="referral-reveal-panel relative w-full max-w-md rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(17,24,39,0.98),rgba(15,23,42,0.96))] p-6 text-white shadow-[0_30px_120px_rgba(15,23,42,0.6)]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-4 top-4 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>

          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
              <Ticket className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">Parrainage</p>
              <p className="text-3xl font-semibold tracking-[0.34em] text-amber-200">{code}</p>
              <p className="text-sm text-white/65">
                Copie automatique terminee. Chaque validation rapporte {rewardAmount} money aux deux comptes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Valides</p>
                <p className="mt-2 text-2xl font-semibold">{successfulReferrals}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Copie</p>
                <p className="mt-2 flex items-center gap-2 text-lg font-medium text-emerald-300">
                  <Copy className="h-4 w-4" />
                  {copied ? 'Confirmee' : 'En cours'}
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={onClose}
              className="w-full bg-amber-300 text-slate-950 hover:bg-amber-200"
            >
              Fermer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

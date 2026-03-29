import { cn } from '@/lib/utils';

type BadgeTier = {
  ringClassName: string;
  coreClassName: string;
  glowClassName: string;
  orbitClassName: string;
  label: string;
};

const getTier = (rank: number): BadgeTier => {
  if (rank <= 3) {
    return {
      label: 'LEGEND',
      ringClassName: 'border-amber-300/80 shadow-[0_0_42px_rgba(251,191,36,0.7)]',
      coreClassName: 'bg-[radial-gradient(circle_at_30%_20%,rgba(255,251,235,0.95),rgba(251,146,60,0.9)_45%,rgba(120,53,15,0.95)_100%)]',
      glowClassName: 'bg-amber-300/35',
      orbitClassName: 'border-amber-200/60',
    };
  }
  if (rank <= 10) {
    return {
      label: 'MASTER',
      ringClassName: 'border-cyan-200/80 shadow-[0_0_30px_rgba(34,211,238,0.55)]',
      coreClassName: 'bg-[radial-gradient(circle_at_20%_20%,rgba(240,249,255,0.95),rgba(59,130,246,0.82)_50%,rgba(30,58,138,0.95)_100%)]',
      glowClassName: 'bg-cyan-300/25',
      orbitClassName: 'border-cyan-100/50',
    };
  }
  if (rank <= 25) {
    return {
      label: 'ELITE',
      ringClassName: 'border-emerald-200/75 shadow-[0_0_24px_rgba(16,185,129,0.45)]',
      coreClassName: 'bg-[radial-gradient(circle_at_20%_20%,rgba(240,253,250,0.92),rgba(16,185,129,0.84)_50%,rgba(6,78,59,0.95)_100%)]',
      glowClassName: 'bg-emerald-300/20',
      orbitClassName: 'border-emerald-100/45',
    };
  }
  if (rank <= 50) {
    return {
      label: 'PRO',
      ringClassName: 'border-violet-200/70 shadow-[0_0_20px_rgba(167,139,250,0.4)]',
      coreClassName: 'bg-[radial-gradient(circle_at_20%_20%,rgba(245,243,255,0.9),rgba(139,92,246,0.8)_50%,rgba(76,29,149,0.95)_100%)]',
      glowClassName: 'bg-violet-300/15',
      orbitClassName: 'border-violet-100/35',
    };
  }

  return {
    label: 'TOP',
    ringClassName: 'border-slate-300/60 shadow-[0_0_14px_rgba(148,163,184,0.28)]',
    coreClassName: 'bg-[radial-gradient(circle_at_20%_20%,rgba(248,250,252,0.9),rgba(148,163,184,0.7)_55%,rgba(51,65,85,0.95)_100%)]',
    glowClassName: 'bg-slate-300/12',
    orbitClassName: 'border-slate-100/30',
  };
};

type OverallClassementBadgeProps = {
  rank?: number | null;
  totalPlayers?: number;
  totalScore?: number;
};

export function OverallClassementBadge({
  rank,
  totalPlayers,
  totalScore,
}: OverallClassementBadgeProps) {
  if (!rank || rank <= 0) {
    return null;
  }

  const tier = getTier(rank);
  const topPercent = totalPlayers && totalPlayers > 0
    ? Math.max(0.1, (rank / totalPlayers) * 100)
    : null;

  return (
    <div className="relative flex items-center justify-end">
      <div className={cn('absolute right-1 top-1 h-20 w-20 rounded-full blur-xl', tier.glowClassName)} />

      {rank <= 25 ? (
        <div
          className={cn('absolute right-0 top-0 h-[86px] w-[86px] rounded-full border border-dashed', tier.orbitClassName)}
          style={{ animation: 'spin 11s linear infinite' }}
        />
      ) : null}

      <div
        className={cn(
          'relative z-10 flex h-20 w-20 flex-col items-center justify-center rounded-full border text-white backdrop-blur-[2px]',
          tier.ringClassName,
          tier.coreClassName,
        )}
      >
        <span className="text-[9px] font-semibold tracking-[0.18em] text-white/85">{tier.label}</span>
        <span className="-mt-0.5 text-2xl font-extrabold leading-none">#{rank}</span>
        {totalPlayers ? (
          <span className="text-[9px] text-white/85">/{totalPlayers}</span>
        ) : null}
      </div>

      <div className="absolute right-[88px] top-3 hidden rounded-full border border-border/60 bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm md:block">
        {topPercent ? `Top ${topPercent.toFixed(1)}%` : 'Classement global'}
      </div>

      {typeof totalScore === 'number' ? (
        <div className="absolute right-[88px] top-10 hidden rounded-full border border-border/60 bg-card/85 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:block">
          Score {totalScore.toFixed(2)}
        </div>
      ) : null}
    </div>
  );
}

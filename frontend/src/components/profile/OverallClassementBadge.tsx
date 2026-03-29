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
      ringClassName: 'shadow-[0_0_34px_rgba(251,191,36,0.55)]',
      coreClassName: 'bg-[radial-gradient(circle_at_22%_18%,rgba(255,247,229,0.96),rgba(251,191,36,0.84)_46%,rgba(180,83,9,0.96)_100%)]',
      glowClassName: 'bg-amber-200/35',
      orbitClassName: 'bg-amber-200/30',
    };
  }
  if (rank <= 10) {
    return {
      label: 'MASTER',
      ringClassName: 'shadow-[0_0_26px_rgba(56,189,248,0.44)]',
      coreClassName: 'bg-[radial-gradient(circle_at_22%_18%,rgba(236,254,255,0.94),rgba(56,189,248,0.78)_50%,rgba(30,64,175,0.94)_100%)]',
      glowClassName: 'bg-cyan-300/25',
      orbitClassName: 'bg-cyan-100/24',
    };
  }
  if (rank <= 25) {
    return {
      label: 'ELITE',
      ringClassName: 'shadow-[0_0_22px_rgba(16,185,129,0.38)]',
      coreClassName: 'bg-[radial-gradient(circle_at_22%_18%,rgba(236,253,245,0.92),rgba(16,185,129,0.78)_52%,rgba(6,95,70,0.94)_100%)]',
      glowClassName: 'bg-emerald-300/20',
      orbitClassName: 'bg-emerald-100/18',
    };
  }
  if (rank <= 50) {
    return {
      label: 'PRO',
      ringClassName: 'shadow-[0_0_18px_rgba(192,132,252,0.35)]',
      coreClassName: 'bg-[radial-gradient(circle_at_22%_18%,rgba(250,245,255,0.9),rgba(192,132,252,0.72)_52%,rgba(88,28,135,0.94)_100%)]',
      glowClassName: 'bg-violet-300/15',
      orbitClassName: 'bg-violet-100/16',
    };
  }

  return {
    label: 'TOP',
    ringClassName: 'shadow-[0_0_12px_rgba(148,163,184,0.22)]',
    coreClassName: 'bg-[radial-gradient(circle_at_22%_18%,rgba(248,250,252,0.9),rgba(148,163,184,0.62)_56%,rgba(71,85,105,0.95)_100%)]',
    glowClassName: 'bg-slate-300/12',
    orbitClassName: 'bg-slate-100/14',
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
    <div className="group relative flex items-center justify-end">
      <div className={cn('absolute right-1 top-1 h-20 w-20 rounded-full blur-xl', tier.glowClassName)} />

      {rank <= 25 ? (
        <div
          className={cn('absolute right-0 top-0 h-[86px] w-[86px] rounded-full', tier.orbitClassName)}
          style={{ animation: 'spin 11s linear infinite' }}
        />
      ) : null}

      <div
        className={cn(
          'relative z-10 flex h-20 w-20 flex-col items-center justify-center rounded-full text-white backdrop-blur-[2px]',
          tier.ringClassName,
          tier.coreClassName,
        )}
      >
        <span className="text-[8px] font-medium tracking-[0.12em] text-white/78">{tier.label}</span>
        <span className="mt-0.5 text-[28px] font-semibold leading-none tracking-tight">#{rank}</span>
      </div>

      <div className="pointer-events-none absolute right-[88px] top-3 w-max max-w-[190px] rounded-xl bg-card/92 px-3 py-2 text-right text-[11px] text-muted-foreground opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100">
        <p>{topPercent ? `Top ${topPercent.toFixed(1)}%` : 'Classement global'}</p>
        {totalPlayers ? <p>#{rank} sur {totalPlayers}</p> : null}
        {typeof totalScore === 'number' ? (
          <p className="text-[10px] uppercase tracking-[0.08em]">Score {totalScore.toFixed(2)}</p>
        ) : null}
      </div>

      {rank <= 10 ? (
        <div className="pointer-events-none absolute -bottom-2 right-5 h-2 w-2 rounded-full bg-white/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      ) : null}
    </div>
  );
}

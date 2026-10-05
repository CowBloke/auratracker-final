import { cn } from '@/lib/utils';

type BadgeTier = {
  ringClassName: string;
  coreClassName: string;
  glowClassName: string;
  orbitClassName: string;
  label: string;
  colorClassName: string;
  description: string;
};

const getTier = (rank: number): BadgeTier => {
  if (rank <= 3) {
    return {
      label: 'LEGEND',
      colorClassName: 'text-warning',
      description: 'Top 3 mondial',
      ringClassName: '',
      coreClassName: 'bg-[radial-gradient(circle_at_22%_18%,rgba(255,247,229,0.96),rgba(251,191,36,0.84)_46%,rgba(180,83,9,0.96)_100%)]',
      glowClassName: 'bg-warning/35',
      orbitClassName: 'bg-warning/30',
    };
  }
  if (rank <= 10) {
    return {
      label: 'MASTER',
      colorClassName: 'text-primary',
      description: 'Top 10 mondial',
      ringClassName: '',
      coreClassName: 'bg-[radial-gradient(circle_at_22%_18%,rgba(236,254,255,0.94),rgba(56,189,248,0.78)_50%,rgba(30,64,175,0.94)_100%)]',
      glowClassName: 'bg-muted/25',
      orbitClassName: 'bg-muted/24',
    };
  }
  if (rank <= 25) {
    return {
      label: 'ELITE',
      colorClassName: 'text-success',
      description: 'Top 25 mondial',
      ringClassName: '',
      coreClassName: 'bg-[radial-gradient(circle_at_22%_18%,rgba(236,253,245,0.92),rgba(16,185,129,0.78)_52%,rgba(6,95,70,0.94)_100%)]',
      glowClassName: 'bg-success/20',
      orbitClassName: 'bg-success/18',
    };
  }
  if (rank <= 50) {
    return {
      label: 'PRO',
      colorClassName: 'text-primary',
      description: 'Top 50 mondial',
      ringClassName: '',
      coreClassName: 'bg-[radial-gradient(circle_at_22%_18%,rgba(250,245,255,0.9),rgba(192,132,252,0.72)_52%,rgba(88,28,135,0.94)_100%)]',
      glowClassName: 'bg-muted/15',
      orbitClassName: 'bg-muted/16',
    };
  }

  return {
    label: 'TOP',
    colorClassName: 'text-muted-foreground',
    description: 'Classement global',
    ringClassName: '',
    coreClassName: 'bg-[radial-gradient(circle_at_22%_18%,rgba(248,250,252,0.9),rgba(148,163,184,0.62)_56%,rgba(71,85,105,0.95)_100%)]',
    glowClassName: 'bg-muted/12',
    orbitClassName: 'bg-muted/14',
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
      <div className={cn('absolute right-1 top-1 h-20 w-20 rounded-full', tier.glowClassName)} />

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
        <span className="text-xs font-medium text-white/78">{tier.label}</span>
        <span className="mt-0.5 text-[28px] font-semibold leading-none">#{rank}</span>
      </div>

      {/* Hover tooltip — appears to the left of the badge */}
      <div className="pointer-events-none absolute right-[92px] top-1 w-48 rounded-xl border border-border/60 bg-card opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="px-3.5 py-2.5 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs font-semibold', tier.colorClassName)}>{tier.label}</span>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <span className="text-xs font-semibold text-foreground">#{rank}</span>
          </div>
          <p className="text-xs text-muted-foreground">{tier.description}</p>
          {topPercent !== null && (
            <p className="text-xs text-muted-foreground">
              Top {topPercent < 1 ? topPercent.toFixed(1) : Math.round(topPercent)}%
              {totalPlayers ? ` · ${totalPlayers} joueurs` : ''}
            </p>
          )}
          {typeof totalScore === 'number' && (
            <div className="border-t border-border/40 pt-1.5 mt-1">
              <p className="text-xs text-muted-foreground/60">
                Score combiné : <span className="font-medium text-muted-foreground">{Math.round(totalScore).toLocaleString('fr-FR')}</span>
                <span className="ml-1">(plus bas = meilleur)</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

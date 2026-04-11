import { useEffect, useState } from 'react';
import { Brain, Building2, ShieldAlert, ShieldOff, Star, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type YouSkill, type YouTemporaryEffect, youApi } from '@/services/api';
import { UserAccountMenu } from '@/components/user-account-menu';
import { setMoneyIndicatorElement } from '@/lib/money-income-effects';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type HeaderSkill = {
  key: string;
  icon: typeof Brain;
  label: string;
  level: number;
  xp: number;
  maxXp: number;
  color: 'emerald' | 'purple' | 'sky' | 'pink' | 'amber' | 'rose';
  desc: string;
  unlocks: string[];
};

const SKILL_ICON_MAP: Record<string, typeof Brain> = {
  affaires: Building2,
  social: Users,
  intelligence: Brain,
  charisme: Star,
  finance: TrendingUp,
  illegalite: ShieldAlert,
};

const SKILL_THEME = {
  emerald: { ring: 'ring-emerald-400/40', bg: 'bg-emerald-400/15', icon: 'text-emerald-400', text: 'text-emerald-400', bar: 'bg-emerald-400' },
  purple: { ring: 'ring-purple-400/40', bg: 'bg-purple-400/15', icon: 'text-purple-400', text: 'text-purple-400', bar: 'bg-purple-400' },
  sky: { ring: 'ring-sky-400/40', bg: 'bg-sky-400/15', icon: 'text-sky-400', text: 'text-sky-400', bar: 'bg-sky-400' },
  pink: { ring: 'ring-pink-400/40', bg: 'bg-pink-400/15', icon: 'text-pink-400', text: 'text-pink-400', bar: 'bg-pink-400' },
  amber: { ring: 'ring-amber-400/40', bg: 'bg-amber-400/15', icon: 'text-amber-400', text: 'text-amber-400', bar: 'bg-amber-400' },
  rose: { ring: 'ring-rose-400/40', bg: 'bg-rose-400/15', icon: 'text-rose-400', text: 'text-rose-400', bar: 'bg-rose-400' },
} satisfies Record<HeaderSkill['color'], { ring: string; bg: string; icon: string; text: string; bar: string }>;

function SkillBadge({ icon: Icon, label, level, xp, maxXp, color, desc, unlocks }: HeaderSkill) {
  const theme = SKILL_THEME[color];
  const progress = Math.min(100, Math.round((xp / maxXp) * 100));

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="relative flex shrink-0 items-center justify-center">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-full ring-2 transition-all duration-200 hover:scale-110 hover:ring-4', theme.bg, theme.ring)}>
            <Icon className={cn('h-3.5 w-3.5', theme.icon)} />
          </div>
          <span className={cn('absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold ring-1 ring-background', theme.bg, theme.text)}>
            {level}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="w-56 space-y-2.5 p-3">
        <div className="flex items-center justify-between">
          <span className={cn('text-sm font-semibold', theme.text)}>{label}</span>
          <span className="text-sm font-bold tabular-nums">Niv. {level}</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Experience</span>
            <span className="tabular-nums">{xp}/{maxXp} XP</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted/40">
            <div className={cn('h-full rounded-full transition-all duration-500', theme.bar)} style={{ width: `${progress}%` }} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
        <div className="space-y-0.5 border-t border-border/30 pt-0.5">
          {unlocks.map((unlock) => (
            <p key={unlock} className="text-[10px] text-muted-foreground/60">
              {'->'} {unlock}
            </p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function YouHeaderBar({ rightSlot }: { rightSlot?: React.ReactNode }) {
  const { user } = useAuth();
  const [skills, setSkills] = useState<HeaderSkill[]>([]);
  const [temporaryEffects, setTemporaryEffects] = useState<YouTemporaryEffect[]>([]);
  const [nowTs, setNowTs] = useState(Date.now());

  const formatRemaining = (expiresAt: string) => {
    const remainingMs = new Date(expiresAt).getTime() - nowTs;
    if (remainingMs <= 0) return 'Expiré';

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    }
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  };

  const visibleTemporaryEffects = temporaryEffects.filter((effect) => new Date(effect.expiresAt).getTime() > nowTs);

  useEffect(() => {
    let active = true;

    const loadSkills = async () => {
      try {
        const response = await youApi.getSkills();
        if (!active) return;
        setSkills(response.data.skills.map((skill: YouSkill) => ({
          key: skill.key,
          icon: SKILL_ICON_MAP[skill.key as keyof typeof SKILL_ICON_MAP] ?? Brain,
          label: skill.label,
          level: skill.level,
          xp: skill.xp,
          maxXp: skill.maxXp,
          color: skill.color,
          desc: skill.description,
          unlocks: skill.unlocks,
        })));
      } catch {
        if (!active) return;
        setSkills([]);
      }
    };

    const loadTemporaryEffects = async () => {
      try {
        const response = await youApi.getTemporaryEffects();
        if (!active) return;
        setTemporaryEffects(response.data.effects ?? []);
      } catch {
        if (!active) return;
        setTemporaryEffects([]);
      }
    };

    const reloadSkills = () => {
      void loadSkills();
    };

    void loadSkills();
    void loadTemporaryEffects();
    window.addEventListener('you:skills-updated', reloadSkills);
    const refreshInterval = window.setInterval(() => {
      void loadTemporaryEffects();
    }, 30000);
    const countdownInterval = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => {
      active = false;
      window.removeEventListener('you:skills-updated', reloadSkills);
      window.clearInterval(refreshInterval);
      window.clearInterval(countdownInterval);
    };
  }, []);

  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden py-1 pl-1 sm:gap-3 sm:pl-2">
          {skills.map((skill) => (
            <SkillBadge key={skill.key} icon={skill.icon} label={skill.label} level={skill.level} xp={skill.xp} maxXp={skill.maxXp} color={skill.color} desc={skill.desc} unlocks={skill.unlocks} />
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {user?.hasAdblock && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1">
              <ShieldOff className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Adblock actif</span>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                Temporaires
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{visibleTemporaryEffects.length}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Objets temporaires actifs</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {visibleTemporaryEffects.length === 0 ? (
                <DropdownMenuItem disabled>Aucun objet temporaire en cours</DropdownMenuItem>
              ) : (
                visibleTemporaryEffects.map((effect) => (
                  <DropdownMenuItem key={`${effect.key}-${effect.expiresAt}`} className="flex items-start justify-between gap-3 py-2" onSelect={(event) => event.preventDefault()}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{effect.label}</p>
                      <p className="line-clamp-2 text-[11px] text-muted-foreground">{effect.description}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-amber-400">{formatRemaining(effect.expiresAt)}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {rightSlot}
          <div className="hidden items-center gap-1.5 rounded-lg bg-muted/30 px-2.5 py-1 sm:flex">
            <CurrencyIcon type="aura" className="h-3 w-3" />
            <span className="text-xs font-semibold tabular-nums">{user?.aura?.toLocaleString() ?? '0'}</span>
          </div>
          <div ref={setMoneyIndicatorElement} className="hidden items-center gap-1.5 rounded-lg bg-muted/30 px-2.5 py-1 sm:flex">
            <CurrencyIcon type="money" className="h-3 w-3" />
            <span className="text-xs font-semibold tabular-nums">{user?.money?.toLocaleString() ?? '0'} {'\u20AC'}</span>
          </div>
          <UserAccountMenu showLabel={false} />
        </div>
      </div>
    </TooltipProvider>
  );
}

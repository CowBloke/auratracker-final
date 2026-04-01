import { Brain, Building2, Coins, Star, TrendingUp, Users, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type YouSkill = {
  icon: typeof Brain;
  label: string;
  level: number;
  xp: number;
  maxXp: number;
  color: 'emerald' | 'purple' | 'sky' | 'pink' | 'amber';
  desc: string;
  unlocks: string[];
};

const YOU_SKILLS: YouSkill[] = [
  {
    icon: Building2,
    label: 'Affaires',
    level: 3,
    xp: 45,
    maxXp: 100,
    color: 'emerald',
    desc: "Gestion d'entreprise et commerce.",
    unlocks: ['Posseder jusqu a 4 entreprises au niv.5', 'Secteurs Finance & Luxe debloques au niv.8', 'Recrutement VIP au niv.10'],
  },
  {
    icon: Users,
    label: 'Social',
    level: 5,
    xp: 72,
    maxXp: 100,
    color: 'purple',
    desc: 'Relations et influence sociale.',
    unlocks: ['+1 ami max par niveau', 'Negociation salariale facilitee au niv.7', 'Acces aux cercles VIP au niv.9'],
  },
  {
    icon: Brain,
    label: 'Intelligence',
    level: 4,
    xp: 60,
    maxXp: 100,
    color: 'sky',
    desc: 'Apprentissage et adaptabilite.',
    unlocks: ["Meilleures offres d'emploi au niv.5", 'Formation acceleree (+50% XP) au niv.7', 'Postes de direction au niv.10'],
  },
  {
    icon: Star,
    label: 'Charisme',
    level: 2,
    xp: 30,
    maxXp: 100,
    color: 'pink',
    desc: 'Persuasion et magnetisme.',
    unlocks: ['+10% salaire negocie au niv.4', 'Partenariats commerciaux au niv.6', 'Campagnes de communication au niv.9'],
  },
  {
    icon: TrendingUp,
    label: 'Finance',
    level: 6,
    xp: 88,
    maxXp: 100,
    color: 'amber',
    desc: 'Investissements et epargne.',
    unlocks: ['+0.5% rendement/niveau', 'Acces aux fonds premium au niv.7', 'Trading a effet de levier au niv.10'],
  },
];

const SKILL_THEME = {
  emerald: { ring: 'ring-emerald-400/40', bg: 'bg-emerald-400/15', icon: 'text-emerald-400', text: 'text-emerald-400', bar: 'bg-emerald-400' },
  purple: { ring: 'ring-purple-400/40', bg: 'bg-purple-400/15', icon: 'text-purple-400', text: 'text-purple-400', bar: 'bg-purple-400' },
  sky: { ring: 'ring-sky-400/40', bg: 'bg-sky-400/15', icon: 'text-sky-400', text: 'text-sky-400', bar: 'bg-sky-400' },
  pink: { ring: 'ring-pink-400/40', bg: 'bg-pink-400/15', icon: 'text-pink-400', text: 'text-pink-400', bar: 'bg-pink-400' },
  amber: { ring: 'ring-amber-400/40', bg: 'bg-amber-400/15', icon: 'text-amber-400', text: 'text-amber-400', bar: 'bg-amber-400' },
} satisfies Record<YouSkill['color'], { ring: string; bg: string; icon: string; text: string; bar: string }>;

function SkillBadge({ icon: Icon, label, level, xp, maxXp, color, desc, unlocks }: YouSkill) {
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

  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden py-1 pl-1 sm:gap-3 sm:pl-2">
          {YOU_SKILLS.map((skill) => (
            <SkillBadge key={skill.label} {...skill} />
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {rightSlot}
          <div className="hidden items-center gap-1.5 rounded-lg bg-muted/30 px-2.5 py-1 sm:flex">
            <Zap className="h-3 w-3 text-yellow-400" />
            <span className="text-xs font-semibold tabular-nums">{user?.aura?.toLocaleString() ?? '0'}</span>
          </div>
          <div className="hidden items-center gap-1.5 rounded-lg bg-muted/30 px-2.5 py-1 sm:flex">
            <Coins className="h-3 w-3 text-emerald-400" />
            <span className="text-xs font-semibold tabular-nums">{user?.money?.toLocaleString() ?? '0'} €</span>
          </div>
          <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border/50">
            {user?.profilePicture ? <AvatarImage src={resolveImageUrl(user.profilePicture)} alt={user.username} /> : null}
            <AvatarFallback className="bg-muted text-xs font-semibold">
              {user?.username?.slice(0, 1).toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </TooltipProvider>
  );
}

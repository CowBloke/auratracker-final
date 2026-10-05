import { useEffect, useState } from 'react';
import { Brain, Building2, ShieldAlert, Star, TrendingUp, Users, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { youApi, type YouSkill } from '@/services/api';

const SKILL_ICONS: Record<string, LucideIcon> = {
  affaires: Building2,
  social: Users,
  intelligence: Brain,
  charisme: Star,
  finance: TrendingUp,
  illegalite: ShieldAlert,
};

export function YouSkillsCard() {
  const [skills, setSkills] = useState<YouSkill[]>([]);

  useEffect(() => {
    let active = true;
    const load = () => {
      youApi
        .getSkills()
        .then((response) => {
          if (active) setSkills(response.data.skills);
        })
        .catch(() => {
          if (active) setSkills([]);
        });
    };
    load();
    window.addEventListener('you:skills-updated', load);
    return () => {
      active = false;
      window.removeEventListener('you:skills-updated', load);
    };
  }, []);

  if (skills.length === 0) return null;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">Compétences</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <ItemGroup className="gap-1">
          {skills.map((skill) => {
            const Icon = SKILL_ICONS[skill.key] ?? Brain;
            const progress = skill.maxXp > 0 ? Math.min(100, Math.round((skill.xp / skill.maxXp) * 100)) : 0;
            return (
              <HoverCard key={skill.key} openDelay={100}>
                <HoverCardTrigger asChild>
                  <Item size="sm" className="px-0">
                    <ItemMedia variant="icon">
                      <Icon />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="w-full justify-between">
                        {skill.label}
                        <span className="text-xs tabular-nums text-muted-foreground">Niv. {skill.level}</span>
                      </ItemTitle>
                      <Progress value={progress} />
                    </ItemContent>
                  </Item>
                </HoverCardTrigger>
                <HoverCardContent side="right" className="flex w-64 flex-col gap-2">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{skill.label}</span>
                    <span className="tabular-nums">Niv. {skill.level}</span>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">{skill.xp}/{skill.maxXp} XP</p>
                  <ItemDescription>{skill.description}</ItemDescription>
                  {skill.unlocks.length > 0 ? (
                    <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {skill.unlocks.map((unlock) => (
                        <li key={unlock}>{'→'} {unlock}</li>
                      ))}
                    </ul>
                  ) : null}
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

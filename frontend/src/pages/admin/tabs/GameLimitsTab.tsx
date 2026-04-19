import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TabsContent } from '@/components/ui/tabs';
import { Loader2, Save } from 'lucide-react';
import { SPACING } from '@/lib/design-system';

export type GameLimitsTabProps = Record<string, unknown>;

export function GameLimitsTab(props: GameLimitsTabProps) {
  const {
    dailyGameAuraLimit,
    setDailyGameAuraLimit,
    dailyGameMoneyLimit,
    setDailyGameMoneyLimit,
    saveDailyGameLimits,
    savingDailyGameLimits,
  } = props as any;

  return (
    <TabsContent value="game-limits" className={SPACING.SECTION_SPACING}>
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Recompenses de jeux</p>
        <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Plafond d'aura journalier</div>
              <div className="text-xs text-muted-foreground">Total maximum d'aura gagnable via les jeux avant le reset de minuit. Valeur par defaut: 500.</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Input
                id="daily-game-aura-limit"
                type="number"
                min={0}
                max={100000}
                step={1}
                value={dailyGameAuraLimit}
                onChange={(event) => setDailyGameAuraLimit(event.target.value)}
                className="w-28 h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Plafond d'argent journalier (par jeu)</div>
              <div className="text-xs text-muted-foreground">Maximum d'argent gagnable par jeu avant le reset de minuit. Valeur par defaut: 1000.</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Input
                id="daily-game-money-limit"
                type="number"
                min={0}
                max={100000}
                step={1}
                value={dailyGameMoneyLimit}
                onChange={(event) => setDailyGameMoneyLimit(event.target.value)}
                className="w-28 h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end px-4 py-3.5">
            <Button size="sm" onClick={saveDailyGameLimits} disabled={savingDailyGameLimits}>
              {savingDailyGameLimits ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </TabsContent>
  );
}

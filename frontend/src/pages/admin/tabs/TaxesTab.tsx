import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TabsContent } from '@/components/ui/tabs';
import { SPACING } from '@/lib/design-system';
import { Landmark, Loader2, Minus, Plus, Save } from 'lucide-react';

type EditableTaxBracket = {
  id: string;
  threshold: string;
  rate: string;
};

type TaxesTabProps = {
  taxLastRunDate: string | null;
  loadingTaxSettings: boolean;
  taxBrackets: EditableTaxBracket[];
  updateTaxBracket: (id: string, field: 'threshold' | 'rate', value: string) => void;
  removeTaxBracket: (id: string) => void;
  savingTaxSettings: boolean;
  addTaxBracket: () => void;
  saveTaxSettings: () => void;
  runTaxNow: () => void;
  runningTaxNow: boolean;
};

export function TaxesTab(props: TaxesTabProps) {
  const {
    taxLastRunDate,
    loadingTaxSettings,
    taxBrackets,
    updateTaxBracket,
    removeTaxBracket,
    savingTaxSettings,
    addTaxBracket,
    saveTaxSettings,
    runTaxNow,
    runningTaxNow,
  } = props;

  return (
    <TabsContent value="taxes" className={SPACING.SECTION_SPACING}>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardDescription>Impôt quotidien des joueurs</CardDescription>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tous les jours à 00:00, chaque joueur ayant au moins le seuil d&apos;un palier paie le taux du palier le plus élevé qu&apos;il atteint.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Si aucun palier n&apos;est enregistré, le système retombe sur la règle par défaut: 10 000$ → 1%.
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground shrink-0">
                <div>Dernier run</div>
                <div className="mt-1 font-medium text-foreground">
                  {taxLastRunDate ?? 'Jamais'}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div>Seuil minimum</div>
                <div>Taux (%)</div>
                <div className="w-10" />
              </div>

              {loadingTaxSettings ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                taxBrackets.map((bracket, index) => (
                  <div key={bracket.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 px-4 py-3">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={bracket.threshold}
                      onChange={(event) => updateTaxBracket(bracket.id, 'threshold', event.target.value)}
                      placeholder={index === 0 ? '10000' : '5000000'}
                    />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={bracket.rate}
                      onChange={(event) => updateTaxBracket(bracket.id, 'rate', event.target.value)}
                      placeholder={index === 0 ? '1' : '5'}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 p-0"
                      onClick={() => removeTaxBracket(bracket.id)}
                      disabled={savingTaxSettings || loadingTaxSettings}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={addTaxBracket}
                disabled={savingTaxSettings || loadingTaxSettings}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Ajouter un palier
              </Button>
              <Button
                type="button"
                onClick={saveTaxSettings}
                disabled={savingTaxSettings || loadingTaxSettings}
              >
                {savingTaxSettings ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Sauvegarder
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={runTaxNow}
                disabled={runningTaxNow || loadingTaxSettings}
              >
                {runningTaxNow ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Landmark className="mr-1.5 h-4 w-4" />}
                Prélever maintenant
              </Button>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-muted-foreground">
              Chaque prélèvement crée une notification dans l&apos;Inbox du joueur avec le montant retiré, le taux appliqué et son nouveau solde.
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TabsContent } from '@/components/ui/tabs';
import { Loader2, Save, Search, Gamepad2, Coins, Sparkles, FilterX } from 'lucide-react';
import { SPACING } from '@/lib/design-system';
import { adminApi } from '@/services/api';
import { toast } from 'sonner';
import { GAME_TYPES } from '../adminPageModels';
import { Badge } from '@/components/ui/badge';

export function GameLimitsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLimits();
  }, []);

  const fetchLimits = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getGameLimits();
      setLimits(response.data.limits || {});
    } catch (err) {
      toast.error('Impossible de charger les limites');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.updateGameLimits(limits);
      toast.success('Limites de gain mises à jour');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const updateLimit = (key: string, value: string) => {
    setLimits(prev => ({ ...prev, [key]: value }));
  };

  const filteredGames = GAME_TYPES.filter(game => 
    game.label.toLowerCase().includes(search.toLowerCase()) ||
    game.value.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <TabsContent value="game-limits" className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </TabsContent>
    );
  }

  return (
    <TabsContent value="game-limits" className={SPACING.SECTION_SPACING}>
      <div className="space-y-6">
        {/* Global Defaults Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
              <Sparkles className="h-3 w-3" /> Paramètres par défaut
            </p>
            <Button size="sm" variant="outline" className="h-8 gap-2 border-primary/20 hover:bg-primary/5 text-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Enregistrer tout
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/40 bg-card/50 p-4 space-y-4 hover:border-primary/20 transition-colors shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Aura par défaut (par jeu)</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">Sert de limite pour les jeux sans configuration spécifique.</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    min={0}
                    value={limits['daily_game_aura_limit'] || '500'}
                    onChange={(e) => updateLimit('daily_game_aura_limit', e.target.value)}
                    className="h-10 pl-9 font-mono text-sm bg-background/50"
                  />
                  <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                </div>
                <Badge variant="outline" className="h-10 px-3 bg-purple-500/5 text-purple-500 border-purple-500/10">Default</Badge>
              </div>
            </div>

            <div className="rounded-2xl border border-border/40 bg-card/50 p-4 space-y-4 hover:border-primary/20 transition-colors shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Argent par défaut (par jeu)</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">Sert de limite pour les jeux sans configuration spécifique.</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    min={0}
                    value={limits['daily_game_money_limit'] || '1000'}
                    onChange={(e) => updateLimit('daily_game_money_limit', e.target.value)}
                    className="h-10 pl-9 font-mono text-sm bg-background/50"
                  />
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                </div>
                <Badge variant="outline" className="h-10 px-3 bg-amber-500/5 text-amber-500 border-amber-500/10">Default</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Per-Game Configuration */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                <Gamepad2 className="h-3 w-3" /> Configuration par jeu
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Laissez vide pour utiliser la valeur par défaut.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Rechercher un jeu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/30">
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Jeu</th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-[180px]">Limite Aura</th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-[180px]">Limite Argent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredGames.length > 0 ? (
                    filteredGames.map((game) => (
                      <tr key={game.value} className="hover:bg-muted/10 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                              <Gamepad2 className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-sm font-medium leading-none">{game.label}</div>
                              <div className="text-[10px] text-muted-foreground mt-1 font-mono uppercase opacity-50">{game.value}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <Input
                              type="number"
                              min={0}
                              placeholder={limits['daily_game_aura_limit'] || '500'}
                              value={limits[`game_limit_aura:${game.value}`] || ''}
                              onChange={(e) => updateLimit(`game_limit_aura:${game.value}`, e.target.value)}
                              className="h-9 pl-8 text-xs font-mono bg-transparent hover:bg-background/80 transition-colors"
                            />
                            <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-purple-500/40" />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <Input
                              type="number"
                              min={0}
                              placeholder={limits['daily_game_money_limit'] || '1000'}
                              value={limits[`game_limit_money:${game.value}`] || ''}
                              onChange={(e) => updateLimit(`game_limit_money:${game.value}`, e.target.value)}
                              className="h-9 pl-8 text-xs font-mono bg-transparent hover:bg-background/80 transition-colors"
                            />
                            <Coins className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-500/40" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-30">
                          <FilterX className="h-8 w-8" />
                          <p className="text-xs font-medium">Aucun jeu trouvé</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="flex justify-end pt-2">
             <Button className="gap-2 shadow-lg shadow-primary/20" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer toutes les limites
            </Button>
          </div>
        </div>
      </div>
    </TabsContent>
  );
}

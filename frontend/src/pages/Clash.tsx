import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { clashApi, Building, AttackTarget, Troop } from '../services/api';
import { X, RefreshCw, ChevronRight, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const BUILDING_CONFIG: Record<string, { emoji: string; name: string }> = {
  townhall: { emoji: '🏛️', name: 'Town Hall' },
  cannon: { emoji: '💣', name: 'Cannon' },
  archer_tower: { emoji: '🏹', name: 'Archer Tower' },
  wall: { emoji: '🧱', name: 'Wall' },
  gold_mine: { emoji: '⛏️', name: 'Gold Mine' },
  elixir_collector: { emoji: '💧', name: 'Elixir Collector' },
  gold_storage: { emoji: '🏦', name: 'Gold Storage' },
  elixir_storage: { emoji: '🧪', name: 'Elixir Storage' },
  barracks: { emoji: '⚔️', name: 'Barracks' },
  mortar: { emoji: '💥', name: 'Mortar' },
};

const TROOP_CONFIG: Record<string, { emoji: string; name: string }> = {
  barbarian: { emoji: '⚔️', name: 'Barbarian' },
  archer: { emoji: '🏹', name: 'Archer' },
  giant: { emoji: '🛡️', name: 'Giant' },
  goblin: { emoji: '👺', name: 'Goblin' },
};

const GRID_SIZE = 15;

type ViewMode = 'base' | 'attack' | 'scout' | 'battle' | 'history';

export default function Clash() {
  const { user, updateBalance } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('base');
  const [isEditing, setIsEditing] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [placingBuilding, setPlacingBuilding] = useState<string | null>(null);
  const [defenseRating, setDefenseRating] = useState(100);
  const [trophies, setTrophies] = useState(0);
  const [shieldUntil, setShieldUntil] = useState<Date | null>(null);
  const [attackCooldown, setAttackCooldown] = useState<Date | null>(null);
  const [targets, setTargets] = useState<AttackTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<AttackTarget | null>(null);
  const [targetBase, setTargetBase] = useState<Building[]>([]);
  const [troops, setTroops] = useState<{ type: string; count: number }[]>([
    { type: 'barbarian', count: 10 },
    { type: 'archer', count: 5 },
    { type: 'giant', count: 2 },
    { type: 'goblin', count: 8 },
  ]);
  const [deployedTroops, setDeployedTroops] = useState<Troop[]>([]);
  const [selectedTroop, setSelectedTroop] = useState<string | null>(null);
  const [battleResult, setBattleResult] = useState<{
    success: boolean;
    starsEarned: number;
    destruction: number;
    auraTaken: number;
    moneyTaken: number;
    trophiesWon: number;
  } | null>(null);
  const [attackHistory, setAttackHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadBase = useCallback(async () => {
    if (!user) return;
    try {
      const response = await clashApi.getBase(user.id);
      const { base } = response.data;
      setBuildings(base.baseLayout.buildings || []);
      setDefenseRating(base.defenseRating);
      setTrophies(base.trophies);
      setShieldUntil(base.shieldUntil ? new Date(base.shieldUntil) : null);
      setAttackCooldown(base.attackCooldown ? new Date(base.attackCooldown) : null);
    } catch (error) {
      console.error('Failed to load base:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadTargets = useCallback(async () => {
    try {
      const response = await clashApi.getTargets();
      setTargets(response.data.targets);
    } catch (error) {
      console.error('Failed to load targets:', error);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const response = await clashApi.getAttacks({ limit: 20 });
      setAttackHistory(response.data.attacks);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }, []);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (viewMode === 'attack') loadTargets();
    else if (viewMode === 'history') loadHistory();
  }, [viewMode, loadTargets, loadHistory]);

  const saveBase = async () => {
    setSaving(true);
    try {
      const response = await clashApi.saveBase(buildings);
      setDefenseRating(response.data.defenseRating);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save base:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCellClick = (x: number, y: number) => {
    if (!isEditing) return;

    if (placingBuilding) {
      const newBuilding: Building = {
        id: `${placingBuilding}-${Date.now()}`,
        type: placingBuilding,
        level: 1,
        x,
        y,
      };
      setBuildings([...buildings, newBuilding]);
      setPlacingBuilding(null);
    } else {
      const building = buildings.find((b) => b.x === x && b.y === y);
      setSelectedBuilding(building ? building.id : null);
    }
  };

  const handleBattleCellClick = (x: number, y: number) => {
    if (viewMode !== 'battle' || !selectedTroop) return;

    const troopData = troops.find((t) => t.type === selectedTroop);
    if (!troopData || troopData.count <= 0) return;

    setDeployedTroops([...deployedTroops, { type: selectedTroop, x, y, deployTime: Date.now() }]);
    setTroops(troops.map((t) => t.type === selectedTroop ? { ...t, count: t.count - 1 } : t));
  };

  const deleteBuilding = () => {
    if (!selectedBuilding) return;
    setBuildings(buildings.filter((b) => b.id !== selectedBuilding));
    setSelectedBuilding(null);
  };

  const scoutTarget = async (target: AttackTarget) => {
    try {
      const response = await clashApi.checkAttack(target.id);
      if (response.data.canAttack) {
        setSelectedTarget(target);
        setTargetBase(response.data.defender.baseLayout.buildings || []);
        setViewMode('scout');
      } else {
        alert(`Cannot attack: ${response.data.reason}`);
      }
    } catch (error) {
      console.error('Failed to scout target:', error);
    }
  };

  const startBattle = () => {
    if (!selectedTarget) return;
    setDeployedTroops([]);
    setBattleResult(null);
    setViewMode('battle');
  };

  const endBattle = async () => {
    if (!selectedTarget) return;

    const totalTroops = deployedTroops.length;
    const destruction = Math.min(100, Math.floor(totalTroops * 4 + Math.random() * 20));
    const starsEarned = destruction >= 100 ? 3 : destruction >= 50 ? 2 : destruction >= 25 ? 1 : 0;

    try {
      const response = await clashApi.executeAttack({
        defenderId: selectedTarget.id,
        troops: deployedTroops,
        duration: 120,
        destruction,
        starsEarned,
      });

      setBattleResult({
        success: response.data.success,
        starsEarned: response.data.starsEarned,
        destruction: response.data.destruction,
        auraTaken: response.data.auraTaken,
        moneyTaken: response.data.moneyTaken,
        trophiesWon: response.data.trophiesWon,
      });

      if (response.data.newBalance) {
        updateBalance(response.data.newBalance.aura, response.data.newBalance.money);
      }

      setAttackCooldown(new Date(response.data.cooldownUntil));
    } catch (error) {
      console.error('Failed to execute attack:', error);
    }
  };

  const formatTimeRemaining = (date: Date | null): string => {
    if (!date) return '';
    const diff = date.getTime() - Date.now();
    if (diff <= 0) return '';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const renderGrid = (gridBuildings: Building[], clickHandler: (x: number, y: number) => void, isInteractive: boolean) => (
    <div
      className="grid gap-px bg-border/20"
      style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`, aspectRatio: '1/1' }}
    >
      {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
        const x = index % GRID_SIZE;
        const y = Math.floor(index / GRID_SIZE);
        const building = gridBuildings.find((b) => b.x === x && b.y === y);
        const deployedHere = deployedTroops.filter((t) => Math.floor(t.x) === x && Math.floor(t.y) === y);
        const isSelected = building && building.id === selectedBuilding;

        return (
          <div
            key={index}
            onClick={() => clickHandler(x, y)}
            className={cn(
              "aspect-square flex items-center justify-center text-xs transition-all",
              isInteractive && "cursor-pointer hover:bg-muted/50",
              building ? 'bg-muted/30' : 'bg-background',
              isSelected && 'ring-1 ring-foreground',
              placingBuilding && 'hover:bg-muted/50'
            )}
          >
            {building && (
              <span className="text-sm" title={BUILDING_CONFIG[building.type]?.name}>
                {BUILDING_CONFIG[building.type]?.emoji}
              </span>
            )}
            {deployedHere.length > 0 && (
              <span className="text-xs">{TROOP_CONFIG[deployedHere[0].type]?.emoji}</span>
            )}
          </div>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-12">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">Stratégie</p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">Clash</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground tabular-nums">
            <span>{trophies} 🏆</span>
            <span>{defenseRating} 🛡️</span>
            {shieldUntil && new Date() < shieldUntil && (
              <span>Shield: {formatTimeRemaining(shieldUntil)}</span>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['base', 'attack', 'history'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              "px-4 py-2 text-sm border transition-colors",
              (viewMode === mode || (viewMode === 'scout' && mode === 'attack') || (viewMode === 'battle' && mode === 'attack'))
                ? "border-foreground text-foreground"
                : "border-border/30 text-muted-foreground hover:text-foreground"
            )}
          >
            {mode === 'base' ? 'Base' : mode === 'attack' ? 'Attaque' : 'Historique'}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Base View */}
      {viewMode === 'base' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Base</h2>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => { setIsEditing(false); setPlacingBuilding(null); setSelectedBuilding(null); loadBase(); }}
                      className="px-3 py-1 text-sm border border-border/30 text-muted-foreground hover:text-foreground"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={saveBase}
                      disabled={saving}
                      className="px-3 py-1 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Sauvegarder'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background"
                  >
                    Modifier
                  </button>
                )}
              </div>
            </div>
            {renderGrid(buildings, handleCellClick, isEditing)}
          </div>

          <div className="space-y-6">
            {isEditing && (
              <div className="space-y-4">
                <h3 className="text-sm text-muted-foreground uppercase tracking-wide">Bâtiments</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(BUILDING_CONFIG).map(([type, config]) => (
                    <button
                      key={type}
                      onClick={() => setPlacingBuilding(type === placingBuilding ? null : type)}
                      className={cn(
                        "p-2 text-left text-sm border transition-colors",
                        placingBuilding === type
                          ? "border-foreground"
                          : "border-border/30 hover:border-foreground/30"
                      )}
                    >
                      <span className="mr-2">{config.emoji}</span>
                      {config.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedBuilding && isEditing && (
              <div className="space-y-4">
                <h3 className="text-sm text-muted-foreground uppercase tracking-wide">Sélectionné</h3>
                <button
                  onClick={deleteBuilding}
                  className="w-full px-3 py-2 text-sm border border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  Supprimer
                </button>
              </div>
            )}

            {!isEditing && (
              <div className="space-y-4">
                <h3 className="text-sm text-muted-foreground uppercase tracking-wide">Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Défense</span><span>{defenseRating}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Trophées</span><span>{trophies}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Bâtiments</span><span>{buildings.length}</span></div>
                  {attackCooldown && new Date() < attackCooldown && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Cooldown</span><span>{formatTimeRemaining(attackCooldown)}</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attack View */}
      {viewMode === 'attack' && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Cibles</h2>
            <button onClick={loadTargets} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {attackCooldown && new Date() < attackCooldown ? (
            <p className="text-center text-muted-foreground py-8">
              Cooldown: {formatTimeRemaining(attackCooldown)}
            </p>
          ) : targets.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucune cible disponible</p>
          ) : (
            <div className="space-y-0">
              {targets.map((target) => (
                <div key={target.id} className="flex items-center justify-between py-4 border-b border-border/30">
                  <div>
                    <p className="font-medium">{target.username}</p>
                    <p className="text-sm text-muted-foreground">
                      {target.trophies} 🏆 · {target.defenseRating} 🛡️
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground tabular-nums">
                      ${target.potentialMoney} · {target.potentialAura} aura
                    </span>
                    <button
                      onClick={() => scoutTarget(target)}
                      className="px-3 py-1 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background"
                    >
                      Scout
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Scout View */}
      {viewMode === 'scout' && selectedTarget && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => { setViewMode('attack'); setSelectedTarget(null); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-medium">Scout: {selectedTarget.username}</h2>
              <p className="text-sm text-muted-foreground">
                {selectedTarget.trophies} 🏆 · ${selectedTarget.potentialMoney} · {selectedTarget.potentialAura} aura
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {renderGrid(targetBase, () => {}, false)}
            </div>
            <div>
              <button
                onClick={startBattle}
                className="w-full px-4 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background"
              >
                Attaquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Battle View */}
      {viewMode === 'battle' && selectedTarget && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Bataille: {selectedTarget.username}</h2>
            {!battleResult && (
              <button
                onClick={endBattle}
                className="px-3 py-1 text-sm border border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <ChevronRight className="w-4 h-4 inline mr-1" />
                Terminer
              </button>
            )}
          </div>

          {battleResult ? (
            <Dialog open={true} onOpenChange={() => {}}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-center text-2xl font-light">
                    {battleResult.success ? 'Victoire!' : 'Défaite'}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="text-center space-y-4">
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3].map((star) => (
                      <Star
                        key={star}
                        className={cn("w-6 h-6", star <= battleResult.starsEarned ? 'text-foreground fill-foreground' : 'text-muted-foreground/30')}
                      />
                    ))}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">{battleResult.destruction}% destruction</p>
                  
                  {(battleResult.moneyTaken > 0 || battleResult.auraTaken > 0) && (
                    <p className="text-sm">
                      {battleResult.moneyTaken > 0 && `+$${battleResult.moneyTaken}`}
                      {battleResult.moneyTaken > 0 && battleResult.auraTaken > 0 && ' · '}
                      {battleResult.auraTaken > 0 && `+${battleResult.auraTaken} aura`}
                    </p>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    onClick={() => { setViewMode('attack'); setSelectedTarget(null); setBattleResult(null); setDeployedTroops([]); loadBase(); }}
                    variant="outline"
                    className="w-full border-foreground"
                  >
                    Continuer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-2">
                <p className="text-xs text-muted-foreground">Clique pour déployer des troupes</p>
                {renderGrid(targetBase, handleBattleCellClick, true)}
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm text-muted-foreground uppercase tracking-wide">Troupes</h3>
                  <div className="space-y-2">
                    {troops.map((troop) => (
                      <button
                        key={troop.type}
                        onClick={() => setSelectedTroop(troop.type === selectedTroop ? null : troop.type)}
                        disabled={troop.count <= 0}
                        className={cn(
                          "w-full flex items-center justify-between p-2 text-sm border transition-colors",
                          selectedTroop === troop.type ? "border-foreground" : "border-border/30",
                          troop.count <= 0 && "opacity-30"
                        )}
                      >
                        <span>{TROOP_CONFIG[troop.type]?.emoji} {TROOP_CONFIG[troop.type]?.name}</span>
                        <span className="tabular-nums">{troop.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-3xl font-light tabular-nums">{deployedTroops.length}</p>
                  <p className="text-xs text-muted-foreground uppercase">déployées</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History View */}
      {viewMode === 'history' && (
        <section className="space-y-6">
          <h2 className="text-lg font-medium">Historique</h2>

          {attackHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucune attaque</p>
          ) : (
            <div className="space-y-0">
              {attackHistory.map((attack) => {
                const isAttacker = attack.attackerId === user?.id;
                return (
                  <div key={attack.id} className="flex items-center justify-between py-4 border-b border-border/30">
                    <div>
                      <p className="font-medium">
                        {isAttacker ? `→ ${attack.defender.username}` : `← ${attack.attacker.username}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(attack.attackedAt).toLocaleDateString()} · {attack.starsEarned}★ · {attack.destruction}%
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      {isAttacker ? (
                        attack.success ? (
                          <span className="text-foreground">+${attack.moneyTaken}</span>
                        ) : (
                          <span className="text-muted-foreground">Échec</span>
                        )
                      ) : (
                        attack.success ? (
                          <span className="text-muted-foreground">-${attack.moneyTaken}</span>
                        ) : (
                          <span className="text-foreground">Défendu</span>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

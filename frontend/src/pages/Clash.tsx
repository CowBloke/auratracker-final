import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { clashApi, Building, AttackTarget, Troop } from '../services/api';
import {
  Swords,
  Shield,
  Trophy,
  Target,
  Clock,
  Coins,
  Sparkles,
  Home,
  Edit3,
  Eye,
  ChevronRight,
  X,
  Play,
  Star,
  History,
  Crown,
  Zap,
  Building as BuildingIcon,
  Bomb,
  Square,
  Hammer,
  Droplet,
  Building2,
  Sword,
  User,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Building definitions with Lucide icons
const BUILDING_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; name: string }> = {
  townhall: { icon: BuildingIcon, color: '#f59e0b', name: 'Town Hall' },
  cannon: { icon: Bomb, color: '#ef4444', name: 'Cannon' },
  archer_tower: { icon: Target, color: '#8b5cf6', name: 'Archer Tower' },
  wall: { icon: Square, color: '#6b7280', name: 'Wall' },
  gold_mine: { icon: Hammer, color: '#fbbf24', name: 'Gold Mine' },
  elixir_collector: { icon: Droplet, color: '#ec4899', name: 'Elixir Collector' },
  gold_storage: { icon: Building2, color: '#f59e0b', name: 'Gold Storage' },
  elixir_storage: { icon: Droplet, color: '#d946ef', name: 'Elixir Storage' },
  barracks: { icon: Swords, color: '#3b82f6', name: 'Barracks' },
  mortar: { icon: Zap, color: '#dc2626', name: 'Mortar' },
};

const TROOP_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; name: string; cost: number }> = {
  barbarian: { icon: Sword, color: '#f59e0b', name: 'Barbarian', cost: 25 },
  archer: { icon: Target, color: '#ec4899', name: 'Archer', cost: 50 },
  giant: { icon: Shield, color: '#8b5cf6', name: 'Giant', cost: 100 },
  goblin: { icon: User, color: '#22c55e', name: 'Goblin', cost: 30 },
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

  // Load user's base
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

  // Load attack targets
  const loadTargets = useCallback(async () => {
    try {
      const response = await clashApi.getTargets();
      setTargets(response.data.targets);
    } catch (error) {
      console.error('Failed to load targets:', error);
    }
  }, []);

  // Load attack history
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
    if (viewMode === 'attack') {
      loadTargets();
    } else if (viewMode === 'history') {
      loadHistory();
    }
  }, [viewMode, loadTargets, loadHistory]);

  // Save base layout
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

  // Handle grid cell click
  const handleCellClick = (x: number, y: number) => {
    if (!isEditing) return;

    if (placingBuilding) {
      // Place new building
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
      // Select existing building
      const building = buildings.find((b) => b.x === x && b.y === y);
      if (building) {
        setSelectedBuilding(building.id);
      } else {
        setSelectedBuilding(null);
      }
    }
  };

  // Handle troop deployment in battle
  const handleBattleCellClick = (x: number, y: number) => {
    if (viewMode !== 'battle' || !selectedTroop) return;

    const troopData = troops.find((t) => t.type === selectedTroop);
    if (!troopData || troopData.count <= 0) return;

    const newTroop: Troop = {
      type: selectedTroop,
      x,
      y,
      deployTime: Date.now(),
    };

    setDeployedTroops([...deployedTroops, newTroop]);
    setTroops(troops.map((t) =>
      t.type === selectedTroop ? { ...t, count: t.count - 1 } : t
    ));
  };

  // Delete selected building
  const deleteBuilding = () => {
    if (!selectedBuilding) return;
    setBuildings(buildings.filter((b) => b.id !== selectedBuilding));
    setSelectedBuilding(null);
  };

  // Scout target before attack
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

  // Start battle
  const startBattle = () => {
    if (!selectedTarget) return;
    setDeployedTroops([]);
    setBattleResult(null);
    setViewMode('battle');
  };

  // End battle and calculate results
  const endBattle = async () => {
    if (!selectedTarget) return;

    // Calculate destruction based on deployed troops (simplified simulation)
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

      // Update user balance
      if (response.data.newBalance) {
        updateBalance(response.data.newBalance.aura, response.data.newBalance.money);
      }

      setAttackCooldown(new Date(response.data.cooldownUntil));
    } catch (error) {
      console.error('Failed to execute attack:', error);
    }
  };

  // Format time remaining
  const formatTimeRemaining = (date: Date | null): string => {
    if (!date) return '';
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff <= 0) return '';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Render grid
  const renderGrid = (gridBuildings: Building[], clickHandler: (x: number, y: number) => void, isInteractive: boolean) => (
    <div
      className="grid gap-px bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700"
      style={{
        gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
        aspectRatio: '1/1',
      }}
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
              "relative aspect-square flex items-center justify-center text-xs transition-all duration-150",
              isInteractive && "cursor-pointer hover:bg-primary/20",
              building ? 'bg-muted' : 'bg-background/50',
              isSelected && 'ring-2 ring-primary',
              placingBuilding && 'hover:bg-primary/30'
            )}
          >
            {building && (
              <div
                className="absolute inset-0.5 rounded flex items-center justify-center"
                style={{ backgroundColor: `${BUILDING_CONFIG[building.type]?.color}20` }}
              >
                {(() => {
                  const BuildingIcon = BUILDING_CONFIG[building.type]?.icon;
                  return BuildingIcon ? (
                    <BuildingIcon className="w-5 h-5" style={{ color: BUILDING_CONFIG[building.type]?.color }} />
                  ) : null;
                })()}
                <span className="absolute bottom-0 right-0 text-[8px] font-bold text-white bg-black/50 px-0.5 rounded">
                  {building.level}
                </span>
              </div>
            )}
            {deployedHere.map((troop, i) => {
              const TroopIcon = TROOP_CONFIG[troop.type]?.icon;
              return TroopIcon ? (
                <TroopIcon 
                  key={i} 
                  className="absolute w-4 h-4 animate-bounce" 
                  style={{ 
                    animationDelay: `${i * 100}ms`,
                    color: TROOP_CONFIG[troop.type]?.color 
                  }} 
                />
              ) : null;
            })}
          </div>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse text-primary text-xl">Loading base...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Swords className="w-8 h-8 text-primary" />
            Clash
          </h1>
          <p className="text-muted-foreground mt-1">Build your base, raid enemies, earn glory</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="px-4 py-2">
            <Trophy className="w-5 h-5 mr-2" />
            <span className="font-bold">{trophies}</span>
          </Badge>
          <Badge variant="secondary" className="px-4 py-2">
            <Shield className="w-5 h-5 mr-2" />
            <span className="font-bold">{defenseRating}</span>
          </Badge>
          {shieldUntil && new Date() < shieldUntil && (
            <Badge variant="outline" className="px-4 py-2 bg-primary/20 border-primary/50">
              <Shield className="w-5 h-5 mr-2" />
              <span>{formatTimeRemaining(shieldUntil)}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg border border-border">
        {[
          { id: 'base' as ViewMode, label: 'My Base', icon: Home },
          { id: 'attack' as ViewMode, label: 'Attack', icon: Target },
          { id: 'history' as ViewMode, label: 'History', icon: History },
        ].map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            onClick={() => setViewMode(id)}
            variant={viewMode === id || (viewMode === 'scout' && id === 'attack') || (viewMode === 'battle' && id === 'attack') ? 'default' : 'ghost'}
            className="flex-1"
          >
            <Icon className="w-4 h-4" />
            {label}
          </Button>
        ))}
      </div>

      {/* Base View */}
      {viewMode === 'base' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Grid */}
          <Card className="lg:col-span-2">
            <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Home className="w-5 h-5 text-primary" />
                Base Layout
              </h2>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button
                      onClick={() => {
                        setIsEditing(false);
                        setPlacingBuilding(null);
                        setSelectedBuilding(null);
                        loadBase();
                      }}
                      variant="secondary"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                    <Button
                      onClick={saveBase}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Base'}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Base
                  </Button>
                )}
              </div>
            </div>

            {renderGrid(buildings, handleCellClick, isEditing)}
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Building Palette (when editing) */}
            {isEditing && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap className="w-4 h-4 text-primary" />
                    Buildings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(BUILDING_CONFIG).map(([type, config]) => {
                      const Icon = config.icon;
                      return (
                        <Button
                          key={type}
                          onClick={() => setPlacingBuilding(type === placingBuilding ? null : type)}
                          variant={placingBuilding === type ? 'default' : 'outline'}
                          className="h-auto p-2 flex-col items-start"
                        >
                          <Icon className="w-5 h-5" style={{ color: config.color }} />
                          <p className="text-xs mt-1 truncate">{config.name}</p>
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected Building Info */}
            {selectedBuilding && isEditing && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Selected Building</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const building = buildings.find((b) => b.id === selectedBuilding);
                    if (!building) return null;
                    const config = BUILDING_CONFIG[building.type];
                    const BuildingIcon = config?.icon;
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          {BuildingIcon && (
                            <BuildingIcon className="w-8 h-8" style={{ color: config?.color }} />
                          )}
                          <div>
                            <p className="font-bold">{config?.name}</p>
                            <CardDescription>Level {building.level}</CardDescription>
                          </div>
                        </div>
                        <Button
                          onClick={deleteBuilding}
                          variant="destructive"
                          className="w-full"
                        >
                          Remove Building
                        </Button>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Base Stats */}
            {!isEditing && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Base Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Defense Rating</span>
                      <span className="font-bold">{defenseRating}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trophies</span>
                      <span className="font-bold">{trophies}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Buildings</span>
                      <span className="font-bold">{buildings.length}</span>
                    </div>
                    {attackCooldown && new Date() < attackCooldown && (
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Attack Cooldown
                        </span>
                        <span className="font-bold">{formatTimeRemaining(attackCooldown)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Attack View - Target Selection */}
      {viewMode === 'attack' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Available Targets
            </h2>
            <Button onClick={loadTargets} variant="secondary">
              Refresh Targets
            </Button>
          </div>

          {attackCooldown && new Date() < attackCooldown ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Clock className="w-12 h-12 mx-auto text-primary mb-3" />
                <p className="text-lg font-bold">Attack on Cooldown</p>
                <CardDescription>Time remaining: {formatTimeRemaining(attackCooldown)}</CardDescription>
              </CardContent>
            </Card>
          ) : targets.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Target className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <CardDescription>No targets available. Try again later.</CardDescription>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {targets.map((target) => (
                <Card key={target.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <Crown className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold">{target.username}</p>
                          <CardDescription className="flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            {target.trophies} trophies
                          </CardDescription>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">Defense</p>
                        <p className="font-bold">{target.defenseRating}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mb-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Coins className="w-4 h-4" />
                        <span>{target.potentialMoney}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Sparkles className="w-4 h-4" />
                        <span>{target.potentialAura}</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => scoutTarget(target)}
                      className="w-full"
                    >
                      <Eye className="w-4 h-4" />
                      Scout Base
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scout View */}
      {viewMode === 'scout' && selectedTarget && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => {
                setViewMode('attack');
                setSelectedTarget(null);
              }}
              variant="secondary"
              size="icon"
            >
              <X className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                Scouting: {selectedTarget.username}
              </h2>
              <CardDescription>Review the base before attacking</CardDescription>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardContent className="p-4">
                {renderGrid(targetBase, () => {}, false)}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Target Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trophies</span>
                      <span className="font-bold">{selectedTarget.trophies}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Defense</span>
                      <span className="font-bold">{selectedTarget.defenseRating}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Potential Loot</span>
                      <span className="font-bold">${selectedTarget.potentialMoney}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Potential Aura</span>
                      <span className="font-bold">{selectedTarget.potentialAura}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={startBattle}
                size="lg"
                className="w-full"
              >
                <Swords className="w-4 h-4" />
                Attack!
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Battle View */}
      {viewMode === 'battle' && selectedTarget && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Swords className="w-5 h-5" />
              Battle: {selectedTarget.username}
            </h2>
            {!battleResult && (
              <Button
                onClick={endBattle}
                variant="destructive"
              >
                <ChevronRight className="w-4 h-4" />
                End Battle
              </Button>
            )}
          </div>

          {battleResult ? (
            // Battle Result
            <Card className="max-w-md mx-auto">
              <CardContent className="p-8 text-center">
                <div className="mb-6">
                {battleResult.success ? (
                  <div className="text-primary">
                    <Trophy className="w-16 h-16 mx-auto mb-2" />
                    <h3 className="text-2xl font-bold">Victory!</h3>
                  </div>
                ) : (
                  <div className="text-destructive">
                    <X className="w-16 h-16 mx-auto mb-2" />
                    <h3 className="text-2xl font-bold">Defeat</h3>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "w-8 h-8",
                      star <= battleResult.starsEarned
                        ? 'text-primary fill-primary'
                        : 'text-muted-foreground'
                    )}
                  />
                ))}
              </div>

              <div className="space-y-3 text-left mb-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destruction</span>
                  <span className="font-bold">{battleResult.destruction}%</span>
                </div>
                {battleResult.moneyTaken > 0 && (
                  <div className="flex justify-between">
                    <span>Money Looted</span>
                    <Badge variant="secondary">+${battleResult.moneyTaken}</Badge>
                  </div>
                )}
                {battleResult.auraTaken > 0 && (
                  <div className="flex justify-between">
                    <span>Aura Stolen</span>
                    <Badge variant="secondary">+{battleResult.auraTaken}</Badge>
                  </div>
                )}
                {battleResult.trophiesWon > 0 && (
                  <div className="flex justify-between">
                    <span>Trophies</span>
                    <Badge variant="secondary">+{battleResult.trophiesWon}</Badge>
                  </div>
                )}
              </div>

              <Button
                onClick={() => {
                  setViewMode('attack');
                  setSelectedTarget(null);
                  setBattleResult(null);
                  setDeployedTroops([]);
                  loadBase();
                }}
                className="w-full"
              >
                Continue
              </Button>
              </CardContent>
            </Card>
          ) : (
            // Active Battle
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-2">Click on the edges to deploy troops</p>
                  {renderGrid(targetBase, handleBattleCellClick, true)}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Swords className="w-4 h-4 text-primary" />
                      Your Army
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {troops.map((troop) => {
                        const TroopIcon = TROOP_CONFIG[troop.type]?.icon;
                        return (
                          <Button
                            key={troop.type}
                            onClick={() => setSelectedTroop(troop.type === selectedTroop ? null : troop.type)}
                            disabled={troop.count <= 0}
                            variant={selectedTroop === troop.type ? 'default' : 'outline'}
                            className="w-full justify-between"
                          >
                            <div className="flex items-center gap-2">
                              {TroopIcon && (
                                <TroopIcon className="w-5 h-5" style={{ color: TROOP_CONFIG[troop.type]?.color }} />
                              )}
                              <span>{TROOP_CONFIG[troop.type]?.name}</span>
                            </div>
                            <Badge variant="secondary">{troop.count}</Badge>
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-bold mb-2">Deployed</h3>
                    <p className="text-2xl font-bold text-primary">{deployedTroops.length}</p>
                    <CardDescription>troops on the field</CardDescription>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History View */}
      {viewMode === 'history' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            Attack History
          </h2>

          {attackHistory.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <History className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <CardDescription>No attacks yet</CardDescription>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {attackHistory.map((attack) => (
                <Card
                  key={attack.id}
                  className={cn(
                    "border-l-4",
                    attack.attackerId === user?.id
                      ? attack.success
                        ? 'border-l-primary'
                        : 'border-l-destructive'
                      : attack.success
                        ? 'border-l-destructive'
                        : 'border-l-primary'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {attack.attackerId === user?.id ? (
                          <Swords className="w-5 h-5 text-primary" />
                        ) : (
                          <Shield className="w-5 h-5 text-primary" />
                        )}
                        <div>
                          <p className="font-bold">
                            {attack.attackerId === user?.id
                              ? `Attacked ${attack.defender.username}`
                              : `Defended against ${attack.attacker.username}`}
                          </p>
                          <CardDescription>
                            {new Date(attack.attackedAt).toLocaleDateString()} •{' '}
                            {attack.starsEarned} stars • {attack.destruction}% destruction
                          </CardDescription>
                        </div>
                      </div>

                      <div className="text-right">
                        {attack.attackerId === user?.id ? (
                          attack.success ? (
                            <div>
                              <Badge variant="secondary">+${attack.moneyTaken}</Badge>
                              {attack.auraTaken > 0 && (
                                <Badge variant="secondary" className="ml-1">+{attack.auraTaken} aura</Badge>
                              )}
                            </div>
                          ) : (
                            <Badge variant="destructive">Failed</Badge>
                          )
                        ) : (
                          attack.success ? (
                            <div>
                              <Badge variant="destructive">-${attack.moneyTaken}</Badge>
                              {attack.auraTaken > 0 && (
                                <Badge variant="destructive" className="ml-1">-{attack.auraTaken} aura</Badge>
                              )}
                            </div>
                          ) : (
                            <Badge variant="secondary">Defended!</Badge>
                          )
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
} from 'lucide-react';

// Building definitions with emoji icons and colors
const BUILDING_CONFIG: Record<string, { icon: string; color: string; name: string }> = {
  townhall: { icon: '🏰', color: '#f59e0b', name: 'Town Hall' },
  cannon: { icon: '💣', color: '#ef4444', name: 'Cannon' },
  archer_tower: { icon: '🏹', color: '#8b5cf6', name: 'Archer Tower' },
  wall: { icon: '🧱', color: '#6b7280', name: 'Wall' },
  gold_mine: { icon: '⛏️', color: '#fbbf24', name: 'Gold Mine' },
  elixir_collector: { icon: '🧪', color: '#ec4899', name: 'Elixir Collector' },
  gold_storage: { icon: '🏦', color: '#f59e0b', name: 'Gold Storage' },
  elixir_storage: { icon: '🫙', color: '#d946ef', name: 'Elixir Storage' },
  barracks: { icon: '⚔️', color: '#3b82f6', name: 'Barracks' },
  mortar: { icon: '💥', color: '#dc2626', name: 'Mortar' },
};

const TROOP_CONFIG: Record<string, { icon: string; color: string; name: string; cost: number }> = {
  barbarian: { icon: '🗡️', color: '#f59e0b', name: 'Barbarian', cost: 25 },
  archer: { icon: '🏹', color: '#ec4899', name: 'Archer', cost: 50 },
  giant: { icon: '👊', color: '#8b5cf6', name: 'Giant', cost: 100 },
  goblin: { icon: '👺', color: '#22c55e', name: 'Goblin', cost: 30 },
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
            className={`
              relative aspect-square flex items-center justify-center text-xs
              transition-all duration-150
              ${isInteractive ? 'cursor-pointer hover:bg-primary/20' : ''}
              ${building ? 'bg-surface' : 'bg-background/50'}
              ${isSelected ? 'ring-2 ring-primary' : ''}
              ${placingBuilding ? 'hover:bg-accent-green/30' : ''}
            `}
          >
            {building && (
              <div
                className="absolute inset-0.5 rounded flex items-center justify-center"
                style={{ backgroundColor: `${BUILDING_CONFIG[building.type]?.color}20` }}
              >
                <span className="text-lg">{BUILDING_CONFIG[building.type]?.icon}</span>
                <span className="absolute bottom-0 right-0 text-[8px] font-bold text-white bg-black/50 px-0.5 rounded">
                  {building.level}
                </span>
              </div>
            )}
            {deployedHere.map((troop, i) => (
              <span key={i} className="absolute text-sm animate-bounce" style={{ animationDelay: `${i * 100}ms` }}>
                {TROOP_CONFIG[troop.type]?.icon}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse text-primary text-xl font-display">Loading base...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-3">
            <Swords className="w-8 h-8 text-accent-orange" />
            Clash
          </h1>
          <p className="text-gray-400 mt-1">Build your base, raid enemies, earn glory</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface rounded-lg border border-gray-700">
            <Trophy className="w-5 h-5 text-money" />
            <span className="font-bold text-money">{trophies}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-surface rounded-lg border border-gray-700">
            <Shield className="w-5 h-5 text-accent-cyan" />
            <span className="font-bold">{defenseRating}</span>
          </div>
          {shieldUntil && new Date() < shieldUntil && (
            <div className="flex items-center gap-2 px-4 py-2 bg-accent-cyan/20 rounded-lg border border-accent-cyan/50">
              <Shield className="w-5 h-5 text-accent-cyan" />
              <span className="text-accent-cyan">{formatTimeRemaining(shieldUntil)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 p-1 bg-surface rounded-lg border border-gray-700">
        {[
          { id: 'base' as ViewMode, label: 'My Base', icon: Home },
          { id: 'attack' as ViewMode, label: 'Attack', icon: Target },
          { id: 'history' as ViewMode, label: 'History', icon: History },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setViewMode(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all flex-1 justify-center ${
              viewMode === id || (viewMode === 'scout' && id === 'attack') || (viewMode === 'battle' && id === 'attack')
                ? 'bg-primary text-white'
                : 'text-gray-400 hover:text-white hover:bg-surface-hover'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Base View */}
      {viewMode === 'base' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Grid */}
          <div className="lg:col-span-2 card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Home className="w-5 h-5 text-primary" />
                Base Layout
              </h2>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setPlacingBuilding(null);
                        setSelectedBuilding(null);
                        loadBase();
                      }}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={saveBase}
                      disabled={saving}
                      className="btn-primary flex items-center gap-2"
                    >
                      {saving ? 'Saving...' : 'Save Base'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Base
                  </button>
                )}
              </div>
            </div>

            {renderGrid(buildings, handleCellClick, isEditing)}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Building Palette (when editing) */}
            {isEditing && (
              <div className="card p-4">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-money" />
                  Buildings
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(BUILDING_CONFIG).map(([type, config]) => (
                    <button
                      key={type}
                      onClick={() => setPlacingBuilding(type === placingBuilding ? null : type)}
                      className={`p-2 rounded-lg border transition-all text-left ${
                        placingBuilding === type
                          ? 'border-primary bg-primary/20'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-xl">{config.icon}</span>
                      <p className="text-xs mt-1 truncate">{config.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Building Info */}
            {selectedBuilding && isEditing && (
              <div className="card p-4">
                <h3 className="font-bold mb-3">Selected Building</h3>
                {(() => {
                  const building = buildings.find((b) => b.id === selectedBuilding);
                  if (!building) return null;
                  const config = BUILDING_CONFIG[building.type];
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{config?.icon}</span>
                        <div>
                          <p className="font-bold">{config?.name}</p>
                          <p className="text-sm text-gray-400">Level {building.level}</p>
                        </div>
                      </div>
                      <button
                        onClick={deleteBuilding}
                        className="btn-danger w-full"
                      >
                        Remove Building
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Base Stats */}
            {!isEditing && (
              <div className="card p-4">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent-cyan" />
                  Base Stats
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Defense Rating</span>
                    <span className="font-bold">{defenseRating}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Trophies</span>
                    <span className="font-bold text-money">{trophies}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Buildings</span>
                    <span className="font-bold">{buildings.length}</span>
                  </div>
                  {attackCooldown && new Date() < attackCooldown && (
                    <div className="flex justify-between text-accent-orange">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Attack Cooldown
                      </span>
                      <span className="font-bold">{formatTimeRemaining(attackCooldown)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attack View - Target Selection */}
      {viewMode === 'attack' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Target className="w-5 h-5 text-accent-orange" />
              Available Targets
            </h2>
            <button onClick={loadTargets} className="btn-secondary">
              Refresh Targets
            </button>
          </div>

          {attackCooldown && new Date() < attackCooldown ? (
            <div className="card p-6 text-center">
              <Clock className="w-12 h-12 mx-auto text-accent-orange mb-3" />
              <p className="text-lg font-bold">Attack on Cooldown</p>
              <p className="text-gray-400">Time remaining: {formatTimeRemaining(attackCooldown)}</p>
            </div>
          ) : targets.length === 0 ? (
            <div className="card p-6 text-center">
              <Target className="w-12 h-12 mx-auto text-gray-500 mb-3" />
              <p className="text-gray-400">No targets available. Try again later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {targets.map((target) => (
                <div key={target.id} className="card p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent-orange/20 flex items-center justify-center">
                        <Crown className="w-5 h-5 text-accent-orange" />
                      </div>
                      <div>
                        <p className="font-bold">{target.username}</p>
                        <p className="text-sm text-gray-400 flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          {target.trophies} trophies
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-gray-400">Defense</p>
                      <p className="font-bold">{target.defenseRating}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-4 text-sm">
                    <div className="flex items-center gap-1 text-money">
                      <Coins className="w-4 h-4" />
                      <span>{target.potentialMoney}</span>
                    </div>
                    <div className="flex items-center gap-1 text-aura">
                      <Sparkles className="w-4 h-4" />
                      <span>{target.potentialAura}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => scoutTarget(target)}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Scout Base
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scout View */}
      {viewMode === 'scout' && selectedTarget && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setViewMode('attack');
                setSelectedTarget(null);
              }}
              className="btn-secondary"
            >
              <X className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Eye className="w-5 h-5 text-accent-cyan" />
                Scouting: {selectedTarget.username}
              </h2>
              <p className="text-gray-400">Review the base before attacking</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-4">
              {renderGrid(targetBase, () => {}, false)}
            </div>

            <div className="space-y-4">
              <div className="card p-4">
                <h3 className="font-bold mb-3">Target Info</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Trophies</span>
                    <span className="font-bold text-money">{selectedTarget.trophies}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Defense</span>
                    <span className="font-bold">{selectedTarget.defenseRating}</span>
                  </div>
                  <div className="flex justify-between text-money">
                    <span>Potential Loot</span>
                    <span className="font-bold">${selectedTarget.potentialMoney}</span>
                  </div>
                  <div className="flex justify-between text-aura">
                    <span>Potential Aura</span>
                    <span className="font-bold">{selectedTarget.potentialAura}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={startBattle}
                className="btn-primary w-full py-3 text-lg flex items-center justify-center gap-2"
              >
                <Swords className="w-5 h-5" />
                Attack!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Battle View */}
      {viewMode === 'battle' && selectedTarget && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2 text-accent-orange">
              <Swords className="w-5 h-5" />
              Battle: {selectedTarget.username}
            </h2>
            {!battleResult && (
              <button
                onClick={endBattle}
                className="btn-danger flex items-center gap-2"
              >
                <ChevronRight className="w-4 h-4" />
                End Battle
              </button>
            )}
          </div>

          {battleResult ? (
            // Battle Result
            <div className="card p-8 text-center max-w-md mx-auto">
              <div className="mb-6">
                {battleResult.success ? (
                  <div className="text-accent-green">
                    <Trophy className="w-16 h-16 mx-auto mb-2" />
                    <h3 className="text-2xl font-bold">Victory!</h3>
                  </div>
                ) : (
                  <div className="text-red-500">
                    <X className="w-16 h-16 mx-auto mb-2" />
                    <h3 className="text-2xl font-bold">Defeat</h3>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3].map((star) => (
                  <Star
                    key={star}
                    className={`w-8 h-8 ${
                      star <= battleResult.starsEarned
                        ? 'text-money fill-money'
                        : 'text-gray-600'
                    }`}
                  />
                ))}
              </div>

              <div className="space-y-3 text-left mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-400">Destruction</span>
                  <span className="font-bold">{battleResult.destruction}%</span>
                </div>
                {battleResult.moneyTaken > 0 && (
                  <div className="flex justify-between text-money">
                    <span>Money Looted</span>
                    <span className="font-bold">+${battleResult.moneyTaken}</span>
                  </div>
                )}
                {battleResult.auraTaken > 0 && (
                  <div className="flex justify-between text-aura">
                    <span>Aura Stolen</span>
                    <span className="font-bold">+{battleResult.auraTaken}</span>
                  </div>
                )}
                {battleResult.trophiesWon > 0 && (
                  <div className="flex justify-between text-accent-green">
                    <span>Trophies</span>
                    <span className="font-bold">+{battleResult.trophiesWon}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setViewMode('attack');
                  setSelectedTarget(null);
                  setBattleResult(null);
                  setDeployedTroops([]);
                  loadBase();
                }}
                className="btn-primary w-full"
              >
                Continue
              </button>
            </div>
          ) : (
            // Active Battle
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 card p-4">
                <p className="text-sm text-gray-400 mb-2">Click on the edges to deploy troops</p>
                {renderGrid(targetBase, handleBattleCellClick, true)}
              </div>

              <div className="space-y-4">
                <div className="card p-4">
                  <h3 className="font-bold mb-3 flex items-center gap-2">
                    <Swords className="w-4 h-4 text-accent-orange" />
                    Your Army
                  </h3>
                  <div className="space-y-2">
                    {troops.map((troop) => (
                      <button
                        key={troop.type}
                        onClick={() => setSelectedTroop(troop.type === selectedTroop ? null : troop.type)}
                        disabled={troop.count <= 0}
                        className={`w-full p-3 rounded-lg border transition-all flex items-center justify-between ${
                          selectedTroop === troop.type
                            ? 'border-primary bg-primary/20'
                            : troop.count > 0
                              ? 'border-gray-700 hover:border-gray-600'
                              : 'border-gray-800 opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{TROOP_CONFIG[troop.type]?.icon}</span>
                          <span>{TROOP_CONFIG[troop.type]?.name}</span>
                        </div>
                        <span className="font-bold">{troop.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card p-4">
                  <h3 className="font-bold mb-2">Deployed</h3>
                  <p className="text-2xl font-bold text-primary">{deployedTroops.length}</p>
                  <p className="text-sm text-gray-400">troops on the field</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History View */}
      {viewMode === 'history' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-gray-400" />
            Attack History
          </h2>

          {attackHistory.length === 0 ? (
            <div className="card p-6 text-center">
              <History className="w-12 h-12 mx-auto text-gray-500 mb-3" />
              <p className="text-gray-400">No attacks yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attackHistory.map((attack) => (
                <div
                  key={attack.id}
                  className={`card p-4 flex items-center justify-between ${
                    attack.attackerId === user?.id
                      ? attack.success
                        ? 'border-l-4 border-l-accent-green'
                        : 'border-l-4 border-l-red-500'
                      : attack.success
                        ? 'border-l-4 border-l-red-500'
                        : 'border-l-4 border-l-accent-green'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {attack.attackerId === user?.id ? (
                      <Swords className="w-5 h-5 text-accent-orange" />
                    ) : (
                      <Shield className="w-5 h-5 text-accent-cyan" />
                    )}
                    <div>
                      <p className="font-bold">
                        {attack.attackerId === user?.id
                          ? `Attacked ${attack.defender.username}`
                          : `Defended against ${attack.attacker.username}`}
                      </p>
                      <p className="text-sm text-gray-400">
                        {new Date(attack.attackedAt).toLocaleDateString()} •{' '}
                        {attack.starsEarned} stars • {attack.destruction}% destruction
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {attack.attackerId === user?.id ? (
                      attack.success ? (
                        <div className="text-accent-green">
                          <p className="font-bold">+${attack.moneyTaken}</p>
                          {attack.auraTaken > 0 && (
                            <p className="text-sm">+{attack.auraTaken} aura</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-red-500 font-bold">Failed</p>
                      )
                    ) : (
                      attack.success ? (
                        <div className="text-red-500">
                          <p className="font-bold">-${attack.moneyTaken}</p>
                          {attack.auraTaken > 0 && (
                            <p className="text-sm">-{attack.auraTaken} aura</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-accent-green font-bold">Defended!</p>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

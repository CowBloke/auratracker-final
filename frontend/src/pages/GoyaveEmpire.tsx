import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useHideGameLeaderboards } from '@/lib/game-preferences';
import { GameFullscreenToolbar } from '@/components/game/GameFullscreenToolbar';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';

// ---- Constants ----
const SAVE_KEY = 'goyave_empire_save';
const TICK_INTERVAL_MS = 200;
const OFFLINE_THRESHOLD_MS = 30_000;
const COST_SCALE = 1.18;
const DB_SAVE_INTERVAL_MS = 3_000; // Keep active leaderboard close to real time
const DB_SAVE_DEBOUNCE_MS = 1_500; // Save shortly after meaningful state changes
const ACTIVE_LEADERBOARD_POLL_MS = 5_000;

// ---- Types ----
type UpgradeTarget =
  | 'click'
  | 'tree'
  | 'picker'
  | 'garden'
  | 'orchard'
  | 'factory'
  | 'plantation'
  | 'lab'
  | 'rocket'
  | 'dimension'
  | 'multiverse'
  | 'chrono'
  | 'divinity';

interface BuildingDef {
  id: string;
  name: string;
  emoji: string;
  baseCost: number;
  baseGps: number;
  description: string;
}

interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  cost: number;
  target: UpgradeTarget;
  multiplier: number;
  unlockCount: number;
}

interface SaveState {
  guavas: number;
  totalGuavas: number;
  clickPower: number;
  buildings: Record<string, number>;
  upgrades: string[];
  lastTick: number;
  cashOutScore: number;
}

// ---- Data ----
const BUILDINGS: BuildingDef[] = [
  { id: 'tree',       name: 'Goyavier',     emoji: '🌳', baseCost: 10,           baseGps: 0.1,    description: 'Un goyavier solitaire. Lent mais bon marché.' },
  { id: 'picker',     name: 'Cueilleur',    emoji: '👷', baseCost: 100,          baseGps: 1,      description: 'Un cueilleur embauché qui récolte pour vous.' },
  { id: 'garden',     name: 'Jardin',       emoji: '🌿', baseCost: 1100,         baseGps: 8,      description: 'Un jardin de goyaves soigneusement entretenu.' },
  { id: 'orchard',    name: 'Verger',       emoji: '🏡', baseCost: 12000,        baseGps: 47,     description: 'Un verger entier de goyaviers matures.' },
  { id: 'factory',    name: 'Usine',        emoji: '🏭', baseCost: 130000,       baseGps: 260,    description: 'Traitement industriel de goyaves à grande échelle.' },
  { id: 'plantation', name: 'Plantation',   emoji: '🌴', baseCost: 1400000,      baseGps: 1400,   description: 'Vaste plantation tropicale gérée par des experts.' },
  { id: 'lab',        name: 'Laboratoire',  emoji: '🔬', baseCost: 20000000,     baseGps: 7800,   description: 'Recherche génétique pour des goyaves surpuissantes.' },
  { id: 'rocket',     name: 'Vaisseau',     emoji: '🚀', baseCost: 330000000,    baseGps: 44000,  description: 'Agriculture en apesanteur dans l\'espace.' },
  { id: 'dimension',  name: 'Dimension',    emoji: '💫', baseCost: 5100000000,   baseGps: 260000, description: 'Exploitation de goyaves dans des dimensions parallèles.' },
  { id: 'multiverse', name: 'Multivers',    emoji: '🌀', baseCost: 85000000000,  baseGps: 1500000, description: 'Des fermes de goyaves synchronisées à travers des univers infinis.' },
  { id: 'chrono',     name: 'Chronoforge',  emoji: '⏳', baseCost: 1300000000000, baseGps: 8500000, description: 'Des serres temporelles qui récoltent hier, aujourd\'hui et demain.' },
  { id: 'divinity',   name: 'Temple divin', emoji: '👑', baseCost: 19000000000000, baseGps: 48000000, description: 'Le sommet absolu de l\'empire goyave, sanctifié par des dieux tropicaux.' },
];

const UPGRADES: UpgradeDef[] = [
  // Click upgrades (always visible)
  { id: 'sharp_nails',        name: 'Ongles aiguisés',      description: '×2 puissance de clic.',           emoji: '💅', cost: 100,          target: 'click',      multiplier: 2, unlockCount: 0  },
  { id: 'harvest_gloves',     name: 'Gants de récolte',     description: '×2 puissance de clic.',           emoji: '🧤', cost: 2000,         target: 'click',      multiplier: 2, unlockCount: 0  },
  { id: 'power_harvester',    name: 'Récolte turbo',        description: '×2 puissance de clic.',           emoji: '⚡', cost: 100000,       target: 'click',      multiplier: 2, unlockCount: 0  },
  { id: 'golden_hands',       name: 'Mains en or',          description: '×2 puissance de clic.',           emoji: '🤲', cost: 5000000,      target: 'click',      multiplier: 2, unlockCount: 0  },
  // Tree upgrades
  { id: 'ripe_trees',         name: 'Goyaves mûres',        description: 'Goyaviers ×2.',                   emoji: '🍃', cost: 200,          target: 'tree',       multiplier: 2, unlockCount: 1  },
  { id: 'grafting',           name: 'Greffage',             description: 'Goyaviers ×2.',                   emoji: '✂️', cost: 3000,         target: 'tree',       multiplier: 2, unlockCount: 5  },
  { id: 'hybrid_goyavier',    name: 'Hybride goyavier',     description: 'Goyaviers ×2.',                   emoji: '🌱', cost: 200000,       target: 'tree',       multiplier: 2, unlockCount: 25 },
  // Picker upgrades
  { id: 'expert_pickers',     name: 'Cueilleurs experts',   description: 'Cueilleurs ×2.',                  emoji: '🏆', cost: 2000,         target: 'picker',     multiplier: 2, unlockCount: 1  },
  { id: 'professional_tools', name: 'Outils pro',           description: 'Cueilleurs ×2.',                  emoji: '🔧', cost: 30000,        target: 'picker',     multiplier: 2, unlockCount: 5  },
  { id: 'mechanized_picking', name: 'Cueillette méca.',     description: 'Cueilleurs ×2.',                  emoji: '🤖', cost: 2000000,      target: 'picker',     multiplier: 2, unlockCount: 25 },
  // Garden upgrades
  { id: 'rich_soil',          name: 'Sol fertile',          description: 'Jardins ×2.',                     emoji: '🪱', cost: 22000,        target: 'garden',     multiplier: 2, unlockCount: 1  },
  { id: 'botanical_study',    name: 'Étude botanique',      description: 'Jardins ×2.',                     emoji: '📖', cost: 330000,       target: 'garden',     multiplier: 2, unlockCount: 5  },
  { id: 'micro_climate',      name: 'Microclimat',          description: 'Jardins ×2.',                     emoji: '🌤️', cost: 22000000,     target: 'garden',     multiplier: 2, unlockCount: 25 },
  // Orchard upgrades
  { id: 'drip_irrigation',    name: 'Irrigation goutte',    description: 'Vergers ×2.',                     emoji: '💧', cost: 240000,       target: 'orchard',    multiplier: 2, unlockCount: 1  },
  { id: 'smart_orchard',      name: 'Verger intelligent',   description: 'Vergers ×2.',                     emoji: '📡', cost: 3600000,      target: 'orchard',    multiplier: 2, unlockCount: 5  },
  { id: 'mega_orchard',       name: 'Méga-verger',          description: 'Vergers ×2.',                     emoji: '🗺️', cost: 240000000,    target: 'orchard',    multiplier: 2, unlockCount: 25 },
  // Factory upgrades
  { id: 'automation',         name: 'Automatisation',       description: 'Usines ×2.',                      emoji: '⚙️', cost: 2600000,      target: 'factory',    multiplier: 2, unlockCount: 1  },
  { id: 'nano_processing',    name: 'Nano-traitement',      description: 'Usines ×2.',                      emoji: '🔬', cost: 39000000,     target: 'factory',    multiplier: 2, unlockCount: 5  },
  { id: 'robo_packaging',     name: 'Emballage robotisé',   description: 'Usines ×2.',                      emoji: '📦', cost: 560000000,    target: 'factory',    multiplier: 2, unlockCount: 25 },
  // Plantation upgrades
  { id: 'tropical_genetics',  name: 'Génétique tropicale',  description: 'Plantations ×2.',                 emoji: '🌺', cost: 28000000,     target: 'plantation', multiplier: 2, unlockCount: 1  },
  { id: 'climate_dome',       name: 'Dôme climatique',      description: 'Plantations ×2.',                 emoji: '🔮', cost: 420000000,    target: 'plantation', multiplier: 2, unlockCount: 5  },
  { id: 'solar_monsoon',      name: 'Mousson solaire',      description: 'Plantations ×2.',                 emoji: '☀️', cost: 6400000000,   target: 'plantation', multiplier: 2, unlockCount: 25 },
  // Lab upgrades
  { id: 'gmo_goyave',         name: 'OGM Goyave',           description: 'Laboratoires ×2.',                emoji: '🧪', cost: 400000000,    target: 'lab',        multiplier: 2, unlockCount: 1  },
  { id: 'super_goyave',       name: 'Super Goyave',         description: 'Laboratoires ×2.',                emoji: '💉', cost: 6000000000,   target: 'lab',        multiplier: 2, unlockCount: 5  },
  { id: 'genome_forge',       name: 'Forge génomique',      description: 'Laboratoires ×2.',                emoji: '🧬', cost: 90000000000,  target: 'lab',        multiplier: 2, unlockCount: 25 },
  // Rocket upgrades
  { id: 'space_farming',      name: 'Agriculture spatiale', description: 'Vaisseaux ×2.',                   emoji: '🛸', cost: 6600000000,   target: 'rocket',     multiplier: 2, unlockCount: 1  },
  { id: 'orbital_greenhouse', name: 'Serres orbitales',     description: 'Vaisseaux ×2.',                   emoji: '🛰️', cost: 99000000000,  target: 'rocket',     multiplier: 2, unlockCount: 5  },
  { id: 'lunar_harvesters',   name: 'Moissonneurs lunaires',description: 'Vaisseaux ×2.',                   emoji: '🌕', cost: 1400000000000, target: 'rocket',     multiplier: 2, unlockCount: 25 },
  // Dimension upgrades
  { id: 'quantum_goyave',     name: 'Goyave quantique',     description: 'Dimensions ×2.',                  emoji: '⚛️', cost: 100000000000, target: 'dimension',  multiplier: 2, unlockCount: 1  },
  { id: 'parallel_dynasties', name: 'Dynasties parallèles', description: 'Dimensions ×2.',                  emoji: '👥', cost: 1500000000000, target: 'dimension',  multiplier: 2, unlockCount: 5  },
  { id: 'paradox_refinery',   name: 'Raffinerie du paradoxe',description: 'Dimensions ×2.',                 emoji: '♾️', cost: 20000000000000, target: 'dimension', multiplier: 2, unlockCount: 25 },
  // Multiverse upgrades
  { id: 'multiversal_rootstock', name: 'Porte-greffes multiversels', description: 'Multivers ×2.',          emoji: '🌌', cost: 2200000000000, target: 'multiverse', multiplier: 2, unlockCount: 1  },
  { id: 'infinite_canopy',       name: 'Canopée infinie',           description: 'Multivers ×2.',          emoji: '🌠', cost: 32000000000000, target: 'multiverse', multiplier: 2, unlockCount: 5  },
  // Chrono upgrades
  { id: 'time_loops',         name: 'Boucles temporelles',  description: 'Chronoforges ×2.',                emoji: '🕰️', cost: 28000000000000, target: 'chrono',    multiplier: 2, unlockCount: 1  },
  { id: 'frozen_harvest',     name: 'Récolte figée',        description: 'Chronoforges ×2.',                emoji: '❄️', cost: 380000000000000, target: 'chrono',   multiplier: 2, unlockCount: 5  },
  // Divinity upgrades
  { id: 'sacred_orchards',    name: 'Vergers sacrés',       description: 'Temples divins ×2.',              emoji: '✨', cost: 420000000000000, target: 'divinity', multiplier: 2, unlockCount: 1  },
  { id: 'guava_ascension',    name: 'Ascension goyavique',  description: 'Temples divins ×2.',              emoji: '🌞', cost: 5500000000000000, target: 'divinity', multiplier: 2, unlockCount: 5  },
];

// ---- Pure helpers ----
function buildingCost(def: BuildingDef, owned: number): number {
  return Math.floor(def.baseCost * Math.pow(COST_SCALE, owned));
}

function buildingGps(def: BuildingDef, owned: number, upgrades: string[]): number {
  if (owned === 0) return 0;
  let mult = 1;
  for (const upg of UPGRADES) {
    if (upg.target === def.id && upgrades.includes(upg.id)) {
      mult *= upg.multiplier;
    }
  }
  return def.baseGps * owned * mult;
}

function totalGps(buildings: Record<string, number>, upgrades: string[]): number {
  return BUILDINGS.reduce((sum, def) => sum + buildingGps(def, buildings[def.id] ?? 0, upgrades), 0);
}

function effectiveClickPower(baseClickPower: number, upgrades: string[]): number {
  let mult = 1;
  for (const upg of UPGRADES) {
    if (upg.target === 'click' && upgrades.includes(upg.id)) {
      mult *= upg.multiplier;
    }
  }
  return baseClickPower * mult;
}

function fmt(n: number): string {
  if (n >= 1_000_000_000_000) return (n / 1_000_000_000_000).toFixed(2) + 'T';
  if (n >= 1_000_000_000)     return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000)         return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)             return (n / 1_000).toFixed(2) + 'K';
  return Math.floor(n).toString();
}

function isUpgradeUnlocked(upg: UpgradeDef, buildings: Record<string, number>, upgrades: string[]): boolean {
  if (upgrades.includes(upg.id)) return false;
  if (upg.target === 'click') return true;
  return (buildings[upg.target] ?? 0) >= upg.unlockCount;
}

function rewardPreviewText(totalGuavas: number): string {
  if (totalGuavas < 100)       return 'Récoltez au moins 100 goyaves pour encaisser.';
  if (totalGuavas < 1000)      return 'Récompense: $10 + 1 aura';
  if (totalGuavas < 10000)     return 'Récompense: $25 + 3 aura';
  if (totalGuavas < 100000)    return 'Récompense: $60 + 8 aura';
  if (totalGuavas < 1000000)   return 'Récompense: $150 + 20 aura';
  if (totalGuavas < 10000000)  return 'Récompense: $400 + 50 aura';

  const topTierMinScore = 10_000_000;
  const maxScoreForScaling = 100_000_000_000_000;
  const maxMoneyReward = 2000;
  const maxAuraReward = 200;
  const clampedScore = Math.min(totalGuavas, maxScoreForScaling);
  const progress = (clampedScore - topTierMinScore) / (maxScoreForScaling - topTierMinScore);

  const curveStrength = 5;
  const scaledProgress = (1 - Math.exp(-curveStrength * progress)) / (1 - Math.exp(-curveStrength));

  const moneyReward = Math.min(
    maxMoneyReward,
    Math.round(1000 + (maxMoneyReward - 1000) * scaledProgress)
  );
  const auraReward = Math.min(
    maxAuraReward,
    Math.round(100 + (maxAuraReward - 100) * scaledProgress)
  );

  return `Récompense: $${moneyReward.toLocaleString('fr-FR')} + ${auraReward.toLocaleString('fr-FR')} aura`;
}

function defaultSave(): SaveState {
  return {
    guavas: 0,
    totalGuavas: 0,
    clickPower: 1,
    buildings: { tree: 0, picker: 0, garden: 0, orchard: 0, factory: 0, plantation: 0, lab: 0, rocket: 0, dimension: 0, multiverse: 0, chrono: 0, divinity: 0 },
    upgrades: [],
    lastTick: Date.now(),
    cashOutScore: 0,
  };
}

function loadSave(): SaveState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const def = defaultSave();
    return {
      ...def,
      ...parsed,
      buildings: { ...def.buildings, ...(parsed.buildings ?? {}) },
    };
  } catch {
    return defaultSave();
  }
}

function persistSave(state: SaveState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

// ---- Component ----
export default function GoyaveEmpire() {
  const hideGameLeaderboards = useHideGameLeaderboards();
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const { user, refreshUser } = useAuth();

  const [save, setSave] = useState<SaveState>(() => loadSave());
  const [offlineGuavas, setOfflineGuavas] = useState<number | null>(null);
  const [cashOutLeaderboard, setCashOutLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [activeLeaderboard, setActiveLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showActiveLeaderboard, setShowActiveLeaderboard] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const saveRef = useRef<SaveState>(save);
  saveRef.current = save;
  const hasInitializedRef = useRef(false);

  const saveToDb = useCallback(async (state: SaveState) => {
    try {
      await gamesApi.saveGoyaveState(JSON.stringify(state));
    } catch {
      // Non-fatal: localStorage is the fallback
    }
  }, []);

  // Load from localStorage + DB on mount, keep the freshest snapshot.
  useEffect(() => {
    const init = async () => {
      let loaded = loadSave();
      try {
        const res = await gamesApi.loadGoyaveSave();
        if (res.data.saveData) {
          const dbSave = JSON.parse(res.data.saveData) as SaveState;
          const def = defaultSave();
          const normalizedDb = { ...def, ...dbSave, buildings: { ...def.buildings, ...(dbSave.buildings ?? {}) } };
          const localLastTick = Number.isFinite(loaded.lastTick) ? loaded.lastTick : 0;
          const dbLastTick = Number.isFinite(normalizedDb.lastTick) ? normalizedDb.lastTick : 0;
          loaded = dbLastTick > localLastTick ? normalizedDb : loaded;
          persistSave(loaded);
        }
      } catch {
        // Fallback to localStorage already loaded above
      }

      const now = Date.now();
      const elapsed = (now - loaded.lastTick) / 1000;
      if (elapsed > OFFLINE_THRESHOLD_MS / 1000) {
        const gps = totalGps(loaded.buildings, loaded.upgrades);
        const earned = gps * elapsed;
        if (earned >= 1) {
          const updated: SaveState = { ...loaded, guavas: loaded.guavas + earned, totalGuavas: loaded.totalGuavas + earned, lastTick: now };
          setSave(updated);
          persistSave(updated);
          hasInitializedRef.current = true;
          setOfflineGuavas(earned);
          return;
        }
      }
      const updated = { ...loaded, lastTick: now };
      setSave(updated);
      hasInitializedRef.current = true;
      persistSave(updated);
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic DB save for persistence + active ranking updates.
  useEffect(() => {
    const interval = setInterval(() => {
      saveToDb(saveRef.current);
    }, DB_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [saveToDb]);

  // Save to DB shortly after state changes to reduce data loss windows.
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    const timeout = setTimeout(() => {
      saveToDb(save);
    }, DB_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [save, saveToDb]);

  // Best-effort flush when tab is hidden or page is unloading.
  useEffect(() => {
    const flushSave = () => {
      if (hasInitializedRef.current) {
        saveToDb(saveRef.current);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSave();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flushSave);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flushSave);
    };
  }, [saveToDb]);

  // Game tick
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPaused) return;
      setSave((prev) => {
        const now = Date.now();
        const dt = (now - prev.lastTick) / 1000;
        const gps = totalGps(prev.buildings, prev.upgrades);
        const earned = gps * dt;
        const next: SaveState = { ...prev, guavas: prev.guavas + earned, totalGuavas: prev.totalGuavas + earned, lastTick: now };
        persistSave(next);
        return next;
      });
    }, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isPaused]);

  // Leaderboard
  const fetchCashOutLeaderboard = useCallback(async () => {
    try {
      const res = await gamesApi.getLeaderboard('goyave_empire', 20);
      setCashOutLeaderboard(res.data.rankings || []);
    } catch { /* non-fatal */ }
  }, []);

  const fetchActiveLeaderboard = useCallback(async () => {
    try {
      const res = await gamesApi.getGoyaveActiveLeaderboard(20);
      setActiveLeaderboard(res.data.rankings || []);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    fetchCashOutLeaderboard();
    fetchActiveLeaderboard();
  }, [fetchCashOutLeaderboard, fetchActiveLeaderboard]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveLeaderboard();
    }, ACTIVE_LEADERBOARD_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchActiveLeaderboard]);

  useEffect(() => {
    if (hideGameLeaderboards && showLeaderboard) {
      setShowLeaderboard(false);
    }
  }, [hideGameLeaderboards, showLeaderboard]);

  // Actions
  const handleClick = useCallback(() => {
    if (isPaused) return;
    setSave((prev) => {
      const power = effectiveClickPower(prev.clickPower, prev.upgrades);
      const next: SaveState = { ...prev, guavas: prev.guavas + power, totalGuavas: prev.totalGuavas + power };
      persistSave(next);
      return next;
    });
  }, [isPaused]);

  const buyBuilding = useCallback((defId: string) => {
    if (isPaused) return;
    setSave((prev) => {
      const def = BUILDINGS.find((b) => b.id === defId)!;
      const owned = prev.buildings[defId] ?? 0;
      const cost = buildingCost(def, owned);
      if (prev.guavas < cost) return prev;
      const next: SaveState = { ...prev, guavas: prev.guavas - cost, buildings: { ...prev.buildings, [defId]: owned + 1 } };
      persistSave(next);
      return next;
    });
  }, [isPaused]);

  const buyUpgrade = useCallback((upgradeId: string) => {
    if (isPaused) return;
    setSave((prev) => {
      const upg = UPGRADES.find((u) => u.id === upgradeId)!;
      if (prev.guavas < upg.cost || prev.upgrades.includes(upgradeId)) return prev;
      const next: SaveState = { ...prev, guavas: prev.guavas - upg.cost, upgrades: [...prev.upgrades, upgradeId] };
      persistSave(next);
      return next;
    });
  }, [isPaused]);

  const handleCashOut = useCallback(async () => {
    if (!user || isCashingOut) return;
    const score = Math.floor(saveRef.current.totalGuavas);
    if (score < 100) return;
    setIsCashingOut(true);
    try {
      const res = await gamesApi.complete('goyave_empire', { score, won: true });
      setRewards({ aura: res.data.auraReward, money: res.data.moneyReward });
      setIsNewHighScore(Boolean(res.data.isNewHighScore));
      await refreshUser();
      fetchCashOutLeaderboard();
      fetchActiveLeaderboard();
      const freshSave: SaveState = { ...defaultSave(), cashOutScore: Math.max(score, saveRef.current.cashOutScore), lastTick: Date.now() };
      setSave(freshSave);
      persistSave(freshSave);
      saveToDb(freshSave);
    } catch (err) {
      console.error('Cash out failed:', err);
    } finally {
      setIsCashingOut(false);
    }
  }, [user, isCashingOut, fetchCashOutLeaderboard, fetchActiveLeaderboard, refreshUser, saveToDb]);

  const handleDeleteScore = async (userId: string, username: string) => {
    try {
      await gamesApi.deleteStats('goyave_empire', userId);
      fetchCashOutLeaderboard();
    } catch (err) {
      console.error('Failed to delete score:', err);
    }
  };

  // Derived values
  const gps = useMemo(() => totalGps(save.buildings, save.upgrades), [save.buildings, save.upgrades]);
  const clickPower = useMemo(() => effectiveClickPower(save.clickPower, save.upgrades), [save.clickPower, save.upgrades]);
  const unlockedUpgrades = useMemo(
    () => UPGRADES.filter((u) => isUpgradeUnlocked(u, save.buildings, save.upgrades)),
    [save.buildings, save.upgrades]
  );

  const PANEL_HEIGHT = 680;

  return (
    <div className="w-full px-2 pb-6 lg:px-4 lg:pb-8">
      {/* Three-column Cookie Clicker layout */}
      <div
        ref={gameContainerRef}
        className={cn(
          'flex w-full flex-col gap-3',
          isFullscreen && 'min-h-screen w-screen bg-background p-4'
        )}
      >
        <GameFullscreenToolbar isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} className="w-full">
          <GamePauseButton isPaused={isPaused} onToggle={() => setIsPaused((current) => !current)} />
        </GameFullscreenToolbar>

        <div className="relative flex gap-0 items-stretch w-full" style={{ height: PANEL_HEIGHT }}>
        <GamePauseOverlay visible={isPaused} onResume={() => setIsPaused(false)} />

        {/* ── LEFT: Upgrades ── */}
        <div className="flex-shrink-0 border border-border/30 border-r-0 rounded-l-xl bg-card flex flex-col overflow-hidden" style={{ width: 192 }}>
          <div className="px-4 py-3 border-b border-border/20 flex-shrink-0">
            <div className="text-xs font-semibold text-muted-foreground">Améliorations</div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {unlockedUpgrades.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center mt-6 leading-relaxed px-2">
                Achetez des bâtiments pour débloquer des améliorations.
              </p>
            ) : (
              <TooltipProvider delayDuration={150}>
                <div className="grid grid-cols-3 gap-1.5">
                  {unlockedUpgrades.map((upg) => {
                    const canAfford = save.guavas >= upg.cost;
                    const targetDef = BUILDINGS.find((b) => b.id === upg.target);
                    return (
                      <Tooltip key={upg.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => buyUpgrade(upg.id)}
                            disabled={!canAfford}
                            className={`aspect-square rounded-lg border-2 text-2xl flex items-center justify-center transition-all select-none
                              ${canAfford
                                ? 'border-yellow-500/70 bg-yellow-500/10 hover:bg-yellow-500/20 hover:border-yellow-400 cursor-pointer shadow-sm shadow-yellow-500/20'
                                : 'border-border/30 bg-muted/10 opacity-40 cursor-not-allowed'
                              }`}
                          >
                            {upg.emoji}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="p-0 overflow-hidden max-w-[200px]">
                          <div className="px-3 pt-3 pb-2 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{upg.emoji}</span>
                              <span className="text-sm font-semibold leading-tight">{upg.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-snug">{upg.description}</p>
                            {targetDef && (
                              <p className="text-xs text-muted-foreground/70">
                                {targetDef.emoji} {targetDef.name}
                              </p>
                            )}
                          </div>
                          <div className={`px-3 py-2 border-t border-border/30 flex items-center justify-between gap-3 ${canAfford ? 'bg-yellow-500/10' : 'bg-muted/20'}`}>
                            <span className="text-xs text-muted-foreground">Coût</span>
                            <span className={`text-xs font-semibold tabular-nums ${canAfford ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                              {fmt(upg.cost)} 🍈
                            </span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* ── CENTER: Main click area ── */}
        <div className="flex-1 border border-border/30 bg-card flex flex-col items-center justify-between py-8 px-6 overflow-hidden">

          {/* Top: big counters */}
          <div className="text-center w-full">
            <div className="text-6xl font-bold tabular-nums leading-none text-green-400">
              {fmt(save.guavas)}
            </div>
            <div className="text-base text-muted-foreground mt-2">goyaves</div>
            <div className="text-sm text-muted-foreground/60 mt-1">
              {fmt(gps)} / seconde
            </div>
          </div>

          {/* Big clickable guava */}
          <button
            onClick={handleClick}
            className="select-none cursor-pointer active:scale-90 hover:scale-110 transition-transform duration-100"
            style={{ filter: 'drop-shadow(0 0 32px rgba(74,222,128,0.35))' }}
            aria-label="Récolter une goyave"
          >
            <img
              src="/assets/doodle-player.png"
              alt="Goyave"
              style={{ width: 224, height: 224, objectFit: 'contain', imageRendering: 'pixelated' }}
              draggable={false}
            />
          </button>

          {/* Bottom info + actions */}
          <div className="w-full space-y-3">
            {/* Click power */}
            <div className="text-center text-xs text-muted-foreground">
              +{fmt(clickPower)} par clic · {fmt(save.totalGuavas)} total récoltées
            </div>

            {/* Offline popup */}
            {offlineGuavas !== null && (
              <div className="border border-green-500/40 rounded-lg bg-green-500/10 px-4 py-2.5 flex items-center justify-between gap-3">
                <span className="text-sm text-green-400">+{fmt(offlineGuavas)} goyaves récoltées hors ligne !</span>
                <button onClick={() => setOfflineGuavas(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
              </div>
            )}

            {/* Rewards display */}
            {rewards && (
              <div className="border border-border/30 rounded-lg bg-muted/20 px-4 py-2.5 text-center space-y-0.5">
                {isNewHighScore && <div className="text-xs font-semibold text-yellow-500">Nouveau record !</div>}
                <div className="text-sm text-muted-foreground">
                  {rewards.money > 0 && <span>+${rewards.money}</span>}
                  {rewards.money > 0 && rewards.aura > 0 && <span className="mx-1.5 opacity-40">·</span>}
                  {rewards.aura > 0 && <span>+{rewards.aura} aura</span>}
                  {rewards.money === 0 && rewards.aura === 0 && <span>Pas assez de goyaves pour une récompense.</span>}
                </div>
              </div>
            )}

            {/* Cash out */}
            <div className="border border-border/30 rounded-lg bg-muted/20 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium">Encaisser l'Empire</div>
                <div className="text-xs text-muted-foreground mt-0.5">{rewardPreviewText(save.totalGuavas)}</div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="shrink-0 text-xs"
                disabled={save.totalGuavas < 100 || isCashingOut}
                onClick={async () => {
                  if (!(await confirm('Encaisser et réinitialiser votre empire ?'))) return;
                  void handleCashOut();
                }}
              >
                {isCashingOut ? '...' : 'Encaisser'}
              </Button>
            </div>

            {/* Record */}
            <div className="text-center text-xs text-muted-foreground">
              Record encaissé : <span className="text-foreground font-medium tabular-nums">{fmt(save.cashOutScore)}</span> goyaves
            </div>
          </div>
        </div>

        {/* ── RIGHT: Buildings + Leaderboard ── */}
        <div className="flex-shrink-0 border border-border/30 border-l-0 rounded-r-xl bg-card flex flex-col overflow-hidden" style={{ width: 320 }}>
          {/* Tab header */}
          <div className="flex border-b border-border/20 flex-shrink-0">
            <button
              onClick={() => setShowLeaderboard(false)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${!showLeaderboard ? 'bg-muted/40 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Bâtiments
            </button>
            {!hideGameLeaderboards && (
              <button
                onClick={() => setShowLeaderboard(true)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${showLeaderboard ? 'bg-muted/40 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Classements
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {!showLeaderboard ? (
              /* Buildings list — Cookie Clicker style */
              <div>
                {BUILDINGS.map((def) => {
                  const owned = save.buildings[def.id] ?? 0;
                  const cost = buildingCost(def, owned);
                  const canAfford = save.guavas >= cost;
                  const contribution = buildingGps(def, owned, save.upgrades);
                  return (
                    <button
                      key={def.id}
                      onClick={() => buyBuilding(def.id)}
                      disabled={!canAfford}
                      className={`w-full text-left px-4 py-3 border-b border-border/20 transition-colors flex items-center gap-3
                        ${canAfford
                          ? 'hover:bg-yellow-500/8 cursor-pointer bg-yellow-500/5'
                          : 'opacity-50 cursor-not-allowed'
                        }`}
                    >
                      {/* Emoji */}
                      <span className={`text-3xl flex-shrink-0 transition-opacity ${owned > 0 ? 'opacity-100' : 'opacity-40'}`}>
                        {def.emoji}
                      </span>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={`text-sm font-semibold truncate ${canAfford ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {def.name}
                          </span>
                          <span className="text-2xl font-bold tabular-nums text-foreground/70 leading-none flex-shrink-0">
                            {owned}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5 gap-2">
                          <span className="text-xs text-muted-foreground truncate">
                            {owned > 0 ? `${fmt(contribution)}/s` : def.description}
                          </span>
                          <span className={`text-xs font-medium tabular-nums flex-shrink-0 ${canAfford ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                            {fmt(cost)} 🍈
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Leaderboards */
              <div className="h-full flex flex-col">
                <div className="p-2 border-b border-border/20 flex gap-2">
                  <button
                    onClick={() => setShowActiveLeaderboard(true)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${showActiveLeaderboard ? 'bg-muted/60 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Actif (live)
                  </button>
                  <button
                    onClick={() => setShowActiveLeaderboard(false)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${!showActiveLeaderboard ? 'bg-muted/60 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Records
                  </button>
                </div>

                <GameLeaderboard
                  entries={showActiveLeaderboard ? activeLeaderboard : cashOutLeaderboard}
                  currentUserId={user?.id}
                  personalHighScore={showActiveLeaderboard ? undefined : save.cashOutScore}
                  isAdmin={showActiveLeaderboard ? false : user?.isAdmin}
                  onDeleteScore={showActiveLeaderboard ? undefined : handleDeleteScore}
                  noCard
                />
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}


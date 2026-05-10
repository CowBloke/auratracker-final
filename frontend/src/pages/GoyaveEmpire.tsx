import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi } from '../services/api';
import { GameLeaderboard, type GameLeaderboardEntry } from '@/components/game/GameLeaderboard';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useHideGameLeaderboards } from '@/lib/game-preferences';
import { Play, RotateCcw, SlidersHorizontal, Trophy } from 'lucide-react';
import { GameFullscreenStage } from '@/components/game/GameFullscreenStage';
import { GamePauseButton } from '@/components/game/GamePauseButton';
import { GamePauseOverlay } from '@/components/game/GamePauseOverlay';
import { useGameFullscreen } from '@/hooks/use-game-fullscreen';
import { GameTopBar } from '@/components/game/GameTopBar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

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
    lastTick: 0, // CRITICAL: 0 means "brand new/not yet ticking", prevents overwriting DB with newer empty saves
    cashOutScore: 0,
  };
}

function getSaveKey(userId?: string): string {
  return userId ? `goyave_empire_save_${userId}` : 'goyave_empire_save';
}

function loadSave(userId?: string): SaveState {
  try {
    const key = getSaveKey(userId);
    const raw = localStorage.getItem(key);
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

function persistSave(state: SaveState, userId?: string): void {
  const key = getSaveKey(userId);
  localStorage.setItem(key, JSON.stringify(state));
}

// ---- Component ----
export default function GoyaveEmpire() {
  const hideGameLeaderboards = useHideGameLeaderboards();
  const { containerRef: gameContainerRef, isFullscreen, toggleFullscreen } = useGameFullscreen<HTMLDivElement>();
  const { user, refreshUser } = useAuth();

  const [save, setSave] = useState<SaveState>(() => defaultSave());
  const [isInitialized, setIsInitialized] = useState(false);
  const [offlineGuavas, setOfflineGuavas] = useState<number | null>(null);
  const [cashOutLeaderboard, setCashOutLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [activeLeaderboard, setActiveLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [rewards, setRewards] = useState<{ aura: number; money: number } | null>(null);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showActiveLeaderboard, setShowActiveLeaderboard] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(true);

  const saveRef = useRef<SaveState>(save);
  saveRef.current = save;

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
      if (!user) return;
      let loaded = loadSave(user.id);
      try {
        const res = await gamesApi.loadGoyaveSave();
        if (res.data.saveData) {
          const dbSave = JSON.parse(res.data.saveData) as SaveState;
          const def = defaultSave();
          const normalizedDb = { ...def, ...dbSave, buildings: { ...def.buildings, ...(dbSave.buildings ?? {}) } };
          const localLastTick = Number.isFinite(loaded.lastTick) ? loaded.lastTick : 0;
          const dbLastTick = Number.isFinite(normalizedDb.lastTick) ? normalizedDb.lastTick : 0;
          loaded = dbLastTick > localLastTick ? normalizedDb : loaded;
          persistSave(loaded, user.id);
        }
      } catch {
        // Fallback to localStorage already loaded above
      }

      const now = Date.now();
      // If the save is brand new (lastTick 0), we don't calculate offline progress
      if (loaded.lastTick > 0) {
        const elapsed = (now - loaded.lastTick) / 1000;
        if (elapsed > OFFLINE_THRESHOLD_MS / 1000) {
          const gps = totalGps(loaded.buildings, loaded.upgrades);
          const earned = gps * elapsed;
          if (earned >= 1) {
            const updated: SaveState = { ...loaded, guavas: loaded.guavas + earned, totalGuavas: loaded.totalGuavas + earned, lastTick: now };
            setSave(updated);
            persistSave(updated, user.id);
            setIsInitialized(true);
            setOfflineGuavas(earned);
            return;
          }
        }
      }
      
      const updated = { ...loaded, lastTick: now };
      setSave(updated);
      setIsInitialized(true);
      persistSave(updated, user.id);
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Periodic DB save for persistence + active ranking updates.
  useEffect(() => {
    const interval = setInterval(() => {
      if (isInitialized) {
        saveToDb(saveRef.current);
      }
    }, DB_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [saveToDb, isInitialized]);

  // Save to DB shortly after state changes to reduce data loss windows.
  useEffect(() => {
    if (!isInitialized) return;
    const timeout = setTimeout(() => {
      saveToDb(save);
    }, DB_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [save, saveToDb, isInitialized]);

  // Best-effort flush when tab is hidden or page is unloading.
  useEffect(() => {
    const flushSave = () => {
      if (isInitialized) {
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
  }, [saveToDb, isInitialized]);

  // Game tick
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPaused || !isInitialized) return;
      setSave((prev) => {
        const now = Date.now();
        // Skip tick if we somehow have a future tick or uninitialized tick
        if (prev.lastTick <= 0) return { ...prev, lastTick: now };
        
        const dt = (now - prev.lastTick) / 1000;
        const gps = totalGps(prev.buildings, prev.upgrades);
        const earned = gps * dt;
        const next: SaveState = { ...prev, guavas: prev.guavas + earned, totalGuavas: prev.totalGuavas + earned, lastTick: now };
        persistSave(next, user?.id);
        return next;
      });
    }, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isPaused, isInitialized, user?.id]);

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
    if (isPaused || !isInitialized) return;
    setSave((prev) => {
      const power = effectiveClickPower(prev.clickPower, prev.upgrades);
      const next: SaveState = { ...prev, guavas: prev.guavas + power, totalGuavas: prev.totalGuavas + power };
      persistSave(next, user?.id);
      return next;
    });
  }, [isPaused, isInitialized, user?.id]);

  const buyBuilding = useCallback((defId: string) => {
    if (isPaused || !isInitialized) return;
    setSave((prev) => {
      const def = BUILDINGS.find((b) => b.id === defId)!;
      const owned = prev.buildings[defId] ?? 0;
      const cost = buildingCost(def, owned);
      if (prev.guavas < cost) return prev;
      const next: SaveState = { ...prev, guavas: prev.guavas - cost, buildings: { ...prev.buildings, [defId]: owned + 1 } };
      persistSave(next, user?.id);
      return next;
    });
  }, [isPaused, isInitialized, user?.id]);

  const buyUpgrade = useCallback((upgradeId: string) => {
    if (isPaused || !isInitialized) return;
    setSave((prev) => {
      const upg = UPGRADES.find((u) => u.id === upgradeId)!;
      if (prev.guavas < upg.cost || prev.upgrades.includes(upgradeId)) return prev;
      const next: SaveState = { ...prev, guavas: prev.guavas - upg.cost, upgrades: [...prev.upgrades, upgradeId] };
      persistSave(next, user?.id);
      return next;
    });
  }, [isPaused, isInitialized, user?.id]);

  const handleCashOut = useCallback(async () => {
    if (!user || isCashingOut || !isInitialized) return;
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
      persistSave(freshSave, user.id);
      saveToDb(freshSave);
    } catch (err) {
      console.error('Cash out failed:', err);
    } finally {
      setIsCashingOut(false);
    }
  }, [user, isCashingOut, isInitialized, fetchCashOutLeaderboard, fetchActiveLeaderboard, refreshUser, saveToDb]);

  const handleDeleteScore = async (userId: string, _username: string) => {
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

  const topBarControls = (
    <div className="space-y-4 text-xs">
      <div className="rounded-lg border border-border/60 p-3 bg-muted/30 space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status de l'Empire</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-border/40 p-2 bg-background">
            <p className="text-[10px] text-muted-foreground">GPS Total</p>
            <p className="font-semibold tabular-nums text-green-400">{fmt(gps)}/s</p>
          </div>
          <div className="rounded border border-border/40 p-2 bg-background">
            <p className="text-[10px] text-muted-foreground">Clic</p>
            <p className="font-semibold tabular-nums">+{fmt(clickPower)}</p>
          </div>
        </div>
      </div>
      <Separator />
      <div className="border border-border/30 rounded-lg bg-muted/20 p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider">Encaisser</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{rewardPreviewText(save.totalGuavas)}</div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 px-3 text-[10px] uppercase font-bold"
            disabled={save.totalGuavas < 100 || isCashingOut}
            onClick={async () => {
              if (!(await confirm('Encaisser et réinitialiser votre empire ?'))) return;
              void handleCashOut();
            }}
          >
            {isCashingOut ? '...' : 'Cash'}
          </Button>
        </div>
        <div className="text-[10px] text-center text-muted-foreground">
          Record : <span className="font-medium">{fmt(save.cashOutScore)}</span>
        </div>
      </div>
      <Separator />
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-center h-8 text-xs"
        onClick={() => setIsPaused((v) => !v)}
      >
        {isPaused ? <Play className="mr-2 h-3 w-3" /> : <RotateCcw className="mr-2 h-3 w-3" />}
        {isPaused ? 'Reprendre' : 'Pause'}
      </Button>
    </div>
  );

  return (
    <div
      ref={gameContainerRef}
      className={`relative flex flex-col gap-3 px-4 pb-6 lg:px-6 lg:pb-8 ${isFullscreen ? 'min-h-screen w-screen items-center bg-background px-4 py-4' : ''}`}
    >
      <GameTopBar
        title="Goyave Empire"
        score={save.guavas}
        scoreSuffix=" 🍈"
        highScore={save.cashOutScore}
        scoreFormatter={fmt}
        isNewHighScore={isNewHighScore}
        rewards={rewards}
        controls={topBarControls}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showLeaderboard={showLeaderboard}
        onToggleLeaderboard={() => setShowLeaderboard(v => !v)}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full"
          onClick={() => setShowSettingsDialog(true)}
          title="Parametres"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </Button>
      </GameTopBar>

      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Parametres Empire</DialogTitle>
          </DialogHeader>
          {topBarControls}
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-center gap-6 overflow-hidden">
        <div className="flex w-full max-w-[1200px] flex-col overflow-hidden">
          <GameFullscreenStage isFullscreen={isFullscreen} baseWidth={1000} baseHeight={PANEL_HEIGHT}>
            <div className="relative flex items-stretch w-full h-full overflow-hidden rounded-[28px] border border-border/30 bg-card shadow-2xl">
              {!isInitialized && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Initialisation de l'Empire...</p>
                  </div>
                </div>
              )}
              <GamePauseOverlay visible={isPaused} onResume={() => setIsPaused(false)} />

              {/* ── LEFT: Upgrades ── */}
              <div className="flex-shrink-0 border-r border-border/20 bg-muted/5 flex flex-col overflow-hidden" style={{ width: 180 }}>
                <div className="px-4 py-3 border-b border-border/20 flex-shrink-0">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Améliorations</div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 scrollbar-hide">
                  {unlockedUpgrades.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center mt-6 leading-relaxed px-2 opacity-50">
                      Plus de bâtiments pour débloquer...
                    </p>
                  ) : (
                    <TooltipProvider delayDuration={150}>
                      <div className="grid grid-cols-3 gap-2">
                        {unlockedUpgrades.map((upg) => {
                          const canAfford = save.guavas >= upg.cost;
                          return (
                            <Tooltip key={upg.id}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => buyUpgrade(upg.id)}
                                  disabled={!canAfford}
                                  className={`aspect-square rounded-xl border-2 text-xl flex items-center justify-center transition-all select-none
                                    ${canAfford
                                      ? 'border-yellow-500/70 bg-yellow-500/10 hover:bg-yellow-500/20 hover:scale-105 cursor-pointer shadow-sm shadow-yellow-500/20'
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
              <div className="flex-1 flex flex-col items-center justify-between py-12 px-8 overflow-hidden bg-gradient-to-b from-card/50 to-muted/20">
                <div className="text-center w-full space-y-2">
                  <div className="text-7xl font-black tabular-nums tracking-tighter text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.2)]">
                    {fmt(save.guavas)}
                  </div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-[0.4em]">goyaves</div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-400/10 text-green-400 text-[10px] font-bold">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400"></span>
                    </span>
                    {fmt(gps)} / seconde
                  </div>
                </div>

                <button
                  onClick={handleClick}
                  className="group relative select-none cursor-pointer active:scale-95 transition-all duration-75"
                  aria-label="Récolter une goyave"
                >
                  <div className="absolute inset-0 bg-green-400/20 rounded-full blur-[60px] group-hover:bg-green-400/30 transition-all"></div>
                  <img
                    src="/assets/doodle-player.png"
                    alt="Goyave"
                    className="relative w-56 h-56 object-contain image-rendering-pixelated group-hover:scale-110 transition-transform duration-200"
                    draggable={false}
                  />
                </button>

                <div className="w-full max-w-sm space-y-4">
                  {offlineGuavas !== null && (
                    <div className="border border-green-500/30 rounded-xl bg-green-500/10 px-4 py-3 flex items-center justify-between gap-3 backdrop-blur-md animate-in slide-in-from-bottom-2">
                      <span className="text-xs font-medium text-green-400">Empire étendu hors-ligne: +{fmt(offlineGuavas)} 🍈</span>
                      <button onClick={() => setOfflineGuavas(null)} className="text-muted-foreground hover:text-foreground">✕</button>
                    </div>
                  )}

                  <div className="text-center space-y-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">
                      Total récolté: {fmt(save.totalGuavas)}
                    </div>
                    <div className="text-[10px] font-medium text-muted-foreground">
                      Puissance de clic: +{fmt(clickPower)}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── RIGHT: Buildings ── */}
              <div className="flex-shrink-0 border-l border-border/20 bg-muted/5 flex flex-col overflow-hidden" style={{ width: 300 }}>
                <div className="px-4 py-3 border-b border-border/20 flex-shrink-0">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Bâtiments</div>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide">
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
                        className={`w-full text-left px-5 py-4 border-b border-border/10 transition-all flex items-center gap-4
                          ${canAfford
                            ? 'hover:bg-yellow-500/5 cursor-pointer'
                            : 'opacity-40 cursor-not-allowed'
                          }`}
                      >
                        <span className={`text-3xl flex-shrink-0 transition-all duration-300 ${owned > 0 ? 'scale-100' : 'scale-75 opacity-30 grayscale'}`}>
                          {def.emoji}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-bold truncate text-foreground/90">
                              {def.name}
                            </span>
                            <span className="text-xl font-black tabular-nums text-foreground/30">
                              {owned}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5 gap-2">
                            <span className="text-[10px] font-medium text-muted-foreground truncate opacity-70">
                              {owned > 0 ? `${fmt(contribution)}/s` : def.description}
                            </span>
                            <span className={`text-[11px] font-bold tabular-nums flex-shrink-0 ${canAfford ? 'text-yellow-500' : 'text-muted-foreground/50'}`}>
                              {fmt(cost)} 🍈
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </GameFullscreenStage>
        </div>

        {showLeaderboard && !isFullscreen && (
          <div className="w-[280px] shrink-0 hidden lg:block h-full">
            <div className="h-full flex flex-col gap-4">
              <div className="p-1 rounded-xl bg-muted/30 border border-border/40 flex gap-1">
                <button
                  onClick={() => setShowActiveLeaderboard(true)}
                  className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${showActiveLeaderboard ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Actif
                </button>
                <button
                  onClick={() => setShowActiveLeaderboard(false)}
                  className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${!showActiveLeaderboard ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
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
                title={showActiveLeaderboard ? "Empire Actuel" : "Meilleurs Records"}
                maxHeight={PANEL_HEIGHT - 60}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


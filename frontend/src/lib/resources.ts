import {
  Building2,
  Cog,
  Database,
  FileText,
  Flame,
  Gem,
  Hammer,
  Heart,
  Layers,
  Leaf,
  Mountain,
  Scissors,
  ShieldAlert,
  Wind,
  Droplets,
  ShieldOff,
  Sparkles,
  Zap,
} from 'lucide-react';

export type ResourceType =
  | 'WOOD' | 'STONE' | 'IRON' | 'FOOD' | 'CLOTH'
  | 'CONCRETE' | 'STEEL' | 'FUEL' | 'PAPER'
  | 'LUXURY_GOODS' | 'MEDICINE' | 'DATA' | 'CONTRABAND' | 'HORSES'
  // ── Craftable items ───────────────────────────────────────────────────────
  | 'ADBLOCK_TOKEN' | 'JUICE_ABRICOT' | 'JUICE_GINGEMBRE'
  | 'JUICE_GOYAVE' | 'JUICE_MALAKOUKOU' | 'JUICE_PAPAYE';

export type ResourceTier = 'RAW' | 'REFINED' | 'FINISHED' | 'SPECIAL' | 'ITEM';

export interface ResourceMeta {
  label: string;
  tier: ResourceTier;
  description: string;
  bg: string;
  iconColor: string;
  emoji?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
}

export const RESOURCE_META: Record<ResourceType, ResourceMeta> = {
  WOOD:         { label: 'Bois',        tier: 'RAW',      description: 'Matériau de base pour construire des structures et entreprises', bg: 'bg-amber-500/15',  iconColor: 'text-amber-600 dark:text-amber-400',   Icon: Layers },
  STONE:        { label: 'Pierre',      tier: 'RAW',      description: 'Utilisé pour les fondations, structures et stockage',            bg: 'bg-slate-500/15',  iconColor: 'text-slate-500 dark:text-slate-400',   Icon: Mountain },
  IRON:         { label: 'Fer',         tier: 'RAW',      description: 'Composant essentiel des équipements et outils',                  bg: 'bg-zinc-500/15',   iconColor: 'text-zinc-500 dark:text-zinc-400',     Icon: Hammer },
  FOOD:         { label: 'Nourriture',  tier: 'RAW',      description: 'Restaurants, salaires NPC et ravitaillement de guerre',         bg: 'bg-green-500/15',  iconColor: 'text-green-600 dark:text-green-400',   Icon: Leaf },
  CLOTH:        { label: 'Tissu',       tier: 'RAW',      description: 'Matière première pour agences et cosmétiques',                  bg: 'bg-rose-500/15',   iconColor: 'text-rose-500 dark:text-rose-400',     Icon: Scissors },
  CONCRETE:     { label: 'Béton',       tier: 'REFINED',  description: 'Bâtiments avancés, entrepôts et fortifications',                bg: 'bg-gray-500/15',   iconColor: 'text-gray-500 dark:text-gray-400',     Icon: Building2 },
  STEEL:        { label: 'Acier',       tier: 'REFINED',  description: 'Fortifications de clan, équipements et recettes avancées',      bg: 'bg-blue-500/15',   iconColor: 'text-blue-500 dark:text-blue-400',     Icon: Cog },
  FUEL:         { label: 'Carburant',   tier: 'REFINED',  description: 'Boost de production 24h pour toute entreprise',                 bg: 'bg-orange-500/15', iconColor: 'text-orange-500 dark:text-orange-400', Icon: Flame },
  PAPER:        { label: 'Papier',      tier: 'REFINED',  description: 'Requis pour publier des formations et contenus médias',         bg: 'bg-yellow-500/15', iconColor: 'text-yellow-600 dark:text-yellow-400', Icon: FileText },
  LUXURY_GOODS: { label: 'Luxe',        tier: 'FINISHED', description: 'Vente haut de gamme, dons aura multipliés',                    bg: 'bg-violet-500/15', iconColor: 'text-violet-500 dark:text-violet-400', Icon: Gem },
  MEDICINE:     { label: 'Médicaments', tier: 'FINISHED', description: 'Soins en guerre, produits des médecins',                       bg: 'bg-emerald-500/15',iconColor: 'text-emerald-600 dark:text-emerald-400',Icon: Heart },
  DATA:         { label: 'Données',     tier: 'FINISHED', description: 'Avantage Polymarket, startups et YouTube',                     bg: 'bg-cyan-500/15',   iconColor: 'text-cyan-500 dark:text-cyan-400',     Icon: Database },
  CONTRABAND:       { label: 'Contrebande',     tier: 'SPECIAL', description: 'Carburant des guerres de clan et armes du marché noir',    bg: 'bg-red-500/15',      iconColor: 'text-red-500 dark:text-red-400',         Icon: ShieldAlert },
  HORSES:           { label: 'Chevaux',         tier: 'SPECIAL', description: 'Animaux de course élevés au haras',                        bg: 'bg-cyan-500/15',     iconColor: 'text-cyan-600 dark:text-cyan-400',       Icon: Wind },
  // ── Craftable items ───────────────────────────────────────────────────────
  ADBLOCK_TOKEN:    { label: 'ADblock',          tier: 'ITEM',   description: 'Bloque les pubs 60 min. Craftable par un Labo Pub.',        bg: 'bg-orange-500/15',   iconColor: 'text-orange-500 dark:text-orange-400',   Icon: ShieldOff },
  JUICE_ABRICOT:    { label: "Jus d'abricot",    tier: 'ITEM',   description: 'Change ta photo de profil. Craftable en juicerie.',         bg: 'bg-amber-500/15',    iconColor: 'text-amber-600 dark:text-amber-400',     Icon: Droplets },
  JUICE_GINGEMBRE:  { label: 'Jus de gingembre', tier: 'ITEM',   description: 'Change la couleur de ton pseudo. Craftable en juicerie.',   bg: 'bg-yellow-500/15',   iconColor: 'text-yellow-600 dark:text-yellow-400',   Icon: Droplets },
  JUICE_GOYAVE:     { label: 'Jus de Goyave',    tier: 'ITEM',   description: '+10 aura permanent. Craftable en juicerie (rare).',         bg: 'bg-pink-500/15',     iconColor: 'text-pink-500 dark:text-pink-400',       Icon: Sparkles },
  JUICE_MALAKOUKOU: { label: 'Jus de malakoukou',tier: 'ITEM',   description: 'Change ta bannière de profil. Craftable en juicerie.',      bg: 'bg-purple-500/15',   iconColor: 'text-purple-500 dark:text-purple-400',   Icon: Zap },
  JUICE_PAPAYE:     { label: 'Jus de papaye',    tier: 'ITEM',   description: '+100 argent. Craftable en juicerie.',                       bg: 'bg-lime-500/15',     iconColor: 'text-lime-600 dark:text-lime-400',       Icon: Droplets },
};

export const TIER_META: Record<ResourceTier, { label: string; cls: string }> = {
  RAW:      { label: 'Brut',    cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  REFINED:  { label: 'Raffiné', cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  FINISHED: { label: 'Fini',    cls: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20' },
  SPECIAL:  { label: 'Spécial', cls: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20' },
  ITEM:     { label: 'Item',    cls: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20' },
};

export interface RecipeInput {
  resource: ResourceType;
  qty: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  inputs: RecipeInput[];
  moneyCost: number;
  output: { type: 'structure' | 'item' | 'business'; id: string; label: string };
  forTypes: string[]; // business typeKeys that can use this recipe
}

export const RECIPES: Recipe[] = [
  {
    id: 'silo',
    name: 'Silo',
    description: 'Augmente la capacité de stockage de 150 unités. Max 3 par entreprise.',
    inputs: [{ resource: 'WOOD', qty: 20 }, { resource: 'STONE', qty: 10 }],
    moneyCost: 500,
    output: { type: 'structure', id: 'silo', label: 'Silo construit' },
    forTypes: ['*'],
  },
  {
    id: 'warehouse',
    name: 'Entrepôt',
    description: 'Augmente la capacité de stockage de 500 unités. Max 1 par entreprise.',
    inputs: [{ resource: 'CONCRETE', qty: 30 }, { resource: 'STEEL', qty: 10 }],
    moneyCost: 2000,
    output: { type: 'structure', id: 'warehouse', label: 'Entrepôt construit' },
    forTypes: ['*'],
  },
  {
    id: 'luxury_box',
    name: 'Boîte Cadeau Luxe',
    description: 'Objet vendable à haute valeur, offrir multiplie l\'aura.',
    inputs: [{ resource: 'LUXURY_GOODS', qty: 2 }, { resource: 'PAPER', qty: 1 }],
    moneyCost: 100,
    output: { type: 'item', id: 'luxury_box', label: 'Boîte Cadeau Luxe' },
    forTypes: ['epicerie', 'agency'],
  },
  {
    id: 'healing_potion',
    name: 'Potion de Soin',
    description: 'Consommable qui restaure des slots de combat en guerre.',
    inputs: [{ resource: 'MEDICINE', qty: 3 }, { resource: 'FOOD', qty: 1 }],
    moneyCost: 50,
    output: { type: 'item', id: 'healing_potion', label: 'Potion de Soin' },
    forTypes: ['medecins'],
  },
  {
    id: 'research_kit',
    name: 'Kit de Recherche',
    description: 'Accélère la recherche produit de 20%.',
    inputs: [{ resource: 'DATA', qty: 5 }, { resource: 'PAPER', qty: 3 }],
    moneyCost: 200,
    output: { type: 'item', id: 'research_kit', label: 'Kit de Recherche' },
    forTypes: ['startup', 'youtube'],
  },
  {
    id: 'business_restaurant',
    name: 'Restaurant',
    description: 'Ouvre un restaurant. Nécessite Food au quotidien.',
    inputs: [{ resource: 'WOOD', qty: 30 }, { resource: 'STONE', qty: 20 }, { resource: 'CONCRETE', qty: 10 }, { resource: 'FOOD', qty: 5 }],
    moneyCost: 2000,
    output: { type: 'business', id: 'restaurant', label: 'Restaurant fondé' },
    forTypes: ['sawmill', 'quarry', 'farm'],
  },
  {
    id: 'business_textile_mill',
    name: 'Manufacture Textile',
    description: 'Produit du Tissu pour alimenter les agences.',
    inputs: [{ resource: 'WOOD', qty: 15 }, { resource: 'IRON', qty: 10 }],
    moneyCost: 800,
    output: { type: 'business', id: 'textile_mill', label: 'Manufacture créée' },
    forTypes: ['sawmill', 'iron_mine'],
  },
  // ── Items craftables ──────────────────────────────────────────────────────
  {
    id: 'item_juice_abricot',
    name: "Jus d'abricot",
    description: 'Débloque le changement de photo de profil.',
    inputs: [{ resource: 'FOOD', qty: 2 }],
    moneyCost: 50,
    output: { type: 'item', id: 'JUICE_ABRICOT', label: "Jus d'abricot" },
    forTypes: ['juterie'],
  },
  {
    id: 'item_juice_gingembre',
    name: 'Jus de gingembre',
    description: 'Débloque la couleur de pseudo.',
    inputs: [{ resource: 'FOOD', qty: 2 }],
    moneyCost: 50,
    output: { type: 'item', id: 'JUICE_GINGEMBRE', label: 'Jus de gingembre' },
    forTypes: ['juterie'],
  },
  {
    id: 'item_juice_papaye',
    name: 'Jus de papaye',
    description: '+100 argent pour l\'acheteur.',
    inputs: [{ resource: 'FOOD', qty: 2 }, { resource: 'LUXURY_GOODS', qty: 1 }],
    moneyCost: 200,
    output: { type: 'item', id: 'JUICE_PAPAYE', label: 'Jus de papaye' },
    forTypes: ['juterie'],
  },
  {
    id: 'item_juice_malakoukou',
    name: 'Jus de malakoukou',
    description: 'Débloque la bannière de profil.',
    inputs: [{ resource: 'FOOD', qty: 3 }, { resource: 'LUXURY_GOODS', qty: 2 }],
    moneyCost: 500,
    output: { type: 'item', id: 'JUICE_MALAKOUKOU', label: 'Jus de malakoukou' },
    forTypes: ['juterie'],
  },
  {
    id: 'item_juice_goyave',
    name: 'Jus de Goyave',
    description: '+10 aura permanent pour l\'acheteur. Très rare.',
    inputs: [{ resource: 'FOOD', qty: 5 }, { resource: 'LUXURY_GOODS', qty: 3 }, { resource: 'MEDICINE', qty: 1 }],
    moneyCost: 5000,
    output: { type: 'item', id: 'JUICE_GOYAVE', label: 'Jus de Goyave' },
    forTypes: ['juterie'],
  },
  {
    id: 'item_adblock',
    name: 'ADblock',
    description: 'Bloque les pubs 60 min.',
    inputs: [{ resource: 'DATA', qty: 2 }, { resource: 'PAPER', qty: 1 }],
    moneyCost: 100,
    output: { type: 'item', id: 'ADBLOCK_TOKEN', label: 'ADblock' },
    forTypes: ['labo_pub'],
  },
];

// Business types that produce resources (producers/extractors)
export const PRODUCER_TYPES = new Set([
  'farm', 'lemonade', 'sawmill', 'quarry', 'iron_mine', 'fuel_refinery', 'textile_mill',
  'coffee_shop', 'restaurant', 'epicerie', 'youtube', 'medecins', 'startup', 'agency', 'illegal_market',
  'juterie', 'labo_pub',
]);

// What each business type produces
export const BUSINESS_PRODUCES: Partial<Record<string, ResourceType[]>> = {
  farm: ['FOOD'],
  lemonade: ['FOOD'],
  sawmill: ['WOOD'],
  quarry: ['STONE', 'CONCRETE'],
  iron_mine: ['IRON', 'STEEL'],
  fuel_refinery: ['FUEL'],
  textile_mill: ['CLOTH'],
  coffee_shop: ['FOOD', 'LUXURY_GOODS'],
  restaurant: ['FOOD'],
  epicerie: ['LUXURY_GOODS'],
  youtube: ['DATA', 'PAPER'],
  medecins: ['MEDICINE'],
  horse_business: [],
  startup: ['DATA'],
  agency: ['LUXURY_GOODS'],
  illegal_market: ['CONTRABAND'],
  bank: [],
  transfer: [],
  formation: ['PAPER'],
  supreme_court: [],
  law_firm: [],
  juterie: ['JUICE_ABRICOT', 'JUICE_GINGEMBRE', 'JUICE_GOYAVE', 'JUICE_MALAKOUKOU', 'JUICE_PAPAYE'],
  labo_pub: ['ADBLOCK_TOKEN'],
};

// Mini-game type per business
export type MiniGameType = 'TIMING' | 'FINANCE' | 'MEMORY' | 'TYPING' | 'MATH' | 'SORT';

export function getMiniGameType(typeKey: string): MiniGameType {
  if (typeKey === 'bank' || typeKey === 'transfer') return 'FINANCE';
  if (typeKey === 'formation' || typeKey === 'medecins') return 'MEMORY';
  if (typeKey === 'sawmill' || typeKey === 'quarry' || typeKey === 'iron_mine' || typeKey === 'fuel_refinery' || typeKey === 'textile_mill') return 'TYPING';
  if (typeKey === 'startup' || typeKey === 'youtube' || typeKey === 'agency' || typeKey === 'labo_pub') return 'MATH';
  if (typeKey === 'illegal_market') return 'SORT';
  if (typeKey === 'juterie') return 'TIMING';
  return 'TIMING';
}

export function getMiniGameLabel(typeKey: string): string {
  const type = getMiniGameType(typeKey);
  switch (type) {
    case 'TIMING': return 'Travail manuel';
    case 'FINANCE': return 'Analyse financière';
    case 'MEMORY': return 'Mémorisation';
    case 'TYPING': return 'Travail de précision';
    case 'MATH': return 'Analyse de données';
    case 'SORT': return 'Gestion des stocks';
  }
}

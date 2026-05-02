// Balancing config — all tweakable numbers for the business system.
// These values are read on each use; changing them takes effect immediately.

export const BALANCING = {
  businesses: {
    lemonade: {
      key: 'lemonade',
      creationCost: 500,
      monthlyRevenue: 300,
      level: 1,
      items: [
        { key: 'citronnade', label: 'Citronnade', price: 10 },
        { key: 'limonade_fraise', label: 'Limonade fraise', price: 15 },
        { key: 'eau_petillante', label: 'Eau petillante', price: 8 },
      ],
      npcCollectAmount: 150,
      npcCollectCooldownHours: 6,
    },
    epicerie: {
      key: 'epicerie',
      creationCost: 1500,
      monthlyRevenue: 600,
      level: 1,
      items: [
        { key: 'baguette', label: 'Baguette', price: 5 },
        { key: 'fromage', label: 'Fromage', price: 20 },
        { key: 'vin', label: 'Vin', price: 35 },
        { key: 'confiture', label: 'Confiture', price: 12 },
      ],
      npcCollectAmount: 300,
      npcCollectCooldownHours: 6,
    },
    restaurant: {
      key: 'restaurant',
      creationCost: 2000,
      monthlyRevenue: 800,
      level: 1,
      items: [
        { key: 'burger', label: 'Burger', price: 15 },
        { key: 'pizza', label: 'Pizza', price: 18 },
        { key: 'fried_chicken', label: 'Poulet Frit', price: 12 },
        { key: 'soda', label: 'Soda', price: 5 },
      ],
      npcCollectAmount: 350,
      npcCollectCooldownHours: 6,
    },
    coffee_shop: {
      key: 'coffee_shop',
      creationCost: 3000,
      monthlyRevenue: 1200,
      level: 2,
    },
    agency: {
      key: 'agency',
      creationCost: 5000,
      monthlyRevenue: 6800,
      level: 2,
      items: [
        { key: 'studio', label: 'Studio 20m²', price: 800 },
        { key: 'appartement', label: 'Appartement T3', price: 3000 },
        { key: 'maison', label: 'Maison avec jardin', price: 8000 },
        { key: 'villa', label: 'Villa de luxe', price: 25000 },
      ],
    },
    formation: {
      key: 'formation',
      creationCost: 1500,
      monthlyRevenue: 800,
      level: 2,
    },
    transfer: {
      key: 'transfer',
      creationCost: 3000,
      monthlyRevenue: 0,
      level: 2,
    },
    youtube: {
      key: 'youtube',
      creationCost: 2500,
      monthlyRevenue: 450,
      level: 2,
      npcCollectAmount: 220,
      npcCollectCooldownHours: 6,
    },
    medecins: {
      key: 'medecins',
      creationCost: 3500,
      monthlyRevenue: 600,
      level: 2,
      items: [
        { key: 'soin_leger', label: 'Soin léger', price: 2500 },
        { key: 'soin_tactique', label: 'Soin tactique', price: 6000 },
        { key: 'regen_totale', label: 'Régénération totale', price: 12000 },
      ],
    },
    startup: {
      key: 'startup',
      creationCost: 10000,
      monthlyRevenue: 0,
      level: 2,
    },
    bank: {
      key: 'bank',
      creationCost: 10000,
      monthlyRevenue: 0,
      level: 3,
    },
    illegal_market: {
      key: 'illegal_market',
      creationCost: 7000,
      monthlyRevenue: 1200,
      level: 3,
      items: [
        { key: 'puff', label: 'Puff', price: 45 },
        { key: 'weed_pack', label: 'Pack de weed', price: 110 },
        { key: 'resine', label: 'Resine', price: 160 },
        { key: 'pilules', label: 'Pilules', price: 220 },
      ],
    },
  },

  loans: {
    maxLoanAmount: 50000,
    defaultInterestRate: 4.0,
  },

  transfer: {
    defaultFeeRate: 2.0,
  },

  formation: {
    defaultPrice: 500,
  },

  bank: {
    defaultSavingsRate: 0.5,
  },

  levelling: {
    xpPerMonth: 10,
    xpToNextLevel: [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000],
  },

  businessLimits: {
    minSlots: 3,
  },
} as const;

export type BalancingBusinessKey = keyof typeof BALANCING.businesses;

export function getBusinessBalancing(typeKey: string) {
  return BALANCING.businesses[typeKey as BalancingBusinessKey] ?? null;
}

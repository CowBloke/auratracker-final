import { prisma } from '../../server.js';
import { emitSharedBalanceUpdatesForUserIds } from '../../utils/shared-balance.js';
import type { YouEconomyResourceType } from './economy.js';

type ResourceType = YouEconomyResourceType;

// Canonical reference prices per resource (used as fallback avg + sparkline seed)
const RESOURCE_CANONICAL_PRICES: Record<string, number> = {
  WOOD: 13, STONE: 10, IRON: 17, FOOD: 6, CLOTH: 14,
  CONCRETE: 23, STEEL: 32, FUEL: 26, PAPER: 11,
  LUXURY_GOODS: 28, MEDICINE: 28, DATA: 20, CONTRABAND: 50,
  // Craftable items
  ADBLOCK_TOKEN: 500, JUICE_ABRICOT: 100, JUICE_GINGEMBRE: 100,
  JUICE_GOYAVE: 800000, JUICE_MALAKOUKOU: 8000, JUICE_PAPAYE: 350,
};

// Items whose purchase applies an effect to the buyer's account directly.
export const CRAFTABLE_ITEM_TYPES = new Set([
  'ADBLOCK_TOKEN', 'JUICE_ABRICOT', 'JUICE_GINGEMBRE',
  'JUICE_GOYAVE', 'JUICE_MALAKOUKOU', 'JUICE_PAPAYE',
]);

const ITEM_EFFECTS: Record<string, { type: string; [k: string]: unknown }> = {
  ADBLOCK_TOKEN:    { type: 'YOU_ADBLOCK',     durationMinutes: 60 },
  JUICE_GOYAVE:     { type: 'BONUS_AURA',      bonusAura: 10 },
  JUICE_PAPAYE:     { type: 'BONUS_MONEY',     bonusMoney: 100 },
  JUICE_ABRICOT:    { type: 'PROFILE_PICTURE', itemName: "Jus d'abricot" },
  JUICE_GINGEMBRE:  { type: 'USERNAME_COLOR',  itemName: 'Jus de gingembre' },
  JUICE_MALAKOUKOU: { type: 'PROFILE_BANNER',  itemName: 'Jus de malakoukou' },
};

function getCanonicalPrice(resourceType: string): number {
  return RESOURCE_CANONICAL_PRICES[resourceType] ?? 10;
}

function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    return (s >>> 0) / 0xffffffff;
  };
}

// Deterministic sparkline for a resource — same shape every call, no DB needed.
export function getResourcePriceTrend(resourceType: string): { trend: number[]; change: number } {
  let seed = 0;
  for (let i = 0; i < resourceType.length; i++) seed = (seed * 31 + resourceType.charCodeAt(i)) | 0;
  const rand = seedRand(Math.abs(seed));
  const base = getCanonicalPrice(resourceType);
  const points: number[] = [];
  let v = base * (0.88 + rand() * 0.24);
  for (let i = 0; i < 7; i++) {
    v = Math.max(1, v + (rand() - 0.48) * base * 0.09);
    points.push(Math.round(v * 10) / 10);
  }
  const change = Math.round(((points[6] - points[0]) / points[0]) * 100);
  return { trend: points, change };
}

const USER_PREVIEW = { id: true, username: true } as const;

function serializeListing(l: any, userId: string) {
  return {
    id: l.id,
    resourceType: l.resourceType as ResourceType,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    sellerName: l.seller?.username ?? 'Vendeur',
    sellerId: l.sellerId,
    businessName: l.business?.name ?? 'Business',
    businessId: l.businessId,
    createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
    mine: l.sellerId === userId,
  };
}

export async function getMarketState(userId: string) {
  const listings = await prisma.resourceMarketListing.findMany({
    where: { isActive: true },
    include: {
      seller: { select: USER_PREVIEW },
      business: { select: { id: true, name: true } },
    },
    orderBy: [{ resourceType: 'asc' }, { unitPrice: 'asc' }, { createdAt: 'asc' }],
  });

  // Compute avg price per resource from live listings, fall back to canonical
  const resourceTypes = [...new Set(listings.map((l) => l.resourceType))];
  const resourceStats: Record<string, { avg: number; trend: number[]; change: number }> = {};
  for (const rt of resourceTypes) {
    const rtListings = listings.filter((l) => l.resourceType === rt);
    const avg = rtListings.length > 0
      ? Math.round(rtListings.reduce((s, l) => s + l.unitPrice, 0) / rtListings.length)
      : getCanonicalPrice(rt);
    const { trend, change } = getResourcePriceTrend(rt);
    resourceStats[rt] = { avg, trend, change };
  }
  // Add stats for resources with no active listings so UI can still show trend info
  for (const rt of Object.keys(RESOURCE_CANONICAL_PRICES)) {
    if (!resourceStats[rt]) {
      const { trend, change } = getResourcePriceTrend(rt);
      resourceStats[rt] = { avg: getCanonicalPrice(rt), trend, change };
    }
  }

  return {
    listings: listings.map((l) => serializeListing(l, userId)),
    resourceStats,
  };
}

export async function createListing(
  userId: string,
  input: { businessId: string; resourceType: string; quantity: number; unitPrice: number },
) {
  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { id: true, ownerId: true },
  });
  if (!business || business.ownerId !== userId) throw new Error('BUSINESS_NOT_FOUND');

  if (input.quantity <= 0) throw new Error('INVALID_QUANTITY');
  if (input.unitPrice <= 0) throw new Error('INVALID_PRICE');

  const inventory = await prisma.businessResourceInventory.findUnique({
    where: { businessId_resourceType: { businessId: input.businessId, resourceType: input.resourceType } },
  });
  if (!inventory) throw new Error('INVENTORY_NOT_FOUND');
  if (inventory.quantity < input.quantity) throw new Error('INVENTORY_INSUFFICIENT');

  return prisma.$transaction(async (tx) => {
    await tx.businessResourceInventory.update({
      where: { id: inventory.id },
      data: { quantity: { decrement: input.quantity } },
    });
    const listing = await tx.resourceMarketListing.create({
      data: {
        sellerId: userId,
        businessId: input.businessId,
        resourceType: input.resourceType,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
      },
    });
    return { listing: serializeListing({ ...listing, seller: { username: '' }, business: { name: '' } }, userId) };
  });
}

export async function cancelListing(userId: string, listingId: string) {
  const listing = await prisma.resourceMarketListing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true, businessId: true, resourceType: true, quantity: true, isActive: true },
  });
  if (!listing) throw new Error('LISTING_NOT_FOUND');
  if (listing.sellerId !== userId) throw new Error('LISTING_FORBIDDEN');
  if (!listing.isActive) throw new Error('LISTING_NOT_ACTIVE');

  await prisma.$transaction(async (tx) => {
    await tx.resourceMarketListing.update({ where: { id: listingId }, data: { isActive: false } });
    await tx.businessResourceInventory.updateMany({
      where: { businessId: listing.businessId, resourceType: listing.resourceType },
      data: { quantity: { increment: listing.quantity } },
    });
  });
}

export async function buyListing(
  userId: string,
  listingId: string,
  input: { quantity: number; targetBusinessId: string },
) {
  const listing = await prisma.resourceMarketListing.findUnique({
    where: { id: listingId },
    include: {
      seller: { select: { id: true } },
      business: { select: { id: true, ownerId: true } },
    },
  });
  if (!listing || !listing.isActive) throw new Error('LISTING_NOT_FOUND');
  if (listing.sellerId === userId) throw new Error('CANNOT_BUY_OWN_LISTING');

  const qty = Math.min(Math.max(1, input.quantity), listing.quantity);
  const totalCost = listing.unitPrice * qty;

  const buyer = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, money: true } });
  if (!buyer) throw new Error('USER_NOT_FOUND');
  if (Number(buyer.money) < totalCost) throw new Error('INSUFFICIENT_FUNDS');

  // Validate target business belongs to buyer
  const targetBusiness = await prisma.business.findUnique({
    where: { id: input.targetBusinessId },
    select: { id: true, ownerId: true },
  });
  if (!targetBusiness || targetBusiness.ownerId !== userId) throw new Error('TARGET_BUSINESS_NOT_FOUND');

  await prisma.$transaction(async (tx) => {
    // Deduct buyer funds
    await tx.user.update({ where: { id: userId }, data: { money: { decrement: totalCost } } });

    // Pay seller business treasury
    await tx.business.update({
      where: { id: listing.businessId },
      data: { treasuryMoney: { increment: totalCost } },
    });

    // Add resource to buyer's target business inventory
    await tx.businessResourceInventory.upsert({
      where: { businessId_resourceType: { businessId: input.targetBusinessId, resourceType: listing.resourceType } },
      update: { quantity: { increment: qty } },
      create: {
        businessId: input.targetBusinessId,
        resourceType: listing.resourceType,
        quantity: qty,
        capacity: Math.max(80, qty * 5),
        productionRatePerHour: 0,
      },
    });

    // Update listing quantity or deactivate
    const remaining = listing.quantity - qty;
    await tx.resourceMarketListing.update({
      where: { id: listingId },
      data: { quantity: remaining, isActive: remaining > 0 },
    });

    // Log transaction for seller
    await tx.businessTransaction.create({
      data: {
        businessId: listing.businessId,
        type: 'RESOURCE_MARKET_SALE',
        amount: BigInt(totalCost),
        label: `Vente marché: ${qty}× ${listing.resourceType} à ${listing.unitPrice}m/u`,
        actorId: userId,
      },
    });
  });

  await emitSharedBalanceUpdatesForUserIds(prisma, [userId, listing.business.ownerId]);
}

export async function setAutoSell(
  userId: string,
  businessId: string,
  resourceType: string,
  input: { enabled: boolean; price: number },
) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true },
  });
  if (!business || business.ownerId !== userId) throw new Error('BUSINESS_NOT_FOUND');
  if (input.price < 0) throw new Error('INVALID_PRICE');

  await prisma.businessResourceInventory.upsert({
    where: { businessId_resourceType: { businessId, resourceType } },
    update: { autoSellEnabled: input.enabled, autoSellPrice: Math.max(1, input.price) },
    create: {
      businessId,
      resourceType,
      quantity: 0,
      capacity: 80,
      productionRatePerHour: 0,
      autoSellEnabled: input.enabled,
      autoSellPrice: Math.max(1, input.price),
    },
  });
}

// Purchases a craftable-item listing. Applies the item effect to the buyer's
// account directly instead of transferring to a business inventory.
export async function buyItemListing(userId: string, listingId: string) {
  const listing = await prisma.resourceMarketListing.findUnique({
    where: { id: listingId },
    include: {
      seller: { select: { id: true } },
      business: { select: { id: true, ownerId: true } },
    },
  });
  if (!listing || !listing.isActive) throw new Error('LISTING_NOT_FOUND');
  if (!CRAFTABLE_ITEM_TYPES.has(listing.resourceType)) throw new Error('NOT_AN_ITEM');
  if (listing.sellerId === userId) throw new Error('CANNOT_BUY_OWN_LISTING');

  const totalCost = listing.unitPrice;

  const buyer = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, money: true } });
  if (!buyer) throw new Error('USER_NOT_FOUND');
  if (Number(buyer.money) < totalCost) throw new Error('INSUFFICIENT_FUNDS');

  const effect = ITEM_EFFECTS[listing.resourceType];
  if (!effect) throw new Error('UNKNOWN_ITEM_EFFECT');

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { money: { decrement: totalCost } } });
    await tx.business.update({
      where: { id: listing.businessId },
      data: { treasuryMoney: { increment: totalCost } },
    });

    // Apply item effect
    if (effect.type === 'BONUS_AURA') {
      await tx.user.update({ where: { id: userId }, data: { aura: { increment: Number(effect.bonusAura ?? 0) } } });
    } else if (effect.type === 'BONUS_MONEY') {
      await tx.user.update({ where: { id: userId }, data: { money: { increment: Number(effect.bonusMoney ?? 0) } } });
    } else if (effect.type === 'YOU_ADBLOCK') {
      const durationMs = Number(effect.durationMinutes ?? 60) * 60 * 1000;
      const currentUser = await tx.user.findUnique({ where: { id: userId }, select: { youAdblockExpiresAt: true } });
      const now = Date.now();
      const existingExpiry = currentUser?.youAdblockExpiresAt ? new Date(currentUser.youAdblockExpiresAt).getTime() : 0;
      const base = existingExpiry > now ? existingExpiry : now;
      await tx.user.update({ where: { id: userId }, data: { youAdblockExpiresAt: new Date(base + durationMs) } });
    } else {
      // Cosmetic unlock: find corresponding shop item by name and create a UserItem
      const itemName = String(effect.itemName ?? '');
      const shopItem = itemName ? await tx.item.findFirst({ where: { name: itemName } }) : null;
      if (shopItem) {
        const existing = await tx.userItem.findFirst({ where: { userId, itemId: shopItem.id } });
        if (existing) {
          await tx.userItem.update({ where: { id: existing.id }, data: { quantity: { increment: 1 } } });
        } else {
          await tx.userItem.create({ data: { userId, itemId: shopItem.id, quantity: 1 } });
        }
      }
    }

    // Consume one unit from the listing
    const remaining = listing.quantity - 1;
    await tx.resourceMarketListing.update({
      where: { id: listingId },
      data: { quantity: remaining, isActive: remaining > 0 },
    });

    await tx.businessTransaction.create({
      data: {
        businessId: listing.businessId,
        type: 'RESOURCE_MARKET_SALE',
        amount: BigInt(totalCost),
        label: `Vente item: 1× ${listing.resourceType} à ${listing.unitPrice}m`,
        actorId: userId,
      },
    });
  });

  await emitSharedBalanceUpdatesForUserIds(prisma, [userId, listing.business.ownerId]);

  return { effect };
}

// Called internally by runResourceAction when autoSell is enabled.
// Creates a market listing for the output instead of adding to inventory.
export async function autoListOutput(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  sellerId: string,
  businessId: string,
  resourceType: string,
  quantity: number,
  unitPrice: number,
) {
  await tx.resourceMarketListing.create({
    data: { sellerId, businessId, resourceType, quantity, unitPrice },
  });
}

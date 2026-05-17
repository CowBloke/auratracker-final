import { prisma } from '../../server.js';
import { emitSharedBalanceUpdatesForUserIds } from '../../utils/shared-balance.js';
import type { YouEconomyResourceType } from './economy.js';

type ResourceType = YouEconomyResourceType;

// Canonical reference prices per resource (used as fallback avg + sparkline seed)
const RESOURCE_CANONICAL_PRICES: Record<string, number> = {
  WOOD: 13, STONE: 10, IRON: 17, FOOD: 6, CLOTH: 14,
  CONCRETE: 23, STEEL: 32, FUEL: 26, PAPER: 11,
  LUXURY_GOODS: 28, MEDICINE: 28, DATA: 20, CONTRABAND: 50,
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

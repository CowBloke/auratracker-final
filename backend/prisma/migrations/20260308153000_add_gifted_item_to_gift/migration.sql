-- Add the nullable gifted item reference used by shop-sent gifts.
ALTER TABLE "Gift" ADD COLUMN "giftedItemId" TEXT;

-- Keep gift history and item lookup queries aligned with the Prisma schema.
CREATE INDEX "Gift_giftedItemId_idx" ON "Gift"("giftedItemId");

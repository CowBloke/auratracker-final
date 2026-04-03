CREATE TABLE "MarketplaceListing" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sellerId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "soldAt" DATETIME,
  "cancelledAt" DATETIME,
  CONSTRAINT "MarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceListing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MarketplaceListing_status_createdAt_idx" ON "MarketplaceListing"("status", "createdAt");
CREATE INDEX "MarketplaceListing_sellerId_status_idx" ON "MarketplaceListing"("sellerId", "status");
CREATE INDEX "MarketplaceListing_itemId_idx" ON "MarketplaceListing"("itemId");

-- CreateTable
CREATE TABLE "BusinessShareMarketListing" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "buyerId" TEXT,
  "sharePercent" REAL NOT NULL,
  "price" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "soldAt" DATETIME,
  "cancelledAt" DATETIME,
  CONSTRAINT "BusinessShareMarketListing_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BusinessShareMarketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BusinessShareMarketListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BusinessShareMarketListing_businessId_status_createdAt_idx" ON "BusinessShareMarketListing"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessShareMarketListing_sellerId_status_createdAt_idx" ON "BusinessShareMarketListing"("sellerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessShareMarketListing_buyerId_createdAt_idx" ON "BusinessShareMarketListing"("buyerId", "createdAt");

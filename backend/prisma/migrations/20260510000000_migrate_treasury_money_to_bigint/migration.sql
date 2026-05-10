-- Migrate treasuryMoney from INT to BIGINT
-- SQLite doesn't support direct column type changes, so we recreate the table

PRAGMA foreign_keys=OFF;

-- Create new table with correct schema
CREATE TABLE "Business_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "supportAgentId" TEXT,
    "name" TEXT NOT NULL,
    "typeKey" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "location" TEXT,
    "mapX" REAL,
    "mapY" REAL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "hiring" BOOLEAN NOT NULL DEFAULT true,
    "startingCapital" INTEGER NOT NULL,
    "treasuryMoney" INTEGER NOT NULL DEFAULT 0,
    "monthlyRevenue" INTEGER NOT NULL DEFAULT 0,
    "monthlyExpenses" INTEGER NOT NULL DEFAULT 0,
    "satisfaction" INTEGER NOT NULL DEFAULT 70,
    "livretEpargneUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "loanInterestRate" REAL NOT NULL DEFAULT 4.0,
    "transferFeeRate" REAL NOT NULL DEFAULT 2.0,
    "lastBankRevenueDate" TEXT,
    "lastBusinessRevenueDate" TEXT,
    "formationUrl" TEXT,
    "formationPrice" INTEGER NOT NULL DEFAULT 500,
    "customData" TEXT,
    "npcLastCollectedAt" DATETIME,
    "isStateOwned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Business_supportAgentId_fkey" FOREIGN KEY ("supportAgentId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Copy data from old table
INSERT INTO "Business_new" SELECT * FROM "Business";

-- Drop old table
DROP TABLE "Business";

-- Rename new table
ALTER TABLE "Business_new" RENAME TO "Business";

-- Recreate indices
CREATE INDEX "Business_ownerId_idx" ON "Business"("ownerId");
CREATE INDEX "Business_supportAgentId_idx" ON "Business"("supportAgentId");
CREATE INDEX "Business_typeKey_createdAt_idx" ON "Business"("typeKey", "createdAt");
CREATE INDEX "Business_hiring_idx" ON "Business"("hiring");
CREATE INDEX "Business_isStateOwned_idx" ON "Business"("isStateOwned");

PRAGMA foreign_keys=ON;

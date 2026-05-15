-- SQLite doesn't support direct column type changes, so we'll use a temporary table approach
PRAGMA foreign_keys=OFF;

-- ============ CryptoPosition Table ============
-- Create new table with updated schema
CREATE TABLE "CryptoPosition_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "coinKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "leverage" INTEGER NOT NULL,
    "entryPrice" REAL NOT NULL,
    "coinAmount" REAL NOT NULL,
    "marginAmount" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT 1,
    "closedAt" DATETIME,
    "exitPrice" REAL,
    "pnl" INTEGER,
    "liquidated" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CryptoPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- Copy data from old table
INSERT INTO "CryptoPosition_new" ("id", "userId", "coinKey", "type", "leverage", "entryPrice", "coinAmount", "marginAmount", "isOpen", "closedAt", "exitPrice", "pnl", "liquidated", "createdAt")
SELECT "id", "userId", "coinKey", "type", "leverage", "entryPrice", "coinAmount", "marginAmount", "isOpen", "closedAt", "exitPrice", "pnl", "liquidated", "createdAt"
FROM "CryptoPosition";

-- Drop old table and indexes
DROP TABLE "CryptoPosition";

-- Rename new table
ALTER TABLE "CryptoPosition_new" RENAME TO "CryptoPosition";

-- Recreate indexes
CREATE INDEX "CryptoPosition_userId_coinKey_isOpen_idx" ON "CryptoPosition"("userId", "coinKey", "isOpen");
CREATE INDEX "CryptoPosition_coinKey_createdAt_idx" ON "CryptoPosition"("coinKey", "createdAt");

-- ============ AuraCoinPosition Table ============
-- Create new table with updated schema
CREATE TABLE "AuraCoinPosition_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "leverage" INTEGER NOT NULL,
    "entryPrice" REAL NOT NULL,
    "coinAmount" REAL NOT NULL,
    "marginAmount" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT 1,
    "closedAt" DATETIME,
    "exitPrice" REAL,
    "pnl" INTEGER,
    "liquidated" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuraCoinPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- Copy data from old table
INSERT INTO "AuraCoinPosition_new" ("id", "userId", "type", "leverage", "entryPrice", "coinAmount", "marginAmount", "isOpen", "closedAt", "exitPrice", "pnl", "liquidated", "createdAt")
SELECT "id", "userId", "type", "leverage", "entryPrice", "coinAmount", "marginAmount", "isOpen", "closedAt", "exitPrice", "pnl", "liquidated", "createdAt"
FROM "AuraCoinPosition";

-- Drop old table and indexes
DROP TABLE "AuraCoinPosition";

-- Rename new table
ALTER TABLE "AuraCoinPosition_new" RENAME TO "AuraCoinPosition";

-- Recreate indexes
CREATE INDEX "AuraCoinPosition_userId_idx" ON "AuraCoinPosition"("userId");
CREATE INDEX "AuraCoinPosition_isOpen_idx" ON "AuraCoinPosition"("isOpen");
CREATE INDEX "AuraCoinPosition_createdAt_idx" ON "AuraCoinPosition"("createdAt");

PRAGMA foreign_keys=ON;

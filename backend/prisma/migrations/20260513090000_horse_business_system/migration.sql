-- Horse business stock, production queue, and production slot upgrades.

CREATE TABLE "HorseBusinessProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "productionSlots" INTEGER NOT NULL DEFAULT 2,
    "capacityLevel" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HorseBusinessProfile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "HorseBusinessHorse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "bodyColor" TEXT NOT NULL DEFAULT '#a16207',
    "pattern" TEXT NOT NULL DEFAULT 'solid',
    "patternColor" TEXT NOT NULL DEFAULT '#f8fafc',
    "geneSpeed" REAL NOT NULL,
    "geneStamina" REAL NOT NULL,
    "geneConsistency" REAL NOT NULL,
    "soldAt" DATETIME,
    "soldToStableId" TEXT,
    "soldHorseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HorseBusinessHorse_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "HorseBusinessProduction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "bodyColor" TEXT NOT NULL DEFAULT '#a16207',
    "pattern" TEXT NOT NULL DEFAULT 'solid',
    "patternColor" TEXT NOT NULL DEFAULT '#f8fafc',
    "geneSpeed" REAL NOT NULL,
    "geneStamina" REAL NOT NULL,
    "geneConsistency" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HorseBusinessProduction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "HorseBusinessProfile_businessId_key" ON "HorseBusinessProfile"("businessId");
CREATE INDEX "HorseBusinessHorse_businessId_soldAt_idx" ON "HorseBusinessHorse"("businessId", "soldAt");
CREATE INDEX "HorseBusinessProduction_businessId_status_endsAt_idx" ON "HorseBusinessProduction"("businessId", "status", "endsAt");

-- AlterTable
ALTER TABLE "Badge" ADD COLUMN "description" TEXT;

-- CreateTable
CREATE TABLE "PolymarketSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "eventDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    CONSTRAINT "PolymarketSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolymarketEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suggestionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "eventDate" DATETIME NOT NULL,
    "yesOdds" REAL NOT NULL,
    "noOdds" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "PolymarketEvent_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "PolymarketSuggestion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolymarketBet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "prediction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payout" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolymarketBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PolymarketBet_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PolymarketEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserBadge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserBadge" ("assignedAt", "badgeId", "id", "userId") SELECT "assignedAt", "badgeId", "id", "userId" FROM "UserBadge";
DROP TABLE "UserBadge";
ALTER TABLE "new_UserBadge" RENAME TO "UserBadge";
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");
CREATE INDEX "UserBadge_badgeId_idx" ON "UserBadge"("badgeId");
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PolymarketSuggestion_status_idx" ON "PolymarketSuggestion"("status");

-- CreateIndex
CREATE INDEX "PolymarketSuggestion_createdAt_idx" ON "PolymarketSuggestion"("createdAt");

-- CreateIndex
CREATE INDEX "PolymarketSuggestion_userId_idx" ON "PolymarketSuggestion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketEvent_suggestionId_key" ON "PolymarketEvent"("suggestionId");

-- CreateIndex
CREATE INDEX "PolymarketEvent_status_idx" ON "PolymarketEvent"("status");

-- CreateIndex
CREATE INDEX "PolymarketEvent_eventDate_idx" ON "PolymarketEvent"("eventDate");

-- CreateIndex
CREATE INDEX "PolymarketEvent_createdAt_idx" ON "PolymarketEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PolymarketBet_userId_idx" ON "PolymarketBet"("userId");

-- CreateIndex
CREATE INDEX "PolymarketBet_eventId_idx" ON "PolymarketBet"("eventId");

-- CreateIndex
CREATE INDEX "PolymarketBet_createdAt_idx" ON "PolymarketBet"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketBet_userId_eventId_key" ON "PolymarketBet"("userId", "eventId");

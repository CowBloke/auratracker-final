-- CreateTable
CREATE TABLE "AuraCoinPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "leverage" INTEGER NOT NULL,
    "entryPrice" REAL NOT NULL,
    "coinAmount" REAL NOT NULL,
    "marginAmount" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "closedAt" DATETIME,
    "exitPrice" REAL,
    "pnl" INTEGER,
    "liquidated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuraCoinPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AuraCoinPosition_userId_idx" ON "AuraCoinPosition"("userId");

-- CreateIndex
CREATE INDEX "AuraCoinPosition_isOpen_idx" ON "AuraCoinPosition"("isOpen");

-- CreateIndex
CREATE INDEX "AuraCoinPosition_createdAt_idx" ON "AuraCoinPosition"("createdAt");

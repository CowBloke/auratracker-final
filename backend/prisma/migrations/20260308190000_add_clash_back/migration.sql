CREATE TABLE "ClashVillage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "townHallLevel" INTEGER NOT NULL DEFAULT 1,
    "buildingsJson" TEXT NOT NULL DEFAULT '[]',
    "lastAttackAt" DATETIME,
    "shieldUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClashVillage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ClashHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "villageId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "deltaMoney" INTEGER NOT NULL DEFAULT 0,
    "relatedUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClashHistory_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "ClashVillage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ClashVillage_userId_key" ON "ClashVillage"("userId");
CREATE INDEX "ClashHistory_villageId_createdAt_idx" ON "ClashHistory"("villageId", "createdAt");

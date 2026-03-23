CREATE TABLE "ClashVillage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "townHallLevel" INTEGER NOT NULL DEFAULT 1,
    "moneyInStorage" INTEGER NOT NULL DEFAULT 0,
    "trophies" INTEGER NOT NULL DEFAULT 100,
    "shieldUntil" DATETIME,
    "attackCooldownUntil" DATETIME,
    "layoutJson" TEXT NOT NULL DEFAULT '[]',
    "buildingsJson" TEXT NOT NULL DEFAULT '[]',
    "troopsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClashVillage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ClashBattle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attackerUserId" TEXT NOT NULL,
    "defenderUserId" TEXT NOT NULL,
    "destructionPercent" INTEGER NOT NULL,
    "moneyStolen" INTEGER NOT NULL DEFAULT 0,
    "trophiesDeltaAttacker" INTEGER NOT NULL DEFAULT 0,
    "trophiesDeltaDefender" INTEGER NOT NULL DEFAULT 0,
    "resultJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClashBattle_attackerUserId_fkey" FOREIGN KEY ("attackerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClashBattle_defenderUserId_fkey" FOREIGN KEY ("defenderUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ClashActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "villageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "deltaMoney" INTEGER NOT NULL DEFAULT 0,
    "deltaTrophies" INTEGER NOT NULL DEFAULT 0,
    "relatedUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClashActivity_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "ClashVillage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ClashVillage_userId_key" ON "ClashVillage"("userId");
CREATE INDEX "ClashVillage_trophies_idx" ON "ClashVillage"("trophies");
CREATE INDEX "ClashVillage_moneyInStorage_idx" ON "ClashVillage"("moneyInStorage");
CREATE INDEX "ClashBattle_attackerUserId_createdAt_idx" ON "ClashBattle"("attackerUserId", "createdAt");
CREATE INDEX "ClashBattle_defenderUserId_createdAt_idx" ON "ClashBattle"("defenderUserId", "createdAt");
CREATE INDEX "ClashBattle_createdAt_idx" ON "ClashBattle"("createdAt");
CREATE INDEX "ClashActivity_villageId_createdAt_idx" ON "ClashActivity"("villageId", "createdAt");
CREATE INDEX "ClashActivity_type_createdAt_idx" ON "ClashActivity"("type", "createdAt");

-- CreateTable
CREATE TABLE "ClanOwnedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clanId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanOwnedItem_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanOwnedItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanEffect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clanId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" INTEGER NOT NULL DEFAULT 0,
    "durationHours" INTEGER NOT NULL DEFAULT 1,
    "cooldownHours" INTEGER NOT NULL DEFAULT 24,
    "activatedAt" DATETIME,
    "activeUntil" DATETIME,
    "cooldownUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanEffect_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ClanOwnedItem_clanId_itemId_key" ON "ClanOwnedItem"("clanId", "itemId");

-- CreateIndex
CREATE INDEX "ClanOwnedItem_clanId_idx" ON "ClanOwnedItem"("clanId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanEffect_clanId_type_key" ON "ClanEffect"("clanId", "type");

-- CreateIndex
CREATE INDEX "ClanEffect_clanId_activeUntil_idx" ON "ClanEffect"("clanId", "activeUntil");

-- CreateIndex
CREATE INDEX "ClanEffect_clanId_cooldownUntil_idx" ON "ClanEffect"("clanId", "cooldownUntil");

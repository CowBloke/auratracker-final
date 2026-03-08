CREATE TABLE "ClanWar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attackerClanId" TEXT NOT NULL,
    "defenderClanId" TEXT NOT NULL,
    "declaredByUserId" TEXT NOT NULL,
    "winnerClanId" TEXT,
    "winnerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "attackerScore" INTEGER NOT NULL DEFAULT 0,
    "defenderScore" INTEGER NOT NULL DEFAULT 0,
    "targetScore" INTEGER NOT NULL DEFAULT 180,
    "winnerRewardMoney" INTEGER NOT NULL DEFAULT 1200,
    "loserRewardMoney" INTEGER NOT NULL DEFAULT 300,
    "winnerRewardAura" INTEGER NOT NULL DEFAULT 45,
    "loserRewardAura" INTEGER NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanWar_attackerClanId_fkey" FOREIGN KEY ("attackerClanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWar_defenderClanId_fkey" FOREIGN KEY ("defenderClanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWar_declaredByUserId_fkey" FOREIGN KEY ("declaredByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWar_winnerClanId_fkey" FOREIGN KEY ("winnerClanId") REFERENCES "Clan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClanWar_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ClanWarDefense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "durability" INTEGER NOT NULL DEFAULT 60,
    "maxDurability" INTEGER NOT NULL DEFAULT 60,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanWarDefense_warId_fkey" FOREIGN KEY ("warId") REFERENCES "ClanWar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarDefense_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ClanWarAttack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "targetClanId" TEXT NOT NULL,
    "attackType" TEXT NOT NULL,
    "staminaCost" INTEGER NOT NULL DEFAULT 1,
    "basePoints" INTEGER NOT NULL,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    "defenseMitigation" INTEGER NOT NULL DEFAULT 0,
    "structureDamage" INTEGER NOT NULL DEFAULT 0,
    "finalPoints" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanWarAttack_warId_fkey" FOREIGN KEY ("warId") REFERENCES "ClanWar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarAttack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarAttack_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarAttack_targetClanId_fkey" FOREIGN KEY ("targetClanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ClanWarFortification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warId" TEXT NOT NULL,
    "defenseId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "levelAdded" INTEGER NOT NULL DEFAULT 0,
    "durabilityAdded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanWarFortification_warId_fkey" FOREIGN KEY ("warId") REFERENCES "ClanWar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarFortification_defenseId_fkey" FOREIGN KEY ("defenseId") REFERENCES "ClanWarDefense" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarFortification_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarFortification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ClanWar_attackerClanId_status_idx" ON "ClanWar"("attackerClanId", "status");
CREATE INDEX "ClanWar_defenderClanId_status_idx" ON "ClanWar"("defenderClanId", "status");
CREATE INDEX "ClanWar_status_startsAt_idx" ON "ClanWar"("status", "startsAt");
CREATE INDEX "ClanWar_status_endsAt_idx" ON "ClanWar"("status", "endsAt");
CREATE INDEX "ClanWar_winnerClanId_idx" ON "ClanWar"("winnerClanId");

CREATE UNIQUE INDEX "ClanWarDefense_warId_clanId_type_key" ON "ClanWarDefense"("warId", "clanId", "type");
CREATE INDEX "ClanWarDefense_warId_clanId_idx" ON "ClanWarDefense"("warId", "clanId");

CREATE INDEX "ClanWarAttack_warId_clanId_createdAt_idx" ON "ClanWarAttack"("warId", "clanId", "createdAt");
CREATE INDEX "ClanWarAttack_warId_userId_createdAt_idx" ON "ClanWarAttack"("warId", "userId", "createdAt");
CREATE INDEX "ClanWarAttack_warId_targetClanId_createdAt_idx" ON "ClanWarAttack"("warId", "targetClanId", "createdAt");

CREATE INDEX "ClanWarFortification_warId_clanId_userId_idx" ON "ClanWarFortification"("warId", "clanId", "userId");
CREATE INDEX "ClanWarFortification_defenseId_idx" ON "ClanWarFortification"("defenseId");

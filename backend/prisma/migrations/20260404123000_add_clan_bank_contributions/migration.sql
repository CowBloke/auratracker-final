CREATE TABLE "ClanBankContribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanBankContribution_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanBankContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ClanBankContribution_clanId_createdAt_idx" ON "ClanBankContribution"("clanId", "createdAt");
CREATE INDEX "ClanBankContribution_userId_createdAt_idx" ON "ClanBankContribution"("userId", "createdAt");

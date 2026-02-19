-- Redefine PolymarketBet to widen payout from Int to BigInt in Prisma
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_PolymarketBet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "prediction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payout" BIGINT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolymarketBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PolymarketBet_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PolymarketEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_PolymarketBet" ("id", "userId", "eventId", "prediction", "amount", "payout", "createdAt")
SELECT "id", "userId", "eventId", "prediction", "amount", "payout", "createdAt"
FROM "PolymarketBet";

DROP TABLE "PolymarketBet";
ALTER TABLE "new_PolymarketBet" RENAME TO "PolymarketBet";

CREATE INDEX "PolymarketBet_userId_idx" ON "PolymarketBet"("userId");
CREATE INDEX "PolymarketBet_eventId_idx" ON "PolymarketBet"("eventId");
CREATE INDEX "PolymarketBet_createdAt_idx" ON "PolymarketBet"("createdAt");
CREATE UNIQUE INDEX "PolymarketBet_userId_eventId_key" ON "PolymarketBet"("userId", "eventId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

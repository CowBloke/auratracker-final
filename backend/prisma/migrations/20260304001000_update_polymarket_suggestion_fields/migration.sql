-- Redefine PolymarketSuggestion so the DB matches the current Prisma schema:
-- - eventDate becomes optional
-- - suggestedYesOdds/suggestedNoOdds are added
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_PolymarketSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "eventDate" DATETIME,
    "suggestedYesOdds" REAL,
    "suggestedNoOdds" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    CONSTRAINT "PolymarketSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_PolymarketSuggestion" (
    "id",
    "userId",
    "title",
    "description",
    "imageUrl",
    "eventDate",
    "status",
    "createdAt",
    "reviewedAt",
    "reviewedBy"
)
SELECT
    "id",
    "userId",
    "title",
    "description",
    "imageUrl",
    "eventDate",
    "status",
    "createdAt",
    "reviewedAt",
    "reviewedBy"
FROM "PolymarketSuggestion";

DROP TABLE "PolymarketSuggestion";
ALTER TABLE "new_PolymarketSuggestion" RENAME TO "PolymarketSuggestion";

CREATE INDEX "PolymarketSuggestion_status_idx" ON "PolymarketSuggestion"("status");
CREATE INDEX "PolymarketSuggestion_createdAt_idx" ON "PolymarketSuggestion"("createdAt");
CREATE INDEX "PolymarketSuggestion_userId_idx" ON "PolymarketSuggestion"("userId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

ALTER TABLE "Business" ADD COLUMN "treasuryMoney" INTEGER NOT NULL DEFAULT 0;

UPDATE "Business" SET "treasuryMoney" = "startingCapital" WHERE "treasuryMoney" = 0;

ALTER TABLE "BusinessLoan" ADD COLUMN "decidedAt" DATETIME;

-- Prisma SQLite alter-table pattern for changing defaults
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BusinessLoan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "interestRate" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessLoan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessLoan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BusinessLoan" ("amount", "borrowerId", "businessId", "createdAt", "id", "interestRate", "status", "updatedAt")
SELECT "amount", "borrowerId", "businessId", "createdAt", "id", "interestRate", "status", "updatedAt" FROM "BusinessLoan";
DROP TABLE "BusinessLoan";
ALTER TABLE "new_BusinessLoan" RENAME TO "BusinessLoan";
CREATE INDEX "BusinessLoan_businessId_createdAt_idx" ON "BusinessLoan"("businessId", "createdAt");
CREATE INDEX "BusinessLoan_borrowerId_status_idx" ON "BusinessLoan"("borrowerId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

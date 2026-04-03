-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BusinessLoan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "interestRate" REAL NOT NULL,
    "motivationMessage" TEXT,
    "collateralAura" INTEGER NOT NULL DEFAULT 0,
    "collateralAuraHeld" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "repaidAmount" INTEGER NOT NULL DEFAULT 0,
    "decidedAt" DATETIME,
    "collateralClaimedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessLoan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessLoan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BusinessLoan" ("amount", "borrowerId", "businessId", "createdAt", "decidedAt", "id", "interestRate", "repaidAmount", "status", "termMonths", "updatedAt")
SELECT "amount", "borrowerId", "businessId", "createdAt", "decidedAt", "id", "interestRate", "repaidAmount", "status", "termMonths", "updatedAt" FROM "BusinessLoan";
DROP TABLE "BusinessLoan";
ALTER TABLE "new_BusinessLoan" RENAME TO "BusinessLoan";
CREATE INDEX "BusinessLoan_businessId_createdAt_idx" ON "BusinessLoan"("businessId", "createdAt");
CREATE INDEX "BusinessLoan_borrowerId_status_idx" ON "BusinessLoan"("borrowerId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

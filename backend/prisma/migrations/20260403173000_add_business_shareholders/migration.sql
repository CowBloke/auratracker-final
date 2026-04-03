-- CreateTable
CREATE TABLE "BusinessShareholder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sharePercent" REAL NOT NULL,
    "investedAmount" INTEGER NOT NULL DEFAULT 0,
    "averagePrice" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessShareholder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessShareholder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessShareProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sharePercent" REAL NOT NULL,
    "amount" INTEGER NOT NULL,
    "suggestedAmount" INTEGER NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "decidedAt" DATETIME,
    CONSTRAINT "BusinessShareProposal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessShareProposal_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessShareProposal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessShareholder_businessId_userId_key" ON "BusinessShareholder"("businessId", "userId");

-- CreateIndex
CREATE INDEX "BusinessShareholder_businessId_sharePercent_idx" ON "BusinessShareholder"("businessId", "sharePercent");

-- CreateIndex
CREATE INDEX "BusinessShareholder_userId_createdAt_idx" ON "BusinessShareholder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessShareProposal_businessId_status_idx" ON "BusinessShareProposal"("businessId", "status");

-- CreateIndex
CREATE INDEX "BusinessShareProposal_investorId_status_idx" ON "BusinessShareProposal"("investorId", "status");

-- CreateIndex
CREATE INDEX "BusinessShareProposal_ownerId_status_idx" ON "BusinessShareProposal"("ownerId", "status");

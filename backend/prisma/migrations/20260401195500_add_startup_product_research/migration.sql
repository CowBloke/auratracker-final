CREATE TABLE "BusinessStartupProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "deployedLevel" INTEGER NOT NULL DEFAULT 0,
    "activeResearchLevel" INTEGER,
    "researchStartedAt" DATETIME,
    "researchEndsAt" DATETIME,
    "researchCost" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessStartupProduct_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BusinessStartupProduct_businessId_slotIndex_key" ON "BusinessStartupProduct"("businessId", "slotIndex");
CREATE INDEX "BusinessStartupProduct_businessId_slotIndex_idx" ON "BusinessStartupProduct"("businessId", "slotIndex");

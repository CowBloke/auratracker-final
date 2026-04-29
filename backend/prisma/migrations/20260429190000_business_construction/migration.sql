-- AlterTable
ALTER TABLE "BusinessSupplyContract" ADD COLUMN "constructionProjectId" TEXT;

-- CreateTable
CREATE TABLE "BusinessConstructionProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "typeKey" TEXT NOT NULL,
    "recipeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNDER_CONSTRUCTION',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessConstructionProject_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessConstructionMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "requiredQuantity" INTEGER NOT NULL,
    "deliveredQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessConstructionMaterial_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BusinessConstructionProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BusinessSupplyContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierBusinessId" TEXT NOT NULL,
    "buyerBusinessId" TEXT NOT NULL,
    "constructionProjectId" TEXT,
    "requesterId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "deliveredQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    "completedAt" DATETIME,
    "rejectedAt" DATETIME,
    CONSTRAINT "BusinessSupplyContract_supplierBusinessId_fkey" FOREIGN KEY ("supplierBusinessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessSupplyContract_buyerBusinessId_fkey" FOREIGN KEY ("buyerBusinessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessSupplyContract_constructionProjectId_fkey" FOREIGN KEY ("constructionProjectId") REFERENCES "BusinessConstructionProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BusinessSupplyContract_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BusinessSupplyContract" ("acceptedAt", "buyerBusinessId", "completedAt", "createdAt", "deliveredQuantity", "id", "rejectedAt", "requesterId", "resourceType", "status", "supplierBusinessId", "totalQuantity", "unitPrice", "updatedAt") SELECT "acceptedAt", "buyerBusinessId", "completedAt", "createdAt", "deliveredQuantity", "id", "rejectedAt", "requesterId", "resourceType", "status", "supplierBusinessId", "totalQuantity", "unitPrice", "updatedAt" FROM "BusinessSupplyContract";
DROP TABLE "BusinessSupplyContract";
ALTER TABLE "new_BusinessSupplyContract" RENAME TO "BusinessSupplyContract";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BusinessConstructionProject_businessId_key" ON "BusinessConstructionProject"("businessId");
CREATE INDEX "BusinessConstructionProject_status_createdAt_idx" ON "BusinessConstructionProject"("status", "createdAt");
CREATE INDEX "BusinessConstructionProject_typeKey_status_idx" ON "BusinessConstructionProject"("typeKey", "status");
CREATE UNIQUE INDEX "BusinessConstructionMaterial_projectId_resourceType_key" ON "BusinessConstructionMaterial"("projectId", "resourceType");
CREATE INDEX "BusinessConstructionMaterial_projectId_idx" ON "BusinessConstructionMaterial"("projectId");
CREATE INDEX "BusinessConstructionMaterial_resourceType_idx" ON "BusinessConstructionMaterial"("resourceType");
CREATE INDEX "BusinessSupplyContract_supplierBusinessId_status_idx" ON "BusinessSupplyContract"("supplierBusinessId", "status");
CREATE INDEX "BusinessSupplyContract_buyerBusinessId_status_idx" ON "BusinessSupplyContract"("buyerBusinessId", "status");
CREATE INDEX "BusinessSupplyContract_constructionProjectId_status_idx" ON "BusinessSupplyContract"("constructionProjectId", "status");
CREATE INDEX "BusinessSupplyContract_requesterId_status_idx" ON "BusinessSupplyContract"("requesterId", "status");
CREATE INDEX "BusinessSupplyContract_resourceType_status_idx" ON "BusinessSupplyContract"("resourceType", "status");

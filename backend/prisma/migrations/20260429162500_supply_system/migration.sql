-- CreateTable
CREATE TABLE "BusinessResourceInventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL,
    "productionRatePerHour" INTEGER NOT NULL DEFAULT 0,
    "lastProducedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessResourceInventory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessSupplyOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "autoAccept" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessSupplyOffer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessSupplyContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierBusinessId" TEXT NOT NULL,
    "buyerBusinessId" TEXT NOT NULL,
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
    CONSTRAINT "BusinessSupplyContract_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessResourceInventory_businessId_resourceType_key" ON "BusinessResourceInventory"("businessId", "resourceType");
CREATE INDEX "BusinessResourceInventory_businessId_idx" ON "BusinessResourceInventory"("businessId");
CREATE INDEX "BusinessResourceInventory_resourceType_idx" ON "BusinessResourceInventory"("resourceType");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSupplyOffer_businessId_resourceType_key" ON "BusinessSupplyOffer"("businessId", "resourceType");
CREATE INDEX "BusinessSupplyOffer_resourceType_isActive_idx" ON "BusinessSupplyOffer"("resourceType", "isActive");
CREATE INDEX "BusinessSupplyOffer_businessId_idx" ON "BusinessSupplyOffer"("businessId");

-- CreateIndex
CREATE INDEX "BusinessSupplyContract_supplierBusinessId_status_idx" ON "BusinessSupplyContract"("supplierBusinessId", "status");
CREATE INDEX "BusinessSupplyContract_buyerBusinessId_status_idx" ON "BusinessSupplyContract"("buyerBusinessId", "status");
CREATE INDEX "BusinessSupplyContract_requesterId_status_idx" ON "BusinessSupplyContract"("requesterId", "status");
CREATE INDEX "BusinessSupplyContract_resourceType_status_idx" ON "BusinessSupplyContract"("resourceType", "status");

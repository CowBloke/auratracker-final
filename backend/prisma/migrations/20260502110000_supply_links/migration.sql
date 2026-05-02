CREATE TABLE "BusinessSupplyLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceBusinessId" TEXT NOT NULL,
    "sourceResourceType" TEXT NOT NULL,
    "targetBusinessId" TEXT,
    "targetResourceType" TEXT,
    "targetKind" TEXT NOT NULL DEFAULT 'BUSINESS',
    "maxUnitsPerHour" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessSupplyLink_sourceBusinessId_fkey" FOREIGN KEY ("sourceBusinessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessSupplyLink_targetBusinessId_fkey" FOREIGN KEY ("targetBusinessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BusinessSupplyLink_sourceBusinessId_isActive_idx" ON "BusinessSupplyLink"("sourceBusinessId", "isActive");
CREATE INDEX "BusinessSupplyLink_targetBusinessId_isActive_idx" ON "BusinessSupplyLink"("targetBusinessId", "isActive");
CREATE INDEX "BusinessSupplyLink_sourceResourceType_isActive_idx" ON "BusinessSupplyLink"("sourceResourceType", "isActive");
CREATE UNIQUE INDEX "BusinessSupplyLink_sourceBusinessId_sourceResourceType_targetBusinessId_targetResourceType_targetKind_key"
ON "BusinessSupplyLink"("sourceBusinessId", "sourceResourceType", "targetBusinessId", "targetResourceType", "targetKind");

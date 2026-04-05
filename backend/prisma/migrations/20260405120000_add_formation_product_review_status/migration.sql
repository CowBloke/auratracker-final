-- Add moderation fields for formation products
ALTER TABLE "FormationProduct" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "FormationProduct" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "FormationProduct" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "FormationProduct" ADD COLUMN "reviewerNote" TEXT;

CREATE INDEX "FormationProduct_businessId_status_idx" ON "FormationProduct"("businessId", "status");

PRAGMA foreign_keys=OFF;

ALTER TABLE "Business" ADD COLUMN "supportAgentId" TEXT;
ALTER TABLE "BusinessMember" ADD COLUMN "specialty" TEXT;
ALTER TABLE "BusinessMember" ADD COLUMN "isPrimaryLawyer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BusinessMember" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MessageConversation" ADD COLUMN "businessId" TEXT;
ALTER TABLE "MessageConversation" ADD COLUMN "tagType" TEXT;
ALTER TABLE "MessageConversation" ADD COLUMN "tagLabel" TEXT;
ALTER TABLE "CourtCase" ADD COLUMN "plaintiffLawFirmId" TEXT;
ALTER TABLE "CourtCase" ADD COLUMN "plaintiffLawyerId" TEXT;
ALTER TABLE "CourtCase" ADD COLUMN "defendantLawFirmId" TEXT;
ALTER TABLE "CourtCase" ADD COLUMN "defendantLawyerId" TEXT;

CREATE TABLE "new_FormationProduct" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "price" INTEGER NOT NULL DEFAULT 500,
  "url" TEXT,
  "imageUrl" TEXT,
  "attachmentOriginalName" TEXT,
  "attachmentMimeType" TEXT,
  "attachmentPath" TEXT,
  "attachmentSizeBytes" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'APPROVED',
  "reviewedAt" DATETIME,
  "reviewedBy" TEXT,
  "reviewerNote" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormationProduct_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_FormationProduct" (
  "id",
  "businessId",
  "title",
  "description",
  "price",
  "url",
  "imageUrl",
  "status",
  "reviewedAt",
  "reviewedBy",
  "reviewerNote",
  "createdAt"
)
SELECT
  "id",
  "businessId",
  "title",
  "description",
  "price",
  "url",
  "imageUrl",
  "status",
  "reviewedAt",
  "reviewedBy",
  "reviewerNote",
  "createdAt"
FROM "FormationProduct";

DROP TABLE "FormationProduct";
ALTER TABLE "new_FormationProduct" RENAME TO "FormationProduct";

CREATE TABLE "FormationProductPurchase" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "pricePaid" INTEGER NOT NULL,
  "purchasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAccessedAt" DATETIME,
  "reviewPromptAt" DATETIME,
  "reviewPromptedAt" DATETIME,
  "reviewedAt" DATETIME,
  CONSTRAINT "FormationProductPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FormationProductPurchase_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FormationProductPurchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FormationProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FormationProductRating" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormationProductRating_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FormationProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FormationProductRating_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FormationProductRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "LawyerRating" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "lawFirmBusinessId" TEXT NOT NULL,
  "lawyerUserId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "courtCaseId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LawyerRating_lawFirmBusinessId_fkey" FOREIGN KEY ("lawFirmBusinessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LawyerRating_lawyerUserId_fkey" FOREIGN KEY ("lawyerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LawyerRating_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LawyerRating_courtCaseId_fkey" FOREIGN KEY ("courtCaseId") REFERENCES "CourtCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ReviewEligibility" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "businessId" TEXT,
  "formationProductId" TEXT,
  "lawyerUserId" TEXT,
  "courtCaseId" TEXT,
  "targetType" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "promptAt" DATETIME,
  "promptedAt" DATETIME,
  "reviewedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewEligibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewEligibility_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewEligibility_formationProductId_fkey" FOREIGN KEY ("formationProductId") REFERENCES "FormationProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewEligibility_lawyerUserId_fkey" FOREIGN KEY ("lawyerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewEligibility_courtCaseId_fkey" FOREIGN KEY ("courtCaseId") REFERENCES "CourtCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Business_supportAgentId_idx" ON "Business"("supportAgentId");
CREATE INDEX "BusinessMember_businessId_isPrimaryLawyer_displayOrder_idx" ON "BusinessMember"("businessId", "isPrimaryLawyer", "displayOrder");
CREATE INDEX "FormationProduct_businessId_idx" ON "FormationProduct"("businessId");
CREATE INDEX "FormationProduct_businessId_status_idx" ON "FormationProduct"("businessId", "status");
CREATE UNIQUE INDEX "FormationProductPurchase_userId_productId_key" ON "FormationProductPurchase"("userId", "productId");
CREATE INDEX "FormationProductPurchase_businessId_purchasedAt_idx" ON "FormationProductPurchase"("businessId", "purchasedAt");
CREATE INDEX "FormationProductPurchase_productId_purchasedAt_idx" ON "FormationProductPurchase"("productId", "purchasedAt");
CREATE INDEX "FormationProductPurchase_userId_reviewPromptAt_idx" ON "FormationProductPurchase"("userId", "reviewPromptAt");
CREATE UNIQUE INDEX "FormationProductRating_productId_userId_key" ON "FormationProductRating"("productId", "userId");
CREATE INDEX "FormationProductRating_businessId_createdAt_idx" ON "FormationProductRating"("businessId", "createdAt");
CREATE INDEX "FormationProductRating_productId_createdAt_idx" ON "FormationProductRating"("productId", "createdAt");
CREATE UNIQUE INDEX "LawyerRating_courtCaseId_authorUserId_key" ON "LawyerRating"("courtCaseId", "authorUserId");
CREATE INDEX "LawyerRating_lawFirmBusinessId_createdAt_idx" ON "LawyerRating"("lawFirmBusinessId", "createdAt");
CREATE INDEX "LawyerRating_lawyerUserId_createdAt_idx" ON "LawyerRating"("lawyerUserId", "createdAt");
CREATE INDEX "MessageConversation_businessId_idx" ON "MessageConversation"("businessId");
CREATE INDEX "CourtCase_plaintiffLawyerId_idx" ON "CourtCase"("plaintiffLawyerId");
CREATE INDEX "CourtCase_defendantLawyerId_idx" ON "CourtCase"("defendantLawyerId");
CREATE INDEX "ReviewEligibility_userId_targetType_promptAt_idx" ON "ReviewEligibility"("userId", "targetType", "promptAt");
CREATE INDEX "ReviewEligibility_businessId_userId_idx" ON "ReviewEligibility"("businessId", "userId");
CREATE INDEX "ReviewEligibility_formationProductId_userId_idx" ON "ReviewEligibility"("formationProductId", "userId");
CREATE INDEX "ReviewEligibility_lawyerUserId_userId_idx" ON "ReviewEligibility"("lawyerUserId", "userId");
CREATE INDEX "ReviewEligibility_courtCaseId_idx" ON "ReviewEligibility"("courtCaseId");

PRAGMA foreign_keys=ON;

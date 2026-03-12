CREATE TABLE "RegistrationReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registrationUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "firstName" TEXT,
    "schoolLevel" TEXT,
    "classLetter" TEXT,
    "email" TEXT NOT NULL,
    "motivationMessage" TEXT,
    "registrationCreatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "importedFromLegacy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RegistrationReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RegistrationReview_registrationUserId_key" ON "RegistrationReview"("registrationUserId");
CREATE INDEX "RegistrationReview_status_reviewedAt_idx" ON "RegistrationReview"("status", "reviewedAt");
CREATE INDEX "RegistrationReview_reviewedAt_idx" ON "RegistrationReview"("reviewedAt");

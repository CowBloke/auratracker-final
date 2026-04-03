-- Add payroll tracking on active business members
ALTER TABLE "BusinessMember" ADD COLUMN "lastSalaryPaymentDate" TEXT;

-- Rebuild BusinessInvitation to support bilateral employment contracts and applications
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_BusinessInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "initiatedByRole" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "salary" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "employerAcceptedAt" DATETIME,
    "employeeAcceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "respondedAt" DATETIME,
    CONSTRAINT "BusinessInvitation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessInvitation_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_BusinessInvitation" (
    "id",
    "businessId",
    "inviterId",
    "inviteeId",
    "employerId",
    "employeeId",
    "initiatedByRole",
    "role",
    "salary",
    "message",
    "status",
    "employerAcceptedAt",
    "employeeAcceptedAt",
    "createdAt",
    "updatedAt",
    "respondedAt"
)
SELECT
    "id",
    "businessId",
    "inviterId",
    "inviteeId",
    "inviterId" AS "employerId",
    "inviteeId" AS "employeeId",
    'EMPLOYER' AS "initiatedByRole",
    "role",
    0 AS "salary",
    NULL AS "message",
    "status",
    CASE WHEN "status" = 'ACCEPTED' THEN COALESCE("respondedAt", "updatedAt", "createdAt") ELSE "createdAt" END AS "employerAcceptedAt",
    CASE WHEN "status" = 'ACCEPTED' THEN COALESCE("respondedAt", "updatedAt", "createdAt") ELSE NULL END AS "employeeAcceptedAt",
    "createdAt",
    "updatedAt",
    "respondedAt"
FROM "BusinessInvitation";

DROP TABLE "BusinessInvitation";
ALTER TABLE "new_BusinessInvitation" RENAME TO "BusinessInvitation";

CREATE INDEX "BusinessInvitation_inviteeId_status_idx" ON "BusinessInvitation"("inviteeId", "status");
CREATE INDEX "BusinessInvitation_employeeId_status_idx" ON "BusinessInvitation"("employeeId", "status");
CREATE INDEX "BusinessInvitation_employerId_status_idx" ON "BusinessInvitation"("employerId", "status");
CREATE INDEX "BusinessInvitation_businessId_status_idx" ON "BusinessInvitation"("businessId", "status");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

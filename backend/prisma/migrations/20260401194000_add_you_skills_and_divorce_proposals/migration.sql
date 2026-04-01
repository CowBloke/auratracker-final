CREATE TABLE "UserSkill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserSkill_userId_key_key" ON "UserSkill"("userId", "key");
CREATE INDEX "UserSkill_userId_idx" ON "UserSkill"("userId");

CREATE TABLE "DivorceProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "relationshipId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "respondedAt" DATETIME,
    CONSTRAINT "DivorceProposal_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DivorceProposal_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DivorceProposal_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DivorceProposal_relationshipId_status_idx" ON "DivorceProposal"("relationshipId", "status");
CREATE INDEX "DivorceProposal_recipientId_status_idx" ON "DivorceProposal"("recipientId", "status");

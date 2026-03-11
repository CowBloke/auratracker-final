CREATE TABLE "Badge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "style" TEXT NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "UserBadgeGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "grantedById" TEXT,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "UserBadgeGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBadgeGrant_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBadgeGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "UserBadgeSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "badgeId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserBadgeSelection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBadgeSelection_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Badge_key_key" ON "Badge"("key");

CREATE UNIQUE INDEX "UserBadgeGrant_userId_badgeId_key" ON "UserBadgeGrant"("userId", "badgeId");
CREATE INDEX "UserBadgeGrant_userId_idx" ON "UserBadgeGrant"("userId");
CREATE INDEX "UserBadgeGrant_badgeId_idx" ON "UserBadgeGrant"("badgeId");
CREATE INDEX "UserBadgeGrant_revokedAt_idx" ON "UserBadgeGrant"("revokedAt");

CREATE UNIQUE INDEX "UserBadgeSelection_userId_slot_key" ON "UserBadgeSelection"("userId", "slot");
CREATE INDEX "UserBadgeSelection_userId_idx" ON "UserBadgeSelection"("userId");
CREATE INDEX "UserBadgeSelection_badgeId_idx" ON "UserBadgeSelection"("badgeId");

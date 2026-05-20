-- Allow system announcement messages in clan chat (nullable userId + type column).
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ClanMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clanId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'user',
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanMessage_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_ClanMessage" ("id", "clanId", "userId", "message", "createdAt")
SELECT "id", "clanId", "userId", "message", "createdAt" FROM "ClanMessage";

DROP TABLE "ClanMessage";
ALTER TABLE "new_ClanMessage" RENAME TO "ClanMessage";

CREATE INDEX "ClanMessage_clanId_createdAt_idx" ON "ClanMessage"("clanId", "createdAt");
CREATE INDEX "ClanMessage_userId_createdAt_idx" ON "ClanMessage"("userId", "createdAt");

PRAGMA foreign_keys=ON;

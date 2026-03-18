PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'user',
    "message" TEXT NOT NULL,
    "imageUrl" TEXT,
    "replyToId" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_ChatMessage" ("createdAt", "id", "message", "pinned", "pinnedAt", "replyToId", "userId")
SELECT "createdAt", "id", "message", "pinned", "pinnedAt", "replyToId", "userId"
FROM "ChatMessage";

DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

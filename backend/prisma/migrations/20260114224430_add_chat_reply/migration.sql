-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "replyToId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ChatMessage" ("createdAt", "id", "message", "userId") SELECT "createdAt", "id", "message", "userId" FROM "ChatMessage";
DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

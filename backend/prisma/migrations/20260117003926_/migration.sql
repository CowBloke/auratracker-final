/*
  Warnings:

  - You are about to alter the column `pinnedAt` on the `ChatMessage` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("timestamp(3)")` to `DateTime`.
  - You are about to drop the column `fastestWin` on the `GameStats` table. All the data in the column will be lost.
  - You are about to drop the column `auraCost` on the `Item` table. All the data in the column will be lost.
  - You are about to alter the column `aura` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- CreateTable
CREATE TABLE "GameSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Ban" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bannedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Ban_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ban_bannedBy_fkey" FOREIGN KEY ("bannedBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT,
    "targetId" TEXT,
    "targetName" TEXT,
    "details" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BombPartyPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prompt" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "length" INTEGER NOT NULL DEFAULT 2
);
INSERT INTO "new_BombPartyPrompt" ("difficulty", "id", "prompt", "wordCount") SELECT "difficulty", "id", "prompt", "wordCount" FROM "BombPartyPrompt";
DROP TABLE "BombPartyPrompt";
ALTER TABLE "new_BombPartyPrompt" RENAME TO "BombPartyPrompt";
CREATE UNIQUE INDEX "BombPartyPrompt_prompt_key" ON "BombPartyPrompt"("prompt");
CREATE INDEX "BombPartyPrompt_difficulty_idx" ON "BombPartyPrompt"("difficulty");
CREATE INDEX "BombPartyPrompt_wordCount_idx" ON "BombPartyPrompt"("wordCount");
CREATE INDEX "BombPartyPrompt_length_idx" ON "BombPartyPrompt"("length");
CREATE TABLE "new_ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "replyToId" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ChatMessage" ("createdAt", "id", "message", "pinned", "pinnedAt", "replyToId", "userId") SELECT "createdAt", "id", "message", "pinned", "pinnedAt", "replyToId", "userId" FROM "ChatMessage";
DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");
CREATE TABLE "new_GameStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "highScore" INTEGER NOT NULL DEFAULT 0,
    "totalPlayed" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GameStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GameStats" ("gameType", "highScore", "id", "losses", "totalPlayed", "userId", "wins") SELECT "gameType", "highScore", "id", "losses", "totalPlayed", "userId", "wins" FROM "GameStats";
DROP TABLE "GameStats";
ALTER TABLE "new_GameStats" RENAME TO "GameStats";
CREATE UNIQUE INDEX "GameStats_userId_gameType_key" ON "GameStats"("userId", "gameType");
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "effect" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Item" ("createdAt", "description", "effect", "expiresAt", "id", "imageUrl", "name", "price", "type") SELECT "createdAt", "description", "effect", "expiresAt", "id", "imageUrl", "name", "price", "type" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "aura" BIGINT NOT NULL DEFAULT 0,
    "money" INTEGER NOT NULL DEFAULT 1000,
    "auraCoinBalance" REAL NOT NULL DEFAULT 0,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "dailyAuraGiven" INTEGER NOT NULL DEFAULT 0,
    "dailyAuraLimit" INTEGER NOT NULL DEFAULT 50,
    "lastDailyReset" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usernameColor" TEXT,
    "profilePicture" TEXT,
    "bio" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("aura", "auraCoinBalance", "bio", "createdAt", "dailyAuraGiven", "dailyAuraLimit", "email", "id", "isAdmin", "isApproved", "lastDailyReset", "money", "passwordHash", "profilePicture", "updatedAt", "username", "usernameColor") SELECT "aura", "auraCoinBalance", "bio", "createdAt", "dailyAuraGiven", "dailyAuraLimit", "email", "id", "isAdmin", "isApproved", "lastDailyReset", "money", "passwordHash", "profilePicture", "updatedAt", "username", "usernameColor" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_aura_idx" ON "User"("aura");
CREATE INDEX "User_money_idx" ON "User"("money");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GameSettings_key_key" ON "GameSettings"("key");

-- CreateIndex
CREATE INDEX "Ban_userId_idx" ON "Ban"("userId");

-- CreateIndex
CREATE INDEX "Ban_isActive_idx" ON "Ban"("isActive");

-- CreateIndex
CREATE INDEX "Ban_expiresAt_idx" ON "Ban"("expiresAt");

-- CreateIndex
CREATE INDEX "Log_type_idx" ON "Log"("type");

-- CreateIndex
CREATE INDEX "Log_action_idx" ON "Log"("action");

-- CreateIndex
CREATE INDEX "Log_userId_idx" ON "Log"("userId");

-- CreateIndex
CREATE INDEX "Log_createdAt_idx" ON "Log"("createdAt");

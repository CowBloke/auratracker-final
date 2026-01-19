-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "aura" BIGINT NOT NULL DEFAULT 0,
    "money" INTEGER NOT NULL DEFAULT 1000,
    "auraCoinBalance" REAL NOT NULL DEFAULT 0,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isChatMuted" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "dailyAuraGiven" INTEGER NOT NULL DEFAULT 0,
    "dailyAuraLimit" INTEGER NOT NULL DEFAULT 50,
    "lastDailyReset" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dailyPassStreak" INTEGER NOT NULL DEFAULT 0,
    "lastDailyPassClaim" DATETIME,
    "usernameColor" TEXT,
    "profilePicture" TEXT,
    "bio" TEXT,
    "displayedNftId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_displayedNftId_fkey" FOREIGN KEY ("displayedNftId") REFERENCES "UserNft" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("aura", "auraCoinBalance", "bio", "createdAt", "dailyAuraGiven", "dailyAuraLimit", "displayedNftId", "email", "id", "isAdmin", "isApproved", "isChatMuted", "lastDailyReset", "money", "passwordHash", "profilePicture", "updatedAt", "username", "usernameColor") SELECT "aura", "auraCoinBalance", "bio", "createdAt", "dailyAuraGiven", "dailyAuraLimit", "displayedNftId", "email", "id", "isAdmin", "isApproved", "isChatMuted", "lastDailyReset", "money", "passwordHash", "profilePicture", "updatedAt", "username", "usernameColor" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_displayedNftId_key" ON "User"("displayedNftId");
CREATE INDEX "User_aura_idx" ON "User"("aura");
CREATE INDEX "User_money_idx" ON "User"("money");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

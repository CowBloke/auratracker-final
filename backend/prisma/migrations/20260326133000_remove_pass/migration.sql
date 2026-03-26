PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "firstName" TEXT,
    "schoolLevel" TEXT,
    "classLetter" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "aura" BIGINT NOT NULL DEFAULT 0,
    "money" INTEGER NOT NULL DEFAULT 1000,
    "auraCoinBalance" REAL NOT NULL DEFAULT 0,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isChatMuted" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "dailyAuraGiven" INTEGER NOT NULL DEFAULT 0,
    "dailyAuraLimit" INTEGER NOT NULL DEFAULT 50,
    "lastDailyReset" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usernameColor" TEXT,
    "profilePicture" TEXT,
    "profileBanner" TEXT,
    "bio" TEXT,
    "motivationMessage" TEXT,
    "referralCode" TEXT,
    "referredById" TEXT,
    "referredAt" DATETIME,
    "referralRewardGrantedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "equippedBadge1Id" TEXT,
    "equippedBadge2Id" TEXT,
    CONSTRAINT "User_equippedBadge1Id_fkey" FOREIGN KEY ("equippedBadge1Id") REFERENCES "Badge" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_equippedBadge2Id_fkey" FOREIGN KEY ("equippedBadge2Id") REFERENCES "Badge" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" (
    "id", "username", "firstName", "schoolLevel", "classLetter", "email", "passwordHash",
    "aura", "money", "auraCoinBalance", "isAdmin", "isSuperAdmin", "isChatMuted", "isApproved",
    "dailyAuraGiven", "dailyAuraLimit", "lastDailyReset", "usernameColor", "profilePicture",
    "profileBanner", "bio", "motivationMessage", "referralCode", "referredById", "referredAt",
    "referralRewardGrantedAt", "createdAt", "updatedAt", "equippedBadge1Id", "equippedBadge2Id"
)
SELECT
    "id", "username", "firstName", "schoolLevel", "classLetter", "email", "passwordHash",
    "aura", "money", "auraCoinBalance", "isAdmin", "isSuperAdmin", "isChatMuted", "isApproved",
    "dailyAuraGiven", "dailyAuraLimit", "lastDailyReset", "usernameColor", "profilePicture",
    "profileBanner", "bio", "motivationMessage", "referralCode", "referredById", "referredAt",
    "referralRewardGrantedAt", "createdAt", "updatedAt", "equippedBadge1Id", "equippedBadge2Id"
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX "User_aura_idx" ON "User"("aura");
CREATE INDEX "User_money_idx" ON "User"("money");
CREATE INDEX "User_referredById_idx" ON "User"("referredById");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

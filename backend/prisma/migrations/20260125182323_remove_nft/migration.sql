-- Remove NFT-related tables and fields

-- Drop index on displayedNftId
DROP INDEX IF EXISTS "User_displayedNftId_key";

-- Drop UserNft table (junction table)
DROP TABLE IF EXISTS "UserNft";

-- Drop Nft table
DROP TABLE IF EXISTS "Nft";

-- Remove displayedNftId column from User table
-- SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
-- Step 1: Create new User table without displayedNftId
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "firstName" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "aura" BIGINT NOT NULL DEFAULT 0,
    "money" INTEGER NOT NULL DEFAULT 1000,
    "auraCoinBalance" REAL NOT NULL DEFAULT 0,
    "solarisBalance" REAL NOT NULL DEFAULT 0,
    "zenithBalance" REAL NOT NULL DEFAULT 0,
    "riftBalance" REAL NOT NULL DEFAULT 0,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Step 2: Copy data from old User table to new User table (excluding displayedNftId)
INSERT INTO "new_User" (
    "id", "username", "firstName", "email", "passwordHash", "aura", "money", 
    "auraCoinBalance", "solarisBalance", "zenithBalance", "riftBalance",
    "isAdmin", "isChatMuted", "isApproved", "dailyAuraGiven", "dailyAuraLimit",
    "lastDailyReset", "dailyPassStreak", "lastDailyPassClaim", "usernameColor",
    "profilePicture", "bio", "createdAt", "updatedAt"
) SELECT 
    "id", "username", "firstName", "email", "passwordHash", "aura", "money",
    "auraCoinBalance", "solarisBalance", "zenithBalance", "riftBalance",
    "isAdmin", "isChatMuted", "isApproved", "dailyAuraGiven", "dailyAuraLimit",
    "lastDailyReset", "dailyPassStreak", "lastDailyPassClaim", "usernameColor",
    "profilePicture", "bio", "createdAt", "updatedAt"
FROM "User";

-- Step 3: Drop old User table
DROP TABLE "User";

-- Step 4: Rename new User table to User
ALTER TABLE "new_User" RENAME TO "User";

-- Step 5: Recreate indexes and constraints
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_aura_idx" ON "User"("aura");
CREATE INDEX "User_money_idx" ON "User"("money");

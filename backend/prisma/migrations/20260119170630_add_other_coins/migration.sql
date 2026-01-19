-- CreateTable
CREATE TABLE "SolarisPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "price" REAL NOT NULL,
    "volume" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SolarisTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "coinAmount" REAL NOT NULL,
    "moneyAmount" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "fee" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SolarisTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ZenithPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "price" REAL NOT NULL,
    "volume" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ZenithTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "coinAmount" REAL NOT NULL,
    "moneyAmount" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "fee" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ZenithTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiftPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "price" REAL NOT NULL,
    "volume" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RiftTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "coinAmount" REAL NOT NULL,
    "moneyAmount" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "fee" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiftTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "displayedNftId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_displayedNftId_fkey" FOREIGN KEY ("displayedNftId") REFERENCES "UserNft" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("aura", "auraCoinBalance", "bio", "createdAt", "dailyAuraGiven", "dailyAuraLimit", "dailyPassStreak", "displayedNftId", "email", "id", "isAdmin", "isApproved", "isChatMuted", "lastDailyPassClaim", "lastDailyReset", "money", "passwordHash", "profilePicture", "updatedAt", "username", "usernameColor") SELECT "aura", "auraCoinBalance", "bio", "createdAt", "dailyAuraGiven", "dailyAuraLimit", "dailyPassStreak", "displayedNftId", "email", "id", "isAdmin", "isApproved", "isChatMuted", "lastDailyPassClaim", "lastDailyReset", "money", "passwordHash", "profilePicture", "updatedAt", "username", "usernameColor" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_displayedNftId_key" ON "User"("displayedNftId");
CREATE INDEX "User_aura_idx" ON "User"("aura");
CREATE INDEX "User_money_idx" ON "User"("money");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SolarisPrice_createdAt_idx" ON "SolarisPrice"("createdAt");

-- CreateIndex
CREATE INDEX "SolarisTransaction_userId_idx" ON "SolarisTransaction"("userId");

-- CreateIndex
CREATE INDEX "SolarisTransaction_createdAt_idx" ON "SolarisTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "ZenithPrice_createdAt_idx" ON "ZenithPrice"("createdAt");

-- CreateIndex
CREATE INDEX "ZenithTransaction_userId_idx" ON "ZenithTransaction"("userId");

-- CreateIndex
CREATE INDEX "ZenithTransaction_createdAt_idx" ON "ZenithTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "RiftPrice_createdAt_idx" ON "RiftPrice"("createdAt");

-- CreateIndex
CREATE INDEX "RiftTransaction_userId_idx" ON "RiftTransaction"("userId");

-- CreateIndex
CREATE INDEX "RiftTransaction_createdAt_idx" ON "RiftTransaction"("createdAt");

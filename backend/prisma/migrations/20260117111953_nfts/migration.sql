-- CreateTable
CREATE TABLE "Nft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserNft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "nftId" TEXT NOT NULL,
    "purchasePrice" INTEGER NOT NULL,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserNft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserNft_nftId_fkey" FOREIGN KEY ("nftId") REFERENCES "Nft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Clan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "maxMembers" INTEGER NOT NULL DEFAULT 5,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Clan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanMember_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanJoinRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanJoinRequest_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isChatMuted" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "dailyAuraGiven" INTEGER NOT NULL DEFAULT 0,
    "dailyAuraLimit" INTEGER NOT NULL DEFAULT 50,
    "lastDailyReset" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usernameColor" TEXT,
    "profilePicture" TEXT,
    "bio" TEXT,
    "displayedNftId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_displayedNftId_fkey" FOREIGN KEY ("displayedNftId") REFERENCES "UserNft" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("aura", "auraCoinBalance", "bio", "createdAt", "dailyAuraGiven", "dailyAuraLimit", "email", "id", "isAdmin", "isApproved", "isChatMuted", "lastDailyReset", "money", "passwordHash", "profilePicture", "updatedAt", "username", "usernameColor") SELECT "aura", "auraCoinBalance", "bio", "createdAt", "dailyAuraGiven", "dailyAuraLimit", "email", "id", "isAdmin", "isApproved", "isChatMuted", "lastDailyReset", "money", "passwordHash", "profilePicture", "updatedAt", "username", "usernameColor" FROM "User";
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
CREATE INDEX "UserNft_userId_idx" ON "UserNft"("userId");

-- CreateIndex
CREATE INDEX "UserNft_nftId_idx" ON "UserNft"("nftId");

-- CreateIndex
CREATE INDEX "Clan_isPublic_idx" ON "Clan"("isPublic");

-- CreateIndex
CREATE INDEX "Clan_createdAt_idx" ON "Clan"("createdAt");

-- CreateIndex
CREATE INDEX "ClanMember_clanId_idx" ON "ClanMember"("clanId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanMember_clanId_userId_key" ON "ClanMember"("clanId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanMember_userId_key" ON "ClanMember"("userId");

-- CreateIndex
CREATE INDEX "ClanJoinRequest_clanId_idx" ON "ClanJoinRequest"("clanId");

-- CreateIndex
CREATE INDEX "ClanJoinRequest_userId_idx" ON "ClanJoinRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanJoinRequest_clanId_userId_key" ON "ClanJoinRequest"("clanId", "userId");

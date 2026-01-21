-- CreateTable
CREATE TABLE "DailyQuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "moneyReward" INTEGER NOT NULL,
    "auraReward" INTEGER NOT NULL,
    "questDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserDailyQuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "questDate" DATETIME NOT NULL,
    "selectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "isClaimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" DATETIME,
    CONSTRAINT "UserDailyQuest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserDailyQuest_questId_fkey" FOREIGN KEY ("questId") REFERENCES "DailyQuest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserQuestProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userQuestId" TEXT NOT NULL UNIQUE,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserQuestProgress_userQuestId_fkey" FOREIGN KEY ("userQuestId") REFERENCES "UserDailyQuest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DailyQuest_questDate_idx" ON "DailyQuest"("questDate");

-- CreateIndex
CREATE INDEX "DailyQuest_questType_idx" ON "DailyQuest"("questType");

-- CreateIndex
CREATE UNIQUE INDEX "UserDailyQuest_userId_questId_questDate_key" ON "UserDailyQuest"("userId", "questId", "questDate");

-- CreateIndex
CREATE INDEX "UserDailyQuest_userId_idx" ON "UserDailyQuest"("userId");

-- CreateIndex
CREATE INDEX "UserDailyQuest_questId_idx" ON "UserDailyQuest"("questId");

-- CreateIndex
CREATE INDEX "UserDailyQuest_questDate_idx" ON "UserDailyQuest"("questDate");

-- CreateIndex
CREATE INDEX "UserDailyQuest_isCompleted_idx" ON "UserDailyQuest"("isCompleted");

-- CreateIndex
CREATE INDEX "UserQuestProgress_userQuestId_idx" ON "UserQuestProgress"("userQuestId");

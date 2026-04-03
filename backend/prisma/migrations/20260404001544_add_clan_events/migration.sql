CREATE TABLE IF NOT EXISTS "ClanEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "bannerUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "highlightColor" TEXT,
    "rulesSummary" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    "finalizedAt" DATETIME,
    "rewardsDistributedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ClanEventQuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "activityType" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "pointsReward" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanEventQuest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ClanEventQuestProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanEventQuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "ClanEventQuest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventQuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventQuestProgress_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ClanEventMiniGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "instructions" TEXT,
    "scoreMultiplier" REAL NOT NULL DEFAULT 1,
    "flatPointsBonus" INTEGER NOT NULL DEFAULT 0,
    "maxPointsPerAttempt" INTEGER NOT NULL DEFAULT 100,
    "maxAttemptsPerUser" INTEGER,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "configJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanEventMiniGame_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ClanEventMiniGameAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "miniGameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "rawScore" INTEGER NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanEventMiniGameAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventMiniGameAttempt_miniGameId_fkey" FOREIGN KEY ("miniGameId") REFERENCES "ClanEventMiniGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventMiniGameAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventMiniGameAttempt_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ClanEventRewardTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "minRank" INTEGER NOT NULL,
    "maxRank" INTEGER NOT NULL,
    "moneyReward" INTEGER NOT NULL DEFAULT 0,
    "auraReward" INTEGER NOT NULL DEFAULT 0,
    "itemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanEventRewardTier_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventRewardTier_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ClanEventClanScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanEventClanScore_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventClanScore_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ClanEventActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "userId" TEXT,
    "sourceType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "sourceId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanEventActivity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventActivity_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClanEvent_slug_key" ON "ClanEvent"("slug");
CREATE INDEX IF NOT EXISTS "ClanEvent_status_startsAt_idx" ON "ClanEvent"("status", "startsAt");
CREATE INDEX IF NOT EXISTS "ClanEvent_status_endsAt_idx" ON "ClanEvent"("status", "endsAt");
CREATE INDEX IF NOT EXISTS "ClanEventQuest_eventId_sortOrder_idx" ON "ClanEventQuest"("eventId", "sortOrder");
CREATE INDEX IF NOT EXISTS "ClanEventQuest_eventId_activityType_idx" ON "ClanEventQuest"("eventId", "activityType");
CREATE INDEX IF NOT EXISTS "ClanEventQuestProgress_clanId_completedAt_idx" ON "ClanEventQuestProgress"("clanId", "completedAt");
CREATE INDEX IF NOT EXISTS "ClanEventQuestProgress_userId_completedAt_idx" ON "ClanEventQuestProgress"("userId", "completedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ClanEventQuestProgress_questId_userId_key" ON "ClanEventQuestProgress"("questId", "userId");
CREATE INDEX IF NOT EXISTS "ClanEventMiniGame_eventId_sortOrder_idx" ON "ClanEventMiniGame"("eventId", "sortOrder");
CREATE INDEX IF NOT EXISTS "ClanEventMiniGame_eventId_type_idx" ON "ClanEventMiniGame"("eventId", "type");
CREATE INDEX IF NOT EXISTS "ClanEventMiniGameAttempt_eventId_clanId_createdAt_idx" ON "ClanEventMiniGameAttempt"("eventId", "clanId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClanEventMiniGameAttempt_miniGameId_userId_createdAt_idx" ON "ClanEventMiniGameAttempt"("miniGameId", "userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClanEventRewardTier_eventId_minRank_maxRank_idx" ON "ClanEventRewardTier"("eventId", "minRank", "maxRank");
CREATE INDEX IF NOT EXISTS "ClanEventClanScore_eventId_totalPoints_idx" ON "ClanEventClanScore"("eventId", "totalPoints");
CREATE UNIQUE INDEX IF NOT EXISTS "ClanEventClanScore_eventId_clanId_key" ON "ClanEventClanScore"("eventId", "clanId");
CREATE INDEX IF NOT EXISTS "ClanEventActivity_eventId_createdAt_idx" ON "ClanEventActivity"("eventId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClanEventActivity_eventId_clanId_createdAt_idx" ON "ClanEventActivity"("eventId", "clanId", "createdAt");

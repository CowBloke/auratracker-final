-- CreateTable
CREATE TABLE "UserFollow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrivateConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantOneId" TEXT NOT NULL,
    "participantTwoId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrivateConversation_participantOneId_fkey" FOREIGN KEY ("participantOneId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrivateConversation_participantTwoId_fkey" FOREIGN KEY ("participantTwoId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrivateMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "PrivateMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "PrivateConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrivateMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserFollow_followerId_followingId_key" ON "UserFollow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "UserFollow_followerId_createdAt_idx" ON "UserFollow"("followerId", "createdAt");

-- CreateIndex
CREATE INDEX "UserFollow_followingId_createdAt_idx" ON "UserFollow"("followingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateConversation_participantOneId_participantTwoId_key" ON "PrivateConversation"("participantOneId", "participantTwoId");

-- CreateIndex
CREATE INDEX "PrivateConversation_participantOneId_lastMessageAt_idx" ON "PrivateConversation"("participantOneId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "PrivateConversation_participantTwoId_lastMessageAt_idx" ON "PrivateConversation"("participantTwoId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "PrivateConversation_lastMessageAt_idx" ON "PrivateConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "PrivateMessage_conversationId_createdAt_idx" ON "PrivateMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "PrivateMessage_senderId_createdAt_idx" ON "PrivateMessage"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "PrivateMessage_conversationId_readAt_idx" ON "PrivateMessage"("conversationId", "readAt");

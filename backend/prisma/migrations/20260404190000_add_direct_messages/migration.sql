-- CreateTable
CREATE TABLE "DirectConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "directKey" TEXT NOT NULL,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DirectConversationParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" DATETIME,
    "lastReadMessageId" TEXT,
    CONSTRAINT "DirectConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DirectConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectConversation_directKey_key" ON "DirectConversation"("directKey");

-- CreateIndex
CREATE INDEX "DirectConversation_lastMessageAt_idx" ON "DirectConversation"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectConversationParticipant_conversationId_userId_key" ON "DirectConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "DirectConversationParticipant_userId_joinedAt_idx" ON "DirectConversationParticipant"("userId", "joinedAt");

-- CreateIndex
CREATE INDEX "DirectConversationParticipant_conversationId_joinedAt_idx" ON "DirectConversationParticipant"("conversationId", "joinedAt");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_senderId_createdAt_idx" ON "DirectMessage"("senderId", "createdAt");

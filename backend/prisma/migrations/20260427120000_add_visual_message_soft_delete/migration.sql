ALTER TABLE "SupportMessage" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "SupportMessage" ADD COLUMN "deletedByUserId" TEXT;

ALTER TABLE "MessageConversationMessage" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "MessageConversationMessage" ADD COLUMN "deletedByUserId" TEXT;

CREATE INDEX "SupportMessage_userId_deletedAt_createdAt_idx" ON "SupportMessage"("userId", "deletedAt", "createdAt");
CREATE INDEX "MessageConversationMessage_conversationId_deletedAt_createdAt_idx" ON "MessageConversationMessage"("conversationId", "deletedAt", "createdAt");

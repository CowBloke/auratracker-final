-- Add message pinning for DM/group conversations.
ALTER TABLE "MessageConversationMessage" ADD COLUMN "pinnedAt" DATETIME;
ALTER TABLE "MessageConversationMessage" ADD COLUMN "pinnedByUserId" TEXT;

CREATE INDEX "MessageConversationMessage_conversationId_pinnedAt_idx" ON "MessageConversationMessage"("conversationId", "pinnedAt");

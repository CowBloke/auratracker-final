-- Preserve every chat message forever and allow visual-only deletions.
ALTER TABLE "ChatMessage" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "ChatMessage" ADD COLUMN "deletedByUserId" TEXT;

CREATE INDEX "ChatMessage_deletedAt_createdAt_idx" ON "ChatMessage"("deletedAt", "createdAt");

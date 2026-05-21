ALTER TABLE "User" ADD COLUMN "chatMuteExpiresAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "chatMuteReason" TEXT;
ALTER TABLE "User" ADD COLUMN "chatMutedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "chatMutedById" TEXT;
ALTER TABLE "User" ADD COLUMN "chatModerationStrikes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "chatModerationLevel" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "User_chatMuteExpiresAt_idx" ON "User"("chatMuteExpiresAt");

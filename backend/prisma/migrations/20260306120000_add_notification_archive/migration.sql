-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Notification" ADD COLUMN "archivedAt" DATETIME;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_isArchived_idx" ON "Notification"("userId", "isArchived");

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ADD COLUMN "pinnedAt" TIMESTAMP(3);

CREATE TABLE "PixelBoardSettings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  "cooldownSeconds" INTEGER NOT NULL DEFAULT 30,
  "durationSeconds" INTEGER NOT NULL DEFAULT 604800,
  "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" DATETIME,
  "isPaused" BOOLEAN NOT NULL DEFAULT false,
  "isEnded" BOOLEAN NOT NULL DEFAULT false,
  "isLocked" BOOLEAN NOT NULL DEFAULT true,
  "lockedMessage" TEXT NOT NULL DEFAULT 'Le Pixel Board n''est pas encore ouvert.',
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "PixelBoardPixel" (
  "x" INTEGER NOT NULL,
  "y" INTEGER NOT NULL,
  "color" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clanId" TEXT,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("x", "y")
);

CREATE TABLE "PixelBoardEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "x" INTEGER NOT NULL,
  "y" INTEGER NOT NULL,
  "color" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clanId" TEXT,
  "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PixelBoardEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PixelBoardPixel_clanId_idx" ON "PixelBoardPixel"("clanId");
CREATE INDEX "PixelBoardPixel_userId_idx" ON "PixelBoardPixel"("userId");
CREATE INDEX "PixelBoardEvent_timestamp_idx" ON "PixelBoardEvent"("timestamp");
CREATE INDEX "PixelBoardEvent_userId_timestamp_idx" ON "PixelBoardEvent"("userId", "timestamp");
CREATE INDEX "PixelBoardEvent_clanId_idx" ON "PixelBoardEvent"("clanId");

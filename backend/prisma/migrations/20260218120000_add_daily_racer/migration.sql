-- CreateTable
CREATE TABLE "DailyRacerRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trackDate" DATETIME NOT NULL,
    "lapTimeMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyRacerRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DailyRacerRun_trackDate_lapTimeMs_idx" ON "DailyRacerRun"("trackDate", "lapTimeMs");

-- CreateIndex
CREATE INDEX "DailyRacerRun_trackDate_userId_idx" ON "DailyRacerRun"("trackDate", "userId");

-- CreateIndex
CREATE INDEX "DailyRacerRun_userId_createdAt_idx" ON "DailyRacerRun"("userId", "createdAt");

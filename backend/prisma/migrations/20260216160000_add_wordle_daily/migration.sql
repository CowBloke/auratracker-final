-- CreateTable
CREATE TABLE "WordlePuzzle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "puzzleDate" DATETIME NOT NULL,
    "word" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WordleAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "puzzleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guessesJson" TEXT NOT NULL DEFAULT '[]',
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "guessCount" INTEGER,
    "completedAt" DATETIME,
    "firstPlayedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WordleAttempt_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "WordlePuzzle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WordleAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WordlePuzzle_puzzleDate_key" ON "WordlePuzzle"("puzzleDate");

-- CreateIndex
CREATE INDEX "WordlePuzzle_puzzleDate_idx" ON "WordlePuzzle"("puzzleDate");

-- CreateIndex
CREATE UNIQUE INDEX "WordleAttempt_puzzleId_userId_key" ON "WordleAttempt"("puzzleId", "userId");

-- CreateIndex
CREATE INDEX "WordleAttempt_puzzleId_solved_guessCount_idx" ON "WordleAttempt"("puzzleId", "solved", "guessCount");

-- CreateIndex
CREATE INDEX "WordleAttempt_userId_updatedAt_idx" ON "WordleAttempt"("userId", "updatedAt");

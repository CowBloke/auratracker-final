-- CreateTable
CREATE TABLE "TaxBracket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threshold" INTEGER NOT NULL,
    "rate" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "TaxBracket_threshold_idx" ON "TaxBracket"("threshold");

-- Add status/resolved fields to Suggestion
ALTER TABLE "Suggestion" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Suggestion" ADD COLUMN "resolvedAt" DATETIME;

-- CreateTable
CREATE TABLE "SuggestionRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suggestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuggestionRating_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SuggestionRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Suggestion_status_idx" ON "Suggestion"("status");

-- CreateIndex
CREATE INDEX "SuggestionRating_suggestionId_idx" ON "SuggestionRating"("suggestionId");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestionRating_suggestionId_userId_key" ON "SuggestionRating"("suggestionId", "userId");

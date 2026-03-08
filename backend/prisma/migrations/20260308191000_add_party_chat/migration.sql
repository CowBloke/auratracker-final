CREATE TABLE IF NOT EXISTS "PartyMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartyMessage_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartyMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PartyMessage_partyId_createdAt_idx" ON "PartyMessage"("partyId", "createdAt");
CREATE INDEX IF NOT EXISTS "PartyMessage_userId_createdAt_idx" ON "PartyMessage"("userId", "createdAt");

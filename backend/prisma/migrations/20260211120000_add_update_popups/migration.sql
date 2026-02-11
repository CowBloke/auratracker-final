-- CreateTable
CREATE TABLE "UpdatePopup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "message" TEXT NOT NULL,
    "imageUrl" TEXT,
    "releaseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UpdatePopup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserUpdatePopupView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "popupId" TEXT NOT NULL,
    "viewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserUpdatePopupView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserUpdatePopupView_popupId_fkey" FOREIGN KEY ("popupId") REFERENCES "UpdatePopup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UpdatePopup_isPublished_releaseDate_idx" ON "UpdatePopup"("isPublished", "releaseDate");

-- CreateIndex
CREATE INDEX "UpdatePopup_createdAt_idx" ON "UpdatePopup"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserUpdatePopupView_userId_popupId_key" ON "UserUpdatePopupView"("userId", "popupId");

-- CreateIndex
CREATE INDEX "UserUpdatePopupView_userId_viewedAt_idx" ON "UserUpdatePopupView"("userId", "viewedAt");

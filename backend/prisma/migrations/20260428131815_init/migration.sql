-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "firstName" TEXT,
    "school" TEXT,
    "schoolLevel" TEXT,
    "classLetter" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "aura" BIGINT NOT NULL DEFAULT 0,
    "money" INTEGER NOT NULL DEFAULT 1000,
    "auraCoinBalance" REAL NOT NULL DEFAULT 0,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isBetaTester" BOOLEAN NOT NULL DEFAULT false,
    "isFiscalInspector" BOOLEAN NOT NULL DEFAULT false,
    "fiscFundBalance" INTEGER NOT NULL DEFAULT 0,
    "fiscalPaymentSource" TEXT NOT NULL DEFAULT 'ACCOUNT',
    "isJudge" BOOLEAN NOT NULL DEFAULT false,
    "isChatMuted" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "dailyAuraGiven" INTEGER NOT NULL DEFAULT 0,
    "dailyAuraLimit" INTEGER NOT NULL DEFAULT 100,
    "lastDailyReset" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dailyGameAuraGiven" INTEGER NOT NULL DEFAULT 0,
    "dailyGameMoneyGiven" INTEGER NOT NULL DEFAULT 0,
    "dailyGameAuraLimit" INTEGER NOT NULL DEFAULT 500,
    "dailyGameMoneyLimit" INTEGER NOT NULL DEFAULT 1000,
    "lastDailyGameReset" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dailyPassStreak" INTEGER NOT NULL DEFAULT 0,
    "lastDailyPassClaim" DATETIME,
    "usernameColor" TEXT,
    "profilePicture" TEXT,
    "profileBanner" TEXT,
    "youAdblockExpiresAt" DATETIME,
    "bio" TEXT,
    "motivationMessage" TEXT,
    "referralCode" TEXT,
    "referredById" TEXT,
    "referredAt" DATETIME,
    "referralRewardGrantedAt" DATETIME,
    "welcomeInboxSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "equippedBadge1Id" TEXT,
    "equippedBadge2Id" TEXT,
    "totalScore" REAL NOT NULL DEFAULT 0,
    "overallRank" INTEGER NOT NULL DEFAULT 0,
    "lastScoreUpdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlockedBusinessLevel" INTEGER NOT NULL DEFAULT 0,
    "isBraquageLegalOwner" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "User_equippedBadge1Id_fkey" FOREIGN KEY ("equippedBadge1Id") REFERENCES "Badge" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_equippedBadge2Id_fkey" FOREIGN KEY ("equippedBadge2Id") REFERENCES "Badge" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegistrationReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registrationUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "firstName" TEXT,
    "school" TEXT,
    "schoolLevel" TEXT,
    "classLetter" TEXT,
    "email" TEXT NOT NULL,
    "motivationMessage" TEXT,
    "registrationCreatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "importedFromLegacy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RegistrationReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "effect" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "soldAt" DATETIME,
    "cancelledAt" DATETIME,
    CONSTRAINT "MarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketplaceListing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "auraAmount" INTEGER NOT NULL DEFAULT 0,
    "moneyAmount" INTEGER NOT NULL DEFAULT 0,
    "isGift" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transfer_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transfer_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "highScore" REAL NOT NULL DEFAULT 0,
    "totalPlayed" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GameStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoyaveSave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "saveData" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GoyaveSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClashVillage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "townHallLevel" INTEGER NOT NULL DEFAULT 1,
    "moneyInStorage" INTEGER NOT NULL DEFAULT 0,
    "trophies" INTEGER NOT NULL DEFAULT 100,
    "shieldUntil" DATETIME,
    "attackCooldownUntil" DATETIME,
    "layoutJson" TEXT NOT NULL DEFAULT '[]',
    "buildingsJson" TEXT NOT NULL DEFAULT '[]',
    "troopsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClashVillage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClashBattle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attackerUserId" TEXT NOT NULL,
    "defenderUserId" TEXT NOT NULL,
    "destructionPercent" INTEGER NOT NULL,
    "moneyStolen" INTEGER NOT NULL DEFAULT 0,
    "trophiesDeltaAttacker" INTEGER NOT NULL DEFAULT 0,
    "trophiesDeltaDefender" INTEGER NOT NULL DEFAULT 0,
    "resultJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClashBattle_attackerUserId_fkey" FOREIGN KEY ("attackerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClashBattle_defenderUserId_fkey" FOREIGN KEY ("defenderUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClashActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "villageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "deltaMoney" INTEGER NOT NULL DEFAULT 0,
    "deltaTrophies" INTEGER NOT NULL DEFAULT 0,
    "relatedUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClashActivity_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "ClashVillage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyRacerRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trackDate" DATETIME NOT NULL,
    "lapTimeMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyRacerRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameScoreHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameScoreHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "maxSize" INTEGER NOT NULL DEFAULT 8,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PartyMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartyMember_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartyMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartyMessage_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartyMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserFollow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DirectConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "directKey" TEXT NOT NULL,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DirectConversationParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" DATETIME,
    "lastReadMessageId" TEXT,
    CONSTRAINT "DirectConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DirectConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "supportAgentId" TEXT,
    "name" TEXT NOT NULL,
    "typeKey" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "location" TEXT,
    "mapX" REAL,
    "mapY" REAL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "hiring" BOOLEAN NOT NULL DEFAULT true,
    "startingCapital" INTEGER NOT NULL,
    "treasuryMoney" INTEGER NOT NULL DEFAULT 0,
    "monthlyRevenue" INTEGER NOT NULL DEFAULT 0,
    "monthlyExpenses" INTEGER NOT NULL DEFAULT 0,
    "satisfaction" INTEGER NOT NULL DEFAULT 70,
    "livretEpargneUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "loanInterestRate" REAL NOT NULL DEFAULT 4.0,
    "transferFeeRate" REAL NOT NULL DEFAULT 2.0,
    "lastBankRevenueDate" TEXT,
    "lastBusinessRevenueDate" TEXT,
    "formationUrl" TEXT,
    "formationPrice" INTEGER NOT NULL DEFAULT 500,
    "customData" TEXT,
    "npcLastCollectedAt" DATETIME,
    "isStateOwned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Business_supportAgentId_fkey" FOREIGN KEY ("supportAgentId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "imageUrl" TEXT,
    "ctaText" TEXT NOT NULL DEFAULT 'En savoir plus',
    "ctaLink" TEXT NOT NULL,
    "adType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" DATETIME,
    "reviewedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ad_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormationProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL DEFAULT 500,
    "url" TEXT,
    "imageUrl" TEXT,
    "attachmentOriginalName" TEXT,
    "attachmentMimeType" TEXT,
    "attachmentPath" TEXT,
    "attachmentSizeBytes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    "reviewerNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormationProduct_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessRating_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "specialty" TEXT,
    "isPrimaryLawyer" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "salary" INTEGER NOT NULL DEFAULT 0,
    "lastSalaryPaymentDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormationProductPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "pricePaid" INTEGER NOT NULL,
    "purchasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" DATETIME,
    "reviewPromptAt" DATETIME,
    "reviewPromptedAt" DATETIME,
    "reviewedAt" DATETIME,
    CONSTRAINT "FormationProductPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FormationProductPurchase_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FormationProductPurchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FormationProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormationProductRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FormationProductRating_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FormationProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FormationProductRating_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FormationProductRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LawyerRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lawFirmBusinessId" TEXT NOT NULL,
    "lawyerUserId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "courtCaseId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LawyerRating_lawFirmBusinessId_fkey" FOREIGN KEY ("lawFirmBusinessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LawyerRating_lawyerUserId_fkey" FOREIGN KEY ("lawyerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LawyerRating_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LawyerRating_courtCaseId_fkey" FOREIGN KEY ("courtCaseId") REFERENCES "CourtCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewEligibility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "formationProductId" TEXT,
    "lawyerUserId" TEXT,
    "courtCaseId" TEXT,
    "targetType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "promptAt" DATETIME,
    "promptedAt" DATETIME,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewEligibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewEligibility_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewEligibility_formationProductId_fkey" FOREIGN KEY ("formationProductId") REFERENCES "FormationProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewEligibility_lawyerUserId_fkey" FOREIGN KEY ("lawyerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewEligibility_courtCaseId_fkey" FOREIGN KEY ("courtCaseId") REFERENCES "CourtCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL DEFAULT '',
    "employeeId" TEXT NOT NULL DEFAULT '',
    "initiatedByRole" TEXT NOT NULL DEFAULT 'EMPLOYER',
    "role" TEXT NOT NULL,
    "salary" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "employerAcceptedAt" DATETIME,
    "employeeAcceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "respondedAt" DATETIME,
    CONSTRAINT "BusinessInvitation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessInvitation_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessLoan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "interestRate" REAL NOT NULL,
    "motivationMessage" TEXT,
    "collateralAura" INTEGER NOT NULL DEFAULT 0,
    "collateralAuraHeld" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "repaidAmount" INTEGER NOT NULL DEFAULT 0,
    "decidedAt" DATETIME,
    "collateralClaimedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessLoan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessLoan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessInvestment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "expectedReturnMin" INTEGER NOT NULL,
    "expectedReturnMax" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessInvestment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessInvestment_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessShareholder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sharePercent" REAL NOT NULL,
    "investedAmount" INTEGER NOT NULL DEFAULT 0,
    "averagePrice" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessShareholder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessShareholder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessShareProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sharePercent" REAL NOT NULL,
    "amount" INTEGER NOT NULL,
    "suggestedAmount" INTEGER NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "decidedAt" DATETIME,
    CONSTRAINT "BusinessShareProposal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessShareProposal_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessShareProposal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessShareMarketListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT,
    "sharePercent" REAL NOT NULL,
    "price" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" DATETIME,
    "cancelledAt" DATETIME,
    CONSTRAINT "BusinessShareMarketListing_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessShareMarketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessShareMarketListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessBuyoutOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    CONSTRAINT "BusinessBuyoutOffer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessBuyoutOffer_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessBuyoutOffer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessTransferTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL,
    "feeRate" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessTransferTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessTransferTransaction_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessTransferTransaction_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessStartupProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "deployedLevel" INTEGER NOT NULL DEFAULT 0,
    "activeResearchLevel" INTEGER,
    "researchStartedAt" DATETIME,
    "researchEndsAt" DATETIME,
    "researchCost" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessStartupProduct_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BraquageLegalSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" DATETIME NOT NULL,
    "totalPool" INTEGER NOT NULL DEFAULT 0,
    "winnerId" TEXT,
    "winnerPayout" INTEGER,
    "ownerPayout" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BraquageLegalSession_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BraquageLegalParticipation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "ticketCount" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BraquageLegalParticipation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BraquageLegalSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BraquageLegalParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSkill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DATING',
    "connectionLevel" INTEGER NOT NULL DEFAULT 55,
    "coupleBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "marriedAt" DATETIME,
    CONSTRAINT "Relationship_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Relationship_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Relationship_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarriageProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "relationshipId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "respondedAt" DATETIME,
    CONSTRAINT "MarriageProposal_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarriageProposal_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarriageProposal_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DivorceProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "relationshipId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "respondedAt" DATETIME,
    CONSTRAINT "DivorceProposal_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DivorceProposal_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DivorceProposal_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CheatingAccusation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accuserId" TEXT NOT NULL,
    "accusedId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CheatingAccusation_accuserId_fkey" FOREIGN KEY ("accuserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CheatingAccusation_accusedId_fkey" FOREIGN KEY ("accusedId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Clan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "banner" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "maxMembers" INTEGER NOT NULL DEFAULT 5,
    "warTrophies" INTEGER NOT NULL DEFAULT 1000,
    "warWins" INTEGER NOT NULL DEFAULT 0,
    "warLosses" INTEGER NOT NULL DEFAULT 0,
    "warDraws" INTEGER NOT NULL DEFAULT 0,
    "clanBankMoney" INTEGER NOT NULL DEFAULT 0,
    "influence" INTEGER NOT NULL DEFAULT 0,
    "intimidation" INTEGER NOT NULL DEFAULT 0,
    "marketControl" INTEGER NOT NULL DEFAULT 0,
    "territoryKey" TEXT NOT NULL DEFAULT 'district-1',
    "nationFlag" TEXT NOT NULL DEFAULT '{"primary":"#1d4ed8","secondary":"#f8fafc","accent":"#dc2626","pattern":"tricolor","icon":"star"}',
    "alliancesJson" TEXT NOT NULL DEFAULT '[]',
    "allianceRequestsJson" TEXT NOT NULL DEFAULT '[]',
    "arsenalJson" TEXT NOT NULL DEFAULT '{"PISTOL":0,"AK":0,"SNIPER":0}',
    "injuriesJson" TEXT NOT NULL DEFAULT '[]',
    "ownerId" TEXT NOT NULL,
    "tagUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "tagText" TEXT,
    "tagStyle" TEXT,
    "slotUpgraded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Clan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanBankContribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanBankContribution_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanBankContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanOwnedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clanId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanOwnedItem_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanOwnedItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanEffect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clanId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" INTEGER NOT NULL DEFAULT 0,
    "durationHours" INTEGER NOT NULL DEFAULT 1,
    "cooldownHours" INTEGER NOT NULL DEFAULT 24,
    "activatedAt" DATETIME,
    "activeUntil" DATETIME,
    "cooldownUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanEffect_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanMember_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanJoinRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanJoinRequest_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanMessage_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanWar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attackerClanId" TEXT NOT NULL,
    "defenderClanId" TEXT NOT NULL,
    "declaredByUserId" TEXT NOT NULL,
    "winnerClanId" TEXT,
    "winnerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "attackerScore" INTEGER NOT NULL DEFAULT 0,
    "defenderScore" INTEGER NOT NULL DEFAULT 0,
    "attackerTrophiesBefore" INTEGER NOT NULL DEFAULT 1000,
    "defenderTrophiesBefore" INTEGER NOT NULL DEFAULT 1000,
    "attackerTrophyChange" INTEGER NOT NULL DEFAULT 0,
    "defenderTrophyChange" INTEGER NOT NULL DEFAULT 0,
    "targetScore" INTEGER NOT NULL DEFAULT 180,
    "declaredWeekKey" TEXT,
    "attackerBoostMoney" INTEGER NOT NULL DEFAULT 0,
    "defenderBoostMoney" INTEGER NOT NULL DEFAULT 0,
    "attackerPenaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "defenderPenaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "attackerDisabledSlots" INTEGER NOT NULL DEFAULT 0,
    "defenderDisabledSlots" INTEGER NOT NULL DEFAULT 0,
    "winnerRewardMoney" INTEGER NOT NULL DEFAULT 1200,
    "loserRewardMoney" INTEGER NOT NULL DEFAULT 300,
    "winnerRewardAura" INTEGER NOT NULL DEFAULT 45,
    "loserRewardAura" INTEGER NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanWar_attackerClanId_fkey" FOREIGN KEY ("attackerClanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWar_defenderClanId_fkey" FOREIGN KEY ("defenderClanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWar_declaredByUserId_fkey" FOREIGN KEY ("declaredByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWar_winnerClanId_fkey" FOREIGN KEY ("winnerClanId") REFERENCES "Clan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClanWar_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanWarDefense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "durability" INTEGER NOT NULL DEFAULT 60,
    "maxDurability" INTEGER NOT NULL DEFAULT 60,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanWarDefense_warId_fkey" FOREIGN KEY ("warId") REFERENCES "ClanWar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarDefense_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanWarAttack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "targetClanId" TEXT NOT NULL,
    "attackType" TEXT NOT NULL,
    "staminaCost" INTEGER NOT NULL DEFAULT 1,
    "basePoints" INTEGER NOT NULL,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    "defenseMitigation" INTEGER NOT NULL DEFAULT 0,
    "structureDamage" INTEGER NOT NULL DEFAULT 0,
    "finalPoints" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanWarAttack_warId_fkey" FOREIGN KEY ("warId") REFERENCES "ClanWar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarAttack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarAttack_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarAttack_targetClanId_fkey" FOREIGN KEY ("targetClanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanWarFortification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warId" TEXT NOT NULL,
    "defenseId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "levelAdded" INTEGER NOT NULL DEFAULT 0,
    "durabilityAdded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanWarFortification_warId_fkey" FOREIGN KEY ("warId") REFERENCES "ClanWar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarFortification_defenseId_fkey" FOREIGN KEY ("defenseId") REFERENCES "ClanWarDefense" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarFortification_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarFortification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanWarGameLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "isPractice" BOOLEAN NOT NULL DEFAULT false,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanWarGameLog_warId_fkey" FOREIGN KEY ("warId") REFERENCES "ClanWar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarGameLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarGameLog_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanWarNavalBoard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "grid" TEXT NOT NULL,
    CONSTRAINT "ClanWarNavalBoard_warId_fkey" FOREIGN KEY ("warId") REFERENCES "ClanWar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarNavalBoard_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanWarNavalShot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "warId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "isHit" BOOLEAN NOT NULL DEFAULT false,
    "building" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanWarNavalShot_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "ClanWarNavalBoard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarNavalShot_warId_fkey" FOREIGN KEY ("warId") REFERENCES "ClanWar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarNavalShot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanWarNavalShot_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanPumpUpMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clanId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#ffffff',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanPumpUpMessage_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "bannerUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "highlightColor" TEXT,
    "rulesSummary" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    "finalizedAt" DATETIME,
    "rewardsDistributedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanEventQuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "activityType" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "pointsReward" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanEventQuest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanEventQuestProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanEventQuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "ClanEventQuest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventQuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventQuestProgress_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanEventMiniGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "instructions" TEXT,
    "scoreMultiplier" REAL NOT NULL DEFAULT 1,
    "flatPointsBonus" INTEGER NOT NULL DEFAULT 0,
    "maxPointsPerAttempt" INTEGER NOT NULL DEFAULT 100,
    "maxAttemptsPerUser" INTEGER,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "configJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanEventMiniGame_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanEventMiniGameAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "miniGameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "rawScore" INTEGER NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanEventMiniGameAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventMiniGameAttempt_miniGameId_fkey" FOREIGN KEY ("miniGameId") REFERENCES "ClanEventMiniGame" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventMiniGameAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventMiniGameAttempt_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanEventRewardTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "minRank" INTEGER NOT NULL,
    "maxRank" INTEGER NOT NULL,
    "moneyReward" INTEGER NOT NULL DEFAULT 0,
    "auraReward" INTEGER NOT NULL DEFAULT 0,
    "itemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClanEventRewardTier_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventRewardTier_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanEventClanScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanEventClanScore_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventClanScore_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClanEventActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "userId" TEXT,
    "sourceType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "sourceId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanEventActivity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventActivity_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClanEventActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'user',
    "message" TEXT NOT NULL,
    "imageUrl" TEXT,
    "replyToId" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" DATETIME,
    "deletedAt" DATETIME,
    "deletedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "AuraCoinPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "price" REAL NOT NULL,
    "volume" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuraCoinTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "coinAmount" REAL NOT NULL,
    "moneyAmount" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "fee" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuraCoinTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuraCoinPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "leverage" INTEGER NOT NULL,
    "entryPrice" REAL NOT NULL,
    "coinAmount" REAL NOT NULL,
    "marginAmount" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "closedAt" DATETIME,
    "exitPrice" REAL,
    "pnl" INTEGER,
    "liquidated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuraCoinPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserCryptoBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "coinKey" TEXT NOT NULL,
    "balance" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserCryptoBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CryptoPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coinKey" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "volume" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CryptoTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "coinKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "coinAmount" REAL NOT NULL,
    "moneyAmount" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "fee" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CryptoTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CryptoPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "coinKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "leverage" INTEGER NOT NULL,
    "entryPrice" REAL NOT NULL,
    "coinAmount" REAL NOT NULL,
    "marginAmount" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "closedAt" DATETIME,
    "exitPrice" REAL,
    "pnl" INTEGER,
    "liquidated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CryptoPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "images" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminReply" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "BugReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "Suggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuggestionComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suggestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuggestionComment_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SuggestionComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuggestionVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suggestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuggestionVote_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SuggestionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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

-- CreateTable
CREATE TABLE "BombPartyPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prompt" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "length" INTEGER NOT NULL DEFAULT 2
);

-- CreateTable
CREATE TABLE "GameSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TaxBracket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threshold" INTEGER NOT NULL,
    "rate" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BombPartyStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "totalPlayed" INTEGER NOT NULL DEFAULT 0,
    "wordsTyped" INTEGER NOT NULL DEFAULT 0,
    "longestWord" TEXT,
    CONSTRAINT "BombPartyStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ban" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bannedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Ban_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ban_bannedBy_fkey" FOREIGN KEY ("bannedBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BanAppeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "banId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    CONSTRAINT "BanAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BanAppeal_banId_fkey" FOREIGN KEY ("banId") REFERENCES "Ban" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NameChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "currentUsername" TEXT NOT NULL,
    "requestedUsername" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    CONSTRAINT "NameChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT,
    "targetId" TEXT,
    "targetName" TEXT,
    "details" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PolymarketSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "eventDate" DATETIME,
    "suggestedYesOdds" REAL,
    "suggestedNoOdds" REAL,
    "optionsConfig" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    CONSTRAINT "PolymarketSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolymarketEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suggestionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "eventDate" DATETIME NOT NULL,
    "yesOdds" REAL NOT NULL,
    "noOdds" REAL NOT NULL,
    "optionsConfig" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "PolymarketEvent_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "PolymarketSuggestion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolymarketBet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "prediction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payout" BIGINT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolymarketBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PolymarketBet_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PolymarketEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyQuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "moneyReward" INTEGER NOT NULL,
    "auraReward" INTEGER NOT NULL,
    "questDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserDailyQuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "questDate" DATETIME NOT NULL,
    "selectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "isClaimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" DATETIME,
    CONSTRAINT "UserDailyQuest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserDailyQuest_questId_fkey" FOREIGN KEY ("questId") REFERENCES "DailyQuest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserQuestProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userQuestId" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserQuestProgress_userQuestId_fkey" FOREIGN KEY ("userQuestId") REFERENCES "UserDailyQuest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GiftTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "message" TEXT,
    "moneyAmount" INTEGER NOT NULL DEFAULT 0,
    "auraAmount" INTEGER NOT NULL DEFAULT 0,
    "giftedItemId" TEXT,
    "isOpened" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Gift_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Gift_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Gift_giftedItemId_fkey" FOREIGN KEY ("giftedItemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GiftItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giftId" TEXT NOT NULL,
    "giftTemplateId" TEXT NOT NULL,
    CONSTRAINT "GiftItem_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "Gift" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GiftItem_giftTemplateId_fkey" FOREIGN KEY ("giftTemplateId") REFERENCES "GiftTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OnlineSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL,
    "usernames" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" TEXT,
    "link" TEXT,
    "icon" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "howToObtain" TEXT,
    "backgroundType" TEXT NOT NULL DEFAULT 'solid',
    "backgroundColor" TEXT NOT NULL DEFAULT '#374151',
    "backgroundGradient" TEXT,
    "backgroundImage" TEXT,
    "icon" TEXT NOT NULL DEFAULT '⭐',
    "iconColor" TEXT NOT NULL DEFAULT '#ffffff',
    "borderColor" TEXT NOT NULL DEFAULT '#6b7280',
    "category" TEXT NOT NULL DEFAULT 'special',
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "autoConditionKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "Badge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "obtainedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "obtainedReason" TEXT,
    CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminWarning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'AVERTISSEMENT',
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "amount" INTEGER,
    "isAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminWarning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdminWarning_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "audienceType" TEXT NOT NULL DEFAULT 'ALL_USERS',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "popupDelaySeconds" INTEGER NOT NULL DEFAULT 45,
    "createdById" TEXT NOT NULL,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Survey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SurveyOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surveyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SurveyOption_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SurveyTargetUser" (
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("surveyId", "userId"),
    CONSTRAINT "SurveyTargetUser_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SurveyTargetUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SurveyResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SurveyResponse_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "SurveyOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingSanction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestedById" TEXT NOT NULL,
    "requestedByRole" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "beneficiaryUserId" TEXT,
    "amount" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "caseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PendingSanction_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PendingSanction_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PendingSanction_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PendingSanction_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomBadgeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '⭐',
    "backgroundColor" TEXT NOT NULL DEFAULT '#374151',
    "borderColor" TEXT NOT NULL DEFAULT '#6b7280',
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "adminNote" TEXT,
    "badgeId" TEXT,
    "pricePaid" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomBadgeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomBadgeRequest_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "images" TEXT,
    "body" TEXT NOT NULL,
    "fromAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "deletedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportMessageReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SupportMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupportMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "imageUrl" TEXT,
    "createdById" TEXT,
    "businessId" TEXT,
    "courtCaseId" TEXT,
    "tagType" TEXT,
    "tagLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessageConversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MessageConversation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageConversationParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "courtRole" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" DATETIME,
    CONSTRAINT "MessageConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MessageConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageConversationMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "courtRole" TEXT,
    "replyToId" TEXT,
    "deletedAt" DATETIME,
    "deletedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MessageConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageConversationMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MessageConversationMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "MessageConversationMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageConversationReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageConversationReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MessageConversationMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageConversationReaction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MessageConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageConversationReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageConversationReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT,
    "snapshotJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" DATETIME,
    "reviewedById" TEXT,
    "reviewerNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageConversationReport_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MessageConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageConversationReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageConversationReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolytrackRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trackNumber" INTEGER NOT NULL,
    "timeMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolytrackRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UpdateEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT,
    "feedCategory" TEXT NOT NULL DEFAULT 'DEV',
    "imageUrl" TEXT,
    "accentColor" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "reactionSeedFire" INTEGER NOT NULL DEFAULT 0,
    "reactionSeedHeart" INTEGER NOT NULL DEFAULT 0,
    "reactionSeedZap" INTEGER NOT NULL DEFAULT 0,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "authorName" TEXT NOT NULL DEFAULT 'Equipe AuraTracker',
    "authorRole" TEXT,
    "authorAvatarUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UpdateItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UpdateItem_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "UpdateEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UpdateReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UpdateReaction_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "UpdateEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UpdateReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "accountType" TEXT NOT NULL DEFAULT 'COURANT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Plainte" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plaintifId" TEXT NOT NULL,
    "defendantId" TEXT,
    "courtId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Plainte_plaintifId_fkey" FOREIGN KEY ("plaintifId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Plainte_defendantId_fkey" FOREIGN KEY ("defendantId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Plainte_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourtCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseNumber" TEXT NOT NULL,
    "plainteId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "plaintifId" TEXT NOT NULL,
    "defendantId" TEXT NOT NULL,
    "plaintiffLawFirmId" TEXT,
    "plaintiffLawyerId" TEXT,
    "defendantLawFirmId" TEXT,
    "defendantLawyerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "verdict" TEXT,
    "verdictAt" DATETIME,
    "sentencing" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourtCase_plainteId_fkey" FOREIGN KEY ("plainteId") REFERENCES "Plainte" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CourtCase_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MessageConversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CourtCase_plaintifId_fkey" FOREIGN KEY ("plaintifId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CourtCase_defendantId_fkey" FOREIGN KEY ("defendantId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CourtCase_plaintiffLawFirmId_fkey" FOREIGN KEY ("plaintiffLawFirmId") REFERENCES "Business" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CourtCase_plaintiffLawyerId_fkey" FOREIGN KEY ("plaintiffLawyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CourtCase_defendantLawFirmId_fkey" FOREIGN KEY ("defendantLawFirmId") REFERENCES "Business" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CourtCase_defendantLawyerId_fkey" FOREIGN KEY ("defendantLawyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourtParty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courtRole" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourtParty_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CourtCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourtParty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourtArgument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourtArgument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CourtCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourtArgument_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuraScrollPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "mediaUrls" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuraScrollPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuraScrollLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuraScrollLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "AuraScrollPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuraScrollLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuraScrollComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuraScrollComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "AuraScrollPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuraScrollComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuraScrollCommentLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuraScrollCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "AuraScrollComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuraScrollCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessPurchasedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "businessName" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "itemLabel" TEXT NOT NULL,
    "itemEmoji" TEXT,
    "itemImageUrl" TEXT,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessPurchasedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessPurchasedItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ForumSubreddit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatorId" TEXT NOT NULL,
    CONSTRAINT "ForumSubreddit_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ForumSubredditMember" (
    "userId" TEXT NOT NULL,
    "subredditId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "subredditId"),
    CONSTRAINT "ForumSubredditMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForumSubredditMember_subredditId_fkey" FOREIGN KEY ("subredditId") REFERENCES "ForumSubreddit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ForumPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "url" TEXT,
    "type" TEXT NOT NULL DEFAULT 'text',
    "authorId" TEXT NOT NULL,
    "subredditId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ForumPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForumPost_subredditId_fkey" FOREIGN KEY ("subredditId") REFERENCES "ForumSubreddit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ForumComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "parentId" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ForumComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForumComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForumComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ForumComment" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "ForumPostVote" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "postId"),
    CONSTRAINT "ForumPostVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForumPostVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ForumCommentVote" (
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "commentId"),
    CONSTRAINT "ForumCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForumCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "ForumComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_aura_idx" ON "User"("aura");

-- CreateIndex
CREATE INDEX "User_money_idx" ON "User"("money");

-- CreateIndex
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

-- CreateIndex
CREATE INDEX "User_totalScore_idx" ON "User"("totalScore");

-- CreateIndex
CREATE INDEX "User_overallRank_idx" ON "User"("overallRank");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationReview_registrationUserId_key" ON "RegistrationReview"("registrationUserId");

-- CreateIndex
CREATE INDEX "RegistrationReview_status_reviewedAt_idx" ON "RegistrationReview"("status", "reviewedAt");

-- CreateIndex
CREATE INDEX "RegistrationReview_reviewedAt_idx" ON "RegistrationReview"("reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserItem_userId_itemId_key" ON "UserItem"("userId", "itemId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_createdAt_idx" ON "MarketplaceListing"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceListing_sellerId_status_idx" ON "MarketplaceListing"("sellerId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceListing_itemId_idx" ON "MarketplaceListing"("itemId");

-- CreateIndex
CREATE INDEX "Transfer_senderId_idx" ON "Transfer"("senderId");

-- CreateIndex
CREATE INDEX "Transfer_receiverId_idx" ON "Transfer"("receiverId");

-- CreateIndex
CREATE UNIQUE INDEX "GameStats_userId_gameType_key" ON "GameStats"("userId", "gameType");

-- CreateIndex
CREATE UNIQUE INDEX "GoyaveSave_userId_key" ON "GoyaveSave"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClashVillage_userId_key" ON "ClashVillage"("userId");

-- CreateIndex
CREATE INDEX "ClashVillage_trophies_idx" ON "ClashVillage"("trophies");

-- CreateIndex
CREATE INDEX "ClashVillage_moneyInStorage_idx" ON "ClashVillage"("moneyInStorage");

-- CreateIndex
CREATE INDEX "ClashBattle_attackerUserId_createdAt_idx" ON "ClashBattle"("attackerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ClashBattle_defenderUserId_createdAt_idx" ON "ClashBattle"("defenderUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ClashBattle_createdAt_idx" ON "ClashBattle"("createdAt");

-- CreateIndex
CREATE INDEX "ClashActivity_villageId_createdAt_idx" ON "ClashActivity"("villageId", "createdAt");

-- CreateIndex
CREATE INDEX "ClashActivity_type_createdAt_idx" ON "ClashActivity"("type", "createdAt");

-- CreateIndex
CREATE INDEX "DailyRacerRun_trackDate_lapTimeMs_idx" ON "DailyRacerRun"("trackDate", "lapTimeMs");

-- CreateIndex
CREATE INDEX "DailyRacerRun_trackDate_userId_idx" ON "DailyRacerRun"("trackDate", "userId");

-- CreateIndex
CREATE INDEX "DailyRacerRun_userId_createdAt_idx" ON "DailyRacerRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GameScoreHistory_gameType_createdAt_idx" ON "GameScoreHistory"("gameType", "createdAt");

-- CreateIndex
CREATE INDEX "GameScoreHistory_userId_gameType_createdAt_idx" ON "GameScoreHistory"("userId", "gameType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartyMember_partyId_userId_key" ON "PartyMember"("partyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyMember_userId_key" ON "PartyMember"("userId");

-- CreateIndex
CREATE INDEX "PartyMessage_partyId_createdAt_idx" ON "PartyMessage"("partyId", "createdAt");

-- CreateIndex
CREATE INDEX "PartyMessage_userId_createdAt_idx" ON "PartyMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserFollow_followerId_createdAt_idx" ON "UserFollow"("followerId", "createdAt");

-- CreateIndex
CREATE INDEX "UserFollow_followingId_createdAt_idx" ON "UserFollow"("followingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserFollow_followerId_followingId_key" ON "UserFollow"("followerId", "followingId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectConversation_directKey_key" ON "DirectConversation"("directKey");

-- CreateIndex
CREATE INDEX "DirectConversation_lastMessageAt_idx" ON "DirectConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "DirectConversationParticipant_userId_joinedAt_idx" ON "DirectConversationParticipant"("userId", "joinedAt");

-- CreateIndex
CREATE INDEX "DirectConversationParticipant_conversationId_joinedAt_idx" ON "DirectConversationParticipant"("conversationId", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectConversationParticipant_conversationId_userId_key" ON "DirectConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_senderId_createdAt_idx" ON "DirectMessage"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "Business_ownerId_idx" ON "Business"("ownerId");

-- CreateIndex
CREATE INDEX "Business_supportAgentId_idx" ON "Business"("supportAgentId");

-- CreateIndex
CREATE INDEX "Business_typeKey_createdAt_idx" ON "Business"("typeKey", "createdAt");

-- CreateIndex
CREATE INDEX "Business_hiring_idx" ON "Business"("hiring");

-- CreateIndex
CREATE INDEX "Business_isStateOwned_idx" ON "Business"("isStateOwned");

-- CreateIndex
CREATE INDEX "Ad_businessId_idx" ON "Ad"("businessId");

-- CreateIndex
CREATE INDEX "Ad_isActive_adType_idx" ON "Ad"("isActive", "adType");

-- CreateIndex
CREATE INDEX "Ad_status_createdAt_idx" ON "Ad"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FormationProduct_businessId_idx" ON "FormationProduct"("businessId");

-- CreateIndex
CREATE INDEX "FormationProduct_businessId_status_idx" ON "FormationProduct"("businessId", "status");

-- CreateIndex
CREATE INDEX "BusinessRating_businessId_idx" ON "BusinessRating"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessRating_businessId_userId_key" ON "BusinessRating"("businessId", "userId");

-- CreateIndex
CREATE INDEX "BusinessMember_userId_status_idx" ON "BusinessMember"("userId", "status");

-- CreateIndex
CREATE INDEX "BusinessMember_businessId_isPrimaryLawyer_displayOrder_idx" ON "BusinessMember"("businessId", "isPrimaryLawyer", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessMember_businessId_userId_key" ON "BusinessMember"("businessId", "userId");

-- CreateIndex
CREATE INDEX "FormationProductPurchase_businessId_purchasedAt_idx" ON "FormationProductPurchase"("businessId", "purchasedAt");

-- CreateIndex
CREATE INDEX "FormationProductPurchase_productId_purchasedAt_idx" ON "FormationProductPurchase"("productId", "purchasedAt");

-- CreateIndex
CREATE INDEX "FormationProductPurchase_userId_reviewPromptAt_idx" ON "FormationProductPurchase"("userId", "reviewPromptAt");

-- CreateIndex
CREATE UNIQUE INDEX "FormationProductPurchase_userId_productId_key" ON "FormationProductPurchase"("userId", "productId");

-- CreateIndex
CREATE INDEX "FormationProductRating_businessId_createdAt_idx" ON "FormationProductRating"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "FormationProductRating_productId_createdAt_idx" ON "FormationProductRating"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FormationProductRating_productId_userId_key" ON "FormationProductRating"("productId", "userId");

-- CreateIndex
CREATE INDEX "LawyerRating_lawFirmBusinessId_createdAt_idx" ON "LawyerRating"("lawFirmBusinessId", "createdAt");

-- CreateIndex
CREATE INDEX "LawyerRating_lawyerUserId_createdAt_idx" ON "LawyerRating"("lawyerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LawyerRating_courtCaseId_authorUserId_key" ON "LawyerRating"("courtCaseId", "authorUserId");

-- CreateIndex
CREATE INDEX "ReviewEligibility_userId_targetType_promptAt_idx" ON "ReviewEligibility"("userId", "targetType", "promptAt");

-- CreateIndex
CREATE INDEX "ReviewEligibility_businessId_userId_idx" ON "ReviewEligibility"("businessId", "userId");

-- CreateIndex
CREATE INDEX "ReviewEligibility_formationProductId_userId_idx" ON "ReviewEligibility"("formationProductId", "userId");

-- CreateIndex
CREATE INDEX "ReviewEligibility_lawyerUserId_userId_idx" ON "ReviewEligibility"("lawyerUserId", "userId");

-- CreateIndex
CREATE INDEX "ReviewEligibility_courtCaseId_idx" ON "ReviewEligibility"("courtCaseId");

-- CreateIndex
CREATE INDEX "BusinessInvitation_inviteeId_status_idx" ON "BusinessInvitation"("inviteeId", "status");

-- CreateIndex
CREATE INDEX "BusinessInvitation_employeeId_status_idx" ON "BusinessInvitation"("employeeId", "status");

-- CreateIndex
CREATE INDEX "BusinessInvitation_employerId_status_idx" ON "BusinessInvitation"("employerId", "status");

-- CreateIndex
CREATE INDEX "BusinessInvitation_businessId_status_idx" ON "BusinessInvitation"("businessId", "status");

-- CreateIndex
CREATE INDEX "BusinessLoan_businessId_createdAt_idx" ON "BusinessLoan"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessLoan_borrowerId_status_idx" ON "BusinessLoan"("borrowerId", "status");

-- CreateIndex
CREATE INDEX "BusinessInvestment_businessId_createdAt_idx" ON "BusinessInvestment"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessInvestment_investorId_createdAt_idx" ON "BusinessInvestment"("investorId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessShareholder_businessId_sharePercent_idx" ON "BusinessShareholder"("businessId", "sharePercent");

-- CreateIndex
CREATE INDEX "BusinessShareholder_userId_createdAt_idx" ON "BusinessShareholder"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessShareholder_businessId_userId_key" ON "BusinessShareholder"("businessId", "userId");

-- CreateIndex
CREATE INDEX "BusinessShareProposal_businessId_status_idx" ON "BusinessShareProposal"("businessId", "status");

-- CreateIndex
CREATE INDEX "BusinessShareProposal_investorId_status_idx" ON "BusinessShareProposal"("investorId", "status");

-- CreateIndex
CREATE INDEX "BusinessShareProposal_ownerId_status_idx" ON "BusinessShareProposal"("ownerId", "status");

-- CreateIndex
CREATE INDEX "BusinessShareMarketListing_businessId_status_createdAt_idx" ON "BusinessShareMarketListing"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessShareMarketListing_sellerId_status_createdAt_idx" ON "BusinessShareMarketListing"("sellerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessShareMarketListing_buyerId_createdAt_idx" ON "BusinessShareMarketListing"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessBuyoutOffer_businessId_idx" ON "BusinessBuyoutOffer"("businessId");

-- CreateIndex
CREATE INDEX "BusinessBuyoutOffer_bidderId_idx" ON "BusinessBuyoutOffer"("bidderId");

-- CreateIndex
CREATE INDEX "BusinessBuyoutOffer_ownerId_status_idx" ON "BusinessBuyoutOffer"("ownerId", "status");

-- CreateIndex
CREATE INDEX "BusinessTransferTransaction_businessId_createdAt_idx" ON "BusinessTransferTransaction"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessTransferTransaction_senderId_createdAt_idx" ON "BusinessTransferTransaction"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessTransferTransaction_recipientId_createdAt_idx" ON "BusinessTransferTransaction"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessStartupProduct_businessId_slotIndex_idx" ON "BusinessStartupProduct"("businessId", "slotIndex");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessStartupProduct_businessId_slotIndex_key" ON "BusinessStartupProduct"("businessId", "slotIndex");

-- CreateIndex
CREATE INDEX "BraquageLegalSession_status_endTime_idx" ON "BraquageLegalSession"("status", "endTime");

-- CreateIndex
CREATE INDEX "BraquageLegalSession_createdAt_idx" ON "BraquageLegalSession"("createdAt");

-- CreateIndex
CREATE INDEX "BraquageLegalSession_winnerId_idx" ON "BraquageLegalSession"("winnerId");

-- CreateIndex
CREATE INDEX "BraquageLegalParticipation_sessionId_createdAt_idx" ON "BraquageLegalParticipation"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "BraquageLegalParticipation_userId_tier_idx" ON "BraquageLegalParticipation"("userId", "tier");

-- CreateIndex
CREATE INDEX "BraquageLegalParticipation_sessionId_userId_tier_idx" ON "BraquageLegalParticipation"("sessionId", "userId", "tier");

-- CreateIndex
CREATE INDEX "UserSkill_userId_idx" ON "UserSkill"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkill_userId_key_key" ON "UserSkill"("userId", "key");

-- CreateIndex
CREATE INDEX "Relationship_status_connectionLevel_idx" ON "Relationship"("status", "connectionLevel");

-- CreateIndex
CREATE INDEX "Relationship_userAId_idx" ON "Relationship"("userAId");

-- CreateIndex
CREATE INDEX "Relationship_userBId_idx" ON "Relationship"("userBId");

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_userAId_userBId_key" ON "Relationship"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "MarriageProposal_relationshipId_status_idx" ON "MarriageProposal"("relationshipId", "status");

-- CreateIndex
CREATE INDEX "MarriageProposal_recipientId_status_idx" ON "MarriageProposal"("recipientId", "status");

-- CreateIndex
CREATE INDEX "DivorceProposal_relationshipId_status_idx" ON "DivorceProposal"("relationshipId", "status");

-- CreateIndex
CREATE INDEX "DivorceProposal_recipientId_status_idx" ON "DivorceProposal"("recipientId", "status");

-- CreateIndex
CREATE INDEX "CheatingAccusation_accusedId_status_idx" ON "CheatingAccusation"("accusedId", "status");

-- CreateIndex
CREATE INDEX "CheatingAccusation_accuserId_status_idx" ON "CheatingAccusation"("accuserId", "status");

-- CreateIndex
CREATE INDEX "Clan_isPublic_idx" ON "Clan"("isPublic");

-- CreateIndex
CREATE INDEX "Clan_createdAt_idx" ON "Clan"("createdAt");

-- CreateIndex
CREATE INDEX "Clan_warTrophies_idx" ON "Clan"("warTrophies");

-- CreateIndex
CREATE INDEX "ClanBankContribution_clanId_createdAt_idx" ON "ClanBankContribution"("clanId", "createdAt");

-- CreateIndex
CREATE INDEX "ClanBankContribution_userId_createdAt_idx" ON "ClanBankContribution"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ClanOwnedItem_clanId_idx" ON "ClanOwnedItem"("clanId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanOwnedItem_clanId_itemId_key" ON "ClanOwnedItem"("clanId", "itemId");

-- CreateIndex
CREATE INDEX "ClanEffect_clanId_activeUntil_idx" ON "ClanEffect"("clanId", "activeUntil");

-- CreateIndex
CREATE INDEX "ClanEffect_clanId_cooldownUntil_idx" ON "ClanEffect"("clanId", "cooldownUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ClanEffect_clanId_type_key" ON "ClanEffect"("clanId", "type");

-- CreateIndex
CREATE INDEX "ClanMember_clanId_idx" ON "ClanMember"("clanId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanMember_clanId_userId_key" ON "ClanMember"("clanId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanMember_userId_key" ON "ClanMember"("userId");

-- CreateIndex
CREATE INDEX "ClanJoinRequest_clanId_idx" ON "ClanJoinRequest"("clanId");

-- CreateIndex
CREATE INDEX "ClanJoinRequest_userId_idx" ON "ClanJoinRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanJoinRequest_clanId_userId_key" ON "ClanJoinRequest"("clanId", "userId");

-- CreateIndex
CREATE INDEX "ClanMessage_clanId_createdAt_idx" ON "ClanMessage"("clanId", "createdAt");

-- CreateIndex
CREATE INDEX "ClanMessage_userId_createdAt_idx" ON "ClanMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ClanWar_attackerClanId_status_idx" ON "ClanWar"("attackerClanId", "status");

-- CreateIndex
CREATE INDEX "ClanWar_defenderClanId_status_idx" ON "ClanWar"("defenderClanId", "status");

-- CreateIndex
CREATE INDEX "ClanWar_status_startsAt_idx" ON "ClanWar"("status", "startsAt");

-- CreateIndex
CREATE INDEX "ClanWar_status_endsAt_idx" ON "ClanWar"("status", "endsAt");

-- CreateIndex
CREATE INDEX "ClanWar_winnerClanId_idx" ON "ClanWar"("winnerClanId");

-- CreateIndex
CREATE INDEX "ClanWarDefense_warId_clanId_idx" ON "ClanWarDefense"("warId", "clanId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanWarDefense_warId_clanId_type_key" ON "ClanWarDefense"("warId", "clanId", "type");

-- CreateIndex
CREATE INDEX "ClanWarAttack_warId_clanId_createdAt_idx" ON "ClanWarAttack"("warId", "clanId", "createdAt");

-- CreateIndex
CREATE INDEX "ClanWarAttack_warId_userId_createdAt_idx" ON "ClanWarAttack"("warId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "ClanWarAttack_warId_targetClanId_createdAt_idx" ON "ClanWarAttack"("warId", "targetClanId", "createdAt");

-- CreateIndex
CREATE INDEX "ClanWarFortification_warId_clanId_userId_idx" ON "ClanWarFortification"("warId", "clanId", "userId");

-- CreateIndex
CREATE INDEX "ClanWarFortification_defenseId_idx" ON "ClanWarFortification"("defenseId");

-- CreateIndex
CREATE INDEX "ClanWarGameLog_warId_userId_gameType_idx" ON "ClanWarGameLog"("warId", "userId", "gameType");

-- CreateIndex
CREATE INDEX "ClanWarGameLog_userId_gameType_playedAt_idx" ON "ClanWarGameLog"("userId", "gameType", "playedAt");

-- CreateIndex
CREATE INDEX "ClanWarNavalBoard_warId_idx" ON "ClanWarNavalBoard"("warId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanWarNavalBoard_warId_clanId_key" ON "ClanWarNavalBoard"("warId", "clanId");

-- CreateIndex
CREATE INDEX "ClanWarNavalShot_boardId_userId_idx" ON "ClanWarNavalShot"("boardId", "userId");

-- CreateIndex
CREATE INDEX "ClanWarNavalShot_warId_clanId_idx" ON "ClanWarNavalShot"("warId", "clanId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanWarNavalShot_boardId_x_y_key" ON "ClanWarNavalShot"("boardId", "x", "y");

-- CreateIndex
CREATE INDEX "ClanPumpUpMessage_clanId_idx" ON "ClanPumpUpMessage"("clanId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanEvent_slug_key" ON "ClanEvent"("slug");

-- CreateIndex
CREATE INDEX "ClanEvent_status_startsAt_idx" ON "ClanEvent"("status", "startsAt");

-- CreateIndex
CREATE INDEX "ClanEvent_status_endsAt_idx" ON "ClanEvent"("status", "endsAt");

-- CreateIndex
CREATE INDEX "ClanEventQuest_eventId_sortOrder_idx" ON "ClanEventQuest"("eventId", "sortOrder");

-- CreateIndex
CREATE INDEX "ClanEventQuest_eventId_activityType_idx" ON "ClanEventQuest"("eventId", "activityType");

-- CreateIndex
CREATE INDEX "ClanEventQuestProgress_clanId_completedAt_idx" ON "ClanEventQuestProgress"("clanId", "completedAt");

-- CreateIndex
CREATE INDEX "ClanEventQuestProgress_userId_completedAt_idx" ON "ClanEventQuestProgress"("userId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClanEventQuestProgress_questId_userId_key" ON "ClanEventQuestProgress"("questId", "userId");

-- CreateIndex
CREATE INDEX "ClanEventMiniGame_eventId_sortOrder_idx" ON "ClanEventMiniGame"("eventId", "sortOrder");

-- CreateIndex
CREATE INDEX "ClanEventMiniGame_eventId_type_idx" ON "ClanEventMiniGame"("eventId", "type");

-- CreateIndex
CREATE INDEX "ClanEventMiniGameAttempt_eventId_clanId_createdAt_idx" ON "ClanEventMiniGameAttempt"("eventId", "clanId", "createdAt");

-- CreateIndex
CREATE INDEX "ClanEventMiniGameAttempt_miniGameId_userId_createdAt_idx" ON "ClanEventMiniGameAttempt"("miniGameId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "ClanEventRewardTier_eventId_minRank_maxRank_idx" ON "ClanEventRewardTier"("eventId", "minRank", "maxRank");

-- CreateIndex
CREATE INDEX "ClanEventClanScore_eventId_totalPoints_idx" ON "ClanEventClanScore"("eventId", "totalPoints");

-- CreateIndex
CREATE UNIQUE INDEX "ClanEventClanScore_eventId_clanId_key" ON "ClanEventClanScore"("eventId", "clanId");

-- CreateIndex
CREATE INDEX "ClanEventActivity_eventId_createdAt_idx" ON "ClanEventActivity"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "ClanEventActivity_eventId_clanId_createdAt_idx" ON "ClanEventActivity"("eventId", "clanId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_deletedAt_createdAt_idx" ON "ChatMessage"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "ChatReaction_messageId_idx" ON "ChatReaction"("messageId");

-- CreateIndex
CREATE INDEX "ChatReaction_userId_idx" ON "ChatReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatReaction_messageId_userId_emoji_key" ON "ChatReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "Season_isActive_idx" ON "Season"("isActive");

-- CreateIndex
CREATE INDEX "AuraCoinPrice_createdAt_idx" ON "AuraCoinPrice"("createdAt");

-- CreateIndex
CREATE INDEX "AuraCoinTransaction_userId_idx" ON "AuraCoinTransaction"("userId");

-- CreateIndex
CREATE INDEX "AuraCoinTransaction_createdAt_idx" ON "AuraCoinTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "AuraCoinPosition_userId_idx" ON "AuraCoinPosition"("userId");

-- CreateIndex
CREATE INDEX "AuraCoinPosition_isOpen_idx" ON "AuraCoinPosition"("isOpen");

-- CreateIndex
CREATE INDEX "AuraCoinPosition_createdAt_idx" ON "AuraCoinPosition"("createdAt");

-- CreateIndex
CREATE INDEX "UserCryptoBalance_coinKey_balance_idx" ON "UserCryptoBalance"("coinKey", "balance");

-- CreateIndex
CREATE UNIQUE INDEX "UserCryptoBalance_userId_coinKey_key" ON "UserCryptoBalance"("userId", "coinKey");

-- CreateIndex
CREATE INDEX "CryptoPrice_coinKey_createdAt_idx" ON "CryptoPrice"("coinKey", "createdAt");

-- CreateIndex
CREATE INDEX "CryptoTransaction_userId_coinKey_idx" ON "CryptoTransaction"("userId", "coinKey");

-- CreateIndex
CREATE INDEX "CryptoTransaction_coinKey_createdAt_idx" ON "CryptoTransaction"("coinKey", "createdAt");

-- CreateIndex
CREATE INDEX "CryptoPosition_userId_coinKey_isOpen_idx" ON "CryptoPosition"("userId", "coinKey", "isOpen");

-- CreateIndex
CREATE INDEX "CryptoPosition_coinKey_createdAt_idx" ON "CryptoPosition"("coinKey", "createdAt");

-- CreateIndex
CREATE INDEX "BugReport_status_idx" ON "BugReport"("status");

-- CreateIndex
CREATE INDEX "BugReport_createdAt_idx" ON "BugReport"("createdAt");

-- CreateIndex
CREATE INDEX "Suggestion_status_idx" ON "Suggestion"("status");

-- CreateIndex
CREATE INDEX "Suggestion_createdAt_idx" ON "Suggestion"("createdAt");

-- CreateIndex
CREATE INDEX "SuggestionComment_suggestionId_idx" ON "SuggestionComment"("suggestionId");

-- CreateIndex
CREATE INDEX "SuggestionComment_createdAt_idx" ON "SuggestionComment"("createdAt");

-- CreateIndex
CREATE INDEX "SuggestionVote_suggestionId_idx" ON "SuggestionVote"("suggestionId");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestionVote_suggestionId_userId_key" ON "SuggestionVote"("suggestionId", "userId");

-- CreateIndex
CREATE INDEX "SuggestionRating_suggestionId_idx" ON "SuggestionRating"("suggestionId");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestionRating_suggestionId_userId_key" ON "SuggestionRating"("suggestionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BombPartyPrompt_prompt_key" ON "BombPartyPrompt"("prompt");

-- CreateIndex
CREATE INDEX "BombPartyPrompt_wordCount_idx" ON "BombPartyPrompt"("wordCount");

-- CreateIndex
CREATE INDEX "BombPartyPrompt_length_idx" ON "BombPartyPrompt"("length");

-- CreateIndex
CREATE INDEX "BombPartyPrompt_length_wordCount_idx" ON "BombPartyPrompt"("length", "wordCount");

-- CreateIndex
CREATE UNIQUE INDEX "GameSettings_key_key" ON "GameSettings"("key");

-- CreateIndex
CREATE INDEX "TaxBracket_threshold_idx" ON "TaxBracket"("threshold");

-- CreateIndex
CREATE UNIQUE INDEX "BombPartyStats_userId_key" ON "BombPartyStats"("userId");

-- CreateIndex
CREATE INDEX "Ban_userId_idx" ON "Ban"("userId");

-- CreateIndex
CREATE INDEX "Ban_isActive_idx" ON "Ban"("isActive");

-- CreateIndex
CREATE INDEX "Ban_expiresAt_idx" ON "Ban"("expiresAt");

-- CreateIndex
CREATE INDEX "BanAppeal_status_idx" ON "BanAppeal"("status");

-- CreateIndex
CREATE INDEX "BanAppeal_userId_idx" ON "BanAppeal"("userId");

-- CreateIndex
CREATE INDEX "BanAppeal_createdAt_idx" ON "BanAppeal"("createdAt");

-- CreateIndex
CREATE INDEX "NameChangeRequest_status_idx" ON "NameChangeRequest"("status");

-- CreateIndex
CREATE INDEX "NameChangeRequest_userId_idx" ON "NameChangeRequest"("userId");

-- CreateIndex
CREATE INDEX "NameChangeRequest_createdAt_idx" ON "NameChangeRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Log_type_idx" ON "Log"("type");

-- CreateIndex
CREATE INDEX "Log_action_idx" ON "Log"("action");

-- CreateIndex
CREATE INDEX "Log_userId_idx" ON "Log"("userId");

-- CreateIndex
CREATE INDEX "Log_createdAt_idx" ON "Log"("createdAt");

-- CreateIndex
CREATE INDEX "PolymarketSuggestion_status_idx" ON "PolymarketSuggestion"("status");

-- CreateIndex
CREATE INDEX "PolymarketSuggestion_createdAt_idx" ON "PolymarketSuggestion"("createdAt");

-- CreateIndex
CREATE INDEX "PolymarketSuggestion_userId_idx" ON "PolymarketSuggestion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketEvent_suggestionId_key" ON "PolymarketEvent"("suggestionId");

-- CreateIndex
CREATE INDEX "PolymarketEvent_status_idx" ON "PolymarketEvent"("status");

-- CreateIndex
CREATE INDEX "PolymarketEvent_eventDate_idx" ON "PolymarketEvent"("eventDate");

-- CreateIndex
CREATE INDEX "PolymarketEvent_createdAt_idx" ON "PolymarketEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PolymarketBet_userId_idx" ON "PolymarketBet"("userId");

-- CreateIndex
CREATE INDEX "PolymarketBet_eventId_idx" ON "PolymarketBet"("eventId");

-- CreateIndex
CREATE INDEX "PolymarketBet_createdAt_idx" ON "PolymarketBet"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketBet_userId_eventId_key" ON "PolymarketBet"("userId", "eventId");

-- CreateIndex
CREATE INDEX "DailyQuest_questDate_idx" ON "DailyQuest"("questDate");

-- CreateIndex
CREATE INDEX "DailyQuest_questType_idx" ON "DailyQuest"("questType");

-- CreateIndex
CREATE INDEX "UserDailyQuest_userId_idx" ON "UserDailyQuest"("userId");

-- CreateIndex
CREATE INDEX "UserDailyQuest_questId_idx" ON "UserDailyQuest"("questId");

-- CreateIndex
CREATE INDEX "UserDailyQuest_questDate_idx" ON "UserDailyQuest"("questDate");

-- CreateIndex
CREATE INDEX "UserDailyQuest_isCompleted_idx" ON "UserDailyQuest"("isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "UserDailyQuest_userId_questId_questDate_key" ON "UserDailyQuest"("userId", "questId", "questDate");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuestProgress_userQuestId_key" ON "UserQuestProgress"("userQuestId");

-- CreateIndex
CREATE INDEX "UserQuestProgress_userQuestId_idx" ON "UserQuestProgress"("userQuestId");

-- CreateIndex
CREATE INDEX "Gift_senderId_idx" ON "Gift"("senderId");

-- CreateIndex
CREATE INDEX "Gift_receiverId_idx" ON "Gift"("receiverId");

-- CreateIndex
CREATE INDEX "Gift_isOpened_idx" ON "Gift"("isOpened");

-- CreateIndex
CREATE INDEX "Gift_createdAt_idx" ON "Gift"("createdAt");

-- CreateIndex
CREATE INDEX "Gift_giftedItemId_idx" ON "Gift"("giftedItemId");

-- CreateIndex
CREATE INDEX "GiftItem_giftId_idx" ON "GiftItem"("giftId");

-- CreateIndex
CREATE INDEX "GiftItem_giftTemplateId_idx" ON "GiftItem"("giftTemplateId");

-- CreateIndex
CREATE INDEX "OnlineSnapshot_createdAt_idx" ON "OnlineSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_isArchived_idx" ON "Notification"("userId", "isArchived");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_updatedAt_idx" ON "PushSubscription"("updatedAt");

-- CreateIndex
CREATE INDEX "Badge_category_idx" ON "Badge"("category");

-- CreateIndex
CREATE INDEX "Badge_isAutomatic_idx" ON "Badge"("isAutomatic");

-- CreateIndex
CREATE INDEX "Badge_autoConditionKey_idx" ON "Badge"("autoConditionKey");

-- CreateIndex
CREATE INDEX "Badge_isActive_idx" ON "Badge"("isActive");

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE INDEX "UserBadge_badgeId_idx" ON "UserBadge"("badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "AdminWarning_userId_isAcknowledged_idx" ON "AdminWarning"("userId", "isAcknowledged");

-- CreateIndex
CREATE INDEX "AdminWarning_createdAt_idx" ON "AdminWarning"("createdAt");

-- CreateIndex
CREATE INDEX "Survey_status_createdAt_idx" ON "Survey"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Survey_audienceType_status_idx" ON "Survey"("audienceType", "status");

-- CreateIndex
CREATE INDEX "SurveyOption_surveyId_sortOrder_idx" ON "SurveyOption"("surveyId", "sortOrder");

-- CreateIndex
CREATE INDEX "SurveyTargetUser_userId_idx" ON "SurveyTargetUser"("userId");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_optionId_idx" ON "SurveyResponse"("surveyId", "optionId");

-- CreateIndex
CREATE INDEX "SurveyResponse_userId_createdAt_idx" ON "SurveyResponse"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_surveyId_userId_key" ON "SurveyResponse"("surveyId", "userId");

-- CreateIndex
CREATE INDEX "PendingSanction_status_createdAt_idx" ON "PendingSanction"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomBadgeRequest_badgeId_key" ON "CustomBadgeRequest"("badgeId");

-- CreateIndex
CREATE INDEX "CustomBadgeRequest_userId_idx" ON "CustomBadgeRequest"("userId");

-- CreateIndex
CREATE INDEX "CustomBadgeRequest_status_idx" ON "CustomBadgeRequest"("status");

-- CreateIndex
CREATE INDEX "SupportMessage_userId_idx" ON "SupportMessage"("userId");

-- CreateIndex
CREATE INDEX "SupportMessage_createdAt_idx" ON "SupportMessage"("createdAt");

-- CreateIndex
CREATE INDEX "SupportMessage_userId_deletedAt_createdAt_idx" ON "SupportMessage"("userId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "SupportMessageReaction_messageId_idx" ON "SupportMessageReaction"("messageId");

-- CreateIndex
CREATE INDEX "SupportMessageReaction_userId_idx" ON "SupportMessageReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportMessageReaction_messageId_userId_emoji_key" ON "SupportMessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "MessageConversation_courtCaseId_key" ON "MessageConversation"("courtCaseId");

-- CreateIndex
CREATE INDEX "MessageConversation_type_lastMessageAt_idx" ON "MessageConversation"("type", "lastMessageAt");

-- CreateIndex
CREATE INDEX "MessageConversation_createdById_idx" ON "MessageConversation"("createdById");

-- CreateIndex
CREATE INDEX "MessageConversation_businessId_idx" ON "MessageConversation"("businessId");

-- CreateIndex
CREATE INDEX "MessageConversationParticipant_userId_joinedAt_idx" ON "MessageConversationParticipant"("userId", "joinedAt");

-- CreateIndex
CREATE INDEX "MessageConversationParticipant_conversationId_lastReadAt_idx" ON "MessageConversationParticipant"("conversationId", "lastReadAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageConversationParticipant_conversationId_userId_key" ON "MessageConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "MessageConversationMessage_conversationId_createdAt_idx" ON "MessageConversationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageConversationMessage_conversationId_deletedAt_createdAt_idx" ON "MessageConversationMessage"("conversationId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "MessageConversationMessage_senderId_createdAt_idx" ON "MessageConversationMessage"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageConversationMessage_replyToId_idx" ON "MessageConversationMessage"("replyToId");

-- CreateIndex
CREATE INDEX "MessageConversationReaction_messageId_idx" ON "MessageConversationReaction"("messageId");

-- CreateIndex
CREATE INDEX "MessageConversationReaction_userId_idx" ON "MessageConversationReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageConversationReaction_messageId_userId_emoji_key" ON "MessageConversationReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "UserBlock_blockerId_idx" ON "UserBlock"("blockerId");

-- CreateIndex
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "MessageConversationReport_conversationId_createdAt_idx" ON "MessageConversationReport"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageConversationReport_reporterId_createdAt_idx" ON "MessageConversationReport"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageConversationReport_status_createdAt_idx" ON "MessageConversationReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PolytrackRecord_trackNumber_timeMs_idx" ON "PolytrackRecord"("trackNumber", "timeMs");

-- CreateIndex
CREATE INDEX "PolytrackRecord_userId_idx" ON "PolytrackRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PolytrackRecord_userId_trackNumber_key" ON "PolytrackRecord"("userId", "trackNumber");

-- CreateIndex
CREATE INDEX "UpdateEntry_date_idx" ON "UpdateEntry"("date");

-- CreateIndex
CREATE INDEX "UpdateEntry_isPublished_publishedAt_idx" ON "UpdateEntry"("isPublished", "publishedAt");

-- CreateIndex
CREATE INDEX "UpdateItem_entryId_idx" ON "UpdateItem"("entryId");

-- CreateIndex
CREATE INDEX "UpdateReaction_entryId_kind_idx" ON "UpdateReaction"("entryId", "kind");

-- CreateIndex
CREATE INDEX "UpdateReaction_userId_createdAt_idx" ON "UpdateReaction"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UpdateReaction_entryId_userId_kind_key" ON "UpdateReaction"("entryId", "userId", "kind");

-- CreateIndex
CREATE INDEX "BankAccount_userId_idx" ON "BankAccount"("userId");

-- CreateIndex
CREATE INDEX "BankAccount_businessId_idx" ON "BankAccount"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_businessId_userId_accountType_key" ON "BankAccount"("businessId", "userId", "accountType");

-- CreateIndex
CREATE INDEX "BusinessTransaction_businessId_createdAt_idx" ON "BusinessTransaction"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "Plainte_courtId_status_idx" ON "Plainte"("courtId", "status");

-- CreateIndex
CREATE INDEX "Plainte_plaintifId_idx" ON "Plainte"("plaintifId");

-- CreateIndex
CREATE INDEX "Plainte_defendantId_idx" ON "Plainte"("defendantId");

-- CreateIndex
CREATE UNIQUE INDEX "CourtCase_caseNumber_key" ON "CourtCase"("caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CourtCase_plainteId_key" ON "CourtCase"("plainteId");

-- CreateIndex
CREATE UNIQUE INDEX "CourtCase_conversationId_key" ON "CourtCase"("conversationId");

-- CreateIndex
CREATE INDEX "CourtCase_status_idx" ON "CourtCase"("status");

-- CreateIndex
CREATE INDEX "CourtCase_plaintifId_idx" ON "CourtCase"("plaintifId");

-- CreateIndex
CREATE INDEX "CourtCase_defendantId_idx" ON "CourtCase"("defendantId");

-- CreateIndex
CREATE INDEX "CourtCase_plaintiffLawyerId_idx" ON "CourtCase"("plaintiffLawyerId");

-- CreateIndex
CREATE INDEX "CourtCase_defendantLawyerId_idx" ON "CourtCase"("defendantLawyerId");

-- CreateIndex
CREATE INDEX "CourtParty_caseId_idx" ON "CourtParty"("caseId");

-- CreateIndex
CREATE INDEX "CourtParty_userId_idx" ON "CourtParty"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourtParty_caseId_userId_key" ON "CourtParty"("caseId", "userId");

-- CreateIndex
CREATE INDEX "CourtArgument_caseId_idx" ON "CourtArgument"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourtArgument_caseId_side_key" ON "CourtArgument"("caseId", "side");

-- CreateIndex
CREATE INDEX "AuraScrollPost_status_createdAt_idx" ON "AuraScrollPost"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuraScrollPost_userId_idx" ON "AuraScrollPost"("userId");

-- CreateIndex
CREATE INDEX "AuraScrollLike_postId_idx" ON "AuraScrollLike"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "AuraScrollLike_postId_userId_key" ON "AuraScrollLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "AuraScrollComment_postId_createdAt_idx" ON "AuraScrollComment"("postId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuraScrollCommentLike_commentId_userId_key" ON "AuraScrollCommentLike"("commentId", "userId");

-- CreateIndex
CREATE INDEX "BusinessPurchasedItem_userId_acquiredAt_idx" ON "BusinessPurchasedItem"("userId", "acquiredAt");

-- CreateIndex
CREATE INDEX "BusinessPurchasedItem_businessId_idx" ON "BusinessPurchasedItem"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumSubreddit_name_key" ON "ForumSubreddit"("name");

-- CreateIndex
CREATE INDEX "ForumSubreddit_name_idx" ON "ForumSubreddit"("name");

-- CreateIndex
CREATE INDEX "ForumPost_subredditId_createdAt_idx" ON "ForumPost"("subredditId", "createdAt");

-- CreateIndex
CREATE INDEX "ForumPost_authorId_idx" ON "ForumPost"("authorId");

-- CreateIndex
CREATE INDEX "ForumComment_postId_idx" ON "ForumComment"("postId");

-- CreateIndex
CREATE INDEX "ForumComment_authorId_idx" ON "ForumComment"("authorId");

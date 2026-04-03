-- AddColumn images to BugReport
ALTER TABLE "BugReport" ADD COLUMN "images" TEXT;

-- AddColumn images to SupportMessage
ALTER TABLE "SupportMessage" ADD COLUMN "images" TEXT;

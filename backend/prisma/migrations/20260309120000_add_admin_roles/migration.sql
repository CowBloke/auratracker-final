ALTER TABLE "User" ADD COLUMN "adminRole" TEXT NOT NULL DEFAULT 'USER';

UPDATE "User"
SET "adminRole" = CASE
  WHEN "isAdmin" = 1 THEN 'SUPER_ADMIN'
  ELSE 'USER'
END;

DELETE FROM "GameStats"
WHERE "userId" IN (
  SELECT "id"
  FROM "User"
  WHERE "adminRole" = 'SUPER_ADMIN'
);

DELETE FROM "DailyRacerRun"
WHERE "userId" IN (
  SELECT "id"
  FROM "User"
  WHERE "adminRole" = 'SUPER_ADMIN'
);

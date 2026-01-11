UPDATE "User" SET "status" = 'ACTIVE' WHERE "status" = 'LOCKED';

ALTER TABLE "User" DROP COLUMN "failedLoginAttempts";
ALTER TABLE "User" DROP COLUMN "lockedUntil";

ALTER TYPE "UserStatus" RENAME TO "UserStatus_old";
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "status" TYPE "UserStatus" USING "status"::text::"UserStatus";
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
DROP TYPE "UserStatus_old";

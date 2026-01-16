ALTER TABLE "Product" DROP COLUMN IF EXISTS "unit";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "visionTrainingStatus";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "visionLastTrainingModel";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "visionLastTrainingJobId";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "visionTrainedAt";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "visionTrainingError";

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "hasVariants" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "parentProductId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "variantName" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "cgstRate" DECIMAL(5,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sgstRate" DECIMAL(5,2);

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_barcode_key";
DROP INDEX IF EXISTS "Product_barcode_key";
DROP INDEX IF EXISTS "Product_barcode_idx";
CREATE INDEX IF NOT EXISTS "Product_barcode_idx" ON "Product"("barcode");

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_parentProductId_fkey";
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_parentProductId_fkey"
  FOREIGN KEY ("parentProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Product_parentProductId_variantName_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Product_parentProductId_variantName_key"
  ON "Product"("parentProductId", "variantName");
CREATE INDEX IF NOT EXISTS "Product_parentProductId_idx" ON "Product"("parentProductId");

ALTER TABLE "InventoryItem" DROP COLUMN IF EXISTS "location";

ALTER TABLE "Batch" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;
ALTER TABLE "Batch" ADD COLUMN IF NOT EXISTS "reservedQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Batch" DROP CONSTRAINT IF EXISTS "Batch_supplierId_fkey";
ALTER TABLE "Batch"
  ADD CONSTRAINT "Batch_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Batch_supplierId_idx" ON "Batch"("supplierId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ThemeMode') THEN
    CREATE TYPE "ThemeMode" AS ENUM ('DARK', 'LIGHT');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "AppSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "businessName" TEXT,
  "ownerName" TEXT,
  "businessPhone" TEXT,
  "businessEmail" TEXT,
  "defaultCgst" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "defaultSgst" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "upiId" TEXT,
  "themeMode" "ThemeMode" NOT NULL DEFAULT 'DARK',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AppSettings" ("id", "updatedAt")
VALUES ('default', NOW())
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "Coupon" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "discountPercent" DECIMAL(5,2) NOT NULL,
  "maxDiscount" DECIMAL(12,2),
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_isActive_startsAt_endsAt_idx" ON "Coupon"("isActive", "startsAt", "endsAt");

DROP TABLE IF EXISTS "VisionTrackResolution" CASCADE;
DROP TABLE IF EXISTS "VisionDetectionEvent" CASCADE;
DROP TABLE IF EXISTS "VisionModelVersion" CASCADE;
DROP TABLE IF EXISTS "VisionCameraConfig" CASCADE;
DROP TABLE IF EXISTS "VisionDefectSample" CASCADE;
DROP TABLE IF EXISTS "VisionAnnotation" CASCADE;
DROP TABLE IF EXISTS "VisionDefectClass" CASCADE;
DROP TABLE IF EXISTS "VisionUnknownCapture" CASCADE;
DROP TABLE IF EXISTS "VisionProductImage" CASCADE;
DROP TABLE IF EXISTS "VisionSession" CASCADE;

DROP TYPE IF EXISTS "VisionAnnotationStatus" CASCADE;
DROP TYPE IF EXISTS "VisionTrackResolutionStatus" CASCADE;
DROP TYPE IF EXISTS "VisionSessionStatus" CASCADE;
DROP TYPE IF EXISTS "VisionTrainingStatus" CASCADE;
DROP TYPE IF EXISTS "VisionModelStatus" CASCADE;
DROP TYPE IF EXISTS "VisionModelType" CASCADE;
DROP TYPE IF EXISTS "VisionLineDirection" CASCADE;
DROP TYPE IF EXISTS "VisionUnknownStatus" CASCADE;
DROP TYPE IF EXISTS "VisionImageStatus" CASCADE;
DROP TYPE IF EXISTS "VisionDatasetSplit" CASCADE;

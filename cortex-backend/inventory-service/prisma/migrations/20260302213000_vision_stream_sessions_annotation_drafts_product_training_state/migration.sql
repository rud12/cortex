-- Vision stream sessions + annotation draft metadata + product training state

CREATE TYPE "VisionTrainingStatus" AS ENUM ('NOT_TRAINED', 'TRAINING', 'TRAINED', 'FAILED');
CREATE TYPE "VisionSessionStatus" AS ENUM ('ACTIVE', 'STOPPED', 'ARCHIVED');
CREATE TYPE "VisionTrackResolutionStatus" AS ENUM ('PENDING', 'ADD_PRODUCT', 'MAP_EXISTING', 'DISCARDED');
CREATE TYPE "VisionAnnotationStatus" AS ENUM ('DRAFT', 'SAVED', 'ARCHIVED');

ALTER TABLE "Product"
  ADD COLUMN "visionTrainingStatus" "VisionTrainingStatus" NOT NULL DEFAULT 'NOT_TRAINED',
  ADD COLUMN "visionLastTrainingModel" "VisionModelType",
  ADD COLUMN "visionLastTrainingJobId" TEXT,
  ADD COLUMN "visionTrainedAt" TIMESTAMP(3),
  ADD COLUMN "visionTrainingError" TEXT;

CREATE TABLE "VisionSession" (
  "id" TEXT NOT NULL,
  "cameraKey" TEXT,
  "rtspUrl" TEXT,
  "status" "VisionSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "supplierId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "summary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisionSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisionTrackResolution" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "trackId" TEXT NOT NULL,
  "status" "VisionTrackResolutionStatus" NOT NULL DEFAULT 'PENDING',
  "productId" TEXT,
  "note" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisionTrackResolution_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "VisionAnnotation"
  ADD COLUMN "className" TEXT,
  ADD COLUMN "defectType" TEXT,
  ADD COLUMN "sessionId" TEXT,
  ADD COLUMN "trackId" TEXT,
  ADD COLUMN "productId" TEXT,
  ADD COLUMN "annotatorId" TEXT,
  ADD COLUMN "frameRef" INTEGER,
  ADD COLUMN "imageCropPath" TEXT,
  ADD COLUMN "status" "VisionAnnotationStatus" NOT NULL DEFAULT 'SAVED';

ALTER TABLE "VisionDetectionEvent"
  ADD COLUMN "sessionId" TEXT;

CREATE INDEX "VisionSession_status_startedAt_idx" ON "VisionSession"("status", "startedAt");
CREATE INDEX "VisionSession_supplierId_startedAt_idx" ON "VisionSession"("supplierId", "startedAt");
CREATE UNIQUE INDEX "VisionTrackResolution_sessionId_trackId_key" ON "VisionTrackResolution"("sessionId", "trackId");
CREATE INDEX "VisionTrackResolution_productId_idx" ON "VisionTrackResolution"("productId");
CREATE INDEX "VisionTrackResolution_status_createdAt_idx" ON "VisionTrackResolution"("status", "createdAt");
CREATE INDEX "VisionAnnotation_sessionId_status_idx" ON "VisionAnnotation"("sessionId", "status");
CREATE INDEX "VisionAnnotation_trackId_idx" ON "VisionAnnotation"("trackId");
CREATE INDEX "VisionAnnotation_productId_idx" ON "VisionAnnotation"("productId");
CREATE INDEX "VisionDetectionEvent_sessionId_createdAt_idx" ON "VisionDetectionEvent"("sessionId", "createdAt");

ALTER TABLE "VisionSession"
  ADD CONSTRAINT "VisionSession_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisionTrackResolution"
  ADD CONSTRAINT "VisionTrackResolution_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VisionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "VisionTrackResolution_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisionAnnotation"
  ADD CONSTRAINT "VisionAnnotation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VisionSession"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "VisionAnnotation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisionDetectionEvent"
  ADD CONSTRAINT "VisionDetectionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VisionSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

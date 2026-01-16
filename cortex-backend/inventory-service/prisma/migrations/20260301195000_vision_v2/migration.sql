-- CreateEnum
CREATE TYPE "VisionDatasetSplit" AS ENUM ('TRAIN', 'VAL', 'TEST');

-- CreateEnum
CREATE TYPE "VisionImageStatus" AS ENUM ('ACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "VisionUnknownStatus" AS ENUM ('PENDING', 'MAPPED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "VisionLineDirection" AS ENUM ('FORWARD', 'REVERSE');

-- CreateEnum
CREATE TYPE "VisionModelType" AS ENUM ('PRODUCT_EMBEDDER', 'DEFECT_CLASSIFIER');

-- CreateEnum
CREATE TYPE "VisionModelStatus" AS ENUM ('TRAINING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "VisionProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "split" "VisionDatasetSplit" NOT NULL DEFAULT 'TRAIN',
    "embedding" JSONB,
    "status" "VisionImageStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisionProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisionUnknownCapture" (
    "id" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "cameraKey" TEXT,
    "detectionConfidence" DOUBLE PRECISION,
    "status" "VisionUnknownStatus" NOT NULL DEFAULT 'PENDING',
    "mappedProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisionUnknownCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisionDefectClass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisionDefectClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisionAnnotation" (
    "id" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "objectBbox" JSONB NOT NULL,
    "defectBoxes" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisionAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisionDefectSample" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "productId" TEXT,
    "filePath" TEXT NOT NULL,
    "annotationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisionDefectSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisionCameraConfig" (
    "id" TEXT NOT NULL,
    "cameraKey" TEXT NOT NULL,
    "lineStart" JSONB NOT NULL,
    "lineEnd" JSONB NOT NULL,
    "roiPolygon" JSONB NOT NULL,
    "direction" "VisionLineDirection" NOT NULL DEFAULT 'FORWARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisionCameraConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisionModelVersion" (
    "id" TEXT NOT NULL,
    "modelType" "VisionModelType" NOT NULL,
    "version" TEXT NOT NULL,
    "status" "VisionModelStatus" NOT NULL DEFAULT 'TRAINING',
    "metrics" JSONB,
    "artifactPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "VisionModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisionDetectionEvent" (
    "id" TEXT NOT NULL,
    "cameraKey" TEXT,
    "trackId" TEXT,
    "productId" TEXT,
    "unknownCaptureId" TEXT,
    "defectClassId" TEXT,
    "counted" BOOLEAN NOT NULL DEFAULT false,
    "anomalyScore" DOUBLE PRECISION,
    "isDamaged" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisionDetectionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisionProductImage_productId_status_idx" ON "VisionProductImage"("productId", "status");

-- CreateIndex
CREATE INDEX "VisionUnknownCapture_status_createdAt_idx" ON "VisionUnknownCapture"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VisionDefectClass_name_key" ON "VisionDefectClass"("name");

-- CreateIndex
CREATE INDEX "VisionDefectSample_classId_createdAt_idx" ON "VisionDefectSample"("classId", "createdAt");

-- CreateIndex
CREATE INDEX "VisionDefectSample_productId_idx" ON "VisionDefectSample"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "VisionCameraConfig_cameraKey_key" ON "VisionCameraConfig"("cameraKey");

-- CreateIndex
CREATE UNIQUE INDEX "VisionModelVersion_modelType_version_key" ON "VisionModelVersion"("modelType", "version");

-- CreateIndex
CREATE INDEX "VisionDetectionEvent_cameraKey_createdAt_idx" ON "VisionDetectionEvent"("cameraKey", "createdAt");

-- CreateIndex
CREATE INDEX "VisionDetectionEvent_productId_idx" ON "VisionDetectionEvent"("productId");

-- AddForeignKey
ALTER TABLE "VisionProductImage" ADD CONSTRAINT "VisionProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisionUnknownCapture" ADD CONSTRAINT "VisionUnknownCapture_mappedProductId_fkey" FOREIGN KEY ("mappedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisionDefectSample" ADD CONSTRAINT "VisionDefectSample_classId_fkey" FOREIGN KEY ("classId") REFERENCES "VisionDefectClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisionDefectSample" ADD CONSTRAINT "VisionDefectSample_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisionDefectSample" ADD CONSTRAINT "VisionDefectSample_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "VisionAnnotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisionDetectionEvent" ADD CONSTRAINT "VisionDetectionEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisionDetectionEvent" ADD CONSTRAINT "VisionDetectionEvent_unknownCaptureId_fkey" FOREIGN KEY ("unknownCaptureId") REFERENCES "VisionUnknownCapture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisionDetectionEvent" ADD CONSTRAINT "VisionDetectionEvent_defectClassId_fkey" FOREIGN KEY ("defectClassId") REFERENCES "VisionDefectClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

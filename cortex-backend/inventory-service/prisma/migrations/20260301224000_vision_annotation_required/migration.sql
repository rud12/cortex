-- Add optional annotation linkage for reference images
ALTER TABLE "VisionProductImage"
ADD COLUMN "annotationId" TEXT;

-- Index for annotation-based ingestion/lookups
CREATE INDEX "VisionProductImage_annotationId_idx"
ON "VisionProductImage"("annotationId");

-- Keep reference image rows when annotation is deleted
ALTER TABLE "VisionProductImage"
ADD CONSTRAINT "VisionProductImage_annotationId_fkey"
FOREIGN KEY ("annotationId") REFERENCES "VisionAnnotation"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

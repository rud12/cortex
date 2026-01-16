-- Make defect classes product-scoped (same class names can exist across products)
ALTER TABLE "VisionDefectClass"
ADD COLUMN "productId" TEXT;

-- Remove global uniqueness on class name
DROP INDEX IF EXISTS "VisionDefectClass_name_key";

-- Add product-scoped uniqueness and lookup index
CREATE INDEX "VisionDefectClass_productId_idx"
ON "VisionDefectClass"("productId");

CREATE UNIQUE INDEX "VisionDefectClass_productId_name_key"
ON "VisionDefectClass"("productId", "name");

-- Link class to product (optional to keep migration backward compatible)
ALTER TABLE "VisionDefectClass"
ADD CONSTRAINT "VisionDefectClass_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

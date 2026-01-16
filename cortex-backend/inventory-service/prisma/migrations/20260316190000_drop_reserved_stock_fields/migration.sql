ALTER TABLE "inventory"."Batch" DROP COLUMN IF EXISTS "reservedQuantity";
ALTER TABLE "inventory"."InventoryItem" DROP COLUMN IF EXISTS "quantityReserved";

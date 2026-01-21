/*
  Warnings:

  - You are about to drop the column `couponCode` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `couponDiscountAmount` on the `Transaction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "couponCode",
DROP COLUMN "couponDiscountAmount";

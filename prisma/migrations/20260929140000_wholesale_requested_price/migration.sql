-- Prix unitaire souhaité par le revendeur, par ligne. Additif et facultatif.

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "requestedUnitPrice" INTEGER;


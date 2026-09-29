-- Commandes en gros : type de commande, boutique, acompte. Additif : les commandes
-- existantes et celles du code actuel restent des commandes au détail (DETAIL).

-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('DETAIL', 'GROS');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "depositAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "depositNote" TEXT,
ADD COLUMN     "depositPaidAt" TIMESTAMP(3),
ADD COLUMN     "kind" "OrderKind" NOT NULL DEFAULT 'DETAIL';

-- CreateIndex
CREATE INDEX "Order_kind_createdAt_idx" ON "Order"("kind", "createdAt");


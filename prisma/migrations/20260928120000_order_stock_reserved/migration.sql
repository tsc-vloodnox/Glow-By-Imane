-- AlterTable
ALTER TABLE "Order" ADD COLUMN "stockReserved" BOOLEAN NOT NULL DEFAULT false;

-- Les commandes passées depuis la boutique ont décrémenté le stock à leur création.
-- Les commandes annulées n'ont jamais été restituées : on les laisse à false pour ne pas
-- recréditer rétroactivement un stock déjà corrigé à la main.
UPDATE "Order" SET "stockReserved" = true WHERE "source" = 'app' AND "status" <> 'ANNULEE';

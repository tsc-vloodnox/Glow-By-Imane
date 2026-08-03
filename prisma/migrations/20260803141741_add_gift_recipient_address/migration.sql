/*
  Warnings:

  - Added the required column `recipientAddress` to the `GiftCard` table without a default value.
    Backfillée avec '' pour les lignes existantes (cartes cadeau déjà créées avant ce champ) —
    à compléter manuellement depuis l'admin si nécessaire.
*/

-- AlterTable
ALTER TABLE "GiftCard" ADD COLUMN "recipientAddress" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "GiftCard" ALTER COLUMN "recipientAddress" DROP DEFAULT;

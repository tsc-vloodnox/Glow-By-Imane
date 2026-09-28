-- Slugs produit (URLs lisibles) ---------------------------------------------------

-- 1. Colonne ajoutée vide, remplie depuis le nom, puis rendue obligatoire
ALTER TABLE "Product" ADD COLUMN "slug" TEXT;

UPDATE "Product"
SET "slug" = left(
  trim(both '-' from regexp_replace(
    translate(replace(replace(lower("name"), 'œ', 'oe'), 'æ', 'ae'), 'àáâãäåāçèéêëēìíîïīñòóôõöøōùúûüūýÿ', 'aaaaaaaceeeeeiiiiinooooooouuuuuyy'),
    '[^a-z0-9]+', '-', 'g'
  )),
  80
);

-- Nom sans aucun caractère exploitable : on retombe sur l'id
UPDATE "Product" SET "slug" = "id" WHERE "slug" IS NULL OR "slug" = '';

-- Doublons : le plus ancien garde le slug, les autres reçoivent un suffixe tiré de leur id
WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "slug" ORDER BY "createdAt", "id") AS rn
  FROM "Product"
)
UPDATE "Product" p
SET "slug" = p."slug" || '-' || right(p."id", 6)
FROM ranked
WHERE ranked."id" = p."id" AND ranked.rn > 1;

ALTER TABLE "Product" ALTER COLUMN "slug" SET NOT NULL;

-- Valeur par défaut : rend la migration rétrocompatible. L'ancienne version du code
-- (qui ne connaît pas "slug") peut continuer à créer des produits si la migration est
-- appliquée avant le déploiement. La nouvelle version fournit toujours un vrai slug.
ALTER TABLE "Product" ALTER COLUMN "slug" SET DEFAULT ('produit-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10));

CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- Order.updatedAt ---------------------------------------------------------------

ALTER TABLE "Order" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Index (filtres et tris des pages admin, anti-spam, jointures) -------------------

CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_archived_createdAt_idx" ON "Product"("archived", "createdAt");
CREATE INDEX "ProductPromotion_productId_idx" ON "ProductPromotion"("productId");
CREATE INDEX "KitItem_productId_idx" ON "KitItem"("productId");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_phone_createdAt_idx" ON "Order"("phone", "createdAt");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX "OrderItem_productSizeId_idx" ON "OrderItem"("productSizeId");
CREATE INDEX "OrderItem_kitId_idx" ON "OrderItem"("kitId");
CREATE INDEX "Delivery_livreurId_idx" ON "Delivery"("livreurId");
CREATE INDEX "Delivery_scheduledAt_idx" ON "Delivery"("scheduledAt");

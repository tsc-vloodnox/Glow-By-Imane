-- Fiches clientes : nouveaux champs + rattachement des commandes existantes.
-- Additif et sans effet sur le code actuel (qui ne lit ni n'écrit ces champs).

ALTER TABLE "Customer" ADD COLUMN "businessName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "isReseller" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN "notes" TEXT;
ALTER TABLE "Customer" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Numéro normalisé comme normalizeGuineaPhone() : chiffres seuls, sans indicatif 224
-- ni 0 initial, puis préfixé par 224.
-- Une fiche par numéro, avec le nom et le quartier de la commande la plus récente.
WITH normalized AS (
  SELECT
    "name",
    "quartier",
    "createdAt",
    '224' || regexp_replace(regexp_replace(regexp_replace("phone", '\D', '', 'g'), '^224', ''), '^0+', '') AS norm
  FROM "Order"
),
latest AS (
  SELECT DISTINCT ON (norm) norm, "name", "quartier"
  FROM normalized
  ORDER BY norm, "createdAt" DESC
),
first_seen AS (
  SELECT norm, min("createdAt") AS first_at FROM normalized GROUP BY norm
)
INSERT INTO "Customer" ("id", "phone", "name", "quartier", "createdAt", "updatedAt")
SELECT 'cus_' || md5(latest.norm), latest.norm, latest."name", latest."quartier", first_seen.first_at, CURRENT_TIMESTAMP
FROM latest
JOIN first_seen ON first_seen.norm = latest.norm
ON CONFLICT ("phone") DO NOTHING;

UPDATE "Order" o
SET "customerId" = c."id"
FROM "Customer" c
WHERE o."customerId" IS NULL
  AND c."phone" = '224' || regexp_replace(regexp_replace(regexp_replace(o."phone", '\D', '', 'g'), '^224', ''), '^0+', '');

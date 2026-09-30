-- Livraisons : point de départ, quartiers de référence, réglages et tournées.
-- Additif : sans effet sur le code actuellement en ligne (nouveaux champs facultatifs / par défaut).

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('LIVRAISON', 'RETRAIT');

-- CreateEnum
CREATE TYPE "RunCostMode" AS ENUM ('CALCULE', 'FORFAIT');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PLANIFIEE', 'EN_COURS', 'TERMINEE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryFeeMax" INTEGER,
ADD COLUMN     "deliveryFeeMin" INTEGER,
ADD COLUMN     "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'LIVRAISON',
ADD COLUMN     "locationLat" DOUBLE PRECISION,
ADD COLUMN     "locationLng" DOUBLE PRECISION,
ADD COLUMN     "pickupPointId" TEXT,
ADD COLUMN     "quartierId" TEXT;

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "runId" TEXT;

-- CreateTable
CREATE TABLE "PickupPoint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quartier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "feeMin" INTEGER,
    "feeMax" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Quartier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliverySettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "baseFee" INTEGER NOT NULL DEFAULT 5000,
    "perKm" INTEGER NOT NULL DEFAULT 1000,
    "perExtraStop" INTEGER NOT NULL DEFAULT 1000,
    "includeReturn" BOOLEAN NOT NULL DEFAULT true,
    "roadFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.3,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliverySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRun" (
    "id" TEXT NOT NULL,
    "livreurId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PLANIFIEE',
    "costMode" "RunCostMode" NOT NULL DEFAULT 'CALCULE',
    "estimatedKm" DOUBLE PRECISION,
    "suggestedCost" INTEGER NOT NULL DEFAULT 0,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "settledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quartier_name_key" ON "Quartier"("name");

-- CreateIndex
CREATE INDEX "DeliveryRun_livreurId_date_idx" ON "DeliveryRun"("livreurId", "date");

-- CreateIndex
CREATE INDEX "DeliveryRun_settledAt_idx" ON "DeliveryRun"("settledAt");

-- CreateIndex
CREATE INDEX "Delivery_runId_idx" ON "Delivery"("runId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "Quartier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "PickupPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DeliveryRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRun" ADD CONSTRAINT "DeliveryRun_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "Livreur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Données initiales ───────────────────────────────────────────────────────

-- Point de départ : la boutique. Position à placer sur la carte dans l'admin (Livraisons → Réglages).
INSERT INTO "PickupPoint" ("id", "name", "isDefault", "active")
VALUES ('pp_boutique', 'Boutique Glow by Imane', true, true)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "DeliverySettings" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING;

-- Grands quartiers de Conakry. Coordonnées APPROXIMATIVES (à 1–2 km près), à ajuster en
-- déplaçant les points sur la carte admin. Fourchettes de frais vides : à renseigner
-- (ou « Suggérer » depuis l'admin une fois la boutique placée).
INSERT INTO "Quartier" ("id", "name", "commune", "lat", "lng", "position") VALUES
  ('q_kaloum-centre', 'Kaloum Centre', 'Kaloum', 9.5092, -13.7122, 0),
  ('q_boulbinet', 'Boulbinet', 'Kaloum', 9.5147, -13.719, 1),
  ('q_tombo', 'Tombo', 'Kaloum', 9.5268, -13.7047, 2),
  ('q_dixinn-centre', 'Dixinn Centre', 'Dixinn', 9.548, -13.678, 3),
  ('q_camayenne', 'Camayenne', 'Dixinn', 9.541, -13.688, 4),
  ('q_landreah', 'Landréah', 'Dixinn', 9.536, -13.693, 5),
  ('q_belle-vue', 'Belle-Vue', 'Dixinn', 9.552, -13.67, 6),
  ('q_matam-centre', 'Matam Centre', 'Matam', 9.556, -13.656, 7),
  ('q_madina', 'Madina', 'Matam', 9.554, -13.667, 8),
  ('q_bonfi', 'Bonfi', 'Matam', 9.564, -13.648, 9),
  ('q_hamdallaye', 'Hamdallaye', 'Ratoma', 9.573, -13.645, 10),
  ('q_taouyah', 'Taouyah', 'Ratoma', 9.585, -13.663, 11),
  ('q_kipe', 'Kipé', 'Ratoma', 9.604, -13.656, 12),
  ('q_ratoma-centre', 'Ratoma Centre', 'Ratoma', 9.623, -13.648, 13),
  ('q_kaporo', 'Kaporo', 'Ratoma', 9.63, -13.64, 14),
  ('q_nongo', 'Nongo', 'Ratoma', 9.642, -13.63, 15),
  ('q_lambanyi', 'Lambanyi', 'Ratoma', 9.645, -13.615, 16),
  ('q_koloma', 'Koloma', 'Ratoma', 9.62, -13.61, 17),
  ('q_cosa', 'Cosa', 'Ratoma', 9.603, -13.618, 18),
  ('q_sonfonia', 'Sonfonia', 'Ratoma', 9.662, -13.575, 19),
  ('q_kobaya', 'Kobaya', 'Ratoma', 9.67, -13.6, 20),
  ('q_matoto-centre', 'Matoto Centre', 'Matoto', 9.587, -13.612, 21),
  ('q_gbessia', 'Gbessia', 'Matoto', 9.576, -13.618, 22),
  ('q_yimbaya', 'Yimbaya', 'Matoto', 9.59, -13.595, 23),
  ('q_enta', 'Enta', 'Matoto', 9.605, -13.592, 24),
  ('q_sangoyah', 'Sangoyah', 'Matoto', 9.621, -13.57, 25),
  ('q_kagbelen', 'Kagbélen', 'Grand Conakry', 9.695, -13.53, 26),
  ('q_maneah', 'Manéah', 'Grand Conakry', 9.7, -13.46, 27),
  ('q_coyah', 'Coyah', 'Grand Conakry', 9.707, -13.387, 28),
  ('q_dubreka', 'Dubréka', 'Grand Conakry', 9.791, -13.523, 29)
ON CONFLICT ("name") DO NOTHING;

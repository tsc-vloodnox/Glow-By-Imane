import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
const bucketName = "catalogue";
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing Supabase env vars. Configure SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function ensureStorageBucket() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw listError;
  }

  const bucketExists = buckets.some((bucket) => bucket.name === bucketName);
  if (bucketExists) {
    console.log(`Bucket already exists: ${bucketName}`);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: true,
  });

  if (createError) {
    throw createError;
  }

  console.log(`Created public bucket: ${bucketName}`);
}

async function uploadCatalogueImages() {
  const catalogueDir = path.resolve(__dirname, "..", "public", "catalogue");
  const files = await fs.readdir(catalogueDir);

  for (const fileName of files) {
    const ext = path.extname(fileName).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext)) {
      continue;
    }

    const filePath = path.join(catalogueDir, fileName);
    const fileBuffer = await fs.readFile(filePath);

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, { upsert: true });

    if (error) {
      throw error;
    }

    console.log(`Uploaded image: ${fileName}`);
  }
}

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  await ensureStorageBucket();
  await uploadCatalogueImages();

  const categories = [
    { id: "gommages", name: "Gommages & Corps" },
    { id: "levres", name: "Soins Lèvres" },
    { id: "visage", name: "Masques & Visage" },
    { id: "poudres", name: "Poudres & Exfoliants" },
    { id: "savons", name: "Savons & Nettoyants" },
    { id: "cheveux", name: "Cheveux & Beauté" },
    { id: "accessoires", name: "Accessoires" },
  ];

  await prisma.category.createMany({ data: categories });

  const products = [
    {
      name: "Serviette de Gommage Éclat",
      description: "Douceur enveloppante pour un gommage parfait.",
      price: 90000,
      stock: 10,
      images: ["serviette_gommage_01.png", "serviette_gommage_02.png"],
      categoryId: "gommages",
    },
    {
      name: "Gant de Gommage Élégance +",
      description: "Action exfoliante délicate pour une peau soyeuse.",
      price: 20000,
      stock: 12,
      images: ["gant_gommage_plus_01.png", "gant_gommage_plus_02.png"],
      categoryId: "gommages",
    },
    {
      name: "Gant de Gommage Luxe ++",
      description: "Texture luxueuse pour un exfoliant professionnel.",
      price: 20000,
      stock: 12,
      images: [
        "gant_gommage_plusplus_01.png",
        "gant_gommage_plusplus_02.png",
        "gant_gommage_plusplus_03.png",
      ],
      categoryId: "gommages",
    },
    {
      name: "Masque Éclat Visage",
      description: "Masque visage illuminant à base d’ingrédients naturels.",
      price: 12500,
      stock: 14,
      images: ["masque_eclat_visage_01.png", "masque_eclat_visage_02.png"],
      categoryId: "visage",
    },
    {
      name: "Crème Lèvres Rosées",
      description: "Hydratation intense et délicate teinte rosée.",
      price: 30000,
      stock: 18,
      images: [
        "creme_levres_rosees_01.png",
        "creme_levres_rosees_02.png",
        "creme_levres_rosees_03.png",
      ],
      categoryId: "levres",
    },
    {
      name: "Kit Lèvres Méga",
      description: "Soin complet pour des lèvres pulpeuses et gourmandes.",
      price: 100000,
      stock: 8,
      images: [
        "kit_levres_mega_01.png",
        "kit_levres_mega_02.png",
        "kit_levres_mega_03.png",
      ],
      categoryId: "levres",
    },
    {
      name: "Kit Lèvres Moyen",
      description: "Formule essentielle pour des lèvres douces et nourries.",
      price: 85000,
      stock: 10,
      images: [
        "kit_levres_moyen_01.png",
        "kit_levres_moyen_02.png",
        "kit_levres_moyen_03.png",
      ],
      categoryId: "levres",
    },
    {
      name: "Kit Lèvres Découverte",
      description: "Mini routine lèvres pour découvrir l’univers Glow.",
      price: 80000,
      stock: 11,
      images: ["kit_levres_decouverte_01.png"],
      categoryId: "levres",
    },
    {
      name: "Gommage Lèvres Douceur",
      description: "Exfolie en douceur et prépare aux soins lèvres.",
      price: 5000,
      stock: 22,
      images: ["gommage_levres_douceur_01.png"],
      categoryId: "levres",
    },
    {
      name: "Masque Lèvres Repulpant",
      description: "Répare, repulpe et sublime le sourire.",
      price: 10000,
      stock: 20,
      images: [
        "masque_levres_repulpant_01.png",
        "masque_levres_repulpant_02.png",
        "masque_levres_repulpant_03.png",
      ],
      categoryId: "levres",
    },
    {
      name: "Brosse Lèvres Satin",
      description: "Application douce et précise des soins lèvres.",
      price: 12500,
      stock: 15,
      images: ["brosse_levres_01.png", "brosse_levres_02.png"],
      categoryId: "levres",
    },
    {
      name: "Masque Anti-Cernes Lumière",
      description: "Atténue les poches et illumine le regard.",
      price: 10000,
      stock: 17,
      images: [
        "masque_anti_cernes_01.png",
        "masque_anti_cernes_02.png",
        "masque_anti_cernes_03.png",
      ],
      categoryId: "visage",
    },
    {
      name: "Poudre Pierre Jaune Purifiante",
      description: "Poudre fine pour un exfoliant naturel et doux.",
      price: 70000,
      stock: 9,
      images: ["poudre_pierre_jaune_01.png"],
      categoryId: "poudres",
    },
    {
      name: "Graines de Chia Beauté",
      description: "Booster hydratant et nutritif pour une peau lumineuse.",
      price: 85000,
      stock: 12,
      images: ["graines_chia_01.png", "graines_chia_02.png"],
      categoryId: "poudres",
    },
    {
      name: "Savon Noir du Nigeria",
      description: "Nettoyant traditionnel riche et purifiant.",
      price: 120000,
      stock: 7,
      images: ["savon_noir_nigeria_01.png"],
      categoryId: "savons",
    },
    {
      name: "Savon Molato",
      description: "Savon authentique pour une peau douce et fraîche.",
      price: 120000,
      stock: 7,
      images: ["savon_molato_01.png"],
      categoryId: "savons",
    },
    {
      name: "Savon Nila",
      description: "Senteur délicate et nettoyage en profondeur.",
      price: 120000,
      stock: 7,
      images: ["savon_nila_01.png"],
      categoryId: "savons",
    },
    {
      name: "Bande Adhésive Perruque Discrète",
      description: "Maintien invisible pour une coiffure parfaite.",
      price: 12000,
      stock: 20,
      images: ["bande_perruque_01.png"],
      categoryId: "cheveux",
    },
    {
      name: "Bandeau Doux",
      description: "Accessoire confortable pour protéger vos cheveux.",
      price: 25000,
      stock: 18,
      images: ["bandeau_01.png", "bandeau_02.png"],
      categoryId: "cheveux",
    },
    {
      name: "Bandes de Coiffure Élégantes",
      description: "Finitions propres et style maîtrisé.",
      price: 25000,
      stock: 16,
      images: [
        "bandes_coiffure_01.png",
        "bandes_coiffure_02.png",
        "bandes_coiffure_03.png",
      ],
      categoryId: "cheveux",
    },
    {
      name: "Gaine Sculptante Visage",
      description: "Soutien sculptant pour une silhouette visage raffinée.",
      price: 75000,
      stock: 14,
      images: [
        "gaine_sculptante_visage_01.png",
        "gaine_sculptante_visage_02.png",
        "gaine_sculptante_visage_03.png",
      ],
      categoryId: "visage",
    },
    {
      name: "Dermaroller de Précision",
      description: "Précision et douceur pour un soin anti-âge.",
      price: 60000,
      stock: 10,
      images: ["dermaroller_01.png", "dermaroller_02.png", "dermaroller_03.png"],
      categoryId: "visage",
    },
    {
      name: "Sérum Retin A 24K",
      description: "Sérum nocturne régénérant à l’éclat doré.",
      price: 60000,
      stock: 12,
      images: ["serum_retin_a24k_01.png", "serum_retin_a24k_02.png"],
      categoryId: "visage",
    },
    {
      name: "Trétinoïne Tonic",
      description: "Soin ciblé contre imperfections et teint terne.",
      price: 150000,
      stock: 8,
      images: ["tretinoine_01.png"],
      categoryId: "visage",
    },
    {
      name: "Sac Frida Kahlo",
      description: "Style artisanal et design audacieux.",
      price: 115000,
      stock: 6,
      images: ["sac_frida_kahlo_01.png"],
      categoryId: "accessoires",
    },
    {
      name: "Sac Lacoste",
      description: "Élégance urbaine et finition soignée.",
      price: 220000,
      stock: 5,
      images: ["sac_lacoste_01.png", "sac_lacoste_02.png"],
      categoryId: "accessoires",
    },
    {
      name: "Pack Minoxidil Cure Complète",
      description: "Cure complète pour des cheveux plus denses et forts.",
      price: 350000,
      stock: 7,
      images: ["pack_minoxidil_01.png", "pack_minoxidil_02.png"],
      categoryId: "cheveux",
    },
    {
      name: "Minoxidil Unitaire",
      description: "Traitement ciblé pour une repousse optimisée.",
      price: 300000,
      stock: 10,
      images: ["minoxidil_01.png"],
      categoryId: "cheveux",
    },
    {
      name: "Collection Kiran Élégance",
      description: "Ensemble couture pour soins et style.",
      price: 100000,
      stock: 4,
      images: [
        "collection_kiran_01.png",
        "collection_kiran_02.png",
        "collection_kiran_03.png",
        "collection_kiran_04.png",
        "collection_kiran_05.png",
        "collection_kiran_06.png",
        "collection_kiran_07.png",
        "collection_kiran_08.png",
        "collection_kiran_09.png",
        "collection_kiran_10.png",
      ],
      categoryId: "accessoires",
    },
    {
      name: "Crème Solaire Lacura",
      description: "Protection solaire légère et confortable.",
      price: 120000,
      stock: 9,
      images: [
        "creme_solaire_lacura_01.png",
        "creme_solaire_lacura_02.png",
        "creme_solaire_lacura_03.png",
      ],
      categoryId: "visage",
    },
    {
      name: "Baume Lèvres Fondant",
      description: "Lèvres douces et veloutées en un geste.",
      price: 10000,
      stock: 20,
      images: ["baume_levres_fondant_01.png"],
      categoryId: "levres",
    },
    {
      name: "Gommage Lèvres Café",
      description: "Exfoliation parfum café pour lèvres gourmandes.",
      price: 30000,
      stock: 14,
      images: ["gommage_levres_cafe_01.png", "gommage_levres_cafe_02.png"],
      categoryId: "levres",
    },
    {
      name: "Lame à Épiler de Précision",
      description: "Précision nette pour des contours parfaits.",
      price: 25000,
      stock: 16,
      images: [
        "lame_epiler_01.png",
        "lame_epiler_02.png",
        "lame_epiler_03.png",
      ],
      categoryId: "accessoires",
    },
    {
      name: "Brosse Moussante Éclat",
      description: "Mousse délicate pour un nettoyage purifiant.",
      price: 60000,
      stock: 12,
      images: ["brosse_moussante_01.png", "brosse_moussante_02.png"],
      categoryId: "visage",
    },
    {
      name: "Gommage Visage & Corps",
      description: "Texture onctueuse pour un nettoyage revitalisant.",
      price: 70000,
      stock: 13,
      images: [
        "Gommage_visage_&_corps_01.png",
        "Gommage_visage_&_corps_02.png",
        "Gommage_visage_&_corps_03.png",
        "Gommage_visage_&_corps_04.png",
      ],
      categoryId: "gommages",
    },
    {
      name: "Crème Solaire Sublime",
      description: "Barrière solaire et confort toute la journée.",
      price: 65000,
      stock: 11,
      images: [
        "Creme_solaire_01.png",
        "Creme_solaire_02.png",
        "Creme_solaire_03.png",
      ],
      categoryId: "visage",
    },
    {
      name: "Support Adhésif Téléphone",
      description: "Maintien pratique pour smartphone et mains libres.",
      price: 20000,
      stock: 18,
      images: [
        "support_adhesif_telephone_01.png",
        "support_adhesif_telephone_02.png",
        "support_adhesif_telephone_03.png",
      ],
      categoryId: "accessoires",
    },
    {
      name: "Aiguilles Anti-Acné",
      description: "Soin ciblé pour une peau claire et lisse.",
      price: 20000,
      stock: 14,
      images: [
        "acne_needle_01.png",
        "acne_needle_02.png",
        "acne_needle_03.png",
      ],
      categoryId: "visage",
    },
    {
      name: "Brosse à Cheveux Bébé",
      description: "Respecte le cuir chevelu sensible des tout-petits.",
      price: 25000,
      stock: 15,
      images: ["brosse_baby_hair_01.png"],
      categoryId: "cheveux",
    },
    {
      name: "Vitamine C Éclat",
      description: "Sérum vitamine pour un teint éclatant et lumineux.",
      price: 60000,
      stock: 12,
      images: [
        "vitamine_c_01.png",
        "vitamine_c_02.png",
        "vitamine_c_03.png",
        "vitamine_c_04.png",
        "vitamine_c_05.png",
        "vitamine_c_06.png",
        "vitamine_c_07.png",
      ],
      categoryId: "visage",
    },
  ];

  await prisma.product.createMany({ data: products });
  console.log(`Seed terminé : ${categories.length} catégories et ${products.length} produits créés.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

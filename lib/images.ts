// Destination : lib/images.ts

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");

/**
 * Résout l'URL publique Supabase Storage d'une image du catalogue.
 * Retourne null si aucun nom d'image n'est fourni — à charge du composant
 * appelant d'afficher un état de remplacement (voir ProductImage.tsx).
 */
export function catalogPath(imageName: string | undefined | null): string | null {
  if (!imageName) {
    return null;
  }

  if (imageName.startsWith("http")) {
    return imageName;
  }

  const encodedName = encodeURIComponent(imageName);
  return `${supabaseUrl}/storage/v1/object/public/catalogue/${encodedName}`;
}

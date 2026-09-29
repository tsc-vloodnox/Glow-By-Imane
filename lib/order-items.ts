// Destination : lib/order-items.ts

type LabelledItem = {
  kit?: { name: string } | null;
  product?: { name: string } | null;
  productSize?: { label: string } | null;
};

/** Libellé d'une ligne de commande : kit, ou produit (+ taille). */
export function orderItemLabel(item: LabelledItem): string {
  if (item.kit) return `${item.kit.name} (kit)`;
  if (!item.product) return "Produit supprimé";
  return item.productSize ? `${item.product.name} — ${item.productSize.label}` : item.product.name;
}

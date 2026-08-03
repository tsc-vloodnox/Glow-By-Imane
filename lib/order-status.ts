// lib/order-status.ts
// Config centralisée des statuts — utilisée dans commandes + livraisons

export const ORDER_STATUS_CONFIG = {
  NOUVELLE: {
    label: "Nouvelle",
    color: "bg-blue-100 text-blue-700",
    next: ["DISCUSSION_WHATSAPP", "ANNULEE"],
  },
  DISCUSSION_WHATSAPP: {
    label: "Discussion WhatsApp",
    color: "bg-yellow-100 text-yellow-700",
    next: ["CONFIRMEE", "ANNULEE"],
  },
  CONFIRMEE: {
    label: "Confirmée",
    color: "bg-emerald-100 text-emerald-700",
    next: ["PREPARATION", "ANNULEE"],
  },
  PREPARATION: {
    label: "Préparation",
    color: "bg-orange-100 text-orange-700",
    next: ["EN_LIVRAISON", "ANNULEE"],
  },
  EN_LIVRAISON: {
    label: "En livraison",
    color: "bg-purple-100 text-purple-700",
    next: ["LIVREE", "ANNULEE"],
  },
  LIVREE: {
    label: "Livrée",
    color: "bg-green-100 text-green-700",
    next: [],
  },
  ANNULEE: {
    label: "Annulée",
    color: "bg-gray-100 text-gray-500",
    next: [],
  },
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS_CONFIG;

export const DELIVERY_STATUS_CONFIG = {
  PLANIFIEE: { label: "Planifiée", color: "bg-blue-100 text-blue-700" },
  EN_COURS: { label: "En cours", color: "bg-purple-100 text-purple-700" },
  LIVREE: { label: "Livrée", color: "bg-green-100 text-green-700" },
  ECHOUEE: { label: "Échouée", color: "bg-red-100 text-red-700" },
  REPORTEE: { label: "Reportée", color: "bg-yellow-100 text-yellow-700" },
} as const;

export type DeliveryStatus = keyof typeof DELIVERY_STATUS_CONFIG;

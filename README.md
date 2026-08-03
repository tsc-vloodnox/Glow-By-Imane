# Glow by Imane 🌸

Application e-commerce de beauté et accessoires ciblant le marché guinéen, avec un panneau d'administration complet. Les prix sont exprimés en **GNF (Franc Guinéen)**.

> **Philosophie** : le site n'est pas une boutique automatisée. Il agit comme un assistant de vente numérique — découverte des produits, prise de commande simplifiée, confirmation et suivi via WhatsApp. La technologie renforce la relation humaine, elle ne la remplace pas.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 16 (App Router) |
| Base de données | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth admin | Cookie HMAC-SHA256 signé (sans Supabase Auth) |
| Stockage images | Supabase Storage (bucket `catalogue`) |
| Temps réel | Supabase Realtime (`postgres_changes` sur `Order`) |
| Styles | Tailwind CSS + variables CSS custom + shadcn/ui |
| Notifications | Web Push (VAPID) + service worker |
| Déploiement | Vercel (domaine : glowbyimane.com) |

---

## Variables d'environnement

Créer un fichier `.env.local` à la racine :

```env
# Base de données
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Auth admin
ADMIN_PHONE=620000000
ADMIN_PASSWORD=ton_mot_de_passe
ADMIN_SECRET=chaine_aleatoire_32_chars   # générer avec : openssl rand -hex 32

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://xxx.supabase.co/storage/v1/object/public/catalogue

# WhatsApp (numéro vendeur, format international sans +)
WHATSAPP_VENDOR_NUMBER=224XXXXXXXXX

# Web Push (générer avec : npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

---

## Installation

```bash
pnpm install

# Composants shadcn/ui utilisés
npx shadcn@latest add skeleton

# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate deploy

# Lancer en développement
pnpm dev
```

---

## Structure du projet

```
app/
├── (shop)/                       # Boutique publique
│   ├── layout.tsx                # CartProvider + header/nav + CartFloatingButton
│   ├── page.tsx                  # Page unique shop : hero + catalogue complet
│   ├── loading.tsx               # Skeleton pendant le fetch Prisma
│   ├── CartContext.tsx           # Context panier partagé (remplace les évènements custom)
│   ├── actions.ts                # createOrder, refreshCartPrices
│   ├── panier/
│   │   ├── page.tsx
│   │   └── CartPageClient.tsx    # Stepper +/− borné au stock réel de chaque article
│   ├── commande/
│   │   ├── page.tsx
│   │   └── CheckoutPageClient.tsx # Revalidation des prix serveur au montage
│   ├── produits/
│   │   └── [slug]/
│   │       ├── page.tsx          # Fiche produit (findUnique par id)
│   │       └── loading.tsx       # Skeleton pendant le fetch
│   └── components/
│       ├── ShopPageClient.tsx    # Hero + barre sticky + grille groupée par catégorie
│       ├── ShopSearchFilterBar.tsx # Row unique : bouton filtre (dépliable) + recherche
│       ├── ProductCard.tsx       # Carte produit avec badge stock adaptatif + remise
│       ├── PriceDisplay.tsx      # Prix actuel + prix barré + badge % remise
│       ├── ProductImage.tsx      # Image avec skeleton shadcn pendant le chargement
│       ├── ProductGallery.tsx    # Galerie swipeable, scroll-snap-stop: always
│       ├── ProductAddToCart.tsx  # Stepper quantité + bouton ajout (fiche produit)
│       ├── AddToCartButton.tsx   # Ajout rapide (quantité 1, feedback 2s)
│       └── CartFloatingButton.tsx # Badge panier flottant, branché sur CartContext
│
└── admin/
    ├── layout.tsx                # Sidebar desktop + AdminMobileNav
    ├── login/                    # Authentification admin
    ├── dashboard/                # Vue d'ensemble
    ├── produits/                 # Gestion produits
    │   ├── new/
    │   └── [id]/
    ├── categories/               # CRUD catégories (création, renommage inline, suppression)
    ├── commandes/                # Gestion commandes
    │   ├── new/                  # Saisie manuelle (WhatsApp / hors-app)
    │   └── [id]/
    ├── livraisons/               # Suivi livraisons par jour et quartier
    ├── livreurs/                 # Gestion des livreurs
    └── kits/                     # Gestion des kits / bundles

lib/
├── admin-auth.ts                 # Auth HMAC : génération et vérification de token
├── cart.ts                       # Logique panier localStorage (CartItem inclut stock)
├── images.ts                     # catalogPath() — résolution URL Supabase Storage
├── order-status.ts               # Config centralisée des statuts (labels, couleurs, transitions)
├── pricing.ts                    # getDiscountPercent() — calcul remises produit/kit
├── prisma.ts                     # Client Prisma singleton
├── push.ts                       # Envoi notifications Web Push (admin)
├── whatsapp.ts                   # normalizeGuineaPhone() + buildWhatsAppUrl() — liens wa.me,
│                                  # buildOrderMessage() — génération message de commande pré-rempli
└── supabase/
    ├── client.ts                 # Client navigateur (anon key)
    └── server.ts                 # Client serveur (service role)

proxy.ts                          # Protection routes /admin/* (vérification token HMAC)
                                  # ⚠️ Next.js 16 : renommé de middleware.ts → proxy.ts
public/
├── sw.js                         # Service worker Web Push
├── og-image.jpg                  # Image Open Graph (1200×630)
├── favicon-32x32.png
├── favicon-16x16.png
├── apple-touch-icon.png
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-512-maskable.png

app/
├── sitemap.ts                    # Sitemap dynamique (servi sur /sitemap.xml)
├── robots.ts                     # Robots.txt (bloque /admin/ et /api/)
└── manifest.ts                   # Web App Manifest (PWA)

types.ts                          # Types TypeScript partagés
```

---

## Modèle de données

### Entités principales

**`Product`** — Produits du catalogue avec soft delete (`archived`) et support remises (`originalPrice`). Les produits ayant des commandes passées sont archivés plutôt que supprimés pour préserver l'historique.

**`ProductSize`** — Déclinaisons de contenance/taille (30ml, 50ml...) avec prix et stock propres.

**`ProductPackPrice`** — Paliers de prix par quantité (1 à X GNF, 3 à Y GNF...).

**`Kit`** — Bundle de produits avec prix fixe et support remises (`originalPrice`).

**`Order`** — Commandes avec workflow de statut, support de remises (`discountAmount`, `discountReason`, `finalTotal`) et traçabilité de la source (`app` / `whatsapp` / `admin`).

**`Delivery`** — Entité logistique séparée de la commande. Contient la date planifiée, le statut, le livreur assigné et les frais de livraison convenus (`deliveryFee`).

**`Customer`** — Profil client avec points de fidélité et statut VIP.

### Workflow commande

```
NOUVELLE → DISCUSSION_WHATSAPP → CONFIRMEE → PREPARATION → EN_LIVRAISON → LIVREE
         ↘                     ↘           ↘             ↘              ↘
           ANNULEE               ANNULEE     ANNULEE        ANNULEE        ANNULEE
```

### Workflow livraison

```
PLANIFIEE → EN_COURS → LIVREE
          ↘          ↘
            REPORTEE   ECHOUEE
```

Statuts et déclencheurs propres à la livraison, mais **pas totalement indépendants** :
quand une livraison passe à `LIVREE`, le statut de la commande associée est automatiquement
mis à jour vers `LIVREE` (`updateDeliveryStatus` dans `app/admin/actions.ts`) — évite d'avoir
à mettre à jour les deux statuts séparément.

---

## Parcours client

```
Accueil/Shop (hero + catalogue groupé) → Fiche produit → Panier → Commande → WhatsApp
```

Aucun compte requis. Le client renseigne nom, téléphone et quartier au moment de la commande. La commande est enregistrée en base, puis le client est redirigé vers WhatsApp avec un message pré-rempli contenant le détail complet (`buildOrderMessage` dans `lib/whatsapp.ts`).

### Panier client (`lib/cart.ts`)

- Stocké en `localStorage`, accessible via `CartContext` (Provider dans `(shop)/layout.tsx`)
- Chaque `CartItem` inclut le champ `stock` capturé au moment de l'ajout — le stepper de quantité est borné côté UI sans appel serveur supplémentaire
- La page `/commande` revalide les prix côté serveur au montage (`refreshCartPrices`) et affiche un bandeau si un prix a changé depuis l'ajout au panier
- Le stock est décrémenté de façon **atomique** au moment de `createOrder` (`updateMany` conditionnel) — deux commandes simultanées sur le même produit ne peuvent pas survendre

### Remises produit (`lib/pricing.ts`)

- `originalPrice` (nullable) sur `Product` et `Kit` — présence = remise active, absence = pas de remise
- `getDiscountPercent(price, originalPrice)` calcule le % affiché automatiquement
- `PriceDisplay` centralise l'affichage (prix actuel + prix barré + badge `-X%`) utilisé sur les cartes et les fiches produit

---

## Panneau d'administration

### Auth (`/admin/login`)

- Cookie `HttpOnly; Secure` posé par Server Action — le mot de passe ne transite jamais vers le navigateur
- Token signé HMAC-SHA256 avec `ADMIN_SECRET`, expiration 8h
- `proxy.ts` vérifie la signature à chaque requête `/admin/*` (Next.js 16 — anciennement `middleware.ts`)

### Catégories (`/admin/categories`)

- Création rapide avec validation Enter
- Renommage **inline** (clic → champ en place, Enter pour sauvegarder, Escape pour annuler)
- Suppression bloquée si des produits actifs sont rattachés à la catégorie

### Produits (`/admin/produits`)

- Édition inline avec détection de modifications non sauvegardées
- Recherche texte + filtre par catégorie + filtre par stock (rupture / bas / tous)
- Gestion d'images : miniatures, réordonner, supprimer, upload multiple vers Supabase Storage
- Champ `originalPrice` pour activer un prix barré côté boutique
- **Soft delete** : archivage au lieu de suppression pour les produits commandés
- Suppression définitive uniquement si aucune commande associée

### Commandes (`/admin/commandes`)

- Filtrage par statut avec compteurs
- **Saisie manuelle** (`/new`) pour les commandes WhatsApp ou hors-application
- Page de détail avec changement de statut (transitions autorisées uniquement, validées côté serveur dans `updateOrderStatus`)
- **Remise** : montant + raison, aperçu du total final en temps réel
- **Suppression en masse** avec double confirmation
- Temps réel via Supabase Realtime : nouvelle commande → toast admin + Web Push

### Livraisons (`/admin/livraisons`)

- Vue groupée par **jour** puis par **quartier**
- Bouton "Marquer livrée" en un clic depuis la liste
- **Frais de livraison** convenus après discussion (ajoutés au total à encaisser)
- **Copie liste livreur** : génère un message WhatsApp formaté par quartier
- Lien WhatsApp de notification client pré-rempli depuis la page de détail

---

## SEO & PWA

- Métadonnées globales + `generateMetadata` dynamique par fiche produit
- Sitemap dynamique (`/sitemap.xml`) incluant toutes les fiches produit non archivées
- `robots.txt` bloquant `/admin/` et `/api/`
- Web App Manifest (`manifest.webmanifest`) — installable sur mobile/desktop
- Site indexé sur Google Search Console (domaine vérifié via enregistrement TXT OVH)

---

## Intégration WhatsApp

L'application n'utilise pas l'API WhatsApp — elle génère des **liens `wa.me` pré-remplis** :

| Usage | Déclencheur |
|---|---|
| Confirmation de commande | Client après validation du formulaire |
| Notification de livraison | Admin depuis la page de détail livraison |
| Liste journalière livreur | Admin depuis la vue livraisons du jour |
| Contact direct client | Admin depuis la liste des commandes |

> WhatsApp reste le canal de communication, l'app est le registre.

---

## Migrations Prisma

```bash
# Créer une nouvelle migration (développement)
npx prisma migrate dev --name nom_de_la_migration

# ⚠️ Pour les colonnes NOT NULL sur tables existantes :
# utiliser --create-only, ajouter DEFAULT now() dans le SQL généré,
# puis npx prisma migrate dev pour appliquer

# Appliquer en production
npx prisma migrate deploy

# Ouvrir Prisma Studio
npx prisma studio
```

---

## Conventions de code

- **Server Actions** pour toutes les mutations (`"use server"`)
- `requireAdmin()` appelé en première ligne de chaque action et page admin
- Types Prisma composés centralisés dans `types.ts`
- Statuts et transitions dans `lib/order-status.ts` — ne pas dupliquer ailleurs
- Images référencées par nom de fichier uniquement en base, URL construite via `catalogPath()` dans `lib/images.ts`
- Le `CartContext` est la seule source de vérité pour l'état du panier côté client — ne pas appeler `lib/cart.ts` directement depuis les composants, passer par `useCart()`
- Remises : passer par `getDiscountPercent()` de `lib/pricing.ts`, afficher via `<PriceDisplay />`

---

## Prochaine étape — Meta Pixel

Intégration prévue via `next/script` dans `app/layout.tsx` (strategy `afterInteractive`).

Événements à tracker :

| Événement | Déclencheur |
|---|---|
| `PageView` | Automatique sur toutes les pages |
| `ViewContent` | Montage de la fiche produit |
| `AddToCart` | `addItem()` dans `CartContext` |
| `Lead` | Redirection WhatsApp après `createOrder` |

> `Lead` est l'équivalent de `Purchase` pour ce projet — le paiement se faisant à la livraison hors app, la redirection WhatsApp est le signal de conversion le plus fiable.

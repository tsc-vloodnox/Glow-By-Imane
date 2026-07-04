# Glow by Imane 🌸

Application e-commerce de beauté et accessoires ciblant le marché guinéen, avec un panneau d'administration complet. Les prix sont exprimés en **GNF (Franc Guinéen)**.

> **Philosophie** : le site n'est pas une boutique automatisée. Il agit comme un assistant de vente numérique — découverte des produits, prise de commande simplifiée, confirmation et suivi via WhatsApp. La technologie renforce la relation humaine, elle ne la remplace pas.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 15 (App Router) |
| Base de données | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth admin | Cookie HMAC-SHA256 signé (sans Supabase Auth) |
| Stockage images | Supabase Storage (bucket `catalogue`) |
| Temps réel | Supabase Realtime (`postgres_changes` sur `Order`) |
| Styles | Tailwind CSS + variables CSS custom + shadcn/ui |
| Notifications | Web Push (VAPID) + service worker |
| Déploiement | Vercel |

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

# Générer le client Prisma (à refaire après chaque migration de schéma)
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
│   ├── actions.ts                # createOrder, refreshCartPrices, updateOrderStatus
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
│       ├── ProductCard.tsx       # Carte produit avec badge stock adaptatif
│       ├── ProductImage.tsx      # Image avec skeleton shadcn pendant le chargement
│       ├── ProductGallery.tsx    # Galerie swipeable, scroll-snap-stop: always
│       ├── ProductAddToCart.tsx  # Stepper quantité + bouton ajout (fiche produit)
│       ├── AddToCartButton.tsx   # Ajout rapide (quantité 1, feedback 2s)
│       └── CartFloatingButton.tsx # Badge panier flottant, branché sur CartContext
│
└── (admin)/
    └── admin/
        ├── actions.ts             # Toutes les Server Actions admin (produits, kits, livraisons, livreurs)
        ├── login/                 # Authentification admin
        ├── dashboard/             # Vue d'ensemble : commandes, produits, kits, livraisons en attente, stock bas
        ├── produits/               # Gestion produits
        │   ├── AdminProductsTable.tsx  # Liste + édition inline (nom, prix, stock, tailles, paliers, images)
        │   ├── ProductForm.tsx         # Formulaire dédié (création + édition complète)
        │   ├── upload.ts               # uploadProductImage() — upload vers Supabase Storage, réutilisé par kits
        │   ├── new/
        │   └── [id]/edit/
        ├── kits/                   # Gestion des kits (bundles)
        │   ├── AdminKitsTable.tsx      # Liste + édition inline + sélecteur d'articles
        │   ├── KitForm.tsx             # Formulaire dédié (création + édition complète)
        │   ├── new/
        │   └── [id]/edit/
        ├── commandes/              # Gestion commandes
        │   ├── new/                # Saisie manuelle (WhatsApp / hors-app)
        │   └── [id]/
        ├── livraisons/             # Suivi livraisons par jour et quartier
        │   └── LivraisonsBoard.tsx # Vue groupée + sélection multiple + attribution livreur
        └── livreurs/               # Registre des livreurs
            └── AdminLivreursTable.tsx # Liste éditable + activer/désactiver

lib/
├── admin-auth.ts                 # Auth HMAC : génération et vérification de token
├── cart.ts                       # Logique panier localStorage (CartItem inclut stock)
├── images.ts                     # catalogPath() — résolution URL Supabase Storage
├── order-status.ts               # Config centralisée des statuts (labels, couleurs, transitions)
├── prisma.ts                     # Client Prisma singleton
├── push.ts                       # Envoi notifications Web Push (admin)
├── whatsapp.ts                   # buildOrderMessage() — génération lien wa.me pré-rempli
└── supabase/
    ├── client.ts                 # Client navigateur (anon key)
    └── server.ts                 # Client serveur (service role)

middleware.ts                     # Protection routes /admin/* (vérification token HMAC)
public/
└── sw.js                         # Service worker Web Push
types.ts                          # Types TypeScript partagés
```

---

## Modèle de données

### Entités principales

**`Product`** — Produits du catalogue avec soft delete (`archived`). Les produits ayant des commandes passées sont archivés plutôt que supprimés pour préserver l'historique. Le prix/stock du produit sert de **valeur par défaut** ; un produit peut en plus avoir :
- **`ProductSize`** — déclinaisons (tailles/contenances), chacune avec son propre prix et stock.
- **`ProductPackPrice`** — paliers de quantité (ex : 3 pour 100 000 GNF), rattachés soit au produit entier, soit à une taille précise.

**`Kit`** — Bundles à prix fixe (indépendant de la somme des articles), composés de **`KitItem`** (produit + taille optionnelle + quantité). Même logique de soft delete que `Product`.

**`Order`** — Commandes avec workflow de statut, support de remises (`discountAmount`, `discountReason`, `finalTotal`) et traçabilité de la source (`app` / `whatsapp` / `admin`).

**`Delivery`** — Entité logistique séparée de la commande. Contient la date planifiée, le statut de livraison, un **livreur assigné** (relation vers `Livreur`, plus une simple chaîne de texte) et les frais de livraison convenus (`deliveryFee`).

**`Livreur`** — Registre des livreurs (nom, téléphone, actif/inactif). Une livraison peut être attribuée à un livreur individuellement ou en lot depuis `/admin/livraisons`.

**`Customer`** — Profil client avec points de fidélité et statut VIP.

### Workflow commande

```
NOUVELLE → DISCUSSION_WHATSAPP → CONFIRMEE → PREPARATION → EN_LIVRAISON → LIVREE
         ↘                     ↘           ↘             ↘              ↘
           ANNULEE               ANNULEE     ANNULEE        ANNULEE        ANNULEE
```

### Workflow livraison (indépendant du workflow commande)

```
PLANIFIEE → EN_COURS → LIVREE
          ↘          ↘
            REPORTEE   ECHOUEE
```

---

## Parcours client

```
Accueil/Shop (hero + catalogue) → Fiche produit → Panier → Commande → WhatsApp
```

Aucun compte requis. Le client renseigne nom, téléphone et quartier au moment de la commande. La commande est enregistrée en base, puis le client est redirigé vers WhatsApp avec un message pré-rempli contenant le détail complet (`buildOrderMessage` dans `lib/whatsapp.ts`).

### Panier client (`lib/cart.ts`)

- Stocké en `localStorage`, accessible via `CartContext` (Provider dans `(shop)/layout.tsx`)
- Chaque `CartItem` inclut le champ `stock` capturé au moment de l'ajout — le stepper de quantité est borné côté UI sans appel serveur supplémentaire
- La page `/commande` revalide les prix côté serveur au montage (`refreshCartPrices`) et affiche un bandeau si un prix a changé depuis l'ajout au panier
- Le stock est décrémenté de façon **atomique** au moment de `createOrder` (`updateMany` conditionnel) — deux commandes simultanées sur le même produit ne peuvent pas survendre

---

## Panneau d'administration

### Auth (`/admin/login`)

- Cookie `HttpOnly; Secure` posé par Server Action — le mot de passe ne transite jamais vers le navigateur
- Token signé HMAC-SHA256 avec `ADMIN_SECRET`, expiration 8h
- Middleware vérifie la signature à chaque requête `/admin/*`

### Produits (`/admin/produits`)

- Édition inline avec détection de modifications non sauvegardées
- Recherche texte + filtre par catégorie + filtre par stock (rupture / bas / tous)
- **Tailles & Tarifs** : section repliable par produit — déclinaisons (taille, prix, stock) et paliers de quantité (avec choix "produit entier" ou une taille précise)
- Gestion d'images : miniatures, réordonner, supprimer, upload multiple vers Supabase Storage
- **Soft delete** : archivage au lieu de suppression pour les produits commandés ; une taille supprimée mais déjà commandée est archivée plutôt que supprimée (même logique)
- Suppression définitive uniquement si aucune commande associée
- `/admin/produits/new` et `/admin/produits/[id]/edit` : formulaire dédié (`ProductForm`) avec la même gestion tailles/paliers/images, en plein écran

### Kits (`/admin/kits`)

- Même structure que Produits : liste avec édition inline + formulaire dédié pour la création
- Sélecteur d'articles avec recherche produit → choix de la taille (si applicable) → quantité
- Affiche la somme des articles à côté du prix fixe du kit (repère de marge)
- Soft delete identique aux produits

### Commandes (`/admin/commandes`)

- Filtrage par statut avec compteurs
- **Saisie manuelle** (`/new`) pour les commandes WhatsApp ou hors-application
- Page de détail avec changement de statut (transitions autorisées uniquement)
- **Remise** : montant + raison, aperçu du total final en temps réel
- **Suppression en masse** avec double confirmation (saisie du mot "SUPPRIMER")
- Temps réel via Supabase Realtime : nouvelle commande → toast admin + Web Push

### Livraisons (`/admin/livraisons`)

- Vue groupée par **jour** puis par **quartier**
- **Sélection multiple** (case à cocher par livraison, ou par quartier entier) + barre d'attribution flottante pour assigner un livreur en un clic
- **Création rapide de livreur** directement depuis la barre d'attribution (nom + téléphone → créé et assigné immédiatement)
- **Frais de livraison** éditables en ligne par livraison, inclus dans le total à encaisser affiché et dans le message WhatsApp généré
- Bouton "Marquer livrée" en un clic depuis la liste
- **Copie liste livreur** : génère un message WhatsApp formaté par quartier (tous arrêts, numéros, totaux à encaisser)
- Lien WhatsApp de contact client direct depuis chaque ligne

### Livreurs (`/admin/livreurs`)

- Liste éditable en ligne (nom, téléphone, notes) avec détection de modifications non sauvegardées
- Activer/désactiver un livreur — désactivé, il disparaît du sélecteur d'attribution mais reste visible sur les livraisons déjà attribuées (aucune suppression, l'historique est préservé)
- Compteur de livraisons en cours par livreur (charge de travail actuelle)
- Création rapide accessible aussi depuis cette page, en plus de la barre d'attribution sur `/admin/livraisons`

### Dashboard (`/admin/dashboard`)

- Compteurs : commandes, produits actifs, kits actifs, livraisons en attente (cliquable)
- Alerte **stock bas** (produits ≤ 3 en stock, triés par urgence)
- Dernières commandes avec statut

---

## Intégration WhatsApp

L'application n'utilise pas l'API WhatsApp — elle génère des **liens `wa.me` pré-remplis** :

| Usage | Déclencheur |
|---|---|
| Confirmation de commande | Client après validation du formulaire |
| Notification de livraison | Admin depuis la page de détail livraison |
| Liste journalière livreur | Admin depuis la vue livraisons du jour |
| Contact direct client | Admin depuis la liste des commandes / livraisons |

> WhatsApp reste le canal de communication, l'app est le registre.

---

## Migrations Prisma

```bash
# Créer une nouvelle migration (développement)
npx prisma migrate dev --name nom_de_la_migration

# Appliquer en production
npx prisma migrate deploy

# Ouvrir Prisma Studio
npx prisma studio
```

---

## Conventions de code

- **Server Actions** pour toutes les mutations (`"use server"`), centralisées dans `app/admin/actions.ts`
- `requireAdmin()` appelé en première ligne de chaque action et page admin
- Pattern de synchronisation pour les listes imbriquées (tailles, paliers, articles de kit) : le client envoie la liste complète (id réel ou `tmp_...` pour un nouvel élément), le serveur diffe et fait le create/update/delete ; les éléments référencés par une commande passée sont archivés plutôt que supprimés
- Les Server Actions qui modifient une entité avec relations (`updateProduct`, `updateKit`) **renvoient l'entité à jour avec ses relations** — indispensable pour que le client remplace ses ids temporaires par les ids réels après sauvegarde
- Types Prisma composés centralisés dans `types.ts`
- Statuts et transitions dans `lib/order-status.ts` — ne pas dupliquer ailleurs
- Images référencées par nom de fichier uniquement en base, URL construite via `catalogPath()` / prop `storageBaseUrl` ; `uploadProductImage()` (dans `admin/produits/upload.ts`) est réutilisé par produits et kits
- Le `CartContext` est la seule source de vérité pour l'état du panier côté client — ne pas appeler `lib/cart.ts` directement depuis les composants, passer par `useCart()`


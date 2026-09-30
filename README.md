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
| Styles | Tailwind CSS + variables CSS custom + shadcn/ui |
| Notifications | Web Push (VAPID) + service worker (`public/sw.js`) |
| Anti-spam | Upstash Redis (`@upstash/ratelimit`), repli en mémoire |
| Tests | Vitest (`pnpm test`) |
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
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://xxx.supabase.co/storage/v1/object/public/catalogue

# WhatsApp (numéro vendeur, format international sans +)
WHATSAPP_VENDOR_NUMBER=224XXXXXXXXX

# Web Push (générer avec : npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Anti-spam partagé (optionnel — sinon compteur en mémoire par instance)
# Ajoutés automatiquement par l'intégration Upstash du Marketplace Vercel
UPSTASH_REDIS_REST_URL=...        # ou KV_REST_API_URL
UPSTASH_REDIS_REST_TOKEN=...      # ou KV_REST_API_TOKEN

# Divers (optionnels)
VAPID_SUBJECT=mailto:admin@glowbyimane.com   # contact envoyé aux services de push
NEXT_PUBLIC_SITE_URL=https://glowbyimane.com   # base des liens de cartes cadeau
NEXT_PUBLIC_META_PIXEL_ID=...                  # Meta Pixel désactivé si absent
```

> 🔐 Changer `ADMIN_PASSWORD` (ou `ADMIN_SECRET`) déconnecte immédiatement toutes les sessions admin ouvertes.

---

## Installation

```bash
pnpm install

# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate deploy

# Lancer en développement
pnpm dev
```

Vérifications avant de pousser :

```bash
pnpm typecheck   # TypeScript
pnpm lint        # ESLint
pnpm test        # Tests unitaires (prix, validation, auth, stock…)
```

> Le projet utilise **pnpm** (`pnpm-lock.yaml`) — ne pas utiliser `npm install`, qui recréerait un `package-lock.json`.

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
│   │   ├── CheckoutPageClient.tsx # Revalidation des prix serveur au montage + case "Cadeau"
│   │   └── gift-upload.ts        # Upload photo de carte cadeau (public, checkout)
│   ├── produits/
│   │   └── [slug]/
│   │       └── page.tsx          # Fiche produit (par slug ; ancien lien par id → redirection)
│   └── components/
│       ├── ShopPageClient.tsx    # Hero + barre sticky + grille groupée par catégorie
│       ├── ShopSearchFilterBar.tsx # Row unique : bouton filtre (dépliable) + recherche
│       ├── ProductCard.tsx       # Carte produit avec badge stock adaptatif + remise
│       ├── PriceDisplay.tsx      # Prix actuel + prix barré + badge % remise
│       ├── ProductImage.tsx      # Image avec skeleton shadcn pendant le chargement
│       ├── ProductGallery.tsx    # Galerie swipeable, scroll-snap-stop: always
│       ├── ProductAddToCart.tsx  # Choix de taille + stepper quantité + ajout (fiche produit)
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
    │   └── [id]/                 # Fiche commande — inclut GiftCardPanel.tsx
    ├── livraisons/               # Suivi livraisons par jour et quartier
    ├── livreurs/                 # Gestion des livreurs
    └── kits/                     # Gestion des kits / bundles

cadeau/
└── [token]/                      # Page publique de consultation d'une carte cadeau publiée

lib/
├── action-result.ts              # withActionResult / UserError / unwrapAction (erreurs des Server Actions)
├── admin-auth.ts                 # Auth HMAC : génération et vérification de token
├── form-validation.ts            # toInt / toDate / toJsonArray (saisies admin)
├── image-upload.ts               # Upload Supabase Storage (vérification du format réel)
├── order-validation.ts           # Validation serveur des commandes boutique
├── rate-limit.ts                 # Limiteur de débit : Upstash si configuré, sinon mémoire (anti-spam, login)
├── customers.ts                  # upsertCustomer() — fiche cliente rattachée à chaque commande
├── customer-stats.ts             # Nombre de commandes, total dépensé, dernière commande
├── wholesale.ts                  # Commandes en gros : minimum, validation des demandes revendeur
├── restock.ts                    # Quantités à réapprovisionner (stock négatif)
├── order-items.ts                # Libellé d'une ligne de commande (kit / produit — taille)
├── slug.ts                       # slugify() + slug unique des produits
├── stock.ts                      # releaseOrderStock() / reserveOrderStock() — rendre ou réserver le stock
├── cart.ts                       # Logique panier localStorage (CartItem inclut stock)
├── gift-card.ts                  # buildDefaultGiftMessage(), giftCardUrl(), durée d'expiration du lien
├── images.ts                     # catalogPath() — résolution URL Supabase Storage
├── order-status.ts               # Config centralisée des statuts (labels, couleurs, transitions)
├── pricing.ts                    # Calcul des prix : remises, promotions, paliers (voir règle ci-dessous)
├── prisma.ts                     # Client Prisma singleton
├── push.ts                       # notifyAdmins() / notifyNewOrder() — Web Push, nettoyage des abonnements expirés
├── whatsapp.ts                   # normalizeGuineaPhone() + buildWhatsAppUrl() — liens wa.me,
│                                  # buildOrderMessage() — génération message de commande pré-rempli
└── supabase/
    └── server.ts                 # Client serveur (service role)

proxy.ts                          # Protection routes /admin/* (vérification token HMAC)
                                  # ⚠️ Next.js 16 : renommé de middleware.ts → proxy.ts
public/
├── og-image.png                  # Image Open Graph (1200×630)
├── favicon-32x32.png
├── favicon-16x16.png
├── apple-touch-icon.png
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-512-maskable.png

app/
├── sitemap.ts                    # Sitemap dynamique (servi sur /sitemap.xml)
├── robots.ts                     # Robots.txt (bloque /admin/, /api/ et /cadeau/)
└── manifest.ts                   # Web App Manifest (PWA)

types/types.ts                    # Types TypeScript partagés
```

---

## Modèle de données

### Entités principales

**`Product`** — Produits du catalogue avec soft delete (`archived`), support remises (`originalPrice`) et `slug` pour l'URL (`/produits/creme-eclat`). Le slug est généré à la création et **ne change pas** si le produit est renommé (les liens déjà partagés restent valides). Les produits ayant des commandes passées sont archivés plutôt que supprimés pour préserver l'historique.

**`ProductSize`** — Déclinaisons de contenance/taille (30ml, 50ml...) avec prix et stock propres.

**`ProductPackPrice`** — Paliers de prix par quantité (1 à X GNF, 3 à Y GNF...).

**`Kit`** — Bundle de produits avec prix fixe et support remises (`originalPrice`).

**`Order`** — Commandes au détail (`kind = DETAIL`) ou en gros (`kind = GROS`, voir « Commandes en gros »), avec workflow de statut, support de remises (`discountAmount`, `discountReason`, `finalTotal`) et traçabilité de la source (`app` / `whatsapp` / `admin`). `stockReserved` indique que la commande a décrémenté le stock : il est restitué (une seule fois) à l'annulation ou à la suppression d'une commande non livrée.

**`Delivery`** — Entité logistique séparée de la commande. Contient la date planifiée, le statut, le livreur assigné et les frais de livraison convenus (`deliveryFee`).

**`GiftCard`** — Carte cadeau optionnelle associée à une commande (créée uniquement si le client coche "Cette commande est un cadeau" au checkout). Contient les infos destinataire, un message et une photo (tous deux modifiables/validables par l'admin), un statut `DRAFT`/`PUBLISHED` et un `token` unique généré à la publication pour le lien public temporaire (`/cadeau/[token]`, expire `GIFT_LINK_EXPIRY_DAYS` après publication — 30 jours par défaut).

**`Customer`** — Fiche cliente créée ou mise à jour automatiquement à chaque commande, par numéro normalisé (`620 00 00 00`, `+224620000000` et `0620000000` = la même cliente). Boutique, statut revendeur et notes internes modifiables dans l'admin (`/admin/clientes`). Points de fidélité et VIP présents mais **règles à définir**.

**`OrderItemComponent`** — Contenu exact d'un kit au moment de la commande : une annulation restitue ce qui a été vendu, même si le kit a été modifié depuis.

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
à mettre à jour les deux statuts séparément. Une commande annulée ne peut plus être passée à `LIVREE` par sa livraison.

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
- `createOrder` ne fait **aucune confiance** au client : tout est revalidé (`lib/order-validation.ts` — quantités entières 1–50, 30 lignes max, téléphone guinéen, longueurs) et les prix sont recalculés côté serveur
- Anti-spam : 5 commandes / 15 min par IP (best-effort, en mémoire) et 3 / 15 min par téléphone (en base)

### Remises produit (`lib/pricing.ts`)

- `originalPrice` (nullable) sur `Product` et `Kit` — présence = remise permanente, absence = pas de remise
- Promotions temporaires (`Promotion`) : pourcentage appliqué sur une période
- **Règle : les remises ne se cumulent pas.** On applique la plus avantageuse entre la remise permanente et la meilleure promotion, cette dernière étant calculée sur le prix de référence (`originalPrice` s'il existe, sinon `price`). Exemple : prix d'origine 10 000, prix 8 000, promo −30 % → 7 000 ; promo −10 % → 8 000
- La même fonction (`resolveActiveUnitPrice`) sert à l'affichage (`PriceDisplay`), au panier et à la commande serveur : **prix affiché = prix facturé** (couvert par `lib/pricing.test.ts`)

---

## Panneau d'administration

### Auth (`/admin/login`)

- Cookie `HttpOnly; Secure` posé par Server Action — le mot de passe ne transite jamais vers le navigateur
- Token signé HMAC-SHA256 (clé dérivée de `ADMIN_SECRET` + `ADMIN_PASSWORD`), expiration 8h
- Identifiants comparés en temps constant ; blocage 15 min après 5 échecs par IP
- `proxy.ts` vérifie la signature à chaque requête `/admin/*` (Next.js 16 — anciennement `middleware.ts`)
- ⚠️ Le proxy ne protège pas les Server Actions (appelables depuis n'importe quelle page) : **chaque action admin doit appeler `requireAdmin()`**

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
- **Carte cadeau** (si le client a coché "Cette commande est un cadeau" au checkout) : édition du
  destinataire/message/photo, publication d'un lien public temporaire (30 jours), envoi du lien
  au destinataire via WhatsApp — voir `GiftCardPanel.tsx`
- **Annulation** : les articles réservés sont remis en stock
- **Suppression en masse** avec double confirmation (stock restitué pour les commandes non livrées)
- Commandes saisies par l'admin : stock décrémenté comme pour une commande boutique

### Livraisons (`/admin/livraisons`)

- Vue groupée par **jour** puis par **quartier**
- Bouton "Marquer livrée" en un clic depuis la liste
- **Frais de livraison** convenus après discussion (ajoutés au total à encaisser)
- **Copie liste livreur** : génère un message WhatsApp formaté par quartier
- Lien WhatsApp de notification client pré-rempli depuis la page de détail

---

## SEO & PWA

- Métadonnées globales + `generateMetadata` dynamique par fiche produit
- Sitemap dynamique (`/sitemap.xml`) incluant les fiches produit et les kits non archivés
- URLs produit lisibles (`/produits/<slug>`) avec balise canonique ; les anciens liens `/produits/<id>` redirigent vers le slug
- `robots.txt` bloquant `/admin/`, `/api/` et `/cadeau/` (liens de cartes cadeau partagés, pas indexables — `noindex` également posé par page via `generateMetadata`)
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
| Envoi du lien de carte cadeau | Admin depuis la fiche commande, une fois la carte publiée |

> WhatsApp reste le canal de communication, l'app est le registre.

---

## Migrations Prisma

```bash
# Créer une nouvelle migration (développement)
npx prisma migrate dev --name nom_de_la_migration

# ⚠️ Pour les colonnes NOT NULL sur tables existantes :
# utiliser --create-only, ajouter DEFAULT (ou remplir la colonne) dans le SQL généré,
# puis npx prisma migrate dev pour appliquer
# (exemple : 20260928130000_product_slug_and_indexes remplit les slugs avant le NOT NULL)

# Appliquer en production
npx prisma migrate deploy

# Ouvrir Prisma Studio
npx prisma studio
```

---

## Conventions de code

- **Server Actions** pour toutes les mutations (`"use server"`)
- `requireAdmin()` appelé en première ligne de chaque action et page admin
- **Erreurs des Server Actions** : en production, Next.js masque le message des erreurs levées. Les actions sont donc exportées via `withActionResult(...)` et renvoient `{ ok, data | error }`. Lever `UserError("…")` pour un message destiné à l'utilisateur (les autres erreurs donnent un message générique et sont journalisées). Côté client : `const x = unwrapAction(xAction)` — voir `lib/action-result.ts`
- Valider toute donnée reçue par une action (`lib/form-validation.ts`, `lib/order-validation.ts`) : les types TypeScript ne protègent rien à l'exécution
- Écritures multiples liées (produit + tailles + paliers, commande + stock…) dans une `prisma.$transaction`
- Types Prisma composés centralisés dans `types.ts`
- Statuts et transitions dans `lib/order-status.ts` — ne pas dupliquer ailleurs
- Images référencées par nom de fichier uniquement en base, URL construite via `catalogPath()` dans `lib/images.ts`
- Le `CartContext` est la seule source de vérité pour l'état du panier côté client — ne pas appeler `lib/cart.ts` directement depuis les composants, passer par `useCart()`
- Prix : passer par `lib/pricing.ts` (`resolveDiscountedLineTotal`, `getEffectiveDiscount`), afficher via `<PriceDisplay />`

---

## Meta Pixel

Intégré via `next/script` dans `app/MetaPixel.tsx` (actif seulement si `NEXT_PUBLIC_META_PIXEL_ID` est défini).

| Événement | Déclencheur |
|---|---|
| `PageView` | Automatique sur toutes les pages |
| `ViewContent` | Montage de la fiche produit (`ProductViewTracker`) |
| `AddToCart` | `addItem()` dans `CartContext` |
| `Lead` | Redirection WhatsApp après `createOrder` |

> `Lead` est l'équivalent de `Purchase` pour ce projet — le paiement se faisant à la livraison hors app, la redirection WhatsApp est le signal de conversion le plus fiable.

---

## Commandes en gros (revendeurs)

Page publique **`/revendeur`** (lien en bas de l'accueil) : le revendeur choisit librement ses quantités, **sans limite de stock**, à partir de `WHOLESALE_MIN_TOTAL_QUANTITY` unités au total (10, dans `lib/wholesale.ts`). Le prix affiché est **indicatif** (paliers et promotions actuels) ; le revendeur peut proposer **son prix souhaité par produit** (facultatif). La demande est enregistrée puis le revendeur est redirigé vers WhatsApp (« Demande revendeur #N », avec ses prix souhaités et le total correspondant). Aucun paiement en ligne.

| Étape | Stock | Côté admin |
|---|---|---|
| Demande reçue (`NOUVELLE`) | Aucun impact | Filtre « En gros » dans Commandes, notification |
| Négociation | Aucun impact | Prix unitaires (et quantités) modifiables par ligne ; prix souhaité du revendeur et écart affichés, bouton « Accepter les prix souhaités » |
| Accord (`CONFIRMEE`) | **Réservé**, même au-delà du disponible | Quantités figées, prix encore modifiables |
| Acompte | — | Montant, date, note ; reste à encaisser calculé |
| Annulation | Rendu | — |

Un **stock négatif** signifie « unités promises à réapprovisionner » : il apparaît dans le dashboard (« À réapprovisionner ») et dans le tableau des produits. Il n'est plus vendable au détail ; quand la marchandise arrive, il suffit d'ajouter le stock reçu.

---

## Notifications

Dashboard admin → **Notifications de commandes → Activer** (à faire sur chaque appareil). Une notification part à chaque commande et chaque demande revendeur, après la réponse (aucun délai pour la cliente) ; les appareils expirés sont nettoyés automatiquement.

- Nécessite `NEXT_PUBLIC_VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` (sinon, simplement désactivé).
- **iPhone** : ajouter d'abord le site à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis activer depuis l'icône.

---

## Chantiers ouverts

- **Fidélité / VIP** : les champs existent sur `Customer`, les règles (points par GNF, avantages, seuil VIP) restent à définir.
- **Prix revendeur publics** : aujourd'hui les prix de gros sont indicatifs (paliers existants) puis négociés ; des paliers spécifiques revendeurs pourraient être ajoutés.


v2
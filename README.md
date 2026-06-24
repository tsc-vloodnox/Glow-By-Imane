# Glow by Imane

Boutique beauté & accessoires — assistant de vente numérique avec commande via WhatsApp.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Prisma + PostgreSQL (Supabase)
- Supabase Auth, Storage, Realtime
- Web Push (VAPID)

## Démarrage rapide

### 1. Installer les dépendances

```bash
cd glow-by-imane
npm install
```

### 2. Configurer Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Copier `.env.example` vers `.env.local` et remplir les variables
3. Activer **Realtime** sur la table `Order` (Database → Replication)

### 3. Base de données

```bash
npm run db:push
# ou pour une migration versionnée :
npm run db:migrate
```

### 4. Lancer le dev server

```bash
npm run dev
```

- Boutique : [http://localhost:3000](http://localhost:3000)
- Admin : [http://localhost:3000/admin/dashboard](http://localhost:3000/admin/dashboard)

## Structure

```
app/
  (shop)/          → pages boutique (accueil, produits, panier, commande)
  (admin)/admin/   → dashboard admin
  api/webhooks/push/
lib/
  prisma.ts, supabase/, whatsapp.ts, push.ts
prisma/schema.prisma
public/sw.js
```

## Prochaines étapes (roadmap)

1. ~~Setup repo~~ ✓
2. ~~Modèles Prisma~~ ✓
3. Pages boutique (base) ✓ — panier client-side à brancher
4. Server Action commande + WhatsApp ✓
5. Dashboard admin (liste) ✓ — changement de statut à ajouter
6. Realtime Supabase sur les commandes
7. Push notifications admin
8. shadcn/ui + polish UI/UX

## Déploiement

Héberger sur **Vercel** et dupliquer les variables d'environnement du `.env.local`.

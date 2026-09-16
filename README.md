# Look360

Outil de **recherche & testing de produits COD** (dropshipping, marchés
francophones africains). Voir `plan-technique-app-produit.md` pour le plan complet.

Stack : **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4 + **Supabase**
(Postgres + Auth + RLS).

> État : **Étape 1 du build (setup)** — projet + client Supabase + auth
> email/mot de passe + schéma de base de données (tables & RLS).
> Les pages Recherche / Testing et les notifications arrivent aux étapes suivantes.

---

## 1. Prérequis

- Node.js 20+ (testé sur Node 22)
- Un projet **Supabase** (plan gratuit suffit) — séparé de Kimba.

## 2. Configurer les variables d'environnement

Copie `.env.example` vers `.env.local` et remplis les valeurs depuis
**Supabase → Project Settings → API** :

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...            # clé "anon public"
SUPABASE_SERVICE_ROLE_KEY=eyJ...                # clé "service_role" — SECRÈTE
```

- `NEXT_PUBLIC_*` sont exposées au navigateur (normal).
- `SUPABASE_SERVICE_ROLE_KEY` reste **côté serveur uniquement** (jamais dans un
  Client Component). `.env.local` est ignoré par git.

## 3. Appliquer la migration (schéma DB)

La migration se trouve dans `supabase/migrations/0001_initial_schema.sql`.
Deux options :

### Option A — SQL Editor (le plus simple)

1. Ouvre ton projet sur [supabase.com](https://supabase.com) → **SQL Editor**.
2. Copie-colle le contenu de `supabase/migrations/0001_initial_schema.sql`.
3. Clique **Run**.

### Option B — Supabase CLI

```bash
npm install -g supabase          # ou: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <ton-project-ref>   # visible dans l'URL du projet
supabase db push                                 # applique les migrations
```

> Après application : le **premier utilisateur inscrit devient `admin`**
> (le patron), les suivants `agent`. Un profil est créé automatiquement à
> l'inscription (trigger `on_auth_user_created`).

## 4. Créer le premier utilisateur (le patron)

L'auth se fait par **email + mot de passe**. Crée le compte via
**Supabase → Authentication → Users → Add user** (coche « Auto Confirm User »
pour éviter l'email de confirmation), puis connecte-toi sur `/login`.

## 5. Lancer en local

```bash
npm install
npm run dev
```

Ouvre http://localhost:3000 :
- Non connecté → redirection vers `/login`.
- Connecté → page d'accueil avec ton email, ton rôle et un bouton Déconnexion.

Autres scripts : `npm run build` (build prod), `npm start` (serveur prod),
`npm run lint`.

---

## Structure

```
src/
  app/
    layout.tsx            # layout racine
    page.tsx              # accueil (protégé)
    login/
      page.tsx            # formulaire de connexion
      actions.ts          # server actions login / logout
  lib/supabase/
    client.ts             # client navigateur (anon)
    server.ts             # client Server Components / Actions / Route Handlers
    admin.ts              # client service_role (serveur uniquement)
    proxy.ts              # rafraîchissement de session + protection des routes
  proxy.ts                # ex-"middleware" (renommé en Next.js 16)
supabase/
  config.toml
  migrations/
    0001_initial_schema.sql   # profiles, produits, tests, push_subscriptions + RLS
```

## Schéma de base de données

4 tables (voir §3 du plan) avec **Row Level Security** activée sur chacune :

| Table | Rôle |
|---|---|
| `profiles` | utilisateurs (admin / agent), liés à `auth.users` |
| `produits` | produits recherchés (coût livré = colonne générée) |
| `tests` | résultats de test rattachés à un produit |
| `push_subscriptions` | abonnements Web Push par appareil |

Règle RLS : **chaque utilisateur gère ses propres données ; l'admin voit tout**
(via la fonction `public.is_admin()`).

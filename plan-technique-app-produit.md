# Plan technique — Look360 (recherche & testing produit COD)

> Brief à filer à Claude Code pour qu'il build. Tout est dedans : stack, base de données, pages, calculs exacts, notifs.

---

## 1. C'est quoi

Outil perso de recherche + test de produits pour du COD dropshipping sur les marchés francophones africains (Côte d'Ivoire, Gabon, Sénégal, Burkina Faso...). Il remplace la méthode Google Sheet manuelle.

- **Pour l'instant** : un seul utilisateur (le patron).
- **Plus tard** : des commerciaux avec leurs propres comptes qui *soumettent* des produits → le patron les *valide*. Donc la base doit prévoir ce workflow dès le départ (rôles + statut de revue), même si la v1 est mono-utilisateur.
- **App séparée de Kimba** (le CRM existant). Son propre projet Supabase, pour ne pas surcharger Kimba.

---

## 2. Stack technique

- **Next.js** (App Router) + TypeScript + Tailwind CSS
- **Supabase** : Postgres + Auth + Row Level Security (RLS)
- **Vercel** : hébergement + **Vercel Cron** pour les notifications programmées
- **Notifications** : **Web Push (PWA)** — l'app installée sur l'écran d'accueil envoie de vraies notifs, même fermée
- Le **plan gratuit Supabase suffit** : 2 projets actifs inclus (Kimba = projet 1, cette app = projet 2), 1 Go de stockage fichiers, 500 Mo de base. On ne stocke pas les images en fichier, juste les **liens** → quasi zéro stockage.

---

## 3. Base de données (Supabase / Postgres)

### Table `profiles`
Utilisateurs. Lié à Supabase Auth.

| champ | type | note |
|---|---|---|
| id | uuid (PK) | = auth.users.id |
| nom | text | |
| role | text | `admin` (patron) ou `agent` (commercial) |

> Les abonnements aux notifs push sont stockés à part dans une table `push_subscriptions` (`user_id`, `endpoint`, `keys`) — un utilisateur peut avoir plusieurs appareils.

### Table `produits`
Le cœur : chaque produit trouvé.

| champ | type | note |
|---|---|---|
| id | uuid (PK) | |
| created_at | timestamptz | |
| nom | text | |
| image_url | text | lien de l'image (pas de fichier hébergé) |
| lien_source | text | Alibaba / AliExpress |
| lien_concurrent | text | site du concurrent |
| lien_ad_library | text | pub FB Ad Library |
| date_debut_pub_concurrent | date | pour juger l'ancienneté de la pub (signal produit gagnant) |
| angle_marketing | text | l'angle utilisé par le concurrent |
| emotion_tag | text | peur / désir / statut / économie... (pour la biblio d'angles) |
| marche | text | pays ciblé (CI, Gabon, Sénégal, BF...) |
| prix_sourcing | numeric | FCFA |
| poids_kg | numeric | |
| frais_logistiques_kilo | numeric | FCFA / kg |
| cout_livre_estime | numeric | **calculé** (voir §5) |
| statut | text | `idee` / `a_tester` / `en_test` / `valide` / `production` / `abandonne` |
| soumis_par | uuid (FK profiles) | l'agent qui l'a proposé |
| statut_revue | text | `soumis` / `en_analyse` / `approuve` / `rejete` |
| date_a_travailler | date | planning (voir notifs) |
| date_lancement_testing | date | planning (voir notifs) |
| notif_envoyee | boolean | pour éviter les doublons de rappel |
| notes | text | |

### Table `tests`
Les résultats de test rattachés à un produit (un produit peut avoir plusieurs tests, ex. par marché).

| champ | type | note |
|---|---|---|
| id | uuid (PK) | |
| produit_id | uuid (FK produits) | |
| created_at | timestamptz | |
| marche | text | pays testé |
| prix_vente_prevu | numeric | FCFA |
| commandes_recues | integer | leads pendant le test |
| commandes_confirmees | integer | validées au closing / à l'appel |
| depense_pub | numeric | total dépensé sur le test |
| cout_produit_estime | numeric | par unité, livré (estimé, souvent test sans stock) |
| frais_livraison_prevu | numeric | par commande (défaut ~1800), pour la projection |
| verdict | text | **calculé** (voir §5) |
| notes_test | text | |

> Les indicateurs (taux de confirmation, bénéfice projeté, marge, CPA, ROAS) se calculent côté app à partir des champs ci-dessus — pas besoin de les stocker, sauf le `verdict` si on veut filtrer dessus.

---

## 4. Pages / écrans

### 1. Auth (login)
Supabase Auth. Mono-utilisateur pour l'instant, mais les rôles sont prêts.

### 2. Page Recherche produit
- Liste / grille de tous les produits, avec **filtres** (statut, marché) et **tri** (coût livré, date, plus tard le score).
- Bouton **"Ajouter produit"** → formulaire avec les champs de la table `produits`. (v2 : coller un lien Alibaba → remplissage semi-auto du nom/image/prix. v1 : saisie manuelle.)
- Sur chaque carte produit : bouton **"Envoyer en test"** → passe le `statut` à `en_test`, ce qui le fait apparaître sur la page Testing.
- Champs planning visibles : `date_a_travailler` / `date_lancement_testing`, avec un **badge visuel** quand l'échéance approche.

### 3. Page Testing
- Affiche les produits en `statut = en_test`.
- Chaque produit → fiche de test (reprendre **exactement** la logique du prototype `estimateur-rentabilite.jsx` déjà validé) : saisie des chiffres réels → affichage **taux de confirmation** (en haut, la validation de la demande) + **bénéfice projeté** + **verdict**.
- Boutons : **"Valider"** (→ `statut = valide`) ou **"Abandonner"** (→ `abandonne`).

### 4. Dashboard (v2)
Nombre de produits par statut, taux de validation, marge moyenne des produits validés, meilleurs angles.

### 5. Validation des soumissions agents (plus tard)
File d'attente des produits `statut_revue = soumis` à approuver/rejeter par l'admin.

---

## 5. Calculs exacts (à implémenter tel quel)

### Coût livré estimé (page Recherche)
```
cout_livre_estime = prix_sourcing + (poids_kg * frais_logistiques_kilo)
```

### Rentabilité d'un test (page Testing)
```
taux_confirmation   = commandes_confirmees / commandes_recues * 100
ca                  = prix_vente_prevu * commandes_confirmees
benefice_projete    = (prix_vente_prevu - cout_produit_estime - frais_livraison_prevu) * commandes_confirmees - depense_pub
cpa_recue           = depense_pub / commandes_recues
cout_par_confirmee  = depense_pub / commandes_confirmees
marge_unite         = benefice_projete / commandes_confirmees
marge_pct           = benefice_projete / ca * 100
roas                = ca / depense_pub
```
> Le test tourne souvent **sans stock** → pas de livraison réelle. Le bénéfice est une **projection** : ce qu'on ferait par commande confirmée une fois le stock commandé et livré.

### Seuils — Taux de confirmation (closing)
- `< 35%` → **faible** (rouge) — demande pas convaincante
- `35–45%` → **correct** (ambre) — à surveiller
- `45–60%` → **normal** (vert) — bon closing
- `≥ 60%` → **super top** (vert fort) — les clients veulent vraiment payer

### Seuils — Marge (verdict rentabilité)
- `bénéfice ≤ 0` → **pas rentable** (rouge)
- `marge_pct ≥ 30%` → **rentable** (vert)
- `15–30%` → **moyen, à optimiser** (ambre)
- `< 15%` → **marge trop faible** (rouge)

*(Gérer les divisions par zéro : si commandes = 0 ou CA = 0, afficher 0 / tiret.)*

---

## 6. Système de notifications (anti-procrastination)

**But** : le patron a trop de produits en attente et procrastine, surtout après un test raté. Le système lui rappelle **quoi bosser** sans qu'il ait à y penser.

**Canal : Web Push (PWA).** L'app est installable sur l'écran d'accueil (manifest + service worker) et envoie de vraies notifications push, même app fermée. Marche sur Android, et sur iPhone à partir d'iOS 16.4 une fois la PWA ajoutée à l'écran d'accueil.

**À mettre en place :**
- Manifest PWA + service worker + clés **VAPID** (lib `web-push`).
- À la première ouverture : demander la permission de notif, stocker la **push subscription** en base (table `push_subscriptions`).
- **Vercel Cron** 1×/jour (ex. 8h) → route API qui query les produits dont `date_lancement_testing` ou `date_a_travailler` = **aujourd'hui** OU **dans 2 jours** et `notif_envoyee = false`, envoie la push, puis passe `notif_envoyee = true` (anti-doublon).

**Règle de design importante :** la notif surface **UN seul produit à traiter** (le prochain dû), jamais une liste de 10 → sinon ça décourage encore plus. Un truc à la fois.

---

## 7. Ordre de build (roadmap)

1. **Setup** : projet Next.js + Supabase + déploiement Vercel, Auth, création du schéma DB.
2. **Page Recherche** : CRUD produits + calcul du coût livré + filtres/tri.
3. **Page Testing** : logique de rentabilité/confirmation (reprendre le prototype `estimateur-rentabilite.jsx`).
4. **Planning + notifs** : champs de date + PWA (manifest/service worker) + Vercel Cron + Web Push.
5. **Score & tri** des produits, puis **bibliothèque d'angles**.
6. **Plus tard** : comptes agents + workflow soumission/validation, puis connexion à Kimba pour pousser les produits validés.

---

## 8. À confirmer

- **Notifs** : Web Push via PWA (décidé). Sur iPhone, nécessite iOS 16.4+ avec l'app ajoutée à l'écran d'accueil.
- **Devise** : FCFA partout (XOF pour CI/Sénégal/Burkina, XAF pour Gabon — même symbole, pas de conversion nécessaire).
- **Un produit = un seul marché, ou plusieurs ?** (si multi, ajouter une table de jonction `produit_marche`).

---

*Fichier de référence à joindre : `estimateur-rentabilite.jsx` (le prototype validé de la page Testing).*

# Look360 — Reste à faire (contexte & priorités)

> État vérifié le **30/09/2026** (code + Supabase + Vercel).
> Ordonné du **plus important au moins important**.
> Légende : 👤 = action Yaccine (dashboard/contenu) · 🤖 = action Claude (code) ·
> 🔴 bloquant prod · 🟠 config/env · 🟡 QA · 🟢 contenu · 🔵 amélioration.

---

## ✅ Feed commun — cron Vercel branché (remplissage)

Le **feed commun** (table `feed_ads`, page Spy) est **branché sur Vercel Cron**
(comme notifs / winner-agent) : entrée ajoutée dans `vercel.json`
(`/api/cron/feed-refresh`, tous les jours **06:00 UTC**). La route accepte
l'auth native Vercel (`Authorization: Bearer $CRON_SECRET`, déjà présent dans
l'env) **et** `x-cron-secret` pour un déclenchement manuel. **Plus besoin de
pg_cron pour le feed.**

Le feed part **VIDE** tant qu'aucun run n'a eu lieu. Deux façons de le remplir :

1. **Tout de suite, depuis le cache (gratuit, sans Apify/Bunny)** — pré-remplit
   `feed_ads` à partir des recherches déjà faites (données **réelles**) :
   `GET /api/cron/feed-refresh?mode=seed`
   (en-tête `x-cron-secret: <CRON_SECRET>`, ou via le bouton « Run » du cron
   dans le dashboard Vercel en ajoutant `?mode=seed`).
2. **Refresh complet quotidien (automatique)** — le cron Vercel lance le scrape
   niches × marchés + archivage des créatives sur Bunny, puis upsert. Se déclenche
   seul chaque jour ; déclenchable à la main depuis **Vercel → Settings → Cron Jobs
   → Run** (nécessite **Apify** + **Bunny Storage** configurés — ils le sont).

Tant que le feed est vide, la page Spy affiche l'état « Lance une recherche ».

---

## ✅ Déjà livré (rappel rapide)

- **Phase 4** : landing + offres + onboarding + vitrine anonymisée.
- **Phase 5 STEP 0→6** : panneau superadmin (cockpit, clients + actions loggées,
  revenus & marge + alertes, activité), suspension de compte, **monitoring Sentry**
  (code prêt, DSN à fournir).
- **Refonte UI « vivante »** : cartes riches (score/closing/marge/drapeau), data‑viz
  Testing, états vides, dashboard « Aujourd'hui », profondeur globale, nav mobile,
  micro‑animations, classement Winners/Top Trend.
- **Fix lecteur vidéo** : lightbox contenue + hls.js + transcodage (env Bunny Stream)
  + fallback. (Valeurs env à fournir + test réel sur déploiement.)

---

## 🔴 P0 — Bloquant avant une vraie mise en production

### 1. 🟢👤 Pages légales (CGU, Confidentialité, Remboursement)
Encore des **placeholders** (`/cgu`, `/confidentialite`, `/remboursement` n'ont que
des titres de sections). **Obligatoire pour la vente en ligne** (droit conso /
Omnibus). → Tu fournis les textes, 🤖 je les intègre dans les pages.

### 2. 🔴👤 GeniusPay : passage sandbox → live
- Remplacer les secrets Edge Functions par les **clés live** + `GENIUSPAY_ENV=live`.
- Dashboard GeniusPay **live** : déclarer le webhook
  `https://rgmaisiggksjnkxdhytv.supabase.co/functions/v1/geniuspay-webhook`
  et la return URL `https://look360.io/offres?pay=return`.
- **Supprimer** la fonction de test `geniuspay-selftest` (encore déployée) :
  Supabase → Edge Functions → Delete.

### 3. 🔴👤 Planifier les relances (pg_cron) — **non actif**
Vérifié : `pg_cron` **n'est pas installé** → l'Edge Function `subscription-reminders`
n'est **jamais appelée** (pas d'emails J‑7/J‑3/J0, pas de passage auto en Gratuit à
l'expiration). À exécuter **une fois** dans Supabase → SQL Editor :

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;  -- déjà présent
select cron.schedule(
  'look360-reminders', '0 8 * * *',
  $$ select net.http_post(
       url := 'https://rgmaisiggksjnkxdhytv.supabase.co/functions/v1/subscription-reminders',
       headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
     ); $$
);
-- Vérifier : select jobname, schedule, active from cron.job;
```
Secrets requis côté Edge Functions : `CRON_SECRET`, `RESEND_API_KEY`, `SITE_URL`.

### 4. 🟡👤 QA paiement bout‑en‑bout (sandbox, puis live)
Abonnement + pack → upgrade plan + crédits crédités + **idempotence** (rejeu webhook
ne double pas). À valider avant d'ouvrir les paiements.

---

## 🟠 P1 — Phase 5 restante (code) + config

### 5. 🤖 STEP 7 — Rate‑limiting (Upstash) — **non commencé**
Limiter les recherches Spy / analyses par offre (anti‑abus, protection coûts Apify).
Vérifié : aucun code `upstash`/`ratelimit` présent. À faire par Claude :
- Middleware/garde sur les routes `/api/spy/*` (limite par plan + par user).
- Variables d'env (noms) : `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- 👤 Ensuite : créer le compte Upstash + renseigner les 2 valeurs dans Vercel.

### 6. 🤖 STEP 8 — Sécurité finale
- Re‑tester : `/admin` **inaccessible** hors `role = 'superadmin'` ; aucune fuite
  inter‑comptes (service_role / SECURITY DEFINER gardés).
- Advisors : **verts ou documentés** (voir « Notes » ci‑dessous — les WARN admin/
  vitrine sont voulus).
- Vérifier le rate‑limit (STEP 7) une fois en place.

### 7. 🟠👤 Renseigner les variables d'env dans Vercel
Le code est prêt ; il manque les **valeurs** (jamais dans le code / le chat) :

| Variable | Pour | État |
|---|---|---|
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Monitoring (STEP 6) | code prêt |
| `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_CDN_HOST` | Lecture vidéo fiable | code prêt |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate‑limit | **après STEP 7** |
| `NEXT_PUBLIC_DEMO_VIDEO_URL` | Vidéo démo landing | code prêt |

### 8. 🟠👤 Supabase Auth — protection mots de passe compromis
Advisor WARN toujours actif. **Authentication → Passwords → Enable leaked password
protection** (HaveIBeenPwned).

---

## 🟡 P2 — QA fonctionnelle à valider

- [ ] 🟡👤 **Lecteur vidéo bout‑en‑bout** sur une **vraie vidéo qui posait problème**
      (à tester sur le déploiement Vercel) : vérifier le chemin emprunté
      (transcodé Bunny / HLS / fallback). Me donner une URL → 🤖 je vérifie.
- [ ] 🟡 **Gating Gratuit** : Winner Agent, Surveillance, Vitrine, téléchargement
      vidéo (Starter+) bien restreints.
- [ ] 🟡 **Vitrine Business** : anonymat total + opt‑out `/parametres`.
- [ ] 🟡 **Onboarding** : signup → email Resend → `/bienvenue` → guide.
- [ ] 🟡 **Spy UE** : reach affiché (dépense seulement si Meta la publie).
- [ ] 🟡 **Passe mobile** : revue mobile de bout en bout (déjà bien avancée).

---

## 🔵 P3 — Améliorations (non bloquantes)

- [ ] 🔵🤖 Polish visuel restant : **Testing**, **Vitrine**, **Offres** (même densité
      « premium data » que le reste).
- [ ] 🔵🤖 Densifier **Surveillance** en liste type « brandtracker » (optionnel).
- [ ] 🟢👤 (Optionnel) **Mot du fondateur** = preuve sociale réelle (les faux
      témoignages restent **interdits** : risque Omnibus/DGCCRF + Meta).

---

## ℹ️ Notes / choix assumés (rien à corriger)

- **Advisors WARN `admin_*` + `vitrine_winners`** : **intentionnel**. Ces fonctions
  sont `SECURITY DEFINER` et **auto‑gardées** (`is_superadmin()` / RLS) ; un appel non
  autorisé renvoie `forbidden`, jamais de données.
- **Advisor INFO `billing_reminders`** : table service_role only (RLS on, aucune
  policy = aucun accès client). État voulu.
- **Stats vitrine (landing)** : socle marketing de départ (`SEED` dans
  `PreuveSection.tsx`), remplacé par les vraies données dès qu'elles dépassent.
- **Déploiement** : Vercel déploie la branche `claude/look360-setup-pn4oxz` en prod
  (`look360.io`). Penser à merger vers la branche par défaut si ce réglage change.

---

## 🚦 Ordre conseillé d'exécution

1. **Pages légales** (#1) + **GeniusPay live & webhook** (#2) + **pg_cron** (#3) → indispensables pour vendre.
2. **QA paiement** (#4).
3. **STEP 7 rate‑limit** (#5) puis **STEP 8 sécurité finale** (#6).
4. **Variables d'env** (#7) + **leaked‑password** (#8).
5. **QA fonctionnelle** (P2), dont le **test réel du lecteur vidéo**.
6. **Polish visuel** restant (P3).

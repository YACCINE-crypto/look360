# Look360 — Actions avant la Phase 5

> État vérifié le 24/09/2026. Coche au fur et à mesure.
> Légende : 🔴 bloquant prod · 🟠 config rapide · 🟡 QA · 🟢 contenu · ✅ fait par Claude.

---

## ✅ Déjà fait côté code (Claude) — rien à faire

- Phase 4 complète (landing STEP 0→10, onboarding, vitrine anonymisée, sécurité).
- Migration `0021` (vitrine SECURITY DEFINER anonymisée + opt-out) **appliquée**.
- Migration `0022` (révocations EXECUTE + `search_path`) **appliquée**.
- Types Supabase régénérés (`database.types.ts`), casts retirés.
- Auth unifiée sur `/login` (onglets), tous les CTA → `/login?tab=signup`.

---

## 🔴 À faire avant une vraie mise en production

### 1. Planifier les relances mensuelles (cron)
L'Edge Function `subscription-reminders` est **déployée mais jamais appelée**
(`pg_cron` non activé). Sans ça : pas d'emails J‑7/J‑3/J0 ni passage auto en
Gratuit à l'expiration.

**À exécuter une fois** dans Supabase → SQL Editor (remplace `<CRON_SECRET>` par
la vraie valeur du secret — ne la commite jamais) :

```sql
-- Activer les extensions (si pas déjà fait)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Appel quotidien à 08:00 UTC de la fonction de relances
select cron.schedule(
  'look360-reminders',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://rgmaisiggksjnkxdhytv.supabase.co/functions/v1/subscription-reminders',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
  );
  $$
);

-- Vérifier :  select jobname, schedule, active from cron.job;
```

Secrets Edge Functions requis pour que ça marche : `CRON_SECRET`, `RESEND_API_KEY`,
`SITE_URL` (voir `docs/PHASE3_PAIEMENT.md`).

### 2. GeniusPay : sandbox → live (quand prêt)
- Remplacer les secrets par les **clés live** + `GENIUSPAY_ENV=live`.
- Dashboard GeniusPay **live** : déclarer le webhook
  `https://rgmaisiggksjnkxdhytv.supabase.co/functions/v1/geniuspay-webhook`
  et la return URL `https://look360.io/offres?pay=return`.

### 3. Supprimer la fonction de test `geniuspay-selftest`
Encore déployée (ACTIVE). Pas d'outil de suppression côté Claude → à supprimer
dans **Supabase → Edge Functions → geniuspay-selftest → Delete**.

---

## 🟠 Config manuelle (dashboard / env)

### 4. Supabase Auth — protection mots de passe compromis
**Authentication → Providers/Passwords → Enable leaked password protection**
(vérif HaveIBeenPwned).

### 5. Vercel — variable d'env de la vidéo démo
`NEXT_PUBLIC_DEMO_VIDEO_URL` = URL d'embed **Bunny Stream** de la vidéo démo.
Tant qu'absente, le bouton « Voir la démo » affiche « bientôt disponible ».

### 6. Resend — ✅ OK (confirmé)

---

## 🟡 QA à valider (fonctionnel)

- [ ] **Paiement bout‑en‑bout sandbox** : abonnement + pack → upgrade plan +
      crédits crédités + idempotence (rejeu webhook ne double pas).
- [ ] **Gating Gratuit** : Winner Agent, Surveillance, Vitrine, téléchargement
      vidéo (réservé Starter+) bien restreints.
- [ ] **Vitrine Business** : données anonymisées (aucun nom/identité) + opt‑out
      dans `/parametres` fonctionne.
- [ ] **Onboarding** : signup → email Resend → `/bienvenue` → guide.
- [ ] **Spy UE** : le reach s'affiche (dépense seulement si Meta la publie).
- [ ] **Passe mobile dédiée** : revue mobile « step by step » de toute la landing
      + app (prévue après le desktop).

---

## 🟢 Contenu à fournir (par Yaccine)

- [ ] **Pages légales** `/cgu`, `/confidentialite`, `/remboursement` : encore des
      placeholders `[Contenu à fournir]` → à rédiger/valider (obligatoire pour la
      vente en ligne).
- [ ] **Vidéo démo Bunny** (cf. #5).
- [ ] (Optionnel) **Mot du fondateur** si tu veux une preuve sociale réelle
      (les faux témoignages ont été retirés — risque légal Omnibus/DGCCRF + Meta).

---

## ℹ️ Notes / choix assumés

- **Stats vitrine (landing)** : socle de départ marketing (40 winners, 120 tests,
  57 % closing, 42 % marge) qui s'affiche tant que la base est jeune ; les vraies
  données prennent le relais dès qu'elles dépassent. Ajustable dans
  `src/components/landing/PreuveSection.tsx` (`const SEED`).
- **Advisor `vitrine_winners` (WARN authenticated)** : intentionnel — la RPC doit
  être appelable par les connectés ; elle est `SECURITY DEFINER` volontairement
  (la RLS bloque la lecture inter‑comptes) et auto‑restreinte (Business +
  anonymisée).
- **Advisor `billing_reminders` (INFO)** : table service_role only, verrouillée
  (RLS on, aucune policy = aucun accès client). État voulu.
- **Déploiement** : Vercel déploie la branche `claude/look360-setup-pn4oxz` en
  production (`look360.io`). Penser à merger vers la branche par défaut si tu
  changes ce réglage.

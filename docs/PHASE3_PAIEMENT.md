# Phase 3 — Paiement (GeniusPay)

Paiement des abonnements et des packs de crédits, en **sandbox d'abord**.
Tout est vérifié **côté serveur** : le client ne fixe jamais un montant ni un
nombre de crédits, il envoie seulement un identifiant (offre / pack).

## Architecture

```
Navigateur (app)                Edge Functions (Deno)              Base (RPC SECURITY DEFINER)
  bouton Choisir/Recharger  ──▶  geniuspay-create-payment  ──┐
   supabase.functions.invoke      · calcule le montant        │  insert payments(status=pending)
                                   · crée le checkout          │
   ◀── checkoutUrl ───────────────┘                           │
   redirection vers le checkout hébergé                        │
        │ (paiement)                                           │
        ▼                                                      │
  retour /offres?pay=return&ref=…                              │
   sonde /api/payments/status                                  │
                                 geniuspay-webhook  ──────────▶  apply_payment_success(ref)
   (webhook = source de vérité)   · HMAC-SHA256                    · subscription → activate_subscription
                                  · anti-rejeu 5 min                · credit_pack  → apply_credits(pack)
                                  · idempotent (ref)                (atomique + verrou FOR UPDATE)
```

- **Unité des crédits** : la base stocke l'unité **interne** (Business = 6 000/mois,
  packs 500/1 200/3 000). L'affichage ×100 est purement front (`formatCredits`).
  Les fonctions créditent l'interne → **marge et nombre d'actions inchangés**.
- **Aucun nom de prestataire côté client** : les boutons disent
  « Choisir cette offre » / « Recharger ». Le nom « GeniusPay » n'apparaît que
  dans le code serveur / la config.
- **Couche d'abstraction** : `_shared/payments.ts` (interface `PaymentProvider`)
  + `_shared/provider.ts` (registry). Ajouter Flutterwave/Paystack = une classe
  de plus, sans toucher aux Edge Functions.

## Montants (unité d'affichage ×100 — usage réel inchangé)

| Offre | Normal | 1er mois (si `has_ever_paid=false`) | Crédits/mois (affichés) |
|-------|-------:|-----------------------:|---------------------:|
| Starter | 7 500 | 5 000 | 120 000 |
| Pro | 15 000 | 10 000 | 300 000 |
| Business | 25 000 | 17 500 | 600 000 |

| Pack | Prix | Crédits (affichés) |
|------|-----:|-------------------:|
| — | 3 000 | 50 000 |
| — | 6 000 | 120 000 |
| — | 13 000 | 300 000 |

## Secrets à créer

> ⚠️ Ne jamais committer les valeurs. On ne renseigne que des **noms** dans le code.

### A. Supabase → Edge Functions → Secrets
(Dashboard : *Project Settings → Edge Functions → Secrets*, ou
`supabase secrets set NOM=valeur`.)

| Secret | Rôle |
|--------|------|
| `GENIUSPAY_ENV` | `sandbox` (puis `live` après validation) — simple label |
| `GENIUSPAY_API_KEY` | en-tête `X-API-Key` |
| `GENIUSPAY_API_SECRET` | en-tête `X-API-Secret` |
| `GENIUSPAY_WEBHOOK_SECRET` | secret de signature du webhook (HMAC-SHA256) |
| `SITE_URL` | ex. `https://look360.io` — liens des emails de relance |
| `CRON_SECRET` | protège la fonction de relances (`x-cron-secret`) |
| `RESEND_API_KEY` | envoi des emails de relance |
| `EMAIL_FROM` | ex. `Look360 <no-reply@look360.io>` (optionnel) |
| `GENIUSPAY_API_URL` | *optionnel* — défaut `https://geniuspay.ci/api/v1/merchant/payments` |
| `PAYMENT_PROVIDER` | *optionnel* — défaut `geniuspay` |

> Ce sont les **mêmes noms** que l'intégration GeniusPay qui tourne déjà en prod
> (mêmes en-têtes `X-API-Key` / `X-API-Secret`). Montant **minimum 200 XOF**.

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont **injectés
automatiquement** dans les Edge Functions — ne pas les recréer.

### B. Vercel (app Next)
**Aucun secret GeniusPay** n'est nécessaire ici (le paiement est initié côté
Edge Function). On garde seulement ceux des phases 1–2 déjà en place :
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.

## URL du webhook à configurer dans GeniusPay

```
https://rgmaisiggksjnkxdhytv.supabase.co/functions/v1/geniuspay-webhook
```

- Événement : *paiement réussi* (et échec/annulation si proposé).
- Récupérer le **secret de signature** du webhook → `GENIUSPAY_WEBHOOK_SECRET`.
- **Signature attendue** : `HMAC-SHA256( ${X-Webhook-Timestamp}.${corps_brut} )`,
  en-têtes `X-Webhook-Signature` (hex) + `X-Webhook-Timestamp` ; rejet si > 5 min.
- **Return URL** : GeniusPay ne prend pas la return_url dans la requête — la
  configurer dans le dashboard GeniusPay sur `https://look360.io/offres?pay=return`.
  La page de retour sonde ensuite le dernier paiement de l'utilisateur (elle n'a
  pas besoin de la référence dans l'URL).

## Procédure de test en SANDBOX

1. **Secrets** : renseigner les secrets Supabase ci-dessus avec
   `GENIUSPAY_ENV=sandbox` et les **clés sandbox** GeniusPay.
2. **Webhook** : dans le dashboard **sandbox** GeniusPay, déclarer l'URL du
   webhook ci-dessus, et copier le secret de signature dans
   `GENIUSPAY_WEBHOOK_SECRET`.
3. **Abonnement** : se connecter à l'app → `/offres` → « Choisir cette offre »
   (Pro). Redirection vers le checkout sandbox → payer avec un moyen de test.
   Retour sur `/offres?pay=return&ref=…` : bandeau « validation en cours »,
   puis « Paiement confirmé » dès réception du webhook (solde + offre à jour).
4. **Vérifier en base** :
   ```sql
   select status, purpose, plan, credits from public.payments order by created_at desc limit 3;
   select plan, has_ever_paid, monthly_credits, pack_credits, current_period_end
     from public.subscriptions where user_id = '<ton uuid>';
   select type, amount, balance_after, reason from public.credit_ledger order by created_at desc limit 5;
   ```
5. **Idempotence** : rejouer le même webhook (bouton *resend* GeniusPay) → le
   solde **ne double pas** (réponse `duplicate`).
6. **Pack** : tester « Recharger » (les crédits s'ajoutent, n'expirent pas).
7. **Passage en LIVE** : uniquement une fois le sandbox validé — remplacer les
   secrets par les clés live et `GENIUSPAY_ENV=live`.

### Simuler le webhook sans GeniusPay (test manuel de la signature)

```bash
SECRET='<GENIUSPAY_WEBHOOK_SECRET de test>'
REF='<provider_ref d''un paiement pending existant (= référence GeniusPay)>'
TS=$(date +%s)
BODY='{"event":"payment.success","data":{"reference":"'"$REF"'","status":"completed","id":"txn_test_1"}}'
SIG=$(printf '%s' "$TS.$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')
curl -sS -X POST \
  https://rgmaisiggksjnkxdhytv.supabase.co/functions/v1/geniuspay-webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Timestamp: $TS" \
  -H "X-Webhook-Signature: $SIG" \
  -d "$BODY"
# → {"received":true,"result":"applied"} puis {"received":true,"result":"duplicate"} au rejeu
```

## Relances mensuelles (J-7 / J-3 / J0 + expiration)

Fonction : `subscription-reminders` (protégée par `x-cron-secret`).
- J-7 / J-3 / J0 avant `current_period_end` → email (Resend), une fois par
  période (dédup via `billing_reminders`).
- Échéance dépassée → `expire_subscription` : `plan=free`, `status=expired`,
  crédits mensuels retombent (10 000 affichés), **les crédits de packs restent**,
  **aucun blocage** (accès conservé en gratuit).
- **WhatsApp** : branchement prévu mais **désactivé** (`WHATSAPP_ENABLED=false`)
  — n'empêche jamais l'email.

Planifier un appel quotidien (au choix) :

```sql
-- Option pg_cron + pg_net (à exécuter une fois, avec l'URL et le CRON_SECRET) :
select cron.schedule('look360-reminders', '0 8 * * *', $$
  select net.http_post(
    url := 'https://rgmaisiggksjnkxdhytv.supabase.co/functions/v1/subscription-reminders',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
  );
$$);
```

Test manuel :
```bash
curl -sS -X POST \
  https://rgmaisiggksjnkxdhytv.supabase.co/functions/v1/subscription-reminders \
  -H "x-cron-secret: <CRON_SECRET>"
# → {"ok":true,"reminded":N,"expired":M,"scanned":K}
```

## Note d'intégration GeniusPay

Le mapping requête/réponse HTTP est centralisé dans
`supabase/functions/_shared/geniuspay.ts`, aligné sur l'intégration GeniusPay
déjà en prod :
- **endpoint** : `POST https://geniuspay.ci/api/v1/merchant/payments`.
- **en-têtes** : `X-API-Key`, `X-API-Secret` (pas de Bearer).
- **requête** : `{ amount, currency:'XOF', description, metadata, [mmo_provider],
  customer:{ country } }`. **Pas** de `reference`/`callback_url`/`return_url`
  (GeniusPay génère la référence). **Jamais** `payment_method:'pawapay'`,
  **jamais** une autre devise que XOF, montant **≥ 200**.
- **réponse** : `data.reference` (ou `data.id`) + `data.checkout_url`,
  `success !== false`, HTTP 200/201.
- **webhook** : signature `HMAC-SHA256(${timestamp}.${body})`,
  en-têtes `X-Webhook-Signature` / `X-Webhook-Timestamp`.

Validé en sandbox : `POST` → `201 { success:true, data:{ reference, checkout_url } }`
(« Sandbox payment initiated successfully »).

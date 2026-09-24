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
| `GENIUSPAY_ENV` | `sandbox` (puis `live` après validation) |
| `GENIUSPAY_API_KEY` | clé publique API GeniusPay |
| `GENIUSPAY_API_SECRET` | clé secrète API GeniusPay |
| `GENIUSPAY_WEBHOOK_SECRET` | secret de signature du webhook (HMAC-SHA256) |
| `SITE_URL` | ex. `https://look360.io` — `return_url` + liens emails |
| `CRON_SECRET` | protège la fonction de relances (`x-cron-secret`) |
| `RESEND_API_KEY` | envoi des emails de relance |
| `EMAIL_FROM` | ex. `Look360 <no-reply@look360.io>` (optionnel) |
| `GENIUSPAY_API_BASE` | *optionnel* — override de l'URL API si le sandbox diffère |
| `PAYMENT_PROVIDER` | *optionnel* — défaut `geniuspay` |

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
- L'`return_url` n'a pas à être configuré : il est fourni dynamiquement par
  `geniuspay-create-payment` (`SITE_URL/offres?pay=return&ref=…`).

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
REF='<provider_ref d''un paiement pending existant>'
BODY='{"event":"payment.success","reference":"'"$REF"'","transaction_id":"txn_test_1","timestamp":'"$(date +%s)"'}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')
curl -sS -X POST \
  https://rgmaisiggksjnkxdhytv.supabase.co/functions/v1/geniuspay-webhook \
  -H "Content-Type: application/json" \
  -H "x-geniuspay-signature: $SIG" \
  -d "$BODY"
# → {"ok":true,"result":"applied"} puis {"ok":true,"result":"duplicate"} au rejeu
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
`supabase/functions/_shared/geniuspay.ts` :
- requête : `amount`, `currency:'XOF'`, `description`, `reference`,
  `callback_url`, `return_url`, `metadata`, `customer{ id,email,name,country }` —
  **jamais** `payment_method:'pawapay'`, **jamais** une autre devise que XOF.
- réponse : l'URL de checkout est extraite de façon tolérante
  (`checkout_url` / `payment_url` / `data.link`…).

Si le sandbox renvoie des noms de champs différents (endpoint, en-tête de
signature, clé d'URL), c'est **le seul fichier à ajuster**.

# Audit design Look360, octobre 2026

**Périmètre.** Production (`https://look360.io`), connecté avec le compte de test (plan Business). 19 routes × 3 tailles d'écran (1440, 834, 390 px). Lecture seule : le script n'a fait que naviguer, aucun formulaire envoyé à part la connexion.

**Outils.**

| Outil | Ce qu'il a fait | Limite |
|---|---|---|
| Playwright (`scripts/design-audit.js`) | Captures, mesures dans la page : contraste WCAG calculé, tailles de texte, cibles tactiles, débordement horizontal, landmarks et titres, labels, focus clavier sur 12 tabulations | Contraste calculé sur fond uni (les fonds en image ou en dégradé sont ignorés) |
| Impeccable 4.8 (`audit`) | Grille de score sur 5 dimensions et sévérités P0 à P3, appliquée à la main | Le binaire `impeccable context/detect` a été bloqué dans l'environnement (code externe), donc pas de détecteur automatique |
| UI UX Pro Max | Checklist prioritaire : a11y, tactile, perf, typo et couleur, formulaires, navigation | Le script `search.py` n'a pas été lancé, seules les règles de référence ont servi |
| SkillUI 1.3.4 | Rétro-ingénierie statique du dépôt (`--dir`), comparée aux tokens réels | Voir § 6 |

**Non couvert.** La page Testing / verdict (l'écran signature) et les fiches produit / test : le compte de test n'a **aucun produit ni test**, donc seuls leurs états vides ont été vus. L'admin redirige ce compte vers `/recherche`, ce qui est normal. Les médias Meta et Bunny étaient en partie bloqués par le proxy du conteneur d'audit. Les « Aperçu indisponible » sont donc plus nombreux sur les captures qu'en vrai, et les temps de chargement de `/recherche` et `/top-trend` sont gonflés.

---

## Score de santé (Impeccable)

| # | Dimension | Score | Constat principal |
|---|---|---|---|
| 1 | Accessibilité | **2/4** | Le vert `--success` en texte fait 2,54:1 sur blanc, dans 25 fichiers |
| 2 | Performance | **3/4** | 1,5 à 3 s par écran app, images en `loading="lazy"`, rien de bloquant |
| 3 | Theming | **3/4** | Tokens bien suivis dans l'app. Reste 94 tailles `text-[9/10/11px]` arbitraires et les badges de rang en palette Tailwind brute |
| 4 | Responsive | **3/4** | Aucun débordement horizontal sur 390 et 834 px. Bannière Offres cassée sur mobile, cibles de 16 px |
| 5 | Intégrité | **2/4** | « Gratuit » écrit en dur pour un compte Business, CGU « gabarit » en prod, badges qui se chevauchent |
| **Total** | | **13/20** | **Acceptable : du travail ciblé, pas de refonte** |

### Verdict d'intégrité : réussi, avec réserves

Le système existe et l'app le respecte. Partout : une seule police (DM Sans, 100 % des nœuds texte), icônes Lucide, sidebar navy et contenu clair, rayons 12/18 px, presque aucune ombre au repos, un `PageHeader` partagé (12 écrans), des états vides avec CTA sur tous les écrans vides. Les écarts sont **localisés**. Le plus grave touche à l'honnêteté des données (§ P1-1), une règle explicite du skill Look360.

---

## Constats par sévérité

Décompte : **P0 : 0 · P1 : 5 · P2 : 7 · P3 : 3**

### P1 : à corriger avant la prochaine release

**P1-1. Plan « Gratuit » affiché en dur, quel que soit le plan réel** *(Intégrité, honnêteté des données)*
- `src/app/(app)/recherche/page.tsx:25` : pastille « Gratuit · 0 recherche ».
- `src/app/(app)/bienvenue/page.tsx:65` : « Ton compte **Gratuit** est activé ». L'étape 1 dit aussi « passe en Starter ».
- Avec le compte de test (Business), la sidebar, Offres et Paramètres disent « Business » mais le feed dit « Gratuit ». L'utilisateur payant croit que son abonnement n'est pas actif.
- Correctif : lire le plan via `PlanProvider` / `planLabel(plan)`. Sur la pastille du feed, n'afficher le « 0 recherche » que si c'est vrai (le feed ne consomme pas de crédit : formuler « Feed inclus · ne consomme pas de recherche »). → `/impeccable harden`

**P1-2. Le vert succès en texte échoue au contraste WCAG AA** *(A11y, WCAG 1.4.3)*
- `--success: #10b981` utilisé en `text-success` (25 fichiers, landing incluse) : **2,54:1** sur blanc, **2,36:1** sur `bg`. Concerné : « Score 87 · Fort potentiel », « Tourne depuis 352 j », « Actif », « Validé », « Actuelle », le compteur « Validés » de Mes produits, le « 73 % » de la Vitrine. `text-warn` (#f59e0b) est encore pire (environ 2,1:1, 10 fichiers).
- Ces pastilles portent l'information clé des cartes (score, ancienneté).
- Correctif : ajouter dans `tokens.css` (extension Look360) des teintes texte `--success-fg: #047857` (≈ 5,5:1), `--warn-fg: #b45309` (≈ 5:1) et `--danger-fg: #b91c1c`. Les exposer en `text-success-fg` etc. et réserver `--success` aux fonds, anneaux et icônes. → `/impeccable colorize`

**P1-3. CGU « gabarit » en production** *(Intégrité)*
- `/cgu` affiche « Dernière mise à jour : [date à fournir] » et « Ce document est un gabarit… ». Pour un produit payant, c'est un signal de non-fini, et un risque juridique.
- Correctif : contenu définitif ou retrait du lien. *(Marketing hors migration design : seul le contenu est en cause.)*

**P1-4. Top Trend : le badge de rang masque le libellé VIDÉO/IMAGE** *(Intégrité, visuel)*
- `src/components/AdGrid.tsx:32` : badge `absolute -left-2 -top-2 z-30` posé exactement sur la pastille de type de `CreativeMedia` (on lit « DÉO »). Voir `top-trend-badges.png`.
- Même zone : le bouton ▶ se superpose au texte « Aperçu indisponible » (texte coupé en « Aperçu… ponible ») quand une vidéo n'a pas de miniature.
- Correctif : décaler la pastille de type quand `ranked`, ou mettre le rang dans le pied de carte. Pour le fallback vidéo, afficher soit ▶ soit le message, pas les deux. → `/impeccable layout`

**P1-5. Cibles tactiles sous 24 px dans le Spy** *(Responsive / A11y, WCAG 2.5.8)*
- `CountryMultiSelect.tsx:122`, bouton « Retirer France » : **16×16**. `:193`, cases à cocher **16×16**. Checkbox « Inclure les pubs inactives » : 16×16. Pastille compteur `0/700` du header mobile : 71×23.
- Le Spy est le flux principal. Sur mobile, retirer un pays demande de la précision.
- Correctif : zone cliquable ≥ 24 px (idéalement 44) avec un padding invisible. L'icône peut rester petite. → `/impeccable adapt`

### P2 : prochaine passe

**P2-1. Trois styles de bouton primaire concurrents.** Bleu plein (standard), noir `#111827` (Bienvenue × 3, « Commencer avec Starter ») et dégradé bleu avec ombre (« Choisir Pro »). Le skill demande un bleu « délibéré ». Ici le noir et le dégradé brouillent la hiérarchie de l'action principale. Garder bleu plein pour le primaire et bordure pour le secondaire. → `/impeccable polish`

**P2-2. Bannière « Offre de lancement » cassée sur mobile.** `OffresClient.tsx:298` : le `<sup>er</sup>` devient un item flex séparé, ce qui donne « sur le 1 » puis « er mois » sur deux lignes à 390 px (voir `offres-banniere-mobile.png`). Envelopper le texte dans un seul `<span>`. Le fond orange et les badges `-33 %` orange s'ajoutent à une page déjà chargée. → `/impeccable quieter`

**P2-3. Échelle typo : 11 px comme taille dominante, plus 94 tailles arbitraires.** Sur les écrans app, **4 460 nœuds texte à 11 px** contre 783 à 13 px. On compte aussi `text-[11px]` × 48, `text-[10px]` × 29, `text-[9px]` × 15 et un `<sup>` à 8,25 px. Le `--muted` (#64748b) sur `bg` (#f4f7fb) fait **4,43:1**, juste sous 4,5 : sous-titres de page, « Mot de passe oublié ? ». Remplacer les tailles arbitraires par `text-xs`, et assombrir légèrement `--muted` (par exemple `#5b6b82`) pour passer 4,5:1 sur `bg`. → `/impeccable typeset`

**P2-4. Focus des champs = simple changement de bordure.** `login/page.tsx:12` (`outline-none focus:border-accent`), recherche de Mes produits, champ du Spy, selects de Top Trend (« Toutes », « 30 derniers jours ») : le script n'a trouvé ni outline ni ring au focus. Les boutons et les liens de nav ont bien un anneau. Ajouter `focus-visible:ring-2 ring-accent/40` au style de champ partagé. → `/impeccable harden`

**P2-5. Cartes pub : 5 à 7 actions par carte.** Ad Library, Boutique, Analyser, Surveiller, Regarder, Télécharger, plus le CTA « Ajouter à mes produits ». Le bas de carte pèse plus que la créative et le titre. Le skill (§ 8) demande de ne pas transformer la carte en mini-dashboard. Garder « Ajouter » et « Analyser », et passer le reste dans un menu `…` ou au survol. → `/impeccable distill`

**P2-6. Login et Mot de passe oublié sans `<h1>`.** Ces deux pages n'ont aucun titre de niveau 1. Les lecteurs d'écran n'ont donc pas de repère. Le logo et le sous-titre peuvent devenir un `h1` visuellement identique. → `/impeccable harden`

**P2-7. Interrupteur « Vitrine communautaire » sans nom accessible.** `parametres/ShareToggle.tsx` : `role="switch"` avec `aria-checked`, mais sans `aria-label` ni `aria-labelledby`. Le libellé visible juste à côté n'est pas relié. → `/impeccable harden`

### P3 : finitions

- **Médailles en emoji** 🥇🥈🥉 et couleurs `amber-100 / slate-200 / orange-100` hors tokens (`AdGrid.tsx:9-14`). Le skill proscrit l'emoji comme icône. Utiliser des chiffres sur les tokens accent / warn.
- **`--radius-lg` et `--radius-xl` valent tous deux 18 px** (`globals.css:70-71`). C'est une étape d'échelle morte : la supprimer ou la différencier.
- **En-tête de la page Offres** : `h1` 42 px sans la barre d'accent du `PageHeader`, alors que tous les autres écrans l'ont. Réutiliser `PageHeader`.

---

## Problèmes systémiques

1. **Les couleurs sémantiques servent à la fois de fond et de texte.** Un seul token par statut sert au fond doux, à l'icône et au texte. Résultat : du texte vert, orange ou rouge illisible partout (P1-2). Il faut une paire `*-fg` par statut.
2. **Micro-texte.** La densité « outil de recherche » est voulue, mais elle a glissé de 13 px vers 11, 10 puis 9 px. Fixer un plancher à `text-xs` (11 px) pour le texte qui porte une info, et l'appliquer.
3. **Textes qui dépendent du plan écrits en dur.** Mots « Gratuit » et « Starter » dans la copie. Tout libellé lié au plan doit passer par `planLabel()`.

## Ce qui marche (à garder)

- **Shell** : sidebar navy, item actif lisible sans se fier à la couleur seule (fond, barre et graisse), menu burger plus pastille de crédits sur mobile. Conforme à l'identité.
- **Discipline des tokens dans l'app** : les couleurs hex en dur dans `src/app/(app)` et `src/components` (hors landing et admin) sont absentes (les seules occurrences sont dans la landing et les graphiques admin). Une seule police, une seule famille d'icônes.
- **États vides** : Mes produits, Testing, Winners, Surveillance et Spy ont tous un titre explicite, une phrase utile et un CTA vers la bonne étape. Rien d'inventé.
- **Responsive** : **zéro débordement horizontal** sur les 38 combinaisons écran × taille mobile et tablette. Les filtres du Spy passent proprement en 2 colonnes.
- **Accessibilité de base** : `<main>`, `<nav>` et `<header>` présents, un seul `h1` par écran app, tous les champs labellisés (sauf la recherche de Mes produits, qui n'a qu'un placeholder), `prefers-reduced-motion` géré, anneau de focus visible sur boutons et liens.
- **Honnêteté de la Vitrine** : « 1 winner validé · données anonymisées », seuil de 10 commandes expliqué. C'est exactement le ton du skill.
- **Score produit transparent** : `lib/score.ts` documente ses 4 composantes. On pourrait l'exposer à l'utilisateur dans une infobulle « pourquoi 87 ? ».

---

## SkillUI : ce que révèle l'extraction statique

SkillUI a reconstruit un DESIGN.md à partir du code. Voici les écarts avec la vérité :

- **7 couleurs détectées seulement.** `success`, `warn`, `danger`, `sidebar-bg` et `bg` manquent, et `border-soft` est pris pour le fond de page.
- **Typo lue comme les valeurs Tailwind par défaut** (48 / 32 / 24 / 16 / 12 px), alors que l'échelle réelle est 11 / 13 / 15 / 17 / 22 / 30 / 42 px.
- **« No breakpoints detected »** et rayons « 2 à 24 px ».

C'est une limite de l'outil, pas un bug Look360. Mais cela montre que les tokens sont peu lisibles par une machine : ils passent par trois couches (`design-system/tokens.css`, puis `@theme` dans `globals.css`, puis les alias de compat). Un agent ou un outil qui ne lit que Tailwind se trompera. Le `design-system/design-tokens.json` existant devrait être tenu à jour comme export de référence. → `/impeccable document`

---

## Actions recommandées (ordre)

1. **[P1] `/impeccable harden`** : plan réel au lieu de « Gratuit » (feed, bienvenue). `h1` sur l'auth, nom accessible de l'interrupteur, focus des champs.
2. **[P1] `/impeccable colorize`** : tokens `success-fg / warn-fg / danger-fg`, puis migration des 25 + 10 fichiers concernés.
3. **[P1] `/impeccable layout`** : badges de Top Trend et fallback vidéo de `CreativeMedia`.
4. **[P1] `/impeccable adapt`** : cibles ≥ 24 px dans `CountryMultiSelect` et les cases à cocher.
5. **[P1] Contenu** : CGU définitives.
6. **[P2] `/impeccable typeset`** : supprimer les `text-[9/10/11px]` et ajuster `--muted`.
7. **[P2] `/impeccable distill`** : alléger les actions des cartes pub.
8. **[P2] `/impeccable polish`** : un seul style de bouton primaire, en-tête Offres, bannière mobile. Passe finale.

**Avant la prochaine passe** : ajouter au compte de test au moins un produit en test avec ≥ 10 commandes, et un autre à 7/10, pour pouvoir auditer l'écran verdict (anneau de closing, jauge de marge, badge Rentable / Moyen / Pas rentable).

Pour relancer : `AUDIT_EMAIL=… AUDIT_PASSWORD=… node scripts/design-audit.js`.

# Benchmark : Search The Trend (31/10/2026)

Les écrans observés avec un compte gratuit, en lecture seule, sont : Ads, Products, Advertisers, Brands, une fiche marque, la version mobile et la landing. Les styles viennent du rendu calculé (Playwright) et de SkillUI. **But : s'en inspirer, ne pas les copier.**

## 1. Structure
- **Cadre** : barre latérale presque noire (bleu nuit). Le contenu est un grand panneau clair aux coins arrondis, posé dans ce cadre.
- **Navigation** groupée (« Analyse », « Boards »), avec des badges d'état (Beta, New, Soon) et un encart « What's new ». Le compte et l'offre sont en bas.
- **Barre du haut** : une recherche globale (« keywords, products, brands ») sur toutes les pages, avec l'aide à droite.
- **Une barre de filtres par liste**, adaptée à chaque page :
  - Ads : variations, niche, média, format, CTA, type de landing, techno, date…
  - Products : niche, type de boutique, pays, langue, thème, pubs actives, dépense EU/UK, revenu…
  - Le tri est toujours à droite (« Sort: … »).
  - Sur mobile, la barre défile horizontalement avec une flèche.
- **Vues Grille et Liste** sur Products. Advertisers est un tableau.

## 2. Cartes
- **Pub** :
  - en-tête avec logo de la page, point vert « Active », durée (« 17 h ») et rang (« 347/372 ») ;
  - texte sur 2 lignes avec « Show more » ;
  - média carré ou vertical en grand ;
  - pied avec drapeau, nombre de variantes, titre, domaine et « Shop now » ;
  - **une seule action** (« View details ») plus une icône pour enregistrer.
- **Produit** :
  - badge d'état (« Scaling ») ;
  - **gros chiffre** (« 3 484 pubs actives ») avec la variation (« +3,3K en 30 jours ») et une courbe ;
  - revenu estimé en fourchette ;
  - grille Visites / Marché / Prix.
- **Marque** : capture de la boutique, méta (date, langue, devise, thème), puis courbes des visites et des pubs actives avec drapeaux par pays.

## 3. Style mesuré
- **Police** : sans-serif système, avec des **chiffres tabulaires**. Graisse maximale 500 : rien n'est en gras lourd.
- **Tailles** : texte dense de 12 à 14,5 px, gros chiffres de 20 à 28 px.
- **Couleurs** :
  - texte principal `#1f2328`, texte secondaire `#59636e` ;
  - bleu d'action `#1165ef`, liens `#0969da` ;
  - vert de hausse `#1a7f37`, rouge pour les baisses ;
  - fond de liste gris très clair, cartes blanches.
- **Cartes** : rayon de 16 px, bordure `rgba(209,217,224,.7)`, ombre très légère (2 couches à 4–6 %). Les boutons et puces ont un rayon de 6 à 10 px ; les filtres et tags sont en pilule.
- **Landing** sombre (bleu nuit, bleu électrique, halos), mais **application claire**.

## 4. Ce que Look360 doit retenir (direction A)
1. Les **chiffres en vedette** dans les cartes, uniquement avec des données réelles : durée de diffusion, variantes, pubs actives, reach, score.
2. **Une action principale par carte.** Les autres passent dans un menu « ⋯ ».
3. Une **barre de filtres et un tri** sur chaque liste. Le Feed n'en a aucun aujourd'hui.
4. Une **recherche globale** en haut.
5. Le contenu dans un **panneau arrondi** à l'intérieur du cadre bleu nuit.
6. La **navigation groupée** (Trouver / Suivre).
7. Des **chiffres tabulaires**, une graisse sobre et moins de pastilles colorées.
8. Les **courbes** sur les fiches d'analyse (évolution des pubs actives, pays).

## 5. Ce que Look360 ne doit pas reprendre
- Les **chiffres non vérifiables**, comme le revenu estimé. Les règles Look360 interdisent les métriques inventées.
- La **bannière d'upsell fixe** qui couvre le bas de l'écran sur toutes les pages, y compris mobile.
- La **police système** : Look360 garde DM Sans (règle du design system).

Maquette : `maquette-feed-direction-a.html`, construite avec des pubs réelles du feed et les tokens Look360.

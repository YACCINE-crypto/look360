// Coût réel estimé par crédit consommé (FCFA).
// ⚠️ PARAMÈTRE d'estimation de marge — PAS une donnée de la base. À ajuster
// selon les coûts fournisseurs réels (Apify recherche, Bunny média, etc.).
// La « marge nette » affichée dans le cockpit est donc une ESTIMATION :
//   coût estimé = crédits consommés × COST_PER_CREDIT_FCFA
//   marge nette = revenu réel − coût estimé
// Exemple : une recherche = 1 000 crédits/pays → 50 FCFA de coût à 0,05.
export const COST_PER_CREDIT_FCFA = 0.05;

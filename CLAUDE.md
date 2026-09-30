@AGENTS.md

# Design system (OBLIGATOIRE)

**Source de vérité des tokens = `/design-system/tokens.css`** (design system OpenDesign
« dashboard », Apache 2.0, + extensions Look360). Exposés en utilitaires Tailwind dans
`src/app/globals.css` (bloc `@theme`).

- **Tout nouvel écran / composant DOIT utiliser ces tokens**, jamais de couleurs,
  tailles, rayons ou ombres **en dur** (pas de hex, pas de `px` arbitraires pour ce qui
  est tokenisé).
- Utilitaires canoniques : `bg-bg`, `bg-surface`, `text-fg`, `text-fg-2`,
  `text-muted-foreground`, `border-border`, `bg-accent` / `text-accent` / `text-accent-on`
  (accent = bleu Look360 `#1a56db`), `text-success` / `text-warn` / `text-danger`
  (+ fonds doux `bg-success-bg` / `bg-warn-bg` / `bg-danger-bg`), rayons
  `rounded-md|lg|xl`, ombres `shadow-card` / `shadow-lift` / `shadow-raised`.
- **Sidebar navy** : tokens `sidebar-bg`, `sidebar-fg`, `sidebar-muted`,
  `sidebar-active-bg`, `sidebar-active-fg`, `sidebar-hover-bg`. Contenu = clair.
- **Patterns de composants = `/design-system/components.html`** (styles/états de
  référence) ; intentions & anti-patterns = `/design-system/DESIGN.md`.
- Nouveaux tokens : les ajouter dans `/design-system/tokens.css` (section « Extension
  Look360 »), jamais redéfinir de valeurs ailleurs.
- **Migration progressive** : les écrans historiques utilisent encore des alias de
  compatibilité (`bg-primary`, `text-foreground`…) qui pointent vers les mêmes tokens ;
  on les migre un écran à la fois vers les noms canoniques (Pipeline déjà migré).
- **La landing (`src/app/(marketing)/**`) N'EST PAS migrée** (choix produit) : elle
  garde les alias de compat et son échelle typo actuelle. Ne pas la refondre.

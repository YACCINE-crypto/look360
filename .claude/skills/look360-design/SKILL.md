---
name: look360-design
description: Design and frontend craft system for Look360. Use when creating, redesigning, or modifying any Look360 interface, including dashboards, product research, ad-spy screens, product cards, filters, tables, analytics, onboarding, landing pages, and responsive layouts.
---

# Look360 Design Skill

## Purpose

Build Look360 as a polished, production-grade SaaS for e-commerce product research and validation.

The goal is not to make an interface merely "beautiful". The goal is to make Look360 feel like a real product designed by an experienced product/design team: distinctive, coherent, information-dense where appropriate, easy to scan, and visually credible.

This skill incorporates the useful design principles of Open Design's frontend-design approach:

- understand the product before choosing the visual direction;
- commit to a coherent aesthetic direction;
- avoid generic AI-generated UI patterns;
- design real product states, not mockup posters;
- use production-quality frontend practices;
- refine typography, color, layout, motion and component details;
- self-review before delivery.

Look360-specific rules below override generic recommendations whenever there is a conflict.

---

## 1. PRODUCT CONTEXT

**Product.** Look360 is a product-research and validation SaaS for e-commerce entrepreneurs. Its core workflow is: research products → discover potential winners → inspect advertising activity → compare products → test products → analyze performance → validate profitability → decide what deserves investment. The product should feel like a serious research/work tool, not a generic AI SaaS.

**Primary users.** E-commerce entrepreneurs, especially African COD operators, who repeatedly: search for products; inspect ads; compare products; evaluate demand; test offers; analyze COD performance; estimate profitability; make investment decisions. They work mainly on a laptop/desktop, so desktop is the primary target and can carry high information density. Mobile must still work and keep the main workflow usable, but desktop leads.

**Product personality.** analytical • fast • confident • practical • modern • professional • data-driven • focused • premium without being luxurious • simple without being simplistic.

Avoid making it feel: childish, overly playful, corporate-bank-like, futuristic for its own sake, or like an AI-generated dashboard template.

---

## 2. CORE DESIGN PRINCIPLE

Every screen must answer: "What is the user trying to accomplish here, and what information or action helps them accomplish it fastest?"

Do not design screens as collections of decorative cards. Priority:
1. hierarchy 2. scanability 3. useful information 4. clear actions 5. consistency 6. visual identity 7. decoration.

A component that does not help the workflow should not exist merely to fill space.

---

## 3. VISUAL DIRECTION

Use a refined analytical SaaS aesthetic: modern product-intelligence platform; research workstation; clean editorial data interface; dense but breathable dashboard. Enough personality to be recognizable as Look360 without visual gimmicks.

**Brand color — primary: `#1A56DB`.** Use it deliberately for: primary actions; active navigation; selected states; important links; key interactive elements; brand accents. Do NOT make every element blue. Use neutral surfaces and borders to create hierarchy.

**Signature layout — dark nav + light content.** Look360 uses a dark navy primary navigation (the left sidebar / main nav, around `#0F1B3D`, light text, active item highlighted in the brand blue) paired with light content surfaces. This split is part of Look360's identity and premium feel — do NOT make the sidebar light/white.

**Neutral direction (content area):** white primary surfaces; very light gray/blue application background; subtle neutral borders; dark text; muted secondary text. Do not invent a completely different brand palette unless explicitly requested.

---

## 4. TYPOGRAPHY

Primary typeface: **DM Sans**. Create hierarchy through size, weight, line-height, spacing and contrast. Avoid excessive font-weight variation. Use strong, readable headings. Data-heavy interfaces should prioritize compact labels, highly readable numbers, aligned metrics and predictable tabular information (use tabular/lining figures for metrics). Never use typography as decoration at the expense of usability.

---

## 5. ANTI-AI-SLOP RULES

Avoid generic AI-generated visual patterns. Do NOT default to: purple-to-blue gradients; huge gradient text; glassmorphism without functional reason; excessive backdrop blur; giant rounded rectangles; every section inside a card; excessive floating cards; decorative blobs; random abstract 3D shapes; stock-icon grids; excessive emoji; generic "AI sparkle" icons; unnecessary neon effects; overly soft shadows everywhere; excessive pill-shaped UI; identical dashboard cards repeated across the page; generic SaaS hero layouts; meaningless decorative charts; fake metrics invented to make a screen look populated.

Do not make Look360 look like a clone of a generic Tailwind/SaaS template. If a visual element does not communicate hierarchy, state, data or interaction, question whether it should exist.

---

## 6. LAYOUT

Deliberate spacing rhythm: clear alignment; consistent gutters; predictable content widths; strong vertical rhythm; intentional whitespace; controlled information density. Dashboards should be more information-dense than marketing pages. Do not force excessive whitespace into operational screens. Do not make every section full-width when a narrower content column improves readability. Use grids when they improve comparison. Use flexible layouts rather than hardcoded positioning.

---

## 7. DASHBOARD PRINCIPLES

Look360 is used repeatedly, so dashboards must be scannable, fast to understand, information-rich, visually calm and consistent. A dashboard should not feel like a presentation slide. Prioritize: navigation; search; filters; sorting; comparison; status; key metrics; actionable next steps. For product-research screens, users should understand the important information without opening every item.

---

## 8. PRODUCT CARDS

Product cards communicate useful research information. Depending on the screen, a card may include: product image; name; market/country; ad activity; platform; active/inactive status; engagement; date; category; research/validation status; relevant action. Do not put every possible metric into every card. Choose information based on the user's current task. Avoid turning cards into miniature dashboards.

---

## 8b. SIGNATURE SCREEN — TESTING / VERDICT

The testing / verdict experience is Look360's differentiator (no competitor has it) and must be the most polished data-visualization in the app. It should read instantly:

- **Closing rate** → a colored progress ring (green / amber / red by threshold), not a bare number.
- **Net margin** → a gauge or colored bar.
- **Verdict** → a clear badge: Rentable (green) / Moyen (amber) / Pas rentable (red).
- A test only becomes "validated" at ≥ 10 orders received; before that, show progress (e.g. "7/10") instead of a verdict.

Make this screen feel confident and credible — it is where the user decides to invest money.

---

## 9. TABLES AND DATA

Tables matter for Look360. Use them for comparison, sorting, scanning many products, checking metrics, filtering, reviewing results. Align numbers consistently; keep headers clear; subtle row separation; readable density; avoid excessive borders; highlight meaningful states only; make sortable columns understandable; support horizontal scrolling on small screens when necessary. Do not convert useful tables into cards just because cards look more modern.

---

## 10. FILTERS AND SEARCH

Search and filters are first-class functionality: easy to discover; compact; predictable; easy to clear; visually grouped; responsive. With many filters, use progressive disclosure rather than a wall of controls. Always make the current filtering state understandable and provide an obvious reset.

---

## 11. NAVIGATION

Navigation reflects the user's mental model. Avoid unnecessary menu items. Clear labels. Active states unmistakable but restrained; do not rely on color alone. Icons support labels, not replace them when meaning is ambiguous.

---

## 12. COMPONENTS

Build reusable components. Prefer the repository's existing component system, tokens, primitives, icon library and styling conventions. Do not introduce a second UI framework or duplicate components without reason. Maintain consistent radius, borders, shadows, spacing, typography, control heights and interaction states. Do not randomly change component styling from screen to screen.

---

## 13. BORDER RADIUS

Moderate, consistent rounding that communicates grouping and hierarchy. Avoid heavily rounding every element, giant pill containers, excessive "bubble UI". Buttons: moderate rounding. Inputs, cards and panels share a coherent radius scale.

---

## 14. SHADOWS

Use shadows sparingly: prefer subtle elevation, borders, surface contrast. Do not give every card a floating shadow. Use stronger elevation only when an element must appear above surrounding content: dropdown, modal, popover, floating action, important overlay.

---

## 15. ICONOGRAPHY

One coherent icon family (**Lucide**). Do not mix random icon styles. Icons communicate meaning, support navigation, reinforce actions, and remain visually subordinate to important text/data. Avoid decorative icons that add no meaning.

---

## 16. MOTION

Motion communicates state and interaction: subtle transitions for hover, focus, selected states, opening/closing, loading, filtering, navigation, feedback. Prefer performant transforms and opacity. Avoid excessive animation, constant movement, attention-seeking effects, long transitions that slow the workflow. The interface should feel responsive, not animated for entertainment.

---

## 17. REAL PRODUCT STATES

Never design only the ideal populated state. Handle:

- **Loading** — appropriate skeletons or lightweight indicators.
- **Empty** — explain what is empty and what the user can do next (CTA). A good empty state shows the promise, it does not just say "nothing here".
- **Error** — explain the problem in useful language and offer a recovery action.
- **No search results** — explain the query/filter returned nothing and make it easy to change the search.
- **Disabled** — visually clear without being confusing.
- **Success** — concise confirmation when an action completes.
- **Partial/unavailable data** — never invent; use labels like unavailable, pending, not yet analyzed, sample data.

---

## 18. DATA HONESTY

Never invent: product performance; ad metrics; revenue; profitability; user counts; conversion rates; testimonials; market statistics. If data is unavailable, represent the unavailable state honestly. This is critical because Look360 is a research and validation product — fake data destroys trust.

---

## 19. RESPONSIVE DESIGN

Design for desktop, tablet and mobile. Desktop is the primary target (e-commerce operators work on laptops) and can support higher information density. Mobile must still work: preserve the main workflow; collapse secondary information; use horizontal scrolling for genuinely tabular data when needed; avoid tiny unreadable text; keep primary actions accessible. Do not simply shrink the desktop layout, and do not break mobile.

---

## 20. ACCESSIBILITY

Use semantic HTML; keyboard-accessible controls; visible focus states; sufficient contrast; meaningful labels; appropriate button/link semantics; accessible form controls. Do not communicate important information through color alone.

---

## 21. IMPLEMENTATION RULES

Before changing an existing Look360 interface: inspect the existing component system; inspect existing design tokens; inspect DESIGN.md if present; reuse existing components; preserve existing product behavior unless the task requires changes; avoid unnecessary dependencies; avoid rewriting unrelated code; keep it maintainable.

**Design tokens are the single source of truth.** They live in the project's global token file — for Look360 that is **`/design-system/tokens.css`** (exposed as Tailwind utilities in `src/app/globals.css`). Always reference these CSS variables / token utilities for colors, spacing, radii, shadows, typography and transitions. Never hardcode colors or sizes per screen — that is a primary cause of an inconsistent, "AI-generated" look.

---

## 22. DESIGN BEFORE CODE

For a new major screen: understand the user job; identify primary and secondary actions; identify the information hierarchy; decide the layout; decide required components; define important states; then implement. Do not start by randomly generating cards.

---

## 23. LOOK360 VISUAL IDENTITY

The memorable quality of Look360 comes from: clarity + information hierarchy + research-oriented density + disciplined blue accent + the dark-nav/light-content split + excellent typography + coherent interaction design. Not from flashy gradients, visual effects, excessive animation or novelty components. Look360 should feel like a tool users trust to make product-research decisions.

---

## 24. WHEN MODIFYING EXISTING UI

Do not automatically redesign everything. First identify what already works; what is inconsistent; what is visually generic; what harms usability; what conflicts with Look360's design system. Then make the smallest coherent set of changes needed. Preserve existing functionality.

---

## 25. SELF-REVIEW CHECKLIST

- **Product:** Does the screen clearly serve a real Look360 workflow? Are primary actions obvious? Is the hierarchy logical?
- **Visual:** Does it look like Look360 (dark nav + light content)? Is `#1A56DB` used deliberately, not excessively? Is DM Sans consistent? Are spacing, alignment, radii and shadows coherent?
- **Anti-AI-slop:** Any unnecessary gradient or glassmorphism? Too many rounded cards? Decorative elements with no purpose? Does it resemble a generic AI SaaS template? Repeated components that could be simplified?
- **UX:** Are loading, empty and error states handled? Are controls understandable? Are filters and search clear? Are interactive states visible?
- **Responsive:** Does desktop work (primary)? Tablet? Mobile? Does data remain readable?
- **Technical:** Are existing components reused? Are tokens used consistently (no hardcoded values)? Semantic HTML? Keyboard/focus states? Were unrelated parts left untouched?

---

## 26. PRIORITY ORDER

When rules conflict:
1. Existing Look360 product requirements →
2. Existing Look360 design system / DESIGN.md →
3. Existing repository component conventions →
4. This Look360 skill →
5. Generic frontend/design conventions.

Never sacrifice an explicit Look360 product requirement merely to make the interface more visually impressive.

---

## FINAL PRINCIPLE

Do not ask: "How can I make this look like a modern SaaS?" Ask: "How should a serious e-commerce researcher use Look360 repeatedly every day, and what interface would make that workflow feel fast, clear and trustworthy?" Build that interface.

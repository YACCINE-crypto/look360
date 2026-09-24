import { Icon } from "@/components/Icon";
import { RevealOnScroll } from "./RevealOnScroll";

/**
 * Grille de fonctions — chaque carte reproduit FIDÈLEMENT l'affichage réel de
 * la page correspondante (mêmes badges, chips, boutons, verdict). Les visuels
 * produit sont des emplacements neutres étiquetés « [visuel] » tant que les
 * vraies images ne sont pas fournies (`img` = chemin dans /public).
 */
export function FonctionsSection() {
  return (
    <section id="fonctions" className="bg-surface scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <RevealOnScroll>
          <div className="text-center">
            <h2 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
              Tout pour trouver, tester et valider
            </h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-base">
              L&apos;aperçu réel de chaque écran — pensé pour investir sur du
              prouvé, pas sur une intuition.
            </p>
          </div>
        </RevealOnScroll>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {/* Spy Facebook — large : 2 vraies cartes */}
          <FeatureCard
            className="md:col-span-2"
            icon="eye"
            title="Spy Facebook"
            desc="Les pubs qui tournent vraiment (Facebook), Afrique + Europe. Score, ancienneté, reach UE."
            delay={0}
          >
            <div className="grid grid-cols-2 gap-3">
              <AdCardPreview
                page="Boutique bien-être"
                text="Le complément n°1 pour vos cheveux — résultats en 30 jours."
                score={79}
                label="Fort potentiel"
                days={94}
                reach="817k"
                media="Vidéo"
              />
              <AdCardPreview
                page="Boutique beauté"
                text="Retrouvez vos compléments préférés — formules naturelles."
                score={66}
                label="Moyen"
                days={148}
                reach="437k"
                media="Image"
              />
            </div>
          </FeatureCard>

          {/* Winner Agent */}
          <FeatureCard
            icon="trophy"
            title="Winner Agent"
            desc="L'agent scanne chaque jour et sort les meilleures pubs selon tes mots-clés et pays."
            delay={80}
          >
            <div className="space-y-2">
              <WinnerRow title="Masseur cervical" score={88} label="Fort potentiel" />
              <WinnerRow title="Sérum anti-âge" score={81} label="Fort potentiel" />
              <WinnerRow title="Montre connectée" score={74} label="Bon" />
            </div>
          </FeatureCard>

          {/* Testing — pleine largeur, verdict fidèle */}
          <FeatureCard
            className="md:col-span-3"
            icon="flask"
            title="Testing & rentabilité"
            desc="Taux de closing, marge nette et verdict — calculés sur tes vraies commandes."
            featured
            delay={0}
          >
            <VerdictPreview />
          </FeatureCard>

          {/* Top Trend */}
          <FeatureCard
            icon="trending"
            title="Top Trend"
            desc="Le classement des produits qui montent, en temps réel."
            delay={0}
          >
            <TopTrendMini />
          </FeatureCard>

          {/* WhatsApp */}
          <FeatureCard
            icon="bell"
            title="Winners sur WhatsApp"
            desc="Reçois tes winners du jour directement sur WhatsApp."
            delay={80}
          >
            <WhatsappMini />
          </FeatureCard>

          {/* COD Afrique */}
          <FeatureCard
            icon="check"
            title="Pensé COD Afrique"
            desc="Winners Afrique + Europe, mobile money, FCFA, closing local."
            delay={160}
          >
            <CodAfriqueMini />
          </FeatureCard>

          {/* Vitrine — large */}
          <FeatureCard
            className="md:col-span-3"
            icon="store"
            title="Vitrine des winners validés"
            desc="Les produits déjà validés par la communauté (≥ 10 commandes reçues). Réservé à l'offre Business."
            delay={0}
          >
            <VitrineMini />
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Carte */

function FeatureCard({
  icon,
  title,
  desc,
  children,
  className = "",
  featured = false,
  delay = 0,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  desc: string;
  children: React.ReactNode;
  className?: string;
  featured?: boolean;
  delay?: number;
}) {
  return (
    <RevealOnScroll delay={delay} className={className}>
      <div
        className={`flex h-full flex-col rounded-2xl border p-6 transition-shadow hover:shadow-md ${
          featured
            ? "border-primary/40 bg-gradient-to-b from-secondary/40 to-surface ring-primary/15 shadow-lg ring-1"
            : "border-border bg-surface shadow-card"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="bg-secondary text-primary grid h-10 w-10 shrink-0 place-items-center rounded-xl">
            <Icon name={icon} size={20} />
          </span>
          <h3 className="text-foreground text-base font-bold">{title}</h3>
          {featured && (
            <span className="bg-primary text-primary-foreground ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold">
              Le cœur de l&apos;app
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed">
          {desc}
        </p>
        <div className="mt-5 flex-1">{children}</div>
      </div>
    </RevealOnScroll>
  );
}

/* ------------------------------------------------- Emplacement média (image) */

function MediaFrame({
  media,
  score,
  label,
  img,
  ratio = "aspect-[4/5]",
}: {
  media?: "Vidéo" | "Image";
  score?: number;
  label?: string;
  img?: string;
  ratio?: string;
}) {
  const badge =
    label === "Fort potentiel"
      ? "bg-success-bg text-success"
      : label === "Moyen" || label === "Bon"
        ? "bg-warning-bg text-warning"
        : "bg-secondary text-secondary-foreground";
  return (
    <div className={`bg-input relative w-full overflow-hidden ${ratio}`}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="h-full w-full object-cover object-center" />
      ) : (
        <div className="text-muted-foreground/50 flex h-full w-full flex-col items-center justify-center gap-1">
          <Icon name="image" size={22} />
          <span className="text-[9px] font-medium">[visuel]</span>
        </div>
      )}
      {media && (
        <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
          {media}
        </span>
      )}
      {score != null && (
        <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge}`}>
          Score {score}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------- Carte pub fidèle */

function AdCardPreview({
  page,
  text,
  score,
  label,
  days,
  reach,
  media,
  img,
}: {
  page: string;
  text: string;
  score: number;
  label: string;
  days: number;
  reach?: string;
  media?: "Vidéo" | "Image";
  img?: string;
}) {
  return (
    <div className="border-border bg-surface flex flex-col overflow-hidden rounded-xl border">
      <MediaFrame media={media} score={score} label={label} img={img} />
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div className="min-w-0">
          <h4 className="text-foreground truncate text-xs font-semibold">{page}</h4>
          <p className="text-muted-foreground line-clamp-2 text-[10px]">{text}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="bg-success-bg text-success inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium">
            <Icon name="clock" size={9} /> {days} j
          </span>
          {reach && (
            <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold">
              <Icon name="eye" size={9} /> {reach}
            </span>
          )}
        </div>
        {/* Boutons d'action (fidèles à l'app) */}
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          <FakeBtn icon="external" label="Ad Library" />
          <FakeBtn icon="store" label="Boutique" />
          <FakeBtn icon="search" label="Analyser" />
          <FakeBtn icon="bell" label="Surveiller" />
        </div>
        <div className="bg-primary text-primary-foreground mt-0.5 inline-flex items-center justify-center gap-1 rounded-md py-1.5 text-[10px] font-semibold">
          <Icon name="plus" size={11} /> Ajouter à mes produits
        </div>
      </div>
    </div>
  );
}

function FakeBtn({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  label: string;
}) {
  return (
    <span className="border-border text-muted-foreground inline-flex items-center justify-center gap-1 rounded-md border py-1 text-[9px] font-medium">
      <Icon name={icon} size={9} /> {label}
    </span>
  );
}

/* -------------------------------------------------- Verdict testing fidèle */

function VerdictPreview() {
  return (
    <div className="border-border bg-surface grid gap-5 rounded-xl border p-5 md:grid-cols-2">
      {/* Colonne verdict */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
            Verdict du test
          </span>
          <span className="text-muted-foreground text-[11px]">
            Durée <span className="text-foreground font-bold">2 jours</span>
          </span>
        </div>

        <span className="bg-success-bg text-success mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold">
          <span className="bg-success h-2 w-2 rounded-full" /> Rentable
        </span>

        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground text-xs">
              Taux de confirmation (closing)
            </span>
            <span className="text-success text-xs font-semibold">
              Excellent closing
            </span>
          </div>
          <p className="text-success text-3xl font-extrabold tabular-nums">70 %</p>
          <div className="bg-input mt-1 h-2.5 overflow-hidden rounded-full">
            <div className="bg-success h-full rounded-full" style={{ width: "70%" }} />
          </div>
          <div className="text-muted-foreground mt-1 flex justify-between text-[9px]">
            <span>0 %</span>
            <span>Objectif 60 %</span>
            <span>100 %</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <StatTile label="Bénéfice projeté" value="103 500" unit="FCFA" />
          <StatTile label="Marge nette" value="74 %" unit="sur prix de vente" accent />
          <StatTile label="ROAS" value="28.0x" unit="retour budget pub" amber />
          <StatTile label="Budget pub" value="5 000" unit="FCFA" />
        </div>
      </div>

      {/* Colonne recommandation + chiffres réels */}
      <div className="flex flex-col gap-3">
        <div className="bg-secondary/50 text-foreground rounded-xl p-3 text-xs leading-relaxed">
          <span className="text-primary font-bold">💡 Recommandation :</span> le
          taux de closing dépasse l&apos;objectif et la marge est solide. Ce
          produit est prêt pour la production.
        </div>
        <div className="border-border grid grid-cols-2 gap-2 rounded-xl border p-3">
          <RealFig label="Commandes reçues" value="10" />
          <RealFig label="Confirmées" value="7" ok />
          <RealFig label="Prix de vente" value="20 000" />
          <RealFig label="Coût produit" value="2 700" />
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  unit,
  accent = false,
  amber = false,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
  amber?: boolean;
}) {
  return (
    <div className="bg-background rounded-lg p-2.5">
      <p className="text-muted-foreground text-[10px]">{label}</p>
      <p
        className={`text-base font-extrabold tabular-nums ${
          accent ? "text-success" : amber ? "text-warning" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="text-muted-foreground text-[9px]">{unit}</p>
    </div>
  );
}

function RealFig({
  label,
  value,
  ok = false,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 ${
        ok ? "border-success/40 bg-success-bg/40" : "border-border bg-background"
      }`}
    >
      <p className="text-muted-foreground text-[9px]">{label}</p>
      <p className="text-foreground text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

/* --------------------------------------------------------- Winner Agent row */

function WinnerRow({
  title,
  score,
  label,
}: {
  title: string;
  score: number;
  label: string;
}) {
  return (
    <div className="border-border bg-background flex items-center gap-2.5 rounded-lg border p-2">
      <span className="bg-input text-muted-foreground/50 relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md">
        <Icon name="image" size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-xs font-semibold">{title}</p>
        <p className="text-success text-[10px] font-medium">
          Score {score} · {label}
        </p>
      </div>
      <span className="bg-secondary text-primary shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold">
        auto
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- autres minis */

function TopTrendMini() {
  const rows = [
    { name: "Complément cheveux", w: 92 },
    { name: "Masseur cervical", w: 74 },
    { name: "Lampe LED", w: 58 },
    { name: "Gourde connectée", w: 41 },
  ];
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-muted-foreground w-4 text-xs font-bold tabular-nums">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-foreground mb-1 truncate text-[11px] font-medium">
              {r.name}
            </p>
            <div className="bg-input h-2 overflow-hidden rounded-full">
              <div
                className="from-primary h-full rounded-full bg-gradient-to-r to-blue-400"
                style={{ width: `${r.w}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WhatsappMini() {
  return (
    <div className="overflow-hidden rounded-xl border border-[#25D366]/30">
      <div className="flex items-center gap-2 bg-[#25D366] px-3 py-2 text-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12.05 21.5a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.44 9.44 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.46-9.44 2.53 0 4.9.99 6.69 2.78a9.38 9.38 0 0 1 2.77 6.68c0 5.2-4.24 9.48-9.45 9.48z" />
        </svg>
        <span className="text-xs font-semibold">Look360</span>
      </div>
      <div className="bg-[#e6f4ea] p-3">
        <div className="text-foreground max-w-[90%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-xs shadow-sm">
          🏆 3 nouveaux winners aujourd&apos;hui — closing &gt; 55 % sur ton
          marché. Ouvre l&apos;app pour les tester.
        </div>
      </div>
    </div>
  );
}

function CodAfriqueMini() {
  return (
    <div className="flex flex-wrap gap-2">
      {["🇨🇮 CI", "🇸🇳 SN", "🇧🇫 BF", "🇨🇲 CM", "🇹🇬 TG"].map((c) => (
        <span
          key={c}
          className="border-border bg-background text-foreground rounded-full border px-2.5 py-1 text-xs font-medium"
        >
          {c}
        </span>
      ))}
      <span className="bg-secondary text-primary rounded-full px-2.5 py-1 text-xs font-semibold">
        Mobile money
      </span>
      <span className="bg-secondary text-primary rounded-full px-2.5 py-1 text-xs font-semibold">
        FCFA
      </span>
    </div>
  );
}

function VitrineMini() {
  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["Masseur cervical", "Sérum visage", "Lampe LED", "Montre connectée"].map(
          (name, i) => (
            <div
              key={i}
              className="border-border bg-surface overflow-hidden rounded-xl border"
            >
              <MediaFrame ratio="aspect-square" />
              <div className="flex items-center gap-1 p-2">
                <span className="bg-success-bg text-success inline-flex items-center gap-0.5 rounded px-1 text-[9px] font-bold">
                  <Icon name="check" size={9} strokeWidth={3} /> Validé
                </span>
                <span className="text-muted-foreground truncate text-[9px]">
                  {name}
                </span>
              </div>
            </div>
          ),
        )}
      </div>
      {/* Cadenas Business */}
      <div className="absolute inset-0 grid place-items-center rounded-xl bg-surface/60 backdrop-blur-[2px]">
        <span className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold shadow">
          <Icon name="lock" size={14} /> Débloque avec l&apos;offre Business
        </span>
      </div>
    </div>
  );
}

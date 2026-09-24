import { Icon } from "@/components/Icon";
import { RevealOnScroll } from "./RevealOnScroll";

/**
 * Grille de fonctions — chaque carte est une mini-interface (pas icône+texte).
 * Focus desktop (bento). Le raffinement mobile est traité dans une passe dédiée.
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
              Chaque fonction est pensée pour une seule chose : investir sur du
              prouvé, pas sur une intuition.
            </p>
          </div>
        </RevealOnScroll>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {/* Spy Facebook — large */}
          <FeatureCard
            className="md:col-span-2"
            icon="eye"
            title="Spy Facebook"
            desc="Les pubs qui tournent vraiment (Facebook), Afrique + Europe. Filtre par pays, ancienneté et portée."
            delay={0}
          >
            <SpyGridMini />
          </FeatureCard>

          {/* Testing — en vedette */}
          <FeatureCard
            icon="flask"
            title="Testing & rentabilité"
            desc="Taux de closing, marge nette et verdict — sur tes vraies commandes."
            featured
            delay={80}
          >
            <VerdictMini />
          </FeatureCard>

          {/* Winner Agent */}
          <FeatureCard
            icon="trophy"
            title="Winner Agent"
            desc="L'agent scanne chaque jour et te sort les meilleures pubs selon tes mots-clés et pays."
            delay={0}
          >
            <WinnerAgentMini />
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

          {/* Top Trend */}
          <FeatureCard
            icon="trending"
            title="Top Trend"
            desc="Le classement des produits qui montent, en temps réel."
            delay={160}
          >
            <TopTrendMini />
          </FeatureCard>

          {/* Vitrine — large */}
          <FeatureCard
            className="md:col-span-2"
            icon="store"
            title="Vitrine des winners validés"
            desc="Les produits déjà validés par la communauté (≥ 10 commandes reçues). Réservé à l'offre Business."
            delay={0}
          >
            <VitrineMini />
          </FeatureCard>

          {/* COD Afrique */}
          <FeatureCard
            icon="check"
            title="Pensé COD Afrique"
            desc="Winners Afrique + Europe, mobile money, FCFA, taux de closing local."
            delay={80}
          >
            <CodAfriqueMini />
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
            ? "border-primary/40 bg-gradient-to-b from-secondary/50 to-surface ring-primary/15 shadow-lg ring-1"
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

/* ------------------------------------------------------- Mini-interfaces */

function SpyGridMini() {
  const ads = [88, 76, 91, 69, 82, 73];
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {ads.map((score, i) => (
        <div
          key={i}
          className="border-border bg-background overflow-hidden rounded-lg border"
        >
          <div className="bg-input text-muted-foreground flex aspect-square items-center justify-center">
            <Icon name="image" size={16} />
          </div>
          <div className="flex items-center justify-between px-1.5 py-1">
            <span className="bg-secondary text-secondary-foreground rounded px-1 text-[9px] font-bold">
              {score}
            </span>
            <span className="text-success">
              <Icon name="trending" size={11} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function VerdictMini() {
  return (
    <div className="border-border bg-surface space-y-2.5 rounded-xl border p-3">
      <Row label="Commandes reçues" value="12" />
      <Row label="Taux de closing" value="58 %" accent />
      <Row label="Marge nette" value="+44 %" accent />
      <span className="bg-success-bg text-success inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold">
        <Icon name="check" size={13} strokeWidth={3} /> Rentable
      </span>
    </div>
  );
}

function WinnerAgentMini() {
  const rows = ["Winner #1", "Winner #2", "Winner #3"];
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div
          key={i}
          className="border-border bg-background flex items-center gap-2.5 rounded-lg border px-2.5 py-2"
        >
          <span className="bg-input text-muted-foreground grid h-7 w-7 shrink-0 place-items-center rounded-md">
            <Icon name="image" size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="bg-muted h-2 w-2/3 rounded-full" />
            <div className="bg-muted/60 mt-1.5 h-1.5 w-1/3 rounded-full" />
          </div>
          <span className="bg-secondary text-primary rounded-full px-1.5 py-0.5 text-[9px] font-bold">
            auto
          </span>
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
        <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-xs text-foreground shadow-sm">
          🏆 3 nouveaux winners aujourd&apos;hui — closing &gt; 55 % sur ton
          marché. Ouvre l&apos;app pour les tester.
        </div>
      </div>
    </div>
  );
}

function TopTrendMini() {
  const bars = [92, 74, 58, 41];
  return (
    <div className="space-y-2.5">
      {bars.map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-muted-foreground w-4 text-xs font-bold tabular-nums">
            {i + 1}
          </span>
          <div className="bg-input h-2.5 flex-1 overflow-hidden rounded-full">
            <div
              className="from-primary h-full rounded-full bg-gradient-to-r to-blue-400"
              style={{ width: `${w}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function VitrineMini() {
  return (
    <div className="relative">
      <div className="grid grid-cols-4 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="border-border bg-background overflow-hidden rounded-lg border"
          >
            <div className="bg-input text-muted-foreground flex aspect-square items-center justify-center">
              <Icon name="image" size={16} />
            </div>
            <div className="flex items-center gap-1 px-1.5 py-1">
              <span className="bg-success-bg text-success inline-flex items-center gap-0.5 rounded px-1 text-[9px] font-bold">
                <Icon name="check" size={9} strokeWidth={3} /> Validé
              </span>
            </div>
          </div>
        ))}
      </div>
      {/* Cadenas Business */}
      <div className="absolute inset-0 grid place-items-center rounded-lg bg-surface/55 backdrop-blur-[2px]">
        <span className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow">
          <Icon name="lock" size={13} /> Offre Business
        </span>
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

function Row({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span
        className={`text-sm font-bold tabular-nums ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

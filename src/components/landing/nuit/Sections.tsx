import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { PLANS, PLAN_LIMITS, type Plan } from "@/lib/billing";
import { formatPrice } from "@/lib/shops";
import { countryLabel, isEUCountry } from "@/lib/spy";
import { estimateSpend, formatSpendRange } from "@/lib/spendEstimate";
import type { LandingData, LandingProduct } from "@/lib/landingData";

/* eslint-disable @next/next/no-img-element -- images Shopify externes, lazy */

const nf = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const SIGNUP = "/login?tab=signup";
export const WHATSAPP_URL = "https://wa.me/2250502952588";
export const SUPPORT_EMAIL = "look360app@gmail.com";

function flag(code: string | null): string {
  if (!code || !/^[A-Z]{2}$/i.test(code)) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

function stage(p: LandingProduct): { label: string; scale: boolean } {
  if (p.adsActive >= 10) return { label: "Scaling", scale: true };
  if ((p.days ?? 0) >= 30) return { label: "Evergreen", scale: false };
  return { label: "En test", scale: false };
}

function Check() {
  return <Icon name="check" size={13} strokeWidth={3} />;
}

/* ----------------------------------------------------------------- Hero */
export function Hero({ data }: { data: LandingData }) {
  return (
    <header className="wrap hero">
      {/* Bandeau « en direct » (modèle ShopClone) : vignettes au-dessus, compteur sur une
          ligne à largeur fixe → rien ne bouge pendant le comptage. */}
      <div className="live">
        {data.products.length > 0 && (
          <span className="stack" aria-hidden>
            {data.products.slice(0, 5).map((p) => (
              <img key={p.id} src={p.image} alt="" width={52} height={52} />
            ))}
          </span>
        )}
        <p className="live-line">
          <span className="dot" aria-hidden />
          <b data-count-now data-count={data.stats.ads30d} style={{ minWidth: `${nf(data.stats.ads30d).length}ch` }}>
            {nf(data.stats.ads30d)}
          </b>{" "}
          pubs analysées ces 30 derniers jours
        </p>
      </div>
      <h1>
        <span className="l1">Trouver un produit gagnant</span>
        <span className="l2">ne suffit pas.</span>
      </h1>
      <p className="sub">
        Look360 repère les pubs qui marchent en Afrique et en Europe, te montre le vendeur derrière, puis calcule si le
        produit est <b>rentable en COD</b> avant que tu achètes ton stock.
      </p>
      <div className="chips">
        {["Afrique + Europe", "Paiement mobile money", "Sans engagement"].map((c) => (
          <span key={c} className="chip">
            <Check />
            {c}
          </span>
        ))}
      </div>
      <div className="cta-row">
        <Link className="btn beam" href={SIGNUP}>
          <span className="halo" aria-hidden />
          Trouver mon premier winner <span aria-hidden>→</span>
        </Link>
        <small>Gratuit · aucune carte bancaire</small>
      </div>
    </header>
  );
}

/* ------------------------------------------------------- Bande produits */
function ProductCard({ p }: { p: LandingProduct }) {
  const st = stage(p);
  return (
    <div className="pc">
      <div className="im">
        <img src={p.image} alt="" loading="lazy" decoding="async" width={200} height={200} />
        <span className={`tag ${st.scale ? "scale" : ""}`}>{st.label}</span>
      </div>
      <div className="b">
        <p className="pt" title={p.name}>
          {p.name}
        </p>
        <div className="meta">
          <span className="price">{p.price != null ? formatPrice(p.price, p.currency) : "—"}</span>
          <span className="ads">{p.adsActive} pubs</span>
        </div>
        <p className="dom">
          {flag(p.country)} {p.country ? countryLabel(p.country) : ""}
          {p.niche ? ` · ${p.niche}` : ""}
        </p>
      </div>
    </div>
  );
}

export function Marquee({ products }: { products: LandingProduct[] }) {
  if (products.length < 6) return null;
  const half = Math.ceil(products.length / 2);
  const a = products.slice(0, half);
  const b = products.slice(half).concat(products.slice(0, Math.max(0, half - (products.length - half))));
  return (
    <div className="marquee layer" aria-label="Produits repérés par Look360 en ce moment">
      {[a, b].map((row, i) => (
        <div key={i} className={`track ${i ? "rev" : ""}`}>
          {[...row, ...row].map((p, j) => (
            <div key={`${p.id}-${j}`} aria-hidden={j >= row.length || undefined}>
              <ProductCard p={p} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- 3 étapes */
function WinBar({ title, spinner = false, dataWin }: { title: string; spinner?: boolean; dataWin?: string }) {
  return (
    <div className="bar">
      <i className="r1" />
      <i className="r2" />
      <i className="r3" />
      <span className="t">
        {spinner && <span className="spin" aria-hidden />}
        <span data-step1-title={dataWin ? "" : undefined} data-win={dataWin}>
          {title}
        </span>
      </span>
    </div>
  );
}

function StepText({ n, title, k, children }: { n: number; title: string; k: string; children: ReactNode }) {
  return (
    <div className="card glow txt rv">
      <div className="n">
        Étape <span>{n}</span>
      </div>
      <h3>{title}</h3>
      <div className="k">{k}</div>
      <p>{children}</p>
    </div>
  );
}

export function Etapes({ products }: { products: LandingProduct[] }) {
  const winner = products[0];
  const grid = products.slice(0, 6);
  // Le gagnant au centre de la 1re ligne.
  if (grid.length >= 3) [grid[0], grid[1]] = [grid[1], grid[0]];
  const seller = products.find((p) => p.euReach && isEUCountry(p.country)) ?? winner;
  const spend = seller?.euReach ? estimateSpend(seller.euReach, seller.country) : null;
  const top = products[0]?.adsActive || 1;

  return (
    <section id="etapes" className="sec layer">
      <div className="wrap">
        <div className="center rv">
          <span className="eyebrow">Comment ça marche</span>
          <h2>
            De la pub au <em>verdict</em>, en 3 étapes.
          </h2>
        </div>

        {/* Étape 1 */}
        <div className="step">
          <StepText n={1} title="Le Spy repère les pubs qui marchent" k="Bibliothèque Meta · 3 continents">
            Cherche un mot-clé ou juste un pays. Look360 note chaque pub sur sa durée, ses variantes et l&apos;activité du
            vendeur, et fait sortir les plus fortes.
          </StepText>
          <div className="win glow rv">
            <WinBar
              title="Recherche des pubs gagnantes…"
              spinner
              dataWin={winner ? `Winner repéré : ${winner.name}` : undefined}
            />
            {grid.length > 0 ? (
              <>
                <div className="grid6" data-step1>
                  <div className="scan" aria-hidden />
                  {grid.map((p) => (
                    <div key={p.id} className={`ad ${p.id === winner?.id ? "winner" : ""}`}>
                      <div className="im">
                        <img src={p.image} alt="" loading="lazy" decoding="async" />
                      </div>
                      <div className="r">
                        <span>
                          {flag(p.country)} {p.name}
                        </span>
                        <b>{p.adsActive}</b>
                      </div>
                    </div>
                  ))}
                </div>
                {winner && (
                  <div className="badge-score">
                    <span className="sc">{winner.adsActive}</span>
                    <span>
                      <b>pubs actives · Fort potentiel</b>
                      <small>{winner.days != null ? `Active depuis ${winner.days} j` : "Toujours active"}</small>
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="lead" style={{ padding: 22 }}>
                Les pubs repérées s&apos;affichent ici dès la prochaine collecte.
              </p>
            )}
          </div>
        </div>

        {/* Étape 2 */}
        <div className="step flip">
          <StepText n={2} title="Tu vois le vendeur derrière" k="Boutique, pubs actives, dépense estimée">
            Combien de pubs il fait tourner, depuis quand, s&apos;il vend en paiement à la livraison, son catalogue et ses
            nouveaux produits. Un clic et le produit part en test.
          </StepText>
          {seller && (
            <div className="card glow rv" data-step2 data-in>
              <div className="seller">
                <img src={seller.image} alt="" loading="lazy" decoding="async" />
                <div>
                  <p className="sn">{seller.name}</p>
                  <p className="d">
                    Boutique Shopify{seller.niche ? ` · ${seller.niche}` : ""} · {flag(seller.country)}{" "}
                    {countryLabel(seller.country)}
                  </p>
                  {seller.cod && <span className="pill g">COD</span>}
                  {seller.adsActive >= 10 && <span className="pill b">SCALE</span>}
                </div>
              </div>
              <div className="kpis">
                <div className="kpi">
                  <small>Pubs actives</small>
                  <b data-count={seller.adsActive}>{seller.adsActive}</b>
                </div>
                <div className="kpi">
                  <small>Depuis</small>
                  <b>
                    {seller.days != null ? (
                      <>
                        <span data-count={seller.days}>{seller.days}</span> j
                      </>
                    ) : (
                      "—"
                    )}
                  </b>
                </div>
                <div className="kpi">
                  <small>Dépense (UE)</small>
                  <b style={{ fontSize: spend ? undefined : 18 }}>{spend ? formatSpendRange(spend) : "—"}</b>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <small className="kpi-note">Pubs actives par rapport au n° 1 du classement</small>
                <div className="meter" style={{ ["--w" as string]: `${Math.round((seller.adsActive / top) * 100)}%` }}>
                  <span />
                </div>
              </div>
              <div className="act">
                <div className="b1">VOIR L&apos;ANALYSE</div>
                <div className="b2" data-press>
                  ENVOYER EN TEST
                </div>
                <svg className="cursor" data-cursor viewBox="0 0 24 24" aria-hidden>
                  <path d="M4 2l16 9-7 2-3 7z" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Étape 3 */}
        <div className="step">
          <StepText n={3} title="Le verdict de rentabilité" k="Taux de closing COD réel · marge nette">
            Entre tes commandes reçues et confirmées : Look360 calcule ton taux de closing, ta marge après livraison et
            retours, et te dit de valider ou d&apos;abandonner.
          </StepText>
          <div className="win glow rv" data-in>
            <WinBar title="Exemple de verdict de test" />
            <Verdict />
            <div className="toast" role="status">
              <span className="ic">✓</span>
              <span>
                <b>Produit validé</b>
                <small>Tu peux commander ton stock</small>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Verdict d'exemple (même langage visuel que l'app). Chiffres illustratifs, signalés comme exemple. */
function Verdict({ reco = false }: { reco?: boolean }) {
  return (
    <div className="verdict">
      <div className="vtop">
        <span>Taux de closing</span>
        <span className="ok">Excellent</span>
      </div>
      <div className="gauge">
        <div className="v">
          <span data-count={70}>70</span> %
        </div>
        <div className="meter" style={{ ["--w" as string]: "70%" }}>
          <span />
          <i className="goal" title="Objectif 60 %" />
        </div>
        <div className="scale">
          <span>0 %</span>
          <span>Objectif 60 %</span>
          <span>100 %</span>
        </div>
      </div>
      <div className="vgrid">
        <div className="kpi">
          <small>Bénéfice projeté</small>
          <b>
            <span data-count={103500}>103 500</span> FCFA
          </b>
        </div>
        <div className="kpi">
          <small>Marge nette</small>
          <b className="ok">
            <span data-count={74}>74</span> %
          </b>
        </div>
        <div className="kpi">
          <small>ROAS</small>
          <b className="amber">28,0x</b>
        </div>
        <div className="kpi">
          <small>Budget pub</small>
          <b>5 000 FCFA</b>
        </div>
      </div>
      {reco && (
        <p className="reco">
          <b>Recommandation :</b> le taux de closing dépasse l&apos;objectif et la marge est solide. Ce produit est prêt
          pour la production.
        </p>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- Comparatif */
type Cell = boolean | string;
const ROWS: { feature: string; strong?: boolean; testing?: boolean; look: Cell; autres: Cell }[] = [
  { feature: "Trouver des pubs gagnantes (Facebook)", look: true, autres: true },
  { feature: "Winners Afrique + Europe", strong: true, look: true, autres: "Afrique uniquement" },
  { feature: "Tester le produit sur ton marché", look: true, autres: false },
  { feature: "Taux de closing COD réel", strong: true, testing: true, look: true, autres: false },
  { feature: "Marge nette + verdict rentable/pas", strong: true, testing: true, look: true, autres: false },
  { feature: "Éviter d'acheter un stock à l'aveugle", look: true, autres: false },
  { feature: "Vitrine des winners validés", look: true, autres: false },
  { feature: "Pensé COD africain (mobile money, FCFA)", look: true, autres: false },
];

function Mark({ cell }: { cell: Cell }) {
  const yes = cell === true;
  return (
    <span>
      <span className={`mk ${yes ? "yes" : "no"}`} aria-label={yes ? "Oui" : "Non"}>
        <Icon name={yes ? "check" : "x"} size={14} strokeWidth={3} />
      </span>
      {typeof cell === "string" && <span className="mk-note">{cell}</span>}
    </span>
  );
}

export function Comparatif() {
  return (
    <section id="comparatif" className="sec layer">
      <div className="wrap">
        <div className="center rv">
          <span className="eyebrow">Comparatif</span>
          <h2>
            Les autres s&apos;arrêtent à «&nbsp;voici une pub&nbsp;». Look360 va jusqu&apos;à{" "}
            <em>«&nbsp;voici si ça va te rapporter&nbsp;»</em>.
          </h2>
          <p className="lead">
            Trouver une pub qui tourne, c&apos;est la partie facile : tout le monde le fait. La vraie question, c&apos;est
            de savoir si ça va vendre et être rentable sur ton marché.
          </p>
        </div>
        <div className="cmp rv" role="table" aria-label="Look360 comparé aux autres spy tools">
          <div className="row head" role="row">
            <span role="columnheader">Fonctionnalité</span>
            <span role="columnheader" className="lk">
              Look360
            </span>
            <span role="columnheader">
              <span className="lg">Les autres spy tools</span>
              <span className="sm-only">Autres</span>
            </span>
          </div>
          {ROWS.map((r) => (
            <div key={r.feature} role="row" className={`row ${r.testing ? "hl" : ""}`}>
              <span role="cell" className={`f ${r.strong ? "strong" : ""}`}>
                {r.feature}
                {r.testing && <span className="tg">Testing</span>}
              </span>
              <span role="cell">
                <Mark cell={r.look} />
              </span>
              <span role="cell">
                <Mark cell={r.autres} />
              </span>
            </div>
          ))}
        </div>
        <p className="punch rv">N&apos;importe quel outil te montre une pub. Un seul te dit si tu vas gagner de l&apos;argent avec.</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------ Testing détaillé */
export function Testing() {
  const pts: { icon: IconName; title: string; body: ReactNode }[] = [
    {
      icon: "inbox",
      title: "Tes commandes → ton taux de closing",
      body: "Tu entres tes commandes reçues et confirmées, Look360 calcule ton taux de closing COD réel. Un test est valable à partir de 10 commandes reçues.",
    },
    {
      icon: "trending",
      title: "Projection de la marge nette",
      body: "Prix − coût produit − livraison : tu vois ta marge réelle avant de commander du stock.",
    },
    {
      icon: "check",
      title: "Un verdict clair",
      body: (
        <span className="dots">
          <span>
            <i style={{ background: "var(--success)" }} /> rentable
          </span>
          <span>
            <i style={{ background: "var(--warn)" }} /> moyen
          </span>
          <span>
            <i style={{ background: "var(--danger)" }} /> pas rentable
          </span>
        </span>
      ),
    },
  ];
  return (
    <section id="testing" className="sec layer">
      <div className="wrap split">
        <div className="rv">
          <span className="eyebrow">
            <Icon name="flask" size={14} /> La fonction signature
          </span>
          <h2>
            Le testing, c&apos;est ça la <em>vraie différence</em>.
          </h2>
          <p className="lead">
            Avant d&apos;investir, tu sais. Taux de closing, marge nette, verdict : calculés sur tes vraies commandes, pas
            sur des suppositions.
          </p>
          <ul className="points">
            {pts.map((p) => (
              <li key={p.title}>
                <span className="pi">
                  <Icon name={p.icon} size={18} />
                </span>
                <div>
                  <b>{p.title}</b>
                  <p>{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="closing">Fini le pari. Tu investis avec des chiffres, pas avec ton intuition.</p>
        </div>
        <div className="win glow rv" data-in>
          <WinBar title="Exemple · verdict du test (2 jours)" />
          <Verdict reco />
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------- Chiffres réels + capture */
export function Chiffres({ stats }: { stats: LandingData["stats"] }) {
  const items = [
    { v: stats.products, l: "produits suivis" },
    { v: stats.shops, l: "boutiques analysées" },
    { v: stats.ads30d, l: "pubs lues en 30 jours" },
    { v: stats.countries, l: "pays couverts par le Spy" },
  ];
  return (
    <section className="sec layer">
      <div className="wrap center">
        <div className="rv">
          <span className="eyebrow">En direct de la base Look360</span>
          <h2>
            Des données réelles, <em>chaque jour</em>.
          </h2>
        </div>
        <div className="stats rv">
          {items.map((s) => (
            <div key={s.l} className="stat">
              <b data-count={s.v}>{nf(s.v)}</b>
              <small>{s.l}</small>
            </div>
          ))}
        </div>
        <div className="shot rv">
          <div className="frame" data-tilt>
            <img
              src="/landing/app-top-trend.jpg"
              alt="Top Trend dans l'app Look360 : les produits les plus poussés du moment"
              width={1600}
              height={964}
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Bento */
export function Fonctions({ products }: { products: LandingProduct[] }) {
  const top5 = products.slice(0, 5);
  const max = top5[0]?.adsActive || 1;
  const feed = products.slice(5, 8);
  return (
    <section id="fonctions" className="sec layer">
      <div className="wrap">
        <div className="center rv">
          <span className="eyebrow">Tout dans une seule app</span>
          <h2>
            Trouver. Suivre. <em>Valider.</em>
          </h2>
        </div>
        <div className="bento">
          <div className="card c3 rv">
            <h3>
              <Icon name="search" size={18} /> Spy Facebook
            </h3>
            <p>Les pubs qui tournent vraiment sur Facebook, en Afrique et en Europe. Score, ancienneté, reach UE.</p>
            {feed.length > 0 && (
              <div className="feed">
                {feed.map((p, i) => (
                  <div key={p.id} className="fi" style={{ transitionDelay: `${i * 160}ms` }}>
                    <img src={p.image} alt="" loading="lazy" decoding="async" />
                    <span>
                      <b>{p.name}</b>
                      <small>
                        {flag(p.country)} {p.adsActive} pubs actives{p.days != null ? ` · ${p.days} j` : ""}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card c3 rv">
            <h3>
              <Icon name="sparkles" size={18} /> Winner Agent
            </h3>
            <p>Chaque jour, l&apos;agent scanne tes mots-clés et tes pays, et sort les meilleures pubs pour toi.</p>
            <div className="feed">
              {["Mot-clé « gaine » · Côte d'Ivoire", "Mot-clé « genouillère » · France", "Mot-clé « sérum » · Sénégal"].map(
                (t, i) => (
                  <div key={t} className="fi" style={{ transitionDelay: `${i * 160}ms` }}>
                    <span className="pi" aria-hidden>
                      <Icon name="clock" size={16} />
                    </span>
                    <span>
                      <b>Scan quotidien</b>
                      <small>{t}</small>
                    </span>
                    {i === 0 && <span className="nw">CE MATIN</span>}
                  </div>
                ),
              )}
            </div>
          </div>
          <div className="card c4 rv">
            <h3>
              <Icon name="trophy" size={18} /> Top Trend
            </h3>
            <p>Le classement des produits les plus poussés, mis à jour en continu. Rien que les signaux forts.</p>
            {top5.length > 0 && (
              <div className="rank" data-in>
                {top5.map((p, i) => (
                  <div key={p.id}>
                    <span className="n">{i + 1}</span>
                    <span>
                      <span className="nm">{p.name}</span>
                      <span className="meter" style={{ ["--w" as string]: `${Math.round((p.adsActive / max) * 100)}%` }}>
                        <span />
                      </span>
                    </span>
                    <span className="v">{p.adsActive} pubs</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card c2 rv">
            <h3>
              <Icon name="bell" size={18} /> Winners sur WhatsApp
            </h3>
            <p>Tes winners du jour, directement sur ton téléphone.</p>
            <div className="wa">
              3 nouveaux winners repérés aujourd&apos;hui dans ta niche. Ouvre Look360 pour les voir.
              <small>08:02 ✓✓</small>
            </div>
          </div>
          <div className="card c2 rv">
            <h3>
              <Icon name="flask" size={18} /> Testing &amp; rentabilité
            </h3>
            <p>Taux de closing, marge nette et verdict, calculés sur tes vraies commandes.</p>
            <div className="meter" style={{ ["--w" as string]: "70%", marginTop: 18 }}>
              <span />
            </div>
            <p style={{ fontSize: 12 }}>Exemple : 70 % de closing, objectif 60 %</p>
          </div>
          <div className="card c4 rv">
            <h3>
              <Icon name="store" size={18} /> Pensé COD Afrique
            </h3>
            <p>Winners Afrique + Europe, paiement mobile money, prix en FCFA, closing local.</p>
            <div className="flags">
              {["CI", "SN", "CM", "GA", "BJ", "TG", "ML", "FR", "BE"].map((c) => (
                <span key={c}>
                  {flag(c)} {countryLabel(c)}
                </span>
              ))}
              <span>Orange Money · Wave · MTN</span>
            </div>
          </div>
          <div className="card c6 rv">
            <h3>
              <Icon name="crown" size={18} /> Vitrine des winners validés <span className="biz">Business</span>
            </h3>
            <p>
              Les produits déjà validés par la communauté (10 commandes reçues ou plus), 100 % anonymisés : catégorie,
              pays, closing et marge. Jamais le nom du vendeur ni sa boutique.
            </p>
            <div className="vitrine">
              {[
                ["Beauté", "CI", "68 %"],
                ["Bien-être", "SN", "72 %"],
                ["Maison", "CM", "61 %"],
                ["Sport", "FR", "64 %"],
              ].map(([c, k, v]) => (
                <div key={c}>
                  <b>{v}</b>
                  {c} · {flag(k)} {k}
                  <br />
                  <small>exemple de closing</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Tarifs */
const PAID: Plan[] = ["starter", "pro", "business"];
const TAGLINE: Record<Plan, string> = {
  free: "",
  starter: "L'essentiel pour se lancer",
  pro: "Tout le Starter, plus l'automatisation",
  business: "Tout le Pro, à grande échelle",
};
const SUPPORT: Record<Plan, string> = { free: "communautaire", starter: "standard", pro: "prioritaire", business: "prioritaire (VIP)" };

function features(p: Plan): { label: ReactNode; on: boolean }[] {
  const c = PLANS[p];
  const l = PLAN_LIMITS[p];
  return [
    {
      label: (
        <>
          <b>{nf(l.monthlySearches)}</b> recherches / mois
        </>
      ),
      on: l.monthlySearches > 0,
    },
    { label: "Feed, produits gagnants et boutiques en entier", on: true },
    { label: p === "starter" ? "Top Trend (aperçu : top 3)" : "Top Trend complet", on: true },
    { label: p === "starter" ? "Fiche boutique : infos + aperçu du catalogue" : "Fiche boutique complète : catalogue, prix, best-sellers", on: true },
    { label: <><b>Testing &amp; validation produit</b> — closing, marge, verdict</>, on: true },
    { label: "Téléchargement des vidéos et images de pub", on: true },
    { label: <>Suivi de <b>{c.competitorSlots}</b> concurrent{c.competitorSlots > 1 ? "s" : ""}</>, on: c.competitorSlots > 0 },
    {
      label: c.winnerEnabled ? (
        <>
          Winner Agent auto — <b>{c.winnerKeywords} mots-clés</b> × {c.winnerCountries} pays
        </>
      ) : (
        "Winner Agent automatique"
      ),
      on: c.winnerEnabled,
    },
    { label: "Alertes winners sur WhatsApp", on: c.whatsapp },
    { label: "Vitrine des winners validés", on: c.vitrineEnabled },
    { label: <>Support <b>{SUPPORT[p]}</b></>, on: true },
  ];
}

export function Tarifs() {
  const pcts = PAID.map((p) => {
    const c = PLANS[p];
    return c.priceFirst != null ? Math.round((1 - c.priceFirst / c.priceNormal) * 100) : 0;
  });
  const maxPct = Math.max(...pcts);
  return (
    <section id="tarifs" className="sec layer">
      <div className="wrap">
        <div className="center rv">
          <span className="eyebrow">Tarifs</span>
          <h2>
            Commence gratuit. <em>Passe payant quand tu gagnes.</em>
          </h2>
          <p className="lead">Paiement mobile money, pas de carte bancaire. Change ou annule quand tu veux.</p>
        </div>
        {maxPct > 0 && (
          <p className="promo rv">
            <Icon name="sparkles" size={15} /> Offre de lancement : jusqu&apos;à −{maxPct} % sur le 1er mois
          </p>
        )}
        <div className="plans">
          {PAID.map((p, i) => {
            const c = PLANS[p];
            const pop = p === "pro";
            return (
              <div key={p} className={`card plan rv ${pop ? "pop" : ""}`}>
                {pop && <span className="badge">Populaire</span>}
                <h3>{c.label}</h3>
                <p className="tl">{TAGLINE[p]}</p>
                {c.priceFirst != null ? (
                  <>
                    <p className="old">
                      <s>{nf(c.priceNormal)} FCFA</s>
                      <span className="pct">−{pcts[i]} %</span>
                    </p>
                    <p className="now">
                      {nf(c.priceFirst)}
                      <span>FCFA</span>
                    </p>
                    <p className="then">le 1er mois, puis {nf(c.priceNormal)} FCFA/mois</p>
                  </>
                ) : (
                  <p className="now" style={{ marginTop: 18 }}>
                    {nf(c.priceNormal)}
                    <span>FCFA/mois</span>
                  </p>
                )}
                <Link className={`btn ${pop ? "btn-primary" : ""}`} href={SIGNUP}>
                  Choisir cette offre
                </Link>
                <ul>
                  {features(p).map((f, k) => (
                    <li key={k} className={f.on ? "" : "off"}>
                      <span className={`mk ${f.on ? "yes" : "no"}`}>
                        <Icon name={f.on ? "check" : "x"} size={12} strokeWidth={3} />
                      </span>
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="free rv">
          <div>
            <b>Offre gratuite · 0 FCFA</b>
            <p>5 recherches par mois, 20 winners du jour, aperçu des produits et boutiques, 50 produits en test · sans carte bancaire</p>
          </div>
          <Link className="btn" href={SIGNUP}>
            Commencer gratuitement
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- FAQ */
const FAQ: { q: string; a: string }[] = [
  {
    q: "C'est quoi Look360 exactement ?",
    a: "Un outil qui t'aide à trouver des produits gagnants (spy Facebook, Afrique + Europe) ET à vérifier s'ils sont vraiment rentables avant d'investir, grâce au testing COD (taux de closing, marge, verdict).",
  },
  {
    q: "En quoi c'est différent d'un spy tool classique ?",
    a: "Un spy tool te montre des pubs qui tournent. Look360 va plus loin : il te dit si le produit va réellement se vendre et être rentable sur ton marché. Trouver la pub, c'est facile ; savoir si ça paie, c'est ça qui compte.",
  },
  {
    q: "Ça marche pour le COD en Afrique ?",
    a: "Oui, c'est fait pour ça. Winners Afrique + Europe, taux de closing, marge, paiement mobile money. Pensé pour les dropshippers africains.",
  },
  { q: "Je paie comment ?", a: "Par mobile money (Orange Money, Wave, MTN...). Pas besoin de carte bancaire." },
  {
    q: "Y a une version gratuite ?",
    a: "Oui. Tu commences gratuitement, sans carte. Tu passes payant quand tu veux plus de volume et les fonctions automatiques.",
  },
  {
    q: "Comment tester un produit sans avoir de stock ?",
    a: "Tu lances un test et tu mesures l'intérêt réel (taux de closing) avant même de commander ton stock. Un test devient valable à partir de 10 commandes reçues.",
  },
  {
    q: "Mes données sont privées ?",
    a: "Oui. Chaque compte ne voit que ses propres données. La vitrine communautaire est 100 % anonymisée : jamais ton nom, jamais le nom exact de tes produits.",
  },
  { q: "Je peux annuler quand je veux ?", a: "Oui, aucun engagement. Tu changes ou annules ton offre quand tu veux." },
];

export function Faq() {
  return (
    <section id="faq" className="sec layer">
      <div className="wrap">
        <div className="center rv">
          <h2>Questions fréquentes</h2>
        </div>
        <div className="faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
        <div className="final rv">
          <h2>
            Arrête de deviner.
            <br />
            <em>Commence à valider.</em>
          </h2>
          <p className="lead">Trouve, teste, valide, et investis seulement sur ce qui rapporte.</p>
          <div className="cta-row">
            <Link className="btn beam" href={SIGNUP}>
              <span className="halo" aria-hidden />
              Commencer gratuitement <span aria-hidden>→</span>
            </Link>
            <small>Aucune carte bancaire requise</small>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Footer */
const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Produit", links: [{ label: "Fonctions", href: "#fonctions" }, { label: "Comparatif", href: "#comparatif" }, { label: "Tarifs", href: "#tarifs" }] },
  { title: "Ressources", links: [{ label: "FAQ", href: "#faq" }, { label: "Support", href: `mailto:${SUPPORT_EMAIL}` }, { label: "WhatsApp", href: WHATSAPP_URL }] },
  { title: "Légal", links: [{ label: "Conditions d'utilisation", href: "/conditions" }, { label: "Confidentialité", href: "/confidentialite" }] },
];

/** `anchorBase="/"` hors landing : les liens #section renvoient vers la landing. */
export function Footer({ anchorBase = "" }: { anchorBase?: string }) {
  return (
    <>
      <footer className="foot layer">
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <img src="/look360-logo-light.svg" alt="Look360" width={140} height={38} />
              <p className="tag">Trouve. Teste. Valide.</p>
              <p>Pensé en Afrique, pour les dropshippers africains.</p>
            </div>
            {COLS.map((c) => (
              <div key={c.title}>
                <h4>{c.title}</h4>
                <ul>
                  {c.links.map((l) => (
                    <li key={l.label}>
                      {l.href.startsWith("/") ? (
                        <Link href={l.href}>{l.label}</Link>
                      ) : (
                        <a href={l.href.startsWith("#") ? `${anchorBase}${l.href}` : l.href} {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                          {l.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="foot-bottom">
            <span>© {new Date().getFullYear()} Look360. Tous droits réservés.</span>
            <span className="r">
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              <span>
                <span className="dot" aria-hidden /> Système opérationnel
              </span>
            </span>
          </div>
        </div>
      </footer>
      <a className="wa-fab" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" aria-label="Nous contacter sur WhatsApp">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.44 9.44 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.46-9.44 2.53 0 4.9.99 6.69 2.78a9.38 9.38 0 0 1 2.77 6.68c0 5.2-4.24 9.44-9.45 9.44zm8.04-17.48A11.36 11.36 0 0 0 12.05.5C5.8.5.72 5.58.72 11.82c0 2 .52 3.95 1.52 5.68L.62 23.5l6.14-1.61a11.3 11.3 0 0 0 5.29 1.35h.01c6.24 0 11.32-5.08 11.33-11.32a11.26 11.26 0 0 0-3.3-7.99z" />
        </svg>
      </a>
    </>
  );
}

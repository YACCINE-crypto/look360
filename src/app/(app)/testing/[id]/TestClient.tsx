"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ProgressRing, MeterBar, VerdictBadge, closingTone, margeTone, type Tone } from "@/components/dataviz";
import { computeTest, type ConfirmationTier } from "@/lib/testing";
import { marcheLabel, externalUrl } from "@/lib/produits";
import { autosaveTest, validerProduit, abandonnerProduit } from "../actions";

const CONFIRMATION_SHORT: Record<ConfirmationTier, string> = {
  faible: "Closing faible",
  correct: "Closing correct",
  normal: "Bon closing",
  super: "Excellent closing",
};

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

type Props = {
  produit: {
    id: string;
    nom: string | null;
    marche: string | null;
    categorie: string | null;
    cout_livre_estime: number | null;
    angle_marketing: string | null;
    lien_source: string | null;
    lien_concurrent: string | null;
    lien_ad_library: string | null;
    date_lancement_testing: string | null;
    image_url: string | null;
  };
  initial: {
    impressions: string;
    clics: string;
    recues: string;
    confirmees: string;
    prix: string;
    coutProduit: string;
    pub: string;
    frais: string;
  };
};

export function TestClient({ produit, initial }: Props) {
  const [recues, setRecues] = useState(initial.recues);
  const [confirmees, setConfirmees] = useState(initial.confirmees);
  const [prix, setPrix] = useState(initial.prix);
  const [coutProduit, setCoutProduit] = useState(initial.coutProduit);
  const [pub, setPub] = useState(initial.pub);
  const [frais, setFrais] = useState(initial.frais);

  const n = (s: string): number | null => {
    if (s.trim() === "") return null;
    const v = Number(s.replace(",", "."));
    return Number.isFinite(v) ? v : null;
  };

  const r = computeTest({
    prix_vente_prevu: n(prix),
    commandes_recues: n(recues),
    commandes_confirmees: n(confirmees),
    depense_pub: n(pub),
    cout_produit_estime: n(coutProduit),
    frais_livraison_prevu: n(frais),
  });

  // Verdict seulement quand les chiffres essentiels sont saisis (sinon « -0 »
  // et « Pas rentable » s'affichaient sur une fiche vide).
  const ready = n(prix) != null && n(confirmees) != null;
  const verdict = ready ? r.verdict : null;
  const duree = joursDepuis(produit.date_lancement_testing);
  const reco = recommandation({ ...r, verdict });

  // Enregistrement automatique (800 ms après la dernière saisie).
  const [save, setSave] = useState<{ state: "idle" | "saving" | "saved" | "error"; at?: string }>({ state: "idle" });
  const [deciding, startDecision] = useTransition();
  const savedKey = useRef<string | null>(null);
  const pending = useRef<Promise<unknown> | null>(null);
  const values = { prix, recues, confirmees, pub, coutProduit, frais };
  const key = JSON.stringify(values);

  function persist() {
    const p = autosaveTest({
      produit_id: produit.id,
      marche: produit.marche,
      prix_vente_prevu: n(prix),
      commandes_recues: n(recues),
      commandes_confirmees: n(confirmees),
      depense_pub: n(pub),
      cout_produit_estime: n(coutProduit),
      frais_livraison_prevu: n(frais),
    }).then((res) => setSave(res.ok ? { state: "saved", at: res.savedAt } : { state: "error" }));
    pending.current = p;
    return p;
  }

  useEffect(() => {
    // Rien à enregistrer tant que les chiffres n'ont pas changé.
    if (savedKey.current === null) savedKey.current = key;
    if (savedKey.current === key) return;
    const t = setTimeout(() => {
      savedKey.current = key;
      setSave({ state: "saving" });
      persist();
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function decide(action: typeof validerProduit) {
    startDecision(async () => {
      // On enregistre d'abord les derniers chiffres saisis.
      await persist();
      const fd = new FormData();
      fd.set("produit_id", produit.id);
      await action(fd);
    });
  }

  const cpa = n(pub) != null && (n(confirmees) ?? 0) > 0 ? n(pub)! / n(confirmees)! : null;

  return (
    <div className="space-y-6">
      {/* Barre d'action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/testing"
          className="text-muted-foreground hover:text-fg flex items-center gap-1 text-sm"
        >
          <Icon name="chevronRight" size={14} className="rotate-180" />
          Testing <span className="text-muted-foreground">/</span>
          <span className="text-fg font-medium">
            {produit.nom ?? "Sans nom"}
          </span>
        </Link>
        <span className="bg-chip-bleu text-chip-bleu-fg rounded-md px-2 py-1 text-xs font-medium">En test</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-6 lg:col-span-2">
        {/* En-tête produit */}
        <div className="flex items-center gap-4">
          <span className="border-border bg-input text-muted-foreground grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border">
            {produit.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={produit.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Icon name="image" size={22} />
            )}
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {produit.nom ?? "Sans nom"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {marcheLabel(produit.marche)}
              {produit.date_lancement_testing &&
                ` · Lancé le ${formatDate(produit.date_lancement_testing)}`}
            </p>
          </div>
        </div>

          <div className="border-border bg-surface rounded-xl border p-6">
            <div className="flex items-start justify-between">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Verdict du test
              </p>
              <div className="text-right">
                <p className="text-muted-foreground text-xs">Durée du test</p>
                <p className="font-bold">
                  {duree === null ? "—" : `${duree} jour${duree > 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            {verdict ? (
              <div className="mt-3">
                <VerdictBadge label={verdict.label} tone={verdictTone(verdict.tier)} size="lg" />
              </div>
            ) : (
              <span className="text-muted-foreground mt-3 inline-block text-sm">
                Renseigne les chiffres →
              </span>
            )}

            {/* Data-viz : anneau closing + jauge marge */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Closing = anneau de progression coloré */}
              <div className="border-border bg-bg flex items-center gap-4 rounded-xl border p-4">
                <ProgressRing
                  value={r.tauxConfirmation}
                  tone={closingTone(r.tauxConfirmation)}
                  size={92}
                  stroke={9}
                  sublabel="closing"
                />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">Taux de confirmation</p>
                  <p className={`text-lg font-bold leading-tight ${confColor(r.confirmation?.tier)}`}>
                    {r.confirmation ? CONFIRMATION_SHORT[r.confirmation.tier] : "À chiffrer"}
                  </p>
                  <p className="text-muted-foreground/80 mt-0.5 text-xs">Objectif ≥ 60 %</p>
                </div>
              </div>

              {/* Marge = jauge */}
              <div className="border-border bg-bg flex flex-col justify-center rounded-xl border p-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-muted-foreground text-xs">Marge nette</p>
                  <span className={`text-2xl font-bold tabular-nums ${marginColor(r.margePct)}`}>
                    {r.margePct === null ? "—" : `${r.margePct.toFixed(0)}%`}
                  </span>
                </div>
                <div className="mt-2">
                  <MeterBar
                    value={r.margePct}
                    tone={r.margePct == null ? "muted" : margeTone(r.margePct)}
                    target={30}
                    targetLabel="Objectif 30 %"
                    height={10}
                  />
                  <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                    <span>0 %</span>
                    <span>Objectif 30 %</span>
                    <span>100 %</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 cartes chiffres */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric label="Bénéfice projeté" hint="FCFA">
                <span
                  className={
                    ready && r.beneficeProjete !== null && r.beneficeProjete < 0
                      ? "text-danger-fg"
                      : ""
                  }
                >
                  {r.beneficeProjete === null || !ready
                    ? "—"
                    : new Intl.NumberFormat("fr-FR", {
                        maximumFractionDigits: 0,
                      }).format(r.beneficeProjete)}
                </span>
              </Metric>
              <Metric label="ROAS" hint="retour sur budget pub">
                <span className="text-warn-fg">
                  {r.roas === null ? "—" : `${r.roas.toFixed(1)}x`}
                </span>
              </Metric>
              <Metric label="Budget pub dépensé" hint="FCFA">
                {n(pub) === null
                  ? "—"
                  : new Intl.NumberFormat("fr-FR", {
                      maximumFractionDigits: 0,
                    }).format(n(pub)!)}
              </Metric>
            </div>
          </div>

          {/* Recommandation */}
          <div className="bg-secondary text-secondary-foreground flex items-start gap-2 rounded-xl p-4 text-sm">
            <span className="mt-0.5">💡</span>
            <p>
              <span className="font-semibold">Recommandation :</span> {reco}
            </p>
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-6">
          {/* Chiffres du test — enregistrés automatiquement */}
          <section className="border-border bg-surface shadow-card rounded-xl border">
            <header className="border-border-soft flex items-center justify-between gap-2 border-b px-5 py-3.5">
              <h2 className="text-sm font-semibold">Chiffres du test</h2>
              <SaveStatus state={save.state} at={save.at} />
            </header>

            <FieldGroup title="Commandes" aside={r.tauxConfirmation != null ? `Closing ${r.tauxConfirmation.toFixed(0)} %` : undefined}>
              <NumField label="Passées" unit="cmd" value={recues} onChange={setRecues} />
              <NumField label="Confirmées" unit="cmd" value={confirmees} onChange={setConfirmees} />
            </FieldGroup>

            <FieldGroup title="Prix et coûts" aside={r.margePct != null ? `Marge ${r.margePct.toFixed(0)} %` : undefined}>
              <NumField label="Prix de vente" unit="FCFA" value={prix} onChange={setPrix} />
              <NumField label="Coût produit" unit="FCFA" value={coutProduit} onChange={setCoutProduit} />
              <NumField label="Livraison / commande" unit="FCFA" value={frais} onChange={setFrais} wide />
            </FieldGroup>

            <FieldGroup title="Publicité" aside={cpa != null ? `${nf.format(cpa)} FCFA / cmd confirmée` : undefined} last>
              <NumField label="Budget pub dépensé" unit="FCFA" value={pub} onChange={setPub} wide />
            </FieldGroup>
          </section>

          {produit.angle_marketing && (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Angle marketing</h2>
              <p className="border-border bg-surface rounded-xl border p-4 text-sm">
                {produit.angle_marketing}
              </p>
            </div>
          )}

          {(externalUrl(produit.lien_source) ||
            externalUrl(produit.lien_concurrent) ||
            externalUrl(produit.lien_ad_library)) && (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Liens</h2>
              <div className="space-y-2 text-sm">
                <ExternalLink href={externalUrl(produit.lien_source)} label="Voir fournisseur" />
                <ExternalLink
                  href={externalUrl(produit.lien_concurrent)}
                  label="Voir boutique concurrent"
                />
                <ExternalLink
                  href={externalUrl(produit.lien_ad_library)}
                  label="Voir pub concurrent"
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Décision — en bas de la fiche */}
      <div className="border-border bg-surface/95 shadow-raised sticky bottom-3 z-20 flex flex-col gap-3 rounded-xl border p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Décision sur ce produit</p>
          <p className="text-muted-foreground truncate text-xs">
            {verdict ? `Verdict actuel : ${verdict.label}` : "Renseigne le prix et les commandes confirmées pour obtenir un verdict"}
            {save.state === "saving" ? " · enregistrement…" : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={deciding}
            onClick={() => decide(abandonnerProduit)}
            className="text-danger-fg border-border hover:border-danger-fg hover:bg-danger-bg inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border px-4 text-sm font-semibold transition-colors disabled:opacity-60 sm:flex-none"
          >
            <Icon name="x" size={15} /> Rejeter
          </button>
          <button
            type="button"
            disabled={deciding}
            onClick={() => decide(validerProduit)}
            className="bg-success-fg text-accent-on inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md px-5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 sm:flex-none"
          >
            <Icon name="check" size={15} /> {deciding ? "…" : "Valider le produit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveStatus({ state, at }: { state: "idle" | "saving" | "saved" | "error"; at?: string }) {
  if (state === "idle") return <span className="text-muted-foreground text-xs">Enregistrement automatique</span>;
  if (state === "saving") return <span className="text-muted-foreground text-xs">Enregistrement…</span>;
  if (state === "error") return <span className="text-danger-fg text-xs font-medium">Échec de l&apos;enregistrement</span>;
  const t = at ? new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <span className="text-success-fg flex items-center gap-1 text-xs font-medium">
      <Icon name="check" size={12} /> Enregistré {t && `à ${t}`}
    </span>
  );
}

function FieldGroup({
  title,
  aside,
  last = false,
  children,
}: {
  title: string;
  aside?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <fieldset className={`px-5 py-4 ${last ? "" : "border-border-soft border-b"}`}>
      <legend className="sr-only">{title}</legend>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{title}</p>
        {aside && <p className="text-accent text-xs font-semibold tabular-nums">{aside}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </fieldset>
  );
}

/** Champ numérique : grand chiffre aligné à droite, unité intégrée. */
function NumField({
  label,
  unit,
  value,
  onChange,
  wide = false,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
}) {
  return (
    <label className={`group block ${wide ? "col-span-2" : ""}`}>
      <span className="text-fg-2 mb-1 block text-xs font-medium">{label}</span>
      <span className="border-border bg-bg group-focus-within:border-accent group-focus-within:bg-surface group-focus-within:shadow-focus flex h-11 items-center gap-2 rounded-md border px-3 transition-colors">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, ""))}
          placeholder="0"
          className="placeholder:text-muted-foreground/50 min-w-0 flex-1 bg-transparent text-right text-base font-semibold tabular-nums outline-none"
        />
        <span className="text-muted-foreground shrink-0 text-xs">{unit}</span>
      </span>
    </label>
  );
}

/** Lien externe cliquable (nouvel onglet). Rien si href vide → pas de lien mort. */
function ExternalLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent flex items-center gap-2 hover:underline"
    >
      <Icon name="chevronRight" size={14} /> {label}
    </a>
  );
}

function Metric({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-input rounded-lg p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{children}</p>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
    </div>
  );
}

function confColor(tier?: ConfirmationTier): string {
  if (!tier) return "text-muted-foreground";
  if (tier === "faible") return "text-danger-fg";
  if (tier === "correct") return "text-warn-fg";
  return "text-success-fg";
}
function marginColor(margePct: number | null): string {
  if (margePct === null) return "";
  if (margePct >= 30) return "text-success-fg";
  if (margePct >= 15) return "text-warn-fg";
  return "text-danger-fg";
}
function verdictTone(tier: string): Tone {
  if (tier === "rentable") return "success";
  if (tier === "moyen") return "warning";
  return "danger";
}

function recommandation(r: ReturnType<typeof computeTest>): string {
  if (!r.verdict) return "Renseigne les chiffres du test pour obtenir le verdict.";
  if (r.verdict.tier === "rentable" && (r.tauxConfirmation ?? 0) >= 45)
    return "Le taux de closing dépasse l'objectif et la marge est solide. Ce produit est prêt pour la production.";
  if (r.verdict.tier === "pas_rentable")
    return "Le test n'est pas rentable en l'état. Revois le prix, le coût produit ou l'angle avant de continuer.";
  return "Résultats corrects mais à optimiser (prix, closing ou coût) avant de valider.";
}

function joursDepuis(dateISO: string | null): number | null {
  if (!dateISO) return null;
  const d = new Date(dateISO + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const j = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  return j >= 0 ? j : null;
}

function formatDate(dateISO: string): string {
  return new Date(dateISO + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

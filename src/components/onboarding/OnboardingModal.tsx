"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, FlaskConical, Search, Trophy, Users, X } from "lucide-react";
import { finishOnboarding } from "@/lib/onboarding/actions";
import {
  normalizePhone,
  ONBOARDING_MARKETS,
  ONBOARDING_NICHES,
  WHATSAPP_COMMUNITY_URL,
} from "@/lib/onboarding/options";
import "./onboarding.css";

/**
 * Onboarding de 1re connexion (adapté du composant « Onboarding Dialog » de
 * 21st.dev : points de progression animés + transition entre étapes, sans
 * carrousel externe). Thème Nuit. Affiché une seule fois : terminer OU passer
 * marque l'onboarding comme vu en base (profiles.onboarding_done_at).
 */

const STEPS = ["bienvenue", "fonctionnement", "profil", "whatsapp", "go"] as const;
type Step = (typeof STEPS)[number];

const LABEL: Record<Step, string> = {
  bienvenue: "Bienvenue",
  fonctionnement: "Comment ça marche",
  profil: "Ton profil",
  whatsapp: "WhatsApp",
  go: "C'est parti",
};

export function OnboardingModal({ firstName, planLabel }: { firstName: string; planLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [niches, setNiches] = useState<string[]>([]);
  const [markets, setMarkets] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [optin, setOptin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  const step = STEPS[i];

  // Verrouille le défilement de la page derrière la fenêtre.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const go = (to: number) => {
    setError(null);
    setDir(to > i ? 1 : -1);
    setI(to);
  };

  /** Termine (ou passe) : enregistre et ferme. `href` = destination finale. */
  const finish = (opts: { skip?: boolean; href?: string } = {}) =>
    start(async () => {
      const res = await finishOnboarding(
        opts.skip
          ? {}
          : { niches, markets, whatsapp: phone, optin },
      );
      if (!res.ok) {
        setError(res.error);
        if (!opts.skip) return;
      }
      setOpen(false);
      if (opts.href) router.push(opts.href);
      else router.refresh();
    });

  const next = () => {
    if (step === "whatsapp") {
      if (optin && !normalizePhone(phone)) {
        setError("Ajoute un numéro valide avec l'indicatif (ex. +225 07 00 00 00 00) pour recevoir les alertes.");
        return;
      }
      if (phone.trim() && !normalizePhone(phone)) {
        setError("Numéro invalide : écris-le avec l'indicatif, ex. +225 07 00 00 00 00.");
        return;
      }
    }
    go(Math.min(i + 1, STEPS.length - 1));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) finish({ skip: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  if (!open) return null;

  return (
    <div className="onb" role="presentation">
      <motion.div
        className="onb-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        aria-hidden
      />
      <motion.div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onb-title"
        className="onb-panel"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="onb-top">
          <span className="onb-count">
            Étape {i + 1}/{STEPS.length} · {LABEL[step]}
          </span>
          <button type="button" className="onb-skip" onClick={() => finish({ skip: true })} disabled={pending}>
            Passer <X size={15} aria-hidden />
          </button>
        </header>

        {/* Points de progression animés (repris du composant 21st.dev). */}
        <div className="onb-dots" role="tablist" aria-label="Progression">
          {STEPS.map((s, k) => (
            <motion.button
              key={s}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={LABEL[s]}
              className={`onb-dot ${k <= i ? "on" : ""}`}
              animate={{ width: k === i ? 28 : 10, opacity: k <= i ? 1 : 0.45 }}
              initial={false}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onClick={() => k < i && go(k)}
              disabled={k > i}
            />
          ))}
        </div>

        <div className="onb-stage">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.section
              key={step}
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * 28 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: d * -28 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="onb-body"
            >
              {step === "bienvenue" && (
                <>
                  <span className="onb-mark" aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/look360-icon.svg" alt="" width={44} height={44} />
                  </span>
                  <h2 id="onb-title">
                    Bienvenue sur Look360{firstName ? `, ${firstName}` : ""}
                  </h2>
                  <p className="onb-lead">
                    Trouve les produits qui se vendent déjà, teste-les et n&apos;investis que dans ceux qui sont rentables.
                  </p>
                  <p className="onb-pill">
                    <Check size={14} aria-hidden /> Ton compte {planLabel} est actif
                  </p>
                </>
              )}

              {step === "fonctionnement" && (
                <>
                  <h2 id="onb-title">Comment ça marche</h2>
                  <p className="onb-lead">Trois étapes, de la pub repérée au produit rentable.</p>
                  <ol className="onb-flow">
                    <li>
                      <span className="onb-ico">
                        <Search size={20} aria-hidden />
                      </span>
                      <div>
                        <b>Trouve</b>
                        <p>Les pubs qui tournent depuis des semaines en Afrique et en Europe.</p>
                      </div>
                      <div className="onb-vis" aria-hidden>
                        <span className="onb-bar w80" />
                        <span className="onb-bar w55" />
                        <span className="onb-tag">Score 87</span>
                      </div>
                    </li>
                    <li>
                      <span className="onb-ico">
                        <FlaskConical size={20} aria-hidden />
                      </span>
                      <div>
                        <b>Teste</b>
                        <p>Entre tes commandes reçues et confirmées : closing et marge calculés.</p>
                      </div>
                      <div className="onb-vis" aria-hidden>
                        <span className="onb-ring" />
                        <span className="onb-tag">Closing</span>
                      </div>
                    </li>
                    <li>
                      <span className="onb-ico">
                        <Trophy size={20} aria-hidden />
                      </span>
                      <div>
                        <b>Valide</b>
                        <p>Un verdict clair avant d&apos;acheter ton stock.</p>
                      </div>
                      <div className="onb-vis" aria-hidden>
                        <span className="onb-ok">
                          <Check size={16} />
                        </span>
                        <span className="onb-tag">Rentable</span>
                      </div>
                    </li>
                  </ol>
                </>
              )}

              {step === "profil" && (
                <>
                  <h2 id="onb-title">Ton profil</h2>
                  <p className="onb-lead">On met en avant ces niches et ces pays dans ton feed. Modifiable à tout moment.</p>
                  <fieldset className="onb-group">
                    <legend>Tes niches</legend>
                    <div className="onb-chips">
                      {ONBOARDING_NICHES.map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={niches.includes(n)}
                          className="onb-chip"
                          onClick={() => toggle(niches, setNiches, n)}
                        >
                          {niches.includes(n) && <Check size={13} aria-hidden />} {n}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="onb-group">
                    <legend>Tes marchés</legend>
                    <div className="onb-chips">
                      {ONBOARDING_MARKETS.map((m) => (
                        <button
                          key={m.code}
                          type="button"
                          aria-pressed={markets.includes(m.code)}
                          className="onb-chip"
                          onClick={() => toggle(markets, setMarkets, m.code)}
                        >
                          {markets.includes(m.code) && <Check size={13} aria-hidden />} {m.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </>
              )}

              {step === "whatsapp" && (
                <>
                  <h2 id="onb-title">Les winners sur WhatsApp</h2>
                  <p className="onb-lead">Facultatif. Reçois les alertes et les infos Look360 là où tu es déjà.</p>
                  <label className="onb-field">
                    <span>Ton numéro WhatsApp</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+225 07 00 00 00 00"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </label>
                  <label className="onb-check">
                    <input type="checkbox" checked={optin} onChange={(e) => setOptin(e.target.checked)} />
                    <span>Je veux recevoir les alertes et infos sur WhatsApp</span>
                  </label>
                  <p className="onb-note">Tu peux te désinscrire à tout moment dans Paramètres.</p>
                  <div className="onb-wa">
                    <WaLink href={WHATSAPP_COMMUNITY_URL} icon={<Users size={16} aria-hidden />}>
                      Rejoindre la communauté
                    </WaLink>
                  </div>
                </>
              )}

              {step === "go" && (
                <>
                  <span className="onb-mark done" aria-hidden>
                    <Check size={26} strokeWidth={3} />
                  </span>
                  <h2 id="onb-title">Tout est prêt</h2>
                  <p className="onb-lead">Commence par les winners du jour, ou lance ta propre recherche.</p>
                  <div className="onb-ctas">
                    <button type="button" className="onb-btn primary" disabled={pending} onClick={() => finish({ href: "/recherche" })}>
                      Explore le feed <ArrowRight size={16} aria-hidden />
                    </button>
                    <button type="button" className="onb-btn ghost" disabled={pending} onClick={() => finish({ href: "/spy" })}>
                      Fais ta première recherche
                    </button>
                  </div>
                </>
              )}
            </motion.section>
          </AnimatePresence>
        </div>

        {error && (
          <p className="onb-error" role="alert">
            {error}
          </p>
        )}

        {step !== "go" && (
          <footer className="onb-foot">
            {i > 0 ? (
              <button type="button" className="onb-btn ghost" onClick={() => go(i - 1)}>
                <ArrowLeft size={16} aria-hidden /> Retour
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="onb-btn primary" onClick={next}>
              {step === "bienvenue" ? "Commencer" : "Continuer"} <ArrowRight size={16} aria-hidden />
            </button>
          </footer>
        )}
      </motion.div>
    </div>
  );
}

/** Lien vers la communauté WhatsApp (« bientôt » si aucun lien). */
function WaLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  if (!href) {
    return (
      <span className="onb-btn wa disabled" aria-disabled="true">
        {icon} {children} <em>Bientôt</em>
      </span>
    );
  }
  return (
    <a className="onb-btn wa" href={href} target="_blank" rel="noopener noreferrer">
      {icon} {children}
    </a>
  );
}

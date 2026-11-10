"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, Link2, Loader2, Lock, QrCode, RefreshCw, RotateCcw, Send, ShieldAlert, Webhook } from "lucide-react";
import { waDispatch, waLink, waQr, waRefresh, waRestart, waState, waTest, waWebhook, type WaState } from "./actions";

// Écran superadmin : un PARCOURS de mise en service (5 étapes, dans l'ordre réel)
// + un panneau d'état (instance, volume du jour). Chaque bouton désactivé dit pourquoi.

type Tone = "ok" | "warn" | "bad" | "idle";
const STATUS: Record<string, { label: string; tone: Tone }> = {
  connected: { label: "Connectée", tone: "ok" },
  qr: { label: "En attente du scan", tone: "warn" },
  connecting: { label: "Connexion en cours", tone: "warn" },
  created: { label: "Créée, à connecter", tone: "warn" },
  disconnected: { label: "Déconnectée", tone: "bad" },
  unknown: { label: "Statut inconnu", tone: "idle" },
  none: { label: "Aucune instance", tone: "idle" },
};
const DOT: Record<Tone, string> = { ok: "bg-success", warn: "bg-warn", bad: "bg-danger", idle: "bg-muted-foreground" };
const TEXT: Record<Tone, string> = { ok: "text-success-fg", warn: "text-warn-fg", bad: "text-danger-fg", idle: "text-fg-2" };

type Step = 1 | 2 | 3 | 4 | 5;
type Msg = { step: Step | 0; ok: boolean; text: string };

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function WhatsAppAdmin({ initial }: { initial: WaState }) {
  const [s, setS] = useState(initial);
  const [qr, setQr] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [linkId, setLinkId] = useState("");
  const [webhookOk, setWebhookOk] = useState(false);
  const [testOk, setTestOk] = useState(false);
  const [pending, start] = useTransition();
  const polling = useRef<number | null>(null);

  const reload = useCallback(async () => setS(await waState()), []);
  const run = (
    step: Step | 0,
    fn: () => Promise<{ ok: boolean; error?: string; data?: string }>,
    okText: string,
    onOk?: () => void,
  ) =>
    start(async () => {
      const r = await fn();
      if (r.ok) onOk?.();
      setMsg({ step, ok: r.ok, text: r.ok ? (r.data ? `${okText} ${r.data}` : okText) : (r.error ?? "Erreur inattendue.") });
      await reload();
    });

  // Pendant le scan : statut en direct toutes les 4 s (3 min max), jusqu'à « connectée ».
  const stopPoll = () => {
    if (polling.current) window.clearInterval(polling.current);
    polling.current = null;
  };
  const startPoll = () => {
    stopPoll();
    const t0 = Date.now();
    polling.current = window.setInterval(async () => {
      const r = await waRefresh();
      await reload();
      const done = r.ok && r.data === "connected";
      if (done || Date.now() - t0 > 180_000) {
        stopPoll();
        setQr(null);
        setMsg(
          done
            ? { step: 2, ok: true, text: "Numéro connecté." }
            : { step: 2, ok: false, text: "QR expiré sans scan. Affiche-le à nouveau." },
        );
      }
    }, 4000);
  };
  useEffect(() => stopPoll, []);

  const statusKey = s.instance ? s.instance.status : "none";
  const st = STATUS[statusKey] ?? STATUS.unknown;
  const connected = statusKey === "connected";

  // État de chaque étape (done = vérifié côté serveur ou réussi dans cette session).
  const done: Record<Step, boolean> = {
    1: s.configured && s.webhookReady,
    2: connected,
    3: webhookOk,
    4: testOk,
    5: s.enabled,
  };
  const blocked: Record<Step, string | null> = {
    1: null,
    2: s.configured ? null : "Ajoute d'abord SWATS_API_KEY (étape 1).",
    3: !s.webhookReady ? "Ajoute d'abord SWATS_WEBHOOK_TOKEN (étape 1)." : !s.instance ? "Crée d'abord l'instance (étape 2)." : null,
    4: connected ? null : "Le numéro doit être connecté (étape 2).",
    5: null,
  };
  const current = ([1, 2, 3, 4, 5] as Step[]).find((k) => !done[k] && !blocked[k]) ?? null;
  const doneCount = Object.values(done).filter(Boolean).length;
  const feedback = (step: Step) => (msg && msg.step === step ? <Feedback ok={msg.ok} text={msg.text} /> : null);

  const usage = s.dailyLimit > 0 ? Math.min(100, Math.round((s.sentToday / s.dailyLimit) * 100)) : 0;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ---------- Parcours de mise en service ---------- */}
      <section aria-labelledby="wa-setup" className="border-border bg-surface rounded-xl border">
        <header className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 id="wa-setup" className="text-fg text-base font-bold">
              Mise en service
            </h2>
            <p className="text-muted-foreground text-sm">Dans l&apos;ordre. Rien ne part aux abonnés avant l&apos;étape 5.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-fg-2 text-sm font-semibold tabular-nums">{doneCount}/5</span>
            <span className="bg-input h-1.5 w-24 overflow-hidden rounded-full" aria-hidden>
              <span className="bg-accent block h-full rounded-full transition-[width]" style={{ width: `${doneCount * 20}%` }} />
            </span>
          </div>
        </header>

        <ol className="divide-border divide-y">
          {/* 1. Clés serveur */}
          <StepRow n={1} title="Clés serveur dans Vercel" done={done[1]} current={current === 1} blocked={blocked[1]}>
            <ul className="mt-2 space-y-1.5">
              <EnvLine name="SWATS_API_KEY" ok={s.configured} hint="clé sk_live_ de ton compte SWATS" />
              <EnvLine name="SWATS_WEBHOOK_TOKEN" ok={s.webhookReady} hint="32 caractères aléatoires ou plus" />
            </ul>
            {!done[1] && (
              <p className="text-muted-foreground mt-2 text-sm">
                Vercel → Settings → Environment Variables (Production), puis <strong className="text-fg-2">Redeploy</strong>.
              </p>
            )}
          </StepRow>

          {/* 2. Connexion du numéro */}
          <StepRow n={2} title="Connecter le numéro dédié" done={done[2]} current={current === 2} blocked={blocked[2]}>
            <p className="text-muted-foreground mt-1 text-sm">
              {connected
                ? `Connecté${s.instance?.phone ? ` : ${s.instance.phone}` : ""}.`
                : s.instance
                  ? "Un numéro réservé à Look360, jamais ton numéro perso. Connexion par QR code."
                  : "Colle l'ID de l'instance SWATS, même tronqué : le début suffit. Laisse vide pour détecter l'instance de ton compte. Aucune instance n'est créée."}
            </p>
            {!blocked[2] && !connected && (
              <div className="mt-3 flex flex-wrap gap-2">
                {!s.instance ? (
                  <form
                    className="flex w-full max-w-lg flex-col gap-2 sm:flex-row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(2, () => waLink(linkId), "Instance reliée. Statut :");
                    }}
                  >
                    <label htmlFor="wa-instance-id" className="sr-only">
                      ID de l&apos;instance SWATS
                    </label>
                    <input
                      id="wa-instance-id"
                      placeholder="ID ou début de l'ID (ex. scalor_6af3…)"
                      value={linkId}
                      onChange={(e) => setLinkId(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      className="border-border bg-surface text-fg focus:border-accent focus-visible:ring-accent/30 min-h-10 flex-1 rounded-md border px-3 font-mono text-sm outline-none focus-visible:ring-2"
                    />
                    <Btn primary type="submit" disabled={pending} icon={<Link2 size={16} />}>
                      Relier l&apos;instance
                    </Btn>
                  </form>
                ) : (
                  <Btn
                    primary
                    disabled={pending}
                    icon={<QrCode size={16} />}
                    onClick={() =>
                      start(async () => {
                        const r = await waQr();
                        if (r.ok && r.data) {
                          setQr(r.data);
                          setMsg(null);
                          startPoll();
                        } else setMsg({ step: 2, ok: false, text: r.ok ? "QR indisponible." : r.error });
                      })
                    }
                  >
                    {qr ? "Nouveau QR code" : "Afficher le QR code"}
                  </Btn>
                )}
              </div>
            )}
            {qr && (
              <div className="border-border bg-bg mt-4 flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR code de connexion WhatsApp" width={200} height={200} className="bg-surface rounded-md p-2" />
                <div className="text-sm">
                  <ol className="text-fg-2 list-decimal space-y-1 pl-5">
                    <li>Sur le téléphone du numéro dédié, ouvre WhatsApp.</li>
                    <li>Paramètres → Appareils connectés → Connecter un appareil.</li>
                    <li>Scanne ce code.</li>
                  </ol>
                  <p className="text-muted-foreground mt-3 inline-flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> En attente du scan…
                  </p>
                </div>
              </div>
            )}
            {feedback(2)}
          </StepRow>

          {/* 3. Webhook */}
          <StepRow n={3} title="Brancher le webhook" done={done[3]} current={current === 3} blocked={blocked[3]}>
            <p className="text-muted-foreground mt-1 text-sm">
              Fait remonter les déconnexions et les réponses STOP (désabonnement automatique).
            </p>
            {!blocked[3] && (
              <div className="mt-3">
                <Btn
                  primary={current === 3}
                  disabled={pending}
                  onClick={() => run(3, waWebhook, "Webhook branché :", () => setWebhookOk(true))}
                  icon={<Webhook size={16} />}
                >
                  {webhookOk ? "Rebrancher" : "Brancher le webhook"}
                </Btn>
              </div>
            )}
            {feedback(3)}
          </StepRow>

          {/* 4. Test */}
          <StepRow n={4} title="Envoyer un test à ton numéro" done={done[4]} current={current === 4} blocked={blocked[4]}>
            <p className="text-muted-foreground mt-1 text-sm">Part même si l&apos;envoi aux abonnés est coupé.</p>
            {!blocked[4] && (
              <form
                className="mt-3 flex max-w-lg flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(4, () => waTest(testNumber), "Message de test envoyé. Vérifie ton WhatsApp.", () => setTestOk(true));
                }}
              >
                <label htmlFor="wa-test" className="sr-only">
                  Ton numéro WhatsApp
                </label>
                <input
                  id="wa-test"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+225 07 00 00 00 00"
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  className="border-border bg-surface text-fg focus:border-accent focus-visible:ring-accent/30 min-h-10 flex-1 rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
                />
                <Btn primary={current === 4} type="submit" disabled={pending || !testNumber.trim()} icon={<Send size={16} />}>
                  Envoyer le test
                </Btn>
              </form>
            )}
            {feedback(4)}
          </StepRow>

          {/* 5. Activation */}
          <StepRow n={5} title="Activer l'envoi aux abonnés" done={done[5]} current={current === 5} blocked={blocked[5]}>
            <p className="text-muted-foreground mt-1 text-sm">
              {s.enabled ? (
                "Actif : les alertes partent sur WhatsApp aux abonnés Pro et Business qui ont accepté (repli e-mail + push en cas d'échec)."
              ) : (
                <>
                  Coupé : toutes les alertes partent par e-mail et push. Pour activer, mets{" "}
                  <code className="bg-input text-fg rounded px-1.5 py-0.5 font-mono text-xs">SWATS_ENABLED=true</code> dans Vercel puis
                  redéploie.
                </>
              )}
            </p>
          </StepRow>
        </ol>
      </section>

      {/* ---------- Panneau d'état ---------- */}
      <aside className="space-y-4 lg:sticky lg:top-6">
        <section aria-labelledby="wa-instance" className="border-border bg-surface rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="wa-instance" className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Instance
            </h2>
            {s.instance && (
              <button
                type="button"
                onClick={() => run(0, waRefresh, "Statut vérifié :")}
                disabled={pending}
                aria-label="Vérifier le statut maintenant"
                className="text-muted-foreground hover:bg-input hover:text-fg focus-visible:ring-accent/30 grid h-8 w-8 place-items-center rounded-md outline-none focus-visible:ring-2 disabled:opacity-50"
              >
                <RefreshCw size={15} className={pending ? "animate-spin" : ""} />
              </button>
            )}
          </div>
          <p className={`mt-2 flex items-center gap-2 text-base font-semibold ${TEXT[st.tone]}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${DOT[st.tone]}`} aria-hidden />
            {st.label}
          </p>
          {s.instance ? (
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label="Numéro" value={s.instance.phone ?? "—"} />
              <Row label="ID" value={<span className="font-mono text-xs">{s.instance.id}</span>} />
              <Row label="Vérifié" value={fmt(s.instance.statusAt)} />
            </dl>
          ) : (
            <p className="text-muted-foreground mt-1 text-sm">À relier à l&apos;étape 2.</p>
          )}
          {s.instance?.lastError && (
            <p className="bg-danger-bg text-danger-fg mt-3 flex items-start gap-2 rounded-md p-2.5 text-sm">
              <ShieldAlert size={15} className="mt-0.5 shrink-0" /> {s.instance.lastError}
            </p>
          )}
          {s.instance && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(0, waRestart, "Instance redémarrée : affiche le QR et scanne à nouveau.")}
              className="text-fg-2 hover:text-fg mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline disabled:opacity-50"
            >
              <RotateCcw size={14} /> Reconnecter
            </button>
          )}
          {msg?.step === 0 && <Feedback ok={msg.ok} text={msg.text} />}
        </section>

        <section aria-labelledby="wa-today" className="border-border bg-surface rounded-xl border p-4">
          <h2 id="wa-today" className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Aujourd&apos;hui
          </h2>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-fg text-2xl font-bold tabular-nums">{s.sentToday}</span>
            <span className="text-muted-foreground text-sm tabular-nums">/ {s.dailyLimit} envois max</span>
          </div>
          <span className="bg-input mt-2 block h-1.5 overflow-hidden rounded-full" aria-hidden>
            <span className={`block h-full rounded-full ${usage >= 90 ? "bg-danger" : "bg-accent"}`} style={{ width: `${usage}%` }} />
          </span>
          <dl className="border-border mt-4 space-y-1.5 border-t pt-3 text-sm">
            <Row label="En file d'attente" value={<span className="tabular-nums">{s.queued}</span>} />
            <Row label="Abonnés (opt-in)" value={<span className="tabular-nums">{s.optins}</span>} />
          </dl>
          {s.queued > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(0, waDispatch, "Passage d'envoi :")}
              className="border-border text-fg hover:bg-input mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border text-sm font-semibold disabled:opacity-50"
            >
              <Send size={14} /> Envoyer la file maintenant
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}

function StepRow({
  n,
  title,
  done,
  current,
  blocked,
  children,
}: {
  n: Step;
  title: string;
  done: boolean;
  current: boolean;
  blocked: string | null;
  children: React.ReactNode;
}) {
  const badge = done
    ? "bg-success text-accent-on"
    : current
      ? "bg-accent text-accent-on"
      : "border-border text-muted-foreground border bg-surface";
  return (
    <li className={`flex gap-4 px-5 py-4 ${current ? "bg-bg" : ""}`} aria-current={current ? "step" : undefined}>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums ${badge}`}>
        {done ? <Check size={15} strokeWidth={3} aria-label="Fait" /> : n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <h3 className={`text-sm font-semibold ${blocked && !done ? "text-muted-foreground" : "text-fg"}`}>{title}</h3>
        {blocked && !done ? (
          <p className="text-muted-foreground mt-1 flex items-start gap-1.5 text-sm">
            <Lock size={13} className="mt-1 shrink-0" aria-hidden /> {blocked}
          </p>
        ) : (
          children
        )}
      </div>
    </li>
  );
}

function EnvLine({ name, ok, hint }: { name: string; ok: boolean; hint: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
      <span className={`inline-flex items-center gap-1.5 font-medium ${ok ? "text-success-fg" : "text-warn-fg"}`}>
        {ok ? <Check size={14} strokeWidth={2.5} /> : <span className="bg-warn h-2 w-2 rounded-full" aria-hidden />}
        {ok ? "Présente" : "Manquante"}
      </span>
      <code className="bg-input text-fg rounded px-1.5 py-0.5 font-mono text-xs">{name}</code>
      {!ok && <span className="text-muted-foreground">({hint})</span>}
    </li>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-fg min-w-0 truncate text-right font-medium">{value}</dd>
    </div>
  );
}

function Feedback({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p role="status" className={`mt-3 rounded-md px-3 py-2 text-sm font-medium ${ok ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg"}`}>
      {text}
    </p>
  );
}

function Btn({
  children,
  icon,
  primary,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      {...p}
      className={`focus-visible:ring-accent/30 inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 disabled:cursor-default disabled:opacity-50 ${
        primary ? "bg-accent text-accent-on hover:bg-accent-hover" : "border-border text-fg hover:bg-input border bg-surface"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

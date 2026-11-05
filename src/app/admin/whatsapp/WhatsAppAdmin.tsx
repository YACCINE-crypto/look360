"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Plug, QrCode, RefreshCw, Send, ShieldAlert, Webhook, Zap } from "lucide-react";
import { waCreate, waDispatch, waQr, waRefresh, waRestart, waState, waTest, waWebhook, type WaState } from "./actions";

const STATUS: Record<string, { label: string; tone: string }> = {
  connected: { label: "Connectée", tone: "bg-success-bg text-success-fg" },
  qr: { label: "En attente du scan", tone: "bg-warn-bg text-warn-fg" },
  connecting: { label: "Connexion…", tone: "bg-warn-bg text-warn-fg" },
  created: { label: "Créée — à connecter", tone: "bg-secondary text-accent" },
  disconnected: { label: "Déconnectée", tone: "bg-danger-bg text-danger-fg" },
  unknown: { label: "Inconnu", tone: "bg-input text-fg-2" },
};

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function WhatsAppAdmin({ initial }: { initial: WaState }) {
  const [s, setS] = useState(initial);
  const [qr, setQr] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [pending, start] = useTransition();
  const polling = useRef<number | null>(null);

  const reload = useCallback(async () => setS(await waState()), []);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: string }>, okText: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.data ? `${okText} ${r.data}` : okText } : { ok: false, text: r.error ?? "Erreur" });
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
      if ((r.ok && r.data === "connected") || Date.now() - t0 > 180_000) {
        stopPoll();
        if (r.ok && r.data === "connected") {
          setQr(null);
          setMsg({ ok: true, text: "Instance connectée. Configure le webhook puis envoie un test." });
        }
      }
    }, 4000);
  };
  useEffect(() => stopPoll, []);

  const status = s.instance?.status ?? "unknown";
  const st = STATUS[status] ?? STATUS.unknown;

  return (
    <div className="space-y-6">
      {/* Configuration serveur (aucune valeur secrète affichée) */}
      <section className="border-border bg-surface shadow-card grid gap-3 rounded-2xl border p-5 sm:grid-cols-4">
        <Flag label="Clé SWATS_API_KEY" on={s.configured} />
        <Flag label="Webhook (jeton secret)" on={s.webhookReady} />
        <Flag label="Envoi réel (SWATS_ENABLED)" on={s.enabled} offText="Coupé : e-mail + push" />
        <div>
          <p className="text-muted-foreground text-xs font-medium">Aujourd&apos;hui</p>
          <p className="text-fg mt-1 text-sm font-semibold tabular-nums">
            {s.sentToday}/{s.dailyLimit} envoyés · {s.queued} en file · {s.optins} abonnés
          </p>
        </div>
      </section>

      {/* Instance */}
      <section className="border-border bg-surface shadow-card space-y-4 rounded-2xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-fg text-lg font-bold">Instance WhatsApp</h2>
            <p className="text-muted-foreground text-sm">
              {s.instance ? (
                <>
                  ID <span className="font-mono">{s.instance.id}</span>
                  {s.instance.phone ? ` · ${s.instance.phone}` : ""} · statut du {fmt(s.instance.statusAt)}
                </>
              ) : (
                "Aucune instance. Crée-la puis scanne le QR code avec le numéro DÉDIÉ à Look360."
              )}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${st.tone}`}>{st.label}</span>
        </div>

        {s.instance?.lastError && (
          <p className="bg-danger-bg text-danger-fg flex items-start gap-2 rounded-lg p-3 text-sm">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" /> {s.instance.lastError}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!s.instance && (
            <Btn primary disabled={pending || !s.configured} onClick={() => run(waCreate, "Instance créée.")} icon={<Plug size={16} />}>
              Créer l&apos;instance
            </Btn>
          )}
          {s.instance && status !== "connected" && (
            <Btn
              primary
              disabled={pending}
              icon={<QrCode size={16} />}
              onClick={() =>
                start(async () => {
                  const r = await waQr();
                  if (r.ok && r.data) {
                    setQr(r.data);
                    setMsg({ ok: true, text: "Scanne ce QR code dans WhatsApp > Appareils connectés, avec le numéro dédié." });
                    startPoll();
                  } else setMsg({ ok: false, text: r.ok ? "QR indisponible" : r.error });
                })
              }
            >
              Afficher le QR code
            </Btn>
          )}
          {s.instance && (
            <>
              <Btn disabled={pending} onClick={() => run(waRefresh, "Statut mis à jour :")} icon={<RefreshCw size={16} />}>
                Actualiser le statut
              </Btn>
              <Btn disabled={pending} onClick={() => run(waRestart, "Redémarrée : affiche le QR et scanne à nouveau.")} icon={<Zap size={16} />}>
                Reconnecter
              </Btn>
              <Btn disabled={pending || !s.webhookReady} onClick={() => run(waWebhook, "Webhook configuré :")} icon={<Webhook size={16} />}>
                Configurer le webhook
              </Btn>
            </>
          )}
        </div>

        {qr && (
          <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed p-5 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code de connexion WhatsApp" width={240} height={240} className="rounded-lg bg-white p-2" />
            <div className="text-sm">
              <p className="text-fg font-semibold">Connexion par QR code</p>
              <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5">
                <li>Ouvre WhatsApp sur le téléphone du numéro dédié.</li>
                <li>Paramètres → Appareils connectés → Connecter un appareil.</li>
                <li>Scanne ce code. Le statut passe à « Connectée » tout seul.</li>
              </ol>
              <p className="text-muted-foreground mt-3 inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Vérification du statut toutes les 4 s…
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Test + envoi */}
      <section className="border-border bg-surface shadow-card space-y-4 rounded-2xl border p-5">
        <div>
          <h2 className="text-fg text-lg font-bold">Envoi</h2>
          <p className="text-muted-foreground text-sm">
            Le test part même si l&apos;envoi réel est coupé (action manuelle du superadmin, instance connectée requise).
          </p>
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => waTest(testNumber), "Message de test envoyé.");
          }}
        >
          <input
            type="tel"
            inputMode="tel"
            placeholder="+225 07 00 00 00 00"
            value={testNumber}
            onChange={(e) => setTestNumber(e.target.value)}
            className="border-border bg-bg text-fg focus:border-accent min-h-11 flex-1 rounded-md border px-3 text-base outline-none"
          />
          <Btn primary type="submit" disabled={pending || status !== "connected"} icon={<Send size={16} />}>
            Envoyer un test
          </Btn>
        </form>
        <Btn disabled={pending || s.queued === 0} onClick={() => run(waDispatch, "Passage d'envoi :")} icon={<Send size={16} />}>
          Vider la file maintenant ({s.queued})
        </Btn>
      </section>

      {msg && (
        <p role="status" className={`rounded-lg p-3 text-sm font-medium ${msg.ok ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function Flag({ label, on, offText }: { label: string; on: boolean; offText?: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${on ? "text-success" : "text-fg-2"}`}>
        {on ? <CheckCircle2 size={15} /> : <span className="bg-input inline-block h-2.5 w-2.5 rounded-full" />}
        {on ? "OK" : (offText ?? "Non configuré")}
      </p>
    </div>
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
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-default disabled:opacity-50 ${
        primary ? "bg-accent text-accent-on hover:bg-accent-hover" : "border-border hover:bg-input border"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

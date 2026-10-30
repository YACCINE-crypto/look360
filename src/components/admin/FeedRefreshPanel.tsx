"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

export type FeedStats = {
  total: number;
  videos: number;
  videosReady: number;
  thumbs: number;
  lastRefresh: string | null;
};

/**
 * Feed commun : état réel + déclenchement manuel (même job que le cron).
 * « Rafraîchir » re-scrape puis transcode ; « Terminer les vidéos » relance
 * seulement le transcodage (l'encodage prend quelques minutes).
 */
export function FeedRefreshPanel({ stats }: { stats: FeedStats }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "refresh" | "media">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [diag, setDiag] = useState<string | null>(null);

  async function testStorage() {
    setDiag("Test du stockage…");
    try {
      const r = await fetch("/api/admin/storage-diag", { method: "POST" });
      const j = await r.json();
      if (!j.configured) return setDiag("Stockage non configuré (variables BUNNY_STORAGE_* manquantes).");
      if (j.putStatus >= 200 && j.putStatus < 300) return setDiag(`Stockage OK (écriture ${j.putStatus}, suppression ${j.deleteStatus}).`);
      if (j.putStatus === 401 || j.putStatus === 403)
        return setDiag(`Refusé (${j.putStatus}) : mot de passe de la zone ou nom de zone incorrect. Hôte : ${j.host}.`);
      if (j.putStatus === -1) return setDiag(`Hôte injoignable (${j.host}) : vérifie BUNNY_STORAGE_REGION.`);
      setDiag(`Réponse inattendue du stockage : ${j.putStatus} (hôte ${j.host}).`);
    } catch {
      setDiag("Test impossible.");
    }
  }

  async function run(mode: "refresh" | "media") {
    setBusy(mode);
    setMsg(mode === "refresh" ? "Scraping et transcodage en cours (jusqu'à 5 min)…" : "Transcodage en cours…");
    try {
      const r = await fetch(`/api/admin/feed-refresh${mode === "media" ? "?mode=media" : ""}`, { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setMsg(`Échec : ${j.error ?? r.status}`);
      } else {
        const m = mode === "media" ? j : j.media;
        setMsg(
          (mode === "refresh" ? `${j.stored} pubs enregistrées, ${j.purged} anciennes retirées. ` : "") +
            `Vidéos : ${m.ready} prêtes, ${m.uploaded} envoyées, ${m.pending} en encodage, ${m.failed} en échec.`,
        );
      }
    } catch {
      setMsg("La requête a été interrompue. Les pubs déjà traitées sont enregistrées : relance pour continuer.");
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  const last = stats.lastRefresh
    ? new Date(stats.lastRefresh).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
    : "jamais";

  return (
    <section className="bg-surface border-border shadow-card rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-fg text-base font-bold">Feed commun</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {stats.total} pubs · dernière mise à jour {last} · vidéos lisibles{" "}
            {stats.videosReady}/{stats.videos} · miniatures archivées {stats.thumbs}/{stats.total}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("refresh")}
            className="bg-accent text-accent-on inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-4 text-sm font-semibold disabled:opacity-60"
          >
            <Icon name="search" size={15} /> {busy === "refresh" ? "En cours…" : "Rafraîchir le feed"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("media")}
            className="border-border text-fg hover:bg-input inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-4 text-sm font-semibold disabled:opacity-60"
          >
            <Icon name="play" size={15} /> {busy === "media" ? "En cours…" : "Terminer les vidéos"}
          </button>
        </div>
      </div>
      {msg && <p className="text-fg-2 mt-3 text-sm">{msg}</p>}
      <div className="border-border mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
        <button
          type="button"
          onClick={testStorage}
          className="border-border text-fg hover:bg-input inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-4 text-sm font-semibold"
        >
          <Icon name="image" size={15} /> Tester le stockage des images
        </button>
        {diag && <p className="text-fg-2 text-sm">{diag}</p>}
      </div>
    </section>
  );
}

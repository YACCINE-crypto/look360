import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { EmptyPreview } from "@/components/dataviz";
import { Icon } from "@/components/Icon";
import { CreativeMedia } from "@/components/CreativeMedia";
import { ajouterAuxProduits, retirerPub } from "../spy/actions";
import { landingKind, LANDING_LABEL, formatReach, countryLabel, cleanField } from "@/lib/spy";

export const dynamic = "force-dynamic";

export default async function SauvegardesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("spy_saved_ads")
    .select("*")
    .order("created_at", { ascending: false });
  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pubs sauvegardées"
        subtitle="Ta bibliothèque de créatives — visuels archivés pour qu'ils n'expirent pas."
      />

      {rows.length === 0 ? (
        <EmptyPreview
          icon="bookmark"
          title="Aucune pub sauvegardée"
          description="Depuis le Spy, clique le marque-page sur une pub pour l'archiver ici — ta bibliothèque de créatives."
          ctaHref="/spy"
          ctaLabel="Explorer le Spy"
          variant="cards"
        />
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((ad) => {
            // Ne jamais afficher une vidéo (.mp4) comme <img> : miniature d'abord.
            const img =
              ad.thumbnail_cdn_url ||
              ad.thumbnail_source_url ||
              (ad.media_type !== "video" ? ad.media_cdn_url || ad.media_source_url : null);
            const watchUrl = ad.media_cdn_url || ad.media_source_url;
            const kind = landingKind(ad.landing_url);
            const pageName = cleanField(ad.page_name);
            const adText = cleanField(ad.ad_text);
            return (
              <article
                key={ad.id}
                className="bg-surface border-border shadow-card flex h-full flex-col overflow-hidden rounded-xl border"
              >
                <CreativeMedia image={img} alt={pageName ?? ""} isVideo={ad.media_type === "video"}>
                  {ad.media_type === "video" && (
                    <span className="bg-black/55 absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
                      Vidéo
                    </span>
                  )}
                  <span
                    className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      ad.media_stored
                        ? "bg-success-bg text-success"
                        : "bg-input text-muted-foreground"
                    }`}
                    title={ad.media_stored ? "Visuel archivé sur le CDN" : "Lien Meta (peut expirer)"}
                  >
                    {ad.media_stored ? "Archivé" : "Lien Meta"}
                  </span>
                </CreativeMedia>

                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold" title={pageName ?? ""}>
                      {pageName ?? "Page inconnue"}
                    </h3>
                    {adText && (
                      <p className="text-muted-foreground line-clamp-2 text-xs">{adText}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {ad.pays_cible && (
                      <span className="bg-input text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                        {countryLabel(ad.pays_cible)}
                      </span>
                    )}
                    {typeof ad.variants_count === "number" && ad.variants_count > 1 && (
                      <span className="bg-input text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                        {ad.variants_count} variantes
                      </span>
                    )}
                    {ad.reach_estimate != null && (
                      <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold">
                        Reach {formatReach(ad.reach_estimate)}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto space-y-2 pt-1">
                    <div className="flex gap-2">
                      {ad.ad_library_url && (
                        <a
                          href={ad.ad_library_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border-border hover:bg-input flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
                        >
                          <Icon name="external" size={12} /> Ad Library
                        </a>
                      )}
                      {ad.media_type === "video" && watchUrl && (
                        <a
                          href={watchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border-border hover:bg-input flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
                        >
                          <Icon name="play" size={12} /> Regarder
                        </a>
                      )}
                      {ad.media_type !== "video" && ad.landing_url && kind === "shop" && (
                        <a
                          href={ad.landing_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border-border hover:bg-input flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
                        >
                          <Icon name="external" size={12} /> Boutique
                        </a>
                      )}
                      {ad.media_type !== "video" && ad.landing_url && kind && kind !== "shop" && (
                        <span className="border-border text-muted-foreground flex flex-1 items-center justify-center rounded-md border border-dashed px-2 py-1.5 text-xs font-medium">
                          {LANDING_LABEL[kind]}
                        </span>
                      )}
                    </div>

                    <form action={ajouterAuxProduits}>
                      <input type="hidden" name="nom" value={pageName ?? ""} />
                      <input type="hidden" name="image_url" value={ad.media_cdn_url ?? ad.thumbnail_cdn_url ?? ad.thumbnail_source_url ?? ""} />
                      <input type="hidden" name="landing_url" value={ad.landing_url ?? ""} />
                      <input type="hidden" name="ad_library_url" value={ad.ad_library_url ?? ""} />
                      <input type="hidden" name="ad_text" value={adText ?? ""} />
                      <input type="hidden" name="marche" value={ad.pays_cible ?? ""} />
                      <button
                        type="submit"
                        className="bg-primary text-primary-foreground flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-opacity hover:opacity-90"
                      >
                        <Icon name="plus" size={14} /> Ajouter à mes produits
                      </button>
                    </form>
                    <form action={retirerPub}>
                      <input type="hidden" name="id" value={ad.id} />
                      <button
                        type="submit"
                        className="text-danger hover:bg-danger-bg flex min-h-[32px] w-full items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors"
                      >
                        <Icon name="trash" size={12} /> Retirer
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

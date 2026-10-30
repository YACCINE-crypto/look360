"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MARCHES, type ProduitInsert } from "@/lib/produits";
import { deleteKey, keyFromCdnUrl, mediaStorageConfigured, storeFromUrl } from "@/lib/mediaStorage";
import { reserveMedia, releaseMedia } from "@/lib/usage";
import { isAllowedMediaUrl, isMetaMediaHost } from "@/lib/mediaHosts";
import { isStreamUrl, streamThumbFromHls } from "@/lib/bunnyStream";
import { accountSuspended } from "@/lib/accountGuard";

function str(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw === "" ? null : raw;
}

/**
 * Pont Spy → Pipeline (§6) : crée une ligne `produits` pré-remplie depuis une
 * pub espionnée, puis ouvre la fiche produit pour compléter le sourcing.
 * RLS : soumis_par = utilisateur courant.
 */
export async function ajouterAuxProduits(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) redirect("/login");
  if (await accountSuspended(userId)) redirect("/suspendu");

  const pays = (str(formData, "marche") ?? "").toUpperCase();
  const marche = MARCHES.some((m) => m.code === pays) ? pays : null;

  // Archivage image sur CDN au moment où la pub devient produit (§3/§5).
  // Jamais une vidéo comme image : un flux HLS devient sa miniature générée.
  const rawImage = str(formData, "image_url");
  const imageSource = streamThumbFromHls(rawImage) ?? (rawImage && /\.(m3u8|mp4)(\?|$)/i.test(rawImage) ? null : rawImage);
  // Déjà sur NOS CDN (archive ou streaming) : rien à recopier.
  const alreadyOurs = Boolean(
    imageSource &&
      (isStreamUrl(imageSource) ||
        (isAllowedMediaUrl(imageSource, { archive: true }) && !isMetaMediaHost(new URL(imageSource).hostname))),
  );
  let mediaCdn: string | null = alreadyOurs ? imageSource : null;
  if (imageSource && !alreadyOurs && mediaStorageConfigured()) {
    // 1 objet du quota de stockage ; quota atteint → on garde le lien source.
    const reserved = await reserveMedia(userId, 1).then(() => true, () => false);
    if (reserved) {
      try {
        mediaCdn = (await storeFromUrl(imageSource, `produits/${userId}`)).cdnUrl;
      } catch {
        /* fallback : on garde le lien source */
        await releaseMedia(userId, 1);
      }
    }
  }

  const payload: ProduitInsert = {
    nom: str(formData, "nom") ?? "Produit espionné",
    soumis_par: userId,
    image_url: imageSource,
    media_cdn_url: mediaCdn,
    lien_concurrent: str(formData, "landing_url"),
    lien_ad_library: str(formData, "ad_library_url"),
    angle_marketing: str(formData, "ad_text"),
    marche,
    statut: "idee",
  };

  const { data, error } = await supabase
    .from("produits")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    redirect("/spy?error=add");
  }

  revalidatePath("/produits");
  redirect(`/produits/${data.id}`);
}

/** Retire une pub sauvegardée. */
export async function retirerPub(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return;
  // RLS : ne supprime (et ne renvoie) que la ligne du compte courant.
  const { data: removed } = await supabase
    .from("spy_saved_ads")
    .delete()
    .eq("id", id)
    .select("media_cdn_url, thumbnail_cdn_url");
  // Libère les objets archivés sur le CDN et le quota de stockage associé.
  const keys = (removed ?? [])
    .flatMap((r) => [keyFromCdnUrl(r.media_cdn_url), keyFromCdnUrl(r.thumbnail_cdn_url)])
    .filter((k): k is string => Boolean(k));
  await Promise.all(keys.map((k) => deleteKey(k)));
  // Vidéo transcodée : partagée entre comptes (même créative) → on ne la
  // supprime pas du service, on rend seulement le quota.
  const streams = (removed ?? []).filter((r) => isStreamUrl(r.media_cdn_url)).length;
  await releaseMedia(userId, keys.length + streams);
  revalidatePath("/produits");
}

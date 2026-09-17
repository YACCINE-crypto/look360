"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createProduit } from "@/app/(app)/recherche/actions";
import { createClient } from "@/lib/supabase/client";
import {
  MARCHES,
  CATEGORIES,
  MODES_TRANSIT,
  TYPES_APPRO,
  DEFAULT_FRAIS_TRANSIT_KILO,
  coutLivreEstime,
  formatFCFA,
  type ModeTransit,
  type TypeAppro,
} from "@/lib/produits";
import { Icon } from "./Icon";

/* eslint-disable @next/next/no-img-element */

const inputCls =
  "w-full min-h-[44px] rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary";
const labelCls = "text-xs font-medium text-muted-foreground";

export function AddProductPanel() {
  const params = useSearchParams();
  const [open, setOpen] = useState(
    params.get("add") === "1" || params.has("error"),
  );

  // Sourcing / transit (état pour le calcul live du coût livré)
  const [typeAppro, setTypeAppro] = useState<TypeAppro>("import");
  const [mode, setMode] = useState<ModeTransit>("aerien");
  const [prix, setPrix] = useState("");
  const [prixLocal, setPrixLocal] = useState("");
  const [poids, setPoids] = useState("");
  const [fraisKilo, setFraisKilo] = useState(String(DEFAULT_FRAIS_TRANSIT_KILO));
  const [cbm, setCbm] = useState("");
  const [fraisCbm, setFraisCbm] = useState("");

  // Image
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const n = (s: string): number | null => {
    if (s.trim() === "") return null;
    const v = Number(s.replace(",", "."));
    return Number.isFinite(v) ? v : null;
  };

  const cout = coutLivreEstime({
    typeAppro,
    mode,
    prixFournisseur: n(prix),
    prixAchatLocal: n(prixLocal),
    poidsKg: n(poids),
    fraisTransitKilo: n(fraisKilo),
    cbm: n(cbm),
    fraisTransitCbm: n(fraisCbm),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("produits")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const {
        data: { publicUrl },
      } = supabase.storage.from("produits").getPublicUrl(path);
      setImageUrl(publicUrl);
    } catch {
      setUploadError("Échec de l'upload. Réessaie.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
      >
        <Icon name="plus" size={16} />
        Ajouter
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="bg-surface relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Nouveau produit</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-md"
                aria-label="Fermer"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <form action={createProduit} className="space-y-4">
              <input type="hidden" name="redirect_to" value="/recherche" />
              <input type="hidden" name="image_url" value={imageUrl} />
              <input type="hidden" name="mode_transit" value={mode} />
              <input type="hidden" name="type_approvisionnement" value={typeAppro} />

              {/* Image */}
              <div className="space-y-1.5">
                <span className={labelCls}>Image</span>
                <div className="flex items-center gap-3">
                  <div className="bg-input text-muted-foreground grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-md">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Icon name="image" size={22} />
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="bg-input text-foreground inline-flex min-h-[44px] items-center rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                    >
                      {uploading ? "Envoi…" : imageUrl ? "Changer" : "Téléverser"}
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFile}
                      className="hidden"
                    />
                    {uploadError && (
                      <p className="text-danger mt-1 text-xs">{uploadError}</p>
                    )}
                  </div>
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className={labelCls}>Nom du produit *</span>
                <input
                  name="nom"
                  required
                  placeholder="ex. Ceinture chauffante infrarouge"
                  className={inputCls}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className={labelCls}>Catégorie</span>
                  <select name="categorie" defaultValue="" className={inputCls}>
                    <option value="">Sélectionner…</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className={labelCls}>Marché</span>
                  <select name="marche" defaultValue="CI" className={inputCls}>
                    {MARCHES.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.code}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className={labelCls}>Lien fournisseur</span>
                <input name="lien_source" placeholder="https://…" className={inputCls} />
              </label>

              <label className="block space-y-1.5">
                <span className={labelCls}>Lien boutique concurrent</span>
                <input name="lien_concurrent" placeholder="https://…" className={inputCls} />
              </label>

              <label className="block space-y-1.5">
                <span className={labelCls}>Lien pub / Ad Library</span>
                <input name="lien_ad_library" placeholder="https://…" className={inputCls} />
              </label>

              {/* Type d'approvisionnement */}
              <div className="space-y-1.5">
                <span className={labelCls}>Approvisionnement</span>
                <div className="border-border bg-input flex gap-1 rounded-md border p-1">
                  {TYPES_APPRO.map((t) => (
                    <button
                      key={t.code}
                      type="button"
                      onClick={() => setTypeAppro(t.code)}
                      className={`min-h-[38px] flex-1 rounded-[6px] text-sm font-medium transition-colors ${
                        typeAppro === t.code
                          ? "bg-surface text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {typeAppro === "local" ? (
                /* Local : un seul prix, aucun frais de transit. */
                <label className="block space-y-1.5">
                  <span className={labelCls}>Prix d&apos;achat local (FCFA)</span>
                  <input
                    name="prix_achat_local"
                    inputMode="decimal"
                    value={prixLocal}
                    onChange={(e) => setPrixLocal(e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                </label>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1.5">
                      <span className={labelCls}>Prix fournisseur (FCFA)</span>
                      <input
                        name="prix_fournisseur"
                        inputMode="decimal"
                        value={prix}
                        onChange={(e) => setPrix(e.target.value)}
                        placeholder="0"
                        className={inputCls}
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className={labelCls}>Poids (kg)</span>
                      <input
                        name="poids_kg"
                        inputMode="decimal"
                        value={poids}
                        onChange={(e) => setPoids(e.target.value)}
                        placeholder="0"
                        className={inputCls}
                      />
                    </label>
                  </div>

                  <label className="block space-y-1.5">
                    <span className={labelCls}>Mode de transit</span>
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as ModeTransit)}
                      className={inputCls}
                    >
                      {MODES_TRANSIT.map((m) => (
                        <option key={m.code} value={m.code}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {mode === "aerien" ? (
                    <label className="block space-y-1.5">
                      <span className={labelCls}>Frais transit / kg (FCFA)</span>
                      <input
                        name="frais_transit_kilo"
                        inputMode="decimal"
                        value={fraisKilo}
                        onChange={(e) => setFraisKilo(e.target.value)}
                        className={inputCls}
                      />
                    </label>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1.5">
                        <span className={labelCls}>CBM (m³)</span>
                        <input
                          name="cbm"
                          inputMode="decimal"
                          value={cbm}
                          onChange={(e) => setCbm(e.target.value)}
                          placeholder="0"
                          className={inputCls}
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className={labelCls}>Frais / CBM (FCFA)</span>
                        <input
                          name="frais_transit_cbm"
                          inputMode="decimal"
                          value={fraisCbm}
                          onChange={(e) => setFraisCbm(e.target.value)}
                          placeholder="0"
                          className={inputCls}
                        />
                      </label>
                    </div>
                  )}
                </>
              )}

              {/* Coût livré — lecture seule, calculé en direct */}
              <div className="border-border bg-input flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <p className={labelCls}>Coût livré (calculé)</p>
                  <p className="text-[11px] text-muted-foreground">
                    {typeAppro === "local"
                      ? "= prix d'achat local"
                      : mode === "aerien"
                        ? "prix + poids × frais/kg"
                        : "prix + CBM × frais/CBM"}
                  </p>
                </div>
                <span className="text-lg font-bold tabular-nums">
                  {formatFCFA(cout)}
                </span>
              </div>

              <label className="block space-y-1.5">
                <span className={labelCls}>Angle marketing</span>
                <textarea
                  name="angle_marketing"
                  rows={3}
                  placeholder="En quoi ce produit résout un vrai problème…"
                  className={inputCls}
                />
              </label>

              {/* Planning (optionnel) — rappel push le jour J et 2 jours avant */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className={labelCls}>À travailler le</span>
                  <input type="date" name="date_a_travailler" className={inputCls} />
                </label>
                <label className="block space-y-1.5">
                  <span className={labelCls}>Lancement testing</span>
                  <input type="date" name="date_lancement_testing" className={inputCls} />
                </label>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={uploading}
                  className="bg-primary text-primary-foreground inline-flex min-h-[44px] items-center justify-center rounded-md px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  Ajouter
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="bg-input text-foreground inline-flex min-h-[44px] items-center justify-center rounded-md px-5 py-2 text-sm font-semibold"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

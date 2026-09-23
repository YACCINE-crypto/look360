"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { updateProduit } from "../../recherche/actions";
import {
  MARCHES,
  CATEGORIES,
  MODES_TRANSIT,
  TYPES_APPRO,
  DEFAULT_FRAIS_TRANSIT_KILO,
  coutLivreEstime,
  formatFCFA,
  type Produit,
  type ModeTransit,
  type TypeAppro,
} from "@/lib/produits";
import { margeColorClass } from "@/lib/testing";

/* eslint-disable @next/next/no-img-element */

const inputCls =
  "w-full min-h-[44px] rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary";
const labelCls = "text-xs font-medium text-muted-foreground";

const s = (v: number | null | undefined) => (v == null ? "" : String(v));

export function EditProductForm({ produit }: { produit: Produit }) {
  const [open, setOpen] = useState(false);

  // Champs infos
  const [imageUrl, setImageUrl] = useState(produit.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [categorie, setCategorie] = useState(produit.categorie ?? "");
  const [marche, setMarche] = useState(produit.marche ?? "CI");

  // Champs coût / sourcing
  const [typeAppro, setTypeAppro] = useState<TypeAppro>(
    produit.type_approvisionnement === "local" ? "local" : "import",
  );
  const [mode, setMode] = useState<ModeTransit>(
    produit.mode_transit === "maritime" ? "maritime" : "aerien",
  );
  const [prix, setPrix] = useState(s(produit.prix_fournisseur));
  const [prixLocal, setPrixLocal] = useState(s(produit.prix_achat_local));
  const [poids, setPoids] = useState(s(produit.poids_kg));
  const [fraisKilo, setFraisKilo] = useState(
    s(produit.frais_transit_kilo) || String(DEFAULT_FRAIS_TRANSIT_KILO),
  );
  const [cbm, setCbm] = useState(s(produit.cbm));
  const [fraisCbm, setFraisCbm] = useState(s(produit.frais_transit_cbm));
  const [prixVente, setPrixVente] = useState(""); // aperçu marge (non enregistré)

  const n = (v: string): number | null => {
    if (v.trim() === "") return null;
    const x = Number(v.replace(",", "."));
    return Number.isFinite(x) ? x : null;
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
  const pv = n(prixVente);
  const marge = pv && pv > 0 ? ((pv - cout) / pv) * 100 : null;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "upload");
      setImageUrl(data.url);
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
        className="bg-input text-foreground hover:bg-muted inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-colors"
      >
        <Icon name="tag" size={15} /> Modifier
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="bg-surface relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto p-6 shadow-xl">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold">Modifier le produit</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-md"
                aria-label="Fermer"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <p className="text-muted-foreground mb-5 text-xs">
              Complète ou corrige les infos — le coût livré se recalcule en direct.
            </p>

            <form action={updateProduit} className="space-y-4">
              <input type="hidden" name="id" value={produit.id} />
              <input type="hidden" name="image_url" value={imageUrl} />
              <input type="hidden" name="type_approvisionnement" value={typeAppro} />
              <input type="hidden" name="mode_transit" value={mode} />

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
                    <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFile} className="hidden" />
                    {uploadError && <p className="text-danger mt-1 text-xs">{uploadError}</p>}
                  </div>
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className={labelCls}>Nom du produit *</span>
                <input name="nom" required defaultValue={produit.nom ?? ""} className={inputCls} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className={labelCls}>Catégorie</span>
                  <Select
                    name="categorie"
                    value={categorie}
                    onChange={setCategorie}
                    placeholder="Sélectionner…"
                    ariaLabel="Catégorie"
                    options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className={labelCls}>Marché</span>
                  <Select
                    name="marche"
                    value={marche}
                    onChange={setMarche}
                    ariaLabel="Marché"
                    options={MARCHES.map((m) => ({ value: m.code, label: m.code }))}
                  />
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className={labelCls}>Lien fournisseur</span>
                <input name="lien_source" defaultValue={produit.lien_source ?? ""} placeholder="https://…" className={inputCls} />
              </label>
              <label className="block space-y-1.5">
                <span className={labelCls}>Lien boutique concurrent</span>
                <input name="lien_concurrent" defaultValue={produit.lien_concurrent ?? ""} placeholder="https://…" className={inputCls} />
              </label>
              <label className="block space-y-1.5">
                <span className={labelCls}>Lien pub / Ad Library</span>
                <input name="lien_ad_library" defaultValue={produit.lien_ad_library ?? ""} placeholder="https://…" className={inputCls} />
              </label>
              <label className="block space-y-1.5">
                <span className={labelCls}>Angle marketing</span>
                <textarea name="angle_marketing" rows={3} defaultValue={produit.angle_marketing ?? ""} className={inputCls} />
              </label>

              {/* --- Coût & approvisionnement --- */}
              <div className="border-border border-t pt-4">
                <p className="mb-3 text-sm font-semibold">Coût & approvisionnement</p>

                <div className="space-y-1.5">
                  <span className={labelCls}>Approvisionnement</span>
                  <div className="border-border bg-input flex gap-1 rounded-md border p-1">
                    {TYPES_APPRO.map((t) => (
                      <button
                        key={t.code}
                        type="button"
                        onClick={() => setTypeAppro(t.code)}
                        className={`min-h-[38px] flex-1 rounded-[6px] text-sm font-medium transition-colors ${
                          typeAppro === t.code ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {typeAppro === "local" ? (
                  <label className="mt-3 block space-y-1.5">
                    <span className={labelCls}>Prix d&apos;achat local (FCFA)</span>
                    <input inputMode="decimal" name="prix_achat_local" value={prixLocal} onChange={(e) => setPrixLocal(e.target.value)} placeholder="0" className={inputCls} />
                  </label>
                ) : (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="block space-y-1.5">
                        <span className={labelCls}>Prix fournisseur (FCFA)</span>
                        <input inputMode="decimal" name="prix_fournisseur" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="0" className={inputCls} />
                      </label>
                      <label className="block space-y-1.5">
                        <span className={labelCls}>Poids (kg)</span>
                        <input inputMode="decimal" name="poids_kg" value={poids} onChange={(e) => setPoids(e.target.value)} placeholder="0" className={inputCls} />
                      </label>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <span className={labelCls}>Mode de transit</span>
                      <Select
                        value={mode}
                        onChange={(v) => setMode(v as ModeTransit)}
                        ariaLabel="Mode de transit"
                        options={MODES_TRANSIT.map((m) => ({ value: m.code, label: m.label }))}
                      />
                    </div>
                    {mode === "aerien" ? (
                      <label className="mt-3 block space-y-1.5">
                        <span className={labelCls}>Frais transit / kg (FCFA)</span>
                        <input inputMode="decimal" name="frais_transit_kilo" value={fraisKilo} onChange={(e) => setFraisKilo(e.target.value)} className={inputCls} />
                      </label>
                    ) : (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <label className="block space-y-1.5">
                          <span className={labelCls}>CBM (m³)</span>
                          <input inputMode="decimal" name="cbm" value={cbm} onChange={(e) => setCbm(e.target.value)} placeholder="0" className={inputCls} />
                        </label>
                        <label className="block space-y-1.5">
                          <span className={labelCls}>Frais / CBM (FCFA)</span>
                          <input inputMode="decimal" name="frais_transit_cbm" value={fraisCbm} onChange={(e) => setFraisCbm(e.target.value)} placeholder="0" className={inputCls} />
                        </label>
                      </div>
                    )}
                  </>
                )}

                <label className="mt-3 block space-y-1.5">
                  <span className={labelCls}>Prix de vente cible (FCFA) — aperçu marge, non enregistré</span>
                  <input inputMode="decimal" value={prixVente} onChange={(e) => setPrixVente(e.target.value)} placeholder="ex. 15000" className={inputCls} />
                </label>

                {/* Aperçu live coût livré + marge */}
                <div className="border-border bg-input mt-3 flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                  <div>
                    <p className={labelCls}>Coût livré (calculé)</p>
                    <p className="text-muted-foreground text-[11px]">
                      {typeAppro === "local"
                        ? "= prix d'achat local"
                        : mode === "aerien"
                          ? "prix + poids × frais/kg"
                          : "prix + CBM × frais/CBM"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold tabular-nums">{formatFCFA(cout)}</span>
                    {marge != null && (
                      <p className={`text-xs font-semibold ${margeColorClass(marge)}`}>
                        marge {marge.toFixed(0)}%
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={uploading}
                  className="bg-primary text-primary-foreground inline-flex min-h-[44px] items-center justify-center rounded-md px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  Enregistrer
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

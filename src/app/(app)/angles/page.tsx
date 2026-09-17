import { createClient } from "@/lib/supabase/server";
import { AnglesClient, type AngleRow, type EmotionCount } from "./AnglesClient";
import { EMOTIONS, EMOTION_LABELS, marcheLabel } from "@/lib/produits";
import {
  dernierTestParProduit,
  scoreParProduit,
} from "@/lib/score";
import { margePctFromTest, verdictMeta } from "@/lib/testing";

export default async function AnglesPage() {
  const supabase = await createClient();
  const [{ data: produits }, { data: tests }] = await Promise.all([
    supabase.from("produits").select("*").order("created_at", { ascending: false }),
    supabase.from("tests").select("*").order("created_at", { ascending: false }),
  ]);

  const prods = produits ?? [];
  const scores = scoreParProduit(prods, tests ?? []);
  const derniers = dernierTestParProduit(tests ?? []);

  // Angles renseignés, triés par score (les meilleurs d'abord = à réutiliser).
  const angles: AngleRow[] = prods
    .filter((p) => (p.angle_marketing ?? "").trim() !== "")
    .map((p) => {
      const t = derniers[p.id];
      const vm = t ? verdictMeta(t.verdict) : null;
      const marge = t ? margePctFromTest(t) : null;
      return {
        id: p.id,
        angle: p.angle_marketing as string,
        nom: p.nom ?? "Sans nom",
        emotion: p.emotion_tag,
        marche: marcheLabel(p.marche),
        score: scores[p.id] ?? 0,
        marge,
        verdictLabel: vm?.label ?? null,
        verdictBadge: vm?.badge ?? null,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Comptes par émotion.
  const emotionCounts: EmotionCount[] = EMOTIONS.map((code) => ({
    code,
    label: EMOTION_LABELS[code] ?? code,
    count: prods.filter((p) => p.emotion_tag === code).length,
  })).filter((e) => e.count > 0);

  return <AnglesClient angles={angles} emotionCounts={emotionCounts} />;
}

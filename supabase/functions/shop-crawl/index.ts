// ============================================================================
// shop-crawl — catalogue PUBLIC des boutiques Shopify (products.json, meta.json)
// pour les boutiques repérées dans les pubs (table shops).
//
// POST { mode: "crawl", limit? }   → boutiques à rafraîchir (next_crawl_at passé)
// POST { mode: "domain", domain }  → une boutique (si périmée ou jamais vue)
// POST { mode: "index" }           → ré-indexe pubs → boutiques (refresh_shop_index)
//
// Politesse : une boutique tous les 7 jours max, pause entre requêtes, 4 pages
// (1 000 produits) max, arrêt immédiat sur 403/429 (reprise différée).
// Écriture via service_role uniquement. Aucune donnée inventée.
// ============================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const UA = "Mozilla/5.0 (compatible; Look360Bot/1.0; +https://look360.io)";
const TTL_DAYS = 7;
const PAGE_DELAY_MS = 1200;
const MAX_PAGES = 4;
const BUDGET_MS = 110_000;
const PARALLEL = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

type Fetched = { status: number; json?: unknown; text?: string };

async function get(url: string, asJson: boolean, maxBytes = 3_000_000): Promise<Fetched> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: asJson ? "application/json" : "text/html" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!r.ok) return { status: r.status };
    const buf = await r.arrayBuffer();
    const text = new TextDecoder().decode(buf.byteLength > maxBytes ? buf.slice(0, maxBytes) : buf);
    if (!asJson) return { status: r.status, text };
    try {
      return { status: r.status, json: JSON.parse(text) };
    } catch {
      return { status: 0 }; // pas du JSON (page HTML, protection anti-bot…)
    }
  } catch {
    return { status: -1 };
  } finally {
    clearTimeout(t);
  }
}

type ShopifyVariant = { price?: string; compare_at_price?: string | null; available?: boolean };
type ShopifyProduct = {
  id?: number;
  title?: string;
  handle?: string;
  product_type?: string;
  vendor?: string;
  tags?: string[] | string;
  body_html?: string;
  created_at?: string;
  published_at?: string;
  images?: { src?: string }[];
  variants?: ShopifyVariant[];
};

const num = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Image Shopify redimensionnée (CDN Shopify : URLs stables, pas d'archivage). */
function sized(src: string | undefined, w = 600): string | null {
  if (!src) return null;
  const u = src.startsWith("//") ? "https:" + src : src;
  return /cdn\.shopify\.com|\/cdn\/shop\//.test(u) ? u + (u.includes("?") ? "&" : "?") + `width=${w}` : u;
}

const COD_APPS: [RegExp, string][] = [
  [/easysell|es-cod-form|easy-sell/i, "EasySell COD"],
  [/releasit/i, "Releasit COD Form"],
  [/codform|cod-form|cod_order_form|cod-order-form/i, "Formulaire COD"],
  [/\bqikify\b/i, "Qikify"],
  [/cash on delivery|paiement à la livraison|payez à la livraison|paiement a la livraison|payer à la livraison/i, "Paiement à la livraison"],
];
const PIXELS: [RegExp, string][] = [
  [/fbq\(|connect\.facebook\.net\/[^"']*fbevents|facebook\.com\/tr\?/i, "Meta"],
  [/analytics\.tiktok\.com|ttq\.(load|page)/i, "TikTok"],
  [/googletagmanager\.com|gtag\(/i, "Google"],
  [/snaptr\(|sc-static\.net/i, "Snapchat"],
  [/pintrk\(/i, "Pinterest"],
];

async function crawlShop(domain: string): Promise<string> {
  const base = `https://${domain}`;
  const { data: shop } = await admin.from("shops").select("id, crawl_attempts").eq("domain", domain).maybeSingle();
  if (!shop) return "absent";

  const meta = await get(`${base}/meta.json`, true, 200_000);
  const m = (meta.json ?? {}) as Record<string, unknown>;
  const looksShopify = typeof m.myshopify_domain === "string" || typeof m.money_format === "string";

  const products: ShopifyProduct[] = [];
  let blocked: number | null = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await get(`${base}/products.json?limit=250&page=${page}`, true);
    if (r.status === 429 || r.status === 403 || r.status === 430) {
      blocked = r.status;
      break;
    }
    const arr = (r.json as { products?: ShopifyProduct[] } | undefined)?.products;
    if (!Array.isArray(arr)) break;
    products.push(...arr);
    if (arr.length < 250) break;
    await sleep(PAGE_DELAY_MS);
  }

  // Pas Shopify (ou catalogue public désactivé).
  if (products.length === 0) {
    const status = blocked ? "blocked" : looksShopify ? "blocked" : "not_shopify";
    await admin
      .from("shops")
      .update({
        platform: looksShopify ? "shopify" : "other",
        status,
        name: typeof m.name === "string" ? m.name : null,
        currency: typeof m.currency === "string" ? m.currency : null,
        country: typeof m.country === "string" ? m.country : null,
        last_crawled: new Date().toISOString(),
        // 429 → on réessaie demain ; sinon dans 30 j (inutile d'insister).
        next_crawl_at: days(blocked === 429 ? 1 : 30),
        crawl_attempts: (shop.crawl_attempts ?? 0) + 1,
        last_error: blocked ? `HTTP ${blocked}` : looksShopify ? "catalogue public désactivé" : "pas une boutique Shopify",
      })
      .eq("id", shop.id);
    return status;
  }

  // Page d'accueil : thème, pixels, apps COD (lecture seule, 600 Ko max).
  await sleep(PAGE_DELAY_MS);
  const home = await get(base, false, 600_000);
  const html = home.text ?? "";
  const theme = html.match(/Shopify\.theme\s*=\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/)?.[1] ?? null;
  const pixels = PIXELS.filter(([re]) => re.test(html)).map(([, n]) => n);
  const cod = [...new Set(COD_APPS.filter(([re]) => re.test(html)).map(([, n]) => n))];

  const now = Date.now();
  const runStart = new Date().toISOString();
  let priceMin: number | null = null;
  let priceMax: number | null = null;
  let discounted = 0;
  let recent = 0;
  const types = new Map<string, number>();
  const rows = products
    .filter((p) => p.handle && p.title)
    .map((p, i) => {
      const vs = p.variants ?? [];
      const prices = vs.map((v) => num(v.price)).filter((x): x is number => x != null && x > 0);
      const price = prices.length ? Math.min(...prices) : null;
      const compares = vs.map((v) => num(v.compare_at_price)).filter((x): x is number => x != null && x > 0);
      const compare = compares.length ? Math.max(...compares) : null;
      if (price != null) {
        priceMin = priceMin == null ? price : Math.min(priceMin, price);
        priceMax = priceMax == null ? price : Math.max(priceMax, price);
      }
      if (price != null && compare != null && compare > price) discounted++;
      if (p.created_at && now - Date.parse(p.created_at) < 30 * 86_400_000) recent++;
      if (p.product_type) types.set(p.product_type, (types.get(p.product_type) ?? 0) + 1);
      const imgs = (p.images ?? []).map((im) => sized(im.src)).filter((x): x is string => Boolean(x));
      const tags = Array.isArray(p.tags)
        ? p.tags
        : typeof p.tags === "string"
          ? p.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [];
      return {
        shop_id: shop.id,
        shopify_id: p.id ?? null,
        handle: String(p.handle).toLowerCase(),
        title: String(p.title).slice(0, 300),
        product_type: p.product_type || null,
        vendor: p.vendor || null,
        tags: tags.slice(0, 20),
        price,
        compare_at_price: compare != null && price != null && compare > price ? compare : null,
        image_url: imgs[0] ?? null,
        images: imgs.slice(0, 8),
        variants_count: vs.length,
        available: vs.some((v) => v.available !== false),
        body_excerpt: (p.body_html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400) || null,
        position: i,
        created_at_shop: p.created_at ?? null,
        published_at: p.published_at ?? null,
        updated_at: runStart,
      };
    });

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await admin.from("shop_products").upsert(rows.slice(i, i + 200), { onConflict: "shop_id,handle" });
    if (error) throw new Error(`upsert produits: ${error.message}`);
  }
  // Produits retirés de la boutique (catalogue complet lu uniquement).
  if (!blocked && products.length < MAX_PAGES * 250) {
    await admin.from("shop_products").delete().eq("shop_id", shop.id).lt("updated_at", runStart);
  }

  const niche = [...types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const publishedCount = typeof m.published_products_count === "number" ? m.published_products_count : null;
  const count = publishedCount ?? rows.length;
  await admin
    .from("shops")
    .update({
      platform: "shopify",
      status: "ok",
      name: typeof m.name === "string" ? m.name : null,
      currency: typeof m.currency === "string" ? m.currency : null,
      country: typeof m.country === "string" ? m.country : null,
      theme,
      product_count: count,
      price_min: priceMin,
      price_max: priceMax,
      catalog_type: count <= 3 ? "mono" : "multi",
      niche,
      cod_apps: cod,
      pixels,
      new_products_30d: recent,
      discounted_count: discounted,
      last_crawled: new Date().toISOString(),
      next_crawl_at: days(TTL_DAYS),
      crawl_attempts: 0,
      last_error: blocked ? `catalogue partiel (HTTP ${blocked})` : null,
    })
    .eq("id", shop.id);
  await admin.rpc("refresh_shop_product_ads", { p_domain: domain, p_days: 30 });
  return `ok:${rows.length}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST", { status: 405 });
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* vide */
  }
  const mode = String(body.mode ?? "crawl");
  const t0 = Date.now();

  try {
    if (mode === "index") {
      const { data, error } = await admin.rpc("refresh_shop_index", { p_days: 30 });
      if (error) throw error;
      return Response.json({ ok: true, index: data });
    }

    if (mode === "domain") {
      const domain = String(body.domain ?? "").toLowerCase().replace(/^www\./, "").trim();
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return Response.json({ error: "domaine invalide" }, { status: 400 });
      const { data: s } = await admin.from("shops").select("next_crawl_at").eq("domain", domain).maybeSingle();
      if (!s) return Response.json({ ok: false, reason: "inconnue" });
      if (Date.parse(s.next_crawl_at) > Date.now()) return Response.json({ ok: true, fresh: true });
      return Response.json({ ok: true, result: await crawlShop(domain) });
    }

    // mode crawl : boutiques périmées, les plus présentes dans les pubs d'abord.
    const limit = Math.min(Number(body.limit) || 12, 40);
    const { data: due } = await admin
      .from("shops")
      .select("domain")
      .lte("next_crawl_at", new Date().toISOString())
      .order("ads_count", { ascending: false })
      .limit(limit);
    const queue = (due ?? []).map((d) => d.domain as string);
    const results: Record<string, string> = {};
    const worker = async () => {
      while (queue.length && Date.now() - t0 < BUDGET_MS) {
        const d = queue.shift()!;
        try {
          results[d] = await crawlShop(d);
        } catch (e) {
          results[d] = "erreur";
          await admin
            .from("shops")
            .update({ status: "error", last_error: String(e).slice(0, 200), next_crawl_at: days(1), last_crawled: new Date().toISOString() })
            .eq("domain", d);
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    return Response.json({ ok: true, crawled: Object.keys(results).length, results, took_ms: Date.now() - t0 });
  } catch (e) {
    return Response.json({ ok: false, error: String(e).slice(0, 300) }, { status: 500 });
  }
});

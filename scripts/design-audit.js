// Look360 design audit crawler (read-only: navigation, no form submission except login).
// Usage : AUDIT_EMAIL=… AUDIT_PASSWORD=… [BASE=https://look360.io] node scripts/design-audit.js
// Requiert `playwright` (non listé dans package.json : `npx -p playwright node …` ou NODE_PATH global).
// Sorties : scripts/out/results.json + scripts/out/shots/*.png (ne pas committer).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'https://look360.io';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
};
const PUBLIC = ['/', '/login', '/signup', '/forgot-password', '/cgu'];
const APP = ['/bienvenue', '/recherche', '/spy', '/top-trend', '/winners', '/produits', '/sauvegardes',
  '/surveillance', '/testing', '/validation', '/vitrine', '/offres', '/equipe', '/parametres'];
const ADMIN = ['/admin', '/admin/clients', '/admin/revenus', '/admin/activite', '/admin/reglages'];

// In-page measurement. Runs in the browser.
function measure() {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const bgOf = (el) => {
    let layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { img: true };
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base);
    return base;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05;
  };
  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    if (cls) s += '.' + cls;
    const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return t ? `${s} «${t}»` : s;
  };

  const res = { contrast: [], tiny: [], targets: [], unnamed: [], imgsNoAlt: [], inputsNoLabel: [], fonts: {}, sizes: {}, colors: {}, radii: {}, shadows: {}, headings: [], overflow: null, landmarks: {}, emojiIcons: [] };
  const docW = document.documentElement.clientWidth;
  res.overflow = { scrollWidth: document.documentElement.scrollWidth, clientWidth: docW, offenders: [] };
  if (document.documentElement.scrollWidth > docW + 1) {
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > docW + 1 && r.width > 0 && visible(el)) {
        // only report outermost offender
        const p = el.parentElement && el.parentElement.getBoundingClientRect();
        if (!p || p.right <= docW + 1) res.overflow.offenders.push(sel(el) + ` right=${Math.round(r.right)}`);
      }
    });
    res.overflow.offenders = res.overflow.offenders.slice(0, 8);
  }

  const seen = new Set();
  document.querySelectorAll('body *').forEach((el) => {
    if (!visible(el)) return;
    const cs = getComputedStyle(el);
    const radius = cs.borderTopLeftRadius; if (radius !== '0px') res.radii[radius] = (res.radii[radius] || 0) + 1;
    if (cs.boxShadow !== 'none') { const k = cs.boxShadow.slice(0, 90); res.shadows[k] = (res.shadows[k] || 0) + 1; }
    const bgc = parse(cs.backgroundColor); if (bgc && bgc.a > 0) { const k = cs.backgroundColor; res.colors['bg ' + k] = (res.colors['bg ' + k] || 0) + 1; }
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!hasText) return;
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    res.fonts[fam] = (res.fonts[fam] || 0) + 1;
    const fs_ = parseFloat(cs.fontSize);
    res.sizes[cs.fontSize] = (res.sizes[cs.fontSize] || 0) + 1;
    res.colors['fg ' + cs.color] = (res.colors['fg ' + cs.color] || 0) + 1;
    const txt = el.innerText ? el.innerText.trim().slice(0, 40) : '';
    if (fs_ < 12 && txt.length > 1) res.tiny.push(`${fs_}px ${sel(el)}`);
    const fg = parse(cs.color); const bg = bgOf(el);
    if (fg && !bg.img) {
      const f = fg.a < 1 ? blend(fg, bg) : fg;
      const L1 = lum(f), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const large = fs_ >= 24 || (fs_ >= 18.66 && parseInt(cs.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      if (ratio < need) {
        const k = `${cs.color}|${sel(el).slice(0, 60)}`;
        if (!seen.has(k)) { seen.add(k); res.contrast.push(`${ratio.toFixed(2)}:1 (need ${need}) ${fs_}px ${cs.color} on rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)}) ${sel(el)}`); }
      }
    }
    if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(txt)) res.emojiIcons.push(sel(el));
  });

  document.querySelectorAll('a[href], button, [role=button], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])').forEach((el) => {
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
    if (!inline && (r.width < 24 || r.height < 24)) res.targets.push(`${Math.round(r.width)}x${Math.round(r.height)} ${sel(el)}`);
    const name = (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.innerText || el.value || '').trim();
    const hasImgAlt = el.querySelector && el.querySelector('img[alt]:not([alt=""])');
    if (!name && !hasImgAlt && !['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) res.unnamed.push(sel(el) + ' ' + el.outerHTML.slice(0, 120));
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && !['submit', 'button', 'checkbox', 'radio'].includes(el.type)) {
      const lab = (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label') || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
      if (!lab) res.inputsNoLabel.push(sel(el) + ` placeholder="${el.placeholder || ''}"`);
    }
  });
  document.querySelectorAll('img').forEach((img) => { if (!img.hasAttribute('alt') && visible(img)) res.imgsNoAlt.push(img.src.slice(0, 100)); });
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => { if (visible(h)) res.headings.push(h.tagName + ' ' + h.innerText.trim().slice(0, 50)); });
  ['main', 'nav', 'header', 'aside', 'footer'].forEach((t) => (res.landmarks[t] = document.querySelectorAll(t).length));
  res.targets = res.targets.slice(0, 25); res.contrast = res.contrast.slice(0, 30); res.tiny = res.tiny.slice(0, 20); res.unnamed = res.unnamed.slice(0, 15);
  res.title = document.title; res.lang = document.documentElement.lang;
  res.reducedMotionCSS = [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => r.media && /prefers-reduced-motion/.test(r.media.mediaText)); } catch { return false; } });
  return res;
}

async function focusCheck(page) {
  const out = [];
  await page.keyboard.press('Tab');
  for (let i = 0; i < 12; i++) {
    const info = await page.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || /rgb/.test(cs.boxShadow);
      return { el: el.tagName + ' ' + (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30), ring, outline: cs.outline, shadow: cs.boxShadow.slice(0, 60) };
    });
    if (info) out.push(info);
    await page.keyboard.press('Tab');
  }
  return out;
}

async function audit(page, route, vp, results) {
  const name = `${vp}${route.replace(/\//g, '_') || '_root'}`;
  const errors = [];
  const onErr = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); };
  page.on('console', onErr);
  const t0 = Date.now();
  let status = null;
  try {
    const resp = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    status = resp && resp.status();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  } catch (e) { errors.push('NAV ' + e.message.slice(0, 120)); }
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'shots', name + '.png'), fullPage: vp !== 'desktop' ? true : false });
  if (vp === 'desktop') await page.screenshot({ path: path.join(OUT, 'shots', name + '_full.png'), fullPage: true });
  let m = null;
  try { m = await page.evaluate(measure); } catch (e) { errors.push('MEASURE ' + e.message.slice(0, 120)); }
  let focus = null;
  if (vp === 'desktop') { try { focus = await focusCheck(page); } catch {} }
  page.off('console', onErr);
  results.push({ route, vp, finalUrl: page.url().replace(BASE, ''), status, loadMs, errors, m, focus });
  console.log(vp, route, '->', page.url().replace(BASE, ''), status, loadMs + 'ms', errors.length ? `${errors.length} err` : '');
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const [vp, size] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, locale: 'fr-FR', hasTouch: vp !== 'desktop', isMobile: vp === 'mobile' });
    const page = await ctx.newPage();
    for (const r of PUBLIC) await audit(page, r, vp, results);
    // login
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('#login-email', process.env.AUDIT_EMAIL);
    await page.fill('#login-password', process.env.AUDIT_PASSWORD);
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => {}), page.click('form:has(#login-email) button[type=submit]')]);
    await page.waitForLoadState('networkidle').catch(() => {});
    console.log('after login', page.url());
    const routes = [...APP];
    // discover detail pages
    for (const [list, re] of [['/produits', /^\/produits\/[^/]+$/], ['/testing', /^\/testing\/[^/]+$/], ['/spy', /^\/analyse\/[^/]+$/], ['/winners', /^\/produits\/[^/]+$/]]) {
      await page.goto(BASE + list, { waitUntil: 'networkidle' }).catch(() => {});
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => new URL(a.href).pathname));
      const h = hrefs.find((x) => re.test(x) && !routes.includes(x));
      if (h) routes.push(h);
    }
    for (const r of routes) await audit(page, r, vp, results);
    for (const r of ADMIN) await audit(page, r, vp, results);
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
})();

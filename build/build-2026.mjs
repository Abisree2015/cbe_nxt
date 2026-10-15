// Builds the 2026 Coimbatore NXT site from the Framer content-import pack.
// Usage: node website/build/build-2026.mjs [packDir] [outDir]
// Reuses the design system (styles, nav, dialogs, search) from website/dist.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const websiteDir = join(here, "..");
const PACK = process.argv[2] || "C:/Users/AbisreeNandhakumar/Documents/Coimbatore_NXT_-_updated_content_/Coimbatore-NXT-Framer-Import";
const OUT = process.argv[3] || join(websiteDir, "site-2026");

// ---------- CSV ----------
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(c => c !== ""));
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
const load = f => parseCsv(readFileSync(join(PACK, f), "utf8"));
const pub = rows => rows.filter(r => r.Published === "true");
const byOrder = (a, b) => (+a.Order || 0) - (+b.Order || 0);

const pages = Object.fromEntries(load("pages.csv").map(p => [p.Slug, p]));
const sections = pub(load("page-sections.csv"));
const pillars = pub(load("pillars.csv")).sort(byOrder);
const goals = pub(load("goals.csv")).sort(byOrder);
const portals = pub(load("audience-portals.csv")).sort(byOrder);
const taskForces = pub(load("task-forces.csv")).sort(byOrder);
const initiatives = pub(load("initiatives.csv")).sort((a, b) => (b.Featured === "true") - (a.Featured === "true") || byOrder(a, b));
const updates = pub(load("updates.csv")).sort((a, b) => b["Published Date"].localeCompare(a["Published Date"]));
const partners = pub(load("partners.csv")).sort(byOrder);
const resources = pub(load("resources.csv")).sort(byOrder);
const nav = pub(load("navigation.csv")).sort(byOrder);
const redirects = load("redirects.csv");
const tfBySlug = Object.fromEntries(taskForces.map(t => [t.Slug, t]));
const sectionsFor = slug => sections.filter(s => s["Page Slug"] === slug).sort((a, b) => +a["Sort Order"] - +b["Sort Order"]);

// Interim photography from the existing site, pending approved assets
// Hero photos not covered by IMG: one per page, never shared between heroes
const HERO = {
  "how-we-work": "26-1.jpg",
  "task-forces": "hero-task-forces.jpg",
  initiatives: "hero-initiatives.jpg",
  "get-involved": "hero-get-involved.jpg",
  contact: ["hero-contact.jpg", "A reception desk in an office"],
  updates: "hero-updates.jpg",
  resources: "hero-resources.jpg",
};
// Task-force pages use their listing photo, except where that photo already heads another page
const TF_HERO = { "communication-public-outreach": "hero-comms.jpg" };
const INIT_HERO = { "four-stations-rail-system": "hero-four-stations.jpg", "coimbatore-railway-division": "hero-rail-division.jpg", "regional-aviation-priorities": "hero-aviation-priorities.jpg", "task-force-operating-framework": "6.jpg" };
const IMG = {
  home: ["hero3.jpg", "Aerial view of Coimbatore, with tree-lined roads and the city skyline"],
  about: ["16-1.jpg", "A campus in Coimbatore with the Western Ghats behind it"],
  "vision-2030": ["27.jpg", "Aerial view of a Coimbatore roundabout and surrounding neighbourhoods"],
  alliance: ["news_banner.jpg", "Partners on stage at the Coimbatore NXT launch"],
  opportunities: ["some_thing.jpg", "Aerial view of Coimbatore with a lake and the hills beyond"],
  portals: { business: "13-1.jpg", invest: "19-1.jpg", startup: "20-1.jpg", employment: "employement.jpg", education: "education.jpg", health: "health.jpg", tourism: "tourism.jpg", retirement: "22-1.jpg" },
};

// ---------- helpers ----------
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const href = u => !u ? "" : u.startsWith("#") || /^https?:|^mailto:/.test(u) ? u : u === "/" ? "/" : u.replace(/\/?$/, "/").replace(/\/#/, "#");
const fmtDate = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
const theme = t => t === "Surface" ? "section section--alt" : t === "Primary" ? "section theme-dark" : "section";
const arrow = `<svg class="icon-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const btn = (label, url, kind = "primary") => label && url ? `<a class="btn btn--${kind}" href="${href(url)}">${esc(label)} ${arrow}</a>` : "";
const linkCta = (label, url) => label && url ? `<a class="link-cta" href="${href(url)}">${esc(label)}</a>` : "";
const statusBadge = s => s ? `<span class="status status--${s.toLowerCase()}">${esc(s)}</span>` : "";
const sectionHead = (s, center = true) => `<header class="section-header${center ? "" : " section-header--left"}">${s.Eyebrow ? `<span class="eyebrow">${esc(sentence(s.Eyebrow))}</span>` : ""}<h2 class="headline-section">${esc(s.Heading)}</h2>${s["Body HTML"] ? `<div class="lede-html">${s["Body HTML"]}</div>` : ""}</header>`;
// Eyebrows arrive in capitals; DESIGN.md asks for sentence case, with acronyms kept
const ACRONYMS = ["NXT", "COIMBATORE NXT"];
function sentence(s) {
  if (!s || s !== s.toUpperCase()) return s;
  if (s === "COIMBATORE NXT") return "Coimbatore NXT";
  let out = s.toLowerCase().replace(/^./, c => c.toUpperCase());
  out = out.replace(/\bnxt\b/g, "NXT").replace(/\bcoimbatore\b/g, "Coimbatore");
  return out;
}

// ---------- layout ----------
const headerNav = nav.filter(n => n.Location === "Header");
const footerNav = nav.filter(n => n.Location === "Footer");
const ctaNav = nav.find(n => n.Location === "CTA");
const searchIcon = `<svg viewBox="0 0 17 17" aria-hidden="true" focusable="false"><circle cx="7" cy="7" r="5.75" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M11.2 11.2l4.3 4.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const closeBtn = `<button class="dialog__close" type="button" data-dialog-close aria-label="Close"><svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>`;
const personIcon = `<svg class="icon-inline" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor"/></svg>`;
const mailIcon = `<svg class="icon-inline" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm9 7.2L4.4 7H19.6z" fill="currentColor"/></svg>`;
const phoneIcon = `<svg class="icon-inline" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" fill="currentColor"/></svg>`;

function layout({ path, title, description, body }) {
  const current = u => path === u || (u !== "/" && path.startsWith(u)) ? ' aria-current="page"' : "";
  return `<!doctype html>
<html lang="en-IN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#F5F5F7">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:site_name" content="Coimbatore NXT">
  <link rel="icon" href="/assets/images/digital_nxt.png">
  <link rel="stylesheet" href="/assets/css/styles.css">
  <link rel="stylesheet" href="/assets/css/nxt-2026.css">
  <script src="/assets/js/main.js" defer></script>
  <script src="/assets/js/search-index.js" defer></script>
  <script src="/assets/js/nxt-2026.js" defer></script>
</head>
<body data-root="/">
  <a class="skip-link" href="#main">Skip to main content</a>
  <header class="globalnav" data-globalnav>
    <nav class="globalnav__inner" aria-label="Main">
      <a class="globalnav__logo" href="/"><img src="/assets/images/coimbatore-next-logo-small.png" alt="Coimbatore NXT home" width="249" height="108"></a>
      <div class="globalnav__menu" id="globalnav-menu">
        <ul class="globalnav__list">
${headerNav.map(n => `          <li class="globalnav__item"><a class="globalnav__link" href="${href(n.URL)}"${current(href(n.URL))}>${esc(n.Label)}</a></li>`).join("\n")}
          <li class="globalnav__item globalnav__item--mobile-only"><a class="globalnav__link" href="${href(ctaNav.URL)}">${esc(ctaNav.Label)}</a></li>
        </ul>
      </div>
      <div class="globalnav__actions">
        <button class="navsearch" type="button" data-dialog-open="dialog-search" aria-haspopup="dialog" aria-label="Search Coimbatore NXT" aria-keyshortcuts="/">${searchIcon}<span class="navsearch__label" aria-hidden="true">Search</span></button>
        <a class="btn btn--primary btn--small globalnav__cta" href="${href(ctaNav.URL)}">${esc(ctaNav.Label)}</a>
        <button class="icon-btn globalnav__toggle" type="button" aria-expanded="false" aria-controls="globalnav-menu" aria-label="Open menu" data-nav-toggle><span class="globalnav__toggle-bars" aria-hidden="true"></span></button>
      </div>
    </nav>
  </header>
  <main id="main" tabindex="-1">
${body}
  </main>
  <footer class="footer">
    <div class="container container--wide">
      <div class="footer__cta theme-dark">
        <h2 class="footer__cta-title">Connect with us! It will only take a minute</h2>
        <a class="btn btn--primary footer__cta-btn" href="/contact/">Contact us ${arrow}</a>
      </div>
      <div class="footer__grid">
        <nav aria-labelledby="footer-site">
          <h3 class="footer__heading" id="footer-site">Coimbatore NXT</h3>
          <ul class="footer__list">${[...headerNav, ...footerNav, ctaNav].map(n => `<li><a href="${href(n.URL)}">${esc(n.Label)}</a></li>`).join("")}</ul>
        </nav>
        <div>
          <h3 class="footer__heading">Contact</h3>
          <div class="footer__people">
            <div class="footer__person">
              <p class="footer__person-name"><span class="footer__ico">${personIcon}</span>Shimna</p>
              <ul class="footer__list footer__list--icons"><li><span class="footer__ico">${mailIcon}</span><a href="mailto:shimna.p@cii.in">Shimna.p@cii.in</a></li><li><span class="footer__ico">${phoneIcon}</span><a href="tel:+917397195791">7397195791</a></li></ul>
            </div>
            <div class="footer__person">
              <p class="footer__person-name"><span class="footer__ico">${personIcon}</span>Vinod</p>
              <ul class="footer__list footer__list--icons"><li><span class="footer__ico">${mailIcon}</span><a href="mailto:vinod.shenoy@cii.in">Vinod.shenoy@cii.in</a></li><li><span class="footer__ico">${phoneIcon}</span><a href="tel:+919047781716">9047781716</a></li></ul>
            </div>
          </div>
        </div>
        <div class="footer__initiative">
          <h3 class="footer__heading">An initiative by</h3>
          <a href="https://www.cii.in/" target="_blank" rel="noopener"><img src="/assets/images/cii_logo-300x186.png" alt="Confederation of Indian Industry (CII) — opens in a new tab" width="300" height="186" loading="lazy"></a>
        </div>
      </div>
      <p class="footer__legal">© 2026 Coimbatore NXT. One Region. One Voice. One Shared Future.</p>
    </div>
  </footer>
  <dialog class="dialog" id="dialog-search" aria-labelledby="dialog-search-title">
    <div class="dialog__header"><div><h2 class="dialog__title" id="dialog-search-title">Search</h2></div>${closeBtn}</div>
    <div class="dialog__body">
      <form role="search" data-search-form>
        <div class="search-field">${searchIcon}<label class="visually-hidden" for="search-input">Search Coimbatore NXT</label><input class="field__input" id="search-input" type="search" placeholder="Search Coimbatore NXT" autocomplete="off" aria-describedby="search-status" aria-controls="search-results"></div>
      </form>
      <p class="search-status" id="search-status" role="status" aria-live="polite">Type to search pages, task forces and updates.</p>
      <ul class="search-results" id="search-results"></ul>
    </div>
  </dialog>
</body>
</html>
`;
}

// ---------- page hero ----------
function hero(p, { image, dark, noCampaign, after = "", mosaic, video } = {}) {
  const ctas = `<div class="btn-row hero__ctas">${btn(p["Primary CTA Label"], p["Primary CTA URL"])}${btn(p["Secondary CTA Label"], p["Secondary CTA URL"], "secondary")}</div>`;
  const text = `<span class="eyebrow">${esc(sentence(p.Eyebrow))}</span>
        <h1 class="headline-hero hero__title" id="hero-title">${esc(p["Hero Title"])}</h1>
        <p class="lede">${esc(p["Hero Subtitle"])}</p>
        ${p["Campaign Line"] && !noCampaign ? `<p class="campaign-line">${esc(p["Campaign Line"])}</p>` : ""}
        ${ctas}${after}`;
  if (mosaic) return `
    <section class="hero hero--nxt list-hero theme-dark" aria-labelledby="hero-title">
      <div class="list-hero__mosaic list-hero__mosaic--${mosaic.length}" aria-hidden="true">${mosaic.map(src => `<img src="/assets/images/${src}" alt="" width="640" height="360" fetchpriority="high">`).join("")}</div>
      <div class="container container--wide list-hero__inner">${text}</div>
    </section>`;
  // Optional looping background video: the still stays underneath as poster and fallback
  const videoHtml = video ? `
      <video class="hero__video" autoplay muted loop playsinline preload="auto" poster="/assets/images/${image[0]}" aria-hidden="true" tabindex="-1" data-hero-video>
        <source src="/assets/video/${video}.webm" type="video/webm"><source src="/assets/video/${video}.mp4" type="video/mp4">
      </video>
      <button class="hero__video-toggle" type="button" aria-pressed="false" aria-label="Pause background video" data-hero-video-toggle><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path class="i-pause" d="M5 3.5v9M11 3.5v9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path class="i-play" d="M5.5 3.5l7 4.5-7 4.5z" fill="currentColor"/></svg></button>` : "";
  if (image) return `
    <section class="hero hero--image hero--nxt${video ? " hero--video" : ""}" aria-labelledby="hero-title">
      <img class="hero__bg" src="/assets/images/${image[0]}" alt="${esc(image[1])}" width="1920" height="750" fetchpriority="high">${videoHtml}
      <div class="hero__overlay"><div class="container container--wide hero__inner hero__inner--left">${text}</div></div>
    </section>`;
  return `
    <section class="hero ${dark ? "hero--dark" : ""} hero--nxt" aria-labelledby="hero-title">
      <div class="container hero__inner">${text}</div>
    </section>`;
}

// ---------- section renderers ----------
const sectionCta = (s, primary) => s["CTA Label"] && s["CTA URL"] ? `<p class="section-cta">${primary ? btn(s["CTA Label"], s["CTA URL"]) : linkCta(s["CTA Label"], s["CTA URL"])}</p>` : "";
const anchorFor = s => ({ "vision-seven-goals": "goals", "alliance-partners": "partners", "opportunities-pathways": "pathways", "get-involved-contributions": "contribute", "contact-routing": "contact" })[s.Slug];

function renderSection(s, extra = "") {
  const id = anchorFor(s);
  const t = s["Section Type"];
  const primary = s.Theme === "Primary";
  const open = `<section class="${theme(s.Theme)} nxt-section nxt-section--${t.toLowerCase().replace(/\s+/g, "-")}"${id ? ` id="${id}"` : ""} aria-labelledby="${s.Slug}-title">`;
  const head = (center) => `${s.Eyebrow ? `<span class="eyebrow">${esc(sentence(s.Eyebrow))}</span>` : ""}<h2 class="headline-section" id="${s.Slug}-title">${esc(s.Heading)}</h2>`;
  // Callouts and closing CTAs: centred, one primary action
  if (t === "Vision Callout" || t === "CTA") return `${open}<div class="container measure center callout">${head()}<div class="prose callout__body">${s["Body HTML"]}</div>${sectionCta(s, true)}</div></section>`;
  // Collection-driven or grid sections: centred header, then the list
  if (extra) return `${open}<div class="container container--wide"><header class="section-header">${head()}<div class="lede-html">${s["Body HTML"]}</div></header>${extra}${sectionCta(s, primary)}</div></section>`;
  // Editorial sections: heading column beside the text column
  return `${open}<div class="container container--wide split-section"><div class="split-section__head">${head()}</div><div class="split-section__body"><div class="prose prose--nxt">${s["Body HTML"]}</div>${sectionCta(s, primary)}</div></div></section>`;
}

// ---------- collection components ----------
const portalCard = p => `<a class="portal-card" href="/opportunities/${p.Slug}/">
  <img class="portal-card__img" src="/assets/images/${IMG.portals[p.Slug]}" alt="" width="512" height="512" loading="lazy" decoding="async">
  <span class="portal-card__body"><span class="portal-card__title">${esc(p.Name)}</span><span class="portal-card__kicker">${esc(p.Kicker)}</span><span class="portal-card__cta">Explore pathway</span></span>
</a>`;
const portalGrid = () => `<div class="portal-grid">${portals.map(portalCard).join("")}</div>`;
const pillarRow = () => `<ol class="pillar-row">${pillars.map((p, i) => `<li class="pillar"><span class="pillar__index">0${i + 1}</span><h3 class="pillar__title">${esc(p.Name)}</h3><p class="pillar__short">${esc(p["Short Description"])}</p><div class="pillar__body">${p["Body HTML"]}</div></li>`).join("")}</ol>`;
const tfCard = t => `<article class="tf-card">
  <div class="tf-card__meta"><span class="tf-card__domain">${esc(t.Domain)}</span>${statusBadge(t.Status)}</div>
  <h3 class="tf-card__title"><a class="stretched" href="/task-forces/${t.Slug}/">${esc(t.Name)}</a></h3>
  <p class="tf-card__purpose">${esc(t.Purpose)}</p>
  <p class="tf-card__foot"><span>${esc(t["Primary Pillar"])}</span><span class="link-cta" aria-hidden="true">View task force</span></p>
</article>`;
// Listing photos: tf-*.jpg are Unsplash License images (credits in build/IMAGE-CREDITS.md); the rest are existing site photos
const TF_IMG = { aviation: "tf-aviation.jpg", railways: "tf-railways.jpg", "roads-mmlp": "tf-roads.jpg", "metro-urban-transport": "tf-metro.jpg", "city-planning": "17-1.jpg", "environment-water": "11-3.jpg", "solid-waste-management": "tf-waste.jpg", "rdi-engineering-innovation": "tf-rdi.jpg", "communication-public-outreach": "news_banner.jpg", "gcc-sunrise-industries": "tf-gcc.jpg", "land-bank": "9.jpg", textiles: "14-1.jpg" };
const tfPhotoCard = t => tfCard(t).replace(`<article class="tf-card">`, `<article class="tf-card tf-card--photo"><span class="tf-card__media"><img src="/assets/images/${TF_IMG[t.Slug] || "hero3.jpg"}" alt="" width="640" height="360" loading="lazy" decoding="async"></span>`);
const tfGrid = list => `<div class="tf-grid">${list.map(tfCard).join("")}</div>`;

// ---------- bespoke homepage sections ----------
const eyebrowH = (s, cls = "") => `${s.Eyebrow ? `<span class="eyebrow">${esc(sentence(s.Eyebrow))}</span>` : ""}<h2 class="headline-section${cls}" id="${s.Slug}-title">${esc(s.Heading)}</h2>`;
// 2030 ambition: full-bleed aerial photo, text on a left-hand fade
const ambitionSection = s => `<section class="ambition theme-dark" aria-labelledby="${s.Slug}-title">
  <img class="ambition__bg" src="/assets/images/27.jpg" alt="" width="1920" height="500" loading="lazy" decoding="async">
  <span class="ambition__year" aria-hidden="true">2030</span>
  <div class="container container--wide ambition__inner">
    <div class="ambition__text">${eyebrowH(s)}<div class="ambition__body">${s["Body HTML"]}</div>${sectionCta(s, true)}</div>
  </div>
</section>`;
// Pillar icons named in pillars.csv (Lucide shapes)
const PILLAR_ICON = {
  TrendingUp: `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>`,
  Globe2: `<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  Landmark: `<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7"/><polygon points="12 2 20 7 4 7"/>`,
};
const pillarIcon = name => `<span class="pillar-list__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${PILLAR_ICON[name] || ""}</svg></span>`;
// Operating focus: intro column beside a numbered pillar list
const pillarSection = s => `<section class="${theme(s.Theme)} focus" aria-labelledby="${s.Slug}-title">
  <div class="container container--wide focus__grid">
    <div class="focus__intro">${eyebrowH(s)}<div class="lede-html focus__lede">${s["Body HTML"]}</div>${sectionCta(s, false)}</div>
    <ol class="pillar-list list-reset">${pillars.map((p, i) => `<li class="pillar-list__item">
      ${pillarIcon(p["Icon Name"])}
      <div class="pillar-list__text"><span class="pillar-list__index">0${i + 1}</span><h3 class="pillar-list__title">${esc(p.Name)}</h3><p class="pillar-list__short">${esc(p["Short Description"])}</p><div class="pillar-list__body">${p["Body HTML"]}</div></div>
    </li>`).join("")}</ol>
  </div>
</section>`;
// Task forces: split header, featured 2×2, then every other task force as a quick link
const featuredTfCard = (t, i) => `<article class="tf-feature">
  <div class="tf-card__meta"><span class="tf-feature__index">${String(i + 1).padStart(2, "0")}</span>${statusBadge(t.Status)}</div>
  <span class="tf-card__domain">${esc(t.Domain)}</span>
  <h3 class="tf-feature__title"><a class="stretched" href="/task-forces/${t.Slug}/">${esc(t.Name)}</a></h3>
  <p class="tf-card__purpose">${esc(t.Purpose)}</p>
  <p class="tf-card__foot"><span>${esc(t["Primary Pillar"])} pillar</span><span class="link-cta" aria-hidden="true">View task force</span></p>
</article>`;
// Work in motion: lead initiative + compact list beside a dated update timeline
const workSection = s => {
  const feat = initiatives.filter(i => i.Featured === "true"), [lead, ...more] = feat;
  const tfName = i => tfBySlug[i["Task Force Slug"]]?.Name || "";
  return `<section class="${theme(s.Theme)} work-section work-section--visual" aria-labelledby="${s.Slug}-title">
  <div class="work-section__visual" aria-hidden="true"><img src="/assets/images/tf-railways.jpg" alt="" width="1200" height="675" loading="lazy" decoding="async"></div>
  <div class="container container--wide">
    <header class="split-header"><div>${eyebrowH(s)}</div><div><div class="lede-html split-header__lede">${s["Body HTML"]}</div>${sectionCta(s, false)}</div></header>
    <div class="work-layout">
      <div class="work-layout__main">
        <h3 class="work-layout__label">Featured initiatives</h3>
        ${lead ? `<article class="lead-initiative">
          <div class="tf-card__meta"><span class="tf-card__domain">${esc(lead.Category)} · ${esc(tfName(lead))}</span>${statusBadge(lead.Status)}</div>
          <h4 class="lead-initiative__title"><a class="stretched" href="/initiatives/${lead.Slug}/">${esc(lead.Name)}</a></h4>
          <p class="lead-initiative__summary">${esc(lead.Summary)}</p>
          <div class="lead-initiative__pair"><div><span class="work-card__label">Outcome sought</span><p>${esc(lead["Outcome Sought"])}</p></div><div><span class="work-card__label">Next milestone</span><p>${esc(lead["Next Milestone"])}</p></div></div>
          <span class="link-cta" aria-hidden="true">View initiative</span>
        </article>` : ""}
        <ul class="initiative-rows list-reset">${more.map(i => `<li><a class="initiative-row" href="/initiatives/${i.Slug}/"><span class="initiative-row__text"><span class="tf-card__domain">${esc(i.Category)} · ${esc(tfName(i))}</span><span class="initiative-row__title">${esc(i.Name)}</span><span class="initiative-row__next"><span class="work-card__label">Next milestone</span> ${esc(i["Next Milestone"])}</span></span>${statusBadge(i.Status)}</a></li>`).join("")}</ul>
      </div>
      <div class="work-layout__side">
        <h3 class="work-layout__label">Latest updates</h3>
        <ol class="update-timeline list-reset">${updates.slice(0, 3).map(u => `<li class="update-timeline__item"><time class="update-timeline__date" datetime="${u["Published Date"]}">${fmtDate(u["Published Date"])}</time><span class="update-timeline__type">${esc(u["Content Type"])}</span><a class="update-timeline__title" href="/updates/${u.Slug}/">${esc(u.Name)}</a><p class="update-timeline__excerpt">${esc(u.Excerpt)}</p></li>`).join("")}</ol>
        <p class="work-layout__more"><a class="link-cta" href="/updates/">All updates</a></p>
      </div>
    </div>
  </div>
</section>`;
};
// Alliance: intro beside a disciplined grid of partner organisations
const allianceSection = s => `<section class="${theme(s.Theme)} alliance-home" aria-labelledby="${s.Slug}-title">
  <div class="container container--wide alliance-home__grid">
    <div class="alliance-home__intro">${eyebrowH(s)}<div class="lede-html focus__lede">${s["Body HTML"]}</div><p class="alliance-home__count"><span>${partners.length}</span> partner organisations</p>${sectionCta(s, false)}</div>
    <ul class="partner-table list-reset">${partners.map(p => `<li class="partner-table__cell"><span class="partner-table__short">${esc(p["Short Name"])}</span><span class="partner-table__name">${esc(p.Name)}</span><span class="partner-table__cat">${esc(p.Category)}</span></li>`).join("")}<li class="partner-table__cell partner-table__cell--cta"><a class="partner-table__join" href="/get-involved/"><span class="partner-table__short">+</span><span class="partner-table__name">Partner with us</span><span class="partner-table__cat">Bring your organisation’s strengths to the shared agenda</span></a></li></ul>
  </div>
</section>`;
const pillarKey = n => n.toLowerCase();
// Vision 2030: the seven goals grouped under the pillar that drives them
const GOAL_ICON = {
  "economic-growth": '<path d="M13 17V9M18 17V5M8 17v-3"/><path d="M3 3v16a2 2 0 0 0 2 2h16"/>',
  "high-value-employment": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  "infrastructure-development": '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8"/>',
  "skill-development": '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  "innovation-entrepreneurship": '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>',
  "sustainability": '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  "brand-building": '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
};
const goalGroupsSection = s => `<section class="goal-groups-section goal-groups-section--soft" id="goals" aria-labelledby="${s.Slug}-title">
  <div class="container container--wide">
    <header class="split-header"><div>${eyebrowH(s)}</div><div><div class="lede-html split-header__lede">${s["Body HTML"]}</div>${sectionCta(s, false)}</div></header>
    <div class="goal-groups">${pillars.map(p => {
      const list = goals.filter(g => g["Primary Pillar"] === p.Name);
      if (!list.length) return "";
      return `<section class="goal-group goal-group--${pillarKey(p.Name)}" aria-labelledby="goal-group-${p.Slug}">
        <div class="goal-group__head">
          <span class="goal-group__halo" aria-hidden="true"><span class="goal-group__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${PILLAR_ICON[p["Icon Name"]] || ""}</svg></span></span>
          <h3 class="goal-group__title" id="goal-group-${p.Slug}">${esc(p.Name)}</h3>
          <p class="goal-group__short">${esc(p["Short Description"])}</p>
          <p class="goal-group__count">${list.length} ${list.length === 1 ? "goal" : "goals"}</p><span class="goal-group__bar" aria-hidden="true"></span>
        </div>
        <ol class="goal-group__list list-reset">${list.map(g => `<li class="goal-tile">
          <div class="goal-tile__top"><span class="goal-tile__index">${String(goals.indexOf(g) + 1).padStart(2, "0")}</span><span class="goal-tile__icon" aria-hidden="true">${svgIcon(GOAL_ICON[g.Slug] || "")}</span></div>
          <h4 class="goal-tile__title">${esc(g.Name)}</h4>
          <p class="goal-tile__short">${esc(g["Short Description"])}</p>
          <div class="goal-tile__body">${g["Body HTML"]}</div>
        </li>`).join("")}</ol>
      </section>`;
    }).join("")}</div>
  </div>
</section>`;
const HORIZON_ICON = ['<path d="M5 20v-6M12 20V9M19 20V4"/>', '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/>', '<path d="M3 21h18M5 21V10M10 21V10M14 21V10M19 21V10M12 3l9 5H3l9-5z"/>'];
// How We Work page: cycle-diagram hero, in-page nav, pillar cards, process stepper, horizon timeline, accountability panel
function howWeWorkPage() {
  const p = pages["how-we-work"], secs = sectionsFor("how-we-work");
  const by = slug => secs.find(s => s.Slug === slug);
  const pillarsSec = by("how-three-pillars"), cycleSec = by("how-task-force-cycle"), horizonSec = by("how-goal-horizons"), accSec = by("how-accountability");
  const strongPairs = html => [...html.matchAll(/<strong>([\s\S]*?)<\/strong>\s*([\s\S]*?)(?=<strong>|<\/li>|<\/p>|$)/g)].map(m => [strip(m[1]).replace(/:$/, ""), strip(m[2]).replace(/^:\s*/, "")]);
  const steps = cycleSec ? strongPairs(cycleSec["Body HTML"]) : [];
  // Hero: copy on the left; the six-step cycle drawn as a loop on the right, over the launch photo
  const R = 128, C = 200, node = 30;
  const pos = i => { const a = (-90 + i * (360 / steps.length)) * Math.PI / 180; return [C + R * Math.cos(a), C + R * Math.sin(a)]; };
  const arcs = steps.map((_, i) => { const a0 = (-90 + i * 60 + 17) * Math.PI / 180, a1 = (-90 + (i + 1) * 60 - 17) * Math.PI / 180; return `<path d="M${(C + R * Math.cos(a0)).toFixed(1)} ${(C + R * Math.sin(a0)).toFixed(1)} A${R} ${R} 0 0 1 ${(C + R * Math.cos(a1)).toFixed(1)} ${(C + R * Math.sin(a1)).toFixed(1)}" marker-end="url(#cycle-arrow)"/>`; }).join("");
  const nodes = steps.map(([name], i) => { const [x, y] = pos(i); const side = Math.abs(x - C) < 1 ? 0 : Math.sign(x - C), lx = x + side * (node + 10), ly = side ? y + 5 : y + (y < C ? -(node + 12) : node + 22); return `<g class="cycle__node"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${node}"/><text class="cycle__num" x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}">${i + 1}</text><text class="cycle__label" text-anchor="${side > 0 ? "start" : side < 0 ? "end" : "middle"}" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}">${esc(name)}</text></g>`; }).join("");
  const cycleSvg = `<svg class="cycle" viewBox="-40 0 480 400" role="img" aria-label="${esc(sentence(cycleSec?.Eyebrow || "Task-force cycle"))}: ${steps.map(s => esc(s[0])).join(", ")}">
    <defs><marker id="cycle-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1l7 4-7 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
    <circle class="cycle__ring" cx="${C}" cy="${C}" r="${R}"/><g class="cycle__arcs">${arcs}</g>${nodes}
    <text class="cycle__centre" x="${C}" y="${C - 6}">${esc(sentence(cycleSec?.Eyebrow || ""))}</text><text class="cycle__centre-sub" x="${C}" y="${C + 18}">${steps.length} steps</text>
  </svg>`;
  const heroHtml = `<section class="how-hero theme-dark" aria-labelledby="hero-title">
    <img class="how-hero__bg" src="/assets/images/${HERO["how-we-work"]}" alt="" width="1920" height="750" fetchpriority="high">
    <div class="container container--wide how-hero__grid">
      <div class="how-hero__text"><span class="eyebrow">${esc(sentence(p.Eyebrow))}</span><h1 class="headline-hero" id="hero-title">${esc(p["Hero Title"])}</h1><p class="lede">${esc(p["Hero Subtitle"])}</p>
        ${p["Campaign Line"] ? `<p class="how-hero__campaign">${esc(p["Campaign Line"])}</p>` : ""}
        <div class="btn-row hero__ctas">${btn(p["Primary CTA Label"], p["Primary CTA URL"])}${btn(p["Secondary CTA Label"], p["Secondary CTA URL"], "secondary")}</div></div>
      <figure class="how-hero__visual">${cycleSvg}<figcaption class="visually-hidden">${steps.map(([n, d]) => `${esc(n)}: ${esc(d)}`).join(" ")}</figcaption></figure>
    </div>
  </section>`;
  const ids = [[pillarsSec, "pillars"], [cycleSec, "cycle"], [horizonSec, "horizons"], [accSec, "accountability"]].filter(([s]) => s);
  const localNav = `<nav class="localnav vision-nav" aria-label="On this page"><div class="container container--wide"><ul class="localnav__list">${ids.map(([s, id]) => `<li><a href="#${id}">${esc(sentence(s.Eyebrow))}</a></li>`).join("")}</ul></div></nav>`;
  // Three pillars: the page's own sentence for each pillar, as icon cards
  const pillarText = pillarsSec ? Object.fromEntries(strongPairs(pillarsSec["Body HTML"]).map(([n, d]) => [n, d.replace(/^\s*/, "")])) : {};
  const pillarsHtml = pillarsSec ? `<section class="section how-pillars" id="pillars" aria-labelledby="${pillarsSec.Slug}-title"><div class="container container--wide">
    <header class="split-header how-header"><div>${eyebrowH(pillarsSec)}</div><div>${sectionCta(pillarsSec, false)}</div></header>
    <ol class="how-pillars__grid list-reset">${pillars.map((pl, i) => `<li class="how-pillar how-pillar--${pillarKey(pl.Name)}"><span class="how-pillar__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${PILLAR_ICON[pl["Icon Name"]] || ""}</svg></span><span class="how-pillar__index">0${i + 1}</span><h3 class="how-pillar__title">${esc(pl.Name)}</h3><p class="how-pillar__text">${esc(pl.Name)} ${esc(pillarText[pl.Name] || pl["Short Description"])}</p></li>`).join("")}</ol>
  </div></section>` : "";
  // Task-force cycle: numbered process strip
  const cycleHtml = cycleSec ? `<section class="section section--alt how-cycle" id="cycle" aria-labelledby="${cycleSec.Slug}-title"><div class="container container--wide">
    <header class="split-header how-header"><div>${eyebrowH(cycleSec)}</div><div>${sectionCta(cycleSec, false)}</div></header>
    <ol class="stepper list-reset">${steps.map(([n, d], i) => `<li class="stepper__step"><span class="stepper__num">${String(i + 1).padStart(2, "0")}</span><span class="stepper__stem" aria-hidden="true"></span><div class="stepper__card"><h3 class="stepper__title">${esc(n)}</h3><p class="stepper__text">${esc(d.charAt(0).toUpperCase() + d.slice(1))}</p></div></li>`).join("")}</ol>
  </div></section>` : "";
  // Goal horizons: three points on a line, titled with the heading's own phrases
  const horizons = horizonSec ? strongPairs(horizonSec["Body HTML"]) : [];
  const phrases = horizonSec ? horizonSec.Heading.split(/\.\s*/).filter(Boolean) : [];
  const horizonHtml = horizonSec ? `<section class="section how-horizons" id="horizons" aria-labelledby="${horizonSec.Slug}-title"><div class="container container--wide">
    <header class="split-header how-header"><div>${eyebrowH(horizonSec)}</div><div>${sectionCta(horizonSec, false)}</div></header>
    <ol class="horizon-line list-reset">${horizons.map(([when, d], i) => `<li class="horizon-line__item"><span class="horizon-line__dot" aria-hidden="true"></span><div class="horizon-line__top"><span class="horizon-line__when">${esc(when)}</span><span class="horizon-line__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${HORIZON_ICON[i] || ""}</svg></span></div><h3 class="horizon-line__title">${esc(phrases[i] || "")}</h3><p class="horizon-line__text">${esc(d.charAt(0).toUpperCase() + d.slice(1))}</p></li>`).join("")}</ol>
  </div></section>` : "";
  // Accountability: copy beside a panel showing roles, reporting rhythm and the status scale (all from the section text)
  const person = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>`;
  const accHtml = accSec ? `<section class="section theme-dark how-acc" id="accountability" aria-labelledby="${accSec.Slug}-title"><div class="container container--wide how-acc__grid">
    <div class="how-acc__text">${eyebrowH(accSec)}<div class="prose prose--nxt how-acc__body">${accSec["Body HTML"]}</div>${sectionCta(accSec, true)}</div>
    <figure class="acc-panel" aria-label="How accountability works">
      <div class="acc-panel__block"><h3 class="acc-panel__label">Each task force</h3><ul class="acc-roles list-reset">${["Strategic mentor", "Delivery lead", "Core coordinator"].map(r => `<li><span class="acc-roles__avatar">${person}</span>${r}</li>`).join("")}</ul></div>
      <div class="acc-panel__block"><h3 class="acc-panel__label">Reporting rhythm</h3><ol class="acc-rhythm list-reset">${[["Weekly", "Working updates maintain momentum"], ["Monthly", "Reports surface progress and blockers"], ["Quarterly", "Reviews examine outcomes"], ["Half-yearly", "Reviews connect workstream impact to the 2030 agenda"]].map(([w, t]) => `<li><span class="acc-rhythm__when">${w}</span><span class="acc-rhythm__what">${t}</span></li>`).join("")}</ol></div>
      <div class="acc-panel__block"><h3 class="acc-panel__label">Green–Amber–Red status</h3><ul class="acc-rag list-reset"><li class="acc-rag__item acc-rag__item--green">Green</li><li class="acc-rag__item acc-rag__item--amber">Amber</li><li class="acc-rag__item acc-rag__item--red">Red <span class="acc-rag__note">escalated to unblock</span></li></ul></div>
    </figure>
  </div></section>` : "";
  page("/how-we-work/", p["SEO Title"], p["SEO Description"], heroHtml + localNav + pillarsHtml + cycleHtml + horizonHtml + accHtml, strip(p["Hero Subtitle"] + " " + secs.map(s => s.Heading + " " + s["Body HTML"]).join(" ")));
}
// Vision 2030 page: hero, at-a-glance figures, in-page nav, north star, goals, outcomes, closing band
function visionPage() {
  const p = pages["vision-2030"], secs = sectionsFor("vision-2030");
  const north = secs.find(s => s.Slug === "vision-north-star"), goalsSec = secs.find(s => s.Slug === "vision-seven-goals"), success = secs.find(s => s.Slug === "vision-success");
  // Figures come from the pack: the $100 billion ambition and the collection counts
  const glance = `<section class="glance" aria-label="Vision 2030 at a glance"><div class="container container--wide"><dl class="glance__list">
    <div class="glance__item"><dt class="glance__label">Regional-economy ambition for 2030</dt><dd class="glance__num">$100bn</dd></div>
    <div class="glance__item"><dt class="glance__label">Connected Charter goals</dt><dd class="glance__num">${goals.length}</dd></div>
    <div class="glance__item"><dt class="glance__label">Pillars: ${pillars.map(x => esc(x.Name)).join(", ")}</dt><dd class="glance__num">${pillars.length}</dd></div>
    <div class="glance__item"><dt class="glance__label">Task forces turning goals into work</dt><dd class="glance__num">${taskForces.length}</dd></div>
  </dl></div></section>`;
  const localNav = `<nav class="localnav vision-nav" aria-label="On this page"><div class="container container--wide"><ul class="localnav__list">${[[north, "north-star"], [goalsSec, "goals"], [success, "success"]].filter(([s]) => s).map(([s, id]) => `<li><a href="#${id}">${esc(sentence(s.Eyebrow))}</a></li>`).join("")}</ul></div></nav>`;
  // North star: statement beside the text; the conditions named in the copy become chips
  const paras = [...(north?.["Body HTML"] || "").matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => m[1]);
  const condMatch = (paras[1] || "").match(/when (.+?) advance with it/);
  const conditions = condMatch ? condMatch[1].split(/,\s*|\s+and\s+/).map(x => x.trim()).filter(Boolean) : [];
  const tick = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>`;
  const northStar = north ? `<section class="section north-star" id="north-star" aria-labelledby="${north.Slug}-title"><div class="container container--wide north-star__grid">
    <div class="north-star__head">${eyebrowH(north)}</div>
    <div class="north-star__text">
      ${paras[0] ? `<p class="north-star__lead">${paras[0]}</p>` : ""}
      ${paras[1] ? `<p class="north-star__p">${paras[1]}</p>` : ""}
      ${conditions.length ? `<ul class="north-star__chips list-reset" aria-label="What must advance with growth">${conditions.map(c => `<li>${tick}${esc(c.charAt(0).toUpperCase() + c.slice(1))}</li>`).join("")}</ul>` : ""}
    </div>
  </div></section>` : "";
  // Closing band: the page's campaign line, with the hero's routes onward
  const closing = `<section class="closing closing--vision theme-dark" aria-labelledby="vision-closing-title">
    <img class="closing__bg" src="/assets/images/hero3.jpg" alt="" width="1920" height="750" loading="lazy" decoding="async">
    <div class="container closing__inner"><span class="eyebrow">${esc(sentence(p.Eyebrow))}</span><h2 class="headline-section" id="vision-closing-title">${esc(p["Campaign Line"])}</h2>
      <div class="btn-row closing__ctas">${btn(p["Secondary CTA Label"], p["Secondary CTA URL"])}${btn(ctaNav.Label, ctaNav.URL, "secondary")}</div></div>
  </section>`;
  const body = hero(p, { image: IMG["vision-2030"], noCampaign: true }) + glance + localNav + northStar + (goalsSec ? goalGroupsSection(goalsSec) : "") + (success ? outcomesSection(success, "success") : "") + closing;
  page("/vision-2030/", p["SEO Title"], p["SEO Description"], body, strip(p["Hero Subtitle"] + " " + secs.map(s => s.Heading + " " + s["Body HTML"]).join(" ") + " " + goals.map(g => g.Name + " " + g["Short Description"]).join(" ")));
}
// Vision 2030: what success looks like — the outcome list as numbered cards
const outcomesSection = (s, id) => {
  const items = [...s["Body HTML"].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => m[1]);
  const tick = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>`;
  // Interim photography, one per outcome in list order, pending approved assets
  const photos = ["13-1.jpg", "5.jpg", "27.jpg", "16-1.jpg", "11-3.jpg", "17-1.jpg"];
  return `<section class="outcomes-section outcomes-section--sky"${id ? ` id="${id}"` : ""} aria-labelledby="${s.Slug}-title">
  <div class="container container--wide">
    <header class="split-header"><div>${eyebrowH(s)}</div><div>${sectionCta(s, false)}</div></header>
    <ol class="outcome-grid list-reset">${items.map((t, i) => `<li class="outcome-card">
      <div class="outcome-card__content"><span class="outcome-card__index">${String(i + 1).padStart(2, "0")}</span><span class="outcome-card__tick">${tick}</span><p class="outcome-card__text">${t}</p></div>
      ${photos[i] ? `<span class="outcome-card__media" aria-hidden="true"><img class="outcome-card__photo" src="/assets/images/${photos[i]}" alt="" width="512" height="512" loading="lazy" decoding="async"></span>` : ""}
    </li>`).join("")}</ol>
  </div>
</section>`;
};
// Opportunity gateway: icon-led pathway cards on a soft gradient (home and /opportunities)
const PORTAL_ICON = {
  business: `<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`,
  invest: `<path d="M13 17V9M18 17V5M8 17v-3"/><path d="M3 3v16a2 2 0 0 0 2 2h16"/>`,
  startup: `<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>`,
  employment: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>`,
  education: `<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>`,
  health: `<path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/>`,
  tourism: `<path d="m8 3 4 8 5-5 5 15H2L8 3z"/><path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19"/>`,
  retirement: `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>`,
};
const svgIcon = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
const gatewayCard = p => `<li class="gateway-card">
  <img class="gateway-card__img" src="/assets/images/${IMG.portals[p.Slug]}" alt="" width="512" height="512" loading="lazy" decoding="async">
  <div class="gateway-card__body">
    <span class="gateway-card__icon">${svgIcon(PORTAL_ICON[p.Slug] || "")}</span>
    <div class="gateway-card__text"><h3 class="gateway-card__title"><a class="stretched" href="/opportunities/${p.Slug}/">${esc(p.Name)}</a></h3><p class="gateway-card__kicker">${esc(p.Kicker)}</p></div>
  </div>
  <p class="gateway-card__cta" aria-hidden="true"><span>Explore pathway</span><span class="gateway-card__arrow">${arrow}</span></p>
</li>`;
// Accent the closing phrase of the heading ("… in Coimbatore.")
const accentTail = h => { const m = h.match(/^(.*?)(\s+in Coimbatore\.?)$/); return m ? `${esc(m[1])}<span class="text-accent">${esc(m[2])}</span>` : esc(h); };
const gatewaySection = s => `<section class="gateway" aria-labelledby="${s.Slug}-title"${anchorFor(s) ? ` id="${anchorFor(s)}"` : ""}>
  <div class="container container--wide">
    <header class="gateway__head">
      ${s.Eyebrow ? `<span class="gateway__eyebrow">${esc(sentence(s.Eyebrow))}</span>` : ""}
      <h2 class="headline-section" id="${s.Slug}-title">${accentTail(s.Heading)}</h2>
      <div class="lede-html">${s["Body HTML"]}</div>
    </header>
    <ul class="gateway__grid list-reset">${portals.map(gatewayCard).join("")}</ul>
    ${s["CTA Label"] && s["CTA URL"] ? `<p class="gateway__cta"><a class="btn btn--primary btn--arrow" href="${href(s["CTA URL"])}">${esc(s["CTA Label"])}<span class="btn__arrow">${arrow}</span></a></p>` : ""}
  </div>
</section>`;
// Closing call to action over the launch photograph
const closingSection = s => `<section class="closing theme-dark" aria-labelledby="${s.Slug}-title">
  <img class="closing__bg" src="/assets/images/news_banner.jpg" alt="" width="1920" height="750" loading="lazy" decoding="async">
  <div class="container closing__inner">
    ${eyebrowH(s)}
    <div class="closing__body">${s["Body HTML"]}</div>
    <div class="btn-row closing__ctas">${btn(s["CTA Label"], s["CTA URL"])}<a class="btn btn--secondary" href="/task-forces/">Explore task forces ${arrow}</a></div>
  </div>
</section>`;
const taskForceSection = s => {
  const featured = taskForces.filter(t => t.Featured === "true"), rest = taskForces.filter(t => t.Featured !== "true");
  // Background mosaic: one photo per task-force domain named in the section copy
  const mosaic = ["aviation", "railways", "roads-mmlp", "environment-water", "rdi-engineering-innovation", "textiles"].map(slug => `<img src="/assets/images/${TF_IMG[slug]}" alt="" width="640" height="360" loading="lazy" decoding="async">`).join("");
  const photoCard = (t, i) => featuredTfCard(t, i).replace(`<article class="tf-feature">`, `<article class="tf-feature tf-feature--photo"><span class="tf-feature__media"><img src="/assets/images/${TF_IMG[t.Slug] || "hero3.jpg"}" alt="" width="640" height="360" loading="lazy" decoding="async"></span><div class="tf-feature__body">`).replace(/<\/article>\s*$/, `</div></article>`);
  return `<section class="${theme(s.Theme)} tf-section tf-section--visual" aria-labelledby="${s.Slug}-title">
  <div class="tf-section__mosaic" aria-hidden="true">${mosaic}</div>
  <div class="container container--wide">
    <header class="split-header"><div>${eyebrowH(s)}</div><div><div class="lede-html split-header__lede">${s["Body HTML"]}</div>${sectionCta(s, false)}</div></header>
    <div class="tf-feature-grid">${featured.map(photoCard).join("")}</div>
    ${rest.length ? `<div class="tf-more"><h3 class="tf-more__title">Also in progress</h3><ul class="tf-more__list list-reset">${rest.map(t => `<li><a class="tf-more__link" href="/task-forces/${t.Slug}/"><span>${esc(t.Name)}</span>${statusBadge(t.Status)}</a></li>`).join("")}</ul></div>` : ""}
  </div>
</section>`;
};
const flagIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>`;
const initCard = i => `<article class="work-card init-card init-card--${(i.Status || "").toLowerCase()}">
  <div class="tf-card__meta"><span class="tf-card__domain">${esc(i.Category)} · ${esc(tfBySlug[i["Task Force Slug"]]?.Name || "")}</span>${statusBadge(i.Status)}</div>
  <h3 class="tf-card__title init-card__title"><a class="stretched" href="/initiatives/${i.Slug}/">${esc(i.Name)}</a></h3>
  <p class="tf-card__purpose init-card__summary">${esc(i.Summary)}</p>
  ${i["Next Milestone"] ? `<div class="init-card__milestone"><span class="init-card__flag">${flagIcon}</span><p><span class="work-card__label">Next milestone</span>${esc(i["Next Milestone"])}</p></div>` : ""}
</article>`;
const updateCard = u => `<article class="update-card">
  <p class="update-card__meta"><span>${esc(u["Content Type"])}</span><time datetime="${u["Published Date"]}">${fmtDate(u["Published Date"])}</time></p>
  <h3 class="update-card__title"><a class="stretched" href="/updates/${u.Slug}/">${esc(u.Name)}</a></h3>
  <p class="update-card__excerpt">${esc(u.Excerpt)}</p>
  <span class="link-cta" aria-hidden="true">Read update</span>
</article>`;
const partnerGrid = () => `<ul class="partner-grid list-reset">${partners.map(p => `<li class="partner"><span class="partner__short" aria-hidden="true">${esc(p["Short Name"])}</span><span class="partner__name">${esc(p.Name)}</span><span class="partner__category">${esc(p.Category)}</span>${p.Description ? `<span class="partner__desc">${esc(p.Description)}</span>` : ""}</li>`).join("")}</ul>`;
const partnerStrip = () => `<ul class="partner-strip list-reset" aria-label="Partner organisations">${partners.map(p => `<li title="${esc(p.Name)}"><abbr title="${esc(p.Name)}">${esc(p["Short Name"])}</abbr></li>`).join("")}</ul>`;
const goalList = () => `<ol class="goal-grid list-reset">${goals.map((g, i) => `<li class="goal-item"><span class="goal-item__index">${String(i + 1).padStart(2, "0")}</span><h3 class="goal-item__title">${esc(g.Name)}</h3><p class="goal-item__short">${esc(g["Short Description"])}</p><div class="goal-item__body">${g["Body HTML"]}</div><span class="goal-item__pillar">${esc(g["Primary Pillar"])}</span></li>`).join("")}</ol>`;
const empty = (title, text) => `<div class="empty-state"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg><p class="empty-state__title">${esc(title)}</p><p>${esc(text)}</p></div>`;

// ---------- forms (preview only until connected in Framer) ----------
const opt = (list) => `<option value="">Select…</option>` + list.map(o => `<option>${esc(o)}</option>`).join("");
const field = (id, label, input, { optional, wide } = {}) => `<div class="field${wide ? " field--wide" : ""}"><label class="field__label" for="${id}">${esc(label)}${optional ? ' <span class="field__optional">(optional)</span>' : ""}</label>${input}<p class="field__error" id="${id}-error">Please complete this field.</p></div>`;
const inp = (id, type, attrs = "") => `<input class="field__input" id="${id}" name="${id}" type="${type}" ${attrs} aria-describedby="${id}-error">`;
const sel = (id, list, attrs = "required") => `<select class="field__input" id="${id}" name="${id}" ${attrs} aria-describedby="${id}-error">${opt(list)}</select>`;
const area = (id, attrs = "required") => `<textarea class="field__input" id="${id}" name="${id}" ${attrs} aria-describedby="${id}-error"></textarea>`;
const consent = id => `<div class="field field--wide"><label class="check"><input type="checkbox" id="${id}" name="consent" required aria-describedby="${id}-error"><span>I agree that Coimbatore NXT may use these details to respond to this submission.</span></label><p class="field__error" id="${id}-error">Please confirm your consent to continue.</p></div>`;
const tfNames = [...taskForces.map(t => t.Name), "Not sure yet"];
const enquiryTypes = ["Task-force participation", "Investment or business facilitation", "Institutional partnership", "Research and data contribution", "Media and communications", "Events", "Resource submission", "General enquiry"];
const contributionTypes = ["Join a task force", "Share evidence", "Open a door", "Support an initiative", "Tell the region’s story"];
const formShell = (id, title, inner, submit) => `<form class="form form--nxt" id="${id}" data-nxt-form novalidate aria-labelledby="${id}-title"><h2 class="headline-sub" id="${id}-title">${esc(title)}</h2><div class="form__grid">${inner}</div><div class="btn-row"><button class="btn btn--primary" type="submit">${esc(submit)}</button></div><p class="form__status" role="status" aria-live="polite" data-form-status></p></form>`;
const contributeForm = formShell("contribute-form", "Submit your interest", [
  field("gi-name", "Name", inp("gi-name", "text", 'autocomplete="name" required')),
  field("gi-org", "Organisation", inp("gi-org", "text", 'autocomplete="organization" required')),
  field("gi-role", "Role", inp("gi-role", "text", 'autocomplete="organization-title" required')),
  field("gi-email", "Email", inp("gi-email", "email", 'autocomplete="email" required')),
  field("gi-phone", "Phone", inp("gi-phone", "tel", 'autocomplete="tel" inputmode="tel"'), { optional: true }),
  field("gi-type", "Contribution type", sel("gi-type", contributionTypes)),
  field("gi-tf", "Relevant task force", sel("gi-tf", tfNames)),
  field("gi-time", "Time availability", inp("gi-time", "text", "required")),
  field("gi-what", "What you can contribute", area("gi-what"), { wide: true }),
  field("gi-outcome", "Outcome you want to support", area("gi-outcome"), { wide: true }),
  field("gi-link", "LinkedIn or website", inp("gi-link", "url", 'autocomplete="url" placeholder="https://"'), { optional: true, wide: true }),
  consent("gi-consent"),
].join(""), "Submit your interest");
const contactForm = formShell("contact-form", "Send an enquiry", [
  field("ct-name", "Name", inp("ct-name", "text", 'autocomplete="name" required')),
  field("ct-org", "Organisation", inp("ct-org", "text", 'autocomplete="organization" required')),
  field("ct-email", "Email", inp("ct-email", "email", 'autocomplete="email" required'), { wide: true }),
  field("ct-type", "Enquiry type", sel("ct-type", enquiryTypes)),
  field("ct-ws", "Relevant workstream", sel("ct-ws", tfNames)),
  field("ct-msg", "Message", area("ct-msg"), { wide: true }),
  consent("ct-consent"),
].join(""), "Send enquiry");

// ---------- pages ----------
const outPages = [];
const page = (path, title, description, body, searchText = "") => outPages.push({ path, title, description, body, searchText });
const strip = h => String(h).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// Home
{
  const p = pages.home;
  const parts = sectionsFor("home").map(s => {
    if (s.Slug === "home-opportunity-gateway") return gatewaySection(s);
    if (s.Slug === "home-shared-ambition") return ambitionSection(s);
    if (s.Slug === "home-three-pillars") return pillarSection(s);
    if (s.Slug === "home-task-forces") return taskForceSection(s);
    if (s.Slug === "home-initiatives") return workSection(s);
    if (s.Slug === "home-alliance") return allianceSection(s);
    if (s.Slug === "home-closing") return closingSection(s);
    return renderSection(s);
  });
  page("/", p["SEO Title"], p["SEO Description"], hero(p, { image: IMG.home, video: "home-hero" }) + parts.join("\n"), strip(sectionsFor("home").map(s => s.Heading + " " + s["Body HTML"]).join(" ")));
}
// Institutional pages built from Page Sections
const sectionPage = (slug, path, { image, dark, extras = {}, heroAfter = "", mosaic } = {}) => {
  const p = pages[slug];
  const parts = sectionsFor(slug).map(s => extras[s.Slug] ? extras[s.Slug](s) : renderSection(s));
  page(path, p["SEO Title"], p["SEO Description"], hero(p, { image, dark, after: heroAfter, mosaic }) + parts.join("\n"), strip(p["Hero Subtitle"] + " " + sectionsFor(slug).map(s => s.Heading + " " + s["Body HTML"]).join(" ")));
};
sectionPage("about", "/about/", { image: IMG.about });
visionPage();
howWeWorkPage();
sectionPage("alliance", "/alliance/", { image: IMG.alliance, extras: { "alliance-partners": s => renderSection(s, partnerGrid()) } });
// Opportunities hero: shortcut chips to each pathway
const pathwayChips = `<ul class="hero-chips list-reset" aria-label="Pathways">${portals.map(p => `<li><a class="hero-chip" href="/opportunities/${p.Slug}/"><span class="hero-chip__icon">${svgIcon(PORTAL_ICON[p.Slug] || "")}</span>${esc(p.Name)}</a></li>`).join("")}</ul>`;
sectionPage("opportunities", "/opportunities/", { image: IMG.opportunities, heroAfter: pathwayChips, extras: { "opportunities-pathways": s => gatewaySection(s) } });
// Ways to contribute: heading over a circular city photo, options as an icon list on a line
const CONTRIB_ICON = [
  '<circle cx="9" cy="8" r="3.2"/><circle cx="16.5" cy="9" r="2.6"/><path d="M3.5 19c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5M14.5 14c3 0 5.5 1.9 5.5 5"/>',
  '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 15.5h5M10 9h2"/>',
  '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8"/>',
  '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 6l2.2 2M17.6 16l2.2 2M2.5 12h3M18.5 12h3M4.2 18l2.2-2M17.6 8l2.2-2"/>',
  '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
];
const contributeSection = s => {
  const items = [...s["Body HTML"].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => m[1]);
  return `<section class="section contrib" id="contribute" aria-labelledby="${s.Slug}-title"><div class="container container--wide contrib__grid">
    <div class="contrib__head">${eyebrowH(s)}
      <div class="contrib__visual" aria-hidden="true"><span class="contrib__ring"></span><img src="/assets/images/10-2.jpg" alt="" width="512" height="512" loading="lazy" decoding="async"><span class="contrib__dot"></span></div>
    </div>
    <div class="contrib__body">
      <ul class="contrib__list list-reset">${items.map((html, i) => `<li class="contrib__item"><span class="contrib__icon" aria-hidden="true">${svgIcon(CONTRIB_ICON[i] || CONTRIB_ICON[0])}</span><p>${html}</p></li>`).join("")}</ul>
      ${s["CTA Label"] && s["CTA URL"] ? `<p class="contrib__cta">${linkCta(s["CTA Label"], s["CTA URL"])}</p>` : ""}
    </div>
  </div></section>`;
};
// What participation requires: copy on the left, meeting photo on the right behind a curved edge
const expectationsSection = s => `<section class="section expect" aria-labelledby="${s.Slug}-title">
  <div class="expect__visual" aria-hidden="true"><img src="/assets/images/21-1.jpg" alt="" width="512" height="512" loading="lazy" decoding="async"><span class="expect__arc"></span><span class="expect__dot"></span></div>
  <div class="container container--wide"><div class="expect__text">${eyebrowH(s)}<div class="prose prose--nxt expect__body">${s["Body HTML"]}</div>${sectionCta(s, false)}</div></div>
</section>`;
// Get Involved hero: teamwork, partners and expertise photos behind the copy
sectionPage("get-involved", "/get-involved/", { dark: true, mosaic: [HERO["get-involved"]], extras: {
  "get-involved-expectations": s => expectationsSection(s),
  "get-involved-contributions": s => contributeSection(s) + `<section class="section section--alt form-section" aria-label="Submit your interest"><div class="container">${contributeForm}</div></section>`,
} });
sectionPage("contact", "/contact/", { image: HERO.contact, extras: {
  "contact-routing": s => renderSection(s) + `<section class="section section--alt" aria-label="Send an enquiry"><div class="container">${contactForm}</div></section>`,
} });

// Listing pages (intros reuse the matching homepage section copy)
const listHero = (eyebrow, title, lede, { images, after = "" } = {}) => images ? `
    <section class="hero hero--nxt list-hero" aria-labelledby="hero-title">
      <div class="list-hero__mosaic list-hero__mosaic--${images.length}" aria-hidden="true">${images.map(src => `<img src="/assets/images/${src}" alt="" width="640" height="360" fetchpriority="high">`).join("")}</div>
      <div class="container container--wide list-hero__inner"><span class="eyebrow">${esc(eyebrow)}</span><h1 class="headline-hero hero__title" id="hero-title">${esc(title)}</h1>${lede ? `<div class="lede lede-html">${lede}</div>` : ""}${after}</div>
    </section>` : `
    <section class="hero hero--nxt" aria-labelledby="hero-title"><div class="container hero__inner"><span class="eyebrow">${esc(eyebrow)}</span><h1 class="headline-hero hero__title" id="hero-title">${esc(title)}</h1>${lede ? `<div class="lede lede-html">${lede}</div>` : ""}</div></section>`;
{
  const s = sections.find(x => x.Slug === "home-task-forces");
  const byPillar = pillars.map(pl => ({ pl, list: taskForces.filter(t => t["Primary Pillar"] === pl.Name) })).filter(g => g.list.length);
  // Hero: shortcuts to each pillar group below
  const pillarJump = `<ul class="hero-chips list-reset" aria-label="Task forces by pillar">${byPillar.map(g => `<li><a class="hero-chip hero-chip--count" href="#${pillarKey(g.pl.Name)}"><span class="hero-chip__icon">${svgIcon(PILLAR_ICON[g.pl["Icon Name"]] || "")}</span>${esc(g.pl.Name)}<span class="hero-chip__count">${g.list.length}</span></a></li>`).join("")}</ul>`;
  page("/task-forces/", "Task Forces | Coimbatore NXT", strip(s["Body HTML"]), listHero(sentence(s.Eyebrow), s.Heading, s["Body HTML"], { images: [HERO["task-forces"]], after: pillarJump }) +
    `<section class="section section--alt"><div class="container container--wide">${byPillar.map(g => `<div class="group tf-group" id="${pillarKey(g.pl.Name)}"><h2 class="group__title tf-group__title">${esc(g.pl.Name)} <span class="group__count">${g.list.length}</span></h2><p class="group__lede tf-group__lede">${esc(g.pl["Short Description"])}</p><div class="tf-grid tf-grid--photo">${g.list.map(tfPhotoCard).join("")}</div></div>`).join("")}</div></section>`,
    taskForces.map(t => t.Name + " " + t.Purpose).join(" "));
}
{
  const s = sections.find(x => x.Slug === "home-initiatives");
  page("/initiatives/", "Initiatives | Coimbatore NXT", strip(s["Body HTML"]), listHero(sentence(s.Eyebrow), s.Heading, s["Body HTML"], { images: [HERO.initiatives] }) +
    `<section class="section section--alt"><div class="container container--wide"><div class="work-list work-list--initiatives">${initiatives.map(initCard).join("") || empty("No initiatives yet", "Published initiatives will appear here.")}</div></div></section>`,
    initiatives.map(i => i.Name + " " + i.Summary).join(" "));
}
// Updates listing: horizontal cards, photo from the related task force
const updateRow = u => `<article class="update-row">
  <span class="update-row__media"><img src="/assets/images/${TF_IMG[u["Related Task Force Slug"]] || "news_banner.jpg"}" alt="" width="640" height="360" loading="lazy" decoding="async"></span>
  <div class="update-row__body">
    <p class="update-card__meta"><span>${esc(u["Content Type"])}</span><time datetime="${u["Published Date"]}">${fmtDate(u["Published Date"])}</time></p>
    <h2 class="update-row__title"><a class="stretched" href="/updates/${u.Slug}/">${esc(u.Name)}</a></h2>
    <p class="update-row__excerpt">${esc(u.Excerpt)}</p>
    <span class="link-cta" aria-hidden="true">Read update</span>
  </div>
</article>`;
page("/updates/", "Updates | Coimbatore NXT", "News and governance updates from Coimbatore NXT.", `
    ${listHero("Updates", "Updates", "", { images: [HERO.updates] })}` +
  `<section class="section updates-section"><div class="container container--wide"><div class="update-rows">${updates.map(updateRow).join("") || empty("No updates yet", "Published updates will appear here.")}</div></div></section>`,
  updates.map(u => u.Name + " " + u.Excerpt).join(" "));
page("/resources/", "Resources | Coimbatore NXT", "Public documents from Coimbatore NXT.", listHero("Resources", "Resources", "", { images: [HERO.resources] }) +
  `<section class="section section--alt"><div class="container">${resources.length ? `<ul class="list-reset resource-list">${resources.map(r => `<li class="update-card"><p class="update-card__meta"><span>${esc(r["Resource Type"])}</span><time datetime="${r["Published Date"]}">${fmtDate(r["Published Date"])}</time></p><h2 class="update-card__title">${esc(r.Name)}</h2><p class="update-card__excerpt">${esc(r.Summary)}</p>${linkCta("Open resource", r["File URL"] || r["External URL"])}</li>`).join("")}</ul>` : empty("Resources are being prepared", "Approved public documents will be published here.")}</div></section>`);

// Detail pages
const facts = rows => `<dl class="facts">${rows.filter(([, v]) => v).map(([k, v]) => `<div class="facts__row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
const back = (url, label) => `<a class="back-link" href="${url}">${esc(label)}</a>`;
for (const t of taskForces) {
  const rel = initiatives.filter(i => i["Task Force Slug"] === t.Slug), relU = updates.filter(u => u["Related Task Force Slug"] === t.Slug);
  page(`/task-forces/${t.Slug}/`, t["SEO Title"], t["SEO Description"], `
    <section class="hero hero--image hero--nxt detail-hero" aria-labelledby="hero-title"><img class="hero__bg" src="/assets/images/${TF_HERO[t.Slug] || TF_IMG[t.Slug]}" alt="" width="1920" height="750" fetchpriority="high"><div class="hero__overlay"><div class="container container--wide hero__inner hero__inner--left">${back("/task-forces/", "All task forces")}<div class="detail-hero__meta"><span class="eyebrow">${esc(t.Domain)}</span>${statusBadge(t.Status)}</div><h1 class="headline-hero hero__title" id="hero-title">${esc(t.Name)}</h1><p class="lede detail-hero__lede">${esc(t.Purpose)}</p></div></div></section>
    <section class="section section--alt"><div class="container container--wide detail-grid">
      <div class="detail-grid__main"><h2 class="headline-sub">Goal horizons</h2>
        <ol class="horizons list-reset">
          <li class="horizon"><span class="horizon__when">0–6 months</span><h3 class="horizon__title">Short-term focus</h3><p>${esc(t["Short-Term Focus (0–6 months)"])}</p></li>
          <li class="horizon"><span class="horizon__when">Up to 24 months</span><h3 class="horizon__title">Mid-term outcome</h3><p>${esc(t["Mid-Term Outcome (up to 24 months)"])}</p></li>
          <li class="horizon"><span class="horizon__when">To 2030</span><h3 class="horizon__title">Long-term impact</h3><p>${esc(t["Long-Term Impact (to 2030)"])}</p></li>
        </ol></div>
      <aside class="detail-grid__aside" aria-label="Task force details">${facts([["Primary pillar", esc(t["Primary Pillar"])], ["Charter goal alignment", esc(t["Charter Goal Alignment"]).replace(/; /g, "<br>")], ["Lead organisation", esc(t["Lead Organisation"])], ["Status", esc(t.Status)]])}<a class="btn btn--primary" href="/get-involved/">Get involved</a></aside>
    </div></section>
    ${rel.length || relU.length ? `<section class="section"><div class="container container--wide"><h2 class="headline-sub related-title">Related work</h2><div class="work-list">${rel.map(initCard).join("")}${relU.map(updateCard).join("")}</div></div></section>` : ""}`,
    t.Purpose + " " + t.Domain);
}
for (const i of initiatives) {
  const tf = tfBySlug[i["Task Force Slug"]];
  page(`/initiatives/${i.Slug}/`, i["SEO Title"], i["SEO Description"], `
    <section class="hero hero--image hero--nxt detail-hero" aria-labelledby="hero-title"><img class="hero__bg" src="/assets/images/${INIT_HERO[i.Slug] || "hero-initiatives.jpg"}" alt="" width="1920" height="750" fetchpriority="high"><div class="hero__overlay"><div class="container container--wide hero__inner hero__inner--left">${back("/initiatives/", "All initiatives")}<div class="detail-hero__meta"><span class="eyebrow">${esc(i.Category)}</span>${statusBadge(i.Status)}</div><h1 class="headline-hero hero__title" id="hero-title">${esc(i.Name)}</h1><p class="lede detail-hero__lede">${esc(i.Summary)}</p></div></div></section>
    <section class="section section--alt"><div class="container container--wide detail-grid">
      <div class="detail-grid__main"><div class="prose prose--nxt">${i["Body HTML"]}</div>
        <div class="outcome-pair"><div class="outcome"><span class="horizon__when">Outcome sought</span><p>${esc(i["Outcome Sought"])}</p></div><div class="outcome"><span class="horizon__when">Next milestone</span><p>${esc(i["Next Milestone"])}</p></div></div></div>
      <aside class="detail-grid__aside" aria-label="Initiative details">${facts([["Task force", tf ? `<a href="/task-forces/${tf.Slug}/">${esc(tf.Name)}</a>` : ""], ["Stage", esc(i.Stage)], ["Status", esc(i.Status)], ["Last updated", `<time datetime="${i["Last Updated"]}">${fmtDate(i["Last Updated"])}</time>`]])}<a class="btn btn--primary" href="/get-involved/">Get involved</a></aside>
    </div></section>`, strip(i.Summary + " " + i["Body HTML"]));
}
for (const u of updates) {
  const tf = tfBySlug[u["Related Task Force Slug"]];
  page(`/updates/${u.Slug}/`, u["SEO Title"], u["SEO Description"], `
    <article class="section" aria-labelledby="hero-title"><div class="container container--reading">${back("/updates/", "All updates")}
      <p class="update-card__meta"><span>${esc(u["Content Type"])}</span><time datetime="${u["Published Date"]}">${fmtDate(u["Published Date"])}</time></p>
      <h1 class="headline-section article-title" id="hero-title">${esc(u.Name)}</h1>
      <p class="lede">${esc(u.Excerpt)}</p>
      <div class="prose prose--nxt article-body">${u["Body HTML"]}</div>
      ${facts([["Author", esc(u.Author)], ["Category", esc(u.Category)], ["Related task force", tf ? `<a href="/task-forces/${tf.Slug}/">${esc(tf.Name)}</a>` : ""]])}
    </div></article>`, strip(u.Excerpt + " " + u["Body HTML"]));
}
for (const p of portals) {
  page(`/opportunities/${p.Slug}/`, p["SEO Title"], p["SEO Description"], `
    <section class="hero hero--image hero--nxt" aria-labelledby="hero-title">
      <img class="hero__bg" src="/assets/images/${IMG.portals[p.Slug]}" alt="" width="1920" height="750" fetchpriority="high">
      <div class="hero__overlay"><div class="container container--wide hero__inner hero__inner--left">${back("/opportunities/", "All pathways")}<span class="eyebrow">${esc(p.Kicker)}</span><h1 class="headline-hero hero__title" id="hero-title">${esc(p["Hero Title"])}</h1><p class="lede">${esc(p.Introduction)}</p>
        <div class="btn-row hero__ctas">${btn(p["Primary CTA Label"], p["Primary CTA URL"])}</div></div></div>
    </section>
    <section class="section"><div class="container container--reading"><div class="prose prose--nxt">${p["Body HTML"]}</div>
      <p class="section-cta">${linkCta(p["Secondary CTA Label"], p["Secondary CTA URL"])}</p></div></section>
    <section class="section section--alt section--tight" aria-label="Other pathways"><div class="container"><ul class="explore">${portals.filter(x => x.Slug !== p.Slug).map(x => `<li><a class="pill-link" href="/opportunities/${x.Slug}/">${esc(x.Name)}</a></li>`).join("")}</ul></div></section>`,
    strip(p.Introduction + " " + p["Body HTML"]));
}

// ---------- write ----------
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(websiteDir, "dist", "assets"), join(OUT, "assets"), { recursive: true });
writeFileSync(join(OUT, "assets", "css", "nxt-2026.css"), readFileSync(join(here, "nxt-2026.css"), "utf8") + "\n" + readFileSync(join(here, "nxt-2026-home.css"), "utf8") + "\n" + readFileSync(join(here, "nxt-2026-vision.css"), "utf8") + "\n" + readFileSync(join(here, "nxt-2026-how.css"), "utf8") + "\n" + readFileSync(join(here, "nxt-2026-footer.css"), "utf8") + "\n" + readFileSync(join(here, "nxt-2026-roveia.css"), "utf8") + String.fromCharCode(10) + readFileSync(join(here, "nxt-2026-motion.css"), "utf8"));
cpSync(join(here, "nxt-2026.js"), join(OUT, "assets", "js", "nxt-2026.js"));
const write = (path, html) => { const dir = join(OUT, path); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, "index.html"), html); };
for (const p of outPages) write(p.path, layout(p));
writeFileSync(join(OUT, "assets", "js", "search-index.js"), "window.SEARCH_INDEX = " + JSON.stringify(outPages.map(p => ({ url: p.path.replace(/^\//, ""), title: p.title.replace(/ \| Coimbatore NXT$/, ""), description: p.description, text: p.searchText }))) + ";\n");

// Redirects: the pack's list plus the retired 2022 pages, as a Vercel config and as local stubs
const legacy = [
  ["/for-businesses", "/opportunities/business"], ["/for-individuals", "/opportunities"], ["/next", "/about"],
  ["/we-did-some-things-exemplary", "/about"], ["/we-are-doing-many-things-enterprising", "/opportunities/business"], ["/we-can-do-any-thing-you-can-imagine", "/opportunities/invest"],
  ["/here-to-help", "/opportunities"], ["/get-it-done", "/about"], ["/digital-business-transformation", "/initiatives"],
  ["/nxt-partners", "/alliance"], ["/nxt-news", "/updates"], ["/nxt-launch-day", "/updates"],
  ["/shankar-vanavarayar-launch-day", "/updates"], ["/arjun-prakash-launch-day", "/updates"], ["/prashanth-subramanian-launch-day", "/updates"], ["/downloads", "/resources"],
];
const all = [...redirects.filter(r => r["Redirect Type"] === "301").map(r => [r["Old Path"], r["New Path"]]), ...legacy];
for (const [from, to] of all) write(from, `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><title>Moved</title><meta name="robots" content="noindex"><link rel="canonical" href="${href(to)}"><meta http-equiv="refresh" content="0; url=${href(to)}"><script>location.replace(${JSON.stringify(href(to))} + location.hash)</script></head><body><p>This page has moved to <a href="${href(to)}">${href(to)}</a>.</p></body></html>`);
writeFileSync(join(OUT, "vercel.json"), JSON.stringify({ $schema: "https://openapi.vercel.sh/vercel.json", trailingSlash: true, redirects: all.map(([source, destination]) => ({ source, destination: href(destination), permanent: true })) }, null, 2) + "\n");
writeFileSync(join(OUT, "redirects.txt"), all.map(([f, t]) => `${f} -> ${href(t)}`).join("\n") + "\n");
// Cache busting: assets are cached for a day, so stamp CSS/JS links with a content hash.
// A changed file gets a new URL and browsers fetch it straight away after a deploy.
{
  const stamp = {};
  for (const dir of ["css", "js"]) for (const f of readdirSync(join(OUT, "assets", dir))) {
    stamp[`/assets/${dir}/${f}`] = createHash("md5").update(readFileSync(join(OUT, "assets", dir, f))).digest("hex").slice(0, 10);
  }
  const walkHtml = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walkHtml(join(d, e.name)) : e.name.endsWith(".html") ? [join(d, e.name)] : []);
  for (const file of walkHtml(OUT)) {
    const html = readFileSync(file, "utf8");
    const next = html.replace(/(href|src)="(\/assets\/(?:css|js)\/[^"?]+)"/g, (m, attr, url) => stamp[url] ? `${attr}="${url}?v=${stamp[url]}"` : m);
    if (next !== html) writeFileSync(file, next);
  }
}
console.log(`Built ${outPages.length} pages and ${all.length} redirects into ${OUT}`);

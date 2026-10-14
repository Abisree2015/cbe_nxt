// Exports the built site (site-2026) as a portable folder of HTML pages: every link and asset path is
// rewritten to be relative, and folder links point at index.html, so pages work when opened straight
// from disk (file://) as well as from any static host.
// Usage: node build/export-html.mjs   (run after build/build-2026.mjs)
import { readFileSync, writeFileSync, rmSync, cpSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..", "site-2026");
const OUT = join(here, "..", "html-export");

rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true, filter: p => !/[\\/]_tmp([\\/]|$)/.test(p) && !/_standalone-test\.html$/.test(p) });

const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const pages = walk(OUT).filter(p => p.endsWith(".html"));

// "/about/#x" -> "../about/index.html#x" for a page `depth` folders deep
const toRelative = (url, prefix) => {
  const m = /^([^?#]*)([?#].*)?$/.exec(url);
  let path = m[1], tail = m[2] || "";
  if (path === "/") path = "/index.html";
  else if (path.endsWith("/")) path += "index.html";
  else if (!/\.[a-z0-9]+$/i.test(path)) path += "/index.html";
  return prefix + path.slice(1) + tail;
};

let rewritten = 0;
for (const file of pages) {
  const depth = relative(OUT, dirname(file)).split(sep).filter(Boolean).length;
  const prefix = depth ? "../".repeat(depth) : "./";
  let html = readFileSync(file, "utf8");
  // href / src / poster / action attributes that start with a single "/"
  html = html.replace(/\b(href|src|poster|action)="(\/(?!\/)[^"]*)"/g, (_, attr, url) => { rewritten++; return `${attr}="${toRelative(url, prefix)}"`; });
  // Redirect stubs: <meta http-equiv="refresh" content="0; url=/about/">
  html = html.replace(/(content="\d+;\s*url=)(\/(?!\/)[^"]*)"/gi, (_, lead, url) => { rewritten++; return `${lead}${toRelative(url, prefix)}"`; });
  // Inline style url(/assets/...)
  html = html.replace(/url\((['"]?)(\/(?!\/)[^)'"]+)\1\)/g, (_, q, url) => { rewritten++; return `url(${q}${prefix}${url.slice(1)}${q})`; });
  // Search builds result links as data-root + url
  html = html.replace(/data-root="\/"/g, `data-root="${prefix}"`);
  writeFileSync(file, html);
}

// Search index: folder addresses -> explicit index.html
const idxFile = join(OUT, "assets", "js", "search-index.js");
const idx = readFileSync(idxFile, "utf8").replace(/"url":"([^"]*)"/g, (_, u) => `"url":"${u === "" ? "index.html" : u.endsWith("/") ? u + "index.html" : u}"`);
writeFileSync(idxFile, idx);

// Host config is not needed in a portable export
rmSync(join(OUT, "vercel.json"), { force: true });

// Report anything still pointing at the site root
const leftovers = pages.flatMap(f => (readFileSync(f, "utf8").match(/\b(?:href|src|poster|action)="\/(?!\/)[^"]*"/g) || []).map(m => `${relative(OUT, f)}: ${m}`));
console.log(`Exported ${pages.length} HTML files to ${OUT}\nRewrote ${rewritten} paths; root-relative paths left: ${leftovers.length}`);
leftovers.slice(0, 10).forEach(l => console.log("  " + l));

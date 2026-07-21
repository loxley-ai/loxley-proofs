// the desk's numbers, checked by a machine that is not the desk.
//
// every hour this reads the public mirror of the desk's posts, pulls out every
// structured price claim ("SYM onchain X, +Y% vs close Z"), and re-derives it
// from sources the desk does not control: the arithmetic itself, the official
// close from Yahoo, and the onchain print from DexScreener. a claim that does
// not survive fails this run, and a failed run is a page to the operator.
//
// design rules:
// - a source being unreachable is "unverifiable", never a failure. the desk
//   must only be paged for numbers that are provably wrong.
// - the arithmetic check is strict (the desk's own inputs must agree with its
//   own percent). external checks carry tolerance: closes to the cent-ish,
//   onchain prices loosely, because posts age and markets move.

const MIRROR = "https://t.me/s/loxley_ai";
const MAX_AGE_MIN = 150; // check posts from the last 2.5h (hourly cron + slack)

const strip = (h) =>
  h.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const num = (s) => parseFloat(String(s).replace(/,/g, ""));

async function getText(url, headers = {}) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.text();
}

async function getJSON(url) {
  return JSON.parse(await getText(url, { "user-agent": "Mozilla/5.0 (factcheck)" }));
}

// ---- collect recent posts from the public mirror
async function recentPosts() {
  const html = await getText(MIRROR);
  const posts = [];
  // each message block carries its text div and a datetime attribute
  const blocks = html.split('tgme_widget_message_wrap').slice(1);
  for (const b of blocks) {
    const t = b.match(/datetime="([^"]+)"/);
    const m = b.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/);
    if (!t || !m) continue;
    const at = new Date(t[1]);
    if (Date.now() - at.getTime() > MAX_AGE_MIN * 60000) continue;
    posts.push({ at: t[1], text: strip(m[1]) });
  }
  return posts;
}

// ---- official close: last few daily closes from Yahoo
async function yahooCloses(sym) {
  const j = await getJSON(
    `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=7d&interval=1d`);
  const res = j.chart && j.chart.result && j.chart.result[0];
  if (!res) return null;
  const closes = ((res.indicators.quote[0] || {}).close || []).filter((x) => x != null);
  if (res.meta && res.meta.chartPreviousClose != null) closes.push(res.meta.chartPreviousClose);
  return closes.length ? closes : null;
}

// ---- onchain prints for the tokenized name on robinhood chain
async function dexPrices(sym) {
  const j = await getJSON(
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sym + " robinhood")}`);
  return (j.pairs || [])
    .filter((p) => p.chainId === "robinhood"
      && ((p.baseToken || {}).symbol || "").toUpperCase() === sym.toUpperCase())
    .map((p) => parseFloat(p.priceUsd)).filter((x) => x > 0);
}

const CLAIM = /([A-Z]{1,5}) onchain ([\d,]+(?:\.\d+)?), ([+−-][\d.]+)% vs close ([\d,]+(?:\.\d+)?)/g;

// ---- the corrections ledger: claims the desk itself has withdrawn.
// a withdrawn claim is not re-verified; it is reported as withdrawn, so a
// checker never stamps "ok" on a number the desk already struck. the ledger
// lives in this repo because corrections are part of the public record.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url));
let CORRECTIONS = [];
try {
  CORRECTIONS = JSON.parse(readFileSync(join(HERE, "..", "corrections.json"), "utf8"));
} catch (e) { /* no ledger yet; nothing is withdrawn */ }
function withdrawn(sym, atIso) {
  const t = new Date(atIso).getTime();
  return CORRECTIONS.find((c) =>
    (c.syms || []).includes(sym)
    && t >= new Date(c.from).getTime() && t <= new Date(c.to).getTime());
}

let failures = 0, checked = 0;
const posts = await recentPosts().catch((e) => {
  console.log(`mirror unreachable (${e.message}); nothing to verify this run`);
  return [];
});

for (const p of posts) {
  for (const m of p.text.matchAll(CLAIM)) {
    checked += 1;
    const [, sym, onchainRaw, pctRaw, closeRaw] = m;
    const onchain = num(onchainRaw), close = num(closeRaw);
    const pct = num(pctRaw.replace("−", "-"));
    const label = `[${p.at}] ${sym} onchain ${onchain} ${pct}% vs close ${close}`;

    // 0. a claim the desk has withdrawn is reported as such, never "ok"
    const w = withdrawn(sym, p.at);
    if (w) {
      console.log(`withdrawn (correction on record): ${label} -> ${w.note}`);
      continue;
    }

    // 1. the post must agree with itself
    const derived = (onchain / close - 1) * 100;
    if (Math.abs(derived - pct) > 0.06) {
      failures += 1;
      console.log(`MISMATCH arithmetic: ${label} -> derived ${derived.toFixed(3)}%`);
      continue;
    }

    // 2. the cited close must be a real official close
    try {
      const closes = await yahooCloses(sym);
      if (closes) {
        const ok = closes.some((c) => Math.abs(c - close) <= Math.max(0.2, close * 0.001));
        if (!ok) {
          failures += 1;
          console.log(`MISMATCH close: ${label} -> yahoo recent closes ${closes.map((c) => c.toFixed(2)).join(", ")}`);
          continue;
        }
      } else {
        console.log(`unverifiable close (no yahoo data): ${label}`);
      }
    } catch (e) {
      console.log(`unverifiable close (${e.message}): ${label}`);
    }

    // 3. the onchain print should resemble some real robinhood-chain pair.
    //    loose on purpose: prices move after a post. only flag when every
    //    live pair disagrees by more than 8%.
    try {
      const prices = await dexPrices(sym);
      if (prices.length && !prices.some((x) => Math.abs(x / onchain - 1) <= 0.08)) {
        failures += 1;
        console.log(`MISMATCH onchain: ${label} -> live pairs ${prices.map((x) => x.toFixed(2)).join(", ")}`);
        continue;
      }
    } catch (e) {
      console.log(`unverifiable onchain (${e.message}): ${label}`);
    }

    console.log(`ok: ${label}`);
  }
}

console.log(`\nchecked ${checked} claim(s) across ${posts.length} recent post(s); ${failures} mismatch(es)`);
if (failures > 0) process.exit(1);

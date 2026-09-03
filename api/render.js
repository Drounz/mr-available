// Vercel Serverless Function
// Wired up via vercel.json's "rewrites" (/ and /index.html -> /api/render) and
// "functions.includeFiles" (bundles index.html alongside this function).
//
// Why this exists: index.html renders its product grid entirely client-side
// after fetching from Supabase, so the raw HTML Vercel serves for "/" has an
// empty <div id="grid">. Google eventually executes the JS and sees the real
// grid, but that can take days to weeks, and AI crawlers (GPTBot, ClaudeBot,
// PerplexityBot) do not execute JavaScript at all — they only ever see the
// empty grid. This function fetches the same published, priced products from
// Supabase server-side and injects real product cards plus JSON-LD structured
// data into the HTML before it reaches any crawler.
//
// A human visitor sees no difference: index.html's own script still runs in
// their browser and re-renders the grid on top for search, filtering, and the
// WhatsApp bundle. This only changes what's present on the very first
// response.
//
// Fails open: any Supabase error serves the original static index.html
// unchanged, so a Supabase hiccup can never take the site down.

const fs = require("fs");
const path = require("path");

// Same anon key already public in index.html/admin.html/vercel.json's CSP —
// safe to expose by this project's own design (RLS controls access, not
// secrecy). Read from env here anyway rather than hardcoding a fourth copy:
// keeps it out of source scanners' way and lets it be rotated without a
// redeploy. Set SUPABASE_URL / SUPABASE_ANON_KEY in the Vercel project's
// Environment Variables (same values as CONFIG.supabase in index.html).
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SITE_URL = "https://mravailable.com";

module.exports = async (req, res) => {
  let html;
  try {
    html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
  } catch (err) {
    res.status(500).send("Site temporarily unavailable.");
    return;
  }

  try {
    const products = await fetchProducts();
    const rendered = injectProducts(html, products);
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    res.status(200).send(rendered);
  } catch (err) {
    // Fail open: never let a Supabase hiccup take the site down.
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.status(200).send(html);
  }
};

async function fetchProducts() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY not set in this Vercel project's environment variables");
  }
  const cols = "id,name,model,category,brand,image_url,images,selling_price,description";
  const url = `${SUPABASE_URL}/rest/v1/products?select=${cols}&published=eq.true&selling_price=gt.0&order=name`;
  const resp = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!resp.ok) throw new Error("supabase fetch failed: " + resp.status);
  const rows = await resp.json();
  return rows
    .map((r) => ({
      id: String(r.id || ""),
      name: String(r.name || ""),
      model: String(r.model || ""),
      cat: String(r.category || "") || "Other",
      brand: String(r.brand || ""),
      image: (r.images && r.images[0]) || r.image_url || "",
      price: Number(r.selling_price) || 0,
      description: String(r.description || ""),
    }))
    .filter((p) => p.id && p.name);
}

function naira(n) {
  return "₦" + Number(n || 0).toLocaleString("en-NG");
}

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
  );
}

function cardHtml(p) {
  const modelLine = p.model
    ? `<div class="pmodel">Model <b>${escapeHtml(p.model)}</b></div>`
    : "";
  const thumb = p.image
    ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy"/>`
    : "";
  return `<article class="card">
    <div class="thumb">${thumb}<span class="cat-tag">${escapeHtml(p.cat)}</span></div>
    <div class="pbody">
      <a class="pname" href="?p=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a>
      <div class="pmeta">${escapeHtml(p.brand)}</div>
      ${modelLine}
      <div class="prow"><span class="price">${naira(p.price)}</span></div>
    </div>
  </article>`;
}

function buildJsonLd(products) {
  const store = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: "MR AVAILABLE",
    url: SITE_URL,
    description:
      "Home appliances and electronics, real stock and fair prices, ordered on WhatsApp.",
  };

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.slice(0, 60).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: p.name,
        brand: p.brand || undefined,
        sku: p.model || undefined,
        category: p.cat,
        description: p.description || undefined,
        image: p.image || undefined,
        offers: {
          "@type": "Offer",
          priceCurrency: "NGN",
          price: p.price,
          availability: "https://schema.org/InStock",
          url: SITE_URL,
        },
      },
    })),
  };

  return (
    `<script type="application/ld+json">${JSON.stringify(store)}</script>\n` +
    `<script type="application/ld+json">${JSON.stringify(itemList)}</script>`
  );
}

function injectProducts(html, products) {
  const productsHtml = products.map(cardHtml).join("");
  const jsonLd = buildJsonLd(products);

  let out = html.replace(
    '<div class="grid" id="grid"></div>',
    `<div class="grid" id="grid">${productsHtml}</div>`
  );
  out = out.replace("</head>", `${jsonLd}\n</head>`);
  return out;
}

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

/* ============================================================
   Category-tinted illustrated placeholders — identical copy of the
   logic in index.html's <script> block. Keep both in sync; a product
   with no photo yet gets a gradient tile + line-art icon matching its
   category instead of a broken image or bare grey box.
   ============================================================ */
const CAT_ART_INK = "#14213A";
const CAT_ICONS = {
  ac: '<rect x="12" y="38" width="96" height="34" rx="8" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><line x1="24" y1="52" x2="96" y2="52" stroke="'+CAT_ART_INK+'" stroke-width="2" stroke-linecap="round"/><line x1="24" y1="60" x2="96" y2="60" stroke="'+CAT_ART_INK+'" stroke-width="2" stroke-linecap="round"/><circle cx="96" cy="45" r="3.2" fill="'+CAT_ART_INK+'"/><path d="M40 78 Q52 90 64 78" stroke="'+CAT_ART_INK+'" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M60 78 Q72 90 84 78" stroke="'+CAT_ART_INK+'" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  airfryer: '<path d="M34 46 Q34 30 60 30 Q86 30 86 46 L82 96 Q82 104 74 104 L46 104 Q38 104 38 96 Z" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><rect x="48" y="18" width="24" height="10" rx="5" fill="#fff" stroke="'+CAT_ART_INK+'" stroke-width="2.5"/><circle cx="60" cy="60" r="12" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2.2"/><circle cx="60" cy="60" r="2.4" fill="'+CAT_ART_INK+'"/>',
  blender: '<path d="M44 16 H76 L70 66 H50 Z" fill="#fff" stroke="'+CAT_ART_INK+'" stroke-width="3"/><line x1="44" y1="30" x2="76" y2="30" stroke="'+CAT_ART_INK+'" stroke-width="2"/><rect x="38" y="66" width="44" height="14" rx="3" fill="#fff" stroke="'+CAT_ART_INK+'" stroke-width="2.5"/><rect x="34" y="80" width="52" height="22" rx="6" fill="#fff" stroke="'+CAT_ART_INK+'" stroke-width="3"/>',
  cooker: '<rect x="18" y="46" width="84" height="46" rx="8" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><circle cx="40" cy="62" r="9" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2.3"/><circle cx="80" cy="62" r="9" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2.3"/><circle cx="40" cy="80" r="6" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2"/><circle cx="80" cy="80" r="6" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2"/>',
  extension: '<rect x="14" y="50" width="92" height="28" rx="8" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><circle cx="34" cy="64" r="5.5" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2"/><circle cx="60" cy="64" r="5.5" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2"/><circle cx="86" cy="64" r="5.5" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2"/><path d="M14 64 Q4 64 4 78 Q4 92 16 92" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2.3" stroke-linecap="round"/>',
  fan: '<circle cx="60" cy="48" r="34" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="3"/><path d="M60 48 L60 20 Q74 22 74 40 Z" fill="'+CAT_ART_INK+'" fill-opacity=".16" stroke="'+CAT_ART_INK+'" stroke-width="2"/><path d="M60 48 L84 60 Q78 74 60 68 Z" fill="'+CAT_ART_INK+'" fill-opacity=".16" stroke="'+CAT_ART_INK+'" stroke-width="2"/><path d="M60 48 L38 66 Q30 54 44 44 Z" fill="'+CAT_ART_INK+'" fill-opacity=".16" stroke="'+CAT_ART_INK+'" stroke-width="2"/><circle cx="60" cy="48" r="5" fill="#fff" stroke="'+CAT_ART_INK+'" stroke-width="2.5"/><line x1="60" y1="82" x2="60" y2="104" stroke="'+CAT_ART_INK+'" stroke-width="3" stroke-linecap="round"/><line x1="44" y1="104" x2="76" y2="104" stroke="'+CAT_ART_INK+'" stroke-width="3" stroke-linecap="round"/>',
  freezer: '<rect x="14" y="42" width="92" height="56" rx="9" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><line x1="14" y1="60" x2="106" y2="60" stroke="'+CAT_ART_INK+'" stroke-width="2.5"/><rect x="46" y="66" width="16" height="7" rx="2" fill="'+CAT_ART_INK+'" fill-opacity=".5"/><line x1="24" y1="98" x2="24" y2="106" stroke="'+CAT_ART_INK+'" stroke-width="3" stroke-linecap="round"/><line x1="96" y1="98" x2="96" y2="106" stroke="'+CAT_ART_INK+'" stroke-width="3" stroke-linecap="round"/>',
  generator: '<rect x="16" y="36" width="88" height="44" rx="7" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><rect x="78" y="24" width="16" height="14" rx="3" fill="#fff" stroke="'+CAT_ART_INK+'" stroke-width="2.5"/><circle cx="34" cy="86" r="9" fill="#fff" stroke="'+CAT_ART_INK+'" stroke-width="3"/><circle cx="86" cy="86" r="9" fill="#fff" stroke="'+CAT_ART_INK+'" stroke-width="3"/><line x1="30" y1="52" x2="70" y2="52" stroke="'+CAT_ART_INK+'" stroke-width="2" stroke-linecap="round"/><line x1="30" y1="62" x2="70" y2="62" stroke="'+CAT_ART_INK+'" stroke-width="2" stroke-linecap="round"/>',
  hometheatre: '<rect x="16" y="40" width="88" height="18" rx="9" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><circle cx="34" cy="49" r="3" fill="'+CAT_ART_INK+'"/><circle cx="50" cy="49" r="3" fill="'+CAT_ART_INK+'"/><circle cx="66" cy="49" r="3" fill="'+CAT_ART_INK+'"/><circle cx="82" cy="49" r="3" fill="'+CAT_ART_INK+'"/><rect x="44" y="70" width="32" height="32" rx="6" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="2.5"/><circle cx="60" cy="86" r="9" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2.2"/>',
  iron: '<path d="M28 96 Q22 60 52 46 L86 46 Q94 46 94 58 L94 84 Q94 96 82 96 Z" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><path d="M52 46 Q46 30 64 26" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="3" stroke-linecap="round"/><circle cx="70" cy="64" r="3" fill="'+CAT_ART_INK+'"/>',
  kettle: '<path d="M34 54 Q34 96 60 96 Q86 96 86 54 Z" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><path d="M86 60 Q104 60 100 44" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="3" stroke-linecap="round"/><path d="M40 54 Q60 44 80 54" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2.5"/><circle cx="60" cy="42" r="6" fill="#fff" stroke="'+CAT_ART_INK+'" stroke-width="2.5"/><path d="M42 96 Q60 106 78 96" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2.5" stroke-linecap="round"/>',
  microwave: '<rect x="16" y="34" width="88" height="56" rx="9" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><rect x="26" y="44" width="52" height="36" rx="4" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2.5"/><circle cx="52" cy="62" r="10" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2"/><circle cx="52" cy="62" r="2.2" fill="'+CAT_ART_INK+'"/><circle cx="90" cy="50" r="5" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2.2"/><circle cx="90" cy="66" r="5" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2.2"/>',
  oven: '<rect x="24" y="18" width="72" height="88" rx="8" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><rect x="34" y="32" width="52" height="34" rx="4" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2.5"/><circle cx="40" cy="80" r="4.5" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2"/><circle cx="56" cy="80" r="4.5" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2"/><circle cx="72" cy="80" r="4.5" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2"/><circle cx="88" cy="80" r="4.5" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2"/>',
  fridge: '<rect x="32" y="10" width="56" height="100" rx="8" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><line x1="32" y1="38" x2="88" y2="38" stroke="'+CAT_ART_INK+'" stroke-width="2.5"/><line x1="78" y1="18" x2="78" y2="30" stroke="'+CAT_ART_INK+'" stroke-width="3" stroke-linecap="round"/><line x1="78" y1="46" x2="78" y2="66" stroke="'+CAT_ART_INK+'" stroke-width="3" stroke-linecap="round"/>',
  stabilizer: '<rect x="26" y="24" width="68" height="72" rx="9" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><circle cx="60" cy="58" r="18" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2.5"/><line x1="60" y1="58" x2="60" y2="44" stroke="'+CAT_ART_INK+'" stroke-width="2.2" stroke-linecap="round"/><circle cx="60" cy="82" r="3" fill="'+CAT_ART_INK+'"/>',
  tv: '<rect x="14" y="22" width="92" height="58" rx="6" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><rect x="38" y="34" width="44" height="34" rx="2" fill="'+CAT_ART_INK+'" fill-opacity=".12"/><path d="M46 88 L60 80 L74 88 Z" fill="#fff" stroke="'+CAT_ART_INK+'" stroke-width="2.5"/><line x1="40" y1="96" x2="80" y2="96" stroke="'+CAT_ART_INK+'" stroke-width="3" stroke-linecap="round"/>',
  washer: '<rect x="20" y="14" width="80" height="92" rx="9" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><rect x="32" y="22" width="14" height="7" rx="2" fill="'+CAT_ART_INK+'" fill-opacity=".5"/><circle cx="60" cy="64" r="28" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="3"/><circle cx="60" cy="64" r="18" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2" stroke-dasharray="3 5"/>',
  waterdispenser: '<path d="M46 14 Q60 6 74 14 L78 46 Q78 54 60 54 Q42 54 42 46 Z" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><rect x="34" y="54" width="52" height="52" rx="8" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><rect x="46" y="70" width="10" height="8" rx="2" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2"/><rect x="64" y="70" width="10" height="8" rx="2" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="2"/><line x1="60" y1="86" x2="60" y2="98" stroke="'+CAT_ART_INK+'" stroke-width="2.5" stroke-linecap="round"/>',
  generic: '<rect x="24" y="30" width="72" height="66" rx="9" fill="#fff" fill-opacity=".85" stroke="'+CAT_ART_INK+'" stroke-width="3"/><path d="M24 46 60 30 96 46" fill="none" stroke="'+CAT_ART_INK+'" stroke-width="3" stroke-linejoin="round"/><line x1="60" y1="46" x2="60" y2="96" stroke="'+CAT_ART_INK+'" stroke-width="2.2"/>'
};
const CAT_RULES = [
  ["air fryer","airfryer","clay"], ["airfryer","airfryer","clay"],
  ["air condition","ac","slate"], [" ac","ac","slate"], ["a/c","ac","slate"],
  ["fridge","fridge","green"], ["refriger","fridge","green"],
  ["freez","freezer","green"],
  ["wash","washer","navy"],
  ["generat","generator","clay"],
  ["blend","blender","teal"], ["mixer","blender","teal"],
  ["fan","fan","sky"],
  ["home theatre","hometheatre","navy"], ["home theater","hometheatre","navy"], ["speaker","hometheatre","navy"], ["sound","hometheatre","navy"],
  ["iron","iron","amber"],
  ["kettle","kettle","amber"],
  ["microwav","microwave","amber"],
  ["oven","oven","clay"],
  ["cooker","cooker","clay"], ["stove","cooker","clay"], ["gas","cooker","clay"],
  ["stabiliz","stabilizer","slate"], ["avr","stabilizer","slate"],
  ["extension","extension","sky"], ["socket","extension","sky"],
  ["television","tv","navy"], ["tv","tv","navy"],
  ["water disp","waterdispenser","sky"], ["dispenser","waterdispenser","sky"]
];
const CAT_TINTS = ["amber","green","teal","navy","slate","clay","sky"];
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
function categoryArtHtml(cat) {
  const c = String(cat || "").toLowerCase().trim();
  let icon = "generic", tint = CAT_TINTS[hashStr(c) % CAT_TINTS.length];
  for (const [kw, ic, tn] of CAT_RULES) { if (c.includes(kw)) { icon = ic; tint = tn; break; } }
  const paths = CAT_ICONS[icon] || CAT_ICONS.generic;
  return { tint, art: `<div class="art"><svg viewBox="0 0 120 120" fill="none">${paths}</svg></div>` };
}

function cardHtml(p) {
  const modelLine = p.model
    ? `<div class="pmodel">Model <b>${escapeHtml(p.model)}</b></div>`
    : "";
  const { tint, art } = categoryArtHtml(p.cat);
  const img = p.image
    ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.style.display='none'"/>`
    : "";
  return `<article class="card">
    <div class="thumb ${tint}">${art}${img}<div class="scrim"></div><span class="cat-tag">${escapeHtml(p.cat)}</span></div>
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

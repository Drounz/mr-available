# MR AVAILABLE — project brief

A storefront for MR AVAILABLE, a home appliances and electronics store in Nigeria. Customers browse products, build a bundle, and place the order in one tap on WhatsApp. There is no on-site checkout or payment.

## Stack (keep it simple)
- One file: `index.html`. Plain HTML, CSS, and vanilla JS. No build step, no framework, no bundler.
- Fonts: Poppins via Google Fonts. Icons are inline SVG.
- Database: Firebase Firestore. The site reads products directly from the browser using the Firebase compat SDK (loaded from gstatic in the head). No backend server.
- Hosting: static, deploys to Vercel/Netlify/Cloudflare Pages as-is.
- The site does NOT depend on Google Sheets or Supabase. Older sheet/Supabase code is deprecated, do not reintroduce it.

## How data flows
On load, `loadProducts()` initializes Firebase from `CONFIG.firebase`, then reads `products` where `published == true` and maps rows to `{id,name,model,cat,brand,image,price}`. If Firebase is unreachable or config is blank, it falls back to the built-in `FALLBACK` array so the page still renders. Keep this fallback behavior.

## Config (top of the `<script>` block)
```js
const CONFIG = {
  whatsapp: "2348119610718",
  firebase: { apiKey:"", authDomain:"", projectId:"", storageBucket:"", messagingSenderId:"", appId:"" }
};
```
Firebase web config values are safe to expose; access is controlled by Firestore rules.

## Database (Firestore)
Collection `products`, one doc per product (doc id = product id). Public fields only:
`name`, `model`, `category`, `brand`, `selling_price` (number), `image_url`, `published` (bool).
Cost price is NOT stored here (Firestore rules are per-document, so a public collection cannot hide a single field). Keep cost data out of this collection.
Rules (`fb/firestore.rules`): public may READ published products, no client WRITES. Edits happen in the Firebase console or via `fb/seed/seed.js` (admin SDK). Seed with `fb/seed/products.json`.

## Design system (keep consistent, inspired by the 3legant look: clean, white, airy)
Colors:
- `--ink:#14213A` (text and primary/dark buttons)
- `--paper:#FFFFFF` (page), `--soft:#F4F5F7` (tiles/sections), `--line:#E6E9EE`
- `--muted:#6C7480`
- `--accent:#E79213` (amber, the pop accent: badges, small labels, active state)
- `--price:#0E7C5A` (emerald, prices only)
- `--wa:#25D366` (WhatsApp buttons only)

Style rules:
- Bold Poppins display headings with tight tracking. The hero headline uses a light `/` and an amber `.` accent.
- Soft rounded grey image tiles on product cards. Section headers have a title left and a link right.
- Prices in emerald. All order actions go to WhatsApp (green). Primary buttons are ink.
- Currency is Naira: `"₦" + n.toLocaleString("en-NG")`.

## Core behaviors to preserve
- Category grid (auto-built with per-category counts), search, and category chips all filter the same grid.
- Bundle is held in memory (`state.bundle`); do not use localStorage.
- Every product card has Add to bundle and a direct WhatsApp buy. The bundle drawer builds one WhatsApp message listing items, model numbers, and total.
- Model number shows on the card when present.

## Roadmap (not built yet)
- Persona bundle view: First Nest, Bachelor Pad, Her Space, New Home, Shortlet Host, each with Essential / Signature / Bespoke tiers.
- Real product photos via `image_url`.
- A nicer custom admin page on top of Supabase (later), possibly customer accounts and saved orders.

## Don'ts
- Do not invent business claims (no "free shipping", "Stripe payments", "30 days money-back") unless the owner confirms them.
- Do not add a checkout or payment step. Ordering is WhatsApp only.
- Do not use em dashes in any user-facing copy.
- Keep it a single static file unless explicitly asked to scaffold a larger app.

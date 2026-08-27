# MR AVAILABLE — project brief

A storefront for MR AVAILABLE, a home appliances and electronics store in Nigeria. Customers browse products, build a bundle, and place the order in one tap on WhatsApp. There is no on-site checkout or payment.

## Stack (keep it simple)
- Storefront: one file, `index.html`. Plain HTML, CSS, and vanilla JS. No build step, no framework, no bundler.
- `admin.html` is a second, unlisted file for photo uploads (see below) — the one deliberate exception to "single file."
- Fonts: Poppins via Google Fonts. Icons are inline SVG.
- Database and storage: Supabase (Postgres + Storage). The site reads products directly from the browser using `@supabase/supabase-js` (loaded from a CDN in the head). No backend server.
- Hosting: static, deploys to Vercel/Netlify/Cloudflare Pages as-is.
- The site does NOT depend on Firebase or Google Sheets. Older Firebase code is deprecated, do not reintroduce it (Firebase Storage forces the paid Blaze plan just to enable it at all — Supabase's free tier does not).

## How data flows
On load, `loadProducts()` creates a Supabase client from `CONFIG.supabase`, then reads the `products` table where `published = true` and maps rows to `{id,name,model,cat,brand,image,price}`. If Supabase is unreachable or config is blank, it falls back to the built-in `FALLBACK` array so the page still renders. Keep this fallback behavior.

## Config (top of the `<script>` block)
```js
const CONFIG = {
  whatsapp: "2348119610718",
  supabase: { url: "", anonKey: "" }
};
```
Supabase URL and anon key are safe to expose; access is controlled by Row Level Security policies, not by hiding the config.

## Database (Supabase Postgres)
Table `products`, one row per product (`id` = product code, primary key). Public columns only:
`name`, `model`, `category`, `brand`, `selling_price` (numeric), `image_url`, `published` (boolean).
Cost price is NOT stored here — keep cost and margin records in a separate, non-public sheet.
Policies (`supabase/schema.sql`): public may SELECT published products, and may UPDATE only the `image_url` column of an existing row (via `admin.html`'s photo uploader — no login by deliberate choice, so this is enforced at the database layer: no other column, no insert, no delete, is possible from the browser). Bulk edits happen in the Supabase dashboard's Table Editor or via `supabase/seed/seed.js` (service-role key, bypasses RLS). Seed with `supabase/seed/products.json`.

## Photo uploads (`admin.html`)
A second static file, not linked from the storefront, for the owner to drop in product photos. Naming convention: the image filename (without extension) must equal the product's ID, e.g. `TV001.jpg`. It uploads to the `products` Storage bucket and writes the resulting public URL into that product's `image_url` — no manual Firestore/Postgres editing needed. No login; the write surface is instead locked down by `supabase/schema.sql`'s policies and the bucket's file-size/MIME-type limits. Keep the admin.html URL private.

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
- Customer accounts and saved orders.

## Don'ts
- Do not invent business claims (no "free shipping", "Stripe payments", "30 days money-back") unless the owner confirms them.
- Do not add a checkout or payment step. Ordering is WhatsApp only.
- Do not use em dashes in any user-facing copy.
- Keep the storefront a single static file (`index.html`) unless explicitly asked to scaffold a larger app; `admin.html` is the one standing exception.

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
On load, `loadProducts()` creates a Supabase client from `CONFIG.supabase`, then reads the `products` table where `published = true` and maps rows to `{id,name,model,cat,brand,image,images,price,description,personas}`. `images` is the ordered gallery array; `image` is `images[0]` (or `image_url` for any row not yet migrated to the array). If Supabase is unreachable or config is blank, it falls back to the built-in `FALLBACK` array so the page still renders. Keep this fallback behavior.

## Routing (no server, single file)
The page has three views toggled by a URL query param, read client-side after `loadProducts()` resolves — no server routing needed on static hosting:
- default (`/`): the catalogue (`#catalogueView`)
- `?p=<PRODUCT_ID>`: the product detail page (`#detailView`) — shareable link, works on direct load
- `?persona=<slug>`: a persona collection view (`#personaView`)

Navigation uses `history.pushState` (see `goTo()`); `popstate` re-runs `route()` so back/forward work. Card thumbnails and product names link to `?p=<id>`; persona tiles link to `?persona=<slug>`.

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
`name`, `model`, `category`, `brand`, `selling_price` (numeric), `image_url`, `images` (text array), `description` (text, short spec line), `personas` (text array, which "shop by what you need" collections this product belongs to), `published` (boolean).
Cost price is NOT stored here — keep cost and margin records in a separate, non-public sheet.
Policies (`supabase/schema.sql`): public may SELECT every product (including unpublished, so admin.html's picker can find them) and UPDATE only the `images`/`image_url`/`description` columns of an existing row — no other column, no insert, no delete, is possible from the browser. No login gates this by deliberate choice; the column grant and the absence of any insert/delete policy are what keep a stray link from doing real damage. `personas` is loaded in bulk (seed script or Table Editor), not edited per-product in admin.html. Bulk edits happen in the Supabase dashboard's Table Editor or via `supabase/seed/seed.js` (service-role key, bypasses RLS). Seed with `supabase/seed/products.json`.

## Persona collections ("Shop by what you need")
Five fixed personas defined in `index.html` (`PERSONAS` array): First Nest, Bachelor Pad, Her Space, New Home, Shortlet Host. Homepage tiles link to `?persona=<slug>`; that view filters `PRODUCTS` by `p.personas.includes(slug)` and offers a "Send this set on WhatsApp" button that builds one bundle message. A persona with no tagged products shows an honest empty state rather than nothing or fake items — only tag products that are actually stocked and priced.

## Photo uploads (`admin.html`)
A second static file, not linked from the storefront, for the owner to manage product photos. No login (deliberate choice — see Database policies above). Pick a product from the searchable list, then drop in one or more images — any filename works, since photos are stored per product folder: `products/<PRODUCT_ID>/<anything>.jpg` in the `products` Storage bucket. After each upload, the page lists that folder, rebuilds the public URLs, and saves the ordered array into that product's `images` column (`images[0]` is the card/primary photo). Delete and reorder (‹ ›) buttons on each thumbnail update both Storage and the database. Keep the admin.html URL private regardless — signing in isn't the gate here, but there is no reason to advertise the page.

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
- Essential / Signature / Bespoke tiers within each persona collection (currently one flat list per persona).
- Customer accounts and saved orders.

## Don'ts
- Do not invent business claims (no "free shipping", "Stripe payments", "30 days money-back", specific warranty terms) unless the owner confirms them.
- Do not add a checkout or payment step, installments, pay-small-small, weekly/monthly plans, plan calculators, or customer accounts. Ordering is outright and WhatsApp only, every time.
- Do not use em dashes in any user-facing copy.
- Keep the storefront a single static file (`index.html`) unless explicitly asked to scaffold a larger app; `admin.html` is the one standing exception.

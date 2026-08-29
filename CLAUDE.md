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
On load, `loadProducts()` and `loadPersonas()` run in parallel, both via a shared `sbClient()` helper that builds one Supabase client from `CONFIG.supabase` (returns `null`, never throws, if the config is blank or the client library failed to load — see below). `loadProducts()` reads the `products` table where `published = true` and maps rows to `{id,name,model,cat,brand,image,images,price,description,personas}`. `images` is the ordered gallery array; `image` is `images[0]` (or `image_url` for any row not yet migrated to the array). If Supabase is unreachable or config is blank, it falls back to the built-in `FALLBACK` array so the page still renders. Keep this fallback behavior. `loadPersonas()` reads the `personas` table (all rows, ordered by `sort_order`) and maps rows to `{key,title,eyebrow,about,heroImageUrl,sortOrder}`; on any failure it returns `[]` rather than inventing placeholder collections — the "Shop by what you need" section just hides itself when there's nothing to show (see Persona collections below).

## Routing (no server, single file)
Two "base" pages are toggled by a URL query param, read client-side after `loadProducts()` resolves — no server routing needed on static hosting:
- default (`/`): the catalogue (`#catalogueView`)
- `?persona=<slug>`: a persona collection view (`#personaView`)

A product page is not a third base page — it's a slide-over panel (`#productPanel` + `#panelBackdrop`) that overlays whichever base page is showing, toggled purely by `?p=<PRODUCT_ID>` on top of the current URL (e.g. `?persona=bachelor-pad&p=TV001`). Opening or closing it never re-renders or scrolls the base page underneath, so scroll position is preserved exactly.

Navigation uses `history.pushState` (see `goTo()`, `goToProduct()`); `popstate` re-runs `route()`, which only switches/re-renders the base page when the base actually changes (comparing against `baseKey`) and independently shows/hides the panel based on `?p=`. A shared `?p=` link works on direct load: the bootstrap script splits it into two history entries (a bare base entry, then the full `?p=` entry) so the panel's close button and the browser Back button — both just call `history.back()` — always land back on-site instead of leaving it. Card thumbnails and product names call `goToProduct()`; persona tiles link to `?persona=<slug>`.

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
Policies (`supabase/schema.sql`): public may SELECT every product (including unpublished, so admin.html's picker can find them) and UPDATE only the `images`/`image_url`/`description`/`selling_price`/`published` columns of an existing row — name, category, brand, model, personas, and the id stay out of reach from the browser, and no insert or delete is possible at all. No login gates this by deliberate choice; the column grant and the absence of any insert/delete policy are what keep a stray link from doing real damage. Because `selling_price` and `published` are in that grant, admin.html's price field and publish toggle work with no sign-in — which also means anyone who gets the admin.html link can change a price or flip a product's visibility, so keep that link private. `personas` is loaded in bulk (seed script or Table Editor), not edited per-product in admin.html. Bulk edits happen in the Supabase dashboard's Table Editor or via `supabase/seed/seed.js` (service-role key, bypasses RLS). Seed with `supabase/seed/products.json`.

Table `personas`, one row per "shop by what you need" collection (`key` = slug, primary key): `title`, `eyebrow`, `about`, `hero_image_url`, `sort_order`. This is owner-managed content — the app only ever reads and writes these columns, it never hardcodes persona copy anywhere in `index.html` or `admin.html`. Policies: public may SELECT every row and UPDATE `title`/`eyebrow`/`about`/`hero_image_url` — no login, same as `products` (deliberate choice). `key` and `sort_order` stay out of reach from the browser. No insert/delete from the browser either way; rows are seeded/added via the dashboard or `service-role` key.

## Persona collections ("Shop by what you need")
Persona rows are loaded at runtime by `loadPersonas()` into `PERSONAS` (sorted by `sort_order`) — never hardcoded in `index.html`. If the table is empty or unreachable, `PERSONAS` is `[]` and the whole "Shop by what you need" section (`#personas`) hides itself rather than showing fabricated tiles. Homepage tiles link to `?persona=<key>`; `renderPersonaView(key)` filters `PRODUCTS` by `p.personas.includes(key)`, renders a hero banner (`#personaHero`) with `eyebrow`/`title` overlaid on `hero_image_url`, an "About this collection" block showing `about` (hidden entirely when blank — never a placeholder), the product grid, and a "Send this set on WhatsApp" button that builds one bundle message. If `hero_image_url` is empty, or the image fails to load (`onerror` → `personaHeroImgError`), the hero falls back to a solid `--ink` band with the same eyebrow/title text — never a broken-image icon. A persona with no tagged products shows an honest empty state rather than nothing or fake items — only tag products that are actually stocked and priced. Opening a product from a persona page uses the same slide-over panel as the catalogue (see Routing above); it does not leave the persona page or reset its scroll position.

## Photo uploads and page images (`admin.html`)
A second static file, not linked from the storefront, for the owner to manage product photos, price, publish status, and (further down the page) each persona's hero image and copy. No login anywhere on this page — deliberate choice, the owner does not want a sign-in step. The column grants in `supabase/schema.sql` are what actually keep a stray link from doing real damage (see Database above); URL secrecy is the only other line of defense, so keep the admin.html link private.
- **Product photos/description/price/published**. Pick a product from the searchable list, then drop in one or more images — any filename works, since photos are stored per product folder: `products/<PRODUCT_ID>/<anything>.jpg` in the `products` Storage bucket. After each upload, the page lists that folder, rebuilds the public URLs, and saves the ordered array into that product's `images` column (`images[0]` is the card/primary photo). Delete and reorder (‹ ›) buttons on each thumbnail update both Storage and the database. A price field (`#priceInput` + Save) writes `selling_price`, and a switch (`#publishedToggle`) writes `published` immediately on change; the toggle refuses to turn a product on while its price is 0/blank, since the storefront hides zero-priced products anyway (`loadProducts()` filters `price>0` client-side on top of the `published=true` server-side filter).
- **Page images** (`#pageImagesCard`) — lists every row from `personas` (not hardcoded to five, so adding a row later — even something unrelated to a persona, like a future homepage hero — just appears here) with a hero-image preview, an Upload/Replace control, and editable eyebrow/title/about fields with Save. Uploads go to the `site` Storage bucket at `personas/<key>.<ext>` (stable path — re-uploading replaces it) and the resulting public URL is written to that row's `hero_image_url`.

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

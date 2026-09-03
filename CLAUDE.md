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
Policies (`supabase/schema.sql`): public may SELECT every product (including unpublished, so admin.html's picker can find them) and UPDATE the `images`/`image_url`/`description`/`selling_price`/`published`/`name` columns of an existing row — category, brand, model, personas, and the id can only be set once, at creation (see below), never changed afterward from the browser. Public may also INSERT a new row, but only into the `id`/`name`/`category`/`brand`/`model` columns — `selling_price` defaults to 0 and `published` defaults to `false`, so a newly created product is never live until it's priced and published through the normal admin.html flow. No delete is possible at all, from any role. No login gates any of this by deliberate choice; the column grants and the absence of any delete policy are what keep a stray link from doing real damage. Because `selling_price`, `published`, and `name` are in the update grant, and creation is allowed outright, admin.html's price field, publish toggle, name field, and "Add a product" form all work with no sign-in — which also means anyone who gets the admin.html link can change a price, rename or create a product, or flip its visibility, so keep that link private. `personas` (the array column) is loaded in bulk (seed script or Table Editor), not edited per-product in admin.html. Bulk edits happen in the Supabase dashboard's Table Editor or via `supabase/seed/seed.js` (service-role key, bypasses RLS). Seed with `supabase/seed/products.json`.

Table `personas`, one row per "shop by what you need" collection (`key` = slug, primary key): `title`, `eyebrow`, `about`, `hero_image_url`, `sort_order`. This is owner-managed content — the app only ever reads and writes these columns, it never hardcodes persona copy anywhere in `index.html` or `admin.html`. Policies: public may SELECT every row and UPDATE `title`/`eyebrow`/`about`/`hero_image_url` — no login, same as `products` (deliberate choice). `key` and `sort_order` stay out of reach from the browser. No insert/delete from the browser either way; rows are seeded/added via the dashboard or `service-role` key.

## Persona collections ("Shop by what you need")
Persona rows are loaded at runtime by `loadPersonas()` into `PERSONAS` (sorted by `sort_order`), excluding the reserved `home-hero` key (see Homepage hero below) — never hardcoded in `index.html`. If the table has no other rows or is unreachable, `PERSONAS` is `[]` and the whole "Shop by what you need" section (`#personas`) hides itself rather than showing fabricated tiles. It sits below the product grid on the homepage, not above it — a deliberate choice to keep the top of the page calm. Homepage tiles link to `?persona=<key>`; `renderPersonaView(key)` filters `PRODUCTS` by `p.personas.includes(key)`, renders a hero banner (`#personaHero`) with `eyebrow`/`title` overlaid on `hero_image_url`, an "About this collection" block showing `about` (hidden entirely when blank — never a placeholder), the product grid, and a "Send this set on WhatsApp" button that builds one bundle message. If `hero_image_url` is empty, or the image fails to load (`onerror` → `personaHeroImgError`), the hero falls back to a solid `--ink` band with the same eyebrow/title text — never a broken-image icon. A persona with no tagged products shows an honest empty state rather than nothing or fake items — only tag products that are actually stocked and priced. Opening a product from a persona page uses the same slide-over panel as the catalogue (see Routing above); it does not leave the persona page or reset its scroll position.

## Homepage hero (admin-managed photo)
The homepage hero photo lives in the same `personas` table, at a reserved row `key = 'home-hero'` (seeded blank by `supabase/schema.sql`, `sort_order = -1`) — reusing the persona-hero pattern rather than a separate table. Only `hero_image_url` is real content on that row; `title`/`eyebrow`/`about` are unused there because the headline ("Everything for the home.") and supporting line ("Real stock, fair prices, ordered on WhatsApp.") are fixed site copy, not owner-editable text — only the photo is swappable. The bootstrap in `index.html` pulls this one row out of the `loadPersonas()` result before building `PERSONAS`, so it never appears as a shoppable tile or `?persona=` collection. `renderHomeHero()` inserts the image + gradient scrim into `#homeHero` when `hero_image_url` is set; otherwise (or if the image 404s, via `onerror` → `homeHeroImgError`) it falls back to a solid `--ink` band behind the same headline — never a broken image. Managed from `admin.html`'s "Page images" section alongside the personas, labeled "Homepage hero" there; uploads go to `site/home-hero.<ext>` (bucket root, not under `personas/`, since it isn't one).

## Photo uploads and page images (`admin.html`)
A second static file, not linked from the storefront, for the owner to manage product photos, name, description, price, publish status, new products, and (further down the page) each persona's hero image and copy. No login anywhere on this page — deliberate choice, the owner does not want a sign-in step. The column grants in `supabase/schema.sql` are what actually keep a stray link from doing real damage (see Database above); URL secrecy is the only other line of defense, so keep the admin.html link private.
- **Add a product**. A small form (`#addId`/`#addName`/`#addCategory`/`#addBrand`/`#addModel`) inserts a new row via `createProduct()` — client-side checks the id isn't already loaded before attempting the insert (a friendly message instead of a raw DB error for the common case), and the DB's own unique-constraint violation is still handled gracefully if it happens anyway (e.g. a stale local list). A new product starts unpublished at ₦0 with no photos; on success the form clears and the new product is auto-selected below so the owner can immediately finish setting it up. `#addCategory` suggests existing categories via a `<datalist>` (`renderCategoryOptions()`) but accepts free text, since categories are just whatever distinct values exist in the data, not a fixed enum. This is a deliberate, explicit creation path — different from the still-true rule that an *uploaded photo* never creates a product on its own (`uploadFiles()` hard-requires an existing, already-loaded product).
- **Product photos/name/description/price/published**. Pick a product from the searchable list, then drop in one or more images — any filename works, since photos are stored per product folder: `products/<PRODUCT_ID>/<anything>.jpg` in the `products` Storage bucket. After each upload, the page lists that folder, rebuilds the public URLs, and saves the ordered array into that product's `images` column (`images[0]` is the card/primary photo). Delete and reorder (‹ ›) buttons on each thumbnail update both Storage and the database. A name field (`#nameInput` + Save) writes `name`. A price field (`#priceInput` + Save) writes `selling_price`, and a switch (`#publishedToggle`) writes `published` immediately on change; the toggle refuses to turn a product on while its price is 0/blank, since the storefront hides zero-priced products anyway (`loadProducts()` filters `price>0` client-side on top of the `published=true` server-side filter).
- **Page images** (`#pageImagesCard`) — lists every row from `personas` (not hardcoded to five, so adding a row later just appears here) with a hero-image preview, an Upload/Replace control, and editable eyebrow/title/about fields with Save. Uploads go to the `site` Storage bucket, at `personas/<key>.<ext>` for a real persona or `home-hero.<ext>` (bucket root) for the `home-hero` row — either way a stable path, so re-uploading replaces it — and the resulting public URL is written to that row's `hero_image_url`.

## Design system (keep consistent, inspired by the 3legant look: clean, white, airy)
Colors:
- `--ink:#14213A` (text and primary/dark buttons)
- `--paper:#FFFFFF` (page), `--soft:#F4F5F7` (tiles/sections), `--line:#E6E9EE`
- `--muted:#6C7480`
- `--accent:#E79213` (amber, the pop accent: badges, small labels, active state)
- `--price:#0E7C5A` (emerald, prices only)
- `--wa:#25D366` (WhatsApp buttons only)

Style rules:
- Bold Poppins display headings with tight tracking. Headings end on an amber `.` accent (e.g. the homepage headline, the logo).
- Soft rounded grey image tiles on product cards. Section headers have a title left and a link right.
- Prices in emerald. All order actions go to WhatsApp (green). Primary buttons are ink.
- Currency is Naira: `"₦" + n.toLocaleString("en-NG")`.

## Core behaviors to preserve
- The homepage has no category tile grid — category filtering is the single row of pills (`#chips`, built by `renderChips()`) directly above the product grid, alongside search. Both filter the same grid.
- Bundle is held in memory (`state.bundle`); do not use localStorage.
- Every product card has Add to bundle and a direct WhatsApp buy. The bundle drawer builds one WhatsApp message listing items, model numbers, and total.
- Model number shows on the card when present.

## Security posture
No login exists anywhere on this site by repeated, deliberate owner choice — the real access control is Row Level Security column grants (see Database above), not admin.html's URL. That has one hard consequence worth remembering: anyone with the public anon key (visible in every page's source, not just admin.html's) can call the Supabase REST API directly and write anything RLS's column grants allow, whether or not they've ever seen admin.html. URL secrecy only hides the convenience UI, not the underlying write access. Given that, the defenses actually in place are:
- **RLS column grants** — the hard boundary. Only specific columns are writable at all (see Database above); `products` also allows creating a new row through a narrow column list (`id`/`name`/`category`/`brand`/`model`, with `selling_price`/`published` forced to their safe defaults). `sort_order` on `personas` is never reachable from the browser, and there is no delete policy on either table under any role.
- **DB-level CHECK constraints** (`supabase/schema.sql`) — `selling_price >= 0`, and generous length caps on every anon-writable text field (`id`, `name`, `category`, `brand`, `model`, `description`, `title`, `eyebrow`, `about`, `image_url`, `hero_image_url`) and on `images` array length. These exist to stop a stray or malicious direct API write from leaving garbage (a negative price, megabytes of text) that no normal UI interaction would ever produce — not to restrict legitimate content, so keep the limits generous when touching them.
- **Consistent output escaping** — every DB-sourced string rendered into `innerHTML` goes through `escapeHtml()`; every DB-sourced id/key embedded inside an inline event handler's JS string (e.g. `onclick="add('${pid}')"`) is quote-escaped first, even columns not currently anon-writable (defense in depth, since a future column-grant change is one PR away from making today's safe assumption wrong). When adding any new field that gets rendered, follow this pattern — don't assume a field is "safe" because the current UI doesn't let anyone type garbage into it.
- **`vercel.json` security headers** — a Content-Security-Policy scoped to the exact external hosts this site actually uses (`cdn.jsdelivr.net` for supabase-js, the project's own `*.supabase.co` for data/images, Google Fonts, `ipapi.co` for analytics geolocation), plus `frame-ancestors 'none'`/`X-Frame-Options: DENY` (clickjacking), `X-Content-Type-Options: nosniff`, and a restrictive `Permissions-Policy`. The CSP allows `'unsafe-inline'` for script/style because the site is intentionally one inline `<script>`/`<style>` block with no build step — this is a real trade-off, not an oversight; it still blocks loading resources from or connecting to any domain not on the allowlist, which is what stops a stored-XSS payload from exfiltrating data or pulling in a remote script. **If the Supabase project URL ever changes, update it in `vercel.json`'s CSP too, not just `CONFIG.supabase.url` in both HTML files** — three places, not two.
- What this does NOT protect against: a determined attacker who extracts the anon key and calls the API directly can still tamper with any anon-writable column (price, publish status, images, persona copy) within the CHECK constraints' bounds. There is no rate limiting. The owner has chosen this trade-off explicitly over adding any sign-in step; if that changes, revisit this section.

## Analytics (page views and product clicks)
`logEvent(type, extra)` in `index.html` writes anonymous rows to the `analytics_events` table (`supabase/schema.sql`) — no cookies, no visitor id, nothing linking one visit to the next. Two call sites: `route()` logs `"page_view"` whenever the base page actually changes (catalogue ↔ a persona collection — not on every panel open/close), and `openPanelUI(id)` logs `"product_click"` with that product's id whenever its slide-over panel opens, from anywhere (catalogue, a persona page, or a direct shared link). `country`/`city` come from a one-time, best-effort client-side lookup (`loadGeo()`, fired at bootstrap without being awaited, via `ipapi.co` — a free third-party IP-geolocation API, no key required); if it fails or hasn't resolved yet, the event still logs with those fields `null`. `logEvent()` itself never awaits or blocks on anything and swallows its own errors — a slow or unreachable analytics write (or geo lookup) must never affect the storefront.

This table is insert-only from the browser — unlike `products`/`personas`, there is deliberately no public SELECT policy on it (see Security posture above: traffic/behavior data is more sensitive than the product catalog, and the anon key is effectively public). **The owner views results in the Supabase dashboard directly** (Table Editor, or the `analytics_summary` / `analytics_top_products` / `analytics_by_country` views in `supabase/schema.sql`), using their own pre-existing Supabase login — this is not a new sign-in step added to `admin.html` or the site.

## Roadmap (not built yet)
- Essential / Signature / Bespoke tiers within each persona collection (currently one flat list per persona).
- Customer accounts and saved orders.

## Don'ts
- Do not invent business claims (no "free shipping", "Stripe payments", "30 days money-back", specific warranty terms) unless the owner confirms them.
- Do not add a checkout or payment step, installments, pay-small-small, weekly/monthly plans, plan calculators, or customer accounts. Ordering is outright and WhatsApp only, every time.
- Do not use em dashes in any user-facing copy.
- Keep the storefront a single static file (`index.html`) unless explicitly asked to scaffold a larger app; `admin.html` is the one standing exception.

# MR AVAILABLE — Supabase setup

Your site reads products from Supabase (Postgres + Storage). Supabase's free tier includes the database and file storage with no card required, and scales later by switching the same project to a paid plan, no rebuild. You manage products in the Supabase dashboard's Table Editor, which is your admin.

Files (drop these into the repo):
- `index.html` — the site, already wired for Supabase.
- `admin.html` — private photo uploader (see section 4 below).
- `supabase/schema.sql` — creates the `products` and `personas` tables, the `analytics_events` table and its reporting views, their security policies, and the `products`/`site` storage buckets.
- `supabase/seed/products.json` — your 50 products.
- `supabase/seed/seed.js`, `supabase/seed/package.json` — one-time loader.

## 1. Create a Supabase project
1. At [supabase.com](https://supabase.com), create a new project (pick a region close to Nigeria, e.g. an EU region).
2. Wait for it to finish provisioning (a couple of minutes).

## 2. Run the schema
1. In the Supabase dashboard, open **SQL Editor > New query**.
2. Paste the contents of `supabase/schema.sql` and click **Run**.
   This creates the `products` table (including the `images` gallery, `description`, and `personas` columns), the `personas` table (the "shop by what you need" collections' copy and hero images, plus one reserved `home-hero` row for the homepage photo — seeded blank automatically, since only its image matters), the storage buckets for product photos and page images, and the security policies:
   - `products`: anyone can read every product and update its photos, name, category, brand, model, description, selling price, or published status, but never `personas` or its id (set once, at creation, never after), and can create a new product (id/name/category/brand/model only — it starts at ₦0 and unpublished) or delete one outright, from the browser. No login is required by deliberate choice — `admin.html` has no sign-in, so keep its URL private; that matters more now that price, publish status, every catalogue field, product creation, and product deletion are all editable from the page.
   - `personas`: anyone can read every row, and can update its title/eyebrow/about/hero image — no login here either, same choice as `products`.
   This file is safe to re-run any time it changes (e.g. after an update to this repo) — every statement is idempotent.

## 3. Load your 50 products
1. Dashboard: **Project settings > API**. Copy the **service_role** key (this bypasses Row Level Security — never put it in `index.html` or `admin.html`, and never commit it).
2. In a terminal: `export SUPABASE_URL="https://xxxx.supabase.co"` and `export SUPABASE_SERVICE_ROLE_KEY="..."` (paste your own values).
3. In `supabase/seed`: run `npm install`, then `node seed.js`.
4. You should see "Seeded 50 products into Supabase." Check **Table Editor > products** to see them. This screen is now where you add, edit, price, and hide products.

## 4. Connect the site and turn on photo uploads
1. Dashboard: **Project settings > API**. Copy the **Project URL** and the **anon public** key (not the service_role key — this one is safe to expose).
2. In both `index.html` and `admin.html`, paste them into `CONFIG.supabase` (`url` and `anonKey`).
3. `admin.html` is part of the deployed site (e.g. `yoursite.com/admin.html`) but not linked from the storefront and has no login anywhere on the page — keep the link to yourself. The main section is a scrollable list of every product, each row showing a thumbnail, name, brand/price, and a status tag (Set price / No photo / Hidden / Live) so you can see at a glance what needs attention; a search box and filter chips (All/Live/Hidden/No photo) sit above it. A "+ Add product" button reveals a small form (ID, name, category, brand, optional model) — it starts unpublished at ₦0 with no photos, and its editor opens immediately on creation so you can finish setting it up right away. Tap any row to open that product's editor: drop in one or more photos — any filename works, since photos live in a folder per product (`products/<PRODUCT_ID>/...` in Storage) rather than needing to match the ID themselves. The first photo (marked "Cover") is the card image; add more for a gallery. Delete and reorder buttons appear on each thumbnail. Name, category, brand, model, and description fields (fix a typo or rename any of them, any time) plus a price field save together with one "Save details" button. A Published switch flips the product live or hidden — it won't turn on while the price is still ₦0, since a zero-priced product never shows on the storefront anyway. A "Delete product" button removes the product and its photos permanently, after a confirmation prompt — there's no undo, so use it deliberately.
4. Further down the same page, **Page images** lists every row from the `personas` table with an image preview, an Upload / Replace button, and editable Eyebrow/Title/About fields with a Save button — also no login. Uploading writes to `site/personas/<key>.<ext>` in Storage (or `site/home-hero.<ext>` for the "Homepage hero" row — that one's own headline and text are fixed in `index.html`, only its photo is managed here) and updates that row's `hero_image_url`; replacing overwrites the same file. This list grows automatically if more rows are added to `personas` later — nothing in `admin.html` is hardcoded to today's collections.

These config values are safe in a public repo. Security is enforced by Row Level Security, not by hiding the config.

## 5. Deploy
Commit and let Vercel redeploy. The site flips from sample data to your live products.

## One-time: clean up junk product rows
If your `products` table ever picked up rows keyed by an image filename instead of a real product ID (e.g. `03-lg-dualcool-front`), run `supabase/cleanup-catalogue.sql` in the SQL Editor once. It deletes anything not in the real 101-ID catalogue and restores catalogue fields (name/price/published/etc.) for the real products from the seed, without touching any `images`/`image_url` already attached. Safe to re-run.

## Everyday use (your admin)
- **Add a product**: use `admin.html`'s "+ Add product" button (see section 4) — ID, name, category, brand, optional model. Or Table Editor > products > insert row directly, using the product code as `id`; either way it starts unpublished at ₦0 until priced and published.
- **Rename a product, or fix category/brand/model**: all four fields (name, category, brand, model) are editable in that product's `admin.html` editor now, saved together with "Save details" — no more Table Editor round-trip for a typo.
- **Publish or hide a product, change its price, add photos or a description**: use `admin.html` (see section 4) — open the product's editor, then use the price field, the Published switch, the description box, and the photo dropzone. Editing `selling_price`/`published`/`description` by hand in the Table Editor works too; photos need `admin.html` (or building the public Storage URLs yourself) since it also handles Storage uploads and the `images`/`image_url` columns.
- **Delete a product**: open it in `admin.html` and use "Delete product" (confirms before removing) — it clears the product's photos from Storage and removes the row. There's no undo; deleting by hand in the Table Editor works too but won't clean up its Storage folder for you.
- **Tag a product to a persona** ("Shop by what you need" collections): not yet in `admin.html` — edit the `personas` array column on that product's row in the Table Editor (e.g. `{bachelor-pad}` or `{bachelor-pad,new-home}`). Valid keys are whatever's in the `personas` table's `key` column (seeded with `first-nest`, `bachelor-pad`, `her-space`, `new-home`, `shortlet-host`). Only tag products that are published with a real price.
- **Edit a persona's hero image or copy** (title/eyebrow/about): use `admin.html`'s "Page images" section (see section 4). Editing the `personas` table by hand in the Table Editor works too.
- **Change the homepage hero photo**: same "Page images" section, the row labeled "Homepage hero" (that's the `key = 'home-hero'` row) — upload replaces it immediately. Its title/eyebrow/about fields are unused; the homepage headline and line are fixed copy in `index.html`.

## See your site visits and product clicks
The site logs an anonymous event every time someone lands on a page or opens a product (see `analytics_events` in `supabase/schema.sql`) — no cookies, no visitor accounts, nothing that identifies a person, just a count with a rough country/city. This table is deliberately **not** readable through the public anon key (unlike `products`/`personas`) — traffic data is more sensitive than your catalogue, so you view it in the Supabase dashboard with your own login, not through `admin.html`:
- **Table Editor > analytics_summary** — total page views, total product clicks, how many countries you've seen, and the first/last event timestamps.
- **Table Editor > analytics_top_products** — every product id that's been opened, most-clicked first.
- **Table Editor > analytics_by_country** — page views grouped by country (rows with no location resolve to "Unknown" — the geolocation lookup is best-effort and occasionally misses).
- For a raw, filterable log (e.g. "show me today's events"), use **SQL Editor** and query `analytics_events` directly, e.g. `select * from analytics_events where created_at > now() - interval '1 day' order by created_at desc;`.

Location comes from a free IP-lookup service (`ipapi.co`) called from the visitor's browser — it's best-effort and never blocks or slows down the site if it fails or is rate-limited; that visit is just logged without a country/city.

## Notes
- Cost prices are intentionally NOT stored in this table — keep your cost and margin records in your central sheet. (Unlike Firestore, Postgres *can* protect single columns with different rules, so this is a choice for simplicity, not a technical limit.)
- When traffic grows, Supabase's paid plans scale the same project, no migration.

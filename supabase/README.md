# MR AVAILABLE — Supabase setup

Your site reads products from Supabase (Postgres + Storage). Supabase's free tier includes the database and file storage with no card required, and scales later by switching the same project to a paid plan, no rebuild. You manage products in the Supabase dashboard's Table Editor, which is your admin.

Files (drop these into the repo):
- `index.html` — the site, already wired for Supabase.
- `admin.html` — private photo uploader (see section 4 below).
- `supabase/schema.sql` — creates the `products` and `personas` tables, their security policies, and the `products`/`site` storage buckets.
- `supabase/seed/products.json` — your 50 products.
- `supabase/seed/seed.js`, `supabase/seed/package.json` — one-time loader.

## 1. Create a Supabase project
1. At [supabase.com](https://supabase.com), create a new project (pick a region close to Nigeria, e.g. an EU region).
2. Wait for it to finish provisioning (a couple of minutes).

## 2. Run the schema
1. In the Supabase dashboard, open **SQL Editor > New query**.
2. Paste the contents of `supabase/schema.sql` and click **Run**.
   This creates the `products` table (including the `images` gallery, `description`, and `personas` columns), the `personas` table (the "shop by what you need" collections' copy and hero images), the storage buckets for product photos and page images, and the security policies:
   - `products`: anyone can read every product and update its photos, description, selling price, or published status, but never its name, category, brand, `personas`, or id, and never create or delete a product, from the browser. No login is required by deliberate choice — `admin.html` has no sign-in for this part, so keep its URL private; that matters more now that price and publish status are editable from the page.
   - `personas`: anyone can read every row (the storefront needs this with no login), but only a signed-in owner can update a persona's title/eyebrow/about/hero image. See section 4b for the one-time step of creating that sign-in.
   This file is safe to re-run any time it changes (e.g. after an update to this repo) — every statement is idempotent.

## 3. Load your 50 products
1. Dashboard: **Project settings > API**. Copy the **service_role** key (this bypasses Row Level Security — never put it in `index.html` or `admin.html`, and never commit it).
2. In a terminal: `export SUPABASE_URL="https://xxxx.supabase.co"` and `export SUPABASE_SERVICE_ROLE_KEY="..."` (paste your own values).
3. In `supabase/seed`: run `npm install`, then `node seed.js`.
4. You should see "Seeded 50 products into Supabase." Check **Table Editor > products** to see them. This screen is now where you add, edit, price, and hide products.

## 4. Connect the site and turn on photo uploads
1. Dashboard: **Project settings > API**. Copy the **Project URL** and the **anon public** key (not the service_role key — this one is safe to expose).
2. In both `index.html` and `admin.html`, paste them into `CONFIG.supabase` (`url` and `anonKey`).
3. `admin.html` is part of the deployed site (e.g. `yoursite.com/admin.html`) but not linked from the storefront and has no login for the product section — keep the link to yourself. Search for a product and drop in one or more photos — any filename works, since photos live in a folder per product (`products/<PRODUCT_ID>/...` in Storage) rather than needing to match the ID themselves. The first photo is the card image; add more for a gallery. Delete and reorder buttons appear on each thumbnail. A description box sets the short spec line shown on the product's page. A price field sets `selling_price`, and a Published switch flips the product live or hidden — the switch won't turn on while the price is still ₦0, since a zero-priced product never shows on the storefront anyway.

These config values are safe in a public repo. Security is enforced by Row Level Security, not by hiding the config.

## 4b. Set up sign-in for page images (one-time)
The "Page images" section further down `admin.html` manages each persona collection's hero banner and copy, and — unlike the rest of the page — it requires a real sign-in, because it writes to public data (the `personas` table and `site` Storage bucket both public may read). To set that up:
1. Dashboard: **Authentication > Users > Add user**. Create yourself an email + password (or use a magic-link/invite if you prefer — any Supabase Auth method that ends in an authenticated session works). This repo has no way to create this account for you; it must be done once from the dashboard.
2. On `admin.html`, scroll to **Page images** and sign in with that email/password.
3. Once signed in, you'll see every row from the `personas` table with an image preview, an Upload / Replace button, and editable Eyebrow/Title/About fields with a Save button. Uploading writes to `site/personas/<key>.<ext>` in Storage and updates that row's `hero_image_url`; replacing overwrites the same file. This same list grows automatically if more rows are added to `personas` later — nothing in `admin.html` is hardcoded to today's five collections.

## 5. Deploy
Commit and let Vercel redeploy. The site flips from sample data to your live products.

## One-time: clean up junk product rows
If your `products` table ever picked up rows keyed by an image filename instead of a real product ID (e.g. `03-lg-dualcool-front`), run `supabase/cleanup-catalogue.sql` in the SQL Editor once. It deletes anything not in the real 101-ID catalogue and restores catalogue fields (name/price/published/etc.) for the real products from the seed, without touching any `images`/`image_url` already attached. Safe to re-run.

## Everyday use (your admin)
- **Add a product**: Table Editor > products > insert row. Use the product code as `id`. Fields: `name`, `category`, `brand`, `selling_price` (number), optionally `model`. Leave `published` false until it has a real price and at least one photo.
- **Publish or hide a product, change its price, add photos or a description**: use `admin.html` (see section 4) — pick the product, then use the price field, the Published switch, the description box, and the photo dropzone. Editing `selling_price`/`published`/`description` by hand in the Table Editor works too; photos need `admin.html` (or building the public Storage URLs yourself) since it also handles Storage uploads and the `images`/`image_url` columns.
- **Tag a product to a persona** ("Shop by what you need" collections): not yet in `admin.html` — edit the `personas` array column on that product's row in the Table Editor (e.g. `{bachelor-pad}` or `{bachelor-pad,new-home}`). Valid keys are whatever's in the `personas` table's `key` column (seeded with `first-nest`, `bachelor-pad`, `her-space`, `new-home`, `shortlet-host`). Only tag products that are published with a real price.
- **Edit a persona's hero image or copy** (title/eyebrow/about): use `admin.html`'s "Page images" section — see section 4b for the one-time sign-in setup. Editing the `personas` table by hand in the Table Editor works too.

## Notes
- Cost prices are intentionally NOT stored in this table — keep your cost and margin records in your central sheet. (Unlike Firestore, Postgres *can* protect single columns with different rules, so this is a choice for simplicity, not a technical limit.)
- When traffic grows, Supabase's paid plans scale the same project, no migration.

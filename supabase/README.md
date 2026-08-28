# MR AVAILABLE — Supabase setup

Your site reads products from Supabase (Postgres + Storage). Supabase's free tier includes the database and file storage with no card required, and scales later by switching the same project to a paid plan, no rebuild. You manage products in the Supabase dashboard's Table Editor, which is your admin.

Files (drop these into the repo):
- `index.html` — the site, already wired for Supabase.
- `admin.html` — private photo uploader (see section 4 below).
- `supabase/schema.sql` — creates the `products` table, its security policies, and the photos storage bucket.
- `supabase/seed/products.json` — your 50 products.
- `supabase/seed/seed.js`, `supabase/seed/package.json` — one-time loader.

## 1. Create a Supabase project
1. At [supabase.com](https://supabase.com), create a new project (pick a region close to Nigeria, e.g. an EU region).
2. Wait for it to finish provisioning (a couple of minutes).

## 2. Run the schema
1. In the Supabase dashboard, open **SQL Editor > New query**.
2. Paste the contents of `supabase/schema.sql` and click **Run**.
   This creates the `products` table (including the `images` gallery column), the storage bucket for photos, and the security policies: the public can read published products; only a signed-in owner can read every product or touch photos, and even then never price, name, or published status, and never create or delete products, from the browser.
   This file is safe to re-run any time it changes (e.g. after an update to this repo) — every statement is idempotent.

## 2b. Create your owner login
`admin.html` requires signing in — this is what protects photo uploads now that anyone with the link previously could.
1. Dashboard: **Authentication > Users > Add user**. Set an email and password (autoconfirm the user, or confirm via the email Supabase sends).
2. That's the login you'll use on `admin.html`. Keep the password somewhere safe; there's no self-serve password reset flow wired up.

## 3. Load your 50 products
1. Dashboard: **Project settings > API**. Copy the **service_role** key (this bypasses Row Level Security — never put it in `index.html` or `admin.html`, and never commit it).
2. In a terminal: `export SUPABASE_URL="https://xxxx.supabase.co"` and `export SUPABASE_SERVICE_ROLE_KEY="..."` (paste your own values).
3. In `supabase/seed`: run `npm install`, then `node seed.js`.
4. You should see "Seeded 50 products into Supabase." Check **Table Editor > products** to see them. This screen is now where you add, edit, price, and hide products.

## 4. Connect the site and turn on photo uploads
1. Dashboard: **Project settings > API**. Copy the **Project URL** and the **anon public** key (not the service_role key — this one is safe to expose).
2. In both `index.html` and `admin.html`, paste them into `CONFIG.supabase` (`url` and `anonKey`).
3. `admin.html` is part of the deployed site (e.g. `yoursite.com/admin.html`) but not linked from the storefront. Sign in with the owner account from step 2b, search for a product, and drop in one or more photos — any filename works, since photos live in a folder per product (`products/<PRODUCT_ID>/...` in Storage) rather than needing to match the ID themselves. The first photo is the card image; add more for a gallery. Delete and reorder buttons appear on each thumbnail.

These config values are safe in a public repo. Security is enforced by Row Level Security, not by hiding the config.

## 5. Deploy
Commit and let Vercel redeploy. The site flips from sample data to your live products.

## Everyday use (your admin)
- **Add a product**: Table Editor > products > insert row. Use the product code as `id`. Fields: `name`, `category`, `brand`, `selling_price` (number), optionally `model`, and `published` = true.
- **Hide a product**: set `published` to false. It leaves the site, stays in the database.
- **Change a price**: edit `selling_price`.
- **Add photos**: use `admin.html` (see section 4). It handles Storage uploads and the `images`/`image_url` columns for you — editing those by hand in the Table Editor works too, but you'd need to build the public URLs yourself.

## Notes
- Cost prices are intentionally NOT stored in this table — keep your cost and margin records in your central sheet. (Unlike Firestore, Postgres *can* protect single columns with different rules, so this is a choice for simplicity, not a technical limit.)
- When traffic grows, Supabase's paid plans scale the same project, no migration.

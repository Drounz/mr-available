-- MR AVAILABLE — Supabase schema
-- Run in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to re-run any time — every statement is idempotent, so re-running
-- this file after a schema update brings an existing project up to date
-- without needing a separate migration.

create table if not exists products (
  id text primary key,
  name text not null,
  model text not null default '',
  category text not null default 'Other',
  brand text not null default '',
  selling_price numeric not null,
  image_url text not null default '',
  published boolean not null default false
);

-- Ordered list of public image URLs for a product; images[0] is the
-- card/primary photo, the rest are the gallery. image_url is kept in
-- sync with images[0] as a fallback for any code that only reads the
-- single-image field.
alter table products add column if not exists images text[] not null default '{}';

alter table products enable row level security;

-- Public storefront: anyone may READ products that are published.
drop policy if exists "Public read published products" on products;
create policy "Public read published products"
  on products for select
  to anon, authenticated
  using (published = true);

-- admin.html's product picker needs to show unpublished placeholders
-- too, and there's no login gating it, so anyone with the anon key can
-- read the full catalog (no cost data is stored here, so the exposure
-- is just names/brands/categories of unpublished items).
drop policy if exists "Owner may read all products" on products;
drop policy if exists "Anyone may read all products" on products;
create policy "Anyone may read all products"
  on products for select
  to anon, authenticated
  using (true);

-- No login by deliberate choice: anyone with the admin.html link may
-- write, but the column grant below means images/image_url are the
-- ONLY columns they can actually change — no price, name, or published
-- edits are possible from the browser. No insert/delete policy exists,
-- so creating or deleting products from the browser is denied outright.
drop policy if exists "Public may update image_url only" on products;
drop policy if exists "Owner may update product photos" on products;
drop policy if exists "Public may update product photos" on products;
create policy "Public may update product photos"
  on products for update
  to anon, authenticated
  using (true)
  with check (true);

revoke update on products from anon, authenticated;
grant update (images, image_url) on products to anon, authenticated;

-- No insert/delete policy for anyone from the browser: denied outright.

-- Product photos bucket: public read, uploads capped to images under 5MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "Public read product photos" on storage.objects;
create policy "Public read product photos"
  on storage.objects for select
  to public
  using (bucket_id = 'products');

-- Uploads, overwrites, and deletes are open (no login), scoped to the
-- products bucket only; the bucket's size/MIME-type limits above still
-- apply to every upload regardless of who makes it.
drop policy if exists "Owner upload product photos" on storage.objects;
drop policy if exists "Public upload product photos" on storage.objects;
create policy "Public upload product photos"
  on storage.objects for insert
  to public
  with check (bucket_id = 'products');

drop policy if exists "Owner overwrite product photos" on storage.objects;
drop policy if exists "Public overwrite product photos" on storage.objects;
create policy "Public overwrite product photos"
  on storage.objects for update
  to public
  using (bucket_id = 'products')
  with check (bucket_id = 'products');

drop policy if exists "Owner delete product photos" on storage.objects;
drop policy if exists "Public delete product photos" on storage.objects;
create policy "Public delete product photos"
  on storage.objects for delete
  to public
  using (bucket_id = 'products');

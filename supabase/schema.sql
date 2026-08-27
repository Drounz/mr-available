-- MR AVAILABLE — Supabase schema
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

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

alter table products enable row level security;

-- Public storefront: anyone may READ products that are published.
create policy "Public read published products"
  on products for select
  to anon, authenticated
  using (published = true);

-- Photo uploader (admin.html): anyone with the update grant may touch
-- an existing row, but the column grant below means image_url is the
-- ONLY column they can actually change — no price, name, or published
-- edits are possible from the browser. No insert/delete policy exists,
-- so creating or deleting products from the browser is denied outright.
create policy "Public may update image_url only"
  on products for update
  to anon, authenticated
  using (true)
  with check (true);

revoke update on products from anon, authenticated;
grant update (image_url) on products to anon, authenticated;

-- Product photos bucket: public read, uploads capped to images under 5MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "Public read product photos"
  on storage.objects for select
  to public
  using (bucket_id = 'products');

create policy "Public upload product photos"
  on storage.objects for insert
  to public
  with check (bucket_id = 'products');

create policy "Public overwrite product photos"
  on storage.objects for update
  to public
  using (bucket_id = 'products')
  with check (bucket_id = 'products');

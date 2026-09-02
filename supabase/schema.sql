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

-- Short public spec/description line, editable in admin.html.
alter table products add column if not exists description text not null default '';

-- Which "shop by what you need" persona collections (First Nest,
-- Bachelor Pad, Her Space, New Home, Shortlet Host, ...) a product
-- belongs to. Loaded in bulk from the planner's mapping, not edited
-- per-product in admin.html (yet).
alter table products add column if not exists personas text[] not null default '{}';

-- Sanity bounds on the columns the browser can write (see the update
-- grant below). These don't require a login to bypass — anyone with
-- the anon key can call the REST API directly, admin.html or not — so
-- this is the real backstop against a stray/malicious write leaving
-- garbage a normal UI never would: a negative price, or megabytes of
-- text in a field meant for one line. Limits are generous on purpose;
-- they should never fire on legitimate content.
alter table products drop constraint if exists products_selling_price_nonneg;
alter table products add constraint products_selling_price_nonneg check (selling_price >= 0);
alter table products drop constraint if exists products_description_len;
alter table products add constraint products_description_len check (char_length(description) <= 2000);
alter table products drop constraint if exists products_image_url_len;
alter table products add constraint products_image_url_len check (char_length(image_url) <= 2000);
alter table products drop constraint if exists products_images_len;
alter table products add constraint products_images_len check (array_length(images, 1) is null or array_length(images, 1) <= 20);

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
-- write, but the column grant below is still the only thing stopping
-- them from touching anything else — name, category, brand, and id stay
-- out of reach from the browser no matter what. selling_price and
-- published ARE in this grant (admin.html has a price field and a
-- publish toggle), so anyone who gets hold of the admin.html link can
-- change a price or flip a product's visibility. Keep that link private.
-- No insert/delete policy exists, so creating or deleting products from
-- the browser is denied outright regardless of this grant.
drop policy if exists "Public may update image_url only" on products;
drop policy if exists "Owner may update product photos" on products;
drop policy if exists "Public may update product photos" on products;
create policy "Public may update product photos"
  on products for update
  to anon, authenticated
  using (true)
  with check (true);

revoke update on products from anon, authenticated;
grant update (images, image_url, description, selling_price, published) on products to anon, authenticated;

-- Non-negotiable: a product is a row created only from the catalogue
-- (Table Editor or the seed script's service-role key), never from an
-- uploaded image. No insert/delete policy exists for products, and
-- these explicit revokes make the browser's inability to create or
-- delete a product true at the grant level too, not just by omission.
revoke insert, delete on products from anon, authenticated;

-- Persona collections ("Shop by what you need"). Content (copy and hero
-- images) is owner-managed data — the app only ever reads/writes rows
-- here, it never hardcodes persona copy. Seeded once with the five
-- collections (first-nest, bachelor-pad, her-space, new-home,
-- shortlet-host); more rows can be added later the same way.
create table if not exists personas (
  key text primary key,
  title text not null default '',
  eyebrow text not null default '',
  about text not null default '',
  hero_image_url text not null default '',
  sort_order int not null default 0
);

-- Same reasoning as the products constraints above: generous bounds
-- against a stray/malicious direct write, not against normal use.
alter table personas drop constraint if exists personas_title_len;
alter table personas add constraint personas_title_len check (char_length(title) <= 200);
alter table personas drop constraint if exists personas_eyebrow_len;
alter table personas add constraint personas_eyebrow_len check (char_length(eyebrow) <= 200);
alter table personas drop constraint if exists personas_about_len;
alter table personas add constraint personas_about_len check (char_length(about) <= 5000);
alter table personas drop constraint if exists personas_hero_image_url_len;
alter table personas add constraint personas_hero_image_url_len check (char_length(hero_image_url) <= 2000);

alter table personas enable row level security;

-- Public storefront: anyone may read every persona (tiles + collection pages).
drop policy if exists "Public read personas" on personas;
create policy "Public read personas"
  on personas for select
  to anon, authenticated
  using (true);

-- No login by deliberate choice, same as products/admin.html: anyone
-- with the admin.html link may write, but the column grant below is
-- still the only thing stopping them from touching anything else — the
-- key and sort_order stay out of reach from the browser no matter what.
drop policy if exists "Owner may update personas" on personas;
drop policy if exists "Public may update personas" on personas;
create policy "Public may update personas"
  on personas for update
  to anon, authenticated
  using (true)
  with check (true);

revoke update on personas from anon, authenticated;
grant update (title, eyebrow, about, hero_image_url) on personas to anon, authenticated;

-- Rows are seeded/managed via the dashboard or service-role key, never
-- created or deleted from the browser.
revoke insert, delete on personas from anon, authenticated;

-- The homepage hero photo lives in this same table, at a reserved key
-- that the storefront never treats as a shoppable persona (index.html
-- filters it out of the tile/collection list). Only hero_image_url is
-- real content here — title/eyebrow/about are unused for this row, so
-- this seeds a blank placeholder, not invented copy.
insert into personas (key, title, eyebrow, about, hero_image_url, sort_order)
values ('home-hero', '', '', '', '', -1)
on conflict (key) do nothing;

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

-- Site/page images bucket (hero banners, etc.) — separate from product
-- photos. Path convention: personas/<persona_key>.<ext>, giving public
-- URLs like .../object/public/site/personas/<key>.<ext>. Open to anon,
-- same as the products bucket — no login on admin.html, by choice.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "Public read site images" on storage.objects;
create policy "Public read site images"
  on storage.objects for select
  to public
  using (bucket_id = 'site');

drop policy if exists "Owner upload site images" on storage.objects;
drop policy if exists "Public upload site images" on storage.objects;
create policy "Public upload site images"
  on storage.objects for insert
  to public
  with check (bucket_id = 'site');

drop policy if exists "Owner overwrite site images" on storage.objects;
drop policy if exists "Public overwrite site images" on storage.objects;
create policy "Public overwrite site images"
  on storage.objects for update
  to public
  using (bucket_id = 'site')
  with check (bucket_id = 'site');

drop policy if exists "Owner delete site images" on storage.objects;
drop policy if exists "Public delete site images" on storage.objects;
create policy "Public delete site images"
  on storage.objects for delete
  to public
  using (bucket_id = 'site');

-- Analytics: page views and product clicks, logged anonymously by the
-- storefront itself (see logEvent() in index.html). No cookies, no
-- visitor id, nothing that ties one visit to another — just an
-- anonymous event per page view / product open. country/city come
-- from a client-side IP-geolocation lookup (ipapi.co), best-effort:
-- if it fails, the event is still logged with those fields null.
create table if not exists analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  path text not null default '',
  product_id text,
  referrer text not null default '',
  country text,
  city text,
  created_at timestamptz not null default now()
);

alter table analytics_events drop constraint if exists analytics_events_type_check;
alter table analytics_events add constraint analytics_events_type_check check (event_type in ('page_view', 'product_click'));
alter table analytics_events drop constraint if exists analytics_events_path_len;
alter table analytics_events add constraint analytics_events_path_len check (char_length(path) <= 500);
alter table analytics_events drop constraint if exists analytics_events_product_id_len;
alter table analytics_events add constraint analytics_events_product_id_len check (product_id is null or char_length(product_id) <= 100);
alter table analytics_events drop constraint if exists analytics_events_referrer_len;
alter table analytics_events add constraint analytics_events_referrer_len check (char_length(referrer) <= 500);
alter table analytics_events drop constraint if exists analytics_events_country_len;
alter table analytics_events add constraint analytics_events_country_len check (country is null or char_length(country) <= 100);
alter table analytics_events drop constraint if exists analytics_events_city_len;
alter table analytics_events add constraint analytics_events_city_len check (city is null or char_length(city) <= 100);

alter table analytics_events enable row level security;

-- Write-only from the browser, deliberately: anyone can log an event
-- (same no-login model as the rest of the site), but nobody can read,
-- change, or delete one through the public anon key. Analytics is more
-- sensitive than the product catalog (it's your traffic and behavior
-- data), so unlike products/personas there is no public SELECT policy
-- here at all — you view it in the Supabase dashboard (Table Editor or
-- SQL Editor) using your own real Supabase login, not through
-- admin.html or the anon key. That's a separate, pre-existing account,
-- not a new sign-in step added to this site.
drop policy if exists "Public may log analytics events" on analytics_events;
create policy "Public may log analytics events"
  on analytics_events for insert
  to anon, authenticated
  with check (true);

revoke all on analytics_events from anon, authenticated;
grant insert on analytics_events to anon, authenticated;
grant usage on sequence analytics_events_id_seq to anon, authenticated;

-- Convenience views for the dashboard — same "no anon access" rule
-- applies: these are never granted to anon/authenticated, so they're
-- only reachable from the Supabase dashboard (Table Editor > Views,
-- or SQL Editor), never from the public site.
create or replace view analytics_summary as
select
  count(*) filter (where event_type = 'page_view') as total_page_views,
  count(*) filter (where event_type = 'product_click') as total_product_clicks,
  count(distinct country) filter (where country is not null) as countries_seen,
  min(created_at) as first_event_at,
  max(created_at) as last_event_at
from analytics_events;

create or replace view analytics_top_products as
select product_id, count(*) as clicks
from analytics_events
where event_type = 'product_click' and product_id is not null
group by product_id
order by clicks desc;

create or replace view analytics_by_country as
select coalesce(country, 'Unknown') as country, count(*) as visits
from analytics_events
where event_type = 'page_view'
group by coalesce(country, 'Unknown')
order by visits desc;

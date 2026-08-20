-- Non-destructive migration: adds screenshot lifecycle state tracking,
-- replaces delete-and-reinsert ingestion with idempotent upsert that
-- preserves screenshot metadata, and restricts uploads to WebP.

-- ──────────────────────────────────────────────────────────────
-- 1. Add screenshot lifecycle columns
-- ──────────────────────────────────────────────────────────────

alter table public.products
  add column if not exists screenshot_status text not null default 'pending'
    check (screenshot_status in ('pending', 'captured', 'fallback', 'empty')),
  add column if not exists screenshot_source text
    check (screenshot_source is null or screenshot_source in ('website', 'product-media')),
  add column if not exists screenshot_error text,
  add column if not exists screenshot_attempt_count integer not null default 0
    check (screenshot_attempt_count >= 0),
  add column if not exists screenshot_last_attempted_at timestamptz;

-- ──────────────────────────────────────────────────────────────
-- 2. Backfill screenshot_status from existing data
-- ──────────────────────────────────────────────────────────────

update public.products
set screenshot_status = case
  when screenshot_url is not null then 'captured'
  when screenshot_captured_at is not null then 'fallback'
  else 'pending'
end
where screenshot_status = 'pending';

-- ──────────────────────────────────────────────────────────────
-- 3. Remove daily_rank uniqueness (allow same rank on same date
--    for different product_hunt_ids); retain (product_hunt_id,
--    launch_date) unique constraint from prior migration
-- ──────────────────────────────────────────────────────────────

alter table public.products
  drop constraint if exists products_launch_date_daily_rank_key;

-- ──────────────────────────────────────────────────────────────
-- 4. Replace replace_daily_products with idempotent upsert that
--    preserves screenshot metadata on conflict
-- ──────────────────────────────────────────────────────────────

create or replace function public.replace_daily_products(
  p_launch_date date,
  p_products jsonb,
  p_allow_empty boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  processed_count integer;
begin
  if p_launch_date > current_date then
    raise exception using
      errcode = '22007',
      message = 'Launch date cannot be in the future';
  end if;

  if jsonb_typeof(p_products) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Products must be a JSON array';
  end if;

  processed_count := jsonb_array_length(p_products);

  if processed_count = 0 and not p_allow_empty then
    raise exception using
      errcode = '22023',
      message = 'Products array cannot be empty unless p_allow_empty is true';
  end if;

  -- Upsert every product; screenshot_* columns are intentionally
  -- omitted from both the INSERT column list and the DO UPDATE SET
  -- so they are preserved when a row already exists.
  if processed_count > 0 then
    insert into public.products (
      product_hunt_id, slug, name, tagline, website_url, product_hunt_url,
      launch_date, launched_at, featured_at, daily_rank, votes_count,
      comments_count, topic_slugs, topic_names, source_payload
    )
    select
      (elem->>'product_hunt_id')::bigint,
      elem->>'slug',
      elem->>'name',
      elem->>'tagline',
      elem->>'website_url',
      elem->>'product_hunt_url',
      (elem->>'launch_date')::date,
      (elem->>'launched_at')::timestamptz,
      (elem->>'featured_at')::timestamptz,
      (elem->>'daily_rank')::integer,
      (elem->>'votes_count')::integer,
      (elem->>'comments_count')::integer,
      case when jsonb_typeof(elem->'topic_slugs') = 'array'
        then array(select jsonb_array_elements_text(elem->'topic_slugs'))
        else '{}'
      end,
      case when jsonb_typeof(elem->'topic_names') = 'array'
        then array(select jsonb_array_elements_text(elem->'topic_names'))
        else '{}'
      end,
      coalesce(elem->'source_payload', '{}'::jsonb)
    from jsonb_array_elements(p_products) as elem
    on conflict (product_hunt_id, launch_date)
    do update set
      slug            = excluded.slug,
      name            = excluded.name,
      tagline         = excluded.tagline,
      website_url     = excluded.website_url,
      product_hunt_url = excluded.product_hunt_url,
      launched_at     = excluded.launched_at,
      featured_at     = excluded.featured_at,
      daily_rank      = excluded.daily_rank,
      votes_count     = excluded.votes_count,
      comments_count  = excluded.comments_count,
      topic_slugs     = excluded.topic_slugs,
      topic_names     = excluded.topic_names,
      source_payload  = excluded.source_payload;
  end if;

  -- Remove products for this launch_date that no longer appear in
  -- the input array (orphans from a previous ingestion run).
  delete from public.products p
  where p.launch_date = p_launch_date
    and p.product_hunt_id not in (
      select (elem->>'product_hunt_id')::bigint
      from jsonb_array_elements(p_products) elem
    );

  return processed_count;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- 5. Add products_health_summary_v2 with failed_screenshots metric
-- ──────────────────────────────────────────────────────────────

create or replace function public.products_health_summary_v2(
  p_refresh_after_days integer default 30,
  p_min_screenshot_bytes integer default 20000
)
returns table (
  latest_launch_date date,
  total_products bigint,
  missing_screenshots bigint,
  stale_screenshots bigint,
  undersized_screenshots bigint,
  failed_screenshots bigint,
  last_screenshot_captured_at timestamptz
)
language sql
stable
set search_path = public, pg_temp
as $$
  with params as (
    select
      now() - make_interval(days => greatest(p_refresh_after_days, 1)) as stale_before,
      greatest(p_min_screenshot_bytes, 1) as min_screenshot_bytes
  )
  select
    max(p.launch_date) as latest_launch_date,
    count(*) as total_products,
    count(*) filter (where p.screenshot_url is null) as missing_screenshots,
    count(*) filter (
      where p.screenshot_captured_at is not null
        and p.screenshot_captured_at < params.stale_before
    ) as stale_screenshots,
    count(*) filter (
      where p.screenshot_bytes is not null
        and p.screenshot_bytes < params.min_screenshot_bytes
    ) as undersized_screenshots,
    count(*) filter (where p.screenshot_status = 'fallback') as failed_screenshots,
    max(p.screenshot_captured_at) as last_screenshot_captured_at
  from public.products p
  cross join params;
$$;

-- ──────────────────────────────────────────────────────────────
-- 6. Grant access: service_role for writes, public for reads
-- ──────────────────────────────────────────────────────────────

revoke all on function public.replace_daily_products(date, jsonb, boolean) from public;
revoke all on function public.products_health_summary_v2(integer, integer) from public;

grant execute on function public.replace_daily_products(date, jsonb, boolean) to service_role;
grant execute on function public.products_health_summary_v2(integer, integer) to service_role;
grant execute on function public.products_health_summary_v2(integer, integer) to anon, authenticated;

-- ──────────────────────────────────────────────────────────────
-- 7. Restrict screenshot bucket to WebP only
-- ──────────────────────────────────────────────────────────────

update storage.buckets
set allowed_mime_types = array['image/webp']
where id = 'screenshots';

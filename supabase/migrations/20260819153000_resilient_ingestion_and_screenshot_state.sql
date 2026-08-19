alter table public.products
  add column if not exists screenshot_status text,
  add column if not exists screenshot_source text,
  add column if not exists screenshot_error text,
  add column if not exists screenshot_attempt_count integer,
  add column if not exists screenshot_last_attempted_at timestamptz;

alter table public.products
  drop constraint if exists products_screenshot_status_check,
  drop constraint if exists products_screenshot_source_check,
  drop constraint if exists products_screenshot_attempt_count_check,
  drop constraint if exists products_launch_date_daily_rank_key;

update public.products
set
  screenshot_status = case when screenshot_url is null then 'pending' else 'captured' end,
  screenshot_source = null,
  screenshot_attempt_count = coalesce(screenshot_attempt_count, 0)
where screenshot_status is null
   or screenshot_attempt_count is null;

alter table public.products
  alter column screenshot_status set default 'pending',
  alter column screenshot_status set not null,
  alter column screenshot_attempt_count set default 0,
  alter column screenshot_attempt_count set not null,
  add constraint products_screenshot_status_check
    check (screenshot_status in ('pending', 'captured', 'fallback', 'empty')),
  add constraint products_screenshot_source_check
    check (screenshot_source is null or screenshot_source in ('website', 'product-media')),
  add constraint products_screenshot_attempt_count_check
    check (screenshot_attempt_count >= 0);

create index if not exists products_screenshot_queue_idx
  on public.products (launch_date desc, votes_count desc)
  where screenshot_status in ('pending', 'fallback');

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
  affected_count integer := 0;
begin
  if p_launch_date > current_date then
    raise exception using errcode = '22007', message = 'Launch date cannot be in the future';
  end if;

  if jsonb_typeof(p_products) <> 'array' then
    raise exception using errcode = '22023', message = 'Products must be a JSON array';
  end if;

  if jsonb_array_length(p_products) = 0 and not p_allow_empty then
    raise exception using
      errcode = '22023',
      message = 'Products array cannot be empty unless p_allow_empty is true';
  end if;

  delete from public.products existing
  where existing.launch_date = p_launch_date
    and not exists (
      select 1
      from jsonb_to_recordset(p_products) as incoming(product_hunt_id bigint)
      where incoming.product_hunt_id = existing.product_hunt_id
    );

  if jsonb_array_length(p_products) = 0 then
    return 0;
  end if;

  insert into public.products (
    product_hunt_id, slug, name, tagline, website_url, product_hunt_url,
    launch_date, launched_at, featured_at, daily_rank, votes_count,
    comments_count, topic_slugs, topic_names, source_payload
  )
  select
    product_hunt_id, slug, name, tagline, website_url, product_hunt_url,
    launch_date, launched_at, featured_at, daily_rank, votes_count,
    comments_count, topic_slugs, topic_names, source_payload
  from jsonb_to_recordset(p_products) as row_data(
    product_hunt_id bigint,
    slug text,
    name text,
    tagline text,
    website_url text,
    product_hunt_url text,
    launch_date date,
    launched_at timestamptz,
    featured_at timestamptz,
    daily_rank integer,
    votes_count integer,
    comments_count integer,
    topic_slugs text[],
    topic_names text[],
    source_payload jsonb
  )
  on conflict (product_hunt_id, launch_date) do update
  set
    slug = excluded.slug,
    name = excluded.name,
    tagline = excluded.tagline,
    website_url = excluded.website_url,
    product_hunt_url = excluded.product_hunt_url,
    launched_at = excluded.launched_at,
    featured_at = excluded.featured_at,
    daily_rank = excluded.daily_rank,
    votes_count = excluded.votes_count,
    comments_count = excluded.comments_count,
    topic_slugs = excluded.topic_slugs,
    topic_names = excluded.topic_names,
    source_payload = excluded.source_payload;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

revoke all on function public.replace_daily_products(date, jsonb, boolean) from public;
grant execute on function public.replace_daily_products(date, jsonb, boolean) to service_role;

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
    max(p.launch_date),
    count(*),
    count(*) filter (where p.screenshot_url is null),
    count(*) filter (
      where p.screenshot_captured_at is not null
        and p.screenshot_captured_at < params.stale_before
    ),
    count(*) filter (
      where p.screenshot_bytes is not null
        and p.screenshot_bytes < params.min_screenshot_bytes
    ),
    count(*) filter (where p.screenshot_status = 'fallback'),
    max(p.screenshot_captured_at)
  from public.products p
  cross join params;
$$;

revoke all on function public.products_health_summary_v2(integer, integer) from public;
grant execute on function public.products_health_summary_v2(integer, integer)
to service_role, anon, authenticated;

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/webp']
where id = 'screenshots';

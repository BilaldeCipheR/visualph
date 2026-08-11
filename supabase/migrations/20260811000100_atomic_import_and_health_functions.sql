create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;

create trigger products_set_updated_at
before update on public.products
for each row
when (old.* is distinct from new.*)
execute function public.set_updated_at();

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
  inserted_count integer := 0;
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

  if jsonb_array_length(p_products) = 0 and not p_allow_empty then
    raise exception using
      errcode = '22023',
      message = 'Products array cannot be empty unless p_allow_empty is true';
  end if;

  delete from public.products
  where launch_date = p_launch_date;

  if jsonb_array_length(p_products) = 0 then
    return 0;
  end if;

  insert into public.products (
    product_hunt_id,
    slug,
    name,
    tagline,
    website_url,
    product_hunt_url,
    launch_date,
    launched_at,
    featured_at,
    daily_rank,
    votes_count,
    comments_count,
    topic_slugs,
    topic_names,
    source_payload
  )
  select
    product_hunt_id,
    slug,
    name,
    tagline,
    website_url,
    product_hunt_url,
    launch_date,
    launched_at,
    featured_at,
    daily_rank,
    votes_count,
    comments_count,
    topic_slugs,
    topic_names,
    source_payload
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
  );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.products_health_summary(
  p_refresh_after_days integer default 30,
  p_min_screenshot_bytes integer default 20000
)
returns table (
  latest_launch_date date,
  total_products bigint,
  missing_screenshots bigint,
  stale_screenshots bigint,
  undersized_screenshots bigint,
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
    max(p.screenshot_captured_at) as last_screenshot_captured_at
  from public.products p
  cross join params;
$$;

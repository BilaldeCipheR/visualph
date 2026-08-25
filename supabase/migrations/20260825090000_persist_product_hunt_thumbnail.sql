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
    raise exception using errcode = '22023', message = 'Products array cannot be empty unless p_allow_empty is true';
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
    thumbnail_url, launch_date, launched_at, featured_at, daily_rank,
    votes_count, comments_count, topic_slugs, topic_names, source_payload
  )
  select
    product_hunt_id, slug, name, tagline, website_url, product_hunt_url,
    thumbnail_url, launch_date, launched_at, featured_at, daily_rank,
    votes_count, comments_count, topic_slugs, topic_names, source_payload
  from jsonb_to_recordset(p_products) as row_data(
    product_hunt_id bigint,
    slug text,
    name text,
    tagline text,
    website_url text,
    product_hunt_url text,
    thumbnail_url text,
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
    thumbnail_url = excluded.thumbnail_url,
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

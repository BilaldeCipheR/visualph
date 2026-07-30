grant usage on schema public to anon, authenticated, service_role;

grant select on table public.products to anon, authenticated;
grant select, insert, update, delete on table public.products to service_role;

grant usage, select on sequence public.products_id_seq to service_role;

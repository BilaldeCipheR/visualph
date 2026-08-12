revoke all on function public.replace_daily_products(date, jsonb, boolean) from public;
revoke all on function public.products_health_summary(integer, integer) from public;

grant execute on function public.replace_daily_products(date, jsonb, boolean) to service_role;
grant execute on function public.products_health_summary(integer, integer) to service_role;

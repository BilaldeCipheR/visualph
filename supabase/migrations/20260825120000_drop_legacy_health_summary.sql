-- Drop the stale products_health_summary RPC (v1) that is superseded by v2
revoke all on function public.products_health_summary from public;
drop function public.products_health_summary;
alter table public.products
  drop constraint if exists products_product_hunt_id_key;

alter table public.products
  add constraint products_product_hunt_id_launch_date_key
  unique (product_hunt_id, launch_date);

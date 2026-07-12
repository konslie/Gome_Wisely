alter table public.cart_items drop constraint if exists cart_items_status_check;
alter table public.cart_items
  add constraint cart_items_status_check
  check (status in ('active', 'deleted', 'purchased'));

create table if not exists public.purchase_batches (
  purchase_id uuid primary key default gen_random_uuid(),
  purchased_at timestamptz not null default now(),
  item_count integer not null check (item_count > 0)
);

create table if not exists public.purchased_items (
  purchased_item_id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchase_batches(purchase_id) on delete cascade,
  source_item_id uuid not null,
  input_value text not null,
  input_type text not null check (input_type in ('text', 'url')),
  item_name varchar(100) not null,
  quantity integer not null check (quantity >= 1 and quantity <= 999),
  delivery_type text not null check (delivery_type in ('ambient', 'fresh')),
  product_url varchar(2048),
  purchased_at timestamptz not null
);

create index if not exists purchased_items_name_idx
  on public.purchased_items (item_name, purchased_at desc);

alter table public.purchase_batches enable row level security;
alter table public.purchased_items enable row level security;
revoke all on public.purchase_batches from anon, authenticated;
revoke all on public.purchased_items from anon, authenticated;

create or replace function public.complete_cart_purchase()
returns table (purchase_id uuid, item_count integer, purchased_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_id uuid;
  completed_at timestamptz := now();
  completed_count integer;
begin
  select count(*) into completed_count
  from public.cart_items
  where status = 'active';

  if completed_count = 0 then
    raise exception '장바구니가 비어 있습니다.';
  end if;

  insert into public.purchase_batches (purchased_at, item_count)
  values (completed_at, completed_count)
  returning purchase_batches.purchase_id into completed_id;

  insert into public.purchased_items (
    purchase_id, source_item_id, input_value, input_type, item_name,
    quantity, delivery_type, product_url, purchased_at
  )
  select completed_id, item_id, input_value, input_type, item_name,
    quantity, delivery_type, product_url, completed_at
  from public.cart_items
  where status = 'active';

  update public.cart_items
  set status = 'purchased', updated_at = completed_at
  where status = 'active';

  return query select completed_id, completed_count, completed_at;
end;
$$;

revoke all on function public.complete_cart_purchase() from public, anon, authenticated;
grant execute on function public.complete_cart_purchase() to service_role;

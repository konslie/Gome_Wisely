drop function if exists public.complete_cart_purchase();

alter table public.purchase_batches
  add column if not exists delivery_type text;

update public.purchase_batches as batch
set delivery_type = coalesce((
  select case
    when count(distinct item.delivery_type) = 1 then min(item.delivery_type)
    else 'mixed'
  end
  from public.purchased_items as item
  where item.purchase_id = batch.purchase_id
), 'mixed')
where delivery_type is null;

alter table public.purchase_batches
  alter column delivery_type set not null;

alter table public.purchase_batches
  drop constraint if exists purchase_batches_delivery_type_check;
alter table public.purchase_batches
  add constraint purchase_batches_delivery_type_check
  check (delivery_type in ('ambient', 'fresh', 'mixed'));

create or replace function public.complete_cart_purchase(target_delivery_type text)
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
  if target_delivery_type not in ('ambient', 'fresh') then
    raise exception '배송 유형이 올바르지 않습니다.';
  end if;

  select count(*) into completed_count
  from public.cart_items
  where status = 'active' and delivery_type = target_delivery_type;

  if completed_count = 0 then
    raise exception '장바구니가 비어 있습니다.';
  end if;

  insert into public.purchase_batches (purchased_at, delivery_type, item_count)
  values (completed_at, target_delivery_type, completed_count)
  returning purchase_batches.purchase_id into completed_id;

  insert into public.purchased_items (
    purchase_id, source_item_id, input_value, input_type, item_name,
    quantity, delivery_type, product_url, purchased_at
  )
  select completed_id, item_id, input_value, input_type, item_name,
    quantity, delivery_type, product_url, completed_at
  from public.cart_items
  where status = 'active' and delivery_type = target_delivery_type;

  update public.cart_items
  set status = 'purchased', updated_at = completed_at
  where status = 'active' and delivery_type = target_delivery_type;

  return query select completed_id, completed_count, completed_at;
end;
$$;

revoke all on function public.complete_cart_purchase(text) from public, anon, authenticated;
grant execute on function public.complete_cart_purchase(text) to service_role;

create extension if not exists pgcrypto;

create table if not exists public.auth_settings (
  id smallint primary key default 1 check (id = 1),
  password_hash text not null,
  password_updated_at timestamptz not null default now(),
  failed_attempt_count integer not null default 0,
  locked_until timestamptz,
  session_version integer not null default 1
);

create table if not exists public.cart_items (
  item_id uuid primary key default gen_random_uuid(),
  input_value text not null,
  input_type text not null check (input_type in ('text', 'url')),
  item_name varchar(100) not null,
  quantity integer not null check (quantity >= 1 and quantity <= 999),
  delivery_type text not null check (delivery_type in ('ambient', 'fresh')),
  product_url varchar(2048),
  status text not null default 'active' check (status in ('active', 'deleted', 'purchased')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists cart_items_delivery_status_created_idx
  on public.cart_items (delivery_type, status, created_at desc);

create table if not exists public.purchase_batches (
  purchase_id uuid primary key default gen_random_uuid(),
  purchased_at timestamptz not null default now(),
  delivery_type text not null check (delivery_type in ('ambient', 'fresh')),
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

alter table public.auth_settings enable row level security;
alter table public.cart_items enable row level security;
alter table public.purchase_batches enable row level security;
alter table public.purchased_items enable row level security;

-- 브라우저에는 Supabase 키를 제공하지 않는다. 서버의 service role만 접근한다.
revoke all on public.auth_settings from anon, authenticated;
revoke all on public.cart_items from anon, authenticated;
revoke all on public.purchase_batches from anon, authenticated;
revoke all on public.purchased_items from anon, authenticated;
revoke all on function public.complete_cart_purchase(text) from public, anon, authenticated;
grant execute on function public.complete_cart_purchase(text) to service_role;

-- 아래 <PIN>을 실제 숫자 4자리로 바꿔 Supabase SQL Editor에서 최초 1회 실행한다.
-- 실행 후 SQL Editor의 쿼리 기록에서 원문 PIN이 남지 않도록 해당 쿼리를 삭제한다.
-- insert into public.auth_settings (id, password_hash)
-- values (1, crypt('<PIN>', gen_salt('bf', 12)));

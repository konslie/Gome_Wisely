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
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists cart_items_delivery_status_created_idx
  on public.cart_items (delivery_type, status, created_at desc);

alter table public.auth_settings enable row level security;
alter table public.cart_items enable row level security;

-- 브라우저에는 Supabase 키를 제공하지 않는다. 서버의 service role만 접근한다.
revoke all on public.auth_settings from anon, authenticated;
revoke all on public.cart_items from anon, authenticated;

-- 아래 <PIN>을 실제 숫자 4자리로 바꿔 Supabase SQL Editor에서 최초 1회 실행한다.
-- 실행 후 SQL Editor의 쿼리 기록에서 원문 PIN이 남지 않도록 해당 쿼리를 삭제한다.
-- insert into public.auth_settings (id, password_hash)
-- values (1, crypt('<PIN>', gen_salt('bf', 12)));

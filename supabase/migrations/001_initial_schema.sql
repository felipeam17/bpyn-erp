-- BYN Marine Supply ERP — Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────
-- SUPPLIERS
-- ─────────────────────────────
create table if not exists suppliers (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  country     text,
  contact     text,
  payment     text default 'Contado',   -- 'Crédito' | 'Contado'
  terms       text default 'Contado',   -- '30 días' | 'Contado' etc.
  notes       text,
  active      boolean default true,
  created_at  timestamptz default now()
);

-- ─────────────────────────────
-- CATEGORIES
-- ─────────────────────────────
create table if not exists categories (
  id    uuid primary key default uuid_generate_v4(),
  name  text not null unique
);

insert into categories (name) values
  ('Alimentos'),
  ('Bebidas'),
  ('Limpieza'),
  ('Utensilios de Cocina'),
  ('Equipos'),
  ('Higiene Personal'),
  ('Mantenimiento'),
  ('Otros')
on conflict do nothing;

-- ─────────────────────────────
-- PRODUCTS
-- ─────────────────────────────
create table if not exists products (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  sku             text,
  category_id     uuid references categories(id),
  supplier_id     uuid references suppliers(id),
  unit            text default 'unidad',
  avg_cost        numeric(12,2) default 0,      -- costo promedio (se actualiza manualmente)
  sale_price      numeric(12,2) not null,        -- precio de venta base
  stock           integer default 0,
  notes           text,
  active          boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Trigger to auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();

-- ─────────────────────────────
-- PRICE HISTORY (audit trail)
-- ─────────────────────────────
create table if not exists price_history (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid references products(id) on delete cascade,
  field       text,   -- 'avg_cost' | 'sale_price'
  old_value   numeric(12,2),
  new_value   numeric(12,2),
  changed_by  text,   -- user email
  created_at  timestamptz default now()
);

-- ─────────────────────────────
-- QUOTES
-- ─────────────────────────────
create table if not exists quotes (
  id            uuid primary key default uuid_generate_v4(),
  quote_number  text not null unique,  -- COT-001, COT-002 ...
  client        text not null,
  client_email  text,
  date          date default current_date,
  valid_until   date,
  status        text default 'pendiente',  -- pendiente | aceptada | rechazada | borrador
  discount_pct  numeric(5,2) default 0,
  notes         text,
  subtotal      numeric(12,2) default 0,
  total         numeric(12,2) default 0,
  total_cost    numeric(12,2) default 0,
  created_by    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create trigger quotes_updated_at
  before update on quotes
  for each row execute function update_updated_at();

-- ─────────────────────────────
-- QUOTE ITEMS
-- ─────────────────────────────
create table if not exists quote_items (
  id              uuid primary key default uuid_generate_v4(),
  quote_id        uuid references quotes(id) on delete cascade,
  product_id      uuid references products(id),
  product_name    text not null,   -- snapshot at time of quote
  product_sku     text,
  unit            text,
  unit_cost       numeric(12,2) default 0,
  unit_price      numeric(12,2) not null,  -- may differ from base price
  qty             numeric(10,3) default 1,
  subtotal        numeric(12,2) generated always as (unit_price * qty) stored,
  created_at      timestamptz default now()
);

-- ─────────────────────────────
-- RLS POLICIES (basic security)
-- Enable Row Level Security so only authenticated users can access
-- ─────────────────────────────
alter table suppliers    enable row level security;
alter table categories   enable row level security;
alter table products     enable row level security;
alter table price_history enable row level security;
alter table quotes       enable row level security;
alter table quote_items  enable row level security;

-- Allow all authenticated users full access (adjust per role if needed)
create policy "Authenticated users full access" on suppliers
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on categories
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on products
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on price_history
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on quotes
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users full access" on quote_items
  for all using (auth.role() = 'authenticated');

-- ─────────────────────────────
-- SEQUENCE for quote numbers
-- ─────────────────────────────
create sequence if not exists quote_seq start 1;

-- Helper function to generate quote number
create or replace function next_quote_number()
returns text as $$
begin
  return 'COT-' || lpad(nextval('quote_seq')::text, 4, '0');
end;
$$ language plpgsql;

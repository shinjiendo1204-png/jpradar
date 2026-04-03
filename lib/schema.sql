-- jpradar v2: Japan Used Market Arbitrage Tool
-- Run in Supabase SQL editor (Settings > SQL Editor)

-- ============================================================
-- TABLES
-- ============================================================

-- Profitable deals found by the scanner
create table if not exists deals (
  id                    uuid primary key default gen_random_uuid(),
  title_ja              text not null,
  title_en              text,
  source                text not null check (source in ('surugaya', 'yahoo_auctions', 'hardoff')),
  source_url            text not null,
  image_url             text,
  buy_price_jpy         integer not null,
  shipping_estimate_jpy integer,
  ebay_sell_price_usd   numeric(10,2),
  net_profit_usd        numeric(10,2),
  profit_margin_pct     numeric(5,2),
  category              text check (category in ('game', 'figure', 'card', 'brand', 'electronics', 'other')),
  is_active             boolean default true,
  created_at            timestamptz default now()
);

-- User alert preferences (category filter + min profit threshold)
create table if not exists alerts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users not null,
  category             text check (category in ('game', 'figure', 'card', 'brand', 'electronics', 'other') or category is null),
  min_profit_usd       integer default 15,
  slack_webhook_url    text,
  discord_webhook_url  text,
  is_active            boolean default true,
  created_at           timestamptz default now()
);

-- Price cache to reduce eBay/PriceCharting API calls
create table if not exists price_cache (
  id           uuid primary key default gen_random_uuid(),
  search_term  text not null,
  platform     text not null check (platform in ('ebay', 'pricecharting')),
  price_data   jsonb not null,
  expires_at   timestamptz not null,
  created_at   timestamptz default now(),
  unique (search_term, platform)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table deals enable row level security;
alter table alerts enable row level security;
alter table price_cache enable row level security;

-- Deals: any authenticated user can read all deals
create policy "deals_read"
  on deals for select to authenticated using (true);

-- Deals: only service role (cron) can write
create policy "deals_insert_service"
  on deals for insert to service_role with check (true);

create policy "deals_update_service"
  on deals for update to service_role using (true);

-- Alerts: users manage only their own
create policy "alerts_own"
  on alerts for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Price cache: service role only
create policy "price_cache_service"
  on price_cache for all to service_role
  using (true) with check (true);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_deals_created    on deals (created_at desc);
create index if not exists idx_deals_profit     on deals (net_profit_usd desc);
create index if not exists idx_deals_category   on deals (category);
create index if not exists idx_alerts_user      on alerts (user_id);
create index if not exists idx_alerts_active    on alerts (is_active, min_profit_usd);
create index if not exists idx_price_cache_term on price_cache (search_term, platform);
create index if not exists idx_price_cache_exp  on price_cache (expires_at);

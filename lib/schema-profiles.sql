-- profiles table: plan management + Stripe integration
-- Run in Supabase SQL Editor AFTER schema.sql

create table if not exists profiles (
  id                     uuid primary key references auth.users on delete cascade,
  plan                   text not null default 'free' check (plan in ('free', 'hunter', 'pro')),
  subscription_status    text default null,
  stripe_customer_id     text default null,
  stripe_subscription_id text default null,
  plan_updated_at        timestamptz default now(),
  created_at             timestamptz default now()
);

alter table profiles enable row level security;

-- Users can read their own profile
create policy "profiles_read_own"
  on profiles for select to authenticated
  using (auth.uid() = id);

-- Service role manages all profiles (webhook updates plan)
create policy "profiles_service_role"
  on profiles for all to service_role
  using (true) with check (true);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

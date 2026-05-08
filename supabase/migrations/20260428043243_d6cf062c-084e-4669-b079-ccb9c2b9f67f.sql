create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_enabled_idx on public.push_subscriptions(enabled, last_seen_at desc);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions open" on public.push_subscriptions;
create policy "push_subscriptions open"
on public.push_subscriptions
for all
using (true)
with check (true);

alter table public.notes
  add column if not exists notify_lead_minutes integer;

create table if not exists public.push_dispatch_log (
  note_id uuid not null,
  kind text not null,
  fired_at timestamptz not null default now(),
  primary key (note_id, kind)
);

alter table public.push_dispatch_log enable row level security;
drop policy if exists "push_dispatch_log open" on public.push_dispatch_log;
create policy "push_dispatch_log open"
on public.push_dispatch_log
for all
using (true)
with check (true);

create extension if not exists pg_cron;
create extension if not exists pg_net;
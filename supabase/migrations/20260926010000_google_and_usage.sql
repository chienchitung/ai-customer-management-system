-- Server-only tables. RLS is enabled with NO policies, so browser clients
-- (anon / authenticated) can never read them; only the service role can.

-- Google OAuth refresh tokens used by the server to call the Gmail API.
create table if not exists public.google_tokens (
  owner_id      uuid        primary key references auth.users (id) on delete cascade,
  refresh_token text        not null,
  scope         text        not null default '',
  google_email  text,
  updated_at    timestamptz not null default now()
);
alter table public.google_tokens enable row level security;
alter table public.google_tokens force row level security;
revoke all on public.google_tokens from anon, authenticated;

-- Daily AI request counter per user, for cost control.
create table if not exists public.ai_usage (
  owner_id uuid    not null references auth.users (id) on delete cascade,
  day      date    not null default current_date,
  count    integer not null default 0,
  primary key (owner_id, day)
);
alter table public.ai_usage enable row level security;
alter table public.ai_usage force row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Atomically counts one AI request; returns false when the daily limit is reached.
create or replace function public.consume_ai_quota(p_owner uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
begin
  insert into public.ai_usage as u (owner_id, day, count)
  values (p_owner, current_date, 1)
  on conflict (owner_id, day) do update set count = u.count + 1
  returning u.count into used;
  return used <= p_limit;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, integer) from public, anon, authenticated;

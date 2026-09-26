-- Customers for a personal sales CRM. Each row belongs to exactly one user;
-- Row Level Security ensures a rep can only ever see and change their own data.

create table if not exists public.customers (
  owner_id        uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id              text        not null,
  name            text        not null check (char_length(name) between 1 and 200),
  company         text        not null check (char_length(company) between 1 and 200),
  email           text        not null default '',
  status          text        not null check (status in ('Lead', 'Prospect', 'Negotiation', 'Closed (Won)', 'Closed (Lost)')),
  deal_value      numeric     check (deal_value is null or deal_value >= 0),
  last_contact    date,
  next_action     jsonb,       -- { description, dueDate }
  next_action_due date,        -- derived from next_action by trigger, for indexing
  key_contacts    jsonb       not null default '[]'::jsonb,
  pain_points     jsonb       not null default '[]'::jsonb,
  competitors     jsonb       not null default '[]'::jsonb,
  closed_reason   text,
  status_history  jsonb       not null default '[]'::jsonb,
  interactions    jsonb       not null default '[]'::jsonb,
  created_at      date        not null default current_date,
  updated_at      timestamptz not null default now(),
  primary key (owner_id, id)
);

-- Supports the Today workbench (open deals by due date).
create index if not exists customers_owner_due_idx on public.customers (owner_id, next_action_due);

create or replace function public.customers_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.next_action_due := null;
  if coalesce(new.next_action ->> 'dueDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      new.next_action_due := (new.next_action ->> 'dueDate')::date;
    exception when others then
      -- An impossible date (e.g. 2026-13-45) must not block saving the customer.
      new.next_action_due := null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists customers_before_write on public.customers;
create trigger customers_before_write
  before insert or update on public.customers
  for each row execute function public.customers_before_write();

alter table public.customers enable row level security;
alter table public.customers force row level security;

drop policy if exists "customers_select_own" on public.customers;
drop policy if exists "customers_insert_own" on public.customers;
drop policy if exists "customers_update_own" on public.customers;
drop policy if exists "customers_delete_own" on public.customers;

create policy "customers_select_own" on public.customers
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "customers_insert_own" on public.customers
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "customers_update_own" on public.customers
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "customers_delete_own" on public.customers
  for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.customers from anon;
grant select, insert, update, delete on public.customers to authenticated;

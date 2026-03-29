create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists debt_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  approver_id uuid not null references profiles(id) on delete cascade,
  amount_in_paise bigint not null check (amount_in_paise > 0),
  currency text not null default 'INR',
  reason text not null,
  debt_date date not null default current_date,
  due_at timestamptz,
  status text not null check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade,
  amount_in_paise bigint not null check (amount_in_paise > 0),
  currency text not null default 'INR',
  note text,
  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create view pair_balances as
select
  least(a_id, b_id) as user_a,
  greatest(a_id, b_id) as user_b,
  sum(delta_in_paise) as net_in_paise
from (
  select
    creator_id as a_id,
    approver_id as b_id,
    amount_in_paise as delta_in_paise
  from debt_requests
  where status = 'approved'

  union all

  select
    receiver_id as a_id,
    payer_id as b_id,
    -amount_in_paise as delta_in_paise
  from settlements
) ledger
group by 1, 2;

alter table profiles enable row level security;
alter table friendships enable row level security;
alter table debt_requests enable row level security;
alter table settlements enable row level security;

create policy "profiles are visible to signed in users"
on profiles for select
to authenticated
using (true);

create policy "users manage their own profile"
on profiles for all
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "friendships visible to participants"
on friendships for select
to authenticated
using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "participants can create friendships"
on friendships for insert
to authenticated
with check (auth.uid() = requester_id);

create policy "participants can update friendships"
on friendships for update
to authenticated
using (auth.uid() = requester_id or auth.uid() = addressee_id)
with check (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "debt requests visible to both parties"
on debt_requests for select
to authenticated
using (auth.uid() = creator_id or auth.uid() = approver_id);

create policy "creator can insert debt requests"
on debt_requests for insert
to authenticated
with check (auth.uid() = creator_id);

create policy "participants can update debt requests"
on debt_requests for update
to authenticated
using (auth.uid() = creator_id or auth.uid() = approver_id)
with check (auth.uid() = creator_id or auth.uid() = approver_id);

create policy "settlements visible to both parties"
on settlements for select
to authenticated
using (auth.uid() = payer_id or auth.uid() = receiver_id);

create policy "payer can create settlements"
on settlements for insert
to authenticated
with check (auth.uid() = payer_id);

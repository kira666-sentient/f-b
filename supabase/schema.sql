create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  upi_id text,
  created_at timestamptz not null default now()
);

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  constraint friendships_no_self check (requester_id <> addressee_id),
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists debt_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  approver_id uuid not null references profiles(id) on delete cascade,
  constraint debt_requests_no_self check (creator_id <> approver_id),
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
  constraint settlements_no_self check (payer_id <> receiver_id),
  amount_in_paise bigint not null check (amount_in_paise > 0),
  currency text not null default 'INR',
  note text,
  settled_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists shared_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  friend_id uuid not null references profiles(id) on delete cascade,
  item_name text not null,
  type text not null check (type in ('gave', 'borrowed')),
  status text not null default 'active' check (status in ('active', 'returned')),
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
  where status = 'approved'
) ledger
group by 1, 2;

create unique index if not exists friendships_pair_unique
on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

alter table profiles enable row level security;
alter table friendships enable row level security;
alter table debt_requests enable row level security;
alter table settlements enable row level security;
alter table shared_items enable row level security;

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

create policy "approver can update debt requests"
on debt_requests for update
to authenticated
using (auth.uid() = approver_id and status = 'pending')
with check (auth.uid() = approver_id);

create policy "settlements visible to both parties"
on settlements for select
to authenticated
using (auth.uid() = payer_id or auth.uid() = receiver_id);

create policy "payer can create settlements"
on settlements for insert
to authenticated
with check (auth.uid() = payer_id);

create policy "receiver can update settlements"
on settlements for update
to authenticated
using (auth.uid() = receiver_id and status = 'pending')
with check (auth.uid() = receiver_id);

create policy "shared items visible to both parties"
on shared_items for select
to authenticated
using (auth.uid() = owner_id or auth.uid() = friend_id);

create policy "owner can manage shared items"
on shared_items for all
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create index if not exists shared_items_owner_idx on shared_items (owner_id);
create index if not exists shared_items_friend_idx on shared_items (friend_id);

create or replace function validate_debt_request_update()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'pending' then
    raise exception 'This debt request has already been responded to.';
  end if;

  if auth.uid() is distinct from old.approver_id then
    raise exception 'Only the approver can respond to this debt request.';
  end if;

  if new.creator_id <> old.creator_id
    or new.approver_id <> old.approver_id
    or new.amount_in_paise <> old.amount_in_paise
    or new.currency <> old.currency
    or new.reason <> old.reason
    or new.debt_date <> old.debt_date
    or new.due_at is distinct from old.due_at
    or new.created_at <> old.created_at then
    raise exception 'Debt request details cannot be edited after creation.';
  end if;

  if new.status not in ('approved', 'rejected') then
    raise exception 'Debt requests can only be approved or rejected.';
  end if;

  if new.status = 'approved' and (new.approved_at is null or new.rejected_at is not null) then
    raise exception 'Approved debt requests must only set approved_at.';
  end if;

  if new.status = 'rejected' and (new.rejected_at is null or new.approved_at is not null) then
    raise exception 'Rejected debt requests must only set rejected_at.';
  end if;

  return new;
end;
$$;

drop trigger if exists debt_request_update_guard on debt_requests;

create trigger debt_request_update_guard
before update on debt_requests
for each row
execute function validate_debt_request_update();

create or replace function validate_settlement_update()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'pending' then
    raise exception 'This settlement has already been responded to.';
  end if;

  if auth.uid() is distinct from old.receiver_id then
    raise exception 'Only the receiver can respond to this settlement.';
  end if;

  if new.payer_id <> old.payer_id
    or new.receiver_id <> old.receiver_id
    or new.amount_in_paise <> old.amount_in_paise
    or new.currency <> old.currency
    or new.note is distinct from old.note
    or new.settled_at <> old.settled_at
    or new.created_at <> old.created_at then
    raise exception 'Settlement details cannot be edited after creation.';
  end if;

  if new.status not in ('approved', 'rejected') then
    raise exception 'Settlements can only be approved or rejected.';
  end if;

  if new.status = 'approved' and (new.approved_at is null or new.rejected_at is not null) then
    raise exception 'Approved settlements must only set approved_at.';
  end if;

  if new.status = 'rejected' and (new.rejected_at is null or new.approved_at is not null) then
    raise exception 'Rejected settlements must only set rejected_at.';
  end if;

  return new;
end;
$$;

drop trigger if exists settlement_update_guard on settlements;

create trigger settlement_update_guard
before update on settlements
for each row
execute function validate_settlement_update();

-- Create shared_items table for shared physical items tracking
create table if not exists shared_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  friend_id uuid not null references profiles(id) on delete cascade,
  item_name text not null,
  type text not null check (type in ('gave', 'borrowed')),
  status text not null default 'active' check (status in ('active', 'returned')),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table shared_items enable row level security;

-- Policies
create policy "shared items visible to both parties"
on shared_items for select
to authenticated
using (auth.uid() = owner_id or auth.uid() = friend_id);

create policy "owner can manage shared items"
on shared_items for all
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

-- GID on owner/friend for performance
create index if not exists shared_items_owner_idx on shared_items (owner_id);
create index if not exists shared_items_friend_idx on shared_items (friend_id);

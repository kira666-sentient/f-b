-- Create policy to allow friend to update the status
create policy "friend can update shared items"
on shared_items for update
to authenticated
using (auth.uid() = friend_id)
with check (auth.uid() = friend_id);

-- Validate shared item updates based on business logic
create or replace function validate_shared_item_update()
returns trigger
language plpgsql
as $$
begin
  -- Prevent modification of immutable fields
  if new.owner_id <> old.owner_id
    or new.friend_id <> old.friend_id
    or new.item_name <> old.item_name
    or new.type <> old.type
    or new.created_at <> old.created_at then
    raise exception 'Shared item details (owner, friend, name, type, created_at) cannot be edited.';
  end if;

  -- Friend approvals/rejections of pending items
  if old.status = 'pending' then
    if new.status not in ('active', 'rejected') then
      raise exception 'Pending items can only be made active or rejected.';
    end if;
    if auth.uid() is distinct from old.friend_id then
      raise exception 'Only the friend (recipient) can approve or reject a pending item request.';
    end if;
  end if;

  -- Active items being marked for return
  if old.status = 'active' then
    if new.status <> 'pending_return' and new.status <> 'returned' then
      raise exception 'Active items can only transition to pending_return or returned.';
    end if;
    -- Note: If we allow owner_id to skip pending_return and just mark it 'returned', we check for 'returned'
    if new.status = 'returned' and auth.uid() is distinct from old.owner_id then
      raise exception 'Only the owner can directly confirm an item is returned.';
    end if;
  end if;

  -- Pending return items being confirmed
  if old.status = 'pending_return' then
    if new.status <> 'returned' then
      raise exception 'Items pending return can only transition to returned.';
    end if;
    if auth.uid() is distinct from old.owner_id then
      raise exception 'Only the owner can confirm the item is returned.';
    end if;
  end if;

  -- Terminal states cannot be changed
  if old.status in ('returned', 'rejected') then
    raise exception 'Returned or rejected items cannot be modified further.';
  end if;

  return new;
end;
$$;

drop trigger if exists shared_item_update_guard on shared_items;

create trigger shared_item_update_guard
before update on shared_items
for each row
execute function validate_shared_item_update();

-- DB Integrity and Speed Check Script
-- Run this in the Supabase SQL Editor AFTER running v2_fix_shared_items.sql

-- DB Integrity and Speed Check Script
-- Run this in the Supabase SQL Editor AFTER running v2_fix_shared_items.sql

with verification_results as (
  select 
    'Policy: friend can update shared items' as test_name,
    exists (select 1 from pg_policies where policyname = 'friend can update shared items' and tablename = 'shared_items') as passed
  union all
  select 
    'Trigger: shared_item_update_guard' as test_name,
    exists (select 1 from pg_trigger where tgname = 'shared_item_update_guard') as passed
  union all
  select 
    'Index: shared_items_owner_idx' as test_name,
    exists (select 1 from pg_indexes where indexname = 'shared_items_owner_idx') as passed
  union all
  select 
    'Index: shared_items_friend_idx' as test_name,
    exists (select 1 from pg_indexes where indexname = 'shared_items_friend_idx') as passed
)
select 
  test_name,
  case when passed then '✅ PASS' else '❌ FAIL' end as status
from verification_results;

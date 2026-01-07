-- Clean sessions RLS policies
-- Consolidates all previous attempts into one clean migration

-- Drop ALL existing sessions policies to start fresh
drop policy if exists "Pool owners can create sessions" on sessions;
drop policy if exists "Pool owners can update sessions" on sessions;
drop policy if exists "Pool members can view sessions" on sessions;

-- Create/ensure the is_pool_owner function exists and is correct
-- This function bypasses RLS to check ownership
drop function if exists is_pool_owner(uuid, uuid);

create function is_pool_owner(pool_uuid uuid, user_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  -- Security definer runs as postgres, bypassing RLS
  select exists (
    select 1
    from pools
    where id = pool_uuid
      and owner_id = user_uuid
  );
$$;

-- Ensure function is owned by postgres
alter function is_pool_owner(uuid, uuid) owner to postgres;

-- Grant execute permission
grant execute on function is_pool_owner(uuid, uuid) to authenticated, anon, service_role;

-- Recreate SELECT policy (pool members can view)
create policy "Pool members can view sessions" on sessions
  for select using (
    pool_id in (
      select pp.pool_id from pool_players pp
      join players p on pp.player_id = p.id
      where p.user_id = auth.uid()
    )
    -- Also allow pool owners to see their sessions
    or pool_id in (
      select id from pools where owner_id = auth.uid()
    )
  );

-- Create INSERT policy (pool owners can create)
-- Use the EXACT same pattern as registration_links which works
-- The function approach isn't working, so use direct subquery like registration_links
create policy "Pool owners can create sessions" on sessions
  for insert with check (
    pool_id in (
      select id from pools where owner_id = auth.uid()
    )
  );

-- Create UPDATE policy (pool owners can update)
create policy "Pool owners can update sessions" on sessions
  for update using (
    pool_id in (
      select id from pools where owner_id = auth.uid()
    )
  );


-- Fix infinite recursion in pool_players RLS policy
-- The "Pool members can view pool_players" policy was querying pool_players itself,
-- causing infinite recursion. This migration replaces it with a security definer function.

-- Drop the recursive policy
drop policy if exists "Pool members can view pool_players" on pool_players;

-- Create function to check if user is a pool member (bypasses RLS to avoid recursion)
create or replace function user_is_pool_member(pool_uuid uuid, user_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from pool_players pp
    join players p on pp.player_id = p.id
    where pp.pool_id = pool_uuid
      and p.user_id = user_uuid
      and pp.is_active = true
  );
$$;

-- Recreate the policy using the security definer function
create policy "Pool members can view pool_players" on pool_players
  for select using (
    user_is_pool_member(pool_id, auth.uid())
  );


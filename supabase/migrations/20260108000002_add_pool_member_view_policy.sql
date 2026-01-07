-- Allow pool members to view pools they belong to
-- Currently only owners and public (via registration links) can view pools

-- Create or replace the user_is_pool_member function to check if a user is a member of a pool
create or replace function user_is_pool_member(p_pool_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 
    from pool_players pp
    join players p on pp.player_id = p.id
    where pp.pool_id = p_pool_id 
      and p.user_id = p_user_id
      and pp.is_active = true
  );
$$;

-- Add policy for pool members to view their pools
create policy "Pool members can view their pools" on pools
  for select
  using (
    user_is_pool_member(id, auth.uid())
  );


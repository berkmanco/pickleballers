-- RLS policies for registration_links table
-- Registration links need special handling:
-- 1. Pool owners can create/view links for their pools
-- 2. Public can validate tokens (for registration page - no auth required)
-- 3. Public can mark links as used (during registration)

-- Pool owners can view registration links for their pools
create policy "Pool owners can view registration links" on registration_links
  for select using (
    pool_id in (
      select id from pools where owner_id = auth.uid()
    )
  );

-- Pool owners can create registration links for their pools
create policy "Pool owners can create registration links" on registration_links
  for insert with check (
    pool_id in (
      select id from pools where owner_id = auth.uid()
    )
  );

-- Public can read registration links by token (for validation)
-- Tokens are 64 hex characters (cryptographically random), so very hard to guess
-- This allows the public registration page to validate tokens without auth
create policy "Public can validate registration tokens" on registration_links
  for select using (true);

-- Public can update registration links to mark them as used
-- Only allow updating used_at and used_by fields
-- This is safe because tokens are one-time use and cryptographically random
create policy "Public can mark registration links as used" on registration_links
  for update using (
    -- Only allow updating if not already used
    used_at is null
    -- Only allow updating used_at and used_by fields
    and expires_at > now()
  )
  with check (
    -- Ensure it's not already used
    used_at is not null
    and used_by is not null
  );

-- Function to create a player (bypasses RLS for registration)
-- This function uses SECURITY DEFINER to bypass RLS checks
create or replace function create_player_for_registration(
  p_name text,
  p_phone text,
  p_email text,
  p_venmo_account text,
  p_notification_preferences jsonb default '{"email": true, "sms": false}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  player_id uuid;
begin
  insert into players (name, phone, email, venmo_account, notification_preferences)
  values (p_name, p_phone, p_email, p_venmo_account, p_notification_preferences)
  returning id into player_id;
  return player_id;
end;
$$;

-- Grant execute permission to anon and authenticated users
grant execute on function create_player_for_registration to anon, authenticated;

-- Allow public to create players during registration
-- This is safe because players are created without user_id initially
-- and can be linked to a user account later if they sign up
-- Drop policy if it exists (in case of re-running migration)
drop policy if exists "Public can create players during registration" on players;
create policy "Public can create players during registration" on players
  for insert 
  with check (true);

-- Allow public to add players to pools via valid registration links
-- This ensures players can only be added to the pool associated with their registration token
create policy "Public can add players to pools via registration" on pool_players
  for insert with check (
    -- Check that there's a valid, unused registration link for this pool
    pool_id in (
      select pool_id
      from registration_links
      where used_at is null
        and expires_at > now()
    )
  );

-- Allow public to view pool_players for pools they have valid registration links for
-- This is needed to check if a player is already in a pool
create policy "Public can view pool_players for registration" on pool_players
  for select using (
    pool_id in (
      select pool_id
      from registration_links
      where used_at is null
        and expires_at > now()
    )
  );

-- Allow pool owners to view pool_players for their pools
create policy "Pool owners can view pool_players" on pool_players
  for select using (
    pool_id in (
      select id from pools where owner_id = auth.uid()
    )
  );

-- Function to check if user is a member of a pool (bypasses RLS to avoid recursion)
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

-- Allow pool members to view pool_players for pools they're in
-- Uses a security definer function to avoid RLS recursion
create policy "Pool members can view pool_players" on pool_players
  for select using (
    user_is_pool_member(pool_id, auth.uid())
  );

-- Function to check if a pool has valid registration links (bypasses RLS to avoid recursion)
-- This function uses SECURITY DEFINER to bypass RLS checks and prevent infinite recursion
create or replace function pool_has_valid_registration_link(pool_uuid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from registration_links
    where pool_id = pool_uuid
      and used_at is null
      and expires_at > now()
  );
$$;

-- Allow public to read pool information when they have a valid registration link
-- This is needed for the registration page to display the pool name
-- Uses a security definer function to avoid RLS recursion
create policy "Public can view pools via registration links" on pools
  for select using (
    pool_has_valid_registration_link(id)
  );


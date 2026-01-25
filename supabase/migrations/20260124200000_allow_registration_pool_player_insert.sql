-- Fix registration flow to support both token-based and slug-based registration
-- Token-based: uses registration_links table (legacy)
-- Slug-based: uses registration_enabled flag (new multi-use)

-- Drop existing policies
DROP POLICY IF EXISTS "Pool owners or registration can add players" ON pool_players;
DROP POLICY IF EXISTS "allow_registration_pool_player_insert" ON pool_players;

-- Create comprehensive policy that allows:
-- 1. Pool owners can add players to their pools
-- 2. Via valid registration link (token-based, legacy)
-- 3. Via slug-based registration (new multi-use)
CREATE POLICY "Pool owners or registration can add players" ON pool_players FOR INSERT WITH CHECK (
  -- Pool owners can add players to their pools
  pool_id IN (SELECT id FROM pools WHERE owner_id = (select auth.uid()))
  -- Or via valid token-based registration link (legacy)
  OR pool_id IN (SELECT pool_id FROM registration_links WHERE used_at IS NULL AND expires_at > now())
  -- Or via slug-based registration (new multi-use)
  OR pool_id IN (SELECT id FROM pools WHERE registration_enabled = true)
);

-- Comment for documentation
COMMENT ON POLICY "Pool owners or registration can add players" ON pool_players IS 
  'Allows pool owners to add players, or registration via valid token links or enabled slug-based registration';

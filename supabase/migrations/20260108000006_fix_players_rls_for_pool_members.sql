-- Fix players RLS to allow pool members to see other players in their pools
-- Uses SECURITY DEFINER functions to avoid infinite recursion

-- Helper function to get pool IDs for a user
CREATE OR REPLACE FUNCTION get_user_pool_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT pp.pool_id
  FROM pool_players pp
  JOIN players p ON pp.player_id = p.id
  WHERE p.user_id = p_user_id;
$$;

-- Helper function to get player IDs in a user's pools
CREATE OR REPLACE FUNCTION get_players_in_user_pools(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT pp.player_id
  FROM pool_players pp
  WHERE pp.pool_id IN (
    SELECT get_user_pool_ids(p_user_id)
  );
$$;

-- Drop old policy and create new one
DROP POLICY IF EXISTS "Users can view players in their pools" ON players;

CREATE POLICY "Users can view players in their pools" ON players
  FOR SELECT
  USING (
    -- Own player record
    user_id = auth.uid()
    OR
    -- Players in any pool the user is a member of
    id IN (SELECT get_players_in_user_pools(auth.uid()))
  );

-- ============================================
-- Fix pool_players RLS to allow owners to add existing players
-- ============================================

-- Drop the existing restrictive insert policy
DROP POLICY IF EXISTS "Public can add players via registration" ON pool_players;

-- Create new policy that allows:
-- 1. Inserts via registration links (existing behavior)
-- 2. Pool owners can add any player to their pools
CREATE POLICY "Pool owners or registration can add players" ON pool_players FOR INSERT WITH CHECK (
  -- Pool owners can add players to their pools
  pool_id IN (SELECT id FROM pools WHERE owner_id = (select auth.uid()))
  -- Or via valid registration link
  OR pool_id IN (SELECT pool_id FROM registration_links WHERE used_at IS NULL AND expires_at > now())
);

-- Also add update policy for pool owners (to reactivate players)
CREATE POLICY "Pool owners can update pool_players" ON pool_players FOR UPDATE USING (
  pool_id IN (SELECT id FROM pools WHERE owner_id = (select auth.uid()))
);

-- Add delete policy for pool owners (to remove players from pool)
CREATE POLICY "Pool owners can delete pool_players" ON pool_players FOR DELETE USING (
  pool_id IN (SELECT id FROM pools WHERE owner_id = (select auth.uid()))
);

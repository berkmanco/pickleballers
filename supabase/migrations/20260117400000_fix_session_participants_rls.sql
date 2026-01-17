-- ============================================
-- Fix session_participants RLS for admins adding players
-- ============================================

-- Drop existing restrictive insert policy
DROP POLICY IF EXISTS "Players can insert their own participation" ON session_participants;

-- New policy: Players can add themselves OR pool owners can add anyone
CREATE POLICY "Players or pool owners can insert participation" ON session_participants FOR INSERT WITH CHECK (
  -- Players can add themselves
  player_id IN (SELECT id FROM players WHERE user_id = (select auth.uid()))
  -- Pool owners can add any player to sessions in their pools
  OR session_id IN (
    SELECT s.id FROM sessions s
    JOIN pools p ON s.pool_id = p.id
    WHERE p.owner_id = (select auth.uid())
  )
);

-- Also fix UPDATE policy to allow pool owners to update any participant
DROP POLICY IF EXISTS "Players can update their own participation" ON session_participants;

CREATE POLICY "Players or pool owners can update participation" ON session_participants FOR UPDATE USING (
  -- Players can update their own
  player_id IN (SELECT id FROM players WHERE user_id = (select auth.uid()))
  -- Pool owners can update any participant in their sessions
  OR session_id IN (
    SELECT s.id FROM sessions s
    JOIN pools p ON s.pool_id = p.id
    WHERE p.owner_id = (select auth.uid())
  )
);

-- Add DELETE policy for pool owners (to remove participants)
CREATE POLICY "Pool owners can delete participants" ON session_participants FOR DELETE USING (
  session_id IN (
    SELECT s.id FROM sessions s
    JOIN pools p ON s.pool_id = p.id
    WHERE p.owner_id = (select auth.uid())
  )
);

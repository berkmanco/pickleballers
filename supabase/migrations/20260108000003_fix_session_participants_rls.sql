-- Fix session_participants RLS to also allow pool OWNERS to view participants
-- Currently only pool MEMBERS can view, but owners should too

-- Drop the existing policy
DROP POLICY IF EXISTS "Pool members can view participants" ON session_participants;

-- Create new policy that allows both pool members AND pool owners
CREATE POLICY "Pool members and owners can view participants" ON session_participants
  FOR SELECT
  USING (
    session_id IN (
      SELECT s.id FROM sessions s
      WHERE s.pool_id IN (
        -- Pool members
        SELECT pp.pool_id FROM pool_players pp
        JOIN players p ON pp.player_id = p.id
        WHERE p.user_id = auth.uid()
      )
      OR s.pool_id IN (
        -- Pool owners
        SELECT pools.id FROM pools
        WHERE pools.owner_id = auth.uid()
      )
    )
  );


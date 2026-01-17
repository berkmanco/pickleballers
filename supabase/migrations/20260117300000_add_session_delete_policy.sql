-- ============================================
-- Add DELETE policy for sessions
-- ============================================
-- Pool owners can delete sessions in their pools

CREATE POLICY "Pool owners can delete sessions" ON sessions FOR DELETE USING (
  pool_id IN (SELECT id FROM pools WHERE owner_id = (select auth.uid()))
);

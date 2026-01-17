-- ============================================
-- Fix Supabase linter warnings
-- ============================================

-- ===================
-- 1. DROP DUPLICATE INDEXES
-- ===================
-- These duplicate indexes from the initial schema

DROP INDEX IF EXISTS idx_payments_session_participant_id;  -- duplicate of idx_payments_participant
DROP INDEX IF EXISTS idx_players_user_id;                  -- duplicate of idx_players_user
DROP INDEX IF EXISTS idx_pool_players_player_id;           -- duplicate of idx_pool_players_player
DROP INDEX IF EXISTS idx_pool_players_pool_id;             -- duplicate of idx_pool_players_pool
DROP INDEX IF EXISTS idx_pools_owner_id;                   -- duplicate of idx_pools_owner
DROP INDEX IF EXISTS idx_registration_links_pool_id;       -- duplicate of idx_registration_links_pool
DROP INDEX IF EXISTS idx_session_participants_player_id;   -- duplicate of idx_session_participants_player
DROP INDEX IF EXISTS idx_session_participants_session_id;  -- duplicate of idx_session_participants_session
DROP INDEX IF EXISTS idx_sessions_pool_id;                 -- duplicate of idx_sessions_pool
DROP INDEX IF EXISTS idx_sessions_proposed_date;           -- duplicate of idx_sessions_date

-- ===================
-- 2. FIX notifications_log RLS POLICIES
-- ===================
-- Problem: Two separate SELECT policies both run, and they don't use (select auth.uid())
-- Solution: Merge into one policy with proper syntax

DROP POLICY IF EXISTS "Pool owners can view session notifications" ON notifications_log;
DROP POLICY IF EXISTS "Players can view own notifications" ON notifications_log;

-- Single merged SELECT policy with proper (select auth.uid()) syntax
CREATE POLICY "Users can view relevant notifications" ON notifications_log FOR SELECT USING (
  -- Players can see notifications about themselves
  player_id IN (SELECT id FROM players WHERE user_id = (select auth.uid()))
  -- Pool owners can see all notifications for sessions in their pools
  OR session_id IN (
    SELECT s.id FROM sessions s
    JOIN pools p ON s.pool_id = p.id
    WHERE p.owner_id = (select auth.uid())
  )
);

-- Fix INSERT policy to use (select auth.uid())
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON notifications_log;
CREATE POLICY "Authenticated can insert notifications" ON notifications_log FOR INSERT 
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ===================
-- 3. FIX venmo_transactions RLS POLICY  
-- ===================
-- Problem: Doesn't use (select auth.uid())

DROP POLICY IF EXISTS "Pool owners can view linked transactions" ON venmo_transactions;

CREATE POLICY "Pool owners can view linked transactions" ON venmo_transactions FOR SELECT USING (
  payment_id IN (
    SELECT pay.id FROM payments pay
    JOIN session_participants sp ON pay.session_participant_id = sp.id
    JOIN sessions s ON sp.session_id = s.id
    JOIN pools p ON s.pool_id = p.id
    WHERE p.owner_id = (select auth.uid())
  )
);

-- ===================
-- 4. FIX players INSERT policy
-- ===================
DROP POLICY IF EXISTS "Authenticated users can create players" ON players;
CREATE POLICY "Authenticated users can create players" ON players FOR INSERT 
  WITH CHECK ((select auth.uid()) IS NOT NULL);

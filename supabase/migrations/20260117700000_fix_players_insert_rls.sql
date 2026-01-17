-- Fix players INSERT policy to allow pool owners to create players

-- Drop existing INSERT policies on players (some may not exist, that's OK)
DROP POLICY IF EXISTS "Public can create players during registration" ON players;
DROP POLICY IF EXISTS "Authenticated users can create players" ON players;

-- Create a clear policy: authenticated users can create players
CREATE POLICY "Authenticated users can create players" ON players FOR INSERT 
WITH CHECK (
  (select auth.uid()) IS NOT NULL
);

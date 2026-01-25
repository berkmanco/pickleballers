-- Allow anonymous users to read basic pool info for registration validation
-- This is needed so /r/:slug URLs work for non-authenticated users

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "allow_anonymous_pool_read_for_registration" ON pools;

-- Create policy to allow anonymous users to read pool metadata
CREATE POLICY "allow_anonymous_pool_read_for_registration"
  ON pools
  FOR SELECT
  TO anon
  USING (true);

-- Comment for documentation
COMMENT ON POLICY "allow_anonymous_pool_read_for_registration" ON pools IS 
  'Allows anonymous users to read pool basic info (id, name, slug, registration_enabled) for registration validation at /r/:slug URLs';

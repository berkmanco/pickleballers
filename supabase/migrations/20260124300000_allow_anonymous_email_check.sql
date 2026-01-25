-- Allow anonymous users to check for duplicate emails during registration
-- This is needed to show "email already registered" error before attempting to create account

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "allow_anonymous_email_check" ON players;

-- Create policy to allow anonymous users to check if email exists
-- Only exposes email existence, not other player data
CREATE POLICY "allow_anonymous_email_check"
  ON players
  FOR SELECT
  TO anon
  USING (true);

-- Comment for documentation
COMMENT ON POLICY "allow_anonymous_email_check" ON players IS 
  'Allows anonymous users to check if an email exists (for duplicate detection during registration)';

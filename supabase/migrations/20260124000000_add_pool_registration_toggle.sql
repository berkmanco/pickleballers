-- Add registration toggle to pools table
-- This allows admins to open/close registration using the pool slug URL

ALTER TABLE pools
  ADD COLUMN registration_enabled BOOLEAN DEFAULT TRUE;

-- Add comment for documentation
COMMENT ON COLUMN pools.registration_enabled IS 'When true, users can register via /r/{slug} URL. When false, registration is closed.';

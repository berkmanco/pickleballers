-- When a pool is created, automatically add the owner as a player/member
-- This ensures pool owners can:
-- 1. See session participants (via member RLS policy)
-- 2. Opt into their own sessions
-- 3. Be tracked consistently as players

-- Create function to add owner to pool after creation
CREATE OR REPLACE FUNCTION add_owner_to_pool()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_user_email text;
BEGIN
  -- Get the user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = NEW.owner_id;
  
  -- Find or create player record for the owner
  SELECT id INTO v_player_id
  FROM players
  WHERE user_id = NEW.owner_id;
  
  -- If no player exists, create one
  IF v_player_id IS NULL THEN
    INSERT INTO players (name, email, user_id, venmo_account, notification_preferences)
    VALUES (
      COALESCE(split_part(v_user_email, '@', 1), 'Pool Owner'),
      v_user_email,
      NEW.owner_id,
      '', -- They can update their Venmo later
      '{"email": true, "sms": false}'::jsonb
    )
    RETURNING id INTO v_player_id;
  END IF;
  
  -- Add player to pool_players (if not already there)
  INSERT INTO pool_players (pool_id, player_id, is_active)
  VALUES (NEW.id, v_player_id, true)
  ON CONFLICT (pool_id, player_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run after pool creation
DROP TRIGGER IF EXISTS add_owner_to_pool_trigger ON pools;
CREATE TRIGGER add_owner_to_pool_trigger
  AFTER INSERT ON pools
  FOR EACH ROW
  EXECUTE FUNCTION add_owner_to_pool();

-- Also add Mike to the "jv" pool he created (retroactive fix)
DO $$
DECLARE
  v_player_id uuid;
BEGIN
  -- Get Mike's player ID
  SELECT id INTO v_player_id FROM players WHERE email = 'mike@berkman.co';
  
  -- Add to jv pool if not already there
  IF v_player_id IS NOT NULL THEN
    INSERT INTO pool_players (pool_id, player_id, is_active)
    SELECT 'b1d493a4-6337-4618-90a3-de0926393b66', v_player_id, true
    WHERE NOT EXISTS (
      SELECT 1 FROM pool_players 
      WHERE pool_id = 'b1d493a4-6337-4618-90a3-de0926393b66' 
      AND player_id = v_player_id
    );
  END IF;
END;
$$;


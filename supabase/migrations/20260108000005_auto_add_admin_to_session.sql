-- When a session is created, automatically add the pool owner as a participant
-- The admin always plays (per business rules)

CREATE OR REPLACE FUNCTION add_admin_to_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_player_id uuid;
BEGIN
  -- Get the pool owner
  SELECT owner_id INTO v_owner_id
  FROM pools
  WHERE id = NEW.pool_id;
  
  -- Get their player record
  SELECT id INTO v_player_id
  FROM players
  WHERE user_id = v_owner_id;
  
  -- If we found a player record, add them as admin participant
  IF v_player_id IS NOT NULL THEN
    INSERT INTO session_participants (
      session_id, 
      player_id, 
      is_admin, 
      status,
      opted_in_at,
      status_changed_at
    )
    VALUES (
      NEW.id,
      v_player_id,
      true,  -- is_admin
      'committed',
      now(),
      now()
    )
    ON CONFLICT (session_id, player_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run after session creation
DROP TRIGGER IF EXISTS add_admin_to_session_trigger ON sessions;
CREATE TRIGGER add_admin_to_session_trigger
  AFTER INSERT ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION add_admin_to_session();

-- Retroactive fix: Add Mike to the session he created in "jv" pool
DO $$
DECLARE
  v_player_id uuid;
  v_session_id uuid := '70db9fe7-f6da-4e75-b086-e322fd88f96c';
BEGIN
  -- Get Mike's player ID
  SELECT id INTO v_player_id FROM players WHERE email = 'mike@berkman.co';
  
  -- Add to session if not already there
  IF v_player_id IS NOT NULL THEN
    INSERT INTO session_participants (session_id, player_id, is_admin, status, opted_in_at, status_changed_at)
    SELECT v_session_id, v_player_id, true, 'committed', now(), now()
    WHERE NOT EXISTS (
      SELECT 1 FROM session_participants 
      WHERE session_id = v_session_id 
      AND player_id = v_player_id
    );
  END IF;
END;
$$;


-- Create a SECURITY DEFINER function to create players for pools
-- This bypasses RLS since pool owners need to create players who don't have user accounts yet

CREATE OR REPLACE FUNCTION create_player_for_pool(
  p_pool_id uuid,
  p_name text,
  p_venmo_account text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_owner_id uuid;
BEGIN
  -- Verify the caller owns this pool
  SELECT owner_id INTO v_owner_id FROM pools WHERE id = p_pool_id;
  
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Pool not found';
  END IF;
  
  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Only pool owners can add players';
  END IF;

  -- Create the player
  INSERT INTO players (name, email, phone, venmo_account, is_active, notification_preferences)
  VALUES (
    p_name,
    p_email,
    p_phone,
    p_venmo_account,
    true,
    jsonb_build_object('email', p_email IS NOT NULL, 'sms', p_phone IS NOT NULL)
  )
  RETURNING id INTO v_player_id;

  -- Add to pool
  INSERT INTO pool_players (pool_id, player_id, is_active)
  VALUES (p_pool_id, v_player_id, true);

  RETURN v_player_id;
END;
$$;

COMMENT ON FUNCTION create_player_for_pool IS 'Creates a player and adds them to a pool. Only pool owners can call this.';

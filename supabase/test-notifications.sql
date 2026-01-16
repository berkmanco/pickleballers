-- =============================================
-- DinkUp Notification Test Setup Script
-- Run this in Supabase SQL Editor to set up test data
-- =============================================

-- First, let's see what we have to work with
-- Uncomment these to check current state:

-- SELECT id, name FROM pools LIMIT 5;
-- SELECT id, proposed_date, status, pool_id FROM sessions ORDER BY created_at DESC LIMIT 5;
-- SELECT id, name, email FROM players LIMIT 10;

-- =============================================
-- OPTION A: Set up a LOCKED session with PENDING payments
-- (For testing: roster_locked, payment_reminder)
-- =============================================

DO $$
DECLARE
  v_pool_id uuid;
  v_session_id uuid;
  v_owner_id uuid;
  v_player_id uuid;
  v_participant_id uuid;
  v_payment_id uuid;
BEGIN
  -- Get the first pool and its owner
  SELECT id, owner_id INTO v_pool_id, v_owner_id 
  FROM pools 
  LIMIT 1;

  IF v_pool_id IS NULL THEN
    RAISE EXCEPTION 'No pools found. Create a pool first.';
  END IF;

  -- Create a test session
  INSERT INTO sessions (
    pool_id, 
    proposed_date, 
    proposed_time, 
    court_location,
    status,
    min_players,
    max_players,
    total_cost,
    owner_cost
  ) VALUES (
    v_pool_id,
    CURRENT_DATE + 1, -- Tomorrow
    '18:00',
    'Test Court',
    'locked', -- Already locked
    4,
    8,
    64.00,
    16.00
  ) RETURNING id INTO v_session_id;

  RAISE NOTICE 'Created session: %', v_session_id;

  -- Get a player from the pool (not the owner)
  SELECT pp.player_id INTO v_player_id
  FROM pool_players pp
  WHERE pp.pool_id = v_pool_id
    AND pp.player_id != v_owner_id
    AND pp.is_active = true
  LIMIT 1;

  IF v_player_id IS NULL THEN
    -- Use owner if no other players
    v_player_id := v_owner_id;
  END IF;

  -- Add player as committed participant
  INSERT INTO session_participants (
    session_id,
    player_id,
    status,
    opted_in_at
  ) VALUES (
    v_session_id,
    v_player_id,
    'committed',
    NOW()
  ) RETURNING id INTO v_participant_id;

  -- Create a pending payment
  v_payment_id := gen_random_uuid();
  INSERT INTO payments (
    id,
    session_participant_id,
    amount,
    payment_method,
    status,
    venmo_payment_link
  ) VALUES (
    v_payment_id,
    v_participant_id,
    16.00,
    'venmo',
    'pending',
    'https://venmo.com/test?txn=pay&amount=16.00&note=Test%20Payment%20%23dinkup-' || v_payment_id
  );

  RAISE NOTICE 'Created participant: % with payment: %', v_participant_id, v_payment_id;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Test session ready!';
  RAISE NOTICE 'Session ID: %', v_session_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Test these notifications:';
  RAISE NOTICE '  roster_locked: {"type": "roster_locked", "sessionId": "%"}', v_session_id;
  RAISE NOTICE '  payment_reminder: {"type": "payment_reminder", "sessionId": "%"}', v_session_id;
END $$;

-- =============================================
-- OPTION B: Add a WAITLISTED player to an existing session
-- (For testing: waitlist_promoted)
-- =============================================

-- Uncomment and modify session_id to use:
/*
DO $$
DECLARE
  v_session_id uuid := 'YOUR-SESSION-ID-HERE';
  v_player_id uuid;
  v_participant_id uuid;
BEGIN
  -- Get a player not already in this session
  SELECT p.id INTO v_player_id
  FROM players p
  WHERE p.id NOT IN (
    SELECT sp.player_id FROM session_participants sp WHERE sp.session_id = v_session_id
  )
  LIMIT 1;

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'No available players to add to waitlist';
  END IF;

  -- Add as waitlisted
  INSERT INTO session_participants (
    session_id,
    player_id,
    status,
    opted_in_at
  ) VALUES (
    v_session_id,
    v_player_id,
    'waitlisted',
    NOW()
  ) RETURNING id INTO v_participant_id;

  RAISE NOTICE '✅ Added waitlisted player: %', v_player_id;
  RAISE NOTICE 'Test: {"type": "waitlist_promoted", "sessionId": "%", "playerId": "%"}', v_session_id, v_player_id;
END $$;
*/

-- =============================================
-- CLEANUP: Remove test sessions (if needed)
-- =============================================

-- Uncomment to clean up:
/*
DELETE FROM payments WHERE session_participant_id IN (
  SELECT id FROM session_participants WHERE session_id IN (
    SELECT id FROM sessions WHERE court_location = 'Test Court'
  )
);
DELETE FROM session_participants WHERE session_id IN (
  SELECT id FROM sessions WHERE court_location = 'Test Court'
);
DELETE FROM sessions WHERE court_location = 'Test Court';
*/

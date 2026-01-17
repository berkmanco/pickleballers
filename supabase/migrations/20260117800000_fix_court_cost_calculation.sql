-- Fix court cost calculation to use session's courts_needed instead of auto-calculating
-- This ensures admins pay for the courts they actually reserved

CREATE OR REPLACE FUNCTION get_session_cost_summary(p_session_id uuid)
RETURNS TABLE (
  total_players integer,
  guest_count integer,
  courts_needed integer,
  admin_cost decimal,
  guest_pool decimal,
  guest_cost decimal
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_admin_cost_per_court decimal;
  v_guest_pool_per_court decimal;
  v_session_courts_needed integer;
  v_total integer;
  v_guests integer;
BEGIN
  -- Get session cost settings AND the reserved courts
  SELECT s.admin_cost_per_court, s.guest_pool_per_court, s.courts_needed
  INTO v_admin_cost_per_court, v_guest_pool_per_court, v_session_courts_needed
  FROM sessions s WHERE s.id = p_session_id;
  
  -- Count committed/paid participants
  SELECT 
    count(*) FILTER (WHERE sp.status IN ('committed', 'paid')),
    count(*) FILTER (WHERE sp.status IN ('committed', 'paid') AND NOT sp.is_admin)
  INTO v_total, v_guests
  FROM session_participants sp
  WHERE sp.session_id = p_session_id;
  
  -- Use session's courts_needed (what admin reserved), not auto-calculated
  -- This ensures cost reflects actual court reservations
  RETURN QUERY SELECT
    v_total,
    v_guests,
    v_session_courts_needed,
    (v_admin_cost_per_court * v_session_courts_needed),
    (v_guest_pool_per_court * v_session_courts_needed),
    CASE WHEN v_guests > 0 
      THEN (v_guest_pool_per_court * v_session_courts_needed) / v_guests
      ELSE 0::decimal
    END;
END;
$$;

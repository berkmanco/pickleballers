-- ============================================
-- DinkUp Database Schema
-- ============================================
-- Single consolidated migration for clean database setup.
-- Includes: tables, enums, functions, triggers, indexes, and RLS policies.
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE session_status AS ENUM ('proposed', 'confirmed', 'cancelled', 'completed');
CREATE TYPE participant_status AS ENUM ('committed', 'paid', 'maybe', 'out');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded', 'forgiven');

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Generate registration token
CREATE OR REPLACE FUNCTION generate_registration_token()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  RETURN encode(extensions.gen_random_bytes(32), 'hex');
END;
$$;

-- Generate URL slug from text
CREATE OR REPLACE FUNCTION generate_slug(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        trim(input_text),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );
END;
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- TABLES
-- ============================================

-- Pools (groups of players)
CREATE TABLE pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  slug text UNIQUE NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Players (people who play pickleball)
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE,
  name text NOT NULL,
  phone text,
  email text,
  venmo_account text NOT NULL DEFAULT '',
  notification_preferences jsonb DEFAULT '{"email": true, "sms": false}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Pool Players (junction: which players belong to which pools)
CREATE TABLE pool_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid REFERENCES pools(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  is_active boolean DEFAULT true,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(pool_id, player_id)
);

-- Registration Links (one-time use tokens for joining pools)
CREATE TABLE registration_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid REFERENCES pools(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL DEFAULT generate_registration_token(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  used_at timestamptz,
  used_by uuid REFERENCES players(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Sessions (proposed game times)
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid REFERENCES pools(id) ON DELETE CASCADE NOT NULL,
  
  -- Date/time
  proposed_date date NOT NULL,
  proposed_time time NOT NULL,
  duration_minutes integer DEFAULT 60 CHECK (duration_minutes > 0 AND duration_minutes % 30 = 0),
  
  -- Player limits
  min_players integer DEFAULT 4 CHECK (min_players >= 4),
  max_players integer DEFAULT 7 CHECK (max_players >= min_players),
  
  -- Status
  status session_status DEFAULT 'proposed',
  
  -- Court booking
  court_booking_ids text[],
  court_numbers text[],
  court_location text,
  courts_needed integer DEFAULT 1 CHECK (courts_needed >= 1),
  
  -- Cost fields
  admin_cost_per_court decimal(10,2) DEFAULT 9.00,
  guest_pool_per_court decimal(10,2) DEFAULT 48.00,
  
  -- Payment deadline (when roster locks)
  payment_deadline timestamptz,
  roster_locked boolean DEFAULT false,
  
  -- Future: recurring sessions
  is_recurring boolean DEFAULT false,
  recurring_pattern jsonb,
  
  -- Metadata
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Session Participants (who's in/out for each session)
CREATE TABLE session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  
  is_admin boolean DEFAULT false,
  status participant_status DEFAULT 'committed',
  status_changed_at timestamptz DEFAULT now(),
  opted_in_at timestamptz DEFAULT now(),
  waitlist_position integer,
  
  UNIQUE(session_id, player_id)
);

-- Payments (track Venmo payments - guests only)
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_participant_id uuid REFERENCES session_participants(id) ON DELETE CASCADE NOT NULL,
  
  amount decimal(10,2) NOT NULL,
  payment_method text DEFAULT 'venmo' CHECK (payment_method IN ('venmo', 'stripe')),
  venmo_transaction_id text,
  venmo_payment_link text,
  
  venmo_request_sent_at timestamptz,
  payment_date timestamptz,
  refunded_at timestamptz,
  
  status payment_status DEFAULT 'pending',
  replacement_found boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_pools_owner ON pools(owner_id);
CREATE INDEX idx_pools_slug ON pools(slug);
CREATE INDEX idx_pools_active ON pools(is_active) WHERE is_active = true;

CREATE INDEX idx_players_user ON players(user_id);
CREATE INDEX idx_players_email ON players(email);

CREATE INDEX idx_pool_players_pool ON pool_players(pool_id);
CREATE INDEX idx_pool_players_player ON pool_players(player_id);

CREATE INDEX idx_registration_links_token ON registration_links(token);
CREATE INDEX idx_registration_links_pool ON registration_links(pool_id);
CREATE INDEX idx_registration_links_created_by ON registration_links(created_by);
CREATE INDEX idx_registration_links_used_by ON registration_links(used_by);

CREATE INDEX idx_sessions_pool ON sessions(pool_id);
CREATE INDEX idx_sessions_date ON sessions(proposed_date);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_by ON sessions(created_by);

CREATE INDEX idx_session_participants_session ON session_participants(session_id);
CREATE INDEX idx_session_participants_player ON session_participants(player_id);

CREATE INDEX idx_payments_participant ON payments(session_participant_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ============================================
-- BUSINESS LOGIC FUNCTIONS
-- ============================================

-- Calculate courts needed (4-7 = 1, 8-11 = 2, etc.)
CREATE OR REPLACE FUNCTION calculate_courts_needed(player_count integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF player_count < 4 THEN RETURN 0; END IF;
  RETURN greatest(1, ceil((player_count - 3)::decimal / 4)::integer);
END;
$$;

-- Get session cost summary
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
  v_total integer;
  v_guests integer;
  v_courts integer;
BEGIN
  SELECT s.admin_cost_per_court, s.guest_pool_per_court 
  INTO v_admin_cost_per_court, v_guest_pool_per_court
  FROM sessions s WHERE s.id = p_session_id;
  
  SELECT 
    count(*) FILTER (WHERE sp.status IN ('committed', 'paid')),
    count(*) FILTER (WHERE sp.status IN ('committed', 'paid') AND NOT sp.is_admin)
  INTO v_total, v_guests
  FROM session_participants sp
  WHERE sp.session_id = p_session_id;
  
  v_courts := calculate_courts_needed(v_total);
  
  RETURN QUERY SELECT
    v_total,
    v_guests,
    v_courts,
    (v_admin_cost_per_court * v_courts),
    (v_guest_pool_per_court * v_courts),
    CASE WHEN v_guests > 0 
      THEN (v_guest_pool_per_court * v_courts) / v_guests
      ELSE 0::decimal
    END;
END;
$$;

-- ============================================
-- RLS HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================

-- Check if user is a pool member
CREATE OR REPLACE FUNCTION user_is_pool_member(pool_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pool_players pp
    JOIN players p ON pp.player_id = p.id
    WHERE pp.pool_id = pool_uuid
      AND p.user_id = user_uuid
      AND pp.is_active = true
  );
$$;

-- Check if pool has valid registration link
CREATE OR REPLACE FUNCTION pool_has_valid_registration_link(pool_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM registration_links
    WHERE pool_id = pool_uuid
      AND used_at IS NULL
      AND expires_at > now()
  );
$$;

-- Get player IDs in user's pools
CREATE OR REPLACE FUNCTION get_players_in_user_pools(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT pp2.player_id
  FROM pool_players pp1
  JOIN players p ON pp1.player_id = p.id
  JOIN pool_players pp2 ON pp1.pool_id = pp2.pool_id
  WHERE p.user_id = p_user_id;
$$;

-- Link player to user (for post-registration)
CREATE OR REPLACE FUNCTION link_player_to_user(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_user_id uuid;
  v_existing_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  SELECT id, user_id INTO v_player_id, v_existing_user_id
  FROM players WHERE lower(email) = lower(p_email);
  
  IF v_player_id IS NULL THEN RETURN NULL; END IF;
  IF v_existing_user_id = v_user_id THEN RETURN v_player_id; END IF;
  IF v_existing_user_id IS NOT NULL THEN RETURN v_player_id; END IF;
  
  UPDATE players SET user_id = v_user_id, updated_at = now() WHERE id = v_player_id;
  RETURN v_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION link_player_to_user(text) TO authenticated;

-- Create player for registration (bypasses RLS)
CREATE OR REPLACE FUNCTION create_player_for_registration(
  p_name text,
  p_phone text,
  p_email text,
  p_venmo_account text,
  p_notification_preferences jsonb DEFAULT '{"email": true, "sms": false}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  player_id uuid;
BEGIN
  INSERT INTO players (name, phone, email, venmo_account, notification_preferences)
  VALUES (p_name, p_phone, p_email, p_venmo_account, p_notification_preferences)
  RETURNING id INTO player_id;
  RETURN player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_player_for_registration TO anon, authenticated;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update timestamps
CREATE TRIGGER update_pools_updated_at
  BEFORE UPDATE ON pools FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update participant status timestamp
CREATE OR REPLACE FUNCTION update_participant_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_participant_status_timestamp
  BEFORE UPDATE ON session_participants FOR EACH ROW EXECUTE FUNCTION update_participant_status_changed();

-- Auto-set owner_id from auth.uid()
CREATE OR REPLACE FUNCTION set_pool_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN NEW.owner_id = auth.uid(); END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_pool_owner_on_insert
  BEFORE INSERT ON pools FOR EACH ROW EXECUTE FUNCTION set_pool_owner();

-- Auto-generate slug for pools
CREATE OR REPLACE FUNCTION set_pool_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 1;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := generate_slug(NEW.name);
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM pools WHERE slug = final_slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
      final_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_pool_slug_on_change
  BEFORE INSERT OR UPDATE ON pools FOR EACH ROW EXECUTE FUNCTION set_pool_slug();

-- Auto-add owner to pool as player/member
CREATE OR REPLACE FUNCTION add_owner_to_pool()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_user_email text;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = NEW.owner_id;
  SELECT id INTO v_player_id FROM players WHERE user_id = NEW.owner_id;
  
  IF v_player_id IS NULL THEN
    INSERT INTO players (name, email, user_id, venmo_account, notification_preferences)
    VALUES (
      COALESCE(split_part(v_user_email, '@', 1), 'Pool Owner'),
      v_user_email,
      NEW.owner_id,
      '',
      '{"email": true, "sms": false}'::jsonb
    )
    RETURNING id INTO v_player_id;
  END IF;
  
  INSERT INTO pool_players (pool_id, player_id, is_active)
  VALUES (NEW.id, v_player_id, true)
  ON CONFLICT (pool_id, player_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER add_owner_to_pool_trigger
  AFTER INSERT ON pools FOR EACH ROW EXECUTE FUNCTION add_owner_to_pool();

-- Auto-add admin to session when created
CREATE OR REPLACE FUNCTION add_admin_to_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_player_id uuid;
BEGIN
  SELECT owner_id INTO v_owner_id FROM pools WHERE id = NEW.pool_id;
  SELECT id INTO v_player_id FROM players WHERE user_id = v_owner_id;
  
  IF v_player_id IS NOT NULL THEN
    INSERT INTO session_participants (session_id, player_id, is_admin, status, opted_in_at, status_changed_at)
    VALUES (NEW.id, v_player_id, true, 'committed', now(), now())
    ON CONFLICT (session_id, player_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER add_admin_to_session_trigger
  AFTER INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION add_admin_to_session();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- POOLS
CREATE POLICY "Users can view their pools" ON pools FOR SELECT USING (
  owner_id = (select auth.uid())
  OR user_is_pool_member(id, (select auth.uid()))
  OR pool_has_valid_registration_link(id)
);

CREATE POLICY "Owners can update their pools" ON pools FOR UPDATE USING (owner_id = (select auth.uid()));

CREATE POLICY "Authenticated users can create pools" ON pools FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- PLAYERS
CREATE POLICY "Users can view players in their pools" ON players FOR SELECT USING (
  user_id = (select auth.uid())
  OR id IN (SELECT get_players_in_user_pools((select auth.uid())))
);

CREATE POLICY "Users can update their own player" ON players FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "Public can create players during registration" ON players FOR INSERT WITH CHECK (true);

-- POOL_PLAYERS
CREATE POLICY "Pool members can view pool_players" ON pool_players FOR SELECT USING (
  user_is_pool_member(pool_id, (select auth.uid()))
  OR pool_id IN (SELECT id FROM pools WHERE owner_id = (select auth.uid()))
);

CREATE POLICY "Public can add players via registration" ON pool_players FOR INSERT WITH CHECK (
  pool_id IN (SELECT pool_id FROM registration_links WHERE used_at IS NULL AND expires_at > now())
);

-- REGISTRATION_LINKS
CREATE POLICY "Public can validate registration tokens" ON registration_links FOR SELECT USING (true);

CREATE POLICY "Pool owners can create registration links" ON registration_links FOR INSERT WITH CHECK (
  pool_id IN (SELECT id FROM pools WHERE owner_id = (select auth.uid()))
);

CREATE POLICY "Public can mark registration links as used" ON registration_links FOR UPDATE 
  USING (used_at IS NULL AND expires_at > now())
  WITH CHECK (used_at IS NOT NULL AND used_by IS NOT NULL);

-- SESSIONS
CREATE POLICY "Pool members can view sessions" ON sessions FOR SELECT USING (
  pool_id IN (
    SELECT pp.pool_id FROM pool_players pp
    JOIN players p ON pp.player_id = p.id
    WHERE p.user_id = (select auth.uid())
  )
  OR pool_id IN (SELECT id FROM pools WHERE owner_id = (select auth.uid()))
);

CREATE POLICY "Pool owners can create sessions" ON sessions FOR INSERT WITH CHECK (
  pool_id IN (SELECT id FROM pools WHERE owner_id = (select auth.uid()))
);

CREATE POLICY "Pool owners can update sessions" ON sessions FOR UPDATE USING (
  pool_id IN (SELECT id FROM pools WHERE owner_id = (select auth.uid()))
);

-- SESSION_PARTICIPANTS
CREATE POLICY "Pool members can view participants" ON session_participants FOR SELECT USING (
  session_id IN (
    SELECT s.id FROM sessions s
    WHERE s.pool_id IN (
      SELECT pp.pool_id FROM pool_players pp
      JOIN players p ON pp.player_id = p.id
      WHERE p.user_id = (select auth.uid())
    )
    OR s.pool_id IN (SELECT id FROM pools WHERE owner_id = (select auth.uid()))
  )
);

CREATE POLICY "Players can insert their own participation" ON session_participants FOR INSERT WITH CHECK (
  player_id IN (SELECT id FROM players WHERE user_id = (select auth.uid()))
);

CREATE POLICY "Players can update their own participation" ON session_participants FOR UPDATE USING (
  player_id IN (SELECT id FROM players WHERE user_id = (select auth.uid()))
);

-- PAYMENTS (single SELECT policy combining player + owner access)
CREATE POLICY "Users can view relevant payments" ON payments FOR SELECT USING (
  -- Players can see their own payments
  session_participant_id IN (
    SELECT sp.id FROM session_participants sp
    JOIN players p ON sp.player_id = p.id
    WHERE p.user_id = (select auth.uid())
  )
  -- Pool owners can see all payments in their pools
  OR session_participant_id IN (
    SELECT sp.id FROM session_participants sp
    JOIN sessions s ON sp.session_id = s.id
    JOIN pools po ON s.pool_id = po.id
    WHERE po.owner_id = (select auth.uid())
  )
);

-- Pool owners can insert payments
CREATE POLICY "Pool owners can insert payments" ON payments FOR INSERT WITH CHECK (
  session_participant_id IN (
    SELECT sp.id FROM session_participants sp
    JOIN sessions s ON sp.session_id = s.id
    JOIN pools po ON s.pool_id = po.id
    WHERE po.owner_id = (select auth.uid())
  )
);

-- Pool owners can update payments
CREATE POLICY "Pool owners can update payments" ON payments FOR UPDATE USING (
  session_participant_id IN (
    SELECT sp.id FROM session_participants sp
    JOIN sessions s ON sp.session_id = s.id
    JOIN pools po ON s.pool_id = po.id
    WHERE po.owner_id = (select auth.uid())
  )
);

-- Pool owners can delete payments
CREATE POLICY "Pool owners can delete payments" ON payments FOR DELETE USING (
  session_participant_id IN (
    SELECT sp.id FROM session_participants sp
    JOIN sessions s ON sp.session_id = s.id
    JOIN pools po ON s.pool_id = po.id
    WHERE po.owner_id = (select auth.uid())
  )
);


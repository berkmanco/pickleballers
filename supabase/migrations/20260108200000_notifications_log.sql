-- ============================================
-- Notifications Log Table
-- ============================================
-- Tracks all notifications sent (email/SMS) for auditing and debugging.

-- Notification type enum
CREATE TYPE notification_type AS ENUM (
  'session_created',
  'roster_locked',
  'payment_reminder',
  'session_reminder',
  'waitlist_promoted'
);

-- Notification channel enum
CREATE TYPE notification_channel AS ENUM ('email', 'sms');

-- Notifications log table
CREATE TABLE notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Index for querying by session
CREATE INDEX idx_notifications_log_session ON notifications_log(session_id);

-- Index for querying by player
CREATE INDEX idx_notifications_log_player ON notifications_log(player_id);

-- Index for querying recent notifications
CREATE INDEX idx_notifications_log_created ON notifications_log(created_at DESC);

-- RLS Policies
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

-- Pool owners can view notifications for their sessions
CREATE POLICY "Pool owners can view session notifications"
  ON notifications_log FOR SELECT
  USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN pools p ON s.pool_id = p.id
      WHERE p.owner_id = auth.uid()
    )
  );

-- Players can view their own notifications
CREATE POLICY "Players can view own notifications"
  ON notifications_log FOR SELECT
  USING (
    player_id IN (
      SELECT id FROM players WHERE user_id = auth.uid()
    )
  );

-- Service role can insert (edge functions)
CREATE POLICY "Service role can insert notifications"
  ON notifications_log FOR INSERT
  WITH CHECK (true);

-- Grant insert to service role
GRANT INSERT ON notifications_log TO service_role;

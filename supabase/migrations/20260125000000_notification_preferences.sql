-- Create notification preferences table for granular notification control
-- This enables Twilio compliance (separate opt-in per message type)

CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  email_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure one row per user per notification type
  UNIQUE(user_id, notification_type),
  
  -- Valid notification types
  CHECK (notification_type IN (
    'session_reminder_24h',
    'payment_request',
    'payment_reminder',
    'waitlist_promotion',
    'session_cancelled',
    'pool_invitation'
  ))
);

-- Index for fast lookups by user
CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete own notification preferences"
  ON notification_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Migrate existing SMS preferences
-- If user has sms_notifications = true, enable SMS for session reminders and payment requests
INSERT INTO notification_preferences (user_id, notification_type, email_enabled, sms_enabled)
SELECT 
  p.user_id,
  unnest(ARRAY['session_reminder_24h', 'payment_request']) as notification_type,
  true as email_enabled,
  COALESCE(p.sms_notifications, false) as sms_enabled
FROM players p
WHERE p.user_id IS NOT NULL
ON CONFLICT (user_id, notification_type) DO NOTHING;

COMMENT ON TABLE notification_preferences IS 'Granular per-user notification preferences for email and SMS channels';
COMMENT ON COLUMN notification_preferences.notification_type IS 'Type of notification: session_reminder_24h, payment_request, payment_reminder, waitlist_promotion, session_cancelled, pool_invitation';
COMMENT ON COLUMN notification_preferences.email_enabled IS 'Whether user wants email notifications for this type (default: true)';
COMMENT ON COLUMN notification_preferences.sms_enabled IS 'Whether user wants SMS notifications for this type (default: false, requires explicit opt-in)';

# Notification Preferences System

## Overview
Granular per-user notification preferences allowing users to opt-in/opt-out of specific notification types via email and/or SMS.

## Motivation
- **Twilio Compliance**: Error 30504 requires separate opt-in for each SMS message type
- **User Control**: Professional apps give users granular control over notifications
- **Future-Proof**: Easy to add new notification types without code changes

---

## Notification Types

| Type | Description | Default Email | Default SMS | Channel |
|------|-------------|---------------|-------------|---------|
| `session_reminder_24h` | 24-hour before session reminder | ✓ ON | ✗ OFF | Both |
| `payment_request` | Payment request for completed session | ✓ ON | ✗ OFF | Both |
| `payment_reminder` | Reminder for unpaid balance | ✓ ON | ✗ OFF | Both |
| `waitlist_promotion` | Promoted from waitlist to committed | ✓ ON | ✗ OFF | Email only |
| `session_cancelled` | Session cancelled by admin | ✓ ON | ✗ OFF | Email only |
| `pool_invitation` | Invited to join a pool | ✓ ON | ✗ OFF | Email only |

**Notes:**
- Email is ON by default for all types
- SMS is OFF by default for all types (explicit opt-in required)
- Some types are email-only to avoid Twilio complexity
- Users must have phone number to enable SMS for any type

---

## Database Schema

### Table: `notification_preferences`

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  email_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, notification_type)
);

-- Index for fast lookups
CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);

-- RLS Policies
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id);
```

### Supported Notification Types (enum-like constraint)
```sql
ALTER TABLE notification_preferences
  ADD CONSTRAINT valid_notification_type
  CHECK (notification_type IN (
    'session_reminder_24h',
    'payment_request',
    'payment_reminder',
    'waitlist_promotion',
    'session_cancelled',
    'pool_invitation'
  ));
```

---

## UI Design

### Settings Page - Notification Preferences Section

```
┌─────────────────────────────────────────────────────┐
│ Notification Preferences                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Choose how you want to be notified:                │
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ Notification Type          Email    SMS         ││
│ ├─────────────────────────────────────────────────┤│
│ │ 24-hour session reminders    [✓]    [ ]        ││
│ │ Payment requests             [✓]    [ ]        ││
│ │ Payment reminders            [✓]    [ ]        ││
│ │ Waitlist promotions          [✓]    —          ││
│ │ Session cancellations        [✓]    —          ││
│ │ Pool invitations             [✓]    —          ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ ℹ️ SMS requires a phone number (add above)         │
│ ℹ️ Reply STOP to any SMS to unsubscribe from all   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**SMS Checkboxes Show Individual Disclosures:**
- Each SMS checkbox has hover/tooltip with specific disclosure
- Example: "Receive SMS for 24-hour session reminders. Reply STOP to opt out."

---

## API / Library Functions

### `src/lib/notificationPreferences.ts`

```typescript
export type NotificationType = 
  | 'session_reminder_24h'
  | 'payment_request'
  | 'payment_reminder'
  | 'waitlist_promotion'
  | 'session_cancelled'
  | 'pool_invitation'

export interface NotificationPreference {
  id: string
  user_id: string
  notification_type: NotificationType
  email_enabled: boolean
  sms_enabled: boolean
}

// Get user's preferences (with defaults)
export async function getUserPreferences(userId: string): Promise<Map<NotificationType, NotificationPreference>>

// Update single preference
export async function updatePreference(
  userId: string,
  notificationType: NotificationType,
  emailEnabled: boolean,
  smsEnabled: boolean
): Promise<void>

// Check if user should receive notification
export async function shouldNotify(
  userId: string,
  notificationType: NotificationType,
  channel: 'email' | 'sms'
): Promise<boolean>

// Initialize defaults for new user
export async function initializeDefaultPreferences(userId: string): Promise<void>
```

---

## Integration with Notification Sending

### Before: `src/lib/notifications.ts`
```typescript
// Old: Simple boolean check
if (user.sms_notifications && user.phone) {
  await sendSMS(user.phone, message)
}
```

### After:
```typescript
import { shouldNotify } from './notificationPreferences'

// New: Check granular preference
if (await shouldNotify(user.id, 'session_reminder_24h', 'sms') && user.phone) {
  await sendSMS(user.phone, message)
}

if (await shouldNotify(user.id, 'session_reminder_24h', 'email') && user.email) {
  await sendEmail(user.email, message)
}
```

---

## Migration Strategy

1. **Create table** with defaults (email ON, SMS OFF)
2. **Migrate existing users**: 
   - If `players.sms_notifications = true` → enable SMS for session_reminder_24h and payment_request
   - If `players.sms_notifications = false` → keep all SMS disabled
3. **Update Settings UI** to show new matrix
4. **Update notification logic** to check preferences
5. **Deprecate** `players.sms_notifications` column (keep for backwards compatibility initially)

---

## Twilio Compliance

### Submission Updates

**Use Case Description:**
```
DinkUp is a pickleball app. Users receive OPTIONAL SMS via separate opt-ins:

1. Session Reminders: "I agree to receive SMS for 24-hour game reminders from DinkUp"
2. Payment Requests: "I agree to receive SMS for payment requests from DinkUp"
3. Payment Reminders: "I agree to receive SMS for payment reminders from DinkUp"

Each checkbox has disclosure: "Receive SMS text messages for [type]. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe." Checkboxes unchecked by default. Email is default.
```

**Screenshot Requirements:**
- Show all 3 SMS checkboxes unchecked
- Show full disclosure text for at least one type
- Show DinkUp branding

---

## Testing

### Test Coverage
- ✅ Default preferences created for new user
- ✅ Update preferences per notification type
- ✅ shouldNotify() respects preferences
- ✅ Notification logic checks preferences before sending
- ✅ SMS disabled if no phone number
- ✅ Email/SMS toggle independently

---

## Future Enhancements
- Per-pool notification preferences (mute specific pools)
- Quiet hours (no SMS between 10pm-8am)
- Digest mode (batch notifications)
- In-app notification center

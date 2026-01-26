# Welcome Email for New Pool Members

## Overview

When a new player joins a pool via the registration link, they automatically receive a welcome email that includes:
- Friendly greeting with pool name
- List of upcoming sessions (next 30 days)
- Link to pool page to RSVP
- Tip about enabling notifications

This improves onboarding and ensures new members can immediately see and join upcoming sessions.

## Features

### Email Contents
- **Personalized greeting**: Uses player's first name and pool name
- **Upcoming sessions**: Up to 10 sessions in the next 30 days
  - Date (formatted: "Saturday, Jan 27")
  - Time (formatted: "9:00 AM")
  - Location
- **Call-to-action**: "View Pool & Sessions" button → takes them to pool page
- **Settings tip**: Reminder to enable notifications
- **Graceful fallback**: Shows friendly message if no sessions scheduled

### Timing
- **Triggered**: Immediately after successful registration via invite link
- **Fire-and-forget**: Doesn't block the registration flow
- **Recipient**: Sent to the **new player** (not the pool owner)

### Technical Details
- **Notification type**: `player_welcome`
- **Edge Function**: `supabase/functions/notify/index.ts` → `notifyPlayerWelcome()`
- **Email service**: Resend
- **Template**: Branded DinkUp email template with teal colors

## Implementation

### Registration Flow

```typescript
// src/lib/registration.ts

async function registerPlayer(tokenOrSlug: string, data: RegistrationData) {
  // ... create player and add to pool ...
  
  // Send notifications (fire-and-forget)
  
  // 1. Notify pool owner about new player
  notifyPlayerJoined(link.pool_id, player.id).catch(console.error)
  
  // 2. Send welcome email to new player ← NEW
  notifyPlayerWelcome(link.pool_id, player.id).catch(console.error)
  
  return { player, pool }
}
```

### Notifications Library

```typescript
// src/lib/notifications.ts

/**
 * Send welcome email to new player with upcoming sessions
 */
export async function notifyPlayerWelcome(
  poolId: string,
  playerId: string
): Promise<NotifyResult> {
  return sendNotification('player_welcome', { poolId, playerId });
}
```

### Edge Function Handler

```typescript
// supabase/functions/notify/index.ts

async function notifyPlayerWelcome(
  supabase: SupabaseClient, 
  poolId: string, 
  playerId: string
) {
  // 1. Get pool details
  const pool = await fetchPool(poolId)
  
  // 2. Get new player details (must have email)
  const player = await fetchPlayer(playerId)
  if (!player.email) return { sent: 0, ... }
  
  // 3. Get upcoming sessions (next 30 days, max 10)
  const sessions = await fetchUpcomingSessions(poolId)
  
  // 4. Build email with session list
  const html = emailTemplate({
    title: `Welcome to ${pool.name}! 🎉`,
    body: `
      <p>Hey ${getFirstName(player.name)}!</p>
      <p>Welcome to <strong>${pool.name}</strong>! ...</p>
      ${sessionsHtml}
      <p>Pro tip: Enable notifications in your settings!</p>
    `,
    ctaText: "View Pool & Sessions",
    ctaUrl: `${APP_URL}/p/${pool.slug || pool.id}`,
  })
  
  // 5. Send email
  await sendEmail(player.email, `Welcome to ${pool.name}! 🏓`, html)
  
  // 6. Log notification
  await logNotification(supabase, "player_welcome", null, player.id, "email", true)
}
```

## Example Email

### With Sessions

```
Subject: Welcome to Weekend Warriors! 🏓

Welcome to Weekend Warriors! 🎉

Hey Mike!

Welcome to Weekend Warriors! We're excited to have you join us for some pickleball. 🏓

Upcoming Sessions:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Saturday, Jan 27 at 9:00 AM
📍 Pickle Shack

📅 Wednesday, Jan 30 at 6:30 PM
📍 Pickle Shack

📅 Friday, Feb 2 at 6:00 PM
📍 Jerome Park
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Click below to RSVP for sessions and coordinate with your pool members!

[View Pool & Sessions]

Pro tip: Enable notifications in your settings to get reminders about 
upcoming sessions and important updates!
```

### Without Sessions

```
Subject: Welcome to Weekend Warriors! 🏓

Welcome to Weekend Warriors! 🎉

Hey Mike!

Welcome to Weekend Warriors! We're excited to have you join us for some pickleball. 🏓

No upcoming sessions scheduled yet. Check back soon or reach out to your pool admin!

[View Pool & Sessions]

Pro tip: Enable notifications in your settings to get reminders about 
upcoming sessions and important updates!
```

## When It Fires

**FIRES** ✅
- Player registers via multi-use link (`/r/pool-slug`)
- Player registers via token-based link (legacy)
- Player has an email address

**DOES NOT FIRE** ❌
- Pool owner manually adds player via "Add Existing Player"
- Pool owner manually creates new player via "Create New Player"
- Player has no email address

## Benefits

1. **Reduces confusion**: New members immediately see what's happening
2. **Increases engagement**: Direct link to RSVP for sessions
3. **Professional onboarding**: Sets expectations for communication
4. **Prevents missed sessions**: Shows sessions that were proposed before they joined
5. **Encourages settings**: Reminds users to configure notifications

## Session Query Logic

```typescript
// Get upcoming sessions (next 30 days)
const today = new Date().toISOString().split('T')[0]
const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0]

const sessions = await supabase
  .from('sessions')
  .select('id, proposed_date, proposed_time, court_location, court_numbers')
  .eq('pool_id', poolId)
  .gte('proposed_date', today)
  .lte('proposed_date', thirtyDaysFromNow)
  .in('status', ['proposed', 'confirmed']) // Exclude cancelled
  .order('proposed_date', { ascending: true })
  .limit(10) // Cap at 10 sessions
```

## Email Template Structure

```typescript
emailTemplate({
  title: string,           // "Welcome to {Pool Name}! 🎉"
  preheader: string,       // "You're now a member of..."
  body: string,            // HTML content with sessions
  ctaText: string,         // Button text
  ctaUrl: string,          // Link to pool page
})
```

## Related Notifications

| Notification | Recipient | Trigger | Purpose |
|--------------|-----------|---------|---------|
| `player_welcome` | New player | Player registers | Onboard new member |
| `player_joined` | Pool owner | Player registers | Inform owner |
| `session_created` | Pool members | Session created | Alert about new session |

## Testing

**Test file**: `tests/notifications.test.ts`

**Test**:
```typescript
describe('player_welcome', () => {
  it('should send welcome email to new player', async () => {
    const result = await callEdgeFunction('notify', {
      type: 'player_welcome',
      poolId: testPoolId,
      playerId: testPlayerId,
    })
    
    expect(result.status).toBe(200)
    expect(result.data.success).toBe(true)
    expect(result.data.sent).toBeGreaterThanOrEqual(1)
  })
})
```

**Run tests**:
```bash
npm test -- notifications.test.ts
```

## Future Enhancements

- **SMS version**: Send SMS welcome message (when Twilio approved)
- **Customizable template**: Allow pool owners to add custom welcome message
- **Player bios**: Show other pool members in welcome email
- **Pool stats**: "You're the 15th member!" fun fact
- **Onboarding checklist**: Steps to complete profile, enable notifications, etc.
- **Calendar integration**: ICS file attachment with all upcoming sessions
- **Video/image**: Pool photo or welcome video embed

## Troubleshooting

### Email not received

1. **Check player has email**: Query `players` table
2. **Check spam folder**: Resend sender may be flagged
3. **Check notification logs**: `notifications_log` table for errors
4. **Check Edge Function logs**: Supabase dashboard → Edge Functions → notify
5. **Verify registration completed**: Player should exist in `pool_players`

### No sessions shown in email

This is **expected** if:
- No sessions scheduled yet
- All sessions are > 30 days away
- All sessions are in the past
- All sessions are cancelled

The email will show a fallback message in this case.

## Configuration

No configuration needed! The feature is:
- **Always on** for registrations via invite link
- **Automatic** (no admin action required)
- **Graceful** (handles errors silently)

## Related Files

- `src/lib/registration.ts` - Triggers notification
- `src/lib/notifications.ts` - Client function
- `supabase/functions/notify/index.ts` - Edge Function handler
- `tests/notifications.test.ts` - Tests
- `FEATURE_STATUS.md` - Feature tracking

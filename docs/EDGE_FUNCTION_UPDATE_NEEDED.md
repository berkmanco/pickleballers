# Edge Function Update Required for Notification Preferences

## Current State
The Edge Function (`supabase/functions/notify/index.ts`) currently checks:
```typescript
if (player.notification_preferences?.email) { /* send email */ }
if (player.notification_preferences?.sms) { /* send SMS */ }
```

This uses the old boolean system from the `players.notification_preferences` JSON column.

## Required Changes

### 1. Add Helper Function to Edge Function
Add this function after the `logNotification` function (around line 780):

```typescript
// Check if user should receive notification based on granular preferences
async function shouldNotifyUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  notificationType: string,
  channel: 'email' | 'sms'
): Promise<boolean> {
  const { data } = await supabase
    .from('notification_preferences')
    .select('email_enabled, sms_enabled')
    .eq('user_id', userId)
    .eq('notification_type', notificationType)
    .maybeSingle();

  if (!data) {
    // Default: email ON, SMS OFF
    return channel === 'email' ? true : false;
  }

  return channel === 'email' ? data.email_enabled : data.sms_enabled;
}
```

### 2. Update Notification Type Mapping
Add this mapping to convert our notification function names to preference types:

```typescript
// Map notification types to preference types
const NOTIFICATION_TYPE_MAP: Record<NotificationType, string> = {
  'session_created': 'pool_invitation', // or maybe 'session_created' if we add it
  'roster_locked': 'payment_request',
  'payment_reminder': 'payment_reminder',
  'session_reminder': 'session_reminder_24h',
  'waitlist_promoted': 'waitlist_promotion',
  'session_cancelled': 'session_cancelled',
  'commitment_reminder': 'pool_invitation', // Could be new type
  'admin_low_commitment': 'pool_invitation', // Admin only
};
```

### 3. Replace All Email Checks
Find and replace all instances of:
```typescript
if (player.email && player.notification_preferences?.email) {
```

With:
```typescript
const userIdResult = await supabase
  .from('players')
  .select('user_id')
  .eq('id', player.id)
  .single();

const userId = userIdResult.data?.user_id;
if (player.email && userId && await shouldNotifyUser(supabase, userId, NOTIFICATION_TYPE_MAP[type], 'email')) {
```

### 4. Replace All SMS Checks
Find and replace all instances of:
```typescript
if (player.phone && player.notification_preferences?.sms) {
```

With:
```typescript
const userIdResult = await supabase
  .from('players')
  .select('user_id')
  .eq('id', player.id)
  .single();

const userId = userIdResult.data?.user_id;
if (player.phone && userId && await shouldNotifyUser(supabase, userId, NOTIFICATION_TYPE_MAP[type], 'sms')) {
```

### 5. Optimize: Fetch user_id with player
Instead of separate queries, update the player selects to include `user_id`:

```typescript
.select("player:players(id, user_id, name, email, phone)")
```

Then check becomes simpler:
```typescript
if (player.email && player.user_id && await shouldNotifyUser(supabase, player.user_id, NOTIFICATION_TYPE_MAP[type], 'email')) {
```

## Files to Update
- `/Users/mberkman/Code/BerkmanCo/DinkUp/supabase/functions/notify/index.ts` (main file)

## Occurrences to Update
Search for these patterns and update each:
1. `player.notification_preferences?.email` (11 occurrences)
2. `player.notification_preferences?.sms` (6 occurrences)

## Testing After Update
1. Run `supabase db push` to apply migration
2. Test each notification type:
   - Session reminders (email + SMS)
   - Payment requests (email + SMS)  
   - Payment reminders (email + SMS)
   - Waitlist promotions (email only in UI, but code supports both)
   - Session cancelled (email only)

## Alternative: Simpler Approach
Keep the old `players.notification_preferences` column and sync it from the new table.
Add a trigger to update the JSON column when notification_preferences rows change.
This avoids updating the Edge Function, but adds complexity in the database.

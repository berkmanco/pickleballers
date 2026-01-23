# Session Cancellation with Notifications

## Overview
Session owners can cancel sessions before they happen. When a session is cancelled, all participants (both committed and waitlisted) are automatically notified via email and SMS.

## Feature Details

### Who Can Cancel
- **Pool owner only** (session creator)
- Can only cancel if:
  - Roster is not locked
  - Session is not in the past
  - Session is not already cancelled

### What Happens When Cancelled
1. **Session status** is set to `cancelled`
2. **Notifications sent** to all participants via:
   - Email (if enabled in preferences)
   - SMS (if enabled in preferences and Twilio is active)
3. **Session data preserved** (not deleted, just marked as cancelled)
4. **UI updates** to show cancellation banner

### Notifications Sent

#### Email Notification
- **Subject**: `Session Cancelled: [Pool Name] - [Date]`
- **Content**:
  - Clear cancellation message
  - Session details (date, time, location, pool)
  - Link to view pool for future sessions
  - Red/error styling to emphasize cancellation

#### SMS Notification
- **Format**: `🏓 Session Cancelled: [Pool Name] on [Date] at [Time] has been cancelled. We hope to see you at the next session! View pool: [URL]`
- **Character count**: ~160 characters (single SMS)

## User Flow

1. **Owner navigates** to session details page
2. **Clicks "Cancel Session"** button in admin actions
3. **Confirmation dialog** appears: "Cancel this session? Participants will be notified."
4. **Owner confirms** cancellation
5. **Session status updated** to cancelled
6. **Notifications sent** asynchronously to all participants
7. **UI updates** with red cancellation banner

## Implementation Details

### Modified Files

#### 1. `/supabase/functions/notify/index.ts`
- Added `session_cancelled` to `NotificationType` enum
- Implemented `notifySessionCancelled()` function
- Sends email + SMS to all session participants
- Logs all notification attempts

#### 2. `/src/lib/notifications.ts`
- Added `session_cancelled` to client-side `NotificationType`
- No other changes (uses existing `sendNotification()` function)

#### 3. `/src/lib/sessions.ts`
- Updated `cancelSession()` function
- Now calls `sendNotification('session_cancelled', { sessionId })`
- Fire-and-forget pattern (doesn't block on notification sending)

#### 4. `/src/pages/SessionDetails.tsx`
- Existing UI already had cancel button and confirmation
- No changes needed (already showed "Participants will be notified")

### Database
- No schema changes required
- Uses existing `notifications_log` table for tracking

### Security (RLS)
- Uses existing session RLS policies
- Only session owner (pool owner) can cancel

## Testing

### Automated Tests
- **Test**: `session_cancelled` notification
- **File**: `/tests/notifications.test.ts`
- **Covers**:
  - Notification edge function is called
  - Email sent to participants
  - Notifications logged in database
  - Proper status codes returned

### Manual Testing
1. Create a session
2. Have other pool members opt in
3. Cancel the session as owner
4. Verify participants receive email/SMS
5. Verify cancellation banner shows on session page

## Edge Cases Handled
- ✅ Participants with email disabled → no email sent
- ✅ Participants with SMS disabled → no SMS sent
- ✅ No participants in session → notifications still work (empty list)
- ✅ Notification failures logged but don't block cancellation
- ✅ Session already cancelled → UI prevents re-cancellation

## Future Enhancements
- [ ] Allow cancellation reason/message from owner
- [ ] Send cancellation to pool members who haven't opted in yet
- [ ] Track cancellation history/analytics
- [ ] Option to reschedule instead of cancel

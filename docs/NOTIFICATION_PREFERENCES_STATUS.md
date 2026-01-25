# Notification Preferences System - Implementation Summary

## ✅ Completed

### 1. Database Schema
- **File**: `supabase/migrations/20260125000000_notification_preferences.sql`
- Created `notification_preferences` table
- 6 notification types: `session_reminder_24h`, `payment_request`, `payment_reminder`, `waitlist_promotion`, `session_cancelled`, `pool_invitation`
- Supports email and SMS channels independently
- Migrated existing `players.sms_notifications` to new system
- RLS policies for user access

### 2. Client Library
- **File**: `src/lib/notificationPreferences.ts`
- `getUserPreferences()` - Get all preferences with defaults
- `updatePreference()` - Update single preference
- `shouldNotify()` - Check if user should receive notification
- `initializeDefaultPreferences()` - Set up defaults for new user
- `NOTIFICATION_TYPES` - Metadata for each type (labels, descriptions, SMS disclosures)

### 3. Settings UI
- **File**: `src/pages/Settings.tsx` (updated)
- Beautiful table-based preference matrix
- Email and SMS columns for each notification type
- Checkboxes disable appropriately (SMS requires phone)
- Hover tooltips show SMS disclosure text
- Saves preferences on form submit

### 4. Documentation
- **File**: `docs/NOTIFICATION_PREFERENCES.md` - Full design doc
- **File**: `docs/EDGE_FUNCTION_UPDATE_NEEDED.md` - Implementation guide for Edge Function updates

---

## ⏳ TODO

### 1. Apply Database Migration
```bash
supabase db push
```

### 2. Update Edge Function (CRITICAL)
The Edge Function (`supabase/functions/notify/index.ts`) still uses the old `player.notification_preferences?.sms` checks.

**Options:**
- **Option A** (Recommended): Follow `/docs/EDGE_FUNCTION_UPDATE_NEEDED.md` to update Edge Function
- **Option B** (Quick): Keep old `players.notification_preferences` column and sync via trigger

### 3. Test Settings UI
1. Start dev server: `npm run dev`
2. Go to Settings page
3. Verify matrix displays correctly
4. Toggle some preferences
5. Save and refresh - verify persistence

### 4. Add Tests
Create `tests/notificationPreferences.test.ts`:
- Test default preferences
- Test updating preferences
- Test shouldNotify logic
- Test migration from old system

### 5. Update Twilio Documentation
Once SMS checkboxes are working, update:
- `docs/TWILIO_TOLL_FREE_VERIFICATION.md`
- Take new screenshot showing 3 separate SMS checkboxes
- Update use case description to mention separate opt-ins

### 6. Initialize Preferences for Auth Callback
Update `src/pages/AuthCallback.tsx` or registration flow to call:
```typescript
import { initializeDefaultPreferences } from '../lib/notificationPreferences'

// After user signs up:
await initializeDefaultPreferences(user.id)
```

---

## 🎯 Twilio Compliance

### What This Fixes
- ✅ **Error 30504**: Separate opt-in for each message type
- ✅ Each SMS checkbox has own disclosure
- ✅ Users can select any combination of notification types

### Screenshot Requirements
Show Settings page with:
1. All 3 SMS checkboxes (session reminders, payment requests, payment reminders)
2. All checkboxes UNCHECKED
3. Phone number field visible
4. DinkUp branding in nav
5. Full page context

### Submission Text (Updated)
```
DinkUp is a pickleball app. Users receive OPTIONAL SMS via separate opt-ins for each message type:

1. Session Reminders: "I agree to receive SMS for 24-hour game reminders from DinkUp"
2. Payment Requests: "I agree to receive SMS for payment requests from DinkUp"  
3. Payment Reminders: "I agree to receive SMS for payment reminders from DinkUp"

Each checkbox includes disclosure: "Receive SMS text messages for [type]. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe." All checkboxes unchecked by default. Phone number required for SMS. Email is default notification method.
```

---

## 🐛 Known Issues

1. **Edge Function not updated** - Notifications still use old preference system
2. **No tests yet** - Need to add test coverage
3. **New users don't get defaults** - Need to initialize on signup

---

## 📋 Next Steps

1. **Apply migration** (`supabase db push`)
2. **Test UI locally** - Verify Settings page works
3. **Update Edge Function** - Follow guide in `docs/EDGE_FUNCTION_UPDATE_NEEDED.md`
4. **Deploy and test** - Take screenshot, resubmit to Twilio
5. **Add tests** - Write comprehensive test suite

---

## 💡 Design Decisions

### Why Separate Table?
- Twilio requires separate consent per type
- Easy to add new notification types
- Granular user control
- Audit trail of preference changes

### Why Email-Only for Some Types?
- Reduces Twilio verification complexity
- Waitlist/cancellation less time-sensitive
- Keeps SMS for truly urgent notifications

### Why Default Email ON, SMS OFF?
- SMS requires explicit opt-in (Twilio requirement)
- Email is standard for web apps
- Users expect email by default

---

## 🔗 Related Files

**Created:**
- `supabase/migrations/20260125000000_notification_preferences.sql`
- `src/lib/notificationPreferences.ts`
- `docs/NOTIFICATION_PREFERENCES.md`
- `docs/EDGE_FUNCTION_UPDATE_NEEDED.md`

**Modified:**
- `src/pages/Settings.tsx`

**Next to Modify:**
- `supabase/functions/notify/index.ts` (Edge Function)
- `src/pages/AuthCallback.tsx` (or registration flow)
- `tests/notificationPreferences.test.ts` (new file)
- `docs/TWILIO_TOLL_FREE_VERIFICATION.md`
